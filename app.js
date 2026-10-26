// Khởi tạo state của ứng dụng
const AppState = {
  startMonth: '2026-06',
  endMonth: '2026-09',
  scheduleMonth: 'Tháng 9, 2026', // Tháng đang lập bảng hiển thị bên trái tiêu đề
  extraWeeksTop: 0,
  extraWeeksBottom: 1, // Mặc định luôn có tối thiểu 1 hàng tuần trống bên dưới
  showVnHolidays: true,
  showLunarDates: true, // Mặc định hiển thị ngày Âm lịch bên phải ngày Dương
  calendars: [
    {
      id: 'cal-1',
      name: 'A DŨNG VŨ YÊN - HẢI PHÒNG',
      customerName: 'A DŨNG VŨ YÊN - HẢI PHÒNG',
      color: '#cc0000',
      visible: true
    },
    {
      id: 'cal-2',
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
  footerNote: 'Bảng tiến độ chưa bao gồm thời gian phản hồi và trao đổi thiết kế'
};

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
  if (!Array.isArray(AppState.calendars) || AppState.calendars.length === 0) {
    AppState.calendars = [
      { id: 'cal-1', name: 'A DŨNG VŨ YÊN - HẢI PHÒNG', customerName: 'A DŨNG VŨ YÊN - HẢI PHÒNG', color: '#cc0000', visible: true },
      { id: 'cal-2', name: 'LỊCH CÔNG VIỆC CHUNG', customerName: 'LỊCH CÔNG VIỆC CHUNG', color: '#2e7d32', visible: true }
    ];
  }
  AppState.calendars.forEach(c => {
    if (!c.name || !c.name.trim()) {
      c.name = 'CHƯA ĐẶT TÊN KHÁCH HÀNG';
      c.customerName = '';
    } else if (c.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG') {
      c.customerName = '';
    } else {
      c.customerName = c.name.trim();
    }
  });
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
  loadFromStorage();
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
  const holToggle = document.getElementById('toggle-vn-holidays');
  if (holToggle) holToggle.checked = AppState.showVnHolidays !== false;
  const lunarToggle = document.getElementById('toggle-lunar-dates');
  if (lunarToggle) lunarToggle.checked = AppState.showLunarDates !== false;

  const monthInput = document.getElementById('schedule-month-input');
  if (monthInput) {
    monthInput.value = AppState.scheduleMonth || 'Tháng 9, 2026';
  }

  syncCustomerInputWithActiveCalendar();
  renderCalendarSidebar();
  updateCompanyBranding();
  renderCalendar();
}

function syncCustomerInputWithActiveCalendar() {
  const activeCal = getActiveCalendar();
  const custInput = document.getElementById('customer-name-input');
  if (custInput) {
    custInput.value = activeCal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? '' : activeCal.name;
  }
}

function saveToStorage() {
  localStorage.setItem('timeline_calendar_state', JSON.stringify({
    startMonth: AppState.startMonth,
    endMonth: AppState.endMonth,
    scheduleMonth: AppState.scheduleMonth,
    extraWeeksTop: AppState.extraWeeksTop,
    extraWeeksBottom: AppState.extraWeeksBottom,
    calendars: AppState.calendars,
    activeCalendarId: AppState.activeCalendarId,
    tasks: AppState.tasks,
    companyName: AppState.companyName,
    companyLogo: AppState.companyLogo,
    footerNote: AppState.footerNote,
    showVnHolidays: AppState.showVnHolidays,
    showLunarDates: AppState.showLunarDates
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
      if (parsed.calendars) AppState.calendars = parsed.calendars;
      if (parsed.activeCalendarId) AppState.activeCalendarId = parsed.activeCalendarId;
      if (parsed.tasks) AppState.tasks = parsed.tasks;
      if (parsed.companyName) AppState.companyName = parsed.companyName;
      if (parsed.companyLogo !== undefined) AppState.companyLogo = parsed.companyLogo;
      if (parsed.footerNote) AppState.footerNote = parsed.footerNote;
      if (parsed.showVnHolidays !== undefined) AppState.showVnHolidays = parsed.showVnHolidays;
      if (parsed.showLunarDates !== undefined) AppState.showLunarDates = parsed.showLunarDates;
    } catch (e) {
      console.error(e);
    }
  }
}

// =========================================================================
// SIDEBAR DANH SÁCH LỊCH BÊN TRÁI & ĐỒNG BỘ TÊN KHÁCH HÀNG
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

  AppState.calendars.forEach(cal => {
    const item = document.createElement('div');
    item.className = `calendar-list-item ${cal.id === AppState.activeCalendarId ? 'active-selected' : ''}`;
    item.title = `Bấm để chọn lịch "${cal.name}"`;

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
    editBtn.title = 'Đổi tên khách hàng hoặc màu lịch';
    editBtn.innerHTML = '<i data-lucide="edit-2"></i>';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openCalendarCategoryModal(cal);
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
    container.appendChild(item);
  });

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

let selectedCalCatColor = '#cc0000';

function openCalendarCategoryModal(cal = null) {
  const modal = document.getElementById('calendar-category-modal');
  const titleEl = document.getElementById('modal-cal-cat-title');
  const idInput = document.getElementById('cal-cat-id');
  const nameInput = document.getElementById('cal-cat-name');

  if (cal) {
    titleEl.textContent = 'Chỉnh sửa Tên Khách Hàng / Lịch';
    idInput.value = cal.id;
    nameInput.value = cal.name === 'CHƯA ĐẶT TÊN KHÁCH HÀNG' ? '' : cal.name;
    selectedCalCatColor = cal.color || '#cc0000';
  } else {
    titleEl.textContent = 'Tạo Lịch Khách Hàng Mới';
    idInput.value = '';
    nameInput.value = '';
    selectedCalCatColor = '#cc0000';
  }

  document.querySelectorAll('#cal-cat-color-palette .color-swatch').forEach(sw => {
    if (sw.dataset.color.toLowerCase() === selectedCalCatColor.toLowerCase()) {
      sw.classList.add('active');
    } else {
      sw.classList.remove('active');
    }
  });

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
    if (!name) return;

    if (id) {
      const cal = AppState.calendars.find(c => c.id === id);
      if (cal) {
        renameCalendarAndSyncTasks(cal, name);
        cal.color = selectedCalCatColor;
      }
    } else {
      const newCal = {
        id: 'cal_' + Date.now(),
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
    const dayOfWeek = curr.getDay();
    if (skipSundays) {
      if (dayOfWeek !== 0) workDays++;
    } else {
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
  return AppState.tasks.filter(t => visibleCalIds.has(t.calendarId));
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

      if (dayIdx === 6) {
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
      const shouldSkipSunday = task.skipSundays !== false;
      const rawSegStart = task.startDate < weekStartStr ? 0 : week.findIndex(d => formatDateStr(d) === task.startDate);
      const rawSegEnd = task.endDate > weekEndStr ? 6 : week.findIndex(d => formatDateStr(d) === task.endDate);

      if (!shouldSkipSunday) {
        weekSegments.push({
          task,
          colStart: rawSegStart,
          colEnd: rawSegEnd,
          isOverallStart: task.startDate >= weekStartStr && rawSegStart === week.findIndex(d => formatDateStr(d) === task.startDate),
          isOverallEnd: task.endDate <= weekEndStr && rawSegEnd === week.findIndex(d => formatDateStr(d) === task.endDate)
        });
      } else {
        if (rawSegStart <= 5) {
          const partEnd = Math.min(rawSegEnd, 5);
          weekSegments.push({
            task,
            colStart: rawSegStart,
            colEnd: partEnd,
            isOverallStart: task.startDate >= weekStartStr && rawSegStart === week.findIndex(d => formatDateStr(d) === task.startDate),
            isOverallEnd: task.endDate <= weekEndStr && rawSegEnd <= 5
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
        seg.style.backgroundColor = task.color || '#cc0000';
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
    resizeTask.startDate = resizePreviewStart;
    resizeTask.endDate = resizePreviewEnd;
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
  popoverColor = activeCal.color || '#cc0000';

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
  const palette = document.getElementById('color-palette');
  const swatches = palette.querySelectorAll('.color-swatch');
  const customPicker = document.getElementById('custom-color-picker');

  swatches.forEach(swatch => {
    swatch.addEventListener('click', () => {
      selectSwatchColorInModal(swatch.dataset.color);
    });
  });

  customPicker.addEventListener('input', (e) => {
    swatches.forEach(s => s.classList.remove('active'));
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

function openTaskModal(task = null, defaultStartDate = null) {
  const modal = document.getElementById('task-modal');
  const modalTitle = document.getElementById('modal-task-title');
  const taskIdInput = document.getElementById('task-id');
  const titleInput = document.getElementById('task-title');
  const startInput = document.getElementById('task-start-date');
  const endInput = document.getElementById('task-end-date');
  const noteInput = document.getElementById('task-note');
  const deleteBtn = document.getElementById('btn-delete-task');
  const skipSundaysCheckbox = document.getElementById('task-skip-sundays');
  const showCountCheckbox = document.getElementById('task-show-count');

  const activeCal = getActiveCalendar();

  if (task) {
    modalTitle.textContent = 'Chỉnh sửa tiến độ công việc';
    taskIdInput.value = task.id;
    populateCalendarSelectDropdown(task.calendarId || activeCal.id);
    titleInput.value = task.title;
    startInput.value = task.startDate;
    endInput.value = task.endDate;
    noteInput.value = task.note || '';
    selectSwatchColorInModal(task.color || activeCal.color || '#cc0000');
    skipSundaysCheckbox.checked = task.skipSundays !== false;
    showCountCheckbox.checked = task.showCount !== false;
    deleteBtn.style.display = 'block';
  } else {
    modalTitle.textContent = 'Thêm công việc tiến độ mới';
    taskIdInput.value = '';
    populateCalendarSelectDropdown(activeCal.id);
    titleInput.value = formatStageTitleWithCustomer('3D');
    const defStart = defaultStartDate || formatDateStr(new Date());
    startInput.value = defStart;
    
    const defEnd = parseDateStr(defStart);
    defEnd.setDate(defEnd.getDate() + 3);
    endInput.value = formatDateStr(defEnd);

    noteInput.value = '';
    selectSwatchColorInModal('#cc0000');
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

  const logoContainer = document.getElementById('footer-logo-container');
  if (AppState.companyLogo) {
    logoContainer.innerHTML = `<img src="${AppState.companyLogo}" alt="Logo" class="gdhome-full-logo-img">`;
  } else if (AppState.companyName && AppState.companyName.toUpperCase() !== 'GD HOME') {
    logoContainer.innerHTML = `<img src="gdhome-icon.png" alt="Icon" style="height:56px; object-fit:contain;"> <span class="brand-text">${AppState.companyName}</span>`;
  } else {
    logoContainer.innerHTML = `<img src="gdhome-logo.png" alt="GD HOME" class="gdhome-full-logo-img">`;
  }
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
      executeExportWeeksSlice(currentRenderedWeeks, true, 2, 'clipboard');
    });
  }

  if (btnStartCropHeader) {
    btnStartCropHeader.addEventListener('click', () => {
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
      AppState.showVnHolidays = e.target.checked;
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

    if (startDate > endDate) {
      alert('Ngày bắt đầu không được sau ngày kết thúc!');
      return;
    }

    if (id) {
      const task = AppState.tasks.find(t => t.id === id);
      if (task) {
        task.calendarId = calId;
        task.title = title;
        task.startDate = startDate;
        task.endDate = endDate;
        task.color = selectedColor;
        task.skipSundays = skipSundays;
        task.showCount = showCount;
        task.note = note;
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

// Khởi tạo
window.addEventListener('DOMContentLoaded', () => {
  setupColorPalette();
  setupSidebarEvents();
  setupQuickPopoverEvents();
  setupGridMouseInteractions();
  setupEvents();
  syncWithBackend();
});
