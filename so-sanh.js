// =========================================================================
// GD HOME - BẢNG SO SÁNH (/so-sanh)
// Trái: ô nhập hàng loạt ý tưởng -> hàng đợi AI CHẠY NỀN trên server (đóng trang / F5 vẫn làm tiếp), có tiến trình;
//       danh mục hạng mục lớn (kéo thả đổi thứ tự, kéo bảng sang hạng mục khác) -> các bảng (mới tô nền, đã duyệt bên dưới).
// Phải: dàn trang 2/3 cột giống mẫu GD HOME, sửa trực tiếp, ảnh (Thư viện / Tải / Dán Ctrl+V), Hoàn tác/Làm lại, Copy ảnh, Tải PNG.
// =========================================================================
(() => {
  const byId = id => document.getElementById(id);
  const esc = value => GDHomeShell.escape(value);
  const toast = message => GDHomeShell.toast(message);
  const PALETTE = ['#7d8f69', '#7a2e2e', '#4d6188', '#8c7d6b', '#5f7f8c', '#9a6b3f', '#6b5b8c'];
  let doc = null, version = 0, current = null, saveTimer = null;
  let queue = {jobs: [], avgMs: 45000, now: Date.now()}, queueTimer = null, clockSkew = 0;
  let activeSlot = null;

  async function api(url, options = {}) {
    const res = await fetch(url, {...options, headers: GDHomeShell.authHeaders()});
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.message || 'Lỗi ' + res.status), {status: res.status});
    return json;
  }
  const post = (url, body) => api(url, {method: 'POST', body: JSON.stringify(body || {})});

  // ---------------------------------------------------------------- LƯU + HOÀN TÁC / LÀM LẠI
  const undoStack = [], redoStack = [];
  let snapshot = '', lastPush = 0;
  const docJson = () => JSON.stringify({categories: doc.categories, boards: doc.boards});
  function setStatus(state) { GDHomeShell.saveStatus(byId('save-status'), state); }
  function save({history = true, typing = false} = {}) {
    const now = docJson();
    if (history && now !== snapshot) {
      // Gõ chữ liên tục trong 1,2 giây = 1 bước hoàn tác; thao tác khác luôn là 1 bước riêng
      if (!typing || Date.now() - lastPush > 1200) { undoStack.push(snapshot); if (undoStack.length > 60) undoStack.shift(); redoStack.length = 0; }
      lastPush = typing ? Date.now() : 0;
    }
    snapshot = now;
    renderHistory();
    setStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      setStatus('saving');
      try {
        const saved = await post('/api/compare', {...doc, queue: [], _baseVersion: version});
        version = saved._version;
        setStatus('saved');
      } catch (error) {
        setStatus('error');
        GDHomeShell.alert(error.message);
      }
    }, 700);
  }
  function restore(json) {
    const data = JSON.parse(json);
    doc.categories = data.categories;
    doc.boards = data.boards;
    if (!doc.boards.some(b => b.id === current)) current = doc.boards[0]?.id || null;
    renderAll();
    save({history: false});
  }
  function undo() { if (!undoStack.length) return toast('Không còn thao tác để hoàn tác.'); redoStack.push(snapshot); restore(undoStack.pop()); lastPush = 0; }
  function redo() { if (!redoStack.length) return toast('Không còn thao tác để làm lại.'); undoStack.push(snapshot); restore(redoStack.pop()); lastPush = 0; }
  function renderHistory() {
    byId('cmp-undo').disabled = !undoStack.length;
    byId('cmp-redo').disabled = !redoStack.length;
  }

  const board = () => doc.boards.find(b => b.id === current);
  const catOf = b => doc.categories.find(c => c.id === b.categoryId) || {name: b.category || 'KHÁC', color: '#8c7d6b'};
  function categoryFor(name) {
    const key = String(name || '').trim().toUpperCase() || 'KHÁC';
    let cat = doc.categories.find(c => c.name === key);
    if (!cat) {
      cat = {id: 'cat-' + Math.random().toString(36).slice(2, 10), name: key, color: PALETTE[doc.categories.length % PALETTE.length]};
      doc.categories.push(cat);
    }
    return cat;
  }

  // ---------------------------------------------------------------- BẢNG TỰ LÀM + AI ĐIỀN
  const DEFAULT_NAME = /^phương án [a-c]$/i;
  const blankCol = name => ({kicker: '', name, desc: '', stats: '', pros: [], cons: [], image: null});
  // Kết quả AI về: chữ anh đang có (kể cả sửa trong lúc AI chạy) luôn giữ, AI chỉ lấp ô trống; ảnh giữ nguyên
  function fillBoard(target, made) {
    target.columns = target.columns.map((col, i) => {
      const ai = made.columns[i];
      if (!ai) return col;
      const pick = f => (col[f] && !(f === 'name' && DEFAULT_NAME.test(col[f]))) ? col[f] : ai[f] || col[f];
      const list = f => col[f].length >= 3 ? col[f] : [...col[f], ...ai[f].filter(t => !col[f].includes(t))].slice(0, 3);
      return {...col, kicker: pick('kicker'), name: pick('name'), desc: pick('desc'), stats: col.desc ? col.stats : pick('stats'), pros: list('pros'), cons: list('cons')};
    });
    if (!target.heading) target.heading = made.heading;
    target.status = 'new';
  }
  // Ảnh ô so sánh -> JPEG nhỏ (≤ 768px) gửi AI nhìn
  async function smallImage(img) {
    try {
      if (!img?.src) return null;
      await img.decode();
      const k = Math.min(1, 768 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = Object.assign(document.createElement('canvas'), {width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k)});
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return {mediaType: 'image/jpeg', data: canvas.toDataURL('image/jpeg', 0.82).split(',')[1]};
    } catch { return null; }
  }

  // ---------------------------------------------------------------- HÀNG ĐỢI AI (server làm nền)
  function applyQueue(view) {
    queue = view;
    clockSkew = Date.now() - view.now;
    // Nhận các bảng đã xong vào danh mục rồi báo server bỏ khỏi hàng đợi
    const done = view.jobs.filter(j => j.state === 'done' && j.board);
    if (done.length) {
      for (const job of done) {
        const target = job.boardId && doc.boards.find(b => b.id === job.boardId);
        if (target) { fillBoard(target, job.board); continue; }
        if (doc.boards.some(b => b.id === job.board.id)) continue;
        const made = {...job.board, categoryId: categoryFor(job.board.category).id, status: 'new'};
        doc.boards.unshift(made);
        if (!current) current = made.id;
        if (job.issues?.length) toast('Bảng "' + made.heading + '" cần xem lại: ' + job.issues[0]);
      }
      renderAll();
      save();
      post('/api/compare/queue/ack', {ids: done.map(j => j.id)}).then(applyQueue).catch(() => {});
    }
    renderQueue();
    clearTimeout(queueTimer);
    const busy = view.jobs.some(j => j.state === 'waiting' || j.state === 'running');
    queueTimer = setTimeout(pollQueue, busy ? 2000 : 30000);
  }
  async function pollQueue() {
    if (document.hidden) { queueTimer = setTimeout(pollQueue, 5000); return; }
    try { applyQueue(await api('/api/compare/queue')); }
    catch { clearTimeout(queueTimer); queueTimer = setTimeout(pollQueue, 10000); }
  }
  const secs = ms => Math.max(0, Math.round(ms / 1000));
  function renderQueue() {
    const jobs = queue.jobs.filter(j => j.state !== 'done');
    const active = jobs.filter(j => j.state !== 'error');
    const running = jobs.find(j => j.state === 'running');
    const head = byId('cmp-progress');
    if (active.length) {
      const elapsed = running ? Date.now() - clockSkew - running.startedAt : 0;
      const left = Math.max(0, queue.avgMs * active.length - elapsed);
      const pct = running ? Math.min(95, Math.round(elapsed / queue.avgMs * 100)) : 0;
      head.hidden = false;
      head.innerHTML = `<div class="cmp-progress-text"><strong>AI đang làm ${active.length} bảng</strong>
        <span>${running ? esc(running.step || 'Đang làm') + ' · ' + secs(elapsed) + ' giây' : 'Đang chờ máy chủ…'} · còn khoảng ${Math.ceil(left / 60000)} phút</span></div>
        <div class="cmp-progress-bar"><i style="width:${pct}%"></i></div>
        <small>Chạy nền trên máy chủ: có thể đóng trang hoặc F5, mở lại sẽ thấy bảng mới.</small>`;
    } else head.hidden = true;
    byId('cmp-queue').innerHTML = jobs.map((j, i) => `<li class="is-${j.state}" data-id="${esc(j.id)}">
      <b>${j.state === 'running' ? '⏳' : j.state === 'error' ? '⚠' : (i + 1) + '.'}</b>
      <span>${j.boardId ? '✨ Điền: ' : ''}${esc(j.idea)}${j.state === 'error' ? `<em>${esc(j.error)}</em>` : j.state === 'running' ? `<em>${esc(j.step || '')}</em>` : ''}</span>
      ${j.state === 'error' ? '<button type="button" data-q="retry" title="Thử lại">↻</button>' : ''}
      ${j.state === 'running' ? '' : '<button type="button" data-q="del" title="Bỏ khỏi hàng đợi">×</button>'}</li>`).join('');
  }
  setInterval(() => { if (queue.jobs.some(j => j.state === 'running')) renderQueue(); }, 1000);

  // ---------------------------------------------------------------- DANH MỤC (kéo thả)
  function renderTree() {
    byId('cmp-tree').innerHTML = doc.categories.map(cat => {
      const boards = doc.boards.filter(b => b.categoryId === cat.id);
      const fresh = boards.filter(b => b.status === 'new'), ok = boards.filter(b => b.status !== 'new');
      const item = b => `<li class="${b.status === 'new' ? 'is-new' : ''} ${b.id === current ? 'is-active' : ''}" draggable="true" data-board-id="${esc(b.id)}"><button type="button" data-board="${esc(b.id)}">${esc(b.heading || b.idea || 'Bảng chưa đặt tên')}</button></li>`;
      return `<section class="cmp-cat" data-cat="${esc(cat.id)}">
        <div class="cmp-cat-head" draggable="true" title="Kéo để đổi thứ tự hạng mục"><span class="cmp-grip" aria-hidden="true">⋮⋮</span>
          <input type="color" value="${esc(cat.color)}" title="Màu góc hạng mục" aria-label="Màu hạng mục ${esc(cat.name)}">
          <span class="cmp-cat-name" title="Nháy đúp để đổi tên">${esc(cat.name)}</span><small>${boards.length}</small>
          ${boards.length ? '' : '<button type="button" class="cmp-cat-del" data-cat-del title="Xoá hạng mục trống">×</button>'}</div>
        <ul class="cmp-boards">${fresh.map(item).join('')}${fresh.length && ok.length ? '<li class="cmp-sep" aria-hidden="true"></li>' : ''}${ok.map(item).join('')}</ul>
      </section>`;
    }).join('');
  }
  let drag = null;
  function wireTreeDrag(tree) {
    tree.addEventListener('dragstart', e => {
      const li = e.target.closest('li[data-board-id]'), head = e.target.closest('.cmp-cat-head');
      drag = li ? {kind: 'board', id: li.dataset.boardId} : head ? {kind: 'cat', id: head.closest('[data-cat]').dataset.cat} : null;
      if (!drag) return;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', drag.id);
    });
    const clear = () => tree.querySelectorAll('.drop-before,.drop-after,.drop-into').forEach(el => el.classList.remove('drop-before', 'drop-after', 'drop-into'));
    const target = e => {
      const section = e.target.closest('.cmp-cat');
      if (!section || !drag) return null;
      if (drag.kind === 'cat') {
        const r = section.getBoundingClientRect();
        return {el: section, cls: e.clientY < r.top + r.height / 2 ? 'drop-before' : 'drop-after', cat: section.dataset.cat};
      }
      const li = e.target.closest('li[data-board-id]');
      if (li && li.dataset.boardId !== drag.id) return {el: li, cls: 'drop-before', cat: section.dataset.cat, before: li.dataset.boardId};
      return {el: section, cls: 'drop-into', cat: section.dataset.cat};
    };
    tree.addEventListener('dragover', e => {
      const t = target(e);
      if (!t) return;
      e.preventDefault();
      clear();
      t.el.classList.add(t.cls);
    });
    tree.addEventListener('dragleave', e => { if (!tree.contains(e.relatedTarget)) clear(); });
    tree.addEventListener('drop', e => {
      const t = target(e);
      clear();
      if (!t) return;
      e.preventDefault();
      if (drag.kind === 'cat') {
        const moving = doc.categories.find(c => c.id === drag.id), rest = doc.categories.filter(c => c !== moving);
        let at = rest.findIndex(c => c.id === t.cat);
        if (at < 0 || moving.id === t.cat) return;
        if (t.cls === 'drop-after') at += 1;
        rest.splice(at, 0, moving);
        doc.categories = rest;
      } else {
        const moving = doc.boards.find(b => b.id === drag.id);
        moving.categoryId = t.cat;
        if (t.before) {
          const rest = doc.boards.filter(b => b !== moving);
          rest.splice(rest.findIndex(b => b.id === t.before), 0, moving);
          doc.boards = rest;
        }
      }
      drag = null;
      renderAll();
      save();
    });
    tree.addEventListener('dragend', () => { drag = null; clear(); });
  }

  // ---------------------------------------------------------------- DÀN TRANG
  const ph = text => `data-ph="${esc(text)}"`;
  function sheetHtml(b) {
    const cat = catOf(b), n = b.columns.length;
    const cols = fn => `<div class="cs-grid" style="--n:${n}">${b.columns.map(fn).join('')}</div>`;
    // A4 tỷ lệ 1:√2 – 2 phương án khổ dọc 1000×1414, 3 phương án khổ ngang 1414×1000
    return `<div class="cs-sheet ${n === 3 ? 'is-land' : ''} ${b.status === 'new' ? 'is-new' : ''}" id="cs-sheet" style="--cat:${esc(cat.color)}">
      <div class="cs-head">
        <div class="cs-logo"><img src="/gdhome-logo.png" alt="GD HOME"></div>
        <div class="cs-title"><div contenteditable="plaintext-only" data-f="title" ${ph('SO SÁNH')}>${esc(b.title)}</div>
          <div contenteditable="plaintext-only" data-f="heading" ${ph('TIÊU ĐỀ SO SÁNH')}>${esc(b.heading)}</div></div>
        <div class="cs-tab"><span>${esc(cat.name)}</span></div>
      </div>
      <div class="cs-images">${cols((c, i) => `<div class="cs-img ${c.image ? '' : 'is-empty'} ${activeSlot === i ? 'is-target' : ''}" data-col="${i}" tabindex="0" title="Bấm chọn ô rồi Ctrl+V để dán ảnh (chụp màn hình hoặc file đã copy)">
        ${c.image ? `<img data-asset="${esc(c.image.full)}" alt="">` : '<span class="cs-img-hint">Bấm chọn ô · Ctrl+V để dán ảnh</span>'}
        <div class="cs-img-tools"><button type="button" data-img="lib">Thư viện</button><button type="button" data-img="upload">Tải ảnh</button><button type="button" data-img="paste">Dán</button>${c.image ? '<button type="button" data-img="del">Xoá</button>' : ''}</div></div>`)}</div>
      <div class="cs-band">${cols((c, i) => `<div data-col="${i}">
        <div class="cs-name" contenteditable="plaintext-only" data-f="name" ${ph('Tên phương án')}>${esc(c.name)}</div>
        <div class="cs-desc" contenteditable="plaintext-only" data-f="desc" ${ph('Mô tả ngắn · Shift+Enter xuống dòng (vd Giá thành: 1   Độ cứng: 2)')}>${esc([c.desc, c.stats].filter(Boolean).join('\n'))}</div></div>`)}</div>
      <div class="cs-body">${['pros', 'cons'].map(f => cols((c, i) => `<div data-col="${i}">
        ${f === 'pros' ? '<div class="cs-sec pros"><i>✓</i>ƯU ĐIỂM:</div>' : '<div class="cs-sec cons"><i>✕</i>NHƯỢC ĐIỂM:</div>'}
        <ul class="cs-list" contenteditable="true" data-f="${f}">${(c[f].length ? c[f] : ['']).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`)).join('')}</div>
    </div>`;
  }

  // Luôn thu cả trang giấy vừa vùng làm việc (khi xuất ảnh/PDF luôn đúng 100%)
  function fit() {
    const sheet = byId('cs-sheet'), stage = byId('cmp-stage');
    if (sheet) sheet.style.zoom = Math.min(1, (stage.clientWidth - 40) / sheet.offsetWidth, (stage.clientHeight - 40) / sheet.offsetHeight);
  }
  // Khổ cố định: nhiều chữ hơn dự kiến thì dòng tự sát lại / chữ nhỏ dần cho vừa khổ
  function tighten(sheet = byId('cs-sheet')) {
    const body = sheet?.querySelector('.cs-body');
    if (!body) return;
    let k = 1;
    sheet.style.setProperty('--k', k);
    while (body.scrollHeight > body.clientHeight + 1 && k > 0.6) sheet.style.setProperty('--k', k = Math.round((k - 0.04) * 100) / 100);
    sheet.classList.toggle('is-overflow', body.scrollHeight > body.clientHeight + 1);
  }

  function renderSheet() {
    const b = board();
    byId('cmp-toolbar').hidden = byId('cmp-aibar').hidden = !b;
    byId('cmp-empty').hidden = !!b;
    if (b && document.activeElement !== byId('cmp-notes')) byId('cmp-notes').value = b.notes || '';
    byId('cmp-sheet-wrap').innerHTML = b ? sheetHtml(b) : '';
    if (!b) return;
    byId('cmp-cat-select').innerHTML = doc.categories.map(c => `<option value="${esc(c.id)}" ${c.id === b.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    document.querySelectorAll('.cmp-seg [data-cols]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.cols) === b.columns.length));
    byId('cmp-approve').textContent = b.status === 'new' ? '✓ Duyệt OK' : '↺ Đánh dấu cần xem lại';
    fit();
    tighten();
    for (const img of document.querySelectorAll('#cs-sheet img[data-asset]')) {
      GDHomeAssets.assetUrl(img.dataset.asset).then(url => { img.src = url; }).catch(() => { img.alt = 'Ảnh chưa tải được'; });
    }
  }
  function renderAll() { renderTree(); renderSheet(); renderHistory(); }

  // Sửa trực tiếp trên bảng -> cập nhật dữ liệu
  function readField(el) {
    const b = board();
    if (!b) return;
    const f = el.dataset.f, colEl = el.closest('[data-col]');
    if (!colEl) b[f] = el.textContent.trim();
    else {
      const col = b.columns[Number(colEl.dataset.col)];
      // Xoá hết dòng thì trình duyệt có thể bỏ thẻ <li>: khi đó tách theo xuống dòng
      if (f === 'pros' || f === 'cons') col[f] = (el.querySelector('li') ? [...el.querySelectorAll('li')].map(li => li.textContent) : el.innerText.split('\n'))
        .map(s => s.trim()).filter(Boolean);
      else if (f === 'desc') { col.desc = el.innerText.replace(/\n+$/, '').trim(); col.stats = ''; }   // mô tả + giá thành gộp 1 ô
      else col[f] = el.textContent.trim();
    }
    if (f === 'heading') renderTree();
    tighten();
    save({typing: true});
  }

  // ---------------------------------------------------------------- ẢNH (Thư viện / Tải / Dán)
  function selectSlot(col) {
    activeSlot = col;
    document.querySelectorAll('#cs-sheet .cs-img').forEach(el => el.classList.toggle('is-target', Number(el.dataset.col) === col));
  }
  function setImage(col, full) {
    const b = board();
    if (!b) return;
    b.columns[col].image = full ? {full} : null;
    save();
    renderSheet();
  }
  async function uploadBlob(col, blob) {
    try {
      toast('Đang tải ảnh…');
      const {full} = await GDHomeImages.compress(blob);
      setImage(col, await GDHomeAssets.storeAsset(full));
    } catch (error) { GDHomeShell.alert('Không tải được ảnh: ' + error.message); }
  }
  // Lấy ảnh trong clipboard: ảnh chụp màn hình hoặc file ảnh đã copy từ thư mục
  const clipboardImage = data => [...(data?.items || [])].filter(item => item.kind === 'file' && item.type.startsWith('image/')).map(item => item.getAsFile())[0]
    || [...(data?.files || [])].find(file => file.type.startsWith('image/'));
  async function pasteFromButton(col) {
    try {
      for (const item of await navigator.clipboard.read()) {
        const type = item.types.find(t => t.startsWith('image/'));
        if (type) return uploadBlob(col, await item.getType(type));
      }
      toast('Clipboard chưa có ảnh. Chụp màn hình hoặc copy ảnh rồi bấm Dán (hoặc Ctrl+V).');
    } catch { toast('Trình duyệt chặn đọc clipboard: bấm chọn ô ảnh rồi nhấn Ctrl+V.'); }
  }

  // ---------------------------------------------------------------- XUẤT (Copy ảnh / PNG / PDF 1 bảng, 1 hạng mục, toàn bộ)
  // Dựng bảng ngoài màn hình ở 100% rồi chụp: dùng chung cho bảng đang mở và xuất nhiều bảng
  async function renderCanvas(b) {
    if (!window.html2canvas) throw new Error('Chưa tải được công cụ xuất ảnh, thử lại sau.');
    const box = Object.assign(document.createElement('div'), {className: 'cs-offscreen', innerHTML: sheetHtml(b)});
    const sheet = box.firstElementChild;
    sheet.removeAttribute('id');
    sheet.classList.add('is-exporting');
    document.body.append(box);
    try {
      await Promise.all([...sheet.querySelectorAll('img[data-asset]')].map(async img => {
        try { img.src = await GDHomeAssets.assetUrl(img.dataset.asset); await img.decode(); } catch { /* ảnh lỗi: để ô trống */ }
      }).concat(document.fonts.ready));
      await Promise.all([...sheet.querySelectorAll('img')].map(img => img.decode().catch(() => null)));
      tighten(sheet);
      return await html2canvas(sheet, {scale: 2, backgroundColor: '#e6e6e6', useCORS: true});
    } finally { box.remove(); }
  }
  const fileName = (name, ext) => 'So-sanh_' + String(name || 'bang').replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) + '.' + ext;
  function download(href, name) { Object.assign(document.createElement('a'), {href, download: name}).click(); }
  // Thứ tự xuất = thứ tự trên danh mục (hạng mục, rồi bảng mới, rồi bảng đã duyệt)
  function boardsInOrder(catId) {
    return doc.categories.filter(c => !catId || c.id === catId).flatMap(cat => {
      const list = doc.boards.filter(b => b.categoryId === cat.id);
      return [...list.filter(b => b.status === 'new'), ...list.filter(b => b.status !== 'new')];
    });
  }
  // PDF: mọi trang cùng chiều rộng 210 mm (bảng dọc cao 297, bảng ngang cao 148,5) nên cuộn đọc đều nhau
  async function exportPdf(list, name) {
    if (!window.jspdf) throw new Error('Chưa tải được công cụ PDF, thử lại sau.');
    if (!list.length) throw new Error('Chưa có bảng nào để xuất.');
    let pdf = null;
    for (const [i, b] of list.entries()) {
      toast(`Đang xuất PDF ${i + 1}/${list.length}…`);
      const canvas = await renderCanvas(b), size = [210, 210 * canvas.height / canvas.width];
      const orientation = size[1] >= size[0] ? 'portrait' : 'landscape';   // jsPDF tự đảo cạnh nếu sai hướng
      if (!pdf) pdf = new window.jspdf.jsPDF({unit: 'mm', format: size, orientation, compress: true});
      else pdf.addPage(size, orientation);
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, size[0], size[1]);
    }
    pdf.save(fileName(name, 'pdf'));
    toast('Đã tải PDF ' + list.length + ' bảng.');
  }
  async function output(mode) {
    const b = board();
    try {
      if (mode === 'pdf-all') return await exportPdf(boardsInOrder(), 'toan-bo-danh-muc');
      if (!b) return toast('Chọn một bảng trước.');
      if (mode === 'pdf-cat') return await exportPdf(boardsInOrder(b.categoryId), catOf(b).name);
      if (mode === 'pdf') return await exportPdf([b], b.heading);
      const canvas = await renderCanvas(b);
      if (mode === 'png') return download(canvas.toDataURL('image/png'), fileName(b.heading, 'png'));
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      toast('Đã copy ảnh bảng so sánh – dán (Ctrl+V) vào Zalo, Word…');
    } catch (error) { GDHomeShell.alert('Không xuất được: ' + error.message); }
  }

  // Prompt tạo ảnh: mỗi cột 1 prompt riêng để AI trả về ảnh rời, đúng tỷ lệ ô ảnh của khổ giấy
  function imagePrompts(b) {
    const ratio = b.columns.length === 3 ? '4:3 (landscape)' : '1:1 (square)';
    return b.columns.map(c => `Photorealistic interior design photo for a product comparison board (Vietnam interior fit-out).
Subject: "${c.name || b.heading}"${c.desc ? ' – ' + c.desc.replace(/\n/g, '; ') : ''}.
Comparison topic: ${b.heading || b.idea || ''}.
Show this option clearly as the main subject, realistic materials and construction details, soft natural light, clean modern Vietnamese apartment or neutral studio background.
Aspect ratio ${ratio}. Exactly ONE image. No text, no labels, no watermark, no logo, no collage.`);
  }

  // ---------------------------------------------------------------- SỰ KIỆN
  function wire() {
    byId('cmp-run').onclick = async () => {
      const ideas = byId('cmp-ideas').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!ideas.length) return toast('Nhập ít nhất 1 dòng ý tưởng so sánh.');
      try {
        applyQueue(await post('/api/compare/queue', {ideas, categories: doc.categories.map(c => c.name)}));
        byId('cmp-ideas').value = '';
        toast('Đã gửi ' + ideas.length + ' ý tưởng – AI làm lần lượt trên máy chủ.');
      } catch (error) { GDHomeShell.alert(error.message); }
    };
    byId('cmp-queue').onclick = async e => {
      const btn = e.target.closest('[data-q]'), li = btn && btn.closest('li');
      if (!li) return;
      try { applyQueue(await post('/api/compare/queue/' + (btn.dataset.q === 'del' ? 'delete' : 'retry'), {id: li.dataset.id})); }
      catch (error) { toast(error.message); }
    };
    byId('cmp-add-board').onclick = () => {
      const cat = doc.categories.find(c => c.id === board()?.categoryId) || doc.categories[0] || categoryFor('KHÁC');
      const b = {id: 'cmp_' + crypto.randomUUID(), categoryId: cat.id, category: '', title: 'SO SÁNH', heading: '',
        columns: [blankCol('Phương án A'), blankCol('Phương án B')], idea: '', status: 'new', notes: '', createdAt: new Date().toISOString()};
      doc.boards.unshift(b);
      current = b.id;
      activeSlot = null;
      renderAll();
      save();
      document.querySelector('#cs-sheet [data-f="heading"]')?.focus();
      toast('Bảng trống: gõ tiêu đề, tên phương án, dán ảnh (Ctrl+V) rồi tự điền hoặc bấm ✨ AI điền bảng.');
    };
    byId('cmp-notes').oninput = e => { const b = board(); if (b) { b.notes = e.target.value; save({typing: true}); } };
    byId('cmp-fill').onclick = async () => {
      const b = board(), btn = byId('cmp-fill');
      if (!b) return;
      if (!b.heading && !(b.notes || '').trim() && !b.columns.some(c => (c.name && !DEFAULT_NAME.test(c.name)) || c.image)) {
        return toast('Gõ tiêu đề / tên phương án, dán thông tin hoặc ảnh trước để AI biết so sánh gì.');
      }
      btn.disabled = true;
      try {
        const images = [];
        for (const [col, c] of b.columns.entries()) {
          const data = c.image && await smallImage(document.querySelector(`#cs-sheet .cs-img[data-col="${col}"] img`));
          if (data) images.push({...data, col});
        }
        applyQueue(await post('/api/compare/queue/fill', {board: b, images, categories: doc.categories.map(c => c.name)}));
        toast('AI đang điền bảng trên máy chủ – xem tiến trình bên trái. Chữ anh đã gõ được giữ nguyên.');
      } catch (error) { GDHomeShell.alert(error.message); }
      finally { btn.disabled = false; }
    };
    // Hết lượt AI: copy prompt sang AI khác, dán câu trả lời về để điền bảng đang mở
    const dlg = byId('cmp-prompt-dlg');
    byId('cmp-prompt').onclick = async () => {
      const b = board();
      if (!b) return;
      try {
        const {prompt} = await post('/api/compare/prompt', {board: b, categories: doc.categories.map(c => c.name)});
        byId('cmp-prompt-text').value = prompt;
        byId('cmp-prompt-answer').value = '';
        byId('cmp-img-prompts').innerHTML = imagePrompts(b).map((text, i) => `<div class="cmp-img-prompt"><div><b>Cột ${i + 1}: ${esc(b.columns[i].name || '')}</b>
          <button type="button" class="gd-ask-btn" data-pr="copy-img" data-i="${i}">📋 Copy prompt ảnh</button></div><textarea readonly rows="3">${esc(text)}</textarea></div>`).join('');
        dlg.dataset.board = b.id;
        dlg.showModal();
      } catch (error) { GDHomeShell.alert(error.message); }
    };
    dlg.onclick = async e => {
      const act = e.target.closest('[data-pr]')?.dataset.pr;
      if (act === 'close') return dlg.close();
      if (act === 'copy' || act === 'copy-img') {
        const area = act === 'copy' ? byId('cmp-prompt-text') : e.target.closest('.cmp-img-prompt').querySelector('textarea');
        try { await navigator.clipboard.writeText(area.value); }
        catch { area.select(); document.execCommand('copy'); }
        return toast(act === 'copy' ? 'Đã copy prompt chữ – dán vào ChatGPT / Claude / Gemini.' : 'Đã copy prompt ảnh – gửi riêng để AI vẽ 1 ảnh rời.');
      }
      if (act !== 'apply') return;
      const target = doc.boards.find(x => x.id === dlg.dataset.board);
      if (!target) return dlg.close();
      try {
        const {board: made, issues} = await post('/api/compare/import', {board: target, raw: byId('cmp-prompt-answer').value});
        fillBoard(target, made);
        dlg.close();
        renderAll();
        save();
        toast(issues.length ? 'Đã điền bảng. Cần xem lại: ' + issues[0] : 'Đã điền bảng từ câu trả lời của AI.');
      } catch (error) { GDHomeShell.alert(error.message); }
    };
    byId('cmp-add-cat').onclick = async () => {
      const name = (await GDHomeShell.prompt('Tên hạng mục lớn (vd: VẬT LIỆU, CỬA, ĐIỆN NƯỚC):', '', {okText: 'Thêm'}))?.trim();
      if (!name) return;
      categoryFor(name);
      renderTree();
      save();
    };
    const tree = byId('cmp-tree');
    wireTreeDrag(tree);
    tree.onclick = e => {
      if (e.target.closest('[data-cat-del]')) {
        const id = e.target.closest('[data-cat]').dataset.cat;
        doc.categories = doc.categories.filter(c => c.id !== id);
        renderAll();
        save();
        return;
      }
      const btn = e.target.closest('[data-board]');
      if (!btn) return;
      current = btn.dataset.board;
      activeSlot = null;
      renderTree();
      renderSheet();
    };
    tree.addEventListener('change', e => {
      if (e.target.type !== 'color') return;
      const cat = doc.categories.find(c => c.id === e.target.closest('[data-cat]').dataset.cat);
      cat.color = e.target.value;
      save();
      renderSheet();
    });
    tree.addEventListener('dblclick', async e => {
      const span = e.target.closest('.cmp-cat-name');
      if (!span) return;
      const cat = doc.categories.find(c => c.id === span.closest('[data-cat]').dataset.cat);
      const name = (await GDHomeShell.prompt('Đổi tên hạng mục:', cat.name))?.trim();
      if (!name) return;
      cat.name = name.toUpperCase();
      renderAll();
      save();
    });

    byId('cmp-cat-select').onchange = e => { board().categoryId = e.target.value; renderAll(); save(); };
    document.querySelectorAll('.cmp-seg [data-cols]').forEach(btn => btn.onclick = async () => {
      const b = board(), n = Number(btn.dataset.cols);
      if (!b || b.columns.length === n) return;
      if (n === 3) b.columns.push(blankCol('Phương án C'));
      else {
        const last = b.columns[2];
        if ((last.pros.length || last.cons.length || last.image) && !await GDHomeShell.confirm({message: `Bỏ cột "${last.name}" để về bố cục 2 cột?`, okText: 'Bỏ cột', danger: true})) return;
        b.columns.pop();
      }
      renderSheet();
      save();
    });
    byId('cmp-approve').onclick = () => {
      const b = board();
      b.status = b.status === 'new' ? 'ok' : 'new';
      renderAll();
      save();
    };
    byId('cmp-delete').onclick = async () => {
      const b = board();
      if (!await GDHomeShell.confirm({title: 'Xoá bảng so sánh?', groups: [{items: [b.heading || b.idea]}], message: 'Ctrl+Z để hoàn tác.', okText: 'Xoá', danger: true})) return;
      doc.boards = doc.boards.filter(x => x !== b);
      current = doc.boards[0]?.id || null;
      renderAll();
      save();
    };
    byId('cmp-image-actions').onclick = e => {
      const btn = e.target.closest('[data-out]');
      if (!btn) return;
      btn.closest('details')?.removeAttribute('open');
      output(btn.dataset.out);
    };
    byId('cmp-undo').onclick = undo;
    byId('cmp-redo').onclick = redo;
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey) || document.querySelector('dialog[open]')) return;
      const key = e.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      if (e.target.closest('textarea, input, [contenteditable]')) return;   // trong ô chữ: hoàn tác chữ như thường
      e.preventDefault();
      if (key === 'y' || e.shiftKey) redo(); else undo();
    });

    const wrap = byId('cmp-sheet-wrap');
    wrap.addEventListener('input', e => { if (e.target.closest('[data-f]')) readField(e.target.closest('[data-f]')); });
    wrap.addEventListener('keydown', e => {
      // Dòng tiêu đề / tên: Enter = xong, không xuống dòng
      // Mô tả: Shift+Enter xuống dòng (dòng giá thành / tiêu chí)
      if (e.key === 'Enter' && e.target.matches('[contenteditable="plaintext-only"]') && !(e.shiftKey && e.target.dataset.f === 'desc')) { e.preventDefault(); e.target.blur(); }
    });
    wrap.addEventListener('focusin', e => { const slot = e.target.closest('.cs-img'); if (slot) selectSlot(Number(slot.dataset.col)); });
    // Ctrl+V ở bất kỳ đâu trên trang: có ảnh trong clipboard thì đưa vào ô ảnh đang chọn (hoặc ô trống đầu tiên)
    document.addEventListener('paste', e => {
      const b = board(), file = clipboardImage(e.clipboardData);
      if (b && file && !e.target.closest('#cmp-ideas, dialog')) {
        e.preventDefault();
        const col = activeSlot ?? b.columns.findIndex(c => !c.image);
        return col >= 0 ? uploadBlob(col, file) : toast('Bấm chọn ô ảnh muốn thay rồi Ctrl+V.');
      }
      const list = e.target.closest?.('ul[data-f]');
      if (list) {                                   // dán chữ vào danh sách: chỉ chữ thuần
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }
    });
    wrap.addEventListener('click', e => {
      const slot = e.target.closest('.cs-img');
      if (slot) selectSlot(Number(slot.dataset.col));
      const btn = e.target.closest('[data-img]');
      if (!btn) return;
      const col = Number(slot.dataset.col);
      if (btn.dataset.img === 'del') setImage(col, null);
      else if (btn.dataset.img === 'upload') byId('cmp-file').click();
      else if (btn.dataset.img === 'paste') pasteFromButton(col);
      else GDHomeAssets.openLibrary({onPick: item => { if (item.full) setImage(col, item.full); }});
    });
    byId('cmp-file').onchange = e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file && activeSlot !== null) uploadBlob(activeSlot, file);
    };
    new ResizeObserver(fit).observe(byId('cmp-stage'));
    document.fonts?.ready.then(() => { tighten(); fit(); });   // font Roboto Condensed tải xong thì đo lại cho vừa khổ
    document.addEventListener('visibilitychange', () => { if (!document.hidden) pollQueue(); });
  }

  async function start() {
    GDHomeShell.layout?.();
    wire();
    try {
      doc = await api('/api/compare');
      version = doc._version || 0;
      current = doc.boards[0]?.id || null;
      snapshot = docJson();
      renderAll();
      // Hàng đợi cũ (bản trước lưu trong trình duyệt) -> chuyển sang hàng đợi chạy nền
      if (doc.queue?.length) {
        post('/api/compare/queue', {ideas: doc.queue.map(q => q.idea), categories: doc.categories.map(c => c.name)}).then(applyQueue).catch(() => {});
        doc.queue = [];
        save({history: false});
      }
      pollQueue();
    } catch (error) {
      byId('cmp-empty').innerHTML = error.status === 401
        ? 'Cần đăng nhập. Mở <a href="/tools">Trang chủ công cụ</a> để đăng nhập Gmail rồi quay lại.'
        : esc(error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
