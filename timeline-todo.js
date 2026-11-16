// =========================================================================
// GD HOME - VIỆC CẦN LÀM (TODO) TRÊN TIMELINE
// - Chỉ hiện khi đang ở chế độ Timeline (nằm trong #msproject-view-wrapper)
// - Kéo thả trong danh sách để đổi thứ tự; ★ bên phải = ưu tiên (đồng bộ "Quan trọng" của Microsoft To Do)
// - Kéo việc thả lên Timeline -> đặt NGÀY cho việc (vẫn nằm trong danh sách To Do, chưa thuộc dự án nào)
//   Giữ Shift khi thả lên dòng dự án, hoặc bấm 📁 trên việc -> xếp thành hạng mục của dự án
// - Hạng mục bị xoá / đổi ngày / đổi tên / lên 100% trên Timeline -> việc cập nhật theo
// - Tick hoàn thành -> việc ẩn khỏi danh sách (xem lại ở "Đã xong")
// - Đồng bộ 2 chiều Microsoft To Do (qua /api/todos, server giữ quyền truy cập)
// Dùng các hàm chung của app.js: apiFetch, AppState, syncAllFromMSProject, showToast...
// =========================================================================
(function () {
  'use strict';
  const DRAG_TYPE = 'application/x-gd-todo';
  const SYNC_EVERY_MS = 60000;
  const st = {items: [], ms: {available: false}, loaded: false, loading: false, open: false, showDone: false,
    busy: false, lastSync: 0, dragId: null, syncTimer: null, editingId: null, assignId: null, linkPending: new Set()};
  let root, listEl, inputEl, toggleBtn, statusEl, msEl;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
  const fmtDate = (d) => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
  const todayStr = () => formatDateStr(new Date());
  const isTimelineVisible = () => {
    const w = document.getElementById('msproject-view-wrapper');
    return !!(w && w.offsetParent !== null && w.style.display !== 'none');
  };
  const scheduleReady = () => typeof _scheduleReady === 'undefined' || _scheduleReady || (typeof _guestMode !== 'undefined' && _guestMode);

  async function api(path, options = {}) {
    const res = await apiFetch(path, Object.assign({}, options, options.body ? {body: JSON.stringify(options.body)} : {}), false);
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.message || ('Lỗi ' + res.status));
    return json;
  }

  function applyView(v) {
    if (!v) return;
    if (Array.isArray(v.items)) st.items = v.items;
    if (v.ms) st.ms = v.ms;
    st.loaded = true;
    render();
    drawDayBadges();
    checkLinks();
  }

  async function load() {
    try { applyView(await api('/api/todos')); } catch (e) { setStatus(e.message, true); }
    if (st.ms.linked) sync();
  }

  async function sync(silent = true) {
    if (!st.ms.linked || st.busy) return;
    st.busy = true;
    renderStatus();
    try {
      applyView(await api('/api/todos/sync', {method: 'POST'}));
      st.lastSync = Date.now();
      if (!silent && !st.ms.error) toast('Đã đồng bộ Microsoft To Do');
    } catch (e) {
      if (!silent) toast('Không đồng bộ được: ' + e.message);
    } finally {
      st.busy = false;
      renderStatus();
    }
  }

  // Thay đổi xong thì đẩy sang Microsoft sau 1,5 giây (gộp nhiều thao tác)
  function scheduleSync() {
    if (!st.ms.linked) return;
    clearTimeout(st.syncTimer);
    st.syncTimer = setTimeout(() => sync(), 1500);
  }

  async function mutate(path, method, body, optimistic) {
    const backup = st.items.map(i => Object.assign({}, i));
    if (optimistic) { optimistic(); render(); drawDayBadges(); }
    try {
      applyView(await api(path, {method, body}));
      scheduleSync();
      return true;
    } catch (e) {
      st.items = backup;
      render();
      toast('Lỗi việc cần làm: ' + e.message);
      return false;
    }
  }

  const patch = (item, body, optimistic) => mutate('/api/todos/' + item.id, 'PATCH', body, optimistic);

  async function addTodo(title) {
    title = String(title || '').trim();
    if (!title) return;
    const order = st.items.reduce((m, i) => Math.min(m, i.order || 0), 0) - 1;
    await mutate('/api/todos', 'POST', {title}, () => st.items.push({id: 'tmp_' + Date.now(), title, done: false, due: '', taskId: '', star: false, order}));
  }

  function linkedTask(item) {
    return item.taskId && Array.isArray(AppState.tasks) ? AppState.tasks.find(t => t.id === item.taskId) : null;
  }

  function calName(calId) {
    const cal = AppState.calendars.find(c => c.id === calId);
    if (!cal) return 'dự án';
    const owner = (AppState.projectOwners || []).find(o => o.id === cal.ownerId);
    return owner && owner.name ? `${owner.name} · ${cal.name}` : cal.name;
  }

  function sortedOpen() {
    return st.items.filter(i => !i.done).sort((a, b) =>
      (!!b.star - !!a.star) || ((a.order || 0) - (b.order || 0)) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  async function setDone(item, done) {
    const task = linkedTask(item);
    if (task && done && task.progress !== 100) {
      task.progress = 100;
      syncAllFromMSProject(`Đã xong "${item.title}" – hạng mục trên Timeline lên 100%`);
    } else if (done) {
      toast(`Đã xong: ${item.title}`);
    }
    await patch(item, {done}, () => { item.done = done; });
  }

  // ------------------------------------------------------------------ GIỮ TODO KHỚP VỚI TIMELINE
  // Hạng mục bị xoá -> bỏ liên kết (việc quay lại danh sách, giữ ngày); đổi ngày/tên/100% -> cập nhật việc
  function checkLinks() {
    if (!st.loaded || !scheduleReady() || !Array.isArray(AppState.tasks)) return;
    for (const item of st.items) {
      if (!item.taskId || st.linkPending.has(item.id) || String(item.id).startsWith('tmp_')) continue;
      const task = linkedTask(item);
      const body = {};
      if (!task) body.taskId = '';
      else {
        if (task.endDate && task.endDate !== item.due) body.due = task.endDate;
        if (task.title && task.title !== item.title) body.title = task.title;
        if (task.progress === 100 && !item.done) body.done = true;
      }
      if (!Object.keys(body).length) continue;
      st.linkPending.add(item.id);
      if (!task) toast(`Hạng mục "${item.title}" đã xoá khỏi Timeline – việc trở lại danh sách`);
      patch(item, body, () => Object.assign(item, body)).finally(() => st.linkPending.delete(item.id));
    }
  }

  // ------------------------------------------------------------------ TẠO HẠNG MỤC TỪ VIỆC
  function createTaskFromTodo(item, calId, date) {
    const cal = AppState.calendars.find(c => c.id === calId);
    if (!cal) return;
    cal.visible = true;
    const ownTasks = AppState.tasks.filter(x => x.calendarId === cal.id && x.color);
    const color = ownTasks.length ? ownTasks[ownTasks.length - 1].color : (cal.color || '#1565c0');
    const task = {id: 'task_' + Date.now(), calendarId: cal.id, title: item.title, startDate: date, endDate: date,
      color, skipSundays: true, showCount: true, note: '', predecessors: [], todoId: item.id};
    AppState.tasks.push(task);
    st.linkPending.add(item.id);
    syncAllFromMSProject(`Đã xếp "${item.title}" vào ${calName(cal.id)} ngày ${fmtDate(date)}`);
    patch(item, {taskId: task.id, due: date}, () => { item.taskId = task.id; item.due = date; })
      .finally(() => st.linkPending.delete(item.id));
  }

  function setDue(item, date) {
    if (item.due === date && !item.taskId) return;
    const task = linkedTask(item);
    if (task) {
      // Việc đã thuộc dự án: dời hạng mục, giữ số ngày
      const len = Math.round((parseDateStr(task.endDate) - parseDateStr(task.startDate)) / 86400000);
      const start = parseDateStr(date);
      start.setDate(start.getDate() - len);
      task.startDate = formatDateStr(start);
      task.endDate = date;
      syncAllFromMSProject(`Đã dời "${item.title}" sang ${fmtDate(date)}`);
    } else {
      toast(`Đã hẹn "${item.title}" ngày ${fmtDate(date)} (Microsoft To Do)`);
    }
    st.linkPending.add(item.id);
    patch(item, {due: date}, () => { item.due = date; }).finally(() => st.linkPending.delete(item.id));
  }

  // ------------------------------------------------------------------ KÉO THẢ
  function timelineTarget(e) {
    if (typeof _mspTimelineInfo === 'undefined' || !_mspTimelineInfo) return null;
    const layer = e.target.closest && e.target.closest('#msp-gantt-rows-layer');
    const days = e.target.closest && e.target.closest('#msp-gantt-days-row, #msp-gantt-months-row');
    const base = layer || days;
    if (!base) return null;
    const idx = mspDateIndexFromClientX(base, e.clientX);
    if (idx === null) return null;
    const row = layer ? e.target.closest('.msp-gantt-row') : null;
    const toProject = !!(e.shiftKey && row && row.dataset.calId);
    return {date: mspDateFromIndex(idx), idx, row, calId: toProject ? row.dataset.calId : null};
  }

  function clearDropHint() {
    document.querySelectorAll('.gd-todo-drop-hint').forEach(el => el.remove());
    listEl && listEl.querySelectorAll('.gd-todo-insert-before, .gd-todo-insert-after').forEach(el => el.classList.remove('gd-todo-insert-before', 'gd-todo-insert-after'));
  }

  function showTimelineHint(t) {
    clearDropHint();
    const cw = _mspTimelineInfo.colWidth;
    const hl = document.createElement('div');
    hl.className = 'gd-todo-drop-hint' + (t.calId ? ' to-project' : '');
    hl.style.left = (t.idx * cw) + 'px';
    hl.style.width = cw + 'px';
    if (t.calId && t.row) {
      hl.classList.add('msp-range-select-highlight');
      t.row.appendChild(hl);
    } else {
      const layer = document.getElementById('msp-gantt-rows-layer');
      if (!layer) return;
      hl.classList.add('column');
      layer.appendChild(hl);
    }
  }

  function listTarget(e) {
    const li = e.target.closest && e.target.closest('#gd-todo-list li[data-id]');
    if (!li || li.classList.contains('done') || li.dataset.id === st.dragId) return null;
    const r = li.getBoundingClientRect();
    return {li, after: e.clientY > r.top + r.height / 2};
  }

  async function reorder(dragId, targetId, after) {
    const open = sortedOpen();
    const moving = open.find(i => i.id === dragId);
    if (!moving) return;
    const rest = open.filter(i => i.id !== dragId);
    let at = rest.findIndex(i => i.id === targetId);
    if (at < 0) return;
    if (after) at += 1;
    rest.splice(at, 0, moving);
    // Kéo sang nhóm có sao/không sao thì đổi luôn trạng thái sao theo chỗ thả
    const neighbour = rest[at + 1] || rest[at - 1];
    const starChange = neighbour && !!neighbour.star !== !!moving.star && rest.filter(i => i.star).length !== 0;
    rest.forEach((item, i) => { item.order = i; });
    render();
    try {
      applyView(await api('/api/todos/order', {method: 'POST', body: {ids: rest.map(i => i.id)}}));
    } catch (err) { toast('Không lưu được thứ tự: ' + err.message); }
    if (starChange) patch(moving, {star: !!neighbour.star}, () => { moving.star = !!neighbour.star; });
  }

  function setupDragDrop() {
    document.addEventListener('dragover', (e) => {
      if (!st.dragId || !isTimelineVisible()) return;
      const lt = listTarget(e);
      if (lt) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        clearDropHint();
        lt.li.classList.add(lt.after ? 'gd-todo-insert-after' : 'gd-todo-insert-before');
        return;
      }
      const t = timelineTarget(e);
      if (!t) { clearDropHint(); if (typeof hideFloatingTooltip === 'function') hideFloatingTooltip(); return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      showTimelineHint(t);
      if (typeof showFloatingTooltip === 'function') {
        showFloatingTooltip(t.calId ? `Thả để xếp vào ${calName(t.calId)} • ${fmtDate(t.date)}`
          : `Thả để hẹn ngày ${fmtDate(t.date)} (giữ Shift + thả lên dòng dự án để xếp vào dự án)`, e.clientX, e.clientY);
      }
    });
    document.addEventListener('drop', (e) => {
      if (!st.dragId) return;
      const item = st.items.find(i => i.id === st.dragId);
      const lt = listTarget(e);
      const t = lt ? null : timelineTarget(e);
      const dragId = st.dragId;
      endDrag();
      if (!item || (!lt && !t)) return;
      e.preventDefault();
      if (lt) reorder(dragId, lt.li.dataset.id, lt.after);
      else if (t.calId && !item.taskId) createTaskFromTodo(item, t.calId, t.date);
      else setDue(item, t.date);
    });
    document.addEventListener('dragend', endDrag);
  }

  function endDrag() {
    st.dragId = null;
    clearDropHint();
    root && root.classList.remove('dragging');
    if (typeof hideFloatingTooltip === 'function') hideFloatingTooltip();
  }

  // ------------------------------------------------------------------ DẤU VIỆC TRÊN TIÊU ĐỀ NGÀY
  function drawDayBadges() {
    const row = document.getElementById('msp-gantt-days-row');
    if (!row) return;
    row.querySelectorAll('.gd-todo-day-badge').forEach(el => el.remove());
    if (!st.loaded || typeof _mspTimelineInfo === 'undefined' || !_mspTimelineInfo || !isTimelineVisible()) return;
    const start = parseDateStr(_mspTimelineInfo.startDate);
    const byIdx = new Map();
    for (const item of st.items) {
      if (item.done || !item.due || item.taskId) continue;      // việc đã thuộc dự án thì đã có thanh trên Gantt
      const idx = Math.round((parseDateStr(item.due) - start) / 86400000);
      if (idx < 0 || idx >= _mspTimelineInfo.count) continue;
      if (!byIdx.has(idx)) byIdx.set(idx, []);
      byIdx.get(idx).push(item);
    }
    const cells = row.querySelectorAll('.msp-gantt-day-cell');
    byIdx.forEach((list, idx) => {
      const cell = cells[idx];
      if (!cell) return;
      cell.style.position = 'relative';
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'gd-todo-day-badge' + (list.some(i => i.star) ? ' star' : '');
      b.textContent = list.length;
      b.title = 'Việc cần làm:\n' + list.map(i => (i.star ? '★ ' : '• ') + i.title).join('\n');
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        setOpen(true);
        setTimeout(() => list.forEach(i => {
          const li = listEl.querySelector(`li[data-id="${CSS.escape(i.id)}"]`);
          if (li) { li.scrollIntoView({block: 'nearest'}); li.classList.add('gd-todo-flash'); setTimeout(() => li.classList.remove('gd-todo-flash'), 1600); }
        }), 50);
      });
      cell.appendChild(b);
    });
  }

  // Vẽ lại dấu + kiểm tra liên kết mỗi khi Timeline vẽ lại
  function hookRender() {
    if (typeof renderMSProjectView !== 'function' || renderMSProjectView.__gdTodo) return;
    const orig = renderMSProjectView;
    const wrapped = function () {
      const out = orig.apply(this, arguments);
      try { drawDayBadges(); checkLinks(); } catch (e) { /* không chặn Timeline */ }
      return out;
    };
    wrapped.__gdTodo = true;
    window.renderMSProjectView = wrapped;
  }

  // ------------------------------------------------------------------ GIAO DIỆN
  function build() {
    const wrapper = document.getElementById('msproject-view-wrapper');
    if (!wrapper || document.getElementById('gd-todo-panel')) return false;
    toggleBtn = document.createElement('button');
    toggleBtn.type = 'button';
    toggleBtn.id = 'gd-todo-toggle';
    toggleBtn.className = 'gd-todo-toggle';
    toggleBtn.title = 'Việc cần làm – kéo thả vào Timeline';
    wrapper.appendChild(toggleBtn);

    root = document.createElement('aside');
    root.id = 'gd-todo-panel';
    root.className = 'gd-todo-panel';
    root.setAttribute('aria-label', 'Việc cần làm');
    root.hidden = true;
    root.innerHTML = `
      <header class="gd-todo-head">
        <strong>Việc cần làm</strong>
        <span class="gd-todo-status" id="gd-todo-status"></span>
        <button type="button" class="gd-todo-icon" data-act="sync" title="Đồng bộ Microsoft To Do ngay">⟳</button>
        <button type="button" class="gd-todo-icon" data-act="close" title="Đóng">×</button>
      </header>
      <form class="gd-todo-add" autocomplete="off">
        <input type="text" maxlength="255" placeholder="Thêm việc… (Enter)" aria-label="Thêm việc cần làm">
        <button type="submit" title="Thêm">+</button>
      </form>
      <p class="gd-todo-hint">Kéo ⋮⋮ để sắp xếp. Thả lên Timeline để hẹn ngày; giữ <b>Shift</b> khi thả lên dòng dự án (hoặc bấm 📁) để xếp vào dự án.</p>
      <ul class="gd-todo-list" id="gd-todo-list"></ul>
      <footer class="gd-todo-foot">
        <button type="button" class="gd-todo-link" data-act="done"></button>
        <div class="gd-todo-ms" id="gd-todo-ms"></div>
      </footer>`;
    wrapper.appendChild(root);
    listEl = root.querySelector('#gd-todo-list');
    inputEl = root.querySelector('.gd-todo-add input');
    statusEl = root.querySelector('#gd-todo-status');
    msEl = root.querySelector('#gd-todo-ms');

    toggleBtn.addEventListener('click', () => setOpen(!st.open));
    root.querySelector('.gd-todo-add').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = inputEl.value;
      inputEl.value = '';
      addTodo(v);
    });
    root.addEventListener('click', onClick);
    root.addEventListener('change', (e) => {
      if (e.target.matches('.gd-todo-chk')) {
        const item = st.items.find(i => i.id === e.target.closest('li').dataset.id);
        if (item) setDone(item, e.target.checked);
      }
      if (e.target.matches('.gd-todo-list-select')) chooseList(e.target);
      if (e.target.matches('.gd-todo-assign-select')) {
        const item = st.items.find(i => i.id === e.target.closest('li').dataset.id);
        st.assignId = null;
        if (item && e.target.value) createTaskFromTodo(item, e.target.value, item.due || todayStr());
        else render();
      }
    });
    root.addEventListener('dblclick', (e) => {
      const li = e.target.closest('.gd-todo-title') && e.target.closest('li');
      if (li) startEdit(li.dataset.id);
    });
    listEl.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li[draggable="true"]');
      if (!li) return;
      st.dragId = li.dataset.id;
      e.dataTransfer.effectAllowed = 'copyMove';
      e.dataTransfer.setData(DRAG_TYPE, li.dataset.id);
      e.dataTransfer.setData('text/plain', li.querySelector('.gd-todo-title').textContent);
      setTimeout(() => root.classList.add('dragging'), 0);
    });
    try { st.open = localStorage.getItem('gd_todo_open') === '1'; } catch (e) { /* bỏ qua */ }
    return true;
  }

  function setOpen(open) {
    st.open = open;
    try { localStorage.setItem('gd_todo_open', open ? '1' : '0'); } catch (e) { /* bỏ qua */ }
    render();
    if (open) {
      if (!st.loaded) load();
      else if (Date.now() - st.lastSync > 15000) sync();
      setTimeout(() => inputEl && inputEl.focus(), 30);
    }
  }

  function startEdit(id) {
    const item = st.items.find(i => i.id === id);
    const li = listEl.querySelector(`li[data-id="${CSS.escape(id)}"]`);
    if (!item || !li) return;
    st.editingId = id;
    const span = li.querySelector('.gd-todo-title');
    const input = document.createElement('input');
    input.className = 'gd-todo-edit';
    input.value = item.title;
    input.maxLength = 255;
    span.replaceWith(input);
    input.focus();
    input.select();
    let finished = false;
    const finish = (save) => {
      if (finished) return;
      finished = true;
      st.editingId = null;
      const v = input.value.trim();
      if (save && v && v !== item.title) {
        const task = linkedTask(item);
        if (task) { task.title = v; syncAllFromMSProject(); }
        patch(item, {title: v}, () => { item.title = v; });
      } else render();
    };
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));
  }

  async function onClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    const li = btn.closest('li');
    const item = li ? st.items.find(i => i.id === li.dataset.id) : null;
    if (act === 'close') setOpen(false);
    else if (act === 'sync') sync(false);
    else if (act === 'done') { st.showDone = !st.showDone; render(); }
    else if (act === 'star' && item) patch(item, {star: !item.star}, () => { item.star = !item.star; });
    else if (act === 'assign' && item) { st.assignId = st.assignId === item.id ? null : item.id; render(); }
    else if (act === 'del' && item) {
      if (confirm(`Xoá việc "${item.title}"?${st.ms.linked && item.msLinked ? '\n(Xoá cả trong Microsoft To Do)' : ''}`)) {
        mutate('/api/todos/' + item.id, 'DELETE', null, () => { st.items = st.items.filter(i => i !== item); });
      }
    } else if (act === 'goto' && item) {
      const task = linkedTask(item);
      const row = task && document.querySelector(`.msp-tr[data-task-id="${CSS.escape(task.id)}"]`);
      if (row) { row.scrollIntoView({block: 'center', behavior: 'smooth'}); row.classList.add('gd-todo-flash'); setTimeout(() => row.classList.remove('gd-todo-flash'), 1600); }
      else if (task) toast(`Hạng mục "${task.title}" đang bị ẩn theo phạm vi xem`);
      else if (item.due) toast(`Hẹn ngày ${fmtDate(item.due)} – chưa thuộc dự án nào (bấm 📁 để xếp vào dự án)`);
    } else if (act === 'ms-connect') {
      try {
        const {url} = await api('/api/todos/ms/connect', {method: 'POST'});
        if (url && /^https:\/\/login\.microsoftonline\.com\//.test(url)) location.href = url;
      } catch (err) { toast(err.message); }
    } else if (act === 'ms-unlink') {
      if (!confirm('Ngắt đồng bộ Microsoft To Do? Việc đã có vẫn giữ ở cả 2 nơi.')) return;
      try { applyView(await api('/api/todos/ms/unlink', {method: 'POST'})); } catch (err) { toast(err.message); }
    } else if (act === 'ms-lists') {
      try {
        const {lists} = await api('/api/todos/ms/lists');
        msEl.querySelector('.gd-todo-ms-lists').innerHTML = `<select class="gd-todo-list-select" aria-label="Danh sách Microsoft To Do">${
          lists.map(l => `<option value="${esc(l.id)}" ${l.id === st.ms.listId ? 'selected' : ''}>${esc(l.name)}${l.isDefault ? ' (mặc định)' : ''}</option>`).join('')}</select>`;
      } catch (err) { toast(err.message); }
    }
  }

  async function chooseList(select) {
    const opt = select.selectedOptions[0];
    if (!opt || opt.value === st.ms.listId) return;
    st.busy = true; renderStatus();
    try {
      applyView(await api('/api/todos/ms/list', {method: 'POST', body: {listId: opt.value, listName: opt.textContent.replace(/ \(mặc định\)$/, '')}}));
      toast('Đã chuyển sang danh sách "' + st.ms.listName + '"');
    } catch (err) { toast(err.message); }
    finally { st.busy = false; renderStatus(); }
  }

  function setStatus(text, isError) {
    if (!statusEl) return;
    statusEl.textContent = text || '';
    statusEl.classList.toggle('err', !!isError);
  }

  function renderStatus() {
    if (!statusEl) return;
    if (st.busy) return setStatus('đang đồng bộ…');
    if (st.ms.linked && st.ms.error) return setStatus('lỗi đồng bộ', true);
    if (st.ms.linked && st.ms.lastSyncAt) {
      const t = new Date(st.ms.lastSyncAt);
      return setStatus('MS To Do ✓ ' + t.toLocaleTimeString('vi-VN', {hour: '2-digit', minute: '2-digit'}));
    }
    setStatus('');
  }

  function assignSelect() {
    const owners = new Map((AppState.projectOwners || []).map(o => [o.id, o.name]));
    const opts = AppState.calendars.map(c => `<option value="${esc(c.id)}">${esc(owners.get(c.ownerId) ? owners.get(c.ownerId) + ' · ' + c.name : c.name)}</option>`).join('');
    return `<select class="gd-todo-assign-select" aria-label="Chọn dự án để xếp việc"><option value="">Chọn dự án / giai đoạn…</option>${opts}</select>`;
  }

  function itemHtml(item) {
    const task = linkedTask(item);
    const pending = String(item.id).startsWith('tmp_');
    const dueLabel = task ? `📁 ${fmtDate(task.endDate || item.due)}` : (item.due ? fmtDate(item.due) : '');
    const overdue = !item.done && item.due && item.due < todayStr();
    return `<li data-id="${esc(item.id)}" class="${item.done ? 'done' : ''} ${item.star ? 'starred' : ''}" ${!item.done && !pending ? 'draggable="true"' : ''}>
      <span class="gd-todo-grip" aria-hidden="true" title="Kéo để sắp xếp / thả lên Timeline">⋮⋮</span>
      <input type="checkbox" class="gd-todo-chk" ${item.done ? 'checked' : ''} ${pending ? 'disabled' : ''} aria-label="Hoàn thành">
      <span class="gd-todo-title" title="Nháy đúp để sửa">${esc(item.title)}</span>
      ${dueLabel ? `<button type="button" class="gd-todo-due ${task ? 'linked' : ''} ${overdue ? 'overdue' : ''}" data-act="goto" title="${task ? 'Đã xếp vào ' + esc(calName(task.calendarId)) + ' – bấm để tới hạng mục' : 'Hẹn ngày (Microsoft To Do)'}">${dueLabel}</button>` : ''}
      ${pending || item.done || task ? '' : '<button type="button" class="gd-todo-mini gd-todo-assign" data-act="assign" title="Xếp vào dự án trên Timeline">📁</button>'}
      ${pending ? '' : '<button type="button" class="gd-todo-mini gd-todo-del" data-act="del" title="Xoá">×</button>'}
      <button type="button" class="gd-todo-star ${item.star ? 'on' : ''}" data-act="star" ${pending ? 'disabled' : ''} aria-pressed="${item.star ? 'true' : 'false'}" title="${item.star ? 'Bỏ ưu tiên' : 'Đánh dấu ưu tiên (Quan trọng)'}">${item.star ? '★' : '☆'}</button>
      ${st.assignId === item.id ? `<div class="gd-todo-assign-row">${assignSelect()}</div>` : ''}
    </li>`;
  }

  function render() {
    if (!root) return;
    const open = sortedOpen();
    const done = st.items.filter(i => i.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
    toggleBtn.innerHTML = `☑ Việc cần làm${open.length ? ` <b>${open.length}</b>` : ''}`;
    toggleBtn.classList.toggle('active', st.open);
    root.hidden = !st.open;
    if (!st.open || st.editingId) return;
    let html = open.map(itemHtml).join('');
    if (!st.loaded) html = '<li class="gd-todo-empty">Đang tải…</li>';
    else if (!open.length) html = '<li class="gd-todo-empty">Không còn việc nào 🎉</li>';
    if (st.showDone && done.length) html += `<li class="gd-todo-sep">Đã xong</li>` + done.slice(0, 50).map(itemHtml).join('');
    listEl.innerHTML = html;
    const sel = listEl.querySelector('.gd-todo-assign-select');
    if (sel) sel.focus();
    const doneBtn = root.querySelector('[data-act="done"]');
    doneBtn.textContent = done.length ? (st.showDone ? 'Ẩn việc đã xong' : `Đã xong (${done.length})`) : '';
    doneBtn.hidden = !done.length;
    renderMs();
    renderStatus();
  }

  function renderMs() {
    const ms = st.ms || {};
    if (!ms.available) {
      msEl.innerHTML = '<span class="gd-todo-muted" title="Quản trị cần đặt MS_TODO_CLIENT_ID, MS_TODO_CLIENT_SECRET, MS_TODO_REDIRECT_URI trên Render">Microsoft To Do: máy chủ chưa cấu hình</span>';
    } else if (!ms.linked) {
      msEl.innerHTML = '<button type="button" class="gd-todo-ms-btn" data-act="ms-connect">Liên kết Microsoft To Do</button>' +
        (ms.error ? `<div class="gd-todo-err">${esc(ms.error)}</div>` : '');
    } else {
      msEl.innerHTML = `<div class="gd-todo-ms-row"><span title="${esc(ms.account)}">↔ ${esc(ms.listName || 'To Do')}</span>
        <button type="button" class="gd-todo-link" data-act="ms-lists">Đổi danh sách</button>
        <button type="button" class="gd-todo-link" data-act="ms-unlink">Ngắt</button></div>
        <div class="gd-todo-ms-lists"></div>
        ${ms.error ? `<div class="gd-todo-err">${esc(ms.error)}</div>` : ''}`;
    }
  }

  // ------------------------------------------------------------------ KHỞI ĐỘNG
  function handleOAuthReturn() {
    const params = new URLSearchParams(location.search);
    const r = params.get('ms-todo');
    if (!r) return;
    params.delete('ms-todo');
    history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
    setTimeout(() => {
      toast(r === 'linked' ? 'Đã liên kết Microsoft To Do – đang đồng bộ…' : 'Chưa liên kết được Microsoft To Do, thử lại.');
      if (r === 'linked' && typeof switchViewMode === 'function' && AppState.viewMode !== 'msproject') switchViewMode('msproject');
      setOpen(true);
    }, 800);
  }

  function tick() {
    if (!root && !build()) return;
    // Chưa đăng nhập thì chưa gọi API (tránh bật lại hộp đăng nhập)
    if (typeof _appConfig !== 'undefined' && _appConfig.authMode === 'google' && !getSession()) return;
    const visible = isTimelineVisible();
    if (visible && !st.loaded && !st.loading) { st.loading = true; load().finally(() => { st.loading = false; }); }
    if (visible && st.ms.linked && !document.hidden && Date.now() - st.lastSync > SYNC_EVERY_MS) sync();
    if (st.loaded) checkLinks();
  }

  function init() {
    hookRender();
    setupDragDrop();
    build();
    render();
    handleOAuthReturn();
    tick();
    setInterval(tick, 3000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }

  hookRender();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.GDTimelineTodo = {state: st, reload: load, sync: () => sync(false), checkLinks};
})();
