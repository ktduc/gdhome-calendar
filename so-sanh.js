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
  let zoomFit = true, activeSlot = null;

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

  // ---------------------------------------------------------------- HÀNG ĐỢI AI (server làm nền)
  function applyQueue(view) {
    queue = view;
    clockSkew = Date.now() - view.now;
    // Nhận các bảng đã xong vào danh mục rồi báo server bỏ khỏi hàng đợi
    const done = view.jobs.filter(j => j.state === 'done' && j.board);
    if (done.length) {
      for (const job of done) {
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
      <span>${esc(j.idea)}${j.state === 'error' ? `<em>${esc(j.error)}</em>` : j.state === 'running' ? `<em>${esc(j.step || '')}</em>` : ''}</span>
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
    return `<div class="cs-sheet ${b.status === 'new' ? 'is-new' : ''}" id="cs-sheet" style="--cat:${esc(cat.color)}">
      <div class="cs-head">
        <div class="cs-logo"><img src="/gdhome-icon.png" alt=""><b>GD HOME</b></div>
        <div class="cs-title"><div contenteditable="plaintext-only" data-f="title" ${ph('SO SÁNH')}>${esc(b.title)}</div>
          <div contenteditable="plaintext-only" data-f="heading" ${ph('TIÊU ĐỀ SO SÁNH')}>${esc(b.heading)}</div></div>
        <div class="cs-tab"><span>${esc(cat.name)}</span></div>
      </div>
      <div class="cs-images">${cols((c, i) => `<div class="cs-img ${c.image ? '' : 'is-empty'} ${activeSlot === i ? 'is-target' : ''}" data-col="${i}" tabindex="0" title="Bấm chọn ô rồi Ctrl+V để dán ảnh (chụp màn hình hoặc file đã copy)">
        ${c.image ? `<img data-asset="${esc(c.image.full)}" alt="">` : '<span class="cs-img-hint">Bấm chọn ô · Ctrl+V để dán ảnh</span>'}
        <div class="cs-img-tools"><button type="button" data-img="lib">Thư viện</button><button type="button" data-img="upload">Tải ảnh</button><button type="button" data-img="paste">Dán</button>${c.image ? '<button type="button" data-img="del">Xoá</button>' : ''}</div></div>`)}</div>
      <div class="cs-band">${cols((c, i) => `<div data-col="${i}">
        <div class="cs-kicker" contenteditable="plaintext-only" data-f="kicker" ${ph('(Phương án A:)')}>${esc(c.kicker)}</div>
        <div class="cs-name" contenteditable="plaintext-only" data-f="name" ${ph('Tên phương án')}>${esc(c.name)}</div>
        <div class="cs-desc" contenteditable="plaintext-only" data-f="desc" ${ph('Mô tả ngắn')}>${esc(c.desc)}</div>
        <div class="cs-stats" contenteditable="plaintext-only" data-f="stats" ${ph('(Giá thành: 1   Độ cứng: 2)')}>${esc(c.stats)}</div></div>`)}</div>
      <div class="cs-body">${cols((c, i) => `<div data-col="${i}">
        <div class="cs-sec pros"><i>✓</i>ƯU ĐIỂM:</div>
        <ul class="cs-list" contenteditable="true" data-f="pros">${(c.pros.length ? c.pros : ['']).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        <div class="cs-sec cons"><i>✕</i>NHƯỢC ĐIỂM:</div>
        <ul class="cs-list" contenteditable="true" data-f="cons">${(c.cons.length ? c.cons : ['']).map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>`)}</div>
    </div>`;
  }

  // Khổ thiết kế 1000px: "Vừa khung" thu nhỏ theo vùng làm việc, "100%" để sửa kỹ (khi xuất ảnh luôn 100%)
  function fit() {
    const sheet = byId('cs-sheet');
    if (sheet) sheet.style.zoom = zoomFit ? Math.min(1, (byId('cmp-stage').clientWidth - 40) / 1000) : 1;
    document.querySelectorAll('[data-zoom]').forEach(btn => btn.classList.toggle('active', (btn.dataset.zoom === 'fit') === zoomFit));
  }

  function renderSheet() {
    const b = board();
    byId('cmp-toolbar').hidden = !b;
    byId('cmp-empty').hidden = !!b;
    byId('cmp-sheet-wrap').innerHTML = b ? sheetHtml(b) : '';
    if (!b) return;
    byId('cmp-cat-select').innerHTML = doc.categories.map(c => `<option value="${esc(c.id)}" ${c.id === b.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    document.querySelectorAll('.cmp-seg [data-cols]').forEach(btn => btn.classList.toggle('active', Number(btn.dataset.cols) === b.columns.length));
    byId('cmp-approve').textContent = b.status === 'new' ? '✓ Duyệt OK' : '↺ Đánh dấu cần xem lại';
    fit();
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
      else col[f] = el.textContent.trim();
    }
    if (f === 'heading') renderTree();
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

  // ---------------------------------------------------------------- ẢNH XUẤT (Copy / Tải PNG)
  async function renderCanvas() {
    const sheet = byId('cs-sheet');
    if (!sheet || !window.html2canvas) throw new Error('Chưa tải được công cụ xuất ảnh, thử lại sau.');
    sheet.classList.add('is-exporting');
    sheet.style.zoom = 1;
    try {
      await Promise.all([...sheet.querySelectorAll('img')].map(img => img.complete ? null : img.decode().catch(() => null)));
      return await html2canvas(sheet, {scale: 2, backgroundColor: '#e6e6e6', useCORS: true});
    } finally { sheet.classList.remove('is-exporting'); fit(); }
  }
  async function exportPng() {
    try {
      const canvas = await renderCanvas(), b = board();
      const a = document.createElement('a');
      a.download = 'So-sanh_' + (b.heading || 'bang').replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) + '.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (error) { GDHomeShell.alert('Lỗi xuất ảnh: ' + error.message); }
  }
  async function copyPng() {
    try {
      const canvas = await renderCanvas();
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      await navigator.clipboard.write([new ClipboardItem({'image/png': blob})]);
      toast('Đã copy ảnh bảng so sánh – dán (Ctrl+V) vào Zalo, Word…');
    } catch (error) { GDHomeShell.alert('Không copy được ảnh: ' + error.message); }
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
      if (n === 3) b.columns.push({kicker: b.columns[0].kicker ? 'PHƯƠNG ÁN C:' : '', name: 'Phương án C', desc: '', stats: '', pros: [], cons: [], image: null});
      else {
        const last = b.columns[2];
        if ((last.pros.length || last.cons.length || last.image) && !await GDHomeShell.confirm({message: `Bỏ cột "${last.name}" để về bố cục 2 cột?`, okText: 'Bỏ cột', danger: true})) return;
        b.columns.pop();
      }
      renderSheet();
      save();
    });
    document.querySelectorAll('[data-zoom]').forEach(btn => btn.onclick = () => { zoomFit = btn.dataset.zoom === 'fit'; fit(); });
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
    byId('cmp-export').onclick = exportPng;
    byId('cmp-copy').onclick = copyPng;
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
      if (e.key === 'Enter' && e.target.matches('[contenteditable="plaintext-only"]')) { e.preventDefault(); e.target.blur(); }
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
