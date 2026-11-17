// =========================================================================
// GD HOME - BẢNG SO SÁNH (/so-sanh)
// Trái: ô nhập hàng loạt ý tưởng -> hàng đợi AI (làm lần lượt), danh mục hạng mục lớn -> các bảng.
// Phải: dàn trang 2/3 cột giống mẫu GD HOME, sửa trực tiếp, ảnh từ Dữ liệu dùng chung / tải lên, xuất PNG.
// =========================================================================
(() => {
  const byId = id => document.getElementById(id);
  const esc = value => GDHomeShell.escape(value);
  const toast = message => GDHomeShell.toast(message);
  const PALETTE = ['#7d8f69', '#7a2e2e', '#4d6188', '#8c7d6b', '#5f7f8c', '#9a6b3f', '#6b5b8c'];
  let doc = null, version = 0, current = null, saveTimer = null, running = false;

  async function api(url, options = {}) {
    const res = await fetch(url, {...options, headers: GDHomeShell.authHeaders()});
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(json.message || 'Lỗi ' + res.status), {status: res.status});
    return json;
  }

  // ---------------------------------------------------------------- LƯU
  function setStatus(state) { GDHomeShell.saveStatus(byId('save-status'), state); }
  function save() {
    setStatus('pending');
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      setStatus('saving');
      try {
        const saved = await api('/api/compare', {method: 'POST', body: JSON.stringify({...doc, _baseVersion: version})});
        version = saved._version;
        setStatus('saved');
      } catch (error) {
        setStatus('error');
        GDHomeShell.alert(error.message);
      }
    }, 700);
  }

  const board = () => doc.boards.find(b => b.id === current);
  const catOf = b => doc.categories.find(c => c.id === b.categoryId) || {name: b.category || 'KHÁC', color: '#8c7d6b'};

  // ---------------------------------------------------------------- HÀNG ĐỢI AI
  function categoryFor(name) {
    const key = String(name || '').trim().toUpperCase() || 'KHÁC';
    let cat = doc.categories.find(c => c.name === key);
    if (!cat) {
      cat = {id: 'cat-' + Math.random().toString(36).slice(2, 10), name: key, color: PALETTE[doc.categories.length % PALETTE.length]};
      doc.categories.push(cat);
    }
    return cat;
  }

  async function runQueue() {
    if (running) return;
    running = true;
    try {
      for (;;) {
        const job = doc.queue.find(q => !q.error);
        if (!job) break;
        job.running = true;
        renderQueue();
        try {
          const {board: made, issues} = await api('/api/ai/compare', {method: 'POST',
            body: JSON.stringify({idea: job.idea, categories: doc.categories.map(c => c.name)})});
          made.categoryId = categoryFor(made.category).id;
          made.status = 'new';
          doc.boards.unshift(made);
          doc.queue = doc.queue.filter(q => q !== job);
          if (issues?.length) toast('Bảng "' + made.heading + '" cần xem lại: ' + issues[0]);
          if (!current) current = made.id;
          renderAll();
          save();
        } catch (error) {
          job.running = false;
          job.error = error.message;
          renderQueue();
          save();
          if (error.status === 400 || error.status === 401) break;   // chưa kết nối AI / chưa đăng nhập: dừng cả hàng đợi
        }
      }
    } finally { running = false; renderQueue(); }
  }

  function renderQueue() {
    byId('cmp-queue').innerHTML = doc.queue.map(q => `<li class="${q.running ? 'is-running' : q.error ? 'is-error' : ''}" data-id="${esc(q.id)}" title="${esc(q.error || q.idea)}">
      ${q.running ? '⏳' : q.error ? '⚠' : '•'} <span>${esc(q.idea)}</span>
      ${q.error ? '<button type="button" data-q="retry" title="Thử lại">↻</button>' : ''}
      ${q.running ? '' : '<button type="button" data-q="del" title="Bỏ khỏi hàng đợi">×</button>'}</li>`).join('');
  }

  // ---------------------------------------------------------------- DANH MỤC
  function renderTree() {
    byId('cmp-tree').innerHTML = doc.categories.map(cat => {
      const boards = doc.boards.filter(b => b.categoryId === cat.id);
      const fresh = boards.filter(b => b.status === 'new'), ok = boards.filter(b => b.status !== 'new');
      const item = b => `<li class="${b.status === 'new' ? 'is-new' : ''} ${b.id === current ? 'is-active' : ''}"><button type="button" data-board="${esc(b.id)}">${esc(b.heading || b.idea || 'Bảng chưa đặt tên')}</button></li>`;
      return `<section class="cmp-cat" data-cat="${esc(cat.id)}">
        <div class="cmp-cat-head"><input type="color" value="${esc(cat.color)}" title="Màu góc hạng mục" aria-label="Màu hạng mục ${esc(cat.name)}">
          <span title="Nháy đúp để đổi tên">${esc(cat.name)}</span><small>${boards.length}</small></div>
        <ul class="cmp-boards">${fresh.map(item).join('')}${fresh.length && ok.length ? '<li class="cmp-sep" aria-hidden="true"></li>' : ''}${ok.map(item).join('')}</ul>
      </section>`;
    }).join('');
  }

  // ---------------------------------------------------------------- DÀN TRANG
  const ph = (text) => `data-ph="${esc(text)}"`;
  function sheetHtml(b) {
    const cat = catOf(b), n = b.columns.length;
    const cols = (fn) => `<div class="cs-grid" style="--n:${n}">${b.columns.map(fn).join('')}</div>`;
    return `<div class="cs-sheet ${b.status === 'new' ? 'is-new' : ''}" id="cs-sheet" style="--cat:${esc(cat.color)}">
      <div class="cs-head">
        <div class="cs-logo"><img src="/gdhome-icon.png" alt=""><b>GD HOME</b></div>
        <div class="cs-title"><div contenteditable="plaintext-only" data-f="title" ${ph('SO SÁNH')}>${esc(b.title)}</div>
          <div contenteditable="plaintext-only" data-f="heading" ${ph('TIÊU ĐỀ SO SÁNH')}>${esc(b.heading)}</div></div>
        <div class="cs-tab"><span>${esc(cat.name)}</span></div>
      </div>
      <div class="cs-images">${cols((c, i) => `<div class="cs-img ${c.image ? '' : 'is-empty'}" data-col="${i}" tabindex="0" title="Ctrl+V để dán ảnh">
        ${c.image ? `<img data-asset="${esc(c.image.full)}" alt="">` : ''}
        <div class="cs-img-tools"><button type="button" data-img="lib">Thư viện</button><button type="button" data-img="upload">Tải ảnh</button>${c.image ? '<button type="button" data-img="del">Xoá</button>' : ''}</div></div>`)}</div>
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

  // Khổ thiết kế 1000px: thu nhỏ cho vừa vùng làm việc (khi xuất PNG đặt lại 100%)
  function fit() {
    const sheet = byId('cs-sheet');
    if (sheet) sheet.style.zoom = Math.min(1, (byId('cmp-stage').clientWidth - 40) / 1000);
  }

  async function renderSheet() {
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

  function renderAll() { renderQueue(); renderTree(); renderSheet(); }

  // Sửa trực tiếp trên bảng -> cập nhật dữ liệu
  function readField(el) {
    const b = board();
    if (!b) return;
    const f = el.dataset.f, colEl = el.closest('[data-col]');
    if (!colEl) { b[f] = el.textContent.trim(); }
    else {
      const col = b.columns[Number(colEl.dataset.col)];
      // Xoá hết dòng thì trình duyệt có thể bỏ thẻ <li>: khi đó tách theo xuống dòng
      if (f === 'pros' || f === 'cons') col[f] = (el.querySelector('li') ? [...el.querySelectorAll('li')].map(li => li.textContent) : el.innerText.split('\n'))
        .map(s => s.trim()).filter(Boolean);
      else col[f] = el.textContent.trim();
    }
    if (f === 'heading') renderTree();
    save();
  }

  // ---------------------------------------------------------------- ẢNH
  let imageCol = null;
  async function setImage(col, full) {
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
      await setImage(col, await GDHomeAssets.storeAsset(full));
    } catch (error) { GDHomeShell.alert('Không tải được ảnh: ' + error.message); }
  }

  // ---------------------------------------------------------------- XUẤT PNG
  async function exportPng() {
    const sheet = byId('cs-sheet'), b = board();
    if (!sheet || !window.html2canvas) return GDHomeShell.alert('Chưa tải được công cụ xuất ảnh, thử lại sau.');
    sheet.classList.add('is-exporting');
    sheet.style.zoom = 1;
    try {
      await Promise.all([...sheet.querySelectorAll('img')].map(img => img.complete ? null : img.decode().catch(() => null)));
      const canvas = await html2canvas(sheet, {scale: 2, backgroundColor: '#e6e6e6', useCORS: true});
      const a = document.createElement('a');
      a.download = 'So-sanh_' + (b.heading || 'bang').replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) + '.png';
      a.href = canvas.toDataURL('image/png');
      a.click();
    } catch (error) { GDHomeShell.alert('Lỗi xuất ảnh: ' + error.message); }
    finally { sheet.classList.remove('is-exporting'); fit(); }
  }

  // ---------------------------------------------------------------- SỰ KIỆN
  function wire() {
    byId('cmp-run').onclick = () => {
      const ideas = byId('cmp-ideas').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!ideas.length) return toast('Nhập ít nhất 1 dòng ý tưởng so sánh.');
      doc.queue.push(...ideas.map(idea => ({id: Math.random().toString(36).slice(2), idea})));
      byId('cmp-ideas').value = '';
      renderQueue();
      save();
      runQueue();
    };
    byId('cmp-queue').onclick = e => {
      const btn = e.target.closest('[data-q]'), li = btn && btn.closest('li');
      const job = li && doc.queue.find(q => q.id === li.dataset.id);
      if (!job) return;
      if (btn.dataset.q === 'del') doc.queue = doc.queue.filter(q => q !== job);
      else { delete job.error; runQueue(); }
      renderQueue();
      save();
    };
    byId('cmp-add-cat').onclick = async () => {
      const name = (await GDHomeShell.prompt('Tên hạng mục lớn (vd: VẬT LIỆU, CỬA, ĐIỆN NƯỚC):', '', {okText: 'Thêm'}))?.trim();
      if (!name) return;
      categoryFor(name);
      renderTree();
      save();
    };
    const tree = byId('cmp-tree');
    tree.onclick = e => {
      const btn = e.target.closest('[data-board]');
      if (!btn) return;
      current = btn.dataset.board;
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
      const span = e.target.closest('.cmp-cat-head span');
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
    byId('cmp-approve').onclick = () => {
      const b = board();
      b.status = b.status === 'new' ? 'ok' : 'new';
      renderAll();
      save();
    };
    byId('cmp-delete').onclick = async () => {
      const b = board();
      if (!await GDHomeShell.confirm({title: 'Xoá bảng so sánh?', groups: [{items: [b.heading || b.idea]}], okText: 'Xoá', danger: true})) return;
      doc.boards = doc.boards.filter(x => x !== b);
      current = doc.boards[0]?.id || null;
      renderAll();
      save();
    };
    byId('cmp-export').onclick = exportPng;

    const wrap = byId('cmp-sheet-wrap');
    wrap.addEventListener('input', e => { if (e.target.closest('[data-f]')) readField(e.target.closest('[data-f]')); });
    wrap.addEventListener('keydown', e => {
      // Dòng tiêu đề / tên: Enter = xong, không xuống dòng
      if (e.key === 'Enter' && e.target.matches('[contenteditable="plaintext-only"]')) { e.preventDefault(); e.target.blur(); }
    });
    wrap.addEventListener('paste', e => {
      const slot = e.target.closest('.cs-img');
      const file = [...(e.clipboardData?.files || [])].find(f => f.type.startsWith('image/'));
      if (slot && file) { e.preventDefault(); uploadBlob(Number(slot.dataset.col), file); return; }
      const list = e.target.closest('ul[data-f]');
      if (list) {                                   // dán chữ vào danh sách: chỉ chữ thuần, mỗi dòng 1 ý
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
      }
    });
    wrap.addEventListener('click', e => {
      const btn = e.target.closest('[data-img]');
      if (!btn) return;
      imageCol = Number(btn.closest('.cs-img').dataset.col);
      if (btn.dataset.img === 'del') setImage(imageCol, null);
      else if (btn.dataset.img === 'upload') byId('cmp-file').click();
      else GDHomeAssets.openLibrary({onPick: item => { if (item.full) setImage(imageCol, item.full); }});
    });
    byId('cmp-file').onchange = e => {
      const file = e.target.files[0];
      e.target.value = '';
      if (file && imageCol !== null) uploadBlob(imageCol, file);
    };
    new ResizeObserver(fit).observe(byId('cmp-stage'));
  }

  async function start() {
    GDHomeShell.layout?.();
    wire();
    try {
      doc = await api('/api/compare');
      version = doc._version || 0;
      current = doc.boards[0]?.id || null;
      renderAll();
      if (doc.queue.length) runQueue();                 // tiếp tục hàng đợi còn dở
    } catch (error) {
      byId('cmp-empty').innerHTML = error.status === 401
        ? 'Cần đăng nhập. Mở <a href="/tools">Trang chủ công cụ</a> để đăng nhập Gmail rồi quay lại.'
        : esc(error.message);
    }
  }

  document.addEventListener('DOMContentLoaded', start);
})();
