// Timeline (kiểu MS Project): bảng WBS + Gantt, menu chuột phải, liên kết, cấu trúc dự án, đề mục.
// Tách từ app.js: các file app-*.js chạy nối tiếp nhau (chung phạm vi toàn cục), giữ đúng thứ tự nạp trong index.html.
// =========================================================================
// CHẾ ĐỘ XEM TIMELINE (MICROSOFT PROJECT - WBS & GANTT CHART ĐỒNG BỘ 2 CHIỀU)
// =========================================================================

const MSP_ZOOM_PRESETS = { compact: 24, normal: 34, wide: 46, xwide: 62, xxwide: 84 };
const MSP_ROW_HEIGHT_PRESETS = { mini: 24, compact: 32, normal: 42, tall: 54 };

function getMspColWidth() {
  if (typeof AppState.mspZoom === 'number') return Math.max(18, Math.min(120, AppState.mspZoom));
  return MSP_ZOOM_PRESETS[AppState.mspZoom] || MSP_ZOOM_PRESETS.normal;
}

function getMspRowHeightPx() {
  if (typeof AppState.mspRowHeight === 'number') {
    return Math.max(22, Math.min(84, AppState.mspRowHeight));
  }
  return MSP_ROW_HEIGHT_PRESETS[AppState.mspRowHeight] || MSP_ROW_HEIGHT_PRESETS.normal;
}

// Ẩn/hiện % tiến độ trên Timeline theo tick "Tiến độ %" ở mục CỘT & ĐỀ MỤC
function mspShowProgress() {
  return !!(AppState.mspVisibility && AppState.mspVisibility.colProg);
}

const MSP_FONT_WEIGHT_CLASSES = ['msp-fw-light', 'msp-fw-bold', 'msp-fw-heavy'];
function applyMspFontWeight(targetContainer = null) {
  const fw = AppState.mspFontWeight || 'normal';
  const roots = targetContainer ? [targetContainer] : document.querySelectorAll('.msp-split-workspace');
  roots.forEach(rootEl => {
    rootEl.classList.remove(...MSP_FONT_WEIGHT_CLASSES);
    if (fw !== 'normal') rootEl.classList.add('msp-fw-' + fw);
  });
}

function applyMspRowHeightStyles(targetContainer = null) {
  const rowH = getMspRowHeightPx();
  const barH = rowH <= 28 ? Math.max(14, rowH - 6) : Math.max(18, Math.min(38, rowH - 16));
  const barTop = Math.floor((rowH - barH) / 2);
  const sumTop = Math.max(8, Math.floor((rowH - 8) / 2) - 4);
  const rootEl = targetContainer || document.querySelector('.msp-split-workspace');
  if (rootEl) {
    rootEl.style.setProperty('--msp-row-height', `${rowH}px`);
    rootEl.style.setProperty('--msp-bar-height', `${barH}px`);
    rootEl.style.setProperty('--msp-bar-top', `${barTop}px`);
    rootEl.style.setProperty('--msp-summary-top', `${sumTop}px`);
    rootEl.classList.toggle('msp-rows-mini', rowH <= 28);
    rootEl.classList.toggle('msp-rows-compact', rowH > 28 && rowH <= 34);
  }
}

// Dịch chuyển 1 ngày theo số ngày làm việc có dấu (+/- deltaWorkingDays), tự nhảy qua ngày nghỉ

// Tính khoảng cách số ngày làm việc có dấu từ dateA sang dateB

// Tự động dịch các hạng mục phía sau khi chỉnh Ngày bắt đầu / Ngày kết thúc mà vẫn giữ nguyên số ngày làm việc của từng mục
function cascadeShiftSubsequentTasks(editedTask, oldStartDate, oldEndDate) {
  // Dời các việc phía sau THEO LIÊN KẾT (predecessors), không còn dời theo thứ tự dòng.
  // Các việc chạy song song (không nối) sẽ giữ nguyên.
  if (!editedTask || AppState.autoCascadeShift === false) return 0;
  if (oldStartDate === editedTask.startDate && oldEndDate === editedTask.endDate) return 0;
  return propagateLinkedTasks([editedTask.id], AppState.tasks);
}

// Dịch toàn bộ các hạng mục trong 1 Dự án tới Ngày bắt đầu mới (giữ nguyên khoảng cách và số ngày làm việc của từng mục)
function shiftEntireProjectToStartDate(calId, newProjectStartDateStr) {
  const calTasks = AppState.tasks.filter(t => t.calendarId === calId && t.visibleOnBoard !== false);
  if (calTasks.length === 0 || !newProjectStartDateStr) return 0;
  const minStart = calTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), calTasks[0].startDate);
  const deltaWorkDays = getSignedWorkingDaysGap(minStart, newProjectStartDateStr, true);
  if (deltaWorkDays === 0 && minStart === newProjectStartDateStr) return 0;

  calTasks.forEach(t => {
    const preserveWorkDays = Math.max(1, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false));
    const offsetFromMin = getSignedWorkingDaysGap(minStart, t.startDate, t.skipSundays !== false);
    const shiftedStart = shiftDateByWorkingDays(newProjectStartDateStr, offsetFromMin, t.skipSundays !== false);
    t.startDate = shiftedStart;
    t.endDate = computeEndDateByWorkingDays(shiftedStart, preserveWorkDays, t.skipSundays !== false);
  });
  return calTasks.length;
}

// Dịch toàn bộ các hạng mục trong 1 Dự án sao cho Ngày kết thúc của dự án khớp với ngày mới (giữ nguyên số ngày làm việc của từng mục)
function shiftEntireProjectToEndDate(calId, newProjectEndDateStr) {
  const calTasks = AppState.tasks.filter(t => t.calendarId === calId && t.visibleOnBoard !== false);
  if (calTasks.length === 0 || !newProjectEndDateStr) return 0;
  const maxEnd = calTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), calTasks[0].endDate);
  const deltaWorkDays = getSignedWorkingDaysGap(maxEnd, newProjectEndDateStr, true);
  if (deltaWorkDays === 0) return 0;

  calTasks.forEach(t => {
    const preserveWorkDays = Math.max(1, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false));
    const shiftedStart = shiftDateByWorkingDays(t.startDate, deltaWorkDays, t.skipSundays !== false);
    t.startDate = shiftedStart;
    t.endDate = computeEndDateByWorkingDays(shiftedStart, preserveWorkDays, t.skipSundays !== false);
  });
  return calTasks.length;
}

// Nhân đôi nhanh 1 Công việc (chèn ngay phía dưới công việc gốc để chỉnh sửa nhanh)
function duplicateTask(task, shiftNextDate = false,commit = true) {
  if (!task) return null;
  const workDays = Math.max(1, countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false));
  let newStart = task.startDate;
  let newEnd = task.endDate;
  if (shiftNextDate) {
    newStart = getNextWorkingDateStr(task.endDate, task.skipSundays !== false);
    newEnd = computeEndDateByWorkingDays(newStart, workDays, task.skipSundays !== false);
  }
  const nextColor = getNextSequentialPaletteColor(task.calendarId);
  const cloned = {
    ...task,
    id: 'task_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
    title: `${task.title} (Bản sao)`,
    startDate: newStart,
    endDate: newEnd,
    color: nextColor || task.color,
    predecessors: shiftNextDate
      ? [{ id: task.id, type: 'FS', lag: 0 }]
      : (Array.isArray(task.predecessors) ? task.predecessors.map(l => ({ ...l })) : [])
  };
  for (const key of ['notionPageId','notionSyncedAt','notionSnap']) delete cloned[key];
  const origIdx = AppState.tasks.findIndex(t => t.id === task.id);
  if (origIdx !== -1) {
    AppState.tasks.splice(origIdx + 1, 0, cloned);
  } else {
    AppState.tasks.push(cloned);
  }
  if (commit) syncAllFromMSProject(`Đã nhân đôi công việc "${task.title}"!`);
  return cloned;
}

// Nhân đôi nhanh cả 1 Dự án cùng toàn bộ các hạng mục công việc bên trong
function duplicateProject(cal) {
  if (!cal) return null;
  const newCalId = 'cal_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  const palette = getActivePaletteColors();
  const nextCalColor = palette[AppState.calendars.length % palette.length] || cal.color;
  const newCal = {
    id: newCalId,
    ownerId: cal.ownerId || (AppState.projectOwners && AppState.projectOwners[0] ? AppState.projectOwners[0].id : 'owner_default'),
    name: `${cal.name} (Bản sao)`,
    color: nextCalColor,
    visible: true
  };
  const calIdx = AppState.calendars.findIndex(c => c.id === cal.id);
  if (calIdx !== -1) {
    AppState.calendars.splice(calIdx + 1, 0, newCal);
  } else {
    AppState.calendars.push(newCal);
  }

  const sourceTasks = AppState.tasks.filter(t => t.calendarId === cal.id);
  const idMap = new Map();
  sourceTasks.forEach((t, idx) => {
    idMap.set(t.id, 'task_' + Date.now() + '_' + idx + '_' + Math.floor(Math.random() * 1000));
  });
  sourceTasks.forEach((t) => {
    let clonedTitle = t.title;
    if (cal.name && clonedTitle.endsWith(` - ${cal.name}`)) {
      clonedTitle = clonedTitle.slice(0, -(` - ${cal.name}`).length) + ` - ${newCal.name}`;
    }
    AppState.tasks.push({
      ...t,
      id: idMap.get(t.id),
      calendarId: newCalId,
      title: clonedTitle,
      predecessors: (t.predecessors || []).filter(l => idMap.has(l.id)).map(l => ({ ...l, id: idMap.get(l.id) }))
    });
  });

  AppState.activeCalendarId = newCalId;
  syncAllFromMSProject(`Đã nhân đôi dự án "${cal.name}" (${sourceTasks.length} công việc)!`);
  return newCal;
}

// =========================================================================
// MENU CHUỘT PHẢI (CONTEXT MENU) CHO CÔNG VIỆC & DỰ ÁN
// =========================================================================
// Thu gọn / mở rộng từng mục ở thanh bên trái (lưu theo tài khoản & localStorage)
const SIDEBAR_COLLAPSE_KEY = 'gdhome_sidebar_collapsed';
const SIDEBAR_DEFAULT_COLLAPSED = { palette: true, demuc: false, msp: false, daysoff: false };

function syncSidebarCollapseUI() {
  if (typeof document === 'undefined') return;
  const state = (AppState.sidebarCollapsed && typeof AppState.sidebarCollapsed === 'object')
    ? AppState.sidebarCollapsed
    : SIDEBAR_DEFAULT_COLLAPSED;
  document.querySelectorAll('.sb-collapsible[data-sb]').forEach(sec => {
    const key = sec.dataset.sb;
    const collapsed = state[key] !== undefined ? !!state[key] : !!SIDEBAR_DEFAULT_COLLAPSED[key];
    sec.classList.toggle('is-collapsed', collapsed);
  });
}

function setupCollapsibleSidebar() {
  if (!AppState.sidebarCollapsed || typeof AppState.sidebarCollapsed !== 'object') {
    AppState.sidebarCollapsed = { ...SIDEBAR_DEFAULT_COLLAPSED };
  }
  syncSidebarCollapseUI();
  document.querySelectorAll('.sb-collapsible[data-sb]').forEach(sec => {
    const key = sec.dataset.sb;
    const head = sec.querySelector('.sb-head');
    if (!head) return;
    head.addEventListener('click', (e) => {
      if (e.target.closest('button, input, select, a')) return;
      const now = !sec.classList.contains('is-collapsed');
      sec.classList.toggle('is-collapsed', now);
      if (!AppState.sidebarCollapsed || typeof AppState.sidebarCollapsed !== 'object') {
        AppState.sidebarCollapsed = { ...SIDEBAR_DEFAULT_COLLAPSED };
      }
      AppState.sidebarCollapsed[key] = now;
      try { localStorage.setItem(SIDEBAR_COLLAPSE_KEY, JSON.stringify(AppState.sidebarCollapsed)); } catch (err) { /* bỏ qua */ }
      saveToBackend();
    });
  });
}

// Nhãn hiển thị cho 1 ngày trên dải ngày lễ của Bảng Lịch -> { name, type } | null
// type: 'off' | 'makeup-work' | 'observance' | 'custom-off'
function getDayLabelInfo(dateStr) {
  const ov = getDayOverride(dateStr);
  if (ov === 'off') return { name: 'Nghỉ riêng', type: 'custom-off' };
  if (ov === 'work') return { name: 'Đi làm (tự đánh dấu)', type: 'makeup-work' };
  if (AppState.showVnHolidays === false) return null;
  const hol = getHolidayInfo(dateStr);
  if (!hol) return null;
  return { name: hol.name, type: hol.type === 'work' ? 'makeup-work' : hol.type };
}

// Menu chuột phải vào 1 ô ngày: tự đánh dấu ngày nghỉ riêng / ngày đi làm
function openDayOverrideContextMenu(e, dateStr) {
  hideFloatingTooltip();
  const cfg = AppState.daysOffConfig;
  if (!cfg.overrides || typeof cfg.overrides !== 'object') cfg.overrides = {};
  const current = cfg.overrides[dateStr] || null;
  const info = isDateDayOff(dateStr, true);
  const setOverride = (val, msg) => {
    if (val) cfg.overrides[dateStr] = val;
    else delete cfg.overrides[dateStr];
    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    showToast(msg);
  };
  const dLabel = formatShortVNDate(dateStr);
  const items = [];
  if (current !== 'off') {
    items.push({ label: '⛔ Đánh dấu là NGÀY NGHỈ riêng', onClick: () => setOverride('off', `Đã đánh dấu ${dLabel} là ngày nghỉ`) });
  }
  if (current !== 'work') {
    items.push({ label: '🛠️ Đánh dấu là NGÀY ĐI LÀM (làm bù / tăng ca)', onClick: () => setOverride('work', `Đã đánh dấu ${dLabel} là ngày đi làm`) });
  }
  if (current) {
    items.push({ divider: true });
    items.push({ label: '↺ Bỏ đánh dấu (theo cài đặt chung)', onClick: () => setOverride(null, `Đã bỏ đánh dấu ngày ${dLabel}`) });
  }
  const status = info.isOff ? 'Đang: Nghỉ' : (info.isHalfOff ? 'Đang: Làm 0.5 ngày' : 'Đang: Đi làm');
  showCustomContextMenu(e.clientX, e.clientY, `📅 Ngày ${dLabel} • ${status}${info.reason ? ' • ' + info.reason : ''}`, items);
}

// Bấm vùng tối bên ngoài hộp thoại thì đóng (trừ hộp nhập công việc để không mất dữ liệu đang gõ).
document.addEventListener('mousedown', event => {
  const overlay = event.target;
  if (!overlay.classList || !overlay.classList.contains('active') || overlay.id === 'login-overlay' || overlay.id === 'task-modal') return;
  if (!overlay.classList.contains('modal-overlay') && !overlay.classList.contains('ai-panel-overlay')) return;
  overlay.dataset.outsideDown = '1';
});
document.addEventListener('click', event => {
  const overlay = event.target;
  if (!overlay.dataset || overlay.dataset.outsideDown !== '1') return;
  delete overlay.dataset.outsideDown;
  if (overlay.classList.contains('active')) overlay.classList.remove('active');
});

function handleEscapeKey() {
  if (document.querySelector('dialog[open]')) return false;
  const menu = document.getElementById('custom-context-menu');
  if (menu && menu.style.display !== 'none' && menu.offsetParent !== null) { hideCustomContextMenu(); return true; }
  if (GDHomeShell.closeMenus()) return true;
  const pop = document.getElementById('quick-create-popover');
  if (pop && pop.classList.contains('active')) { closeQuickPopover(); return true; }
  // Hộp thoại (bỏ qua màn hình đăng nhập)
  const modals = Array.from(document.querySelectorAll('.modal-overlay.active, .ai-panel-overlay.active')).filter(m => m.id !== 'login-overlay');
  if (modals.length) {
    const top = modals[modals.length - 1];
    if (top.id === 'task-modal') closeTaskModal(); else top.classList.remove('active');
    return true;
  }
  if (typeof isCropMode !== 'undefined' && isCropMode) { exitInteractiveCropMode(); return true; }
  if (document.querySelector('.msp-range-select-highlight')) { closeQuickPopover(); return true; }
  const ae = document.activeElement;
  if (ae && ['INPUT', 'TEXTAREA', 'SELECT'].includes(ae.tagName) && !ae.closest('.app-sidebar')) { ae.blur(); return true; }
  if (Array.isArray(AppState.selectedTaskIds) && AppState.selectedTaskIds.length) {
    AppState.selectedTaskIds = [];
    if (typeof renderMSProjectView === 'function') renderMSProjectView();
    if (typeof renderCalendar === 'function') try { renderCalendar(); } catch (_) {}
    return true;
  }
  return false;
}

// =========================================================================
// TIÊU ĐỀ NGÀY / THỨ CỐ ĐỊNH KHI CUỘN (Timeline + Bảng lịch)
// Dùng translateY vì khung Gantt có overflow-x (CSS sticky không ăn).
// =========================================================================
const STICKY_HEADER_SELECTORS = ['.msp-table-header', '.msp-gantt-header'];
function getVerticalScrollParent(el) {
  let p = el.parentElement;
  while (p && p !== document.body) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 1) return p;
    p = p.parentElement;
  }
  return null;
}
function updateStickyHeaders() {
  document.querySelectorAll(STICKY_HEADER_SELECTORS.join(',')).forEach(el => {
    if (el.closest('.msp-export-clone') || !el.offsetParent) return;
    const container = el.parentElement;
    const cur = el._stickyY || 0;
    const rect = el.getBoundingClientRect();
    const naturalTop = rect.top - cur;
    const scroller = getVerticalScrollParent(el);
    const limitTop = scroller ? scroller.getBoundingClientRect().top : 0;
    const maxY = Math.max(0, container.getBoundingClientRect().bottom - naturalTop - rect.height);
    const y = Math.round(Math.max(0, Math.min(limitTop - naturalTop, maxY)));
    if (y !== cur) {
      el._stickyY = y;
      el.style.transform = y ? `translateY(${y}px)` : '';
      el.classList.toggle('is-stuck', y > 0);
    }
  });
}
let _stickyRaf = 0;
function scheduleStickyHeaders() {
  if (_stickyRaf) return;
  _stickyRaf = requestAnimationFrame(() => { _stickyRaf = 0; updateStickyHeaders(); });
}
document.addEventListener('scroll', scheduleStickyHeaders, true);
window.addEventListener('resize', scheduleStickyHeaders);

function hideCustomContextMenu() {
  const menu = document.getElementById('custom-context-menu');
  if (menu) menu.style.display = 'none';
}

function showCustomContextMenu(x, y, headerText, items) {
  const menu = document.getElementById('custom-context-menu');
  if (!menu) return;
  menu.innerHTML = '';

  if (headerText) {
    const hdr = document.createElement('div');
    hdr.className = 'ctx-menu-header';
    hdr.textContent = headerText;
    menu.appendChild(hdr);
  }

  items.forEach(item => {
    if (item.divider) {
      const div = document.createElement('div');
      div.className = 'ctx-menu-divider';
      menu.appendChild(div);
      return;
    }
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `ctx-menu-item ${item.danger ? 'danger' : ''}`;
    const labelSpan = document.createElement('span');
    labelSpan.textContent = item.label;
    btn.appendChild(labelSpan);
    if (item.shortcut) {
      const sc = document.createElement('span');
      sc.className = 'ctx-shortcut';
      sc.textContent = item.shortcut;
      btn.appendChild(sc);
    }
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      hideCustomContextMenu();
      if (typeof item.onClick === 'function') item.onClick();
    });
    menu.appendChild(btn);
  });

  menu.style.display = 'block';
  const rect = menu.getBoundingClientRect();
  const maxLeft = window.innerWidth - (rect.width || 220) - 8;
  const maxTop = window.innerHeight - (rect.height || 200) - 8;
  menu.style.left = `${Math.max(8, Math.min(x, maxLeft))}px`;
  menu.style.top = `${Math.max(8, Math.min(y, maxTop))}px`;
}

// Xoá 1 hoặc nhiều hạng mục: hộp xác nhận liệt kê việc, gom theo DỰ ÁN · GIAI ĐOẠN
function taskGroupTitle(task) {
  const cal = AppState.calendars.find(c => c.id === task.calendarId);
  const owner = cal && (AppState.projectOwners || []).find(o => o.id === cal.ownerId);
  return [owner && owner.name, cal && cal.name].filter(Boolean).join(' · ') || 'Không rõ dự án';
}

async function confirmAndDeleteTasks(tasks) {
  tasks = tasks.filter(Boolean);
  if (!tasks.length) return false;
  const groups = new Map();
  tasks.forEach(t => {
    const key = taskGroupTitle(t);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t.title || '(không tên)');
  });
  const ok = await GDHomeShell.confirm({
    title: tasks.length > 1 ? `Xoá ${tasks.length} hạng mục?` : 'Xoá hạng mục?',
    message: groups.size > 1 ? `Các hạng mục thuộc ${groups.size} dự án / giai đoạn khác nhau. Ctrl+Z để hoàn tác.` : 'Ctrl+Z để hoàn tác.',
    groups: [...groups].map(([title, items]) => ({ title, items })),
    okText: tasks.length > 1 ? `Xoá ${tasks.length} mục` : 'Xoá',
    danger: true
  });
  if (!ok) return false;
  const ids = new Set(tasks.map(t => t.id));
  AppState.tasks = AppState.tasks.filter(t => !ids.has(t.id));
  if (Array.isArray(AppState.selectedTaskIds)) AppState.selectedTaskIds = AppState.selectedTaskIds.filter(id => !ids.has(id));
  syncAllFromMSProject(tasks.length > 1 ? `Đã xoá ${tasks.length} hạng mục!` : `Đã xoá "${tasks[0].title}"!`);
  return true;
}

function openTaskContextMenu(e, task) {
  if (!task) return;
  hideFloatingTooltip();
  const isActualDaysMode = task.skipSundays === false;
  const calc = calculateTaskDays(task.startDate, task.endDate, true);
  const selectedIds = Array.isArray(AppState.selectedTaskIds) ? AppState.selectedTaskIds : [];
  const isPartOfMulti = selectedIds.length > 1 && selectedIds.includes(task.id);

  showCustomContextMenu(e.clientX, e.clientY, `📋 Công việc: ${task.title}`, [
    {
      label: isActualDaysMode
        ? `🔄 Chuyển sang Ngày làm việc (${calc.workDays} ngày • Bật gạch chéo nghỉ)`
        : `📅 Tính theo Ngày thực tế (${calc.totalDays} ngày • Bỏ gạch chéo che chữ)`,
      shortcut: isActualDaysMode ? 'Đang: Thực tế' : 'Đang: Làm việc',
      onClick: () => {
        const nextSkip = isActualDaysMode ? true : false;
        if (isPartOfMulti) {
          AppState.tasks.forEach(t => {
            if (selectedIds.includes(t.id)) t.skipSundays = nextSkip;
          });
          syncAllFromMSProject(
            nextSkip
              ? `Đã chuyển ${selectedIds.length} mục đã chọn sang tính Ngày làm việc (Trừ ngày nghỉ)!`
              : `Đã chuyển ${selectedIds.length} mục đã chọn sang tính Ngày thực tế (Không gạch chéo)!`
          );
        } else {
          task.skipSundays = nextSkip;
          const newCount = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
          syncAllFromMSProject(
            nextSkip
              ? `Đã chuyển "${task.title}" sang tính Ngày làm việc (${newCount} ngày • Có gạch chéo ngày nghỉ)!`
              : `Đã chuyển "${task.title}" sang tính Ngày thực tế (${newCount} ngày • Không gạch chéo che chữ)!`
          );
        }
      }
    },
    { divider: true },
    ...buildLinkMenuItems(task, isPartOfMulti ? selectedIds : null),
    { divider: true },
    {
      label: '📑 Nhân đôi công việc (Giữ nguyên ngày)',
      shortcut: 'Nhanh',
      onClick: () => duplicateTask(task, false)
    },
    {
      label: '⏭️ Nhân đôi & nối tiếp ngày kết thúc',
      onClick: () => duplicateTask(task, true)
    },
    {
      label: '✎ Mở bảng chỉnh sửa chi tiết',
      onClick: () => openTaskModal(task)
    },
    {
      label: '🎨 Đổi sang màu kế tiếp trong Palette',
      onClick: () => {
        const pal = getActivePaletteColors();
        const idx = pal.findIndex(c => c.toLowerCase() === String(task.color || '').toLowerCase());
        task.color = pal[(idx + 1) % pal.length];
        syncAllFromMSProject(`Đã đổi màu "${task.title}"!`);
      }
    },
    { divider: true },
    {
      label: isPartOfMulti ? `🗑️ Xóa ${selectedIds.length} công việc đã chọn` : '🗑️ Xóa công việc này',
      danger: true,
      onClick: () => confirmAndDeleteTasks(isPartOfMulti
        ? AppState.tasks.filter(t => selectedIds.includes(t.id))
        : [task])
    }
  ]);
}

// =========================================================================
// MENU LIÊN KẾT TIẾN ĐỘ (Finish-to-Start)
// =========================================================================
function getTaskRowAbove(task) {
  const list = AppState.tasks.filter(t => t.calendarId === task.calendarId && t.visibleOnBoard !== false);
  const idx = list.findIndex(t => t.id === task.id);
  return idx > 0 ? list[idx - 1] : null;
}

function buildLinkMenuItems(task, multiIds) {
  const items = [];
  const preds = Array.isArray(task.predecessors) ? task.predecessors : [];
  const byId = new Map(AppState.tasks.map(t => [t.id, t]));

  if (multiIds && multiIds.length > 1) {
    const chosen = () => AppState.tasks.filter(t => multiIds.includes(t.id))
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
    items.push({
      label: `🔗 Liên kết nhóm ${multiIds.length} việc: làm lần lượt • nét đậm • xếp cạnh nhau`,
      shortcut: 'FS',
      onClick: () => linkSelectedTasksAsGroup(multiIds, 'FS')
    });
    items.push({
      label: `⇉ Liên kết nhóm ${multiIds.length} việc: bắt đầu cùng • nét đậm • xếp cạnh nhau`,
      shortcut: 'SS',
      onClick: () => linkSelectedTasksAsGroup(multiIds, 'SS')
    });
    items.push({ divider: true });
    items.push({
      label: `🔗 Nối chuỗi ${multiIds.length} việc đã chọn: làm lần lượt (FS)`,
      onClick: () => {
        const list = chosen();
        let added = 0;
        for (let i = 1; i < list.length; i++) {
          if (addPredecessorLink(list[i], list[i - 1], AppState.tasks, 'FS')) added++;
        }
        syncAllFromMSProject(added > 0 ? `Đã nối ${added} liên kết làm lần lượt!` : 'Các việc đã được nối sẵn (hoặc sẽ tạo vòng lặp).');
      }
    });
    items.push({
      label: `⇉ ${multiIds.length} việc đã chọn bắt đầu CÙNG việc đầu tiên (SS)`,
      onClick: () => {
        const list = chosen();
        let added = 0;
        for (let i = 1; i < list.length; i++) {
          if (addPredecessorLink(list[i], list[0], AppState.tasks, 'SS')) added++;
        }
        syncAllFromMSProject(added > 0 ? `Đã nối ${added} việc bắt đầu cùng "${list[0].title}"!` : 'Các việc đã được nối sẵn (hoặc sẽ tạo vòng lặp).');
      }
    });
    items.push({
      label: `✂️ Bỏ liên kết giữa ${multiIds.length} việc đã chọn`,
      onClick: () => {
        let removed = 0;
        AppState.tasks.forEach(t => {
          if (!multiIds.includes(t.id) || !Array.isArray(t.predecessors)) return;
          const before = t.predecessors.length;
          t.predecessors = t.predecessors.filter(l => !multiIds.includes(l.id));
          removed += before - t.predecessors.length;
        });
        syncAllFromMSProject(`Đã bỏ ${removed} liên kết!`);
      }
    });
    return items;
  }

  const above = getTaskRowAbove(task);
  if (above) {
    const cur = preds.find(l => l.id === above.id);
    if (!cur || cur.type === 'SS') {
      items.push({
        label: `🔗 Làm SAU khi xong: "${truncateLabel(above.title, 26)}"`,
        shortcut: 'FS',
        onClick: () => {
          if (addPredecessorLink(task, above, AppState.tasks, 'FS')) {
            syncAllFromMSProject(`Đã nối: "${task.title}" làm sau khi xong "${above.title}"`);
          } else {
            showToast('Không nối được (sẽ tạo vòng lặp liên kết).');
          }
        }
      });
    }
    if (!cur || cur.type !== 'SS') {
      items.push({
        label: `⇉ Bắt đầu CÙNG: "${truncateLabel(above.title, 26)}"`,
        shortcut: 'SS',
        onClick: () => {
          if (addPredecessorLink(task, above, AppState.tasks, 'SS')) {
            syncAllFromMSProject(`Đã nối: "${task.title}" bắt đầu cùng "${above.title}"`);
          } else {
            showToast('Không nối được (sẽ tạo vòng lặp liên kết).');
          }
        }
      });
    }
  }
  items.push({
    label: '🔗 Chọn việc liên kết phía trước…',
    shortcut: preds.length > 0 ? `${preds.length} liên kết` : '',
    onClick: () => openPredecessorPicker(task)
  });
  if (preds.length > 0) {
    items.push({
      label: '✂️ Bỏ mọi liên kết phía trước',
      onClick: () => {
        const names = preds.map(l => (byId.get(l.id) || {}).title).filter(Boolean).join(', ');
        task.predecessors = [];
        syncAllFromMSProject(`Đã bỏ liên kết của "${task.title}"${names ? ` với: ${names}` : ''}`);
      }
    });
  }
  return items;
}

// Liên kết nhóm các việc đang chọn: nối bằng nét đậm + xếp các việc đứng liền nhau
// (bỏ qua sắp xếp theo thời gian cho dự án đó; bấm "🔃 Theo ngày" để xếp lại theo thời gian)
function linkSelectedTasksAsGroup(multiIds, type = 'FS') {
  const chosen = AppState.tasks.filter(t => multiIds.includes(t.id))
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
  const byCal = new Map();
  chosen.forEach(t => {
    if (!byCal.has(t.calendarId)) byCal.set(t.calendarId, []);
    byCal.get(t.calendarId).push(t);
  });

  let linked = 0;
  let skipped = 0;
  byCal.forEach((list, calId) => {
    // 1. Nối liên kết + đánh dấu nét đậm
    for (let i = 1; i < list.length; i++) {
      const pred = type === 'SS' ? list[0] : list[i - 1];
      addPredecessorLink(list[i], pred, AppState.tasks, type);
      const link = (list[i].predecessors || []).find(l => l.id === pred.id && (l.type === 'SS' ? 'SS' : 'FS') === type);
      if (link) {
        link.emphasis = true;
        linked++;
      } else {
        skipped++;
      }
    }

    // 2. Xếp các việc trong nhóm đứng liền nhau, tại vị trí của việc đầu tiên trong nhóm
    if (list.length > 1) {
      const calTasks = AppState.tasks.filter(t => t.calendarId === calId);
      const groupSet = new Set(list);
      const firstIdx = calTasks.findIndex(t => groupSet.has(t));
      const others = calTasks.filter(t => !groupSet.has(t));
      const newOrder = [...others.slice(0, firstIdx), ...list, ...others.slice(firstIdx)];
      let k = 0;
      AppState.tasks = AppState.tasks.map(t => (t.calendarId === calId ? newOrder[k++] : t));
      const cal = AppState.calendars.find(c => c.id === calId);
      if (cal) cal.hasManualTaskOrder = true;
    }
  });

  const kind = type === 'SS' ? 'bắt đầu cùng' : 'làm lần lượt';
  syncAllFromMSProject(
    linked > 0
      ? `Đã liên kết nhóm ${chosen.length} việc (${kind}, nét đậm) và xếp cạnh nhau!${skipped ? ` • Bỏ qua ${skipped} liên kết vì tạo vòng lặp` : ''}`
      : 'Không nối được (sẽ tạo vòng lặp liên kết).'
  );
}

function truncateLabel(text, max) {
  const t = String(text || '');
  return t.length > max ? t.slice(0, max - 1) + '…' : t;
}

// Danh sách việc trong cùng dự án: bấm để đổi lần lượt  Không nối -> Làm sau (FS) -> Bắt đầu cùng (SS) -> Không nối
function openPredecessorPicker(task) {
  const preds = Array.isArray(task.predecessors) ? task.predecessors : [];
  const candidates = AppState.tasks.filter(t =>
    t.calendarId === task.calendarId && t.id !== task.id && t.visibleOnBoard !== false
  );
  const items = candidates.map(c => {
    const link = preds.find(l => l.id === c.id);
    const state = link ? (link.type === 'SS' ? 'SS' : 'FS') : null;
    const wouldCycle = !link && dependsOn(c.id, task.id, AppState.tasks);
    const mark = state === 'FS' ? '🔗' : state === 'SS' ? '⇉' : '☐';
    return {
      label: `${mark} ${truncateLabel(c.title, 36)} (${formatShortVNDate(c.startDate)} → ${formatShortVNDate(c.endDate)})`,
      shortcut: wouldCycle ? 'vòng lặp' : (state === 'FS' ? 'Làm sau' : state === 'SS' ? 'Cùng bắt đầu' : ''),
      onClick: () => {
        if (wouldCycle) {
          showToast('Không thể nối: việc này đang phụ thuộc vào việc bạn chọn (tạo vòng lặp).');
          return;
        }
        if (!state) {
          addPredecessorLink(task, c, AppState.tasks, 'FS');
          syncAllFromMSProject(`🔗 "${task.title}" làm SAU khi xong "${c.title}" (bấm lần nữa để đổi sang Bắt đầu cùng)`);
        } else if (state === 'FS') {
          addPredecessorLink(task, c, AppState.tasks, 'SS');
          syncAllFromMSProject(`⇉ "${task.title}" bắt đầu CÙNG "${c.title}" (bấm lần nữa để bỏ nối)`);
        } else {
          removePredecessorLink(task, c.id);
          syncAllFromMSProject(`Đã bỏ liên kết "${c.title}" → "${task.title}"`);
        }
        setTimeout(() => openPredecessorPicker(task), 60);
      }
    };
  });
  if (items.length === 0) {
    showToast('Dự án này chưa có việc nào khác để liên kết.');
    return;
  }
  const rect = { x: Math.round(window.innerWidth / 2 - 180), y: 110 };
  items.unshift({ label: 'ℹ️ Bấm từng việc để đổi: ☐ không nối → 🔗 làm sau khi xong → ⇉ bắt đầu cùng', onClick: () => setTimeout(() => openPredecessorPicker(task), 60) }, { divider: true });
  showCustomContextMenu(rect.x, rect.y, `🔗 Liên kết cho: "${truncateLabel(task.title, 30)}"`, items);
}

function openProjectContextMenu(e, cal) {
  if (!cal) return;
  hideFloatingTooltip();
  showCustomContextMenu(e.clientX, e.clientY, `📁 Dự án: ${cal.name}`, [
    {
      label: '📑 Nhân đôi toàn bộ dự án này',
      shortcut: '1-Click',
      onClick: () => duplicateProject(cal)
    },
    {
      label: '➕ Thêm công việc mới vào dự án',
      onClick: () => {
        AppState.activeCalendarId = cal.id;
        const calTasks = AppState.tasks.filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false);
        const maxEnd = calTasks.length > 0
          ? calTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), calTasks[0].endDate)
          : null;
        const nextStart = maxEnd ? getNextWorkingDateStr(maxEnd, true) : formatDateStr(new Date());
        openTaskModal(null, nextStart, cal.id);
      }
    },
    {
      label: '🎨 Tự nhảy màu tuần tự cho dự án này',
      onClick: () => {
        const pal = getActivePaletteColors();
        const calTasks = AppState.tasks.filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false);
        calTasks.forEach((t, idx) => {
          t.color = pal[idx % pal.length];
        });
        cal.color = pal[0];
        syncAllFromMSProject(`Đã áp dụng dải màu tuần tự cho dự án "${cal.name}"!`);
      }
    },
    {
      label: '🔃 Sắp xếp công việc theo ngày bắt đầu',
      onClick: () => {
        cal.customTaskOrder = false;
        cal.hasManualTaskOrder = false;
        const otherTasks = AppState.tasks.filter(t => t.calendarId !== cal.id);
        const calTasks = AppState.tasks
          .filter(t => t.calendarId === cal.id)
          .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));
        AppState.tasks = [...otherTasks, ...calTasks];
        syncAllFromMSProject(`Đã sắp xếp công việc trong "${cal.name}" theo thứ tự ngày!`);
      }
    },
    {
      label: '✎ Đổi tên / màu dự án',
      onClick: () => openCalendarCategoryModal(cal)
    },
    { divider: true },
    {
      label: '🗑️ Xóa dự án này',
      danger: true,
      onClick: () => deleteCalendarCategory(cal.id)
    }
  ]);
}

if (typeof document !== 'undefined') {
  document.addEventListener('click', () => hideCustomContextMenu());
  window.addEventListener('scroll', () => hideCustomContextMenu(), true);
}

// Tạo SVG gạch chéo 1 chiều dịu mắt (độ tương phản thấp) cho ô ngày nghỉ nằm giữa thanh Gantt
// Đảm bảo trên màn hình và khi Copy/Xuất ảnh PNG đồng bộ 100% và không làm khó đọc chữ
function createDayOffHatchSvg(widthPx, heightPx = 24) {
  const w = Math.max(8, Math.ceil(widthPx));
  const h = heightPx;
  let lines = '';
  for (let x = -h; x < w + h; x += 6) {
    lines += `<line x1="${x}" y1="${h}" x2="${x + h}" y2="0" stroke="rgba(255,255,255,0.34)" stroke-width="1.35" />`;
    lines += `<line x1="${x + 1.4}" y1="${h}" x2="${x + h + 1.4}" y2="0" stroke="rgba(15,23,42,0.13)" stroke-width="1.0" />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;width:100%;height:100%;pointer-events:none;"><rect width="${w}" height="${h}" fill="rgba(255,255,255,0.18)"/>${lines}</svg>`;
}


// Tính ngày kết thúc dựa trên ngày bắt đầu + số ngày làm việc (tự động nhảy qua Ngày nghỉ đã chọn, hỗ trợ cả 0.5 ngày chiều Thứ 7)

// Tìm ngày làm việc kế tiếp sau 1 ngày (nhảy qua các ngày nghỉ đã chọn)

// Đồng bộ toàn diện từ MS Project ngược về Bảng Lịch & Sidebar & Backend
function syncAllFromMSProject(toastMsg = null) {
  // saveToBackend() tự chụp trạng thái Undo (sau khi đã cập nhật độ trễ liên kết)
  syncCustomerInputWithActiveCalendar();
  saveToBackend();
  renderCalendarSidebar();
  renderCalendar(); // renderCalendar tự động gọi renderMSProjectView()
  if (toastMsg) {
    showToast(toastMsg);
  }
}

// Đo chính xác độ rộng pixel của chữ tiếng Việt trên Canvas 2D để không bao giờ bị dư khoảng trắng thừa
let _textMeasureCanvas = null;
function measureTextWidthPx(text, fontSpec) {
  if (!text) return 0;
  try {
    if (!_textMeasureCanvas && typeof document !== 'undefined') {
      _textMeasureCanvas = document.createElement('canvas');
    }
    const ctx = _textMeasureCanvas && typeof _textMeasureCanvas.getContext === 'function'
      ? _textMeasureCanvas.getContext('2d')
      : null;
    if (ctx) {
      ctx.font = fontSpec;
      return Math.ceil(ctx.measureText(String(text)).width);
    }
  } catch (_) {}
  return Math.ceil(String(text).length * 5.8);
}

// =========================================================================
// CẤU TRÚC: DỰ ÁN (projectOwners) -> GIAI ĐOẠN (calendars) -> CÔNG VIỆC (tasks)
// (Tên khoá dữ liệu giữ nguyên như cũ để không phải chuyển đổi dữ liệu)
// =========================================================================
function getProjectOfCalendar(cal) {
  if (!cal) return null;
  return AppState.projectOwners.find(o => o.id === cal.ownerId) || AppState.projectOwners[0] || null;
}

function getActiveProject() {
  return getProjectOfCalendar(getActiveCalendar());
}

// Trả về cửa sổ ngày lọc theo tuỳ chọn "Công việc 1 tuần tới" / "Công việc 2 tuần tới"
function getMspScopeDateWindow() {
  if (AppState.mspScope !== 'next-1-week' && AppState.mspScope !== 'next-2-weeks') {
    return null;
  }
  const daysCount = AppState.mspScope === 'next-1-week' ? 7 : 14;
  const startDate = new Date();
  startDate.setHours(0, 0, 0, 0);
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + daysCount - 1);
  return {
    startStr: formatDateStr(startDate),
    endStr: formatDateStr(endDate),
    daysCount
  };
}

// Danh sách giai đoạn hiển thị trên Timeline theo Phạm vi đang chọn
function getMspTargetCalendars() {
  const activeCal = getActiveCalendar();
  let list;
  if (AppState.mspScope === 'active-only' || AppState.mspScope === 'active') {
    list = activeCal ? [activeCal] : [];
  } else if (
    AppState.mspScope === 'all-visible' ||
    AppState.mspScope === 'next-1-week' ||
    AppState.mspScope === 'next-2-weeks'
  ) {
    list = AppState.calendars.filter(c => c.visible !== false);
  } else {
    // Mặc định khi chọn 'active-project': các giai đoạn (đang bật) của DỰ ÁN đang chọn
    const ownerId = activeCal ? activeCal.ownerId : null;
    list = AppState.calendars.filter(c => c.ownerId === ownerId && c.visible !== false);
  }
  if (list.length === 0 && activeCal) list = [activeCal];
  return list;
}

// Tính độ rộng cột "Hạng mục / Công việc" vừa sát khít dòng chữ dài nhất (không dư khoảng trống bên phải)
function computeTightMspNameColWidth() {
  let maxTextPx = 115;
  const targetCalendars = getMspTargetCalendars();
  const visCalIds = new Set(targetCalendars.map(c => c.id));
  const visOwnerIds = new Set(targetCalendars.map(c => c.ownerId));
  const dateWin = getMspScopeDateWindow();

  (AppState.projectOwners || []).forEach(o => {
    if (visOwnerIds.has(o.id) && o.name) {
      const w = measureTextWidthPx(
        o.name,
        '800 13px "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ) + 34;
      if (w > maxTextPx) maxTextPx = w;
    }
  });

  targetCalendars.forEach(c => {
    if (c.name) {
      const w = measureTextWidthPx(
        c.name,
        '800 12px "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ) + 32;
      if (w > maxTextPx) maxTextPx = w;
    }
  });

  AppState.tasks.forEach(t => {
    if (t.visibleOnBoard !== false && visCalIds.has(t.calendarId) && t.title) {
      if (dateWin && (t.endDate < dateWin.startStr || t.startDate > dateWin.endStr)) return;
      const w = measureTextWidthPx(
        t.title,
        '600 11.5px "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ) + 20;
      if (w > maxTextPx) maxTextPx = w;
    }
  });

  const screenCap = _mspExportRendering ? 520 : Math.max(180, Math.min(500, Math.round((window.innerWidth || 1920) * 0.22)));
  return Math.min(screenCap, Math.max(115, maxTextPx));
}

// Áp dụng độ rộng các cột kiểu Excel + trạng thái ẩn/hiện cột từ mục "ĐỀ MỤC"
function applyMspGridColumnWidths(targetPane = null, forceExportMode = false, exportNameWidth = null) {
  const pane = targetPane || document.getElementById('msp-table-pane');
  if (!pane) return;

  const vis = AppState.mspVisibility || {};
  const cw = AppState.mspColWidths || { wbs: 52, name: 240, dur: 56, start: 68, end: 68, prog: 50, act: 44 };
  const tightNameWidth = computeTightMspNameColWidth();
  const effectiveNameWidth = exportNameWidth || (AppState.userManuallyResizedNameCol ? (cw.name || tightNameWidth) : tightNameWidth);
  if (!exportNameWidth && !AppState.userManuallyResizedNameCol) {
    cw.name = tightNameWidth;
  }

  const colDefs = [
    { key: 'wbs', selector: '.col-wbs', show: vis.colWbs !== false, width: Math.max(46, cw.wbs || 52) },
    { key: 'name', selector: '.col-name', show: true, width: effectiveNameWidth },
    { key: 'dur', selector: '.col-dur', show: vis.colDur !== false, width: Math.max(48, cw.dur || 56) },
    { key: 'start', selector: '.col-start', show: vis.colDate !== false, width: Math.max(62, cw.start || 68) },
    { key: 'end', selector: '.col-end', show: vis.colDate !== false, width: Math.max(62, cw.end || 68) },
    { key: 'prog', selector: '.col-prog', show: vis.colProg !== false, width: Math.max(46, cw.prog || 50) },
    { key: 'act', selector: '.col-act', show: !forceExportMode && vis.colAct !== false, width: Math.max(42, cw.act || 44) }
  ];

  const activeWidths = colDefs.filter(c => c.show).map(c => `${c.width}px`).join(' ');
  const totalWidth = colDefs.filter(c => c.show).reduce((sum, c) => sum + c.width, 0);

  pane.style.setProperty('--msp-grid-cols', activeWidths);
  pane.style.width = `${totalWidth}px`;
  pane.style.minWidth = `${totalWidth}px`;

  colDefs.forEach(c => {
    pane.querySelectorAll(c.selector).forEach(el => {
      el.style.display = c.show ? 'flex' : 'none';
    });
  });
}

// Tự động giãn độ rộng tất cả các cột vừa sát khít nội dung chữ (Auto-fit như Excel)
function autoFitMspColumns(silent = false) {
  AppState.userManuallyResizedNameCol = false;
  const fittedNameWidth = computeTightMspNameColWidth();
  AppState.mspColWidths = {
    wbs: 52,
    name: fittedNameWidth,
    dur: 56,
    start: 68,
    end: 68,
    prog: 50,
    act: 44
  };
  applyMspGridColumnWidths();
  saveToBackend();
  if (!silent) {
    showToast(`Đã tự căn sát khít độ rộng các cột (${fittedNameWidth}px)!`);
  }
}

// Thiết lập kéo thả co giãn độ rộng từng cột (như Excel) & thanh chia đôi bảng
function setupExcelColumnResizing() {
  const header = document.getElementById('msp-table-header');
  const splitter = document.getElementById('msp-pane-splitter');
  const btnAutoFit = document.getElementById('btn-Autofit-msp-cols');

  if (btnAutoFit) {
    btnAutoFit.addEventListener('click', () => autoFitMspColumns(false));
  }

  if (header) {
    header.querySelectorAll('.msp-col-resizer').forEach(resizer => {
      const colKey = resizer.dataset.resizeCol;
      if (!colKey) return;

      // Nháy đúp vào vạch chia cột để tự động giãn vừa khít (Auto-fit như Excel)
      resizer.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        if (colKey === 'name') {
          autoFitMspColumns(false);
        } else {
          const defaults = { wbs: 52, dur: 56, start: 68, end: 68, prog: 50, act: 44 };
          AppState.mspColWidths[colKey] = defaults[colKey] || 56;
          applyMspGridColumnWidths();
          saveToBackend();
        }
      });

      resizer.tabIndex = 0;
      resizer.setAttribute('role','separator');
      resizer.setAttribute('aria-orientation','vertical');
      resizer.setAttribute('aria-label',resizer.title);
      resizer.addEventListener('keydown',event => {
        if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
        event.preventDefault();
        const minW = { wbs:42,name:110,dur:46,start:60,end:60,prog:44,act:40 }[colKey] || 42;
        const delta = event.key === 'ArrowLeft' ? -8 : 8;
        AppState.mspColWidths[colKey] = Math.max(minW,Math.min(750,(AppState.mspColWidths[colKey] || 68)+delta));
        if (colKey === 'name') AppState.userManuallyResizedNameCol = true;
        applyMspGridColumnWidths();
        saveToBackend();
      });
      resizer.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const origWidth = AppState.mspColWidths[colKey] || 68;
        const minWidths = { wbs: 42, name: 110, dur: 46, start: 60, end: 60, prog: 44, act: 40 };
        const minW = minWidths[colKey] || 42;

        resizer.classList.add('resizing');
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';

        const onMove = (ev) => {
          const dx = ev.clientX - startX;
          if (colKey === 'name') AppState.userManuallyResizedNameCol = true;
          AppState.mspColWidths[colKey] = Math.max(minW, Math.min(750, origWidth + dx));
          applyMspGridColumnWidths();
        };

        const onUp = () => {
          resizer.classList.remove('resizing');
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
          saveToBackend();
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });
    });
  }

  // Kéo thanh phân cách giữa Bảng WBS và Biểu đồ Gantt
  if (splitter) {
    splitter.addEventListener('dblclick', () => autoFitMspColumns(false));
    splitter.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      const startX = e.clientX;
      const origNameWidth = AppState.mspColWidths.name || computeTightMspNameColWidth();
      splitter.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        AppState.userManuallyResizedNameCol = true;
        AppState.mspColWidths.name = Math.max(110, Math.min(750, origNameWidth + dx));
        applyMspGridColumnWidths();
      };

      const onUp = () => {
        splitter.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        saveToBackend();
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
  }
}

// =========================================================================
// MỤC "ĐỀ MỤC & TÙY CHỈNH BẢNG" BÊN TRÁI (Tick nhảy lên bảng, bỏ tick vẫn lưu ở đây)
// =========================================================================
function renderDemucSidebar() {
  const container = document.getElementById('demuc-tasks-container');
  const colChecklist = document.getElementById('demuc-columns-checklist');
  if (colChecklist && AppState.mspVisibility) {
    colChecklist.querySelectorAll('input[type="checkbox"][data-demuc-col]').forEach(chk => {
      const key = chk.dataset.demucCol;
      chk.checked = AppState.mspVisibility[key] !== false;
    });
  }

  if (!container) return;
  container.innerHTML = '';

  const visibleCalIds = new Set(
    AppState.calendars.filter(c => c.visible !== false).map(c => c.id)
  );
  const relevantTasks = AppState.tasks.filter(t => visibleCalIds.has(t.calendarId));

  if (relevantTasks.length === 0) {
    container.innerHTML = `<div style="font-size:11px; color:#94a3b8; padding:4px;">Chưa có hạng mục nào trong lịch đang bật.</div>`;
    return;
  }

  relevantTasks.forEach(task => {
    const isChecked = task.visibleOnBoard !== false;
    const wDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
    const label = document.createElement('label');
    label.className = `demuc-task-item ${isChecked ? '' : 'is-unchecked'}`;
    label.title = isChecked
      ? `Đang hiện trên bảng: "${task.title}" (${wDays} ngày) - Bỏ tick để tạm cất khỏi bảng`
      : `Đang cất tại Đề mục: "${task.title}" - Tick vào để nhảy lên bảng ngay`;

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.checked = isChecked;
    chk.addEventListener('change', () => {
      task.visibleOnBoard = chk.checked;
      saveToBackend();
      renderDemucSidebar();
      renderCalendar();
      showToast(chk.checked
        ? `Đã đưa "${task.title}" lên bảng tiến độ!`
        : `Đã cất "${task.title}" vào danh sách Đề mục bên trái!`);
    });

    const dot = document.createElement('span');
    dot.className = 'demuc-dot';
    dot.style.background = task.color || '#cc0000';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'dt-title';
    titleSpan.textContent = task.title;

    const daysBadge = document.createElement('span');
    daysBadge.className = 'dt-days';
    daysBadge.textContent = `${wDays}N`;

    label.appendChild(chk);
    label.appendChild(dot);
    label.appendChild(titleSpan);
    label.appendChild(daysBadge);

    label.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openTaskContextMenu(e, task);
    });

    container.appendChild(label);
  });
}

function switchViewMode(mode) {
  AppState.viewMode = mode;
  const calWrapper = document.getElementById('calendar-view-wrapper');
  const mspWrapper = document.getElementById('msproject-view-wrapper');
  const workspaceWrapper = document.getElementById('workspace-wrapper');
  const btnCal = document.getElementById('btn-view-calendar');
  const btnMsp = document.getElementById('btn-view-msproject');
  const mspOptions = document.getElementById('msp-sidebar-options');

  if (mode === 'msproject') {
    if (calWrapper) calWrapper.style.display = 'none';
    if (mspWrapper) mspWrapper.style.display = 'block';
    if (workspaceWrapper) workspaceWrapper.classList.add('msp-mode-active');
    if (btnCal) btnCal.classList.remove('active');
    if (btnMsp) btnMsp.classList.add('active');
    if (mspOptions) mspOptions.style.display = 'flex';
    syncCustomerInputWithActiveCalendar();
    renderMSProjectView();
  } else {
    if (calWrapper) calWrapper.style.display = 'flex';
    if (mspWrapper) mspWrapper.style.display = 'none';
    if (workspaceWrapper) workspaceWrapper.classList.remove('msp-mode-active');
    if (btnCal) btnCal.classList.add('active');
    if (btnMsp) btnMsp.classList.remove('active');
    if (mspOptions) mspOptions.style.display = 'none';
    syncCustomerInputWithActiveCalendar();
    renderCalendar();
  }
}

function setupMSProjectEvents() {
  const btnCal = document.getElementById('btn-view-calendar');
  const btnMsp = document.getElementById('btn-view-msproject');
  const scopeSelect = document.getElementById('msp-scope-select');
  const zoomBtns = document.querySelectorAll('.msp-zoom-btn');
  const rowHeightBtns = document.querySelectorAll('.msp-row-height-btn');
  const mspFooterNote = document.getElementById('msp-footer-note-text');
  const mspMonthInput = document.getElementById('msp-month-input');
  const mspCustomerInput = document.getElementById('msp-customer-input');
  const btnImportMsp = document.getElementById('btn-import-msproject');
  const inputImportMsp = document.getElementById('input-import-msproject');
  const btnExportMsp = document.getElementById('btn-export-msproject');
  const btnDemucCheckAll = document.getElementById('btn-demuc-check-all');

  if (btnCal) {
    btnCal.addEventListener('click', () => {
      switchViewMode('calendar');
      saveToBackend();
    });
  }
  if (btnMsp) {
    btnMsp.addEventListener('click', () => {
      switchViewMode('msproject');
      saveToBackend();
    });
  }
  if (scopeSelect) {
    scopeSelect.value = AppState.mspScope || 'all-visible';
    scopeSelect.addEventListener('change', (e) => {
      AppState.mspScope = e.target.value;
      saveToBackend();
      renderMSProjectView();
    });
  }
  zoomBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      zoomBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.mspZoom = btn.dataset.zoom || 'normal';
      saveToBackend();
      renderMSProjectView();
    });
  });

  // Tùy chọn độ cao dòng/cột (Thấp | Chuẩn | Cao) tương tự độ rộng cột
  rowHeightBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rowHeightBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.mspRowHeight = btn.dataset.rowHeight || 'mini';
      saveToBackend();
      applyMspRowHeightStyles();
      renderMSProjectView();
    });
  });

  // Độ đậm chữ toàn bảng Timeline (Nhạt | Thường | Đậm | Rất đậm)
  document.querySelectorAll('.msp-font-weight-btn[data-font-weight]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.msp-font-weight-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.mspFontWeight = btn.dataset.fontWeight || 'normal';
      saveToBackend();
      applyMspFontWeight();
    });
  });

  // Sự kiện tick/bỏ tick các mục/cột trong phần "ĐỀ MỤC & TÙY CHỈNH BẢNG" bên trái
  document.querySelectorAll('#demuc-columns-checklist input[type="checkbox"][data-demuc-col]').forEach(chk => {
    chk.addEventListener('change', () => {
      const colKey = chk.dataset.demucCol;
      if (!AppState.mspVisibility) AppState.mspVisibility = {};
      AppState.mspVisibility[colKey] = chk.checked;
      saveToBackend();
      renderMSProjectView();
    });
  });

  if (btnDemucCheckAll) {
    btnDemucCheckAll.addEventListener('click', () => {
      AppState.tasks.forEach(t => { t.visibleOnBoard = true; });
      saveToBackend();
      renderDemucSidebar();
      renderCalendar();
      showToast('Đã đưa toàn bộ các hạng mục công việc lên bảng!');
    });
  }

  // Mở & Xuất file định dạng Microsoft Project (.xml, .csv, .json)
  if (btnImportMsp && inputImportMsp) {
    btnImportMsp.addEventListener('click', () => {
      inputImportMsp.value = '';
      inputImportMsp.click();
    });
    inputImportMsp.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        importMSProjectFile(file);
      }
    });
  }

  if (btnExportMsp) {
    btnExportMsp.addEventListener('click', () => {
      exportMSProjectXMLFile();
    });
  }

  const btnExportJsonBackup = document.getElementById('btn-export-json-backup');
  if (btnExportJsonBackup) {
    btnExportJsonBackup.addEventListener('click', () => {
      const payload = buildServerPayload();
      const custName = (getCurrentCustomerName() || 'GD_HOME').replace(/[^\w\d_-]+/g, '_');
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sao_Luu_Tien_Do_${custName}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('✅ Đã xuất file JSON sao lưu tiến độ thành công!');
    });
  }

  // Đồng bộ sửa Tháng lập bảng trên Header MS Project <-> Bảng Lịch
  if (mspMonthInput) {
    mspMonthInput.addEventListener('input', () => {
      setManualScheduleMonth(mspMonthInput.value);
      const calMonthInput = document.getElementById('schedule-month-input');
      if (calMonthInput) calMonthInput.value = getAutoScheduleMonth();
      saveToBackend();
    });
  }

  // Nút sắp xếp nhanh toàn bộ công việc theo thứ tự ngày bắt đầu
  const btnSortByDate = document.getElementById('btn-msp-sort-by-date');
  if (btnSortByDate) {
    btnSortByDate.addEventListener('click', (e) => {
      e.stopPropagation();
      sortAllTasksChronologically(true); // bỏ cả thứ tự tự xếp (nhóm liên kết) -> xếp lại theo ngày
      syncAllFromMSProject('Đã sắp xếp toàn bộ công việc theo thứ tự ngày bắt đầu!');
    });
  }

  // Nút Hoàn tác (Undo) và Làm lại (Redo)
  const btnUndo = document.getElementById('btn-undo-action');
  if (btnUndo) {
    btnUndo.addEventListener('click', () => undoLastAction());
  }
  const btnRedo = document.getElementById('btn-redo-action');
  if (btnRedo) {
    btnRedo.addEventListener('click', () => redoLastAction());
  }
  window.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.value !== '') return;
      e.preventDefault();
      undoLastAction();
    } else if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement.value !== '') return;
      e.preventDefault();
      redoLastAction();
    }
  });

  // Phím Esc: đóng lần lượt lớp nổi trên cùng (menu chuột phải → menu thả → bảng tạo nhanh → hộp thoại → chế độ cắt) rồi bỏ chọn công việc
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (handleEscapeKey()) e.preventDefault();
  });

  // Checkbox Chọn / Bỏ chọn tất cả công việc trên bảng WBS
  const chkSelectAll = document.getElementById('msp-select-all-tasks');
  if (chkSelectAll) {
    chkSelectAll.addEventListener('change', (e) => {
      const visibleTasks = getVisibleTasks();
      if (e.target.checked) {
        AppState.selectedTaskIds = visibleTasks.map(t => t.id);
      } else {
        AppState.selectedTaskIds = [];
      }
      renderMSProjectView();
    });
  }

  // Các nút trên thanh trạng thái Đang chọn nhiều việc (#msp-multisel-bar)
  const btnMultiPrev = document.getElementById('btn-multisel-shift-prev');
  const btnMultiNext = document.getElementById('btn-multisel-shift-next');
  const btnMultiClear = document.getElementById('btn-multisel-clear');
  document.getElementById('btn-multisel-duplicate').onclick = () => {
    const selected = new Set(AppState.selectedTaskIds);
    const tasks = AppState.tasks.filter(task => selected.has(task.id));
    if (!tasks.length) return;
    tasks.forEach(task => duplicateTask(task,false,false));
    syncAllFromMSProject('Đã nhân bản ' + tasks.length + ' công việc.');
  };

  if (btnMultiPrev) {
    btnMultiPrev.addEventListener('click', () => shiftMultiSelectedTasksByCalendarDays(-1));
  }
  if (btnMultiNext) {
    btnMultiNext.addEventListener('click', () => shiftMultiSelectedTasksByCalendarDays(1));
  }
  if (btnMultiClear) {
    btnMultiClear.addEventListener('click', () => {
      AppState.selectedTaskIds = [];
      renderMSProjectView();
    });
  }

  // Đồng bộ sửa Tên DỰ ÁN trên Header MS Project <-> Bảng Lịch & Sidebar & WBS Cấp 1
  if (mspCustomerInput) {
    mspCustomerInput.addEventListener('input', () => {
      const activeProj = getTitleProject('msproject') || getActiveProject();
      if (activeProj) {
        renameProjectAndSync(activeProj, mspCustomerInput.value);
      }
      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
    });
  }

  // Các nút Thêm nhanh (+ 3D, + CHỈNH SỬA 3D, + HSKT, + Tuỳ chỉnh) ở đáy bảng MS Project
  document.querySelectorAll('#msp-quick-toolbar .msp-qt-btn[data-prefix]').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix;
      const color = btn.dataset.color;
      quickAppendStageToCalendar(getActiveCalendar().id, prefix, color, 10);
    });
  });

  const btnMspAddCustom = document.getElementById('btn-msp-add-custom');
  if (btnMspAddCustom) {
    btnMspAddCustom.addEventListener('click', () => {
      const activeCal = getActiveCalendar();
      const calTasks = AppState.tasks.filter(t => t.calendarId === activeCal.id && t.visibleOnBoard !== false);
      let nextStart = formatDateStr(new Date());
      if (calTasks.length > 0) {
        const maxEnd = calTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), calTasks[0].endDate);
        nextStart = getNextWorkingDateStr(maxEnd, true);
      }
      openTaskModal(null, nextStart, activeCal.id);
    });
  }

  if (mspFooterNote) {
    mspFooterNote.addEventListener('blur', (e) => {
      AppState.footerNote = e.target.textContent.trim();
      const calFooterNote = document.getElementById('footer-note-text');
      if (calFooterNote) calFooterNote.textContent = AppState.footerNote;
      saveToBackend();
    });
  }

  setupExcelColumnResizing();
}

// Hàm thêm nhanh 1 giai đoạn nối tiếp vào lịch dự án ngay trong MS Project
function quickAppendStageToCalendar(calId, stagePrefix, stageColor, defaultWorkingDays = 10) {
  const cal = AppState.calendars.find(c => c.id === calId) || getActiveCalendar();
  cal.visible = true;
  AppState.activeCalendarId = cal.id;

  const calTasks = AppState.tasks.filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false);
  let startStr = formatDateStr(new Date());
  let lastTask = null;
  if (calTasks.length > 0) {
    lastTask = calTasks.reduce((m, t) => (t.endDate > m.endDate ? t : m), calTasks[0]);
    const maxEnd = lastTask.endDate;
    startStr = getNextWorkingDateStr(maxEnd, true);
  } else {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    startStr = formatDateStr(new Date(sy, sm - 1, 1));
  }

  const endStr = computeEndDateByWorkingDays(startStr, defaultWorkingDays, true);
  const custSuffix = (cal.name && cal.name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG') ? ` - ${cal.name}` : '';
  const fullTitle = `${stagePrefix}${custSuffix}`;
  const effectiveColor = AppState.colorPaletteTheme && AppState.colorPaletteTheme !== 'default'
    ? getNextSequentialPaletteColor(cal.id)
    : stageColor;

  AppState.tasks.push({
    id: 'task_' + Date.now(),
    calendarId: cal.id,
    title: fullTitle,
    startDate: startStr,
    endDate: endStr,
    color: effectiveColor,
    skipSundays: true,
    showCount: true,
    visibleOnBoard: true,
    progress: 0,
    note: '',
    predecessors: lastTask ? [{ id: lastTask.id, type: 'FS', lag: 0 }] : []
  });

  syncAllFromMSProject(`Đã thêm "${fullTitle}" (${defaultWorkingDays} ngày làm việc) và đồng bộ sang Bảng Lịch!`);
}

function formatShortVNDate(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
}

function formatDayMonthVN(dateStr) {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}`;
}

function getDatesBetween(startDateStr, endDateStr) {
  const dates = [];
  const curr = parseDateStr(startDateStr);
  const end = parseDateStr(endDateStr);
  while (curr <= end) {
    dates.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

function diffDaysInclusive(startDateStr, endDateStr) {
  const s = parseDateStr(startDateStr);
  const e = parseDateStr(endDateStr);
  return Math.round((e - s) / 86400000) + 1;
}

function diffDaysFromStart(timelineStartStr, targetDateStr) {
  const s = parseDateStr(timelineStartStr);
  const t = parseDateStr(targetDateStr);
  return Math.round((t - s) / 86400000);
}

// Biến lưu trạng thái kéo thả (Drag & Drop) giữa các Dự án và Công việc trong MS Project
let _mspDragPayload = null;
let _lastClickedTaskIdForShift = null;

// Cập nhật thanh trạng thái Đang chọn nhiều việc (#msp-multisel-bar) & ô checkbox chọn tất cả
function updateMultiSelectBarUI(allVisibleTasks = []) {
  if (!Array.isArray(AppState.selectedTaskIds)) AppState.selectedTaskIds = [];
  const validTaskIds = new Set(AppState.tasks.map(t => t.id));
  AppState.selectedTaskIds = AppState.selectedTaskIds.filter(id => validTaskIds.has(id));

  const bar = document.getElementById('msp-multisel-bar');
  const countText = document.getElementById('msp-multisel-count-text');
  const chkSelectAll = document.getElementById('msp-select-all-tasks');

  if (bar) {
    bar.style.display = AppState.selectedTaskIds.length > 0 ? 'flex' : 'none';
  }
  if (countText) {
    countText.textContent = String(AppState.selectedTaskIds.length);
  }
  if (chkSelectAll && allVisibleTasks.length > 0) {
    const selectedVisibleCount = allVisibleTasks.filter(t => AppState.selectedTaskIds.includes(t.id)).length;
    chkSelectAll.checked = selectedVisibleCount > 0 && selectedVisibleCount === allVisibleTasks.length;
    chkSelectAll.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < allVisibleTasks.length;
  } else if (chkSelectAll) {
    chkSelectAll.checked = false;
    chkSelectAll.indeterminate = false;
  }
}

// Dịch chuyển đồng thời toàn bộ các công việc đang được tick chọn theo số ngày lịch (+/- deltaDays)
function shiftMultiSelectedTasksByCalendarDays(deltaDays) {
  if (!Array.isArray(AppState.selectedTaskIds) || AppState.selectedTaskIds.length === 0) return;
  const delta = parseInt(deltaDays, 10) || 0;
  if (delta === 0) return;

  let count = 0;
  AppState.tasks.forEach(t => {
    if (AppState.selectedTaskIds.includes(t.id)) {
      const preserveWorkDays = Math.max(0.5, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false));
      const ns = parseDateStr(t.startDate);
      ns.setDate(ns.getDate() + delta);
      const newStart = formatDateStr(ns);
      t.startDate = newStart;
      t.endDate = computeEndDateByWorkingDays(newStart, preserveWorkDays, t.skipSundays !== false);
      count++;
    }
  });

  if (count > 0) {
    if (AppState.autoCascadeShift !== false) propagateLinkedTasks(AppState.selectedTaskIds.slice(), AppState.tasks);
    syncAllFromMSProject(`Đã dịch đồng thời ${count} công việc đã chọn (${delta > 0 ? '+' : ''}${delta} ngày)!`);
  }
}

function renderMSProjectView() {
  const mspWrapper = document.getElementById('msproject-view-wrapper');
  if (!mspWrapper) return;

  const tableBody = document.getElementById('msp-table-body');
  const ganttMonthsRow = document.getElementById('msp-gantt-months-row');
  const ganttDaysRow = document.getElementById('msp-gantt-days-row');
  const ganttGridBg = document.getElementById('msp-gantt-grid-bg');
  const ganttRowsLayer = document.getElementById('msp-gantt-rows-layer');
  const ganttSvg = document.getElementById('msp-dependency-svg');
  const ganttBody = document.getElementById('msp-gantt-body');
  const kpiSummary = document.getElementById('msp-kpi-summary');
  const mspMonthInput = document.getElementById('msp-month-input');
  const mspTitlePrefixInput = document.getElementById('msp-title-prefix-input');
  const mspCustomerInput = document.getElementById('msp-customer-input');
  const mspFooterNote = document.getElementById('msp-footer-note-text');

  if (!tableBody || !ganttMonthsRow || !ganttDaysRow) return;

  applyMspRowHeightStyles();
  document.querySelectorAll('.msp-zoom-btn[data-zoom]').forEach(b => b.classList.toggle('active', b.dataset.zoom === String(AppState.mspZoom || 'normal')));
  document.querySelectorAll('.msp-row-height-btn[data-row-height]').forEach(b => b.classList.toggle('active', b.dataset.rowHeight === String(AppState.mspRowHeight || 'normal')));

  if (mspMonthInput && document.activeElement !== mspMonthInput) {
    mspMonthInput.value = getAutoScheduleMonth();
  }
  if (mspTitlePrefixInput && document.activeElement !== mspTitlePrefixInput) {
    mspTitlePrefixInput.textContent = scheduleTextValue('mspCustomTitlePrefix');
  }
  renderScheduleText();
  syncCustomerInputWithActiveCalendar(); // tên dự án trên tiêu đề theo dự án đang hiển thị
  if (mspFooterNote && document.activeElement !== mspFooterNote) {
    mspFooterNote.textContent = AppState.footerNote || '';
  }

  const vis = AppState.mspVisibility || {};

  // 1. Xác định danh sách dự án hiển thị (normalizeAppState tự động sắp xếp công việc theo thứ tự ngày)
  normalizeAppState();
  let targetCalendars = getMspTargetCalendars();
  const scopeDateWin = getMspScopeDateWindow();

  // 2. Gom nhóm công việc
  let projectGroups = targetCalendars.map((cal, idx) => {
    const calTasks = AppState.tasks
      .filter(t => {
        if (t.calendarId !== cal.id || t.visibleOnBoard === false) return false;
        if (scopeDateWin) {
          return t.endDate >= scopeDateWin.startStr && t.startDate <= scopeDateWin.endStr;
        }
        return true;
      });

    let minStart = null;
    let maxEnd = null;
    let totalWorkDays = 0;
    let weightedProgressSum = 0;

    calTasks.forEach(t => {
      if (!minStart || t.startDate < minStart) minStart = t.startDate;
      if (!maxEnd || t.endDate > maxEnd) maxEnd = t.endDate;
      const wDays = countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false);
      const prog = typeof t.progress === 'number' ? t.progress : 0;
      totalWorkDays += wDays;
      weightedProgressSum += wDays * prog;
    });

    totalWorkDays = Math.round(totalWorkDays * 10) / 10;
    const overallWorkDays = (minStart && maxEnd) ? countWorkingDays(minStart, maxEnd, true) : 0;
    const totalActualDays = (minStart && maxEnd) ? diffDaysInclusive(minStart, maxEnd) : 0;
    const avgProgress = totalWorkDays > 0 ? Math.round(weightedProgressSum / totalWorkDays) : 0;

    return {
      cal,
      wbsIndex: idx + 1,
      tasks: calTasks,
      minStart,
      maxEnd,
      overallWorkDays,
      totalWorkDays,
      totalActualDays,
      avgProgress
    };
  });

  if (scopeDateWin) {
    const nonEmpty = projectGroups.filter(pg => pg.tasks.length > 0);
    if (nonEmpty.length > 0) {
      projectGroups = nonEmpty;
    }
  }

  // 3. Xác định khoảng ngày toàn cục của biểu đồ Gantt
  let globalMinDate = null;
  let globalMaxDate = null;
  const allVisibleTasks = [];

  projectGroups.forEach(pg => {
    pg.tasks.forEach(t => {
      allVisibleTasks.push(t);
      if (!globalMinDate || t.startDate < globalMinDate) globalMinDate = t.startDate;
      if (!globalMaxDate || t.endDate > globalMaxDate) globalMaxDate = t.endDate;
    });
  });

  updateMultiSelectBarUI(allVisibleTasks);

  const todayStr = formatDateStr(new Date());
  if (scopeDateWin) {
    if (!globalMinDate || scopeDateWin.startStr < globalMinDate) {
      globalMinDate = scopeDateWin.startStr;
    }
    if (!globalMaxDate || scopeDateWin.endStr > globalMaxDate) {
      globalMaxDate = scopeDateWin.endStr;
    }
    const padEnd = parseDateStr(globalMaxDate);
    padEnd.setDate(padEnd.getDate() + 2);
    globalMaxDate = formatDateStr(padEnd);
  } else if (!globalMinDate || !globalMaxDate) {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const sDate = new Date(sy, sm - 1, 1);
    const eDate = new Date(sy, sm, 0);
    globalMinDate = formatDateStr(sDate);
    globalMaxDate = formatDateStr(eDate);
  } else {
    // Bắt đầu ngay từ ngày đầu tiên có công việc (không đệm ngày trống ở đầu)
    // Kết thúc chỉ đệm đúng 3 ngày để hiển thị gọn nhãn ngày của công việc cuối cùng
    const padEnd = parseDateStr(globalMaxDate);
    padEnd.setDate(padEnd.getDate() + 3);
    globalMaxDate = formatDateStr(padEnd);
  }

  const colWidth = getMspColWidth();
  // Kéo dài trục ngày cho kín bề ngang vùng Gantt (màn hình siêu rộng không bị khoảng trắng,
  // và luôn có ngày trống phía sau để quét chọn tạo việc mới)
  {
    const ganttScrollEl = ganttBody ? (ganttBody.closest('.msp-gantt-scroll, .msp-gantt-pane, .msp-gantt-side') || ganttBody.parentElement) : null;
    const availW = (ganttScrollEl && !_mspExportRendering) ? ganttScrollEl.clientWidth : 0;
    if (availW > 0) {
      const minDays = Math.ceil(availW / colWidth) + 1;
      const curDays = diffDaysInclusive(globalMinDate, globalMaxDate);
      if (curDays < minDays) {
        const padEnd2 = parseDateStr(globalMinDate);
        padEnd2.setDate(padEnd2.getDate() + minDays - 1);
        globalMaxDate = formatDateStr(padEnd2);
      }
    }
  }
  const timelineDates = getDatesBetween(globalMinDate, globalMaxDate);
  _mspTimelineInfo = { startDate: globalMinDate, count: timelineDates.length, colWidth };
  const totalTimelineWidth = Math.max(colWidth * 5, timelineDates.length * colWidth);

  // 4. Render KPI Summary Pills
  renderMspKpiSummary(kpiSummary, allVisibleTasks, projectGroups);

  // 6. Render Header Tháng & Ngày bên khung Gantt
  renderMspDayHeaders(ganttMonthsRow, ganttDaysRow, timelineDates, colWidth, totalTimelineWidth, todayStr);

  // 7. Render các dòng trong bảng WBS (Trái) & các dòng thanh Gantt (Phải)
  tableBody.innerHTML = '';
  ganttRowsLayer.innerHTML = '';
  ganttGridBg.innerHTML = '';
  ganttSvg.innerHTML = '';

  const rowRecords = [];
  let currentRowIndex = 0;
  const ROW_HEIGHT = getMspRowHeightPx();
  const BAR_HEIGHT = Math.max(18, Math.min(38, ROW_HEIGHT - 16));

  // Hàm gắn thanh kéo chỉnh độ cao dòng trực tiếp ở đáy mỗi hàng (như Excel)
  const attachRowHeightResizer = (rowEl) => {
    const rowResizer = document.createElement('div');
    rowResizer.className = 'msp-row-resizer';
    rowResizer.title = 'Kéo lên/xuống để chỉnh độ cao dòng (Nháy đúp để về chuẩn 42px)';
    rowResizer.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      AppState.mspRowHeight = 'normal';
      document.querySelectorAll('.msp-row-height-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.rowHeight === 'normal');
      });
      saveToStorage();
      applyMspRowHeightStyles();
      renderMSProjectView();
    });
    rowResizer.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      const startY = e.clientY;
      const origH = getMspRowHeightPx();
      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const onMove = (ev) => {
        const dy = ev.clientY - startY;
        AppState.mspRowHeight = Math.max(22, Math.min(76, origH + dy));
        document.querySelectorAll('.msp-row-height-btn').forEach(b => b.classList.remove('active'));
        applyMspRowHeightStyles();
      };
      const onUp = () => {
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        saveToStorage();
        renderMSProjectView();
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    });
    rowEl.appendChild(rowResizer);
  };

  // ===== CẤP 1: DỰ ÁN (quản lý) -> CẤP 2: GIAI ĐOẠN -> CẤP 3: CÔNG VIỆC =====
  if (!AppState.collapsedMspOwners) AppState.collapsedMspOwners = {};
  const ownerGroupsForRender = [];
  AppState.projectOwners.forEach(owner => {
    const groups = projectGroups.filter(pg => (pg.cal.ownerId || AppState.projectOwners[0].id) === owner.id);
    if (groups.length > 0) ownerGroupsForRender.push({ owner, groups });
  });
  ownerGroupsForRender.forEach((og, oIdx) => {
    og.groups.forEach((pg, gIdx) => { pg.wbsIndex = `${oIdx + 1}.${gIdx + 1}`; });
  });

  ownerGroupsForRender.forEach((og, oIdx) => {
    renderMspProjectHeaderRow(og, oIdx, { tableBody, ganttRowsLayer, globalMinDate, colWidth, totalTimelineWidth });
    currentRowIndex++;
    if (AppState.collapsedMspOwners[og.owner.id]) return;
    og.groups.forEach(pg => {
    const isCollapsed = !!AppState.collapsedProjects[pg.cal.id];
    const startDisp = pg.minStart ? formatShortVNDate(pg.minStart) : '--/--/--';
    const endDisp = pg.maxEnd ? formatShortVNDate(pg.maxEnd) : '--/--/--';
    const projTaskIds = pg.tasks.map(t => t.id);
    const allProjSelected = projTaskIds.length > 0 && projTaskIds.every(id => AppState.selectedTaskIds.includes(id));

    // --- DÒNG SUMMARY CỦA DỰ ÁN (WBS Cấp 1) ---
    const sumRowEl = document.createElement('div');
    sumRowEl.className = 'msp-tr summary-row';
    sumRowEl.dataset.calId = pg.cal.id;
    sumRowEl.draggable = true;

    sumRowEl.innerHTML = `
      <div class="msp-td col-wbs" title="Tick để chọn toàn bộ việc trong dự án này • Kéo để đổi vị trí Dự án">
        <input type="checkbox" class="msp-row-select-chk msp-proj-select-chk" ${allProjSelected ? 'checked' : ''} title="Chọn / bỏ chọn toàn bộ công việc trong dự án này">
        <span class="msp-drag-grip">⋮⋮</span>${pg.wbsIndex}
      </div>
      <div class="msp-td col-name">
        <button type="button" class="msp-project-toggle" title="Thu gọn / Mở rộng dự án">${isCollapsed ? '▶' : '▼'}</button>
        <span class="msp-task-dot" style="background:${escapeHtml(pg.cal.color)}; border-radius:50%;"></span>
        <input type="text" class="msp-inline-project-input" value="${escapeHtml(pg.cal.name)}" title="Gõ để đổi tên Khách hàng / Dự án (Chuột phải để Nhân đôi dự án)">
      </div>
      <div class="msp-td col-dur msp-summary-dur-cell" title="Từ ${startDisp} đến ${endDisp}:&#10;• ${pg.totalActualDays} ngày thực tế (tính cả ngày nghỉ)&#10;• ${pg.overallWorkDays} ngày làm việc (= ngày thực tế trừ ngày nghỉ)">
        <span class="msp-summary-dur-work">${pg.overallWorkDays} LV</span>
        <span class="msp-summary-dur-act">${pg.totalActualDays} TT</span>
      </div>
      <div class="msp-td col-date col-start">
        <div class="msp-date-cell-wrap proj-start-wrap" title="Bấm để đổi Ngày Bắt Đầu của cả Dự án (Tự động dịch toàn bộ các mục theo, giữ nguyên ngày làm việc)">
          <span class="msp-date-display-text">${startDisp}</span>
          <input type="date" class="msp-clean-date-picker msp-proj-start-input" value="${pg.minStart || ''}">
        </div>
      </div>
      <div class="msp-td col-date col-end">
        <div class="msp-date-cell-wrap proj-end-wrap" title="Bấm để đổi Ngày Kết Thúc của cả Dự án (Tự động dịch toàn bộ các mục theo, giữ nguyên ngày làm việc)">
          <span class="msp-date-display-text">${endDisp}</span>
          <input type="date" class="msp-clean-date-picker msp-proj-end-input" value="${pg.maxEnd || ''}">
        </div>
      </div>
      <div class="msp-td col-prog">
        <span class="msp-prog-badge ${pg.avgProgress === 100 ? 'msp-prog-100' : pg.avgProgress > 0 ? 'msp-prog-mid' : 'msp-prog-0'}">${pg.avgProgress}%</span>
      </div>
      <div class="msp-td col-act">
        <button type="button" class="msp-quick-add-btn" title="Thêm công việc mới vào dự án này">+ Việc</button>
      </div>
    `;

    attachRowHeightResizer(sumRowEl);

    // Không cho kéo row khi đang gõ chữ trong ô input
    sumRowEl.querySelectorAll('input, button, select').forEach(inp => {
      inp.addEventListener('mousedown', (ev) => ev.stopPropagation());
    });

    const projSelectChk = sumRowEl.querySelector('.msp-proj-select-chk');
    if (projSelectChk) {
      projSelectChk.addEventListener('change', (e) => {
        e.stopPropagation();
        if (e.target.checked) {
          projTaskIds.forEach(id => {
            if (!AppState.selectedTaskIds.includes(id)) AppState.selectedTaskIds.push(id);
          });
        } else {
          AppState.selectedTaskIds = AppState.selectedTaskIds.filter(id => !projTaskIds.includes(id));
        }
        renderMSProjectView();
      });
    }

    // Chuột phải vào dòng Dự án -> Mở menu Nhân đôi dự án
    sumRowEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProjectContextMenu(e, pg.cal);
    });

    // Kéo thả Giai đoạn nhảy qua nhau (hoặc sang Dự án khác) hoặc nhận Công việc từ giai đoạn/dự án khác thả vào
    sumRowEl.addEventListener('dragstart', (e) => {
      _mspDragPayload = { type: 'project', calId: pg.cal.id, fromOwnerId: pg.cal.ownerId };
      sumRowEl.classList.add('is-dragging');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', `project:${pg.cal.id}`);
      }
    });
    sumRowEl.addEventListener('dragend', () => {
      sumRowEl.classList.remove('is-dragging');
      tableBody.querySelectorAll('.drop-target-above, .drop-target-below, .drop-target-into').forEach(el => {
        el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
      });
    });
    sumRowEl.addEventListener('dragover', (e) => {
      if (!_mspDragPayload) return;
      e.preventDefault();
      sumRowEl.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
      if (_mspDragPayload.type === 'project' && _mspDragPayload.calId !== pg.cal.id) {
        const rect = sumRowEl.getBoundingClientRect();
        const isAfter = (e.clientY - rect.top) > rect.height / 2;
        sumRowEl.classList.add(isAfter ? 'drop-target-below' : 'drop-target-above');
      } else if (_mspDragPayload.type === 'task') {
        sumRowEl.classList.add('drop-target-into');
      }
    });
    sumRowEl.addEventListener('dragleave', () => {
      sumRowEl.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
    });
    sumRowEl.addEventListener('drop', (e) => {
      e.preventDefault();
      sumRowEl.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
      if (!_mspDragPayload) return;

      if (_mspDragPayload.type === 'project' && _mspDragPayload.calId !== pg.cal.id) {
        const fromIdx = AppState.calendars.findIndex(c => c.id === _mspDragPayload.calId);
        const toIdx = AppState.calendars.findIndex(c => c.id === pg.cal.id);
        if (fromIdx !== -1 && toIdx !== -1) {
          const rect = sumRowEl.getBoundingClientRect();
          const insertAfter = (e.clientY - rect.top) > rect.height / 2;
          const [movedCal] = AppState.calendars.splice(fromIdx, 1);
          movedCal.ownerId = pg.cal.ownerId;
          const newTargetIdx = AppState.calendars.findIndex(c => c.id === pg.cal.id);
          AppState.calendars.splice(insertAfter ? newTargetIdx + 1 : newTargetIdx, 0, movedCal);
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã di chuyển giai đoạn "${movedCal.name}" sang vị trí mới!`);
        }
      } else if (_mspDragPayload.type === 'task') {
        const idsToMove = Array.isArray(_mspDragPayload.taskIds) && _mspDragPayload.taskIds.length > 0
          ? _mspDragPayload.taskIds
          : [_mspDragPayload.taskId];
        const movedTasks = AppState.tasks.filter(t => idsToMove.includes(t.id));
        if (movedTasks.length > 0) {
          AppState.tasks = AppState.tasks.filter(t => !idsToMove.includes(t.id));
          movedTasks.forEach(t => { t.calendarId = pg.cal.id; });
          pg.cal.hasManualTaskOrder = true;
          pg.cal.customTaskOrder = true;
          // Chèn vào cuối danh sách việc của giai đoạn đích
          let lastIdx = -1;
          for (let i = AppState.tasks.length - 1; i >= 0; i--) {
            if (AppState.tasks[i].calendarId === pg.cal.id) {
              lastIdx = i;
              break;
            }
          }
          if (lastIdx !== -1) {
            AppState.tasks.splice(lastIdx + 1, 0, ...movedTasks);
          } else {
            AppState.tasks.push(...movedTasks);
          }
          AppState.collapsedProjects[pg.cal.id] = false;
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã chuyển ${movedTasks.length} công việc sang giai đoạn "${pg.cal.name}"!`);
        }
      }
    });

    sumRowEl.querySelector('.msp-project-toggle').addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.collapsedProjects[pg.cal.id] = !AppState.collapsedProjects[pg.cal.id];
      renderMSProjectView();
    });

    const projNameInput = sumRowEl.querySelector('.msp-inline-project-input');
    projNameInput.addEventListener('focus', () => {
      AppState.activeCalendarId = pg.cal.id;
      renderCalendarSidebar();
      syncCustomerInputWithActiveCalendar();
    });
    projNameInput.addEventListener('change', () => {
      const newName = projNameInput.value.trim();
      if (newName) {
        AppState.activeCalendarId = pg.cal.id;
        renameCalendarAndSyncTasks(pg.cal, newName);
        syncAllFromMSProject(`Đã đổi tên dự án thành "${pg.cal.name}" và đồng bộ sang Bảng Lịch!`);
      }
    });
    projNameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        projNameInput.blur();
      }
    });

    // Sửa Ngày bắt đầu của cả Dự án -> Tự động dịch toàn bộ các mục trong dự án theo
    const projStartWrap = sumRowEl.querySelector('.proj-start-wrap');
    const projStartInput = sumRowEl.querySelector('.msp-proj-start-input');
    if (projStartWrap && projStartInput) {
      projStartWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof projStartInput.showPicker === 'function') {
          try { projStartInput.showPicker(); } catch (_) { projStartInput.focus(); }
        } else {
          projStartInput.focus();
        }
      });
      projStartInput.addEventListener('change', () => {
        if (!projStartInput.value) return;
        const count = shiftEntireProjectToStartDate(pg.cal.id, projStartInput.value);
        syncAllFromMSProject(`Đã dời ngày bắt đầu dự án "${pg.cal.name}" sang ${formatShortVNDate(projStartInput.value)} (Tự động dịch ${count} hạng mục, giữ nguyên ngày làm việc)!`);
      });
    }

    // Sửa Ngày kết thúc của cả Dự án -> Tự động dịch toàn bộ các mục trong dự án theo
    const projEndWrap = sumRowEl.querySelector('.proj-end-wrap');
    const projEndInput = sumRowEl.querySelector('.msp-proj-end-input');
    if (projEndWrap && projEndInput) {
      projEndWrap.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof projEndInput.showPicker === 'function') {
          try { projEndInput.showPicker(); } catch (_) { projEndInput.focus(); }
        } else {
          projEndInput.focus();
        }
      });
      projEndInput.addEventListener('change', () => {
        if (!projEndInput.value) return;
        const count = shiftEntireProjectToEndDate(pg.cal.id, projEndInput.value);
        syncAllFromMSProject(`Đã dời ngày kết thúc dự án "${pg.cal.name}" sang ${formatShortVNDate(projEndInput.value)} (Tự động dịch ${count} hạng mục, giữ nguyên ngày làm việc)!`);
      });
    }

    sumRowEl.querySelector('.msp-quick-add-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      AppState.activeCalendarId = pg.cal.id;
      const nextStart = pg.maxEnd ? getNextWorkingDateStr(pg.maxEnd, true) : formatDateStr(new Date());
      openTaskModal(null, nextStart, pg.cal.id);
    });

    tableBody.appendChild(sumRowEl);

    // Dòng Gantt bên phải cho Summary Row
    const gRowSum = document.createElement('div');
    gRowSum.className = 'msp-gantt-row summary-row';
    gRowSum.dataset.calId = pg.cal.id;
    gRowSum.style.width = `${totalTimelineWidth}px`;
    gRowSum.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProjectContextMenu(e, pg.cal);
    });

    if (pg.minStart && pg.maxEnd) {
      const startIdx = diffDaysFromStart(globalMinDate, pg.minStart);
      const durDays = diffDaysInclusive(pg.minStart, pg.maxEnd);
      const leftPx = startIdx * colWidth + 2;
      const widthPx = Math.max(12, durDays * colWidth - 4);

      const sumBar = document.createElement('div');
      sumBar.className = 'msp-summary-bar';
      sumBar.style.left = `${leftPx}px`;
      sumBar.style.width = `${widthPx}px`;
      sumBar.title = `${pg.cal.name}: ${startDisp} → ${endDisp} (${pg.overallWorkDays} ngày làm việc • Chuột phải để Nhân đôi dự án)`;

      const sumLabel = document.createElement('div');
      sumLabel.className = 'msp-summary-label';
      sumLabel.textContent = `${pg.cal.name} (${pg.overallWorkDays} ngày LV • ${pg.totalActualDays} ngày TT${mspShowProgress() ? ` • ${pg.avgProgress}%` : ''})`;
      sumBar.appendChild(sumLabel);

      gRowSum.appendChild(sumBar);
    }

    ganttRowsLayer.appendChild(gRowSum);
    currentRowIndex++;

    // --- CÁC DÒNG CÔNG VIỆC CON (WBS 1.1, 1.2...) ---
    if (!isCollapsed) {
      pg.tasks.forEach((task, tIdx) => {
        const wbsCode = `${pg.wbsIndex}.${tIdx + 1}`;
        const isActualDaysMode = task.skipSundays === false;
        const workDays = countWorkingDays(task.startDate, task.endDate, !isActualDaysMode);
        const taskProg = typeof task.progress === 'number' ? task.progress : 0;
        const isTaskSelected = Array.isArray(AppState.selectedTaskIds) && AppState.selectedTaskIds.includes(task.id);

        const taskRowEl = document.createElement('div');
        taskRowEl.className = `msp-tr task-row ${isTaskSelected ? 'is-multiselected' : ''}`;
        taskRowEl.dataset.taskId = task.id;
        taskRowEl.dataset.calId = pg.cal.id;
        taskRowEl.draggable = true;

        const progressOptions = [0, 10, 25, 50, 75, 90, 100].map(val =>
          `<option value="${val}" ${taskProg === val ? 'selected' : ''}>${val}%</option>`
        ).join('');

        taskRowEl.innerHTML = `
          <div class="msp-td col-wbs" title="Tick chọn nhiều việc để kéo di chuyển đồng thời • Kéo thả để đổi thứ tự hoặc nhảy sang dự án khác">
            <input type="checkbox" class="msp-row-select-chk msp-task-select-chk" ${isTaskSelected ? 'checked' : ''} title="Tick chọn nhiều việc (Hoặc giữ Shift/Ctrl + Click)">
            <span class="msp-drag-grip">⋮⋮</span>${wbsCode}
          </div>
          <div class="msp-td col-name">
            <span class="msp-task-dot" style="background:${escapeHtml(task.color)}; cursor:pointer;" title="Bấm để đổi màu hoặc mở chi tiết"></span>
            <input type="text" class="msp-inline-title-input" value="${escapeHtml(task.title)}" title="${escapeHtml(task.title)} (Gõ để sửa • Chuột phải để Nhân đôi / Chuyển Ngày thực tế)">
          </div>
          <div class="msp-td col-dur">
            <div class="msp-inline-dur-wrap">
              <input type="number" min="0.5" max="365" step="0.5" class="msp-inline-dur-input" value="${workDays}" title="Nhập số ngày (${isActualDaysMode ? 'Ngày thực tế' : 'Ngày làm việc'}) -> Tự động tính ngày kết thúc">
              <span class="msp-dur-unit ${isActualDaysMode ? 'is-actual-days' : ''}" title="${isActualDaysMode ? 'Đang tính Ngày thực tế (Gồm cả ngày nghỉ • Chuột phải để đổi)' : 'Đang tính Ngày làm việc (Trừ ngày nghỉ • Chuột phải để đổi)'}">${isActualDaysMode ? 'thực' : 'ng'}</span>
            </div>
          </div>
          <div class="msp-td col-date col-start">
            <div class="msp-date-cell-wrap start-wrap" title="Bấm vào để chọn Ngày Bắt Đầu (Tự động giữ số ngày & dịch các mục sau)">
              <span class="msp-date-display-text">${formatShortVNDate(task.startDate)}</span>
              <input type="date" class="msp-clean-date-picker msp-start-input" value="${task.startDate}">
            </div>
          </div>
          <div class="msp-td col-date col-end">
            <div class="msp-date-cell-wrap end-wrap" title="Bấm vào để chọn Ngày Kết Thúc (Tự động dịch các mục sau)">
              <span class="msp-date-display-text">${formatShortVNDate(task.endDate)}</span>
              <input type="date" class="msp-clean-date-picker msp-end-input" value="${task.endDate}">
            </div>
          </div>
          <div class="msp-td col-prog">
            <select class="msp-progress-select ${taskProg === 100 ? 'is-done' : ''}" title="Cập nhật % tiến độ">
              ${progressOptions}
            </select>
          </div>
          <div class="msp-td col-act">
            <button type="button" class="msp-row-icon-btn edit" title="Mở bảng chỉnh sửa đầy đủ">✎</button>
            <button type="button" class="msp-row-icon-btn del" title="Xóa hạng mục này">×</button>
          </div>
        `;

        if (typeof decorateMaterialBadge === 'function') decorateMaterialBadge(taskRowEl);
        attachRowHeightResizer(taskRowEl);

        taskRowEl.querySelectorAll('input, button, select').forEach(inp => {
          inp.addEventListener('mousedown', (ev) => ev.stopPropagation());
        });

        // Xử lý chọn nhiều công việc bằng Checkbox hoặc giữ Shift/Ctrl + Click
        const handleToggleTaskSelection = (checkedState, isShiftKey = false) => {
          if (!Array.isArray(AppState.selectedTaskIds)) AppState.selectedTaskIds = [];
          if (isShiftKey && _lastClickedTaskIdForShift && _lastClickedTaskIdForShift !== task.id) {
            const visIds = allVisibleTasks.map(t => t.id);
            const idxA = visIds.indexOf(_lastClickedTaskIdForShift);
            const idxB = visIds.indexOf(task.id);
            if (idxA !== -1 && idxB !== -1) {
              const [from, to] = idxA < idxB ? [idxA, idxB] : [idxB, idxA];
              for (let k = from; k <= to; k++) {
                if (!AppState.selectedTaskIds.includes(visIds[k])) {
                  AppState.selectedTaskIds.push(visIds[k]);
                }
              }
            }
          } else {
            if (checkedState) {
              if (!AppState.selectedTaskIds.includes(task.id)) AppState.selectedTaskIds.push(task.id);
            } else {
              AppState.selectedTaskIds = AppState.selectedTaskIds.filter(id => id !== task.id);
            }
          }
          _lastClickedTaskIdForShift = task.id;
          renderMSProjectView();
        };

        const rowSelectChk = taskRowEl.querySelector('.msp-task-select-chk');
        if (rowSelectChk) {
          rowSelectChk.addEventListener('click', (e) => {
            e.stopPropagation();
            handleToggleTaskSelection(e.target.checked, e.shiftKey);
          });
        }

        // Hỗ trợ giữ Ctrl/Cmd hoặc Shift + Click vào dòng để chọn nhanh nhiều việc
        taskRowEl.addEventListener('click', (e) => {
          if (e.ctrlKey || e.metaKey || e.shiftKey) {
            e.preventDefault();
            e.stopPropagation();
            const nextState = !AppState.selectedTaskIds.includes(task.id);
            handleToggleTaskSelection(nextState, e.shiftKey);
          }
        });

        // Chuột phải vào dòng Công việc -> Mở menu chuột phải (Chuyển Ngày thực tế / Nhân đôi)
        taskRowEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openTaskContextMenu(e, task);
        });

        // Kéo thả Công việc nhảy qua lại giữa các hàng hoặc nhảy sang Dự án khác (hỗ trợ kéo nhiều việc đã chọn cùng lúc)
        taskRowEl.addEventListener('dragstart', (e) => {
          const multiIds = (Array.isArray(AppState.selectedTaskIds) && AppState.selectedTaskIds.includes(task.id) && AppState.selectedTaskIds.length > 1)
            ? [...AppState.selectedTaskIds]
            : [task.id];
          _mspDragPayload = { type: 'task', taskId: task.id, taskIds: multiIds, fromCalId: pg.cal.id };
          taskRowEl.classList.add('is-dragging');
          if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', `task:${task.id}`);
          }
        });
        taskRowEl.addEventListener('dragend', () => {
          taskRowEl.classList.remove('is-dragging');
          tableBody.querySelectorAll('.drop-target-above, .drop-target-below, .drop-target-into').forEach(el => {
            el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
          });
        });
        taskRowEl.addEventListener('dragover', (e) => {
          if (!_mspDragPayload) return;
          e.preventDefault();
          taskRowEl.classList.remove('drop-target-above', 'drop-target-below');
          const rect = taskRowEl.getBoundingClientRect();
          const isAfter = (e.clientY - rect.top) > rect.height / 2;
          taskRowEl.classList.add(isAfter ? 'drop-target-below' : 'drop-target-above');
        });
        taskRowEl.addEventListener('dragleave', () => {
          taskRowEl.classList.remove('drop-target-above', 'drop-target-below');
        });
        taskRowEl.addEventListener('drop', (e) => {
          e.preventDefault();
          taskRowEl.classList.remove('drop-target-above', 'drop-target-below');
          if (!_mspDragPayload) return;

          const rect = taskRowEl.getBoundingClientRect();
          const insertAfter = (e.clientY - rect.top) > rect.height / 2;

          if (_mspDragPayload.type === 'task' && _mspDragPayload.taskId !== task.id) {
            const idsToMove = Array.isArray(_mspDragPayload.taskIds) && _mspDragPayload.taskIds.length > 0
              ? _mspDragPayload.taskIds
              : [_mspDragPayload.taskId];
            if (!idsToMove.includes(task.id)) {
              const movedTasks = AppState.tasks.filter(t => idsToMove.includes(t.id));
              AppState.tasks = AppState.tasks.filter(t => !idsToMove.includes(t.id));
              movedTasks.forEach(mt => { mt.calendarId = pg.cal.id; });
              pg.cal.customTaskOrder = true;
              pg.cal.hasManualTaskOrder = true;
              const targetIdx = AppState.tasks.findIndex(t => t.id === task.id);
              if (targetIdx !== -1) {
                AppState.tasks.splice(insertAfter ? targetIdx + 1 : targetIdx, 0, ...movedTasks);
              } else {
                AppState.tasks.push(...movedTasks);
              }
              _mspDragPayload = null;
              syncAllFromMSProject(
                movedTasks.length > 1
                  ? `Đã di chuyển đồng thời ${movedTasks.length} công việc sang "${pg.cal.name}"!`
                  : `Đã di chuyển công việc "${movedTasks[0].title}" sang "${pg.cal.name}"!`
              );
            }
          } else if (_mspDragPayload.type === 'project' && _mspDragPayload.calId !== pg.cal.id) {
            const fromIdx = AppState.calendars.findIndex(c => c.id === _mspDragPayload.calId);
            if (fromIdx !== -1) {
              const [movedCal] = AppState.calendars.splice(fromIdx, 1);
              movedCal.ownerId = pg.cal.ownerId;
              const newTargetIdx = AppState.calendars.findIndex(c => c.id === pg.cal.id);
              AppState.calendars.splice(insertAfter ? newTargetIdx + 1 : newTargetIdx, 0, movedCal);
              _mspDragPayload = null;
              syncAllFromMSProject(`Đã di chuyển giai đoạn "${movedCal.name}"!`);
            }
          }
        });

        // 1) Click vào chấm màu hoặc nút ✎ để mở Modal đầy đủ
        taskRowEl.querySelector('.msp-task-dot').addEventListener('click', () => openTaskModal(task));
        taskRowEl.querySelector('.msp-row-icon-btn.edit').addEventListener('click', () => openTaskModal(task));

        // 2) Nút × xóa nhanh công việc
        taskRowEl.querySelector('.msp-row-icon-btn.del').addEventListener('click', () => {
          // Đang chọn nhiều việc (gồm việc này) -> xoá cả nhóm
          const sel = Array.isArray(AppState.selectedTaskIds) ? AppState.selectedTaskIds : [];
          confirmAndDeleteTasks(sel.length > 1 && sel.includes(task.id) ? AppState.tasks.filter(t => sel.includes(t.id)) : [task]);
        });

        // 3) Sửa trực tiếp Tên công việc
        const titleInput = taskRowEl.querySelector('.msp-inline-title-input');
        titleInput.addEventListener('change', () => {
          const val = titleInput.value.trim();
          if (val && val !== task.title) {
            task.title = val;
            if (/^3D\b/i.test(val)) task.color = '#cc0000';
            else if (/^CHỈNH SỬA 3D\b/i.test(val)) task.color = '#f57c00';
            else if (/^HSKT\b/i.test(val)) task.color = '#2e7d32';
            syncAllFromMSProject(`Đã cập nhật tên "${task.title}"!`);
          }
        });
        titleInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            titleInput.blur();
          }
        });

        // 4) Sửa trực tiếp Số ngày -> Tự động tính lại Ngày kết thúc & dịch các mục sau!
        const durInput = taskRowEl.querySelector('.msp-inline-dur-input');
        durInput.addEventListener('change', () => {
          const oldStart = task.startDate;
          const oldEnd = task.endDate;
          const newDays = Math.max(0.5, parseFloat(durInput.value) || 1);
          task.endDate = computeEndDateByWorkingDays(task.startDate, newDays, task.skipSundays !== false);
          const shifted = cascadeShiftSubsequentTasks(task, oldStart, oldEnd);
          syncAllFromMSProject(`Đã đổi "${task.title}" thành ${newDays} ngày (Kết thúc: ${formatShortVNDate(task.endDate)}${shifted > 0 ? ` • Tự động dịch ${shifted} mục sau` : ''})!`);
        });
        durInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            durInput.blur();
          }
        });

        // 5) Ô Ngày bắt đầu & Ngày kết thúc
        const startWrap = taskRowEl.querySelector('.start-wrap');
        const startInput = taskRowEl.querySelector('.msp-start-input');
        startWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof startInput.showPicker === 'function') {
            try { startInput.showPicker(); } catch (_) { startInput.focus(); }
          } else {
            startInput.focus();
          }
        });
        startInput.addEventListener('change', () => {
          const newStart = startInput.value;
          if (!newStart) return;
          const oldStart = task.startDate;
          const oldEnd = task.endDate;
          task.startDate = newStart;
          task.endDate = computeEndDateByWorkingDays(newStart, workDays, task.skipSundays !== false);
          const shifted = cascadeShiftSubsequentTasks(task, oldStart, oldEnd);
          syncAllFromMSProject(`Đã dời ngày bắt đầu "${task.title}" → ${formatShortVNDate(task.startDate)} (Giữ nguyên ${workDays} ngày${shifted > 0 ? ` • Tự động dịch ${shifted} mục sau` : ''})!`);
        });

        const endWrap = taskRowEl.querySelector('.end-wrap');
        const endInput = taskRowEl.querySelector('.msp-end-input');
        endWrap.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof endInput.showPicker === 'function') {
            try { endInput.showPicker(); } catch (_) { endInput.focus(); }
          } else {
            endInput.focus();
          }
        });
        endInput.addEventListener('change', () => {
          const newEnd = endInput.value;
          if (!newEnd) return;
          if (newEnd < task.startDate) {
            GDHomeShell.alert('Ngày kết thúc không được nhỏ hơn ngày bắt đầu!');
            endInput.value = task.endDate;
            return;
          }
          const oldStart = task.startDate;
          const oldEnd = task.endDate;
          task.endDate = newEnd;
          const updatedDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
          const shifted = cascadeShiftSubsequentTasks(task, oldStart, oldEnd);
          syncAllFromMSProject(`Đã đổi ngày kết thúc "${task.title}" → ${formatShortVNDate(task.endDate)} (${updatedDays} ngày${shifted > 0 ? ` • Tự động dịch ${shifted} mục sau` : ''})!`);
        });

        // 6) Sửa trực tiếp % Tiến độ
        const progSelect = taskRowEl.querySelector('.msp-progress-select');
        progSelect.addEventListener('change', (e) => {
          task.progress = parseInt(e.target.value, 10) || 0;
          syncAllFromMSProject(`Đã cập nhật tiến độ "${task.title}" → ${task.progress}%`);
        });

        tableBody.appendChild(taskRowEl);

        // --- DÒNG GANTT BÊN PHẢI TƯƠNG ỨNG ---
        const gRowTask = document.createElement('div');
        gRowTask.className = 'msp-gantt-row';
        gRowTask.dataset.calId = pg.cal.id;
        gRowTask.dataset.taskId = task.id;
        gRowTask.style.width = `${totalTimelineWidth}px`;

        const startIdx = diffDaysFromStart(globalMinDate, task.startDate);
        const durDays = diffDaysInclusive(task.startDate, task.endDate);
        const leftPx = startIdx * colWidth + 2;
        const widthPx = Math.max(18, durDays * colWidth - 4);

        const taskBar = document.createElement('div');
        taskBar.className = `msp-task-bar ${isTaskSelected ? 'is-multiselected' : ''}`;
        taskBar.dataset.taskId = task.id;
        taskBar.style.left = `${leftPx}px`;
        taskBar.style.width = `${widthPx}px`;
        taskBar.style.background = task.color || '#cc0000';
        taskBar.style.color = getContrastTextColor(task.color || '#cc0000');
        const modeLabel = isActualDaysMode ? 'ngày thực tế (gồm cả ngày nghỉ)' : 'ngày làm việc';
        taskBar.title = `${task.title}\nTừ: ${formatShortVNDate(task.startDate)} đến ${formatShortVNDate(task.endDate)} (${workDays} ${modeLabel})${mspShowProgress() ? `\nTiến độ: ${taskProg}%` : ''}\n(Kéo để dời ngày, Chuột phải để chuyển đổi Ngày thực tế / Ngày làm việc hoặc Nhân đôi)`;

        taskBar.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openTaskContextMenu(e, task);
        });

        if (taskProg > 0 && mspShowProgress()) {
          const progFill = document.createElement('div');
          progFill.className = 'msp-task-progress-fill';
          progFill.style.width = `${taskProg}%`;
          taskBar.appendChild(progFill);
        }

        // Chỉ vẽ ô gạch chéo ngày nghỉ khi công việc đang tính theo Ngày làm việc (task.skipSundays !== false)
        if (!isActualDaysMode) {
          const taskDates = getDatesBetween(task.startDate, task.endDate);
          taskDates.forEach((d, dOffset) => {
            const offInfo = isDateDayOff(d, true);
            if (offInfo.isOff) {
              const sunCut = document.createElement('div');
              sunCut.className = 'msp-sunday-cutout';
              sunCut.style.left = `${dOffset * colWidth - 1}px`;
              sunCut.style.width = `${colWidth}px`;
              sunCut.title = `${offInfo.reason} (Không tính vào số ngày làm việc)`;
              sunCut.innerHTML = createDayOffHatchSvg(colWidth, BAR_HEIGHT);
              taskBar.appendChild(sunCut);
            } else if (offInfo.isHalfOff) {
              // Nghỉ chiều Thứ 7 (0.5 ngày): chỉ gạch chéo nửa bên phải (buổi chiều) của ô Thứ 7
              const halfW = Math.max(8, Math.ceil(colWidth / 2));
              const halfLeft = dOffset * colWidth + Math.floor(colWidth / 2) - 1;
              const halfCut = document.createElement('div');
              halfCut.className = 'msp-sunday-cutout is-half-day-cutout';
              halfCut.style.left = `${halfLeft}px`;
              halfCut.style.width = `${halfW}px`;
              halfCut.title = `${offInfo.reason}`;
              halfCut.innerHTML = createDayOffHatchSvg(halfW, BAR_HEIGHT);
              taskBar.appendChild(halfCut);
            }
          });
        }

        const handleL = document.createElement('div');
        handleL.className = 'msp-gantt-handle left';
        handleL.title = 'Kéo sang trái/phải để đổi ngày Bắt đầu';
        const handleR = document.createElement('div');
        handleR.className = 'msp-gantt-handle right';
        handleR.title = 'Kéo sang trái/phải để đổi ngày Kết thúc';
        taskBar.appendChild(handleL);
        taskBar.appendChild(handleR);

        const innerLabel = document.createElement('div');
        innerLabel.className = 'msp-task-bar-label';
        innerLabel.style.color = getContrastTextColor(task.color || '#cc0000');
        innerLabel.textContent = `${task.title} (${workDays} ngày)`;
        taskBar.appendChild(innerLabel);

        const outsideLabel = document.createElement('div');
        outsideLabel.className = 'msp-task-outside-label';
        outsideLabel.textContent = `${formatDayMonthVN(task.startDate)} - ${formatDayMonthVN(task.endDate)} (${workDays}N)`;
        taskBar.appendChild(outsideLabel);

        setupGanttBarDragAndClick(taskBar, handleL, handleR, task, colWidth);

        gRowTask.appendChild(taskBar);
        ganttRowsLayer.appendChild(gRowTask);

        rowRecords.push({
          calId: pg.cal.id,
          task,
          rowIndex: currentRowIndex,
          leftPx,
          rightPx: leftPx + widthPx,
          centerY: currentRowIndex * ROW_HEIGHT + (ROW_HEIGHT / 2)
        });

        currentRowIndex++;
      });
    }
  });
  });

  // Áp dụng độ rộng cột hiện tại & ẩn/hiện cột theo ĐỀ MỤC
  applyMspGridColumnWidths();
  renderDemucSidebar();

  // 8. Dựng lớp nền lưới dọc (Ngày lễ, Chủ Nhật, Chiều Thứ 7, Đường kẻ Đỏ HÔM NAY)
  const totalBodyHeight = Math.max(220, currentRowIndex * ROW_HEIGHT);
  renderMspGridBackground(ganttBody, ganttGridBg, timelineDates, colWidth, totalTimelineWidth, totalBodyHeight, todayStr);

  // 9. Vẽ mũi tên liên kết Finish-to-Start (FS) & Start-to-Start (SS) chuẩn Microsoft Project
  renderMspDependencyArrows(ganttSvg, rowRecords, ROW_HEIGHT, totalTimelineWidth, totalBodyHeight, vis);

  if (window.lucide) {
    window.lucide.createIcons();
  }  applyMspFontWeight();
  scheduleStickyHeaders();
}

function renderMspKpiSummary(kpiSummary, allVisibleTasks, projectGroups) {
  if (!kpiSummary) return;
  const totalTasksCount = allVisibleTasks.length;
  const totalCalCount = projectGroups.length;
  let firstTaskStart = null;
  let lastTaskEnd = null;
  allVisibleTasks.forEach(t => {
    if (!firstTaskStart || t.startDate < firstTaskStart) firstTaskStart = t.startDate;
    if (!lastTaskEnd || t.endDate > lastTaskEnd) lastTaskEnd = t.endDate;
  });
  const spanWorkDays = (firstTaskStart && lastTaskEnd) ? countWorkingDays(firstTaskStart, lastTaskEnd, true) : 0;
  const spanActualDays = (firstTaskStart && lastTaskEnd) ? diffDaysInclusive(firstTaskStart, lastTaskEnd) : 0;

  kpiSummary.innerHTML = `
    <div class="msp-kpi-pill">
      <span>Giai đoạn:</span>
      <strong>${totalCalCount}</strong>
    </div>
    <div class="msp-kpi-pill">
      <span>Hạng mục:</span>
      <strong>${totalTasksCount} việc</strong>
    </div>
    <div class="msp-kpi-pill" title="Ngày làm việc (LV) = ngày thực tế (TT) trừ ngày nghỉ, tính từ ngày bắt đầu sớm nhất đến ngày kết thúc muộn nhất">
      <span>Tổng:</span>
      <strong>${spanWorkDays} ngày LV</strong>
      <span class="msp-kpi-sep">•</span>
      <strong class="msp-kpi-sub">${spanActualDays} ngày TT</strong>
    </div>
    ${firstTaskStart && lastTaskEnd ? `
    <div class="msp-kpi-pill">
      <span>Lộ trình:</span>
      <strong>${formatShortVNDate(firstTaskStart)} → ${formatShortVNDate(lastTaskEnd)}</strong>
    </div>` : ''}
  `;
}

function renderMspDayHeaders(ganttMonthsRow, ganttDaysRow, timelineDates, colWidth, totalTimelineWidth, todayStr) {
  ganttMonthsRow.innerHTML = '';
  ganttDaysRow.innerHTML = '';
  ganttMonthsRow.style.width = `${totalTimelineWidth}px`;
  ganttDaysRow.style.width = `${totalTimelineWidth}px`;

  const monthBuckets = [];
  timelineDates.forEach(d => {
    const ymKey = `${d.getFullYear()}-${d.getMonth() + 1}`;
    const label = `THÁNG ${d.getMonth() + 1} / ${d.getFullYear()}`;
    if (monthBuckets.length === 0 || monthBuckets[monthBuckets.length - 1].key !== ymKey) {
      monthBuckets.push({ key: ymKey, label, count: 1 });
    } else {
      monthBuckets[monthBuckets.length - 1].count++;
    }
  });

  monthBuckets.forEach(mb => {
    const mCell = document.createElement('div');
    mCell.className = 'msp-gantt-month-cell';
    mCell.style.width = `${mb.count * colWidth}px`;
    mCell.textContent = mb.label;
    ganttMonthsRow.appendChild(mCell);
  });

  const dowNames = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  timelineDates.forEach(d => {
    const dStr = formatDateStr(d);
    const dow = d.getDay();
    const offInfo = isDateDayOff(d, true);
    const lunarInfo = AppState.showLunarDates !== false ? getLunarDateDisplay(d) : { text: '', isFirst: false };

    const dCell = document.createElement('div');
    dCell.className = 'msp-gantt-day-cell';
    if (d.getDate() === 1) dCell.classList.add('is-month-first');
    if (offInfo.type === 'sunday' || offInfo.type === 'saturday') dCell.classList.add('is-sunday');
    if (offInfo.type === 'saturday-half') dCell.classList.add('is-saturday-half');
    if (offInfo.type === 'holiday') dCell.classList.add('is-holiday');
    if (offInfo.type === 'makeup-work' || offInfo.type === 'custom-work') dCell.classList.add('is-makeup-work');
    if (dStr === todayStr) dCell.classList.add('is-today');
    dCell.style.width = `${colWidth}px`;
    if (offInfo.reason) dCell.title = offInfo.reason;
    dCell.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openDayOverrideContextMenu(e, dStr);
    });

    dCell.innerHTML = `
      <div class="msp-day-top-line">
        <span class="msp-solar-num">${String(d.getDate()).padStart(2, '0')}</span>
        ${lunarInfo.text ? `<span class="msp-lunar-mini ${lunarInfo.isFirst ? 'is-first' : ''}">${lunarInfo.text}</span>` : ''}
      </div>
      <span style="font-size:8px; opacity:0.82;">${dowNames[dow]}</span>
    `;
    ganttDaysRow.appendChild(dCell);
  });
}

function renderMspProjectHeaderRow(og, oIdx, ctx) {
  const { tableBody, ganttRowsLayer, globalMinDate, colWidth, totalTimelineWidth } = ctx;
  const owner = og.owner;
  const isOwnerCollapsed = !!AppState.collapsedMspOwners[owner.id];
  let pMin = null;
  let pMax = null;
  let wSum = 0;
  let pSum = 0;
  og.groups.forEach(pg => {
    if (pg.minStart && (!pMin || pg.minStart < pMin)) pMin = pg.minStart;
    if (pg.maxEnd && (!pMax || pg.maxEnd > pMax)) pMax = pg.maxEnd;
    wSum += pg.totalWorkDays;
    pSum += pg.totalWorkDays * pg.avgProgress;
  });
  const pLV = (pMin && pMax) ? countWorkingDays(pMin, pMax, true) : 0;
  const pTT = (pMin && pMax) ? diffDaysInclusive(pMin, pMax) : 0;
  const pProg = wSum > 0 ? Math.round(pSum / wSum) : 0;
  const pStartDisp = pMin ? formatShortVNDate(pMin) : '--/--/--';
  const pEndDisp = pMax ? formatShortVNDate(pMax) : '--/--/--';

  const rowEl = document.createElement('div');
  rowEl.className = 'msp-tr project-row';
  rowEl.dataset.ownerId = owner.id;
  rowEl.draggable = true;
  rowEl.innerHTML = `
    <div class="msp-td col-wbs" title="Dự án (Kéo thả công việc hoặc giai đoạn vào đây để chuyển sang dự án này)"><span class="msp-drag-grip">⋮⋮</span>${oIdx + 1}</div>
    <div class="msp-td col-name">
      <button type="button" class="msp-project-toggle msp-owner-toggle" title="Thu gọn / Mở rộng dự án">${isOwnerCollapsed ? '▶' : '▼'}</button>
      <span class="msp-project-icon">📁</span>
      <input type="text" class="msp-inline-owner-input" value="${escapeHtml(owner.name)}" title="Tên DỰ ÁN (gõ để đổi tên và đồng bộ tiêu đề Bảng Lịch & Timeline)">
    </div>
    <div class="msp-td col-dur msp-summary-dur-cell" title="Từ ${pStartDisp} đến ${pEndDisp}:&#10;• ${pTT} ngày thực tế&#10;• ${pLV} ngày làm việc (= ngày thực tế trừ ngày nghỉ)">
      <span class="msp-summary-dur-work">${pLV} LV</span>
      <span class="msp-summary-dur-act">${pTT} TT</span>
    </div>
    <div class="msp-td col-date col-start"><span class="msp-date-display-text">${pStartDisp}</span></div>
    <div class="msp-td col-date col-end"><span class="msp-date-display-text">${pEndDisp}</span></div>
    <div class="msp-td col-prog">
      <span class="msp-prog-badge ${pProg === 100 ? 'msp-prog-100' : pProg > 0 ? 'msp-prog-mid' : 'msp-prog-0'}">${pProg}%</span>
    </div>
    <div class="msp-td col-act">
      <button type="button" class="msp-quick-add-btn msp-add-stage-btn" title="Thêm giai đoạn mới vào dự án này">+ GĐ</button>
    </div>
  `;
  rowEl.querySelectorAll('input, button').forEach(el => el.addEventListener('mousedown', ev => ev.stopPropagation()));
  rowEl.querySelector('.msp-owner-toggle').addEventListener('click', () => {
    AppState.collapsedMspOwners[owner.id] = !isOwnerCollapsed;
    renderMSProjectView();
  });

  // Hỗ trợ kéo thả DỰ ÁN nhảy qua nhau, hoặc thả GIAI ĐOẠN / CÔNG VIỆC từ dự án khác vào DỰ ÁN này
  rowEl.addEventListener('dragstart', (e) => {
    _mspDragPayload = { type: 'owner', ownerId: owner.id };
    rowEl.classList.add('is-dragging');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', `owner:${owner.id}`);
    }
  });
  rowEl.addEventListener('dragend', () => {
    rowEl.classList.remove('is-dragging');
    tableBody.querySelectorAll('.drop-target-above, .drop-target-below, .drop-target-into').forEach(el => {
      el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
    });
  });
  rowEl.addEventListener('dragover', (e) => {
    if (!_mspDragPayload) return;
    e.preventDefault();
    rowEl.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
    if (_mspDragPayload.type === 'owner' && _mspDragPayload.ownerId !== owner.id) {
      const rect = rowEl.getBoundingClientRect();
      const isAfter = (e.clientY - rect.top) > rect.height / 2;
      rowEl.classList.add(isAfter ? 'drop-target-below' : 'drop-target-above');
    } else if (_mspDragPayload.type === 'project' || _mspDragPayload.type === 'task') {
      rowEl.classList.add('drop-target-into');
    }
  });
  rowEl.addEventListener('dragleave', () => {
    rowEl.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
  });
  rowEl.addEventListener('drop', (e) => {
    e.preventDefault();
    rowEl.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
    if (!_mspDragPayload) return;

    if (_mspDragPayload.type === 'owner' && _mspDragPayload.ownerId !== owner.id) {
      const fromIdx = AppState.projectOwners.findIndex(o => o.id === _mspDragPayload.ownerId);
      const toIdx = AppState.projectOwners.findIndex(o => o.id === owner.id);
      if (fromIdx !== -1 && toIdx !== -1) {
        const rect = rowEl.getBoundingClientRect();
        const insertAfter = (e.clientY - rect.top) > rect.height / 2;
        const [movedOwner] = AppState.projectOwners.splice(fromIdx, 1);
        const newTargetIdx = AppState.projectOwners.findIndex(o => o.id === owner.id);
        AppState.projectOwners.splice(insertAfter ? newTargetIdx + 1 : newTargetIdx, 0, movedOwner);
        _mspDragPayload = null;
        syncAllFromMSProject(`Đã di chuyển dự án "${movedOwner.name}"!`);
      }
    } else if (_mspDragPayload.type === 'project') {
      const movedCal = AppState.calendars.find(c => c.id === _mspDragPayload.calId);
      if (movedCal) {
        movedCal.ownerId = owner.id;
        AppState.collapsedMspOwners[owner.id] = false;
        _mspDragPayload = null;
        syncAllFromMSProject(`Đã chuyển giai đoạn "${movedCal.name}" sang dự án "${owner.name}"!`);
      }
    } else if (_mspDragPayload.type === 'task') {
      let targetCal = AppState.calendars.find(c => c.ownerId === owner.id && c.visible !== false)
        || AppState.calendars.find(c => c.ownerId === owner.id);
      if (!targetCal) {
        const pal = getActivePaletteColors();
        targetCal = {
          id: 'cal_' + Date.now(),
          ownerId: owner.id,
          name: 'GIAI ĐOẠN 1',
          customerName: 'GIAI ĐOẠN 1',
          color: pal[AppState.calendars.length % pal.length],
          visible: true
        };
        AppState.calendars.push(targetCal);
      }
      const idsToMove = Array.isArray(_mspDragPayload.taskIds) && _mspDragPayload.taskIds.length > 0
        ? _mspDragPayload.taskIds
        : [_mspDragPayload.taskId];
      const movedTasks = AppState.tasks.filter(t => idsToMove.includes(t.id));
      if (movedTasks.length > 0) {
        AppState.tasks = AppState.tasks.filter(t => !idsToMove.includes(t.id));
        movedTasks.forEach(t => { t.calendarId = targetCal.id; });
        targetCal.hasManualTaskOrder = true;
        targetCal.customTaskOrder = true;
        AppState.tasks.push(...movedTasks);
        AppState.collapsedMspOwners[owner.id] = false;
        AppState.collapsedProjects[targetCal.id] = false;
        _mspDragPayload = null;
        syncAllFromMSProject(`Đã chuyển ${movedTasks.length} công việc sang dự án "${owner.name}" (${targetCal.name})!`);
      }
    }
  });

  const ownerInput = rowEl.querySelector('.msp-inline-owner-input');
  ownerInput.addEventListener('focus', () => {
    const firstCal = og.groups[0] && og.groups[0].cal;
    if (firstCal) {
      AppState.activeCalendarId = firstCal.id;
      renderCalendarSidebar();
      syncCustomerInputWithActiveCalendar();
    }
  });
  ownerInput.addEventListener('change', () => {
    const v = ownerInput.value.trim();
    if (!v || v === owner.name) return;
    renameProjectAndSync(owner, v);
    syncAllFromMSProject(`Đã đổi tên dự án thành "${owner.name}" và đồng bộ tiêu đề Bảng Lịch & Timeline!`);
  });
  ownerInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') ownerInput.blur(); });
  rowEl.querySelector('.msp-add-stage-btn').addEventListener('click', async () => {
    const name = await GDHomeShell.prompt(`Tên giai đoạn mới cho dự án "${owner.name}" (VD: THI CÔNG PHẦN THÔ, HOÀN THIỆN, NỘI THẤT...):`, '', { okText: 'Thêm giai đoạn' });
    if (!name || !name.trim()) return;
    const pal = getActivePaletteColors();
    const stage = {
      id: 'cal_' + Date.now(),
      ownerId: owner.id,
      name: name.trim().toUpperCase(),
      customerName: name.trim().toUpperCase(),
      color: pal[AppState.calendars.length % pal.length],
      visible: true
    };
    AppState.calendars.push(stage);
    AppState.activeCalendarId = stage.id;
    syncAllFromMSProject(`Đã thêm giai đoạn "${stage.name}" vào dự án "${owner.name}"`);
  });
  tableBody.appendChild(rowEl);

  const gRow = document.createElement('div');
  gRow.className = 'msp-gantt-row project-row';
  gRow.dataset.ownerId = owner.id;
  gRow.dataset.calId = og.groups[0].cal.id;
  gRow.style.width = `${totalTimelineWidth}px`;
  if (pMin && pMax) {
    const leftPx = diffDaysFromStart(globalMinDate, pMin) * colWidth + 2;
    const widthPx = Math.max(12, diffDaysInclusive(pMin, pMax) * colWidth - 4);
    const bar = document.createElement('div');
    bar.className = 'msp-summary-bar msp-project-bar';
    bar.style.left = `${leftPx}px`;
    bar.style.width = `${widthPx}px`;
    bar.title = `${owner.name}: ${pStartDisp} → ${pEndDisp} (${pLV} ngày làm việc • ${pTT} ngày thực tế)`;
    const lbl = document.createElement('div');
    lbl.className = 'msp-summary-label';
    lbl.textContent = `📁 ${owner.name} (${pLV} ngày LV • ${pTT} ngày TT${mspShowProgress() ? ` • ${pProg}%` : ''})`;
    bar.appendChild(lbl);
    gRow.appendChild(bar);
  }
  ganttRowsLayer.appendChild(gRow);
}

function renderMspGridBackground(ganttBody, ganttGridBg, timelineDates, colWidth, totalTimelineWidth, totalBodyHeight, todayStr) {
  ganttBody.style.width = `${totalTimelineWidth}px`;
  ganttBody.style.minHeight = `${totalBodyHeight}px`;
  ganttGridBg.style.width = `${totalTimelineWidth}px`;
  ganttGridBg.style.height = `${totalBodyHeight}px`;

  timelineDates.forEach((d, idx) => {
    const dStr = formatDateStr(d);
    const offInfo = isDateDayOff(d, true);

    const gCol = document.createElement('div');
    gCol.className = 'msp-gantt-bg-col';
    if (offInfo.type === 'sunday' || offInfo.type === 'saturday') gCol.classList.add('is-sunday');
    if (offInfo.type === 'saturday-half') gCol.classList.add('is-saturday-half');
    if (offInfo.type === 'holiday') gCol.classList.add('is-holiday');
    gCol.style.width = `${colWidth}px`;
    ganttGridBg.appendChild(gCol);

    if (dStr === todayStr) {
      const todayLine = document.createElement('div');
      todayLine.className = 'msp-today-line';
      todayLine.style.left = `${idx * colWidth + Math.floor(colWidth / 2)}px`;
      ganttGridBg.appendChild(todayLine);
    }
  });
}

function renderMspDependencyArrows(ganttSvg, rowRecords, ROW_HEIGHT, totalTimelineWidth, totalBodyHeight, vis) {
  ganttSvg.setAttribute('width', totalTimelineWidth);
  ganttSvg.setAttribute('height', totalBodyHeight);
  ganttSvg.style.width = `${totalTimelineWidth}px`;
  ganttSvg.style.height = `${totalBodyHeight}px`;

  if (vis.ganttArrows === false) {
    ganttSvg.innerHTML = '';
    return;
  }

  const svgDefs = `
    <defs>
      <marker id="msp-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 1 2 L 7 5 L 1 8 z" fill="#0284c7" />
      </marker>
      <marker id="msp-arrow-bold" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse">
        <path d="M 1 1.5 L 8 5 L 1 8.5 z" fill="#0b4f8a" />
      </marker>
    </defs>
  `;
  let svgPaths = '';
  const rowByTaskId = new Map(rowRecords.map(rr => [rr.task.id, rr]));
  const barH = ROW_HEIGHT <= 28 ? Math.max(14, ROW_HEIGHT - 6) : Math.max(18, Math.min(38, ROW_HEIGHT - 16));

  const orthoPath = (pts, rad = 4) => {
    const clean = pts.filter((pt, i) => i === 0 || pt[0] !== pts[i - 1][0] || pt[1] !== pts[i - 1][1]);
    if (clean.length < 2) return '';
    let d = `M ${clean[0][0]} ${clean[0][1]}`;
    for (let i = 1; i < clean.length; i++) {
      const [x, y] = clean[i];
      if (i < clean.length - 1) {
        const [px, py] = clean[i - 1];
        const [nx, ny] = clean[i + 1];
        const inLen = Math.abs(x - px) + Math.abs(y - py);
        const outLen = Math.abs(nx - x) + Math.abs(ny - y);
        const rr = Math.min(rad, inLen / 2, outLen / 2);
        const bx = x - Math.sign(x - px) * rr;
        const by = y - Math.sign(y - py) * rr;
        const ax = x + Math.sign(nx - x) * rr;
        const ay = y + Math.sign(ny - y) * rr;
        d += ` L ${bx} ${by} Q ${x} ${y} ${ax} ${ay}`;
      } else {
        d += ` L ${x} ${y}`;
      }
    }
    return d;
  };

  rowRecords.forEach(succ => {
    (succ.task.predecessors || []).forEach(link => {
      const pred = rowByTaskId.get(link.id);
      if (!pred) return;
      const isSS = link.type === 'SS';
      const y1 = pred.centerY;
      const y2 = succ.centerY;
      const down = y2 >= y1;
      const xs = succ.leftPx;
      let pts;
      if (isSS) {
        const xp = pred.leftPx;
        const trunkX = Math.max(2, Math.min(xp, xs) - 8);
        pts = [[xp, y1], [trunkX, y1], [trunkX, y2], [xs - 1, y2]];
      } else {
        const sx = Math.max(pred.leftPx + 4, pred.rightPx - 6);
        const sy = down ? y1 + barH / 2 : y1 - barH / 2;
        const laneY = down ? y1 + ROW_HEIGHT / 2 : y1 - ROW_HEIGHT / 2;
        if (xs >= sx + 6) {
          const entryX = Math.round(xs + Math.min(8, Math.max(4, (succ.rightPx - xs) / 3)));
          pts = [[sx, sy], [sx, laneY], [entryX, laneY], [entryX, down ? y2 - barH / 2 - 1 : y2 + barH / 2 + 1]];
        } else {
          const backX = Math.max(2, xs - 8);
          pts = [[sx, sy], [sx, laneY], [backX, laneY], [backX, y2], [xs - 1, y2]];
        }
      }
      if (link.emphasis) {
        svgPaths += `<path class="msp-link-path is-bold ${isSS ? 'is-ss' : 'is-fs'}" d="${orthoPath(pts, 5)}" fill="none" stroke="#0b4f8a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" marker-end="url(#msp-arrow-bold)" opacity="0.95" />`;
      } else {
        svgPaths += `<path class="msp-link-path ${isSS ? 'is-ss' : 'is-fs'}" d="${orthoPath(pts)}" fill="none" stroke="#0284c7" stroke-width="1.15" marker-end="url(#msp-arrow)" opacity="0.85" />`;
      }
    });
  });

  ganttSvg.innerHTML = svgDefs + svgPaths;
}

// Kéo thả dịch chuyển hoặc co giãn thanh công việc trên biểu đồ Gantt MS Project
// Hỗ trợ kéo di chuyển đồng thời nhiều việc đang được chọn VÀ kéo dọc sang giai đoạn/dự án khác!
function setupGanttBarDragAndClick(taskBar, handleL, handleR, task, colWidth) {
  let isDragging = false;
  let dragType = null;
  let startX = 0;
  let startY = 0;
  let origStart = task.startDate;
  let origEnd = task.endDate;
  let origWorkDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
  let origLeftPx = 0;
  let origWidthPx = 0;
  let hasMoved = false;
  let multiSnapshot = [];
  let hoveredDropTarget = null;

  const clearVerticalDropHighlights = () => {
    document.querySelectorAll('.msp-tr.drop-target-above, .msp-tr.drop-target-below, .msp-tr.drop-target-into, .msp-gantt-row.drop-target-into').forEach(el => {
      el.classList.remove('drop-target-above', 'drop-target-below', 'drop-target-into');
    });
  };

  const onMouseDown = (e, type) => {
    if (e.button !== 0) return;
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      e.stopPropagation();
      if (!Array.isArray(AppState.selectedTaskIds)) AppState.selectedTaskIds = [];
      if (AppState.selectedTaskIds.includes(task.id)) {
        AppState.selectedTaskIds = AppState.selectedTaskIds.filter(id => id !== task.id);
      } else {
        AppState.selectedTaskIds.push(task.id);
      }
      renderMSProjectView();
      return;
    }

    e.stopPropagation();
    isDragging = true;
    dragType = type;
    startX = e.clientX;
    startY = e.clientY;
    origStart = task.startDate;
    origEnd = task.endDate;
    origWorkDays = Math.max(0.5, countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false));
    origLeftPx = parseFloat(taskBar.style.left) || 0;
    origWidthPx = parseFloat(taskBar.style.width) || 40;
    hasMoved = false;
    hoveredDropTarget = null;

    const isMultiMove = type === 'move' && Array.isArray(AppState.selectedTaskIds) && AppState.selectedTaskIds.length > 1 && AppState.selectedTaskIds.includes(task.id);
    if (isMultiMove) {
      multiSnapshot = AppState.tasks
        .filter(t => AppState.selectedTaskIds.includes(t.id))
        .map(t => {
          const barEl = document.querySelector(`.msp-task-bar[data-task-id="${t.id}"]`);
          return {
            taskRef: t,
            origStart: t.startDate,
            origEnd: t.endDate,
            origWorkDays: Math.max(0.5, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false)),
            barEl,
            origLeftPx: barEl ? (parseFloat(barEl.style.left) || 0) : 0
          };
        });
    } else {
      multiSnapshot = [];
    }

    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';

    const onMouseMove = (ev) => {
      if (!isDragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      const deltaDays = Math.round(dx / colWidth);
      if (Math.abs(dx) > 4 || Math.abs(dy) > 6) hasMoved = true;

      if (dragType === 'move') {
        // Kiểm tra nếu kéo dọc sang hàng công việc / giai đoạn / dự án khác
        clearVerticalDropHighlights();
        hoveredDropTarget = null;
        if (Math.abs(dy) > 10) {
          taskBar.style.pointerEvents = 'none';
          const elUnder = document.elementFromPoint(ev.clientX, ev.clientY);
          taskBar.style.pointerEvents = '';
          const rowUnder = elUnder ? elUnder.closest('.msp-gantt-row, .msp-tr') : null;
          if (rowUnder) {
            const targetTaskId = rowUnder.dataset.taskId || null;
            const targetCalId = rowUnder.dataset.calId || null;
            const targetOwnerId = rowUnder.dataset.ownerId || null;
            const rect = rowUnder.getBoundingClientRect();
            const insertAfter = (ev.clientY - rect.top) > rect.height / 2;
            if (targetTaskId && targetTaskId !== task.id) {
              hoveredDropTarget = { kind: 'task', taskId: targetTaskId, calId: targetCalId, insertAfter };
              const trMatch = document.querySelector(`.msp-tr.task-row[data-task-id="${targetTaskId}"]`);
              if (trMatch) trMatch.classList.add(insertAfter ? 'drop-target-below' : 'drop-target-above');
            } else if (!targetTaskId && rowUnder.classList.contains('project-row') && targetOwnerId) {
              hoveredDropTarget = { kind: 'owner', ownerId: targetOwnerId, calId: targetCalId };
              const trMatch = document.querySelector(`.msp-tr.project-row[data-owner-id="${targetOwnerId}"]`);
              if (trMatch) trMatch.classList.add('drop-target-into');
            } else if (!targetTaskId && targetCalId) {
              hoveredDropTarget = { kind: 'stage', calId: targetCalId };
              const trMatch = document.querySelector(`.msp-tr.summary-row[data-cal-id="${targetCalId}"]`);
              if (trMatch) trMatch.classList.add('drop-target-into');
            }
          }
        }

        if (multiSnapshot.length > 1) {
          multiSnapshot.forEach(item => {
            const ns = parseDateStr(item.origStart);
            ns.setDate(ns.getDate() + deltaDays);
            const candidateStart = formatDateStr(ns);
            item.taskRef.startDate = candidateStart;
            item.taskRef.endDate = computeEndDateByWorkingDays(candidateStart, item.origWorkDays, item.taskRef.skipSundays !== false);
            if (item.barEl) {
              item.barEl.style.left = `${item.origLeftPx + deltaDays * colWidth}px`;
            }
          });
          showFloatingTooltip(`Đang di chuyển đồng thời ${multiSnapshot.length} công việc (${deltaDays >= 0 ? '+' : ''}${deltaDays} ngày)`, ev.clientX, ev.clientY);
          return;
        } else {
          const ns = parseDateStr(origStart);
          ns.setDate(ns.getDate() + deltaDays);
          const candidateStart = formatDateStr(ns);
          task.startDate = candidateStart;
          task.endDate = computeEndDateByWorkingDays(candidateStart, origWorkDays, task.skipSundays !== false);
          taskBar.style.left = `${origLeftPx + deltaDays * colWidth}px`;
        }
      } else if (dragType === 'left') {
        const ns = parseDateStr(origStart);
        ns.setDate(ns.getDate() + deltaDays);
        const candidate = formatDateStr(ns);
        if (candidate <= origEnd) {
          task.startDate = candidate;
          taskBar.style.left = `${origLeftPx + deltaDays * colWidth}px`;
          taskBar.style.width = `${Math.max(18, origWidthPx - deltaDays * colWidth)}px`;
        }
      } else if (dragType === 'right') {
        const ne = parseDateStr(origEnd);
        ne.setDate(ne.getDate() + deltaDays);
        const candidate = formatDateStr(ne);
        if (candidate >= origStart) {
          task.endDate = candidate;
          taskBar.style.width = `${Math.max(18, origWidthPx + deltaDays * colWidth)}px`;
        }
      }

      const wDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
      showFloatingTooltip(`${task.title}: ${formatShortVNDate(task.startDate)} → ${formatShortVNDate(task.endDate)} (${wDays} ngày)`, ev.clientX, ev.clientY);
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      clearVerticalDropHighlights();
      hideFloatingTooltip();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (hasMoved) {
        const idsToMove = multiSnapshot.length > 1
          ? multiSnapshot.map(m => m.taskRef && m.taskRef.id).filter(Boolean)
          : [task.id];

        if (hoveredDropTarget) {
          let destCal = null;
          if (hoveredDropTarget.kind === 'owner' && hoveredDropTarget.ownerId) {
            destCal = AppState.calendars.find(c => c.ownerId === hoveredDropTarget.ownerId && c.visible !== false)
              || AppState.calendars.find(c => c.ownerId === hoveredDropTarget.ownerId);
          } else if (hoveredDropTarget.calId) {
            destCal = AppState.calendars.find(c => c.id === hoveredDropTarget.calId);
          }
          if (destCal) {
            const movedTasks = AppState.tasks.filter(t => idsToMove.includes(t.id));
            AppState.tasks = AppState.tasks.filter(t => !idsToMove.includes(t.id));
            movedTasks.forEach(mt => { mt.calendarId = destCal.id; });
            destCal.hasManualTaskOrder = true;
            destCal.customTaskOrder = true;
            if (hoveredDropTarget.kind === 'task' && hoveredDropTarget.taskId) {
              const tIdx = AppState.tasks.findIndex(t => t.id === hoveredDropTarget.taskId);
              if (tIdx !== -1) {
                AppState.tasks.splice(hoveredDropTarget.insertAfter ? tIdx + 1 : tIdx, 0, ...movedTasks);
              } else {
                AppState.tasks.push(...movedTasks);
              }
            } else {
              AppState.tasks.push(...movedTasks);
            }
          }
        }

        if (multiSnapshot.length > 1) {
          const shiftedMulti = AppState.autoCascadeShift === false ? 0
            : propagateLinkedTasks(idsToMove, AppState.tasks);
          syncAllFromMSProject(`Đã di chuyển đồng thời ${multiSnapshot.length} công việc đã chọn!${shiftedMulti > 0 ? ` • Tự động dịch ${shiftedMulti} mục nối phía sau` : ''}`);
        } else {
          const shifted = cascadeShiftSubsequentTasks(task, origStart, origEnd);
          const wDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
          syncAllFromMSProject(`Đã cập nhật "${task.title}": ${formatShortVNDate(task.startDate)} → ${formatShortVNDate(task.endDate)} (${wDays} ngày${shifted > 0 ? ` • Tự động dịch ${shifted} mục sau` : ''})!`);
        }
      } else {
        openTaskModal(task);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  handleL.addEventListener('mousedown', (e) => onMouseDown(e, 'left'));
  handleR.addEventListener('mousedown', (e) => onMouseDown(e, 'right'));
  taskBar.addEventListener('mousedown', (e) => {
    if (e.target === handleL || e.target === handleR) return;
    onMouseDown(e, 'move');
  });
}
