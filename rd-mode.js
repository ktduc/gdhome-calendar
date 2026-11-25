// Chế độ R&D (chỉ admin): bấm 🎯 rồi bấm vào bất kỳ thành phần nào trên trang để ghi góp ý.
// Góp ý lưu trên máy (gom được nhiều trang), "Copy prompt" xuất thành đoạn chữ dán vào khung chat Claude để sửa.
(() => {
  if (window.GDHomeRd) return;
  const NOTES = 'gdhome_rd_notes', ON = 'gdhome_rd_on';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const page = () => location.pathname + location.search;
  const load = () => { try { return JSON.parse(localStorage.getItem(NOTES) || '[]'); } catch { return []; } };
  const save = list => { try { localStorage.setItem(NOTES, JSON.stringify(list)); } catch {} };
  let notes = load(), picking = true, hovered = null, panel, box, pop, timer;

  // Bộ chọn CSS ngắn, ưu tiên id / data-* để Claude tìm đúng chỗ trong mã nguồn
  const KEY_ATTRS = ['data-f', 'data-row', 'data-sec', 'data-tab', 'data-action', 'data-mode', 'data-q', 'data-sort', 'data-cat', 'name', 'aria-label'];
  function selectorOf(el) {
    const parts = [];
    for (let node = el; node && node !== document.body && node.nodeType === 1 && parts.length < 5; node = node.parentElement) {
      if (node.id && !/\d{5,}/.test(node.id)) { parts.unshift('#' + CSS.escape(node.id)); break; }
      let s = node.tagName.toLowerCase();
      const attr = KEY_ATTRS.find(a => node.getAttribute(a));
      if (attr) s += '[' + attr + '="' + node.getAttribute(attr).slice(0, 40).replace(/"/g, '\\"') + '"]';
      else {
        const classes = [...node.classList].filter(c => !/^(is-|has-|rd-)/.test(c)).slice(0, 2);
        if (classes.length) s += '.' + classes.map(c => CSS.escape(c)).join('.');
        const kin = node.parentElement ? [...node.parentElement.children] : [];
        const same = kin.filter(x => x.tagName === node.tagName);
        if (kin.filter(x => x.tagName === node.tagName && classes.every(c => x.classList.contains(c))).length > 1) s += ':nth-of-type(' + (same.indexOf(node) + 1) + ')';
      }
      parts.unshift(s);
    }
    return parts.join(' > ');
  }
  function describe(el) {
    const text = (el.innerText || el.value || '').replace(/\s+/g, ' ').trim().slice(0, 90);
    const hint = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('placeholder') || '';
    const r = el.getBoundingClientRect();
    return {selector: selectorOf(el), tag: el.tagName.toLowerCase(), text, hint, size: Math.round(r.width) + '×' + Math.round(r.height)};
  }
  const findEl = note => { try { return note.page === page() && document.querySelector(note.selector); } catch { return null; } };
  const ours = el => el?.closest?.('.rd-ui');

  function ui() {
    box = document.createElement('div');
    box.className = 'rd-ui rd-hover';
    panel = document.createElement('div');
    panel.className = 'rd-ui rd-panel';
    document.body.append(box, panel);
    panel.addEventListener('click', onPanel);
    paint();
  }
  function paint() {
    const here = notes.filter(n => n.page === page()).length;
    panel.innerHTML = '<div class="rd-head"><b>🧪 R&amp;D</b><span>' + notes.length + ' góp ý' + (notes.length !== here ? ' · ' + here + ' trang này' : '') + '</span></div>' +
      '<div class="rd-actions"><button type="button" data-rd="pick" aria-pressed="' + picking + '" title="Bật: bấm vào thành phần để góp ý · Tắt: dùng giao diện bình thường (Esc)">🎯 ' + (picking ? 'Đang chọn' : 'Chọn') + '</button>' +
      '<button type="button" data-rd="copy" ' + (notes.length ? '' : 'disabled') + '>📋 Copy prompt</button>' +
      '<button type="button" data-rd="list" title="Xem / xoá từng góp ý">☰</button>' +
      '<button type="button" data-rd="clear" title="Xoá hết góp ý" ' + (notes.length ? '' : 'disabled') + '>🗑</button>' +
      '<button type="button" data-rd="exit" title="Thoát chế độ R&amp;D">✕</button></div>' +
      (panel.classList.contains('is-list') ? '<ol class="rd-list">' + notes.map((n, i) => '<li><span><b>' + esc(n.page) + '</b> · ' + esc(n.comment) + '</span><button type="button" data-del="' + i + '" aria-label="Xoá góp ý">✕</button></li>').join('') + '</ol>' : '');
    pins();
  }
  function pins() {
    document.querySelectorAll('.rd-pin').forEach(p => p.remove());
    notes.forEach((n, i) => {
      const el = findEl(n);
      if (!el) return;
      const r = el.getBoundingClientRect();
      if (!r.width && !r.height) return;
      const pin = document.createElement('button');
      pin.type = 'button';
      pin.className = 'rd-ui rd-pin';
      pin.textContent = i + 1;
      pin.title = n.comment;
      pin.style.left = Math.max(0, r.left - 9) + 'px';
      pin.style.top = Math.max(0, r.top - 9) + 'px';
      pin.onclick = () => edit(el, i);
      document.body.append(pin);
    });
  }

  function edit(el, index) {
    pop?.remove();
    const note = index != null ? notes[index] : null, info = note || describe(el);
    const r = el.getBoundingClientRect();
    pop = document.createElement('div');
    pop.className = 'rd-ui rd-pop';
    pop.innerHTML = '<div class="rd-target">' + esc(info.selector) + (info.text ? '<br><i>“' + esc(info.text) + '”</i>' : '') + '</div>' +
      '<textarea placeholder="Góp ý cho thành phần này… (Ctrl+Enter để lưu)">' + esc(note?.comment || '') + '</textarea>' +
      '<div class="rd-actions">' + (!note && el.parentElement !== document.body ? '<button type="button" data-act="up" title="Chọn rộng ra khối chứa thành phần này">⬆ Khối cha</button>' : '') + (note ? '<button type="button" data-act="del">Xoá</button>' : '') + '<button type="button" data-act="cancel">Huỷ</button><button type="button" data-act="ok" class="rd-ok">Lưu</button></div>';
    document.body.append(pop);
    pop.style.left = Math.min(innerWidth - pop.offsetWidth - 8, Math.max(8, r.left)) + 'px';
    pop.style.top = (r.bottom + pop.offsetHeight + 8 < innerHeight ? r.bottom + 6 : Math.max(8, r.top - pop.offsetHeight - 6)) + 'px';
    const area = pop.querySelector('textarea');
    area.focus();
    const close = () => { pop?.remove(); pop = null; };
    const commit = () => {
      const comment = area.value.trim();
      if (!comment) return close();
      if (note) note.comment = comment;
      else notes.push({...info, page: page(), title: document.title, viewport: innerWidth + '×' + innerHeight, comment, at: Date.now()});
      save(notes); close(); paint();
    };
    area.onkeydown = e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) commit(); if (e.key === 'Escape') { e.stopPropagation(); close(); } };
    pop.onclick = e => {
      const act = e.target.dataset.act;
      if (act === 'ok') commit();
      if (act === 'cancel') close();
      if (act === 'up') edit(el.parentElement);
      if (act === 'del') { notes.splice(index, 1); save(notes); close(); paint(); }
    };
  }

  function prompt() {
    const byPage = {};
    notes.forEach((n, i) => (byPage[n.page] ||= []).push([i + 1, n]));
    return 'Góp ý giao diện GD HOME Tools (chế độ R&D) – sửa theo từng mục:\n\n' + Object.entries(byPage).map(([p, list]) =>
      '## Trang ' + p + ' (' + (list[0][1].title || '') + ', màn ' + list[0][1].viewport + ')\n' + list.map(([i, n]) =>
        i + '. ' + n.comment + '\n   - Thành phần: `' + n.selector + '` (' + n.tag + ', ' + n.size + ')' +
        (n.text ? '\n   - Chữ trên đó: "' + n.text + '"' : '') + (n.hint ? '\n   - Nhãn: "' + n.hint + '"' : '')).join('\n')).join('\n\n');
  }
  async function copy() {
    const text = prompt();
    try { await navigator.clipboard.writeText(text); GDHomeShell.toast('Đã copy ' + notes.length + ' góp ý – dán vào khung chat'); }
    catch { GDHomeShell.alert ? GDHomeShell.alert(text) : window.prompt('Copy đoạn này:', text); }
  }
  async function onPanel(e) {
    const del = e.target.closest('[data-del]');
    if (del) { notes.splice(Number(del.dataset.del), 1); save(notes); return paint(); }
    const act = e.target.closest('[data-rd]')?.dataset.rd;
    if (act === 'pick') { picking = !picking; box.hidden = true; paint(); }
    if (act === 'copy') copy();
    if (act === 'list') { panel.classList.toggle('is-list'); paint(); }
    if (act === 'clear' && await GDHomeShell.confirm({title: 'Xoá góp ý', message: 'Xoá hết ' + notes.length + ' góp ý R&D?', okText: 'Xoá', danger: true})) { notes = []; save(notes); paint(); }
    if (act === 'exit') stop();
  }

  // Bắt chuột ở pha capture để trang không nhận cú bấm khi đang chọn
  function onMove(e) {
    if (!picking || pop || ours(e.target)) { box.hidden = true; return; }
    hovered = e.target;
    const r = hovered.getBoundingClientRect();
    Object.assign(box.style, {left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px'});
    box.dataset.label = selectorOf(hovered).split(' > ').pop();
    box.hidden = false;
  }
  function onClick(e) {
    if (!picking || ours(e.target)) return;
    if (pop) { if (!ours(e.target)) { e.preventDefault(); e.stopPropagation(); } return; }
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    box.hidden = true;
    edit(e.target);
  }
  const swallow = e => { if (picking && !ours(e.target) && !pop) { e.preventDefault(); e.stopPropagation(); } };
  function onKey(e) { if (e.key === 'Escape' && picking && !pop) { picking = false; box.hidden = true; paint(); } }

  function start() {
    if (panel) return;
    notes = load(); picking = true;
    ui();
    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('click', onClick, true);
    ['mousedown', 'pointerdown', 'mouseup', 'dblclick', 'contextmenu'].forEach(t => document.addEventListener(t, swallow, true));
    document.addEventListener('keydown', onKey, true);
    addEventListener('scroll', pins, true);
    addEventListener('resize', pins);
    timer = setInterval(pins, 1500);   // trang tự vẽ lại thì ghim tự tìm lại thành phần
  }
  function stop() {
    try { localStorage.removeItem(ON); } catch {}
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('click', onClick, true);
    ['mousedown', 'pointerdown', 'mouseup', 'dblclick', 'contextmenu'].forEach(t => document.removeEventListener(t, swallow, true));
    document.removeEventListener('keydown', onKey, true);
    removeEventListener('scroll', pins, true);
    removeEventListener('resize', pins);
    clearInterval(timer);
    document.querySelectorAll('.rd-ui').forEach(x => x.remove());
    panel = box = pop = null;
  }

  const css = document.createElement('style');
  css.textContent = `
.rd-hover{position:fixed;z-index:2147483000;pointer-events:none;outline:2px solid #ff3b6b;background:rgba(255,59,107,.08);border-radius:3px}
.rd-hover::after{content:attr(data-label);position:absolute;left:-2px;top:-20px;max-width:320px;overflow:hidden;white-space:nowrap;text-overflow:ellipsis;padding:1px 6px;border-radius:4px 4px 0 0;background:#ff3b6b;color:#fff;font:600 11px/18px system-ui,sans-serif}
.rd-panel{position:fixed;left:16px;bottom:16px;z-index:2147483001;width:min(360px,calc(100vw - 32px));padding:10px;border-radius:14px;background:rgba(28,28,30,.92);color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.3);-webkit-backdrop-filter:blur(16px);backdrop-filter:blur(16px)}
.rd-head{display:flex;justify-content:space-between;gap:8px;margin-bottom:8px}.rd-head span{color:#aeaeb2}
.rd-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}
.rd-ui button{height:30px;padding:0 10px;border:0;border-radius:8px;background:rgba(255,255,255,.14);color:#fff;font:500 12.5px system-ui,sans-serif;cursor:pointer}
.rd-ui button:hover:not(:disabled){background:rgba(255,255,255,.24)}.rd-ui button:disabled{opacity:.4;cursor:default}
.rd-panel [aria-pressed=true]{background:#ff3b6b}
.rd-list{margin:8px 0 0;padding:0 0 0 18px;max-height:40vh;overflow:auto}.rd-list li{margin:4px 0}.rd-list li{display:list-item}
.rd-list li span{display:inline}.rd-list li button{height:20px;padding:0 6px;margin-left:6px;font-size:11px}
.rd-pin{position:fixed;z-index:2147483000;width:20px;height:20px!important;padding:0!important;border-radius:50%!important;background:#ff3b6b!important;font:700 11px/20px system-ui,sans-serif!important;box-shadow:0 0 0 2px #fff}
.rd-pop{position:fixed;z-index:2147483002;width:min(380px,calc(100vw - 16px));padding:10px;border-radius:12px;background:#1c1c1e;color:#fff;font:13px/1.4 system-ui,sans-serif;box-shadow:0 12px 32px rgba(0,0,0,.35)}
.rd-target{margin-bottom:6px;color:#aeaeb2;font:11.5px/1.35 ui-monospace,Consolas,monospace;word-break:break-all}.rd-target i{font-family:system-ui,sans-serif}
.rd-pop textarea{box-sizing:border-box;width:100%;min-height:80px;margin-bottom:8px;padding:8px;border:0;border-radius:8px;background:#2c2c2e;color:#fff;font:13px/1.4 system-ui,sans-serif;resize:vertical}
.rd-ui .rd-ok{background:#0a84ff}`;
  document.head.append(css);
  window.GDHomeRd = {start, stop, prompt, selectorOf};
})();
