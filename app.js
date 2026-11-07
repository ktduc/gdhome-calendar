// Quản lý Lịch sử Undo / Redo (khoảng 50 bước)
const MAX_UNDO_STACK = 50;
let _undoStack = [];
let _redoStack = [];
let _isUndoOrRedoInProgress = false;

function snapshotState() {
  if (_isUndoOrRedoInProgress) return;
  try {
    const snap = JSON.stringify({
      tasks: AppState.tasks,
      calendars: AppState.calendars,
      activeCalendarId: AppState.activeCalendarId,
      mspCustomTitlePrefix: AppState.mspCustomTitlePrefix,
      daysOffConfig: AppState.daysOffConfig,
      projectOwners: AppState.projectOwners,
      footerNote: AppState.footerNote,
      startMonth: AppState.startMonth,
      endMonth: AppState.endMonth
    });
    if (_undoStack.length > 0 && _undoStack[_undoStack.length - 1] === snap) {
      return;
    }
    _undoStack.push(snap);
    if (_undoStack.length > MAX_UNDO_STACK) {
      _undoStack.shift();
    }
    _redoStack = [];
    updateUndoRedoButtonsUI();
  } catch (err) {
    console.error('Lỗi khi snapshot state:', err);
  }
}

function undoLastAction() {
  if (_undoStack.length <= 1) {
    showToast('Đã ở trạng thái ban đầu, không còn bước nào để hoàn tác!');
    return;
  }
  const currentState = _undoStack.pop();
  _redoStack.push(currentState);
  const prevStateStr = _undoStack[_undoStack.length - 1];
  applyRestoredSnapshot(prevStateStr, 'Đã hoàn tác (Undo) thành công!');
}

function redoLastAction() {
  if (_redoStack.length === 0) return;
  const nextStateStr = _redoStack.pop();
  _undoStack.push(nextStateStr);
  applyRestoredSnapshot(nextStateStr, 'Đã làm lại (Redo) thành công!');
}

function applyRestoredSnapshot(jsonStr, toastMsg) {
  if (!jsonStr) return;
  _isUndoOrRedoInProgress = true;
  try {
    const data = JSON.parse(jsonStr);
    if (data.tasks) AppState.tasks = data.tasks;
    if (data.calendars) AppState.calendars = data.calendars;
    if (data.activeCalendarId) AppState.activeCalendarId = data.activeCalendarId;
    if (data.mspCustomTitlePrefix !== undefined) AppState.mspCustomTitlePrefix = data.mspCustomTitlePrefix;
    if (data.daysOffConfig) AppState.daysOffConfig = data.daysOffConfig;
    if (data.projectOwners) AppState.projectOwners = data.projectOwners;
    if (data.footerNote !== undefined) AppState.footerNote = data.footerNote;
    if (data.startMonth) AppState.startMonth = data.startMonth;
    if (data.endMonth) AppState.endMonth = data.endMonth;
    normalizeAppState();
    updateUIElements();
    saveToBackend(); // Lưu cả lên server (trước đây chỉ lưu trình duyệt -> F5 thì server vẫn là bản cũ)
    renderCalendarSidebar();
    renderCalendar();
    showToast(toastMsg || 'Đã khôi phục dữ liệu!');
  } catch (err) {
    console.error('Lỗi apply snapshot:', err);
  } finally {
    _isUndoOrRedoInProgress = false;
    updateUndoRedoButtonsUI();
  }
}

function updateUndoRedoButtonsUI() {
  const btnUndo = document.getElementById('btn-undo-action');
  const btnRedo = document.getElementById('btn-redo-action');
  if (btnUndo) {
    btnUndo.disabled = _undoStack.length <= 1;
    btnUndo.style.opacity = _undoStack.length <= 1 ? '0.5' : '1';
  }
  if (btnRedo) {
    btnRedo.style.display = _redoStack.length > 0 ? 'inline-flex' : 'none';
  }
}

// Mặc định cài đặt thanh bên trái chuẩn (áp dụng cho cả tài khoản mới và chế độ khách)
function getDefaultLeftSidebarSettings() {
  return {
    mspScope: 'all-visible', // 'all-visible' (Tất cả dự án đang bật) | 'active-project' | 'active-only' | 'next-1-week' | 'next-2-weeks'
    mspZoom: 'normal', // 'compact' (XS) | 'normal' (S) | 'wide' (M) | 'xwide' (L) | 'xxwide' (XL)
    mspRowHeight: 'mini', // 'mini' (XS - 24px) | 'compact' (S - 32px) | 'normal' (M - 42px) | 'tall' (L - 54px)
    mspFontWeight: 'normal', // 'light' | 'normal' | 'bold' | 'heavy' — độ đậm chữ trong bảng Timeline
    exportWatermark: true,
    colorPaletteTheme: 'default',
    autoCascadeShift: false,
    autoLinkNewTasks: true,
    showVnHolidays: false,
    showLunarDates: true,
    daysOffConfig: {
      holidays: false,
      saturdayHalf: false,
      saturday: true,
      sunday: true,
      overrides: {}
    },
    mspVisibility: {
      overviewStrip: true,
      overviewCallouts: true,
      colWbs: true,
      colDur: true,
      colDate: true,
      colProg: false,
      colAct: false,
      ganttArrows: true
    },
    mspColWidths: {
      wbs: 54,
      name: 240,
      dur: 54,
      start: 66,
      end: 66,
      prog: 50,
      act: 44
    },
    sidebarCollapsed: {
      projects: false,
      timeline: false,
      daysoff: false,
      palette: true,
      demuc: false
    }
  };
}

// Khởi tạo state của ứng dụng
const _initDefaults = getDefaultLeftSidebarSettings();
const AppState = {
  startMonth: '2026-06',
  endMonth: '2026-09',
  scheduleMonth: 'Tháng 9, 2026', // Tháng đang lập bảng hiển thị bên trái tiêu đề
  viewMode: 'calendar', // 'calendar' (Google Lịch) hoặc 'msproject' (Microsoft Project Timeline / Gantt)
  mspScope: _initDefaults.mspScope,
  mspZoom: _initDefaults.mspZoom,
  mspRowHeight: _initDefaults.mspRowHeight,
  mspFontWeight: _initDefaults.mspFontWeight,
  exportWatermark: _initDefaults.exportWatermark,
  colorPaletteTheme: _initDefaults.colorPaletteTheme,
  autoCascadeShift: _initDefaults.autoCascadeShift,
  autoLinkNewTasks: _initDefaults.autoLinkNewTasks,
  mspCustomTitlePrefix: 'TIẾN ĐỘ THIẾT KẾ DỰ KIẾN -', // Tiêu đề tự gõ trên thanh Timeline MS Project
  selectedTaskIds: [], // Danh sách các ID công việc đang được tick chọn nhiều để kéo di chuyển đồng thời
  collapsedProjects: {},
  collapsedMspOwners: {},
  sidebarCollapsed: { ..._initDefaults.sidebarCollapsed },
  mspColWidths: { ..._initDefaults.mspColWidths },
  mspVisibility: { ..._initDefaults.mspVisibility },
  extraWeeksTop: 0,
  extraWeeksBottom: 1, // Mặc định luôn có tối thiểu 1 hàng tuần trống bên dưới
  showVnHolidays: _initDefaults.showVnHolidays,
  showLunarDates: _initDefaults.showLunarDates,
  daysOffConfig: { ..._initDefaults.daysOffConfig },
  projectOwners: [
    { id: 'owner-1', name: 'A DŨNG VŨ YÊN - HẢI PHÒNG', collapsed: false }
  ],
  calendars: [
    {
      id: 'cal-1',
      ownerId: 'owner-1',
      name: 'A DŨNG VŨ YÊN - HẢI PHÒNG',
      customerName: 'A DŨNG VŨ YÊN - HẢI PHÒNG',
      color: '#cc0000',
      visible: true
    },
    {
      id: 'cal-2',
      ownerId: 'owner-1',
      name: 'Lịch Công Việc Chung',
      customerName: '',
      color: '#2e7d32',
      visible: true
    }
  ],
  activeCalendarId: 'cal-1',
  tasks: [
    {
      id: 'task-1',
      calendarId: 'cal-1',
      title: '3D - A DŨNG VŨ YÊN - HẢI PHÒNG',
      startDate: '2026-06-22',
      endDate: '2026-07-23',
      color: '#cc0000',
      skipSundays: true,
      showCount: true,
      note: ''
    },
    {
      id: 'task-2',
      calendarId: 'cal-1',
      title: 'CHỈNH SỬA 3D - A DŨNG VŨ YÊN - HẢI PHÒNG',
      startDate: '2026-07-24',
      endDate: '2026-08-08',
      color: '#f57c00',
      skipSundays: true,
      showCount: true,
      note: ''
    },
    {
      id: 'task-3',
      calendarId: 'cal-1',
      title: 'HSKT - A DŨNG VŨ YÊN - HẢI PHÒNG',
      startDate: '2026-08-10',
      endDate: '2026-08-29',
      color: '#2e7d32',
      skipSundays: true,
      showCount: true,
      note: ''
    },
    {
      id: 'task-4',
      calendarId: 'cal-2',
      title: 'Ngày làm việc',
      startDate: '2026-08-21',
      endDate: '2026-08-22',
      color: '#0288d1',
      skipSundays: false,
      showCount: true,
      note: ''
    },
    {
      id: 'task-6',
      calendarId: 'cal-1',
      title: 'HSKT - A DŨNG VŨ YÊN - HẢI PHÒNG',
      startDate: '2026-09-03',
      endDate: '2026-09-04',
      color: '#2e7d32',
      skipSundays: true,
      showCount: true,
      note: ''
    }
  ],
  companyName: 'GD HOME',
  companyLogo: null,
  footerNote: 'Ngày làm việc không bao gồm Ngày lễ ở Việt Nam, Chủ nhật'
};

// Tự động tạo nội dung Ghi chú dựa theo tùy chọn Ngày nghỉ (Ngày lễ ở Việt Nam, Chiều thứ 7 / Thứ 7, Chủ nhật)
function buildAutoFooterNoteFromDaysOff() {
  const cfg = AppState.daysOffConfig || {
    holidays: AppState.showVnHolidays !== false,
    saturdayHalf: false,
    saturday: false,
    sunday: true
  };
  const offParts = [];
  if (cfg.holidays) offParts.push('Ngày lễ ở Việt Nam');
  if (cfg.saturday) offParts.push('Thứ 7');
  else if (cfg.saturdayHalf) offParts.push('Chiều thứ 7');
  if (cfg.sunday) offParts.push('Chủ nhật');
  if (offParts.length === 0) {
    return 'Ngày làm việc tính tất cả các ngày trong tuần (không trừ ngày nghỉ)';
  }
  return `Ngày làm việc không bao gồm ${offParts.join(', ')}`;
}

function syncFooterNoteWithDaysOff() {
  AppState.footerNote = buildAutoFooterNoteFromDaysOff();
  const calNote = document.getElementById('footer-note-text');
  if (calNote) calNote.textContent = AppState.footerNote;
  const mspNote = document.getElementById('msp-footer-note-text');
  if (mspNote) mspNote.textContent = AppState.footerNote;
  const settingNote = document.getElementById('setting-note-text');
  if (settingNote) settingNote.value = AppState.footerNote;
}

// =========================================================================
// HỆ THỐNG PALETTE MÀU 2 HÀNG (20 MÀU / PALETTE) & TỰ NHẢY MÀU THEO THỨ TỰ
// =========================================================================
const COLOR_PALETTES = {
  default: [
    // Hàng 1: 10 màu chuẩn GD HOME
    '#cc0000', '#e65100', '#f57c00', '#d4a017', '#2e7d32',
    '#00897b', '#0288d1', '#3949ab', '#7b1fa2', '#c2185b',
    // Hàng 2: 10 màu bổ sung sắc độ kiến trúc
    '#991b1b', '#b45309', '#ca8a04', '#4d7c0f', '#0f766e',
    '#0369a1', '#1d4ed8', '#4338ca', '#6d28d9', '#334155'
  ],
  default_soft: [
    // Hàng 1: 10 màu như bảng Mặc định nhưng giảm độ rực & giảm tương phản cho dịu mắt
    '#C85A5A', '#D06D4E', '#D9884E', '#C9A24D', '#528C62',
    '#478982', '#4A86B0', '#5B68A6', '#825D9E', '#B05574',
    // Hàng 2: 10 màu bổ sung giảm độ rực & dịu mắt
    '#9E4747', '#A8643B', '#B3863E', '#658546', '#3E756F',
    '#3E6E91', '#465E9C', '#5D5499', '#734C96', '#526071'
  ],
  olive: [
    // Hàng 1: 10 mã màu chuẩn từ bộ Olive / Sage Earth của người dùng
    '#DDE392', '#C6D191', '#AFBE8F', '#96A280', '#7D8570',
    '#717A64', '#646F58', '#5A5D49', '#555442', '#504B3A',
    // Hàng 2: 10 màu bổ sung tông Rêu Đất / Rừng Tự Nhiên để đủ 2 hàng 20 màu
    '#A3B18A', '#588157', '#3A5A40', '#344E41', '#8A9A86',
    '#6B705C', '#A5A58D', '#B7B7A4', '#7F5539', '#414833'
  ],
  mauve: [
    // Hàng 1: 10 mã màu chuẩn từ bộ Mauve / Graphite / Pastel Slate của người dùng
    '#2A2B2A', '#443A40', '#51424B', '#5E4955', '#996888',
    '#B18396', '#C99DA3', '#C8BDCA', '#C7CDDD', '#C6DDF0',
    // Hàng 2: 10 màu bổ sung tông Khói Tím / Xám Đá để đủ 2 hàng 20 màu
    '#3D314A', '#68506E', '#846A8A', '#A6808C', '#D6CFCB',
    '#706677', '#565264', '#7A8B99', '#91A6BC', '#4A5859'
  ],
  rust: [
    // Hàng 1: 10 mã màu Gạch nung / Gỉ sắt (Rosy Granite -> Oxidized Iron) của người dùng
    '#837A7A', '#87706D', '#8A6864', '#8D605A', '#8F5A53',
    '#934F45', '#974438', '#9B392A', '#9F2E1D', '#A2230F',
    // Hàng 2: cùng tông nhưng trầm hơn
    '#6C605F', '#6E5A56', '#705450', '#724F49', '#744B45',
    '#77433B', '#793C32', '#7C3429', '#7F2D20', '#812516'
  ],
  eagle: [
    // Hàng 1: tông Lông vũ / Nâu Đá / Xám Xanh (lấy từ ảnh chim ưng, đã giảm tương phản)
    '#7C8F95', '#584C43', '#373431', '#47423C', '#57493D',
    '#564133', '#7D7467', '#525D5F', '#B3A48F', '#63767E',
    // Hàng 2: cùng tông, sáng & dịu hơn
    '#9BA7A7', '#81776C', '#6A655F', '#756F67', '#817468',
    '#806F61', '#9C9386', '#7D8381', '#C3B6A3', '#899597'
  ]
};

function getActivePaletteColors() {
  const key = AppState.colorPaletteTheme || 'default';
  return COLOR_PALETTES[key] || COLOR_PALETTES.default;
}

// Tự động tính màu chữ (Đen đậm hoặc Trắng) dựa trên độ sáng của màu nền Palette để luôn đọc rõ 100%
function getContrastTextColor(hexColor) {
  if (!hexColor || typeof hexColor !== 'string') return '#ffffff';
  const clean = hexColor.replace('#', '').trim();
  if (clean.length !== 6) return '#ffffff';
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 0.60 ? '#1e293b' : '#ffffff';
}

// Tự động lấy màu tiếp theo theo đúng thứ tự của Palette đang chọn
function getNextSequentialPaletteColor(calendarId = null) {
  const palette = getActivePaletteColors();
  const relevant = calendarId
    ? AppState.tasks.filter(t => t.calendarId === calendarId)
    : AppState.tasks;
  return palette[relevant.length % palette.length];
}

// Cập nhật toàn bộ các khay chọn màu (2 hàng = 20 ô màu) theo Palette đang chọn
function renderPaletteSwatchesUI() {
  const palette = getActivePaletteColors();
  const themeKey = AppState.colorPaletteTheme || 'default';

  const sidebarSel = document.getElementById('sidebar-palette-select');
  if (sidebarSel && sidebarSel.value !== themeKey) sidebarSel.value = themeKey;
  const modalSel = document.getElementById('modal-palette-select');
  if (modalSel && modalSel.value !== themeKey) modalSel.value = themeKey;

  // 1. Preview 20 ô màu ở Sidebar bên trái
  const sidePreview = document.getElementById('sidebar-palette-preview');
  if (sidePreview) {
    sidePreview.innerHTML = palette.map((hex, idx) =>
      `<div class="sidebar-palette-chip" data-color="${hex}" style="background:${hex};" title="Màu #${idx + 1}: ${hex} (Bấm để đặt cho lịch đang chọn)"></div>`
    ).join('');
    sidePreview.querySelectorAll('.sidebar-palette-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const activeCal = getActiveCalendar();
        if (activeCal) {
          activeCal.color = chip.dataset.color;
          popoverColor = chip.dataset.color;
          saveToBackend();
          renderCalendarSidebar();
          renderCalendar();
          showToast(`Đã chọn màu ${chip.dataset.color} cho lịch "${activeCal.name}"`);
        }
      });
    });
  }

  // 2. Khay 20 màu trong Modal Công Việc (#color-palette)
  const taskPaletteEl = document.getElementById('color-palette');
  if (taskPaletteEl) {
    taskPaletteEl.innerHTML = palette.map((hex, idx) =>
      `<button type="button" class="color-swatch ${hex.toLowerCase() === (selectedColor || '').toLowerCase() ? 'active' : ''}" data-color="${hex}" style="background-color: ${hex};" title="Màu #${idx + 1} (${hex})"></button>`
    ).join('');
    taskPaletteEl.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        selectSwatchColorInModal(sw.dataset.color);
      });
    });
  }

  // 3. Khay 20 màu trong Modal Tạo/Sửa Dự Án (#cal-cat-color-palette)
  const calPaletteEl = document.getElementById('cal-cat-color-palette');
  if (calPaletteEl) {
    calPaletteEl.innerHTML = palette.map((hex, idx) =>
      `<button type="button" class="color-swatch ${hex.toLowerCase() === (selectedCalCatColor || '').toLowerCase() ? 'active' : ''}" data-color="${hex}" style="background-color: ${hex};" title="Màu #${idx + 1} (${hex})"></button>`
    ).join('');
    calPaletteEl.querySelectorAll('.color-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        calPaletteEl.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        selectedCalCatColor = sw.dataset.color;
      });
    });
  }

  // 4. Khay 20 màu trong Quick Create Popover (#popover-swatches)
  const popPaletteEl = document.getElementById('popover-swatches');
  if (popPaletteEl) {
    popPaletteEl.innerHTML = palette.map((hex, idx) =>
      `<button type="button" class="p-swatch ${hex.toLowerCase() === (popoverColor || '').toLowerCase() ? 'active' : ''}" data-color="${hex}" style="background:${hex};" title="Màu #${idx + 1} (${hex})"></button>`
    ).join('');
    popPaletteEl.querySelectorAll('.p-swatch').forEach(sw => {
      sw.addEventListener('click', () => {
        popPaletteEl.querySelectorAll('.p-swatch').forEach(s => s.classList.remove('active'));
        sw.classList.add('active');
        popoverColor = sw.dataset.color;
      });
    });
  }
}

// Tự động nhảy màu theo đúng thứ tự của Palette cho các công việc trên bảng
function applyPaletteSequenceToTasks(targetCalId = null, silent = false) {
  const palette = getActivePaletteColors();
  if (targetCalId) {
    let idx = 0;
    AppState.tasks.forEach(t => {
      if (t.calendarId === targetCalId && t.visibleOnBoard !== false) {
        t.color = palette[idx % palette.length];
        idx++;
      }
    });
    const cal = AppState.calendars.find(c => c.id === targetCalId);
    if (cal) cal.color = palette[0];
  } else {
    // Áp dụng tuần tự theo từng dự án đang hiển thị
    let globalIdx = 0;
    AppState.calendars.forEach((cal, cIdx) => {
      cal.color = palette[cIdx % palette.length];
      AppState.tasks.forEach(t => {
        if (t.calendarId === cal.id) {
          t.color = palette[globalIdx % palette.length];
          globalIdx++;
        }
      });
    });
  }
  saveToBackend();
  renderPaletteSwatchesUI();
  renderCalendarSidebar();
  renderCalendar();
  if (!silent) {
    const themeNames = {
      default: 'Mặc định GD HOME (20 màu)',
      default_soft: 'Mặc định Dịu mắt (20 màu)',
      olive: 'Olive / Rêu Đất (20 màu)',
      mauve: 'Mauve / Khói Tím (20 màu)',
      rust: 'Gạch nung / Gỉ sắt (20 màu)',
      eagle: 'Lông vũ / Nâu Đá (20 màu)'
    };
    showToast(`🎨 Đã tự nhảy màu theo thứ tự bộ "${themeNames[AppState.colorPaletteTheme] || 'Palette'}"!`);
  }
}

// Bộ chuyển đổi Dương lịch -> Âm lịch chuẩn
const lunarFormatter = new Intl.DateTimeFormat('vi-VN-u-ca-chinese', {
  day: 'numeric',
  month: 'numeric'
});

function getLunarDateDisplay(date) {
  try {
    const parts = lunarFormatter.formatToParts(date);
    let d = '';
    let m = '';
    parts.forEach(p => {
      if (p.type === 'day') d = p.value;
      if (p.type === 'month') m = p.value;
    });
    if (!d) return { text: '', isFirst: false };
    const dayNum = parseInt(d, 10);
    // Nếu là mùng 1 Âm lịch hoặc ngày 1 Dương lịch thì hiện dạng "d/m" (VD: 1/5), còn lại hiện số ngày âm mảnh
    if (dayNum === 1 || date.getDate() === 1) {
      return { text: `${d}/${m}`, isFirst: dayNum === 1 };
    }
    return { text: `${d}`, isFirst: false };
  } catch (e) {
    return { text: '', isFirst: false };
  }
}

// Toast Notification
let toastTimeout = null;
function showToast(message) {
  const toast = document.getElementById('toast-notification');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('show');
  }, 3200);
}

// Sắp xếp các công việc trong từng dự án theo đúng thứ tự Ngày bắt đầu -> Ngày kết thúc (Tránh bị lộn xộn)
function sortAllTasksChronologically(resetManual = false) {
  if (!Array.isArray(AppState.tasks) || AppState.tasks.length <= 1) return;
  if (resetManual && Array.isArray(AppState.calendars)) {
    AppState.calendars.forEach(c => { delete c.hasManualTaskOrder; });
  }
  const manualCalIds = new Set(
    (AppState.calendars || []).filter(c => c.hasManualTaskOrder).map(c => c.id)
  );
  const grouped = new Map();
  AppState.tasks.forEach(t => {
    const cid = t.calendarId || 'default';
    if (!grouped.has(cid)) grouped.set(cid, []);
    grouped.get(cid).push(t);
  });
  const sortedAll = [];
  grouped.forEach((list, cid) => {
    if (!manualCalIds.has(cid)) {
      list.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || '') || (a.endDate || '').localeCompare(b.endDate || ''));
    }
    sortedAll.push(...list);
  });
  AppState.tasks = sortedAll;
}

// Chuẩn hóa dữ liệu
function normalizeAppState() {
  const defSettings = getDefaultLeftSidebarSettings();
  if (!AppState.daysOffConfig || typeof AppState.daysOffConfig !== 'object') {
    AppState.daysOffConfig = { ...defSettings.daysOffConfig };
  }
  if (!AppState.mspVisibility || typeof AppState.mspVisibility !== 'object') {
    AppState.mspVisibility = { ...defSettings.mspVisibility };
  }
  if (!AppState.mspColWidths || typeof AppState.mspColWidths !== 'object') {
    AppState.mspColWidths = { ...defSettings.mspColWidths };
  }
  if (!AppState.sidebarCollapsed || typeof AppState.sidebarCollapsed !== 'object') {
    AppState.sidebarCollapsed = { ...defSettings.sidebarCollapsed };
  }
  if (!AppState.mspScope) AppState.mspScope = defSettings.mspScope;
  if (!AppState.mspZoom) AppState.mspZoom = defSettings.mspZoom;
  if (!AppState.mspRowHeight) AppState.mspRowHeight = defSettings.mspRowHeight;
  if (!AppState.mspFontWeight) AppState.mspFontWeight = defSettings.mspFontWeight;
  if (!Array.isArray(AppState.selectedTaskIds)) {
    AppState.selectedTaskIds = [];
  }
  if (!Array.isArray(AppState.projectOwners) || AppState.projectOwners.length === 0) {
    const firstCalName = Array.isArray(AppState.calendars) && AppState.calendars[0] && AppState.calendars[0].name && AppState.calendars[0].name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG'
      ? AppState.calendars[0].name.trim()
      : 'A DŨNG VŨ YÊN - HẢI PHÒNG';
    AppState.projectOwners = [
      { id: 'owner-1', name: firstCalName, collapsed: false }
    ];
  } else if (
    AppState.projectOwners.length === 1 &&
    AppState.projectOwners[0].name === 'GD HOME' &&
    Array.isArray(AppState.calendars) &&
    AppState.calendars.length > 0 &&
    AppState.calendars[0].name &&
    AppState.calendars[0].name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG' &&
    AppState.calendars[0].name !== 'GIAI ĐOẠN 1'
  ) {
    AppState.projectOwners[0].name = AppState.calendars[0].name.trim();
  }
  const defaultOwnerId = AppState.projectOwners[0].id;
  const validOwnerIds = new Set(AppState.projectOwners.map(o => o.id));

  if (!Array.isArray(AppState.calendars) || AppState.calendars.length === 0) {
    AppState.calendars = [
      { id: 'cal-1', ownerId: defaultOwnerId, name: 'A DŨNG VŨ YÊN - HẢI PHÒNG', customerName: 'A DŨNG VŨ YÊN - HẢI PHÒNG', color: '#cc0000', visible: true },
      { id: 'cal-2', ownerId: defaultOwnerId, name: 'LỊCH CÔNG VIỆC CHUNG', customerName: 'LỊCH CÔNG VIỆC CHUNG', color: '#2e7d32', visible: true }
    ];
  }
  AppState.calendars.forEach(c => {
    if (!c.ownerId || !validOwnerIds.has(c.ownerId)) {
      c.ownerId = defaultOwnerId;
    }
    if (!c.name || !c.name.trim()) {
      c.name = 'CHƯA ĐẶT TÊN KHÁCH HÀNG';
      c.customerName = '';
    } else if (c.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG') {
      c.customerName = '';
    } else {
      c.customerName = c.name.trim();
    }
  });
  if (!AppState.footerNote || AppState.footerNote === 'Bảng tiến độ chưa bao gồm thời gian phản hồi và trao đổi thiết kế' || AppState.footerNote.startsWith('Ngày làm việc')) {
    AppState.footerNote = buildAutoFooterNoteFromDaysOff();
  }
  if (!AppState.activeCalendarId || !AppState.calendars.some(c => c.id === AppState.activeCalendarId)) {
    AppState.activeCalendarId = AppState.calendars[0].id;
  }
  const defaultCalId = AppState.calendars[0].id;
  AppState.tasks.forEach(t => {
    if (!t.calendarId || !AppState.calendars.some(c => c.id === t.calendarId)) {
      t.calendarId = defaultCalId;
    }
    // Đồng bộ các mục HSKT mặc định sang màu xanh lá (#2e7d32)
    if (t.title && t.title.toUpperCase().startsWith('HSKT') && t.color === '#0288d1') {
      t.color = '#2e7d32';
    }
  });
  sortAllTasksChronologically(false);
  if (!AppState.daysOffConfig.overrides || typeof AppState.daysOffConfig.overrides !== 'object') {
    AppState.daysOffConfig.overrides = {};
  }
  if (typeof cleanupDanglingLinks === 'function') {
    cleanupDanglingLinks(AppState.tasks);
    inferMissingPredecessors(AppState.tasks);
  }
}

function getActiveCalendar() {
  if (!Array.isArray(AppState.calendars) || AppState.calendars.length === 0) {
    normalizeAppState();
  }
  return AppState.calendars.find(c => c.id === AppState.activeCalendarId) || AppState.calendars[0];
}

// Đồng bộ đổi tên DỰ ÁN (projectOwners) <-> Tiêu đề Bảng Lịch & Timeline + hậu tố công việc
function renameProjectAndSync(owner, rawNewName) {
  if (!owner) return;
  const oldOwnerName = (owner.name || '').trim();
  const cleanNew = (rawNewName || '').trim().toUpperCase();
  owner.name = cleanNew || 'CHƯA ĐẶT TÊN DỰ ÁN';

  const ownerCals = (AppState.calendars || []).filter(c => c.ownerId === owner.id);
  const ownerCalIds = new Set(ownerCals.map(c => c.id));

  // Nếu dự án chỉ có 1 giai đoạn trùng tên cũ hoặc chưa đặt tên thì đồng bộ theo
  if (ownerCals.length === 1) {
    const onlyCal = ownerCals[0];
    if (!onlyCal.name || onlyCal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' || (oldOwnerName && onlyCal.name.toUpperCase() === oldOwnerName.toUpperCase())) {
      onlyCal.name = cleanNew || 'GIAI ĐOẠN 1';
      onlyCal.customerName = cleanNew;
    }
  }

  AppState.tasks.forEach(t => {
    if (!ownerCalIds.has(t.calendarId) || !t.title) return;
    const stageMatch = t.title.match(/^(3D|CHỈNH SỬA 3D|HSKT)(?:\s*-\s*(.*))?$/i);
    if (stageMatch) {
      const stagePrefix = stageMatch[1].toUpperCase();
      t.title = cleanNew ? `${stagePrefix} - ${cleanNew}` : stagePrefix;
    } else if (oldOwnerName && t.title.toUpperCase().endsWith(' - ' + oldOwnerName.toUpperCase())) {
      const basePart = t.title.slice(0, t.title.length - (' - ' + oldOwnerName).length).trim();
      t.title = cleanNew ? `${basePart} - ${cleanNew}` : basePart;
    }
  });
}

// Đồng bộ đổi tên Lịch / Giai đoạn + Cập nhật hậu tố các thanh công việc thuộc giai đoạn đó
function renameCalendarAndSyncTasks(cal, rawNewName) {
  if (!cal) return;
  const oldName = (cal.customerName || (cal.name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? cal.name : '') || '').trim();
  const cleanNew = (rawNewName || '').trim().toUpperCase();

  cal.customerName = cleanNew;
  cal.name = cleanNew || 'CHƯA ĐẶT TÊN KHÁCH HÀNG';

  // Tự động cập nhật hậu tố tên khách hàng trên các thanh công việc (3D, CHỈNH SỬA 3D, HSKT) của lịch này
  AppState.tasks.forEach(t => {
    if (t.calendarId !== cal.id || !t.title) return;
    const stageMatch = t.title.match(/^(3D|CHỈNH SỬA 3D|HSKT)(?:\s*-\s*(.*))?$/i);
    if (stageMatch) {
      const stagePrefix = stageMatch[1].toUpperCase();
      t.title = cleanNew ? `${stagePrefix} - ${cleanNew}` : stagePrefix;
    } else if (oldName && t.title.toUpperCase().endsWith(' - ' + oldName.toUpperCase())) {
      const basePart = t.title.slice(0, t.title.length - (' - ' + oldName).length).trim();
      t.title = cleanNew ? `${basePart} - ${cleanNew}` : basePart;
    }
  });
}

// Lấy tên DỰ ÁN hiện tại (luôn đồng bộ giữa ô tiêu đề Bảng Lịch, Timeline và Dự án bên trái)
function getCurrentCustomerName() {
  const activeProj = typeof getActiveProject === 'function' ? getActiveProject() : null;
  if (activeProj && activeProj.name && activeProj.name.trim() && activeProj.name !== 'CHƯA ĐẶT TÊN DỰ ÁN') {
    return activeProj.name.trim().toUpperCase();
  }
  const inputEl = document.getElementById('customer-name-input');
  if (inputEl && inputEl.value.trim()) {
    return inputEl.value.trim().toUpperCase();
  }
  const activeCal = getActiveCalendar();
  if (activeCal && activeCal.customerName && activeCal.customerName.trim()) {
    return activeCal.customerName.trim().toUpperCase();
  }
  if (activeCal && activeCal.name && activeCal.name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG') {
    return activeCal.name.trim().toUpperCase();
  }
  return '';
}

// Ghép Tag Tiền tố ("3D", "CHỈNH SỬA 3D", "HSKT") + Hậu tố Tên khách hàng
function formatStageTitleWithCustomer(prefix) {
  const proj = getActiveProject();
  const customer = (proj && proj.name) || getCurrentCustomerName();
  if (customer) {
    return `${prefix} - ${customer}`;
  }
  return prefix;
}

// Tháng lập bảng: TỰ ĐỘNG theo tháng hiện tại.
// Nếu người dùng tự gõ tháng khác thì chỉ giữ trong tháng đó; sang tháng mới tự nhảy lại theo lịch.
function getCurrentYM() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}
function getCurrentMonthLabel() {
  const n = new Date();
  return `Tháng ${n.getMonth() + 1}, ${n.getFullYear()}`;
}
function getAutoScheduleMonth() {
  if (AppState.scheduleMonthManualFor === getCurrentYM() && AppState.scheduleMonth) return AppState.scheduleMonth;
  return getCurrentMonthLabel();
}
function setManualScheduleMonth(text) {
  AppState.scheduleMonth = String(text || '').trim();
  AppState.scheduleMonthManualFor = AppState.scheduleMonth ? getCurrentYM() : null;
}

// Lấy tháng đang lập bảng hiển thị bên trái tiêu đề
function getScheduleMonthText() {
  const inputEl = document.getElementById('schedule-month-input');
  if (inputEl && inputEl.value.trim()) {
    return inputEl.value.trim();
  }
  return getAutoScheduleMonth();
}

// Tên dự án hiện trên tiêu đề: chỉ khi đang hiển thị ĐÚNG 1 dự án; từ 2 dự án trở lên thì để trống
function getTitleProject(mode) {
  let cals;
  if (mode === 'msproject' && typeof getMspTargetCalendars === 'function') {
    cals = getMspTargetCalendars();
  } else {
    cals = AppState.calendars.filter(c => c.visible !== false);
  }
  const ownerIds = [...new Set(cals.map(c => c.ownerId))];
  if (ownerIds.length !== 1) return null;
  return AppState.projectOwners.find(o => o.id === ownerIds[0]) || null;
}

function getTitleProjectName(mode) {
  let cals;
  if (mode === 'msproject' && typeof getMspTargetCalendars === 'function') {
    cals = getMspTargetCalendars();
  } else {
    cals = AppState.calendars.filter(c => c.visible !== false);
  }
  const ownerIds = [...new Set(cals.map(c => c.ownerId))];
  if (ownerIds.length !== 1) return null;
  const owner = AppState.projectOwners.find(o => o.id === ownerIds[0]);
  if (!owner || !owner.name || owner.name === 'CHƯA ĐẶT TÊN DỰ ÁN') return '';
  return owner.name;
}

// Đồng bộ & Lưu trữ
// =========================================================================
// ĐỒNG BỘ & LƯU TRỮ (an toàn hơn)
//  - Lưu localStorage ngay lập tức, gửi lên server sau 0.6s (gom nhiều thao tác liên tiếp)
//  - Có số phiên bản (_version) để phát hiện 2 máy cùng sửa -> hỏi trước khi ghi đè
//  - Hiện trạng thái "Đã lưu / Đang lưu / Lỗi lưu" trên thanh header
//  - Hỗ trợ mật khẩu (nếu server đặt biến môi trường APP_PASSWORD)
// =========================================================================
const SAVE_DEBOUNCE_MS = 600;
const APP_KEY_STORAGE = 'gdhome_app_key';
let _serverVersion = null;      // Phiên bản dữ liệu server mà máy này đang dựa vào
let _pendingSync = false;       // Còn thay đổi chưa gửi lên server
let _saveTimer = null;
let _saveInFlight = false;
let _saveAgainAfterFlight = false;
let _conflictDialogOpen = false;

function isOfflineFileMode() {
  return typeof location !== 'undefined' && location.protocol === 'file:';
}

// =========================================================================
// ĐĂNG NHẬP BẰNG GMAIL (Google Identity Services)
// Chỉ bật khi server có GOOGLE_CLIENT_ID. Mỗi tài khoản Gmail có dữ liệu riêng.
// =========================================================================
const SESSION_STORAGE_KEY = 'gdhome_session';
const GUEST_FLAG_KEY = 'gdhome_guest';
const GUEST_STATE_KEY = 'timeline_calendar_state::guest';
let _appConfig = { authMode: 'none', googleClientId: null, storage: 'file' };
let _currentUser = null;
let _guestMode = false;
let _loginOverlayShown = false;

function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_STORAGE_KEY) || 'null');
    return s && s.token ? s : null;
  } catch (e) {
    return null;
  }
}

function setSession(sess) {
  try {
    if (sess) localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sess));
    else localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) { /* bỏ qua */ }
}

// Khoá lưu trên trình duyệt tách riêng theo tài khoản hoặc chế độ khách
function getLocalStateKey() {
  if (_guestMode) return GUEST_STATE_KEY;
  return _currentUser && _currentUser.email ? `timeline_calendar_state::${_currentUser.email}` : 'timeline_calendar_state';
}

function resetStateToEmptyGuest() {
  const def = getDefaultLeftSidebarSettings();
  const now = new Date();
  const y = now.getFullYear();
  const m1 = String(now.getMonth() + 1).padStart(2, '0');
  const endD = new Date(y, now.getMonth() + 3, 1);
  const y2 = endD.getFullYear();
  const m2 = String(endD.getMonth() + 1).padStart(2, '0');
  AppState.startMonth = `${y}-${m1}`;
  AppState.endMonth = `${y2}-${m2}`;
  AppState.scheduleMonth = `Tháng ${now.getMonth() + 1}, ${y}`;
  AppState.mspScope = def.mspScope;
  AppState.mspZoom = def.mspZoom;
  AppState.mspRowHeight = def.mspRowHeight;
  AppState.mspFontWeight = def.mspFontWeight;
  AppState.exportWatermark = def.exportWatermark;
  AppState.colorPaletteTheme = def.colorPaletteTheme;
  AppState.autoCascadeShift = def.autoCascadeShift;
  AppState.autoLinkNewTasks = def.autoLinkNewTasks;
  AppState.showVnHolidays = def.showVnHolidays;
  AppState.showLunarDates = def.showLunarDates;
  AppState.daysOffConfig = { ...def.daysOffConfig, overrides: {} };
  AppState.mspVisibility = { ...def.mspVisibility };
  AppState.mspColWidths = { ...def.mspColWidths };
  AppState.sidebarCollapsed = { ...def.sidebarCollapsed };
  AppState.collapsedProjects = {};
  AppState.collapsedMspOwners = {};
  AppState.projectOwners = [
    { id: 'owner-1', name: 'DỰ ÁN MỚI', collapsed: false }
  ];
  AppState.calendars = [
    {
      id: 'cal-1',
      ownerId: 'owner-1',
      name: 'GIAI ĐOẠN 1',
      customerName: 'GIAI ĐOẠN 1',
      color: '#cc0000',
      visible: true
    }
  ];
  AppState.activeCalendarId = 'cal-1';
  AppState.tasks = [];
  AppState.selectedTaskIds = [];
  AppState.footerNote = buildAutoFooterNoteFromDaysOff();
}

function enterGuestMode(opts = {}) {
  _guestMode = true;
  _currentUser = null;
  _serverVersion = null;
  _pendingSync = false;
  _undoStack = [];
  _redoStack = [];
  try { localStorage.setItem(GUEST_FLAG_KEY, '1'); } catch (e) { /* bỏ qua */ }
  const existingGuestData = localStorage.getItem(GUEST_STATE_KEY);
  if (existingGuestData) {
    loadFromStorage();
  } else {
    resetStateToEmptyGuest();
    saveToStorage();
  }
  hideLoginOverlay();
  normalizeAppState();
  updateUIElements();
  snapshotState();
  renderUserChip();
  setSaveStatus('guest');
  if (!opts.silent) {
    showToast('👤 Đang dùng Chế độ khách – dữ liệu chỉ lưu trên trình duyệt này');
  }
}

function promptLoginFromGuest() {
  try { localStorage.removeItem(GUEST_FLAG_KEY); } catch (e) { /* bỏ qua */ }
  showLoginOverlay();
}

function getGuestSavedData() {
  try {
    const raw = localStorage.getItem(GUEST_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch (e) {
    return null;
  }
}

async function loadAppConfig() {
  if (isOfflineFileMode()) return _appConfig;
  try {
    const res = await fetch('/api/config', { cache: 'no-store' });
    if (res.ok) _appConfig = Object.assign(_appConfig, await res.json());
  } catch (e) { /* mất mạng: dùng mặc định */ }
  return _appConfig;
}

function loadGoogleScript() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.accounts && window.google.accounts.id) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Không tải được thư viện đăng nhập Google (kiểm tra mạng)'));
    document.head.appendChild(s);
  });
}

function renderUserChip() {
  const chip = document.getElementById('btn-user-account');
  const guestChip = document.getElementById('guest-mode-chip');
  const guestLoginBtn = document.getElementById('btn-guest-login');
  if (guestChip) guestChip.style.display = _guestMode ? 'inline-flex' : 'none';
  if (guestLoginBtn) guestLoginBtn.style.display = _guestMode ? 'inline-flex' : 'none';
  if (!chip) return;
  if (_guestMode || _appConfig.authMode !== 'google' || !_currentUser) {
    chip.style.display = 'none';
    return;
  }
  chip.style.display = 'inline-flex';
  const initial = (_currentUser.name || _currentUser.email || '?').trim().charAt(0).toUpperCase();
  chip.innerHTML = '';
  const av = document.createElement('span');
  av.className = 'user-chip-avatar';
  if (_currentUser.picture) {
    const img = document.createElement('img');
    img.src = _currentUser.picture;
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    av.appendChild(img);
  } else {
    av.textContent = initial;
  }
  chip.appendChild(av);
  const label = document.createElement('span');
  label.className = 'btn-label user-chip-email';
  label.textContent = _currentUser.email;
  chip.appendChild(label);
  chip.title = `Đang đăng nhập: ${_currentUser.email} • Bấm để đăng xuất`;
}

async function handleGoogleCredential(response) {
  const msgEl = document.getElementById('login-overlay-msg');
  try {
    if (msgEl) msgEl.textContent = 'Đang đăng nhập...';
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    const result = await res.json().catch(() => ({}));
    if (!res.ok || !result.token) throw new Error(result.message || 'Đăng nhập thất bại');

    const wasGuest = _guestMode;
    const guestData = getGuestSavedData();
    const hasGuestWork = guestData && Array.isArray(guestData.tasks) && guestData.tasks.length > 0;
    const copyGuestToAccount = (wasGuest || hasGuestWork) && hasGuestWork
      ? confirm('Chép dữ liệu đang làm ở chế độ khách vào tài khoản?')
      : false;

    _guestMode = false;
    try { localStorage.removeItem(GUEST_FLAG_KEY); } catch (e) { /* bỏ qua */ }
    setSession({ token: result.token, user: result.user });
    _currentUser = result.user;

    if (!copyGuestToAccount && result.isNewUser && result.legacyAvailable) {
      const ok = confirm(
        `Chào ${result.user.name || result.user.email}!\n\n` +
        'Tài khoản này chưa có dữ liệu. Bạn có muốn CHÉP dữ liệu tiến độ dùng chung trước đây vào tài khoản của mình không?\n\n' +
        '• [OK] = Chép sang (dữ liệu chung cũ vẫn giữ nguyên)\n• [Cancel / Huỷ] = Bắt đầu với bảng trống'
      );
      if (ok) {
        await apiFetch('/api/import-legacy', { method: 'POST', body: '{}' });
      }
    }
    hideLoginOverlay();
    _serverVersion = null;
    _pendingSync = false;
    _undoStack = [];
    _redoStack = [];
    renderUserChip();

    if (copyGuestToAccount && guestData) {
      applyServerData(guestData);
      normalizeAppState();
      updateUIElements();
      saveToStorage();
      snapshotState();
      await flushSaveToBackend({ force: true });
      showToast(`Đã đăng nhập & chép dữ liệu khách vào: ${result.user.email}`);
      return;
    }

    await syncWithBackend();
    showToast(`Đã đăng nhập: ${result.user.email}`);
  } catch (err) {
    if (msgEl) msgEl.textContent = '⚠ ' + err.message;
  }
}

async function showLoginOverlay(message) {
  const overlay = document.getElementById('login-overlay');
  if (!overlay) return;
  overlay.classList.add('active');
  _loginOverlayShown = true;
  const msgEl = document.getElementById('login-overlay-msg');
  if (msgEl) msgEl.textContent = message || '';
  try {
    await loadGoogleScript();
    window.google.accounts.id.initialize({
      client_id: _appConfig.googleClientId,
      callback: handleGoogleCredential,
      auto_select: true,
      cancel_on_tap_outside: false
    });
    const btnBox = document.getElementById('google-signin-btn');
    if (btnBox) {
      btnBox.innerHTML = '';
      window.google.accounts.id.renderButton(btnBox, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'vi', width: 280 });
    }
    window.google.accounts.id.prompt();
  } catch (err) {
    if (msgEl) msgEl.textContent = '⚠ ' + err.message;
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.remove('active');
  _loginOverlayShown = false;
}

function signOut() {
  if (!confirm(`Đăng xuất tài khoản ${_currentUser ? _currentUser.email : ''}?`)) return;
  setSession(null);
  _guestMode = false;
  try { localStorage.removeItem(GUEST_FLAG_KEY); } catch (e) { /* bỏ qua */ }
  try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (e) { /* bỏ qua */ }
  location.reload();
}

// Khởi động: đọc cấu hình -> nếu đang ở chế độ khách hoặc cần đăng nhập mà chưa có phiên -> xử lý tương ứng
async function bootstrapAuthAndData() {
  await loadAppConfig();
  const chip = document.getElementById('btn-user-account');
  if (chip && !chip.dataset.bound) {
    chip.dataset.bound = '1';
    chip.addEventListener('click', signOut);
  }
  const btnGuestMode = document.getElementById('btn-guest-mode');
  if (btnGuestMode && !btnGuestMode.dataset.bound) {
    btnGuestMode.dataset.bound = '1';
    btnGuestMode.addEventListener('click', () => enterGuestMode());
  }
  const btnGuestLogin = document.getElementById('btn-guest-login');
  if (btnGuestLogin && !btnGuestLogin.dataset.bound) {
    btnGuestLogin.dataset.bound = '1';
    btnGuestLogin.addEventListener('click', () => promptLoginFromGuest());
  }

  let isGuestSaved = false;
  try { isGuestSaved = localStorage.getItem(GUEST_FLAG_KEY) === '1'; } catch (e) { /* bỏ qua */ }
  if (isGuestSaved) {
    enterGuestMode({ silent: true });
    return;
  }

  if (_appConfig.authMode === 'google') {
    const sess = getSession();
    if (!sess) {
      showLoginOverlay();
      return;
    }
    _currentUser = sess.user;
    renderUserChip();
  }
  syncWithBackend();
}

function getAppKey() {
  try { return localStorage.getItem(APP_KEY_STORAGE) || ''; } catch (e) { return ''; }
}

// fetch có kèm mật khẩu; nếu server báo 401 thì hỏi mật khẩu 1 lần rồi thử lại
async function apiFetch(url, options = {}, allowPrompt = true) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
  const key = getAppKey();
  if (key) headers['x-app-key'] = key;
  const sess = getSession();
  if (sess && _appConfig.authMode === 'google') headers.Authorization = `Bearer ${sess.token}`;
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (res.status === 401 && _appConfig.authMode === 'google') {
    // Phiên đăng nhập hết hạn -> đăng nhập lại (dữ liệu chưa lưu vẫn giữ trên trình duyệt)
    setSession(null);
    if (!_loginOverlayShown) showLoginOverlay('Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.');
    return res;
  }
  if (res.status === 401 && allowPrompt) {
    const entered = prompt('Trang này đã được đặt mật khẩu. Nhập mật khẩu để xem & lưu tiến độ:');
    if (entered) {
      try { localStorage.setItem(APP_KEY_STORAGE, entered.trim()); } catch (e) { /* bỏ qua */ }
      return apiFetch(url, options, false);
    }
  }
  return res;
}

function setSaveStatus(state, detail) {
  const el = document.getElementById('save-status-indicator');
  if (!el) return;
  const map = {
    saved: { text: '✓ Đã lưu', cls: 'is-saved' },
    pending: { text: '● Chưa lưu…', cls: 'is-pending' },
    saving: { text: '⟳ Đang lưu…', cls: 'is-saving' },
    error: { text: '⚠ Lỗi lưu server', cls: 'is-error' },
    offline: { text: '💾 Chỉ lưu trên máy này', cls: 'is-offline' },
    guest: { text: '💾 Chế độ khách – chỉ lưu trên máy này', cls: 'is-offline' },
    conflict: { text: '⚠ Xung đột dữ liệu', cls: 'is-error' }
  };
  const m = map[state] || map.saved;
  el.textContent = m.text;
  el.className = `save-status ${m.cls}`;
  el.title = detail || ({
    saved: 'Dữ liệu đã được lưu lên server',
    pending: 'Đang chờ gửi thay đổi lên server',
    saving: 'Đang gửi thay đổi lên server',
    error: 'Không gửi được lên server. Dữ liệu vẫn được giữ trên trình duyệt này và sẽ tự gửi lại ở lần lưu sau. Bấm để thử lại ngay.',
    offline: 'Đang mở file trực tiếp (không có server) - dữ liệu chỉ lưu trong trình duyệt này',
    guest: 'Đang ở chế độ khách – mọi thay đổi chỉ lưu trên trình duyệt của máy này (không gửi lên server)',
    conflict: 'Dữ liệu trên server đã bị sửa từ máy khác'
  }[state] || '');
}

function buildServerPayload() {
  return {
    startMonth: AppState.startMonth,
    endMonth: AppState.endMonth,
    scheduleMonth: AppState.scheduleMonth,
    scheduleMonthManualFor: AppState.scheduleMonthManualFor || null,
    viewMode: AppState.viewMode,
    extraWeeksTop: AppState.extraWeeksTop,
    extraWeeksBottom: AppState.extraWeeksBottom,
    projectOwners: AppState.projectOwners,
    daysOffConfig: AppState.daysOffConfig,
    calendars: AppState.calendars,
    activeCalendarId: AppState.activeCalendarId,
    tasks: AppState.tasks,
    companyName: AppState.companyName,
    companyLogo: AppState.companyLogo,
    footerNote: AppState.footerNote,
    showVnHolidays: AppState.showVnHolidays,
    showLunarDates: AppState.showLunarDates,
    mspScope: AppState.mspScope,
    mspZoom: AppState.mspZoom,
    mspRowHeight: AppState.mspRowHeight,
    mspFontWeight: AppState.mspFontWeight,
    exportWatermark: AppState.exportWatermark,
    colorPaletteTheme: AppState.colorPaletteTheme,
    autoCascadeShift: AppState.autoCascadeShift,
    autoLinkNewTasks: AppState.autoLinkNewTasks,
    mspCustomTitlePrefix: AppState.mspCustomTitlePrefix,
    mspColWidths: AppState.mspColWidths,
    mspVisibility: AppState.mspVisibility,
    userManuallyResizedNameCol: !!AppState.userManuallyResizedNameCol,
    collapsedProjects: AppState.collapsedProjects || {},
    collapsedMspOwners: AppState.collapsedMspOwners || {},
    sidebarCollapsed: AppState.sidebarCollapsed || {},
    customTaskTitles: AppState.customTaskTitles || []
  };
}

// Nạp dữ liệu nhận từ server vào AppState
function applyServerData(data) {
  if (!data) return;
  if (data.startMonth) AppState.startMonth = data.startMonth;
  if (data.endMonth) AppState.endMonth = data.endMonth;
  if (data.scheduleMonth) AppState.scheduleMonth = data.scheduleMonth;
  AppState.scheduleMonthManualFor = data.scheduleMonthManualFor || null;
  if (data.viewMode === 'calendar' || data.viewMode === 'msproject') AppState.viewMode = data.viewMode;
  if (data.extraWeeksTop !== undefined) AppState.extraWeeksTop = data.extraWeeksTop;
  if (data.extraWeeksBottom !== undefined) AppState.extraWeeksBottom = data.extraWeeksBottom;
  if (data.projectOwners) AppState.projectOwners = data.projectOwners;
  if (data.daysOffConfig) AppState.daysOffConfig = Object.assign({}, AppState.daysOffConfig, data.daysOffConfig);
  if (data.calendars) AppState.calendars = data.calendars;
  if (data.activeCalendarId) AppState.activeCalendarId = data.activeCalendarId;
  if (data.tasks) AppState.tasks = data.tasks;
  if (data.companyName) AppState.companyName = data.companyName;
  if (data.companyLogo !== undefined) AppState.companyLogo = data.companyLogo;
  if (data.footerNote) AppState.footerNote = data.footerNote;
  if (data.showVnHolidays !== undefined) AppState.showVnHolidays = data.showVnHolidays;
  if (data.showLunarDates !== undefined) AppState.showLunarDates = data.showLunarDates;
  if (data.mspScope) AppState.mspScope = data.mspScope;
  if (data.mspZoom !== undefined) AppState.mspZoom = data.mspZoom;
  if (data.mspRowHeight !== undefined) AppState.mspRowHeight = data.mspRowHeight;
  if (data.mspFontWeight) AppState.mspFontWeight = data.mspFontWeight;
  if (data.exportWatermark !== undefined) AppState.exportWatermark = data.exportWatermark;
  if (data.colorPaletteTheme) AppState.colorPaletteTheme = data.colorPaletteTheme;
  if (data.autoCascadeShift !== undefined) AppState.autoCascadeShift = data.autoCascadeShift;
  if (data.autoLinkNewTasks !== undefined) AppState.autoLinkNewTasks = data.autoLinkNewTasks;
  if (data.mspCustomTitlePrefix !== undefined) AppState.mspCustomTitlePrefix = data.mspCustomTitlePrefix;
  if (data.mspColWidths && typeof data.mspColWidths === 'object') {
    AppState.mspColWidths = Object.assign({}, AppState.mspColWidths, data.mspColWidths);
  }
  if (data.mspVisibility && typeof data.mspVisibility === 'object') {
    AppState.mspVisibility = Object.assign({}, AppState.mspVisibility, data.mspVisibility);
  }
  if (data.userManuallyResizedNameCol !== undefined) {
    AppState.userManuallyResizedNameCol = !!data.userManuallyResizedNameCol;
  }
  if (data.collapsedProjects && typeof data.collapsedProjects === 'object') {
    AppState.collapsedProjects = data.collapsedProjects;
  }
  if (data.collapsedMspOwners && typeof data.collapsedMspOwners === 'object') {
    AppState.collapsedMspOwners = data.collapsedMspOwners;
  }
  if (data.sidebarCollapsed && typeof data.sidebarCollapsed === 'object') {
    AppState.sidebarCollapsed = Object.assign({}, getDefaultLeftSidebarSettings().sidebarCollapsed, data.sidebarCollapsed);
  }
  if (Array.isArray(data.customTaskTitles)) AppState.customTaskTitles = data.customTaskTitles;
}

let _localSavedAt = null;

async function syncWithBackend() {
  if (_guestMode) {
    if (localStorage.getItem(GUEST_STATE_KEY)) {
      loadFromStorage();
    } else {
      resetStateToEmptyGuest();
      saveToStorage();
    }
    normalizeAppState();
    updateUIElements();
    snapshotState();
    setSaveStatus('guest');
    return;
  }

  // 1. Nạp bản lưu trên trình duyệt trước (gồm cả cấu hình cột, palette...)
  _localSavedAt = null;
  loadFromStorage();
  const localTaskCount = Array.isArray(AppState.tasks) ? AppState.tasks.length : 0;
  const localTasksJson = JSON.stringify(AppState.tasks || []);
  const localHadPending = _pendingSync;
  const localBaseVersion = _serverVersion;

  if (isOfflineFileMode()) {
    normalizeAppState();
    updateUIElements();
    snapshotState();
    setSaveStatus('offline');
    return;
  }

  try {
    const res = await apiFetch('/api/schedule');
    if (res.ok) {
      const result = await res.json();
      const serverVersion = typeof result.version === 'number' ? result.version : 0;

      // Phát hiện server bị "reset" (VD: Render cập nhật code làm mất dữ liệu, server trả về bản cũ hơn
      // bản trình duyệt này đã từng lưu) -> hỏi trước, KHÔNG để bản cũ ghi đè lên dữ liệu trên máy
      const serverData = result.data || {};
      const serverUpdatedAt = serverData._updatedAt || null;
      const serverLooksOlder =
        localTaskCount > 0 &&
        localTasksJson !== JSON.stringify(serverData.tasks || []) &&
        ((typeof localBaseVersion === 'number' && serverVersion < localBaseVersion) ||
          (localBaseVersion === null && _localSavedAt && (!serverUpdatedAt || _localSavedAt > serverUpdatedAt)));
      if (!localHadPending && serverLooksOlder) {
        const keepLocal = confirm(
          'Dữ liệu trên server đang CŨ HƠN dữ liệu đã lưu trên trình duyệt này (có thể server vừa cập nhật / khởi động lại).\n\n' +
          `• Trên máy này: ${localTaskCount} việc\n• Trên server: ${(serverData.tasks || []).length} việc\n\n` +
          '• [OK] = GIỮ bản trên máy này và gửi lại lên server (khuyên dùng)\n' +
          '• [Cancel / Huỷ] = Dùng bản trên server'
        );
        if (keepLocal) {
          _serverVersion = serverVersion;
          normalizeAppState();
          updateUIElements();
          snapshotState();
          flushSaveToBackend({ force: true });
          return;
        }
      }

      if (localHadPending && localBaseVersion === serverVersion) {
        // Máy này có thay đổi chưa kịp gửi (mất mạng / tắt trình duyệt) và server chưa đổi -> giữ bản máy này & gửi lên
        _serverVersion = serverVersion;
        normalizeAppState();
        updateUIElements();
        snapshotState();
        flushSaveToBackend();
        return;
      }

      if (localHadPending && localBaseVersion !== serverVersion) {
        const keepServer = confirm(
          'Trình duyệt này có thay đổi CHƯA LƯU lên server, nhưng dữ liệu trên server cũng đã được sửa từ máy khác.\n\n' +
          '• [OK] = Dùng bản trên SERVER (bỏ thay đổi chưa lưu của máy này)\n' +
          '• [Cancel / Huỷ] = Dùng bản của MÁY NÀY và ghi đè lên server'
        );
        _serverVersion = serverVersion;
        if (keepServer) {
          applyServerData(result.data);
          _pendingSync = false;
          normalizeAppState();
          updateUIElements();
          saveToStorage();
          snapshotState();
          setSaveStatus('saved');
        } else {
          normalizeAppState();
          updateUIElements();
          snapshotState();
          flushSaveToBackend({ force: true });
        }
        return;
      }

      _serverVersion = serverVersion;
      if (result.data) applyServerData(result.data);
      _pendingSync = false;
      normalizeAppState();
      updateUIElements();
      saveToStorage();
      snapshotState(); // Mốc Undo ban đầu (trước đây bị thiếu khi có server -> thao tác đầu tiên không Undo được)
      setSaveStatus('saved');
      return;
    }
    if (res.status === 401) {
      showToast('⚠ Sai mật khẩu - đang hiển thị dữ liệu lưu trên trình duyệt này');
    }
  } catch (err) {
    // Mất mạng -> dùng dữ liệu trên trình duyệt
  }
  normalizeAppState();
  updateUIElements();
  snapshotState();
  setSaveStatus(_pendingSync ? 'error' : 'offline', 'Không kết nối được server - đang dùng dữ liệu lưu trên trình duyệt này');
}

// Gọi sau MỖI thay đổi dữ liệu: chuẩn hoá + chụp Undo + lưu trình duyệt + hẹn gửi server
// Tự nối liên kết cho việc VỪA TẠO bằng tay (giống AI đề xuất). Bỏ qua việc nhập file / AI / Notion / nhân bản.
const _autoLinkSeen = new Set();
function autoLinkFreshTasks() {
  if (AppState.autoLinkNewTasks === false || typeof autoLinkTask !== 'function') return 0;
  const now = Date.now();
  const fresh = AppState.tasks.filter(t => {
    if (_autoLinkSeen.has(t.id)) return false;
    const m = /^task_(\d{13})(?:_|$)/.exec(String(t.id));
    return m && now - Number(m[1]) < 60000 && !t.notionPageId && (!Array.isArray(t.predecessors) || !t.predecessors.length);
  });
  AppState.tasks.forEach(t => _autoLinkSeen.add(t.id));
  if (!fresh.length || fresh.length > 3) return 0; // tạo hàng loạt -> không tự nối
  let n = 0;
  fresh.forEach(t => { if (autoLinkTask(t, AppState.tasks, { markAuto: true })) n++; });
  return n;
}

function saveToBackend() {
  normalizeAppState();
  autoLinkFreshTasks();
  if (typeof refreshAllLinkLags === 'function') refreshAllLinkLags(AppState.tasks);
  snapshotState();
  if (_guestMode) {
    _pendingSync = false;
    saveToStorage();
    setSaveStatus('guest');
    return Promise.resolve();
  }
  _pendingSync = true;
  saveToStorage();
  if (isOfflineFileMode()) {
    setSaveStatus('offline');
    return Promise.resolve();
  }
  setSaveStatus('pending');
  clearTimeout(_saveTimer);
  return new Promise(resolve => {
    _saveTimer = setTimeout(() => {
      _saveTimer = null;
      flushSaveToBackend().then(resolve, resolve);
    }, SAVE_DEBOUNCE_MS);
  });
}

async function flushSaveToBackend(opts = {}) {
  if (isOfflineFileMode() || _guestMode) return;
  if (_saveInFlight) {
    _saveAgainAfterFlight = true;
    return;
  }
  _saveInFlight = true;
  setSaveStatus('saving');
  try {
    const body = Object.assign(buildServerPayload(), {
      _baseVersion: _serverVersion,
      _force: !!opts.force
    });
    const res = await apiFetch('/api/schedule', {
      method: 'POST',
      body: JSON.stringify(body),
      keepalive: !!opts.keepalive
    });

    if (res.status === 409) {
      const result = await res.json().catch(() => ({}));
      await handleSaveConflict(result);
      return;
    }
    if (!res.ok) throw new Error('HTTP ' + res.status);

    const result = await res.json();
    if (typeof result.version === 'number') _serverVersion = result.version;
    _pendingSync = false;
    saveToStorage();
    setSaveStatus('saved');
  } catch (err) {
    console.warn('Không lưu được lên server:', err);
    setSaveStatus('error');
  } finally {
    _saveInFlight = false;
    if (_saveAgainAfterFlight) {
      _saveAgainAfterFlight = false;
      flushSaveToBackend();
    }
  }
}

async function handleSaveConflict(result) {
  setSaveStatus('conflict');
  if (_conflictDialogOpen) return;
  _conflictDialogOpen = true;
  try {
    const keepServer = confirm(
      'Dữ liệu trên server vừa được sửa từ một máy/trình duyệt khác.\n\n' +
      '• [OK] = Tải bản mới nhất từ SERVER (bỏ thay đổi vừa làm ở máy này)\n' +
      '• [Cancel / Huỷ] = Giữ bản của MÁY NÀY và ghi đè lên server'
    );
    if (keepServer) {
      if (typeof result.version === 'number') _serverVersion = result.version;
      applyServerData(result.data);
      _pendingSync = false;
      normalizeAppState();
      updateUIElements();
      saveToStorage();
      snapshotState();
      setSaveStatus('saved');
      showToast('Đã tải bản mới nhất từ server.');
    } else {
      _conflictDialogOpen = false;
      _saveInFlight = false;
      await flushSaveToBackend({ force: true });
    }
  } finally {
    _conflictDialogOpen = false;
  }
}

// Đóng tab / F5 khi còn thay đổi chưa gửi -> gửi ngay
window.addEventListener('pagehide', () => {
  if (_saveTimer) {
    clearTimeout(_saveTimer);
    _saveTimer = null;
    flushSaveToBackend({ keepalive: true });
  }
});


function syncHeaderRangeButtonLabel() {
  const lbl = document.getElementById('header-range-btn-label');
  if (!lbl) return;
  const fmt = (ym) => {
    if (!ym || !ym.includes('-')) return ym || '';
    const [y, m] = ym.split('-');
    return `${String(m).padStart(2, '0')}/${y}`;
  };
  lbl.textContent = `Tháng ${fmt(AppState.startMonth)} → ${fmt(AppState.endMonth)}`;
}

function updateUIElements() {
  document.getElementById('start-month-input').value = AppState.startMonth;
  document.getElementById('end-month-input').value = AppState.endMonth;
  syncHeaderRangeButtonLabel();
  const def = getDefaultLeftSidebarSettings();
  const cfg = AppState.daysOffConfig || def.daysOffConfig;
  const holToggle = document.getElementById('toggle-vn-holidays');
  if (holToggle) holToggle.checked = !!cfg.holidays;
  const satHalfToggle = document.getElementById('toggle-off-saturday-half');
  if (satHalfToggle) satHalfToggle.checked = !!cfg.saturdayHalf && !cfg.saturday;
  const satToggle = document.getElementById('toggle-off-saturday');
  if (satToggle) satToggle.checked = !!cfg.saturday;
  const sunToggle = document.getElementById('toggle-off-sunday');
  if (sunToggle) sunToggle.checked = cfg.sunday !== false;
  const lunarToggle = document.getElementById('toggle-lunar-dates');
  if (lunarToggle) lunarToggle.checked = AppState.showLunarDates !== false;
  const cascadeToggle = document.getElementById('toggle-cascade-shift');
  if (cascadeToggle) cascadeToggle.checked = !!AppState.autoCascadeShift;
  const autoLinkToggle = document.getElementById('toggle-auto-link');
  if (autoLinkToggle) autoLinkToggle.checked = AppState.autoLinkNewTasks !== false;

  const scopeSelect = document.getElementById('msp-scope-select');
  if (scopeSelect) {
    scopeSelect.value = AppState.mspScope || def.mspScope;
  }
  document.querySelectorAll('.msp-zoom-btn[data-zoom]').forEach(b => {
    b.classList.toggle('active', b.dataset.zoom === String(AppState.mspZoom || def.mspZoom));
  });
  document.querySelectorAll('.msp-row-height-btn[data-row-height]').forEach(b => {
    b.classList.toggle('active', b.dataset.rowHeight === String(AppState.mspRowHeight || def.mspRowHeight));
  });
  document.querySelectorAll('.msp-font-weight-btn[data-font-weight]').forEach(b => {
    b.classList.toggle('active', b.dataset.fontWeight === String(AppState.mspFontWeight || 'normal'));
  });
  const colChecklist = document.getElementById('demuc-columns-checklist');
  if (colChecklist && AppState.mspVisibility) {
    colChecklist.querySelectorAll('input[type="checkbox"][data-demuc-col]').forEach(chk => {
      const key = chk.dataset.demucCol;
      chk.checked = AppState.mspVisibility[key] !== false;
    });
  }
  const wmChk = document.getElementById('export-watermark');
  if (wmChk) wmChk.checked = AppState.exportWatermark !== false;
  if (typeof syncSidebarCollapseUI === 'function') syncSidebarCollapseUI();

  const monthInput = document.getElementById('schedule-month-input');
  if (monthInput) {
    monthInput.value = getAutoScheduleMonth();
  }
  const mspMonthInput = document.getElementById('msp-month-input');
  if (mspMonthInput) {
    mspMonthInput.value = getAutoScheduleMonth();
  }
  const mspTitlePrefixInput = document.getElementById('msp-title-prefix-input');
  if (mspTitlePrefixInput && document.activeElement !== mspTitlePrefixInput) {
    mspTitlePrefixInput.value = AppState.mspCustomTitlePrefix !== undefined ? AppState.mspCustomTitlePrefix : 'TIẾN ĐỘ THIẾT KẾ DỰ KIẾN -';
  }

  renderPaletteSwatchesUI();
  syncCustomerInputWithActiveCalendar();
  renderCalendarSidebar();
  updateCompanyBranding();
  if (AppState.viewMode === 'msproject') {
    switchViewMode('msproject', true);
  } else {
    renderCalendar();
  }
}

function syncCustomerInputWithActiveCalendar() {
  // Tiêu đề tên dự án tự nhảy theo dự án đang được tích chọn hiển thị.
  // Từ 2 dự án trở lên -> ẩn tên dự án trên tiêu đề.
  const applyTitle = (inputEl, name) => {
    if (!inputEl) return;
    const multi = name === null;
    inputEl.style.display = multi ? 'none' : '';
    inputEl.dataset.multiProject = multi ? '1' : '';
    if (document.activeElement !== inputEl) inputEl.value = multi ? '' : name;
  };
  applyTitle(document.getElementById('customer-name-input'), getTitleProjectName('calendar'));
  applyTitle(document.getElementById('msp-customer-input'), getTitleProjectName('msproject'));

  // Đang lọc "1 tuần tới / 2 tuần tới" -> ghi rõ ngay sau tên dự án trên tiêu đề Timeline
  const badge = document.getElementById('msp-scope-badge');
  if (badge) {
    const win = typeof getMspScopeDateWindow === 'function' ? getMspScopeDateWindow() : null;
    if (win) {
      const fmt = (str) => { const [y, m, d] = str.split('-'); return `${d}/${m}`; };
      badge.textContent = `${win.daysCount === 7 ? '1 TUẦN TỚI' : '2 TUẦN TỚI'} (${fmt(win.startStr)} – ${fmt(win.endStr)})`;
      badge.title = 'Đang lọc chỉ hiện công việc trong khoảng này, KHÔNG phải toàn bộ tiến độ dự án';
      badge.style.display = '';
    } else {
      badge.textContent = '';
      badge.style.display = 'none';
    }
  }
}

function saveToStorage() {
  try {
  localStorage.setItem(getLocalStateKey(), JSON.stringify({
    startMonth: AppState.startMonth,
    endMonth: AppState.endMonth,
    scheduleMonth: AppState.scheduleMonth,
    scheduleMonthManualFor: AppState.scheduleMonthManualFor || null,
    viewMode: AppState.viewMode,
    extraWeeksTop: AppState.extraWeeksTop,
    extraWeeksBottom: AppState.extraWeeksBottom,
    projectOwners: AppState.projectOwners,
    daysOffConfig: AppState.daysOffConfig,
    calendars: AppState.calendars,
    activeCalendarId: AppState.activeCalendarId,
    tasks: AppState.tasks,
    companyName: AppState.companyName,
    companyLogo: AppState.companyLogo,
    footerNote: AppState.footerNote,
    showVnHolidays: AppState.showVnHolidays,
    showLunarDates: AppState.showLunarDates,
    mspRowHeight: AppState.mspRowHeight,
    mspFontWeight: AppState.mspFontWeight,
    mspZoom: AppState.mspZoom,
    customTaskTitles: AppState.customTaskTitles,
    mspScope: AppState.mspScope,
    exportWatermark: AppState.exportWatermark,
    colorPaletteTheme: AppState.colorPaletteTheme,
    autoCascadeShift: AppState.autoCascadeShift,
    autoLinkNewTasks: AppState.autoLinkNewTasks,
    mspCustomTitlePrefix: AppState.mspCustomTitlePrefix,
    mspColWidths: AppState.mspColWidths,
    mspVisibility: AppState.mspVisibility,
    userManuallyResizedNameCol: !!AppState.userManuallyResizedNameCol,
    collapsedProjects: AppState.collapsedProjects || {},
    collapsedMspOwners: AppState.collapsedMspOwners || {},
    sidebarCollapsed: AppState.sidebarCollapsed || {},
    _pendingSync: typeof _pendingSync !== 'undefined' ? _pendingSync : false,
    _serverVersion: typeof _serverVersion !== 'undefined' ? _serverVersion : null,
    _savedAt: new Date().toISOString()
  }));
  } catch (err) {
    console.warn('Không lưu được vào bộ nhớ trình duyệt (có thể do logo quá nặng):', err);
  }
}

function loadFromStorage() {
  const saved = localStorage.getItem(getLocalStateKey());
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.startMonth) AppState.startMonth = parsed.startMonth;
      if (parsed.endMonth) AppState.endMonth = parsed.endMonth;
      if (parsed.scheduleMonth) AppState.scheduleMonth = parsed.scheduleMonth;
      AppState.scheduleMonthManualFor = parsed.scheduleMonthManualFor || null;
      if (parsed.viewMode === 'calendar' || parsed.viewMode === 'msproject') AppState.viewMode = parsed.viewMode;
      if (parsed.extraWeeksTop !== undefined) AppState.extraWeeksTop = parsed.extraWeeksTop;
      if (parsed.extraWeeksBottom !== undefined) AppState.extraWeeksBottom = parsed.extraWeeksBottom;
      if (parsed.projectOwners) AppState.projectOwners = parsed.projectOwners;
      if (parsed.daysOffConfig) AppState.daysOffConfig = Object.assign(AppState.daysOffConfig || {}, parsed.daysOffConfig);
      if (parsed.calendars) AppState.calendars = parsed.calendars;
      if (parsed.activeCalendarId) AppState.activeCalendarId = parsed.activeCalendarId;
      if (parsed.tasks) AppState.tasks = parsed.tasks;
      if (parsed.companyName) AppState.companyName = parsed.companyName;
      if (parsed.companyLogo !== undefined) AppState.companyLogo = parsed.companyLogo;
      if (parsed.footerNote) AppState.footerNote = parsed.footerNote;
      if (parsed.showVnHolidays !== undefined) AppState.showVnHolidays = parsed.showVnHolidays;
      if (parsed.showLunarDates !== undefined) AppState.showLunarDates = parsed.showLunarDates;
      if (parsed.mspRowHeight !== undefined) AppState.mspRowHeight = parsed.mspRowHeight;
      if (parsed.mspFontWeight) AppState.mspFontWeight = parsed.mspFontWeight;
      if (parsed.mspZoom !== undefined) AppState.mspZoom = parsed.mspZoom;
      if (parsed.mspScope) AppState.mspScope = parsed.mspScope;
      if (Array.isArray(parsed.customTaskTitles)) AppState.customTaskTitles = parsed.customTaskTitles;
      if (parsed.exportWatermark !== undefined) AppState.exportWatermark = parsed.exportWatermark;
      if (parsed.colorPaletteTheme) AppState.colorPaletteTheme = parsed.colorPaletteTheme;
      if (parsed.autoCascadeShift !== undefined) AppState.autoCascadeShift = parsed.autoCascadeShift;
      if (parsed.autoLinkNewTasks !== undefined) AppState.autoLinkNewTasks = parsed.autoLinkNewTasks;
      if (parsed.mspCustomTitlePrefix !== undefined) AppState.mspCustomTitlePrefix = parsed.mspCustomTitlePrefix;
      if (parsed.mspColWidths) AppState.mspColWidths = Object.assign(AppState.mspColWidths, parsed.mspColWidths);
      if (parsed.mspVisibility) AppState.mspVisibility = Object.assign(AppState.mspVisibility, parsed.mspVisibility);
      if (parsed.userManuallyResizedNameCol !== undefined) AppState.userManuallyResizedNameCol = !!parsed.userManuallyResizedNameCol;
      if (parsed.collapsedProjects && typeof parsed.collapsedProjects === 'object') AppState.collapsedProjects = parsed.collapsedProjects;
      if (parsed.collapsedMspOwners && typeof parsed.collapsedMspOwners === 'object') AppState.collapsedMspOwners = parsed.collapsedMspOwners;
      if (parsed.sidebarCollapsed && typeof parsed.sidebarCollapsed === 'object') {
        AppState.sidebarCollapsed = Object.assign({}, getDefaultLeftSidebarSettings().sidebarCollapsed, parsed.sidebarCollapsed);
      }
      _pendingSync = !!parsed._pendingSync;
      _serverVersion = typeof parsed._serverVersion === 'number' ? parsed._serverVersion : null;
      _localSavedAt = parsed._savedAt || null;
    } catch (e) {
      console.error(e);
    }
  }
}

// =========================================================================
// SIDEBAR DANH SÁCH "DỰ ÁN CỦA ..." (NHIỀU NGƯỜI DÙNG, SỔ RA & THU GỌN)
// =========================================================================
function renderCalendarSidebar() {
  normalizeAppState();
  const container = document.getElementById('calendar-list-container');
  if (!container) return;
  container.innerHTML = '';

  const activeCal = getActiveCalendar();
  const activeNameEl = document.getElementById('active-cal-name');
  const activeDotEl = document.getElementById('active-cal-dot');
  if (activeNameEl) activeNameEl.textContent = activeCal.name;
  if (activeDotEl) activeDotEl.style.backgroundColor = activeCal.color;

  AppState.projectOwners.forEach(owner => {
    const ownerCalendars = AppState.calendars.filter(c => c.ownerId === owner.id);
    const groupEl = document.createElement('div');
    groupEl.className = `project-owner-group ${owner.collapsed ? 'is-collapsed' : ''}`;

    const headerEl = document.createElement('div');
    headerEl.className = 'project-owner-header';
    headerEl.title = `Dự án "${owner.name}" • Bấm để sổ ra / thu gọn các giai đoạn`;

    const leftHeader = document.createElement('div');
    leftHeader.className = 'project-owner-left';

    const ownerCheck = document.createElement('input');
    ownerCheck.type = 'checkbox';
    ownerCheck.checked = ownerCalendars.length > 0 && ownerCalendars.some(c => c.visible !== false);
    ownerCheck.style.cssText = 'width:13px; height:13px; accent-color:#b91c1c; cursor:pointer; flex-shrink:0;';
    ownerCheck.title = `Bật / Tắt toàn bộ các giai đoạn của dự án "${owner.name}"`;
    ownerCheck.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetVis = ownerCheck.checked;
      ownerCalendars.forEach(c => { c.visible = targetVis; });
      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
    });

    const arrowSpan = document.createElement('span');
    arrowSpan.className = 'project-owner-arrow';
    arrowSpan.textContent = owner.collapsed ? '▶' : '▼';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'project-owner-title';
    titleSpan.innerHTML = `<em>${escapeHtml(owner.name)}</em>`;

    const countSpan = document.createElement('span');
    countSpan.className = 'project-owner-count';
    countSpan.textContent = String(ownerCalendars.length);

    leftHeader.appendChild(ownerCheck);
    leftHeader.appendChild(arrowSpan);
    leftHeader.appendChild(titleSpan);
    leftHeader.appendChild(countSpan);

    const actionsHeader = document.createElement('div');
    actionsHeader.className = 'project-owner-actions';

    const addCalBtn = document.createElement('button');
    addCalBtn.type = 'button';
    addCalBtn.className = 'owner-mini-btn';
    addCalBtn.title = `Thêm giai đoạn mới vào dự án "${owner.name}"`;
    addCalBtn.textContent = '+';
    addCalBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      owner.collapsed = false;
      openCalendarCategoryModal(null, owner.id);
    });
    actionsHeader.appendChild(addCalBtn);

    const renameOwnerBtn = document.createElement('button');
    renameOwnerBtn.type = 'button';
    renameOwnerBtn.className = 'owner-mini-btn';
    renameOwnerBtn.title = `Đổi tên dự án "${owner.name}"`;
    renameOwnerBtn.textContent = '✎';
    renameOwnerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newOwnerName = prompt('Tên dự án (VD: VĂN PHÒNG B4 PHẠM NGỌC THẠCH, NHÀ A DŨNG - HẢI PHÒNG...):', owner.name);
      if (newOwnerName && newOwnerName.trim()) {
        renameProjectAndSync(owner, newOwnerName.trim());
        syncCustomerInputWithActiveCalendar();
        saveToBackend();
        renderCalendarSidebar();
        renderCalendar();
        showToast(`Đã đổi tên dự án thành "${owner.name}"!`);
      }
    });
    actionsHeader.appendChild(renameOwnerBtn);

    if (AppState.projectOwners.length > 1) {
      const delOwnerBtn = document.createElement('button');
      delOwnerBtn.type = 'button';
      delOwnerBtn.className = 'owner-mini-btn del';
      delOwnerBtn.title = `Xóa dự án "${owner.name}"`;
      delOwnerBtn.textContent = '×';
      delOwnerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Xóa dự án "${owner.name}"? (Các giai đoạn bên trong sẽ được chuyển sang dự án đầu tiên, không mất công việc)`)) {
          const fallbackOwner = AppState.projectOwners.find(o => o.id !== owner.id);
          if (fallbackOwner) {
            AppState.calendars.forEach(c => {
              if (c.ownerId === owner.id) c.ownerId = fallbackOwner.id;
            });
          }
          AppState.projectOwners = AppState.projectOwners.filter(o => o.id !== owner.id);
          saveToBackend();
          renderCalendarSidebar();
        }
      });
      actionsHeader.appendChild(delOwnerBtn);
    }

    headerEl.addEventListener('click', () => {
      owner.collapsed = !owner.collapsed;
      saveToBackend();
      renderCalendarSidebar();
    });

    // Hỗ trợ kéo thả giai đoạn hoặc công việc vào tiêu đề Dự án bên thanh trái
    headerEl.addEventListener('dragover', (e) => {
      if (!_mspDragPayload) return;
      e.preventDefault();
      headerEl.style.outline = '2px dashed #b91c1c';
    });
    headerEl.addEventListener('dragleave', () => {
      headerEl.style.outline = '';
    });
    headerEl.addEventListener('drop', (e) => {
      e.preventDefault();
      headerEl.style.outline = '';
      if (!_mspDragPayload) return;
      if (_mspDragPayload.type === 'project') {
        const cal = AppState.calendars.find(c => c.id === _mspDragPayload.calId);
        if (cal && cal.ownerId !== owner.id) {
          cal.ownerId = owner.id;
          owner.collapsed = false;
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã chuyển giai đoạn "${cal.name}" sang dự án "${owner.name}"!`);
        }
      } else if (_mspDragPayload.type === 'task') {
        let targetCal = AppState.calendars.find(c => c.ownerId === owner.id);
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
        let movedCount = 0;
        AppState.tasks.forEach(t => {
          if (idsToMove.includes(t.id)) {
            t.calendarId = targetCal.id;
            movedCount++;
          }
        });
        if (movedCount > 0) {
          targetCal.hasManualTaskOrder = true;
          owner.collapsed = false;
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã chuyển ${movedCount} công việc sang dự án "${owner.name}" (${targetCal.name})!`);
        }
      }
    });

    headerEl.appendChild(leftHeader);
    headerEl.appendChild(actionsHeader);
    groupEl.appendChild(headerEl);

    const bodyEl = document.createElement('div');
    bodyEl.className = 'project-owner-body';

    if (ownerCalendars.length === 0) {
      const emptyNote = document.createElement('div');
      emptyNote.style.cssText = 'font-size:10.5px; color:#94a3b8; padding:4px 6px;';
      emptyNote.textContent = 'Chưa có dự án nào (Bấm + để thêm)';
      bodyEl.appendChild(emptyNote);
    }

    ownerCalendars.forEach(cal => {
      const item = document.createElement('div');
      item.className = `calendar-list-item ${cal.id === AppState.activeCalendarId ? 'active-selected' : ''}`;
      item.title = `Bấm để chọn giai đoạn "${cal.name}" (dự án ${owner.name})`;

      const leftDiv = document.createElement('div');
      leftDiv.className = 'cal-item-left';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'cal-visibility-check';
      checkbox.checked = cal.visible !== false;
      checkbox.style.accentColor = cal.color;
      checkbox.title = 'Ẩn / Hiện các công việc của lịch này';
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        cal.visible = checkbox.checked;
        saveToBackend();
        renderCalendar();
      });

      const colorBox = document.createElement('span');
      colorBox.className = 'cal-color-box';
      colorBox.style.backgroundColor = cal.color;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'cal-item-name';
      const taskCount = AppState.tasks.filter(t => t.calendarId === cal.id).length;
      nameSpan.textContent = `${cal.name} (${taskCount})`;

      leftDiv.appendChild(checkbox);
      leftDiv.appendChild(colorBox);
      leftDiv.appendChild(nameSpan);

      item.addEventListener('click', () => {
        AppState.activeCalendarId = cal.id;
        cal.visible = true;
        popoverColor = cal.color;
        syncCustomerInputWithActiveCalendar();
        saveToBackend();
        renderCalendarSidebar();
        renderCalendar();
      });

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'cal-item-actions';

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'cal-action-btn';
      editBtn.title = 'Đổi tên khách hàng, người phụ trách hoặc màu lịch';
      editBtn.innerHTML = '<i data-lucide="edit-2"></i>';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCalendarCategoryModal(cal, cal.ownerId);
      });
      actionsDiv.appendChild(editBtn);

      if (AppState.calendars.length > 1) {
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'cal-action-btn';
        delBtn.title = 'Xóa danh mục lịch này';
        delBtn.innerHTML = '<i data-lucide="trash-2"></i>';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Bạn có chắc muốn xóa hẳn danh mục lịch "${cal.name}" và toàn bộ các công việc bên trong không?`)) {
            AppState.tasks = AppState.tasks.filter(t => t.calendarId !== cal.id);
            AppState.calendars = AppState.calendars.filter(c => c.id !== cal.id);
            normalizeAppState();
            syncCustomerInputWithActiveCalendar();
            saveToBackend();
            renderCalendarSidebar();
            renderCalendar();
          }
        });
        actionsDiv.appendChild(delBtn);
      }

      item.appendChild(leftDiv);
      item.appendChild(actionsDiv);
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        _mspDragPayload = { type: 'project', calId: cal.id };
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', `project:${cal.id}`);
        }
      });
      item.addEventListener('dragover', (e) => {
        if (!_mspDragPayload) return;
        e.preventDefault();
        item.style.outline = '1.5px dashed #b91c1c';
      });
      item.addEventListener('dragleave', () => {
        item.style.outline = '';
      });
      item.addEventListener('drop', (e) => {
        e.preventDefault();
        item.style.outline = '';
        if (!_mspDragPayload) return;
        if (_mspDragPayload.type === 'project' && _mspDragPayload.calId !== cal.id) {
          const fromIdx = AppState.calendars.findIndex(c => c.id === _mspDragPayload.calId);
          if (fromIdx !== -1) {
            const [movedCal] = AppState.calendars.splice(fromIdx, 1);
            movedCal.ownerId = cal.ownerId;
            const toIdx = AppState.calendars.findIndex(c => c.id === cal.id);
            AppState.calendars.splice(toIdx !== -1 ? toIdx : AppState.calendars.length, 0, movedCal);
            _mspDragPayload = null;
            syncAllFromMSProject(`Đã chuyển giai đoạn "${movedCal.name}" vào dự án "${owner.name}"!`);
          }
        } else if (_mspDragPayload.type === 'task') {
          const idsToMove = Array.isArray(_mspDragPayload.taskIds) && _mspDragPayload.taskIds.length > 0
            ? _mspDragPayload.taskIds
            : [_mspDragPayload.taskId];
          let movedCount = 0;
          AppState.tasks.forEach(t => {
            if (idsToMove.includes(t.id)) {
              t.calendarId = cal.id;
              movedCount++;
            }
          });
          if (movedCount > 0) {
            cal.hasManualTaskOrder = true;
            _mspDragPayload = null;
            syncAllFromMSProject(`Đã chuyển ${movedCount} công việc sang giai đoạn "${cal.name}"!`);
          }
        }
      });
      item.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (typeof openProjectContextMenu === 'function') {
          openProjectContextMenu(e, cal);
        }
      });
      bodyEl.appendChild(item);
    });

    groupEl.appendChild(bodyEl);
    container.appendChild(groupEl);
  });

  if (typeof renderDemucSidebar === 'function') {
    renderDemucSidebar();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

let selectedCalCatColor = '#cc0000';

function openCalendarCategoryModal(cal = null, presetOwnerId = null) {
  normalizeAppState();
  const modal = document.getElementById('calendar-category-modal');
  const titleEl = document.getElementById('modal-cal-cat-title');
  const idInput = document.getElementById('cal-cat-id');
  const nameInput = document.getElementById('cal-cat-name');
  const ownerSelect = document.getElementById('cal-cat-owner');

  const targetOwnerId = (cal && cal.ownerId) || presetOwnerId || AppState.projectOwners[0].id;
  if (ownerSelect) {
    ownerSelect.innerHTML = AppState.projectOwners.map(o =>
      `<option value="${o.id}" ${o.id === targetOwnerId ? 'selected' : ''}>${escapeHtml(o.name)}</option>`
    ).join('');
  }

  if (cal) {
    titleEl.textContent = 'Sửa giai đoạn';
    idInput.value = cal.id;
    nameInput.value = cal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? '' : cal.name;
    selectedCalCatColor = cal.color || getActivePaletteColors()[0];
  } else {
    titleEl.textContent = 'Thêm giai đoạn mới';
    idInput.value = '';
    nameInput.value = '';
    const pal = getActivePaletteColors();
    selectedCalCatColor = pal[AppState.calendars.length % pal.length];
  }

  renderPaletteSwatchesUI();

  modal.classList.add('active');
  setTimeout(() => nameInput.focus(), 40);
}

function closeCalendarCategoryModal() {
  document.getElementById('calendar-category-modal').classList.remove('active');
}

function setupSidebarEvents() {
  const toggleBtn = document.getElementById('btn-toggle-sidebar');
  const sidebar = document.getElementById('app-sidebar');
  if (toggleBtn && sidebar) {
    toggleBtn.addEventListener('click', () => {
      sidebar.classList.toggle('collapsed');
    });
  }

  // Chọn giao diện Palette màu ở Sidebar -> Tự nhảy màu theo thứ tự Palette
  const sidebarPaletteSelect = document.getElementById('sidebar-palette-select');
  if (sidebarPaletteSelect) {
    sidebarPaletteSelect.addEventListener('change', (e) => {
      AppState.colorPaletteTheme = e.target.value || 'default';
      applyPaletteSequenceToTasks(null, false);
    });
  }

  const btnApplyPaletteSeq = document.getElementById('btn-apply-palette-sequence');
  if (btnApplyPaletteSeq) {
    btnApplyPaletteSeq.addEventListener('click', () => {
      applyPaletteSequenceToTasks(null, false);
    });
  }

  const toggleCascadeShift = document.getElementById('toggle-cascade-shift');
  if (toggleCascadeShift) {
    toggleCascadeShift.addEventListener('change', (e) => {
      AppState.autoCascadeShift = e.target.checked;
      saveToBackend();
      showToast(AppState.autoCascadeShift
        ? '🔄 Đã BẬT tự động dịch các mục sau khi chỉnh ngày (giữ nguyên số ngày làm việc)!'
        : 'Đã TẮT tự động dịch các mục sau khi chỉnh ngày.');
    });
  }

  const addOwnerBtn = document.getElementById('btn-add-project-owner');
  if (addOwnerBtn) {
    addOwnerBtn.addEventListener('click', () => {
      const ownerName = prompt('Tên DỰ ÁN mới (VD: VĂN PHÒNG B4 PHẠM NGỌC THẠCH, NHÀ A DŨNG - HẢI PHÒNG...):');
      if (ownerName && ownerName.trim()) {
        const newOwner = {
          id: 'owner_' + Date.now(),
          name: ownerName.trim().toUpperCase(),
          collapsed: false
        };
        AppState.projectOwners.push(newOwner);
        // Tạo sẵn 1 giai đoạn đầu tiên cho dự án mới & chọn luôn
        const pal = getActivePaletteColors();
        const firstStage = {
          id: 'cal_' + Date.now(),
          ownerId: newOwner.id,
          name: 'GIAI ĐOẠN 1',
          customerName: 'GIAI ĐOẠN 1',
          color: pal[AppState.calendars.length % pal.length],
          visible: true
        };
        AppState.calendars.push(firstStage);
        AppState.activeCalendarId = firstStage.id;
        syncCustomerInputWithActiveCalendar();
        saveToBackend();
        renderCalendarSidebar();
        renderCalendar();
        showToast(`Đã tạo dự án "${newOwner.name}" (kèm "GIAI ĐOẠN 1" - bấm ✎ để đổi tên)`);
      }
    });
  }

  // Ô nhập tên DỰ ÁN trên tiêu đề trên cùng: luôn đồng bộ 2 chiều với Dự án đang chọn bên trái + tiêu đề Timeline
  const custInput = document.getElementById('customer-name-input');
  if (custInput) {
    custInput.addEventListener('input', () => {
      const activeProj = getTitleProject('calendar') || getActiveProject();
      if (activeProj) {
        renameProjectAndSync(activeProj, custInput.value);
      } else {
        const activeCal = getActiveCalendar();
        renameCalendarAndSyncTasks(activeCal, custInput.value);
      }
      const mspCustInput = document.getElementById('msp-customer-input');
      if (mspCustInput && document.activeElement !== mspCustInput) {
        mspCustInput.value = custInput.value;
      }
      renderCalendarSidebar();
      renderCalendar();
      saveToBackend();
    });
  }

  // Ô chỉnh sửa tháng đang lập bảng bên trái tiêu đề
  const monthInput = document.getElementById('schedule-month-input');
  if (monthInput) {
    monthInput.addEventListener('input', () => {
      setManualScheduleMonth(monthInput.value);
      saveToBackend();
    });
  }

  const createBtnSidebar = document.getElementById('btn-sidebar-create-task');
  if (createBtnSidebar) {
    createBtnSidebar.addEventListener('click', () => {
      openTaskModal();
    });
  }

  document.getElementById('btn-open-new-calendar-modal').addEventListener('click', () => {
    openCalendarCategoryModal(null);
  });

  document.getElementById('btn-close-cal-cat-modal').addEventListener('click', closeCalendarCategoryModal);
  document.getElementById('btn-cancel-cal-cat').addEventListener('click', closeCalendarCategoryModal);

  document.querySelectorAll('#cal-cat-color-palette .color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      document.querySelectorAll('#cal-cat-color-palette .color-swatch').forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      selectedCalCatColor = sw.dataset.color;
    });
  });

  document.getElementById('calendar-category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('cal-cat-id').value;
    const name = document.getElementById('cal-cat-name').value.trim().toUpperCase();
    const ownerSelect = document.getElementById('cal-cat-owner');
    const chosenOwnerId = (ownerSelect && ownerSelect.value) || AppState.projectOwners[0].id;
    if (!name) return;

    if (id) {
      const cal = AppState.calendars.find(c => c.id === id);
      if (cal) {
        renameCalendarAndSyncTasks(cal, name);
        cal.color = selectedCalCatColor;
        cal.ownerId = chosenOwnerId;
      }
    } else {
      const newCal = {
        id: 'cal_' + Date.now(),
        ownerId: chosenOwnerId,
        name,
        customerName: name,
        color: selectedCalCatColor,
        visible: true
      };
      AppState.calendars.push(newCal);
      AppState.activeCalendarId = newCal.id;
      popoverColor = newCal.color;
    }

    syncCustomerInputWithActiveCalendar();
    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    closeCalendarCategoryModal();
  });

  document.getElementById('btn-clear-active-calendar').addEventListener('click', () => {
    const activeCal = getActiveCalendar();
    const count = AppState.tasks.filter(t => t.calendarId === activeCal.id).length;
    if (count === 0) {
      alert(`Danh mục lịch "${activeCal.name}" hiện đang trống, không có công việc nào để xóa.`);
      return;
    }
    if (confirm(`Bạn có chắc chắn muốn XÓA TOÀN BỘ ${count} công việc thuộc lịch "${activeCal.name}" không?\n(Các danh mục lịch khác vẫn được giữ nguyên)`)) {
      AppState.tasks = AppState.tasks.filter(t => t.calendarId !== activeCal.id);
      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
    }
  });
}

// Helpers


// Kiểm tra 1 ngày có nằm trong các tùy chọn Ngày nghỉ (Ngày lễ ở Việt Nam, Thứ 7, Nghỉ chiều Thứ 7, Chủ nhật) hay không


function getVisibleTasks() {
  const visibleCalIds = new Set(
    (AppState.calendars || []).filter(c => c.visible !== false).map(c => c.id)
  );
  return (AppState.tasks || []).filter(t => visibleCalIds.has(t.calendarId) && t.visibleOnBoard !== false);
}

function getMaxTaskEndDateStr() {
  let maxStr = null;
  getVisibleTasks().forEach(t => {
    if (t.endDate && (!maxStr || t.endDate > maxStr)) {
      maxStr = t.endDate;
    }
  });
  return maxStr;
}

function getMinTaskStartDateStr() {
  let minStr = null;
  getVisibleTasks().forEach(t => {
    if (t.startDate && (!minStr || t.startDate < minStr)) {
      minStr = t.startDate;
    }
  });
  return minStr;
}

// Tạo danh sách các tuần
function generateCalendarWeeks(startMonthStr, endMonthStr, ignoreExtra = false) {
  const [sYear, sMonth] = startMonthStr.split('-').map(Number);
  const [eYear, eMonth] = endMonthStr.split('-').map(Number);

  let startDate = new Date(sYear, sMonth - 1, 1);
  let endDate = new Date(eYear, eMonth, 0);

  if (!ignoreExtra) {
    const minTaskStr = getMinTaskStartDateStr();
    if (minTaskStr) {
      const minTaskDate = parseDateStr(minTaskStr);
      if (minTaskDate < startDate) startDate = new Date(minTaskDate);
    }

    const maxTaskStr = getMaxTaskEndDateStr();
    if (maxTaskStr) {
      const maxTaskDate = parseDateStr(maxTaskStr);
      const requiredEndWithEmptyRow = new Date(maxTaskDate);
      requiredEndWithEmptyRow.setDate(requiredEndWithEmptyRow.getDate() + 7);
      if (requiredEndWithEmptyRow > endDate) {
        endDate = requiredEndWithEmptyRow;
      }
    }
  }

  let current = new Date(startDate);
  let dayOfWeek = current.getDay();
  let diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  current.setDate(current.getDate() + diffToMonday);

  if (!ignoreExtra && AppState.extraWeeksTop) {
    current.setDate(current.getDate() - AppState.extraWeeksTop * 7);
  }

  let endSunday = new Date(endDate);
  let endDayOfWeek = endSunday.getDay();
  if (endDayOfWeek !== 0) {
    endSunday.setDate(endSunday.getDate() + (7 - endDayOfWeek));
  }

  if (!ignoreExtra && AppState.extraWeeksBottom) {
    endSunday.setDate(endSunday.getDate() + AppState.extraWeeksBottom * 7);
  }

  if (endSunday <= current) {
    endSunday = new Date(current);
    endSunday.setDate(endSunday.getDate() + 13);
  }

  const weeks = [];
  while (current <= endSunday) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  // Luôn đảm bảo hàng cuối cùng bên dưới timeline là hàng lịch trống
  if (!ignoreExtra && weeks.length > 0) {
    const visibleTasks = getVisibleTasks();
    const lastWeek = weeks[weeks.length - 1];
    const lastWeekStartStr = formatDateStr(lastWeek[0]);
    const lastWeekEndStr = formatDateStr(lastWeek[6]);
    const hasTaskInLastWeek = visibleTasks.some(t => !(t.endDate < lastWeekStartStr || t.startDate > lastWeekEndStr));
    if (hasTaskInLastWeek) {
      const emptyWeek = [];
      for (let i = 0; i < 7; i++) {
        emptyWeek.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(emptyWeek);
    }
  }

  return weeks;
}

function generateWeeksBetweenDates(startDateStr, endDateStr) {
  let startDate = parseDateStr(startDateStr);
  let endDate = parseDateStr(endDateStr);

  let current = new Date(startDate);
  let dayOfWeek = current.getDay();
  let diffToMonday = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
  current.setDate(current.getDate() + diffToMonday);

  let endSunday = new Date(endDate);
  let endDayOfWeek = endSunday.getDay();
  if (endDayOfWeek !== 0) {
    endSunday.setDate(endSunday.getDate() + (7 - endDayOfWeek));
  }

  const weeks = [];
  while (current <= endSunday) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }
  return weeks;
}


// Trạng thái Tương tác
let isSelecting = false;
let selectionStartStr = null;
let selectionEndStr = null;

let isResizing = false;
let resizeTask = null;
let resizeType = null;
let resizePreviewStart = null;
let resizePreviewEnd = null;

let isCropMode = false;
let isDraggingCrop = false;
let cropStartWeekIdx = null;
let cropEndWeekIdx = null;
let currentRenderedWeeks = [];

function showFloatingTooltip(text, x, y) {
  const tip = document.getElementById('floating-action-tooltip');
  if (!tip) return;
  tip.textContent = text;
  tip.style.display = 'block';
  tip.style.left = `${Math.min(x + 14, window.innerWidth - 220)}px`;
  tip.style.top = `${Math.max(y - 34, 10)}px`;
}

function hideFloatingTooltip() {
  const tip = document.getElementById('floating-action-tooltip');
  if (tip) tip.style.display = 'none';
}

// Tìm ngày hiển thị thực tế đầu tiên & cuối cùng của 1 công việc trên Bảng Lịch
// (Khắc phục triệt để lỗi công việc kết thúc vào ngày nghỉ Chủ nhật / Thứ 7 / Lễ bị mất nút kéo đầu mút cuối)
function getTaskEffectiveRenderBounds(task) {
  if (!task || !task.startDate || !task.endDate) {
    return { firstDateStr: '', lastDateStr: '', allOff: false };
  }
  if (task.skipSundays === false) {
    return { firstDateStr: task.startDate, lastDateStr: task.endDate, allOff: false };
  }
  let firstDateStr = null;
  let lastDateStr = null;
  const curr = parseDateStr(task.startDate);
  const end = parseDateStr(task.endDate);
  while (curr <= end) {
    if (!isDateDayOff(curr, true).isOff) {
      const dStr = formatDateStr(curr);
      if (!firstDateStr) firstDateStr = dStr;
      lastDateStr = dStr;
    }
    curr.setDate(curr.getDate() + 1);
  }
  if (!firstDateStr || !lastDateStr) {
    return { firstDateStr: task.startDate, lastDateStr: task.endDate, allOff: true };
  }
  return { firstDateStr, lastDateStr, allOff: false };
}

// Render Calendar
function renderCalendar(targetWeeks = null, customContainer = null) {
  const gridContainer = customContainer || document.getElementById('calendar-grid');
  gridContainer.innerHTML = '';

  const weeks = targetWeeks || generateCalendarWeeks(AppState.startMonth, AppState.endMonth);
  if (!customContainer) {
    currentRenderedWeeks = weeks;
  }

  const visibleTasks = getVisibleTasks();
  const todayStr = formatDateStr(new Date());

  if (!customContainer && weeks.length > 0) {
    syncHeaderRangeButtonLabel();
    const firstDay = weeks[0][0];
    const lastDay = weeks[weeks.length - 1][6];
    document.getElementById('display-range-title').textContent = 
      `Tháng ${firstDay.getMonth() + 1}, ${firstDay.getFullYear()} - Tháng ${lastDay.getMonth() + 1}, ${lastDay.getFullYear()}`;
    
    const exportLabel = document.getElementById('export-all-label');
    if (exportLabel) {
      exportLabel.textContent = `${firstDay.getDate()}/${firstDay.getMonth() + 1}/${firstDay.getFullYear()} - ${lastDay.getDate()}/${lastDay.getMonth() + 1}/${lastDay.getFullYear()}`;
    }
  }

  weeks.forEach((week, weekIndex) => {
    const weekRow = document.createElement('div');
    weekRow.className = `calendar-week-row ${weekIndex % 2 === 0 ? 'row-even' : 'row-odd'}`;
    weekRow.dataset.weekIndex = weekIndex;
    weekRow.dataset.weekStart = formatDateStr(week[0]);
    weekRow.dataset.weekEnd = formatDateStr(week[6]);

    // Background ngày
    const bgRow = document.createElement('div');
    bgRow.className = 'week-days-background';

    week.forEach((dayDate, dayIdx) => {
      const dayCell = document.createElement('div');
      const dayStr = formatDateStr(dayDate);
      dayCell.className = 'day-cell';
      dayCell.dataset.date = dayStr;
      dayCell.dataset.weekIndex = weekIndex;

      const dayOffInfo = isDateDayOff(dayDate, true);
      if (dayOffInfo.type === 'sunday' || dayOffInfo.type === 'saturday') {
        dayCell.classList.add('sunday-cell');
      }
      if (dayOffInfo.isCustom && dayOffInfo.isOff) dayCell.classList.add('is-custom-off');
      if (dayOffInfo.type === 'makeup-work' || dayOffInfo.type === 'custom-work') {
        dayCell.classList.add('is-workday-forced');
        dayCell.title = dayOffInfo.reason;
      }
      dayCell.addEventListener('contextmenu', (e) => {
        if (e.target.closest && e.target.closest('.task-bar-segment')) return;
        e.preventDefault();
        openDayOverrideContextMenu(e, dayStr);
      });

      const dayNum = dayDate.getDate();
      const monthNum = dayDate.getMonth() + 1;

      if (dayStr === todayStr) {
        dayCell.classList.add('today');
      }

      const dayHeader = document.createElement('div');
      dayHeader.className = 'day-header';

      if (dayNum === 1) {
        const monthLabel = document.createElement('span');
        monthLabel.className = 'day-month-label is-month-first';
        monthLabel.textContent = `1 thg ${monthNum}`;
        dayHeader.appendChild(monthLabel);
      } else {
        const numCircle = document.createElement('span');
        numCircle.className = 'day-number-circle';
        numCircle.textContent = dayNum;
        dayHeader.appendChild(numCircle);
      }

      // Hiển thị Ngày Âm lịch bên phải ngày Dương (60% kích thước, nét cực mảnh)
      if (AppState.showLunarDates !== false) {
        const lunarInfo = getLunarDateDisplay(dayDate);
        if (lunarInfo.text) {
          const lunarSpan = document.createElement('span');
          lunarSpan.className = `lunar-date-label ${lunarInfo.isFirst ? 'lunar-first-day' : ''}`;
          lunarSpan.textContent = lunarInfo.text;
          lunarSpan.title = `Âm lịch: ${lunarInfo.text}`;
          dayHeader.appendChild(lunarSpan);
        }
      }

      dayCell.appendChild(dayHeader);
      bgRow.appendChild(dayCell);
    });

    weekRow.appendChild(bgRow);

    // Lớp chứa các thanh tiến độ
    const weekStartStr = formatDateStr(week[0]);
    const weekEndStr = formatDateStr(week[6]);

    const activeTasksInWeek = visibleTasks.filter(task => {
      return !(task.endDate < weekStartStr || task.startDate > weekEndStr);
    });

    const eventsLayer = document.createElement('div');
    eventsLayer.className = 'week-events-layer';

    const weekSegments = [];

    activeTasksInWeek.forEach(task => {
      const bounds = getTaskEffectiveRenderBounds(task);
      const shouldSkipSunday = task.skipSundays !== false && !bounds.allOff;
      const rawSegStart = task.startDate < weekStartStr ? 0 : week.findIndex(d => formatDateStr(d) === task.startDate);
      const rawSegEnd = task.endDate > weekEndStr ? 6 : week.findIndex(d => formatDateStr(d) === task.endDate);

      if (!shouldSkipSunday) {
        weekSegments.push({
          task,
          colStart: rawSegStart,
          colEnd: rawSegEnd,
          isOverallStart: formatDateStr(week[rawSegStart]) === bounds.firstDateStr,
          isOverallEnd: formatDateStr(week[rawSegEnd]) === bounds.lastDateStr
        });
      } else {
        let c = rawSegStart;
        while (c <= rawSegEnd) {
          while (c <= rawSegEnd && isDateDayOff(week[c], true).isOff) c++;
          if (c > rawSegEnd) break;
          const partStart = c;
          while (c <= rawSegEnd && !isDateDayOff(week[c], true).isOff) c++;
          const partEnd = c - 1;
          weekSegments.push({
            task,
            colStart: partStart,
            colEnd: partEnd,
            isOverallStart: formatDateStr(week[partStart]) === bounds.firstDateStr,
            isOverallEnd: formatDateStr(week[partEnd]) === bounds.lastDateStr
          });
        }
      }
    });

    const tracks = [];
    weekSegments.forEach(item => {
      let trackIndex = -1;
      for (let t = 0; t < tracks.length; t++) {
        let isFree = true;
        for (let col = item.colStart; col <= item.colEnd; col++) {
          if (tracks[t][col]) {
            isFree = false;
            break;
          }
        }
        if (isFree) {
          trackIndex = t;
          break;
        }
      }

      if (trackIndex === -1) {
        tracks.push(new Array(7).fill(false));
        trackIndex = tracks.length - 1;
      }

      for (let col = item.colStart; col <= item.colEnd; col++) {
        tracks[trackIndex][col] = true;
      }

      item.trackIndex = trackIndex;
    });

    tracks.forEach((_, tIdx) => {
      const trackRow = document.createElement('div');
      trackRow.className = 'event-track-row';

      const segmentsOnTrack = weekSegments.filter(s => s.trackIndex === tIdx);
      segmentsOnTrack.forEach(item => {
        const task = item.task;
        const seg = document.createElement('div');
        seg.className = 'task-bar-segment';
        seg.dataset.taskId = task.id;
        const barColor = task.color || '#cc0000';
        seg.style.backgroundColor = barColor;
        seg.style.color = getContrastTextColor(barColor);
        seg.style.gridColumn = `${item.colStart + 1} / ${item.colEnd + 2}`;

        if (item.isOverallStart) seg.classList.add('is-start');
        else seg.classList.add('not-start');

        if (item.isOverallEnd) seg.classList.add('is-end');
        else seg.classList.add('not-end');

        if (!customContainer && item.isOverallStart) {
          const handleStart = document.createElement('div');
          handleStart.className = 'resize-handle handle-start';
          handleStart.title = 'Kéo để đổi ngày bắt đầu';
          handleStart.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResizing(task, 'start', e.clientX, e.clientY);
          });
          seg.appendChild(handleStart);
        }

        const titleSpan = document.createElement('span');
        titleSpan.className = 'task-text';
        titleSpan.textContent = task.title;
        seg.appendChild(titleSpan);

        const calc = calculateTaskDays(task.startDate, task.endDate, task.skipSundays !== false);
        if (task.showCount !== false) {
          const badge = document.createElement('span');
          badge.className = 'task-day-badge';
          badge.textContent = `${calc.workDays} ngày`;
          seg.appendChild(badge);
        }

        if (!customContainer && item.isOverallEnd) {
          const handleEnd = document.createElement('div');
          handleEnd.className = 'resize-handle handle-end';
          handleEnd.title = 'Kéo để đổi ngày kết thúc';
          handleEnd.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            startResizing(task, 'end', e.clientX, e.clientY);
          });
          seg.appendChild(handleEnd);
        }

        const calObj = AppState.calendars.find(c => c.id === task.calendarId);
        const calLabel = calObj ? `[${calObj.name}] ` : '';
        seg.title = `${calLabel}${task.title} (${task.startDate} -> ${task.endDate}) | ${calc.workDays} ngày làm việc`;

        if (!customContainer) {
          seg.addEventListener('click', (e) => {
            if (isResizing || isCropMode) return;
            e.stopPropagation();
            closeQuickPopover();
            openTaskModal(task);
          });
          seg.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            closeQuickPopover();
            if (typeof openTaskContextMenu === 'function') {
              openTaskContextMenu(e, task);
            }
          });
        }

        trackRow.appendChild(seg);
      });

      eventsLayer.appendChild(trackRow);
    });

    // LỊCH RIÊNG CHO NGÀY LỄ VIỆT NAM
    {
      const weekHolidays = [];
      week.forEach((d, cIdx) => {
        const dStr = formatDateStr(d);
        const label = getDayLabelInfo(dStr);
        if (label) {
          weekHolidays.push({ col: cIdx, dateStr: dStr, name: label.name, type: label.type });
        }
      });

      if (weekHolidays.length > 0) {
        const holTrackRow = document.createElement('div');
        holTrackRow.className = 'event-track-row';
        holTrackRow.style.marginTop = '4px';

        let i = 0;
        while (i < weekHolidays.length) {
          const startHol = weekHolidays[i];
          let endCol = startHol.col;
          let j = i + 1;
          while (j < weekHolidays.length && weekHolidays[j].col === endCol + 1 && weekHolidays[j].name === startHol.name && weekHolidays[j].type === startHol.type) {
            endCol = weekHolidays[j].col;
            j++;
          }

          const holSeg = document.createElement('div');
          holSeg.className = `holiday-bar-segment is-start is-end is-${startHol.type}`;
          holSeg.style.gridColumn = `${startHol.col + 1} / ${endCol + 2}`;
          holSeg.textContent = startHol.name;
          holSeg.title = {
            'off': `Ngày nghỉ lễ: ${startHol.name}`,
            'makeup-work': `Ngày ĐI LÀM (làm bù): ${startHol.name}`,
            'observance': `${startHol.name} - chỉ để biết, KHÔNG tính là ngày nghỉ`,
            'custom-off': 'Ngày nghỉ riêng do bạn tự đánh dấu (chuột phải vào ô ngày để bỏ)'
          }[startHol.type] || startHol.name;
          holTrackRow.appendChild(holSeg);

          i = j;
        }

        eventsLayer.appendChild(holTrackRow);
      }
    }

    weekRow.appendChild(eventsLayer);
    gridContainer.appendChild(weekRow);
  });

  if (!customContainer && typeof renderMSProjectView === 'function') {
    renderMSProjectView();
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// =========================================================================
// HỆ THỐNG KÉO THẢ & QUÉT NGÀY ỔN ĐỊNH
// =========================================================================
function findDayCellFromPoint(clientX, clientY) {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return null;
  const directCell = el.closest('.day-cell');
  if (directCell) return directCell;

  const weekRow = el.closest('.calendar-week-row');
  if (weekRow) {
    const cells = weekRow.querySelectorAll('.day-cell');
    for (const c of cells) {
      const rect = c.getBoundingClientRect();
      if (clientX >= rect.left && clientX <= rect.right) {
        return c;
      }
    }
  }
  return null;
}

function highlightSelection(startStr, endStr) {
  const [minD, maxD] = startStr < endStr ? [startStr, endStr] : [endStr, startStr];
  document.querySelectorAll('#calendar-grid .day-cell').forEach(cell => {
    const d = cell.dataset.date;
    if (d >= minD && d <= maxD) {
      cell.classList.add('drag-selected');
    } else {
      cell.classList.remove('drag-selected');
    }
  });
}

function clearSelectionHighlight() {
  document.querySelectorAll('#calendar-grid .day-cell').forEach(cell => {
    cell.classList.remove('drag-selected');
  });
}

function startResizing(task, type, clientX, clientY) {
  closeQuickPopover();
  isResizing = true;
  resizeTask = task;
  resizeType = type;
  resizePreviewStart = task.startDate;
  resizePreviewEnd = task.endDate;
  document.body.style.cursor = 'ew-resize';
  document.body.style.userSelect = 'none';

  highlightSelection(resizePreviewStart, resizePreviewEnd);
  const calc = calculateTaskDays(resizePreviewStart, resizePreviewEnd, task.skipSundays !== false);
  showFloatingTooltip(`${task.title}: ${resizePreviewStart} → ${resizePreviewEnd} (${calc.workDays} ngày)`, clientX, clientY);
}

function updateResizePreview(dayStr, clientX, clientY) {
  if (!isResizing || !resizeTask) return;
  if (resizeType === 'start') {
    if (dayStr <= resizeTask.endDate) {
      resizePreviewStart = dayStr;
    }
  } else if (resizeType === 'end') {
    if (dayStr >= resizeTask.startDate) {
      resizePreviewEnd = dayStr;
    }
  }
  highlightSelection(resizePreviewStart, resizePreviewEnd);
  const calc = calculateTaskDays(resizePreviewStart, resizePreviewEnd, resizeTask.skipSundays !== false);
  showFloatingTooltip(`${resizePreviewStart} → ${resizePreviewEnd} (${calc.workDays} ngày làm việc)`, clientX, clientY);
}

function stopResizing() {
  if (!isResizing) return;
  isResizing = false;
  document.body.style.cursor = '';
  document.body.style.userSelect = '';
  hideFloatingTooltip();
  clearSelectionHighlight();

  if (resizeTask) {
    const oldStart = resizeTask.startDate;
    const oldEnd = resizeTask.endDate;
    resizeTask.startDate = resizePreviewStart;
    resizeTask.endDate = resizePreviewEnd;
    if (AppState.autoCascadeShift !== false && (oldStart !== resizeTask.startDate || oldEnd !== resizeTask.endDate)) {
      if (typeof cascadeShiftSubsequentTasks === 'function') {
        cascadeShiftSubsequentTasks(resizeTask, oldStart, oldEnd);
      }
    }
    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
  }
  resizeTask = null;
  resizeType = null;
}

// =========================================================================
// CHẾ ĐỘ QUÉT CHỌN VÙNG NHÌN ĐỂ XUẤT ẢNH & COPY CLIPBOARD
// =========================================================================
function enterInteractiveCropMode() {
  closeQuickPopover();
  isCropMode = true;
  cropStartWeekIdx = null;
  cropEndWeekIdx = null;
  document.getElementById('crop-mode-banner').classList.add('active');
  document.getElementById('btn-capture-cropped').style.display = 'none';
  document.getElementById('btn-copy-cropped').style.display = 'none';
  document.getElementById('crop-banner-instruction').innerHTML = 
    '<strong>Chế độ tạo vùng nhìn xuất ảnh:</strong> Hãy nhấn giữ chuột và quét từ <em>Hàng tuần bắt đầu</em> đến <em>Hàng tuần kết thúc</em> trên lịch...';
}

function exitInteractiveCropMode() {
  isCropMode = false;
  isDraggingCrop = false;
  cropStartWeekIdx = null;
  cropEndWeekIdx = null;
  document.getElementById('crop-mode-banner').classList.remove('active');
  document.querySelectorAll('#calendar-grid .calendar-week-row').forEach(r => {
    r.classList.remove('crop-selected-row', 'crop-dimmed-row');
  });
}

function highlightCropWeeks(sIdx, eIdx) {
  const [minW, maxW] = sIdx < eIdx ? [sIdx, eIdx] : [eIdx, sIdx];
  document.querySelectorAll('#calendar-grid .calendar-week-row').forEach(row => {
    const idx = parseInt(row.dataset.weekIndex, 10);
    if (idx >= minW && idx <= maxW) {
      row.classList.add('crop-selected-row');
      row.classList.remove('crop-dimmed-row');
    } else {
      row.classList.remove('crop-selected-row');
      row.classList.add('crop-dimmed-row');
    }
  });

  if (currentRenderedWeeks[minW] && currentRenderedWeeks[maxW]) {
    const d1 = formatDateStr(currentRenderedWeeks[minW][0]);
    const d2 = formatDateStr(currentRenderedWeeks[maxW][6]);
    document.getElementById('crop-banner-instruction').innerHTML = 
      `Đã chọn vùng nhìn: <strong>Từ ${d1} đến ${d2}</strong> (${maxW - minW + 1} hàng tuần). Chọn <strong>Copy</strong> hoặc <strong>Tải ảnh</strong> bên phải!`;
    document.getElementById('btn-capture-cropped').style.display = 'inline-flex';
    document.getElementById('btn-copy-cropped').style.display = 'inline-flex';
  }
}

function setupGridMouseInteractions() {
  const grid = document.getElementById('calendar-grid');

  grid.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (e.target.closest('.resize-handle') || e.target.closest('.task-bar-segment')) return;

    const cell = findDayCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    if (isCropMode) {
      e.preventDefault();
      isDraggingCrop = true;
      cropStartWeekIdx = parseInt(cell.dataset.weekIndex, 10);
      cropEndWeekIdx = cropStartWeekIdx;
      highlightCropWeeks(cropStartWeekIdx, cropEndWeekIdx);
      return;
    }

    e.preventDefault();
    closeQuickPopover();
    isSelecting = true;
    selectionStartStr = cell.dataset.date;
    selectionEndStr = cell.dataset.date;
    highlightSelection(selectionStartStr, selectionEndStr);

    const calc = calculateTaskDays(selectionStartStr, selectionEndStr, true);
    showFloatingTooltip(`Đang chọn: ${selectionStartStr} (${calc.workDays} ngày)`, e.clientX, e.clientY);
  });

  window.addEventListener('mousemove', (e) => {
    if (!isSelecting && !isResizing && !isDraggingCrop) return;

    const cell = findDayCellFromPoint(e.clientX, e.clientY);
    if (!cell) return;

    const dayStr = cell.dataset.date;

    if (isDraggingCrop) {
      const wIdx = parseInt(cell.dataset.weekIndex, 10);
      if (!isNaN(wIdx) && wIdx !== cropEndWeekIdx) {
        cropEndWeekIdx = wIdx;
        highlightCropWeeks(cropStartWeekIdx, cropEndWeekIdx);
      }
      return;
    }

    if (isSelecting) {
      if (dayStr && dayStr !== selectionEndStr) {
        selectionEndStr = dayStr;
        highlightSelection(selectionStartStr, selectionEndStr);
      }
      const [minD, maxD] = selectionStartStr < selectionEndStr ? [selectionStartStr, selectionEndStr] : [selectionEndStr, selectionStartStr];
      const calc = calculateTaskDays(minD, maxD, true);
      showFloatingTooltip(`Quét chọn: ${minD} → ${maxD} (${calc.workDays} ngày làm việc)`, e.clientX, e.clientY);
      return;
    }

    if (isResizing) {
      if (dayStr) {
        updateResizePreview(dayStr, e.clientX, e.clientY);
      }
    }
  });

  window.addEventListener('mouseup', (e) => {
    if (isDraggingCrop) {
      isDraggingCrop = false;
      return;
    }

    if (isSelecting) {
      isSelecting = false;
      hideFloatingTooltip();
      if (selectionStartStr && selectionEndStr) {
        showQuickPopover(selectionStartStr, selectionEndStr, e.clientX, e.clientY);
      }
      return;
    }

    if (isResizing) {
      stopResizing();
    }
  });
}

// =========================================================================
// QUICK CREATE POPOVER (Có sẵn Tag 1-Click: "3D", "CHỈNH SỬA 3D", "HSKT")
// =========================================================================
let popoverColor = '#cc0000';
let currentPopoverRange = { start: '', end: '' };

function showQuickPopover(startStr, endStr, clientX, clientY) {
  const [minD, maxD] = startStr < endStr ? [startStr, endStr] : [endStr, startStr];
  currentPopoverRange = { start: minD, end: maxD };

  const activeCal = getActiveCalendar();
  popoverColor = getNextSequentialPaletteColor(activeCal.id) || activeCal.color || '#cc0000';
  renderPaletteSwatchesUI();

  const popover = document.getElementById('quick-create-popover');
  const titleInput = document.getElementById('popover-task-title');
  const dateText = document.getElementById('popover-date-range-text');
  const countSummary = document.getElementById('popover-count-summary');
  const targetCalName = document.getElementById('popover-target-cal-name');

  titleInput.value = '';
  const custName = getCurrentCustomerName() || activeCal.name;
  if (targetCalName) {
    targetCalName.textContent = custName;
    targetCalName.style.color = activeCal.color;
  }

  document.querySelectorAll('#popover-swatches .p-swatch').forEach(sw => {
    if (sw.dataset.color.toLowerCase() === popoverColor.toLowerCase()) {
      sw.classList.add('active');
    } else {
      sw.classList.remove('active');
    }
  });

  const sDate = parseDateStr(minD);
  const eDate = parseDateStr(maxD);
  dateText.textContent = `${sDate.getDate()} thg ${sDate.getMonth() + 1} - ${eDate.getDate()} thg ${eDate.getMonth() + 1}, ${eDate.getFullYear()}`;

  const calc = calculateTaskDays(minD, maxD, true);
  countSummary.textContent = `${calc.workDays} ngày làm việc (đã trừ ngày nghỉ) • ${calc.totalDays} ngày thực tế`;

  // Tự động chọn tab thư viện hoặc ẩn/hiện 3 nút thiết kế (3D / Chỉnh sửa 3D / HSKT) theo loại giai đoạn
  const normStage = normalizeVN(activeCal.name || '');
  if (AppState.hideDesignQuickTags === undefined) {
    const isConstructionStage = /thi cong|phan tho|hoan thien|noi that|ban giao/.test(normStage);
    syncPopoverDesignTagsVisibility(isConstructionStage);
  } else {
    syncPopoverDesignTagsVisibility(!!AppState.hideDesignQuickTags);
  }
  if (/phan tho|dien|nuoc|pccc/.test(normStage)) _titleLibTab = 'rough';
  else if (/hoan thien|son|tran|san/.test(normStage)) _titleLibTab = 'finish';
  else if (/noi that|xuong|do roi/.test(normStage)) _titleLibTab = 'furniture';

  if (typeof window.__renderPopoverTitleLib === 'function') window.__renderPopoverTitleLib();

  popover.style.visibility = 'hidden';
  popover.classList.add('active');
  const popWidth = popover.offsetWidth || 380;
  const popHeight = Math.min(popover.offsetHeight || 520, window.innerHeight - 24);
  let left = clientX + 12;
  let top = clientY - 80;
  if (left + popWidth > window.innerWidth - 12) left = Math.max(12, clientX - popWidth - 12);
  if (top + popHeight > window.innerHeight - 12) top = window.innerHeight - popHeight - 12;
  if (top < 12) top = 12;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.style.visibility = '';

  setTimeout(() => titleInput.focus(), 30);
}

// =========================================================================
// QUÉT CHỌN VÙNG NGÀY TRÊN TIMELINE (GANTT) ĐỂ TẠO CÔNG VIỆC
// Giữ chuột trái & kéo ngang trên vùng trống của 1 dòng -> chọn khoảng ngày
// -> hiện bảng tạo nhanh, việc mới thuộc dự án của dòng đó.
// Nháy đúp vào vùng trống = tạo việc 1 ngày.
// =========================================================================
let _mspTimelineInfo = null;
let _mspExportRendering = false; // Khi xuất ảnh: không kéo dài trục ngày theo màn hình, không giới hạn cột tên

function mspDateIndexFromClientX(layerEl, clientX) {
  if (!_mspTimelineInfo) return null;
  const rect = layerEl.getBoundingClientRect();
  const idx = Math.floor((clientX - rect.left) / _mspTimelineInfo.colWidth);
  return Math.max(0, Math.min(_mspTimelineInfo.count - 1, idx));
}

function mspDateFromIndex(idx) {
  const d = parseDateStr(_mspTimelineInfo.startDate);
  d.setDate(d.getDate() + idx);
  return formatDateStr(d);
}

function openGanttRangeCreate(calId, startStr, endStr, clientX, clientY) {
  if (calId && AppState.calendars.some(c => c.id === calId)) {
    AppState.activeCalendarId = calId;
    syncCustomerInputWithActiveCalendar();
  }
  showQuickPopover(startStr, endStr, clientX, clientY);
}

function setupGanttRangeSelection() {
  const layer = document.getElementById('msp-gantt-rows-layer');
  if (!layer || layer.dataset.rangeSelectReady === '1') return;
  layer.dataset.rangeSelectReady = '1';

  const isEmptyArea = (target) =>
    !target.closest('.msp-task-bar, .msp-summary-bar, .msp-bar-handle, button, input, select');

  let sel = null;

  const clearHighlight = () => {
    layer.querySelectorAll('.msp-range-select-highlight').forEach(el => el.remove());
  };

  const drawHighlight = () => {
    if (!sel) return;
    let hl = sel.rowEl.querySelector('.msp-range-select-highlight');
    if (!hl) {
      hl = document.createElement('div');
      hl.className = 'msp-range-select-highlight';
      sel.rowEl.appendChild(hl);
    }
    const a = Math.min(sel.startIdx, sel.endIdx);
    const b = Math.max(sel.startIdx, sel.endIdx);
    const cw = _mspTimelineInfo.colWidth;
    hl.style.left = `${a * cw}px`;
    hl.style.width = `${(b - a + 1) * cw}px`;
    const s = mspDateFromIndex(a);
    const e = mspDateFromIndex(b);
    const calc = calculateTaskDays(s, e, true);
    hl.textContent = cw * (b - a + 1) > 70 ? `${calc.workDays} ngày LV` : '';
    showFloatingTooltip(`${formatShortVNDate(s)} → ${formatShortVNDate(e)} • ${calc.workDays} ngày làm việc • ${calc.totalDays} ngày thực tế`, sel.lastX, sel.lastY);
  };

  layer.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || !_mspTimelineInfo) return;
    const rowEl = e.target.closest('.msp-gantt-row');
    if (!rowEl || !isEmptyArea(e.target)) return;
    const idx = mspDateIndexFromClientX(layer, e.clientX);
    if (idx === null) return;
    e.preventDefault();
    clearHighlight();
    sel = { rowEl, calId: rowEl.dataset.calId, startIdx: idx, endIdx: idx, downX: e.clientX, lastX: e.clientX, lastY: e.clientY, moved: false };
    document.body.style.userSelect = 'none';

    const onMove = (ev) => {
      if (!sel) return;
      sel.lastX = ev.clientX;
      sel.lastY = ev.clientY;
      if (Math.abs(ev.clientX - sel.downX) > 4) sel.moved = true;
      if (!sel.moved) return;
      sel.endIdx = mspDateIndexFromClientX(layer, ev.clientX);
      drawHighlight();
    };
    const onUp = (ev) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.userSelect = '';
      hideFloatingTooltip();
      const done = sel;
      sel = null;
      if (!done || !done.moved) {
        clearHighlight();
        return;
      }
      const a = Math.min(done.startIdx, done.endIdx);
      const b = Math.max(done.startIdx, done.endIdx);
      openGanttRangeCreate(done.calId, mspDateFromIndex(a), mspDateFromIndex(b), ev.clientX, ev.clientY);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  });

  layer.addEventListener('dblclick', (e) => {
    const rowEl = e.target.closest('.msp-gantt-row');
    if (!rowEl || !isEmptyArea(e.target) || !_mspTimelineInfo) return;
    const idx = mspDateIndexFromClientX(layer, e.clientX);
    const d = mspDateFromIndex(idx);
    openGanttRangeCreate(rowEl.dataset.calId, d, d, e.clientX, e.clientY);
  });
}

function closeQuickPopover() {
  document.querySelectorAll('.msp-range-select-highlight').forEach(el => el.remove());
  const pop = document.getElementById('quick-create-popover');
  if (pop) pop.classList.remove('active');
  clearSelectionHighlight();
}

// =========================================================================
// THƯ VIỆN TIÊU ĐỀ CÔNG VIỆC (chọn nhanh trong bảng tạo việc)
// Nhóm "Của tôi" do người dùng tự thêm, lưu cùng dữ liệu (customTaskTitles)
// =========================================================================
const TASK_TITLE_LIBRARY = [
  { key: 'design', label: 'Thiết kế', items: [
    'Khảo sát & đo đạc hiện trạng', 'Lên phương án mặt bằng bố trí', 'Concept / moodboard', 'Dựng 3D', 'Chỉnh sửa 3D',
    'Hồ sơ kỹ thuật (HSKT)', 'Dự toán - báo giá', 'Chốt vật liệu & mẫu', 'Ký hợp đồng thi công', 'Thủ tục với ban quản lý tòa nhà'
  ] },
  { key: 'prep', label: 'Chuẩn bị', items: [
    'Bàn giao mặt bằng', 'Che chắn bảo vệ công trình', 'Tháo dỡ - phá dỡ', 'Vận chuyển phế thải', 'Định vị - lấy dấu tim mốc'
  ] },
  { key: 'rough', label: 'Phần thô & M&E', items: [
    'Xây tường - chèn tường', 'Đục tường - cắt rãnh', 'Thi công điện (đi dây âm tường)', 'Thi công điện nhẹ (mạng, camera, âm thanh)',
    'Thi công cấp thoát nước', 'Thi công điều hòa (ống đồng, thoát nước)', 'Thi công PCCC (sprinkler, báo cháy)',
    'Chống thấm WC / ban công / mái', 'Trát tường', 'Cán nền', 'Nghiệm thu phần thô'
  ] },
  { key: 'finish', label: 'Hoàn thiện', items: [
    'Thi công trần thạch cao', 'Thi công vách thạch cao', 'Ốp lát gạch', 'Lát sàn gỗ / sàn nhựa', 'Bả matit - sơn lót', 'Sơn hoàn thiện',
    'Giấy dán tường', 'Phào chỉ trần / chân tường', 'Ốp đá (bếp, lavabo, cầu thang)', 'Lắp cửa gỗ / cửa nhôm kính',
    'Lắp vách kính - kính tắm', 'Lắp thiết bị vệ sinh', 'Lắp thiết bị điện (công tắc, ổ cắm, đèn)', 'Lắp điều hòa & thiết bị'
  ] },
  { key: 'furniture', label: 'Nội thất', items: [
    'Đo đạc sản xuất đồ nội thất', 'Sản xuất đồ nội thất tại xưởng', 'Kiểm tra đồ tại xưởng', 'Vận chuyển & lắp đặt nội thất',
    'Đặt hàng đồ rời (sofa, bàn ghế, rèm)', 'Lắp rèm cửa', 'Lắp đặt đồ rời & decor', 'Thi công biển - logo'
  ] },
  { key: 'handover', label: 'Bàn giao', items: [
    'Vệ sinh công nghiệp', 'Kiểm tra - chạy thử thiết bị', 'Sửa lỗi tồn đọng (defect)', 'Nghiệm thu tổng thể', 'Bàn giao', 'Bảo hành'
  ] }
];
let _titleLibTab = 'design';

function normalizeVN(str) {
  return String(str || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}

function getTitleLibraryGroups() {
  const custom = Array.isArray(AppState.customTaskTitles) ? AppState.customTaskTitles : [];
  return [{ key: 'mine', label: '⭐ Của tôi', items: custom }, ...TASK_TITLE_LIBRARY];
}

function renderTitleLibrary(onPick) {
  const tabsEl = document.getElementById('title-lib-tabs');
  const listEl = document.getElementById('title-lib-list');
  const input = document.getElementById('popover-task-title');
  if (!tabsEl || !listEl) return;
  const groups = getTitleLibraryGroups();
  const q = normalizeVN(input ? input.value : '');

  tabsEl.innerHTML = '';
  groups.forEach(g => {
    if (g.key === 'mine' && g.items.length === 0) return;
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `title-lib-tab ${!q && _titleLibTab === g.key ? 'active' : ''}`;
    tab.textContent = g.label;
    tab.addEventListener('click', () => {
      _titleLibTab = g.key;
      if (input) input.value = '';
      renderTitleLibrary(onPick);
    });
    tabsEl.appendChild(tab);
  });
  tabsEl.style.display = q ? 'none' : '';

  let items = [];
  if (q) {
    groups.forEach(g => g.items.forEach(t => {
      if (normalizeVN(t).includes(q) && !items.some(x => x.title === t)) items.push({ title: t, mine: g.key === 'mine' });
    }));
    items = items.slice(0, 40);
  } else {
    let g = groups.find(x => x.key === _titleLibTab);
    if (!g || g.items.length === 0) { g = groups.find(x => x.key === 'design'); _titleLibTab = 'design'; }
    items = g.items.map(t => ({ title: t, mine: g.key === 'mine' }));
  }

  listEl.innerHTML = '';
  if (items.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'title-lib-empty';
    empty.textContent = 'Không có mẫu khớp. Bấm Enter để tạo việc với tên vừa gõ, hoặc lưu vào "Của tôi".';
    listEl.appendChild(empty);
    return;
  }
  items.forEach(it => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `title-lib-chip ${it.mine ? 'is-mine' : ''}`;
    chip.textContent = it.title;
    chip.title = it.mine ? 'Bấm để tạo việc ngay • Chuột phải để xoá khỏi "Của tôi"' : 'Bấm để tạo việc ngay với tiêu đề này';
    chip.addEventListener('click', () => onPick(it.title));
    if (it.mine) {
      chip.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm(`Xoá "${it.title}" khỏi danh sách "Của tôi"?`)) {
          AppState.customTaskTitles = (AppState.customTaskTitles || []).filter(t => t !== it.title);
          saveToBackend();
          renderTitleLibrary(onPick);
        }
      });
    }
    listEl.appendChild(chip);
  });
}

function addCustomTaskTitle(title) {
  const t = String(title || '').trim();
  if (!t) return false;
  if (!Array.isArray(AppState.customTaskTitles)) AppState.customTaskTitles = [];
  if (AppState.customTaskTitles.some(x => normalizeVN(x) === normalizeVN(t))) return false;
  AppState.customTaskTitles.unshift(t);
  AppState.customTaskTitles = AppState.customTaskTitles.slice(0, 80);
  return true;
}

function syncPopoverDesignTagsVisibility(hideTags) {
  const tagsBox = document.getElementById('popover-instant-tags');
  const toggleBtn = document.getElementById('btn-toggle-design-tags');
  if (tagsBox) tagsBox.style.display = hideTags ? 'none' : '';
  if (toggleBtn) {
    toggleBtn.textContent = hideTags ? 'Hiện nút 3D/HSKT' : 'Ẩn nút TK';
  }
}

function setupQuickPopoverEvents() {
  document.getElementById('btn-close-popover').addEventListener('click', closeQuickPopover);
  const btnToggleDesignTags = document.getElementById('btn-toggle-design-tags');
  if (btnToggleDesignTags) {
    btnToggleDesignTags.addEventListener('click', (e) => {
      e.stopPropagation();
      const tagsBox = document.getElementById('popover-instant-tags');
      const currentlyHidden = tagsBox && tagsBox.style.display === 'none';
      AppState.hideDesignQuickTags = !currentlyHidden;
      syncPopoverDesignTagsVisibility(AppState.hideDesignQuickTags);
    });
  }

  // 1-Click Tag ("3D" -> Đỏ, "CHỈNH SỬA 3D" -> Cam, "HSKT" -> Xanh):
  // Bấm vào là tự ghép với tên khách hàng + màu chuẩn và hoàn tất luôn!
  document.querySelectorAll('.instant-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix;
      const tagColor = btn.dataset.color;
      const fullTitle = formatStageTitleWithCustomer(prefix);
      const activeCal = getActiveCalendar();
      activeCal.visible = true;

      snapshotState();
      AppState.tasks.push({
        id: 'task_' + Date.now(),
        calendarId: activeCal.id,
        title: fullTitle,
        startDate: currentPopoverRange.start,
        endDate: currentPopoverRange.end,
        color: tagColor,
        skipSundays: true,
        showCount: true,
        note: '',
        predecessors: []
      });

      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
      closeQuickPopover();
      showToast(`Đã tạo: ${fullTitle}`);
    });
  });

  // Nút thêm giai đoạn mới không liền nhau vào chính dự án đang chọn
  const btnAppendSame = document.getElementById('btn-popover-append-same-project');
  if (btnAppendSame) {
    btnAppendSame.addEventListener('click', () => {
      const activeCal = getActiveCalendar();
      activeCal.visible = true;
      const rawTitle = document.getElementById('popover-task-title').value.trim();
      const title = rawTitle || formatStageTitleWithCustomer('Giai đoạn bổ sung');

      snapshotState();
      AppState.tasks.push({
        id: 'task_' + Date.now(),
        calendarId: activeCal.id,
        title,
        startDate: currentPopoverRange.start,
        endDate: currentPopoverRange.end,
        color: popoverColor,
        skipSundays: true,
        showCount: true,
        note: '',
        predecessors: []
      });

      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
      closeQuickPopover();
      showToast(`Đã thêm giai đoạn (${currentPopoverRange.start} → ${currentPopoverRange.end}) vào dự án "${activeCal.name}"!`);
    });
  }

  const pSwatches = document.querySelectorAll('.p-swatch');
  pSwatches.forEach(sw => {
    sw.addEventListener('click', () => {
      pSwatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      popoverColor = sw.dataset.color;
    });
  });

  const saveQuickTask = () => {
    const activeCal = getActiveCalendar();
    activeCal.visible = true;
    const rawTitle = document.getElementById('popover-task-title').value.trim();
    const title = rawTitle || formatStageTitleWithCustomer('3D');
    AppState.tasks.push({
      id: 'task_' + Date.now(),
      calendarId: activeCal.id,
      title,
      startDate: currentPopoverRange.start,
      endDate: currentPopoverRange.end,
      color: popoverColor,
      skipSundays: true,
      showCount: true,
      note: '',
      predecessors: []
    });

    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    closeQuickPopover();
  };

  document.getElementById('btn-popover-save').addEventListener('click', saveQuickTask);

  // Thư viện tiêu đề: bấm 1 lần là tạo việc với tiêu đề đó
  const pickTitle = (title) => {
    document.getElementById('popover-task-title').value = title;
    saveQuickTask();
    showToast(`Đã tạo: ${title}`);
  };
  window.__renderPopoverTitleLib = () => renderTitleLibrary(pickTitle);
  document.getElementById('popover-task-title').addEventListener('input', () => renderTitleLibrary(pickTitle));
  const btnLibAdd = document.getElementById('btn-title-lib-add');
  if (btnLibAdd) {
    btnLibAdd.addEventListener('click', () => {
      const v = document.getElementById('popover-task-title').value.trim();
      if (!v) {
        showToast('Gõ tên việc vào ô phía trên trước, rồi bấm lưu.');
        return;
      }
      if (addCustomTaskTitle(v)) {
        saveToBackend();
        _titleLibTab = 'mine';
        document.getElementById('popover-task-title').value = '';
        renderTitleLibrary(pickTitle);
        showToast(`Đã lưu "${v}" vào nhóm "Của tôi"`);
      } else {
        showToast('Tiêu đề này đã có trong "Của tôi".');
      }
    });
  }
  document.getElementById('popover-task-title').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      saveQuickTask();
    } else if (e.key === 'Escape') {
      closeQuickPopover();
    }
  });

  document.getElementById('btn-popover-more').addEventListener('click', () => {
    const preTitle = document.getElementById('popover-task-title').value.trim();
    const range = { ...currentPopoverRange };
    closeQuickPopover();
    openTaskModal(null, range.start);
    document.getElementById('task-start-date').value = range.start;
    document.getElementById('task-end-date').value = range.end;
    if (preTitle) document.getElementById('task-title').value = preTitle;
    updateModalDaysCount();
  });
}

// =========================================================================
// MODAL CHI TIẾT CÔNG VIỆC
// =========================================================================
let selectedColor = '#cc0000';

function updateModalDaysCount() {
  const s = document.getElementById('task-start-date').value;
  const e = document.getElementById('task-end-date').value;
  const skip = document.getElementById('task-skip-sundays').checked;
  const calc = calculateTaskDays(s, e, skip);

  document.getElementById('calculated-days-count').textContent = `${calc.workDays} ngày`;
  document.getElementById('calculated-total-span').textContent = `(Tổng cả ngày nghỉ: ${calc.totalDays} ngày)`;
}

function selectSwatchColorInModal(colorHex) {
  selectedColor = colorHex;
  const customPicker = document.getElementById('custom-color-picker');
  if (customPicker) customPicker.value = selectedColor;
  document.querySelectorAll('#color-palette .color-swatch').forEach(s => {
    if (s.dataset.color.toLowerCase() === selectedColor.toLowerCase()) {
      s.classList.add('active');
    } else {
      s.classList.remove('active');
    }
  });
}

function setupColorPalette() {
  const customPicker = document.getElementById('custom-color-picker');
  const modalPaletteSelect = document.getElementById('modal-palette-select');

  renderPaletteSwatchesUI();

  if (modalPaletteSelect) {
    modalPaletteSelect.addEventListener('change', (e) => {
      AppState.colorPaletteTheme = e.target.value || 'default';
      saveToStorage();
      renderPaletteSwatchesUI();
      const nextCol = getNextSequentialPaletteColor(document.getElementById('task-calendar-select')?.value || AppState.activeCalendarId);
      selectSwatchColorInModal(nextCol);
    });
  }

  customPicker.addEventListener('input', (e) => {
    document.querySelectorAll('#color-palette .color-swatch').forEach(s => s.classList.remove('active'));
    selectedColor = e.target.value;
  });

  // Các nút Tag trong Modal (3D, CHỈNH SỬA 3D, HSKT)
  document.querySelectorAll('#modal-stage-tags .stage-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix;
      const color = btn.dataset.color;
      document.getElementById('task-title').value = formatStageTitleWithCustomer(prefix);
      selectSwatchColorInModal(color);
    });
  });

  document.getElementById('task-start-date').addEventListener('change', updateModalDaysCount);
  document.getElementById('task-end-date').addEventListener('change', updateModalDaysCount);
  document.getElementById('task-skip-sundays').addEventListener('change', updateModalDaysCount);
}

function populateCalendarSelectDropdown(selectedCalId) {
  const selectEl = document.getElementById('task-calendar-select');
  if (!selectEl) return;
  selectEl.innerHTML = '';
  // Chỉ hiện các dự án thuộc cùng nhóm "Dự án của ..." với dự án đang chọn -> tránh lẫn lộn
  const refCal = AppState.calendars.find(c => c.id === selectedCalId) || getActiveCalendar();
  const ownerId = refCal ? refCal.ownerId : null;
  const list = AppState.calendars.filter(c => !ownerId || c.ownerId === ownerId || c.id === selectedCalId);
  list.forEach(cal => {
    const opt = document.createElement('option');
    opt.value = cal.id;
    opt.textContent = cal.name;
    if (cal.id === selectedCalId) opt.selected = true;
    selectEl.appendChild(opt);
  });
}

function openTaskModal(task = null, defaultStartDate = null, presetCalendarId = null) {
  const modal = document.getElementById('task-modal');
  const modalTitle = document.getElementById('modal-task-title');
  const taskIdInput = document.getElementById('task-id');
  const titleInput = document.getElementById('task-title');
  const startInput = document.getElementById('task-start-date');
  const endInput = document.getElementById('task-end-date');
  const noteInput = document.getElementById('task-note');
  const progressSelect = document.getElementById('task-progress');
  const deleteBtn = document.getElementById('btn-delete-task');
  const skipSundaysCheckbox = document.getElementById('task-skip-sundays');
  const showCountCheckbox = document.getElementById('task-show-count');

  const activeCal = getActiveCalendar();
  const targetCalId = presetCalendarId || activeCal.id;
  const targetCal = AppState.calendars.find(c => c.id === targetCalId) || activeCal;

  if (task) {
    modalTitle.textContent = 'Chỉnh sửa tiến độ công việc';
    taskIdInput.value = task.id;
    populateCalendarSelectDropdown(task.calendarId || targetCal.id);
    titleInput.value = task.title;
    startInput.value = task.startDate;
    endInput.value = task.endDate;
    noteInput.value = task.note || '';
    if (progressSelect) progressSelect.value = String(task.progress || 0);
    selectSwatchColorInModal(task.color || targetCal.color || '#cc0000');
    skipSundaysCheckbox.checked = task.skipSundays !== false;
    showCountCheckbox.checked = task.showCount !== false;
    deleteBtn.style.display = 'block';
  } else {
    modalTitle.textContent = 'Thêm công việc tiến độ mới';
    taskIdInput.value = '';
    populateCalendarSelectDropdown(targetCal.id);
    const custSuffix = targetCal.name && targetCal.name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? ` - ${targetCal.name}` : '';
    titleInput.value = `3D${custSuffix}`;
    const defStart = defaultStartDate || formatDateStr(new Date());
    startInput.value = defStart;
    
    const defEnd = parseDateStr(defStart);
    defEnd.setDate(defEnd.getDate() + 3);
    endInput.value = formatDateStr(defEnd);

    noteInput.value = '';
    if (progressSelect) progressSelect.value = '0';
    renderPaletteSwatchesUI();
    selectSwatchColorInModal(getNextSequentialPaletteColor(targetCal.id));
    skipSundaysCheckbox.checked = true;
    showCountCheckbox.checked = true;
    deleteBtn.style.display = 'none';
  }

  updateModalDaysCount();
  modal.classList.add('active');
}

function closeTaskModal() {
  document.getElementById('task-modal').classList.remove('active');
}

// =========================================================================
// CÀI ĐẶT BRANDING & LOGO CHUẨN ĐỎ ĐEN GD HOME
// =========================================================================
function updateCompanyBranding() {
  document.getElementById('footer-note-text').textContent = AppState.footerNote || '';
  const mspNote = document.getElementById('msp-footer-note-text');
  if (mspNote) mspNote.textContent = AppState.footerNote || '';

  const logoContainer = document.getElementById('footer-logo-container');
  const mspLogoContainer = document.getElementById('msp-footer-logo-container');
  let logoHtml = `<img src="gdhome-logo.png" alt="GD HOME" class="gdhome-full-logo-img">`;
  if (AppState.companyLogo) {
    logoHtml = `<img src="${AppState.companyLogo}" alt="Logo" class="gdhome-full-logo-img">`;
  } else if (AppState.companyName && AppState.companyName.toUpperCase() !== 'GD HOME') {
    logoHtml = `<img src="gdhome-icon.png" alt="Icon" style="height:56px; object-fit:contain;"> <span class="brand-text">${AppState.companyName}</span>`;
  }
  if (logoContainer) logoContainer.innerHTML = logoHtml;
  if (mspLogoContainer) mspLogoContainer.innerHTML = logoHtml;
}

// =========================================================================
// XUẤT ẢNH & COPY VÀO CLIPBOARD (DÁN TRỰC TIẾP SANG PHẦN MỀM KHÁC)
// =========================================================================
function setupExportModal() {
  const exportModal = document.getElementById('export-modal');
  const btnOpen = document.getElementById('btn-open-export-modal');
  const btnClose = document.getElementById('btn-close-export-modal');
  const btnCancel = document.getElementById('btn-cancel-export');
  const btnConfirmDownload = document.getElementById('btn-confirm-export');
  const btnCopyModal = document.getElementById('btn-copy-export-clipboard');
  const btnQuickCopyHeader = document.getElementById('btn-quick-copy-clipboard');
  const btnStartCropHeader = document.getElementById('btn-start-crop-export');

  const customRangeRow = document.getElementById('export-custom-range-row');
  const scopeRadios = document.querySelectorAll('input[name="export-scope"]');

  btnOpen.addEventListener('click', () => {
    if (currentRenderedWeeks.length > 0) {
      document.getElementById('export-start-date').value = formatDateStr(currentRenderedWeeks[0][0]);
      document.getElementById('export-end-date').value = formatDateStr(currentRenderedWeeks[currentRenderedWeeks.length - 1][6]);
    }
    exportModal.classList.add('active');
  });

  btnClose.addEventListener('click', () => exportModal.classList.remove('active'));
  btnCancel.addEventListener('click', () => exportModal.classList.remove('active'));

  // Nút Copy nhanh trên thanh công cụ Header
  if (btnQuickCopyHeader) {
    btnQuickCopyHeader.addEventListener('click', () => {
      if (AppState.viewMode === 'msproject') {
        exportMSProjectSheet(2, 'clipboard');
      } else {
        executeExportWeeksSlice(getWeeksWithTasks(currentRenderedWeeks), true, 2, 'clipboard');
      }
    });
  }

  if (btnStartCropHeader) {
    btnStartCropHeader.addEventListener('click', () => {
      if (AppState.viewMode === 'msproject') {
        switchViewMode('calendar');
      }
      enterInteractiveCropMode();
    });
  }

  document.getElementById('btn-cancel-crop').addEventListener('click', () => {
    exitInteractiveCropMode();
  });

  document.getElementById('btn-capture-cropped').addEventListener('click', () => {
    if (cropStartWeekIdx === null || cropEndWeekIdx === null) return;
    const [minW, maxW] = cropStartWeekIdx < cropEndWeekIdx ? [cropStartWeekIdx, cropEndWeekIdx] : [cropEndWeekIdx, cropStartWeekIdx];
    const selectedWeeksSlice = currentRenderedWeeks.slice(minW, maxW + 1);
    exitInteractiveCropMode();
    executeExportWeeksSlice(selectedWeeksSlice, true, 2, 'download');
  });

  document.getElementById('btn-copy-cropped').addEventListener('click', () => {
    if (cropStartWeekIdx === null || cropEndWeekIdx === null) return;
    const [minW, maxW] = cropStartWeekIdx < cropEndWeekIdx ? [cropStartWeekIdx, cropEndWeekIdx] : [cropEndWeekIdx, cropStartWeekIdx];
    const selectedWeeksSlice = currentRenderedWeeks.slice(minW, maxW + 1);
    exitInteractiveCropMode();
    executeExportWeeksSlice(selectedWeeksSlice, true, 2, 'clipboard');
  });

  scopeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.value === 'custom-date') {
        customRangeRow.style.opacity = '1';
        customRangeRow.style.pointerEvents = 'auto';
      } else {
        customRangeRow.style.opacity = '0.5';
        customRangeRow.style.pointerEvents = 'none';
      }
    });
  });

  const handleModalExportAction = (mode) => {
    const scope = document.querySelector('input[name="export-scope"]:checked').value;
    const incFooter = document.getElementById('export-include-footer').checked;
    const scale = document.getElementById('export-high-res').checked ? 2 : 1;

    exportModal.classList.remove('active');

    if (AppState.viewMode === 'msproject') {
      exportMSProjectSheet(scale, mode);
      return;
    }

    if (scope === 'interactive-crop') {
      enterInteractiveCropMode();
      return;
    }

    if (scope === 'all') {
      executeExportWeeksSlice(getWeeksWithTasks(currentRenderedWeeks), incFooter, scale, mode);
    } else if (scope === 'custom-date') {
      const sD = document.getElementById('export-start-date').value;
      const eD = document.getElementById('export-end-date').value;
      if (!sD || !eD || sD > eD) {
        alert('Ngày bắt đầu phải trước hoặc bằng ngày kết thúc!');
        return;
      }
      const customWeeks = generateWeeksBetweenDates(sD, eD);
      executeExportWeeksSlice(customWeeks, incFooter, scale, mode);
    }
  };

  btnConfirmDownload.addEventListener('click', () => handleModalExportAction('download'));
  if (btnCopyModal) {
    btnCopyModal.addEventListener('click', () => handleModalExportAction('clipboard'));
  }
}

// Copy / xuất ảnh Bảng Lịch: chỉ giữ các tuần có công việc, bỏ qua các tuần trống (cả đầu, cuối và ở giữa)
function getWeeksWithTasks(weeks) {
  if (!Array.isArray(weeks) || weeks.length === 0) return weeks;
  const tasks = getVisibleTasks();
  if (tasks.length === 0) return weeks;
  const kept = weeks.filter(week => {
    const wStart = formatDateStr(week[0]);
    const wEnd = formatDateStr(week[week.length - 1]);
    return tasks.some(t => t.startDate <= wEnd && t.endDate >= wStart);
  });
  return kept.length > 0 ? kept : weeks;
}

function executeExportWeeksSlice(weeksSlice, includeBranding = true, scale = 2, mode = 'download') {
  const activeBtn = mode === 'clipboard' ? document.getElementById('btn-quick-copy-clipboard') : document.getElementById('btn-open-export-modal');
  const originalText = activeBtn ? activeBtn.innerHTML : '';
  if (activeBtn) {
    activeBtn.innerHTML = mode === 'clipboard' ? 'Đang copy...' : 'Đang tạo ảnh...';
    activeBtn.disabled = true;
  }

  const cloneSheet = document.createElement('div');
  cloneSheet.className = 'schedule-sheet';
  cloneSheet.style.width = '1200px';
  cloneSheet.style.position = 'fixed';
  cloneSheet.style.left = '-9999px';
  cloneSheet.style.top = '0';
  cloneSheet.style.background = '#ffffff';

  // Tiêu đề trên cùng: TIẾN ĐỘ THIẾT KẾ DỰ KIẾN - TÊN KHÁCH HÀNG + Tháng lập bảng bên trái
  if (includeBranding) {
    const topBannerClone = document.createElement('div');
    topBannerClone.className = 'sheet-top-banner';
    const custName = getTitleProjectName('calendar') || '';
    const monthText = getScheduleMonthText();
    topBannerClone.innerHTML = `
      <div class="sheet-banner-left">
        <span class="schedule-month-display">${escapeHtml(monthText)}</span>
      </div>
      <div class="sheet-banner-title">
        <span class="banner-prefix">TIẾN ĐỘ THIẾT KẾ DỰ KIẾN${custName ? ' - ' : ''}</span>
        ${custName ? `<span style="font-size:22px; font-weight:800; color:#b91d14; letter-spacing:0.5px; text-transform:uppercase;">${escapeHtml(custName)}</span>` : ''}
      </div>
    `;
    cloneSheet.appendChild(topBannerClone);
  }

  const headerClone = document.querySelector('.calendar-week-header').cloneNode(true);
  headerClone.style.position = 'static';
  cloneSheet.appendChild(headerClone);

  const weeksGridClone = document.createElement('div');
  weeksGridClone.className = 'calendar-weeks-container';
  cloneSheet.appendChild(weeksGridClone);

  if (includeBranding) {
    const footerClone = document.querySelector('.schedule-footer').cloneNode(true);
    cloneSheet.appendChild(footerClone);
  }

  document.body.appendChild(cloneSheet);
  renderCalendar(weeksSlice, weeksGridClone);

  const firstD = weeksSlice.length > 0 ? formatDateStr(weeksSlice[0][0]) : 'start';
  const lastD = weeksSlice.length > 0 ? formatDateStr(weeksSlice[weeksSlice.length - 1][6]) : 'end';

  setTimeout(() => {
    html2canvas(cloneSheet, {
      scale: scale,
      useCORS: true,
      backgroundColor: '#ffffff'
    }).then(canvas => {
      document.body.removeChild(cloneSheet);
      if (activeBtn) {
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
      }

      if (mode === 'clipboard') {
        copyCanvasToClipboard(canvas, { watermark: AppState.exportWatermark !== false, notify: showToast });
      } else {
        downloadCanvas(canvas, `Bang_Tien_Do_${firstD}_den_${lastD}.png`, AppState.exportWatermark !== false);
        showToast('Đã tải xuống file ảnh PNG thành công!');
      }
    }).catch(err => {
      document.body.removeChild(cloneSheet);
      if (activeBtn) {
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
      }
      alert('Lỗi kết xuất ảnh: ' + err.message);
    });
  }, 150);
}

// Sọc chéo chìm mờ phủ toàn bộ ảnh (chống chỉnh sửa / cắt ghép)
// =========================================================================
// ĐIỀU KHIỂN VÙNG NHÌN LỊCH & EVENTS
// =========================================================================
function setupEvents() {
  // Đóng/mở các menu thả xuống trên thanh Header (Chọn tháng, File ▾, Copy ảnh ▾)
  const closeAllHeaderDropdowns = (exceptEl = null) => {
    document.querySelectorAll('.hdr-dropdown.open').forEach(dd => {
      if (dd !== exceptEl) dd.classList.remove('open');
    });
  };
  document.querySelectorAll('.hdr-dropdown-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const parentDd = btn.closest('.hdr-dropdown');
      if (!parentDd) return;
      const willOpen = !parentDd.classList.contains('open');
      closeAllHeaderDropdowns(parentDd);
      parentDd.classList.toggle('open', willOpen);
    });
  });
  document.querySelectorAll('.hdr-dropdown-menu .hdr-menu-item').forEach(item => {
    item.addEventListener('click', () => closeAllHeaderDropdowns());
  });
  document.querySelectorAll('.range-selector-popover').forEach(pop => {
    pop.addEventListener('click', (e) => e.stopPropagation());
  });
  document.addEventListener('click', () => closeAllHeaderDropdowns());

  document.getElementById('btn-apply-range').addEventListener('click', () => {
    const s = document.getElementById('start-month-input').value;
    const e = document.getElementById('end-month-input').value;
    if (!s || !e) return;
    if (s > e) {
      alert('Tháng bắt đầu phải trước tháng kết thúc!');
      return;
    }
    AppState.startMonth = s;
    AppState.endMonth = e;
    AppState.extraWeeksTop = 0;
    AppState.extraWeeksBottom = 1;

    // Tháng lập bảng luôn theo lịch hiện tại (không đổi theo khoảng tháng đang xem)

    closeAllHeaderDropdowns();
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-week-top').addEventListener('click', () => {
    AppState.extraWeeksTop = (AppState.extraWeeksTop || 0) + 1;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-sub-week-top').addEventListener('click', () => {
    AppState.extraWeeksTop = (AppState.extraWeeksTop || 0) - 1;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-month-top').addEventListener('click', () => {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const prevM = new Date(sy, sm - 2, 1);
    AppState.startMonth = `${prevM.getFullYear()}-${String(prevM.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('start-month-input').value = AppState.startMonth;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-week-bottom').addEventListener('click', () => {
    AppState.extraWeeksBottom = (AppState.extraWeeksBottom || 0) + 1;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-sub-week-bottom').addEventListener('click', () => {
    AppState.extraWeeksBottom = Math.max(0, (AppState.extraWeeksBottom || 0) - 1);
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-add-month-bottom').addEventListener('click', () => {
    const [ey, em] = AppState.endMonth.split('-').map(Number);
    const nextM = new Date(ey, em, 1);
    AppState.endMonth = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  const toggleHolidays = document.getElementById('toggle-vn-holidays');
  if (toggleHolidays) {
    toggleHolidays.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, sunday: true };
      AppState.daysOffConfig.holidays = e.target.checked;
      AppState.showVnHolidays = e.target.checked;
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  const toggleOffSat = document.getElementById('toggle-off-saturday');
  const toggleOffSatHalf = document.getElementById('toggle-off-saturday-half');

  if (toggleOffSat) {
    toggleOffSat.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, saturdayHalf: false, sunday: true };
      AppState.daysOffConfig.saturday = e.target.checked;
      if (e.target.checked) {
        AppState.daysOffConfig.saturdayHalf = false;
        if (toggleOffSatHalf) toggleOffSatHalf.checked = false;
      }
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  if (toggleOffSatHalf) {
    toggleOffSatHalf.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, saturdayHalf: false, sunday: true };
      AppState.daysOffConfig.saturdayHalf = e.target.checked;
      if (e.target.checked) {
        AppState.daysOffConfig.saturday = false;
        if (toggleOffSat) toggleOffSat.checked = false;
      }
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  const toggleOffSun = document.getElementById('toggle-off-sunday');
  if (toggleOffSun) {
    toggleOffSun.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, saturdayHalf: false, sunday: true };
      AppState.daysOffConfig.sunday = e.target.checked;
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  const toggleLunar = document.getElementById('toggle-lunar-dates');
  if (toggleLunar) {
    toggleLunar.addEventListener('change', (e) => {
      AppState.showLunarDates = e.target.checked;
      saveToBackend();
      renderCalendar();
    });
  }

  document.getElementById('btn-add-task').addEventListener('click', () => {
    openTaskModal();
  });

  document.getElementById('btn-close-task-modal').addEventListener('click', closeTaskModal);
  document.getElementById('btn-cancel-task').addEventListener('click', closeTaskModal);

  document.getElementById('task-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('task-id').value;
    const calId = document.getElementById('task-calendar-select').value || AppState.activeCalendarId;
    const title = document.getElementById('task-title').value.trim();
    const startDate = document.getElementById('task-start-date').value;
    const endDate = document.getElementById('task-end-date').value;
    const note = document.getElementById('task-note').value.trim();
    const skipSundays = document.getElementById('task-skip-sundays').checked;
    const showCount = document.getElementById('task-show-count').checked;
    const progressEl = document.getElementById('task-progress');
    const progress = progressEl ? parseInt(progressEl.value || '0', 10) : 0;

    if (startDate > endDate) {
      alert('Ngày bắt đầu không được sau ngày kết thúc!');
      return;
    }

    if (id) {
      const task = AppState.tasks.find(t => t.id === id);
      if (task) {
        const oldStart = task.startDate;
        const oldEnd = task.endDate;
        const oldWorkDays = Math.max(1, countWorkingDays(oldStart, oldEnd, task.skipSundays !== false));
        task.calendarId = calId;
        task.title = title;
        task.startDate = startDate;
        // Nếu người dùng chỉ đổi ngày bắt đầu mà chưa đổi ngày kết thúc (hoặc giữ nguyên số ngày làm việc khi dịch chuyển):
        if (startDate !== oldStart && endDate === oldEnd && AppState.autoCascadeShift !== false) {
          task.endDate = computeEndDateByWorkingDays(startDate, oldWorkDays, skipSundays);
        } else {
          task.endDate = endDate;
        }
        task.color = selectedColor;
        task.skipSundays = skipSundays;
        task.showCount = showCount;
        task.progress = progress;
        task.note = note;
        if (AppState.autoCascadeShift !== false && (oldStart !== task.startDate || oldEnd !== task.endDate)) {
          if (typeof cascadeShiftSubsequentTasks === 'function') {
            cascadeShiftSubsequentTasks(task, oldStart, oldEnd);
          }
        }
      }
    } else {
      AppState.tasks.push({
        id: 'task_' + Date.now(),
        calendarId: calId,
        title,
        startDate,
        endDate,
        color: selectedColor,
        skipSundays,
        showCount,
        progress,
        note
      });
    }

    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    closeTaskModal();
  });

  document.getElementById('btn-delete-task').addEventListener('click', () => {
    const id = document.getElementById('task-id').value;
    if (id && confirm('Bạn có chắc chắn muốn xoá công việc này không?')) {
      AppState.tasks = AppState.tasks.filter(t => t.id !== id);
      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
      closeTaskModal();
    }
  });

  document.getElementById('btn-today').addEventListener('click', () => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    AppState.startMonth = `${y}-${m}`;
    const next3Months = new Date(y, now.getMonth() + 3, 1);
    const ey = next3Months.getFullYear();
    const em = String(next3Months.getMonth() + 1).padStart(2, '0');
    AppState.endMonth = `${ey}-${em}`;
    AppState.extraWeeksTop = 0;
    AppState.extraWeeksBottom = 1;
    document.getElementById('start-month-input').value = AppState.startMonth;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-prev').addEventListener('click', () => {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const [ey, em] = AppState.endMonth.split('-').map(Number);
    const newStart = new Date(sy, sm - 2, 1);
    const newEnd = new Date(ey, em - 2, 1);
    AppState.startMonth = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, '0')}`;
    AppState.endMonth = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('start-month-input').value = AppState.startMonth;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  document.getElementById('btn-next').addEventListener('click', () => {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const [ey, em] = AppState.endMonth.split('-').map(Number);
    const newStart = new Date(sy, sm, 1);
    const newEnd = new Date(ey, em, 1);
    AppState.startMonth = `${newStart.getFullYear()}-${String(newStart.getMonth() + 1).padStart(2, '0')}`;
    AppState.endMonth = `${newEnd.getFullYear()}-${String(newEnd.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('start-month-input').value = AppState.startMonth;
    document.getElementById('end-month-input').value = AppState.endMonth;
    saveToBackend();
    renderCalendar();
  });

  const settingsModal = document.getElementById('settings-modal');
  document.getElementById('btn-project-settings').addEventListener('click', () => {
    document.getElementById('setting-company-name').value = AppState.companyName;
    document.getElementById('setting-note-text').value = AppState.footerNote;
    settingsModal.classList.add('active');
  });

  document.getElementById('btn-close-settings-modal').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });
  document.getElementById('btn-cancel-settings').addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  const resetLogoBtn = document.getElementById('btn-reset-default-logo');
  if (resetLogoBtn) {
    resetLogoBtn.addEventListener('click', () => {
      AppState.companyLogo = null;
      AppState.companyName = 'GD HOME';
      document.getElementById('setting-company-name').value = 'GD HOME';
      saveToBackend();
      updateCompanyBranding();
      showToast('Đã khôi phục về Logo GD HOME chuẩn đỏ đen!');
    });
  }

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    AppState.companyName = document.getElementById('setting-company-name').value.trim() || 'GD HOME';
    AppState.footerNote = document.getElementById('setting-note-text').value.trim();

    const logoFile = document.getElementById('setting-logo-file').files[0];
    if (logoFile) {
      const reader = new FileReader();
      reader.onload = (event) => {
        AppState.companyLogo = event.target.result;
        saveToBackend();
        updateCompanyBranding();
        settingsModal.classList.remove('active');
      };
      reader.readAsDataURL(logoFile);
    } else {
      saveToBackend();
      updateCompanyBranding();
      settingsModal.classList.remove('active');
    }
  });

  document.getElementById('footer-note-text').addEventListener('blur', (e) => {
    AppState.footerNote = e.target.textContent.trim();
    saveToBackend();
  });

  setupExportModal();
}

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
function duplicateTask(task, shiftNextDate = false) {
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
  const origIdx = AppState.tasks.findIndex(t => t.id === task.id);
  if (origIdx !== -1) {
    AppState.tasks.splice(origIdx + 1, 0, cloned);
  } else {
    AppState.tasks.push(cloned);
  }
  syncAllFromMSProject(`Đã nhân đôi công việc "${task.title}"!`);
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

function handleEscapeKey() {
  const menu = document.getElementById('custom-context-menu');
  if (menu && menu.style.display !== 'none' && menu.offsetParent !== null) { hideCustomContextMenu(); return true; }
  const openDd = document.querySelectorAll('.hdr-dropdown.open');
  if (openDd.length) { openDd.forEach(d => d.classList.remove('open')); return true; }
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
      label: '🗑️ Xóa công việc này',
      danger: true,
      onClick: () => {
        if (confirm(`Xóa hạng mục "${task.title}"?`)) {
          AppState.tasks = AppState.tasks.filter(t => t.id !== task.id);
          if (Array.isArray(AppState.selectedTaskIds)) {
            AppState.selectedTaskIds = AppState.selectedTaskIds.filter(id => id !== task.id);
          }
          syncAllFromMSProject(`Đã xóa "${task.title}"!`);
        }
      }
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

  // Đồng bộ sửa Tiêu đề chính trên Header MS Project (tự gõ tự do)
  const mspTitlePrefixInput = document.getElementById('msp-title-prefix-input');
  if (mspTitlePrefixInput) {
    mspTitlePrefixInput.addEventListener('input', () => {
      AppState.mspCustomTitlePrefix = mspTitlePrefixInput.value;
      saveToStorage();
    });
    mspTitlePrefixInput.addEventListener('change', () => {
      AppState.mspCustomTitlePrefix = mspTitlePrefixInput.value.trim();
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
    mspTitlePrefixInput.value = AppState.mspCustomTitlePrefix !== undefined ? AppState.mspCustomTitlePrefix : 'TIẾN ĐỘ THIẾT KẾ DỰ KIẾN -';
  }
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
          if (confirm(`Xóa hạng mục "${task.title}"?`)) {
            AppState.tasks = AppState.tasks.filter(t => t.id !== task.id);
            if (Array.isArray(AppState.selectedTaskIds)) {
              AppState.selectedTaskIds = AppState.selectedTaskIds.filter(id => id !== task.id);
            }
            syncAllFromMSProject(`Đã xóa "${task.title}" và đồng bộ sang Bảng Lịch!`);
          }
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
            alert('Ngày kết thúc không được nhỏ hơn ngày bắt đầu!');
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
  rowEl.querySelector('.msp-add-stage-btn').addEventListener('click', () => {
    const name = prompt(`Tên giai đoạn mới cho dự án "${owner.name}" (VD: THI CÔNG PHẦN THÔ, HOÀN THIỆN, NỘI THẤT...):`);
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

// =========================================================================
// MỞ VÀ XUẤT FILE ĐỊNH DẠNG CHUẨN MICROSOFT PROJECT (.XML MSPDI, .CSV, .JSON)
// =========================================================================

// Chống chèn mã HTML khi đưa tên việc / tên khách hàng vào innerHTML
function escapeHtml(str) {
  return String(str === undefined || str === null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Xuất ra file chuẩn Microsoft Project XML (.xml) mở trực tiếp được trên phần mềm MS Project
function exportMSProjectXMLFile() {
  normalizeAppState();
  // Xuất đúng phạm vi đang xem trên Timeline, xếp theo Dự án -> Giai đoạn
  const scopeCals = getMspTargetCalendars();
  const targetCals = [];
  AppState.projectOwners.forEach(o => scopeCals.filter(c => c.ownerId === o.id).forEach(c => targetCals.push(c)));
  scopeCals.forEach(c => { if (!targetCals.includes(c)) targetCals.push(c); });
  const activeProj = getActiveProject();
  const custName = (activeProj && activeProj.name) || getCurrentCustomerName() || 'GD_HOME_PROJECT';

  let allTasks = [];
  targetCals.forEach(c => {
    AppState.tasks.filter(t => t.calendarId === c.id && t.visibleOnBoard !== false).forEach(t => allTasks.push(t));
  });

  let projStart = allTasks.length > 0 ? allTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), allTasks[0].startDate) : formatDateStr(new Date());
  let projEnd = allTasks.length > 0 ? allTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), allTasks[0].endDate) : formatDateStr(new Date());

  let uidCounter = 1;
  let idCounter = 1;
  let tasksXml = `
    <Task>
      <UID>0</UID>
      <ID>0</ID>
      <Name>${escapeXml(custName)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>0</WBS>
      <OutlineNumber>0</OutlineNumber>
      <OutlineLevel>0</OutlineLevel>
      <Summary>1</Summary>
      <Start>${projStart}T08:00:00</Start>
      <Finish>${projEnd}T17:00:00</Finish>
    </Task>`;

  // Cấp UID trước cho mọi việc để xuất liên kết đúng (kể cả liên kết tới việc nằm phía dưới)
  const taskUidMap = new Map();
  {
    let preUid = 1;
    let preOwner = null;
    targetCals.forEach(cal => {
      if (cal.ownerId !== preOwner) { preOwner = cal.ownerId; preUid++; } // dòng Dự án
      preUid++; // dòng Giai đoạn
      AppState.tasks
        .filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false)
        .slice()
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate))
        .forEach(t => taskUidMap.set(t.id, preUid++));
    });
  }

  let lastOwnerId = null;
  let ownerIdx = 0;
  let stageIdx = 0;
  targetCals.forEach((cal, cIdx) => {
    if (cal.ownerId !== lastOwnerId) {
      lastOwnerId = cal.ownerId;
      ownerIdx++;
      stageIdx = 0;
      const owner = getProjectOfCalendar(cal) || { name: 'DỰ ÁN' };
      const oTasks = AppState.tasks.filter(t => t.visibleOnBoard !== false && targetCals.some(c => c.ownerId === cal.ownerId && c.id === t.calendarId));
      const oStart = oTasks.length ? oTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), oTasks[0].startDate) : projStart;
      const oEnd = oTasks.length ? oTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), oTasks[0].endDate) : projEnd;
      tasksXml += `
    <Task>
      <UID>${uidCounter++}</UID>
      <ID>${idCounter++}</ID>
      <Name>${escapeXml(owner.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>${ownerIdx}</WBS>
      <OutlineNumber>${ownerIdx}</OutlineNumber>
      <OutlineLevel>1</OutlineLevel>
      <Summary>1</Summary>
      <Start>${oStart}T08:00:00</Start>
      <Finish>${oEnd}T17:00:00</Finish>
    </Task>`;
    }
    stageIdx++;
    const calUid = uidCounter++;
    const calIdNum = idCounter++;
    const wbsParent = `${ownerIdx}.${stageIdx}`;
    const calTasks = AppState.tasks
      .filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false)
      .slice()
      .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.endDate.localeCompare(b.endDate));

    const cStart = calTasks.length > 0 ? calTasks[0].startDate : projStart;
    const cEnd = calTasks.length > 0 ? calTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), calTasks[0].endDate) : projEnd;
    const cWorkDays = calTasks.length > 0 ? countWorkingDays(cStart, cEnd, true) : 1;

    tasksXml += `
    <Task>
      <UID>${calUid}</UID>
      <ID>${calIdNum}</ID>
      <Name>${escapeXml(cal.name)}</Name>
      <Type>1</Type>
      <IsNull>0</IsNull>
      <WBS>${wbsParent}</WBS>
      <OutlineNumber>${wbsParent}</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
      <Summary>1</Summary>
      <Start>${cStart}T08:00:00</Start>
      <Finish>${cEnd}T17:00:00</Finish>
      <Duration>PT${cWorkDays * 8}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <ExtendedAttribute>
        <FieldID>188743731</FieldID>
        <Value>${escapeXml(cal.color || '#cc0000')}</Value>
      </ExtendedAttribute>
    </Task>`;

    calTasks.forEach((t, tIdx) => {
      const tUid = uidCounter++;
      const tIdNum = idCounter++;
      const wbsCode = `${wbsParent}.${tIdx + 1}`;
      const wDays = Math.max(1, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false));
      const prog = typeof t.progress === 'number' ? t.progress : 0;

      // MS Project: Type 1 = FS; LinkLag tính bằng 1/10 phút (1 ngày làm việc = 8h = 4800); LagFormat 7 = ngày
      const predXml = (t.predecessors || [])
        .filter(l => taskUidMap.has(l.id))
        .map(l => `
      <PredecessorLink>
        <PredecessorUID>${taskUidMap.get(l.id)}</PredecessorUID>
        <Type>${l.type === 'SS' ? 3 : 1}</Type>
        <CrossProject>0</CrossProject>
        <LinkLag>${Math.round((Number(l.lag) || 0) * 4800)}</LinkLag>
        <LagFormat>7</LagFormat>
      </PredecessorLink>`).join('');

      tasksXml += `
    <Task>
      <UID>${tUid}</UID>
      <ID>${tIdNum}</ID>
      <Name>${escapeXml(t.title)}</Name>
      <Type>0</Type>
      <IsNull>0</IsNull>
      <WBS>${wbsCode}</WBS>
      <OutlineNumber>${wbsCode}</OutlineNumber>
      <OutlineLevel>3</OutlineLevel>
      <Summary>0</Summary>
      <Start>${t.startDate}T08:00:00</Start>
      <Finish>${t.endDate}T17:00:00</Finish>
      <Duration>PT${wDays * 8}H0M0S</Duration>
      <DurationFormat>7</DurationFormat>
      <PercentComplete>${prog}</PercentComplete>
      <Notes>${escapeXml(t.note || '')}</Notes>${predXml}
      <ExtendedAttribute>
        <FieldID>188743731</FieldID>
        <Value>${escapeXml(t.color || '#cc0000')}</Value>
      </ExtendedAttribute>
    </Task>`;

    });
  });

  const xmlContent = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Project xmlns="http://schemas.microsoft.com/project">
  <SaveVersion>14</SaveVersion>
  <Name>${escapeXml(custName)}.xml</Name>
  <Title>${escapeXml(custName)}</Title>
  <ScheduleFromStart>1</ScheduleFromStart>
  <StartDate>${projStart}T08:00:00</StartDate>
  <FinishDate>${projEnd}T17:00:00</FinishDate>
  <MinutesPerDay>480</MinutesPerDay>
  <MinutesPerWeek>2880</MinutesPerWeek>
  <DaysPerMonth>26</DaysPerMonth>
  <ExtendedAttributes>
    <ExtendedAttribute>
      <FieldID>188743731</FieldID>
      <FieldName>Text1</FieldName>
      <Alias>GDHomeColor</Alias>
    </ExtendedAttribute>
  </ExtendedAttributes>
  <Tasks>${tasksXml}
  </Tasks>
</Project>`;

  const blob = new Blob([xmlContent], { type: 'application/xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safeName = custName.replace(/[^\w\d_-]+/g, '_');
  a.href = url;
  a.download = `Tien_Do_MSProject_${safeName}.xml`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('✅ Đã xuất file định dạng Microsoft Project (.xml) thành công!');
}

// Mở và đọc file định dạng Microsoft Project (.xml, .csv, .json)
function importMSProjectFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const ext = (file.name.split('.').pop() || '').toLowerCase();

    try {
      if (ext === 'json') {
        const parsed = JSON.parse(content);
        if (parsed.calendars && parsed.tasks) {
          AppState.calendars = parsed.calendars;
          AppState.tasks = parsed.tasks;
          normalizeAppState();
          autoFitMspColumns(true);
          syncAllFromMSProject(`Đã nạp dữ liệu dự án từ file "${file.name}"!`);
          return;
        }
      }

      if (ext === 'csv') {
        importFromCSVContent(content, file.name);
        return;
      }

      // Mặc định đọc chuẩn XML của Microsoft Project (MSPDI .xml)
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(content, 'text/xml');
      const taskNodes = Array.from(xmlDoc.getElementsByTagName('Task'));

      if (taskNodes.length === 0) {
        alert('Không tìm thấy dữ liệu công việc (<Task>) hợp lệ trong file MS Project này!');
        return;
      }

      const rainbowPalette = ['#cc0000', '#e65100', '#f57c00', '#d4a017', '#2e7d32', '#00897b', '#0288d1', '#3949ab', '#7b1fa2'];
      const importedCalendars = [];
      const importedTasks = [];

      const projectTitleNode = xmlDoc.querySelector('Project > Title') || xmlDoc.querySelector('Project > Name');
      const defaultProjName = (projectTitleNode ? projectTitleNode.textContent : file.name.replace(/\.[^.]+$/, '')).trim().toUpperCase();

      let currentCal = null;
      let colorIdx = 0;
      // File 3 cấp (Dự án -> Giai đoạn -> Việc) hay 2 cấp (Giai đoạn -> Việc)?
      const isThreeLevel = taskNodes.some(n => {
        const sEl = n.getElementsByTagName('Summary')[0];
        const lEl = n.getElementsByTagName('OutlineLevel')[0];
        return sEl && sEl.textContent.trim() === '1' && lEl && lEl.textContent.trim() === '2';
      });
      const importedOwners = [];
      let currentOwner = null;
      const ensureOwner = (name) => {
        currentOwner = { id: 'owner_imp_' + Date.now() + '_' + importedOwners.length, name: (name || defaultProjName || 'DỰ ÁN').toUpperCase(), collapsed: false };
        importedOwners.push(currentOwner);
        return currentOwner;
      };

      const getTagText = (parent, tag) => {
        const el = parent.getElementsByTagName(tag)[0];
        return el ? el.textContent.trim() : '';
      };

      const extractIsoDate = (rawStr) => {
        if (!rawStr) return null;
        const m = rawStr.match(/^(\d{4}-\d{2}-\d{2})/);
        if (m) return m[1];
        const d = new Date(rawStr);
        if (!isNaN(d.getTime())) return formatDateStr(d);
        return null;
      };

      taskNodes.forEach(tNode => {
        const uid = getTagText(tNode, 'UID');
        const name = getTagText(tNode, 'Name');
        const isNull = getTagText(tNode, 'IsNull');
        const outlineLevel = parseInt(getTagText(tNode, 'OutlineLevel') || '1', 10);
        const isSummary = getTagText(tNode, 'Summary') === '1';

        if (!name || isNull === '1' || uid === '0' || outlineLevel === 0) return;

        // Lấy màu từ ExtendedAttribute nếu có
        let customColor = '';
        const extAttrs = Array.from(tNode.getElementsByTagName('ExtendedAttribute'));
        extAttrs.forEach(ea => {
          const val = getTagText(ea, 'Value');
          if (/^#[0-9a-fA-F]{6}$/.test(val)) customColor = val;
        });

        if (isThreeLevel && isSummary && outlineLevel === 1) {
          // Dòng DỰ ÁN (cấp 1)
          ensureOwner(name);
          currentCal = null;
        } else if (isSummary && outlineLevel === (isThreeLevel ? 2 : 1)) {
          // Dòng GIAI ĐOẠN
          if (!currentOwner) ensureOwner(defaultProjName);
          currentCal = {
            ownerId: currentOwner.id,
            id: 'cal_imp_' + Date.now() + '_' + importedCalendars.length,
            name: name.toUpperCase(),
            customerName: name.toUpperCase(),
            color: customColor || rainbowPalette[importedCalendars.length % rainbowPalette.length],
            visible: true
          };
          importedCalendars.push(currentCal);
        } else if (!isSummary) {
          if (!currentCal) {
            if (!currentOwner) ensureOwner(defaultProjName);
            currentCal = {
              ownerId: currentOwner.id,
              id: 'cal_imp_' + Date.now() + '_0',
              name: defaultProjName || 'DỰ ÁN MS PROJECT',
              customerName: defaultProjName || 'DỰ ÁN MS PROJECT',
              color: '#cc0000',
              visible: true
            };
            importedCalendars.push(currentCal);
          }

          const startStr = extractIsoDate(getTagText(tNode, 'Start')) || formatDateStr(new Date());
          let endStr = extractIsoDate(getTagText(tNode, 'Finish')) || startStr;
          if (endStr < startStr) endStr = startStr;

          const pct = parseInt(getTagText(tNode, 'PercentComplete') || '0', 10) || 0;
          const note = getTagText(tNode, 'Notes') || '';

          let taskColor = customColor;
          if (!taskColor) {
            if (/^3D\b/i.test(name)) taskColor = '#cc0000';
            else if (/^CHỈNH SỬA 3D\b/i.test(name)) taskColor = '#f57c00';
            else if (/^HSKT\b/i.test(name)) taskColor = '#2e7d32';
            else taskColor = rainbowPalette[colorIdx++ % rainbowPalette.length];
          }

          const predLinks = Array.from(tNode.getElementsByTagName('PredecessorLink')).map(pl => ({
            uid: getTagText(pl, 'PredecessorUID'),
            type: getTagText(pl, 'Type') || '1',
            lag: Math.round((parseInt(getTagText(pl, 'LinkLag') || '0', 10) || 0) / 4800)
          })).filter(pl => pl.uid && (pl.type === '1' || pl.type === '3')); // 1 = FS, 3 = SS
          importedTasks.push({
            _uid: uid,
            _predLinks: predLinks,
            id: 'task_imp_' + Date.now() + '_' + importedTasks.length,
            calendarId: currentCal.id,
            title: name,
            startDate: startStr,
            endDate: endStr,
            color: taskColor,
            skipSundays: true,
            showCount: true,
            visibleOnBoard: true,
            progress: Math.min(100, Math.max(0, pct)),
            note
          });
        }
      });

      if (importedTasks.length === 0) {
        alert('File không có hạng mục công việc con nào để hiển thị!');
        return;
      }

      // Chuyển liên kết theo UID của MS Project sang ID nội bộ
      const uidToId = new Map(importedTasks.map(t => [t._uid, t.id]));
      importedTasks.forEach(t => {
        t.predecessors = (t._predLinks || [])
          .filter(pl => uidToId.has(pl.uid))
          .map(pl => ({ id: uidToId.get(pl.uid), type: pl.type === '3' ? 'SS' : 'FS', lag: pl.lag }));
        delete t._uid;
        delete t._predLinks;
      });

      // Hỏi người dùng muốn Gộp thêm vào dự án hiện tại hay Thay thế bằng dự án vừa mở
      const replaceMode = confirm(
        `Đã đọc được ${importedCalendars.length} dự án và ${importedTasks.length} hạng mục từ file "${file.name}".\n\n` +
        `• Bấm [OK] để MỞ ĐÈ (Thay thế bảng hiện tại bằng file vừa mở).\n` +
        `• Bấm [Cancel / Huỷ] để GỘP THÊM vào danh sách dự án hiện tại.`
      );

      if (replaceMode) {
        AppState.projectOwners = importedOwners.length ? importedOwners : AppState.projectOwners;
        AppState.calendars = importedCalendars;
        AppState.tasks = importedTasks;
      } else {
        AppState.projectOwners.push(...importedOwners);
        AppState.calendars.push(...importedCalendars);
        AppState.tasks.push(...importedTasks);
      }

      AppState.activeCalendarId = importedCalendars[0].id;

      // Tự động cập nhật khoảng tháng hiển thị theo dữ liệu file vừa mở
      const minD = importedTasks.reduce((m, t) => (t.startDate < m ? t.startDate : m), importedTasks[0].startDate);
      const maxD = importedTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), importedTasks[0].endDate);
      AppState.startMonth = minD.slice(0, 7);
      AppState.endMonth = maxD.slice(0, 7);
      document.getElementById('start-month-input').value = AppState.startMonth;
      document.getElementById('end-month-input').value = AppState.endMonth;

      normalizeAppState();
      autoFitMspColumns(true);
      syncAllFromMSProject(`✅ Đã mở thành công ${importedTasks.length} hạng mục từ file MS Project "${file.name}"!`);
    } catch (err) {
      console.error(err);
      alert('Lỗi khi đọc file MS Project: ' + err.message);
    }
  };
  reader.readAsText(file, 'utf-8');
}

function importFromCSVContent(csvText, fileName) {
  const lines = csvText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) {
    alert('File CSV trống hoặc không đúng định dạng!');
    return;
  }
  const rainbowPalette = ['#cc0000', '#e65100', '#f57c00', '#d4a017', '#2e7d32', '#00897b', '#0288d1', '#3949ab', '#7b1fa2'];
  const calName = fileName.replace(/\.[^.]+$/, '').toUpperCase();
  const newCal = {
    id: 'cal_csv_' + Date.now(),
    name: calName,
    customerName: calName,
    color: '#cc0000',
    visible: true
  };
  const newTasks = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
    if (cols.length >= 3) {
      const title = cols[1] || cols[0];
      const startStr = cols[2];
      const endStr = cols[3] || startStr;
      if (/^\d{4}-\d{2}-\d{2}$/.test(startStr)) {
        newTasks.push({
          id: 'task_csv_' + Date.now() + '_' + i,
          calendarId: newCal.id,
          title,
          startDate: startStr,
          endDate: /^\d{4}-\d{2}-\d{2}$/.test(endStr) ? endStr : startStr,
          color: rainbowPalette[(i - 1) % rainbowPalette.length],
          skipSundays: true,
          showCount: true,
          visibleOnBoard: true,
          progress: 0,
          note: ''
        });
      }
    }
  }
  if (newTasks.length === 0) {
    alert('Không tìm thấy dòng ngày tháng hợp lệ (YYYY-MM-DD) trong file CSV!');
    return;
  }
  AppState.calendars.push(newCal);
  AppState.tasks.push(...newTasks);
  AppState.activeCalendarId = newCal.id;
  autoFitMspColumns(true);
  syncAllFromMSProject(`✅ Đã nhập ${newTasks.length} công việc từ file "${fileName}"!`);
}

// =========================================================================
// XUẤT ẢNH PNG & COPY CLIPBOARD (KHÔNG BAO GIỜ BỊ CẮT CHỮ HAY LỖI Ô INPUT)
// =========================================================================
function exportMSProjectSheet(scale = 2, mode = 'download') {
  const mspSheet = document.getElementById('msp-sheet');
  const ganttBody = document.getElementById('msp-gantt-body');
  if (!mspSheet || !ganttBody) return;

  const activeBtn = mode === 'clipboard' ? document.getElementById('btn-quick-copy-clipboard') : document.getElementById('btn-open-export-modal');
  const originalText = activeBtn ? activeBtn.innerHTML : '';
  if (activeBtn) {
    activeBtn.innerHTML = mode === 'clipboard' ? 'Đang copy...' : 'Đang tạo ảnh...';
    activeBtn.disabled = true;
  }

  // Vẽ lại bảng ở chế độ xuất ảnh (trục ngày vừa khít công việc, cột tên đủ dài)
  _mspExportRendering = true;
  renderMSProjectView();

  // 1. Tính độ rộng vừa khít chính xác (pixel) cho cột "Hạng mục / Công việc" để không dư khoảng trống và không mất chữ
  const exportNameColWidth = computeTightMspNameColWidth();

  // 2. Tạo bản sao (Clone) chuyên biệt để chụp ảnh sắc nét, không làm giật màn hình
  const cloneSheet = mspSheet.cloneNode(true);
  cloneSheet.classList.add('msp-export-clone');
  cloneSheet.querySelectorAll('.msp-table-header, .msp-gantt-header').forEach(h => { h.style.transform = ''; h.classList.remove('is-stuck'); });
  cloneSheet.style.position = 'fixed';
  cloneSheet.style.left = '-19999px';
  cloneSheet.style.top = '0';
  cloneSheet.style.background = '#ffffff';
  cloneSheet.style.zIndex = '-1';

  // Ẩn thanh công cụ thêm nhanh, thanh chọn nhiều việc và thanh kéo splitter trong ảnh xuất
  const cloneQuickToolbar = cloneSheet.querySelector('#msp-quick-toolbar');
  if (cloneQuickToolbar) cloneQuickToolbar.style.display = 'none';
  const cloneMultiBar = cloneSheet.querySelector('#msp-multisel-bar');
  if (cloneMultiBar) cloneMultiBar.style.display = 'none';
  const cloneSortBtn = cloneSheet.querySelector('#btn-msp-sort-by-date');
  if (cloneSortBtn) cloneSortBtn.style.display = 'none';
  const cloneSplitter = cloneSheet.querySelector('#msp-pane-splitter');
  if (cloneSplitter) cloneSplitter.style.display = 'none';

  // Áp dụng độ rộng cột đã mở rộng toàn bộ tên việc cho bản sao
  const cloneTablePane = cloneSheet.querySelector('#msp-table-pane');
  applyMspGridColumnWidths(cloneTablePane, true, exportNameColWidth);

  // 3. Chuyển tất cả các thẻ <input> và <select> trong bản sao thành chữ hiển thị tĩnh (<span>)
  // để tránh hoàn toàn lỗi html2canvas cắt chữ bên trong thẻ <input>!
  const origInputs = mspSheet.querySelectorAll('input, select');
  const cloneInputs = cloneSheet.querySelectorAll('input, select');

  cloneInputs.forEach((cEl, idx) => {
    const oEl = origInputs[idx];
    if (!oEl) return;

    if (
      cEl.classList.contains('msp-clean-date-picker') ||
      cEl.classList.contains('msp-row-select-chk') ||
      cEl.id === 'msp-select-all-tasks'
    ) {
      cEl.remove();
      return;
    }

    const span = document.createElement('span');
    span.className = 'msp-export-static-text';

    if (cEl.tagName.toLowerCase() === 'select') {
      const selOpt = oEl.options && oEl.options[oEl.selectedIndex];
      span.textContent = selOpt ? selOpt.text : (oEl.value + '%');
      span.style.fontSize = '11.5px';
      span.style.color = oEl.value === '100' ? '#15803d' : '#1e293b';
    } else if (cEl.id === 'msp-title-prefix-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ffffff';
      span.style.fontSize = '18px';
      span.style.fontWeight = '800';
      span.style.textTransform = 'uppercase';
      span.style.marginRight = '6px';
    } else if (cEl.id === 'msp-customer-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ff4d4f';
      span.style.fontSize = '18px';
      span.style.fontWeight = '800';
      span.style.textTransform = 'uppercase';
    } else if (cEl.type === 'hidden') {
      cEl.remove();
      return;
    } else if (cEl.id === 'msp-month-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ffffff';
      span.style.fontSize = '13.5px';
      span.style.fontWeight = '700';
    } else if (cEl.classList.contains('msp-inline-owner-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '13px';
      span.style.fontWeight = '800';
      span.style.color = '#ffffff'; // Tên dự án: chữ trắng trên nền xám xanh (không dùng đỏ cho dễ đọc)
    } else if (cEl.classList.contains('msp-inline-project-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '12.5px';
      span.style.fontWeight = '800';
      span.style.color = '#0f172a';
    } else if (cEl.classList.contains('msp-inline-title-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '12px';
      span.style.fontWeight = '600';
      span.style.color = '#1e293b';
    } else if (cEl.classList.contains('msp-inline-dur-input')) {
      span.textContent = oEl.value || '';
      span.style.fontSize = '12px';
      span.style.fontWeight = '700';
      span.style.color = '#0f5132';
      span.style.marginRight = '2px';
    } else {
      span.textContent = oEl.value || '';
    }

    cEl.replaceWith(span);
  });

  // 4. Mở rộng toàn bộ khung Gantt để chụp trọn vẹn cả bảng WBS lẫn biểu đồ Gantt
  const cloneGanttPane = cloneSheet.querySelector('#msp-gantt-pane');
  if (cloneGanttPane) {
    cloneGanttPane.style.overflow = 'visible';
  }
  const fullGanttWidth = ganttBody.scrollWidth || 900;
  const fullTableWidth = parseFloat(cloneTablePane.style.width) || 680;
  const targetTotalWidth = fullTableWidth + fullGanttWidth + 2;

  // Trả màn hình về chế độ xem bình thường
  _mspExportRendering = false;
  renderMSProjectView();

  cloneSheet.style.width = `${targetTotalWidth}px`;
  document.body.appendChild(cloneSheet);

  setTimeout(() => {
    html2canvas(cloneSheet, {
      scale: scale,
      useCORS: true,
      backgroundColor: '#ffffff',
      width: targetTotalWidth,
      windowWidth: targetTotalWidth + 120
    }).then(canvas => {
      document.body.removeChild(cloneSheet);
      if (activeBtn) {
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
      }

      if (mode === 'clipboard') {
        copyCanvasToClipboard(canvas, { watermark: AppState.exportWatermark !== false, notify: showToast });
      } else {
        const custName = getCurrentCustomerName().replace(/\s+/g, '_') || 'DuAn';
        downloadCanvas(canvas, `Timeline_MSProject_${custName}.png`, AppState.exportWatermark !== false);
        showToast('✅ Đã xuất file ảnh PNG Timeline (MS Project) đầy đủ không mất chữ!');
      }
    }).catch(err => {
      if (cloneSheet.parentNode) document.body.removeChild(cloneSheet);
      if (activeBtn) {
        activeBtn.innerHTML = originalText;
        activeBtn.disabled = false;
      }
      alert('Lỗi kết xuất ảnh Timeline: ' + err.message);
    });
  }, 150);
}

// Khởi tạo
window.addEventListener('DOMContentLoaded', () => {
  setupColorPalette();
  setupSidebarEvents();
  setupQuickPopoverEvents();
  setupGridMouseInteractions();
  setupMSProjectEvents();
  setupGanttRangeSelection();
  setupEvents();
  setupCollapsibleSidebar();
  const wmChk = document.getElementById('export-watermark');
  if (wmChk) {
    wmChk.checked = AppState.exportWatermark !== false;
    wmChk.addEventListener('change', () => {
      AppState.exportWatermark = wmChk.checked;
      saveToBackend();
    });
  }
  let _resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => {
      if (AppState.viewMode === 'msproject') renderMSProjectView();
    }, 250);
  });
  const saveStatusEl = document.getElementById('save-status-indicator');
  if (saveStatusEl) {
    saveStatusEl.addEventListener('click', () => {
      if (!isOfflineFileMode()) flushSaveToBackend();
    });
  }
  bootstrapAuthAndData().finally(() => { if (typeof refreshMaterialBadges === 'function') refreshMaterialBadges(); });
});

// =========================================================================
// AI LẬP TIẾN ĐỘ (ảnh / Excel / PDF -> danh sách việc + liên kết) & ĐỒNG BỘ NOTION
// Server giữ khoá (ANTHROPIC_API_KEY, NOTION_TOKEN) – trình duyệt chỉ gọi /api/ai, /api/notion
// =========================================================================
const AIPlanner = { files: [], plan: null, rows: [] };

function featureEnabled(name) {
  return !!(_appConfig && _appConfig.features && _appConfig.features[name]);
}

function integrationBlockedReason() {
  if (typeof isOfflineFileMode === 'function' && isOfflineFileMode()) return 'Tính năng này cần mở web qua server (localhost hoặc Render), không dùng được khi mở file trực tiếp.';
  if (_guestMode) return 'Chế độ khách không dùng được tính năng này. Hãy đăng nhập Gmail.';
  return '';
}

// ----- Cài đặt kết nối (mỗi tài khoản tự dán khoá; server mã hoá & giữ, trình duyệt không đọc lại được) -----
let _intSettings = null;
const AI_KEY_HELP = {
  gemini: 'Lấy key <b>miễn phí</b> bằng chính Gmail: mở <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> → <b>Create API key</b> → copy (dạng AIza…). Gói miễn phí có giới hạn số lượt/phút.',
  openai: 'Đăng nhập <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener">platform.openai.com/api-keys</a> → <b>Create new secret key</b> → copy (sk-…). Cần nạp tiền ở mục Billing (tài khoản ChatGPT Plus KHÔNG dùng chung cho API).',
  anthropic: 'Đăng nhập <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> → <b>API Keys → Create Key</b> → copy (sk-ant-…). Cần nạp tiền ở mục Billing (gói Claude Pro KHÔNG dùng chung cho API).'
};

function setConnMsg(id, text, kind) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || '';
  el.className = 'ai-msg' + (text && kind ? ' is-' + kind : '');
}

function renderIntegrationStatus() {
  const st = _intSettings || {};
  const ai = st.ai || {};
  const nt = st.notion || {};
  const aiEl = document.getElementById('ai-conn-status');
  if (aiEl) {
    aiEl.textContent = ai.configured
      ? `✅ ${ai.providerLabel}${ai.source === 'user' ? ` (key ${ai.keyMasked})` : ' (khoá chung của server)'}`
      : '❌ chưa kết nối – bấm để cài';
    aiEl.className = ai.configured ? 'is-ok' : 'is-warn';
  }
  const prov = document.getElementById('ai-provider');
  if (prov && ai.source === 'user' && ai.provider) prov.value = ai.provider;
  const mdl = document.getElementById('ai-model');
  if (mdl && ai.source === 'user') mdl.value = ai.model || '';
  updateAiKeyHelp();
  const ntEl = document.getElementById('notion-conn-status');
  if (ntEl) {
    ntEl.textContent = nt.configured ? `✅ đã kết nối${nt.source === 'user' ? ` (mã ${nt.tokenMasked})` : ' (dùng chung của server)'}` : '❌ chưa kết nối – bấm để cài';
    ntEl.className = nt.configured ? 'is-ok' : 'is-warn';
  }
  const dpWrap = document.getElementById('notion-date-wrap');
  const dpSel = document.getElementById('notion-date-prop');
  if (dpWrap && dpSel) {
    const props = nt.dateProps || [];
    dpWrap.style.display = nt.configured && props.length ? '' : 'none';
    dpSel.innerHTML = '';
    props.forEach(n => { const o = document.createElement('option'); o.value = n; o.textContent = n; dpSel.appendChild(o); });
    if (nt.dateProp) dpSel.value = nt.dateProp;
    const t = document.getElementById('notion-db-title');
    if (t) t.textContent = nt.dbTitle ? `Bảng Notion: ${nt.dbTitle}` : '';
  }
  const dbInp = document.getElementById('notion-db');
  if (dbInp && nt.source === 'user' && nt.db && !dbInp.value) dbInp.value = nt.db;
  const openDb = document.getElementById('notion-open-db');
  if (openDb) {
    openDb.style.display = nt.dbUrl ? '' : 'none';
    if (nt.dbUrl) openDb.href = nt.dbUrl;
  }
  document.querySelectorAll('#notion-sync-modal .notion-actions button').forEach(b => { b.disabled = !nt.configured; });
}

function updateAiKeyHelp() {
  const prov = document.getElementById('ai-provider');
  const help = document.getElementById('ai-key-help');
  if (prov && help) help.innerHTML = AI_KEY_HELP[prov.value] || '';
}

async function fetchIntegrationSettings() {
  try {
    const res = await apiFetch('/api/integrations/settings');
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) _intSettings = json;
  } catch (e) { /* bỏ qua */ }
  renderIntegrationStatus();
  return _intSettings;
}

async function saveIntegrationSettings(payload, msgId) {
  setConnMsg(msgId, '⏳ Đang kiểm tra kết nối…', 'busy');
  try {
    const res = await apiFetch('/api/integrations/settings', { method: 'POST', body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
    _intSettings = json;
    renderIntegrationStatus();
    setConnMsg(msgId, payload.clear ? 'Đã gỡ kết nối.' : '✅ Kết nối thành công, đã lưu (khoá được mã hoá trên server).', 'ok');
    return true;
  } catch (err) {
    setConnMsg(msgId, '⚠ ' + err.message, 'warn');
    return false;
  }
}

function openModalById(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
  if (window.lucide) window.lucide.createIcons();
}

function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error('Không tải được thư viện ' + src));
    document.head.appendChild(s);
  });
}

function readFileAs(file, how) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    if (how === 'buffer') r.readAsArrayBuffer(file); else r.readAsDataURL(file);
  });
}

// Thu nhỏ ảnh (cạnh dài ≤ 1568px) để gửi AI nhanh & rẻ
async function imageFileToPayload(file) {
  const dataUrl = await readFileAs(file, 'dataurl');
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = dataUrl; });
  const maxSide = 1568;
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { mediaType: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.85).split(',')[1] };
}

async function sheetFileToText(file) {
  if (/\.csv$/i.test(file.name)) return await file.text();
  await loadScriptOnce('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');
  const wb = window.XLSX.read(await readFileAs(file, 'buffer'), { type: 'array' });
  return wb.SheetNames.map(n => `### Sheet: ${n}\n` + window.XLSX.utils.sheet_to_csv(wb.Sheets[n], { blankrows: false })).join('\n\n');
}

function renderAiFileList() {
  const el = document.getElementById('ai-file-list');
  if (!el) return;
  el.innerHTML = '';
  AIPlanner.files.forEach((f, i) => {
    const chip = document.createElement('span');
    chip.className = 'ai-file-chip';
    chip.textContent = f.name;
    const x = document.createElement('button');
    x.type = 'button'; x.textContent = '×'; x.title = 'Bỏ file này';
    x.addEventListener('click', () => { AIPlanner.files.splice(i, 1); renderAiFileList(); });
    chip.appendChild(x);
    el.appendChild(chip);
  });
}

function addAiFiles(list) {
  Array.from(list || []).forEach(f => {
    if (/^image\//.test(f.type) || /\.(xlsx|xls|csv|pdf)$/i.test(f.name)) AIPlanner.files.push(f);
  });
  AIPlanner.files = AIPlanner.files.slice(0, 8);
  renderAiFileList();
}

function fillAiStageSelect() {
  const sel = document.getElementById('ai-target-stage');
  if (!sel) return;
  sel.innerHTML = '';
  const activeCal = getActiveCalendar();
  (AppState.projectOwners || []).forEach(o => {
    const g = document.createElement('optgroup');
    g.label = `Dự án: ${o.name || '(chưa đặt tên)'}`;
    const optNew = document.createElement('option');
    optNew.value = 'new:' + o.id;
    optNew.textContent = '＋ Giai đoạn mới (tên do AI đặt)';
    g.appendChild(optNew);
    AppState.calendars.filter(c => c.ownerId === o.id).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      g.appendChild(opt);
    });
    sel.appendChild(g);
  });
  const orphan = AppState.calendars.filter(c => !(AppState.projectOwners || []).some(o => o.id === c.ownerId));
  orphan.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt); });
  if (activeCal) sel.value = 'new:' + activeCal.ownerId;
  if (!sel.value && sel.options.length) sel.selectedIndex = 0;
}

function openAiPlanner() {
  if (AIPlanner.running) { showAiBgPanel('running', 'AI vẫn đang lập tiến độ… xong sẽ báo ở đây.'); return; }
  const msg = document.getElementById('ai-input-msg');
  const reason = integrationBlockedReason();
  if (msg) { msg.textContent = reason; msg.className = 'ai-msg' + (reason ? ' is-warn' : ''); }
  if (!reason) {
    fetchIntegrationSettings().then(st => {
      const det = document.getElementById('ai-settings');
      if (det) det.open = !(st && st.ai && st.ai.configured);
    });
  }
  const sd = document.getElementById('ai-start-date');
  if (sd && !sd.value) sd.value = formatDateStr(new Date());
  fillAiStageSelect();
  document.getElementById('ai-step-input').style.display = '';
  document.getElementById('ai-step-review').style.display = 'none';
  openModalById('ai-planner-modal');
}

function getAiTargetWorkDays() {
  const mode = document.getElementById('ai-limit-mode').value;
  const start = document.getElementById('ai-start-date').value || formatDateStr(new Date());
  if (mode === 'days') return Math.max(1, parseInt(document.getElementById('ai-target-days').value, 10) || 0) || null;
  if (mode === 'end') {
    const end = document.getElementById('ai-end-date').value;
    if (!end || end < start) return null;
    return Math.max(1, Math.round(countWorkingDays(start, end, true)));
  }
  return null;
}

async function runAiPlanner() {
  const msg = document.getElementById('ai-input-msg');
  const btn = document.getElementById('btn-ai-run');
  const reason = integrationBlockedReason();
  if (reason) { msg.textContent = reason; msg.className = 'ai-msg is-warn'; return; }
  if (_intSettings && _intSettings.ai && !_intSettings.ai.configured) {
    document.getElementById('ai-settings').open = true;
    msg.textContent = 'Chưa kết nối AI: chọn Gemini / ChatGPT / Claude, dán API key rồi bấm "Lưu & kiểm tra".';
    msg.className = 'ai-msg is-warn';
    return;
  }
  const notes = document.getElementById('ai-notes').value.trim();
  if (!AIPlanner.files.length && !notes) { msg.textContent = 'Hãy chọn ít nhất 1 ảnh / file hoặc nhập mô tả.'; msg.className = 'ai-msg is-warn'; return; }
  if (document.getElementById('ai-limit-mode').value !== 'auto' && !getAiTargetWorkDays()) {
    msg.textContent = 'Nhập số ngày hoặc ngày kết thúc (sau ngày bắt đầu).'; msg.className = 'ai-msg is-warn'; return;
  }
  if (AIPlanner.running) { msg.textContent = 'AI đang chạy yêu cầu trước, đợi xong đã nhé.'; msg.className = 'ai-msg is-warn'; return; }
  AIPlanner.running = true;
  btn.disabled = true;
  msg.className = 'ai-msg is-busy';
  msg.textContent = '⏳ Đang đọc file…';
  try {
    const payload = { images: [], pdfs: [], sheetText: '', notes };
    for (const f of AIPlanner.files) {
      if (/^image\//.test(f.type)) payload.images.push(await imageFileToPayload(f));
      else if (/\.pdf$/i.test(f.name)) {
        if (f.size > 7 * 1024 * 1024) throw new Error(`File PDF "${f.name}" quá lớn (> 7MB)`);
        payload.pdfs.push({ data: (await readFileAs(f, 'dataurl')).split(',')[1] });
      } else payload.sheetText += `\n\n## File: ${f.name}\n` + (await sheetFileToText(f));
    }
    payload.startDate = document.getElementById('ai-start-date').value || formatDateStr(new Date());
    payload.targetWorkDays = getAiTargetWorkDays();
    const target = document.getElementById('ai-target-stage').value;
    const ownerId = target.startsWith('new:') ? target.slice(4) : (AppState.calendars.find(c => c.id === target) || {}).ownerId;
    const owner = (AppState.projectOwners || []).find(o => o.id === ownerId);
    payload.projectName = owner ? owner.name : '';
    msg.textContent = '';
    msg.className = 'ai-msg';
    // Chạy nền: ẩn cửa sổ AI, hiện thông báo nhỏ góc màn hình để làm việc khác
    document.getElementById('ai-planner-modal').classList.remove('active');
    showAiBgPanel('running', 'AI đang đọc file và lập tiến độ… (thường 20–60 giây)<br><small>Anh cứ làm việc khác, xong sẽ báo ở đây.</small>');
    const res = await apiFetch('/api/ai/schedule', { method: 'POST', body: JSON.stringify(payload) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
    AIPlanner.plan = json.plan;
    AIPlanner.startDate = payload.startDate;
    AIPlanner.targetWorkDays = payload.targetWorkDays;
    AIPlanner.rows = json.plan.tasks.map((t, i) => ({ ...t, include: true, idx: i }));
    showAiReview();
    if (!AIPlanner.rows.length) {
      showAiBgPanel('error', 'AI không tìm thấy hạng mục công việc nào trong file.', 'Mở lại');
    } else {
      showAiBgPanel('done', `✨ AI đã đề xuất <b>${AIPlanner.rows.length}</b> công việc.`, 'Xem & thêm vào lịch');
    }
  } catch (err) {
    const modalOpen = document.getElementById('ai-planner-modal').classList.contains('active');
    msg.textContent = '⚠ ' + err.message;
    msg.className = 'ai-msg is-warn';
    if (!modalOpen) showAiBgPanel('error', escapeHtmlAi(err.message), 'Mở lại');
  } finally {
    btn.disabled = false;
    AIPlanner.running = false;
  }
}

function escapeHtmlAi(t) {
  return String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Ô thông báo nhỏ góc phải dưới khi AI chạy nền
function showAiBgPanel(state, html, actionLabel) {
  let el = document.getElementById('ai-bg-panel');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ai-bg-panel';
    el.className = 'ai-bg-panel';
    document.body.appendChild(el);
  }
  el.className = 'ai-bg-panel is-' + state;
  el.innerHTML = '';
  const icon = document.createElement('div');
  icon.className = 'ai-bg-icon';
  icon.textContent = state === 'running' ? '' : state === 'done' ? '✅' : '⚠';
  if (state === 'running') icon.innerHTML = '<span class="ai-spinner"></span>';
  const body = document.createElement('div');
  body.className = 'ai-bg-body';
  const text = document.createElement('div');
  text.innerHTML = html;
  body.appendChild(text);
  if (actionLabel) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-primary btn-sm';
    btn.textContent = actionLabel;
    btn.addEventListener('click', () => {
      hideAiBgPanel();
      openModalById('ai-planner-modal');
      const review = state === 'done';
      document.getElementById('ai-step-input').style.display = review ? 'none' : '';
      document.getElementById('ai-step-review').style.display = review ? '' : 'none';
    });
    body.appendChild(btn);
  }
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'ai-bg-close';
  close.title = state === 'running' ? 'Ẩn (AI vẫn chạy tiếp)' : 'Đóng';
  close.textContent = '×';
  close.addEventListener('click', hideAiBgPanel);
  el.appendChild(icon);
  el.appendChild(body);
  el.appendChild(close);
  el.style.display = 'flex';
}

function hideAiBgPanel() {
  const el = document.getElementById('ai-bg-panel');
  if (el) el.style.display = 'none';
}

// Tính ngày cho từng việc theo lịch làm việc (bỏ ngày nghỉ / lễ) + liên kết FS/SS
function computeAiRowDates() {
  const start0 = shiftDateByWorkingDays(AIPlanner.startDate, 0, true);
  const rows = AIPlanner.rows;
  rows.forEach((r, i) => {
    let s = null;
    (r.dependsOn || []).forEach(d => {
      const p = rows[d.index];
      if (!p || d.index >= i || !p.include || !p.start) return;
      const cand = getLinkedStartDate({ startDate: p.start, endDate: p.end }, { type: d.type, lag: d.lag }, true);
      if (!s || cand > s) s = cand;
    });
    r.start = s || start0;
    r.end = computeEndDateByWorkingDays(r.start, r.workDays, true);
  });
  const inc = rows.filter(r => r.include);
  const maxEnd = inc.reduce((m, r) => (r.end > m ? r.end : m), start0);
  return { start: start0, end: maxEnd, workDays: inc.length ? countWorkingDays(start0, maxEnd, true) : 0, calDays: inc.length ? Math.round((parseDateStr(maxEnd) - parseDateStr(start0)) / 86400000) + 1 : 0 };
}

function fmtVnDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function showAiReview() {
  document.getElementById('ai-step-input').style.display = 'none';
  document.getElementById('ai-step-review').style.display = '';
  const plan = AIPlanner.plan || {};
  const sum = document.getElementById('ai-summary');
  sum.innerHTML = '';
  const nameLbl = document.createElement('label');
  nameLbl.textContent = 'Tên giai đoạn: ';
  const nameInp = document.createElement('input');
  nameInp.type = 'text'; nameInp.id = 'ai-stage-name'; nameInp.value = plan.stageName || 'Tiến độ AI đề xuất';
  nameLbl.appendChild(nameInp);
  const p = document.createElement('div');
  p.className = 'ai-summary-text';
  p.textContent = plan.summary || '';
  sum.appendChild(nameLbl); sum.appendChild(p);
  const target = document.getElementById('ai-target-stage').value;
  nameLbl.style.display = target.startsWith('new:') ? '' : 'none';
  const q = document.getElementById('ai-questions');
  q.innerHTML = '';
  if (plan.questions && plan.questions.length) {
    const t = document.createElement('div'); t.className = 'ai-q-title'; t.textContent = 'AI cần anh/chị xác nhận thêm:'; q.appendChild(t);
    plan.questions.forEach(x => { const li = document.createElement('div'); li.textContent = '• ' + x; q.appendChild(li); });
  }
  renderAiReviewTable();
}

function renderAiReviewTable() {
  const info = computeAiRowDates();
  const tb = document.getElementById('ai-review-body');
  tb.innerHTML = '';
  AIPlanner.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (!r.include) tr.className = 'is-off';
    const c0 = document.createElement('td');
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = r.include;
    chk.addEventListener('change', () => { r.include = chk.checked; renderAiReviewTable(); });
    c0.appendChild(chk);
    const c1 = document.createElement('td'); c1.textContent = i + 1;
    const c2 = document.createElement('td');
    const nm = document.createElement('input'); nm.type = 'text'; nm.value = r.name; nm.title = r.note || '';
    nm.addEventListener('change', () => { r.name = nm.value.trim() || r.name; });
    c2.appendChild(nm);
    const c3 = document.createElement('td');
    const wd = document.createElement('input'); wd.type = 'number'; wd.min = '0.5'; wd.step = '0.5'; wd.value = r.workDays; wd.className = 'ai-num';
    wd.addEventListener('change', () => { r.workDays = Math.max(0.5, Math.round((parseFloat(wd.value) || 1) * 2) / 2); renderAiReviewTable(); });
    c3.appendChild(wd);
    const c4 = document.createElement('td');
    c4.textContent = (r.dependsOn || []).filter(d => d.index < i).map(d => `${d.index + 1}${d.type === 'SS' ? ' (SS)' : ''}`).join(', ');
    const c5 = document.createElement('td'); c5.textContent = r.include ? fmtVnDate(r.start) : '';
    const c6 = document.createElement('td'); c6.textContent = r.include ? fmtVnDate(r.end) : '';
    [c0, c1, c2, c3, c4, c5, c6].forEach(c => tr.appendChild(c));
    tb.appendChild(tr);
  });
  const tot = document.getElementById('ai-total');
  const over = AIPlanner.targetWorkDays && info.workDays > AIPlanner.targetWorkDays;
  tot.innerHTML = '';
  tot.textContent = `Tổng: ${fmtVnDate(info.start)} → ${fmtVnDate(info.end)} · ${info.workDays} ngày làm việc · ${info.calDays} ngày thực tế`
    + (AIPlanner.targetWorkDays ? ` (mục tiêu ${AIPlanner.targetWorkDays} ngày làm việc)` : '');
  tot.classList.toggle('is-over', !!over);
  document.getElementById('btn-ai-fit').style.display = AIPlanner.targetWorkDays && info.workDays !== AIPlanner.targetWorkDays ? '' : 'none';
}

// Co giãn thời lượng các việc để tổng vừa đúng số ngày mục tiêu
function fitAiRowsToTarget() {
  const target = AIPlanner.targetWorkDays;
  if (!target) return;
  for (let k = 0; k < 4; k++) {
    const info = computeAiRowDates();
    if (!info.workDays || info.workDays === target) break;
    const f = target / info.workDays;
    AIPlanner.rows.forEach(r => { r.workDays = Math.max(0.5, Math.round(r.workDays * f * 2) / 2); });
  }
  renderAiReviewTable();
}

function applyAiPlan() {
  const rows = AIPlanner.rows.filter(r => r.include);
  if (!rows.length) { showToast('Chưa chọn công việc nào'); return; }
  computeAiRowDates();
  const target = document.getElementById('ai-target-stage').value;
  let cal;
  if (target.startsWith('new:')) {
    const ownerId = target.slice(4);
    const name = (document.getElementById('ai-stage-name') || {}).value || 'Tiến độ AI đề xuất';
    cal = { id: 'cal_' + Date.now(), ownerId, name: name.trim(), customerName: name.trim(), color: getActiveCalendar() ? getActiveCalendar().color : '#3b82f6', visible: true };
    AppState.calendars.push(cal);
  } else {
    cal = AppState.calendars.find(c => c.id === target);
  }
  if (!cal) { showToast('Không tìm thấy giai đoạn đích'); return; }
  cal.visible = true;
  const idMap = new Map();
  const stamp = Date.now();
  AIPlanner.rows.forEach((r, i) => { if (r.include) idMap.set(i, `task_ai_${stamp}_${i}`); });
  const created = [];
  AIPlanner.rows.forEach((r, i) => {
    if (!r.include) return;
    const t = {
      id: idMap.get(i),
      calendarId: cal.id,
      title: r.name,
      startDate: r.start,
      endDate: r.end,
      color: getNextSequentialPaletteColor(cal.id) || cal.color,
      skipSundays: true,
      showCount: true,
      note: r.note || '',
      progress: 0,
      predecessors: []
    };
    AppState.tasks.push(t);
    created.push({ t, r, i });
  });
  created.forEach(({ t, r, i }) => {
    (r.dependsOn || []).forEach(d => {
      if (d.index >= i || !idMap.has(d.index)) return;
      const pred = AppState.tasks.find(x => x.id === idMap.get(d.index));
      if (pred) addPredecessorLink(t, pred, AppState.tasks, d.type);
    });
  });
  AppState.activeCalendarId = cal.id;
  hideAiBgPanel();
  document.getElementById('ai-planner-modal').classList.remove('active');
  AIPlanner.files = []; renderAiFileList();
  syncAllFromMSProject(`✨ Đã thêm ${created.length} công việc AI đề xuất vào "${cal.name}"`);
}

// ---------------------------- NOTION ----------------------------
function notionLog(text, cls = '') {
  const el = document.getElementById('notion-log');
  if (!el) return;
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = `${new Date().toLocaleTimeString('vi-VN')} – ${text}`;
  el.prepend(d);
}


function openNotionSync() {
  const reason = integrationBlockedReason();
  const st = document.getElementById('notion-status-msg');
  st.textContent = reason;
  st.className = 'ai-msg' + (reason ? ' is-warn' : '');
  document.querySelectorAll('#notion-sync-modal .notion-actions button').forEach(b => { b.disabled = true; });
  openModalById('notion-sync-modal');
  if (!reason) {
    fetchIntegrationSettings().then(s2 => {
      const det = document.getElementById('notion-settings');
      if (det) det.open = !(s2 && s2.notion && s2.notion.configured);
    });
  }
}


// Dự án & giai đoạn RIÊNG cho lịch Notion (không trộn vào dự án đang chọn)
const NOTION_OWNER_ID = 'owner_notion';
function ensureNotionStage(dbId, dbTitle) {
  if (!Array.isArray(AppState.projectOwners)) AppState.projectOwners = [];
  let owner = AppState.projectOwners.find(o => o.id === NOTION_OWNER_ID);
  if (!owner) {
    owner = { id: NOTION_OWNER_ID, name: 'NOTION', collapsed: false };
    AppState.projectOwners.push(owner);
  }
  const calId = 'cal_notion_' + dbId;
  let cal = AppState.calendars.find(c => c.id === calId);
  const name = (dbTitle || 'Lịch Notion').toUpperCase();
  if (!cal) {
    cal = { id: calId, ownerId: NOTION_OWNER_ID, name, customerName: name, color: '#64748b', visible: true, isNotion: true };
    AppState.calendars.push(cal);
  } else if (cal.name !== name) {
    cal.name = name;
    cal.customerName = name;
  }
  return cal;
}

function notionSnap(t) { return [t.title, t.startDate, t.endDate].join('|'); }

async function notionPullTasks() {
  notionLog('Đang lấy lịch từ Notion…');
  const res = await apiFetch('/api/notion/pull');
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
  const cal = ensureNotionStage(json.dbId, json.dbTitle);
  const seen = new Set();
  let updated = 0, added = 0;
  json.items.forEach((it, idx) => {
    if (!it.start) return;
    seen.add(it.pageId);
    const end = it.end && it.end >= it.start ? it.end : it.start;
    let t = AppState.tasks.find(x => x.calendarId === cal.id && x.notionPageId === it.pageId);
    if (t) {
      if (t.notionSyncedAt && it.lastEdited <= t.notionSyncedAt) return; // Notion chưa sửa từ lần trước
      if (t.title !== it.name || t.startDate !== it.start || t.endDate !== end) updated++;
      t.title = it.name; t.startDate = it.start; t.endDate = end;
    } else {
      t = {
        id: `task_nt_${Date.now()}_${idx}`,
        calendarId: cal.id,
        title: it.name,
        startDate: it.start,
        endDate: end,
        color: getNextSequentialPaletteColor(cal.id) || cal.color,
        skipSundays: false, // giữ đúng ngày như trên Notion (tính theo ngày thực tế)
        showCount: true,
        note: '',
        progress: 0,
        predecessors: [],
        notionPageId: it.pageId
      };
      AppState.tasks.push(t);
      added++;
    }
    t.notionSyncedAt = it.lastEdited;
    t.notionSnap = notionSnap(t);
  });
  // Dòng đã xoá trên Notion (hoặc bỏ trống ngày) -> bỏ khỏi dự án NOTION
  const before = AppState.tasks.length;
  AppState.tasks = AppState.tasks.filter(t => t.calendarId !== cal.id || !t.notionPageId || seen.has(t.notionPageId));
  const removed = before - AppState.tasks.length;
  cal.visible = true;
  syncAllFromMSProject();
  notionLog(`Lấy về "${json.dbTitle}" (cột ngày "${json.dateProp}"): thêm ${added}, cập nhật ${updated}${removed ? `, bỏ ${removed}` : ''} việc → dự án NOTION.`, 'is-ok');
  return cal;
}

// Đẩy lại các việc trong dự án NOTION đã sửa tên/ngày trong app
async function notionPushLocalEdits() {
  const changed = AppState.tasks.filter(t => t.notionPageId && String(t.calendarId || '').startsWith('cal_notion_') && t.notionSnap && t.notionSnap !== notionSnap(t));
  if (!changed.length) { notionLog('Không có việc nào sửa trong app cần gửi lên Notion.'); return; }
  notionLog(`Đang gửi ${changed.length} việc đã sửa lên Notion…`);
  const items = changed.map(t => ({ pageId: t.notionPageId, name: t.title, start: t.startDate, end: t.endDate }));
  const res = await apiFetch('/api/notion/push', { method: 'POST', body: JSON.stringify({ items }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
  let ok = 0, failed = 0;
  json.results.forEach(r => {
    const t = AppState.tasks.find(x => x.notionPageId === r.pageId);
    if (r.error || !t) { failed++; return; }
    t.notionSyncedAt = r.lastEdited;
    t.notionSnap = notionSnap(t);
    ok++;
  });
  saveToBackend();
  notionLog(`Đã cập nhật ${ok} việc lên Notion${failed ? `, lỗi ${failed}` : ''}.`, failed ? 'is-warn' : 'is-ok');
}


async function runNotionAction(kind) {
  const btns = document.querySelectorAll('#notion-sync-modal .notion-actions button');
  btns.forEach(b => { b.disabled = true; });
  try {
    if (kind === 'both') await notionPushLocalEdits();
    await notionPullTasks();
    showToast('Đồng bộ Notion xong');
  } catch (err) {
    notionLog('⚠ ' + err.message, 'is-warn');
  } finally {
    btns.forEach(b => { b.disabled = false; });
  }
}

function setupIntegrationsUI() {
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => {
    const m = document.getElementById(b.dataset.closeModal);
    if (m) m.classList.remove('active');
  }));
  const openAi = () => { document.querySelectorAll('.hdr-dropdown.open').forEach(d => d.classList.remove('open')); openAiPlanner(); };
  ['btn-open-ai-planner', 'btn-open-ai-planner-menu'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', openAi); });
  const nb = document.getElementById('btn-open-notion-sync');
  if (nb) nb.addEventListener('click', () => { document.querySelectorAll('.hdr-dropdown.open').forEach(d => d.classList.remove('open')); openNotionSync(); });
  const fi = document.getElementById('ai-file-input');
  if (fi) fi.addEventListener('change', () => { addAiFiles(fi.files); fi.value = ''; });
  const dz = document.getElementById('ai-drop-zone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('is-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('is-over'));
    dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('is-over'); addAiFiles(e.dataTransfer.files); });
  }
  document.addEventListener('paste', e => {
    const m = document.getElementById('ai-planner-modal');
    if (!m || !m.classList.contains('active')) return;
    const files = Array.from(e.clipboardData ? e.clipboardData.files : []);
    if (files.length) { e.preventDefault(); addAiFiles(files); }
  });
  const lm = document.getElementById('ai-limit-mode');
  if (lm) lm.addEventListener('change', () => {
    document.getElementById('ai-days-wrap').style.display = lm.value === 'days' ? '' : 'none';
    document.getElementById('ai-end-wrap').style.display = lm.value === 'end' ? '' : 'none';
  });
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('btn-ai-run', runAiPlanner);
  on('btn-ai-back', () => { document.getElementById('ai-step-input').style.display = ''; document.getElementById('ai-step-review').style.display = 'none'; });
  on('btn-ai-fit', fitAiRowsToTarget);
  on('btn-ai-apply', applyAiPlan);
  on('btn-notion-sync2', () => runNotionAction('both'));
  on('btn-notion-pull', () => runNotionAction('pull'));
  const prov = document.getElementById('ai-provider');
  if (prov) prov.addEventListener('change', updateAiKeyHelp);
  updateAiKeyHelp();
  on('btn-ai-save-conn', async () => {
    const ok = await saveIntegrationSettings({
      aiProvider: document.getElementById('ai-provider').value,
      aiKey: document.getElementById('ai-key').value.trim(),
      aiModel: document.getElementById('ai-model').value.trim()
    }, 'ai-conn-msg');
    if (ok) { document.getElementById('ai-key').value = ''; setConnMsg('ai-input-msg', ''); }
  });
  on('btn-ai-clear-conn', () => saveIntegrationSettings({ clear: 'ai' }, 'ai-conn-msg'));
  on('btn-notion-save-conn', async () => {
    const ok = await saveIntegrationSettings({
      notionToken: document.getElementById('notion-token').value.trim(),
      notionDb: document.getElementById('notion-db').value.trim()
    }, 'notion-conn-msg');
    if (ok) document.getElementById('notion-token').value = '';
  });
  on('btn-notion-clear-conn', () => saveIntegrationSettings({ clear: 'notion' }, 'notion-conn-msg'));
  const dpSel = document.getElementById('notion-date-prop');
  if (dpSel) dpSel.addEventListener('change', () => saveIntegrationSettings({ notionDateProp: dpSel.value }, 'notion-conn-msg'));
}
window.addEventListener('DOMContentLoaded', setupIntegrationsUI);

// Tuỳ chọn tự nối liên kết + nút nối các việc cũ chưa nối
window.addEventListener('DOMContentLoaded', () => {
  const tg = document.getElementById('toggle-auto-link');
  if (tg) {
    tg.checked = AppState.autoLinkNewTasks !== false;
    tg.addEventListener('change', () => {
      AppState.autoLinkNewTasks = tg.checked;
      saveToBackend();
      showToast(tg.checked ? 'Việc mới tạo sẽ tự nối với việc trước trong cùng giai đoạn' : 'Đã tắt tự nối việc mới');
    });
  }
  const btn = document.getElementById('btn-auto-link-stages');
  if (btn) btn.addEventListener('click', () => {
    const timelineOn = !!document.querySelector('.msp-split-workspace') && !!document.querySelector('.msp-split-workspace').offsetParent;
    const cals = timelineOn && typeof getMspTargetCalendars === 'function' ? getMspTargetCalendars() : [getActiveCalendar()].filter(Boolean);
    let n = 0;
    cals.forEach(c => { n += autoLinkStage(c.id, AppState.tasks, { markAuto: true }); });
    if (!n) { showToast('Không có việc nào cần nối thêm (các việc đã có liên kết hoặc cách nhau quá xa)'); return; }
    syncAllFromMSProject(`🔗 Đã tự nối ${n} liên kết trong ${cals.length} giai đoạn (Ctrl+Z để hoàn tác)`);
  });
  const btnRe = document.getElementById('btn-auto-relink-stages');
  if (btnRe) btnRe.addEventListener('click', () => {
    const timelineOn = !!document.querySelector('.msp-split-workspace') && !!document.querySelector('.msp-split-workspace').offsetParent;
    const cals = timelineOn && typeof getMspTargetCalendars === 'function' ? getMspTargetCalendars() : [getActiveCalendar()].filter(Boolean);
    if (!cals.length) return;
    const names = cals.map(c => c.name).slice(0, 4).join(', ') + (cals.length > 4 ? '…' : '');
    if (!confirm(`Nối lại TOÀN BỘ liên kết trong ${cals.length} giai đoạn đang hiển thị (${names}) theo quy tắc mới?\n\nCác liên kết hiện có giữa các việc trong những giai đoạn này sẽ được thay thế. Ctrl+Z để hoàn tác.`)) return;
    const calIds = new Set(cals.map(c => c.id));
    const taskCal = new Map(AppState.tasks.map(t => [t.id, t.calendarId]));
    AppState.tasks.forEach(t => {
      if (!calIds.has(t.calendarId) || !Array.isArray(t.predecessors)) return;
      t.predecessors = t.predecessors.filter(l => taskCal.get(l.id) !== t.calendarId); // giữ liên kết khác giai đoạn
    });
    let n = 0;
    cals.forEach(c => { n += autoLinkStage(c.id, AppState.tasks, { markAuto: true }); });
    syncAllFromMSProject(`↺ Đã nối lại ${n} liên kết trong ${cals.length} giai đoạn (Ctrl+Z để hoàn tác)`);
  });
});
