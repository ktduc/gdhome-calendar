// Bảng thống kê dự án (/thong-ke): tính các cột tự động của 1 dự án từ Lịch (việc 3D / CHỈNH SỬA 3D / HSKT…) và Chốt mã.
// Cột anh nhập tay trong hồ sơ luôn được ưu tiên; ở đây chỉ trả giá trị "tự" để bảng hiện khi ô tay còn trống.
const DAY = 86400000;
const OVERDUE_WINDOW_DAYS = 30;   // shortcut: việc cũ chưa đánh dấu 100 % quá 30 ngày thì coi như đã xong, đỡ báo trễ hàng loạt

// Loại việc theo tiền tố tên (giống nút tag trên Lịch): "3D - …", "CHỈNH SỬA 3D - …", "HSKT - …", "LAYOUT - …"
function taskKind(title = '') {
  const head = String(title).toUpperCase().split(' - ')[0].trim();
  if (/CHỈNH SỬA 3D|SỬA 3D/.test(head)) return 'edit3d';
  if (/HSKT|HỒ SƠ KỸ THUẬT/.test(head)) return 'hskt';
  if (/\b3D\b/.test(head)) return '3d';
  if (/LAYOUT|MẶT BẰNG/.test(head)) return 'layout';
  return 'other';
}
const taskLabel = title => String(title || '').split(' - ')[0].trim() || 'Việc';
const isDone = task => (Number(task.progress) || 0) >= 100;
const people = tasks => [...new Set(tasks.flatMap(task => String(task.assignee || '').split(',').map(name => name.trim()).filter(Boolean)))].join(', ');
const daysBetween = (from, to) => Math.round((Date.parse(to) - Date.parse(from)) / DAY);

function projectTasks(projectId, schedule) {
  const calendars = new Set((schedule?.calendars || []).filter(cal => cal.ownerId === projectId).map(cal => cal.id));
  return (schedule?.tasks || []).filter(task => calendars.has(task.calendarId) && task.startDate && task.endDate);
}

// Trạng thái 3D / HSKT suy từ lịch: đang làm theo ngày hôm nay, đã xong theo ngày kết thúc hoặc 100 %
function autoStatus(tasks, today, kinds) {
  const list = tasks.filter(task => kinds.includes(taskKind(task.title))).sort((a, b) => a.startDate.localeCompare(b.startDate));
  if (!list.length) return '';
  const running = list.find(task => !isDone(task) && task.startDate <= today && task.endDate >= today);
  if (running) return taskKind(running.title) === 'edit3d' ? 'Đang chỉnh sửa' : 'Đang triển khai';
  const finished = list.filter(task => isDone(task) || task.endDate < today);
  if (!finished.length) return 'Chưa làm';
  if (kinds.includes('hskt')) return finished.length === list.length ? 'Đã gửi' : 'Đang triển khai';
  return finished.length === list.length ? 'Xong lần ' + finished.length : 'Chờ phản hồi';
}

function projectRow(project, schedule, today = new Date().toISOString().slice(0, 10)) {
  const tasks = projectTasks(project.id, schedule);
  const open = tasks.filter(task => !isDone(task));
  const next = open.filter(task => task.endDate >= today).sort((a, b) => a.endDate.localeCompare(b.endDate) || a.startDate.localeCompare(b.startDate))[0];
  const overdue = open.filter(task => task.endDate < today && daysBetween(task.endDate, today) <= OVERDUE_WINDOW_DAYS)
    .sort((a, b) => a.endDate.localeCompare(b.endDate));
  const of = kinds => tasks.filter(task => kinds.includes(taskKind(task.title)));
  return {
    deadline: next ? {start: next.startDate, end: next.endDate, label: taskLabel(next.title), daysLeft: daysBetween(today, next.endDate), taskId: next.id} : null,
    overdue: overdue.map(task => ({end: task.endDate, label: taskLabel(task.title), taskId: task.id})),
    designer3d: people(of(['3d', 'edit3d', 'layout'])),
    designerHskt: people(of(['hskt'])),
    status3d: autoStatus(tasks, today, ['3d', 'edit3d']),
    statusHskt: autoStatus(tasks, today, ['hskt']),
    taskCount: tasks.length,
    doneCount: tasks.length - open.length,
  };
}

// Phí thiết kế còn phải thu theo điều khoản giảm trừ khi ký thi công (mẫu HĐTK GD HOME: ≥ 4 tỷ giảm 100 %, 2–4 tỷ giảm 50 %)
function designFeeAfterDiscount(designValue, constructionValue) {
  const fee = Number(designValue) || 0, build = Number(constructionValue) || 0;
  if (build >= 4e9) return 0;
  if (build >= 2e9) return Math.round(fee / 2);
  return fee;
}

module.exports = {taskKind, projectTasks, projectRow, autoStatus, designFeeAfterDiscount};
