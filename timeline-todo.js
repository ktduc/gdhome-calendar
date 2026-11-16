// =========================================================================
// GD HOME - VIỆC CẦN LÀM (TODO) TRÊN TIMELINE
// - Chỉ hiện khi đang ở chế độ Timeline (nằm trong #msproject-view-wrapper)
// - Kéo 1 việc thả vào dòng dự án trên biểu đồ Gantt -> tạo hạng mục đúng ngày thả
// - Tick hoàn thành -> việc ẩn khỏi danh sách (xem lại ở "Đã xong")
// - Đồng bộ 2 chiều Microsoft To Do (qua /api/todos, server giữ quyền truy cập)
// Dùng các hàm chung của app.js: apiFetch, AppState, syncAllFromMSProject, showToast...
// =========================================================================
(function () {
  'use strict';
  const DRAG_TYPE = 'application/x-gd-todo';
  const SYNC_EVERY_MS = 60000;
  const st = {items: [], ms: {available: false}, loaded: false, open: false, showDone: false,
    busy: false, lastSync: 0, dragId: null, syncTimer: null, editingId: null};
  let root, listEl, inputEl, toggleBtn, statusEl, msEl;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const toast = (m) => { if (typeof showToast === 'function') showToast(m); };
  const fmtDate = (d) => d ? d.slice(8, 10) + '/' + d.slice(5, 7) : '';
  const isTimelineVisible = () => {
    const w = document.getElementById('msproject-view-wrapper');
    return !!(w && w.offsetParent !== null && w.style.display !== 'none');
  };

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
    if (optimistic) { optimistic(); render(); }
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

  async function addTodo(title) {
    title = String(title || '').trim();
    if (!title) return;
    const tempId = 'tmp_' + Date.now();
    await mutate('/api/todos', 'POST', {title}, () => st.items.push({id: tempId, title, done: false, due: '', taskId: ''}));
  }

  function linkedTask(item) {
    return item.taskId && Array.isArray(AppState.tasks) ? AppState.tasks.find(t => t.id === item.taskId) : null;
  }

  async function setDone(item, done) {
    const task = linkedTask(item);
    if (task && done && task.progress !== 100) {
      task.progress = 100;
      syncAllFromMSProject(`Đã xong "${item.title}" – hạng mục trên Timeline lên 100%`);
    } else if (done) {
      toast(`Đã xong: ${item.title}`);
    }
    await mutate('/api/todos/' + item.id, 'PATCH', {done}, () => { item.done = done; });
  }

  // ------------------------------------------------------------------ KÉO THẢ VÀO TIMELINE
  function dropTarget(e) {
    const layer = e.target.closest && e.target.closest('#msp-gantt-rows-layer');
    if (layer) {
      const row = e.target.closest('.msp-gantt-row');
      if (!row || !row.dataset.calId || typeof _mspTimelineInfo === 'undefined' || !_mspTimelineInfo) return null;
      const idx = mspDateIndexFromClientX(layer, e.clientX);
      if (idx === null) return null;
      return {calId: row.dataset.calId, date: mspDateFromIndex(idx), row, idx};
    }
    const tr = e.target.closest && e.target.closest('#msp-table-body [data-cal-id]');
    if (tr) return {calId: tr.dataset.calId, date: formatDateStr(new Date()), row: null};
    return null;
  }

  function clearDropHint() {
    document.querySelectorAll('.gd-todo-drop-hint').forEach(el => el.remove());
    document.querySelectorAll('.gd-todo-drop-row').forEach(el => el.classList.remove('gd-todo-drop-row'));
  }

  function showDropHint(t) {
    clearDropHint();
    if (!t.row) {
      const tr = document.querySelector(`#msp-table-body [data-cal-id="${CSS.escape(t.calId)}"]`);
      if (tr) tr.classList.add('gd-todo-drop-row');
      return;
    }
    const hl = document.createElement('div');
    hl.className = 'msp-range-select-highlight gd-todo-drop-hint';
    hl.style.left = (t.idx * _mspTimelineInfo.colWidth) + 'px';
    hl.style.width = _mspTimelineInfo.colWidth + 'px';
    t.row.appendChild(hl);
  }

  function createTaskFromTodo(item, t) {
    const cal = AppState.calendars.find(c => c.id === t.calId) || getActiveCalendar();
    if (!cal) return;
    cal.visible = true;
    const ownTasks = AppState.tasks.filter(x => x.calendarId === cal.id && x.color);
    const color = ownTasks.length ? ownTasks[ownTasks.length - 1].color : (cal.color || '#1565c0');
    const task = {id: 'task_' + Date.now(), calendarId: cal.id, title: item.title, startDate: t.date, endDate: t.date,
      color, skipSundays: true, showCount: true, note: '', predecessors: [], todoId: item.id};
    AppState.tasks.push(task);
    syncAllFromMSProject(`Đã xếp "${item.title}" vào ${cal.name || 'dự án'} ngày ${fmtDate(t.date)}`);
    mutate('/api/todos/' + item.id, 'PATCH', {taskId: task.id, due: t.date}, () => { item.taskId = task.id; item.due = t.date; });
  }

  function setupDropZone() {
    document.addEventListener('dragover', (e) => {
      if (!st.dragId || !isTimelineVisible()) return;
      const t = dropTarget(e);
      if (!t) { clearDropHint(); return; }
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      showDropHint(t);
      if (typeof showFloatingTooltip === 'function') {
        const cal = AppState.calendars.find(c => c.id === t.calId);
        showFloatingTooltip(`Thả để xếp vào ${cal ? cal.name : 'dự án'} • ${fmtDate(t.date)}`, e.clientX, e.clientY);
      }
    });
    document.addEventListener('drop', (e) => {
      if (!st.dragId) return;
      const t = dropTarget(e);
      const item = st.items.find(i => i.id === st.dragId);
      clearDropHint();
      if (typeof hideFloatingTooltip === 'function') hideFloatingTooltip();
      st.dragId = null;
      root && root.classList.remove('dragging');
      if (!t || !item) return;
      e.preventDefault();
      createTaskFromTodo(item, t);
    });
    document.addEventListener('dragend', () => {
      st.dragId = null;
      clearDropHint();
      root && root.classList.remove('dragging');
      if (typeof hideFloatingTooltip === 'function') hideFloatingTooltip();
    });
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
      <p class="gd-todo-hint">Kéo việc thả vào dòng dự án trên biểu đồ để xếp lịch.</p>
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
    });
    root.addEventListener('dblclick', (e) => {
      const li = e.target.closest('.gd-todo-title') && e.target.closest('li');
      if (li) startEdit(li.dataset.id);
    });
    listEl.addEventListener('dragstart', (e) => {
      const li = e.target.closest('li[draggable="true"]');
      if (!li) return;
      st.dragId = li.dataset.id;
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData(DRAG_TYPE, li.dataset.id);
      e.dataTransfer.setData('text/plain', li.querySelector('.gd-todo-title').textContent);
      root.classList.add('dragging');
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
      if (save && v && v !== item.title) mutate('/api/todos/' + id, 'PATCH', {title: v}, () => { item.title = v; });
      else render();
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
    else if (act === 'del' && item) {
      if (confirm(`Xoá việc "${item.title}"?${st.ms.linked && item.msLinked ? '\n(Xoá cả trong Microsoft To Do)' : ''}`)) {
        mutate('/api/todos/' + item.id, 'DELETE', null, () => { st.items = st.items.filter(i => i !== item); });
      }
    } else if (act === 'goto' && item) {
      const task = linkedTask(item);
      const row = task && document.querySelector(`.msp-tr[data-task-id="${CSS.escape(task.id)}"], [data-task-id="${CSS.escape(task.id)}"]`);
      if (row) { row.scrollIntoView({block: 'center', behavior: 'smooth'}); row.classList.add('gd-todo-flash'); setTimeout(() => row.classList.remove('gd-todo-flash'), 1600); }
      else toast(task ? `Hạng mục "${task.title}" đang bị ẩn theo phạm vi xem` : 'Hạng mục trên Timeline đã bị xoá');
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

  function itemHtml(item) {
    const task = linkedTask(item);
    const pending = String(item.id).startsWith('tmp_');
    return `<li data-id="${esc(item.id)}" class="${item.done ? 'done' : ''}" ${!item.done && !pending ? 'draggable="true"' : ''}>
      <span class="gd-todo-grip" aria-hidden="true">⋮⋮</span>
      <input type="checkbox" class="gd-todo-chk" ${item.done ? 'checked' : ''} ${pending ? 'disabled' : ''} aria-label="Hoàn thành">
      <span class="gd-todo-title" title="Nháy đúp để sửa">${esc(item.title)}</span>
      ${item.due ? `<button type="button" class="gd-todo-due ${task ? 'linked' : ''}" data-act="goto" title="${task ? 'Đã xếp trên Timeline – bấm để tới hạng mục' : 'Hạn (từ Microsoft To Do)'}">${task ? '📅 ' : ''}${fmtDate(item.due)}</button>` : ''}
      ${pending ? '' : '<button type="button" class="gd-todo-del" data-act="del" title="Xoá">×</button>'}
    </li>`;
  }

  function render() {
    if (!root) return;
    const open = st.items.filter(i => !i.done);
    const done = st.items.filter(i => i.done).sort((a, b) => String(b.doneAt).localeCompare(String(a.doneAt)));
    toggleBtn.innerHTML = `☑ Việc cần làm${open.length ? ` <b>${open.length}</b>` : ''}`;
    toggleBtn.classList.toggle('active', st.open);
    root.hidden = !st.open;
    if (!st.open) return;
    if (st.editingId) return;
    const scheduledLast = open.slice().sort((a, b) => (!!linkedTask(a)) - (!!linkedTask(b)));
    let html = scheduledLast.map(itemHtml).join('');
    if (!st.loaded) html = '<li class="gd-todo-empty">Đang tải…</li>';
    else if (!open.length) html = '<li class="gd-todo-empty">Không còn việc nào 🎉</li>';
    if (st.showDone && done.length) html += `<li class="gd-todo-sep">Đã xong</li>` + done.slice(0, 50).map(itemHtml).join('');
    listEl.innerHTML = html;
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
  }

  function init() {
    setupDropZone();
    build();
    render();
    handleOAuthReturn();
    tick();
    setInterval(tick, 3000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.GDTimelineTodo = {state: st, reload: load, sync: () => sync(false)};
})();
