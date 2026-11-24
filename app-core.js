// Lõi trang Lịch: hoàn tác, trạng thái, bảng màu, âm lịch, chuẩn hoá dữ liệu, lưu/đồng bộ, đăng nhập.
// Tách từ app.js: các file app-*.js chạy nối tiếp nhau (chung phạm vi toàn cục), giữ đúng thứ tự nạp trong index.html.
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
      designNote: AppState.designNote,
      constructionNote: AppState.constructionNote,
      designCustomTitlePrefix: AppState.designCustomTitlePrefix,
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
    if (data.daysOffConfig) AppState.daysOffConfig = data.daysOffConfig;
    if (data.projectOwners) AppState.projectOwners = data.projectOwners;
    if (data.footerNote !== undefined) AppState.footerNote = data.footerNote;
    loadScheduleText(data);
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
    btnRedo.disabled = _redoStack.length === 0;
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

const scheduleTextDefaults = {
  designCustomTitlePrefix:'TIẾN ĐỘ THIẾT KẾ DỰ KIẾN -',
  mspCustomTitlePrefix:'TIẾN ĐỘ THI CÔNG DỰ KIẾN -',
  designNote:'Tiến độ chưa bao gồm thời gian trao đổi công việc',
  constructionNote:'Các hạng mục thay đổi khi thi công sẽ làm kéo dài thời gian thi công'
};
function migrateScheduleText(field,value) {
  if (typeof value !== 'string') return scheduleTextDefaults[field];
  return field === 'mspCustomTitlePrefix' && value.trim() === scheduleTextDefaults.designCustomTitlePrefix ? scheduleTextDefaults.mspCustomTitlePrefix : value;
}
function loadScheduleText(source) {
  for (const field of Object.keys(scheduleTextDefaults)) {
    AppState[field] = migrateScheduleText(field,source[field]);
    for (const owner of AppState.projectOwners || []) if (typeof owner[field] !== 'string') owner[field] = AppState[field];
  }
}
function scheduleTextOwner(field) {
  return getTitleProject(['constructionNote','mspCustomTitlePrefix'].includes(field) ? 'msproject' : 'calendar');
}
function scheduleTextValue(field) {
  return scheduleTextOwner(field)?.[field] ?? AppState[field];
}
function setScheduleText(field,value) {
  AppState[field] = value;
  const owner = scheduleTextOwner(field);
  if (owner) owner[field] = value;
}
function renderScheduleText() {
  for (const [id,field] of [['design-title-prefix','designCustomTitlePrefix'],['msp-title-prefix-input','mspCustomTitlePrefix'],
    ['design-note-text','designNote'],['construction-note-text','constructionNote']]) {
    const element = document.getElementById(id), value = scheduleTextValue(field);
    if (element && document.activeElement !== element && element.textContent !== value) element.textContent = value;
  }
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
  ...scheduleTextDefaults,
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

function showToast(message) {
  GDHomeShell.toast(message,document.getElementById('toast-notification'));
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

// Sắp lại theo dòng thời gian trong các giai đoạn đã chọn; việc đã NỐI với nhau (cùng giai đoạn) luôn đứng liền nhau.
// Mỗi chuỗi nối xếp theo ngày sớm nhất của chuỗi; trong chuỗi cũng theo ngày. Giữ nguyên vị trí khối của từng giai đoạn.
function sortTasksByTimeKeepLinked(calIds) {
  const byDate = (a, b) => (a.startDate || '').localeCompare(b.startDate || '') || (a.endDate || '').localeCompare(b.endDate || '');
  const parent = new Map();
  const find = id => { while (parent.get(id) !== id) id = parent.get(id); return id; };
  const inScope = AppState.tasks.filter(t => calIds.has(t.calendarId));
  const byId = new Map(inScope.map(t => [t.id, t]));
  inScope.forEach(t => parent.set(t.id, t.id));
  inScope.forEach(t => (t.predecessors || []).forEach(l => {
    const p = byId.get(l.id);
    if (p && p.calendarId === t.calendarId) parent.set(find(t.id), find(p.id));
  }));
  const sortedByCal = new Map();
  calIds.forEach(cid => {
    const groups = new Map();
    inScope.filter(t => t.calendarId === cid).forEach(t => {
      const root = find(t.id);
      if (!groups.has(root)) groups.set(root, []);
      groups.get(root).push(t);
    });
    const list = [...groups.values()].map(g => g.sort(byDate)).sort((a, b) => byDate(a[0], b[0])).flat();
    sortedByCal.set(cid, list);
  });
  const cursor = new Map();
  AppState.tasks = AppState.tasks.map(t => {
    if (!sortedByCal.has(t.calendarId)) return t;
    const i = cursor.get(t.calendarId) || 0;
    cursor.set(t.calendarId, i + 1);
    return sortedByCal.get(t.calendarId)[i];
  });
  // Giữ thứ tự vừa xếp, không để bước tự xếp theo ngày tách chuỗi nối
  AppState.calendars.forEach(c => { if (calIds.has(c.id)) c.hasManualTaskOrder = true; });
}

// Chuẩn hóa dữ liệu
function normalizeAppState() {
  for (const field of Object.keys(scheduleTextDefaults)) {
    if (typeof AppState[field] !== 'string') AppState[field] = scheduleTextDefaults[field];
    for (const owner of AppState.projectOwners || []) if (typeof owner[field] !== 'string') owner[field] = scheduleTextDefaults[field];
  }

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
  // Giai đoạn đang chọn thuộc dự án bị ẩn -> chuyển sang giai đoạn của dự án đang làm (chỉ đổi chỗ đang xem)
  const curCal = AppState.calendars.find(c => c.id === AppState.activeCalendarId);
  if (curCal && !ownerActive(curCal.ownerId)) {
    const alt = AppState.calendars.find(c => ownerActive(c.ownerId));
    if (alt) AppState.activeCalendarId = alt.id;
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

// Chỉ hiện dự án đang Thiết kế / Thi công (lọc lúc hiển thị, không đổi dữ liệu lưu)
const SHOW_ALL_PROJECTS_KEY = 'gdhome_show_all_projects';
function getShowAllProjects() {
  try { return localStorage.getItem(SHOW_ALL_PROJECTS_KEY) === '1'; } catch (e) { return false; }
}
function setShowAllProjects(on) {
  try { localStorage.setItem(SHOW_ALL_PROJECTS_KEY, on ? '1' : '0'); } catch (e) { /* bỏ qua */ }
}
function ownerStage(owner) {
  const p = (owner && owner.profile) || {};
  return String(p.stage || (p.constructionSignedAt ? 'Thi công' : 'Thiết kế')).replace(/\s+/g, ' ').trim().toLowerCase();
}
function ownerActive(ownerId) {
  if (getShowAllProjects()) return true;
  const owner = (AppState.projectOwners || []).find(o => o.id === ownerId);
  if (!owner) return true;
  try { if (new URLSearchParams(location.search).get('project') === ownerId) return true; } catch (e) { /* bỏ qua */ }
  const s = ownerStage(owner);
  return s === 'thiết kế' || s === 'thi công';
}
function calShown(c) { return c.visible !== false && ownerActive(c.ownerId); }

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
    cals = AppState.calendars.filter(calShown);
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
    cals = AppState.calendars.filter(calShown);
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
let _scheduleReady = false;
let _scheduleBooting = false;
let _scheduleLocalPainted = false;
let _scheduleRetry;

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
  Object.assign(AppState,scheduleTextDefaults);
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
  setScheduleReady(true);
  setSaveStatus('guest');
  if (!opts.silent) {
    showToast('👤 Đang dùng Chế độ khách – dữ liệu chỉ lưu trên trình duyệt này');
  }
}

async function promptLoginFromGuest() {
  try {
    await loadAppConfig();
    localStorage.removeItem(GUEST_FLAG_KEY);
    await showLoginOverlay();
  } catch { showToast('Đang kết nối máy chủ…'); }
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
  const response = await fetch('/api/config',{cache:'no-store',signal:AbortSignal.timeout(12000)});
  if (!response.ok) throw new Error('Không tải được cấu hình server.');
  _appConfig = {..._appConfig,...await response.json()};
  return _appConfig;
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
      ? await GDHomeShell.confirm({ title: 'Dữ liệu chế độ khách', message: 'Chép dữ liệu đang làm ở chế độ khách vào tài khoản?', okText: 'Chép vào tài khoản', cancelText: 'Không chép' })
      : false;

    _guestMode = false;
    _scheduleReady = false;
    try { localStorage.removeItem(GUEST_FLAG_KEY); } catch (e) { /* bỏ qua */ }
    setSession({ token: result.token, user: result.user });
    _currentUser = result.user;

    if (!copyGuestToAccount && result.isNewUser && result.legacyAvailable) {
      const ok = await GDHomeShell.confirm({
        title: `Chào ${result.user.name || result.user.email}!`,
        message: 'Tài khoản này chưa có dữ liệu. Bạn có muốn CHÉP dữ liệu tiến độ dùng chung trước đây vào tài khoản của mình không?\n(Dữ liệu chung cũ vẫn giữ nguyên)',
        okText: 'Chép sang', cancelText: 'Bắt đầu bảng trống'
      });
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
      const latest = await apiFetch('/api/schedule',{signal:AbortSignal.timeout(12000)});
      if (!latest.ok) { retryScheduleConnection(); return; }
      const {version} = await latest.json();
      if (!Number.isSafeInteger(version)) { retryScheduleConnection(); return; }
      _serverVersion = version;
      setScheduleReady(true);
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
    if (!_loginOverlayShown) retryScheduleConnection();
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
    await GDHomeShell.googleSignIn({
      clientId:_appConfig.googleClientId,container:document.getElementById('google-signin-btn'),
      onCredential:handleGoogleCredential,autoSelect:true
    });
  } catch (err) {
    if (msgEl) msgEl.textContent = '⚠ ' + err.message;
  }
}

function hideLoginOverlay() {
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.remove('active');
  _loginOverlayShown = false;
}

async function signOut() {
  if (!await GDHomeShell.confirm({ title: 'Đăng xuất', message: `Đăng xuất tài khoản ${_currentUser ? _currentUser.email : ''}?`, okText: 'Đăng xuất' })) return;
  setSession(null);
  _guestMode = false;
  try { localStorage.removeItem(GUEST_FLAG_KEY); } catch (e) { /* bỏ qua */ }
  try { if (window.google && window.google.accounts) window.google.accounts.id.disableAutoSelect(); } catch (e) { /* bỏ qua */ }
  location.reload();
}

// Khởi động: đọc cấu hình -> nếu đang ở chế độ khách hoặc cần đăng nhập mà chưa có phiên -> xử lý tương ứng
function setScheduleReady(ready) {
  _scheduleReady = ready;
  document.querySelectorAll('.app-body-layout,.shell-toolbar,#hdr-range-dropdown').forEach(node => {
    node.inert = !ready;
  });
  if (!ready) setSaveStatus('connecting');
}

function retryScheduleConnection() {
  setScheduleReady(false);
  clearTimeout(_scheduleRetry);
  _scheduleRetry = setTimeout(bootstrapAuthAndData,3000);
}

async function bootstrapAuthAndData() {
  if (_scheduleBooting) return;
  _scheduleBooting = true;
  clearTimeout(_scheduleRetry);
  try {
    await startScheduleConnection();
  } catch {
    retryScheduleConnection();
  } finally { _scheduleBooting = false; }
}

async function startScheduleConnection() {
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

  if (localStorage.getItem(GUEST_FLAG_KEY) === '1') {
    enterGuestMode({silent:true});
    return;
  }
  _currentUser = getSession()?.user || null;
  if (!_scheduleLocalPainted) {
    loadFromStorage();
    normalizeAppState();
    updateUIElements();
    snapshotState();
    _scheduleLocalPainted = true;
  }
  if (!isOfflineFileMode()) setScheduleReady(false);
  await loadAppConfig();
  if (_appConfig.authMode === 'google' && !getSession()) {
    showLoginOverlay();
    return;
  }
  renderUserChip();
  await syncWithBackend();
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
    const entered = await GDHomeShell.prompt('Trang này đã được đặt mật khẩu. Nhập mật khẩu để xem & lưu tiến độ:', '', { type: 'password', okText: 'Mở khoá' });
    if (entered) {
      try { localStorage.setItem(APP_KEY_STORAGE, entered.trim()); } catch (e) { /* bỏ qua */ }
      return apiFetch(url, options, false);
    }
  }
  return res;
}

function setSaveStatus(state, detail) {
  GDHomeShell.saveStatus(document.getElementById('save-status-indicator'),state,detail);
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
    designNote: AppState.designNote,
    constructionNote: AppState.constructionNote,
    designCustomTitlePrefix: AppState.designCustomTitlePrefix,
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
  loadScheduleText(data);
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
    setScheduleReady(true);
    setSaveStatus('offline');
    return;
  }

  setScheduleReady(false);
  try {
    const res = await apiFetch('/api/schedule',{signal:AbortSignal.timeout(12000)});
    if (res.ok) {
      const result = await res.json();
      if (!Number.isSafeInteger(result.version) || !Array.isArray(result.data?.tasks)) throw new Error('Dữ liệu Tiến độ chưa sẵn sàng.');
      const serverVersion = result.version;
      setScheduleReady(true);

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
        const keepLocal = await GDHomeShell.confirm({
          title: 'Server đang có bản cũ hơn',
          message: 'Dữ liệu trên server đang CŨ HƠN dữ liệu đã lưu trên trình duyệt này (có thể server vừa cập nhật / khởi động lại).\n\n' +
            `• Trên máy này: ${localTaskCount} việc\n• Trên server: ${(serverData.tasks || []).length} việc`,
          okText: 'Giữ bản máy này (khuyên dùng)', cancelText: 'Dùng bản server'
        });
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
        const keepServer = await GDHomeShell.confirm({
          title: 'Dữ liệu bị sửa ở 2 nơi',
          message: 'Trình duyệt này có thay đổi CHƯA LƯU lên server, nhưng dữ liệu trên server cũng đã được sửa từ máy khác.\n\n' +
            '• Dùng bản SERVER: bỏ thay đổi chưa lưu của máy này\n• Dùng bản MÁY NÀY: ghi đè lên server',
          okText: 'Dùng bản server', cancelText: 'Dùng bản máy này'
        });
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
    if (res.status === 401 && _appConfig.authMode === 'google') return;
  } catch (error) {
    console.warn('Chưa tải được Tiến độ:',error.message);
  }
  retryScheduleConnection();
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
  if (!_scheduleReady && !_guestMode && !isOfflineFileMode()) return Promise.resolve();
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
  if (isOfflineFileMode() || _guestMode || !_scheduleReady) return;
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
      keepalive: !!opts.keepalive,signal:AbortSignal.timeout(15000)
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
    const keepServer = await GDHomeShell.confirm({
      title: 'Server vừa được sửa ở máy khác',
      message: 'Dữ liệu trên server vừa được sửa từ một máy/trình duyệt khác.\n\n' +
        '• Tải bản SERVER: bỏ thay đổi vừa làm ở máy này\n• Giữ bản MÁY NÀY: ghi đè lên server',
      okText: 'Tải bản server', cancelText: 'Giữ bản máy này'
    });
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
    mspTitlePrefixInput.textContent = scheduleTextValue('mspCustomTitlePrefix');
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

function projectContactText(mode) {
  const profile = getTitleProject(mode)?.profile;
  return [profile?.customer,profile?.address].filter(Boolean).join(' · ');
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
  for (const [id,mode] of [['customer-name-input','calendar'],['msp-customer-input','msproject']]) {
    const input = document.getElementById(id);
    if (!input) continue;
    let summary = document.querySelector('[data-project-summary="' + mode + '"]');
    if (!summary) {
      summary = document.createElement('small');
      summary.dataset.projectSummary = mode;
      summary.className = 'project-summary';
      input.closest('.sheet-banner-title')?.after(summary);
      if (!summary.isConnected) input.parentElement.after(summary);
    }
    summary.textContent = projectContactText(mode);
    summary.hidden = !summary.textContent;
  }

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
    designNote: AppState.designNote,
    constructionNote: AppState.constructionNote,
    designCustomTitlePrefix: AppState.designCustomTitlePrefix,
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
      loadScheduleText(parsed);
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
