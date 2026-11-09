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
    const response = await fetch('/api/materials/assets',{method:'POST',headers:{...hooks.headers(),'Content-Type':blob.type},body:blob});
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || 'Không lưu được ảnh.');
    return data.name;
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
      try { img.src = await assetUrl(img.dataset.libAsset); } catch { img.alt = 'Ảnh chưa tải được'; }
    }));
  }
  async function uploadImage(file,options) {
    const {full,thumb} = await GDHomeImages.compress(file,null,options);
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
  function guestLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(guestLibraryKey) || 'null');
      if (stored?.categories) {
        const genericWood = stored.categories.find(c => c.id === 'cat-1' && c.name.toLocaleLowerCase('vi') === 'mã gỗ');
        if (genericWood) genericWood.name = 'Mẫu ảnh gỗ';
        const wood = stored.categories.find(c => c.id === 'ancuong-wood');
        if (wood) wood.name = 'Mã gỗ';
        else stored.categories.push({id:'ancuong-wood',name:'Mã gỗ'});
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
          if (!data.items.some(other => other.code && catalogueKey(other) === catalogueKey(entry))) data.items.push(entry);
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
      document.dispatchEvent(new Event('gdhome:library-changed'));
      return {...library,...result};
    }
    const data = await api('/api/library/' + path,{method:'POST',body:JSON.stringify(body)});
    if (!library || data._version >= library._version) library = data;
    document.dispatchEvent(new Event('gdhome:library-changed'));
    return data;
  }
  const uid = () => crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random();
  const addItems = (categoryId,items) => libraryCall('items',{categoryId,items},data => {
    const added = [];
    let skipped = 0;
    for (const item of items) {
      if (item.code && data.items.some(entry => entry.categoryId === categoryId && entry.code && catalogueKey(entry) === catalogueKey(item))) { skipped++; continue; }
      added.push({id:uid(),categoryId,name:item.name || '',note:'',kind:item.kind || (item.code ? 'wood' : 'image'),hex:item.hex,full:item.full,thumb:item.thumb,square:item.square,originalFull:item.originalFull,originalThumb:item.originalThumb,createdAt:Date.now(),
        ...(item.code ? {code:item.code,brand:item.brand || 'An Cường',collection:item.collection,finish:item.finish} : {})});
    }
    data.items.unshift(...added);
    return {added,skipped};
  });
  const updateItem = patch => libraryCall('items/update',patch,data => {
    const item = data.items.find(entry => entry.id === patch.id);
    if (item) {
      if (typeof patch.name === 'string') item.name = patch.name;
      for (const key of ['brand','size','tags','suppliers']) if (Object.hasOwn(patch,key)) item[key] = patch[key];
      if (typeof patch.hidden === 'boolean') item.hidden = patch.hidden;
      if (patch.hex) item.hex = patch.hex;
      if (typeof patch.square === 'boolean') for (const key of ['square','full','thumb','originalFull','originalThumb']) item[key] = patch[key];
      if (patch.categoryId) item.categoryId = patch.categoryId;
      if (patch.used) item.used = (item.used || 0) + 1;
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
    if (id) { const category = data.categories.find(c => c.id === id); if (category) category.name = name; return {category}; }
    const category = {id:'cat-' + uid().slice(0,8),name};
    data.categories.push(category);
    return {category};
  });
  const deleteCategory = id => libraryCall('categories/delete',{id},data => {
    if (data.items.some(item => item.categoryId === id)) throw new Error('Hạng mục còn ảnh. Chuyển hoặc xoá ảnh trước.');
    data.categories = data.categories.filter(c => c.id !== id);
    return {};
  });
  function categoryFor(data,groupName) {
    const target = fold(groupName);
    if (!target) return null;
    let best = null, bestScore = 0;
    for (const category of data.categories) for (const name of [category.name,category.source].map(fold).filter(Boolean)) {
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
  function clampView(view,ratio) {
    const z = Math.min(6,Math.max(1,view.z || 1));
    const visX = ratio >= 1 ? 1/(z*ratio) : 1/z;
    const visY = ratio >= 1 ? 1/z : ratio/z;
    const clamp = (value,visible) => visible >= 1 ? 0.5 : Math.min(1-visible/2,Math.max(visible/2,value));
    return {x:round(clamp(view.x ?? 0.5,visX)),y:round(clamp(view.y ?? 0.5,visY)),z:round(z)};
  }

  function editView(item,{title = 'Chỉnh vùng nhìn'} = {}) {
    return new Promise(async (resolve,reject) => {
      let url;
      try { url = await assetUrl(item.full || item.thumb); } catch (error) { reject(error); return; }
      const dialog = document.createElement('dialog');
      dialog.className = 'shell-dialog asset-view-dialog';
      dialog.innerHTML = '<h2>' + esc(title) + '</h2><p>Kéo ảnh để chọn vùng hiển thị trong ô vuông, cuộn chuột hoặc kéo thanh để phóng to. Ảnh gốc không bị cắt.</p>' +
        '<div class="asset-view-stage" tabindex="0" aria-label="Vùng nhìn ảnh, dùng phím mũi tên để di chuyển"><img alt="" draggable="false"></div>' +
        '<label class="asset-view-zoom">Phóng to <input type="range" min="1" max="4" step="0.01"></label>' +
        '<div class="toolbar"><button type="button" data-view="reset">Đặt lại</button><span></span>' +
        '<button type="button" data-view="cancel">Huỷ</button><button type="button" class="primary" data-view="save">Lưu vùng nhìn</button></div>';
      document.body.append(dialog);
      const stage = dialog.querySelector('.asset-view-stage'), img = stage.querySelector('img'), zoom = dialog.querySelector('input[type=range]');
      let ratio = 1, view = {x:item.view?.x ?? 0.5,y:item.view?.y ?? 0.5,z:item.view?.z ?? 1}, result = null;
      img.src = url;
      try { await img.decode(); } catch { /* Ảnh vẫn hiển thị sau khi tải xong. */ }
      ratio = (img.naturalWidth || 1)/(img.naturalHeight || 1);
      img.dataset.imageAxis = ratio >= 1 ? 'wide' : 'tall';
      function paint() {
        view = clampView(view,ratio);
        img.style.transform = viewCss(view) || 'none';
        zoom.value = view.z;
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
        const step = {ArrowLeft:[-0.02,0],ArrowRight:[0.02,0],ArrowUp:[0,-0.02],ArrowDown:[0,0.02]}[event.key];
        if (!step) return;
        event.preventDefault();
        view = {...view,x:view.x+step[0],y:view.y+step[1]};
        paint();
      };
      zoom.oninput = () => { view = {...view,z:Number(zoom.value)}; paint(); };
      dialog.onclick = event => {
        const command = event.target.closest('[data-view]')?.dataset.view;
        if (event.target === dialog || command === 'cancel') dialog.close();
        if (command === 'reset') { view = {x:0.5,y:0.5,z:1}; paint(); }
        if (command === 'save') {
          result = view.x === 0.5 && view.y === 0.5 && view.z === 1 ? undefined : view;
          dialog.close('save');
        }
      };
      dialog.onclose = () => { dialog.remove(); resolve(dialog.returnValue === 'save' ? (result || {x:0.5,y:0.5,z:1}) : null); };
      paint();
      dialog.showModal();
      stage.focus();
    });
  }

  // ---------------------------------------------------------------- Giao diện chung
  const facetLabels = {subgroup:'Nhóm phụ kiện',cabinetWidth:'Rộng tủ',size:'Kích thước',brand:'Thương hiệu',suppliers:'Đơn vị cung cấp',material:'Loại vật liệu',finish:'Bề mặt',tone:'Tông màu',grain:'Vân',collection:'Bộ sưu tập',tags:'Tag'};
  const facetValues = (item,key) => [item[key]].flat().filter(Boolean).map(String);
  const matchFacets = (item,facets,except) => Object.entries(facets).every(([key,values]) =>
    key === except || !values.size || facetValues(item,key).some(value => values.has(value)));
  function facetMarkup(items,facets) {
    return '<div class="asset-facets">' + Object.entries(facetLabels).map(([key,label]) => {
      const counts = new Map();
      for (const item of items.filter(item => matchFacets(item,facets,key))) {
        for (const value of facetValues(item,key)) counts.set(value,(counts.get(value) || 0)+1);
      }
      for (const value of facets[key] || []) if (!counts.has(value)) counts.set(value,0);
      if (!counts.size) return '';
      return '<div><strong>' + label + '</strong> ' + [...counts].map(([value,count]) =>
        '<button type="button" data-facet="' + key + '" data-value="' + esc(value) + '" aria-pressed="' +
        !!facets[key]?.has(value) + '">' + esc(key === 'size' ? value.replace('x','×') : key === 'cabinetWidth' ? 'Tủ '+value : value) + ' (' + count + ')</button>').join(' ') + '</div>';
    }).join('') + '</div>';
  }
  function wireFacets(root,facets,paint) {
    root.querySelectorAll('[data-facet]').forEach(button => button.onclick = () => {
      const values = facets[button.dataset.facet] ||= new Set();
      const value = button.dataset.value;
      if (values.has(value)) values.delete(value);
      else values.add(value);
      paint();
    });
  }
  function grid(items,{selectable = true,removable = false,selected = null,empty = 'Chưa có ảnh.'} = {}) {
    if (!items.length) return '<p class="asset-empty">' + esc(empty) + '</p>';
    return '<div class="asset-grid">' + items.map(item => '<figure class="asset-card" data-asset-id="' + esc(item.id) + '"' + (selected ? ' draggable="true"' : '') + '>' +
      (selected ? '<label class="asset-card-check"><input type="checkbox" data-bulk-select aria-label="Chọn ' + esc(item.name || item.code) + '"' + (selected.has(item.id) ? ' checked' : '') + '></label>' : '') +
      '<button type="button" class="asset-thumb"' + (selectable ? ' data-asset-pick' : ' data-asset-open') + ' title="' + esc(item.name || item.room || '') + '">' +
      (item.kind === 'paint' ? '<span class="asset-paint-swatch" style="background-color:' + esc(item.hex) + '"></span>' : item.thumb ? '<img data-lib-asset="' + esc(item.thumb) + '" alt="' + esc(item.name || 'Ảnh') + '">' : '<span>' + esc(item.code || '') + '</span>') + '</button>' +
      (item.size || item.brand ? '<span class="asset-card-badge">' + esc([item.size?.replace('x','×'),item.brand].filter(Boolean).join(' · ')) + '</span>' : '') +
      '<figcaption>' + esc(item.page ? 'Trang ' + item.page + (item.room && item.room !== 'Cả nhà' ? ' · ' + item.room : '') : ([item.code,item.name || item.room,item.collection,item.finish,item.spec,item.cabinetWidth && 'Tủ '+item.cabinetWidth,item.subgroup].filter(Boolean).join(' · '))) + '</figcaption>' +
      (removable && item.full ? '<button type="button" data-asset-square aria-pressed="' + !!item.square + '">' + (item.square ? 'Dùng ảnh gốc' : 'Lấp đầy ô vuông') + '</button>' : '') +
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
  function popover(anchor,build) {
    closePicker();
    const panel = document.createElement('div');
    const lifetime = new AbortController();
    panel.className = 'asset-popover';
    panel.setAttribute('role','dialog');
    document.body.append(panel);
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const width = Math.min(560,innerWidth-16);
      panel.style.width = width + 'px';
      const below = innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const direction = below >= 420 ? 'below' : above >= 420 ? 'above' : 'center';
      const limit = Math.min(560,innerHeight*.8,direction === 'below' ? below : direction === 'above' ? above : innerHeight-16);
      const left = direction === 'center' ? (innerWidth-width)/2 : Math.min(innerWidth-width-8,Math.max(8,rect.left));
      panel.dataset.direction = direction;
      panel.style.left = left + 'px';
      panel.style.top = direction === 'below' ? rect.bottom+4+'px' : direction === 'center' ? (innerHeight-limit)/2+'px' : '';
      panel.style.bottom = direction === 'above' ? innerHeight-rect.top+4+'px' : '';
      panel.style.height = limit + 'px';
      panel.style.maxHeight = limit + 'px';
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
      async function paint() {
        try { data = await loadLibrary(); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        if (!panel.isConnected) return;
        categoryId ||= categoryFor(data,groupName)?.id || 'all';
        const candidates = data.items.filter(item => !item.hidden && (item.full || item.kind === 'paint' || item.kind === 'wood') && (categoryId === 'all' || item.categoryId === categoryId) &&
          (!query || fold(item.name).includes(fold(query)))).sort((a,b) => (b.used || 0)-(a.used || 0));
        const items = candidates.filter(item => matchFacets(item,facets));
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters"><select aria-label="Hạng mục"><option value="all">Tất cả hạng mục</option>' +
          data.categories.map(c => '<option value="' + esc(c.id) + '"' + (c.id === categoryId ? ' selected' : '') + '>' + esc(c.name) +
            ' (' + data.items.filter(item => item.categoryId === c.id).length + ')</option>').join('') + '</select>' +
          '<input type="search" placeholder="Tìm theo tên / mã" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' + facetMarkup(candidates,facets) + (items.length ? grid(items,{empty:'Hạng mục này chưa có ảnh. Bấm "Tải lên" để thêm ảnh mẫu dùng chung.'}) : '<p class="asset-empty">Không tìm thấy ảnh' + (query ? ' cho "' + esc(query) + '"' : '') + '. Bấm "Tải lên" để thêm ảnh mẫu dùng chung.</p>') + onlineSlot + '</div>' +
          '<footer><button type="button" data-upload>⬆ Tải lên hạng mục này</button><button type="button" data-full>Quản lý dữ liệu</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        wireFacets(panel,facets,paint);
        panel.querySelector('select').onchange = event => { categoryId = event.target.value; paint(); };
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
    const category = categoryId || categoryFor(data,groupName)?.id;
    return data.items.filter(item => item.full && item.kind === 'image' && !item.hidden && item.categoryId === category && fold(item.name).includes(fold(query)));
  }
  function wireLocalAssetPhotos(panel,items,onPick) {
    panel.querySelectorAll('.asset-specialized-photos [data-asset-pick]').forEach(button => {
      button.onclick = () => onPick(items.find(item => item.id === button.closest('[data-asset-id]').dataset.assetId));
    });
    hydrate(panel);
  }
  const localAssetPhotos = items => items.length ? '<div class="asset-specialized-photos">' + grid(items) + '</div>' : '';

  async function loadPaintData(brand = 'Dulux') {
    const data = await loadLibrary();
    const colors = data.items.filter(item => item.kind === 'paint' && !item.hidden);
    return {source:'Dữ liệu dùng chung',brands:[...new Set(['Dulux','Jotun',...colors.map(item => item.brand)])],
      colors:colors.filter(item => item.brand === brand)};


  }

  function pickPaint(anchor, { groupName, onPick, title = 'Chọn màu sơn' } = {}) {
    return popover(anchor, async (panel, close, place, signal) => {
      const facets = {};
      let brand = 'Dulux', query = '', paintData = null;
      async function paint() {
        try { paintData = await loadPaintData(brand); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        const photos = await findLocalAssetPhotos(query,null,groupName);
        if (!panel.isConnected) return;
        const candidates = (paintData.colors || []).filter(c => !query || fold(c.code).includes(fold(query)) || fold(c.name).includes(fold(query)));
        const colors = candidates.filter(item => matchFacets(item,facets));
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters">' +
          '<select aria-label="Hãng sơn">' + paintData.brands.map(name => '<option value="' + esc(name) + '"' +
            (brand === name ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select>' +
          '<input type="search" placeholder="Tìm theo mã hoặc tên màu (vd: 30YY, 9918, White...)" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' + facetMarkup([...candidates,...photos],facets) +
          (colors.length ? '<div class="asset-paint-grid">' + colors.map(c => '<button type="button" class="asset-paint-card" data-paint-code="' + esc(c.code) + '" title="' + esc(c.code + ' – ' + c.name) + '">' +
            '<div class="asset-paint-swatch" style="background-color:' + esc(c.hex) + '"></div>' +
            '<div class="asset-paint-info"><strong>' + esc(c.code) + '</strong><span>' + esc(c.name) + '</span></div></button>').join('') + '</div>' :
            '<p class="asset-empty">Chưa có "' + esc(query) + '" trong bảng màu mẫu.</p>' +
            '<form class="asset-paint-custom"><strong>Dùng mã này</strong><label>Mã <input name="code" required value="' + esc(query) + '"></label>' +
            '<label>Tên màu <input name="name" placeholder="vd Ivory Lace"></label><label>Màu <input name="hex" type="color" value="#f2eee6"></label>' +
            '<button class="primary">Dùng màu ' + esc(brand) + ' này</button><small class="asset-hint">Xem mã trên quạt màu hoặc web hãng rồi chọn màu gần đúng. Lần sau sẽ có sẵn trong Dữ liệu dùng chung.</small></form>') + localAssetPhotos(photos.filter(item => matchFacets(item,facets))) + onlineSlot +
          '</div>' +
          '<footer><small class="asset-hint">Nguồn: ' + esc(paintData.source || '') + ' (' + colors.length + ' màu)</small><button type="button" data-close>Đóng</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        panel.querySelector('[data-close]').onclick = close;
        panel.querySelector('select').onchange = event => { brand = event.target.value; paint(); };
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
    return {woods:library.items.filter(item => item.kind === 'wood' && !item.hidden).map(withWoodBrand),source:'Dữ liệu dùng chung'};
  }

  const withWoodBrand = item => ({...item,brand:item.brand || 'An Cường'});
  function pickWood(anchor, { groupName, onPick, title = 'Mã gỗ' } = {}) {
    return popover(anchor, async (panel, close, place, signal) => {
      const facets = {};
      let brand = '', collection = 'all', query = '', woodData = null;
      async function paint() {
        try { woodData = await loadWoodData(); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        const photos = await findLocalAssetPhotos(query,'ancuong-wood',groupName);
        if (!panel.isConnected) return;
        const brands = [...new Set(woodData.woods.map(wood => wood.brand))];
        const byBrand = woodData.woods.filter(wood => !brand || brand === wood.brand);
        const collections = [...new Set(byBrand.map(wood => wood.collection).filter(Boolean))];
        const candidates = byBrand.filter(w => (collection === 'all' || w.collection === collection) &&
          (!query || fold(w.code).includes(fold(query)) || fold(w.name).includes(fold(query)) || fold(w.collection).includes(fold(query))));
        const woods = candidates.filter(item => matchFacets(item,facets));
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters">' +
          '<select aria-label="Hãng"><option value="">Tất cả hãng</option>' +
          brands.map(name => '<option value="' + esc(name) + '"' + (name === brand ? ' selected' : '') + '>' + esc(name) + '</option>').join('') + '</select>' +
          '<select aria-label="Dòng sản phẩm"><option value="all">Tất cả dòng sản phẩm</option>' +
          collections.map(col => '<option value="' + esc(col) + '"' + (col === collection ? ' selected' : '') + '>' + esc(col) + '</option>').join('') + '</select>' +
          '<input type="search" placeholder="Tìm theo mã, tên hoặc catalogue" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' + facetMarkup([...candidates,...photos],facets) +
          (woods.length ? '<div class="asset-wood-grid">' + woods.map((w,index) => '<button type="button" data-wood-index="' + index + '" class="asset-wood-card" data-wood-code="' + esc(w.code) + '" title="' + esc(w.code + ' – ' + w.name) + '">' +
            (w.thumb ? '<img data-lib-asset="' + esc(w.thumb) + '" alt="">' : '') + '<strong>' + esc(w.code) + '</strong><span class="wood-name">' + esc(w.name) + '</span>' +
            '<span class="wood-badge">' + esc([w.brand,w.collection].filter(Boolean).join(' · ')) + '</span></button>').join('') + '</div>' :
            '<p class="asset-empty">Không tìm thấy mã gỗ phù hợp với "' + esc(query) + '".</p>') + localAssetPhotos(photos.filter(item => matchFacets(item,facets))) + onlineSlot +
          '</div>' +
          '<footer><small class="asset-hint">Nguồn: ' + esc(woodData.source || '') + ' (' + woods.length + ' mã)</small><button type="button" data-close>Đóng</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        panel.querySelector('[data-close]').onclick = close;
        panel.querySelector('[aria-label=Hãng]').onchange = event => { brand = event.target.value; collection = 'all'; paint(); };
        panel.querySelector('[aria-label="Dòng sản phẩm"]').onchange = event => { collection = event.target.value; paint(); };
        wireFacets(panel,facets,paint);
        wireAssetSearch(panel,() => query,value => { query = value; },paint);
        panel.querySelectorAll('[data-wood-code]').forEach(button => {
          button.onclick = () => {
            const w = woods[Number(button.dataset.woodIndex)];
            close();
            if (w) { updateItem({id:w.id,used:true}).catch(() => {}); onPick?.({...w,kind:'wood'}); }
          };
        });
        wireLocalAssetPhotos(panel,photos,entry => { close(); onPick?.(entry); });
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

  async function uploadToLibrary(categoryId,files,onStatus = toast,square = false) {
    const images = files.filter(file => file.type?.startsWith('image/'));
    if (!images.length) throw new Error('Chọn file ảnh.');
    const uploaded = [];
    let before = 0, after = 0;
    for (const [index,file] of images.entries()) {
      onStatus?.('Đang nén và tải ' + (index+1) + '/' + images.length + '…');
      const {full,thumb} = await GDHomeImages.compress(file,null,{square});
      before += file.size; after += full.size;
      const fullName = await storeAsset(full);
      const image = {full:fullName,thumb:thumb === full ? fullName : await storeAsset(thumb)};
      const original = square ? await uploadImage(file) : image;
      uploaded.push({full:image.full,thumb:image.thumb,...(square ? {square:true,originalFull:original.full,originalThumb:original.thumb} : {}),name:(file.name || '').replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').slice(0,160)});
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
  function reviewFolders(categoryId,files,square = false) {
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
              const image = square ? await uploadImage(file,{square:true}) : original;
              controller.signal.throwIfAborted();
              seen.add(original.full);
              await addItems(categoryId,[{...image,name:file.name.replace(/\.[^.]+$/,''),tags,
                ...(square ? {square:true,originalFull:original.full,originalThumb:original.thumb} : {})}]);
            }
            status.textContent = 'Đã xử lý ' + (++done) + '/' + images + ' ảnh';
          }
        }
        if (pdfs.length) {
          dialog.close();
          const next = () => {
            const pdf = pdfs.shift();
            if (pdf) openWoodCatalogue(categoryId,null,{...pdf,onClose:next});
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

  async function anCuongSwatches(context,canvas,labels) {
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
      return [{box,label:anCuongLabel(text,name)}];
    });
    const ratios = candidates.map(({box}) => box.h/box.w).sort((a,b) => a-b);
    const ratio = (ratios[Math.floor((ratios.length-1)/2)]+ratios[Math.floor(ratios.length/2)])/2;
    return candidates.map(({box,label}) => {
      // Center a common-aspect crop inside the detected bounds to avoid the white border.
      const w = Math.min(box.w-2,(box.h-2)/ratio), h = w*ratio;
      return {...label,qr:true,tone:box.tone,grain:'Gỗ',crop:{x:(box.x+(box.w-w)/2)/width,y:(box.y+(box.h-h)/2)/height,w:w/width,h:h/height}};
    });
  }

  const kitchenSubgroups = ['Giá bát đĩa nâng hạ','Giá bát đĩa','Giá xoong nồi','Giá dao thớt gia vị','Thùng gạo','Thùng rác',
    'Tủ đồ khô','Góc liên hoàn','Ray / bản lề','Tay nâng'];
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

  async function scanWoodCatalogue(file,patterns,direction,onPage,{useAi,signal,onWarning,layout} = {}) {
    const regexes = patterns.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => new RegExp(line,'i'));
    if (!regexes.length) throw new Error('Nhập ít nhất một mẫu nhận diện mã.');
    const pdfjs = await loadPdfJs();
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    const pdf = await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
    let results = [];
    const sources = new Map(), batch = [];
    async function flush() {
      if (!batch.length) return;
      const pages = batch.splice(0);
      try {
        const ai = await GDHomeAI.startJob({kind:'catalogue',pages},{signal});
        for (const item of ai.items || []) {
          const source = sources.get(item.page);
          if (!source) continue;
          if (layout === 'ancuong') {
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
          const record = {...item,source,crop:item.bbox,confidence:match ? Math.max(.85,item.confidence) : item.confidence};
          if (['phao','kitchen'].includes(layout)) {
            if (match) {
              const detected = results[index];
              results[index] = {...record,...detected,grain:item.grain || detected.grain};
            }
            continue;
          }
          if (match) results[index] = record;
          else results.push(record);
        }
      } catch (error) {
        signal?.throwIfAborted();
        useAi = false;
        onWarning?.(error.message);
      }
    }
    try {
      for (let number = 1; number <= pdf.numPages; number++) {
        signal?.throwIfAborted();
        onPage(number,pdf.numPages);
        const page = await pdf.getPage(number);
        const base = page.getViewport({scale:1});
        const scale = Math.min(3,1600/Math.max(base.width,base.height));
        const viewport = page.getViewport({scale});
        const {items} = await page.getTextContent();
        const labels = items.filter(item => item.str?.trim()).map(item => {
          const [x,y] = viewport.convertToViewportPoint(item.transform[4],item.transform[5]);
          return {text:item.str.trim(),x,y,width:item.width*scale,height:Math.max(1,item.height*scale)};
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
        if (layout !== 'ancuong' && !matches.length && !useAi) { page.cleanup(); continue; }
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        await page.render({canvasContext:context,viewport}).promise;
        signal?.throwIfAborted();
        const swatches = layout === 'ancuong' ? await anCuongSwatches(context,canvas,labels) : [];
        if (results.length + matches.length + swatches.length > 5000) throw new Error('Catalogue vượt 5.000 mã. Hãy chia PDF thành nhiều lượt.');
        if (layout === 'ancuong' && !swatches.length) {
          canvas.width = canvas.height = 0;
          page.cleanup();
          continue;
        }
        // Save page as a compressed image and keep only the swatch canvases live.
        const source = URL.createObjectURL(await new Promise(resolve => canvas.toBlob(resolve,'image/webp',.94)));
        sources.set(number,source);
        if (useAi && (layout !== 'ancuong' || !labels.length)) batch.push({number,image:canvas.toDataURL('image/jpeg',.7),
          text:labels.slice(0,500).map(({text,x,y,width,height}) => ({text,x:x/canvas.width,y:y/canvas.height,w:width/canvas.width,h:height/canvas.height}))});
        for (const swatch of swatches) results.push({...swatch,page:number,source});
        if (layout === 'kitchen') {
          const first = matches[0];
          if (first) {
            const tableTop = labels.filter(label => label.y < first.y && label.y >= first.y-first.height*12 &&
              /quy cach|don gia|ma dat hang|kich thuoc tu/.test(fold(label.text)))
              .reduce((top,label) => Math.min(top,label.y-label.height*1.2),first.y-first.height*2);
            const crop = {x:0,y:0,w:1,h:bounded(tableTop/canvas.height,.05,1)};
            for (const {y,height,...row} of matches) results.push({...row,page:number,source,crop,confidence:.9});
          }
          canvas.width = canvas.height = 0;
          page.cleanup();
          if (batch.length === 4 || number === pdf.numPages) await flush();
          continue;
        }
        const nearest = (values,fallback) => values.length ? Math.min(...values) : fallback;
        for (const label of matches) {
          const dx = nearest(matches.filter(o => Math.abs(o.y-label.y) < label.height && Math.abs(o.x-label.x) > label.height*2)
            .map(o => Math.abs(o.x-label.x)),canvas.width/Math.max(1,new Set(matches.map(m => Math.round(m.x/label.height))).size));
          const dy = nearest(matches.filter(o => Math.abs(o.y-label.y) > label.height*2)
            .map(o => Math.abs(o.y-label.y)),canvas.height*.35);
          const w = Math.min(canvas.width, direction === 'left' ? dx*.58 : dx*.72);
          const h = Math.min(canvas.height,dy*.66);
          const x = bounded(direction === 'left' ? label.x-w-label.height*.4 : label.x-dx*.06,0,canvas.width-w);
          const y = bounded(direction === 'left' ? label.y-h*.55 : label.y-h-label.height*1.2,0,canvas.height-h);
          if (layout === 'phao') {
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
            results.push({code:label.code,name:label.name,size,page:number,source,confidence:.85,
              crop:{x:left/canvas.width,y:top/canvas.height,w:(right-left)/canvas.width,h:(bottom-top)/canvas.height}});
            continue;
          }
          results.push({code:label.code,name:label.name,page:number,source,confidence:.6,
            crop:{x:x/canvas.width,y:y/canvas.height,w:w/canvas.width,h:h/canvas.height}});
        }
        canvas.width = canvas.height = 0;
        page.cleanup();
        if (batch.length === 4 || number === pdf.numPages) await flush();
      }
      await flush();
      const retained = new Set(results.map(item => item.source));
      for (const source of sources.values()) if (!retained.has(source)) URL.revokeObjectURL(source);
    } catch (error) {
      for (const source of sources.values()) URL.revokeObjectURL(source);
      throw error;
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
      '<button type="button" role="tab" data-catalogue-tab="web" aria-selected="false">Từ link website</button></div><form class="wood-catalogue-controls">' +
      '<label>Hạng mục <select name="category">' + library.categories.map(category => '<option value="' + esc(category.id) + '"' +
        (category.id === categoryId ? ' selected' : '') + '>' + esc(category.name) + '</option>').join('') + '</select></label>' +
      '<label>Đơn vị cung cấp <input name="suppliers" list="catalogue-suppliers" placeholder="Tên cách nhau bằng dấu phẩy"></label>' +
      '<datalist id="catalogue-suppliers">' + (library.suppliers || []).map(item => '<option>' + esc(item.name) + '</option>').join('') + '</datalist>' +
      ((library.suppliers || []).length ? '<label>Chọn nhiều đơn vị <select name="supplierChoices" multiple>' +
        library.suppliers.map(item => '<option>' + esc(item.name) + '</option>').join('') + '</select></label>' : '') +
      '<label>Tag <input name="tags" placeholder="Cách nhau bằng dấu phẩy"></label>' +
      '<label><input type="checkbox" name="useAi"' + (categoryId !== 'ancuong-wood' && window.GDHomeAI ? ' checked' : '') + '> Dùng AI để đọc PDF</label>' +
      '<label data-catalogue-pdf>Catalogue PDF <input name="pdf" type="file" accept="application/pdf,.pdf" required></label>' +
      '<label data-catalogue-web hidden>Link website <textarea name="urls" rows="3" placeholder="Một URL mỗi dòng"></textarea></label>' +
      '<label>Bố cục <select name="layout"><option value="generic">Tự động / lưới</option><option value="ancuong">An Cường</option><option value="phao">Phào chỉ</option><option value="kitchen">Phụ kiện bếp · ảnh và bảng mã</option></select></label>' +
      '<label><input type="checkbox" name="square"> Lấp đầy ô vuông</label>' +
      '<label>Vị trí ảnh so với mã <select name="direction"><option value="above">Phía trên</option><option value="left">Bên trái</option></select></label>' +
      '<label>Hãng <input name="brand" list="wood-brands" value="' + (categoryId === 'ancuong-wood' ? 'An Cường' : '') + '" maxlength="80"></label>' +
      '<datalist id="wood-brands">' + ['An Cường','Minh Long','Thái Dương','Mộc Phát','Ba Thanh','Vanachai','EGGER','Khác'].map(name => '<option>' + name + '</option>').join('') + '</datalist>' +
      '<label>Catalogue <input name="collection" list="wood-catalogues" maxlength="120" placeholder="VD: Melamine/MFC"></label>' +
      '<datalist id="wood-catalogues"><option>Melamine/MFC</option><option>Laminate</option><option>Acrylic</option><option>Veneer</option></datalist>' +
      '<label>Bề mặt <input name="finish" maxlength="120" placeholder="VD: Mờ"></label>' +
      '<details><summary>Mẫu mã (regex)</summary><label>Mỗi dòng một mẫu<textarea name="patterns" rows="4" maxlength="1000">' +
      esc(woodPatterns.join('\n')) + '</textarea></label></details>' +
      '<button type="submit">Đọc PDF</button><button type="button" data-catalogue-cancel>Huỷ xử lý</button><button type="button" data-save-wood disabled>Lưu mã đã chọn</button></form>' +
      '<p role="status"></p><div class="wood-catalogue-results"></div>';
    const form = body.querySelector('form');
    if (preset.file) { const transfer = new DataTransfer(); transfer.items.add(preset.file); form.elements.pdf.files = transfer.files; }
    if (preset.tags) form.elements.tags.value = preset.tags.join(', ');
    if (categoryId === 'kitchen-accessories') form.elements.layout.value = 'kitchen';
    form.elements.layout.onchange = () => { if (form.elements.layout.value === 'phao') form.elements.square.checked = true; };
    const status = body.querySelector('[role=status]');
    const list = body.querySelector('.wood-catalogue-results'), save = body.querySelector('[data-save-wood]');
    const read = form.querySelector('[type=submit]');
    let items = [], mode = 'pdf';
    for (const tab of body.querySelectorAll('[data-catalogue-tab]')) tab.onclick = () => {
      if (busy) return;
      mode = tab.dataset.catalogueTab;
      for (const button of body.querySelectorAll('[data-catalogue-tab]')) button.setAttribute('aria-selected',String(tab === button));
      form.querySelector('[data-catalogue-web]').hidden = mode !== 'web';
      form.querySelector('[data-catalogue-pdf]').hidden = mode !== 'pdf';
      form.elements.pdf.required = mode === 'pdf';
      form.elements.urls.required = mode === 'web';
      read.textContent = mode === 'web' ? 'Đọc website' : 'Đọc PDF';
      save.disabled = true;
      list.replaceChildren();
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
      busy = read.disabled = save.disabled = true;
      controller = new AbortController();
      list.replaceChildren();
      for (const source of sources) URL.revokeObjectURL(source);
      sources.clear();
      try {
        let warning = '';
        if (mode === 'web') {
          const urls = form.elements.urls.value.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
          status.textContent = 'Đang đọc website…';
          const result = await api('/api/catalogue/web',{method:'POST',signal:controller.signal,body:JSON.stringify({urls,useAi:form.elements.useAi.checked})});
          items = [];
          const failures = [...(result.warnings || [])];
          for (const [index,product] of (result.items || []).slice(0,60).entries()) {
            controller.signal.throwIfAborted();
            if (index) await new Promise(resolve => setTimeout(resolve,350));
            controller.signal.throwIfAborted();
            status.textContent = 'Đang tải ảnh ' + (index+1) + '/' + result.items.length + '…';
            try {
              const response = await fetch('/api/catalogue/image',{method:'POST',signal:controller.signal,
                headers:{...hooks.headers(),'Content-Type':'application/json'},body:JSON.stringify({url:product.image})});
              if (!response.ok) throw new Error((await response.json().catch(() => ({}))).message || 'Không tải được ảnh.');
              const source = URL.createObjectURL(await response.blob());
              sources.add(source);
              items.push({...product,source,crop:{x:0,y:0,w:1,h:1},confidence:.7,web:true});
            } catch (error) {
              controller.signal.throwIfAborted();
              failures.push(error.message);
            }
          }
          if (failures.length) toast(failures.join(' · '));
        } else {
          items = await scanWoodCatalogue(form.elements.pdf.files[0],form.elements.patterns.value,form.elements.direction.value,
            (page,total) => { status.textContent = 'Đang đọc trang ' + page + '/' + total + '…'; },
            {useAi:form.elements.useAi.checked && !!window.GDHomeAI,signal:controller.signal,layout:form.elements.layout.value,onWarning:message => { warning = message; }});
        }
        if (warning) toast('Dùng mẫu mã vì AI không đọc được: ' + warning);
        for (const item of items) sources.add(item.source);
        status.textContent = items.length ? 'Nhận diện ' + items.length + ' mẫu. Kiểm tra và chỉnh ảnh trước khi lưu.' : 'Không tìm thấy mẫu có ảnh.';
        list.innerHTML = items.map(item => '<article class="wood-catalogue-card">' +
          '<canvas aria-label="Ảnh swatch"></canvas><small>' + (item.web ? 'Website' : 'Trang ' + item.page) + ' · ' + Math.round(item.confidence*100) + '%</small>' +
          '<label><input type="checkbox" data-wood-include' + (item.needsReview ? '> Cần kiểm tra' : ' checked> Lưu mã này') + '</label>' +
          '<label>Mã <input data-wood-code-input maxlength="80" value="' + esc(item.code) + '"></label>' +
          '<label>Tên <input data-wood-name-input maxlength="160" value="' + esc(item.name) + '"></label>' +
          (item.web ? '<label>Đơn vị cung cấp <input data-catalogue-supplier value="' + esc(item.supplier) + '"></label><label>Hãng <input data-catalogue-brand value="' + esc(item.brand) + '"></label>' : '') +
          (form.elements.layout.value === 'kitchen' ? '<datalist id="catalogue-kitchen-' + esc(item.code) + '">' +
            kitchenSubgroups.map(name => '<option>' + esc(name) + '</option>').join('') + '</datalist>' +
            ['spec','cabinetWidth','innerWidth','unit','price','subgroup'].map(key => '<label>' +
              ({spec:'Quy cách R*S*C',cabinetWidth:'Rộng tủ',innerWidth:'Lọt lòng',unit:'Đơn vị',price:'Đơn giá nội bộ',subgroup:'Nhóm phụ kiện'})[key] +
              '<input data-catalogue-field="' + key + '"' + (key === 'subgroup' ? ' list="catalogue-kitchen-' + esc(item.code) + '"' : '') +
              ' value="' + esc(item[key]) + '"></label>').join('') : '') +
          ['size','finish','collection','material','tone','grain'].map(key => '<label>' + ({size:'Kích thước',finish:'Bề mặt',collection:'Catalogue',material:'Loại vật liệu',tone:'Tông màu',grain:'Vân'})[key] +
            '<input data-catalogue-field="' + key + '" value="' + esc(item[key]) + '"></label>').join('') +
          '<button type="button" data-catalogue-merge>Gộp mã trùng</button><button type="button" data-edit-wood-crop>Chỉnh khung cắt</button></article>').join('');
        const cards = [...list.children];
        let lastSource, image;
        for (const [i,item] of items.entries()) {
          if (!dialog.isConnected) return;
          if (lastSource !== item.source) { image = await loadPageImage(item.source); lastSource = item.source; }
          const canvas = cards[i].querySelector('canvas');
          drawSwatch(canvas,image,item.crop);
          cards[i].querySelector('[data-catalogue-merge]').onclick = () => {
            const code = cards[i].querySelector('[data-wood-code-input]').value.trim().toUpperCase();
            const duplicate = cards.find((card,index) => index !== i && card.querySelector('[data-wood-include]').checked &&
              card.querySelector('[data-wood-code-input]').value.trim().toUpperCase() === code);
            if (!duplicate) return toast('Không có thẻ đang chọn cùng mã.');
            for (const field of cards[i].querySelectorAll('[data-catalogue-field]')) {
              if (!field.value) field.value = duplicate.querySelector('[data-catalogue-field="' + field.dataset.catalogueField + '"]').value;
            }
            duplicate.querySelector('[data-wood-include]').checked = false;
          };
          cards[i].querySelector('[data-edit-wood-crop]').onclick = async () => {
            const image = await loadPageImage(item.source);
            editWoodCrop(image,item.crop,crop => { item.crop = crop; drawSwatch(canvas,image,crop); });
          };
        }
        save.disabled = !items.length;
      } catch (error) { status.textContent = error.message; }
      finally {
        busy = read.disabled = false;
        if (!dialog.open) GDHomeShell.aiNotice('asset-catalogue-job',{state:'done',body:esc(status.textContent),label:'Mở kết quả',onAction:() => dialog.showModal()});
      }
    };
    save.onclick = async () => {
      if (busy || !form.reportValidity()) return;
      const categoryId = form.elements.category.value;
      const listValues = value => value.split(',').map(part => part.trim()).filter(Boolean);
      const suppliers = [...listValues(form.elements.suppliers.value),...Array.from(form.elements.supplierChoices?.selectedOptions || [],option => option.value)];
      const tags = listValues(form.elements.tags.value);
      const brand = form.elements.brand.value.trim();
      const collection = form.elements.collection.value.trim(), finish = form.elements.finish.value.trim();
      if (mode === 'pdf' && (!brand || !collection)) { status.textContent = 'Nhập hãng và tên catalogue.'; return; }
      const selected = [...list.children].flatMap(card => {
        const code = card.querySelector('[data-wood-code-input]').value.trim();
        return card.querySelector('[data-wood-include]').checked && (code || mode === 'web') ?
          [{card,code,name:card.querySelector('[data-wood-name-input]').value.trim()}] : [];
      });
      if (!selected.length) { status.textContent = 'Chọn ít nhất một thẻ có mã.'; return; }
      busy = read.disabled = save.disabled = true;
      let added = 0, skipped = 0, batch = [];
      const savedCrops = new Map();
      try {
        const data = await loadLibrary();
        const existing = new Map(data.items.filter(item => item.code && item.full).map(item => [catalogueKey(item),item]));
        const flush = async () => {
          if (!batch.length) return;
          const result = await addItems(categoryId,batch);
          added += result.added.length;
          skipped += result.skipped || 0;
          batch = [];
        };
        for (const {card,code,name} of selected) {
          if (!dialog.open) break;
          const item = items[[...list.children].indexOf(card)];
          const itemBrand = card.querySelector('[data-catalogue-brand]')?.value.trim() || brand || (categoryId === 'ancuong-wood' ? 'An Cường' : '');
          const itemSuppliers = [...new Set([...suppliers,...listValues(card.querySelector('[data-catalogue-supplier]')?.value || '')])];
          const key = code ? catalogueKey({brand:itemBrand,code}) : item.source;
          const previous = existing.get(key);
          if (previous && !itemSuppliers.some(value => !previous.suppliers?.includes(value)) && !tags.some(value => !previous.tags?.includes(value))) {
            skipped++; continue;
          }
          status.textContent = 'Đang lưu ' + code + '…';
          const crop = item.crop;
          const cropKey = JSON.stringify([item.source,crop,form.elements.square.checked]);
          const image = previous || savedCrops.get(cropKey) || await (async () => {
            const source = await fetch(item.source).then(response => response.blob());
            const bounds = [crop.x,crop.y,crop.x+crop.w,crop.y+crop.h];
            async function saveCrop(square) {
              const {full,thumb} = await GDHomeImages.compress(source,bounds,{square});
              const key = await storeAsset(full);
              return {full:key,thumb:thumb === full ? key : await storeAsset(thumb)};
            }
            const original = await saveCrop(false);
            if (!form.elements.square.checked) return original;
            return {...await saveCrop(true),square:true,originalFull:original.full,originalThumb:original.thumb};
          })();
          savedCrops.set(cropKey,image);
          const fields = Object.fromEntries([...card.querySelectorAll('[data-catalogue-field]')].filter(field => field.value.trim())
            .map(field => [field.dataset.catalogueField,field.value.trim()]));
          if (form.elements.layout.value === 'phao' && fields.size && !/mm|cm/i.test(fields.size)) fields.size += ' mm';
          const record = {full:image.full,thumb:image.thumb,square:image.square,originalFull:image.originalFull,originalThumb:image.originalThumb,code,name,brand:itemBrand,collection,finish,suppliers:itemSuppliers,tags,
            kind:categoryId === 'ancuong-wood' && code ? 'wood' : 'image',...fields};
          existing.set(key,record);
          batch.push(record);
          if (batch.length === 50) await flush();
        }
        await flush();
        status.textContent = 'Đã lưu ' + added + ' mã · bỏ qua ' + skipped + ' mã trùng.';
        onSaved?.();
      } catch (error) { status.textContent = (added ? 'Đã lưu ' + added + ' mã. ' : '') + error.message; }
      finally { busy = read.disabled = save.disabled = false; }
    };
  }

  function editWoodCrop(image,current,onSave) {
    const {dialog,body} = modal('wood-crop-dialog','Chỉnh khung cắt swatch');
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

  function openLibrary({groupName,categoryId,onPick} = {}) {
    const {dialog,body} = modal('asset-library-dialog','📚 Dữ liệu dùng chung');
    let current = categoryId || null, query = '', status = '';
    let squareUploads = false;
    const facets = {}, selected = new Set();
    let rangeAnchor, dragged, undoToken, guestUndo;
    async function bulk(patch) {
      const result = await libraryCall('items/bulk',patch,data => {
        if (patch.undo && guestUndo) { data.items = guestUndo; guestUndo = null; return {}; }
        guestUndo = structuredClone(data.items);
        const ids = new Set(patch.ids);
        if (patch.delete) data.items = data.items.filter(item => !ids.has(item.id));
        for (const item of data.items.filter(item => ids.has(item.id))) {
          Object.assign(item,patch.set || {});
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
    function bulkControls() {
      if (onPick) return '';
      return '<div class="asset-bulk-controls">' + (selected.size ? '<strong>' + selected.size + ' đã chọn</strong> ' +
        [['addTags','Gắn tag'],['removeTags','Bỏ tag'],['brand','Đặt hãng'],['addSuppliers','Thêm đơn vị cung cấp'],
          ['removeSuppliers','Bỏ đơn vị cung cấp'],['size','Đặt kích thước'],['categoryId','Chuyển hạng mục'],['delete','Xoá đã chọn']]
          .map(([key,label]) => '<button type="button" data-bulk="' + key + '">' + label + '</button>').join(' ') : '') +
        (undoToken ? '<button type="button" data-bulk="undo">Hoàn tác</button>' : '') + '</div>';
    }
    async function paint() {
      let data;
      try { data = await loadLibrary(); } catch (error) { body.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
      current ||= categoryFor(data,groupName)?.id || data.categories[0]?.id || null;
      const category = data.categories.find(c => c.id === current);
      const candidates = data.items.filter(item => item.categoryId === current && (!onPick || !item.hidden) && (!query || fold([item.code,item.name,item.brand,item.collection].join(' ')).includes(fold(query))));
      const items = candidates.filter(item => matchFacets(item,facets)).sort((a,b) => (a.order ?? Infinity)-(b.order ?? Infinity));
      body.innerHTML = '<aside class="asset-categories"><div class="asset-cat-list">' + data.categories.map(c => '<button type="button" draggable="true" data-cat="' + esc(c.id) + '"' +
        (c.id === current ? ' aria-current="true"' : '') + '><span>' + esc(c.name) + '</span><small>' + data.items.filter(item => item.categoryId === c.id).length +
        '</small></button>').join('') + '</div><button type="button" data-cat-add>＋ Thêm hạng mục</button></aside>' +
        '<section class="asset-library-main">' + (category ? '<div class="asset-library-head"><strong>' + esc(category.name) + '</strong>' +
          '<button type="button" data-import-wood>Nhập catalogue</button>' +
          (category.id === 'ancuong-wood' ? '' : '<button type="button" data-cat-rename>Đổi tên</button><button type="button" data-cat-delete>Xoá hạng mục</button>') +
          '<input type="search" placeholder="Tìm theo tên / mã" value="' + esc(query) + '"></div>' +
          '<div class="asset-drop" tabindex="0">⬆ Kéo thả ảnh vào đây, bấm để chọn file, hoặc Ctrl+V để dán · ảnh tự nén WebP 1600 px</div>' +
          '<label><input type="checkbox" data-library-square> Lấp đầy ô vuông khi tải ảnh</label>' +
          '<label>Chọn thư mục <input type="file" webkitdirectory multiple data-folder-input></label>' +
          '<p class="asset-status" role="status">' + esc(status) + '</p>' + facetMarkup(candidates,facets) +
          '<button type="button" data-manage-suppliers>Đơn vị cung cấp</button>' + bulkControls() + grid(items,{selectable:!!onPick,removable:true,selected:onPick ? null : selected,empty:'Chưa có ảnh trong hạng mục này.'}) + onlineSlot : '<p class="asset-empty">Tạo hạng mục để bắt đầu.</p>') +
        (onPick ? '<p class="asset-hint">Bấm vào ảnh để dùng cho ô đang chọn.</p>' : '') + '</section>';
      wireFacets(body,facets,paint);
      body.querySelectorAll('[data-bulk-select]').forEach(box => box.onclick = event => {
        const id = box.closest('[data-asset-id]').dataset.assetId;
        const ids = items.map(item => item.id);
        const from = ids.indexOf(rangeAnchor), to = ids.indexOf(id);
        const range = event.shiftKey && from >= 0 ? ids.slice(Math.min(from,to),Math.max(from,to)+1) : [id];
        for (const entry of range) box.checked ? selected.add(entry) : selected.delete(entry);
        rangeAnchor = id;
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
      const targetOf = event => event.target.closest('[data-cat],[data-asset-id],[data-facet=tags],[data-facet=suppliers]');
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
      body.querySelectorAll('[data-cat]').forEach(button => button.onclick = () => { current = button.dataset.cat; status = ''; paint(); });
      body.querySelector('[data-cat-add]').onclick = async () => {
        const name = prompt('Tên hạng mục mới (vd: Gạch ốp lát, Sàn gỗ, Rèm):');
        if (!name?.trim()) return;
        try { const result = await saveCategory(name.trim()); current = result.category?.id || current; paint(); } catch (error) { toast(error.message); }
      };
      body.querySelector('[data-import-wood]')?.addEventListener('click',() => openWoodCatalogue(category.id,paint));
      body.querySelector('[data-cat-rename]')?.addEventListener('click',async () => {
        const name = prompt('Đổi tên hạng mục:',category.name);
        if (!name?.trim()) return;
        try { await saveCategory(name.trim(),category.id); paint(); } catch (error) { toast(error.message); }
      });
      body.querySelector('[data-cat-delete]')?.addEventListener('click',async () => {
        if (!confirm('Xoá hạng mục "' + category.name + '"?')) return;
        try { await deleteCategory(category.id); current = null; paint(); } catch (error) { toast(error.message); }
      });
      const search = body.querySelector('input[type=search]');
      if (search) search.oninput = () => { query = search.value; clearTimeout(search.timer); search.timer = setTimeout(() => { paint().then(() => { const s = body.querySelector('input[type=search]'); s?.focus(); s?.setSelectionRange(query.length,query.length); }); },250); };
      const squareOption = body.querySelector('[data-library-square]');
      if (squareOption) {
        squareOption.checked = squareUploads;
        squareOption.onchange = () => { squareUploads = squareOption.checked; };
      }
      const drop = body.querySelector('.asset-drop');
      const upload = async files => {
        try { await uploadToLibrary(current,files,message => { status = message; const s = body.querySelector('.asset-status'); if (s) s.textContent = message; },squareUploads); }
        catch (error) { status = error.message; }
        paint();
      };
      if (drop) {
        drop.onclick = async () => { const files = await filePicker('image/*'); if (files.length) upload(files); };
        drop.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drop.click(); } };
        enableDrop(drop,upload);
        drop.addEventListener('drop',event => {
          const entries = [...event.dataTransfer.items].map(item => item.webkitGetAsEntry?.()).filter(Boolean);
          if (!entries.some(entry => entry.isDirectory)) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          droppedCatalogueFiles(entries).then(files => reviewFolders(current,files,squareUploads)).catch(error => toast(error.message));
        },true);
      }
      const folder = body.querySelector('[data-folder-input]');
      if (folder) folder.onchange = () => {
        try { reviewFolders(current,[...folder.files].map(file => ({file,path:file.webkitRelativePath.split('/').slice(0,-1).join('/')})),squareUploads); }
        catch (error) { toast(error.message); }
        folder.value = '';
      };
      dialog.onpaste = event => {
        const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
        if (!files.length || !current || event.target.closest('input')) return;
        event.preventDefault();
        upload(files);
      };
      body.querySelectorAll('[data-asset-square]').forEach(button => button.onclick = async () => {
        const item = items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
        const originalFull = item.originalFull || item.full, originalThumb = item.originalThumb || item.thumb;
        button.disabled = true;
        try {
          const image = item.square ? {full:originalFull,thumb:originalThumb} : await uploadImage(await readAsset(originalFull),{square:true});
          await updateItem({id:item.id,...image,originalFull,originalThumb,square:!item.square});
        } catch (error) { toast(error.message); button.disabled = false; }
      });
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
        caption.ondblclick = async () => {
          const id = caption.closest('[data-asset-id]').dataset.assetId;
          const item = data.items.find(entry => entry.id === id);
          const name = prompt('Tên / mã ảnh mẫu:',item.name || '');
          if (name === null) return;
          const hex = item.kind === 'paint' ? prompt('Màu hex:',item.hex) : undefined;
          if (hex === null) return;
          const brand = prompt('Thương hiệu:',item.brand || '');
          const size = prompt('Kích thước:',item.size || '');
          const suppliers = prompt('Đơn vị cung cấp, cách nhau bằng dấu phẩy:',(item.suppliers || []).join(', '));
          const tags = prompt('Tag, cách nhau bằng dấu phẩy:',(item.tags || []).join(', '));
          if ([brand,size,suppliers,tags].includes(null)) return;
          try { await updateItem({id,name:name.trim(),hex,brand,size,suppliers:suppliers.split(','),tags:tags.split(',')}); paint(); } catch (error) { toast(error.message); }
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
    categoryFor,openLibrary,openRenders,pickRender,pickLibrary,pickPaint,pickWood,loadPaintData,loadWoodData,storeAsset,closePicker,editView,viewCss,viewStyle,clampView,hydrate,assetUrl,
    filePicker,isPdf,pdfPages};
})();
