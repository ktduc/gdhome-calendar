/* Vẽ hiện trạng (/ve-hien-trang): danh sách bản vẽ + màn vẽ mặt bằng (tường, cửa, cột, thiết bị, kích thước), tự lưu lên tài khoản. */
(() => {
  const C = window.GDPlanCore, Shell = window.GDHomeShell;
  const $ = id => document.getElementById(id);
  const esc = v => Shell.escape(String(v ?? ''));
  const svg = $('vh-svg'), world = $('vh-world'), drawLayer = $('vh-draw'), over = $('vh-over'), pop = $('vh-pop');
  const S = {id: '', plan: null, view: {x: 0, y: 0, k: 0.12}, mode: 'plan', tool: 'select', lock: true, sel: null, draft: null, devType: 'o_cam',
    ceilType: 'downlight', ceilSize: 90, ceilLevel: 2700, ceilLed: false, lenMode: 'square', multi: false, multiSel: [], boxDraft: null,
    hist: [], fut: [], dirty: false, saveTimer: 0, projects: [], cursor: null, dimDraft: null, arrowDraft: null, pendingPhoto: null, elev: null, bgBar: false, bgPts: null, popHide: false};
  const assetUrls = new Map();
  async function assetBlobUrl(name) {
    if (!name) return '';
    if (assetUrls.has(name)) return assetUrls.get(name);
    const res = await fetch('/api/materials/assets/' + encodeURIComponent(name), {headers: Shell.authHeaders()});
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const url = URL.createObjectURL(await res.blob());
    assetUrls.set(name, url);
    return url;
  }
  async function uploadImageAsset(file) {
    const {full} = await window.GDHomeImages.compress(file);
    const res = await window.GDHomeImages.uploadAsset(full, Shell.authHeaders);
    return typeof res === 'string' ? res : res?.name;
  }
  const floor = () => S.plan.floors[S.plan.active] || S.plan.floors[0];
  // ở mặt đứng: ghi chú / mũi tên nằm trong room.elev[i]
  const elevData = () => { const r = roomById(S.elev.roomId); r.elev ||= {}; return (r.elev[S.elev.i] ||= {}); };
  const notesList = () => S.elev ? (elevData().notes ||= []) : (floor().notes ||= []);
  const arrowsList = () => S.elev ? (elevData().arrows ||= []) : (floor().arrows ||= []);
  const ceilUI = () => S.mode === 'ceil' && !S.elev;
  const ELEV_TOOLS = ['select', 'device', 'note', 'arrow'];
  const roomById = id => floor().rooms.find(r => r.id === id);
  const fmt = n => Math.round(n).toLocaleString('vi-VN').replace(/\./g, '');
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  // ================= Lưu / tải =================
  const cacheKey = id => 'gd-plan-' + id;
  function cache() { try { localStorage.setItem(cacheKey(S.id), JSON.stringify({plan: S.plan, at: Date.now(), dirty: S.dirty, baseAt: S.baseAt})); } catch { /* đầy bộ nhớ: bỏ qua */ } }
  function markDirty() {
    S.dirty = true; cache();
    Shell.saveStatus($('save-status'), 'pending');
    clearTimeout(S.saveTimer);
    S.saveTimer = setTimeout(save, 1500);
  }
  async function save() {
    clearTimeout(S.saveTimer);
    if (!S.plan || !S.dirty) return;
    S.dirty = false;
    Shell.saveStatus($('save-status'), 'saving');
    const force = S.force; S.force = false;
    try {
      const res = await Shell.api('/api/site-plans/' + S.id, {method: 'POST', body: {name: S.plan.name, projectId: S.plan.projectId, data: S.plan, baseAt: S.baseAt, force}});
      if (res?.updatedAt) S.baseAt = res.updatedAt;
      Shell.saveStatus($('save-status'), 'saved'); cache();
    } catch (error) {
      S.dirty = true; cache();
      if (error.status === 409) return resolveConflict();
      Shell.saveStatus($('save-status'), error.status === 401 ? 'offline' : 'error', error.status === 401 ? 'Chưa đăng nhập – đang giữ trên máy này' : error.message);
      if (error.status !== 401 && error.status !== 413) S.saveTimer = setTimeout(save, 15000);
      if (error.status === 413) Shell.toast('Bản vẽ quá lớn để lưu lên server (> 1 MB) – bớt nền DXF hoặc tách tầng sang bản vẽ khác.');
    }
  }
  // Bản trên server mới hơn: Ghi đè, hoặc giữ bản server và lưu bản của máy này thành bản sao
  async function resolveConflict() {
    const id = S.id, mine = S.plan;
    const ok = await Shell.ask({title: 'Bản vẽ đã được sửa ở nơi khác', message: 'Máy hoặc tab khác vừa lưu bản mới hơn. Ghi đè bằng bản trên máy này?\nChọn Huỷ: mở bản mới nhất, bản của máy này được lưu thành bản sao.', okText: 'Ghi đè', danger: true});
    if (S.id !== id) return;
    if (ok) { S.force = true; S.dirty = true; return save(); }
    const copyId = newId();
    try { await Shell.api('/api/site-plans/' + copyId, {method: 'POST', body: {name: (mine.name || 'Bản vẽ') + ' (bản sao)', projectId: mine.projectId, data: {...mine, name: (mine.name || 'Bản vẽ') + ' (bản sao)'}}}); Shell.toast('Đã lưu bản của máy này thành bản sao.'); }
    catch (error) { Shell.toast('Không lưu được bản sao: ' + error.message); return; }
    try { localStorage.removeItem(cacheKey(id)); } catch { /* bỏ */ }
    S.dirty = false;
    openPlan(id);
  }
  addEventListener('beforeunload', e => { if (S.dirty) { save(); e.preventDefault(); } });
  addEventListener('online', () => { if (S.dirty) save(); });

  // ================= Danh sách =================
  async function loadProjects() {
    try { S.projects = ((await Shell.api('/api/project-hub/overview')).projects || []).map(p => ({id: p.id, name: p.name || p.id})); }
    catch { S.projects = []; }
    const opts = '<option value="">- Không gắn -</option>' + S.projects.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
    document.querySelectorAll('select[name=projectId]').forEach(s => { const v = s.value; s.innerHTML = opts; s.value = v; });
  }
  async function showHome() {
    mic(false);
    await save();
    S.plan = null; S.id = '';
    $('vh-editor').hidden = true; $('vh-home').hidden = false;
    history.replaceState(null, '', '/ve-hien-trang');
    const list = $('vh-list');
    let plans = [];
    try { plans = (await Shell.api('/api/site-plans')).plans || []; }
    catch (error) {
      list.innerHTML = '<li class="vh-muted vh-login">' + (error.status === 401 ? 'Cần đăng nhập. Mở <a href="/tools">Trang chủ công cụ</a> để đăng nhập Gmail rồi quay lại. Vẫn vẽ được, bản vẽ giữ tạm trên máy này.' : esc(error.message)) + '</li>';
    }
    // bản vẽ chỉ có trên máy (chưa lên được server)
    const local = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith('gd-plan-')) continue;
      const id = k.slice(8);
      if (plans.some(p => p.id === id)) continue;
      try { const c = JSON.parse(localStorage.getItem(k)); if (c?.plan) local.push({id, name: c.plan.name, updatedAt: c.at, rooms: c.plan.floors.reduce((n, f) => n + f.rooms.length, 0), local: true}); } catch { /* hỏng: bỏ */ }
    }
    const all = [...local, ...plans];
    if (!all.length && !list.querySelector('.vh-login')) list.innerHTML = '<li class="vh-muted">Chưa có bản vẽ. Tạo bản vẽ mới hoặc mở bản vẽ mẫu để thử.</li>';
    if (all.length) list.innerHTML = all.map(p => '<li class="vh-item" data-id="' + esc(p.id) + '"><b data-open>' + esc(p.name) + '</b><span class="vh-muted">' +
      (p.projectId ? '📁 ' + esc(S.projects.find(x => x.id === p.projectId)?.name || p.projectId) + ' · ' : '') + (p.rooms || 0) + ' phòng · ' +
      new Date(p.updatedAt).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'}) + (p.local ? ' · <b style="color:#b45309">chỉ trên máy này</b>' : '') + '</span>' +
      '<div class="vh-item-btns"><button type="button" class="btn btn-primary btn-sm" data-open>Mở</button><button type="button" class="btn btn-outline btn-sm" data-dl>Tải JSON</button><button type="button" class="btn btn-outline btn-sm" data-del>Xoá</button></div></li>').join('');
  }
  async function openPlan(id) {
    let plan = null;
    let local = null;
    try { local = JSON.parse(localStorage.getItem(cacheKey(id)) || 'null'); } catch { /* bỏ */ }
    let serverAt = 0;
    try { const doc = await Shell.api('/api/site-plans/' + id); plan = doc.data; serverAt = doc.updatedAt || 0; }
    catch (error) { if (!local) return Shell.toast('Không mở được bản vẽ: ' + error.message); }
    let dirty = false;
    if (local?.dirty && local.plan) {   // có thay đổi trên máy chưa lên server
      const stale = plan && serverAt && local.baseAt && serverAt > local.baseAt;
      if (!stale || await Shell.ask({title: 'Có 2 bản khác nhau', message: 'Máy này còn thay đổi chưa lưu, nhưng bản trên server đã được sửa ở nơi khác sau đó. Dùng bản trên máy này (ghi đè bản server)?', okText: 'Dùng bản máy này', danger: true})) { plan = local.plan; dirty = true; }
    }
    startEditor(id, plan || local.plan, dirty, serverAt || local?.baseAt || 0);
  }
  function startEditor(id, plan, dirty = false, baseAt = 0) {
    S.baseAt = baseAt; S.force = false;
    S.id = id; S.plan = normalize(plan); S.mode = 'plan'; S.multi = false; S.multiSel = []; S.hist = []; S.fut = []; S.sel = null; S.draft = null; S.dirty = false; S.elev = null; S.bgBar = false;
    $('vh-multi')?.classList.remove('is-on');
    $('vh-home').hidden = true; $('vh-editor').hidden = false;
    history.replaceState(null, '', '/ve-hien-trang?plan=' + encodeURIComponent(id));
    syncModeUI(); setTool('select'); renderAll(); fit();
    if (dirty) markDirty(); else Shell.saveStatus($('save-status'), 'saved');
  }
  function normalize(plan) {
    const p = {...C.newPlan(), ...plan};
    p.floors = (p.floors?.length ? p.floors : C.newPlan().floors).map(f => ({
      ceilItems: [], ceilLines: [], notes: [], arrows: [], photos: [], ...f,
      id: f.id || C.uid(), name: f.name || 'Tầng',
      rooms: (f.rooms || []).map(r => ({segs: [], openings: [], devices: [], ...r})),
      columns: f.columns || [], dims: f.dims || []
    }));
    if (!p.floors[p.active]) p.active = 0;
    return p;
  }
  function createPlan(plan) {
    const id = newId();
    startEditor(id, plan);
    markDirty(); save();
  }
  function download(name, blob) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name.replace(/[\\/:*?"<>|]+/g, '-');
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  $('vh-home').addEventListener('click', async e => {
    const act = e.target.closest('[data-home]')?.dataset.home;
    if (act === 'new') { $('vh-new').hidden = false; $('vh-new').elements.name.focus(); }
    if (act === 'cancel') $('vh-new').hidden = true;
    if (act === 'sample') createPlan(C.samplePlan());
    const item = e.target.closest('.vh-item');
    if (!item) return;
    const id = item.dataset.id;
    if (e.target.closest('[data-open]')) openPlan(id);
    if (e.target.closest('[data-dl]')) {
      try {
        const doc = await Shell.api('/api/site-plans/' + id).catch(() => ({data: JSON.parse(localStorage.getItem(cacheKey(id))).plan}));
        download((doc.data.name || 'ban-ve') + '.json', new Blob([JSON.stringify(doc.data, null, 1)], {type: 'application/json'}));
      } catch (error) { Shell.toast('Không tải được: ' + error.message); }
    }
    if (e.target.closest('[data-del]')) {
      const name = item.querySelector('b').textContent;
      if (!await Shell.ask({title: 'Xoá bản vẽ', message: 'Xoá hẳn "' + name + '"? Không khôi phục được (trừ khi có file JSON sao lưu).', okText: 'Xoá', danger: true})) return;
      try { await Shell.api('/api/site-plans/' + id + '/delete', {method: 'POST', body: {}}); } catch (error) { if (error.status !== 401) return Shell.toast('Không xoá được: ' + error.message); }
      try { localStorage.removeItem(cacheKey(id)); } catch { /* bỏ */ }
      showHome();
    }
  });
  $('vh-new').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.elements;
    createPlan(C.newPlan({name: f.name.value.trim(), address: f.address.value.trim(), surveyor: f.surveyor.value.trim(), projectId: f.projectId.value,
      wall: Number(f.wall.value) || 140, snap: Number(f.snap.value) || 10}));
    e.target.reset(); e.target.hidden = true;
  });
  $('vh-restore').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const plan = JSON.parse(await file.text());
      if (!Array.isArray(plan?.floors)) throw new Error('File không phải bản vẽ hiện trạng.');
      createPlan(plan);
      Shell.toast('Đã khôi phục "' + (plan.name || 'bản vẽ') + '" thành bản vẽ mới.');
    } catch (error) { Shell.toast('Không đọc được file: ' + error.message); }
  });

  // ================= Lịch sử =================
  function pushHist(snap) { S.hist.push(snap); if (S.hist.length > 120) S.hist.shift(); }
  function commit(fn) {
    pushHist(JSON.stringify(S.plan));
    S.fut = [];
    fn();
    renderAll(); markDirty();
  }
  function undo() {
    if (S.draft) { draftUndo(); return; }
    if (!S.hist.length) return;
    S.fut.push(JSON.stringify(S.plan)); S.plan = JSON.parse(S.hist.pop()); S.sel = null; S.multiSel = []; renderAll(); markDirty();
  }
  function redo() {
    if (!S.fut.length) return;
    S.hist.push(JSON.stringify(S.plan)); S.plan = JSON.parse(S.fut.pop()); S.sel = null; S.multiSel = []; renderAll(); markDirty();
  }

  // ================= Khung nhìn =================
  const toWorld = (cx, cy) => { const r = svg.getBoundingClientRect(); return [(cx - r.left - S.view.x) / S.view.k, (cy - r.top - S.view.y) / S.view.k]; };
  const toScreen = p => [p[0] * S.view.k + S.view.x, p[1] * S.view.k + S.view.y];
  function applyView() {
    world.setAttribute('transform', `translate(${S.view.x} ${S.view.y}) scale(${S.view.k})`);
    const r = svg.getBoundingClientRect(), [x0, y0] = [-S.view.x / S.view.k, -S.view.y / S.view.k];
    const g = $('vh-grid');
    g.setAttribute('x', Math.floor(x0 / 1000) * 1000); g.setAttribute('y', Math.floor(y0 / 1000) * 1000);
    g.setAttribute('width', r.width / S.view.k + 2000); g.setAttribute('height', r.height / S.view.k + 2000);
    g.style.display = S.plan?.grid === false ? 'none' : '';
    $('vh-grid-minor').firstElementChild.style.opacity = S.view.k < 0.06 ? 0 : 1;
    placeFab();
  }
  const renderOpts = () => ({mode: S.mode, sel: S.sel ? (S.sel.kind === 'ci' ? 'ci:' + S.sel.id : S.sel.kind === 'cl' ? 'cl:' + S.sel.id : null) : null});
  const viewPrims = () => S.elev ? C.elevPrimitives(S.plan, roomById(S.elev.roomId), S.elev.i) : C.floorPrimitives(S.plan, floor(), renderOpts());
  function fit() {
    const b = C.bounds(viewPrims());
    const r = svg.getBoundingClientRect();
    if (!b || !r.width) { S.view = {x: r.width / 2, y: r.height / 2, k: 0.1}; return applyView(); }
    // máy tính: chừa bên phải cho bảng thuộc tính; mặt đứng: chừa trên cho thanh tiêu đề
    const pad = 40, padR = r.width > 640 ? 330 : pad, padT = S.elev ? 60 : pad, aw = r.width - pad - padR, ah = r.height - pad - padT;
    const k = Math.min(aw / Math.max(b.x1 - b.x0, 1000), ah / Math.max(b.y1 - b.y0, 1000), 0.6);
    S.view = {k, x: pad + (aw - (b.x1 - b.x0) * k) / 2 - b.x0 * k, y: padT + (ah - (b.y1 - b.y0) * k) / 2 - b.y0 * k};
    applyView();
  }
  function zoomAt(cx, cy, factor) {
    const r = svg.getBoundingClientRect(), [wx, wy] = toWorld(cx, cy);
    const k = Math.min(3, Math.max(0.005, S.view.k * factor));
    S.view = {k, x: cx - r.left - wx * k, y: cy - r.top - wy * k};
    applyView();
  }
  new ResizeObserver(() => S.plan && applyView()).observe(svg);
  screen.orientation?.addEventListener('change', () => setTimeout(() => S.plan && !$('vh-editor').hidden && fit(), 300));

  // ================= Vẽ ra SVG =================
  function primSvg(p) {
    const hit = p.hit ? ` data-hit="${esc(p.hit)}"` : '';
    const n = v => Math.round(v * 10) / 10 || 0;
    const st = (p.stroke && p.stroke !== 'none' ? ` stroke="${esc(p.stroke)}" stroke-width="${n(p.w || 1)}" vector-effect="non-scaling-stroke"` : '') + (p.dash ? ` stroke-dasharray="${esc(p.dash)}"` : '');
    switch (p.t) {
      case 'line': return `<line x1="${n(p.a[0])}" y1="${n(p.a[1])}" x2="${n(p.b[0])}" y2="${n(p.b[1])}"${st} stroke-linecap="round"${hit}/>`;
      case 'poly': return `<${p.close ? 'polygon' : 'polyline'} points="${p.pts.map(q => n(q[0]) + ',' + n(q[1])).join(' ')}" fill="${esc(p.fill || 'none')}"${st}${hit}/>`;
      case 'circle': return `<circle cx="${n(p.c[0])}" cy="${n(p.c[1])}" r="${n(p.r)}" fill="${esc(p.fill || 'none')}"${st}${hit}/>`;
      case 'arc': {
        const s = [p.c[0] + p.r * Math.cos(p.a0), p.c[1] + p.r * Math.sin(p.a0)], e = [p.c[0] + p.r * Math.cos(p.a1), p.c[1] + p.r * Math.sin(p.a1)];
        return `<path d="M${n(s[0])} ${n(s[1])}A${n(p.r)} ${n(p.r)} 0 ${Math.abs(p.a1 - p.a0) > Math.PI ? 1 : 0} ${p.a1 > p.a0 ? 1 : 0} ${n(e[0])} ${n(e[1])}" fill="none"${st}${hit}/>`;
      }
      case 'text': return `<text x="${n(p.p[0])}" y="${n(p.p[1])}" font-size="${n(p.size)}" text-anchor="${esc(p.anchor || 'middle')}" dominant-baseline="middle" fill="${esc(p.fill || '#111')}"${p.weight ? ` font-weight="${n(p.weight)}"` : ''}${p.rot ? ` transform="rotate(${n(p.rot)} ${n(p.p[0])} ${n(p.p[1])})"` : ''}${hit}>${esc(p.s)}</text>`;
      default: return '';
    }
  }
  function renderAll() {
    if (!S.plan) return;
    const er0 = S.elev && roomById(S.elev.roomId);
    if (S.elev && (!er0 || S.elev.i >= C.segCount(er0))) { S.elev = null; syncModeUI(); }   // phòng / đoạn bị xoá, hoàn tác
    drawLayer.innerHTML = viewPrims().map(primSvg).join('');
    $('vh-name').textContent = S.plan.name || 'Bản vẽ';
    const selRoom = S.sel?.room && roomById(S.sel.room);
    $('vh-floor-label').textContent = floor().name + (S.mode === 'ceil' ? ' · Trần' : '') + (selRoom ? ' · ' + selRoom.name : '') + ' ▾';
    const er = S.elev && roomById(S.elev.roomId);
    $('vh-elev-bar').hidden = !er;
    if (er) $('vh-elev-title').textContent = 'Mặt đứng · ' + er.name + ' · đoạn ' + (S.elev.i + 1) + '/' + C.segCount(er);
    renderBg();
    document.querySelector('[data-act=undo]').disabled = !S.hist.length && !S.draft?.pts.length;
    document.querySelector('[data-act=redo]').disabled = !S.fut.length;
    renderOverlay(); applyView(); renderPop();
  }
  function renderOverlay() {
    const out = [], k = S.view.k, px = v => v / k;
    const sel = S.sel;
    if (sel && S.elev) {
      const room = sel.room && roomById(sel.room), dev = sel.kind === 'dev' && room?.devices.find(o => o.id === sel.id);
      if (dev) { const fr = C.elevFrame(room, S.elev.i); out.push({t: 'circle', c: [fr.u(dev.at), -(dev.h ?? 0) - 43], r: px(22), stroke: '#2563eb', w: 2.5}); }
      if (sel.kind === 'note') { const nt = notesList().find(n => n.id === sel.id); if (nt) out.push({t: 'circle', c: [nt.x, nt.y], r: px(8), stroke: '#2563eb', w: 2.5, fill: '#fff'}); }
      if (sel.kind === 'ar') { const ar = arrowsList().find(a => a.id === sel.id); if (ar) out.push({t: 'poly', pts: ar.pts, close: false, fill: 'none', stroke: '#2563eb', w: 3, dash: '6 4'}); }
    } else if (sel) {
      const room = sel.room && roomById(sel.room);
      if (sel.kind === 'seg' && room) { const [a, b] = C.segEnds(room, sel.i); out.push({t: 'line', a, b, stroke: '#2563eb', w: 5}); }
      if (sel.kind === 'room' && room) out.push({t: 'poly', pts: room.pts, close: room.closed, fill: 'rgba(37,99,235,.08)', stroke: '#2563eb', w: 2, dash: '8 5'});
      if (sel.kind === 'op' && room) {
        const op = room.openings.find(o => o.id === sel.id);
        if (op) { const [a, b] = C.segEnds(room, op.seg), d = C.unit(C.sub(b, a)); out.push({t: 'line', a: C.add(a, C.mul(d, op.at)), b: C.add(a, C.mul(d, op.at + op.w)), stroke: '#2563eb', w: 6}); }
      }
      if (sel.kind === 'dev' && room) {
        const dev = room.devices.find(o => o.id === sel.id);
        if (dev) { const [a, b] = C.segEnds(room, dev.seg), d = C.unit(C.sub(b, a)); out.push({t: 'circle', c: C.add(a, C.mul(d, dev.at)), r: px(16), stroke: '#2563eb', w: 2.5}); }
      }
      if (sel.kind === 'col') { const col = floor().columns.find(c => c.id === sel.id); if (col) out.push({t: 'circle', c: [col.x, col.y], r: Math.max(col.w, col.h) * .75, stroke: '#2563eb', w: 2, dash: '5 4'}); }
      if (sel.kind === 'ci') { const it = (floor().ceilItems || []).find(c => c.id === sel.id); if (it) { const [w, h] = C.sizeWH(it.size ?? C.CEIL[it.type]?.def); out.push({t: 'circle', c: [it.x, it.y], r: Math.max(w, h) / 2 + px(8), stroke: '#2563eb', w: 2, dash: '5 4'}); } }
      if (sel.kind === 'cl') { const cl = (floor().ceilLines || []).find(c => c.id === sel.id); if (cl) out.push({t: 'poly', pts: cl.pts, close: !!cl.closed, fill: 'none', stroke: '#2563eb', w: 3, dash: '8 5'}); }
      if (sel.kind === 'note') { const nt = notesList().find(n => n.id === sel.id); if (nt) out.push({t: 'circle', c: [nt.x, nt.y], r: px(8), stroke: '#2563eb', w: 2.5, fill: '#fff'}); }
      if (sel.kind === 'ar') { const ar = arrowsList().find(a => a.id === sel.id); if (ar) out.push({t: 'poly', pts: ar.pts, close: false, fill: 'none', stroke: '#2563eb', w: 3, dash: '6 4'}); }
      if (sel.kind === 'ph') { const ph = (floor().photos || []).find(p => p.id === sel.id); if (ph) out.push({t: 'circle', c: [ph.x, ph.y], r: (S.plan.font || 150) * 1.6, stroke: '#2563eb', w: 2.5, dash: '5 4'}); }
      if ((sel.kind === 'seg' || sel.kind === 'room') && room) room.pts.forEach((p, j) => out.push({t: 'poly', pts: [[p[0] - px(6), p[1] - px(6)], [p[0] + px(6), p[1] - px(6)], [p[0] + px(6), p[1] + px(6)], [p[0] - px(6), p[1] + px(6)]], close: true, fill: '#fff', stroke: '#2563eb', w: 2, hit: 'vtx:' + room.id + ':' + j}));
      if (sel.kind === 'room' && room && !room.closed) [room.pts[0], room.pts[room.pts.length - 1]].forEach(p => out.push({t: 'circle', c: p, r: px(9), stroke: '#dc2626', w: 2.5}));
    }
    for (const m of S.multiSel) {
      if (m.kind === 'room') { const r = roomById(m.id); if (r) out.push({t: 'poly', pts: r.pts, close: r.closed, fill: 'rgba(37,99,235,.10)', stroke: '#2563eb', w: 2.5, dash: '8 5'}); }
      else if (m.kind === 'col') { const c = floor().columns.find(x => x.id === m.id); if (c) out.push({t: 'circle', c: [c.x, c.y], r: Math.max(c.w, c.h) * .75, stroke: '#2563eb', w: 2.5, dash: '5 4'}); }
      else if (m.kind === 'ci') { const it = (floor().ceilItems || []).find(x => x.id === m.id); if (it) { const [w, h] = C.sizeWH(it.size ?? C.CEIL[it.type]?.def); out.push({t: 'circle', c: [it.x, it.y], r: Math.max(w, h) / 2 + px(8), stroke: '#2563eb', w: 2.5, dash: '5 4'}); } }
      else if (m.kind === 'cl') { const cl = (floor().ceilLines || []).find(x => x.id === m.id); if (cl) out.push({t: 'poly', pts: cl.pts, close: !!cl.closed, fill: 'none', stroke: '#2563eb', w: 3, dash: '6 4'}); }
      else if (m.kind === 'note') { const nt = notesList().find(x => x.id === m.id); if (nt) out.push({t: 'circle', c: [nt.x, nt.y], r: px(9), stroke: '#2563eb', w: 2.5, fill: 'rgba(37,99,235,.15)'}); }
      else if (m.kind === 'ar') { const ar = arrowsList().find(x => x.id === m.id); if (ar) out.push({t: 'poly', pts: ar.pts, close: false, fill: 'none', stroke: '#2563eb', w: 3, dash: '6 4'}); }
      else if (m.kind === 'ph') { const ph = (floor().photos || []).find(x => x.id === m.id); if (ph) out.push({t: 'circle', c: [ph.x, ph.y], r: (S.plan.font || 150) * 1.7, stroke: '#2563eb', w: 2.5, dash: '5 4'}); }
    }
    if (S.boxDraft) {
      const [[ax, ay], [bx, by]] = S.boxDraft;
      out.push({t: 'poly', pts: [[ax, ay], [bx, ay], [bx, by], [ax, by]], close: true, fill: 'rgba(37,99,235,.08)', stroke: '#2563eb', w: 1.5, dash: '6 4'});
    }
    const d = S.draft;
    if (d?.pts.length) {
      const font = (S.plan.font || 150);
      for (let i = 1; i < d.pts.length; i++) {
        const color = {window: '#3b82c4', door: '#d9822b', open: '#9ca3af', partition: '#7c3aed'}[d.kinds[i - 1]] || '#111827';
        out.push({t: 'line', a: d.pts[i - 1], b: d.pts[i], stroke: color, w: 2.5});
        const L = C.len(C.sub(d.pts[i], d.pts[i - 1]));
        out.push(...C.dimLine(d.pts[i - 1], d.pts[i], font * 1.3, fmt(L) + (d.kinds[i - 1] && d.kinds[i - 1] !== 'wall' ? ' ' + KIND_LABEL[d.kinds[i - 1]] : ''), font));
      }
      out.push({t: 'circle', c: d.pts[0], r: px(7), stroke: '#16a34a', w: 2.5, fill: '#fff'});
      const last = d.pts[d.pts.length - 1];
      if (d.cursor && C.len(C.sub(d.cursor, last)) > 1) {
        out.push({t: 'line', a: last, b: d.cursor, stroke: '#dc2626', w: 1.5, dash: '6 5'});
        out.push(...C.dimLine(last, d.cursor, font * 1.3, fmt(C.len(C.sub(d.cursor, last))), font).map(p => ({...p, stroke: p.stroke && '#dc2626', fill: p.fill && '#dc2626'})));
      }
      out.push({t: 'circle', c: last, r: px(8), stroke: '#dc2626', w: 3, fill: '#fff'});
    }
    if (S.dimDraft) {
      const {a, b} = S.dimDraft, c = S.cursor || b || a;
      if (!b) out.push({t: 'line', a, b: c, stroke: '#2f8a3c', w: 1.5, dash: '5 4'});
      else out.push(...C.dimLine(a, b, dimOffset(a, b, c), fmt(C.len(C.sub(b, a))), S.plan.font || 150));
    }
    if (S.arrowDraft?.pts.length) {
      const pts = [...S.arrowDraft.pts, ...(S.cursor ? [S.cursor] : [])];
      out.push({t: 'circle', c: pts[0], r: px(5), fill: '#b91c1c', stroke: '#b91c1c', w: 1});
      if (pts.length > 1) out.push({t: 'poly', pts, close: false, fill: 'none', stroke: '#b91c1c', w: 1.8, dash: '6 4'});
    }
    if (S.bgPts?.length) { const pts = [...S.bgPts, ...(S.cursor && S.bgPts.length < 2 ? [S.cursor] : [])]; out.push({t: 'poly', pts, close: false, fill: 'none', stroke: '#c2410c', w: 2, dash: '6 4'}); pts.forEach(c => out.push({t: 'circle', c, r: px(6), stroke: '#c2410c', w: 2, fill: '#fff'})); }
    if (S.sketch?.length > 1) out.push({t: 'poly', pts: S.sketch, close: false, stroke: '#dc2626', w: 2});
    over.innerHTML = out.map(primSvg).join('');
    placeFab();
  }
  const dimOffset = (a, b, c) => { const d = C.unit(C.sub(b, a)); return C.dot(C.sub(c, a), [d[1], -d[0]]); };
  const KIND_LABEL = {window: 'cửa sổ', door: 'cửa đi', open: 'lối đi', partition: 'vách'};

  // ================= Công cụ =================
  const HINTS = {
    select: 'Chạm tường / cửa / thiết bị để sửa · kéo tường để co giãn, kéo phòng để dời · kéo chỗ trống để xem chỗ khác · lăn chuột để phóng to',
    draw: 'Chạm đặt điểm đầu rồi gõ / đọc số (dọc 3500, ngang 1200 cửa sổ…) hoặc chạm điểm tiếp · phím mũi tên khoá hướng · Enter trống = khép kín · Esc = kết thúc · hoặc kéo 1 nét phác quanh phòng',
    'ceil-line': 'Chạm đặt các điểm đường giật cấp / hắt LED · gõ số kích thước · Enter trống = khép kín · Esc = kết thúc nét hở',
    device: 'Chọn loại thiết bị rồi chạm bản vẽ để đặt',
    column: 'Chạm chỗ đặt cột vuông 200 (gần tường thì tự ăn vào tường)',
    dim: 'Chạm điểm đầu, điểm cuối (tự bắt góc tường) rồi chạm chỗ đặt đường kích thước',
    note: 'Chạm lên bản vẽ để đặt khung ghi chú nhiều dòng',
    arrow: 'Bấm lần lượt điểm đầu mũi tên → điểm gập → điểm chân rồi nhập chữ',
    photo: 'Chạm lên bản vẽ vị trí chụp để đặt ghim và chọn / chụp ảnh hiện trường',
    'bg-scale': 'Chạm 2 điểm trên nền có số đo đã biết rồi nhập số mm thật',
    'bg-move': 'Kéo để dời nền hiện trạng'
  };
  function syncModeUI() {
    const ceil = ceilUI();
    $('vh-editor').classList.toggle('is-elev', !!S.elev);
    $('vh-ceil').classList.toggle('is-on', S.mode === 'ceil');
    $('vh-tool-ceilline').hidden = !ceil;
    $('vh-devices').hidden = ceil || S.tool !== 'device';
    $('vh-ceil-devices').hidden = !ceil;
    renderCeilSub();
  }
  function renderCeilSub() {
    const sub = $('vh-ceil-sub');
    if (!ceilUI()) { sub.hidden = true; return; }
    if (S.tool === 'device') {
      const spec = C.CEIL[S.ceilType] || C.CEIL.downlight;
      if (!spec.sizes.some(sz => String(sz) === String(S.ceilSize))) S.ceilSize = spec.def;
      sub.innerHTML = spec.sizes.map(sz => `<button type="button" data-csize="${esc(sz)}" class="${String(sz) === String(S.ceilSize) ? 'is-on' : ''}">${esc(C.sizeText(S.ceilType, sz))}</button>`).join('');
      sub.hidden = false;
    } else if (S.tool === 'ceil-line') {
      sub.innerHTML = `<label>Cao độ + (mm) <input type="number" id="vh-cl-level" step="50" value="${S.ceilLevel || 2700}"></label>` +
        `<label class="vh-check"><input type="checkbox" id="vh-cl-led" ${S.ceilLed ? 'checked' : ''}> LED hắt</label>`;
      sub.hidden = false;
    } else sub.hidden = true;
  }
  function setMode(mode) {
    if (S.draft) finishDraft(false);
    S.mode = mode; S.sel = null;
    if (mode !== 'ceil' && S.tool === 'ceil-line') S.tool = 'select';
    syncModeUI(); setTool(S.tool); renderAll();
  }
  function setTool(tool) {
    if (S.elev && !ELEV_TOOLS.includes(tool)) return;
    if (S.draft && S.tool !== tool) finishDraft(false);
    S.tool = tool; S.dimDraft = null; S.arrowDraft = null; S.bgPts = null;
    document.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('is-on', b.dataset.tool === tool));
    svg.classList.toggle('is-draw', tool === 'draw' || tool === 'ceil-line');
    svg.classList.toggle('is-place', ['device', 'column', 'dim', 'note', 'arrow', 'photo', 'bg-scale', 'bg-move'].includes(tool));
    $('vh-devices').hidden = ceilUI() || tool !== 'device';
    $('vh-ceil-devices').hidden = !ceilUI();
    renderCeilSub();
    $('vh-draw-btns').hidden = tool !== 'draw' && tool !== 'ceil-line';
    $('vh-draw-btns').querySelectorAll('[data-cmd="vách"],[data-cmd="cửa sổ"],[data-cmd="cửa đi"],[data-cmd="lối đi"]').forEach(b => { b.hidden = tool === 'ceil-line'; });
    $('vh-hint').textContent = tool === 'select' && innerWidth <= 640 ? '' : HINTS[tool] || '';   // điện thoại: chỉ hướng dẫn khi đang dùng công cụ
    if (tool !== 'select') { S.sel = null; S.multi = false; S.multiSel = []; $('vh-multi')?.classList.remove('is-on'); }
    renderPop(); renderOverlay();   // về Chọn sau khi đặt: hiện bảng thuộc tính của đối tượng vừa đặt
  }
  $('vh-devices').innerHTML = Object.entries(C.DEVICES).map(([k, d]) => `<button type="button" data-dev="${k}">${esc(d.label)}</button>`).join('');
  $('vh-devices').addEventListener('click', e => {
    const b = e.target.closest('[data-dev]');
    if (!b) return;
    S.devType = b.dataset.dev;
    document.querySelectorAll('[data-dev]').forEach(x => x.classList.toggle('is-on', x === b));
  });
  document.querySelector(`[data-dev=${S.devType}]`).classList.add('is-on');
  $('vh-ceil-devices').innerHTML = Object.entries(C.CEIL).map(([k, d]) => `<button type="button" data-cdev="${k}" class="${k === S.ceilType ? 'is-on' : ''}">${esc(d.label)}</button>`).join('');
  $('vh-ceil-devices').addEventListener('click', e => {
    const b = e.target.closest('[data-cdev]');
    if (!b) return;
    S.ceilType = b.dataset.cdev;
    S.ceilSize = C.CEIL[S.ceilType]?.def;
    document.querySelectorAll('[data-cdev]').forEach(x => x.classList.toggle('is-on', x === b));
    setTool('device');
  });
  $('vh-ceil-sub').addEventListener('click', e => {
    const b = e.target.closest('[data-csize]');
    if (!b) return;
    const raw = b.dataset.csize;
    S.ceilSize = /^\d+$/.test(raw) ? Number(raw) : raw;
    renderCeilSub();
  });
  $('vh-ceil-sub').addEventListener('change', e => {
    if (e.target.id === 'vh-cl-level') S.ceilLevel = Number(e.target.value) || 0;
    if (e.target.id === 'vh-cl-led') S.ceilLed = e.target.checked;
  });

  // ================= Vẽ chu vi =================
  function snapPt(p, exceptDraft) {
    const tol = 12 / S.view.k;
    for (const room of floor().rooms) for (const q of room.pts) if (C.len(C.sub(q, p)) < tol) return q.slice();
    if (!exceptDraft && S.draft?.pts.length > 2 && C.len(C.sub(S.draft.pts[0], p)) < tol) return S.draft.pts[0].slice();
    const s = S.plan.snap || 10;
    return [C.round(p[0], s), C.round(p[1], s)];
  }
  function draftCursor(raw) {
    const d = S.draft, last = d.pts[d.pts.length - 1];
    if (!last) return snapPt(raw);
    let v = C.sub(raw, last);
    if (S.lock || d.arrow) {
      if (d.arrow) v = C.mul(d.arrow, Math.max(0, C.dot(v, d.arrow)));
      else v = Math.abs(v[0]) >= Math.abs(v[1]) ? [v[0], 0] : [0, v[1]];
      const s = S.plan.snap || 10, L = C.round(C.len(v), s);
      const p = C.add(last, C.mul(C.unit(v), L));
      // bắt về điểm đầu nếu cùng hàng
      const first = d.pts[0];
      if (d.pts.length > 2 && C.len(C.sub(p, first)) < 12 / S.view.k) return first.slice();
      return p;
    }
    return snapPt(raw);
  }
  function startDraft(p, ceilLine = S.tool === 'ceil-line') {
    S.draft = {pts: [p], kinds: [], lastV: null, lastH: null, dir: null, cursor: null, nextKind: null, arrow: null, ceilLine};
    renderAll();
  }
  function draftAdd(p, kind) {
    const d = S.draft, last = d.pts[d.pts.length - 1], v = C.sub(p, last);
    if (C.len(v) < 1) return;
    if (d.pts.length > 2 && C.len(C.sub(p, d.pts[0])) < 1) { finishDraft(true); return; }
    d.pts.push(p); d.kinds.push(kind || d.nextKind || 'wall'); d.nextKind = null;
    const u = C.unit(v);
    if (Math.abs(u[0]) < 1e-6) d.lastV = [0, Math.sign(u[1])];
    if (Math.abs(u[1]) < 1e-6) d.lastH = [Math.sign(u[0]), 0];
    d.dir = u;
    renderAll();
  }
  function draftUndo() {
    const d = S.draft;
    if (!d) return;
    d.pts.pop(); d.kinds.pop();
    if (!d.pts.length) S.draft = null;
    renderAll();
  }
  function finishDraft(close) {
    const d = S.draft;
    S.draft = null;
    if (!d) return;
    let pts = d.pts.slice(), kinds = d.kinds.slice();
    if (close && pts.length > 2 && C.len(C.sub(pts[pts.length - 1], pts[0])) < 1) { pts.pop(); kinds.splice(-1, 1, kinds[kinds.length - 1]); }
    if (pts.length < 2 || (close && pts.length < 3)) { renderAll(); return; }
    const closed = close && pts.length > 2;
    if (d.ceilLine) {
      const id = C.uid();
      commit(() => {
        (floor().ceilLines ||= []).push({id, pts, closed, level: S.ceilLevel || 2700, led: !!S.ceilLed});
        S.sel = {kind: 'cl', id};
      });
      setTool('select');
      return;
    }
    const keep = d.keep;
    commit(() => {
      const room = {id: keep?.id || C.uid(), name: keep?.name || 'P' + (floor().rooms.length + 1), closed, ceil: keep?.ceil || 0, gyps: keep?.gyps || 0, skirt: keep?.skirt || 0, note: keep?.note || '',
        pts, segs: [], openings: (keep?.openings || []).filter(o => !o.full), devices: keep?.devices || []};
      kinds.forEach((k, i) => {
        if (k === 'partition') room.segs[i] = {k: 'partition'};
        else if (k === 'open') room.segs[i] = {k: 'open'};
        else if (k === 'window' || k === 'door') room.openings.push({id: C.uid(), seg: i, at: 0, w: C.segLen(room, i), type: k, full: true, hinge: 'l', swing: 'in'});
      });
      // đoạn khép kín (từ điểm cuối về điểm đầu) mặc định là tường
      const rooms = floor().rooms;
      if (keep) rooms.splice(rooms.findIndex(r => r.id === keep.id), 1, room); else rooms.push(room);
      S.sel = {kind: 'room', room: room.id};
    });
  }
  // Vẽ tiếp nét hở gần nhất (hoặc phòng đang chọn)
  function continueOpen() {
    const rooms = floor().rooms, room = (S.sel?.room && roomById(S.sel.room)) || [...rooms].reverse().find(r => !r.closed);
    if (!room || room.closed) return Shell.toast('Không có nét hở để vẽ tiếp.');
    const kinds = Array.from({length: C.segCount(room)}, (_, i) => {
      const full = room.openings.find(o => o.full && o.seg === i);
      return full ? full.type : room.segs[i]?.k || 'wall';
    });
    setTool('draw');
    S.draft = {pts: room.pts.map(p => p.slice()), kinds, lastV: null, lastH: null, dir: null, cursor: null, nextKind: null, keep: JSON.parse(JSON.stringify(room))};
    renderAll();
  }
  // Gợi ý: thêm đoạn vuông góc còn thiếu rồi khép kín
  function suggest() {
    const d = S.draft;
    if (!d || d.pts.length < 2) return;
    const s = d.pts[0], l = d.pts[d.pts.length - 1];
    if (Math.abs(s[0] - l[0]) > 1 && Math.abs(s[1] - l[1]) > 1) {
      const verticalLast = d.dir && Math.abs(d.dir[0]) < 1e-6;
      draftAdd(verticalLast ? [s[0], l[1]] : [l[0], s[1]]);
    }
    if (S.draft) finishDraft(true);
  }
  function freeSpot() {
    const b = C.bounds(C.floorPrimitives(S.plan, floor(), {dims: false}));
    return b ? [C.round(b.x1 + 1500, 100), C.round(b.y0, 100)] : [0, 0];
  }

  // ================= Ô lệnh / giọng nói =================
  function runCommand(text) {
    if (/(?:^|[\s,;])(phòng|phong)(?:$|[\s,;])/i.test(String(text || '').normalize('NFC'))) {
      const desc = C.parseRoomDescription(text);
      if (desc) {
        setTool('select');
        const [x, y] = freeSpot(), {room, columns} = C.roomFromDescription(desc, x, y, 'P' + (floor().rooms.length + 1));
        commit(() => {
          floor().rooms.push(room);
          if (columns?.length) (floor().columns ||= []).push(...columns);
          S.sel = {kind: 'room', room: room.id};
        });
        fit();
        return true;
      }
    }
    const acts = C.parseCommand(text);
    if (!acts.length) { Shell.toast('Chưa hiểu lệnh "' + text + '". VD: dọc 3500 · ngang 1200 cửa sổ · khép kín'); return false; }
    for (const a of acts) {
      if (a.type === 'seg') {
        if (S.tool !== 'draw' && S.tool !== 'ceil-line') setTool('draw');
        if (!S.draft) startDraft(freeSpot());
        const d = S.draft;
        if (a.len > 200000) { Shell.toast('Số đo ' + a.len + ' mm quá lớn, bỏ qua.'); continue; }
        if (a.len == null) { d.arrow = C.stepVector(a.dir, null, d.lastV, d.lastH); continue; }
        const last = d.pts[d.pts.length - 1];
        let v;
        if (a.dir) v = C.stepVector(a.dir, null, d.lastV, d.lastH);
        else if (d.arrow) v = d.arrow;
        else if (d.cursor && C.len(C.sub(d.cursor, last)) > 1) { const u = C.unit(C.sub(d.cursor, last)); v = S.lock ? (Math.abs(u[0]) >= Math.abs(u[1]) ? [Math.sign(u[0]), 0] : [0, Math.sign(u[1])]) : u; }
        else v = d.dir || [1, 0];
        draftAdd(C.add(last, C.mul(v, a.len)), a.kind);
        d.arrow = null;
      } else if (a.type === 'kind') {
        const d = S.draft;
        if (a.kind === 'partition') { if (d) d.nextKind = 'partition'; else Shell.toast('Đang vẽ mới đổi được đoạn tiếp theo thành vách.'); }
        else if (d?.kinds.length) { d.kinds[d.kinds.length - 1] = a.kind; renderAll(); }
        else if (S.sel?.kind === 'seg') addOpening(a.kind === 'open' ? 'open' : a.kind);
      } else if (a.type === 'finish') finishDraft(false);
      else if (a.type === 'close') finishDraft(true);
      else if (a.type === 'continue') continueOpen();
      else if (a.type === 'undo') undo();
      else if (a.type === 'suggest') suggest();
      else if (a.type === 'stop') mic(false);
    }
    return true;
  }
  const cmd = $('vh-cmd');
  cmd.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const t = cmd.value.trim();
      if (!t) { if (S.draft) finishDraft(true); return; }
      if (runCommand(t)) cmd.value = '';
    } else if (e.key === 'Backspace' && !cmd.value && S.draft) { e.preventDefault(); draftUndo(); }
    else if (e.key === 'Escape') { cmd.value = ''; cmd.blur(); if (S.draft) finishDraft(false); }
    else if (S.draft && !cmd.value && e.key.startsWith('Arrow')) { e.preventDefault(); arrow(e.key); }
  });
  function arrow(key) {
    if (!S.draft) return;
    S.draft.arrow = {ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0]}[key];
    $('vh-hint').textContent = 'Đã khoá hướng ' + {ArrowUp: 'lên', ArrowDown: 'xuống', ArrowLeft: 'trái', ArrowRight: 'phải'}[key] + ' – gõ số rồi Enter';
  }
  document.querySelector('.vh-cmd').addEventListener('click', e => {
    const c = e.target.closest('[data-cmd]')?.dataset.cmd;
    if (c) runCommand(c);
  });
  // Micro: đọc tới đâu vẽ tới đó
  let rec = null;
  function mic(on) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (on && !SR) { Shell.toast('Trình duyệt không hỗ trợ đọc giọng nói. Chạm ô lệnh rồi dùng micro của bàn phím điện thoại.'); cmd.focus(); return; }
    if (!on) { if (rec) { rec.onend = null; rec.stop(); } rec = null; $('vh-mic').classList.remove('is-on'); return; }
    rec = new SR();
    rec.lang = 'vi-VN'; rec.continuous = true; rec.interimResults = false;
    rec.onresult = e => {
      const t = e.results[e.results.length - 1][0].transcript.trim();
      cmd.value = t;
      if (runCommand(t)) setTimeout(() => { if (cmd.value === t) cmd.value = ''; }, 1500);
    };
    rec.onerror = e => { if (e.error === 'not-allowed') { Shell.toast('Micro bị chặn. Chạm ô lệnh rồi dùng micro bàn phím.'); mic(false); } };
    rec.onend = () => { if (rec) rec.start(); };
    rec.start();
    $('vh-mic').classList.add('is-on');
  }

  // ================= Chuột / cảm ứng =================
  const ptrs = new Map();
  let drag = null;
  const parseHit = el => { const h = el?.closest?.('[data-hit]')?.dataset.hit; if (!h) return null; const [kind, a, b] = h.split(':'); return kind === 'wall' ? null : {kind, a, b}; };
  const normMulti = hit => {
    if (!hit || hit.kind === 'sched') return null;
    if (['room', 'seg', 'vtx', 'op', 'dev'].includes(hit.kind)) return {kind: 'room', id: hit.a};
    return {kind: hit.kind, id: hit.a};
  };
  const inMulti = it => it && S.multiSel.some(m => m.kind === it.kind && m.id === it.id);
  function toggleMultiItem(it) {
    if (!it) return;
    if (inMulti(it)) S.multiSel = S.multiSel.filter(m => !(m.kind === it.kind && m.id === it.id));
    else S.multiSel.push(it);
  }
  function toggleMultiMode(force) {
    if (S.elev && force !== false) return Shell.toast('Chọn nhiều chỉ dùng ở mặt bằng.');
    S.multi = force != null ? force : !S.multi;
    if (S.multi) {
      if (S.tool !== 'select') setTool('select');
      if (S.sel) {
        const cur = S.sel.room ? {kind: 'room', id: S.sel.room} : S.sel.id ? {kind: S.sel.kind, id: S.sel.id} : null;
        if (cur && !inMulti(cur)) S.multiSel.push(cur);
        S.sel = null;
      }
    } else S.multiSel = [];
    $('vh-multi')?.classList.toggle('is-on', S.multi);
    renderAll();
  }
  function boxSelect(a, b) {
    const x0 = Math.min(a[0], b[0]), x1 = Math.max(a[0], b[0]), y0 = Math.min(a[1], b[1]), y1 = Math.max(a[1], b[1]);
    const addIt = it => { if (!inMulti(it)) S.multiSel.push(it); };
    for (const r of floor().rooms) {
      if (!r.pts.length) continue;
      const xs = r.pts.map(p => p[0]), ys = r.pts.map(p => p[1]);
      if (Math.max(...xs) >= x0 && Math.min(...xs) <= x1 && Math.max(...ys) >= y0 && Math.min(...ys) <= y1) addIt({kind: 'room', id: r.id});
    }
    for (const c of floor().columns || []) if (c.x >= x0 && c.x <= x1 && c.y >= y0 && c.y <= y1) addIt({kind: 'col', id: c.id});
    if (S.mode === 'ceil') {
      for (const it of floor().ceilItems || []) if (it.x >= x0 && it.x <= x1 && it.y >= y0 && it.y <= y1) addIt({kind: 'ci', id: it.id});
      for (const cl of floor().ceilLines || []) if (cl.pts.some(p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1)) addIt({kind: 'cl', id: cl.id});
    }
    const mine = x => (x.mode || 'plan') === S.mode;
    for (const nt of notesList().filter(mine)) if (nt.x <= x1 && nt.x + (nt.w || 2400) >= x0 && nt.y <= y1 && nt.y + 400 >= y0) addIt({kind: 'note', id: nt.id});
    for (const ar of arrowsList().filter(mine)) if (ar.pts.some(p => p[0] >= x0 && p[0] <= x1 && p[1] >= y0 && p[1] <= y1)) addIt({kind: 'ar', id: ar.id});
    for (const ph of floor().photos || []) if (ph.x >= x0 && ph.x <= x1 && ph.y >= y0 && ph.y <= y1) addIt({kind: 'ph', id: ph.id});
  }
  function dragMulti(d, w) {
    const s = S.plan.snap || 10, dx = C.round(w[0] - d.w[0], s), dy = C.round(w[1] - d.w[1], s), bf = d.baseFloor;
    if (!dx && !dy) return;
    d.changed = true;
    for (const m of S.multiSel) {
      if (m.kind === 'room') { const r = roomById(m.id), br = bf.rooms.find(x => x.id === m.id); if (r && br) r.pts = br.pts.map(p => [p[0] + dx, p[1] + dy]); }
      else if (m.kind === 'col') { const c = floor().columns.find(x => x.id === m.id), bc = bf.columns.find(x => x.id === m.id); if (c && bc) { c.x = bc.x + dx; c.y = bc.y + dy; } }
      else if (m.kind === 'ci') { const it = (floor().ceilItems || []).find(x => x.id === m.id), bi = (bf.ceilItems || []).find(x => x.id === m.id); if (it && bi) { it.x = bi.x + dx; it.y = bi.y + dy; } }
      else if (m.kind === 'cl') { const cl = (floor().ceilLines || []).find(x => x.id === m.id), bl = (bf.ceilLines || []).find(x => x.id === m.id); if (cl && bl) cl.pts = bl.pts.map(p => [p[0] + dx, p[1] + dy]); }
      else if (m.kind === 'note') { const nt = notesList().find(x => x.id === m.id), bn = (bf.notes || []).find(x => x.id === m.id); if (nt && bn) { nt.x = bn.x + dx; nt.y = bn.y + dy; } }
      else if (m.kind === 'ar') { const ar = arrowsList().find(x => x.id === m.id), ba = (bf.arrows || []).find(x => x.id === m.id); if (ar && ba) ar.pts = ba.pts.map(p => [p[0] + dx, p[1] + dy]); }
      else if (m.kind === 'ph') { const ph = (floor().photos || []).find(x => x.id === m.id), bp = (bf.photos || []).find(x => x.id === m.id); if (ph && bp) { ph.x = bp.x + dx; ph.y = bp.y + dy; } }
    }
    drawSoon();
  }
  function deleteMulti() {
    if (!S.multiSel.length) return;
    const set = new Set(S.multiSel.map(m => m.kind + ':' + m.id));
    commit(() => {
      floor().rooms = floor().rooms.filter(r => !set.has('room:' + r.id));
      floor().columns = (floor().columns || []).filter(c => !set.has('col:' + c.id));
      floor().ceilItems = (floor().ceilItems || []).filter(c => !set.has('ci:' + c.id));
      floor().ceilLines = (floor().ceilLines || []).filter(c => !set.has('cl:' + c.id));
      floor().notes = (floor().notes || []).filter(n => !set.has('note:' + n.id));
      floor().arrows = (floor().arrows || []).filter(a => !set.has('ar:' + a.id));
      floor().photos = (floor().photos || []).filter(p => !set.has('ph:' + p.id));
      floor().dims = (floor().dims || []).filter(d => !set.has('fdim:' + d.id));
      S.multiSel = [];
    });
  }
  svg.addEventListener('pointerdown', e => {
    svg.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    if (ptrs.size === 2) { const [p, q] = [...ptrs.values()]; drag = {type: 'pinch', d: Math.hypot(p[0] - q[0], p[1] - q[1]), c: [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2]}; S.sketch = null; S.boxDraft = null; return; }
    const w = toWorld(e.clientX, e.clientY), start = {x: e.clientX, y: e.clientY, w, moved: false, touch: e.pointerType !== 'mouse'};
    if (e.button === 1 || e.button === 2 || e.altKey) { drag = {type: 'pan', ...start, view: {...S.view}}; return; }
    const hit = parseHit(e.target);
    if (S.tool === 'select') {
      if (e.shiftKey && hit) {
        const it = normMulti(hit);
        if (it) {
          if (S.sel) { const cur = S.sel.room ? {kind: 'room', id: S.sel.room} : S.sel.id ? {kind: S.sel.kind, id: S.sel.id} : null; if (cur && !inMulti(cur)) S.multiSel.push(cur); S.sel = null; }
          toggleMultiItem(it); renderAll();
        }
        return;
      }
      if (!hit) {
        if (S.multi || e.shiftKey) { drag = {type: 'box', ...start}; return; }
        drag = {type: 'pan', ...start, view: {...S.view}, clear: true}; return;
      }
      const mIt = normMulti(hit);
      if (start.touch && !S.multi && !(S.multiSel.length && inMulti(mIt)) && !isSelected(hit)) { drag = {type: 'pan', ...start, view: {...S.view}, tapHit: hit}; return; }
      if (S.multiSel.length && inMulti(mIt)) {
        drag = {type: 'multi', hit, ...start, snapshot: JSON.stringify(S.plan), baseFloor: JSON.parse(JSON.stringify(floor()))};
        return;
      }
      if (S.multi && mIt) { drag = {type: 'multi-pick', hit, ...start}; return; }
      drag = {type: 'obj', hit, ...start, snapshot: JSON.stringify(S.plan), base: JSON.parse(JSON.stringify(currentObj(hit)))};
      return;
    }
    if (S.tool === 'draw' || S.tool === 'ceil-line') { drag = {type: 'draw', ...start, path: [w]}; return; }
    if (S.tool === 'bg-move' && floor().bg) { drag = {type: 'bgmove', ...start, snapshot: JSON.stringify(S.plan), base: [floor().bg.x || 0, floor().bg.y || 0]}; return; }
    drag = {type: 'place', ...start};
  });
  svg.addEventListener('pointermove', e => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    const w = toWorld(e.clientX, e.clientY);
    S.cursor = w;
    if (drag?.type === 'pinch' && ptrs.size === 2) {
      const [p, q] = [...ptrs.values()], dist = Math.hypot(p[0] - q[0], p[1] - q[1]), c = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
      S.view.x += c[0] - drag.c[0]; S.view.y += c[1] - drag.c[1];
      zoomAt(c[0], c[1], dist / drag.d);
      drag.d = dist; drag.c = c;
      return;
    }
    if (drag) drag.moved ||= Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6;
    if (drag?.type === 'pan' && drag.moved) {
      S.view.x = drag.view.x + e.clientX - drag.x; S.view.y = drag.view.y + e.clientY - drag.y;
      svg.classList.add('is-pan'); applyView(); return;
    }
    if (drag?.type === 'box') { S.boxDraft = [drag.w, w]; renderOverlay(); return; }
    if (drag?.type === 'multi' && drag.moved) { dragMulti(drag, w); return; }
    if (drag?.type === 'obj' && drag.moved) { dragObj(drag, w); return; }
    if (drag?.type === 'bgmove' && drag.moved) { const bg = floor().bg, s = S.plan.snap || 10; bg.x = C.round(drag.base[0] + w[0] - drag.w[0], s); bg.y = C.round(drag.base[1] + w[1] - drag.w[1], s); renderBg(); return; }
    if (S.tool === 'bg-scale' && S.bgPts) { renderOverlay(); return; }
    if (S.tool === 'draw' || S.tool === 'ceil-line') {
      if (S.tool === 'draw' && drag?.type === 'draw' && !S.draft && drag.moved) { drag.path.push(w); S.sketch = drag.path; renderOverlay(); return; }
      if (S.draft) { S.draft.cursor = draftCursor(w); renderOverlay(); }
      return;
    }
    if (S.tool === 'dim' && S.dimDraft) { S.cursor = S.dimDraft.b ? w : snapPt(w); renderOverlay(); }
    if (S.tool === 'arrow' && S.arrowDraft) { S.cursor = snapPt(w); renderOverlay(); }
  });
  const endPtr = e => {
    ptrs.delete(e.pointerId);
    svg.classList.remove('is-pan');
    const d = drag;
    if (!d || (d.type === 'pinch' && ptrs.size)) return;
    drag = null;
    if (d.type === 'pinch') return;
    const w = toWorld(e.clientX, e.clientY);
    if (d.type === 'pan') {
      if (!d.moved && d.tapHit) { S.multiSel = []; select(d.tapHit, e); }
      else if (!d.moved && d.clear) { S.sel = null; S.multiSel = []; renderAll(); }
      return;
    }
    if (d.type === 'box') {
      S.boxDraft = null;
      if (d.moved) { boxSelect(d.w, w); S.sel = null; }
      else S.multiSel = [];
      renderAll(); return;
    }
    if (d.type === 'multi-pick') {
      if (!d.moved) { S.sel = null; toggleMultiItem(normMulti(d.hit)); renderAll(); }
      return;
    }
    if (d.type === 'multi') {
      if (d.moved) { if (d.changed) { pushHist(d.snapshot); S.fut = []; markDirty(); } renderAll(); }
      else if (S.multi) { toggleMultiItem(normMulti(d.hit)); renderAll(); }
      else { S.multiSel = []; select(d.hit, e); }
      return;
    }
    if (d.type === 'obj') {
      if (d.moved) { if (d.changed) { pushHist(d.snapshot); S.fut = []; markDirty(); } renderAll(); }
      else if (!d.fab) { S.multiSel = []; select(d.hit, e); }
      return;
    }
    if (d.type === 'bgmove') { if (d.moved) { pushHist(d.snapshot); S.fut = []; markDirty(); renderAll(); } return; }
    if (d.type === 'draw') {
      if (S.tool === 'draw' && !S.draft && d.moved && d.path.length > 4) {   // nét phác một lèo
        S.sketch = null;
        const r = C.simplifySketch(d.path, 10 / S.view.k);
        if (!r) { renderOverlay(); return; }
        S.draft = {pts: r.pts, kinds: r.pts.slice(1).map(() => 'wall'), lastV: null, lastH: null, dir: null, cursor: null, nextKind: null};
        finishDraft(r.closed);
        Shell.toast('Đã dựng phòng từ nét phác – chạm từng số kích thước để sửa số đo thật.');
        return;
      }
      if (!S.draft) { startDraft(snapPt(w)); return; }
      if (d.moved && d.touch) return;   // cảm ứng kéo = chỉ hướng, gõ số sau
      const p = draftCursor(w);
      if (S.draft.pts.length > 2 && C.len(C.sub(p, S.draft.pts[0])) < 1) { finishDraft(true); return; }
      draftAdd(p);
      return;
    }
    if (d.type === 'place' && !d.moved) place(w, d.touch);
  };
  svg.addEventListener('pointerup', endPtr);
  svg.addEventListener('pointercancel', endPtr);
  svg.addEventListener('contextmenu', e => e.preventDefault());
  svg.addEventListener('wheel', e => { e.preventDefault(); zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * 0.0015)); }, {passive: false});
  svg.addEventListener('dblclick', e => { if (S.tool === 'draw' && S.draft) { e.preventDefault(); addColumn(S.draft.pts[S.draft.pts.length - 1]); } });

  function currentObj(hit) {
    const room = roomById(hit.a);
    if (hit.kind === 'col') return floor().columns.find(c => c.id === hit.a);
    if (hit.kind === 'fdim') return floor().dims.find(c => c.id === hit.a);
    if (hit.kind === 'ci') return (floor().ceilItems || []).find(c => c.id === hit.a);
    if (hit.kind === 'cl') return (floor().ceilLines || []).find(c => c.id === hit.a);
    if (hit.kind === 'note') return notesList().find(n => n.id === hit.a);
    if (hit.kind === 'ar') return arrowsList().find(a => a.id === hit.a);
    if (hit.kind === 'ph') return (floor().photos || []).find(p => p.id === hit.a);
    if (hit.kind === 'sched') return floor()[hit.a === 'ceil' ? 'schedCeilOff' : 'schedPlanOff'] || [0, 0];
    if (!room) return null;
    if (hit.kind === 'op') return room.openings.find(o => o.id === hit.b);
    if (hit.kind === 'dev') return room.devices.find(o => o.id === hit.b);
    return room;
  }
  function dragObj(d, w) {
    const delta = C.sub(w, d.w), s = S.plan.snap || 10, base = d.base;
    if (!base) return;
    const room = roomById(d.hit.a);
    if (!C.round(delta[0], s) && !C.round(delta[1], s) && !d.changed) return;
    d.changed = true;
    const fr = S.elev && room ? C.elevFrame(room, S.elev.i) : null, du = fr ? (fr.flip ? -delta[0] : delta[0]) : 0;
    if (fr && d.hit.kind === 'dev') {   // mặt đứng: dời ngang = at, dời dọc = cao độ
      const dev = room.devices.find(o => o.id === d.hit.b);
      dev.at = Math.max(0, Math.min(fr.L, C.round(base.at + du, s)));
      dev.h = Math.max(0, C.round((base.h ?? C.DEVICES[base.type]?.h ?? 0) - delta[1], s));
    } else if (fr && d.hit.kind === 'op') {
      const op = room.openings.find(o => o.id === d.hit.b);
      op.at = Math.max(0, Math.min(fr.L - op.w, C.round(base.at + du, s))); op.full = false;
    } else if (d.hit.kind === 'room' && room) room.pts = base.pts.map(p => [C.round(p[0] + delta[0], s), C.round(p[1] + delta[1], s)].map((v, k) => v - C.round(base.pts[0][k], s) + base.pts[0][k]));
    else if (d.hit.kind === 'seg' && room) {   // kéo tường: dời song song (co / giãn phòng)
      const i = Number(d.hit.b), n = C.normal({...base, pts: base.pts}, i), dn = C.round(C.dot(delta, n), s), j = (i + 1) % base.pts.length;
      room.pts = base.pts.map((p, k) => k === i || k === j ? C.add(p, C.mul(n, dn)) : p);
    } else if (d.hit.kind === 'vtx' && room) {
      const j = Number(d.hit.b);
      room.pts = base.pts.map((p, k) => k === j ? snapPt(C.add(p, delta), true) : p);
    } else if (d.hit.kind === 'op' && room) {
      const op = room.openings.find(o => o.id === d.hit.b), [a, b] = C.segEnds(room, op.seg), u = C.unit(C.sub(b, a));
      op.at = Math.max(0, Math.min(C.segLen(room, op.seg) - op.w, C.round(base.at + C.dot(delta, u), s)));
    } else if (d.hit.kind === 'dev' && room) {
      const dev = room.devices.find(o => o.id === d.hit.b), near = C.nearestSeg({rooms: [room]}, w);
      if (near) { dev.seg = near.seg; dev.at = C.round(near.at, s); }
    } else if (d.hit.kind === 'col') {
      const col = floor().columns.find(c => c.id === d.hit.a);
      col.x = C.round(base.x + delta[0], s); col.y = C.round(base.y + delta[1], s);
    } else if (d.hit.kind === 'ci') {
      const it = (floor().ceilItems || []).find(c => c.id === d.hit.a);
      if (it) { it.x = C.round(base.x + delta[0], s); it.y = C.round(base.y + delta[1], s); }
    } else if (d.hit.kind === 'cl') {
      const cl = (floor().ceilLines || []).find(c => c.id === d.hit.a);
      if (cl) cl.pts = base.pts.map(p => [C.round(p[0] + delta[0], s), C.round(p[1] + delta[1], s)]);
    } else if (d.hit.kind === 'note') {
      const nt = notesList().find(n => n.id === d.hit.a);
      if (nt) { nt.x = C.round(base.x + delta[0], s); nt.y = C.round(base.y + delta[1], s); }
    } else if (d.hit.kind === 'ar') {
      const ar = arrowsList().find(a => a.id === d.hit.a);
      if (ar) ar.pts = base.pts.map(p => [C.round(p[0] + delta[0], s), C.round(p[1] + delta[1], s)]);
    } else if (d.hit.kind === 'ph') {
      const ph = (floor().photos || []).find(p => p.id === d.hit.a);
      if (ph) { ph.x = C.round(base.x + delta[0], s); ph.y = C.round(base.y + delta[1], s); }
    } else if (d.hit.kind === 'sched') {
      floor()[d.hit.a === 'ceil' ? 'schedCeilOff' : 'schedPlanOff'] = [C.round(base[0] + delta[0], s), C.round(base[1] + delta[1], s)];
    } else if (d.hit.kind === 'fdim') {
      const dim = floor().dims.find(c => c.id === d.hit.a);
      dim.off = dimOffset(dim.a, dim.b, w);
    }
    drawSoon();
  }
  // kéo liên tục: dựng lại SVG tối đa 1 lần / khung hình
  let drawPending = false;
  function drawSoon() {
    if (drawPending) return;
    drawPending = true;
    requestAnimationFrame(() => { drawPending = false; if (S.plan) { drawLayer.innerHTML = viewPrims().map(primSvg).join(''); renderOverlay(); } });
  }
  function isSelected(hit) {
    const s = S.sel;
    if (!s || !hit) return false;
    if (hit.kind === 'seg') return s.kind === 'seg' && s.room === hit.a && s.i === Number(hit.b);
    if (hit.kind === 'room' || hit.kind === 'vtx') return s.kind === 'room' && s.room === hit.a || s.kind === 'seg' && s.room === hit.a && hit.kind === 'vtx';
    if (hit.kind === 'op' || hit.kind === 'dev') return s.kind === hit.kind && s.id === hit.b;
    return s.kind === hit.kind && s.id === hit.a;
  }

  // ================= Đặt thiết bị / cột / đo =================
  function place(w, touch = false) {   // chạm tay: đặt xong về Chọn; chuột: giữ công cụ để đặt liên tiếp
    if (S.tool === 'bg-scale') return bgScalePick(w);
    if (S.tool === 'device' && S.elev) {   // mặt đứng: x -> at (theo chiều nhìn), y -> cao độ
      const room = roomById(S.elev.roomId), fr = C.elevFrame(room, S.elev.i), s = S.plan.snap || 10, id = C.uid();
      const x = Math.max(0, Math.min(fr.L, w[0])), at = C.round(fr.flip ? fr.L - x : x, s), h = Math.max(0, C.round(-w[1], s));
      commit(() => { room.devices.push({id, type: S.devType, seg: S.elev.i, at, h}); S.sel = {kind: 'dev', room: room.id, id}; });
      if (touch) setTool('select');
      return;
    }
    if (S.tool === 'device') {
      if (ceilUI()) {
        const s = S.plan.snap || 10, x = C.round(w[0], s), y = C.round(w[1], s);
        const spec = C.CEIL[S.ceilType] || C.CEIL.downlight, size = S.ceilSize ?? spec.def, id = C.uid();
        commit(() => { (floor().ceilItems ||= []).push({id, type: S.ceilType, x, y, size, rot: 0, dim: false}); S.sel = {kind: 'ci', id}; });
        if (touch) setTool('select');
        return;
      }
      const near = C.nearestSeg(floor(), w, (room, i) => C.segInfo(S.plan, room, i).k !== 'open');
      if (!near || near.dist > 700) return Shell.toast('Chạm sát tường để đặt thiết bị.');
      const spec = C.DEVICES[S.devType], id = C.uid();
      commit(() => { near.room.devices.push({id, type: S.devType, seg: near.seg, at: C.round(near.at, S.plan.snap || 10), h: spec.h}); S.sel = {kind: 'dev', room: near.room.id, id}; });
      if (touch) setTool('select');
    } else if (S.tool === 'column') addColumn(w);
    else if (S.tool === 'dim') {
      const p = snapPt(w);
      if (!S.dimDraft) S.dimDraft = {a: p};
      else if (!S.dimDraft.b) { if (C.len(C.sub(p, S.dimDraft.a)) > 1) S.dimDraft.b = p; }
      else {
        const {a, b} = S.dimDraft;
        S.dimDraft = null;
        commit(() => floor().dims.push({id: C.uid(), a, b, off: dimOffset(a, b, w), mode: S.mode}));
      }
      renderOverlay();
    } else if (S.tool === 'note') {
      const s = S.plan.snap || 10, x = C.round(w[0], s), y = C.round(w[1], s), font = S.plan.font || 150, id = C.uid();
      setTool('select');
      commit(() => {
        notesList().push({id, x, y, w: font * 16, text: '', title: 'GHI CHÚ', showTitle: true, color: '#b91c1c', size: font, bold: false, list: 'none', frame: true, mode: S.mode});
        S.sel = {kind: 'note', id};
      });
      pop.querySelector('[data-f=ntext]')?.focus();
    } else if (S.tool === 'arrow') {
      const p = snapPt(w);
      if (!S.arrowDraft) { S.arrowDraft = {pts: [p]}; renderOverlay(); return; }
      const prev = S.arrowDraft.pts[S.arrowDraft.pts.length - 1];
      if (C.len(C.sub(p, prev)) < 1) return;
      if (S.arrowDraft.pts.length < 2) { S.arrowDraft.pts.push(p); renderOverlay(); return; }
      const pts = [...S.arrowDraft.pts, p], mode = S.mode;
      S.arrowDraft = null; renderOverlay();
      finishArrow(pts, mode);
    } else if (S.tool === 'photo') {
      const s = S.plan.snap || 10;
      S.pendingPhoto = {x: C.round(w[0], s), y: C.round(w[1], s)};
      $('vh-photo-input').click();
    }
  }
  $('vh-photo-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    const pend = S.pendingPhoto;
    S.pendingPhoto = null;
    if (!file || !pend) return;
    Shell.toast('Đang nén và tải ảnh hiện trường…');
    try {
      const name = await uploadImageAsset(file);
      if (pend.replaceId) {
        commit(() => { const ph = (floor().photos || []).find(p => p.id === pend.replaceId); if (ph) ph.name = name; });
        openPhotoDialog(pend.replaceId);
      } else {
        const id = C.uid();
        setTool('select');
        commit(() => { (floor().photos ||= []).push({id, x: pend.x, y: pend.y, name, note: ''}); S.sel = {kind: 'ph', id}; });
        openPhotoDialog(id);
      }
    } catch (error) { Shell.toast('Không tải được ảnh: ' + error.message); }
  });
  async function openPhotoDialog(id) {
    const list = floor().photos || [], idx = list.findIndex(p => p.id === id), ph = list[idx];
    if (!ph) return;
    const dlg = $('vh-photo-dlg'), img = $('vh-photo-img');
    dlg.dataset.phId = id;
    $('vh-photo-title').textContent = 'Ảnh hiện trường #' + (idx + 1);
    $('vh-photo-note').value = ph.note || '';
    img.removeAttribute('src');
    if (!dlg.open) dlg.showModal();
    try { img.src = await assetBlobUrl(ph.name); }
    catch (error) { Shell.toast('Không tải được ảnh: ' + error.message); }
  }
  $('vh-photo-note').addEventListener('change', e => {
    const id = $('vh-photo-dlg').dataset.phId, ph = (floor().photos || []).find(p => p.id === id);
    if (ph) commit(() => { ph.note = e.target.value.slice(0, 500); });
  });
  $('vh-photo-replace').addEventListener('click', () => {
    const id = $('vh-photo-dlg').dataset.phId;
    if (!id) return;
    S.pendingPhoto = {replaceId: id};
    $('vh-photo-input').click();
  });
  $('vh-photo-del').addEventListener('click', () => {
    const id = $('vh-photo-dlg').dataset.phId;
    $('vh-photo-dlg').close();
    if (id) { S.sel = {kind: 'ph', id}; deleteSel(); }
  });
  async function finishArrow(pts, mode) {
    const text = await Shell.ask({title: 'Chữ mũi tên', input: {value: '', placeholder: 'Nhập nội dung chú thích…'}});
    if (text === null) return;
    const id = C.uid();
    setTool('select');
    commit(() => {
      arrowsList().push({id, pts, text: text.trim(), color: '#b91c1c', mode});
      S.sel = {kind: 'ar', id};
    });
  }
  function addColumn(w) {
    const s = S.plan.snap || 10, size = 200, id = C.uid();
    let c = [C.round(w[0], s), C.round(w[1], s)];
    const near = C.nearestSeg(floor(), w, (room, i) => C.segInfo(S.plan, room, i).k !== 'open');
    if (near && near.dist < 300) {   // cột sát tường: ăn vào tường, mặt ngoài cột trùng mặt ngoài tường
      const [a, b] = C.segEnds(near.room, near.seg), d = C.unit(C.sub(b, a)), n = C.normal(near.room, near.seg), t = C.segInfo(S.plan, near.room, near.seg).t;
      c = C.add(C.add(a, C.mul(d, C.round(near.at, s))), C.mul(n, t - size / 2));
    }
    commit(() => { floor().columns.push({id, x: c[0], y: c[1], w: size, h: size}); S.sel = {kind: 'col', id}; });
  }
  function addOpening(type) {
    const room = roomById(S.sel.room), i = S.sel.i, L = C.segLen(room, i);
    const w = Math.min(L, {door: 900, window: 1200, open: 900}[type]), id = C.uid();
    commit(() => { room.openings.push({id, seg: i, at: C.round((L - w) / 2, 10), w, type, hinge: 'l', swing: 'in'}); S.sel = {kind: 'op', room: room.id, id}; });
  }

  // ================= Chọn + bảng sửa nhanh =================
  function select(hit) {
    if (hit.kind === 'seg') { if (!(S.sel?.kind === 'seg' && S.sel.room === hit.a)) S.lenMode = 'square'; S.sel = {kind: 'seg', room: hit.a, i: Number(hit.b)}; }
    else if (hit.kind === 'room' || hit.kind === 'vtx') S.sel = {kind: 'room', room: hit.a};
    else if (hit.kind === 'op' || hit.kind === 'dev') S.sel = {kind: hit.kind, room: hit.a, id: hit.b};
    else S.sel = {kind: hit.kind, id: hit.a};
    renderAll();
    revealSel(hit);
    if (hit.kind === 'seg' && !matchMedia('(pointer: coarse)').matches) pop.querySelector('[data-f=len]')?.select();
    if (hit.kind === 'ph') openPhotoDialog(hit.a);
  }
  function revealSel(hit) {
    if (pop.hidden || innerWidth > 640) return;
    const key = hit.kind + ':' + hit.a + (hit.b != null ? ':' + hit.b : '');
    const els = [...drawLayer.querySelectorAll('[data-hit]')].filter(el => el.dataset.hit === key);
    if (!els.length) return;
    const bottom = Math.max(...els.map(el => el.getBoundingClientRect().bottom)), top = pop.getBoundingClientRect().top - 16;
    if (bottom > top) { S.view.y -= bottom - top; applyView(); placeFab?.(); }
  }
  const field = (label, f, value, attrs = '') => `<label>${label}<input data-f="${f}" value="${esc(value)}" ${attrs}></label>`;
  const num = (label, f, value) => `<label>${label}<div class="vh-step"><button type="button" data-step="${f}:-10">−</button><input data-f="${f}" type="number" inputmode="numeric" value="${Math.round(value)}"><button type="button" data-step="${f}:10">+</button></div></label>`;
  const head = title => `<h3>${esc(title)}<button type="button" class="vh-x" data-pop="close" aria-label="Đóng">×</button></h3>`;
  function renderPop() {
    if (S.multiSel.length && S.tool === 'select') {
      pop.innerHTML = head('Đã chọn ' + S.multiSel.length + ' đối tượng') +
        '<p class="vh-muted">Kéo bất kỳ đối tượng nào trong nhóm để dời cả nhóm, hoặc bấm Delete để xoá.</p>' +
        `<div class="vh-btns"><button type="button" data-pop="clearMulti">Bỏ chọn</button><button type="button" class="vh-danger" data-pop="delMulti">🗑 Xoá (${S.multiSel.length})</button></div>`;
      pop.hidden = false; return;
    }
    const sel = S.sel, room = sel?.room && roomById(sel.room);
    if (!sel || S.tool !== 'select') { pop.hidden = true; return; }
    let html = '';
    if (sel.kind === 'seg' && room) {
      const info = C.segInfo(S.plan, room, sel.i);
      const kb = (k, label) => `<button type="button" data-pop="segk:${k}" class="${info.k === k ? 'is-on' : ''}">${label}</button>`;
      html = head('Đoạn tường · ' + room.name) +
        `<div class="vh-segnav"><button type="button" data-pop="segPrev" aria-label="Đoạn trước">‹</button><b>Đoạn ${sel.i + 1}/${C.segCount(room)}</b><button type="button" data-pop="segNext" aria-label="Đoạn sau">›</button></div>` +
        num('Chiều dài', 'len', C.segLen(room, sel.i)) +
        `<label>Kiểu đổi dài<select data-f="lenmode"><option value="square">Giữ vuông</option><option value="shift">Dời cả phần sau</option><option value="end">Chỉ dời điểm cuối</option></select></label>` +
        (info.k !== 'open' ? num('Dày', 'thick', info.t) : '') +
        '<div class="vh-btns vh-kinds">' + kb('wall', 'Tường') + kb('partition', 'Vách') + kb('open', 'Lối đi') +
        '<button type="button" data-pop="door">+ Cửa</button><button type="button" data-pop="window">+ Cửa sổ</button><button type="button" data-pop="open">+ Ô mở</button></div>' +
        '<div class="vh-btns"><button type="button" data-pop="elev">▥ Mặt đứng</button><button type="button" data-pop="room">Cả phòng</button></div>';
    } else if (sel.kind === 'op' && room) {
      const op = room.openings.find(o => o.id === sel.id);
      if (!op) { S.sel = null; pop.hidden = true; return; }
      html = head({door: 'Cửa đi', window: 'Cửa sổ', open: 'Ô mở'}[op.type]) + num('Rộng', 'opw', op.w) + num('Cách đầu tường', 'opat', op.at) +
        `<label>Loại<select data-f="optype"><option value="door">Cửa đi</option><option value="window">Cửa sổ</option><option value="open">Ô mở</option></select></label>` +
        (op.type === 'door' ? `<label>Cánh<select data-f="leaves"><option value="1">1 cánh</option><option value="2">2 cánh</option></select></label>` + num('Cao cửa', 'oph', op.h ?? 2100) : '') +
        (op.type === 'window' ? num('Cao bậu', 'opsill', op.sill ?? 900) + num('Cao cửa sổ', 'ophw', op.hw ?? 1400) : '') +
        '<div class="vh-btns">' + (op.type === 'door' ? '<button type="button" data-pop="flip" title="Lần lượt 4 kiểu mở">⇆ Đổi chiều mở</button>' : '') + '<button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else if (sel.kind === 'dev' && room) {
      const dev = room.devices.find(o => o.id === sel.id);
      if (!dev) { S.sel = null; pop.hidden = true; return; }
      const spec = C.DEVICES[dev.type] || {};
      html = head(spec.label || 'Thiết bị') + `<label>Loại<select data-f="devtype">${Object.entries(C.DEVICES).map(([k, d]) => `<option value="${k}">${esc(d.label)}</option>`).join('')}</select></label>` +
        num('Cao độ' + (spec.note ? ' (' + spec.note + ')' : ''), 'devh', dev.h ?? spec.h ?? 0) + num('Tim cách đầu tường', 'devat', dev.at) +
        (spec.w ? num('Rộng', 'devw', dev.w || spec.w) : '') +
        '<div class="vh-btns"><button type="button" data-pop="copyL">⧉ Copy trái</button><button type="button" data-pop="copyR">⧉ Copy phải</button><button type="button" data-pop="devflip">⇆ Lật</button><button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else if (sel.kind === 'room' && room) {
      html = head('Phòng') + field('Tên phòng', 'rname', room.name) + field('Cao độ trần (mm)', 'ceil', room.ceil || '', 'type="number" inputmode="numeric" placeholder="VD 3300"') +
        field('Trần thạch cao +', 'gyps', room.gyps || '', 'type="number" inputmode="numeric" placeholder="VD 2750"') +
        field('Len (mm)', 'skirt', room.skirt || '', 'type="number" inputmode="numeric" placeholder="VD 80"') +
        `<label>Ghi chú<textarea data-f="note" rows="2">${esc(room.note || '')}</textarea></label>` +
        `<p class="vh-muted">${room.closed ? 'Diện tích ' + (C.area(room) / 1e6).toFixed(2).replace('.', ',') + ' m² · ' : 'Nét hở · '}chu vi ${fmt(C.perimeter(room))} mm · ${room.pts.length} góc</p>` +
        '<div class="vh-btns">' + (room.closed ? '' : '<button type="button" data-pop="continue">✎ Vẽ tiếp</button><button type="button" data-pop="closeRoom">▭ Khép kín</button>') +
        '<button type="button" data-pop="dup">⧉ Nhân bản</button><button type="button" data-pop="toFloor">Chuyển tầng…</button><button type="button" class="vh-danger" data-pop="del">🗑 Xoá phòng</button></div>';
    } else if (sel.kind === 'ci') {
      const it = (floor().ceilItems || []).find(c => c.id === sel.id);
      if (!it) { S.sel = null; pop.hidden = true; return; }
      const spec = C.CEIL[it.type] || {};
      html = head(spec.label || 'Thiết bị trần') +
        `<label>Loại<select data-f="citype">${Object.entries(C.CEIL).map(([k, d]) => `<option value="${k}">${esc(d.label)}</option>`).join('')}</select></label>` +
        `<label>Cỡ<select data-f="cisize">${(spec.sizes || []).map(sz => `<option value="${esc(sz)}">${esc(C.sizeText(it.type, sz))}</option>`).join('')}</select></label>` +
        num('Xoay (độ)', 'cirot', it.rot || 0) +
        `<label class="vh-check"><input type="checkbox" data-f="cidim" ${it.dim ? 'checked' : ''}> Luôn hiện dim</label>` +
        '<div class="vh-btns"><button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else if (sel.kind === 'cl') {
      const cl = (floor().ceilLines || []).find(c => c.id === sel.id);
      if (!cl) { S.sel = null; pop.hidden = true; return; }
      html = head('Giật cấp trần') + num('Cao độ (+mm)', 'cllevel', cl.level || 0) +
        `<label class="vh-check"><input type="checkbox" data-f="clled" ${cl.led ? 'checked' : ''}> LED hắt</label>` +
        `<label class="vh-check"><input type="checkbox" data-f="clclosed" ${cl.closed ? 'checked' : ''}> Khép kín</label>` +
        '<div class="vh-btns"><button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else if (sel.kind === 'col') {
      const col = floor().columns.find(c => c.id === sel.id);
      if (!col) { S.sel = null; pop.hidden = true; return; }
      html = head('Cột') + num('Rộng', 'colw', col.w) + num('Sâu', 'colh', col.h) + num('Xoay (độ)', 'colr', col.rot || 0) +
        `<label class="vh-check"><input type="checkbox" data-f="colround" ${col.round ? 'checked' : ''}> Cột tròn</label>` +
        '<div class="vh-btns"><button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else if (sel.kind === 'fdim') {
      html = head('Kích thước đo thêm') + '<p class="vh-muted">Kéo để dời đường kích thước.</p><div class="vh-btns"><button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else if (sel.kind === 'note') {
      const nt = notesList().find(n => n.id === sel.id);
      if (!nt) { S.sel = null; pop.hidden = true; return; }
      const font = S.plan.font || 150;
      html = head('Ghi chú') +
        `<label>Nội dung<textarea data-f="ntext" rows="3" placeholder="Nhập ghi chú nhiều dòng…">${esc(nt.text || '')}</textarea></label>` +
        `<label class="vh-check"><input type="checkbox" data-f="nshowtitle" ${nt.showTitle !== false ? 'checked' : ''}> Hiện tiêu đề</label>` +
        (nt.showTitle !== false ? field('Tiêu đề', 'ntitle', nt.title || 'GHI CHÚ') : '') +
        `<label>Màu chữ<input type="color" data-f="ncolor" value="${esc(nt.color || '#b91c1c')}"></label>` +
        num('Cỡ chữ', 'nsize', nt.size || font) +
        num('Độ rộng', 'nw', nt.w || (nt.size || font) * 16) +
        `<label>Danh sách<select data-f="nlist"><option value="none">Không</option><option value="dot">• Chấm đầu dòng</option><option value="num">1. Đánh số</option></select></label>` +
        `<label class="vh-check"><input type="checkbox" data-f="nbold" ${nt.bold ? 'checked' : ''}> Chữ đậm</label>` +
        `<label class="vh-check"><input type="checkbox" data-f="nframe" ${nt.frame !== false ? 'checked' : ''}> Đóng khung</label>` +
        '<div class="vh-btns"><button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else if (sel.kind === 'ar') {
      const ar = arrowsList().find(a => a.id === sel.id);
      if (!ar) { S.sel = null; pop.hidden = true; return; }
      html = head('Mũi tên') +
        `<label>Chữ<textarea data-f="artext" rows="2">${esc(ar.text || '')}</textarea></label>` +
        `<label>Màu<input type="color" data-f="arcolor" value="${esc(ar.color || '#b91c1c')}"></label>` +
        num('Cỡ chữ', 'arsize', ar.size || S.plan.font || 150) +
        '<div class="vh-btns"><button type="button" class="vh-danger" data-pop="del">🗑 Xoá</button></div>';
    } else { pop.hidden = true; return; }
    pop.innerHTML = html;
    if (sel.kind === 'seg') pop.querySelector('[data-f=lenmode]').value = S.lenMode || 'square';
    if (sel.kind === 'op') { const op = room.openings.find(o => o.id === sel.id); pop.querySelector('[data-f=optype]').value = op.type; const lv = pop.querySelector('[data-f=leaves]'); if (lv) lv.value = op.leaves === 2 ? '2' : '1'; }
    if (sel.kind === 'dev') pop.querySelector('[data-f=devtype]').value = room.devices.find(o => o.id === sel.id).type;
    if (sel.kind === 'ci') { const it = (floor().ceilItems || []).find(c => c.id === sel.id); pop.querySelector('[data-f=citype]').value = it.type; pop.querySelector('[data-f=cisize]').value = String(it.size ?? C.CEIL[it.type]?.def); }
    if (sel.kind === 'note') { const nt = notesList().find(n => n.id === sel.id); pop.querySelector('[data-f=nlist]').value = nt.list || 'none'; }
    pop.hidden = !!(S.popHide && matchMedia('(max-width: 640px)').matches);
  }
  // Nút tròn nổi quanh đối tượng đang chọn (CSS chỉ hiện ở điện thoại); bảng thuộc tính là bảng bên / bottom sheet nên không cần đặt vị trí
  function placeFab() {
    const fab = $('vh-fab'), sel = S.sel;
    if (!sel || S.tool !== 'select' || S.multiSel.length || drag?.type === 'obj') { fab.hidden = true; return; }
    const b = over.getBoundingClientRect(), r = $('vh-stage').getBoundingClientRect();
    if (!b.width && !b.height) { fab.hidden = true; return; }
    fab.hidden = false;
    fab.querySelector('[data-fab=elev]').hidden = sel.kind !== 'seg';
    fab.querySelector('[data-fab=props]').classList.toggle('is-on', !S.popHide);
    const fw = fab.offsetWidth, fh = fab.offsetHeight;
    fab.style.left = Math.max(4, Math.min(r.width - fw - 4, b.left - r.left + b.width / 2 - fw / 2)) + 'px';
    fab.style.top = Math.max(4, Math.min(r.height - fh - 4, b.top - r.top - fh - 10)) + 'px';
  }
  function applyField(f, raw) {
    if (f === 'lenmode') { S.lenMode = raw; return; }
    const sel = S.sel, room = sel?.room && roomById(sel.room), v = Number(raw);
    const op = room?.openings.find(o => o.id === sel.id), dev = room?.devices.find(o => o.id === sel.id), col = floor().columns.find(c => c.id === sel?.id);
    const ci = (floor().ceilItems || []).find(c => c.id === sel?.id), cl = (floor().ceilLines || []).find(c => c.id === sel?.id);
    const nt = notesList().find(n => n.id === sel?.id), ar = arrowsList().find(a => a.id === sel?.id);
    commit(() => {
      switch (f) {
        case 'len': if (v > 0 && v <= 200000) C.setSegLength(room, sel.i, v, S.lenMode || 'square'); break;
        case 'thick': if (v > 0) { room.segs[sel.i] = {...room.segs[sel.i], t: v}; } break;
        case 'segk': room.segs[sel.i] = {...room.segs[sel.i], k: raw}; break;
        case 'opw': if (v > 0) { op.w = Math.min(v, C.segLen(room, op.seg)); op.full = false; op.at = Math.min(op.at, C.segLen(room, op.seg) - op.w); } break;
        case 'opat': op.at = Math.max(0, Math.min(C.segLen(room, op.seg) - op.w, v)); op.full = false; break;
        case 'optype': op.type = raw; break;
        case 'leaves': op.leaves = Number(raw); break;
        case 'oph': if (v > 0) op.h = Math.round(v); break;
        case 'opsill': if (v >= 0) op.sill = Math.round(v); break;
        case 'ophw': if (v > 0) op.hw = Math.round(v); break;
        case 'devtype': dev.type = raw; dev.h = C.DEVICES[raw].h; break;
        case 'devh': dev.h = v; break;
        case 'devat': dev.at = Math.max(0, Math.min(C.segLen(room, dev.seg), v)); break;
        case 'devw': if (v > 0) dev.w = v; break;
        case 'rname': room.name = raw.trim().slice(0, 60) || room.name; break;
        case 'ceil': room.ceil = v > 0 ? Math.round(v) : 0; break;
        case 'gyps': room.gyps = v > 0 ? Math.round(v) : 0; break;
        case 'skirt': room.skirt = v > 0 ? Math.round(v) : 0; break;
        case 'note': room.note = raw.slice(0, 500); break;
        case 'colw': if (v > 0) col.w = v; break;
        case 'colh': if (v > 0) col.h = v; break;
        case 'colr': col.rot = v || 0; break;
        case 'colround': col.round = raw; break;
        case 'citype': if (ci) { ci.type = raw; ci.size = C.CEIL[raw]?.def; } break;
        case 'cisize': if (ci) ci.size = /^\d+$/.test(String(raw)) ? Number(raw) : raw; break;
        case 'cirot': if (ci) ci.rot = v || 0; break;
        case 'cidim': if (ci) ci.dim = !!raw; break;
        case 'cllevel': if (cl) cl.level = Math.max(0, Math.round(v) || 0); break;
        case 'clled': if (cl) cl.led = !!raw; break;
        case 'clclosed': if (cl) cl.closed = !!raw; break;
        case 'ntext': if (nt) nt.text = String(raw).slice(0, 2000); break;
        case 'ntitle': if (nt) nt.title = String(raw).trim().slice(0, 80) || 'GHI CHÚ'; break;
        case 'nshowtitle': if (nt) nt.showTitle = !!raw; break;
        case 'ncolor': if (nt) nt.color = raw; break;
        case 'nsize': if (nt && v > 20) nt.size = Math.round(v); break;
        case 'nw': if (nt && v >= 200) nt.w = Math.round(v); break;
        case 'nlist': if (nt) nt.list = raw; break;
        case 'nbold': if (nt) nt.bold = !!raw; break;
        case 'nframe': if (nt) nt.frame = !!raw; break;
        case 'artext': if (ar) ar.text = String(raw).slice(0, 500); break;
        case 'arcolor': if (ar) ar.color = raw; break;
        case 'arsize': if (ar && v > 20) ar.size = Math.round(v); break;
      }
    });
  }
  pop.addEventListener('change', e => {
    const f = e.target.dataset.f;
    if (f) applyField(f, e.target.type === 'checkbox' ? e.target.checked : e.target.value);
  });
  pop.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) { e.preventDefault(); e.target.blur(); } e.stopPropagation(); });
  pop.addEventListener('click', e => {
    const step = e.target.closest('[data-step]')?.dataset.step;
    if (step) { const [f, dv] = step.split(':'), input = pop.querySelector(`[data-f=${f}]`); applyField(f, Number(input.value) + Number(dv)); return; }
    const act = e.target.closest('[data-pop]')?.dataset.pop;
    if (!act) return;
    const sel = S.sel, room = sel?.room && roomById(sel.room);
    if (act === 'close') { S.sel = null; S.multiSel = []; renderAll(); }
    else if (act === 'clearMulti') { S.multiSel = []; renderAll(); }
    else if (act === 'delMulti') deleteMulti();
    else if (['door', 'window', 'open'].includes(act)) addOpening(act);
    else if (act === 'room') { S.sel = {kind: 'room', room: sel.room}; renderAll(); }
    else if (act.startsWith('segk:')) commit(() => { room.segs[sel.i] = {...room.segs[sel.i], k: act.slice(5)}; });
    else if (act === 'segPrev' || act === 'segNext') { const n = C.segCount(room); S.sel = {...sel, i: (sel.i + (act === 'segNext' ? 1 : n - 1)) % n}; renderAll(); }
    else if (act === 'elev') openElev(sel.room, sel.i);
    else if (act === 'flip') commit(() => { const op = room.openings.find(o => o.id === sel.id), k = ['l:in', 'r:in', 'r:out', 'l:out'], n = k[(k.indexOf((op.hinge || 'l') + ':' + (op.swing || 'in')) + 1) % 4].split(':'); op.hinge = n[0]; op.swing = n[1]; });
    else if (act === 'devflip') commit(() => { const dev = room.devices.find(o => o.id === sel.id); dev.flip = !dev.flip; });
    else if (act === 'copyL' || act === 'copyR') {
      const dev = room.devices.find(o => o.id === sel.id), step = Math.max(300, (dev.w || C.DEVICES[dev.type]?.w || 0) + 100), id = C.uid();
      commit(() => { room.devices.push({...dev, id, at: Math.max(0, Math.min(C.segLen(room, dev.seg), dev.at + (act === 'copyR' ? step : -step)))}); S.sel = {...sel, id}; });
    } else if (act === 'continue') continueOpen();
    else if (act === 'closeRoom') commit(() => { room.closed = true; });
    else if (act === 'dup') {
      const id = C.uid(), copy = JSON.parse(JSON.stringify(room));
      commit(() => { copy.id = id; copy.name = room.name + ' (bản sao)'; copy.pts = copy.pts.map(p => [p[0] + 1000, p[1] + 1000]); copy.openings.forEach(o => { o.id = C.uid(); }); copy.devices.forEach(o => { o.id = C.uid(); }); floor().rooms.push(copy); S.sel = {kind: 'room', room: id}; });
    } else if (act === 'toFloor') moveRoomToFloor(room);
    else if (act === 'del') deleteSel();
  });
  async function moveRoomToFloor(room) {
    const others = S.plan.floors.map((f, i) => [i, f.name]).filter(([i]) => i !== S.plan.active);
    if (!others.length) return Shell.toast('Chưa có tầng khác. Thêm tầng ở menu tầng (dưới tên bản vẽ).');
    const name = await Shell.ask({title: 'Chuyển phòng sang tầng', message: 'Gõ tên tầng: ' + others.map(o => o[1]).join(', '), input: {value: others[0][1]}});
    const target = others.find(o => o[1].toLowerCase() === String(name || '').trim().toLowerCase());
    if (!target) return;
    commit(() => { floor().rooms.splice(floor().rooms.indexOf(room), 1); S.plan.floors[target[0]].rooms.push(room); S.sel = null; });
  }
  async function deleteSel() {
    const sel = S.sel, room = sel?.room && roomById(sel.room);
    if (!sel) return;
    if (sel.kind === 'seg' && !await Shell.ask({title: 'Xoá phòng', message: 'Đang chọn 1 bức tường. Xoá cả phòng "' + (room?.name || '') + '"?', okText: 'Xoá phòng', danger: true})) return;
    commit(() => {
      if (sel.kind === 'op') room.openings = room.openings.filter(o => o.id !== sel.id);
      else if (sel.kind === 'dev') room.devices = room.devices.filter(o => o.id !== sel.id);
      else if (sel.kind === 'room' || sel.kind === 'seg') floor().rooms = floor().rooms.filter(r => r.id !== room.id);
      else if (sel.kind === 'col') floor().columns = floor().columns.filter(c => c.id !== sel.id);
      else if (sel.kind === 'fdim') floor().dims = floor().dims.filter(c => c.id !== sel.id);
      else if (sel.kind === 'ci') floor().ceilItems = (floor().ceilItems || []).filter(c => c.id !== sel.id);
      else if (sel.kind === 'cl') floor().ceilLines = (floor().ceilLines || []).filter(c => c.id !== sel.id);
      else if (sel.kind === 'note') { const list = notesList(), k = list.findIndex(n => n.id === sel.id); if (k >= 0) list.splice(k, 1); }
      else if (sel.kind === 'ar') { const list = arrowsList(), k = list.findIndex(a => a.id === sel.id); if (k >= 0) list.splice(k, 1); }
      else if (sel.kind === 'ph') floor().photos = (floor().photos || []).filter(p => p.id !== sel.id);
      S.sel = null;
    });
  }

  // ================= Tầng / phòng =================
  function renderFloorMenu() {
    $('vh-floor-menu').innerHTML = S.plan.floors.map((f, i) => `<div class="vh-menu-head">${esc(f.name)}${i === S.plan.active ? ' ✓' : ''}<span><button type="button" data-floor-rename="${i}" title="Đổi tên tầng">✎</button>${S.plan.floors.length > 1 ? `<button type="button" data-floor-del="${i}" title="Xoá tầng">🗑</button>` : ''}</span></div>` +
      `<button type="button" data-floor="${i}" class="${i === S.plan.active ? 'is-on' : ''}">Xem ${esc(f.name)} (${f.rooms.length} phòng)</button>` +
      f.rooms.map(r => `<button type="button" class="vh-menu-room" data-floor="${i}" data-room="${r.id}">${esc(r.name)}</button>`).join('')).join('<hr>') +
      '<hr><button type="button" data-floor-add>+ Thêm tầng</button><button type="button" data-act="quick-room">+ Phòng chữ nhật có cửa</button>';
  }
  $('vh-floor').addEventListener('toggle', () => { if ($('vh-floor').open) renderFloorMenu(); });
  $('vh-floor-menu').addEventListener('click', async e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.floor != null) {
      S.plan.active = Number(b.dataset.floor); S.sel = b.dataset.room ? {kind: 'room', room: b.dataset.room} : null; S.draft = null;
      $('vh-floor').open = false; renderAll(); fit(); markDirty();
    } else if (b.matches('[data-floor-add]')) {
      commit(() => { S.plan.floors.push({id: C.uid(), name: 'Tầng ' + (S.plan.floors.length + 1), rooms: [], columns: [], dims: [], ceilItems: [], ceilLines: [], notes: [], arrows: [], photos: []}); S.plan.active = S.plan.floors.length - 1; S.sel = null; });
      $('vh-floor').open = false; fit();
    } else if (b.dataset.floorRename != null) {
      const f = S.plan.floors[Number(b.dataset.floorRename)], name = await Shell.ask({title: 'Đổi tên tầng', input: {value: f.name}});
      if (name?.trim()) commit(() => { f.name = name.trim().slice(0, 40); });
      renderFloorMenu();
    } else if (b.dataset.floorDel != null) {
      const i = Number(b.dataset.floorDel);
      if (!await Shell.ask({title: 'Xoá tầng', message: 'Xoá "' + S.plan.floors[i].name + '" cùng mọi phòng trên tầng? (Hoàn tác được)', okText: 'Xoá', danger: true})) return;
      commit(() => { S.plan.floors.splice(i, 1); S.plan.active = Math.min(S.plan.active, S.plan.floors.length - 1); S.sel = null; });
      renderFloorMenu();
    }
  });

  // ================= Mặt đứng =================
  function openElev(roomId, i) {
    if (S.draft) finishDraft(false);
    S.elev = {roomId, i}; S.sel = null; S.multi = false; S.multiSel = []; $('vh-multi').classList.remove('is-on');
    setTool('select'); syncModeUI(); renderAll(); fit();
  }
  function closeElev() { S.elev = null; S.sel = null; syncModeUI(); setTool('select'); renderAll(); fit(); }
  $('vh-elev-bar').addEventListener('click', e => {
    const act = e.target.closest('[data-elev]')?.dataset.elev, room = S.elev && roomById(S.elev.roomId);
    if (!act || !room) return;
    if (act === 'close') closeElev();
    else if (act === 'prev' || act === 'next') { const n = C.segCount(room); S.elev.i = (S.elev.i + (act === 'next' ? 1 : n - 1)) % n; S.sel = null; renderAll(); fit(); }
    else if (act === 'png') exportPng();
    else if (act === 'dxf') exportDxf();
  });

  // ================= Nền hiện trạng =================
  let bgKey = '';
  function renderBg() {
    const g = $('vh-bg'), bg = !S.elev && floor().bg;
    $('vh-bg-bar').hidden = !(S.bgBar && bg);
    if (bg) { $('vh-bg-bar').querySelector('[data-bg=hide]').textContent = bg.hidden ? '👁 Hiện' : '🙈 Ẩn'; $('vh-bg-bar').querySelector('[data-bg=opacity]').value = bg.opacity ?? .5; }
    const k = bg?.mmPerUnit || 1, url = bg && bg.kind !== 'dxf' ? assetUrls.get(bg.name) : '';
    const key = !bg || bg.hidden ? '' : [bg.kind, bg.name, bg.x, bg.y, k, bg.opacity, bg.segs?.length, url].join('|');
    if (key === bgKey) return;
    bgKey = key;
    if (!key) { g.innerHTML = ''; return; }
    const n = v => Math.round(v * 10) / 10, x = bg.x || 0, y = bg.y || 0, op = bg.opacity ?? .5;
    if (bg.kind === 'dxf') {
      const sg = bg.segs || [], d = [];
      for (let j = 0; j + 3 < sg.length; j += 4) d.push('M' + n(x + sg[j] * k) + ' ' + n(y + sg[j + 1] * k) + 'L' + n(x + sg[j + 2] * k) + ' ' + n(y + sg[j + 3] * k));
      g.innerHTML = `<path d="${d.join('')}" fill="none" stroke="#475569" stroke-width="1" vector-effect="non-scaling-stroke" opacity="${op}"/>`;
    } else if (url) g.innerHTML = `<image href="${url}" x="${n(x)}" y="${n(y)}" width="${n(bg.w * k)}" height="${n(bg.h * k)}" opacity="${op}" preserveAspectRatio="none"/>`;
    else { g.innerHTML = ''; bgKey = ''; if (!bgFailed.has(bg.name)) assetBlobUrl(bg.name).then(() => renderBg(), err => { bgFailed.add(bg.name); Shell.toast('Không tải được nền: ' + err.message); }); }
  }
  const bgFailed = new Set();
  async function loadPdfJs() {
    if (!window.pdfjsLib) await new Promise((ok, fail) => {
      const sc = document.createElement('script');
      sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
      sc.onload = ok; sc.onerror = () => fail(new Error('Không tải được pdf.js'));
      document.head.append(sc);
    });
    pdfjsLib.GlobalWorkerOptions.workerSrc ||= 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    return pdfjsLib;
  }
  async function pdfPageBlob(file) {
    const lib = await loadPdfJs(), pdf = await lib.getDocument({data: new Uint8Array(await file.arrayBuffer())}).promise;
    let no = 1;
    if (pdf.numPages > 1) {
      const ans = await Shell.ask({title: 'Chọn trang PDF', message: 'File có ' + pdf.numPages + ' trang. Lấy trang số mấy làm nền?', input: {value: '1'}});
      if (ans === null) return null;
      no = Math.max(1, Math.min(pdf.numPages, parseInt(ans, 10) || 1));
    }
    const page = await pdf.getPage(no), v1 = page.getViewport({scale: 1}), vp = page.getViewport({scale: Math.min(4, 3000 / Math.max(v1.width, v1.height))});
    const c = document.createElement('canvas');
    c.width = Math.round(vp.width); c.height = Math.round(vp.height);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({canvasContext: ctx, viewport: vp}).promise;
    return new Promise((ok, fail) => c.toBlob(bl => bl ? ok(bl) : fail(new Error('Không dựng được trang PDF')), 'image/webp', 0.85));
  }
  $('vh-bg-input').addEventListener('change', async e => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      let bg;
      if (/\.dxf$/i.test(file.name)) {
        const r = C.parseDxf(await file.text());
        if (!r.count) throw new Error('DXF không có nét nào đọc được.');
        bg = {kind: 'dxf', name: file.name, segs: r.segs, x: 0, y: 0, mmPerUnit: r.mmPerUnit, opacity: .6, hidden: false};
        if (r.count < r.total) Shell.toast('DXF nhiều nét, chỉ lấy ' + r.count + '/' + r.total + ' nét dài nhất.');
      } else {
        Shell.toast('Đang xử lý và tải nền lên…');
        const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
        const blob = isPdf ? await pdfPageBlob(file) : file;
        if (!blob) return;
        const bm = await createImageBitmap(blob), w = bm.width, h = bm.height;
        bm.close?.();
        const name = await uploadImageAsset(blob);
        // tỷ lệ tạm: ảnh rộng 10 m, rồi dùng "Đặt tỷ lệ" để khớp số đo thật
        bg = {kind: isPdf ? 'pdf' : 'img', name, w, h, x: 0, y: 0, mmPerUnit: 10000 / w, opacity: .5, hidden: false};
      }
      const b0 = C.bounds(viewPrims());
      if (b0) { bg.x = C.round(b0.x0, 10); bg.y = C.round(b0.y0, 10); }
      commit(() => { floor().bg = bg; });
      S.bgBar = true; renderBg(); fit();
      Shell.toast('Đã nhập nền. Bấm "📏 Đặt tỷ lệ" để khớp số đo thật.');
    } catch (error) { Shell.toast('Không nhập được nền: ' + error.message); }
  });
  async function bgScalePick(w) {
    S.bgPts = [...(S.bgPts || []), w];
    renderOverlay();
    if (S.bgPts.length < 2) return;
    const [p, q] = S.bgPts, cur = C.len(C.sub(q, p));
    S.bgPts = null; renderOverlay();
    if (cur < 1) return;
    const ans = await Shell.ask({title: 'Đặt tỷ lệ nền', message: 'Đoạn vừa chọn đang dài ' + fmt(cur) + ' mm. Số đo thật là bao nhiêu mm?', input: {value: String(Math.round(cur))}});
    const raw = String(ans || '').trim().replace(/\s/g, ''), real = Number(/^\d{1,3}(\.\d{3})+$/.test(raw) ? raw.replace(/\./g, '') : raw.replace(',', '.'));
    if (!(real > 0)) return;
    const r = real / cur, bg = floor().bg;
    commit(() => { bg.mmPerUnit *= r; bg.x = p[0] + ((bg.x || 0) - p[0]) * r; bg.y = p[1] + ((bg.y || 0) - p[1]) * r; });
    setTool('select');
  }
  $('vh-bg-bar').addEventListener('click', e => {
    const act = e.target.closest('button[data-bg]')?.dataset.bg, bg = floor().bg;
    if (!act || !bg) return;
    if (act === 'scale' || act === 'move') setTool('bg-' + act);
    else if (act === 'hide') commit(() => { bg.hidden = !bg.hidden; });
    else if (act === 'del') { commit(() => { delete floor().bg; }); S.bgBar = false; setTool('select'); }
    else if (act === 'close') { S.bgBar = false; setTool('select'); renderBg(); }
  });
  $('vh-bg-bar').addEventListener('input', e => { if (e.target.dataset.bg === 'opacity' && floor().bg) { floor().bg.opacity = Number(e.target.value); renderBg(); } });
  $('vh-bg-bar').addEventListener('change', e => { if (e.target.dataset.bg === 'opacity') markDirty(); });

  // ================= Xuất =================
  // o: {mode, only, dims, schedule, font} – mặc định theo màn đang xem
  function exportPrims(o = {}) {
    if (S.elev) return C.elevPrimitives(S.plan, roomById(S.elev.roomId), S.elev.i, {font: o.font});
    return C.floorPrimitives(S.plan, floor(), {mode: o.mode || S.mode, only: o.only, dims: o.dims, schedule: o.schedule, font: o.font, roomFill: '#fff'});
  }
  function exportTitle(o = {}) {
    if (S.elev) { const r = roomById(S.elev.roomId); return 'Mặt đứng ' + r.name + ' - đoạn ' + (S.elev.i + 1); }
    const only = o.only && roomById(o.only[0]);
    return floor().name + ((o.mode || S.mode) === 'ceil' ? ' - Trần' : '') + (only ? ' - ' + only.name : '');
  }
  function exportPng(o = {}, type = 'png') {
    const prims = exportPrims(o).filter(p => p.layer !== 'HIT');
    const b = C.bounds(prims);
    if (!b) return Shell.toast('Chưa có gì để xuất.');
    const pad = 600, W = b.x1 - b.x0 + pad * 2, H = b.y1 - b.y0 + pad * 2 + 700, scale = Math.min(4000 / W, 4000 / H, 0.6);
    const title = `<text x="${b.x0 - pad + 200}" y="${b.y1 + pad + 350}" font-size="260" font-weight="700" fill="#111">${esc(S.plan.name)} – ${esc(exportTitle(o))}</text>` +
      `<text x="${b.x0 - pad + 200}" y="${b.y1 + pad + 650}" font-size="180" fill="#555">${esc([S.plan.address, S.plan.surveyor && 'Khảo sát: ' + S.plan.surveyor, new Date().toLocaleDateString('vi-VN'), 'Đơn vị: mm'].filter(Boolean).join(' · '))}</text>`;
    // nét non-scaling-stroke tính theo px ảnh -> đổi sang mm cho đúng độ dày khi in
    const body = prims.map(p => primSvg({...p, w: (p.w || 1) * 1.6 / scale})).join('').replace(/ vector-effect="non-scaling-stroke"/g, '');
    const src = `<svg xmlns="http://www.w3.org/2000/svg" width="${Math.round(W * scale)}" height="${Math.round(H * scale)}" viewBox="${b.x0 - pad} ${b.y0 - pad} ${W} ${H}"><rect x="${b.x0 - pad}" y="${b.y0 - pad}" width="${W}" height="${H}" fill="#fff"/><style>text{font-family:Roboto,Arial,sans-serif}</style>${body}${title}</svg>`;
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = Math.round(W * scale); c.height = Math.round(H * scale);
      c.getContext('2d').drawImage(img, 0, 0);
      c.toBlob(blob => download(`${S.plan.name} - ${exportTitle(o)}.${type}`, blob), type === 'jpg' ? 'image/jpeg' : 'image/png', 0.92);
    };
    img.onerror = () => Shell.toast('Không dựng được ảnh.');
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(src);
  }
  function exportDxf(o = {}) {
    const prims = exportPrims(o);
    const b = C.bounds(prims);
    if (!b) return Shell.toast('Chưa có gì để xuất.');
    const font = o.font || S.plan.font || 150;
    prims.push({t: 'text', p: [b.x0 + 2000, b.y1 + font * 6], s: S.plan.name + ' - ' + exportTitle(o), size: font * 1.6, layer: 'CHU'});
    if (S.plan.address) prims.push({t: 'text', p: [b.x0 + 2000, b.y1 + font * 8.5], s: S.plan.address, size: font * 1.2, layer: 'CHU'});
    download(`${S.plan.name} - ${exportTitle(o)}.dxf`, new Blob([C.toDxf(prims)], {type: 'application/dxf'}));
  }
  const SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 1000];
  // PDF = cửa sổ in của trình duyệt (khổ ngang, SVG theo mm, khung tên, trang ảnh hiện trường)
  async function exportPdf(o = {}) {
    const prims = exportPrims(o).filter(p => p.layer !== 'HIT'), b = C.bounds(prims);
    if (!b) return Shell.toast('Chưa có gì để xuất.');
    const [pw, ph] = o.paper === 'A3' ? [420, 297] : [297, 210], m = 10, tb = 18, aw = pw - 2 * m, ah = ph - 2 * m - tb - 4;
    const pad = 300, W = b.x1 - b.x0 + pad * 2, H = b.y1 - b.y0 + pad * 2, need = Math.max(W / aw, H / ah);
    const scale = o.scale || SCALES.find(v => v >= need) || Math.ceil(need / 100) * 100;
    if (o.scale && need > o.scale) Shell.toast('Tỷ lệ 1:' + o.scale + ' không vừa khổ ' + (o.paper || 'A4') + ', phần ngoài sẽ bị cắt. Chọn "Tự vừa khổ" nếu cần.');
    const body = prims.map(p => primSvg({...p, w: (p.w || 1) * 0.18 * scale})).join('').replace(/ vector-effect="non-scaling-stroke"/g, '');
    const drawing = `<svg xmlns="http://www.w3.org/2000/svg" width="${W / scale}mm" height="${H / scale}mm" viewBox="${b.x0 - pad} ${b.y0 - pad} ${W} ${H}"><style>text{font-family:Roboto,Arial,sans-serif}</style>${body}</svg>`;
    const cell = (k, v) => `<td><small>${k}</small><b>${esc(v || '–')}</b></td>`;
    const titleBlock = `<table class="tb"><tr><td class="brand">GD HOME</td>${cell('Tên bản vẽ', S.plan.name)}${cell('Địa chỉ', S.plan.address)}${cell('Người đo', S.plan.surveyor)}${cell('Ngày', new Date().toLocaleDateString('vi-VN'))}${cell('Tỷ lệ', '1:' + scale)}${cell(S.elev ? 'Mặt đứng' : 'Tầng', exportTitle(o))}</tr></table>`;
    let photos = '';
    const list = !S.elev && o.photos !== false ? (floor().photos || []) : [];
    for (let k = 0; k < list.length; k++) {
      let url = '';
      try { url = await assetBlobUrl(list[k].name); } catch { /* ảnh lỗi: vẫn in trang có số */ }
      photos += `<section class="pg ph"><h2>Ảnh hiện trường #${k + 1}</h2>${url ? `<img src="${url}">` : '<p>(không tải được ảnh)</p>'}<p>${esc(list[k].note || '')}</p>${titleBlock}</section>`;
    }
    const html = `<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>${esc(S.plan.name)}</title><style>
@page{size:${o.paper === 'A3' ? 'A3' : 'A4'} landscape;margin:${m}mm}
*{box-sizing:border-box}body{margin:0;font-family:Roboto,Arial,sans-serif;color:#111}
.pg{width:${aw}mm;height:${ph - 2 * m}mm;display:flex;flex-direction:column;page-break-after:always;break-after:page;overflow:hidden}
.pg:last-child{page-break-after:auto;break-after:auto}
.dw{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;overflow:hidden;border:0.3mm solid #111}
.tb{width:100%;height:${tb}mm;margin-top:4mm;border-collapse:collapse;table-layout:fixed;font-size:8pt}
.tb td{border:0.3mm solid #111;padding:1mm 2mm;vertical-align:top;overflow:hidden}.tb small{display:block;color:#555;font-size:6.5pt}
.tb .brand{width:28mm;font-size:13pt;font-weight:700;vertical-align:middle;text-align:center}
.ph h2{margin:0 0 2mm;font-size:12pt}.ph img{flex:1;min-height:0;object-fit:contain;width:100%}.ph p{margin:2mm 0 0;font-size:9pt}
</style></head><body><section class="pg"><div class="dw">${drawing}</div>${titleBlock}</section>${photos}</body></html>`;
    window.GDPlanPage.lastPrint = html;
    if (window.GDPlanPage.noPrint) return html;
    const fr = document.createElement('iframe');
    fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0';
    document.body.append(fr);
    const doc = fr.contentDocument;
    doc.open(); doc.write(html); doc.close();
    await Promise.all([...doc.images].map(im => im.complete ? 0 : new Promise(r => { im.onload = im.onerror = r; })));
    fr.contentWindow.focus(); fr.contentWindow.print();
    setTimeout(() => fr.remove(), 60000);
    return html;
  }
  const expForm = $('vh-export-form').elements;
  function syncExportForm() {
    const fmtv = expForm.fmt.value;
    $('vh-export-form').querySelectorAll('[data-for]').forEach(el => { el.hidden = !el.dataset.for.split(' ').includes(fmtv); });
  }
  function openExport() {
    expForm.mode.value = S.mode;
    const selRoom = S.sel?.room && roomById(S.sel.room), opt = expForm.scope.querySelector('[value=room]');
    opt.disabled = !selRoom;
    opt.textContent = selRoom ? 'Phòng đang chọn: ' + selRoom.name : 'Phòng đang chọn (chưa chọn)';
    expForm.scope.value = selRoom ? 'room' : 'floor';
    expForm.schedule.checked = !!floor()[S.mode === 'ceil' ? 'schedCeil' : 'schedPlan'];
    $('vh-export-scope').hidden = !!S.elev;
    syncExportForm();
    $('vh-export-dlg').showModal();
  }
  $('vh-export-form').addEventListener('change', syncExportForm);
  // submit chạy ngay khi bấm (sự kiện close của dialog có thể bị hoãn khi tab ẩn)
  $('vh-export-form').addEventListener('submit', e => {
    if (e.submitter?.value !== 'ok') return;
    const f = expForm, scale = Number(f.scale.value) || 0, mode = f.mode.value, key = mode === 'ceil' ? 'schedCeil' : 'schedPlan';
    if (!S.elev && !!floor()[key] !== f.schedule.checked) commit(() => { floor()[key] = f.schedule.checked; });   // bảng kê lưu theo tầng, hiện cả trên màn vẽ
    const o = {mode, only: f.scope.value === 'room' && S.sel?.room ? [S.sel.room] : undefined, dims: f.dims.checked, schedule: f.schedule.checked,
      font: scale ? 2.5 * scale : undefined, scale, paper: f.paper.value, photos: f.photos.checked};
    const fmtv = f.fmt.value;
    if (fmtv === 'dxf') exportDxf(o);
    else if (fmtv === 'png' || fmtv === 'jpg') exportPng(o, fmtv);
    else if (fmtv === 'pdf') exportPdf(o);
    else download(S.plan.name + '.json', new Blob([JSON.stringify(S.plan, null, 1)], {type: 'application/json'}));
  });

  // ================= Nút tròn nổi (điện thoại) =================
  const selHit = sel => sel.kind === 'seg' || sel.kind === 'room' ? {kind: 'room', a: sel.room} : sel.room ? {kind: sel.kind, a: sel.room, b: sel.id} : {kind: sel.kind, a: sel.id};
  $('vh-fab').addEventListener('click', e => {
    const act = e.target.closest('[data-fab]')?.dataset.fab;
    if (!act || !S.sel) return;
    if (act === 'del') deleteSel();
    else if (act === 'props') { S.popHide = !S.popHide; renderPop(); placeFab(); }
    else if (act === 'elev' && S.sel.kind === 'seg') openElev(S.sel.room, S.sel.i);
  });
  $('vh-fab').querySelector('[data-fab=move]').addEventListener('pointerdown', e => {
    if (!S.sel) return;
    e.preventDefault();
    const hit = selHit(S.sel), base = currentObj(hit);
    if (!base) return;
    svg.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, [e.clientX, e.clientY]);
    drag = {type: 'obj', fab: true, hit, x: e.clientX, y: e.clientY, w: toWorld(e.clientX, e.clientY), moved: false, touch: true, snapshot: JSON.stringify(S.plan), base: JSON.parse(JSON.stringify(base))};
    $('vh-fab').hidden = true;
  });

  // ================= Cài đặt =================
  function openSettings() {
    const f = $('vh-settings-form').elements, p = S.plan;
    for (const k of ['name', 'address', 'surveyor', 'wall', 'partition', 'snap', 'font']) f[k].value = p[k] ?? '';
    f.projectId.value = p.projectId || '';
    for (const k of ['showDims', 'devDims', 'grid']) f[k].checked = p[k] !== false;
    $('vh-settings').returnValue = '';
    $('vh-settings').showModal();
  }
  $('vh-settings').addEventListener('close', () => {
    if ($('vh-settings').returnValue !== 'ok') return;
    const f = $('vh-settings-form').elements;
    commit(() => {
      const p = S.plan;
      p.name = f.name.value.trim().slice(0, 120) || p.name;
      p.address = f.address.value.trim(); p.surveyor = f.surveyor.value.trim(); p.projectId = f.projectId.value;
      for (const k of ['wall', 'partition', 'snap', 'font']) { const v = Number(f[k].value); if (v > 0) p[k] = v; }
      for (const k of ['showDims', 'devDims', 'grid']) p[k] = f[k].checked;
    });
  });

  // ================= Nút / phím =================
  document.querySelector('.vh-tools').addEventListener('click', e => { const t = e.target.closest('[data-tool]')?.dataset.tool; if (t) setTool(t); });
  $('vh-editor').addEventListener('click', async e => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    e.target.closest('details')?.removeAttribute('open');
    if (act === 'home') showHome();
    else if (act === 'ceil') setMode(S.mode === 'ceil' ? 'plan' : 'ceil');
    else if (act === 'undo') undo();
    else if (act === 'redo') redo();
    else if (act === 'fit') fit();
    else if (act === 'lock') { S.lock = !S.lock; $('vh-lock').classList.toggle('is-on', S.lock); }
    else if (act === 'settings') openSettings();
    else if (act === 'dxf') exportDxf();
    else if (act === 'png') exportPng();
    else if (act === 'export') openExport();
    else if (act === 'bg-import') $('vh-bg-input').click();
    else if (act === 'bg-edit') { if (!floor().bg) return Shell.toast('Tầng này chưa có nền. Chọn "Nhập nền…" trước.'); S.bgBar = true; renderBg(); }
    else if (act === 'json') download(S.plan.name + '.json', new Blob([JSON.stringify(S.plan, null, 1)], {type: 'application/json'}));
    else if (act === 'mic') mic(!rec);
    else if (act === 'multi') toggleMultiMode();
    else if (act === 'quick-room') {
      const [x, y] = freeSpot(), room = C.rectRoom(x, y, 3000, 4000, 'P' + (floor().rooms.length + 1));
      commit(() => { floor().rooms.push(room); S.sel = {kind: 'room', room: room.id}; });
      setTool('select'); fit();
    }
  });
  $('vh-name').addEventListener('click', async () => {
    const name = await Shell.ask({title: 'Đổi tên bản vẽ', input: {value: S.plan.name}});
    if (name?.trim()) commit(() => { S.plan.name = name.trim().slice(0, 120); });
  });
  $('vh-lock').classList.toggle('is-on', S.lock);
  addEventListener('keydown', e => {
    if (!S.plan || $('vh-editor').hidden) return;
    if (e.target.closest('input, textarea, select, dialog') && !(e.target === cmd && !cmd.value && (e.ctrlKey || e.metaKey))) return;
    const key = e.key.toLowerCase();
    if ((e.ctrlKey || e.metaKey) && key === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
    if ((e.ctrlKey || e.metaKey) && key === 'y') { e.preventDefault(); redo(); return; }
    if ((e.ctrlKey || e.metaKey) && key === 's') { e.preventDefault(); S.dirty = true; save(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (S.draft && e.key.startsWith('Arrow')) { e.preventDefault(); arrow(e.key); return; }
    if (S.draft && (/^[0-9]$/.test(e.key))) { cmd.focus(); return; }   // gõ số thẳng vào ô lệnh
    if (e.key === 'Enter' && S.draft) { finishDraft(true); return; }
    if (e.key === 'Backspace' && S.draft) { e.preventDefault(); draftUndo(); return; }
    if (e.key === 'Escape' && S.elev && !S.sel && !S.draft && !S.arrowDraft) { closeElev(); return; }
    if (e.key === 'Escape') { if (S.draft) finishDraft(false); else if (S.dimDraft || S.arrowDraft || S.boxDraft) { S.dimDraft = null; S.arrowDraft = null; S.boxDraft = null; renderOverlay(); } else { S.sel = null; S.multi = false; S.multiSel = []; $('vh-multi')?.classList.remove('is-on'); setTool('select'); renderAll(); } return; }
    if (e.key === 'Enter' && S.arrowDraft?.pts.length >= 2) { const pts = S.arrowDraft.pts.slice(), mode = S.mode; S.arrowDraft = null; renderOverlay(); finishArrow(pts, mode); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.multiSel.length) { e.preventDefault(); deleteMulti(); return; }
    if ((e.key === 'Delete' || e.key === 'Backspace') && S.sel) { e.preventDefault(); deleteSel(); return; }
    const tools = {v: 'select', p: 'draw', d: 'device', c: 'column', m: 'dim', t: 'note'};
    if (tools[key]) setTool(tools[key]);
    else if (key === 'f') fit();
    else if (key === 'l') { S.lock = !S.lock; $('vh-lock').classList.toggle('is-on', S.lock); }
  });

  // ================= Khởi động =================
  (async () => {
    await loadProjects();
    const id = new URLSearchParams(location.search).get('plan');
    if (id && /^[\w-]{6,60}$/.test(id)) openPlan(id); else showHome();
  })();
  window.GDPlanPage = {state: S, runCommand, fit, exportDxf, exportPdf, exportPng, openElev, closeElev, renderAll};
})();
