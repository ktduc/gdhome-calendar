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
  const DEFAULT_NAME = /^phương án [a-f]$/i;   // tên tạm cũ: coi như chưa đặt tên
  const blankCol = name => ({kicker: '', name, desc: '', stats: '', pros: [], cons: [], image: null});
  // Kết quả AI về: chữ anh đang có (kể cả sửa trong lúc AI chạy) luôn giữ, AI chỉ lấp ô trống; ảnh giữ nguyên
  function fillBoard(target, made) {
    target.columns = target.columns.map((col, i) => {
      const ai = made.columns[i];
      if (!ai) return col;
      const pick = f => (col[f] && !(f === 'name' && DEFAULT_NAME.test(col[f]))) ? col[f] : ai[f] || col[f];
      const list = f => col[f].length >= 3 ? col[f] : [...col[f], ...ai[f].filter(t => !col[f].includes(t))].slice(0, Math.max(3, Math.min(4, ai[f].length)));   // 3–4 ý theo AI
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
  // Bố cục: số phương án mỗi tờ. Tờ 2 PA = khổ dọc 10000×12500, tờ 3 PA = khổ ngang 14600×12500 (bản vẽ anh Đức, 1 px = 10 đơn vị)
  const LAYOUTS = {'2': [2], '3': [3], '2+2': [2, 2], '2+3': [2, 3], '3+2': [3, 2], '3+3': [3, 3]};
  const defaultLayout = n => n <= 2 ? [2] : n === 3 ? [3] : n === 4 ? [2, 2] : n === 5 ? [2, 3] : [3, 3];
  function layoutOf(b) {
    const key = (b.layout || []).join('+');
    return LAYOUTS[key] && LAYOUTS[key].reduce((x, y) => x + y, 0) === b.columns.length ? LAYOUTS[key] : defaultLayout(b.columns.length);
  }
  function sheetHtml(b) {
    const cat = catOf(b), layout = layoutOf(b);
    let start = 0;
    const pages = layout.map((n, p) => {
      const entries = b.columns.slice(start, start + n).map((c, j) => [c, start + j]);
      start += n;
      const cols = fn => `<div class="cs-grid" style="--n:${n}">${entries.map(([c, i]) => fn(c, i)).join('')}</div>`;
      return `<div class="cs-sheet ${n === 3 ? 'is-land' : ''}" data-page="${p}">
      <div class="cs-head">
        <div class="cs-logo"><img src="/gdhome-logo-sq.png" alt="GD HOME"></div>
        <div class="cs-title"><div contenteditable="plaintext-only" data-f="title" ${ph('SO SÁNH')}>${esc(b.title)}</div>
          <div contenteditable="plaintext-only" data-f="heading" ${ph('TIÊU ĐỀ SO SÁNH')}>${esc(b.heading)}</div></div>
        <div class="cs-tab"><span>${esc(cat.name)}</span></div>
      </div>
      <div class="cs-images">${cols((c, i) => `<div class="cs-img ${c.image ? '' : 'is-empty'} ${activeSlot === i ? 'is-target' : ''}" data-col="${i}" tabindex="0" title="Bấm chọn ô rồi Ctrl+V để dán ảnh (chụp màn hình hoặc file đã copy)">
        ${c.image ? `<img data-asset="${esc(c.image.full)}" alt="">` : '<span class="cs-img-hint">Bấm chọn ô · Ctrl+V để dán ảnh</span>'}
        <div class="cs-img-tools"><button type="button" data-img="lib">Thư viện</button><button type="button" data-img="upload">Tải ảnh</button><button type="button" data-img="paste">Dán</button>${c.image ? '<button type="button" data-img="del">Xoá</button>' : ''}</div></div>`)}</div>
      <div class="cs-band">${cols((c, i) => `<div data-col="${i}">
        <div class="cs-name" contenteditable="plaintext-only" data-f="name" ${ph('Gõ tên loại phương án (vd Ghế lưng cao)')}>${esc(DEFAULT_NAME.test(c.name) ? '' : c.name)}</div>
        <div class="cs-desc" contenteditable="plaintext-only" data-f="desc" ${ph('Mô tả ngắn · Shift+Enter xuống dòng (vd Giá thành: 1   Độ cứng: 2)')}>${esc([c.desc, c.stats].filter(Boolean).join('\n'))}</div></div>`)}</div>
      <div class="cs-body">${['pros', 'cons'].map(f => cols((c, i) => `<div data-col="${i}">
        ${f === 'pros' ? '<div class="cs-sec pros"><i>✓</i>ƯU ĐIỂM:</div>' : '<div class="cs-sec cons"><i>✕</i>NHƯỢC ĐIỂM:</div>'}
        <ul class="cs-list" contenteditable="true" data-f="${f}">${(c[f].length ? c[f] : ['']).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`)).join('')}</div>
    </div>`;
    });
    // Nhiều tờ: ghép cạnh nhau như bản vẽ, có vệt màu sát mép trên báo "còn tờ khác"
    return `<div class="cs-board ${layout.length > 1 ? 'is-multi' : ''} ${b.status === 'new' ? 'is-new' : ''}" id="cs-sheet" style="--cat:${esc(cat.color)}">${pages.join('')}</div>`;
  }

  // Luôn thu cả bộ tờ vừa vùng làm việc (khi xuất ảnh/PDF luôn đúng 100%)
  function fit() {
    const el = byId('cs-sheet'), stage = byId('cmp-stage');
    if (el) el.style.zoom = Math.min(1, (stage.clientWidth - 40) / el.offsetWidth, (stage.clientHeight - 40) / el.offsetHeight);
  }
  // Khổ cố định: nhiều dòng hơn thường lệ (4–5, tối đa ~7) thì dòng tự sát lại / chữ nhỏ dần cho vừa khổ, từng tờ riêng
  function tighten(root = byId('cs-sheet')) {
    for (const sheet of root ? root.querySelectorAll('.cs-sheet') : []) {
      const body = sheet.querySelector('.cs-body');
      let k = 1;
      sheet.style.setProperty('--k', k);
      while (body.scrollHeight > body.clientHeight + 1 && k > 0.6) sheet.style.setProperty('--k', k = Math.round((k - 0.04) * 100) / 100);
      sheet.classList.toggle('is-overflow', body.scrollHeight > body.clientHeight + 1);
    }
    // Tiêu đề dưới chữ SO SÁNH luôn 1 dòng: dài thì chữ nhỏ dần cho vừa (tối thiểu 12 px)
    for (const h of root ? root.querySelectorAll('.cs-title [data-f="heading"]') : []) {
      h.style.fontSize = '';
      let size = parseFloat(getComputedStyle(h).fontSize);
      while (h.scrollWidth > h.clientWidth + 1 && size > 12) h.style.fontSize = (size -= 0.5) + 'px';
    }
    // Nhiều tờ ghép: phần ƯU ĐIỂM cao bằng nhau để tiêu đề NHƯỢC ĐIỂM thẳng hàng qua các tờ
    const pros = root ? [...root.querySelectorAll('.cs-body > .cs-grid:first-child')] : [];
    if (pros.length > 1) {
      pros.forEach(g => { g.style.minHeight = ''; });
      const tallest = Math.max(...pros.map(g => g.offsetHeight));
      pros.forEach(g => { g.style.minHeight = tallest + 'px'; });
    }
  }

  function renderSheet() {
    const b = board();
    byId('cmp-toolbar').hidden = byId('cmp-aibar').hidden = !b;
    byId('cmp-empty').hidden = !!b;
    if (b && document.activeElement !== byId('cmp-notes')) byId('cmp-notes').value = b.notes || '';
    byId('cmp-sheet-wrap').innerHTML = b ? sheetHtml(b) : '';
    if (!b) return;
    byId('cmp-cat-select').innerHTML = doc.categories.map(c => `<option value="${esc(c.id)}" ${c.id === b.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    byId('cmp-layout').value = layoutOf(b).join('+');
    document.querySelectorAll('#cmp-image-actions [data-out^="copy-"]').forEach(el => { el.hidden = layoutOf(b).length < 2; });
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
    // Tiêu đề lặp ở mọi tờ: gõ ở tờ nào thì các tờ còn lại theo
    if (!colEl) document.querySelectorAll(`#cs-sheet [data-f="${f}"]`).forEach(other => { if (other !== el) other.textContent = b[f]; });
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
  async function uploadBlob(col, blob, {skipMark = false} = {}) {
    try {
      toast('Đang tải ảnh…');
      // Ảnh Gemini: tự xoá logo ngôi sao ở góc (xử lý trên máy, không gọi AI)
      const clean = !skipMark && await window.removeGeminiMark?.(blob).catch(() => null);
      if (clean) { blob = clean; toast('Đã tự xoá logo Gemini ở góc ảnh.'); }
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
  const WM_KEY = 'gd_cmp_watermark';
  const watermarkOn = () => { try { return localStorage.getItem(WM_KEY) !== '0'; } catch { return true; } };
  // perPage: PDF chụp từng tờ; không thì chụp cả bộ tờ ghép cạnh nhau (Copy ảnh / PNG)
  async function renderCanvas(b, perPage = false) {
    if (!window.html2canvas) throw new Error('Chưa tải được công cụ xuất ảnh, thử lại sau.');
    const box = Object.assign(document.createElement('div'), {className: 'cs-offscreen', innerHTML: sheetHtml(b)});
    const root = box.firstElementChild;
    root.removeAttribute('id');
    root.classList.add('is-exporting');
    document.body.append(box);
    try {
      await Promise.all([...root.querySelectorAll('img[data-asset]')].map(async img => {
        try { img.src = await GDHomeAssets.assetUrl(img.dataset.asset); await img.decode(); } catch { /* ảnh lỗi: để ô trống */ }
      }).concat(document.fonts.ready));
      await Promise.all([...root.querySelectorAll('img')].map(img => img.decode().catch(() => null)));
      tighten(root);
      // Nét sọc dày theo cỡ ảnh (khoảng cách sọc cũng giãn theo cỡ): ảnh 2 tờ rộng ~4900 px dán vào Zalo/Word bị thu nhỏ vẫn còn thấy sọc
      const shoot = async el => {
        const canvas = await html2canvas(el, {scale: 2, backgroundColor: '#e6e6e6', useCORS: true});
        return applyAntiEditWatermark(canvas, watermarkOn(), {alpha: 0.08, lineWidth: 1.6 * Math.max(1, Math.round(canvas.width / 1400))});
      };
      if (!perPage) return await shoot(root);
      const pages = [];
      for (const page of root.querySelectorAll('.cs-sheet')) pages.push(await shoot(page));
      return pages;
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
  // PDF: mỗi tờ 1 trang, mọi trang cùng chiều rộng 210 mm (tờ dọc cao 262,5, tờ ngang cao ~180) nên cuộn đọc đều nhau
  async function exportPdf(list, name) {
    if (!window.jspdf) throw new Error('Chưa tải được công cụ PDF, thử lại sau.');
    if (!list.length) throw new Error('Chưa có bảng nào để xuất.');
    let pdf = null;
    for (const [i, b] of list.entries()) {
      toast(`Đang xuất PDF ${i + 1}/${list.length}…`);
      for (const canvas of await renderCanvas(b, true)) {
        const size = [210, 210 * canvas.height / canvas.width];
        const orientation = size[1] >= size[0] ? 'portrait' : 'landscape';   // jsPDF tự đảo cạnh nếu sai hướng
        if (!pdf) pdf = new window.jspdf.jsPDF({unit: 'mm', format: size, orientation, compress: true});
        else pdf.addPage(size, orientation);
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, size[0], size[1]);
      }
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
      const unnamed = b.columns.filter(c => !c.name || DEFAULT_NAME.test(c.name)).length;
      if (unnamed && !await GDHomeShell.confirm({message: 'Còn ' + unnamed + ' phương án chưa có tên (viền đỏ trên bảng). Vẫn xuất ảnh?', okText: 'Vẫn xuất'})) return;
      // Bảng 2 tờ: copy riêng tờ trái / tờ phải
      const page = /^copy-(\d)$/.exec(mode);
      const canvas = page ? (await renderCanvas(b, true))[Number(page[1])] : await renderCanvas(b);
      if (!canvas) return toast('Bảng này chỉ có 1 tờ.');
      if (mode === 'png') return download(canvas.toDataURL('image/png'), fileName(b.heading, 'png'));
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      toast('Đã copy ảnh bảng so sánh – dán (Ctrl+V) vào Zalo, Word…');
    } catch (error) { GDHomeShell.alert('Không xuất được: ' + error.message); }
  }

  // Phong cách ảnh anh Đức thích: trong trẻo, ánh sáng có chiều sâu, sinh động (ảnh tạp chí nội thất), tránh ảnh xám, phẳng, kiểu 3D
  const PHOTO_STYLE = 'Style: bright, airy, crystal-clear editorial interior photography (premium interior magazine look). Natural daylight streaming in from a large window at the side, soft directional light with gentle shadows, visible depth and layered background with soft depth of field, crisp sharp details on the subject, fresh true-to-life colours with a slightly warm, inviting tone, light wood / warm white / beige palette, a few tasteful lifestyle props for a lively lived-in feel. Avoid flat, dull, grey, foggy, hazy, over-smoothed, plastic or CGI-looking renders.';
  // Prompt tạo ảnh: ảnh minh hoạ luôn vuông 1:1. Mỗi cột 1 prompt + 1 prompt gộp cho mọi cột
  const subjectOf = (b, c) => `"${c.name || b.heading}"${c.desc ? ' – ' + c.desc.replace(/\n/g, '; ') : ''}`;
  function allImagesPrompt(b) {
    return `Create ${b.columns.length} SEPARATE photorealistic images for an interior design comparison board (Vietnam interior fit-out), one image per option, in this order:
${b.columns.map((c, i) => `${i + 1}. ${subjectOf(b, c)}`).join('\n')}
Comparison topic: ${b.heading || b.idea || ''}.
All images must share the same camera angle, lighting and modern Vietnamese apartment setting so they compare fairly; each option clearly the main subject with realistic materials and construction details.
${PHOTO_STYLE}
Each image square 1:1. Output ${b.columns.length} individual images (not a grid, not a collage). No text, no labels, no watermark, no logo.`;
  }
  function imagePrompts(b) {
    // Gửi tiếp trong cùng cuộc trò chuyện sau ảnh ghép: Gemini vẽ lại đúng ô đó thành ảnh riêng, nét, cùng phong cách
    const ratio = '1:1 (square)';
    return b.columns.map((c, i) => `If the grid image you just made is above in this chat: output Panel ${i + 1} ALONE as its own image at the highest resolution you can (2K/4K), keeping exactly the same subject, materials, colours, camera angle, lighting and background as in the grid.
Otherwise create it from this description — photorealistic interior design photo for a product comparison board (Vietnam interior fit-out).
Subject: ${subjectOf(b, c)}.
Comparison topic: ${b.heading || b.idea || ''}.
Show this option clearly as the main subject with realistic materials and construction details, in a modern Vietnamese apartment.
${PHOTO_STYLE}
Aspect ratio ${ratio}. Exactly ONE image. No text, no labels, no watermark, no logo, no collage.`);
  }

  // Ảnh ghép: Gemini thường chỉ vẽ 1 ảnh mỗi lượt -> xin 1 ảnh chia ô (đồng bộ phong cách), web tự cắt vào từng cột
  // Chỉ dùng tỷ lệ Gemini có sẵn mà mỗi ô ra đúng hình vuông: 1:1 = lưới 2×2 (2–4 PA), 3:2 = lưới 3×2 (5–6 PA).
  // Ô thừa để trắng ở cuối (góc dưới phải) -> logo Gemini ở góc ảnh thường rơi vào ô trắng, không đè lên ảnh.
  const gridFor = n => n <= 4 ? [2, 2] : [3, 2];          // [số cột, số hàng] của ảnh ghép
  function collagePrompt(b) {
    const n = b.columns.length, [C, R] = gridFor(n), ratio = C === R ? '1:1' : '3:2';
    return `Create ONE single image (aspect ratio ${ratio}) laid out as a clean grid of ${C} columns × ${R} row(s) of equal square panels separated by thin pure white gutters, read left-to-right, top-to-bottom:
${b.columns.map((c, i) => `Panel ${i + 1}: ${subjectOf(b, c)}`).join('\n')}${n < C * R ? `\nLeave the last ${C * R - n} panel plain white.` : ''}
Comparison topic: ${b.heading || b.idea || ''}.
All panels photorealistic with the same camera angle, lighting and modern Vietnamese apartment setting so they compare fairly; each subject centered and fully inside its square panel with realistic materials and construction details.
${PHOTO_STYLE}
Render at the highest resolution available (2K or 4K) so each panel stays sharp after cropping.
No text, no labels, no numbers, no frames other than the white gutters, no watermark, no logo.`;
  }
  // Cắt ảnh ghép thành n ô: chia đều theo lưới, gọt viền trắng ở mép ô, rồi lấy hình vuông chính giữa
  async function splitCollage(blob, n) {
    const bmp = await createImageBitmap(blob), [C, R] = gridFor(n), W = bmp.width, H = bmp.height;
    const ctx = Object.assign(document.createElement('canvas'), {width: W, height: H}).getContext('2d', {willReadFrequently: true});
    ctx.drawImage(bmp, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const L = (x, y) => { const k = (y * W + x) * 4; return 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; };
    const whiteLine = (x0, y0, x1, y1) => {           // đường ngang/dọc gần như trắng tinh = khe giữa các ô
      let sum = 0, min = 255, n2 = 0;
      for (let t = 0; t <= 1; t += 1 / 40) { const l = L(Math.round(x0 + (x1 - x0) * t), Math.round(y0 + (y1 - y0) * t)); sum += l; min = Math.min(min, l); n2++; }
      return sum / n2 > 238 && min > 205;
    };
    const tiles = [];
    for (let i = 0; i < n; i++) {
      const cw = W / C, ch = H / R, col = i % C, row = (i / C) | 0;
      let x0 = Math.round(col * cw), x1 = Math.round((col + 1) * cw) - 1, y0 = Math.round(row * ch), y1 = Math.round((row + 1) * ch) - 1;
      const limit = 0.15 * Math.min(cw, ch);
      for (let k = 0; k < limit && whiteLine(x0, y0, x0, y1); k++) x0++;
      for (let k = 0; k < limit && whiteLine(x1, y0, x1, y1); k++) x1--;
      for (let k = 0; k < limit && whiteLine(x0, y0, x1, y0); k++) y0++;
      for (let k = 0; k < limit && whiteLine(x0, y1, x1, y1); k++) y1--;
      const s = Math.min(x1 - x0 + 1, y1 - y0 + 1), sx = x0 + ((x1 - x0 + 1 - s) >> 1), sy = y0 + ((y1 - y0 + 1 - s) >> 1);
      tiles.push(await new Promise(resolve => sharpTile(ctx.canvas, sx, sy, s).toBlob(resolve, 'image/png')));
    }
    return tiles;
  }
  // Ô nhỏ (ảnh Gemini 1K chia nhiều ô): phóng lên 1024 px bằng nội suy chất lượng cao rồi làm nét nhẹ (unsharp mask 3×3)
  function sharpTile(src, sx, sy, s) {
    const size = Math.max(s, 1024), out = Object.assign(document.createElement('canvas'), {width: size, height: size});
    const ctx = out.getContext('2d', {willReadFrequently: true});
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, sx, sy, s, s, 0, 0, size, size);
    if (size === s) return out;
    const img = ctx.getImageData(0, 0, size, size), d = img.data, o = new Uint8ClampedArray(d), amount = 0.6;
    for (let y = 1; y < size - 1; y++) for (let x = 1; x < size - 1; x++) {
      const k = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) {
        const blur = (o[k + c] * 4 + o[k - 4 + c] + o[k + 4 + c] + o[k - size * 4 + c] + o[k + size * 4 + c]) / 8;
        d[k + c] = o[k + c] + (o[k + c] - blur) * amount;
      }
    }
    ctx.putImageData(img, 0, 0);
    return out;
  }
  async function useCollage(blob) {
    const b = board();
    if (!b) return;
    try {
      toast('Đang tách ảnh ghép thành ' + b.columns.length + ' ô…');
      blob = await window.removeGeminiMark?.(blob).catch(() => null) || blob;     // logo Gemini nằm ở góc ảnh ghép: xoá trước khi cắt
      const tiles = await splitCollage(blob, b.columns.length);
      for (const [i, tile] of tiles.entries()) await uploadBlob(i, tile, {skipMark: true});   // đã xoá logo trên cả ảnh ghép
      toast('Đã đưa ' + tiles.length + ' ảnh vào các cột.');
    } catch (error) { GDHomeShell.alert('Không tách được ảnh ghép: ' + error.message); }
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
        columns: [blankCol(''), blankCol('')], layout: [2], idea: '', status: 'new', notes: '', createdAt: new Date().toISOString()};
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
        byId('cmp-img-all').value = allImagesPrompt(b);
        byId('cmp-img-collage').value = collagePrompt(b);
        byId('cmp-img-prompts').innerHTML = imagePrompts(b).map((text, i) => `<div class="cmp-img-prompt"><div><b>Cột ${i + 1}: ${esc(b.columns[i].name || '')}</b>
          <button type="button" class="gd-ask-btn" data-pr="copy-img" data-i="${i}">📋 Copy prompt ảnh</button></div><textarea readonly rows="3">${esc(text)}</textarea></div>`).join('');
        dlg.dataset.board = b.id;
        dlg.showModal();
      } catch (error) { GDHomeShell.alert(error.message); }
    };
    // Ctrl+V ảnh khi hộp prompt đang mở = ảnh ghép, tự tách vào các cột
    dlg.addEventListener('paste', e => {
      const file = clipboardImage(e.clipboardData);
      if (file) { e.preventDefault(); useCollage(file); }
    });
    dlg.onclick = async e => {
      const act = e.target.closest('[data-pr]')?.dataset.pr;
      if (act === 'close') return dlg.close();
      if (act === 'paste-collage') {
        try {
          for (const item of await navigator.clipboard.read()) {
            const type = item.types.find(t => t.startsWith('image/'));
            if (type) return useCollage(await item.getType(type));
          }
          return toast('Clipboard chưa có ảnh. Copy ảnh ghép Gemini vẽ rồi bấm lại (hoặc Ctrl+V).');
        } catch { return toast('Trình duyệt chặn đọc clipboard: nhấn Ctrl+V khi hộp này đang mở.'); }
      }
      if (act === 'copy' || act === 'copy-img' || act === 'copy-all-img' || act === 'copy-collage') {
        const area = act === 'copy' ? byId('cmp-prompt-text') : act === 'copy-all-img' ? byId('cmp-img-all') : act === 'copy-collage' ? byId('cmp-img-collage') : e.target.closest('.cmp-img-prompt').querySelector('textarea');
        try { await navigator.clipboard.writeText(area.value); }
        catch { area.select(); document.execCommand('copy'); }
        return toast({copy: 'Đã copy prompt chữ – dán vào ChatGPT / Claude / Gemini.', 'copy-img': 'Đã copy prompt ảnh – gửi riêng để AI vẽ 1 ảnh rời.',
          'copy-all-img': 'Đã copy prompt nhiều ảnh rời.', 'copy-collage': 'Đã copy prompt ảnh ghép – dán vào Gemini, vẽ xong copy ảnh rồi bấm Dán ảnh ghép.'}[act]);
      }
      if (act !== 'apply') return;
      const target = doc.boards.find(x => x.id === dlg.dataset.board);
      if (!target) return dlg.close();
      // Ô trả lời trống: hiểu là vừa copy câu trả lời của AI khác -> tự lấy từ clipboard (như Ctrl+V)
      const answer = byId('cmp-prompt-answer');
      if (!answer.value.trim()) {
        try { answer.value = await navigator.clipboard.readText(); }
        catch { return toast('Trình duyệt chặn đọc clipboard: bấm vào ô trả lời, Ctrl+V rồi bấm Điền bảng.'); }
        if (!answer.value.trim()) return toast('Clipboard đang trống: copy câu trả lời của AI rồi bấm lại.');
      }
      try {
        const {board: made, issues} = await post('/api/compare/import', {board: target, raw: answer.value});
        fillBoard(target, made);
        renderAll();
        save();
        // Giữ hộp mở để làm tiếp phần ảnh: prompt ảnh ghép dựng lại theo tên/mô tả vừa điền rồi copy sẵn
        byId('cmp-img-collage').value = collagePrompt(target);
        byId('cmp-img-all').value = allImagesPrompt(target);
        let copied = true;
        try { await navigator.clipboard.writeText(byId('cmp-img-collage').value); }
        catch { copied = false; byId('cmp-img-collage').select(); }
        const done = issues.length ? 'Đã điền bảng (cần xem lại: ' + issues[0] + ').' : 'Đã điền bảng.';
        toast(done + (copied ? ' Đã copy sẵn prompt ảnh ghép – dán vào Gemini.' : ' Bấm Copy prompt ảnh ghép để lấy prompt ảnh.'));
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
    // Số phương án + thứ tự tờ: thêm cột trống ở cuối, hoặc bỏ cột cuối (hỏi nếu cột đã có nội dung)
    byId('cmp-layout').onchange = async e => {
      const b = board(), layout = LAYOUTS[e.target.value], n = layout.reduce((x, y) => x + y, 0);
      if (!b) return;
      const removed = b.columns.slice(n);
      const filled = removed.filter(c => c.pros.length || c.cons.length || c.image || c.desc);
      if (filled.length && !await GDHomeShell.confirm({message: 'Bỏ ' + removed.length + ' phương án cuối: ' + removed.map(c => c.name).join(', ') + '?', okText: 'Bỏ', danger: true})) return renderSheet();
      b.columns = b.columns.slice(0, n);
      while (b.columns.length < n) b.columns.push(blankCol(''));
      b.layout = layout;
      renderSheet();
      save();
    };
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
    // Sọc chìm chống chỉnh sửa (giống Chốt mã): mặc định bật, nhớ theo máy
    byId('cmp-watermark').checked = watermarkOn();
    byId('cmp-watermark').onchange = e => { try { localStorage.setItem(WM_KEY, e.target.checked ? '1' : '0'); } catch { /* bỏ qua */ } };
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
