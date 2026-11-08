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
  function guestLibrary() {
    try {
      const stored = JSON.parse(localStorage.getItem(guestLibraryKey) || 'null');
      if (stored?.categories) {
        if (!stored.categories.some(c => c.id === 'ancuong-wood')) stored.categories.push({id:'ancuong-wood',name:'Mã gỗ An Cường'});
        return stored;
      }
    } catch { /* Dữ liệu khách hỏng thì tạo lại. */ }
    const template = window.materialTemplate || [];
    return {_version:0,categories:[...template.map(([name],index) => ({id:'cat-' + (index+1),name:name.replace(/\s*\(.*\)\s*$/,''),source:name})),{id:'ancuong-wood',name:'Mã gỗ An Cường'}],items:[]};
  }
  function saveGuest(data) {
    data._version = (data._version || 0) + 1;
    try { localStorage.setItem(guestLibraryKey,JSON.stringify(data)); } catch { throw new Error('Bộ nhớ trình duyệt đã đầy.'); }
    return data;
  }
  let libraryError = null;
  async function loadLibrary(force = false) {
    if (library && !force) return visibleLibrary(library);
    if (isGuest()) return (library = guestLibrary());
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
      if (item.code && data.items.some(entry => entry.categoryId === categoryId && entry.code?.replace(/\s+/g,'').toUpperCase() === item.code.replace(/\s+/g,'').toUpperCase())) { skipped++; continue; }
      added.push({id:uid(),categoryId,name:item.name || '',note:'',full:item.full,thumb:item.thumb,createdAt:Date.now(),
        ...(item.code ? {code:item.code,collection:item.collection,finish:item.finish} : {})});
    }
    data.items.unshift(...added);
    return {added,skipped};
  });
  const updateItem = patch => libraryCall('items/update',patch,data => {
    const item = data.items.find(entry => entry.id === patch.id);
    if (item) {
      if (typeof patch.name === 'string') item.name = patch.name;
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
  function grid(items,{selectable = true,removable = false,empty = 'Chưa có ảnh.'} = {}) {
    if (!items.length) return '<p class="asset-empty">' + esc(empty) + '</p>';
    return '<div class="asset-grid">' + items.map(item => '<figure class="asset-card" data-asset-id="' + esc(item.id) + '">' +
      '<button type="button" class="asset-thumb"' + (selectable ? ' data-asset-pick' : ' data-asset-open') + ' title="' + esc(item.name || item.room || '') + '">' +
      (item.thumb ? '<img data-lib-asset="' + esc(item.thumb) + '" alt="' + esc(item.name || 'Ảnh') + '">' : '<span>' + esc(item.code || '') + '</span>') + '</button>' +
      '<figcaption>' + esc(item.page ? 'Trang ' + item.page + (item.room && item.room !== 'Cả nhà' ? ' · ' + item.room : '') : ([item.code,item.name || item.room,item.collection,item.finish].filter(Boolean).join(' · '))) + '</figcaption>' +
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
      panel.remove();
      document.removeEventListener('pointerdown',outside,true);
      document.removeEventListener('keydown',key,true);
      removeEventListener('resize',place);
      if (openPopover?.panel === panel) openPopover = null;
    }
    setTimeout(() => document.addEventListener('pointerdown',outside,true));
    document.addEventListener('keydown',key,true);
    addEventListener('resize',place);
    openPopover = {panel,close};
    place();
    build(panel,close,place);
    return openPopover;
  }

  function pickRender(anchor,{projectId,onPick,title = 'Phối cảnh 3D của dự án'}) {
    return popover(anchor,async (panel,close,place) => {
      async function paint(force = false) {
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-body"><p class="asset-empty">Đang tải…</p></div><footer><button type="button" data-upload>⬆ Tải ảnh / PDF 3D</button>' +
          '<button type="button" data-full>Mở danh sách</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
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
          const items = await loadRenders(projectId,force);
          if (!panel.isConnected) return;
          panel.querySelector('.asset-body').innerHTML = grid(items,{empty:'Dự án chưa có phối cảnh 3D. Tải ảnh hoặc file PDF cả nhà lên để chọn nhanh.'});
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
      paint();
    });
  }

  function pickLibrary(anchor,{groupName,onPick,title = 'Mẫu vật liệu · Dữ liệu dùng chung'}) {
    return popover(anchor,async (panel,close,place) => {
      let data, categoryId, query = '';
      async function paint() {
        try { data = await loadLibrary(); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        categoryId ||= categoryFor(data,groupName)?.id || 'all';
        const items = data.items.filter(item => (categoryId === 'all' || item.categoryId === categoryId) &&
          (!query || fold(item.name).includes(fold(query)))).sort((a,b) => (b.used || 0)-(a.used || 0));
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters"><select aria-label="Hạng mục"><option value="all">Tất cả hạng mục</option>' +
          data.categories.map(c => '<option value="' + esc(c.id) + '"' + (c.id === categoryId ? ' selected' : '') + '>' + esc(c.name) +
            ' (' + data.items.filter(item => item.categoryId === c.id).length + ')</option>').join('') + '</select>' +
          '<input type="search" placeholder="Tìm theo tên / mã" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' + (items.length ? grid(items,{empty:'Hạng mục này chưa có ảnh. Bấm "Tải lên" để thêm ảnh mẫu dùng chung.'}) : '<p class="asset-empty">Không tìm thấy ảnh' + (query ? ' cho "' + esc(query) + '"' : '') + '. Bấm "Tải lên" để thêm ảnh mẫu dùng chung.</p><div class="asset-google-fallback-slot"></div>') + '</div>' +
          '<footer><button type="button" data-upload>⬆ Tải lên hạng mục này</button><button type="button" data-full>Quản lý dữ liệu</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
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
          updateItem({id:item.id,used:true}).catch(() => {});
          onPick?.(item);
        });
        await hydrate(panel);
        if (!items.length && query.trim()) {
          renderGoogleFallback(panel.querySelector('.asset-google-fallback-slot'), query, {
            onPickImage: entry => { close(); onPick?.(entry); },
            categoryId: categoryId === 'all' ? null : categoryId
          });
        }

        place();
      }
      panel.innerHTML = '<p class="asset-empty">Đang tải…</p>';
      paint();
    });
  }

  async function renderGoogleFallback(container, query, { onPickImage, categoryId }) {
    if (!container || !query?.trim()) return;
    container.innerHTML = '<div class="asset-google-fallback"><p class="asset-hint">Đang tìm kiếm ảnh trên Google…</p></div>';
    try {
      const res = await fetch('/api/google/search?q=' + encodeURIComponent(query.trim()), { headers: hooks.headers() });
      const data = await res.json().catch(() => ({}));
      if (data.configured && data.items && data.items.length) {
        container.innerHTML = '<div class="asset-google-fallback"><p><strong>Tìm thấy ' + data.items.length + ' ảnh trực tuyến cho "' + esc(query) + '":</strong></p>' +
          '<div class="asset-google-grid">' +
          data.items.slice(0, 12).map((item, idx) => '<button type="button" class="asset-google-item" data-google-idx="' + idx + '" title="' + esc(item.title) + '"><img src="' + esc(item.thumbnail || item.link) + '" alt="' + esc(item.title) + '"></button>').join('') +
          '</div><p class="asset-hint">Bấm vào ảnh để tải về và lưu vào ô</p></div>';
        container.querySelectorAll('[data-google-idx]').forEach(btn => {
          btn.onclick = async () => {
            const item = data.items[Number(btn.dataset.googleIdx)];
            btn.style.opacity = '0.5';
            toast('Đang tải ảnh từ Google và nén WebP…');
            try {
              const proxyRes = await fetch('/api/google/proxy-image', {
                method: 'POST',
                headers: { ...hooks.headers(), 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: item.link })
              });
              if (!proxyRes.ok) {
                const err = await proxyRes.json().catch(() => ({}));
                throw new Error(err.message || 'Lỗi tải ảnh proxy (' + proxyRes.status + ')');
              }
              const blob = await proxyRes.blob();
              const { full, thumb } = await GDHomeImages.compress(blob);
              const fullName = await storeAsset(full);
              const thumbName = thumb === full ? fullName : await storeAsset(thumb);
              const entry = { full: fullName, thumb: thumbName, name: item.title?.slice(0, 160) || query };
              if (categoryId && categoryId !== 'all') {
                await addItems(categoryId, [entry]).catch(() => {});
              }
              toast('Đã tải ảnh thành công!');
              onPickImage?.(entry);
            } catch (e) {
              toast('Không tải được ảnh: ' + e.message);
            }
          };
        });
      } else {
        const notConfiguredMsg = !data.configured ? 'Chưa cấu hình Google Search trong ⚙ Kết nối.' : 'Không tìm thấy ảnh trên Google.';
        container.innerHTML = '<div class="asset-google-fallback">' +
          '<p class="asset-hint">' + notConfiguredMsg + '</p>' +
          '<a class="btn btn-primary" href="https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query.trim()) + '" target="_blank" rel="noopener">🔍 Mở Google Ảnh "' + esc(query.trim()) + '" ↗</a>' +
          '<p class="asset-hint">Mở Google Ảnh: nhấp chuột phải vào ảnh → <strong>Sao chép hình ảnh</strong> (Copy image) → quay lại bảng bấm <strong>Ctrl+V</strong> để dán.</p>' +
          '</div>';
      }
    } catch (err) {
      container.innerHTML = '<div class="asset-google-fallback">' +
        '<a class="btn btn-primary" href="https://www.google.com/search?tbm=isch&q=' + encodeURIComponent(query.trim()) + '" target="_blank" rel="noopener">🔍 Mở Google Ảnh "' + esc(query.trim()) + '" ↗</a>' +
        '<p class="asset-hint">Nhấp chuột phải vào ảnh → Sao chép hình ảnh → quay lại bảng bấm Ctrl+V để dán.</p></div>';
    }
  }

  const paintCache = {};
  async function loadPaintData(brand = 'Dulux') {
    const key = brand.toLowerCase();
    if (!paintCache[key]) {
      const file = key.includes('jotun') ? '/data/paint-jotun.json' : '/data/paint-dulux.json';
      const res = await fetch(file);
      if (!res.ok) throw new Error('Không tải được bảng màu ' + brand);
      paintCache[key] = await res.json();
    }
    return paintCache[key];
  }

  function pickPaint(anchor, { groupName, onPick, title = 'Chọn màu sơn' } = {}) {
    return popover(anchor, async (panel, close, place) => {
      let brand = 'Dulux', query = '', paintData = null;
      async function paint() {
        try { paintData = await loadPaintData(brand); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        const colors = (paintData.colors || []).filter(c => !query || fold(c.code).includes(fold(query)) || fold(c.name).includes(fold(query)));
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters">' +
          '<select aria-label="Hãng sơn"><option value="Dulux"' + (brand === 'Dulux' ? ' selected' : '') + '>Dulux</option>' +
          '<option value="Jotun"' + (brand === 'Jotun' ? ' selected' : '') + '>Jotun</option></select>' +
          '<input type="search" placeholder="Tìm theo mã hoặc tên màu (vd: 30YY, 9918, White...)" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' +
          (colors.length ? '<div class="asset-paint-grid">' + colors.map(c => '<button type="button" class="asset-paint-card" data-paint-code="' + esc(c.code) + '" title="' + esc(c.code + ' – ' + c.name) + '">' +
            '<div class="asset-paint-swatch" style="background-color:' + esc(c.hex) + '"></div>' +
            '<div class="asset-paint-info"><strong>' + esc(c.code) + '</strong><span>' + esc(c.name) + '</span></div></button>').join('') + '</div>' :
            '<p class="asset-empty">Chưa có "' + esc(query) + '" trong bảng màu mẫu.</p>' +
            '<form class="asset-paint-custom"><strong>Dùng mã này</strong><label>Mã <input name="code" required value="' + esc(query) + '"></label>' +
            '<label>Tên màu <input name="name" placeholder="vd Ivory Lace"></label><label>Màu <input name="hex" type="color" value="#f2eee6"></label>' +
            '<button class="primary">Dùng màu ' + esc(brand) + ' này</button><small class="asset-hint">Xem mã trên quạt màu hoặc web hãng rồi chọn màu gần đúng. Lần sau sẽ có sẵn trong Dữ liệu dùng chung.</small></form>' +
            '<div class="asset-google-fallback-slot"></div>') +
          '</div>' +
          '<footer><small class="asset-hint">Nguồn: ' + esc(paintData.source || '') + ' (' + colors.length + ' màu)</small><button type="button" data-close>Đóng</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        panel.querySelector('[data-close]').onclick = close;
        panel.querySelector('select').onchange = event => { brand = event.target.value; paint(); };
        const search = panel.querySelector('input[type=search]');
        search.oninput = () => {
          query = search.value;
          clearTimeout(search.timer);
          search.timer = setTimeout(() => {
            paint().then(() => {
              const s = panel.querySelector('input[type=search]');
              s?.focus();
              s?.setSelectionRange(query.length, query.length);
            });
          }, 200);
        };
        panel.querySelectorAll('[data-paint-code]').forEach(button => {
          button.onclick = () => {
            const c = colors.find(entry => entry.code === button.dataset.paintCode);
            close();
            if (c) onPick?.({ kind: 'paint', brand, code: c.code, name: c.name, hex: c.hex });
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
        if (!colors.length && query.trim()) {
          renderGoogleFallback(panel.querySelector('.asset-google-fallback-slot'), query, {
            onPickImage: entry => {
              close();
              onPick?.(entry);
            }
          });
        }
        place();
      }
      panel.innerHTML = '<p class="asset-empty">Đang tải bảng màu…</p>';
      paint();
    });
  }

  async function loadWoodData() {
    const library = await loadLibrary();
    if (isGuest()) {
      const response = await fetch('/data/wood-ancuong.json');
      const seed = response.ok ? (await response.json()).woods : [];
      const imported = library.items.filter(item => item.categoryId === 'ancuong-wood' && item.code);
      const key = code => String(code).replace(/\s+/g,'').toUpperCase();
      return {woods:[...imported,...seed.filter(item => !imported.some(entry => key(entry.code) === key(item.code)))],source:'Dữ liệu dùng chung'};
    }
    return {woods:library.items.filter(item => item.categoryId === 'ancuong-wood' && item.code),source:'Dữ liệu dùng chung'};
  }

  function pickWood(anchor, { onPick, title = 'Mã gỗ An Cường' } = {}) {
    return popover(anchor, async (panel, close, place) => {
      let collection = 'all', query = '', woodData = null;
      async function paint() {
        try { woodData = await loadWoodData(); } catch (error) { panel.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
        const collections = Array.from(new Set((woodData.woods || []).map(w => w.collection).filter(Boolean)));
        const woods = (woodData.woods || []).filter(w => (collection === 'all' || w.collection === collection) &&
          (!query || fold(w.code).includes(fold(query)) || fold(w.name).includes(fold(query)) || fold(w.collection).includes(fold(query))));
        panel.innerHTML = '<header><strong>' + esc(title) + '</strong><button type="button" class="asset-x" aria-label="Đóng">×</button></header>' +
          '<div class="asset-filters">' +
          '<select aria-label="Dòng sản phẩm"><option value="all">Tất cả dòng sản phẩm</option>' +
          collections.map(col => '<option value="' + esc(col) + '"' + (col === collection ? ' selected' : '') + '>' + esc(col) + '</option>').join('') + '</select>' +
          '<input type="search" placeholder="Tìm theo mã, tên hoặc catalogue" value="' + esc(query) + '"></div>' +
          '<div class="asset-body">' +
          (woods.length ? '<div class="asset-wood-grid">' + woods.map(w => '<button type="button" class="asset-wood-card" data-wood-code="' + esc(w.code) + '" title="' + esc(w.code + ' – ' + w.name) + '">' +
            (w.thumb ? '<img data-lib-asset="' + esc(w.thumb) + '" alt="">' : '') + '<strong>' + esc(w.code) + '</strong><span class="wood-name">' + esc(w.name) + '</span>' +
            '<span class="wood-badge">' + esc(w.collection) + '</span></button>').join('') + '</div>' :
            '<p class="asset-empty">Không tìm thấy mã gỗ phù hợp với "' + esc(query) + '".</p><div class="asset-google-fallback-slot"></div>') +
          '</div>' +
          '<footer><small class="asset-hint">Nguồn: ' + esc(woodData.source || '') + ' (' + woods.length + ' mã)</small><button type="button" data-close>Đóng</button></footer>';
        panel.querySelector('.asset-x').onclick = close;
        panel.querySelector('[data-close]').onclick = close;
        panel.querySelector('select').onchange = event => { collection = event.target.value; paint(); };
        const search = panel.querySelector('input[type=search]');
        search.oninput = () => {
          query = search.value;
          clearTimeout(search.timer);
          search.timer = setTimeout(() => {
            paint().then(() => {
              const s = panel.querySelector('input[type=search]');
              s?.focus();
              s?.setSelectionRange(query.length, query.length);
            });
          }, 200);
        };
        panel.querySelectorAll('[data-wood-code]').forEach(button => {
          button.onclick = () => {
            const w = woods.find(entry => entry.code === button.dataset.woodCode);
            close();
            if (w) onPick?.({...w,kind:'wood',brand:'An Cường'});
          };
        });
        hydrate(panel);
        if (!woods.length && query.trim()) {
          renderGoogleFallback(panel.querySelector('.asset-google-fallback-slot'), query, {
            onPickImage: entry => {
              close();
              onPick?.(entry);
            }
          });
        }
        place();
      }
      panel.innerHTML = '<p class="asset-empty">Đang tải danh mục mã gỗ…</p>';
      paint();
    });
  }

  async function uploadToLibrary(categoryId,files,onStatus = toast) {
    const images = files.filter(file => file.type?.startsWith('image/'));
    if (!images.length) throw new Error('Chọn file ảnh.');
    const uploaded = [];
    let before = 0, after = 0;
    for (const [index,file] of images.entries()) {
      onStatus?.('Đang nén và tải ' + (index+1) + '/' + images.length + '…');
      const {full,thumb} = await GDHomeImages.compress(file);
      before += file.size; after += full.size;
      const fullName = await storeAsset(full);
      uploaded.push({full:fullName,thumb:thumb === full ? fullName : await storeAsset(thumb),name:(file.name || '').replace(/\.[a-z0-9]+$/i,'').replace(/[_-]+/g,' ').slice(0,160)});
    }
    for (let index = 0; index < uploaded.length; index += 50) await addItems(categoryId,uploaded.slice(index,index+50));
    const sized = bytes => bytes >= 1048576 ? (bytes/1048576).toFixed(1).replace('.',',') + ' MB' : Math.max(1,Math.round(bytes/1024)) + ' KB';
    onStatus?.('Đã thêm ' + uploaded.length + ' ảnh · ' + sized(before) + ' → ' + sized(after));
    return uploaded;
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
  const catalogueKey = code => code.toUpperCase().replace(/\s+/g,'');
  const bounded = (value,min,max) => Math.max(min,Math.min(max,value));
  async function scanWoodCatalogue(file,patterns,direction,onPage) {
    const regexes = patterns.split(/\r?\n/).map(line => line.trim()).filter(Boolean).map(line => new RegExp(line,'i'));
    if (!regexes.length) throw new Error('Nhập ít nhất một mẫu nhận diện mã.');
    const pdfjs = await loadPdfJs();
    if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
    const pdf = await pdfjs.getDocument({data:await file.arrayBuffer(),isEvalSupported:false}).promise;
    const results = [];
    try {
      for (let number = 1; number <= pdf.numPages; number++) {
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
        const matches = labels.flatMap(label => {
          const match = regexes.map(regex => label.text.match(regex)).filter(Boolean)
            .sort((a,b) => a.index-b.index || b[0].length-a[0].length)[0];
          if (!match?.[0] || match[0].length > 80) return [];
          const name = label.text.replace(match[0],'').replace(/^[\s:–—-]+/,'').trim() ||
            labels.find(other => other !== label && Math.abs(other.y-label.y) <= label.height*.5 &&
              other.x >= label.x+label.width-2 && other.x-label.x-label.width < label.height*4 &&
              !regexes.some(regex => regex.test(other.text)))?.text || '';
          return [{...label,code:match[0].trim().toUpperCase(),name}];
        });
        if (!matches.length) { page.cleanup(); continue; }
        if (results.length + matches.length > 5000) throw new Error('Catalogue vượt 5.000 mã. Hãy chia PDF thành nhiều lượt.');
        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const context = canvas.getContext('2d');
        await page.render({canvasContext:context,viewport}).promise;
        // Save page as a compressed image and keep only the swatch canvases live.
        const source = URL.createObjectURL(await new Promise(resolve => canvas.toBlob(resolve,'image/webp',.94)));
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
          results.push({code:label.code,name:label.name,page:number,source,width:canvas.width,height:canvas.height,
            crop:{x:x/canvas.width,y:y/canvas.height,w:w/canvas.width,h:h/canvas.height}});
        }
        canvas.width = canvas.height = 0;
        page.cleanup();
      }
    } catch (error) {
      for (const source of new Set(results.map(item => item.source))) URL.revokeObjectURL(source);
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
  async function openWoodCatalogue(categoryId,onSaved) {
    const {dialog,body} = modal('wood-catalogue-dialog','Nhập catalogue PDF An Cường');
    const sources = new Set();
    dialog.addEventListener('close',() => { for (const source of sources) URL.revokeObjectURL(source); },{once:true});
    body.innerHTML = '<form class="wood-catalogue-controls">' +
      '<label>Catalogue PDF <input name="pdf" type="file" accept="application/pdf,.pdf" required></label>' +
      '<label>Vị trí ảnh so với mã <select name="direction"><option value="above">Phía trên</option><option value="left">Bên trái</option></select></label>' +
      '<label>Catalogue <input name="collection" list="wood-catalogues" maxlength="120" placeholder="VD: Melamine/MFC"></label>' +
      '<datalist id="wood-catalogues"><option>Melamine/MFC</option><option>Laminate</option><option>Acrylic</option><option>Veneer</option></datalist>' +
      '<label>Bề mặt <input name="finish" maxlength="120" placeholder="VD: Mờ"></label>' +
      '<details><summary>Mẫu mã (regex)</summary><label>Mỗi dòng một mẫu<textarea name="patterns" rows="4" maxlength="1000">' +
      esc(woodPatterns.join('\n')) + '</textarea></label></details>' +
      '<button type="submit">Đọc PDF</button><button type="button" data-save-wood disabled>Lưu mã đã chọn</button></form>' +
      '<p role="status"></p><div class="wood-catalogue-results"></div>';
    const form = body.querySelector('form'), status = body.querySelector('[role=status]');
    const list = body.querySelector('.wood-catalogue-results'), save = body.querySelector('[data-save-wood]');
    const read = form.querySelector('[type=submit]');
    let items = [], busy = false;
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
      list.replaceChildren();
      for (const source of sources) URL.revokeObjectURL(source);
      sources.clear();
      try {
        items = await scanWoodCatalogue(form.elements.pdf.files[0],form.elements.patterns.value,form.elements.direction.value,
          (page,total) => { status.textContent = 'Đang đọc trang ' + page + '/' + total + '…'; });
        if (!dialog.open) { for (const item of items) URL.revokeObjectURL(item.source); return; }
        for (const item of items) sources.add(item.source);
        status.textContent = items.length ? 'Nhận diện ' + items.length + ' mã. Kiểm tra và chỉnh ảnh trước khi lưu.' : 'Không tìm thấy mã. Thử đổi mẫu nhận diện.';
        list.innerHTML = items.map(item => '<article class="wood-catalogue-card">' +
          '<canvas aria-label="Ảnh swatch"></canvas><small>Trang ' + item.page + '</small>' +
          '<label><input type="checkbox" data-wood-include checked> Lưu mã này</label>' +
          '<label>Mã <input data-wood-code-input maxlength="80" value="' + esc(item.code) + '"></label>' +
          '<label>Tên <input data-wood-name-input maxlength="160" value="' + esc(item.name) + '"></label>' +
          '<button type="button" data-edit-wood-crop>Chỉnh khung cắt</button></article>').join('');
        const cards = [...list.children];
        let lastSource, image;
        for (const [i,item] of items.entries()) {
          if (!dialog.open) return;
          if (lastSource !== item.source) { image = await loadPageImage(item.source); lastSource = item.source; }
          const canvas = cards[i].querySelector('canvas');
          drawSwatch(canvas,image,item.crop);
          cards[i].querySelector('[data-edit-wood-crop]').onclick = async () => {
            const image = await loadPageImage(item.source);
            editWoodCrop(image,item.crop,crop => { item.crop = crop; drawSwatch(canvas,image,crop); });
          };
        }
        save.disabled = !items.length;
      } catch (error) { status.textContent = error.message; }
      finally { busy = read.disabled = false; }
    };
    save.onclick = async () => {
      if (busy || !form.reportValidity()) return;
      const collection = form.elements.collection.value.trim(), finish = form.elements.finish.value.trim();
      if (!collection) { status.textContent = 'Nhập tên catalogue.'; return; }
      const selected = [...list.children].flatMap(card => {
        const code = card.querySelector('[data-wood-code-input]').value.trim();
        return card.querySelector('[data-wood-include]').checked && code ?
          [{card,code,name:card.querySelector('[data-wood-name-input]').value.trim()}] : [];
      });
      if (!selected.length) { status.textContent = 'Chọn ít nhất một thẻ có mã.'; return; }
      busy = read.disabled = save.disabled = true;
      let added = 0, skipped = 0, batch = [];
      try {
        const data = await loadLibrary();
        const existing = new Set(data.items.filter(item => item.categoryId === categoryId && item.code && item.full).map(item => catalogueKey(item.code)));
        const flush = async () => {
          if (!batch.length) return;
          const result = await addItems(categoryId,batch);
          added += result.added.length;
          skipped += result.skipped || 0;
          batch = [];
        };
        for (const {card,code,name} of selected) {
          if (!dialog.open) break;
          const key = catalogueKey(code);
          if (existing.has(key)) { skipped++; continue; }
          existing.add(key);
          status.textContent = 'Đang lưu ' + code + '…';
          const blob = await new Promise(resolve => card.querySelector('canvas').toBlob(resolve,'image/webp',.9));
          if (!blob || blob.type !== 'image/webp') throw new Error('Không tạo được ảnh WebP.');
          const full = await storeAsset(blob);
          batch.push({full,thumb:full,code,name,collection,finish});
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
    async function paint() {
      let data;
      try { data = await loadLibrary(); } catch (error) { body.innerHTML = '<p class="asset-empty">' + esc(error.message) + '</p>'; return; }
      current ||= categoryFor(data,groupName)?.id || data.categories[0]?.id || null;
      const category = data.categories.find(c => c.id === current);
      const items = data.items.filter(item => item.categoryId === current && (!query || fold([item.code,item.name,item.collection].join(' ')).includes(fold(query))));
      body.innerHTML = '<aside class="asset-categories"><div class="asset-cat-list">' + data.categories.map(c => '<button type="button" data-cat="' + esc(c.id) + '"' +
        (c.id === current ? ' aria-current="true"' : '') + '><span>' + esc(c.name) + '</span><small>' + data.items.filter(item => item.categoryId === c.id).length +
        '</small></button>').join('') + '</div><button type="button" data-cat-add>＋ Thêm hạng mục</button></aside>' +
        '<section class="asset-library-main">' + (category ? '<div class="asset-library-head"><strong>' + esc(category.name) + '</strong>' +
          (category.id === 'ancuong-wood' ? '<button type="button" data-import-wood>Nhập catalogue PDF</button>' : '') +
          (category.id === 'ancuong-wood' ? '' : '<button type="button" data-cat-rename>Đổi tên</button><button type="button" data-cat-delete>Xoá hạng mục</button>') +
          '<input type="search" placeholder="Tìm theo tên / mã" value="' + esc(query) + '"></div>' +
          '<div class="asset-drop" tabindex="0">⬆ Kéo thả ảnh vào đây, bấm để chọn file, hoặc Ctrl+V để dán · ảnh tự nén WebP 1600 px</div>' +
          '<p class="asset-status" role="status">' + esc(status) + '</p>' +
          grid(items,{selectable:!!onPick,removable:true,empty:'Chưa có ảnh trong hạng mục này.'}) : '<p class="asset-empty">Tạo hạng mục để bắt đầu.</p>') +
        (onPick ? '<p class="asset-hint">Bấm vào ảnh để dùng cho ô đang chọn.</p>' : '') + '</section>';
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
      const drop = body.querySelector('.asset-drop');
      const upload = async files => {
        try { await uploadToLibrary(current,files,message => { status = message; const s = body.querySelector('.asset-status'); if (s) s.textContent = message; }); }
        catch (error) { status = error.message; }
        paint();
      };
      if (drop) {
        drop.onclick = async () => { const files = await filePicker('image/*'); if (files.length) upload(files); };
        drop.onkeydown = event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); drop.click(); } };
        enableDrop(drop,upload);
      }
      dialog.onpaste = event => {
        const files = [...(event.clipboardData?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile()).filter(Boolean);
        if (!files.length || !current || event.target.closest('input')) return;
        event.preventDefault();
        upload(files);
      };
      body.querySelectorAll('[data-asset-remove]').forEach(button => button.onclick = async () => {
        if (!confirm('Xoá ảnh khỏi dữ liệu dùng chung? Các bảng đã dùng ảnh này vẫn giữ ảnh.')) return;
        try { await deleteItems([button.closest('[data-asset-id]').dataset.assetId]); } catch (error) { toast(error.message); }
      });
      body.querySelectorAll('[data-asset-pick]').forEach(button => button.onclick = () => {
        const item = data.items.find(entry => entry.id === button.closest('[data-asset-id]').dataset.assetId);
        dialog.close();
        updateItem({id:item.id,used:true}).catch(() => {});
        if (item.full) onPick(item);
      });
      body.querySelectorAll('.asset-card figcaption').forEach(caption => {
        caption.title = 'Nháy đúp để đổi tên';
        caption.ondblclick = async () => {
          const id = caption.closest('[data-asset-id]').dataset.assetId;
          const item = data.items.find(entry => entry.id === id);
          const name = prompt('Tên / mã ảnh mẫu:',item.name || '');
          if (name === null) return;
          try { await updateItem({id,name:name.trim()}); paint(); } catch (error) { toast(error.message); }
        };
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
