/* Thư viện ảnh dùng chung cho GD HOME Tools:
   - Phối cảnh 3D của dự án (bộ nhớ chung giữa Chốt mã và Quản lý dự án, nhận ảnh hoặc PDF nhiều trang).
   - Dữ liệu dùng chung toàn hệ thống: ảnh mẫu vật liệu xếp theo hạng mục.
   - Chỉnh "vùng nhìn" của ảnh trong ô vuông (không tạo ảnh mới).
   Cần shell.js và image-compression.js. */
window.GDHomeAssets = (() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const guestLibraryKey = 'gdhome_guest_library_v1';
  const hooks = { headers:defaultHeaders, guest:() => false, storeAsset:null, readAsset:null };
  const urlCache = new Map();
  const renderCache = new Map();
  const removedRenders = new Map();
  const pendingLibraryDeletes = new Set();
  const visibleRenders = (projectId,items) => items.filter(item => !removedRenders.get(projectId)?.has(item.id));
  const visibleLibrary = data => ({...data,items:data.items.filter(item => !pendingLibraryDeletes.has(item.id))});
  const notifyLibrary = () => document.dispatchEvent(new Event('gdhome:library-changed'));
  let library = null, libraryLoading = null;

  const renderChanges = typeof BroadcastChannel === 'function' ? new BroadcastChannel('gdhome-project-renders') : null;
  function invalidateRenders(projectId,broadcast = true) {
    renderCache.delete(projectId);
    document.dispatchEvent(new CustomEvent('gdhome:renders-changed',{detail:projectId}));
    if (broadcast) renderChanges?.postMessage(projectId);
  }
  if (renderChanges) renderChanges.onmessage = event => invalidateRenders(event.data,false);

  function defaultHeaders() {
    const headers = {};
    try {
      const session = JSON.parse(localStorage.getItem('gdhome_session') || 'null');
      if (session?.token) headers.Authorization = 'Bearer ' + session.token;
      const appKey = localStorage.getItem('gdhome_app_key');
      if (appKey) headers['x-app-key'] = appKey;
    } catch { /* Không có phiên đăng nhập. */ }
    return headers;
  }
  const isGuest = () => {
    try { return !!hooks.guest(); } catch { return false; }
  };
  function configure(options) { Object.assign(hooks,options); }

  async function api(url,options = {}) {
    const response = await fetch(url,{...options,headers:{...hooks.headers(),...(options.body && !(options.body instanceof FormData) ? {'Content-Type':'application/json'} : {}),...options.headers}});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw Object.assign(new Error(data.message || 'Lỗi máy chủ (' + response.status + ').'),{status:response.status});
    return data;
  }
  const toast = message => window.GDHomeShell?.toast(message);

  // ---------------------------------------------------------------- Ảnh
  async function storeAsset(blob) {
    if (hooks.storeAsset) return hooks.storeAsset(blob);
    return GDHomeImages.uploadAsset(blob,hooks.headers);
  }
  async function readAsset(name) {
    if (hooks.readAsset) return hooks.readAsset(name);
    const response = await fetch('/api/materials/assets/' + name,{headers:hooks.headers()});
    if (!response.ok) throw new Error('Không mở được ảnh.');
    return response.blob();
  }
  function assetUrl(name) {
    if (!urlCache.has(name)) urlCache.set(name,readAsset(name).then(URL.createObjectURL).catch(error => { urlCache.delete(name); throw error; }));
    return urlCache.get(name);
  }
  async function hydrate(root) {
    await Promise.all([...root.querySelectorAll('img[data-lib-asset]')].map(async img => {
      try {
        img.src = await assetUrl(img.dataset.libAsset);
        if (img.dataset.display === 'pad') { await img.decode(); GDHomeImages.applyPadding(img); }
      } catch { img.alt = 'Ảnh chưa tải được'; }
    }));
  }
  async function uploadImage(file) {
    const {full,thumb} = await GDHomeImages.compress(file);
    const fullName = await storeAsset(full);
    const thumbName = thumb === full ? fullName : await storeAsset(thumb);
    return {full:fullName,thumb:thumbName,reduction:GDHomeImages.reduction(file,full)};
  }

  // ---------------------------------------------------------------- PDF → ảnh
  async function loadPdfJs() {
    if (window.pdfjsLib) return window.pdfjsLib;
    await new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = PDFJS + 'pdf.min.js';
      script.onload = resolve;
      script.onerror = () => reject(new Error('Không tải được bộ đọc PDF.'));
      document.head.append(script);
    });
    for (let wait = 0; !window.pdfjsLib && wait < 60; wait++) await new Promise(resolve => setTimeout(resolve,50));
    if (!window.pdfjsLib) throw new Error('Không tải được bộ đọc PDF.');
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    return window.pdfjsLib;
  }
  const isPdf = file => file.type === 'application/pdf' || /\.pdf$/i.test(file.name || '');
  async function* pdfPages(file) {
    const pdfjs = await loadPdfJs();
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    const pdf = await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({scale:1});
      const scale = Math.min(3,1800/Math.max(base.width,base.height));
      const viewport = page.getViewport({scale});
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const context = canvas.getContext('2d');
      context.fillStyle = '#fff';
      context.fillRect(0,0,canvas.width,canvas.height);
      await page.render({canvasContext:context,viewport}).promise;
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',0.92));
      page.cleanup();
      yield {number,total:pdf.numPages,blob:new File([blob],(file.name || 'phoi-canh').replace(/\.pdf$/i,'') + '_trang_' + number + '.jpg',{type:'image/jpeg'})};
    }
  }

  // ---------------------------------------------------------------- Phối cảnh 3D dự án
  async function loadRenders(projectId,force = false) {
    if (!projectId) return [];
    if (isGuest()) throw Object.assign(new Error('Đăng nhập để dùng kho phối cảnh 3D của dự án.'),{guest:true});
    if (!force && renderCache.has(projectId)) return visibleRenders(projectId,await renderCache.get(projectId));
    const promise = api('/api/project-hub/project?id=' + encodeURIComponent(projectId)).then(data =>
      (data.project?.hub?.documents || []).filter(doc => doc.type === 'render' && doc.assetKey).map(doc => ({
        id:doc.id,name:doc.name || '',room:doc.room || '',page:doc.pageNumber || null,source:doc.sourcePdf || '',
        items:doc.detectedItems || [],
        full:String(doc.assetKey).replace(/^render-/,''),
        thumb:String(doc.thumbAssetKey || doc.assetKey).replace(/^render-/,'')
      })).filter(item => GDHomeImages.isAssetName(item.full) && GDHomeImages.isAssetName(item.thumb)));
    renderCache.set(projectId,promise);
    // Lỗi cũng giữ 30 giây để không gọi lại máy chủ ở mỗi lần vẽ lại bảng.
    promise.catch(() => setTimeout(() => { if (renderCache.get(projectId) === promise) renderCache.delete(projectId); },30000));
    return visibleRenders(projectId,await promise);
  }
  async function uploadRenders(projectId,files,onStatus = toast) {
    if (!projectId) throw new Error('Chọn dự án trước khi tải phối cảnh 3D.');
    if (isGuest()) throw new Error('Đăng nhập để lưu phối cảnh 3D vào hồ sơ dự án.');
    const queue = [];
    for (const file of files) {
      if (isPdf(file)) {
        onStatus?.('Đang tách trang PDF ' + (file.name || '') + '…');
        for await (const page of pdfPages(file)) {
          onStatus?.('Đang tách trang ' + page.number + '/' + page.total + '…');
          queue.push({file:page.blob,page:page.number,source:file.name || ''});
        }
      } else if (file.type?.startsWith('image/')) queue.push({file});
    }
    if (!queue.length) throw new Error('Chọn ảnh JPG/PNG/WebP hoặc file PDF.');
    let before = 0, after = 0, done = 0;
    for (const entry of queue) {
      onStatus?.('Đang nén và tải ' + (++done) + '/' + queue.length + '…');
      const {full,thumb} = await GDHomeImages.compress(entry.file);
      before += entry.file.size; after += full.size;
      const body = new FormData();
      body.set('full',full);
      if (thumb !== full) body.set('thumb',thumb);
      const query = new URLSearchParams({projectId,name:entry.file.name || 'phoi-canh.webp',type:'render',room:'Cả nhà'});
      if (entry.page) { query.set('pageNumber',entry.page); query.set('sourcePdf',entry.source); }
      await api('/api/project-hub/documents/upload?' + query,{method:'POST',body});
    }
    invalidateRenders(projectId);
    const sized = bytes => bytes >= 1048576 ? (bytes/1048576).toFixed(1).replace('.',',') + ' MB' : Math.max(1,Math.round(bytes/1024)) + ' KB';
    const message = 'Đã thêm ' + queue.length + ' ảnh 3D vào dự án · ' + sized(before) + ' → ' + sized(after);
    onStatus?.(message);
    return {count:queue.length,message};
  }

  // ---------------------------------------------------------------- Dữ liệu dùng chung
  const fold = value => String(value || '').normalize('NFD').replace(/\p{M}/gu,'').replace(/đ/gi,'d').toLowerCase()
    .replace(/\(.*?\)/g,' ').replace(/[^a-z0-9]+/g,' ').trim();
  const woodCategory = category => ['ancuong-wood','cat-1','cat-11'].includes(category?.id) ||
    /\b(?:ma go|mau (?:anh )?go|san go|van go|wood)\b/.test(fold(category?.name));
  const primarySize = size => String((Array.isArray(size) ? size[0] : size) || '').split(/[,;]/,1)[0].trim()
    .replace(/\s*[×xX*]\s*/g,'x');
  function guestLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(guestLibraryKey) || 'null');
      if (stored?.categories) {
        for (const item of stored.items || []) item.size = primarySize(item.size);
        const wood = stored.categories.find(c => c.id === 'ancuong-wood');
        if (!attributeCatalog().removedSystemCategories(stored).has('ancuong-wood') &&
            (!wood || wood.name.toLocaleLowerCase('vi') === 'mã gỗ')) {
          const genericWood = stored.categories.find(c => c.id === 'cat-1' && c.name.toLocaleLowerCase('vi') === 'mã gỗ');
          if (genericWood) genericWood.name = 'Mẫu ảnh gỗ';
          if (!wood) stored.categories.push({id:'ancuong-wood',name:'Mã gỗ'});
        }
        return stored;
      }
    } catch { /* Dữ liệu khách hỏng thì tạo lại. */ }
    const template = window.materialTemplate || [];
    return {_version:0,categories:[...template.map(([name],index) => ({id:'cat-' + (index+1),name:index === 0 ? 'Mẫu ảnh gỗ' : name.replace(/\s*\(.*\)\s*$/,''),source:name})),{id:'ancuong-wood',name:'Mã gỗ'}],items:[]};
  }
  function saveGuest(data) {
    data._version = (data._version || 0) + 1;
    try { localStorage.setItem(guestLibraryKey,JSON.stringify(data)); } catch { throw new Error('Bộ nhớ trình duyệt đã đầy.'); }
    return data;
  }
  let libraryError = null;
  async function loadLibrary(force = false) {
    if (library && !force) return visibleLibrary(library);
    if (isGuest()) {
      const data = guestLibrary();
      for (const item of data.items) item.kind ||= item.code ? 'wood' : 'image';
      if (!data.builtinSeeded) {
        const presets = await Promise.all(['paint-dulux','paint-jotun','wood-ancuong'].map(name => fetch('/data/' + name + '.json').then(r => r.json())));
        for (const preset of presets) for (const item of preset.colors || preset.woods || []) {
          const kind = preset.colors ? 'paint' : 'wood';
          const entry = {...item,kind,brand:preset.brand || 'An Cường',categoryId:kind === 'paint' ? 'cat-3' : 'ancuong-wood',builtin:true,id:uid()};
          if (data.categories.some(category => category.id === entry.categoryId) &&
              !data.items.some(other => other.code && catalogueKey(other) === catalogueKey(entry))) data.items.push(entry);
        }
        data.builtinSeeded = true;
        saveGuest(data);
      }
      return (library = data);
    }
    if (!force && libraryError && Date.now()-libraryError.at < 30000) throw libraryError.error;
    libraryLoading ||= api('/api/library').then(data => { libraryError = null; if (!library || data._version >= library._version) library = data; return library; })
      .catch(error => { libraryError = {error,at:Date.now()}; throw error; })
      .finally(() => { libraryLoading = null; });
    return visibleLibrary(await libraryLoading);
  }
  async function libraryCall(path,body,guestChange) {
    if (isGuest()) {
      const data = guestLibrary();
      const result = guestChange(data);
      library = saveGuest(data);
      notifyLibrary();
      return {...library,...result};
    }
    const data = await api('/api/library/' + path,{method:'POST',body:JSON.stringify(body)});
    if (!library || data._version >= library._version) library = data;
    libraryError = null;
    notifyLibrary();
    return data;
  }
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const addItems = (categoryId,items) => libraryCall('items',{categoryId,items},data => {
    const added = [];
    let skipped = 0;
    for (const item of items) {
      if (item.code && data.items.some(entry => entry.categoryId === categoryId && entry.code && catalogueKey(entry) === catalogueKey(item))) { skipped++; continue; }
      if (!item.code && item.full && data.items.some(entry => entry.categoryId === categoryId && entry.kind === 'image' && entry.full === item.full)) { skipped++; continue; }
      const metadata = Object.fromEntries(['brand','suppliers','tags','material','finish','collection','subgroup'].filter(key => Object.hasOwn(item,key)).map(key => [key,item[key]]));
      const price = attributeCatalog().priceFields(item);
      added.push({id:uid(),categoryId,name:item.name || '',note:'',kind:item.kind || (item.code ? 'wood' : 'image'),hex:item.hex,full:item.full,thumb:item.thumb,display:item.display,view:item.view,size:primarySize(item.size),createdAt:Date.now(),...metadata,
        ...price,...(Object.keys(price).length ? {priceUpdatedAt:Date.now()} : {}),
        ...(item.customAttributes ? {customAttributes:attributeCatalog().customValues(item.customAttributes,data.attributeGroups || [])} : {}),
        ...(item.code ? {code:item.code,brand:item.brand || 'An Cường',collection:item.collection,finish:item.finish} : {})});
    }
    data.items.unshift(...added);
    return {added,skipped};
  });
  const updateItem = patch => libraryCall('items/update',patch,data => {
    const item = data.items.find(entry => entry.id === patch.id);
    if (item) {
      if (typeof patch.name === 'string') item.name = patch.name;
      for (const key of ['code','view']) if (Object.hasOwn(patch,key)) item[key] = patch[key];
      for (const key of ['brand','size','tags','suppliers','display','material','finish','collection','subgroup']) if (Object.hasOwn(patch,key)) item[key] = patch[key];
      if (Object.hasOwn(patch,'customAttributes')) item.customAttributes = attributeCatalog().customValues(patch.customAttributes,data.attributeGroups || []);
      attributeCatalog().updatePrice(item,patch);
      if (Object.hasOwn(patch,'size')) item.size = primarySize(patch.size);
      if (typeof patch.hidden === 'boolean') item.hidden = patch.hidden;
      if (patch.hex) item.hex = patch.hex;
      if (typeof patch.square === 'boolean') for (const key of ['square','full','thumb','originalFull','originalThumb']) item[key] = patch[key];
      if (patch.categoryId) item.categoryId = patch.categoryId;
      if (typeof patch.favorite === 'boolean') item.favorite = patch.favorite;
      if (patch.used === true) {
        item.used = Math.min(1e6,(item.used || 0) + 1);
        item.lastUsedAt = Date.now();
      }
    }
    return {};
  });
  async function deleteItems(ids) {
    ids = ids.filter(id => !pendingLibraryDeletes.has(id));
    if (!ids.length) return;
    ids.forEach(id => pendingLibraryDeletes.add(id));
    notifyLibrary();
    try {
      return await libraryCall('items/delete',{ids},data => { data.items = data.items.filter(item => !ids.includes(item.id)); return {}; });
    } finally {
      ids.forEach(id => pendingLibraryDeletes.delete(id));
      notifyLibrary();
    }
  }
  const saveCategory = (name,id) => libraryCall('categories',{name,id},data => {
    const existing = data.categories.find(c => c.id !== id && c.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'));
    if (id) {
      if (existing) throw new Error('Tên hạng mục đã có. Dùng Gộp để hợp nhất.');
      const category = data.categories.find(c => c.id === id);
      if (!category) throw new Error('Không tìm thấy hạng mục.');
      category.name = name;
      return {category};
    }
    if (existing) return {category:existing};
    const category = {id:'cat-' + uid().slice(0,8),name};
    data.categories.push(category);
    return {category};
  });
  const deleteCategory = id => libraryCall('categories/delete',{id},data => {
    attributeCatalog().removeCategory(data,id);
    return {};
  });
  function categoryFor(data,groupName) {
    const target = fold(groupName);
    if (!target) return null;
    const exact = data.categories.find(category => [category.name,category.source].some(name => fold(name) === target));
    if (exact) return exact;
    let best = null, bestScore = 0;
    for (const category of data.categories) for (const name of [category.name,category.source,...(category.aliases || [])].map(fold).filter(Boolean)) {
      if (name === target) return category;
      const words = new Set(name.split(' ')), wanted = target.split(' ');
      const score = wanted.filter(word => words.has(word)).length/Math.max(words.size,wanted.length);
      if (score > bestScore) { bestScore = score; best = category; }
    }
    return bestScore >= 0.5 ? best : null;
  }

  // ---------------------------------------------------------------- Vùng nhìn ảnh
  const round = value => Math.round(value*1000)/1000;
  function viewCss(view) {
    if (!view) return '';
    const z = Math.max(1,Number(view.z) || 1), x = Number.isFinite(view.x) ? view.x : 0.5, y = Number.isFinite(view.y) ? view.y : 0.5;
    if (z === 1 && x === 0.5 && y === 0.5) return '';
    return 'scale(' + round(z) + ') translate(' + round((0.5-x)*100) + '%,' + round((0.5-y)*100) + '%)';
  }
  const viewStyle = view => {
    const css = viewCss(view);
    return css ? ' style="--view:' + css + '"' : '';
  };
  function editAssetIdentity(container,item,save) {
    if (container.querySelector('.asset-identity-editor')) return;
    const form = document.createElement('form');
    form.className = 'asset-identity-editor';
    form.innerHTML = '<label>Mã <input name="code" maxlength="80"></label><label>Tên <input name="name" maxlength="160"></label><button>Lưu</button>';
    form.elements.code.value = item.code || '';
    form.elements.name.value = item.name || '';
    form.onkeydown = event => {
      event.stopPropagation();
      if (event.key === 'Escape') { event.preventDefault(); form.remove(); container.focus(); }
    };
    form.onsubmit = async event => {
      event.preventDefault();
      form.querySelector('button').disabled = true;
      try {
        await save({code:form.elements.code.value.trim(),name:form.elements.name.value.trim()});
        form.remove();
        container.focus();
      } catch (error) { toast(error.message); form.querySelector('button').disabled = false; }
    };
    container.append(form);
    form.elements.code.focus();
    form.elements.code.select();
  }
  const displayOptions = [['fill','Cắt đầy ô'],['fit','Vừa khung'],['pad','Lấp nền ô vuông']];
  const displayAttribute = display => displayOptions.some(([value]) => value === display) ? ' data-display="' + display + '"' : '';
  function categoryDisplay(category) {
    return /phao|phu kien/.test(fold(category?.name || '')) ? 'pad' : 'fill';
  }
  function displaySelect(display,attribute) {
    return '<select ' + attribute + ' aria-label="Kiểu hiển thị">' + displayOptions.map(([value,label]) =>
      '<option value="' + value + '"' + (display === value ? ' selected' : '') + '>' + label + '</option>').join('') + '</select>';
  }
  function clampView(view,ratio) {
    const z = Math.min(6,Math.max(1,view.z || 1));
    const visX = ratio >= 1 ? 1/(z*ratio) : 1/z;
    const visY = ratio >= 1 ? 1/z : ratio/z;
    const clamp = (value,visible) => visible >= 1 ? 0.5 : Math.min(1-visible/2,Math.max(visible/2,value));
    return {x:round(clamp(view.x ?? 0.5,visX)),y:round(clamp(view.y ?? 0.5,visY)),z:round(z)};
  }

  function editView(item,{title = 'Chỉnh vùng nhìn',sequence,onSave,urlFor = entry => assetUrl(entry.full || entry.thumb)} = {}) {
    return new Promise(async (resolve,reject) => {
      let url;
      try { url = await urlFor(item); } catch (error) { reject(error); return; }
      const dialog = document.createElement('dialog');
      dialog.className = 'shell-dialog asset-view-dialog';
      dialog.innerHTML = '<h2>' + esc(title) + '</h2><p>Kéo ảnh để chọn vùng hiển thị trong ô vuông, cuộn chuột hoặc kéo thanh để phóng to. Ảnh gốc không bị cắt.</p>' +
        '<div class="asset-view-stage" tabindex="0" aria-label="Vùng nhìn ảnh, dùng phím mũi tên để di chuyển"><img alt="" draggable="false"></div>' +
        '<label class="asset-view-zoom">Phóng to <input type="range" min="1" max="4" step="0.01"></label>' +
        '<div class="toolbar"><button type="button" data-view="reset">Đặt lại</button><span></span>' +
        (sequence ? '<button type="button" data-view="previous" aria-label="Mã trước">←</button><button type="button" data-view="next" aria-label="Mã sau">→</button>' +
          '<button type="button" data-view="rename">Sửa mã/tên (F2)</button><button type="button" data-view="save">Đóng</button>' :
          '<button type="button" data-view="cancel">Huỷ</button><button type="button" class="primary" data-view="save">Lưu vùng nhìn</button>') + '</div>';
      document.body.append(dialog);
      const stage = dialog.querySelector('.asset-view-stage'), img = stage.querySelector('img'), zoom = dialog.querySelector('input[type=range]');
      let ratio = 1, view = item.view || {x:.5,y:.5,z:1}, result = null, moving = false;
      let index = sequence?.indexOf(item);
      img.src = url;
      try { await img.decode(); } catch { /* Ảnh vẫn hiển thị sau khi tải xong. */ }
      ratio = (img.naturalWidth || 1)/(img.naturalHeight || 1);
      img.dataset.imageAxis = ratio >= 1 ? 'wide' : 'tall';
      function paint() {
        view = clampView(view,ratio);
        img.style.transform = viewCss(view) || 'none';
        zoom.value = view.z;
      }
      const heading = dialog.querySelector('h2');
      function titleForItem() {
        if (!sequence) return;
        heading.textContent = [item.code,item.name].filter(Boolean).join(' · ') || title;
        dialog.querySelector('[data-view=previous]').disabled = index <= 0;
        dialog.querySelector('[data-view=next]').disabled = index >= sequence.length-1;
      }
      async function persist(patch = {}) {
        if (!onSave) return;
        const change = {...patch};
        const saved = item.view || {x:.5,y:.5,z:1};
        if (['x','y','z'].some(key => saved[key] !== view[key])) change.view = view;
        if (!Object.keys(change).length) return;
        await onSave(item,change);
        Object.assign(item,change);
        titleForItem();
      }
      async function navigate(step) {
        const next = index+step;
        if (moving || next < 0 || next >= sequence.length) return;
        moving = true;
        try {
          await persist();
          const url = await urlFor(sequence[next]);
          img.src = url;
          await img.decode();
          index = next;
          item = sequence[index];
          ratio = img.naturalWidth/img.naturalHeight;
          img.dataset.imageAxis = ratio >= 1 ? 'wide' : 'tall';
          view = item.view || {x:.5,y:.5,z:1};
          paint();
          titleForItem();
          stage.focus();
        } catch (error) { toast(error.message); }
        finally { moving = false; }
      }
      function rename() { if (!moving) editAssetIdentity(dialog,item,persist); }
      async function closePreview() {
        if (moving) return;
        moving = true;
        try { await persist(); dialog.close(); }
        catch (error) { toast(error.message); }
        finally { moving = false; }
      }
      let drag = null;
      stage.onpointerdown = event => {
        if (event.button !== 0) return;
        event.preventDefault();
        stage.setPointerCapture(event.pointerId);
        drag = {id:event.pointerId,x:event.clientX,y:event.clientY,start:{...view},size:stage.clientWidth};
      };
      stage.onpointermove = event => {
        if (!drag || drag.id !== event.pointerId) return;
        const width = drag.size*(ratio >= 1 ? ratio : 1)*view.z, height = drag.size*(ratio >= 1 ? 1 : 1/ratio)*view.z;
        view = {...view,x:drag.start.x-(event.clientX-drag.x)/width,y:drag.start.y-(event.clientY-drag.y)/height};
        paint();
      };
      stage.onlostpointercapture = () => { drag = null; };
      stage.onwheel = event => { event.preventDefault(); view = {...view,z:view.z*(event.deltaY < 0 ? 1.08 : 1/1.08)}; paint(); };
      stage.onkeydown = event => {
        if (sequence && ['ArrowLeft','ArrowRight'].includes(event.key)) return;
        const step = {ArrowLeft:[-0.02,0],ArrowRight:[0.02,0],ArrowUp:[0,-0.02],ArrowDown:[0,0.02]}[event.key];
        if (!step) return;
        event.preventDefault();
        view = {...view,x:view.x+step[0],y:view.y+step[1]};
        paint();
      };
      zoom.oninput = () => { view = {...view,z:Number(zoom.value)}; paint(); };
      if (sequence) {
        dialog.oncancel = event => { event.preventDefault(); closePreview(); };
        dialog.onkeydown = event => {
          if (event.key === 'F2') { event.preventDefault(); rename(); }
          if (['ArrowLeft','ArrowRight'].includes(event.key) && event.target !== zoom) {
            event.preventDefault();
            navigate(event.key === 'ArrowLeft' ? -1 : 1);
          }
        };
      }
      dialog.onclick = event => {
        const command = event.target.closest('[data-view]')?.dataset.view;
        if (sequence) {
          if (event.target === dialog || command === 'save') closePreview();
          if (command === 'rename') rename();
          if (command === 'previous' || command === 'next') navigate(command === 'previous' ? -1 : 1);
          if (command === 'reset') { view = {x:.5,y:.5,z:1}; paint(); }
          return;
        }
        if (event.target === dialog || command === 'cancel') dialog.close();
        if (command === 'reset') { view = {x:0.5,y:0.5,z:1}; paint(); }
        if (command === 'save') {
          result = view.x === 0.5 && view.y === 0.5 && view.z === 1 ? undefined : view;
          dialog.close('save');
        }
      };
      dialog.onclose = () => { dialog.remove(); resolve(dialog.returnValue === 'save' ? (result || {x:0.5,y:0.5,z:1}) : null); };
      paint();
      titleForItem();
      dialog.showModal();
      stage.focus();
    });
  }

  // ---------------------------------------------------------------- Giao diện chung
  const {facetLabels} = window.GDHomeLibraryAttributes;
  const facetValues = (item,key) => [...new Set([key === 'size' ? primarySize(item.size) : key === 'favorite' ?
    (item.favorite ? 'favorite' : '') : key === 'review' ? (item.tags?.includes('chua-duyet') ? 'Chưa duyệt' : '') :
    key.startsWith('custom-') ? item.customAttributes?.[key] : item[key],
    ...(key === 'brand' ? item.brands || [] : [])].flat().filter(Boolean).map(String))];
  const matchFacets = (item,facets,except) => Object.entries(facets).every(([key,values]) =>
    key === except || !values.size || facetValues(item,key).some(value => values.has(value)));
  function clearFacets(facets) {
    for (const key of Object.keys(facets)) delete facets[key];
  }
  function pruneFacets(items,facets) {
    for (const [key,selected] of Object.entries(facets)) {
      const available = new Set(items.flatMap(item => facetValues(item,key)));
      for (const value of selected) if (!available.has(value)) selected.delete(value);
    }
  }
  const facetEmpty = (items,facets) => !items.length && Object.values(facets).some(values => values.size) ?
    '<p class="asset-empty">Không có mẫu khớp bộ lọc · <button type="button" data-clear-facets>Bỏ lọc</button></p>' : '';
  const filterGroup = (key,label,content) => '<details data-filter-group="' + esc(key) + '" open><summary>' + esc(label) + '</summary>' + content + '</details>';
  function pickerCategorySelect(categories,items,current) {
    const counts = new Map();
    for (const item of items) counts.set(item.categoryId,(counts.get(item.categoryId) || 0)+1);
    return '<select aria-label="Hạng mục" data-picker-categories><option value="all">Tất cả hạng mục (' + items.length + ')</option>' +
      categories.map(category => '<option value="' + esc(category.id) + '"' + (current === category.id ? ' selected' : '') + '>' +
        esc(category.name) + ' (' + (counts.get(category.id) || 0) + ')</option>').join('') + '</select>';
  }
  function wirePickerCategories(root,onChange) {
    root.querySelectorAll('[data-picker-category]').forEach(input => input.onchange = () => {
      if (input.checked) onChange(input.value);
    });
  }
  function facetMarkup(items,facets,config) {
    const groups = config ? [['favorite',facetLabels.favorite],...config.filter(group => group.visible).map(group => [group.key,group.label])] :
      Object.entries(facetLabels);
    return '<div class="asset-facets">' + (config ? '<button type="button" data-edit-filters aria-label="Tuỳ chỉnh cột lọc">⚙ Tuỳ chỉnh lọc</button>' : '') +
      groups.map(([key,label]) => {
      const counts = new Map();
      for (const item of items.filter(item => matchFacets(item,facets,key))) {
        for (const value of facetValues(item,key)) counts.set(value,(counts.get(value) || 0)+1);
      }
      for (const value of facets[key] || []) if (!counts.has(value)) counts.set(value,0);
      if (!counts.size && key === 'favorite') counts.set('favorite',0);
      if (!counts.size) return config && key.startsWith('custom-') ? filterGroup(key,label,'<p class="asset-empty">Chưa có giá trị</p>') : '';
      const limited = !!config && counts.size > 8;
      const choice = (value,caption,checked,hidden = false) => '<label class="asset-facet-choice"' + (hidden ? ' hidden' : '') +
        (value ? ' data-filter-value' : '') + '><input type="' + (key === 'size' ? 'radio' : 'checkbox') +
        '" data-facet="' + key + '" data-value="' + esc(value) + '"' + (checked ? ' checked' : '') + '> <span>' + esc(caption) + '</span></label>';
      const options = (key === 'size' ? choice('','Tất cả',!facets.size?.size) : '') + [...counts].map(([value,count],index) =>
        choice(value,(key === 'size' ? value.replace('x','×') : key === 'cabinetWidth' ? 'Tủ '+value : key === 'favorite' ? 'Chỉ mục yêu thích' : value) +
          ' (' + count + ')',facets[key]?.has(value),limited && index >= 8)).join('');
      return filterGroup(key,label,limited ?
        '<input type="search" data-facet-search placeholder="Tìm giá trị" aria-label="Tìm trong ' + esc(label) + '">' + options +
          '<button type="button" data-facet-more aria-expanded="false">Xem thêm</button>' : options);
    }).join('') + '</div>';
  }
  function arrangeFilterSidebar(root,state) {
    const facets = root.querySelector('.asset-facets');
    let sidebar = root.querySelector('.asset-categories');
    const controls = root.querySelector('.asset-library-navigation,.asset-filters,.asset-library-head');
    if (!facets || !controls) return;
    state.radioName ||= 'asset-filter-' + uid();
    if (!sidebar) {
      const grid = root.querySelector('.asset-body');
      const layout = document.createElement('div'), main = document.createElement('div');
      layout.className = 'asset-picker-layout';
      main.className = 'asset-picker-main';
      sidebar = document.createElement('aside');
      sidebar.innerHTML = filterGroup('category','Hạng mục','');
      const categoryGroup = sidebar.querySelector('details');
      const categories = controls.querySelector('[data-picker-categories]');
      if (categories) {
        for (const option of categories.options) {
          const label = document.createElement('label'), input = document.createElement('input');
          label.className = 'asset-facet-choice';
          input.type = 'radio';
          input.name = state.radioName + '-category';
          input.value = input.dataset.pickerCategory = option.value;
          input.checked = option.selected;
          label.append(input,document.createTextNode(option.text));
          categoryGroup.append(label);
        }
        categories.remove();
      }
      for (const select of controls.querySelectorAll('select')) {
        const label = select.getAttribute('aria-label'), key = label === 'Dòng sản phẩm' ? 'collection' : 'brand';
        let group = facets.querySelector('[data-filter-group=' + key + ']');
        if (!group) {
          group = document.createElement('details');
          group.dataset.filterGroup = key;
          group.innerHTML = '<summary>' + facetLabels[key] + '</summary>';
          facets.prepend(group);
        }
        group.append(select);
      }
      controls.before(layout);
      layout.append(sidebar,main);
      main.append(controls,grid);
    } else {
      const category = sidebar.querySelector('.asset-cat-list');
      const group = document.createElement('details');
      group.dataset.filterGroup = 'category';
      group.innerHTML = '<summary>Hạng mục</summary>';
      sidebar.prepend(group);
      group.append(category);
    }
    sidebar.classList.add('asset-filter-sidebar');
    sidebar.setAttribute('aria-label','Bộ lọc vật liệu');
    const categoryColumn = document.createElement('div');
    categoryColumn.className = 'asset-category-column';
    categoryColumn.append(...sidebar.children);
    const favorites = facets.querySelector('[data-filter-group=favorite]');
    if (favorites) categoryColumn.prepend(favorites);
    sidebar.append(categoryColumn,facets);
    for (const input of sidebar.querySelectorAll('[data-facet=size]')) input.name = state.radioName + '-size';
    for (const input of sidebar.querySelectorAll('[data-category-check]')) input.name = state.radioName + '-category';
    for (const group of sidebar.querySelectorAll('[data-filter-group]')) {
      const key = group.dataset.filterGroup;
      group.open = state.groups[key] ?? true;
      group.ontoggle = () => { state.groups[key] = group.open; };
    }
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.dataset.assetFilterToggle = '';
    toggle.textContent = 'Bộ lọc';
    const paintDrawer = () => {
      sidebar.classList.toggle('is-drawer-open',!!state.drawer);
      toggle.setAttribute('aria-expanded',!!state.drawer);
    };
    toggle.onclick = () => { state.drawer = !state.drawer; paintDrawer(); };
    controls.prepend(toggle);
    paintDrawer();
  }
  const sortLabels = {used:'Hay dùng',recent:'Mới thêm',name:'Tên A–Z',code:'Mã',manual:'Thứ tự thủ công'};
  const priceSortLabels = {priceUp:'Giá thấp đến cao',priceDown:'Giá cao đến thấp'};
  const displayPrice = new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:2});
  const assetCollator = new Intl.Collator('vi',{numeric:true,sensitivity:'base'});
  function sortLibrary(items,mode = 'used') {
    const comparators = {
      used:(a,b) => (b.used || 0)-(a.used || 0) || (b.lastUsedAt || 0)-(a.lastUsedAt || 0),
      recent:(a,b) => (b.createdAt || 0)-(a.createdAt || 0),
      name:() => 0,
      code:(a,b) => assetCollator.compare(a.code || '',b.code || ''),
      priceUp:(a,b) => (a.price ?? Infinity)-(b.price ?? Infinity),
      priceDown:(a,b) => (b.price ?? -Infinity)-(a.price ?? -Infinity),
      manual:(a,b) => (a.order ?? Infinity)-(b.order ?? Infinity)
    };
    return [...items].sort((a,b) => Number(!!b.favorite)-Number(!!a.favorite) || comparators[mode](a,b) ||
      assetCollator.compare(a.name || '',b.name || '') || assetCollator.compare(a.id,b.id));
  }
  function assetItemActions(item) {
    if (!['image','wood','paint'].includes(item.kind)) return '';
    return '<button type="button" data-asset-favorite="' + esc(item.id) + '" aria-pressed="' + !!item.favorite +
      '" aria-label="' + (item.favorite ? 'Bỏ yêu thích' : 'Yêu thích') + ' ' + esc(item.name || item.code) + '">' +
      (item.favorite ? '★' : '☆') + '</button><small class="asset-usage" aria-label="' + (item.used || 0) + ' lượt dùng">' + (item.used || 0) + '</small>';
  }
  function wireLibraryActions(root,state,paint,{manual = false,showPrices = false} = {}) {
    const toolbar = root.querySelector('.asset-filters,.asset-library-head');
    if (!toolbar) return;
    const controls = document.createElement('div');
    controls.className = 'asset-sort-controls';
    controls.innerHTML = '<label>Sắp xếp <select aria-label="Sắp xếp">' + Object.entries(showPrices ? {...sortLabels,...priceSortLabels} : sortLabels).filter(([key]) => manual || key !== 'manual')
      .map(([key,label]) => '<option value="' + key + '">' + label + '</option>').join('') + '</select></label>' +
      (state.favoriteUndo ? '<button type="button" data-favorite-undo>Hoàn tác yêu thích</button>' : '');
    toolbar.append(controls);
    const sort = controls.querySelector('select');
    sort.value = state.sort || 'used';
    sort.onchange = () => { state.sort = sort.value; paint(); };
    async function change(id,value,undo) {
      if (state.favoriteBusy) return;
      state.favoriteBusy = true;
      const previous = state.favoriteUndo;
      state.favoriteUndo = undo;
      try { await updateItem({id,favorite:value}); }
      catch (error) { state.favoriteUndo = previous; toast(error.message); paint(); }
      finally { state.favoriteBusy = false; }
    }
    root.querySelectorAll('[data-asset-favorite]').forEach(button => button.onclick = () => {
      const id = button.dataset.assetFavorite, value = button.getAttribute('aria-pressed') === 'true';
      change(id,!value,{id,value});
    });
    const undo = controls.querySelector('[data-favorite-undo]');
    if (undo) undo.onclick = () => change(state.favoriteUndo.id,state.favoriteUndo.value,null);
  }
  const attributeCatalog = () => window.GDHomeLibraryAttributes;
  function attributeSuggestions(owner,data,categoryId,fields) {
    owner.dataset.suggestionId ||= uid();
    for (const [key,inputs] of Object.entries(fields)) {
      if (!inputs.length) continue;
      const id = 'library-values-' + owner.dataset.suggestionId + '-' + key;
      let list = owner.querySelector('#' + id);
      const defaults = inputs.flatMap(input => {
        if (!input.dataset.attrDefaults) {
          const original = input.list || (key === 'subgroup' ? input.closest('[data-catalogue-detail-fields]')?.querySelector('datalist') : null);
          input.dataset.attrDefaults = JSON.stringify([...(original?.options || [])].map(option => option.value));
        }
        return JSON.parse(input.dataset.attrDefaults);
      });
      if (!list) {
        list = document.createElement('datalist');
        list.id = id;
        owner.append(list);
      }
      const values = attributeCatalog().view(data,key).filter(row => !row.categoryIds.length || row.categoryIds.includes(categoryId)).map(row => row.name);
      list.replaceChildren(...[...new Set([...defaults,...values])].map(value => new Option(value)));
      for (const input of inputs) input.setAttribute('list',id);
    }
  }
  const attributePatch = patch => libraryCall('attributes',patch,data => {
    attributeCatalog().change(data,patch,{size:primarySize});
    return {};
  });
  const saveFilterPreferences = patch => libraryCall('filters',patch,data => {
    attributeCatalog().saveFilters(data,patch);
    return {};
  });
  function editFilterPreferences(category,config) {
    const {dialog,body} = modal('asset-attribute-editor','Tuỳ chỉnh cột lọc');
    body.innerHTML = '<form class="asset-attribute-form"><p>' + esc(category.name) +
      '</p><ol class="asset-filter-order">' + config.map(group =>
        '<li data-filter-key="' + esc(group.key) + '" data-collapsed="' + group.collapsed + '">' +
        '<span draggable="true" title="Kéo để đổi thứ tự">⠿</span><input type="checkbox" aria-label="Hiện ' + esc(group.label) + '"' +
        (group.visible ? ' checked' : '') + '><input aria-label="Tên nhóm ' + esc(group.label) + '" maxlength="60" value="' + esc(group.label) + '">' +
        '<button type="button" data-move-filter="-1" aria-label="Lên">↑</button><button type="button" data-move-filter="1" aria-label="Xuống">↓</button></li>').join('') +
      '</ol><div><button type="submit">Lưu bộ lọc</button> <button type="button" data-reset-filters>Về mặc định</button></div><p role="status"></p></form>';
    const form = body.querySelector('form'), list = body.querySelector('ol');
    let dragged;
    list.ondragstart = event => {
      dragged = event.target.closest('li');
      event.dataTransfer.setData('text/plain',dragged.dataset.filterKey);
    };
    list.ondragend = () => { dragged = null; };
    list.ondragover = event => { if (dragged && event.target.closest('li')) event.preventDefault(); };
    list.ondrop = event => {
      const target = event.target.closest('li');
      if (!dragged || !target || dragged === target) return;
      event.preventDefault();
      const rect = target.getBoundingClientRect();
      if (event.clientY < rect.top+rect.height/2) target.before(dragged);
      else target.after(dragged);
    };
    list.onclick = event => {
      const button = event.target.closest('[data-move-filter]');
      if (!button) return;
      const row = button.closest('li');
      if (button.dataset.moveFilter === '-1') row.previousElementSibling?.before(row);
      else row.nextElementSibling?.after(row);
      button.focus();
    };
    async function save(groups) {
      const buttons = form.querySelectorAll('button');
      for (const button of buttons) button.disabled = true;
      try { await saveFilterPreferences({categoryId:category.id,groups}); dialog.close(); }
      catch (error) { form.querySelector('[role=status]').textContent = error.message; }
      finally { for (const button of buttons) button.disabled = false; }
    }
    form.onsubmit = event => {
      event.preventDefault();
      save([...list.children].map(row => ({key:row.dataset.filterKey,label:row.querySelector('input[maxlength]').value,
        visible:row.querySelector('input[type=checkbox]').checked,collapsed:row.dataset.collapsed === 'true'})));
    };
    form.querySelector('[data-reset-filters]').onclick = () => save(null);
  }
  function wireLibraryFilterSettings(root,category,config) {
    if (!category) return;
    root.querySelector('[data-edit-filters]').onclick = () => editFilterPreferences(category,config);
    for (const group of config) {
      const details = root.querySelector('[data-filter-group="' + group.key + '"]');
      if (!details) continue;
      let collapsed = group.collapsed;
      details.open = !collapsed;
      details.ontoggle = () => {
        if (!details.isConnected || details.open === !collapsed) return;
        collapsed = !details.open;
        saveFilterPreferences({categoryId:category.id,collapsedKey:group.key,collapsed}).catch(error => toast(error.message));
      };
      const search = details.querySelector('[data-facet-search]'), more = details.querySelector('[data-facet-more]');
      if (!search || !more) continue;
      const values = [...details.querySelectorAll('[data-filter-value]')];
      let expanded = false;
      const refresh = () => {
        const query = fold(search.value);
        values.forEach((row,index) => {
          row.hidden = query ? !fold(row.textContent).includes(query) : !expanded && index >= 8;
        });
        more.hidden = !!query;
        more.textContent = expanded ? 'Thu gọn' : 'Xem thêm';
        more.setAttribute('aria-expanded',String(expanded));
      };
      search.oninput = refresh;
      more.onclick = () => { expanded = !expanded; refresh(); };
    }
  }
  function editLibraryAttribute(data,key,row) {
    const {dialog,body} = modal('asset-attribute-editor',row ? 'Sửa giá trị thuộc tính' : 'Thêm giá trị thuộc tính');
    body.innerHTML = '<form class="asset-attribute-form"><label>' + esc(attributeCatalog().groupLabels(data)[key]) +
      ' <input name="value" maxlength="120" required value="' + esc(row?.name) + '"></label>' +
      (key === 'suppliers' ? '<label>Số điện thoại <input name="phone" maxlength="40" value="' + esc(row?.phone) + '"></label>' +
        '<label>Ghi chú <textarea name="note" maxlength="300">' + esc(row?.note) + '</textarea></label>' : '') +
      '<label>Hạng mục áp dụng <select name="categories" multiple>' + data.categories.map(category =>
        '<option value="' + esc(category.id) + '"' + (row?.categoryIds.includes(category.id) ? ' selected' : '') + '>' + esc(category.name) + '</option>').join('') +
      '</select></label><small>Để trống nếu dùng cho mọi hạng mục.</small><button>Lưu giá trị</button><p role="status"></p></form>';
    const form = body.querySelector('form');
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      try {
        await attributePatch({key,action:'save',previous:row?.name,name:form.elements.value.value,
          categoryIds:[...form.elements.categories.selectedOptions].map(option => option.value),
          phone:form.elements.phone?.value,note:form.elements.note?.value});
        dialog.close();
      } catch (error) { form.querySelector('[role=status]').textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  function editLibraryItem(item,data) {
    const {dialog,body} = modal('asset-attribute-editor','Sửa mẫu vật liệu');
    const labels = attributeCatalog().groupLabels(data);
    body.innerHTML = '<form class="asset-attribute-form"><label>Tên <input name="name" maxlength="160" value="' + esc(item.name) + '"></label>' +
      (item.kind === 'paint' ? '<label>Màu hex <input name="hex" value="' + esc(item.hex) + '"></label>' : '') +
      Object.entries(labels).map(([key,label]) => {
        const value = key.startsWith('custom-') ? item.customAttributes?.[key] : item[key];
        return '<label>' + esc(label) + ' <input name="' + key + '" value="' + esc(Array.isArray(value) ? value.join(', ') : value) + '"></label>';
      }).join('') + (data.showPrices ? libraryPriceInputs(item) : '') + '<button>Lưu mẫu</button><p role="status"></p></form>';
    const form = body.querySelector('form');
    const keys = Object.keys(labels);
    attributeSuggestions(form,data,item.categoryId,Object.fromEntries(keys.map(key => [key,[form.elements[key]]])));
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      const patch = {id:item.id,name:form.elements.name.value.trim(),hex:form.elements.hex?.value.trim()};
      if (keys.some(key => key.startsWith('custom-'))) patch.customAttributes = {};
      for (const key of keys) {
        const value = form.elements[key].value.trim();
        if (key.startsWith('custom-')) patch.customAttributes[key] = value;
        else patch[key] = ['tags','suppliers'].includes(key) ? value.split(',').map(part => part.trim()).filter(Boolean) : value;
      }
      try { await updateItem(data.showPrices ? {...patch,...libraryPricePatch(form)} : patch); dialog.close(); }
      catch (error) { form.querySelector('[role=status]').textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  const libraryPriceInputs = (item = {}) =>
    '<label>Giá (₫) <input type="number" name="price" min="0" max="10000000000" step="0.01" value="' + esc(item.price) + '"></label>' +
    '<label>Đơn vị giá <input name="priceUnit" maxlength="30" placeholder="m², viên, bộ, md, tấm…" value="' + esc(item.priceUnit) + '"></label>' +
    '<label>Ghi chú giá <input name="priceNote" maxlength="300" value="' + esc(item.priceNote) + '"></label>';
  const libraryPricePatch = form => Object.fromEntries(['price','priceUnit','priceNote'].map(key => [key,form.elements[key].value.trim()]));
  function wireFacets(root,facets,paint) {
    const clear = root.querySelector('[data-clear-facets]');
    if (clear) clear.onclick = () => { clearFacets(facets); paint(); };
    root.querySelectorAll('[data-facet]').forEach(button => button.onclick = () => {
      const values = facets[button.dataset.facet] ||= new Set();
      const value = button.dataset.value;
      if (button.dataset.facet === 'size') {
        values.clear();
        if (value) values.add(value);
      } else if (values.has(value)) values.delete(value);
      else values.add(value);
      paint();
    });
  }
  const libraryTabs = active => '<div class="asset-library-tabs" role="tablist" aria-label="Quản lý dữ liệu">' +
    [['items','Mẫu vật liệu'],['attributes','Thuộc tính']].map(([id,label]) => '<button type="button" role="tab" data-library-tab="' +
      id + '" aria-selected="' + (id === active) + '">' + label + '</button>').join('') + '</div>';
  function renderLibraryAttributes(body,data,state,paint) {
    const {groupLabels,view,createGroup} = attributeCatalog(), labels = groupLabels(data), key = state.attributeKey || 'size';
    const rows = view(data,key);
    body.innerHTML = '<div class="asset-attributes-panel">' +
      '<div class="asset-attributes-controls"><label>Nhóm thuộc tính <select data-attribute-key>' +
      Object.entries(labels).map(([value,label]) => '<option value="' + value + '"' + (key === value ? ' selected' : '') + '>' + esc(label) + '</option>').join('') +
      '</select></label><button type="button" data-attribute-add>Thêm giá trị</button>' +
      '<button type="button" data-attribute-group-add>Thêm nhóm tuỳ chỉnh</button>' +
      '<label>Gộp về <select data-attribute-target><option value="">Chọn giá trị đích</option>' +
      rows.map(row => '<option>' + esc(row.name) + '</option>').join('') + '</select></label><button type="button" data-attribute-merge>Gộp</button></div>' +
      '<p role="status">' + esc(state.attributeMessage) + '</p><table><thead><tr><th>Giá trị</th><th>Số mẫu</th><th>Hạng mục</th><th>Thao tác</th></tr></thead><tbody>' +
      rows.map((row,i) => '<tr data-attribute-row="' + i + '"><td><label><input type="checkbox" data-attribute-select value="' +
        esc(row.name) + '"> ' + esc(row.name) + '</label>' +
        (row.phone || row.note ? '<small>' + esc([row.phone,row.note].filter(Boolean).join(' · ')) + '</small>' : '') +
        '</td><td>' + row.count + '</td><td>' + esc(row.categoryIds.length ? row.categoryIds.map(id => data.categories.find(category => category.id === id)?.name).filter(Boolean).join(', ') : 'Tất cả') +
        '</td><td><button type="button" data-attribute-action="edit">Sửa</button> <button type="button" data-attribute-action="up" aria-label="Lên"' +
        (i === 0 ? ' disabled' : '') + '>↑</button> <button type="button" data-attribute-action="down" aria-label="Xuống"' +
        (i === rows.length-1 ? ' disabled' : '') + '>↓</button> <button type="button" data-attribute-action="delete">Xoá</button></td></tr>').join('') +
      '</tbody></table></div>';
    const status = body.querySelector('[role=status]');
    async function apply(patch) {
      if (state.attributeBusy) return;
      state.attributeBusy = true;
      state.attributeMessage = 'Đã cập nhật thuộc tính.';
      try { await attributePatch({key,...patch}); }
      catch (error) { state.attributeMessage = ''; status.textContent = error.message; }
      finally { state.attributeBusy = false; }
    }
    body.querySelector('[data-attribute-key]').onchange = event => { state.attributeKey = event.target.value; state.attributeMessage = ''; paint(); };
    body.querySelector('[data-attribute-add]').onclick = () => editLibraryAttribute(data,key);
    body.querySelector('[data-attribute-group-add]').onclick = async () => {
      const name = prompt('Tên nhóm thuộc tính tuỳ chỉnh:')?.trim();
      if (!name) return;
      const group = {key:'custom-'+uid().replace(/[^a-z0-9]/gi,'').slice(0,24),name};
      try {
        await libraryCall('attribute-groups',group,data => ({group:createGroup(data,group)}));
        state.attributeKey = group.key;
        await paint();
      } catch (error) { status.textContent = error.message; }
    };
    body.querySelector('[data-attribute-merge]').onclick = () => apply({action:'merge',
      names:[...body.querySelectorAll('[data-attribute-select]:checked')].map(box => box.value),
      target:body.querySelector('[data-attribute-target]').value});
    body.querySelectorAll('[data-attribute-action]').forEach(button => button.onclick = () => {
      const row = rows[Number(button.closest('tr').dataset.attributeRow)], action = button.dataset.attributeAction;
      if (action === 'edit') return editLibraryAttribute(data,key,row);
      if (action === 'delete') {
        if (row.count && !confirm('Xoá “' + row.name + '” khỏi ' + row.count + ' mẫu đang dùng?')) return;
        return apply({action,previous:row.name,confirm:true});
      }
      apply({action:'move',previous:row.name,step:action === 'up' ? -1 : 1});
    });
  }
  function openLibraryMerge(source,targets,onMerge) {
    const {dialog,body} = modal('asset-attribute-editor','Gộp “' + source + '”');
    body.innerHTML = '<form class="asset-attribute-form"><label>Gộp vào <select name="target" required>' +
      '<option value="">Chọn đích</option>' + targets.map(([value,label]) => '<option value="' + esc(value) + '">' + esc(label) + '</option>').join('') +
      '</select></label><p class="asset-hint">Các mẫu đang dùng “' + esc(source) + '” sẽ chuyển sang đích đã chọn.</p>' +
      '<button type="submit">Gộp</button><p role="status"></p></form>';
    const form = body.querySelector('form');
    form.onsubmit = async event => {
      event.preventDefault();
      const button = form.querySelector('button');
      button.disabled = true;
      try { await onMerge(form.elements.target.value); dialog.close(); }
      catch (error) { form.querySelector('[role=status]').textContent = error.message; }
      finally { button.disabled = false; }
    };
  }
  function showLibraryContext(root,event,actions) {
    if (!actions.length) return;
    event.preventDefault();
    root.querySelector('.asset-library-context')?.remove();
    const menu = document.createElement('div');
    menu.className = 'asset-library-context';
    menu.popover = 'auto';
    menu.setAttribute('role','group');
    menu.setAttribute('aria-label','Thao tác thư viện');
    for (const [label,action] of actions) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.onclick = () => { menu.remove(); action(); };
      menu.append(button);
    }
    menu.addEventListener('toggle',event => { if (event.newState === 'closed') menu.remove(); });
    root.append(menu);
    menu.showPopover();
    const anchor = event.target.getBoundingClientRect();
    menu.style.left = Math.max(6,Math.min(event.clientX || anchor.left,innerWidth-menu.offsetWidth-6)) + 'px';
    menu.style.top = Math.max(6,Math.min(event.clientY || anchor.bottom,innerHeight-menu.offsetHeight-6)) + 'px';
    menu.firstElementChild.focus();
  }
  function wireLibraryContext(root,data,{renameCategory,mergeCategory,removeManagedCategory,showAttributes,attributeKey}) {
    const {groupLabels,view,canMergeCategory} = attributeCatalog(), labels = groupLabels(data);
    root.oncontextmenu = event => {
      const categoryId = event.target.closest('[data-cat]')?.dataset.cat;
      if (categoryId) {
        const category = data.categories.find(entry => entry.id === categoryId);
        const actions = [['Sửa tên hạng mục',() => renameCategory(category)]];
        if (canMergeCategory(categoryId) && data.categories.length > 1) actions.push(['Gộp vào hạng mục…',() => mergeCategory(category,data)]);
        actions.push(['Xoá hạng mục',() => removeManagedCategory(category)]);
        return showLibraryContext(root,event,actions);
      }
      const choice = event.target.closest('.asset-facet-choice')?.querySelector('[data-facet]');
      const row = event.target.closest('[data-attribute-row]');
      const group = event.target.closest('summary')?.parentElement.dataset.filterGroup;
      const key = row ? attributeKey : choice?.dataset.facet || group;
      if (!Object.hasOwn(labels,key)) return;
      const actions = [['Xem bảng giá trị',() => showAttributes(key)]];
      const value = row ? row.querySelector('[data-attribute-select]').value : choice?.dataset.value;
      if (value) {
        const rows = view(data,key);
        const normalized = value.trim().replace(/\s+/g,' ').toLocaleLowerCase('vi');
        const source = rows.find(entry => entry.name.toLocaleLowerCase('vi') === normalized);
        if (source) {
          actions.unshift(['Sửa giá trị',() => editLibraryAttribute(data,key,source)]);
          const targets = rows.filter(entry => entry !== source).map(entry => [entry.name,entry.name]);
          if (targets.length) actions.splice(1,0,['Gộp vào giá trị…',() => openLibraryMerge(source.name,targets,target =>
            attributePatch({key,action:'merge',names:[source.name,target],target}))]);
        }
      }
      showLibraryContext(root,event,actions);
    };
  }
  function grid(items,{selectable = true,removable = false,selected = null,showPrices = false,empty = 'Chưa có ảnh.'} = {}) {
    if (!items.length) return '<p class="asset-empty">' + esc(empty) + '</p>';
    return '<div class="asset-grid' + (selected ? ' asset-grid-managed' : '') + '">' + items.map(item => '<figure class="asset-card' + (selected?.has(item.id) ? ' is-selected' : '') +
      '" data-asset-id="' + esc(item.id) + '"' + (selected ? ' draggable="true"' : '') + '>' +
      (selected ? '<label class="asset-card-check"><input type="checkbox" data-bulk-select aria-label="Chọn ' + esc(item.name || item.code) + '"' + (selected.has(item.id) ? ' checked' : '') + '></label>' : '') +
      '<button type="button" class="asset-thumb"' + (selectable ? ' data-asset-pick' : ' data-asset-open') + ' title="' + esc(item.name || item.room || '') + '">' +
      (item.kind === 'paint' ? '<span class="asset-paint-swatch" style="background-color:' + esc(item.hex) + '"></span>' : item.thumb ? '<img data-lib-asset="' + esc(item.thumb) + '"' + displayAttribute(item.display) + ' alt="' + esc(item.name || 'Ảnh') + '">' : '<span>' + esc(item.code || '') + '</span>') + '</button>' +
      (item.size || item.brand ? '<span class="asset-card-badge">' + esc([item.size?.replace('x','×'),item.brand].filter(Boolean).join(' · ')) + '</span>' : '') +
      (selected ? '<figcaption title="' + esc([item.code,item.name,item.collection,item.finish,item.spec].filter(Boolean).join(' · ')) + '"><strong>' +
        esc(item.code || item.name) + '</strong><span>' + esc(item.code ? item.name : item.collection) + '</span></figcaption>' :
        '<figcaption>' + esc(item.page ? 'Trang ' + item.page + (item.room && item.room !== 'Cả nhà' ? ' · ' + item.room : '') : ([item.code,item.name || item.room,item.collection,item.finish,item.spec,item.cabinetWidth && 'Tủ '+item.cabinetWidth,item.subgroup].filter(Boolean).join(' · '))) + '</figcaption>') +
      (showPrices && item.price != null ? '<small class="asset-card-price" title="' + esc(item.priceNote) + '">' +
        esc(displayPrice.format(item.price) + (item.priceUnit ? '/' + item.priceUnit : '')) + '</small>' : '') +
      (removable && item.full ? '<details class="asset-card-menu"><summary aria-label="Tuỳ chọn ảnh">⋯</summary><label>Kiểu hiển thị' + displaySelect(item.display || 'fill','data-asset-display') + '</label></details>' : '') +
      ((selectable || removable) ? assetItemActions(item) : '') +
      (removable && item.builtin ? '<button type="button" data-asset-hide>' + (item.hidden ? 'Hiện' : 'Ẩn') + '</button>' : '') +
      (removable ? '<button type="button" class="asset-remove" data-asset-remove aria-label="Xoá ảnh">×</button>' : '') + '</figure>').join('') + '</div>';
  }
  function filePicker(accept,multiple = true) {
    return new Promise(resolve => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = accept; input.multiple = multiple;
      input.onchange = () => resolve([...input.files]);
      input.click();
    });
  }
  function enableDrop(element,onFiles) {
    element.addEventListener('dragover',event => { if (event.dataTransfer.types.includes('Files')) { event.preventDefault(); element.classList.add('is-drop'); } });
    element.addEventListener('dragleave',() => element.classList.remove('is-drop'));
    element.addEventListener('drop',event => {
      element.classList.remove('is-drop');
      if (!event.dataTransfer.files.length) return;
      event.preventDefault();
      onFiles([...event.dataTransfer.files]);
    });
  }

  let openPopover = null;
  function closePicker() { openPopover?.close(); }
  const pickerWidthKey = 'gdhome-asset-picker-width';
  function savedPickerWidth() {
    if (hooks.pickerWidth) return hooks.pickerWidth();
    try { return Number(localStorage.getItem(pickerWidthKey)) || undefined; } catch { return undefined; }
  }
  function rememberPickerWidth(width) {
    if (hooks.savePickerWidth) hooks.savePickerWidth(width);
    else try { localStorage.setItem(pickerWidthKey,String(width)); } catch { /* Layout still works without local storage. */ }
  }
  function popover(anchor,build) {
    closePicker();
    const panel = document.createElement('div');
    const lifetime = new AbortController();
    panel.className = 'asset-popover';
    panel.setAttribute('role','dialog');
    document.body.append(panel);
    let preferredWidth = savedPickerWidth();
    const margin = 12;
    const limits = width => Math.round(Math.min(1100,innerWidth-margin*2,Math.max(720,width)));
    function resizeHandle(side) {
      let handle = panel.querySelector('[data-picker-resize]');
      if (!handle) {
        handle = document.createElement('button');
        handle.type = 'button';
        handle.dataset.pickerResize = '';
        handle.setAttribute('aria-label','Đổi chiều rộng bảng chọn');
        panel.append(handle);
        let drag;
        handle.onpointerdown = event => {
          if (event.button !== 0) return;
          event.preventDefault();
          drag = {id:event.pointerId,x:event.clientX,width:panel.getBoundingClientRect().width,side:panel.dataset.direction};
          handle.setPointerCapture(event.pointerId);
        };
        handle.onpointermove = event => {
          if (drag?.id !== event.pointerId) return;
          preferredWidth = limits(drag.width + (event.clientX-drag.x)*(drag.side === 'right' ? -1 : 1));
          place();
        };
        handle.onlostpointercapture = () => {
          if (!drag) return;
          drag = null;
          if (preferredWidth) rememberPickerWidth(preferredWidth);
        };
        handle.onkeydown = event => {
          if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          const delta = event.key === 'ArrowRight' ? 24 : -24;
          preferredWidth = limits(panel.getBoundingClientRect().width + delta*(panel.dataset.direction === 'right' ? -1 : 1));
          place();
          rememberPickerWidth(preferredWidth);
        };
      }
      handle.hidden = side === 'full';
    }
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const full = innerWidth <= 900;
      const side = full ? 'full' : rect.left+rect.width/2 < innerWidth/2 ? 'right' : 'left';
      const header = document.querySelector('.material-header,.app-header');
      const top = full ? 0 : Math.max(0,header?.getBoundingClientRect().bottom || 0);
      const height = full ? innerHeight : Math.max(0,innerHeight-top-margin);
      const available = side === 'right' ? innerWidth-margin-rect.right-8 : rect.left-margin-8;
      const desired = limits(preferredWidth || innerWidth*.65);
      const width = full ? innerWidth : available >= 720 ? Math.min(desired,available) : desired;
      const left = full ? 0 : side === 'right' ? innerWidth-margin-width : margin;
      panel.dataset.direction = side;
      Object.assign(panel.style,{width:width+'px',height:height+'px',maxHeight:height+'px',top:top+'px',left:left+'px'});
      resizeHandle(side);
    };
    const outside = event => {
      if (!panel.contains(event.target) && !event.target.closest?.('dialog[open]')) close();
    };
    const key = event => { if (event.key === 'Escape' && !event.target.closest?.('dialog[open]')) { event.preventDefault(); event.stopPropagation(); close(); } };
    function close() {
      if (!panel.isConnected) return;
      lifetime.abort();
      panel.remove();
      document.removeEventListener('pointerdown',outside,true);
      document.removeEventListener('keydown',key,true);
      removeEventListener('resize',place);
      if (openPopover?.panel === panel) openPopover = null;
    }
    setTimeout(() => { if (panel.isConnected) document.addEventListener('pointerdown',outside,true); });
    document.addEventListener('keydown',key,true);
    addEventListener('resize',place);
    addEventListener('scroll',event => {
      if (event.target === document || event.target.contains?.(anchor)) place();
    },{capture:true,signal:lifetime.signal});
    openPopover = {panel,close};
    place();
    build(panel,close,place,lifetime.signal);
    return openPopover;
  }

  function pickRender(anchor,{projectId,groupName,onPick,title = 'Phối cảnh 3D của dự án'}) {
    return popover(anchor,async (panel,close,place,signal) => {
      let query = '';
      async function paint(force = false) {
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters"><input type="search" aria-label="Tìm ảnh 3D" value="' + esc(query) + '"></div>' +
          '<div class="asset-body"><p class="asset-empty">Đang tải…</p></div><footer><button type="button" data-upload>⬆ Tải ảnh / PDF 3D</button>' +
          '<button type="button" data-full>Mở danh sách</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        wireAssetSearch(panel,() => query,value => { query = value; },paint);
        panel.querySelector('[data-full]').onclick = () => { close(); openRenders({projectId,onPick}); };
        panel.querySelector('[data-upload]').onclick = async () => {
          const files = await filePicker('image/*,application/pdf');
          if (!files.length) return;
          try { await uploadRenders(projectId,files,message => { const p = panel.querySelector('.asset-body'); if (p) p.innerHTML = '<p class="asset-empty">' + esc(message) + '</p>'; }); }
          catch (error) { toast(error.message); }
          paint(true);
        };
        enableDrop(panel,async files => { try { await uploadRenders(projectId,files); } catch (error) { toast(error.message); } paint(true); });
        try {
          const available = await loadRenders(projectId,force);
          const items = available.filter(item => !query || fold([item.name,item.room,item.source].join(' ')).includes(fold(query)));
          if (!panel.isConnected) return;
          panel.querySelector('.asset-body').innerHTML = grid(items,{empty:query ? 'Không có ảnh 3D phù hợp.' : 'Dự án chưa có phối cảnh 3D.'}) + onlineSlot;
          if (items.length < 4) renderGoogleFallback(panel.querySelector('.asset-google-fallback-slot'),query,{
            groupName,onPickImage:entry => { close(); onPick?.(entry); }
          });
          panel.querySelectorAll('[data-asset-pick]').forEach(button => button.onclick = () => {
            const item = items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
            close();
            onPick?.(item);
          });
          await hydrate(panel);

        } catch (error) {
          panel.querySelector('.asset-body').innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>';
        }
        place();
      }
      document.addEventListener('gdhome:renders-changed',event => { if (event.detail === projectId) paint(); },{signal});
      paint();
    });
  }

  function pickLibrary(anchor,{groupName,onPick,title = 'Mẫu vật liệu · Dữ liệu dùng chung'}) {
    return popover(anchor,async (panel,close,place,signal) => {
      let data, categoryId, query = '';
      const facets = {};
      const sidebarState = {groups:{}};
      async function paint() {
        try { data = await loadLibrary(); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        if (!panel.isConnected) return;
        categoryId ||= categoryFor(data,groupName)?.id || 'all';
        const available = data.items.filter(item => !item.hidden && (item.full || item.kind === 'paint' || item.kind === 'wood'));
        const scoped = available.filter(item => categoryId === 'all' || item.categoryId === categoryId);
        pruneFacets(scoped,facets);
        const candidates = scoped.filter(item => !query || fold(item.name).includes(fold(query)));
        const items = sortLibrary(candidates.filter(item => matchFacets(item,facets)),sidebarState.sort);
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters">' + pickerCategorySelect(data.categories,available,categoryId) +
          '<input type="search" placeholder="Tìm theo tên / mã" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' + facetMarkup(candidates,facets) + (facetEmpty(items,facets) ||
            grid(items,{empty:query ? 'Không tìm thấy ảnh cho "' + query + '".' : 'Hạng mục này chưa có ảnh.'})) + onlineSlot + '</div>' +
          '<footer><button type="button" data-upload>⬆ Tải lên hạng mục này</button><button type="button" data-full>Quản lý dữ liệu</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        arrangeFilterSidebar(panel,sidebarState);
        wireLibraryActions(panel,sidebarState,paint);
        wireFacets(panel,facets,paint);
        wirePickerCategories(panel,value => { categoryId = value; clearFacets(facets); paint(); });
        const search = panel.querySelector('input[type=search]');
        search.oninput = () => { query = search.value; clearTimeout(search.timer); search.timer = setTimeout(() => { paint().then(() => { const s = panel.querySelector('input[type=search]'); s?.focus(); s?.setSelectionRange(query.length,query.length); }); },250); };
        panel.querySelector('[data-full]').onclick = () => { close(); openLibrary({groupName,categoryId:categoryId === 'all' ? null : categoryId,onPick}); };
        panel.querySelector('[data-upload]').onclick = async () => {
          const target = categoryId === 'all' ? categoryFor(data,groupName)?.id || data.categories[0]?.id : categoryId;
          if (!target) return toast('Tạo hạng mục trước khi tải ảnh.');
          const files = await filePicker('image/*');
          if (!files.length) return;
          try { await uploadToLibrary(target,files); } catch (error) { toast(error.message); }
          paint();
        };
        panel.querySelectorAll('[data-asset-pick]').forEach(button => button.onclick = () => {
          const item = data.items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
          close();
          if (item.kind !== 'paint') updateItem({id:item.id,used:true}).catch(() => {});
          onPick?.(item);
        });
        await hydrate(panel);
        if (items.length < 4 && query.trim()) {
          renderGoogleFallback(panel.querySelector('.asset-google-fallback-slot'), query, {
            onPickImage: entry => { close(); onPick?.(entry); },
            categoryId: categoryId === 'all' ? null : categoryId,groupName
          });
        }

        place();
      }
      panel.innerHTML = '<p class="asset-empty">Đang tải…</p>';
      document.addEventListener('gdhome:library-changed',paint,{signal});
      paint();
    });
  }

  const onlineSlot = '<div class="asset-google-fallback-slot"></div>';
  function wireAssetSearch(root,getQuery,setQuery,paint) {
    const field = root.querySelector('input[type=search]');
    field.oninput = () => {
      setQuery(field.value);
      clearTimeout(field.timer);
      field.timer = setTimeout(async () => {
        await paint();
        const replacement = root.querySelector('input[type=search]');
        replacement?.focus();
        replacement?.setSelectionRange(getQuery().length,getQuery().length);
      },250);
    };
  }
  async function renderGoogleFallback(container,query,{onPickImage,categoryId,groupName} = {}) {
    query = query.trim();
    if (!container || !query) return;
    const heading = '<h4>Tìm trên mạng</h4>';
    const fallback = message => {
      container.innerHTML = '<section class="asset-google-fallback">' + heading +
        (message ? '<p class="asset-hint">' + esc(message) + '</p>' : '') +
        '<a class="btn btn-primary" href="https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query) + '" target="_blank" rel="noopener">🔍 Mở Google Ảnh "' + esc(query) + '" ↗</a>' +
        '<p class="asset-hint">Nhấp chuột phải vào ảnh → Sao chép hình ảnh → quay lại bảng bấm <strong>Ctrl+V</strong> để dán.</p></section>';
    };
    container.innerHTML = '<section class="asset-google-fallback">' + heading + '<p class="asset-hint">Đang tìm ảnh…</p></section>';
    try {
      const data = await api('/api/google/search?q=' + encodeURIComponent(query));
      if (!container.isConnected) return;
      if (!data.configured || !data.items?.length) {
        fallback(data.configured ? 'Không tìm thấy ảnh trực tuyến.' : 'Chưa cấu hình nhà cung cấp tìm ảnh trong ⚙ Kết nối.');
        return;
      }
      const library = await loadLibrary().catch(() => null);
      if (!container.isConnected) return;
      const target = library?.categories.find(category => category.id === categoryId) ||
        (library && (categoryFor(library,groupName) || library.categories[0]));
      container.innerHTML = '<section class="asset-google-fallback">' + heading +
        (target ? '<label><input type="checkbox" data-save-online-image checked> Lưu vào Dữ liệu dùng chung · ' + esc(target.name) + '</label>' : '') +
        '<div class="asset-google-grid">' + data.items.slice(0,12).map((item,index) =>
          '<button type="button" class="asset-google-item" data-google-idx="' + index + '" title="' + esc(item.title) + '"><img src="' +
          esc(item.thumbnail || item.link) + '" alt="' + esc(item.title) + '"></button>').join('') + '</div></section>';
      const save = container.querySelector('[data-save-online-image]');
      let picking = false;
      container.querySelectorAll('[data-google-idx]').forEach(button => {
        button.onclick = async () => {
          if (picking) return;
          picking = button.disabled = true;
          const item = data.items[Number(button.dataset.googleIdx)];
          const saveToLibrary = save?.checked;
          try {
            const response = await fetch('/api/google/proxy-image',{
              method:'POST',headers:{...hooks.headers(),'Content-Type':'application/json'},body:JSON.stringify({url:item.link})
            });
            if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không tải được ảnh.');
            const {full,thumb} = await uploadImage(await response.blob());
            const entry = {full,thumb,name:item.title?.slice(0,160) || query};
            if (onPickImage) onPickImage(entry);
            if (target && saveToLibrary) {
              await addItems(target.id,[entry]);
            } else if (!onPickImage) {
              const image = document.createElement('img');
              image.src = await assetUrl(entry.full);
              image.alt = entry.name;
              image.className = 'asset-online-preview';
              container.append(image);
            }
            toast('Đã tải ảnh thành công.');
          } catch (error) { toast(error.message); }
          finally { picking = button.disabled = false; }
        };
      });
    } catch { if (container.isConnected) fallback('Không kết nối được dịch vụ tìm ảnh.'); }
  }

  async function findLocalAssetPhotos(query,categoryId,groupName) {
    if (!query.trim()) return [];
    const data = await loadLibrary().catch(() => null);
    if (!data) return [];
    const category = data.categories.find(category => category.id === categoryId)?.id || categoryFor(data,groupName)?.id;
    return data.items.filter(item => item.full && item.kind === 'image' && !item.hidden && item.categoryId === category && fold(item.name).includes(fold(query)));
  }
  function wireLocalAssetPhotos(panel,items,onPick) {
    panel.querySelectorAll('.asset-specialized-photos [data-asset-pick]').forEach(button => {
      button.onclick = () => {
        const item = items.find(item => item.id === button.closest('[data-asset-id]').dataset.assetId);
        if (!item) return;
        updateItem({id:item.id,used:true}).catch(() => {});
        onPick(item);
      };
    });
    hydrate(panel);
  }
  const localAssetPhotos = items => items.length ? '<div class="asset-specialized-photos">' + grid(items) + '</div>' : '';

  async function loadPaintData(brand = 'Dulux') {
    const data = await loadLibrary();
    const colors = data.items.filter(item => item.kind === 'paint' && !item.hidden);
    return {source:'Dữ liệu dùng chung',categories:data.categories,brands:[...new Set(['Dulux','Jotun',...colors.map(item => item.brand)])],
      colors:colors.filter(item => item.brand === brand)};


  }

  function pickPaint(anchor, { groupName, onPick, title = 'Chọn màu sơn' } = {}) {
    return popover(anchor, async (panel, close, place, signal) => {
      const facets = {};
      const sidebarState = {groups:{}};
      let brand = 'Dulux', query = '', paintData = null, categoryId = 'all';
      async function paint() {
        try { paintData = await loadPaintData(brand); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        const allPhotos = await findLocalAssetPhotos(query,null,groupName);
        if (!panel.isConnected) return;
        const available = [...paintData.colors,...allPhotos], categories = new Set(available.map(item => item.categoryId));
        if (categoryId !== 'all' && !categories.has(categoryId)) { categoryId = 'all'; clearFacets(facets); }
        const inCategory = item => categoryId === 'all' || item.categoryId === categoryId;
        const scoped = paintData.colors.filter(inCategory), photos = allPhotos.filter(inCategory);
        pruneFacets([...scoped,...photos],facets);
        const candidates = scoped.filter(c => !query || fold(c.code).includes(fold(query)) || fold(c.name).includes(fold(query)));
        const colors = sortLibrary(candidates.filter(item => matchFacets(item,facets)),sidebarState.sort);
        const matchingPhotos = sortLibrary(photos.filter(item => matchFacets(item,facets)),sidebarState.sort);
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters">' +
          pickerCategorySelect(paintData.categories.filter(category => categories.has(category.id)),available,categoryId) +
          '<select aria-label="Hãng sơn">' + paintData.brands.map(name => '<option value="' + esc(name) + '"' +
            (brand === name ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select>' +
          '<input type="search" placeholder="Tìm theo mã hoặc tên màu (vd: 30YY, 9918, White...)" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' + facetMarkup([...candidates,...photos],facets) +
          (colors.length ? '<div class="asset-paint-grid">' + colors.map(c => '<div class="asset-specialized-card"><button type="button" class="asset-paint-card" data-paint-code="' + esc(c.code) + '" title="' + esc(c.code + ' – ' + c.name) + '">' +
            '<div class="asset-paint-swatch" style="background-color:' + esc(c.hex) + '"></div>' +
            '<div class="asset-paint-info"><strong>' + esc(c.code) + '</strong><span>' + esc(c.name) + '</span></div></button>' + assetItemActions(c) + '</div>').join('') + '</div>' :
            (facetEmpty(matchingPhotos,facets) || '<p class="asset-empty">Chưa có "' + esc(query) + '" trong bảng màu mẫu.</p>') +
            '<form class="asset-paint-custom"><strong>Dùng mã này</strong><label>Mã <input name="code" required value="' + esc(query) + '"></label>' +
            '<label>Tên màu <input name="name" placeholder="vd Ivory Lace"></label><label>Màu <input name="hex" type="color" value="#f2eee6"></label>' +
            '<button class="primary">Dùng màu ' + esc(brand) + ' này</button><small class="asset-hint">Xem mã trên quạt màu hoặc web hãng rồi chọn màu gần đúng. Lần sau sẽ có sẵn trong Dữ liệu dùng chung.</small></form>') + localAssetPhotos(matchingPhotos) + onlineSlot +
          '</div>' +
          '<footer><small class="asset-hint">Nguồn: ' + esc(paintData.source || '') + ' (' + colors.length + ' màu)</small><button type="button" data-close>Đóng</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        arrangeFilterSidebar(panel,sidebarState);
        wireLibraryActions(panel,sidebarState,paint);
        panel.querySelector('[data-close]').onclick = close;
        panel.querySelector('[aria-label="Hãng sơn"]').onchange = event => { brand = event.target.value; categoryId = 'all'; clearFacets(facets); paint(); };
        wirePickerCategories(panel,value => { categoryId = value; clearFacets(facets); paint(); });
        wireFacets(panel,facets,paint);
        wireAssetSearch(panel,() => query,value => { query = value; },paint);
        panel.querySelectorAll('[data-paint-code]').forEach(button => {
          button.onclick = () => {
            const c = colors.find(entry => entry.code === button.dataset.paintCode);
            close();
            if (c) onPick?.(c);
          };
        });
        const custom = panel.querySelector('.asset-paint-custom');
        if (custom) custom.onsubmit = event => {
          event.preventDefault();
          const form = new FormData(custom);
          const code = String(form.get('code') || '').trim();
          if (!code) return;
          close();
          onPick?.({ kind: 'paint', brand, code, name: String(form.get('name') || '').trim(), hex: String(form.get('hex') || '#f2eee6') });
        };
        wireLocalAssetPhotos(panel,photos,entry => { close(); onPick?.(entry); });
        if (colors.length + photos.length < 4 && query.trim()) {
          renderGoogleFallback(panel.querySelector('.asset-google-fallback-slot'), query, {
            onPickImage: entry => {
              close();
              onPick?.(entry);
            },groupName
          });
        }
        place();
      }
      panel.innerHTML = '<p class="asset-empty">Đang tải bảng màu…</p>';
      document.addEventListener('gdhome:library-changed',paint,{signal});
      paint();
    });
  }

  async function loadWoodData() {
    const library = await loadLibrary();
    const categories = new Set(library.categories.filter(woodCategory).map(category => category.id));
    return {woods:library.items.filter(item => !item.hidden && item.code &&
      (item.kind === 'wood' || (item.kind !== 'paint' && (categories.has(item.categoryId) ||
        facetValues(item,'brand').some(brand => fold(brand) === 'an cuong'))))).map(withWoodBrand),source:'Dữ liệu dùng chung',categories:library.categories};
  }

  const withWoodBrand = item => ({...item,brand:item.brand || 'An Cường',kind:'wood'});
  function pickWood(anchor, { groupName, onPick, title = 'Mã gỗ' } = {}) {
    return popover(anchor, async (panel, close, place, signal) => {
      const facets = {};
      const sidebarState = {groups:{}};
      let brand = '', collection = 'all', query = '', revision = 0, tab = 'codes', categoryId = 'all';
      async function paint() {
        const current = ++revision;
        let woodData;
        try { woodData = await loadWoodData(); } catch (error) {
          if (current === revision) panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>';
          return;
        }
        const allPhotos = await findLocalAssetPhotos(query,'ancuong-wood',groupName);
        if (!panel.isConnected || current !== revision) return;
        const available = [...woodData.woods,...allPhotos], categories = new Set(available.map(item => item.categoryId));
        if (categoryId !== 'all' && !categories.has(categoryId)) { categoryId = 'all'; clearFacets(facets); }
        const inCategory = item => categoryId === 'all' || item.categoryId === categoryId;
        const categoryWoods = woodData.woods.filter(inCategory), photos = allPhotos.filter(inCategory);
        const brands = [...new Set(categoryWoods.map(wood => wood.brand))];
        const byBrand = categoryWoods.filter(wood => !brand || brand === wood.brand);
        const collections = [...new Set(byBrand.map(wood => wood.collection).filter(Boolean))];
        const scoped = byBrand.filter(w => collection === 'all' || w.collection === collection);
        pruneFacets([...scoped,...photos],facets);
        const candidates = scoped.filter(w => !query || fold(w.code).includes(fold(query)) || fold(w.name).includes(fold(query)) || fold(w.collection).includes(fold(query)));
        const woods = sortLibrary(candidates.filter(item => matchFacets(item,facets)),sidebarState.sort);
        const matchingPhotos = sortLibrary(photos.filter(item => matchFacets(item,facets)),sidebarState.sort);
        const photoSamples = sortLibrary([...new Map([...matchingPhotos,...woods.filter(item => item.full && item.thumb)]
          .map(item => [item.id,item])).values()],sidebarState.sort);
        const codeCards = woods.length ? '<div class="asset-wood-grid">' + woods.map((w,index) =>
          '<div class="asset-specialized-card"><button type="button" data-wood-index="' + index + '" class="asset-wood-card" data-wood-code="' +
          esc(w.code) + '" title="' + esc(w.code + ' – ' + w.name) + '">' + (w.thumb ? '<img data-lib-asset="' + esc(w.thumb) + '" alt="">' : '') +
          '<strong>' + esc(w.code) + '</strong><span class="wood-name">' + esc(w.name) + '</span><span class="wood-badge">' +
          esc([w.brand,w.collection].filter(Boolean).join(' · ')) + '</span></button>' + assetItemActions(w) + '</div>').join('') + '</div>' :
          (facetEmpty(matchingPhotos,facets) || '<p class="asset-empty">Không tìm thấy mã gỗ phù hợp với "' + esc(query) + '".</p>');
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters">' +
          pickerCategorySelect(woodData.categories.filter(category => categories.has(category.id)),available,categoryId) +
          '<select aria-label="Hãng"><option value="">Tất cả hãng</option>' +
          brands.map(name => '<option value="' + esc(name) + '"' + (name === brand ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select>' +
          '<select aria-label="Dòng sản phẩm"><option value="all">Tất cả dòng sản phẩm</option>' +
          collections.map(col => '<option value="' + esc(col) + '"' + (col === collection ? ' selected' : '') + '>' + esc(col) + '</option>').join('') + '</select>' +
          '<input type="search" placeholder="Tìm theo mã, tên hoặc catalogue" value="' + esc(query) + '">' +
          '<div role="tablist" class="asset-wood-tabs" aria-label="Nguồn mẫu gỗ">' + [['codes','Mã gỗ'],['photos','Ảnh mẫu']].map(([key,label]) =>
            '<button type="button" role="tab" data-wood-tab="' + key + '" aria-selected="' + (key === tab) + '">' + label + '</button>').join('') + '</div></div>' +
          '<div class="asset-body">' + facetMarkup([...candidates,...photos],facets) + (tab === 'photos' ?
            (localAssetPhotos(photoSamples) || facetEmpty(photoSamples,facets) || '<p class="asset-empty">Chưa có ảnh mẫu phù hợp.</p>') :
            codeCards + localAssetPhotos(matchingPhotos)) + onlineSlot +
          '</div>' +
          '<footer><small class="asset-hint">Nguồn: ' + esc(woodData.source || '') + ' (' + woods.length + ' mã)</small><button type="button" data-close>Đóng</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        arrangeFilterSidebar(panel,sidebarState);
        wireLibraryActions(panel,sidebarState,paint);
        panel.querySelector('[data-close]').onclick = close;
        panel.querySelectorAll('[data-wood-tab]').forEach(button => button.onclick = () => { tab = button.dataset.woodTab; paint(); });
        panel.querySelector('[aria-label=Hãng]').onchange = event => { brand = event.target.value; collection = 'all'; clearFacets(facets); paint(); };
        panel.querySelector('[aria-label="Dòng sản phẩm"]').onchange = event => { collection = event.target.value; clearFacets(facets); paint(); };
        wirePickerCategories(panel,value => { categoryId = value; brand = ''; collection = 'all'; clearFacets(facets); paint(); });
        wireFacets(panel,facets,paint);
        wireAssetSearch(panel,() => query,value => { query = value; },paint);
        panel.querySelectorAll('[data-wood-code]').forEach(button => {
          button.onclick = () => {
            const w = woods[Number(button.dataset.woodIndex)];
            close();
            if (w) { updateItem({id:w.id,used:true}).catch(() => {}); onPick?.({...w,kind:'wood'}); }
          };
        });
        wireLocalAssetPhotos(panel,tab === 'photos' ? photoSamples : photos,entry => { close(); onPick?.(entry); });
        if (woods.length + photos.length < 4 && query.trim()) {
          renderGoogleFallback(panel.querySelector('.asset-google-fallback-slot'), query, {
            onPickImage: entry => {
              close();
              onPick?.(entry);
            },categoryId:'ancuong-wood',groupName
          });
        }
        place();
      }
      panel.innerHTML = '<p class="asset-empty">Đang tải danh mục mã gỗ…</p>';
      document.addEventListener('gdhome:library-changed',paint,{signal});
      paint();
    });
  }

  async function uploadToLibrary(categoryId,files,onStatus = toast,display) {
    const images = files.filter(file => file.type?.startsWith('image/'));
    if (!images.length) throw new Error('Chọn file ảnh.');
    const uploaded = [];
    let before = 0, after = 0;
    for (const [index,file] of images.entries()) {
      onStatus?.('Đang nén và tải ' + (index+1) + '/' + images.length + '…');
      const {full,thumb} = await GDHomeImages.compress(file);
      before += file.size; after += full.size;
      const fullName = await storeAsset(full);
      const image = {full:fullName,thumb:thumb === full ? fullName : await storeAsset(thumb)};
      uploaded.push({...image,display,name:(file.name || '').replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').slice(0,160)});
    }
    for (let index = 0; index < uploaded.length; index += 50) await addItems(categoryId,uploaded.slice(index,index+50));
    const sized = bytes => bytes >= 1048576 ? (bytes/1048576).toFixed(1).replace('.',',') + ' MB' : Math.max(1,Math.round(bytes/1024)) + ' KB';
    onStatus?.('Đã thêm ' + uploaded.length + ' ảnh · ' + sized(before) + ' → ' + sized(after));
    return uploaded;
  }

  function folderTags(path) {
    const title = value => value.toLocaleLowerCase('vi').replace(/(^|\s)\p{L}/gu,letter => letter.toLocaleUpperCase('vi'));
    return [...new Set(path.split('/').filter(Boolean).flatMap(folder => folder.split(/\s+-\s+/)).map(title))];
  }
  async function droppedCatalogueFiles(entries) {
    const files = [];
    async function walk(entry,path = '') {
      if (entry.isFile) {
        const file = await new Promise((resolve,reject) => entry.file(resolve,reject));
        files.push({file,path});
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        for (;;) {
          const children = await new Promise((resolve,reject) => reader.readEntries(resolve,reject));
          if (!children.length) break;
          for (const child of children) await walk(child,path + entry.name + '/');
        }
      }
      if (files.length > 2000) throw new Error('Thư mục vượt 2.000 tệp.');
    }
    for (const entry of entries) await walk(entry);
    return files;
  }
  function reviewFolders(categoryId,files,display) {
    const groups = new Map();
    let images = 0;
    for (const {file,path} of files) {
      if (!isPdf(file) && !file.type.startsWith('image/')) continue;
      if (!isPdf(file) && ++images > 500) throw new Error('Mỗi lần nhập tối đa 500 ảnh.');
      if (!groups.has(path)) groups.set(path,[]);
      groups.get(path).push(file);
    }
    if (!groups.size) throw new Error('Không tìm thấy ảnh hoặc PDF.');
    const {dialog,body} = modal('asset-folder-dialog','Duyệt thư mục nhập');
    const controller = new AbortController();
    body.innerHTML = '<table><thead><tr><th>Thư mục</th><th>Ảnh / PDF</th><th>Tag</th></tr></thead><tbody>' +
      [...groups].map(([path,files]) => '<tr><td>' + esc(path || 'Tệp rời') + '</td><td>' +
        files.filter(file => !isPdf(file)).length + ' ảnh / ' + files.filter(isPdf).length +
        ' PDF</td><td><input aria-label="Tag thư mục" value="' + esc(folderTags(path).join(', ')) + '"></td></tr>').join('') +
      '</tbody></table><p role="status"></p><button data-folder-save>Lưu ảnh và mở PDF</button> <button data-folder-cancel>Huỷ</button>';
    dialog.addEventListener('close',() => controller.abort(),{once:true});
    body.querySelector('[data-folder-cancel]').onclick = () => controller.abort();
    body.querySelector('[data-folder-save]').onclick = async event => {
      event.currentTarget.disabled = true;
      const status = body.querySelector('[role=status]');
      let done = 0;
      const pdfs = [], seen = new Set();
      try {
        const data = await loadLibrary();
        data.items.filter(item => item.categoryId === categoryId).forEach(item => seen.add(item.originalFull || item.full));
        for (const [index,files] of [...groups.values()].entries()) {
          const tags = body.querySelectorAll('tbody input')[index].value.split(',').map(tag => tag.trim()).filter(Boolean);
          for (const file of files) {
            controller.signal.throwIfAborted();
            if (isPdf(file)) { pdfs.push({file,tags}); continue; }
            const original = await uploadImage(file);
            controller.signal.throwIfAborted();
            if (!seen.has(original.full)) {
              seen.add(original.full);
              await addItems(categoryId,[{...original,display,name:file.name.replace(/\.[^.]+$/,''),tags}]);
            }
            status.textContent = 'Đã xử lý ' + (++done) + '/' + images + ' ảnh';
          }
        }
        if (pdfs.length) {
          dialog.close();
          const next = () => {
            const pdf = pdfs.shift();
            if (pdf) openWoodCatalogue(categoryId,null,{...pdf,display,onClose:next});
          };
          next();
        } else status.textContent = 'Đã xử lý ' + done + '/' + images + ' ảnh. Hoàn tất.';
      } catch (error) { status.textContent = controller.signal.aborted ? 'Đã huỷ. Các ảnh đã lưu vẫn giữ trong thư viện.' : error.message; }
    };
  }

  function modal(className,title) {
    const dialog = document.createElement('dialog');
    dialog.className = 'shell-dialog asset-dialog ' + className;
    dialog.innerHTML = '<button type="button" class="close-dialog" aria-label="Đóng">×</button><h2>' + esc(title) + '</h2><div class="asset-dialog-body"></div>';
    document.body.append(dialog);
    dialog.querySelector('.close-dialog').onclick = () => dialog.close();
    dialog.addEventListener('click',event => { if (event.target === dialog) dialog.close(); });
    dialog.onclose = () => dialog.remove();
    dialog.showModal();
    return {dialog,body:dialog.querySelector('.asset-dialog-body')};
  }

  const woodPatterns = [
    '\\b\\d{3,4}\\s?[A-Z]{1,3}\\b', '\\bMS\\s?\\d{3,4}\\b',
    '\\b[A-Z]{1,3}\\s?\\d{3,4}(\\s?[A-Z]{1,3})?\\b', '\\b\\d{9}\\b'
  ];
  const catalogueKey = item => (item.brand || 'An Cường').trim().toLowerCase() + ':' + item.code.toUpperCase().replace(/\s+/g,'');
  const bounded = (value,min,max) => Math.max(min,Math.min(max,value));
  const anCuongCode = /^(MFC|MDF|HDF|LAM(?:INATE)?|ACR(?:YLIC)?|VENEER)\s*[-–]?\s*((?:[A-Z]{1,4}\s*)?\d{2,5}(?:[.-]\d+)?)\s+([A-Z][A-Z0-9]{0,7})\b/i;
  // A finder has a dark/light/dark/light/dark sequence of 1:1:3:1:1
  // through its center. Require a vertical crossing and two matching neighbors.
  function qrFinderBoxes({data,width,height}) {
    const dark = new Uint8Array(width*height);
    for (let i=0; i<dark.length; i++) dark[i] = Number(data[i*4]+data[i*4+1]+data[i*4+2] < 270);
    const finders = [];
    function scan(length,pixel,onFinder) {
      const runs = [];
      let start = 0, color = pixel(0);
      for (let i=1; i<=length; i++) {
        const next = i < length ? pixel(i) : -1;
        if (next === color) continue;
        runs.push(i-start);
        if (runs.length > 5) runs.shift();
        if (color && runs.length === 5) {
          const module = runs.reduce((sum,n) => sum+n,0)/7;
          if (module >= 1 && runs.every((n,j) => Math.abs(n/module-(j === 2 ? 3 : 1)) <= .65)) {
            onFinder(i-runs[4]-runs[3]-runs[2]/2,module);
          }
        }
        color = next;
        start = i;
      }
    }
    for (let y=0; y<height; y++) scan(width,x => dark[y*width+x],(x,module) => {
      const known = finders.find(p => Math.abs(p.x-x) < module && Math.abs(p.y-y) < module*2);
      if (known) return;
      const column = Math.floor(x), top = Math.max(0,y-Math.ceil(module*6));
      scan(Math.min(height-top,Math.ceil(module*12)),j => dark[(top+j)*width+column],(middle,vertical) => {
        if (Math.abs(top+middle-y) <= module*1.5 && Math.abs(vertical/module-1) <= .35) {
          finders.push({x,y:top+middle,module:(module+vertical)/2});
        }
      });
    });
    const boxes = [];
    for (const corner of finders) {
      const {x,y,module} = corner;
      const same = p => Math.abs(p.module/module-1) <= .25;
      const across = finders.filter(p => same(p) && p.x-x >= module*12 && p.x-x <= module*175 &&
        Math.abs(p.y-y) <= module*1.5).sort((a,b) => a.x-b.x);
      for (const right of across) {
        const span = right.x-x;
        const down = finders.find(p => same(p) && Math.abs(p.x-x) <= module*1.5 && Math.abs(p.y-y-span) <= module*2);
        if (!down) continue;
        const version = (span/module-14)/4;
        if (Math.abs(version-Math.round(version)) > .45) continue;
        boxes.push({x:x-module*3.5,y:y-module*3.5,w:span+module*7,h:down.y-y+module*7});
        break;
      }
    }
    return boxes;
  }

  async function catalogueQrBoxes(context,width,height) {
    const boxes = [];
    if (window.BarcodeDetector) {
      try {
        const detector = new window.BarcodeDetector({formats:['qr_code']});
        for (const {boundingBox:{x,y,width:w,height:h}} of await detector.detect(context.canvas)) boxes.push({x,y,w,h});
      } catch {
        // Some platforms expose the API without a working QR detector.
      }
    }
    for (const box of qrFinderBoxes(context.getImageData(0,0,width,height))) {
      if (boxes.some(other => Math.abs(other.x-box.x) < box.w*.35 && Math.abs(other.y-box.y) < box.h*.35)) continue;
      boxes.push(box);
    }
    return boxes;
  }
  function anCuongCrop(context,left,top,right,bottom) {
    left = Math.max(0,Math.floor(left)); top = Math.max(0,Math.floor(top));
    const width = Math.max(1,Math.floor(right)-left), height = Math.max(1,Math.floor(bottom)-top);
    const pixels = context.getImageData(left,top,width,height).data;
    const visible = index => pixels[index+3] > 0 && Math.min(pixels[index],pixels[index+1],pixels[index+2]) < 244;
    let start = 0, best = [0,0];
    for (let y=0; y<=height; y++) {
      let count = 0;
      if (y < height) for (let x=0; x<width; x+=2) if (visible((y*width+x)*4)) count++;
      if (count >= width*.17) continue;
      if (y-start > best[1]-best[0]) best = [start,y];
      start = y+1;
    }
    if (best[1]-best[0] < 3) return null;
    let minX = width, maxX = 0, brightness = 0, count = 0;
    for (let y=best[0]; y<best[1]; y++) for (let x=0; x<width; x++) {
      const index = (y*width+x)*4;
      if (!visible(index)) continue;
      minX = Math.min(minX,x); maxX = Math.max(maxX,x);
      brightness += .2126*pixels[index]+.7152*pixels[index+1]+.0722*pixels[index+2];
      count++;
    }
    const light = brightness/count;
    return {x:left+minX,y:top+best[0],w:maxX-minX+1,h:best[1]-best[0],tone:light >= 170 ? 'Sáng' : light < 95 ? 'Tối' : 'Trung tính'};
  }

  function anCuongLabel(text,name = '') {
    const parsed = text.match(anCuongCode);
    return parsed ? {code:parsed[2].toUpperCase(),name,material:parsed[1].toUpperCase(),finish:parsed[3].toUpperCase(),
      confidence:.9,needsReview:false} : {code:text,name,confidence:.35,needsReview:true};
  }

  async function anCuongSwatches(context,canvas,labels,includeCode) {
    const {width,height} = canvas;
    const boxes = (await catalogueQrBoxes(context,width,height)).sort((a,b) => a.y-b.y || a.x-b.x);
    const candidates = boxes.flatMap(qr => {
      const right = Math.min(width,qr.x+qr.w*1.08), left = Math.max(0,right-qr.w*3.8);
      const band = labels.filter(label => label.x >= left && label.x < qr.x &&
        label.y >= qr.y-qr.h*.45 && label.y <= qr.y+qr.h);
      const labelTop = band.reduce((top,label) => Math.min(top,label.y-label.height),qr.y);
      const previous = boxes.filter(box => box.y < qr.y-qr.h && Math.abs(box.x-qr.x) < qr.w)
        .reduce((top,box) => Math.max(top,box.y+box.h),0);
      const box = anCuongCrop(context,left,Math.max(previous,labelTop-qr.w*6.5),right,labelTop);
      if (!box || box.h/box.w < 1.15 || box.h/box.w > 2.3 || box.w < qr.w*1.7 ||
          Math.abs(box.x+box.w-(qr.x+qr.w)) > qr.w*.45 ||
          qr.y-box.y-box.h > qr.h*.75) return [];
      const lines = [];
      for (const part of band.filter(label => label.x >= box.x-qr.w*.15 && label.y > box.y+box.h)
        .sort((a,b) => a.y-b.y || a.x-b.x)) {
        const line = lines.find(row => Math.abs(row.y-part.y) < part.height*.45);
        if (line) line.parts.push(part);
        else lines.push({y:part.y,parts:[part]});
      }
      const [text='',name=''] = lines.map(line => line.parts.sort((a,b) => a.x-b.x).map(part => part.text).join(' '));
      const bottom = Math.min(height,qr.y+qr.h+box.h*.02);
      return [{box,bottom,label:anCuongLabel(text,name)}];
    });
    const ratios = candidates.map(({box,bottom}) => (bottom-box.y)/box.w).sort((a,b) => a-b);
    const ratio = (ratios[Math.floor((ratios.length-1)/2)]+ratios[Math.floor(ratios.length/2)])/2;
    return candidates.map(({box,bottom,label}) => {
      const w = box.w, h = includeCode ? Math.min(height-box.y,Math.max(bottom-box.y,Math.round(w*ratio))) : box.h;
      return {...label,qr:true,tone:box.tone,grain:'Gỗ',...(includeCode ? {view:clampView({x:.5,y:box.h/(2*h),z:1},w/h)} : {}),
        crop:{x:box.x/width,y:box.y/height,w:w/width,h:h/height}};
    });
  }

  const kitchenSubgroups = ['Giá bát đĩa nâng hạ','Giá bát đĩa','Giá xoong nồi','Giá dao thớt gia vị','Thùng gạo','Thùng rác',
    'Tủ đồ khô','Góc liên hoàn','Ray / bản lề','Tay nâng'];
  function catalogueGuideRatio(guide) {
    const ratios = (guide?.examples || []).filter(example => example.crop).map(({aspect,crop}) => aspect*crop.w/crop.h).sort((a,b) => a-b);
    return ratios.length ? (ratios[Math.floor((ratios.length-1)/2)]+ratios[Math.floor(ratios.length/2)])/2 : 0;
  }
  function fitCatalogueCrop(box,ratio) {
    if (!ratio) return box;
    const w = Math.min(1,ratio,Math.sqrt(box.w*box.h*ratio)), h = w/ratio;
    return {x:bounded(box.x+(box.w-w)/2,0,1-w),y:bounded(box.y+(box.h-h)/2,0,1-h),w,h};
  }
  function includeCatalogueCode(crop,codeBox) {
    if (!codeBox) return crop;
    const x = bounded(Math.min(crop.x,codeBox.x),0,1), y = bounded(Math.min(crop.y,codeBox.y),0,1);
    const right = bounded(Math.max(crop.x+crop.w,codeBox.x+codeBox.w),x,1);
    const bottom = bounded(Math.max(crop.y+crop.h,codeBox.y+codeBox.h),y,1);
    return {x,y,w:right-x,h:bottom-y};
  }
  function pdfLabelCrop(label,canvas) {
    const pad = label.height*.25;
    return {x:(label.x-pad)/canvas.width,y:(label.y-label.height-pad)/canvas.height,
      w:(label.width+2*pad)/canvas.width,h:(label.height+2*pad)/canvas.height};
  }

  const middleValue = values => {
    const sorted = [...values].sort((a,b) => a-b);
    return sorted.length ? (sorted[(sorted.length-1)>>1]+sorted[sorted.length>>1])/2 : 0;
  };
  function catalogueImageBounds(left,top,right,bottom,width,height) {
    const x = Math.max(0,left), y = Math.max(0,top);
    const w = Math.min(right,width)-x, h = Math.min(bottom,height)-y;
    const ratio = w/h, fraction = w*h/(width*height);
    return w > 0 && h > 0 && ratio >= .3 && ratio <= 3 && fraction >= .005 && fraction < .85 ? {x,y,w,h} : null;
  }
  async function embeddedCatalogueImages(page,viewport,pdfjs) {
    const {fnArray,argsArray} = await page.getOperatorList();
    const {OPS,Util} = pdfjs;
    const stack = [], images = [];
    let transform = [1,0,0,1,0,0];
    function add(matrix) {
      const [a,b,c,d,x,y] = Util.transform(viewport.transform,matrix);
      const xs = [x,x+a,x+c,x+a+c], ys = [y,y+b,y+d,y+b+d];
      const box = catalogueImageBounds(Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys),viewport.width,viewport.height);
      if (box) images.push(box);
    }
    for (const [i,op] of fnArray.entries()) {
      const args = argsArray[i];
      if (op === OPS.save || op === OPS.paintFormXObjectBegin) {
        stack.push(transform);
        if (op === OPS.paintFormXObjectBegin && args?.[0]?.length === 6) transform = Util.transform(transform,args[0]);
      } else if (op === OPS.restore || op === OPS.paintFormXObjectEnd) {
        transform = stack.pop() || transform;
      } else if (op === OPS.transform) {
        transform = Util.transform(transform,args);
      } else if (op === OPS.paintImageXObject || op === OPS.paintInlineImageXObject) {
        add(transform);
      } else if (op === OPS.paintImageXObjectRepeat) {
        const [,sx,sy,positions] = args;
        for (let j=0;j<positions.length;j+=2) add(Util.transform(transform,[sx,0,0,sy,positions[j],positions[j+1]]));
      }
    }
    return images;
  }
  function rasterCatalogueImages(context,canvas) {
    const {width,height} = canvas;
    const pixels = context.getImageData(0,0,width,height).data;
    const channels = [[],[],[]];
    function sample(x,y) {
      const p = (y*width+x)*4;
      for (let i=0;i<3;i++) channels[i].push(pixels[p+i]);
    }
    for (let i=0;i<64;i++) {
      const x = Math.floor(i*(width-1)/63), y = Math.floor(i*(height-1)/63);
      sample(x,0); sample(x,height-1); sample(0,y); sample(width-1,y);
    }
    const [r,g,b] = channels.map(middleValue);
    const foreground = new Uint8Array(width*height);
    for (let i=0,p=0;i<foreground.length;i++,p+=4) {
      if (pixels[p+3] > 0 && Math.max(Math.abs(pixels[p]-r),Math.abs(pixels[p+1]-g),Math.abs(pixels[p+2]-b)) > 30) foreground[i] = 1;
    }
    const queue = new Int32Array(foreground.length), images = [];
    function push(pixel,index) {
      if (!foreground[pixel]) return index;
      foreground[pixel] = 0;
      queue[index] = pixel;
      return index+1;
    }
    for (let i=0;i<foreground.length;i++) {
      if (!foreground[i]) continue;
      let end = push(i,0), left = width, right = 0, top = height, bottom = 0, sum = 0, squares = 0;
      for (let next=0;next<end;next++) {
        const p = queue[next], x = p%width, y = Math.floor(p/width), offset = p*4;
        left = Math.min(left,x); right = Math.max(right,x); top = Math.min(top,y); bottom = Math.max(bottom,y);
        const value = (pixels[offset]+pixels[offset+1]+pixels[offset+2])/3;
        sum += value; squares += value*value;
        if (x > 0) end = push(p-1,end);
        if (x+1 < width) end = push(p+1,end);
        if (y > 0) end = push(p-width,end);
        if (y+1 < height) end = push(p+width,end);
      }
      const box = catalogueImageBounds(left,top,right+1,bottom+1,width,height);
      if (!box) continue;
      const density = end/(box.w*box.h), variance = squares/end-(sum/end)**2;
      // A vector swatch can be a single flat colour. Require an almost solid rectangle in that case.
      if (density >= .85 && (variance >= 16 || density >= .97)) images.push(box);
    }
    return images;
  }
  const intersection = (a,b) => Math.max(0,Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x)) *
    Math.max(0,Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y));
  const relativeCrop = ({x,y,w,h},canvas) => ({x:x/canvas.width,y:y/canvas.height,w:w/canvas.width,h:h/canvas.height});
  function catalogueTextBounds(item,viewport,pdfjs,width,height) {
    const [a,b,c,d,x,y] = pdfjs.Util.transform(viewport.transform,item.transform);
    const along = Math.hypot(a,b) || 1, up = Math.hypot(c,d) || 1;
    const dx = a/along*width, dy = b/along*width, ux = c/up*height, uy = d/up*height;
    const xs = [x-ux*.22,x+ux,x+dx-ux*.22,x+dx+ux], ys = [y-uy*.22,y+uy,y+dy-uy*.22,y+dy+uy];
    const left = Math.min(...xs), top = Math.min(...ys);
    return {x:left,y:top,w:Math.max(...xs)-left,h:Math.max(...ys)-top};
  }
  const cataloguePricePattern = /(?:\b(?:đơn\s+)?giá\s*[:=]?\s*)([\d][\d.,\u00a0 ]*)(?:\s*(?:₫|VNĐ|VND))?|([\d][\d.,\u00a0 ]*)\s*(?:₫|VNĐ|VND)(?=$|[\s/;,])/i;
  function cataloguePrice(label,labels) {
    const match = label.text.match(cataloguePricePattern) || labels.find(other => other !== label && other.x > label.x &&
      other.x-label.x-label.width < label.height*4 && Math.abs(other.y-label.y) <= label.height*.5 &&
      cataloguePricePattern.test(other.text))?.text.match(cataloguePricePattern);
    if (!match) return {};
    const price = attributeCatalog().parsePrice(match[1] || match[2]);
    const priceUnit = match.input.slice(match.index+match[0].length).match(/^\s*\/\s*(m²|m2|viên|bộ|md|tấm|cái)(?=$|[\s;,])/i)?.[1];
    return price === undefined ? {} : {price,priceUnit};
  }
  async function matchCatalogueCrops(page,viewport,pdfjs,context,canvas,matches,labels) {
    const embedded = await embeddedCatalogueImages(page,viewport,pdfjs);
    const images = [...embedded,...rasterCatalogueImages(context,canvas).filter(box =>
      !embedded.some(image => intersection(image,box) >= .6*Math.min(image.w*image.h,box.w*box.h)))];
    const pairs = [];
    for (const label of matches) {
      const text = label.box;
      for (const image of images) {
        const xOverlap = Math.min(text.x+text.w,image.x+image.w)-Math.max(text.x,image.x);
        const yOverlap = Math.min(text.y+text.h,image.y+image.h)-Math.max(text.y,image.y);
        const gaps = [text.y-image.y-image.h,image.y-text.y-text.h,text.x-image.x-image.w];
        const aligned = [xOverlap >= Math.min(text.w,image.w)*.2,xOverlap >= Math.min(text.w,image.w)*.2,
          yOverlap >= Math.min(text.h,image.h)*.4];
        const side = gaps.findIndex((gap,i) => aligned[i] && gap >= -text.h*.4 && gap <= Math.max(text.h*3,(i === 2 ? image.w : image.h)*.35));
        if (side < 0) continue;
        const centerDistance = side === 2 ? Math.abs(text.y+text.h/2-image.y-image.h/2) :
          Math.abs(text.x+text.w/2-image.x-image.w/2);
        pairs.push({label,image,side,gap:Math.max(0,gaps[side]),centerDistance});
      }
    }
    const offsets = [0,1,2].map(side => middleValue(matches.flatMap(label => {
      const gaps = pairs.filter(pair => pair.label === label && pair.side === side).map(pair => pair.gap);
      return gaps.length ? [Math.min(...gaps)] : [];
    })));
    const score = pair => pair.gap+Math.abs(pair.gap-offsets[pair.side])*.25+pair.centerDistance*.12;
    pairs.sort((a,b) => a.side-b.side || score(a)-score(b));
    const chosen = new Map(), used = new Set();
    for (const {label,image} of pairs) {
      if (!chosen.has(label) && !used.has(image)) { chosen.set(label,image); used.add(image); }
    }
    return matches.map(label => {
      const image = chosen.get(label);
      const size = label.text.match(/\b\d{2,4}\s*[x×*]\s*\d{2,4}(?:\s*(?:cm|mm))?\b/i)?.[0] || '';
      const name = label.name.replace(cataloguePricePattern,'').replace(/\s*\/\s*(?:m²|m2|viên|bộ|md|tấm|cái)\s*$/i,'').trim();
      const metadata = {code:label.code,name,size,...cataloguePrice(label,labels)};
      if (!image) return {...metadata,crop:{x:0,y:0,w:1,h:1},confidence:0,needsReview:true,unmatched:true};
      const inset = {x:image.x+1,y:image.y+1,w:image.w-2,h:image.h-2};
      const needsReview = inset.w*inset.h < image.w*image.h*.97 || labels.some(text => intersection(inset,text.box) > 0);
      return {...metadata,crop:relativeCrop(needsReview ? image : inset,canvas),confidence:needsReview ? .45 : .95,needsReview};
    });
  }

  function wireCatalogueGuide(form,status) {
    const region = form.querySelector('[data-catalogue-guide]');
    const previews = region.querySelector('[data-guide-previews]');
    const input = form.elements.guideImages;
    const template = form.elements.guidePreset;
    const key = 'gdhome-catalogue-layouts-v1';
    let templates, examples = [];
    try { templates = JSON.parse(localStorage.getItem(key) || '[]'); } catch { templates = []; }
    if (!Array.isArray(templates)) templates = [];
    const matching = () => templates.filter(item => item.category === form.elements.category.value && item.brand === fold(form.elements.brand.value));
    const updateTemplates = () => {
      template.innerHTML = '<option value="">Chọn mẫu đã lưu</option>' + matching().map(item => '<option>' + esc(item.name) + '</option>').join('');
    };
    function render() {
      previews.replaceChildren();
      examples.forEach((example,index) => {
        const card = document.createElement('div');
        const image = new Image();
        image.src = example.image;
        image.alt = 'Ảnh minh hoạ ' + (index+1);
        card.append(image);
        for (const [field,label] of [['crop','Vùng cần cắt'],['codeBox','Vùng chứa mã']]) {
          const button = document.createElement('button');
          button.type = 'button';
          button.textContent = label;
          button.dataset.guideBox = field;
          button.setAttribute('aria-pressed',!!example[field]);
          button.onclick = async () => {
            const copy = new Image();
            copy.src = example.image;
            await copy.decode();
            editWoodCrop(copy,example[field] || {x:.2,y:.2,w:.6,h:.6},box => { example[field] = box; render(); },label);
          };
          card.append(button);
        }
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.textContent = 'Bỏ ảnh';
        remove.onclick = () => { examples.splice(index,1); render(); };
        card.append(remove);
        previews.append(card);
      });
    }
    async function add(files) {
      try {
        const images = files.filter(file => file.type.startsWith('image/'));
        if (images.length+examples.length > 3) throw new Error('Chọn tối đa 3 ảnh minh hoạ.');
        for (const file of images) {
          if (file.size > 12*1024*1024) throw new Error('Ảnh minh hoạ tối đa 12 MB trước khi nén.');
          const bitmap = await createImageBitmap(file);
          const canvas = document.createElement('canvas');
          const scale = Math.min(1,640/Math.max(bitmap.width,bitmap.height));
          canvas.width = Math.max(1,Math.round(bitmap.width*scale));
          canvas.height = Math.max(1,Math.round(bitmap.height*scale));
          const context = canvas.getContext('2d');
          context.fillStyle = '#fff';
          context.fillRect(0,0,canvas.width,canvas.height);
          context.drawImage(bitmap,0,0,canvas.width,canvas.height);
          bitmap.close();
          if (examples.length >= 3) break;
          examples.push({image:canvas.toDataURL('image/jpeg',.68),aspect:canvas.width/canvas.height});
        }
      } catch (error) { status.textContent = error.message; }
      render();
    }
    input.onchange = () => { add([...input.files]); input.value = ''; };
    enableDrop(region,add);
    region.onpaste = event => {
      const files = [...event.clipboardData.files].filter(file => file.type.startsWith('image/'));
      if (files.length) { event.preventDefault(); add(files); }
    };
    const read = () => ({prompt:form.elements.guidePrompt.value.trim(),examples:structuredClone(examples)});
    form.elements.category.addEventListener('change',updateTemplates);
    form.elements.brand.addEventListener('input',updateTemplates);
    template.onchange = () => {
      const saved = matching().find(item => item.name === template.value);
      if (!saved) return;
      form.elements.layout.value = saved.layout;
      form.elements.guidePrompt.value = saved.prompt;
      examples = structuredClone(saved.examples);
      render();
    };
    region.querySelector('[data-guide-save]').onclick = () => {
      const name = form.elements.guideName.value.trim();
      if (!name) { status.textContent = 'Nhập tên mẫu bố cục.'; return; }
      const category = form.elements.category.value, brand = fold(form.elements.brand.value);
      const next = [{name,category,brand,layout:form.elements.layout.value,...read()},
        ...templates.filter(item => item.name !== name || item.category !== category || item.brand !== brand)].slice(0,12);
      try {
        localStorage.setItem(key,JSON.stringify(next));
        templates = next;
        updateTemplates();
        template.value = name;
        status.textContent = 'Đã lưu mẫu bố cục ' + name + '.';
      } catch { status.textContent = 'Không đủ bộ nhớ trình duyệt để lưu mẫu bố cục.'; }
    };
    updateTemplates();
    return read;
  }
  function kitchenCatalogueRows(labels) {
    const specPattern = /R\s*\d{2,4}\s*[x×*]\s*S\s*\d{2,4}\s*[x×*]\s*C\s*\d{2,4}/i;
    const codes = /\b[A-Z]{1,5}\d{2,}(?:[.-][A-Z0-9]+)*[A-Z0-9]*\b/i;
    const subgroup = kitchenSubgroups.find(name => labels.some(label => fold(label.text).includes(fold(name)))) || '';
    const rows = [];
    for (const label of labels.filter(label => specPattern.test(label.text) || codes.test(label.text))) {
      const row = labels.filter(other => Math.abs(other.y-label.y) <= Math.max(label.height,other.height)*.55)
        .sort((a,b) => a.x-b.x).map(other => other.text).join(' ');
      const spec = row.match(specPattern);
      if (!spec) continue;
      const code = row.slice(0,spec.index).match(codes)?.[0];
      if (!code || rows.some(other => other.code === code)) continue;
      const rest = row.slice(spec.index+spec[0].length).trim();
      const widths = rest.match(/^(\d{3,4})\s+(\d{3,4})\s*/);
      const tail = widths ? rest.slice(widths[0].length) : rest;
      const price = tail.match(/\d{1,3}(?:[.,]\d{3}){1,4}|\d{5,10}/);
      const unit = (price ? tail.slice(0,price.index) : tail).trim().split(/\s+/)[0] || '';
      rows.push({code:code.toUpperCase(),spec:spec[0].replace(/\s+/g,'').replace(/[x×]/gi,'*').toUpperCase(),
        cabinetWidth:widths?.[1] || '',innerWidth:widths?.[2] || '',unit,price:price?.[0] || '',
        subgroup,name:subgroup || code,y:label.y,height:label.height});
    }
    return rows;
  }

  async function scanWoodCatalogue(file,patterns,onPage,{ai,signal,onWarning,onPause,onAiProgress,layout,guide,includeCode = true} = {}) {
    const regexes = patterns.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => new RegExp(line,'i'));
    if (!regexes.length) throw new Error('Nhập ít nhất một mẫu nhận diện mã.');
    const pdfjs = await loadPdfJs();
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    const pdf = await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
    const results = [];
    const sources = new Map(), pageAspects = new Map(), batch = [];
    const localPages = new Set(), scannedPages = new Set();
    const generic = !['ancuong','phao','kitchen'].includes(layout);
    const keepCode = !generic && includeCode;
    const guided = !!(guide?.prompt || guide?.examples?.length);
    let aiWarning = '';
    const useAi = () => ai.pdf && ai.available && !aiWarning;
    const guideRatio = catalogueGuideRatio(guide);
    const example = guide?.examples?.find(example => example.crop && example.codeBox);
    function guidedCodeBox(crop) {
      if (!example) return;
      const {crop:sample,codeBox} = example;
      return {x:crop.x+(codeBox.x-sample.x)*crop.w/sample.w,y:crop.y+(codeBox.y-sample.y)*crop.h/sample.h,
        w:codeBox.w*crop.w/sample.w,h:codeBox.h*crop.h/sample.h};
    }
    function guideCrop(crop,page,codeBox) {
      const fitted = fitCatalogueCrop(crop,guideRatio/pageAspects.get(page));
      return keepCode ? includeCatalogueCode(fitted,codeBox || guidedCodeBox(fitted) || crop) : fitted;
    }
    async function flush() {
      if (!batch.length) return;
      const pages = batch.splice(0);
      if (!useAi()) return;
      let applied = 0;
      function accept(recognized) {
        for (const item of recognized?.items?.slice(applied) || []) {
          const source = sources.get(item.page);
          if (!source) continue;
          if (layout === 'ancuong' && localPages.has(item.page)) {
            if (!item.bbox) continue;
            const {x,y,w,h} = item.bbox;
            const match = results.find(row => row.page === item.page && row.needsReview &&
              x+w/2 >= row.crop.x && x+w/2 <= row.crop.x+row.crop.w &&
              y+h/2 >= row.crop.y && y+h/2 <= row.crop.y+row.crop.h);
            if (match) Object.assign(match,anCuongLabel(item.code,item.name),{grain:item.grain || match.grain});
            continue;
          }
          const code = item.code;
          const index = results.findIndex(row => row.page === item.page && row.code.replace(/\s/g,'').toUpperCase() === code.replace(/\s/g,'').toUpperCase());
          const match = index >= 0;
          const record = {...item,source,crop:generic ? item.bbox : guideCrop(item.bbox,item.page,results[index]?.codeBox || item.codeBBox),
            confidence:match ? Math.max(.85,item.confidence) : item.confidence,...(generic ? {needsReview:true} : {})};
          if (['phao','kitchen'].includes(layout) && localPages.has(item.page)) {
            if (match) {
              const detected = results[index];
              results[index] = {...record,...detected,grain:item.grain || detected.grain};
            }
            continue;
          }
          if (match) results[index] = record;
          else results.push(record);
        }
        applied = recognized?.items?.length || applied;
      }
      try {
        const recognized = await GDHomeAI.startJob({kind:'catalogue',pages,includeCode:keepCode,...(guided ? {guide} : {})},
          {signal,onPause,onProgress:job => { accept(job.result); onAiProgress?.(job); }});
        accept(recognized);
      } catch (error) {
        signal?.throwIfAborted();
        if (['quota','shared_quota','bad_key','no_key'].includes(error.code)) ai.available = false;
        aiWarning = 'Đã tiếp tục đọc PDF cục bộ. ' + error.message;
      }
    }
    try {
      for (let number = 1; number <= pdf.numPages; number++) {
        signal?.throwIfAborted();
        onPage(number,pdf.numPages);
        const page = await pdf.getPage(number);
        const base = page.getViewport({scale:1});
        const side = Math.max(base.width,base.height);
        const scale = Math.min(3200/side,Math.max(2,Math.min(3,1600/side)));
        const viewport = page.getViewport({scale});
        const {items} = await page.getTextContent();
        const labels = items.filter(item => item.str?.trim()).map(item => {
          const [x,y] = viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
          const width = item.width*scale, height = Math.max(1,item.height*scale);
          return {text:item.str.trim(),x,y,width,height,box:catalogueTextBounds(item,viewport,pdfjs,width,height)};
        });
        const matches = layout === 'ancuong' ? [] : layout === 'kitchen' ? kitchenCatalogueRows(labels) : labels.flatMap(label => {
          if (layout === 'phao') {
            const code = label.text.match(/\b[A-Z]{1,4}\d{3,8}[A-Z0-9]*\b/i)?.[0];
            return code ? [{...label,code:code.toUpperCase(),name:code}] : [];
          }
          const match = regexes.map(regex => label.text.match(regex)).filter(Boolean)
            .sort((a,b) => a.index-b.index || b[0].length-a[0].length)[0];
          if (!match?.[0] || match[0].length > 80) return [];
          const name = label.text.replace(match[0],'').replace(/^[\s:–—-]+/,'').trim() ||
            labels.find(other => other !== label && Math.abs(other.y-label.y) <= label.height*.5 &&
              other.x >= label.x+label.width-2 && other.x-label.x-label.width < label.height*4 &&
              !regexes.some(regex => regex.test(other.text)))?.text || '';
          return [{...label,code:match[0].trim().toUpperCase(),name}];
        });
        if (layout !== 'ancuong' && labels.length && !matches.length) { page.cleanup(); continue; }
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        await page.render({canvasContext:context,viewport}).promise;
        signal?.throwIfAborted();
        const swatches = layout === 'ancuong' ? await anCuongSwatches(context,canvas,labels,includeCode) : [];
        const detected = generic && matches.length ? await matchCatalogueCrops(page,viewport,pdfjs,context,canvas,matches,labels) : [];
        if (results.length + matches.length + swatches.length > 5000) throw new Error('Catalogue vượt 5.000 mã. Hãy chia PDF thành nhiều lượt.');
        const needsAi = generic ? !detected.some(item => !item.unmatched) : layout === 'ancuong' ? !swatches.some(item => !item.needsReview) : !matches.length;
        if (layout === 'ancuong' && labels.length && !swatches.length) {
          canvas.width = canvas.height = 0;
          page.cleanup();
          continue;
        }
        // Save page as a compressed image and keep only the swatch canvases live.
        const source = URL.createObjectURL(await new Promise(resolve => canvas.toBlob(resolve,'image/webp',.94)));
        sources.set(number,source);
        pageAspects.set(number,canvas.width/canvas.height);
        if (!labels.length) scannedPages.add(number);
        if (matches.length || swatches.length) localPages.add(number);
        if (needsAi && useAi()) batch.push({number,image:canvas.toDataURL('image/jpeg',.7),
          text:labels.slice(0,500).map(({text,x,y,width,height}) => ({text,x:x/canvas.width,y:y/canvas.height,w:width/canvas.width,h:height/canvas.height}))});
        for (const swatch of [...swatches,...detected]) results.push({...swatch,page:number,source});
        if (layout === 'kitchen') {
          const first = matches[0];
          if (first) {
            const tableTop = labels.filter(label => label.y < first.y && label.y >= first.y-first.height*12 &&
              /quy cach|don gia|ma dat hang|kich thuoc tu/.test(fold(label.text)))
              .reduce((top,label) => Math.min(top,label.y-label.height*1.2),first.y-first.height*2);
            const crop = {x:0,y:0,w:1,h:bounded(tableTop/canvas.height,.05,1)};
            const table = {x:0,y:crop.h,w:1,h:Math.max(0,Math.max(...matches.map(row => row.y+row.height*.35))/canvas.height-crop.h)};
            const framed = guideCrop(crop,number,table);
            for (const {y,height,...row} of matches) results.push({...row,page:number,source,crop:framed,confidence:.9});
          }
          canvas.width = canvas.height = 0;
          page.cleanup();
          if (batch.length === 4 || number === pdf.numPages) await flush();
          continue;
        }
        for (const label of layout === 'phao' ? matches : []) {
          const codeBox = pdfLabelCrop(label,canvas);
          const distances = matches.filter(o => Math.abs(o.y-label.y) < label.height && Math.abs(o.x-label.x) > label.height*2)
            .map(o => Math.abs(o.x-label.x));
          const dx = distances.length ? Math.min(...distances) :
            canvas.width/Math.max(1,new Set(matches.map(m => Math.round(m.x/label.height))).size);
          const left = Math.max(0,label.x-dx*.45);
          const right = Math.min(canvas.width,left+dx);
          const top = matches.filter(other => other.y < label.y && Math.abs(other.x-label.x) < dx*.5)
            .reduce((value,other) => Math.max(value,other.y+other.height),0);
          const bottom = Math.min(canvas.height,label.y+label.height);
          const numbers = labels.filter(other => other.y >= top && other.y <= label.y && other.x >= left && other.x <= right);
          const combined = numbers.map(other => other.text).find(text => /\b\d{2,4}\s*[×x*]\s*\d{2,4}\b/i.test(text));
          const split = numbers.filter(other => /^\d{2,4}$/.test(other.text)).sort((a,b) => a.y-b.y).map(other => other.text);
          const size = combined?.match(/\d{2,4}\s*[×x*]\s*\d{2,4}/i)?.[0].replace(/\s+/g,'').replace(/[×*]/,'x') ||
            (split.length >= 2 ? split.slice(0,2).join('x') : '');
          results.push({code:label.code,name:label.name,size,page:number,source,confidence:.85,codeBox,
            crop:guideCrop({x:left/canvas.width,y:top/canvas.height,w:(right-left)/canvas.width,h:(bottom-top)/canvas.height},number,codeBox)});
        }
        canvas.width = canvas.height = 0;
        page.cleanup();
        if (batch.length === 4 || number === pdf.numPages) await flush();
      }
      await flush();
      const recognizedPages = new Set(results.map(item => item.page));
      const manualPages = [...scannedPages].filter(page => !recognizedPages.has(page));
      for (const page of manualPages) {
        results.push({page,source:sources.get(page),code:'',name:'Trang scan ' + page,crop:{x:0,y:0,w:1,h:1},confidence:0,needsReview:true});
      }
      const manualWarning = manualPages.length ? 'Có ' + manualPages.length + ' trang scan cần cắt và nhập mã thủ công.' : '';
      const warning = [aiWarning,manualWarning].filter(Boolean).join(' · ');
      if (warning) onWarning?.(warning,!!manualPages.length || !results.length);
      const retained = new Set(results.map(item => item.source));
      for (const source of sources.values()) if (!retained.has(source)) URL.revokeObjectURL(source);
    } catch (error) {
      const retained = new Set(signal?.aborted ? results.map(item => item.source) : []);
      for (const source of sources.values()) if (!retained.has(source)) URL.revokeObjectURL(source);
      if (!signal?.aborted) throw error;
    } finally { await pdf.destroy(); }
    return results;
  }
  function drawSwatch(canvas,image,crop,max = 480) {
    const w = image.naturalWidth*crop.w, h = image.naturalHeight*crop.h;
    const scale = Math.min(1,max/Math.max(w,h));
    canvas.width = Math.max(1,Math.round(w*scale));
    canvas.height = Math.max(1,Math.round(h*scale));
    canvas.getContext('2d').drawImage(image,image.naturalWidth*crop.x,image.naturalHeight*crop.y,w,h,0,0,canvas.width,canvas.height);
  }
  function wireMarquee(grid,selector,apply,{ignore = 'input,button,label,summary,select,form'} = {}) {
    let start, frame;
    grid.onpointerdown = event => {
      if (event.button !== 0 || event.target.closest(ignore)) return;
      start = {x:event.clientX,y:event.clientY,id:event.pointerId,subtract:event.altKey};
    };
    grid.onpointermove = event => {
      if (!start || start.id !== event.pointerId || !(event.buttons & 1)) return;
      if (!frame && Math.hypot(event.clientX-start.x,event.clientY-start.y) < 6) return;
      if (!frame) {
        frame = document.createElement('div');
        frame.className = 'asset-marquee';
        grid.append(frame);
        grid.setPointerCapture(event.pointerId);
      }
      const x = Math.min(start.x,event.clientX), y = Math.min(start.y,event.clientY);
      Object.assign(frame.style,{left:x+'px',top:y+'px',width:Math.abs(event.clientX-start.x)+'px',height:Math.abs(event.clientY-start.y)+'px'});
    };
    const reset = () => { frame?.remove(); start = frame = null; };
    grid.onpointerup = () => {
      if (!frame) { reset(); return; }
      const range = frame.getBoundingClientRect(), subtract = start.subtract;
      const intersecting = [...grid.querySelectorAll(selector)].filter(card => {
        if (card.hidden) return false;
        const rect = card.getBoundingClientRect();
        return rect.left < range.right && rect.right > range.left && rect.top < range.bottom && rect.bottom > range.top;
      });
      reset();
      apply(intersecting,subtract);
    };
    grid.onlostpointercapture = grid.onpointercancel = reset;
    grid.onpointerleave = () => { if (!frame) reset(); };
  }
  const importHistory = () => window.GDHomeCatalogueHistory;
  const updateImportHistory = patch => libraryCall('imports',patch,data => {
    importHistory().apply(data,patch);
    return {};
  });
  async function catalogueHash(blob) {
    const digest = await crypto.subtle.digest('SHA-256',await blob.arrayBuffer());
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
  }
  function duplicateImport(entry,signal) {
    return new Promise(resolve => {
      const {dialog,body} = modal('catalogue-duplicate-dialog','Nguồn đã nhập');
      body.innerHTML = '<p>' + esc(entry.name || entry.source) + ' đã nhập ngày ' +
        esc(new Date(entry.at).toLocaleDateString('vi-VN')) + ' (' + entry.count + ' mẫu).</p>' +
        '<button type="button" data-choice="retry">Nhập lại</button> <button type="button" data-choice="new">Chỉ thêm mẫu mới</button> ' +
        '<button type="button" data-choice="cancel">Huỷ</button>';
      const abort = () => dialog.close();
      signal.addEventListener('abort',abort,{once:true});
      dialog.onclose = () => {
        signal.removeEventListener('abort',abort);
        dialog.remove();
        resolve(dialog.returnValue || 'cancel');
      };
      body.querySelectorAll('[data-choice]').forEach(button => button.onclick = () => dialog.close(button.dataset.choice));
    });
  }
  function catalogueDelay(ms,signal) {
    return new Promise(resolve => {
      const done = () => { clearTimeout(timer); signal.removeEventListener('abort',done); resolve(); };
      const timer = setTimeout(done,ms);
      if (signal.aborted) done();
      else signal.addEventListener('abort',done,{once:true});
    });
  }
  async function downloadCataloguePhoto(product,signal) {
    let failure;
    for (const url of [product.image,...(product.imageAlternates || []).slice(0,5)]) {
      signal.throwIfAborted();
      try {
        const response = await fetch('/api/catalogue/image',{method:'POST',signal,
          headers:{...hooks.headers(),'Content-Type':'application/json'},body:JSON.stringify({url})});
        if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không tải được ảnh.');
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);
        try {
          if (Math.min(bitmap.width,bitmap.height) < 300) throw new Error('Bỏ ảnh nhỏ hơn 300 px.');
        } finally { bitmap.close(); }
        return {blob,url};
      } catch (error) { failure = error; }
    }
    throw failure;
  }

  async function scanCatalogueWeb(url,{ai,signal,onProgress,onSource,onWarning,budget,hashes}) {
    const items = [], failures = new Set(), visited = new Set(), seen = new Set();
    let total, resume = '', aiWarning = '', missingImages = 0, limitReached = false;
    while (url && !signal.aborted && budget.pages && budget.items) {
      const key = importHistory().sourceKey(url);
      if (!key || visited.has(key)) {
        failures.add('Trang nguồn trả đường dẫn phân trang không hợp lệ hoặc bị lặp.');
        url = '';
        break;
      }
      visited.add(key);
      budget.pages--;
      const parsed = new URL(url);
      const page = parsed.searchParams.get('page') || parsed.searchParams.get('p') ||
        parsed.pathname.match(/\/page\/(\d+)\/?$/i)?.[1] || visited.size;
      const progress = () => onProgress('Trang ' + page + '/' + (total || '?') + ' · ' + items.length + ' mẫu');
      progress();
      let result;
      try {
        result = await api('/api/catalogue/web',{method:'POST',signal,body:JSON.stringify({urls:[url],useAi:ai.available && ai.web})});
      } catch (error) {
        if (!signal.aborted) {
          failures.add(error.message);
          resume = url;
        }
        break;
      }
      total = result.total || total;
      if (result.aiWarning) {
        ai.available = false;
        aiWarning ||= 'Đã tiếp tục đọc HTML. ' + result.aiWarning;
      }
      for (const warning of result.warnings || []) failures.add(warning);
      if (result.warnings?.length && !result.items?.length && !result.next) {
        resume = url;
        break;
      }
      const products = [], pageIdentities = new Set();
      for (const product of result.items || []) {
        const identity = product.code ? 'code:' + fold(product.brand) + ':' + duplicateCode(product.code) : 'image:' + product.image;
        if (seen.has(identity) || pageIdentities.has(identity)) continue;
        pageIdentities.add(identity);
        products.push(product);
      }
      if (products.length > budget.items) {
        limitReached = true;
        break;
      }
      budget.items -= products.length;
      for (const product of products) {
        if (signal.aborted) break;
        try {
          const photo = await downloadCataloguePhoto(product,signal);
          const hash = await catalogueHash(photo.blob);
          if (hashes.has(hash)) continue;
          hashes.add(hash);
          const source = URL.createObjectURL(photo.blob);
          onSource(source);
          items.push({...product,image:photo.url,source,crop:{x:0,y:0,w:1,h:1},confidence:.7,web:true});
          progress();
        } catch (error) {
          if (!signal.aborted) {
            missingImages++;
            failures.add(error.message);
          }
        }
      }
      for (const identity of pageIdentities) seen.add(identity);
      url = result.next;
      if (url && budget.pages && budget.items) await catalogueDelay(1200,signal);
    }
    if (url && !signal.aborted && !resume && (limitReached || !budget.pages || !budget.items)) {
      failures.add('Đã tới giới hạn 30 trang hoặc 600 mẫu cho một lượt nhập.');
      resume = url;
    }
    if (resume) failures.add('Link nhập tiếp ' + resume);
    if (missingImages) failures.add('Có ' + missingImages + ' ảnh tải chưa thành công.');
    if (!items.length && !failures.size && !signal.aborted) failures.add('Không tìm thấy ảnh mẫu trong HTML của nguồn này.');
    const notices = [aiWarning,...failures].filter(Boolean);
    if (notices.length) onWarning(notices.join(' · '),failures.size > 0);
    return items;
  }

  function catalogueQueue(form,body,categories,status) {
    const region = body.querySelector('[data-catalogue-queue]');
    const files = new Map(), overrides = new Map();
    const textSources = () => [...new Set(form.elements.urls.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean))];
    function entries(mode) {
      return [...(mode === 'web' ? [] : [...files.values()].filter(entry => mode === 'mixed' || entry.type === 'pdf')),...(mode === 'pdf' ? [] : textSources().map(url => ({key:url,name:url,url,type:'web'})))];
    }
    const selectOptions = pairs => '<option value="">Dùng thiết lập chung</option>' + pairs.map(([value,label]) =>
      '<option value="' + esc(value) + '">' + esc(label) + '</option>').join('');
    function render(mode) {
      region.replaceChildren();
      for (const entry of entries(mode)) {
        const row = document.createElement('li');
        row.dataset.catalogueSource = entry.type;
        row.dataset.sourceState = 'waiting';
        row.innerHTML = '<span title="' + esc(entry.name) + '">' + esc(entry.name) + '</span><small data-source-progress>Chờ</small>' +
          '<details><summary>Thiết lập riêng</summary><label>Lưu nguồn này vào <select data-source-setting="categoryId">' +
          selectOptions(categories.map(({id,name}) => [id,name])) + '</select></label>' +
          '<label>Thương hiệu <input data-source-setting="brand" maxlength="80"></label>' +
          '<label>Đơn vị cung cấp <input data-source-setting="suppliers"></label>' +
          (entry.type === 'pdf' ? '<label>Mẫu bố cục <select data-source-setting="layout">' +
            selectOptions([...form.elements.layout.options].map(option => [option.value,option.text])) + '</select></label>' : '') +
          '</details><button type="button" data-remove-source aria-label="Bỏ nguồn ' + esc(entry.name) + '">×</button>' +
          '<small data-source-warning hidden></small><button type="button" data-source-resume hidden>Tiếp tục</button>';
        const settings = overrides.get(entry.key) || {};
        row.querySelectorAll('[data-source-setting]').forEach(input => {
          const key = input.dataset.sourceSetting;
          input.value = settings[key] || '';
          input.oninput = () => { settings[key] = input.value.trim(); overrides.set(entry.key,settings); };
        });
        row.querySelector('[data-remove-source]').onclick = () => {
          if (entry.url) form.elements.urls.value = textSources().filter(url => url !== entry.url).join('\n');
          else files.delete(entry.key);
          overrides.delete(entry.key);
          render(mode);
        };
        region.append(row);
      }
    }
    function add(incoming,mode) {
      for (const {file,path = ''} of incoming) {
        if (!isPdf(file) && !file.type.startsWith('image/')) continue;
        const key = JSON.stringify([file.name,file.size,file.lastModified,path]);
        if (files.size >= 50 && !files.has(key)) { status.textContent = 'Mỗi lượt nhận tối đa 50 nguồn.'; break; }
        files.set(key,{key,file,path,name:file.name,type:isPdf(file) ? 'pdf' : 'image'});
      }
      render(mode);
    }
    function read(mode) {
      return entries(mode).map((entry,index) => ({...entry,override:{...overrides.get(entry.key)},row:region.children[index]}));
    }
    return {add,read,render};
  }

  async function openWoodCatalogue(categoryId,onSaved,preset = {}) {
    const {dialog,body} = modal('wood-catalogue-dialog','Nhập catalogue PDF mã gỗ');
    const sources = new Set();
    let busy = false, controller;
    const cleanup = () => { for (const source of sources) URL.revokeObjectURL(source); dialog.remove(); preset.onClose?.(); };
    dialog.onclose = () => {
      if (!busy) return cleanup();
      GDHomeShell.aiNotice('asset-catalogue-job',{state:'running',body:'Đang xử lý catalogue',label:'Mở lại',onAction:() => dialog.showModal()});
    };
    const library = await loadLibrary();
    if (!dialog.isConnected) return;
    dialog.querySelector('h2').textContent = 'Nhập catalogue';
    body.innerHTML = '<div role="tablist" aria-label="Nguồn catalogue"><button type="button" role="tab" data-catalogue-tab="pdf" aria-selected="true">Từ PDF</button>' +
      '<button type="button" role="tab" data-catalogue-tab="web" aria-selected="false">Từ link website</button>' +
      '<button type="button" role="tab" data-catalogue-tab="mixed" aria-selected="false">Nhiều nguồn</button>' +
      '<button type="button" role="tab" data-catalogue-tab="history" aria-selected="false">Đã nhập</button></div>' +
      '<section data-catalogue-history hidden></section><form class="wood-catalogue-controls">' +
      '<label>Hạng mục lưu mặc định <select name="category">' + library.categories.map(category => '<option value="' + esc(category.id) + '"' +
        (category.id === categoryId ? ' selected' : '') + '>' + esc(category.name) + '</option>').join('') + '</select></label>' +
      '<label>Đơn vị cung cấp <input name="suppliers" list="catalogue-suppliers" placeholder="Tên cách nhau bằng dấu phẩy"></label>' +
      '<datalist id="catalogue-suppliers">' + (library.suppliers || []).map(item => '<option>' + esc(item.name) + '</option>').join('') + '</datalist>' +
      ((library.suppliers || []).length ? '<label>Chọn nhiều đơn vị <select name="supplierChoices" multiple>' +
        library.suppliers.map(item => '<option>' + esc(item.name) + '</option>').join('') + '</select></label>' : '') +
      '<label>Tag <input name="tags" placeholder="Cách nhau bằng dấu phẩy"></label>' +
      '<label data-catalogue-pdf-ai><input type="checkbox" name="useAi"> Dùng AI cho trang khó</label>' +
      '<label data-catalogue-web-ai hidden><input type="checkbox" name="useWebAi"> Dùng AI bổ sung tên / mã khi HTML thiếu</label>' +
      '<label data-catalogue-pdf>Catalogue PDF <input name="pdf" type="file" accept="application/pdf,.pdf" multiple></label>' +
      '<label data-catalogue-pdf-code><input type="checkbox" name="includeCode" checked> Giữ dòng mã trong bố cục chuyên dụng</label>' +
      '<label data-catalogue-web hidden>Link website <textarea name="urls" rows="3" placeholder="Một URL mỗi dòng"></textarea>' +
      '<small>Tự đọc HTML, tải ảnh và theo trang kế tiếp.</small></label>' +
      '<label data-catalogue-autosave hidden><input type="checkbox" name="autoSave" checked> Tự lưu tất cả, lọc lại sau</label>' +
      '<div data-catalogue-mixed hidden><label>Thư mục <input type="file" name="folder" webkitdirectory multiple></label>' +
      '<label>Ảnh <input type="file" name="images" accept="image/*" multiple></label>' +
      '<div class="asset-drop" data-catalogue-drop>Kéo thả thư mục, PDF hoặc ảnh vào đây</div></div>' +
      '<ol data-catalogue-queue aria-label="Hàng đợi nguồn nhập"></ol>' +
      '<label>Bố cục <select name="layout"><option value="generic">Tự động / lưới</option><option value="ancuong">An Cường</option><option value="phao">Phào chỉ</option><option value="kitchen">Phụ kiện bếp · ảnh và bảng mã</option></select></label>' +
      '<label>Kiểu hiển thị ' + displaySelect(preset.display || categoryDisplay(library.categories.find(c => c.id === categoryId)),'name="display"') + '</label>' +
      '<label>Hãng <input name="brand" list="wood-brands" value="' + (categoryId === 'ancuong-wood' ? 'An Cường' : '') + '" maxlength="80"></label>' +
      '<datalist id="wood-brands">' + ['An Cường','Minh Long','Thái Dương','Mộc Phát','Ba Thanh','Vanachai','EGGER','Khác'].map(name => '<option>' + name + '</option>').join('') + '</datalist>' +
      '<label>Catalogue <input name="collection" list="wood-catalogues" maxlength="120" placeholder="VD: Melamine/MFC"></label>' +
      '<datalist id="wood-catalogues"><option>Melamine/MFC</option><option>Laminate</option><option>Acrylic</option><option>Veneer</option></datalist>' +
      '<label>Bề mặt <input name="finish" maxlength="120" placeholder="VD: Mờ"></label>' +
      '<fieldset data-catalogue-guide><legend>Hướng dẫn đọc PDF</legend>' +
      '<label>Mô tả cách lọc <textarea name="guidePrompt" maxlength="2000" rows="2"></textarea></label>' +
      '<label>Ảnh minh hoạ · dán, kéo thả hoặc chọn tối đa 3 ảnh <input type="file" name="guideImages" accept="image/*" multiple></label>' +
      '<div data-guide-previews></div><label>Mẫu bố cục <select name="guidePreset"></select></label>' +
      '<label>Tên mẫu <input name="guideName" maxlength="80"></label><button type="button" data-guide-save>Lưu mẫu bố cục</button></fieldset>' +
      '<details><summary>Mẫu mã (regex)</summary><label>Mỗi dòng một mẫu<textarea name="patterns" rows="4" maxlength="1000">' +
      esc(woodPatterns.join('\n')) + '</textarea></label></details>' +
      '<button type="submit">Đọc PDF</button><button type="button" data-catalogue-cancel>Dừng</button></form>' +
      '<p role="status"></p><div class="catalogue-review-toolbar" hidden><strong data-catalogue-count></strong>' +
      '<button type="button" data-catalogue-select="clear">Bỏ chọn</button><button type="button" data-catalogue-select="invert">Đảo chọn</button>' +
      '<button type="button" data-catalogue-select="qr">Chỉ giữ thẻ có QR</button>' +
      '<label>Lọc <select data-catalogue-filter><option value="all">Tất cả</option><option value="selected">Đã chọn</option><option value="review">Cần kiểm tra</option></select></label>' +
      '<label>Catalogue <input data-batch-collection maxlength="120"></label><label>Bề mặt <input data-batch-finish maxlength="120"></label>' +
      '<button type="button" data-catalogue-assign>Gán cho nhóm chọn</button>' +
      '<label>Hạng mục đích <select data-catalogue-destination><option value="">Theo thiết lập nguồn</option>' +
      library.categories.map(category => '<option value="' + esc(category.id) + '">' + esc(category.name) + '</option>').join('') +
      '</select></label><button type="button" data-assign-destination>Áp dụng cho thẻ đã chọn</button>' +
      '<button type="button" data-save-wood disabled>Lưu mã đã chọn</button></div>' +
      '<div class="catalogue-review"><div class="wood-catalogue-results"></div><aside data-catalogue-details hidden aria-label="Chi tiết thẻ"></aside></div>';
    const form = body.querySelector('form');
    if (preset.tags) form.elements.tags.value = preset.tags.join(', ');
    if (categoryId === 'kitchen-accessories') form.elements.layout.value = 'kitchen';
    const suggest = () => attributeSuggestions(form,library,form.elements.category.value,{
      brand:[form.elements.brand],collection:[form.elements.collection],finish:[form.elements.finish],
      suppliers:[form.elements.suppliers],tags:[form.elements.tags]});
    suggest();
    form.elements.category.onchange = () => {
      form.elements.display.value = categoryDisplay(library.categories.find(c => c.id === form.elements.category.value));
      suggest();
      refreshSelection();
    };
    form.elements.layout.onchange = () => { if (['phao','kitchen'].includes(form.elements.layout.value)) form.elements.display.value = 'pad'; };
    const status = body.querySelector('[role=status]');
    const readGuide = wireCatalogueGuide(form,status);
    const queue = catalogueQueue(form,body,library.categories,status);
    const list = body.querySelector('.wood-catalogue-results'), save = body.querySelector('[data-save-wood]');
    const read = form.querySelector('[type=submit]');
    let items = [], mode = 'pdf';
    let activeImports = [];
    const setProgress = (entry,state,message) => {
      entry.row.dataset.sourceState = state;
      entry.row.querySelector('[data-source-progress]').textContent = message;
    };
    function waitForAiResume(entry,job,signal) {
      setProgress(entry,'paused',job.step);
      status.textContent = job.step;
      const button = entry.row.querySelector('[data-source-resume]');
      button.hidden = false;
      return new Promise((resolve,reject) => {
        function clear() {
          button.hidden = true;
          button.onclick = null;
          signal.removeEventListener('abort',cancel);
        }
        function cancel() { clear(); reject(signal.reason); }
        button.onclick = () => { clear(); resolve(); };
        if (signal.aborted) cancel();
        else signal.addEventListener('abort',cancel,{once:true});
      });
    }
    dialog.addEventListener('close',() => controller?.abort(),{once:true});
    form.elements.pdf.onchange = () => {
      queue.add([...form.elements.pdf.files].map(file => ({file})),mode);
      form.elements.pdf.value = '';
    };
    form.elements.urls.oninput = () => queue.render(mode);
    form.elements.folder.onchange = () => {
      queue.add([...form.elements.folder.files].map(file => ({file,path:file.webkitRelativePath.split('/').slice(0,-1).join('/')})),mode);
      form.elements.folder.value = '';
    };
    form.elements.images.onchange = () => {
      queue.add([...form.elements.images.files].map(file => ({file})),mode);
      form.elements.images.value = '';
    };
    const drop = form.querySelector('[data-catalogue-drop]');
    drop.ondragover = event => { event.preventDefault(); };
    drop.ondrop = async event => {
      event.preventDefault();
      if (busy) return;
      const entries = [...event.dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
      const files = [...event.dataTransfer.files];
      try {
        const incoming = entries.length ? await droppedCatalogueFiles(entries) : files.map(file => ({file}));
        if (!busy) queue.add(incoming,mode);
      } catch (error) { status.textContent = error.message; }
    };
    if (preset.file) queue.add([{file:preset.file}],mode);
    const historyPanel = body.querySelector('[data-catalogue-history]'), review = body.querySelector('.catalogue-review');
    const listValues = value => value.split(',').map(part => part.trim()).filter(Boolean);
    const sharedSuppliers = () => [...listValues(form.elements.suppliers.value),
      ...Array.from(form.elements.supplierChoices?.selectedOptions || [],option => option.value)];
    async function saveImportRows(records) {
      if (records.length) await updateImportHistory({imports:records.map(importHistory().normalize)});
    }
    async function showHistory() {
      const data = await loadLibrary(), entries = data.imports || [];
      if (historyPanel.hidden || !historyPanel.isConnected) return;
      historyPanel.innerHTML = entries.length ? '<table><thead><tr><th>Nguồn</th><th>Ngày</th><th>Hạng mục / Hãng</th><th>Số mẫu</th><th>Trạng thái</th><th></th></tr></thead><tbody>' +
        entries.map((entry,index) => '<tr data-import-history-row="' + index + '"><td>' + esc(entry.name || entry.source) + '</td><td>' +
          esc(new Date(entry.at).toLocaleString('vi-VN')) + '</td><td>' + esc([data.categories.find(c => c.id === entry.categoryId)?.name,entry.brand,
            ...entry.suppliers].filter(Boolean).join(' · ')) + '</td><td>' + entry.count + '</td><td>' +
          ({done:'Xong',partial:'Dở',error:'Lỗi'})[entry.status] +
          '</td><td><button type="button" data-history-action="open">Xem kết quả</button> <button type="button" data-history-action="retry">Nhập lại</button> ' +
          '<button type="button" data-history-action="delete">Xoá dòng</button></td></tr>').join('') + '</tbody></table>' : '<p>Chưa có lịch sử nhập.</p>';
      historyPanel.querySelectorAll('[data-history-action]').forEach(button => button.onclick = async () => {
        const entry = entries[Number(button.closest('tr').dataset.importHistoryRow)];
        try {
          if (button.dataset.historyAction === 'delete') {
            await updateImportHistory({deleteId:entry.id});
            await showHistory();
          } else if (button.dataset.historyAction === 'open') {
            const saved = modal('catalogue-history-result','Kết quả · ' + entry.name);
            const ids = new Set(entry.itemIds);
            saved.body.innerHTML = grid(data.items.filter(item => ids.has(item.id)),{selectable:false,empty:'Không có mẫu đã lưu còn trong thư viện.'});
            await hydrate(saved.body);
          } else {
            const next = ({pdf:'pdf',web:'web',image:'mixed'})[entry.type];
            body.querySelector('[data-catalogue-tab=' + next + ']').click();
            if (data.categories.some(category => category.id === entry.categoryId)) form.elements.category.value = entry.categoryId;
            form.elements.category.onchange();
            form.elements.brand.value = entry.brand;
            form.elements.suppliers.value = entry.suppliers.join(', ');
            if (entry.type === 'web') { form.elements.urls.value = entry.source; queue.render(mode); }
            else {
              status.textContent = 'Chọn lại tệp ' + entry.name + ' để nhập.';
              form.elements[entry.type === 'pdf' ? 'pdf' : 'images'].click();
            }
          }
        } catch (error) { toast(error.message); }
      });
    }
    let cards = [], details = [], rangeAnchor = null, activeDetail = null;
    const toolbar = body.querySelector('.catalogue-review-toolbar'), detailPanel = body.querySelector('[data-catalogue-details]');
    const filter = toolbar.querySelector('[data-catalogue-filter]');
    const include = card => card.querySelector('[data-wood-include]');
    const selected = () => cards.filter(card => include(card).checked);
    const destinationOf = item => item.destinationId || item.originImport.override.categoryId || form.elements.category.value;
    function refreshSelection() {
      const chosen = selected();
      for (const [i,card] of cards.entries()) {
        card.classList.toggle('is-selected',include(card).checked);
        const issue = items[i].saveError;
        card.classList.toggle('needs-review',!!(issue || items[i].needsReview));
        if (issue) card.title = issue;
        else card.removeAttribute('title');
        card.hidden = (filter.value === 'selected' && !include(card).checked) || (filter.value === 'review' && !items[i].needsReview && !issue);
      }
      const index = activeDetail ?? (chosen.length === 1 ? cards.indexOf(chosen[0]) : -1);
      const detail = details[index];
      if (detail && !cards[index].hidden) {
        const destination = library.categories.find(category => category.id === destinationOf(items[index]));
        detail.querySelector('[data-catalogue-destination-label]').textContent = destination?.name || '';
        detail.querySelector('[data-catalogue-save-error]').textContent = items[index].saveError || '';
        if (detailPanel.firstElementChild !== detail) detailPanel.replaceChildren(detail);
      } else detailPanel.replaceChildren();
      detailPanel.hidden = !detailPanel.childElementCount;
      toolbar.hidden = !cards.length || !historyPanel.hidden;
      toolbar.querySelector('[data-catalogue-count]').textContent = 'Đã chọn ' + chosen.length + '/' + cards.length;
      save.disabled = busy || !chosen.length;
    }
    function resetReview() {
      cards = []; details = []; items = [];
      rangeAnchor = activeDetail = null;
      filter.value = 'all';
      list.replaceChildren();
      refreshSelection();
    }
    function toggleCard(index,checked,shift) {
      const from = shift && rangeAnchor !== null ? rangeAnchor : index;
      for (let i=Math.min(from,index); i<=Math.max(from,index); i++) {
        if (!cards[i].hidden) include(cards[i]).checked = shift ? true : checked;
      }
      rangeAnchor = index;
      activeDetail = null;
      refreshSelection();
    }
    filter.onchange = () => { activeDetail = null; refreshSelection(); };
    toolbar.querySelector('[data-assign-destination]').onclick = () => {
      if (busy) return;
      const chosen = selected();
      const destination = toolbar.querySelector('[data-catalogue-destination]').value;
      for (const card of chosen) items[cards.indexOf(card)].destinationId = destination;
      if (chosen.length) status.textContent = 'Đã đặt hạng mục lưu cho ' + chosen.length + ' thẻ.';
      refreshSelection();
    };
    toolbar.querySelectorAll('[data-catalogue-select]').forEach(button => button.onclick = () => {
      for (const [i,card] of cards.entries()) {
        const box = include(card);
        box.checked = button.dataset.catalogueSelect === 'invert' ? !box.checked : button.dataset.catalogueSelect === 'qr' && box.checked && !!items[i].qr;
      }
      activeDetail = rangeAnchor = null;
      refreshSelection();
    });
    toolbar.querySelector('[data-catalogue-assign]').onclick = () => {
      for (const card of selected()) for (const key of ['collection','finish']) {
        const value = toolbar.querySelector('[data-batch-' + key + ']').value.trim();
        if (value) details[cards.indexOf(card)].querySelector('[data-catalogue-field=' + key + ']').value = value;
      }
    };
    dialog.onkeydown = event => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a' && cards.length &&
          !event.target.matches('input:not([type=checkbox]),textarea,select,[contenteditable]')) {
        event.preventDefault();
        for (const card of cards.filter(card => !card.hidden)) include(card).checked = true;
        activeDetail = null;
        refreshSelection();
      }
    };
    wireMarquee(list,'.wood-catalogue-card',(intersecting,subtract) => {
      for (const card of intersecting) include(card).checked = !subtract;
      activeDetail = null;
      refreshSelection();
    });
    for (const tab of body.querySelectorAll('[data-catalogue-tab]')) tab.onclick = () => {
      if (busy) return;
      const next = tab.dataset.catalogueTab;
      for (const button of body.querySelectorAll('[data-catalogue-tab]')) button.setAttribute('aria-selected',String(tab === button));
      const showingHistory = next === 'history';
      form.hidden = review.hidden = status.hidden = showingHistory;
      historyPanel.hidden = !showingHistory;
      if (showingHistory) {
        refreshSelection();
        showHistory().catch(error => { historyPanel.textContent = error.message; });
        return;
      }
      if (mode !== next) resetReview();
      mode = next;
      form.querySelector('[data-catalogue-web]').hidden = mode === 'pdf';
      form.querySelector('[data-catalogue-autosave]').hidden = mode === 'pdf';
      form.querySelector('[data-catalogue-pdf]').hidden = mode === 'web';
      form.querySelector('[data-catalogue-pdf-code]').hidden = mode === 'web';
      form.querySelector('[data-catalogue-guide]').hidden = mode === 'web';
      form.querySelector('[data-catalogue-mixed]').hidden = mode !== 'mixed';
      form.querySelector('[data-catalogue-pdf-ai]').hidden = mode === 'web';
      form.querySelector('[data-catalogue-web-ai]').hidden = mode === 'pdf';
      read.textContent = ({web:'Đọc website',pdf:'Đọc PDF',mixed:'Xử lý hàng đợi'})[mode];
      queue.render(mode);
      refreshSelection();
    };
    body.querySelector('[data-catalogue-cancel]').onclick = () => controller?.abort();
    const loadPageImage = async source => {
      const image = new Image();
      image.src = source;
      await image.decode();
      return image;
    };
    form.onsubmit = async event => {
      event.preventDefault();
      if (busy) return;
      const locked = [...form.querySelectorAll('input,textarea,select,button:not([data-catalogue-cancel],[data-source-resume])')].filter(control => !control.disabled);
      for (const control of locked) control.disabled = true;
      busy = read.disabled = save.disabled = true;
      controller = new AbortController();
      resetReview();
      activeImports = [];
      for (const source of sources) URL.revokeObjectURL(source);
      sources.clear();
      try {
        const signal = controller.signal, inputs = queue.read(mode);
        if (!inputs.length || inputs.length > 50) throw new Error('Chọn từ 1 đến 50 nguồn nhập.');
        const existing = (await loadLibrary(true)).imports || [], seen = new Set();
        for (const input of inputs) {
          signal.throwIfAborted();
          input.row.querySelector('[data-source-warning]').hidden = true;
          setProgress(input,'waiting','Đang kiểm tra nguồn…');
          const source = input.url ? importHistory().sourceKey(input.url) : 'sha256:' + await catalogueHash(input.file);
          if (!source) { setProgress(input,'error','Lỗi · Link phải là HTTP hoặc HTTPS'); continue; }
          if (seen.has(source)) { setProgress(input,'skipped','Bỏ qua · Trùng trong hàng đợi'); continue; }
          seen.add(source);
          const duplicate = existing.find(record => record.source === source);
          const choice = duplicate ? await duplicateImport(duplicate,signal) : 'retry';
          if (choice === 'cancel') { setProgress(input,'skipped','Đã huỷ'); continue; }
          setProgress(input,'waiting','Chờ');
          activeImports.push({...input,source,id:uid(),at:Date.now(),categoryId:input.override.categoryId || form.elements.category.value,
            brand:input.override.brand || form.elements.brand.value.trim(),suppliers:input.override.suppliers ? listValues(input.override.suppliers) : sharedSuppliers(),
            layout:input.override.layout || form.elements.layout.value,status:'partial',count:0,itemIds:[],onlyNew:choice === 'new'});
        }
        if (!activeImports.length) { status.textContent = 'Đã huỷ nhập.'; return; }
        await saveImportRows(activeImports);
        const guide = readGuide(), budget = {pages:30,items:600};
        const ai = {available:!!window.GDHomeAI,pdf:form.elements.useAi.checked,web:form.elements.useWebAi.checked};
        const webHashes = new Map();
        const scans = new Array(activeImports.length);
        let next = 0;
        async function worker() {
          while (next < activeImports.length && !signal.aborted) {
            const index = next++, entry = activeImports[index];
            let warning = '', incomplete = false;
            const onProgress = message => {
              status.textContent = message;
              setProgress(entry,'running',message);
            };
            const onWarning = (message,failed = true) => { warning = message; incomplete = failed; };
            onProgress('Đang chạy…');
            try {
              let imported;
              if (entry.type === 'web') {
                if (!webHashes.has(entry.categoryId)) webHashes.set(entry.categoryId,new Set());
                imported = await scanCatalogueWeb(entry.url,{ai,signal,onProgress,onWarning,budget,
                  hashes:webHashes.get(entry.categoryId),onSource:source => sources.add(source)});
              }
              else if (entry.type === 'pdf') imported = await scanWoodCatalogue(entry.file,form.elements.patterns.value,
                (page,total) => onProgress('Đang đọc trang ' + page + '/' + total + '…'),
                {ai,signal,layout:entry.layout,guide,onWarning,includeCode:form.elements.includeCode.checked,
                  onPause:job => waitForAiResume(entry,job,signal),
                  onAiProgress:job => { if (job.status === 'running' && job.step) onProgress(job.step); }});
              else {
                const source = URL.createObjectURL(entry.file);
                const image = new Image();
                image.src = source;
                sources.add(source);
                await image.decode();
                imported = [{source,crop:{x:0,y:0,w:1,h:1},confidence:1,name:entry.name.replace(/\.[^.]+$/,''),code:'',fileImage:true}];
              }
              scans[index] = imported.map(item => ({...item,originImport:entry}));
              for (const item of imported) sources.add(item.source);
              entry.incomplete = signal.aborted || incomplete;
              entry.status = imported.length || signal.aborted ? 'partial' : incomplete ? 'error' : 'done';
              setProgress(entry,signal.aborted ? 'stopped' : entry.status === 'error' ? 'error' : 'done',
                signal.aborted ? 'Đã dừng · ' + imported.length + ' mẫu' : entry.status === 'error' ? 'Lỗi' : 'Xong · ' + imported.length + ' mẫu');
              if (warning) {
                const notice = entry.row.querySelector('[data-source-warning]');
                notice.textContent = warning;
                notice.hidden = false;
              }
            } catch (error) {
              setProgress(entry,signal.aborted ? 'stopped' : 'error',signal.aborted ? 'Đã dừng' : 'Lỗi · ' + error.message);
              if (!signal.aborted) entry.status = 'error';
            }
          }
        }
        await Promise.all([worker(),worker()]);
        if (signal.aborted) for (const entry of activeImports.slice(next)) setProgress(entry,'stopped','Đã dừng');
        items = scans.flat();
        await saveImportRows(activeImports);
        if (signal.aborted && !items.length) { status.textContent = 'Đã dừng xử lý.'; return; }
        let saveWarning = '';
        if (mode !== 'pdf' && form.elements.autoSave.checked && items.length) {
          const automatic = items.filter(item => !item.needsReview && (item.code || item.web || item.fileImage));
          if (automatic.length) {
            const saved = await persistSelection(automatic.map(item => ({item,code:item.code || '',name:item.name})),{auto:true});
            saveWarning = status.textContent;
            items = items.filter(item => !saved.has(item));
          }
          if (!items.length) return;
        }
        for (const item of items) sources.add(item.source);
        const resultMessage = items.length ? 'Nhận diện ' + items.length + ' mẫu. Kiểm tra và chỉnh ảnh trước khi lưu.' : 'Không tìm thấy mẫu có ảnh.';
        status.textContent = [saveWarning,resultMessage].filter(Boolean).join(' · ');
        list.innerHTML = items.map(item => '<article class="wood-catalogue-card' + (item.needsReview ? ' needs-review' : '') + '" tabindex="0">' +
          '<canvas aria-label="Ảnh swatch"></canvas><small title="' + (item.needsReview ? 'Cần kiểm tra' : '') + '">' +
          (item.web ? 'Web' : item.fileImage ? 'Ảnh' : 'T' + item.page) + ' · ' + Math.round(item.confidence*100) + '%</small>' +
          '<input type="checkbox" aria-label="Chọn ' + esc(item.code || item.name) + '" data-wood-include' + (item.needsReview ? '' : ' checked') + '>' +
          '<button type="button" data-show-catalogue-detail aria-label="Chi tiết ' + esc(item.code || item.name) + '">⋯</button>' +
          '<input aria-label="Mã" data-wood-code-input maxlength="80" value="' + esc(item.code) + '">' +
          '<input aria-label="Tên" data-wood-name-input maxlength="160" value="' + esc(item.name) + '">' +
          '<div data-catalogue-detail-fields><p>Hạng mục lưu <strong data-catalogue-destination-label></strong></p><small data-catalogue-save-error></small>' +
          (item.web ? '<label>Đơn vị cung cấp <input data-catalogue-supplier value="' + esc(item.originImport.override.suppliers ? '' : item.supplier) + '"></label><label>Hãng <input data-catalogue-brand value="' + esc(item.originImport.override.brand || item.brand) + '"></label>' : '') +
          (item.originImport.layout === 'kitchen' && !item.web && !item.fileImage ? '<datalist id="catalogue-kitchen-' + esc(item.code) + '">' +
            kitchenSubgroups.map(name => '<option>' + esc(name) + '</option>').join('') + '</datalist>' +
            ['spec','cabinetWidth','innerWidth','unit','subgroup'].map(key => '<label>' +
              ({spec:'Quy cách R*S*C',cabinetWidth:'Rộng tủ',innerWidth:'Lọt lòng',unit:'Đơn vị',subgroup:'Nhóm phụ kiện'})[key] +
              '<input data-catalogue-field="' + key + '"' + (key === 'subgroup' ? ' list="catalogue-kitchen-' + esc(item.code) + '"' : '') +
              ' value="' + esc(item[key]) + '"></label>').join('') : '') +
          ['size','finish','collection','material','tone','grain',...(library.showPrices ? ['price','priceUnit','priceNote'] : [])].map(key => '<label>' +
            ({size:'Kích thước',finish:'Bề mặt',collection:'Catalogue',material:'Loại vật liệu',tone:'Tông màu',grain:'Vân',price:'Đơn giá nội bộ',priceUnit:'Đơn vị giá',priceNote:'Ghi chú giá'})[key] +
            '<input data-catalogue-field="' + key + '" value="' + esc(item[key]) + '"></label>').join('') +
          '<button type="button" data-catalogue-merge>Gộp mã trùng</button><button type="button" data-edit-wood-crop>Chỉnh khung cắt</button></div></article>').join('');
        cards = [...list.children];
        details = cards.map(card => {
          const fields = card.querySelector('[data-catalogue-detail-fields]');
          fields.remove();
          return fields;
        });
        attributeSuggestions(form,library,form.elements.category.value,Object.fromEntries(
          ['size','material','finish','collection','subgroup'].map(key => [key,details.flatMap(detail =>
            [...detail.querySelectorAll('[data-catalogue-field="' + key + '"]')]) ])));
        const syncIdentity = (item,patch) => {
          Object.assign(item,patch);
          const card = cards[items.indexOf(item)];
          if ('code' in patch) card.querySelector('[data-wood-code-input]').value = patch.code;
          if ('name' in patch) card.querySelector('[data-wood-name-input]').value = patch.name;
        };
        const readIdentity = item => {
          const card = cards[items.indexOf(item)];
          return Object.assign(item,{code:card.querySelector('[data-wood-code-input]').value,name:card.querySelector('[data-wood-name-input]').value});
        };
        let lastSource, image;
        for (const [i,item] of items.entries()) {
          if (!dialog.isConnected) return;
          if (lastSource !== item.source) {
            lastSource = item.source;
            image = await loadPageImage(item.source).catch(() => null);
          }
          const canvas = cards[i].querySelector('canvas');
          if (image) drawSwatch(canvas,image,item.crop);
          else {
            item.saveError ||= 'Ảnh nguồn không đọc được.';
            canvas.hidden = true;
            details[i].querySelector('[data-edit-wood-crop]').disabled = true;
          }
          cards[i].onclick = event => {
            if (!event.target.closest('input,button,label,.asset-identity-editor')) toggleCard(i,!include(cards[i]).checked,event.shiftKey);
          };
          include(cards[i]).onclick = event => toggleCard(i,event.target.checked,event.shiftKey);
          cards[i].querySelector('[data-show-catalogue-detail]').onclick = () => {
            activeDetail = activeDetail === i ? null : i;
            refreshSelection();
          };
          cards[i].ondblclick = event => {
            if (canvas.hidden || event.target.closest('input,button,label,.asset-identity-editor')) return;
            editView(readIdentity(item),{sequence:items.filter((_,index) => !cards[index].hidden).map(readIdentity),onSave:syncIdentity,
              urlFor:async entry => {
                const preview = document.createElement('canvas');
                drawSwatch(preview,await loadPageImage(entry.source),entry.crop,1200);
                return preview.toDataURL('image/jpeg',.9);
              }}).catch(error => toast(error.message));
          };
          cards[i].onkeydown = event => {
            if (event.key !== 'F2') return;
            event.preventDefault();
            editAssetIdentity(cards[i],readIdentity(item),patch => syncIdentity(item,patch));
          };
          details[i].querySelector('[data-catalogue-merge]').onclick = () => {
            const code = cards[i].querySelector('[data-wood-code-input]').value.trim().toUpperCase();
            const duplicate = cards.find((card,index) => index !== i && card.querySelector('[data-wood-include]').checked &&
              card.querySelector('[data-wood-code-input]').value.trim().toUpperCase() === code);
            if (!duplicate) return toast('Không có thẻ đang chọn cùng mã.');
            for (const field of details[i].querySelectorAll('[data-catalogue-field]')) {
              if (!field.value) field.value = details[cards.indexOf(duplicate)].querySelector('[data-catalogue-field="' + field.dataset.catalogueField + '"]').value;
            }
            duplicate.querySelector('[data-wood-include]').checked = false;
            refreshSelection();
          };
          details[i].querySelector('[data-edit-wood-crop]').onclick = async () => {
            const image = await loadPageImage(item.source);
            editWoodCrop(image,item.crop,crop => { item.crop = crop; drawSwatch(canvas,image,crop); });
          };
        }
      } catch (error) { status.textContent = error.message; }
      finally {
        for (const control of locked) control.disabled = false;
        busy = read.disabled = false;
        refreshSelection();
        if (!dialog.open) GDHomeShell.aiNotice('asset-catalogue-job',{state:'done',body:esc(status.textContent),label:'Mở kết quả',onAction:() => dialog.showModal()});
      }
    };
    async function persistSelection(selection,{auto = false} = {}) {
      const suppliers = sharedSuppliers();
      const sharedTags = listValues(form.elements.tags.value);
      const brand = form.elements.brand.value.trim();
      const collection = form.elements.collection.value.trim(), finish = form.elements.finish.value.trim();
      let added = 0, skipped = 0, batch = [], batchCategory;
      const savedCrops = new Map(), finished = new Set(), failures = [];
      const destinations = new Map(selection.map(({item}) => [item,destinationOf(item)]));
      const reviewed = new Map();
      const failedSources = new Set();
      const finishHistory = (complete = false) => {
        for (const [entry,metadata] of reviewed) {
          const status = complete && !entry.incomplete && !failedSources.has(entry) ? 'done' : 'partial';
          Object.assign(entry,{...metadata,status,count:entry.itemIds.length});
          setProgress(entry,status,(status === 'partial' ? 'Dở · đã lưu ' : 'Đã lưu ') + entry.count + ' mẫu');
        }
        return saveImportRows([...reviewed.keys()]);
      };
      try {
        const data = await loadLibrary();
        const scopeKey = (categoryId,value) => categoryId + ':' + value;
        const existing = new Map(data.items.filter(item => item.code && item.full).map(item => [scopeKey(item.categoryId,catalogueKey(item)),item]));
        const savedCodes = new Set(data.items.filter(item => item.full && item.code).map(item => scopeKey(item.categoryId,duplicateCode(item.code))));
        const savedHashes = new Set(data.items.flatMap(item => [item.full,item.originalFull].filter(Boolean)
          .map(name => scopeKey(item.categoryId,name.split('.')[0]))));
        const skip = item => { skipped++; finished.add(item); };
        const flush = async () => {
          if (!batch.length) return;
          const result = await addItems(batchCategory,batch.map(({record}) => record));
          added += result.added.length;
          skipped += result.skipped || 0;
          for (const addedItem of result.added) {
            const found = batch.find(({record}) => addedItem.code ? catalogueKey(addedItem) === catalogueKey(record) : record.full === addedItem.full);
            if (found?.entry && !found.entry.itemIds.includes(addedItem.id)) found.entry.itemIds.push(addedItem.id);
          }
          for (const {item} of batch) finished.add(item);
          batch = [];
        };
        for (const {item,detail,code,name} of selection) {
          if (!dialog.open && !auto) break;
          const entry = item.originImport;
          const categoryId = destinations.get(item);
          delete item.saveError;
          const entryBrand = entry.override.brand || brand;
          const entrySuppliers = entry.override.suppliers ? listValues(entry.override.suppliers) : suppliers;
          if (batchCategory && batchCategory !== categoryId) await flush();
          batchCategory = categoryId;
          const itemBrand = (detail ? detail.querySelector('[data-catalogue-brand]')?.value.trim() : (entry.override.brand || item.brand)) || entryBrand ||
            (categoryId === 'ancuong-wood' ? 'An Cường' : '');
          const supplier = detail ? detail.querySelector('[data-catalogue-supplier]')?.value : (entry.override.suppliers ? '' : item.supplier);
          const itemSuppliers = [...new Set([...entrySuppliers,...listValues(supplier || '')])];
          const tags = [...new Set([...sharedTags,...(entry.path ? folderTags(entry.path) : []),
            ...(auto ? ['chua-duyet',...(entry.url ? [new URL(entry.url).hostname] : [])] : [])])];
          reviewed.set(entry,{categoryId,brand:entryBrand,suppliers:entrySuppliers});
          const codeKey = code && scopeKey(categoryId,duplicateCode(code));
          if (entry.onlyNew && codeKey && savedCodes.has(codeKey)) { skip(item); continue; }
          const key = scopeKey(categoryId,code ? catalogueKey({brand:itemBrand,code}) : item.source);
          const previous = existing.get(key);
          if (previous && !itemSuppliers.some(value => !previous.suppliers?.includes(value)) && !tags.some(value => !previous.tags?.includes(value))) {
            skip(item); continue;
          }
          status.textContent = 'Đang lưu ' + code + '…';
          const crop = item.crop;
          const cropKey = JSON.stringify([item.source,crop]);
          let image = previous || savedCrops.get(cropKey);
          try {
            if (!image) {
              const response = await fetch(item.source);
              if (!response.ok) throw new Error('Không đọc được ảnh nguồn.');
              const bounds = [crop.x,crop.y,crop.x+crop.w,crop.y+crop.h];
              const {full,thumb} = await GDHomeImages.compress(await response.blob(),bounds);
              if (entry.onlyNew && savedHashes.has(scopeKey(categoryId,await catalogueHash(full)))) { skip(item); continue; }
              const key = await storeAsset(full);
              image = {full:key,thumb:thumb === full ? key : await storeAsset(thumb)};
            }
          } catch (error) {
            item.saveError = error.message;
            failures.push((code || name || entry.name) + ' · ' + error.message);
            failedSources.add(entry);
            continue;
          }
          const hashKey = scopeKey(categoryId,image.full.split('.')[0]);
          if (entry.onlyNew && savedHashes.has(hashKey)) { skip(item); continue; }
          savedCrops.set(cropKey,image);
          if (codeKey) savedCodes.add(codeKey);
          savedHashes.add(hashKey);
          const priceFields = attributeCatalog().priceFields(item);
          const fields = {...priceFields,...Object.fromEntries(detail ? [...detail.querySelectorAll('[data-catalogue-field]')]
            .filter(field => field.value.trim() || Object.hasOwn(priceFields,field.dataset.catalogueField))
            .map(field => [field.dataset.catalogueField,field.value.trim()]) :
            ['size','spec','cabinetWidth','innerWidth','unit','subgroup','finish','collection','material','tone','grain']
              .filter(field => item[field]).map(field => [field,item[field]]))};
          if (entry.layout === 'phao' && fields.size && !/mm|cm/i.test(fields.size)) fields.size += ' mm';
          const category = library.categories.find(category => category.id === categoryId);
          const record = {full:image.full,thumb:image.thumb,display:item.destinationId || entry.override.categoryId ? categoryDisplay(category) : form.elements.display.value,
            view:item.view,code,name,brand:itemBrand,collection,finish,suppliers:itemSuppliers,tags,kind:code && woodCategory(category) ? 'wood' : 'image',...fields};
          existing.set(key,record);
          batch.push({record,entry,item});
          if (batch.length === 50) await flush();
        }
        await flush();
        await finishHistory(auto || dialog.open);
        status.textContent = 'Đã lưu ' + added + ' mã · bỏ qua ' + skipped + ' mã trùng.' +
          (failures.length ? ' ' + failures.length + ' mẫu chưa lưu. Có thể chọn lại và lưu tiếp. ' + failures.slice(0,3).join(' · ') : '');
        onSaved?.();
      } catch (error) {
        for (const {item} of batch) item.saveError = error.message;
        await finishHistory().catch(historyError => toast(historyError.message));
        status.textContent = (added ? 'Đã lưu ' + added + ' mã. ' : '') + error.message;
      }
      return finished;
    }
    save.onclick = async () => {
      if (busy || !form.reportValidity()) return;
      if (mode === 'pdf' && (!form.elements.brand.value.trim() || !form.elements.collection.value.trim())) {
        status.textContent = 'Nhập hãng và tên catalogue.';
        return;
      }
      const selection = selected().flatMap(card => {
        const i = cards.indexOf(card), item = items[i];
        const code = card.querySelector('[data-wood-code-input]').value.trim();
        return code || item.web || item.fileImage ? [{item,detail:details[i],code,name:card.querySelector('[data-wood-name-input]').value.trim()}] : [];
      });
      if (!selection.length) { status.textContent = 'Chọn ít nhất một thẻ có mã.'; return; }
      busy = read.disabled = save.disabled = true;
      try { await persistSelection(selection); }
      finally { busy = read.disabled = false; refreshSelection(); }
    };
  }

  function editWoodCrop(image,current,onSave,title = 'Chỉnh khung cắt swatch') {
    const {dialog,body} = modal('wood-crop-dialog',title);
    const crop = {...current};
    const stage = document.createElement('div');
    stage.className = 'wood-crop-stage';
    const frame = document.createElement('div');
    frame.className = 'wood-crop-frame';
    frame.innerHTML = '<span title="Kéo để đổi kích thước"></span>';
    stage.append(image,frame);
    body.append(stage);
    const save = document.createElement('button');
    save.type = 'button';
    save.textContent = 'Áp dụng khung cắt';
    body.append(save);
    const paint = () => Object.assign(frame.style,{left:crop.x*100+'%',top:crop.y*100+'%',width:crop.w*100+'%',height:crop.h*100+'%'});
    frame.onpointerdown = event => {
      const start = {...crop}, x = event.clientX, y = event.clientY, rect = stage.getBoundingClientRect();
      const resize = event.target === frame.firstElementChild;
      frame.setPointerCapture(event.pointerId);
      frame.onpointermove = event => {
        const dx = (event.clientX-x)/rect.width, dy = (event.clientY-y)/rect.height;
        if (resize) {
          crop.w = bounded(start.w+dx,.02,1-crop.x);
          crop.h = bounded(start.h+dy,.02,1-crop.y);
        } else {
          crop.x = bounded(start.x+dx,0,1-crop.w);
          crop.y = bounded(start.y+dy,0,1-crop.h);
        }
        paint();
      };
      frame.onlostpointercapture = () => { frame.onpointermove = null; };
    };
    save.onclick = () => { onSave(crop); dialog.close(); };
    paint();
  }

  const duplicateCode = code => String(code || '').normalize('NFD').replace(/\p{M}/gu,'')
    .replace(/đ/gi,'d').toLowerCase().replace(/[\s\p{Pd}]+/gu,'');
  function similarCode(a,b) {
    const limit = Math.floor(Math.max(a.length,b.length)*.15);
    if (!limit || Math.abs(a.length-b.length) > limit) return false;
    if (limit === 1) {
      let i = 0, j = 0, edits = 0;
      while (i < a.length && j < b.length) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (a.length >= b.length) i++;
        if (b.length >= a.length) j++;
      }
      return edits + (a.length-i) + (b.length-j) <= 1;
    }
    let previous = Array.from({length:b.length+1},(_,i) => i);
    for (let i=1; i<=a.length; i++) {
      const row = Array(b.length+1).fill(limit+1);
      row[0] = i;
      let minimum = i;
      for (let j=Math.max(1,i-limit); j<=Math.min(b.length,i+limit); j++) {
        row[j] = Math.min(row[j-1]+1,previous[j]+1,previous[j-1]+Number(a[i-1] !== b[j-1]));
        minimum = Math.min(minimum,row[j]);
      }
      if (minimum > limit) return false;
      previous = row;
    }
    return previous[b.length] <= limit;
  }
  async function duplicateGroups(items,signal) {
    const parents = items.map((_,i) => i);
    function root(i) {
      while (parents[i] !== i) {
        parents[i] = parents[parents[i]];
        i = parents[i];
      }
      return i;
    }
    const codes = new Map(), hashes = new Map();
    function groupBy(map,key,index) {
      if (!key) return;
      if (map.has(key)) parents[root(index)] = root(map.get(key));
      else map.set(key,index);
    }
    for (const [i,item] of items.entries()) {
      groupBy(codes,duplicateCode(item.code),i);
      groupBy(hashes,item.full?.split('.')[0],i);
      groupBy(hashes,item.originalFull?.split('.')[0],i);
    }
    const entries = [...codes].sort(([a],[b]) => a.length-b.length);
    for (const [i,[code,index]] of entries.entries()) {
      if (i%60 === 0) {
        await new Promise(resolve => setTimeout(resolve,0));
        if (signal.aborted) return [];
      }
      for (let j=i+1; j<entries.length; j++) {
        const [other,target] = entries[j];
        if (code.length < other.length*.85) break;
        if (root(index) !== root(target) && similarCode(code,other)) parents[root(target)] = root(index);
      }
    }
    const groups = new Map();
    for (const [i,item] of items.entries()) {
      const key = root(i);
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(item);
    }
    return [...groups.values()].filter(group => group.length > 1);
  }

  function openDuplicateLibrary() {
    const {dialog,body} = modal('asset-merge-dialog','Tìm mã trùng');
    body.innerHTML = '<p role="status">Đang dò mã và ảnh trùng…</p><button type="button" data-merge-undo hidden>Hoàn tác gộp</button><div data-duplicate-groups></div>';
    const status = body.querySelector('[role=status]'), list = body.querySelector('[data-duplicate-groups]');
    const undoButton = body.querySelector('[data-merge-undo]'), lifetime = new AbortController();
    let undoToken, guestUndo, busy = false;
    dialog.addEventListener('close',() => lifetime.abort(),{once:true});
    async function paint(message) {
      const data = await loadLibrary();
      const groups = await duplicateGroups(data.items,lifetime.signal);
      if (!dialog.isConnected) return;
      list.innerHTML = groups.map((group,index) => '<fieldset><legend>Nhóm ' + (index+1) + ' · ' + group.length + ' mẫu</legend>' +
        '<div class="asset-merge-grid">' + group.map((item,i) => '<div>' + grid([item],{selectable:false}) +
          '<label><input type="checkbox" data-merge-include value="' + esc(item.id) + '"' + (i === 0 ? ' checked' : '') + '> Gộp</label>' +
          '<label><input type="radio" name="merge-target-' + index + '" value="' + esc(item.id) + '"' + (i === 0 ? ' checked' : '') + '> Đích</label></div>').join('') +
        '</div><button type="button" data-merge-group>Gộp</button></fieldset>').join('');
      status.textContent = (message ? message + ' · ' : '') + (groups.length ? groups.length + ' nhóm mã hoặc ảnh trùng/gần giống.' : 'Không còn nhóm trùng.');
      undoButton.hidden = !undoToken;
      await hydrate(list);
    }
    async function apply(patch) {
      if (busy) return;
      busy = true;
      try {
        const result = await libraryCall('items/merge',patch,data => {
          if (patch.undo) {
            if (!guestUndo || guestUndo.version !== data._version) throw new Error('Thư viện đã thay đổi.');
            data.items = guestUndo.items;
            return {guestReverse:guestUndo.changes};
          }
          const ids = new Set(patch.ids);
          const target = data.items.find(item => item.id === patch.targetId);
          if (!target || !ids.has(target.id) || ids.size < 2) throw new Error('Chọn mã đích và ít nhất một mã khác.');
          const selected = data.items.filter(item => ids.has(item.id));
          if (selected.length !== ids.size) throw new Error('Có mã không còn trong thư viện.');
          guestUndo = {items:structuredClone(data.items),version:data._version+1};
          for (const field of ['tags','suppliers']) target[field] = [...new Set(selected.flatMap(item => item[field] || []))];
          target.brands = [...new Set(selected.flatMap(item => [item.brand,...(item.brands || [])]).filter(Boolean))];
          target.used = selected.reduce((sum,item) => sum+(item.used || 0),0);
          ids.delete(target.id);
          data.items = data.items.filter(item => !ids.has(item.id));
          return {undoToken:'guest',guestRemoved:[...ids],guestTarget:target.id};
        });
        if (isGuest()) {
          const referenceChanges = hooks.mergeGuestReferences?.(result.guestRemoved,result.guestTarget,result.guestReverse) || [];
          if (result.undoToken) guestUndo.changes = referenceChanges;
        } else {
          document.dispatchEvent(new CustomEvent('gdhome:library-references',{detail:result}));
        }
        undoToken = result.undoToken;
        await paint(patch.undo ? 'Đã hoàn tác' : 'Đã gộp mã');
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; }
    }
    undoButton.onclick = () => apply({undo:undoToken});
    list.onchange = event => {
      if (event.target.matches('[type=radio]')) event.target.closest('label').previousElementSibling.querySelector('input').checked = true;
    };
    list.onclick = event => {
      const button = event.target.closest('[data-merge-group]');
      if (!button) return;
      const group = button.closest('fieldset');
      const ids = [...group.querySelectorAll('[data-merge-include]:checked')].map(box => box.value);
      const targetId = group.querySelector('[type=radio]:checked')?.value;
      if (ids.length < 2 || !ids.includes(targetId)) {
        status.textContent = 'Chọn mã đích và ít nhất một mã khác để gộp.';
        return;
      }
      apply({targetId,ids});
    };
    paint().catch(error => { status.textContent = error.message; });
  }

  function openLibrary({groupName,categoryId,onPick} = {}) {
    const {dialog,body} = modal('asset-library-dialog','📚 Dữ liệu dùng chung');
    let current = categoryId || null, query = '', status = '';
    let uploadDisplay;
    const priceRange = {min:'',max:''};
    const facets = {}, selected = new Set();
    const sidebarState = {groups:{}};
    const viewState = {tab:'items'};
    let rangeAnchor, dragged, undoToken, guestUndo;
    function changeCategory(id) {
      if (current !== id) {
        current = id;
        clearFacets(facets);
        selected.clear();
        rangeAnchor = null;
        uploadDisplay = undefined;
        priceRange.min = priceRange.max = '';
      }
      status = '';
      paint();
    }
    async function renameCategory(category) {
      const name = prompt('Đổi tên hạng mục:',category.name);
      if (!name?.trim()) return;
      try { await saveCategory(name.trim(),category.id); } catch (error) { toast(error.message); }
    }
    async function removeManagedCategory(category) {
      if (!confirm('Xoá hạng mục "' + category.name + '"?')) return;
      try {
        await deleteCategory(category.id);
        undoToken = guestUndo = null;
        if (current === category.id) changeCategory(null);
      } catch (error) { toast(error.message); }
    }
    function mergeCategory(category,data) {
      const targets = data.categories.filter(entry => entry.id !== category.id).map(entry => [entry.id,entry.name]);
      openLibraryMerge(category.name,targets,async targetId => {
        const patch = {sourceId:category.id,targetId};
        await libraryCall('categories/merge',patch,guest => {
          attributeCatalog().mergeCategories(guest,patch);
          return {};
        });
        undoToken = guestUndo = null;
        changeCategory(targetId);
        toast('Đã gộp hạng mục “' + category.name + '”.');
      });
    }
    async function bulk(patch) {
      if (patch.order) sidebarState.sort = 'manual';
      const result = await libraryCall('items/bulk',patch,data => {
        if (patch.undo && guestUndo) { data.items = guestUndo; guestUndo = null; return {}; }
        guestUndo = structuredClone(data.items);
        const ids = new Set(patch.ids);
        if (patch.delete) data.items = data.items.filter(item => !ids.has(item.id));
        for (const item of data.items.filter(item => ids.has(item.id))) {
          const {price,priceUnit,priceNote,...fields} = patch.set || {};
          Object.assign(item,fields);
          attributeCatalog().updatePrice(item,patch.set || {});
          if (patch.categoryId) item.categoryId = patch.categoryId;
          if (patch.order) item.order = patch.order.indexOf(item.id);
          item.tags = [...new Set([...(item.tags || []),...(patch.addTags || [])])].filter(tag => !patch.removeTags?.includes(tag));
          item.suppliers = [...new Set([...(item.suppliers || []),...(patch.addSuppliers || [])])].filter(name => !patch.removeSuppliers?.includes(name));
        }
        return {undoToken:'guest'};
      });
      undoToken = result.undoToken;
      selected.clear();
      rangeAnchor = null;
      await paint();
    }
    const applyBulk = patch => bulk(patch).catch(error => toast(error.message));
    function bulkControls(showPrices) {
      if (onPick) return '';
      return '<div class="asset-bulk-controls">' + (selected.size ? '<strong>' + selected.size + ' đã chọn</strong> ' +
        [['addTags','Gắn tag'],['removeTags','Bỏ tag'],['brand','Đặt hãng'],['addSuppliers','Thêm đơn vị cung cấp'],
          ['removeSuppliers','Bỏ đơn vị cung cấp'],['size','Đặt kích thước'],['categoryId','Chuyển hạng mục'],['reviewed','Đã duyệt'],
          ...(showPrices ? [['price','Đặt giá']] : []),['delete','Xoá đã chọn']]
          .map(([key,label]) => '<button type="button" data-bulk="' + key + '">' + label + '</button>').join(' ') : '') +
        (undoToken ? '<button type="button" data-bulk="undo">Hoàn tác</button>' : '') + '</div>';
    }
    async function paint() {
      let data;
      try { data = await loadLibrary(); } catch (error) { body.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
      const showTab = tab => {
        viewState.tab = tab;
        sidebarState.drawer = false;
        paint();
      };
      const attributes = viewState.tab === 'attributes';
      if (!data.categories.some(category => category.id === current)) {
        current = categoryFor(data,groupName)?.id || data.categories[0]?.id || null;
        clearFacets(facets);
      }
      const category = data.categories.find(c => c.id === current);
      const showPrices = !onPick && data.showPrices === true;
      if (!showPrices && Object.hasOwn(priceSortLabels,sidebarState.sort)) sidebarState.sort = 'used';
      const config = category ? attributeCatalog().filterConfig(data,current) : undefined;
      for (const group of config || []) if (!group.visible) delete facets[group.key];
      const scoped = data.items.filter(item => item.categoryId === current && (!onPick || !item.hidden));
      pruneFacets(scoped,facets);
      const candidates = scoped.filter(item => !query || fold([item.code,item.name,...facetValues(item,'brand'),item.collection].join(' ')).includes(fold(query)));
      const filterPrice = showPrices && (priceRange.min !== '' || priceRange.max !== '');
      const items = sortLibrary(candidates.filter(item => matchFacets(item,facets) &&
        (!filterPrice || (item.price != null && item.price >= (priceRange.min || 0) && item.price <= (priceRange.max || Infinity)))),sidebarState.sort);
      const previousMain = body.querySelector('.asset-library-main');
      const sameCategory = previousMain?.dataset.libraryCategory === current;
      const viewKey = attributes ? viewState.attributeKey || 'size' : 'items';
      const mainScroll = sameCategory && previousMain.dataset.libraryView === viewKey ? previousMain.scrollTop : 0;
      const categoryPaneScroll = body.querySelector('.asset-category-column')?.scrollTop || 0;
      const categoryScroll = body.querySelector('.asset-cat-list')?.scrollTop || 0;
      const facetScroll = sameCategory ? body.querySelector('.asset-facets')?.scrollTop || 0 : 0;
      body.innerHTML = '<aside class="asset-categories"><div class="asset-cat-list">' + data.categories.map(c => '<label draggable="' + !attributes + '" data-cat="' + esc(c.id) + '"' +
        (c.id === current ? ' aria-current="true"' : '') + '><input type="radio" data-category-check' + (c.id === current ? ' checked' : '') +
        '><span title="' + esc(c.name) + '">' + esc(c.name) + '</span><small>' + data.items.filter(item => item.categoryId === c.id).length +
        '</small></label>').join('') + '</div><button type="button" data-cat-add>＋ Thêm hạng mục</button></aside>' +
        '<div class="asset-library-navigation">' + (!onPick ? libraryTabs(viewState.tab) : '') + '</div>' +
        '<section class="asset-library-main">' + facetMarkup(candidates,facets,config) + (attributes ? '' : category ? '<div class="asset-library-head"><div class="asset-category-toolbar"><strong title="' + esc(category.name) + '">' + esc(category.name) + '</strong>' +
          '<button type="button" data-import-wood>Nhập catalogue</button>' +
          (!onPick ? '<button type="button" data-find-duplicates>Tìm mã trùng</button>' : '') +
          '<details class="asset-category-menu"><summary aria-label="Thao tác hạng mục">⋯</summary><div>' +
          '<button type="button" data-cat-rename>Đổi tên</button><button type="button" data-cat-delete>Xoá hạng mục</button>' +
          '<button type="button" data-manage-suppliers>Đơn vị cung cấp</button></div></details></div>' +
          '<input type="search" placeholder="Tìm theo tên / mã" value="' + esc(query) + '">' +
          (!onPick ? '<label class="asset-price-toggle"><input type="checkbox" data-show-prices' + (showPrices ? ' checked' : '') + '> Hiện giá</label>' : '') +
          (showPrices ? '<div class="asset-price-range">' + [['min','Giá từ'],['max','Giá đến']].map(([key,label]) =>
            '<input type="number" min="0" step="any" data-price-range="' + key + '" aria-label="' + label + '" placeholder="' + label + '" value="' + esc(priceRange[key]) + '">').join('') + '</div>' : '') + '</div>' +
          '<details class="asset-upload-strip"' + (sidebarState.uploadOpen === false ? '' : ' open') + '><summary>Thêm ảnh</summary>' +
          '<div><button type="button" class="asset-drop" title="Kéo thả hoặc Ctrl+V để dán ảnh">Chọn tệp / kéo thả</button>' +
          '<button type="button" data-folder-choose>Chọn thư mục</button><input type="file" webkitdirectory multiple data-folder-input hidden>' +
          '<label>Kiểu hiển thị ' + displaySelect(uploadDisplay || categoryDisplay(category),'data-library-display') + '</label></div></details>' +
          '<p class="asset-status" role="status">' + esc(status) + '</p>' +
          bulkControls(showPrices) +
          (facetEmpty(items,facets) || grid(items,{selectable:!!onPick,removable:true,showPrices,selected:onPick ? null : selected,
            empty:filterPrice ? 'Không có mẫu trong khoảng giá.' : 'Chưa có ảnh trong hạng mục này.'})) + onlineSlot : '<p class="asset-empty">Tạo hạng mục để bắt đầu.</p>') +
        (onPick ? '<p class="asset-hint">Bấm vào ảnh để dùng cho ô đang chọn.</p>' : '') + '</section>';
      arrangeFilterSidebar(body,sidebarState);
      wireLibraryFilterSettings(body,category,config);
      const main = body.querySelector('.asset-library-main');
      main.dataset.libraryView = viewKey;
      main.dataset.libraryCategory = current || '';
      body.querySelectorAll('[data-library-tab]').forEach(button => button.onclick = () => showTab(button.dataset.libraryTab));
      body.querySelectorAll('[data-category-check]').forEach(input => input.onchange = () => {
        if (input.checked) changeCategory(input.closest('[data-cat]').dataset.cat);
      });
      body.querySelector('[data-cat-add]').onclick = async () => {
        const name = prompt('Tên hạng mục mới (vd: Gạch ốp lát, Sàn gỗ, Rèm):');
        if (!name?.trim()) return;
        try { const result = await saveCategory(name.trim()); changeCategory(result.category?.id || current); } catch (error) { toast(error.message); }
      };
      if (!onPick) wireLibraryContext(body,data,{renameCategory,mergeCategory,removeManagedCategory,attributeKey:viewState.attributeKey || 'size',showAttributes:key => {
        viewState.attributeKey = key;
        viewState.attributeMessage = '';
        showTab('attributes');
      }});
      body.querySelector('.asset-category-column').scrollTop = categoryPaneScroll;
      body.querySelector('.asset-cat-list').scrollTop = categoryScroll;
      body.querySelector('.asset-facets').scrollTop = facetScroll;
      wireFacets(body,facets,paint);
      if (attributes) {
        dialog.onkeydown = dialog.onpaste = null;
        body.ondragstart = body.ondragover = body.ondragend = body.ondrop = null;
        renderLibraryAttributes(main,data,viewState,paint);
        main.scrollTop = mainScroll;
        return;
      }
      main.scrollTop = mainScroll;
      wireLibraryActions(body,sidebarState,paint,{manual:!onPick,showPrices});
      const showPricesToggle = body.querySelector('[data-show-prices]');
      if (showPricesToggle) showPricesToggle.onchange = async () => {
        const value = showPricesToggle.checked;
        showPricesToggle.disabled = true;
        if (!value) priceRange.min = priceRange.max = '';
        try { await libraryCall('preferences',{showPrices:value},guest => { guest.showPrices = value; }); }
        catch (error) { toast(error.message); await paint(); }
      };
      body.querySelectorAll('[data-price-range]').forEach(input => input.onchange = () => {
        priceRange[input.dataset.priceRange] = input.value;
        paint();
      });
      const findDuplicates = body.querySelector('[data-find-duplicates]');
      if (findDuplicates) findDuplicates.onclick = openDuplicateLibrary;
      body.querySelectorAll('[data-bulk-select]').forEach(box => box.onclick = event => {
        const id = box.closest('[data-asset-id]').dataset.assetId;
        const ids = items.map(item => item.id);
        const from = ids.indexOf(rangeAnchor), to = ids.indexOf(id);
        const range = event.shiftKey && from >= 0 ? ids.slice(Math.min(from,to),Math.max(from,to)+1) : [id];
        for (const entry of range) box.checked ? selected.add(entry) : selected.delete(entry);
        rangeAnchor = id;
        paint();
      });
      const managedGrid = body.querySelector('.asset-grid-managed');
      if (managedGrid) wireMarquee(managedGrid,'.asset-card',(intersecting,subtract) => {
        for (const card of intersecting) {
          const id = card.dataset.assetId;
          if (subtract) selected.delete(id);
          else selected.add(id);
        }
        paint();
      });
      dialog.onkeydown = event => {
        if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'a' || event.target.matches('input[type=search],textarea')) return;
        if (onPick) return;
        event.preventDefault();
        selected.clear();
        items.forEach(item => selected.add(item.id));
        paint();
      };
      body.querySelectorAll('[data-bulk]').forEach(button => button.onclick = () => {
        const key = button.dataset.bulk;
        const ids = [...selected];
        if (key === 'undo') return applyBulk({undo:undoToken});
        if (key === 'reviewed') return applyBulk({ids,removeTags:['chua-duyet']});
        if (key === 'price') {
          const editor = modal('asset-attribute-editor','Đặt giá cho ' + ids.length + ' mẫu');
          editor.body.innerHTML = '<form class="asset-attribute-form">' + libraryPriceInputs() +
            '<small>Để trống trường cần xoá.</small><button>Lưu giá</button><p role="status"></p></form>';
          const form = editor.body.querySelector('form');
          form.onsubmit = async event => {
            event.preventDefault();
            const button = form.querySelector('button');
            button.disabled = true;
            try { await bulk({ids,set:libraryPricePatch(form)}); editor.dialog.close(); }
            catch (error) { form.querySelector('[role=status]').textContent = error.message; }
            finally { button.disabled = false; }
          };
          return;
        }
        if (key === 'delete') {
          if (confirm('Xoá các mẫu đã chọn?')) applyBulk({ids,delete:true});
          return;
        }
        const hint = key === 'categoryId' ? '\n' + data.categories.map((item,index) => (index+1) + '. ' + item.name).join('\n') : '';
        const value = prompt(button.textContent + hint);
        if (value === null) return;
        if (key === 'categoryId') {
          const categoryId = data.categories[Number(value)-1]?.id;
          if (categoryId) applyBulk({ids,categoryId});
        } else if (['brand','size'].includes(key)) applyBulk({ids,set:{[key]:value}});
        else applyBulk({ids,[key]:value.split(',').map(value => value.trim()).filter(Boolean)});
      });
      const changeCategoryOrder = order => libraryCall('categories/order',{order},guest => {
        const positions = new Map(order.map((id,index) => [id,index]));
        guest.categories.sort((a,b) => positions.get(a.id)-positions.get(b.id));
        return {};
      }).catch(error => toast(error.message));
      body.ondragstart = event => {
        const card = event.target.closest('[data-asset-id]');
        const cat = event.target.closest('[data-cat]');
        if (card && !onPick) {
          const id = card.dataset.assetId;
          dragged = {ids:selected.has(id) ? [...selected] : [id],id};
        } else if (cat) dragged = {categoryId:cat.dataset.cat};
        else return;
        event.dataTransfer.setData('application/x-gdhome-library','1');
      };
      const targetOf = event => event.target.closest('[data-cat],[data-asset-id]') ||
        event.target.closest('.asset-facet-choice')?.querySelector('[data-facet=tags],[data-facet=suppliers]');
      const clearMark = () => body.querySelectorAll('.asset-drop-mark').forEach(el => el.classList.remove('asset-drop-mark'));
      body.ondragover = event => {
        const target = targetOf(event);
        if (!dragged || !target) return;
        event.preventDefault();
        clearMark();
        target.classList.add('asset-drop-mark');
      };
      body.ondragend = () => { dragged = null; clearMark(); };
      body.ondrop = event => {
        const target = targetOf(event), source = dragged;
        if (!source || !target) return;
        event.preventDefault();
        dragged = null;
        clearMark();
        const categoryId = target.dataset.cat;
        if (source.categoryId && categoryId && source.categoryId !== categoryId) {
          const order = data.categories.map(item => item.id).filter(id => id !== source.categoryId);
          order.splice(order.indexOf(categoryId),0,source.categoryId);
          changeCategoryOrder(order);
        } else if (source.ids && categoryId) applyBulk({ids:source.ids,categoryId});
        else if (source.ids && target.dataset.facet) applyBulk({ids:source.ids,[target.dataset.facet === 'tags' ? 'addTags' : 'addSuppliers']:[target.dataset.value]});
        else if (source.ids && target.dataset.assetId && !source.ids.includes(target.dataset.assetId)) {
          const order = items.map(item => item.id).filter(id => !source.ids.includes(id));
          order.splice(order.indexOf(target.dataset.assetId),0,...source.ids);
          applyBulk({ids:order,order});
        }
      };
      body.querySelectorAll('[data-cat]').forEach(button => button.onkeydown = event => {
        if (!event.altKey || !['ArrowUp','ArrowDown'].includes(event.key)) return;
        const order = data.categories.map(item => item.id);
        const index = order.indexOf(button.dataset.cat);
        const next = index + (event.key === 'ArrowUp' ? -1 : 1);
        if (next < 0 || next >= order.length) return;
        event.preventDefault();
        [order[index],order[next]] = [order[next],order[index]];
        changeCategoryOrder(order);
      });
      body.querySelector('[data-manage-suppliers]')?.addEventListener('click',async () => {
        const previousName = prompt('Chọn tên để sửa hoặc để trống để thêm: ' + (data.suppliers || []).map(item => item.name).join(', '));
        if (previousName === null) return;
        const previous = data.suppliers?.find(item => item.name === previousName);
        const name = prompt('Tên đơn vị cung cấp:',previous?.name || '');
        if (!name?.trim()) return;
        const phone = prompt('Số điện thoại:',previous?.phone || '');
        const note = prompt('Ghi chú:',previous?.note || '');
        if (phone === null || note === null) return;
        try { await libraryCall('suppliers',{previousName,name,phone,note},guest => {
          guest.suppliers = [...(guest.suppliers || []).filter(item => item.name !== previousName && item.name !== name),{name,phone,note}];
          return {};
        }); } catch (error) { toast(error.message); }
      });
      body.querySelector('[data-import-wood]')?.addEventListener('click',() => openWoodCatalogue(category.id,paint));
      const categoryMenu = body.querySelector('.asset-category-menu');
      if (categoryMenu) categoryMenu.addEventListener('click',event => {
        if (event.target.closest('button')) categoryMenu.open = false;
      });
      body.querySelector('[data-cat-rename]')?.addEventListener('click',() => renameCategory(category));
      body.querySelector('[data-cat-delete]')?.addEventListener('click',() => removeManagedCategory(category));
      const search = body.querySelector('.asset-library-head input[type=search]');
      if (search) search.oninput = () => { query = search.value; clearTimeout(search.timer); search.timer = setTimeout(() => { paint().then(() => { const s = body.querySelector('.asset-library-head input[type=search]'); s?.focus(); s?.setSelectionRange(query.length,query.length); }); },250); };
      const displayOption = body.querySelector('[data-library-display]');
      if (displayOption) displayOption.onchange = () => { uploadDisplay = displayOption.value; };
      const display = () => uploadDisplay || categoryDisplay(category);
      const drop = body.querySelector('.asset-drop');
      const upload = async files => {
        try { await uploadToLibrary(current,files,message => { status = message; const s = body.querySelector('.asset-status'); if (s) s.textContent = message; },display()); }
        catch (error) { status = error.message; }
        paint();
      };
      if (drop) {
        drop.onclick = async () => { const files = await filePicker('image/*'); if (files.length) upload(files); };
        enableDrop(drop,upload);
        drop.addEventListener('drop',event => {
          const entries = [...event.dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
          if (!entries.some(entry => entry.isDirectory)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          droppedCatalogueFiles(entries).then(files => reviewFolders(current,files,display())).catch(error => toast(error.message));
        },true);
      }
      const folder = body.querySelector('[data-folder-input]');
      const strip = body.querySelector('.asset-upload-strip');
      if (strip) strip.ontoggle = () => { sidebarState.uploadOpen = strip.open; };
      body.querySelector('[data-folder-choose]')?.addEventListener('click',() => folder.click());
      if (folder) folder.onchange = () => {
        try { reviewFolders(current,[...folder.files].map(file => ({file,path:file.webkitRelativePath.split('/').slice(0,-1).join('/')})),display()); }
        catch (error) { toast(error.message); }
        folder.value = '';
      };
      dialog.onpaste = event => {
        const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
        if (!files.length || !current || event.target.closest('input')) return;
        event.preventDefault();
        upload(files);
      };
      body.querySelectorAll('[data-asset-display]').forEach(select => select.onchange = async () => {
        try { await updateItem({id:select.closest('[data-asset-id]').dataset.assetId,display:select.value}); }
        catch (error) { toast(error.message); paint(); }
      });
      if (!onPick) {
        const pictured = items.filter(item => item.full || item.thumb);
        body.querySelectorAll('[data-asset-open]').forEach(button => button.ondblclick = () => {
          const item = pictured.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
          if (item) editView(item,{sequence:pictured,onSave:(entry,patch) => updateItem({id:entry.id,...patch})}).catch(error => toast(error.message));
        });
        const handleSelectionKey = dialog.onkeydown;
        dialog.onkeydown = event => {
          if (event.key !== 'F2') return handleSelectionKey(event);
          const card = event.target.closest('[data-asset-id]') || (selected.size === 1 ?
            [...body.querySelectorAll('[data-asset-id]')].find(node => selected.has(node.dataset.assetId)) : null);
          const item = items.find(entry => entry.id === card?.dataset.assetId);
          if (!item) return;
          event.preventDefault();
          editAssetIdentity(card,item,patch => updateItem({id:item.id,...patch}));
        };
      }
      body.querySelectorAll('[data-asset-hide]').forEach(button => button.onclick = () => {
        const item = items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
        updateItem({id:item.id,hidden:!item.hidden}).catch(error => toast(error.message));
      });
      body.querySelectorAll('[data-asset-remove]').forEach(button => button.onclick = async () => {
        if (!confirm('Xoá ảnh khỏi dữ liệu dùng chung? Các bảng đã dùng ảnh này vẫn giữ ảnh.')) return;
        try { await deleteItems([button.closest('[data-asset-id]').dataset.assetId]); } catch (error) { toast(error.message); }
      });
      body.querySelectorAll('[data-asset-pick]').forEach(button => button.onclick = () => {
        const item = data.items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
        dialog.close();
        if (item.kind !== 'paint') updateItem({id:item.id,used:true}).catch(() => {});
        if (item.full || item.kind === 'paint' || item.kind === 'wood') onPick(item);
      });
      body.querySelectorAll('.asset-card figcaption').forEach(caption => {
        caption.title = 'Nháy đúp để sửa mẫu';
        caption.ondblclick = () => {
          const id = caption.closest('[data-asset-id]').dataset.assetId;
          const item = data.items.find(entry => entry.id === id);
          if (item) editLibraryItem(item,data);
        };
      });
      if (items.length < 4 && query.trim()) renderGoogleFallback(body.querySelector('.asset-google-fallback-slot'),query,{
        categoryId:current,groupName,
        onPickImage:onPick ? entry => { dialog.close(); onPick(entry); } : undefined
      });
      await hydrate(body);
    }
    document.addEventListener('gdhome:library-changed',paint);
    dialog.addEventListener('close',() => document.removeEventListener('gdhome:library-changed',paint),{once:true});
    body.innerHTML = '<p class="asset-empty">Đang tải…</p>';
    paint();
    return dialog;
  }

  function openRenders({projectId,projectName,onPick} = {}) {
    const {dialog,body} = modal('asset-render-dialog','🎨 Phối cảnh 3D' + (projectName ? ' · ' + projectName : ''));
    let status = '';
    async function paint(force = false) {
      body.innerHTML = '<div class="asset-drop" tabindex="0">⬆ Kéo thả ảnh hoặc PDF phối cảnh cả nhà · PDF tự tách từng trang thành ảnh và nén</div>' +
        '<p class="asset-status" role="status">' + esc(status) + '</p><div class="asset-render-list"><p class="asset-empty">Đang tải…</p></div>' +
        '<p class="asset-hint">Kho ảnh này dùng chung với Quản lý dự án.' + (onPick ? ' Bấm ảnh để dùng cho ô đang chọn.' : '') +
        ' <a href="/du-an?project=' + encodeURIComponent(projectId || '') + '" target="_blank">Mở Hồ sơ dự án</a></p>';
      const drop = body.querySelector('.asset-drop');
      const upload = async files => {
        try { await uploadRenders(projectId,files,message => { status = message; const s = body.querySelector('.asset-status'); if (s) s.textContent = message; }); }
        catch (error) { status = error.message; }
        paint(true);
      };
      drop.onclick = async () => { const files = await filePicker('image/*,application/pdf'); if (files.length) upload(files); };
      drop.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drop.click(); } };
      enableDrop(drop,upload);
      const list = body.querySelector('.asset-render-list');
      try {
        const items = await loadRenders(projectId,force);
        if (!list.isConnected) return;
        list.innerHTML = grid(items,{selectable:!!onPick,removable:true,empty:'Dự án chưa có phối cảnh 3D.'});
        list.querySelectorAll('[data-asset-pick]').forEach(button => button.onclick = () => {
          const item = items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
          body.closest('dialog').close();
          onPick(item);
        });
        list.querySelectorAll('[data-asset-open]').forEach(button => button.onclick = async () => {
          const item = items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
          if (item.full) window.open(await assetUrl(item.full),'_blank');
        });
        list.querySelectorAll('[data-asset-remove]').forEach(button => button.onclick = async () => {
          if (!confirm('Xoá ảnh 3D khỏi dự án?')) return;
          const documentId = button.closest('[data-asset-id]').dataset.assetId;
          if (!removedRenders.has(projectId)) removedRenders.set(projectId,new Set());
          const removed = removedRenders.get(projectId);
          removed.add(documentId);
          document.dispatchEvent(new CustomEvent('gdhome:renders-changed',{detail:projectId}));
          try {
            await api('/api/project-hub/documents/delete',{method:'POST',body:JSON.stringify({projectId,documentId})});
            invalidateRenders(projectId);
          } catch (error) {
            removed.delete(documentId);
            document.dispatchEvent(new CustomEvent('gdhome:renders-changed',{detail:projectId}));
            toast(error.message);
          }
        });
        await hydrate(list);
      } catch (error) {
        body.querySelector('.asset-render-list').innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>';
      }
    }
    const refresh = event => { if (event.detail === projectId) paint(); };
    document.addEventListener('gdhome:renders-changed',refresh);
    dialog.addEventListener('close',() => document.removeEventListener('gdhome:renders-changed',refresh),{once:true});
    paint();
  }

  if (location.hash === '#library') addEventListener('load',() => setTimeout(() => openLibrary(),300));

  return {configure,libraryItemMatches:(full,code) => !!library?.items.some(item => item.full === full && (item.code === code || item.name === code)),invalidateRenders,loadRenders,uploadRenders,loadLibrary,uploadToLibrary,addItems,deleteItems,updateItem,saveCategory,deleteCategory,
    categoryFor,openLibrary,openRenders,pickRender,pickLibrary,pickPaint,pickWood,loadPaintData,loadWoodData,storeAsset,closePicker,editView,viewCss,viewStyle,clampView,hydrate,assetUrl,displayAttribute,displayOptions,
    filePicker,isPdf,pdfPages};
})();
