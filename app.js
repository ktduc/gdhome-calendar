// Khởi tạo state của ứng dụng
const AppState = {
  startMonth: '2026-06',
  endMonth: '2026-09',
  scheduleMonth: 'Tháng 9, 2026', // Tháng đang lập bảng hiển thị bên trái tiêu đề
  viewMode: 'calendar', // 'calendar' (Google Lịch) hoặc 'msproject' (Microsoft Project Timeline / Gantt)
  mspScope: 'all-visible', // 'all-visible' hoặc 'active-only'
  mspZoom: 'normal', // 'compact' | 'normal' | 'wide'
  mspRowHeight: 'normal', // 'compact' (32px) | 'normal' (42px) | 'tall' (54px) hoặc số px
  colorPaletteTheme: 'default', // 'default' | 'olive' | 'mauve'
  autoCascadeShift: true, // Tự động dịch các mục sau khi chỉnh ngày bắt đầu / kết thúc (giữ nguyên số ngày làm việc)
  collapsedProjects: {},
  mspColWidths: {
    wbs: 44,
    name: 310,
    dur: 64,
    start: 86,
    end: 86,
    prog: 62,
    act: 50
  },
  mspVisibility: {
    overviewStrip: true,
    overviewCallouts: true,
    colWbs: true,
    colDur: true,
    colDate: true,
    colProg: true,
    colAct: true,
    ganttArrows: true
  },
  extraWeeksTop: 0,
  extraWeeksBottom: 1, // Mặc định luôn có tối thiểu 1 hàng tuần trống bên dưới
  showVnHolidays: true,
  showLunarDates: true, // Mặc định hiển thị ngày Âm lịch bên phải ngày Dương
  daysOffConfig: {
    holidays: true, // Ngày lễ ở Việt Nam
    saturday: false, // Thứ 7
    sunday: true // Chủ nhật
  },
  projectOwners: [
    { id: 'owner-1', name: 'GD HOME', collapsed: false }
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

// Tự động tạo nội dung Ghi chú dựa theo 3 tùy chọn Ngày nghỉ (Ngày lễ ở Việt Nam, Thứ 7, Chủ nhật)
function buildAutoFooterNoteFromDaysOff() {
  const cfg = AppState.daysOffConfig || {
    holidays: AppState.showVnHolidays !== false,
    saturday: false,
    sunday: true
  };
  const offParts = [];
  if (cfg.holidays) offParts.push('Ngày lễ ở Việt Nam');
  if (cfg.saturday) offParts.push('Thứ 7');
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
      olive: 'Olive / Rêu Đất (20 màu)',
      mauve: 'Mauve / Khói Tím (20 màu)'
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

// Chuẩn hóa dữ liệu
function normalizeAppState() {
  if (!AppState.daysOffConfig || typeof AppState.daysOffConfig !== 'object') {
    AppState.daysOffConfig = {
      holidays: AppState.showVnHolidays !== false,
      saturday: false,
      sunday: true
    };
  }
  if (!Array.isArray(AppState.projectOwners) || AppState.projectOwners.length === 0) {
    AppState.projectOwners = [
      { id: 'owner-1', name: 'GD HOME', collapsed: false }
    ];
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
}

function getActiveCalendar() {
  normalizeAppState();
  return AppState.calendars.find(c => c.id === AppState.activeCalendarId) || AppState.calendars[0];
}

// Đồng bộ đổi tên Lịch / Khách hàng + Cập nhật hậu tố các thanh công việc thuộc lịch đó
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

// Lấy tên khách hàng hiện tại (luôn đồng bộ giữa ô tiêu đề trên cùng và lịch đang chọn bên trái)
function getCurrentCustomerName() {
  const inputEl = document.getElementById('customer-name-input');
  if (inputEl && inputEl.value.trim()) {
    return inputEl.value.trim().toUpperCase();
  }
  const activeCal = getActiveCalendar();
  if (activeCal.customerName && activeCal.customerName.trim()) {
    return activeCal.customerName.trim().toUpperCase();
  }
  if (activeCal.name && activeCal.name !== 'CHƯA ĐẶT TÊN KHÁCH HÀNG') {
    return activeCal.name.trim().toUpperCase();
  }
  return '';
}

// Ghép Tag Tiền tố ("3D", "CHỈNH SỬA 3D", "HSKT") + Hậu tố Tên khách hàng
function formatStageTitleWithCustomer(prefix) {
  const customer = getCurrentCustomerName();
  if (customer) {
    return `${prefix} - ${customer}`;
  }
  return prefix;
}

// Lấy tháng đang lập bảng hiển thị bên trái tiêu đề
function getScheduleMonthText() {
  const inputEl = document.getElementById('schedule-month-input');
  if (inputEl && inputEl.value.trim()) {
    return inputEl.value.trim();
  }
  return AppState.scheduleMonth || 'Tháng 9, 2026';
}

// Đồng bộ & Lưu trữ
async function syncWithBackend() {
  loadFromStorage(); // Nạp cấu hình cục bộ trước (như nhóm Dự án của..., cấu hình ngày nghỉ, độ rộng cột)
  try {
    const res = await fetch('/api/schedule');
    if (res.ok) {
      const result = await res.json();
      if (result.data) {
        if (result.data.startMonth) AppState.startMonth = result.data.startMonth;
        if (result.data.endMonth) AppState.endMonth = result.data.endMonth;
        if (result.data.scheduleMonth) AppState.scheduleMonth = result.data.scheduleMonth;
        if (result.data.extraWeeksTop !== undefined) AppState.extraWeeksTop = result.data.extraWeeksTop;
        if (result.data.extraWeeksBottom !== undefined) AppState.extraWeeksBottom = result.data.extraWeeksBottom;
        if (result.data.projectOwners) AppState.projectOwners = result.data.projectOwners;
        if (result.data.daysOffConfig) AppState.daysOffConfig = Object.assign(AppState.daysOffConfig, result.data.daysOffConfig);
        if (result.data.calendars) AppState.calendars = result.data.calendars;
        if (result.data.activeCalendarId) AppState.activeCalendarId = result.data.activeCalendarId;
        if (result.data.tasks) AppState.tasks = result.data.tasks;
        if (result.data.companyName) AppState.companyName = result.data.companyName;
        if (result.data.companyLogo !== undefined) AppState.companyLogo = result.data.companyLogo;
        if (result.data.footerNote) AppState.footerNote = result.data.footerNote;
        if (result.data.showVnHolidays !== undefined) AppState.showVnHolidays = result.data.showVnHolidays;
        if (result.data.showLunarDates !== undefined) AppState.showLunarDates = result.data.showLunarDates;
        normalizeAppState();
        updateUIElements();
        return;
      }
    }
  } catch (err) {
    // Offline fallback
  }
  normalizeAppState();
  updateUIElements();
}

async function saveToBackend() {
  saveToStorage();
  try {
    await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startMonth: AppState.startMonth,
        endMonth: AppState.endMonth,
        scheduleMonth: AppState.scheduleMonth,
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
        showLunarDates: AppState.showLunarDates
      })
    });
  } catch (err) {
    // Silent catch
  }
}

function updateUIElements() {
  document.getElementById('start-month-input').value = AppState.startMonth;
  document.getElementById('end-month-input').value = AppState.endMonth;
  const cfg = AppState.daysOffConfig || { holidays: true, saturday: false, sunday: true };
  const holToggle = document.getElementById('toggle-vn-holidays');
  if (holToggle) holToggle.checked = cfg.holidays !== false;
  const satToggle = document.getElementById('toggle-off-saturday');
  if (satToggle) satToggle.checked = !!cfg.saturday;
  const sunToggle = document.getElementById('toggle-off-sunday');
  if (sunToggle) sunToggle.checked = cfg.sunday !== false;
  const lunarToggle = document.getElementById('toggle-lunar-dates');
  if (lunarToggle) lunarToggle.checked = AppState.showLunarDates !== false;
  const cascadeToggle = document.getElementById('toggle-cascade-shift');
  if (cascadeToggle) cascadeToggle.checked = AppState.autoCascadeShift !== false;

  const monthInput = document.getElementById('schedule-month-input');
  if (monthInput) {
    monthInput.value = AppState.scheduleMonth || 'Tháng 9, 2026';
  }
  const mspMonthInput = document.getElementById('msp-month-input');
  if (mspMonthInput) {
    mspMonthInput.value = AppState.scheduleMonth || 'Tháng 9, 2026';
  }

  renderPaletteSwatchesUI();
  syncCustomerInputWithActiveCalendar();
  renderCalendarSidebar();
  updateCompanyBranding();
  renderCalendar();
}

function syncCustomerInputWithActiveCalendar() {
  const activeCal = getActiveCalendar();
  const displayVal = activeCal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? '' : activeCal.name;
  const custInput = document.getElementById('customer-name-input');
  if (custInput && document.activeElement !== custInput) {
    custInput.value = displayVal;
  }
  const mspCustInput = document.getElementById('msp-customer-input');
  if (mspCustInput && document.activeElement !== mspCustInput) {
    mspCustInput.value = displayVal;
  }
}

function saveToStorage() {
  localStorage.setItem('timeline_calendar_state', JSON.stringify({
    startMonth: AppState.startMonth,
    endMonth: AppState.endMonth,
    scheduleMonth: AppState.scheduleMonth,
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
    colorPaletteTheme: AppState.colorPaletteTheme,
    autoCascadeShift: AppState.autoCascadeShift,
    mspColWidths: AppState.mspColWidths,
    mspVisibility: AppState.mspVisibility
  }));
}

function loadFromStorage() {
  const saved = localStorage.getItem('timeline_calendar_state');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.startMonth) AppState.startMonth = parsed.startMonth;
      if (parsed.endMonth) AppState.endMonth = parsed.endMonth;
      if (parsed.scheduleMonth) AppState.scheduleMonth = parsed.scheduleMonth;
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
      if (parsed.colorPaletteTheme) AppState.colorPaletteTheme = parsed.colorPaletteTheme;
      if (parsed.autoCascadeShift !== undefined) AppState.autoCascadeShift = parsed.autoCascadeShift;
      if (parsed.mspColWidths) AppState.mspColWidths = Object.assign(AppState.mspColWidths, parsed.mspColWidths);
      if (parsed.mspVisibility) AppState.mspVisibility = Object.assign(AppState.mspVisibility, parsed.mspVisibility);
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
    headerEl.title = `Bấm để sổ ra / thu gọn danh sách "Dự án của ${owner.name}"`;

    const leftHeader = document.createElement('div');
    leftHeader.className = 'project-owner-left';

    const ownerCheck = document.createElement('input');
    ownerCheck.type = 'checkbox';
    ownerCheck.checked = ownerCalendars.length > 0 && ownerCalendars.some(c => c.visible !== false);
    ownerCheck.style.cssText = 'width:13px; height:13px; accent-color:#b91c1c; cursor:pointer; flex-shrink:0;';
    ownerCheck.title = `Bật / Tắt toàn bộ các lịch trong "Dự án của ${owner.name}"`;
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
    titleSpan.innerHTML = `Dự án của <em>${owner.name}</em>`;

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
    addCalBtn.title = `Thêm dự án mới vào mục "Dự án của ${owner.name}"`;
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
    renameOwnerBtn.title = `Đổi tên mục "Dự án của ${owner.name}"`;
    renameOwnerBtn.textContent = '✎';
    renameOwnerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const newOwnerName = prompt('Nhập tên người dùng / phụ trách (Hiển thị: "Dự án của ..."):', owner.name);
      if (newOwnerName && newOwnerName.trim()) {
        owner.name = newOwnerName.trim();
        saveToBackend();
        renderCalendarSidebar();
        showToast(`Đã đổi thành "Dự án của ${owner.name}"!`);
      }
    });
    actionsHeader.appendChild(renameOwnerBtn);

    if (AppState.projectOwners.length > 1) {
      const delOwnerBtn = document.createElement('button');
      delOwnerBtn.type = 'button';
      delOwnerBtn.className = 'owner-mini-btn del';
      delOwnerBtn.title = `Xóa mục "Dự án của ${owner.name}"`;
      delOwnerBtn.textContent = '×';
      delOwnerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm(`Xóa nhóm "Dự án của ${owner.name}"? (Các lịch dự án bên trong sẽ được chuyển sang nhóm đầu tiên)`)) {
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
      saveToStorage();
      renderCalendarSidebar();
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
      item.title = `Bấm để chọn lịch "${cal.name}" (Dự án của ${owner.name})`;

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
      `<option value="${o.id}" ${o.id === targetOwnerId ? 'selected' : ''}>Dự án của ${o.name}</option>`
    ).join('');
  }

  if (cal) {
    titleEl.textContent = 'Chỉnh sửa Tên Khách Hàng / Lịch';
    idInput.value = cal.id;
    nameInput.value = cal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? '' : cal.name;
    selectedCalCatColor = cal.color || getActivePaletteColors()[0];
  } else {
    titleEl.textContent = 'Tạo Lịch Khách Hàng Mới';
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
      saveToStorage();
      showToast(AppState.autoCascadeShift
        ? '🔄 Đã BẬT tự động dịch các mục sau khi chỉnh ngày (giữ nguyên số ngày làm việc)!'
        : 'Đã TẮT tự động dịch các mục sau khi chỉnh ngày.');
    });
  }

  const addOwnerBtn = document.getElementById('btn-add-project-owner');
  if (addOwnerBtn) {
    addOwnerBtn.addEventListener('click', () => {
      const ownerName = prompt('Nhập tên người phụ trách cho mục "Dự án của ..." mới (VD: KTS. Đức, KTS. Minh, Nhóm 2...):');
      if (ownerName && ownerName.trim()) {
        const newOwner = {
          id: 'owner_' + Date.now(),
          name: ownerName.trim(),
          collapsed: false
        };
        AppState.projectOwners.push(newOwner);
        saveToBackend();
        renderCalendarSidebar();
        showToast(`Đã thêm mục "Dự án của ${newOwner.name}"!`);
      }
    });
  }

  // Ô nhập tên khách hàng trên tiêu đề trên cùng: luôn đồng bộ 2 chiều với lịch đang chọn bên trái + thanh tiến độ
  const custInput = document.getElementById('customer-name-input');
  if (custInput) {
    custInput.addEventListener('input', () => {
      const activeCal = getActiveCalendar();
      renameCalendarAndSyncTasks(activeCal, custInput.value);
      renderCalendarSidebar();
      renderCalendar();
      saveToBackend();
    });
  }

  // Ô chỉnh sửa tháng đang lập bảng bên trái tiêu đề
  const monthInput = document.getElementById('schedule-month-input');
  if (monthInput) {
    monthInput.addEventListener('input', () => {
      AppState.scheduleMonth = monthInput.value.trim();
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
function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Kiểm tra 1 ngày có nằm trong 3 tùy chọn Ngày nghỉ (Ngày lễ ở Việt Nam, Thứ 7, Chủ nhật) hay không
function isDateDayOff(dateOrStr, respectSkip = true) {
  if (!respectSkip) return { isOff: false, reason: null, type: null };
  const d = typeof dateOrStr === 'string' ? parseDateStr(dateOrStr) : dateOrStr;
  const dStr = typeof dateOrStr === 'string' ? dateOrStr : formatDateStr(d);
  const dow = d.getDay();
  const cfg = AppState.daysOffConfig || {
    holidays: AppState.showVnHolidays !== false,
    saturday: false,
    sunday: true
  };

  if (cfg.holidays && typeof getHolidayName === 'function' && getHolidayName(dStr)) {
    return { isOff: true, reason: `Nghỉ lễ: ${getHolidayName(dStr)}`, type: 'holiday' };
  }
  if (cfg.sunday && dow === 0) {
    return { isOff: true, reason: 'Nghỉ Chủ nhật', type: 'sunday' };
  }
  if (cfg.saturday && dow === 6) {
    return { isOff: true, reason: 'Nghỉ Thứ 7', type: 'saturday' };
  }
  return { isOff: false, reason: null, type: null };
}

function calculateTaskDays(startDateStr, endDateStr, skipSundays = true) {
  if (!startDateStr || !endDateStr || startDateStr > endDateStr) {
    return { workDays: 0, totalDays: 0 };
  }
  let curr = parseDateStr(startDateStr);
  const end = parseDateStr(endDateStr);
  let totalDays = 0;
  let workDays = 0;

  while (curr <= end) {
    totalDays++;
    if (!isDateDayOff(curr, skipSundays !== false).isOff) {
      workDays++;
    }
    curr.setDate(curr.getDate() + 1);
  }
  return { workDays, totalDays };
}

function getVisibleTasks() {
  normalizeAppState();
  const visibleCalIds = new Set(
    AppState.calendars.filter(c => c.visible !== false).map(c => c.id)
  );
  return AppState.tasks.filter(t => visibleCalIds.has(t.calendarId) && t.visibleOnBoard !== false);
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

function getHolidayName(dateStr) {
  if (typeof VIETNAM_HOLIDAYS !== 'undefined' && VIETNAM_HOLIDAYS[dateStr]) {
    return VIETNAM_HOLIDAYS[dateStr];
  }
  return null;
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

      const dayNum = dayDate.getDate();
      const monthNum = dayDate.getMonth() + 1;

      if (dayStr === todayStr) {
        dayCell.classList.add('today');
      }

      const dayHeader = document.createElement('div');
      dayHeader.className = 'day-header';

      if (dayNum === 1) {
        const monthLabel = document.createElement('span');
        monthLabel.className = 'day-month-label';
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
    if (AppState.showVnHolidays !== false) {
      const weekHolidays = [];
      week.forEach((d, cIdx) => {
        const dStr = formatDateStr(d);
        const hName = getHolidayName(dStr);
        if (hName) {
          weekHolidays.push({ col: cIdx, dateStr: dStr, name: hName });
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
          while (j < weekHolidays.length && weekHolidays[j].col === endCol + 1 && weekHolidays[j].name === startHol.name) {
            endCol = weekHolidays[j].col;
            j++;
          }

          const holSeg = document.createElement('div');
          holSeg.className = 'holiday-bar-segment is-start is-end';
          holSeg.style.gridColumn = `${startHol.col + 1} / ${endCol + 2}`;
          holSeg.textContent = startHol.name;
          holSeg.title = `Ngày lễ Việt Nam: ${startHol.name}`;
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
  countSummary.textContent = `${calc.workDays} ngày làm việc (đã trừ Chủ nhật) • Tổng ${calc.totalDays} ngày`;

  const popWidth = 360;
  const popHeight = 320;
  let left = clientX + 12;
  let top = clientY - 80;

  if (left + popWidth > window.innerWidth - 16) {
    left = Math.max(16, clientX - popWidth - 12);
  }
  if (top + popHeight > window.innerHeight - 16) {
    top = window.innerHeight - popHeight - 16;
  }
  if (top < 75) {
    top = 75;
  }

  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
  popover.classList.add('active');

  setTimeout(() => titleInput.focus(), 30);
}

function closeQuickPopover() {
  const pop = document.getElementById('quick-create-popover');
  if (pop) pop.classList.remove('active');
  clearSelectionHighlight();
}

function setupQuickPopoverEvents() {
  document.getElementById('btn-close-popover').addEventListener('click', closeQuickPopover);

  // 1-Click Tag ("3D" -> Đỏ, "CHỈNH SỬA 3D" -> Cam, "HSKT" -> Xanh):
  // Bấm vào là tự ghép với tên khách hàng + màu chuẩn và hoàn tất luôn!
  document.querySelectorAll('.instant-tag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const prefix = btn.dataset.prefix;
      const tagColor = btn.dataset.color;
      const fullTitle = formatStageTitleWithCustomer(prefix);
      const activeCal = getActiveCalendar();
      activeCal.visible = true;

      AppState.tasks.push({
        id: 'task_' + Date.now(),
        calendarId: activeCal.id,
        title: fullTitle,
        startDate: currentPopoverRange.start,
        endDate: currentPopoverRange.end,
        color: tagColor,
        skipSundays: true,
        showCount: true,
        note: ''
      });

      saveToBackend();
      renderCalendarSidebar();
      renderCalendar();
      closeQuickPopover();
      showToast(`Đã tạo: ${fullTitle}`);
    });
  });

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
      note: ''
    });

    saveToBackend();
    renderCalendarSidebar();
    renderCalendar();
    closeQuickPopover();
  };

  document.getElementById('btn-popover-save').addEventListener('click', saveQuickTask);
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
  AppState.calendars.forEach(cal => {
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
        executeExportWeeksSlice(currentRenderedWeeks, true, 2, 'clipboard');
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
      executeExportWeeksSlice(currentRenderedWeeks, incFooter, scale, mode);
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
    const custName = getCurrentCustomerName();
    const monthText = getScheduleMonthText();
    topBannerClone.innerHTML = `
      <div class="sheet-banner-left">
        <span class="schedule-month-display">${monthText}</span>
      </div>
      <div class="sheet-banner-title">
        <span class="banner-prefix">TIẾN ĐỘ THIẾT KẾ DỰ KIẾN${custName ? ' - ' : ''}</span>
        ${custName ? `<span style="font-size:22px; font-weight:800; color:#b91d14; letter-spacing:0.5px; text-transform:uppercase;">${custName}</span>` : ''}
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
        copyCanvasToClipboard(canvas);
      } else {
        downloadCanvas(canvas, `Bang_Tien_Do_${firstD}_den_${lastD}.png`);
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

function downloadCanvas(canvas, filename) {
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function copyCanvasToClipboard(canvas) {
  canvas.toBlob(async (blob) => {
    if (!blob) {
      alert('Không thể tạo dữ liệu ảnh để copy.');
      return;
    }
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        showToast('✅ Đã Copy ảnh vào bộ nhớ tạm! Bạn có thể bấm Ctrl+V để dán ngay vào Zalo, Word, Photoshop...');
      } else {
        throw new Error('Trình duyệt không hỗ trợ ClipboardItem');
      }
    } catch (err) {
      console.error('Copy clipboard error:', err);
      // Nếu trình duyệt chặn, tự động tải về làm phương án dự phòng
      downloadCanvas(canvas, 'Bang_Tien_Do_Copied.png');
      showToast('Đã tải ảnh về máy (Trình duyệt hiện tại hạn chế quyền Clipboard trực tiếp).');
    }
  }, 'image/png');
}

// =========================================================================
// ĐIỀU KHIỂN VÙNG NHÌN LỊCH & EVENTS
// =========================================================================
function setupEvents() {
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

    // Tự động đồng bộ tháng đang lập bảng sang tháng được chọn
    const [ey, em] = e.split('-').map(Number);
    AppState.scheduleMonth = `Tháng ${em}, ${ey}`;
    const mInput = document.getElementById('schedule-month-input');
    if (mInput) mInput.value = AppState.scheduleMonth;

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
  if (toggleOffSat) {
    toggleOffSat.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, sunday: true };
      AppState.daysOffConfig.saturday = e.target.checked;
      syncFooterNoteWithDaysOff();
      saveToBackend();
      renderCalendar();
    });
  }

  const toggleOffSun = document.getElementById('toggle-off-sunday');
  if (toggleOffSun) {
    toggleOffSun.addEventListener('change', (e) => {
      if (!AppState.daysOffConfig) AppState.daysOffConfig = { holidays: true, saturday: false, sunday: true };
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

function getMspColWidth() {
  if (AppState.mspZoom === 'compact' || AppState.mspZoom === 24) return 24;
  if (AppState.mspZoom === 'wide' || AppState.mspZoom === 46) return 46;
  return 34; // normal
}

function getMspRowHeightPx() {
  if (typeof AppState.mspRowHeight === 'number') {
    return Math.max(26, Math.min(84, AppState.mspRowHeight));
  }
  if (AppState.mspRowHeight === 'compact') return 32;
  if (AppState.mspRowHeight === 'tall') return 54;
  return 42; // normal
}

function applyMspRowHeightStyles(targetContainer = null) {
  const rowH = getMspRowHeightPx();
  const barH = Math.max(18, Math.min(38, rowH - 16));
  const barTop = Math.floor((rowH - barH) / 2);
  const sumTop = Math.max(8, Math.floor((rowH - 8) / 2) - 4);
  const rootEl = targetContainer || document.querySelector('.msp-split-workspace');
  if (rootEl) {
    rootEl.style.setProperty('--msp-row-height', `${rowH}px`);
    rootEl.style.setProperty('--msp-bar-height', `${barH}px`);
    rootEl.style.setProperty('--msp-bar-top', `${barTop}px`);
    rootEl.style.setProperty('--msp-summary-top', `${sumTop}px`);
  }
}

// Dịch chuyển 1 ngày theo số ngày làm việc có dấu (+/- deltaWorkingDays), tự nhảy qua ngày nghỉ
function shiftDateByWorkingDays(dateStr, deltaWorkingDays, skipSundays = true) {
  const curr = parseDateStr(dateStr);
  let remaining = parseInt(deltaWorkingDays, 10) || 0;
  if (remaining === 0) {
    while (skipSundays && isDateDayOff(curr, true).isOff) {
      curr.setDate(curr.getDate() + 1);
    }
    return formatDateStr(curr);
  }
  const step = remaining > 0 ? 1 : -1;
  let stepsLeft = Math.abs(remaining);
  while (stepsLeft > 0) {
    curr.setDate(curr.getDate() + step);
    if (!isDateDayOff(curr, skipSundays !== false).isOff) {
      stepsLeft--;
    }
  }
  while (skipSundays && isDateDayOff(curr, true).isOff) {
    curr.setDate(curr.getDate() + 1);
  }
  return formatDateStr(curr);
}

// Tính khoảng cách số ngày làm việc có dấu từ dateA sang dateB
function getSignedWorkingDaysGap(dateAStr, dateBStr, skipSundays = true) {
  if (!dateAStr || !dateBStr || dateAStr === dateBStr) return 0;
  const a = parseDateStr(dateAStr);
  const b = parseDateStr(dateBStr);
  const sign = b > a ? 1 : -1;
  const curr = new Date(a);
  let count = 0;
  while ((sign > 0 && curr < b) || (sign < 0 && curr > b)) {
    curr.setDate(curr.getDate() + sign);
    if (!isDateDayOff(curr, skipSundays !== false).isOff) {
      count += sign;
    }
  }
  return count;
}

// Tự động dịch các hạng mục phía sau khi chỉnh Ngày bắt đầu / Ngày kết thúc mà vẫn giữ nguyên số ngày làm việc của từng mục
function cascadeShiftSubsequentTasks(editedTask, oldStartDate, oldEndDate) {
  if (!editedTask || AppState.autoCascadeShift === false) return 0;
  const endShiftWorkingDays = getSignedWorkingDaysGap(oldEndDate, editedTask.endDate, editedTask.skipSundays !== false);
  const startShiftWorkingDays = getSignedWorkingDaysGap(oldStartDate, editedTask.startDate, editedTask.skipSundays !== false);
  const deltaWorkDays = endShiftWorkingDays !== 0 ? endShiftWorkingDays : startShiftWorkingDays;
  if (deltaWorkDays === 0) return 0;

  const calTasks = AppState.tasks.filter(t => t.calendarId === editedTask.calendarId && t.visibleOnBoard !== false);
  const editedIdx = calTasks.findIndex(t => t.id === editedTask.id);
  let shiftedCount = 0;

  calTasks.forEach((t, idx) => {
    if (t.id === editedTask.id) return;
    // Dịch các công việc nằm phía sau trong danh sách dự án hoặc có ngày bắt đầu >= ngày bắt đầu cũ
    if ((editedIdx !== -1 && idx > editedIdx) || t.startDate > oldStartDate) {
      const preserveWorkDays = Math.max(1, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false));
      const newStart = shiftDateByWorkingDays(t.startDate, deltaWorkDays, t.skipSundays !== false);
      const newEnd = computeEndDateByWorkingDays(newStart, preserveWorkDays, t.skipSundays !== false);
      t.startDate = newStart;
      t.endDate = newEnd;
      shiftedCount++;
    }
  });
  return shiftedCount;
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
    color: nextColor || task.color
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
  sourceTasks.forEach((t, idx) => {
    let clonedTitle = t.title;
    if (cal.name && clonedTitle.endsWith(` - ${cal.name}`)) {
      clonedTitle = clonedTitle.slice(0, -(` - ${cal.name}`).length) + ` - ${newCal.name}`;
    }
    AppState.tasks.push({
      ...t,
      id: 'task_' + Date.now() + '_' + idx + '_' + Math.floor(Math.random() * 1000),
      calendarId: newCalId,
      title: clonedTitle
    });
  });

  AppState.activeCalendarId = newCalId;
  syncAllFromMSProject(`Đã nhân đôi dự án "${cal.name}" (${sourceTasks.length} công việc)!`);
  return newCal;
}

// =========================================================================
// MENU CHUỘT PHẢI (CONTEXT MENU) CHO CÔNG VIỆC & DỰ ÁN
// =========================================================================
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
    btn.innerHTML = `<span>${item.label}</span>${item.shortcut ? `<span class="ctx-shortcut">${item.shortcut}</span>` : ''}`;
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
  showCustomContextMenu(e.clientX, e.clientY, `📋 Công việc: ${task.title}`, [
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
          syncAllFromMSProject(`Đã xóa "${task.title}"!`);
        }
      }
    }
  ]);
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

// Tạo SVG gạch chéo cho ô ngày nghỉ nằm giữa thanh Gantt (Giúp html2canvas Copy/Xuất ảnh không bao giờ mất gạch chéo)
function createDayOffHatchSvg(widthPx, heightPx = 24) {
  const w = Math.max(14, Math.ceil(widthPx));
  const h = heightPx;
  let lines = '';
  for (let x = -h; x < w + h; x += 5) {
    lines += `<line x1="${x}" y1="${h}" x2="${x + h}" y2="0" stroke="rgba(15,23,42,0.48)" stroke-width="1.6" />`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="display:block;width:100%;height:100%;pointer-events:none;"><rect width="${w}" height="${h}" fill="rgba(255,255,255,0.62)"/>${lines}</svg>`;
}

function countWorkingDays(startDateStr, endDateStr, skipSundays = true) {
  return calculateTaskDays(startDateStr, endDateStr, skipSundays !== false).workDays;
}

// Tính ngày kết thúc dựa trên ngày bắt đầu + số ngày làm việc (tự động nhảy qua Ngày nghỉ đã chọn)
function computeEndDateByWorkingDays(startDateStr, targetWorkingDays, skipSundays = true) {
  const days = Math.max(1, parseInt(targetWorkingDays, 10) || 1);
  const curr = parseDateStr(startDateStr);
  while (skipSundays && isDateDayOff(curr, true).isOff) {
    curr.setDate(curr.getDate() + 1);
  }
  let counted = 0;
  while (true) {
    if (!isDateDayOff(curr, skipSundays !== false).isOff) {
      counted++;
    }
    if (counted >= days) {
      break;
    }
    curr.setDate(curr.getDate() + 1);
  }
  return formatDateStr(curr);
}

// Tìm ngày làm việc kế tiếp sau 1 ngày (nhảy qua các ngày nghỉ đã chọn)
function getNextWorkingDateStr(dateStr, skipSundays = true) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + 1);
  while (skipSundays && isDateDayOff(d, true).isOff) {
    d.setDate(d.getDate() + 1);
  }
  return formatDateStr(d);
}

// Đồng bộ toàn diện từ MS Project ngược về Bảng Lịch & Sidebar & Backend
function syncAllFromMSProject(toastMsg = null) {
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

// Tính độ rộng cột "Hạng mục / Công việc" vừa khít 100% dòng chữ dài nhất (không dư khoảng trống bên phải)
function computeTightMspNameColWidth() {
  let maxTextPx = 175;
  let targetCalendars = [];
  if (AppState.mspScope === 'active-only' || AppState.mspScope === 'active') {
    const activeCal = getActiveCalendar();
    if (activeCal) targetCalendars = [activeCal];
  } else {
    targetCalendars = AppState.calendars.filter(c => c.visible !== false);
    if (targetCalendars.length === 0 && AppState.calendars.length > 0) {
      targetCalendars = [getActiveCalendar()];
    }
  }
  const visCalIds = new Set(targetCalendars.map(c => c.id));

  targetCalendars.forEach(c => {
    if (c.name) {
      const w = measureTextWidthPx(
        c.name,
        '800 12.5px "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ) + 46;
      if (w > maxTextPx) maxTextPx = w;
    }
  });

  AppState.tasks.forEach(t => {
    if (t.visibleOnBoard !== false && visCalIds.has(t.calendarId) && t.title) {
      const w = measureTextWidthPx(
        t.title,
        '600 12px "Be Vietnam Pro", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      ) + 34;
      if (w > maxTextPx) maxTextPx = w;
    }
  });

  return Math.min(520, Math.max(175, maxTextPx));
}

// Áp dụng độ rộng các cột kiểu Excel + trạng thái ẩn/hiện cột từ mục "ĐỀ MỤC"
function applyMspGridColumnWidths(targetPane = null, forceExportMode = false, exportNameWidth = null) {
  const pane = targetPane || document.getElementById('msp-table-pane');
  if (!pane) return;

  const vis = AppState.mspVisibility || {};
  const cw = AppState.mspColWidths || { wbs: 44, name: 310, dur: 64, start: 86, end: 86, prog: 62, act: 50 };
  const tightNameWidth = computeTightMspNameColWidth();
  const effectiveNameWidth = exportNameWidth || (AppState.userManuallyResizedNameCol ? (cw.name || tightNameWidth) : tightNameWidth);
  if (!exportNameWidth && !AppState.userManuallyResizedNameCol) {
    cw.name = tightNameWidth;
  }

  const colDefs = [
    { key: 'wbs', selector: '.col-wbs', show: vis.colWbs !== false, width: cw.wbs || 44 },
    { key: 'name', selector: '.col-name', show: true, width: effectiveNameWidth },
    { key: 'dur', selector: '.col-dur', show: vis.colDur !== false, width: cw.dur || 64 },
    { key: 'start', selector: '.col-start', show: vis.colDate !== false, width: cw.start || 86 },
    { key: 'end', selector: '.col-end', show: vis.colDate !== false, width: cw.end || 86 },
    { key: 'prog', selector: '.col-prog', show: vis.colProg !== false, width: cw.prog || 62 },
    { key: 'act', selector: '.col-act', show: !forceExportMode && vis.colAct !== false, width: cw.act || 50 }
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

// Tự động giãn độ rộng cột Tên công việc vừa khít nội dung dài nhất (Auto-fit như Excel)
function autoFitMspColumns(silent = false) {
  AppState.userManuallyResizedNameCol = false;
  const fittedNameWidth = computeTightMspNameColWidth();
  AppState.mspColWidths.name = fittedNameWidth;
  applyMspGridColumnWidths();
  saveToStorage();
  if (!silent) {
    showToast(`Đã tự động co giãn cột vừa khít dòng chữ dài nhất (${fittedNameWidth}px)!`);
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
          const defaults = { wbs: 44, dur: 66, start: 88, end: 88, prog: 64 };
          AppState.mspColWidths[colKey] = defaults[colKey] || 70;
          applyMspGridColumnWidths();
        }
      });

      resizer.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();

        const startX = e.clientX;
        const origWidth = AppState.mspColWidths[colKey] || 80;
        const minWidths = { wbs: 34, name: 150, dur: 50, start: 72, end: 72, prog: 52 };
        const minW = minWidths[colKey] || 45;

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
          saveToStorage();
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
        AppState.mspColWidths.name = Math.max(150, Math.min(750, origNameWidth + dx));
        applyMspGridColumnWidths();
      };

      const onUp = () => {
        splitter.classList.remove('dragging');
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        saveToStorage();
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
    btnCal.addEventListener('click', () => switchViewMode('calendar'));
  }
  if (btnMsp) {
    btnMsp.addEventListener('click', () => switchViewMode('msproject'));
  }
  if (scopeSelect) {
    scopeSelect.addEventListener('change', (e) => {
      AppState.mspScope = e.target.value;
      renderMSProjectView();
    });
  }
  zoomBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      zoomBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.mspZoom = btn.dataset.zoom || 'normal';
      saveToStorage();
      renderMSProjectView();
    });
  });

  // Tùy chọn độ cao dòng/cột (Thấp | Chuẩn | Cao) tương tự độ rộng cột
  rowHeightBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      rowHeightBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.mspRowHeight = btn.dataset.rowHeight || 'normal';
      saveToStorage();
      applyMspRowHeightStyles();
      renderMSProjectView();
    });
  });

  // Sự kiện tick/bỏ tick các mục/cột trong phần "ĐỀ MỤC & TÙY CHỈNH BẢNG" bên trái
  document.querySelectorAll('#demuc-columns-checklist input[type="checkbox"][data-demuc-col]').forEach(chk => {
    chk.addEventListener('change', () => {
      const colKey = chk.dataset.demucCol;
      if (!AppState.mspVisibility) AppState.mspVisibility = {};
      AppState.mspVisibility[colKey] = chk.checked;
      saveToStorage();
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

  // Đồng bộ sửa Tháng lập bảng trên Header MS Project <-> Bảng Lịch
  if (mspMonthInput) {
    mspMonthInput.addEventListener('input', () => {
      AppState.scheduleMonth = mspMonthInput.value.trim();
      const calMonthInput = document.getElementById('schedule-month-input');
      if (calMonthInput) calMonthInput.value = AppState.scheduleMonth;
      saveToBackend();
    });
  }

  // Đồng bộ sửa Tên khách hàng trên Header MS Project <-> Bảng Lịch & Hậu tố công việc
  if (mspCustomerInput) {
    mspCustomerInput.addEventListener('input', () => {
      const activeCal = getActiveCalendar();
      renameCalendarAndSyncTasks(activeCal, mspCustomerInput.value);
      const calCustInput = document.getElementById('customer-name-input');
      if (calCustInput) calCustInput.value = mspCustomerInput.value;
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
  if (calTasks.length > 0) {
    const maxEnd = calTasks.reduce((m, t) => (t.endDate > m ? t.endDate : m), calTasks[0].endDate);
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
    note: ''
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
  const mspCustomerInput = document.getElementById('msp-customer-input');
  const mspFooterNote = document.getElementById('msp-footer-note-text');

  if (!tableBody || !ganttMonthsRow || !ganttDaysRow) return;

  applyMspRowHeightStyles();

  if (mspMonthInput && document.activeElement !== mspMonthInput) {
    mspMonthInput.value = AppState.scheduleMonth || 'Tháng 9, 2026';
  }
  if (mspCustomerInput && document.activeElement !== mspCustomerInput) {
    const activeCal = getActiveCalendar();
    mspCustomerInput.value = activeCal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? '' : activeCal.name;
  }
  if (mspFooterNote && document.activeElement !== mspFooterNote) {
    mspFooterNote.textContent = AppState.footerNote || '';
  }

  const vis = AppState.mspVisibility || {};

  // 1. Xác định danh sách dự án hiển thị
  normalizeAppState();
  let targetCalendars = [];
  if (AppState.mspScope === 'active-only' || AppState.mspScope === 'active') {
    const activeCal = getActiveCalendar();
    if (activeCal) targetCalendars = [activeCal];
  } else {
    targetCalendars = AppState.calendars.filter(c => c.visible !== false);
    if (targetCalendars.length === 0 && AppState.calendars.length > 0) {
      targetCalendars = [getActiveCalendar()];
    }
  }

  // 2. Gom nhóm công việc (giữ nguyên thứ tự để hỗ trợ kéo thả đổi vị trí công việc & dự án qua lại)
  const projectGroups = targetCalendars.map((cal, idx) => {
    const calTasks = AppState.tasks
      .filter(t => t.calendarId === cal.id && t.visibleOnBoard !== false);

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

    const overallWorkDays = (minStart && maxEnd) ? countWorkingDays(minStart, maxEnd, true) : 0;
    const avgProgress = totalWorkDays > 0 ? Math.round(weightedProgressSum / totalWorkDays) : 0;

    return {
      cal,
      wbsIndex: idx + 1,
      tasks: calTasks,
      minStart,
      maxEnd,
      overallWorkDays,
      totalWorkDays,
      avgProgress
    };
  });

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

  const todayStr = formatDateStr(new Date());
  if (!globalMinDate || !globalMaxDate) {
    const [sy, sm] = AppState.startMonth.split('-').map(Number);
    const sDate = new Date(sy, sm - 1, 1);
    const eDate = new Date(sy, sm, 0);
    globalMinDate = formatDateStr(sDate);
    globalMaxDate = formatDateStr(eDate);
  } else {
    // Bắt đầu ngay từ ngày đầu tiên có công việc (không đệm ngày trống ở đầu)
    // Kết thúc chỉ đệm đúng 3 ngày để hiển thị gọn nhãn ngày của công việc cuối cùng (bỏ các cột trống thừa ở cuối)
    const padEnd = parseDateStr(globalMaxDate);
    padEnd.setDate(padEnd.getDate() + 3);
    globalMaxDate = formatDateStr(padEnd);
  }

  const timelineDates = getDatesBetween(globalMinDate, globalMaxDate);
  const colWidth = getMspColWidth();
  const totalTimelineWidth = Math.max(colWidth * 5, timelineDates.length * colWidth);

  // 4. Render KPI Summary Pills
  if (kpiSummary) {
    const totalTasksCount = allVisibleTasks.length;
    const totalCalCount = projectGroups.length;
    let firstTaskStart = null;
    let lastTaskEnd = null;
    allVisibleTasks.forEach(t => {
      if (!firstTaskStart || t.startDate < firstTaskStart) firstTaskStart = t.startDate;
      if (!lastTaskEnd || t.endDate > lastTaskEnd) lastTaskEnd = t.endDate;
    });
    const spanWorkDays = (firstTaskStart && lastTaskEnd) ? countWorkingDays(firstTaskStart, lastTaskEnd, true) : 0;

    kpiSummary.innerHTML = `
      <div class="msp-kpi-pill">
        <span>Dự án:</span>
        <strong>${totalCalCount}</strong>
      </div>
      <div class="msp-kpi-pill">
        <span>Hạng mục:</span>
        <strong>${totalTasksCount} việc</strong>
      </div>
      <div class="msp-kpi-pill">
        <span>Tổng công:</span>
        <strong>${spanWorkDays} ngày</strong>
      </div>
      ${firstTaskStart && lastTaskEnd ? `
      <div class="msp-kpi-pill">
        <span>Lộ trình:</span>
        <strong>${formatShortVNDate(firstTaskStart)} → ${formatShortVNDate(lastTaskEnd)}</strong>
      </div>` : ''}
    `;
  }

  // 6. Render Header Tháng & Ngày bên khung Gantt
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
    if (offInfo.type === 'sunday' || offInfo.type === 'saturday') dCell.classList.add('is-sunday');
    if (offInfo.type === 'holiday') dCell.classList.add('is-holiday');
    if (dStr === todayStr) dCell.classList.add('is-today');
    dCell.style.width = `${colWidth}px`;
    if (offInfo.isOff && offInfo.reason) dCell.title = offInfo.reason;

    dCell.innerHTML = `
      <div class="msp-day-top-line">
        <span class="msp-solar-num">${String(d.getDate()).padStart(2, '0')}</span>
        ${lunarInfo.text ? `<span class="msp-lunar-mini ${lunarInfo.isFirst ? 'is-first' : ''}">${lunarInfo.text}</span>` : ''}
      </div>
      <span style="font-size:8px; opacity:0.82;">${dowNames[dow]}</span>
    `;
    ganttDaysRow.appendChild(dCell);
  });

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
        AppState.mspRowHeight = Math.max(28, Math.min(76, origH + dy));
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

  projectGroups.forEach(pg => {
    const isCollapsed = !!AppState.collapsedProjects[pg.cal.id];
    const startDisp = pg.minStart ? formatShortVNDate(pg.minStart) : '--/--/--';
    const endDisp = pg.maxEnd ? formatShortVNDate(pg.maxEnd) : '--/--/--';

    // --- DÒNG SUMMARY CỦA DỰ ÁN (WBS Cấp 1 - Cho phép chỉnh Ngày Bắt đầu/Kết thúc để dịch toàn bộ Dự án + Kéo thả nhảy qua nhau) ---
    const sumRowEl = document.createElement('div');
    sumRowEl.className = 'msp-tr summary-row';
    sumRowEl.dataset.calId = pg.cal.id;
    sumRowEl.draggable = true;

    sumRowEl.innerHTML = `
      <div class="msp-td col-wbs" title="Kéo để đổi vị trí Dự án • Chuột phải để Nhân đôi dự án">
        <span class="msp-drag-grip">⋮⋮</span>${pg.wbsIndex}
      </div>
      <div class="msp-td col-name">
        <button type="button" class="msp-project-toggle" title="Thu gọn / Mở rộng dự án">${isCollapsed ? '▶' : '▼'}</button>
        <span class="msp-task-dot" style="background:${pg.cal.color}; border-radius:50%;"></span>
        <input type="text" class="msp-inline-project-input" value="${pg.cal.name.replace(/"/g, '&quot;')}" title="Gõ để đổi tên Khách hàng / Dự án (Chuột phải để Nhân đôi dự án)">
      </div>
      <div class="msp-td col-dur" title="Số ngày thi công thực tế từ ${startDisp} đến ${endDisp} (đã trừ ngày nghỉ)">${pg.overallWorkDays} ngày</div>
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

    // Chuột phải vào dòng Dự án -> Mở menu Nhân đôi dự án
    sumRowEl.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openProjectContextMenu(e, pg.cal);
    });

    // Kéo thả Dự án nhảy qua nhau hoặc nhận Công việc từ dự án khác thả vào
    sumRowEl.addEventListener('dragstart', (e) => {
      _mspDragPayload = { type: 'project', calId: pg.cal.id };
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
          const newTargetIdx = AppState.calendars.findIndex(c => c.id === pg.cal.id);
          AppState.calendars.splice(insertAfter ? newTargetIdx + 1 : newTargetIdx, 0, movedCal);
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã di chuyển dự án "${movedCal.name}" sang vị trí mới!`);
        }
      } else if (_mspDragPayload.type === 'task') {
        const draggedTask = AppState.tasks.find(t => t.id === _mspDragPayload.taskId);
        if (draggedTask) {
          draggedTask.calendarId = pg.cal.id;
          AppState.collapsedProjects[pg.cal.id] = false;
          _mspDragPayload = null;
          syncAllFromMSProject(`Đã chuyển "${draggedTask.title}" sang dự án "${pg.cal.name}"!`);
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

    // Sửa Ngày bắt đầu của cả Dự án -> Tự động dịch toàn bộ các mục trong dự án theo (giữ nguyên ngày làm việc)
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

    // Sửa Ngày kết thúc của cả Dự án -> Tự động dịch toàn bộ các mục trong dự án theo (giữ nguyên ngày làm việc)
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
      sumLabel.textContent = `${pg.cal.name} (${pg.overallWorkDays} ngày làm việc • ${pg.avgProgress}%)`;
      sumBar.appendChild(sumLabel);

      gRowSum.appendChild(sumBar);
    }

    ganttRowsLayer.appendChild(gRowSum);
    currentRowIndex++;

    // --- CÁC DÒNG CÔNG VIỆC CON (WBS 1.1, 1.2... - BỎ ICON LỊCH Ở Ô NGÀY, ẤN VÀO HIỆN BẢNG LỊCH NGAY) ---
    if (!isCollapsed) {
      pg.tasks.forEach((task, tIdx) => {
        const wbsCode = `${pg.wbsIndex}.${tIdx + 1}`;
        const workDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
        const taskProg = typeof task.progress === 'number' ? task.progress : 0;

        const taskRowEl = document.createElement('div');
        taskRowEl.className = 'msp-tr task-row';
        taskRowEl.dataset.taskId = task.id;
        taskRowEl.dataset.calId = pg.cal.id;
        taskRowEl.draggable = true;

        const progressOptions = [0, 10, 25, 50, 75, 90, 100].map(val =>
          `<option value="${val}" ${taskProg === val ? 'selected' : ''}>${val}%</option>`
        ).join('');

        taskRowEl.innerHTML = `
          <div class="msp-td col-wbs" title="Kéo thả để đổi thứ tự hoặc nhảy sang dự án khác • Chuột phải để Nhân đôi">
            <span class="msp-drag-grip">⋮⋮</span>${wbsCode}
          </div>
          <div class="msp-td col-name">
            <span class="msp-task-dot" style="background:${task.color}; cursor:pointer;" title="Bấm để đổi màu hoặc mở chi tiết"></span>
            <input type="text" class="msp-inline-title-input" value="${task.title.replace(/"/g, '&quot;')}" title="${task.title.replace(/"/g, '&quot;')} (Gõ để sửa • Chuột phải để Nhân đôi)">
          </div>
          <div class="msp-td col-dur">
            <div class="msp-inline-dur-wrap">
              <input type="number" min="1" max="365" class="msp-inline-dur-input" value="${workDays}" title="Nhập số ngày làm việc -> Tự động tính ngày kết thúc & dịch các mục sau">
              <span class="msp-dur-unit">ng</span>
            </div>
          </div>
          <div class="msp-td col-date col-start">
            <div class="msp-date-cell-wrap start-wrap" title="Bấm vào để chọn Ngày Bắt Đầu (Tự động giữ số ngày làm việc & dịch các mục sau)">
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

        attachRowHeightResizer(taskRowEl);

        taskRowEl.querySelectorAll('input, button, select').forEach(inp => {
          inp.addEventListener('mousedown', (ev) => ev.stopPropagation());
        });

        // Chuột phải vào dòng Công việc -> Mở menu Nhân đôi nhanh
        taskRowEl.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openTaskContextMenu(e, task);
        });

        // Kéo thả Công việc nhảy qua lại giữa các hàng hoặc nhảy sang Dự án khác
        taskRowEl.addEventListener('dragstart', (e) => {
          _mspDragPayload = { type: 'task', taskId: task.id, fromCalId: pg.cal.id };
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
            const fromIdx = AppState.tasks.findIndex(t => t.id === _mspDragPayload.taskId);
            if (fromIdx !== -1) {
              const [movedTask] = AppState.tasks.splice(fromIdx, 1);
              movedTask.calendarId = pg.cal.id;
              const targetIdx = AppState.tasks.findIndex(t => t.id === task.id);
              if (targetIdx !== -1) {
                AppState.tasks.splice(insertAfter ? targetIdx + 1 : targetIdx, 0, movedTask);
              } else {
                AppState.tasks.push(movedTask);
              }
              _mspDragPayload = null;
              syncAllFromMSProject(`Đã di chuyển công việc "${movedTask.title}"!`);
            }
          } else if (_mspDragPayload.type === 'project' && _mspDragPayload.calId !== pg.cal.id) {
            const fromIdx = AppState.calendars.findIndex(c => c.id === _mspDragPayload.calId);
            if (fromIdx !== -1) {
              const [movedCal] = AppState.calendars.splice(fromIdx, 1);
              const newTargetIdx = AppState.calendars.findIndex(c => c.id === pg.cal.id);
              AppState.calendars.splice(insertAfter ? newTargetIdx + 1 : newTargetIdx, 0, movedCal);
              _mspDragPayload = null;
              syncAllFromMSProject(`Đã di chuyển dự án "${movedCal.name}"!`);
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

        // 4) Sửa trực tiếp Số ngày làm việc -> Tự động tính lại Ngày kết thúc & dịch các mục sau!
        const durInput = taskRowEl.querySelector('.msp-inline-dur-input');
        durInput.addEventListener('change', () => {
          const oldStart = task.startDate;
          const oldEnd = task.endDate;
          const newDays = Math.max(1, parseInt(durInput.value, 10) || 1);
          task.endDate = computeEndDateByWorkingDays(task.startDate, newDays, task.skipSundays !== false);
          const shifted = cascadeShiftSubsequentTasks(task, oldStart, oldEnd);
          syncAllFromMSProject(`Đã đổi "${task.title}" thành ${newDays} ngày làm việc (Kết thúc: ${formatShortVNDate(task.endDate)}${shifted > 0 ? ` • Tự động dịch ${shifted} mục sau` : ''})!`);
        });
        durInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            durInput.blur();
          }
        });

        // 5) Ô Ngày bắt đầu & Ngày kết thúc: Bấm vào hiện lịch ngay, khi đổi ngày tự động giữ nguyên ngày làm việc và dịch các mục sau
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
          // Giữ nguyên số ngày làm việc của chính công việc này khi đổi ngày bắt đầu
          task.startDate = newStart;
          task.endDate = computeEndDateByWorkingDays(newStart, workDays, task.skipSundays !== false);
          const shifted = cascadeShiftSubsequentTasks(task, oldStart, oldEnd);
          syncAllFromMSProject(`Đã dời ngày bắt đầu "${task.title}" → ${formatShortVNDate(task.startDate)} (Giữ nguyên ${workDays} ngày làm việc${shifted > 0 ? ` • Tự động dịch ${shifted} mục sau` : ''})!`);
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
        gRowTask.style.width = `${totalTimelineWidth}px`;

        const startIdx = diffDaysFromStart(globalMinDate, task.startDate);
        const durDays = diffDaysInclusive(task.startDate, task.endDate);
        const leftPx = startIdx * colWidth + 2;
        const widthPx = Math.max(18, durDays * colWidth - 4);

        const taskBar = document.createElement('div');
        taskBar.className = 'msp-task-bar';
        taskBar.style.left = `${leftPx}px`;
        taskBar.style.width = `${widthPx}px`;
        taskBar.style.background = task.color || '#cc0000';
        taskBar.style.color = getContrastTextColor(task.color || '#cc0000');
        taskBar.title = `${task.title}\nTừ: ${formatShortVNDate(task.startDate)} đến ${formatShortVNDate(task.endDate)} (${workDays} ngày làm việc)\nTiến độ: ${taskProg}%\n(Kéo giữa thanh để dời ngày, kéo 2 đầu để co giãn, Chuột phải để Nhân đôi)`;

        taskBar.addEventListener('contextmenu', (e) => {
          e.preventDefault();
          e.stopPropagation();
          openTaskContextMenu(e, task);
        });

        if (taskProg > 0) {
          const progFill = document.createElement('div');
          progFill.className = 'msp-task-progress-fill';
          progFill.style.width = `${taskProg}%`;
          taskBar.appendChild(progFill);
        }

        if (task.skipSundays !== false) {
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

  // Áp dụng độ rộng cột hiện tại & ẩn/hiện cột theo ĐỀ MỤC
  applyMspGridColumnWidths();
  renderDemucSidebar();

  // 8. Dựng lớp nền lưới dọc (Ngày lễ, Chủ Nhật, Đường kẻ Đỏ HÔM NAY)
  const totalBodyHeight = Math.max(220, currentRowIndex * ROW_HEIGHT);
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

  // 9. Vẽ mũi tên liên kết Finish-to-Start (FS) chuẩn Microsoft Project
  ganttSvg.setAttribute('width', totalTimelineWidth);
  ganttSvg.setAttribute('height', totalBodyHeight);
  ganttSvg.style.width = `${totalTimelineWidth}px`;
  ganttSvg.style.height = `${totalBodyHeight}px`;

  if (vis.ganttArrows === false) {
    ganttSvg.innerHTML = '';
  } else {
    const svgDefs = `
      <defs>
        <marker id="msp-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 8 5 L 0 9 z" fill="#475569" />
        </marker>
      </defs>
    `;
    let svgPaths = '';

    projectGroups.forEach(pg => {
      const projRows = rowRecords.filter(r => r.calId === pg.cal.id);
      for (let i = 0; i < projRows.length - 1; i++) {
        const prev = projRows[i];
        const next = projRows[i + 1];

        const x1 = prev.rightPx;
        const y1 = prev.centerY;
        const x2 = next.leftPx;
        const y2 = next.centerY;

        let dPath = '';
        if (x2 >= x1 + 8) {
          const midX = x1 + 8;
          dPath = `M ${x1} ${y1} L ${midX} ${y1} L ${midX} ${y2} L ${x2 - 2} ${y2}`;
        } else {
          const dropY = y1 + 14;
          const backX = Math.max(4, x2 - 10);
          dPath = `M ${x1} ${y1} L ${x1 + 8} ${y1} L ${x1 + 8} ${dropY} L ${backX} ${dropY} L ${backX} ${y2} L ${x2 - 2} ${y2}`;
        }

        svgPaths += `<path d="${dPath}" fill="none" stroke="#64748b" stroke-width="1.6" marker-end="url(#msp-arrow)" opacity="0.85" />`;
      }
    });

    ganttSvg.innerHTML = svgDefs + svgPaths;
  }

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

// Kéo thả dịch chuyển hoặc co giãn thanh công việc trên biểu đồ Gantt MS Project
function setupGanttBarDragAndClick(taskBar, handleL, handleR, task, colWidth) {
  let isDragging = false;
  let dragType = null;
  let startX = 0;
  let origStart = task.startDate;
  let origEnd = task.endDate;
  let origWorkDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
  let origLeftPx = 0;
  let origWidthPx = 0;
  let hasMoved = false;

  const onMouseDown = (e, type) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDragging = true;
    dragType = type;
    startX = e.clientX;
    origStart = task.startDate;
    origEnd = task.endDate;
    origWorkDays = Math.max(1, countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false));
    origLeftPx = parseFloat(taskBar.style.left) || 0;
    origWidthPx = parseFloat(taskBar.style.width) || 40;
    hasMoved = false;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize';

    const onMouseMove = (ev) => {
      if (!isDragging) return;
      const dx = ev.clientX - startX;
      const deltaDays = Math.round(dx / colWidth);
      if (Math.abs(dx) > 4) hasMoved = true;

      if (dragType === 'move') {
        const ns = parseDateStr(origStart);
        ns.setDate(ns.getDate() + deltaDays);
        const candidateStart = formatDateStr(ns);
        task.startDate = candidateStart;
        task.endDate = computeEndDateByWorkingDays(candidateStart, origWorkDays, task.skipSundays !== false);
        taskBar.style.left = `${origLeftPx + deltaDays * colWidth}px`;
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
      showFloatingTooltip(`${task.title}: ${formatShortVNDate(task.startDate)} → ${formatShortVNDate(task.endDate)} (${wDays} ngày làm việc)`, ev.clientX, ev.clientY);
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      hideFloatingTooltip();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);

      if (hasMoved) {
        const shifted = cascadeShiftSubsequentTasks(task, origStart, origEnd);
        const wDays = countWorkingDays(task.startDate, task.endDate, task.skipSundays !== false);
        syncAllFromMSProject(`Đã cập nhật "${task.title}": ${formatShortVNDate(task.startDate)} → ${formatShortVNDate(task.endDate)} (${wDays} ngày${shifted > 0 ? ` • Tự động dịch ${shifted} mục sau` : ''})!`);
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
  const visibleCals = AppState.calendars.filter(c => c.visible !== false);
  const targetCals = visibleCals.length > 0 ? visibleCals : AppState.calendars;
  const custName = getCurrentCustomerName() || 'GD_HOME_PROJECT';

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

  targetCals.forEach((cal, cIdx) => {
    const calUid = uidCounter++;
    const calIdNum = idCounter++;
    const wbsParent = `${cIdx + 1}`;
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
      <OutlineLevel>1</OutlineLevel>
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

    let prevChildUid = null;
    calTasks.forEach((t, tIdx) => {
      const tUid = uidCounter++;
      const tIdNum = idCounter++;
      const wbsCode = `${wbsParent}.${tIdx + 1}`;
      const wDays = Math.max(1, countWorkingDays(t.startDate, t.endDate, t.skipSundays !== false));
      const prog = typeof t.progress === 'number' ? t.progress : 0;

      const predXml = prevChildUid ? `
      <PredecessorLink>
        <PredecessorUID>${prevChildUid}</PredecessorUID>
        <Type>1</Type>
        <CrossProject>0</CrossProject>
      </PredecessorLink>` : '';

      tasksXml += `
    <Task>
      <UID>${tUid}</UID>
      <ID>${tIdNum}</ID>
      <Name>${escapeXml(t.title)}</Name>
      <Type>0</Type>
      <IsNull>0</IsNull>
      <WBS>${wbsCode}</WBS>
      <OutlineNumber>${wbsCode}</OutlineNumber>
      <OutlineLevel>2</OutlineLevel>
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

      prevChildUid = tUid;
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

        if (isSummary && outlineLevel === 1) {
          // Đây là dòng Dự án cha (Summary Row)
          currentCal = {
            id: 'cal_imp_' + Date.now() + '_' + importedCalendars.length,
            name: name.toUpperCase(),
            customerName: name.toUpperCase(),
            color: customColor || rainbowPalette[importedCalendars.length % rainbowPalette.length],
            visible: true
          };
          importedCalendars.push(currentCal);
        } else if (!isSummary) {
          if (!currentCal) {
            currentCal = {
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

          importedTasks.push({
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

      // Hỏi người dùng muốn Gộp thêm vào dự án hiện tại hay Thay thế bằng dự án vừa mở
      const replaceMode = confirm(
        `Đã đọc được ${importedCalendars.length} dự án và ${importedTasks.length} hạng mục từ file "${file.name}".\n\n` +
        `• Bấm [OK] để MỞ ĐÈ (Thay thế bảng hiện tại bằng file vừa mở).\n` +
        `• Bấm [Cancel / Huỷ] để GỘP THÊM vào danh sách dự án hiện tại.`
      );

      if (replaceMode) {
        AppState.calendars = importedCalendars;
        AppState.tasks = importedTasks;
      } else {
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

  // 1. Tính độ rộng vừa khít chính xác (pixel) cho cột "Hạng mục / Công việc" để không dư khoảng trống và không mất chữ
  const exportNameColWidth = computeTightMspNameColWidth();

  // 2. Tạo bản sao (Clone) chuyên biệt để chụp ảnh sắc nét, không làm giật màn hình
  const cloneSheet = mspSheet.cloneNode(true);
  cloneSheet.classList.add('msp-export-clone');
  cloneSheet.style.position = 'fixed';
  cloneSheet.style.left = '-19999px';
  cloneSheet.style.top = '0';
  cloneSheet.style.background = '#ffffff';
  cloneSheet.style.zIndex = '-1';

  // Ẩn thanh công cụ thêm nhanh và thanh kéo splitter trong ảnh xuất
  const cloneQuickToolbar = cloneSheet.querySelector('#msp-quick-toolbar');
  if (cloneQuickToolbar) cloneQuickToolbar.style.display = 'none';
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

    if (cEl.classList.contains('msp-clean-date-picker')) {
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
    } else if (cEl.id === 'msp-customer-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ffffff';
      span.style.fontSize = '18px';
      span.style.fontWeight = '800';
      span.style.textTransform = 'uppercase';
    } else if (cEl.id === 'msp-month-input') {
      span.textContent = oEl.value || '';
      span.style.color = '#ffffff';
      span.style.fontSize = '13.5px';
      span.style.fontWeight = '700';
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
        copyCanvasToClipboard(canvas);
      } else {
        const custName = getCurrentCustomerName().replace(/\s+/g, '_') || 'DuAn';
        downloadCanvas(canvas, `Timeline_MSProject_${custName}.png`);
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
  setupEvents();
  syncWithBackend();
});
