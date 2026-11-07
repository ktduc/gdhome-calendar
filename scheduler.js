// =========================================================================
// GD HOME - BỘ TÍNH NGÀY LÀM VIỆC & LIÊN KẾT TIẾN ĐỘ (SCHEDULER ENGINE)
// -------------------------------------------------------------------------
// Tách riêng khỏi app.js để:
//  - Dễ kiểm tra (chạy được bằng Node: node --test)
//  - Mọi phép tính ngày (ngày nghỉ, 0.5 ngày Thứ 7, làm bù, liên kết FS)
//    nằm ở 1 chỗ duy nhất.
// Phụ thuộc: holidays-data.js (getVnHolidayInfo) phải được nạp trước.
// Cấu hình ngày nghỉ đọc từ AppState.daysOffConfig (nếu có).
// =========================================================================

const DEFAULT_DAYS_OFF_CONFIG = { holidays: true, saturdayHalf: false, saturday: false, sunday: true, overrides: {} };

function getDaysOffConfig() {
  if (typeof AppState !== 'undefined' && AppState && AppState.daysOffConfig && typeof AppState.daysOffConfig === 'object') {
    return AppState.daysOffConfig;
  }
  return DEFAULT_DAYS_OFF_CONFIG;
}

function formatDateStr(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateStr(str) {
  const [y, m, d] = String(str).split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Thông tin ngày lễ để HIỂN THỊ (gồm cả ngày kỷ niệm & ngày làm bù) -> { name, type } | null
function getHolidayInfo(dateStr) {
  if (typeof getVnHolidayInfo === 'function') return getVnHolidayInfo(dateStr);
  if (typeof VIETNAM_HOLIDAYS !== 'undefined' && VIETNAM_HOLIDAYS[dateStr]) {
    return { name: VIETNAM_HOLIDAYS[dateStr], type: 'off' };
  }
  return null;
}

function getHolidayName(dateStr) {
  const info = getHolidayInfo(dateStr);
  return info ? info.name : null;
}

// Ngày tự đánh dấu riêng (chuột phải vào ô ngày): 'off' = nghỉ, 'work' = đi làm
function getDayOverride(dateStr) {
  const cfg = getDaysOffConfig();
  return (cfg.overrides && cfg.overrides[dateStr]) || null;
}

// Kiểm tra 1 ngày có phải ngày nghỉ không.
// Thứ tự ưu tiên: Ngày tự đánh dấu > Ngày lễ / Làm bù > Chủ nhật > Thứ 7 > Chiều Thứ 7
function isDateDayOff(dateOrStr, respectSkip = true) {
  if (!respectSkip) return { isOff: false, isHalfOff: false, workWeight: 1, reason: null, type: null };
  const d = typeof dateOrStr === 'string' ? parseDateStr(dateOrStr) : dateOrStr;
  const dStr = typeof dateOrStr === 'string' ? dateOrStr : formatDateStr(d);
  const dow = d.getDay();
  const cfg = getDaysOffConfig();

  const ov = cfg.overrides ? cfg.overrides[dStr] : null;
  if (ov === 'off') {
    return { isOff: true, isHalfOff: false, workWeight: 0, reason: 'Ngày nghỉ riêng (tự đánh dấu)', type: 'holiday', isCustom: true };
  }
  if (ov === 'work') {
    return { isOff: false, isHalfOff: false, workWeight: 1, reason: 'Ngày đi làm (tự đánh dấu)', type: 'custom-work', isCustom: true };
  }

  if (cfg.holidays) {
    const hol = getHolidayInfo(dStr);
    if (hol && hol.type === 'off') {
      return { isOff: true, isHalfOff: false, workWeight: 0, reason: `Nghỉ lễ: ${hol.name}`, type: 'holiday' };
    }
    if (hol && hol.type === 'work') {
      return { isOff: false, isHalfOff: false, workWeight: 1, reason: `Ngày làm bù: ${hol.name}`, type: 'makeup-work' };
    }
  }
  if (cfg.sunday && dow === 0) {
    return { isOff: true, isHalfOff: false, workWeight: 0, reason: 'Nghỉ Chủ nhật', type: 'sunday' };
  }
  if (cfg.saturday && dow === 6) {
    return { isOff: true, isHalfOff: false, workWeight: 0, reason: 'Nghỉ Thứ 7', type: 'saturday' };
  }
  if (cfg.saturdayHalf && dow === 6) {
    return { isOff: false, isHalfOff: true, workWeight: 0.5, reason: 'Nghỉ chiều Thứ 7 (Làm sáng 0.5 ngày)', type: 'saturday-half' };
  }
  return { isOff: false, isHalfOff: false, workWeight: 1, reason: null, type: null };
}

function calculateTaskDays(startDateStr, endDateStr, skipSundays = true) {
  if (!startDateStr || !endDateStr || startDateStr > endDateStr) {
    return { workDays: 0, totalDays: 0 };
  }
  const curr = parseDateStr(startDateStr);
  const end = parseDateStr(endDateStr);
  let totalDays = 0;
  let workDays = 0;
  let guard = 0;
  while (curr <= end && guard++ < 20000) {
    totalDays++;
    const dayInfo = isDateDayOff(curr, skipSundays !== false);
    if (!dayInfo.isOff) {
      workDays += (typeof dayInfo.workWeight === 'number' ? dayInfo.workWeight : 1);
    }
    curr.setDate(curr.getDate() + 1);
  }
  workDays = Math.round(workDays * 10) / 10;
  return { workDays, totalDays };
}

function countWorkingDays(startDateStr, endDateStr, skipSundays = true) {
  return calculateTaskDays(startDateStr, endDateStr, skipSundays !== false).workDays;
}

// Dịch 1 ngày đi N ngày làm việc (âm = lùi lại), kết quả luôn rơi vào ngày làm việc
function shiftDateByWorkingDays(dateStr, deltaWorkingDays, skipSundays = true) {
  const curr = parseDateStr(dateStr);
  const remaining = parseInt(deltaWorkingDays, 10) || 0;
  let guard = 0;
  if (remaining !== 0) {
    const step = remaining > 0 ? 1 : -1;
    let stepsLeft = Math.abs(remaining);
    while (stepsLeft > 0 && guard++ < 20000) {
      curr.setDate(curr.getDate() + step);
      if (!isDateDayOff(curr, skipSundays !== false).isOff) {
        stepsLeft--;
      }
    }
  }
  while (skipSundays && isDateDayOff(curr, true).isOff && guard++ < 20000) {
    curr.setDate(curr.getDate() + 1);
  }
  return formatDateStr(curr);
}

// Khoảng cách số ngày làm việc có dấu từ dateA sang dateB
function getSignedWorkingDaysGap(dateAStr, dateBStr, skipSundays = true) {
  if (!dateAStr || !dateBStr || dateAStr === dateBStr) return 0;
  const a = parseDateStr(dateAStr);
  const b = parseDateStr(dateBStr);
  const sign = b > a ? 1 : -1;
  const curr = new Date(a);
  let count = 0;
  let guard = 0;
  while (((sign > 0 && curr < b) || (sign < 0 && curr > b)) && guard++ < 20000) {
    curr.setDate(curr.getDate() + sign);
    if (!isDateDayOff(curr, skipSundays !== false).isOff) {
      count += sign;
    }
  }
  return count;
}

// Ngày kết thúc = Ngày bắt đầu + số ngày làm việc (nhảy qua ngày nghỉ, hỗ trợ 0.5 ngày chiều Thứ 7)
function computeEndDateByWorkingDays(startDateStr, targetWorkingDays, skipSundays = true) {
  const days = Math.max(0.5, parseFloat(targetWorkingDays) || 1);
  const curr = parseDateStr(startDateStr);
  let guard = 0;
  while (skipSundays && isDateDayOff(curr, true).isOff && guard++ < 20000) {
    curr.setDate(curr.getDate() + 1);
  }
  let counted = 0;
  while (guard++ < 40000) {
    const dayInfo = isDateDayOff(curr, skipSundays !== false);
    if (!dayInfo.isOff) {
      const weight = typeof dayInfo.workWeight === 'number' ? dayInfo.workWeight : 1;
      counted = Math.round((counted + weight) * 10) / 10;
    }
    if (counted >= days) break;
    curr.setDate(curr.getDate() + 1);
  }
  return formatDateStr(curr);
}

// Ngày làm việc kế tiếp sau 1 ngày
function getNextWorkingDateStr(dateStr, skipSundays = true) {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + 1);
  let guard = 0;
  while (skipSundays && isDateDayOff(d, true).isOff && guard++ < 20000) {
    d.setDate(d.getDate() + 1);
  }
  return formatDateStr(d);
}

// =========================================================================
// LIÊN KẾT TIẾN ĐỘ (PREDECESSORS) + độ trễ (lag, tính bằng ngày làm việc)
// task.predecessors = [{ id: 'task_xxx', type: 'FS' | 'SS', lag: <số ngày làm việc> }]
//  - FS (Finish-to-Start): việc sau bắt đầu SAU KHI việc trước XONG
//      lag = 0 -> bắt đầu ngay ngày làm việc kế tiếp; lag > 0 -> cách thêm N ngày; lag < 0 -> gối đầu
//  - SS (Start-to-Start): việc sau BẮT ĐẦU CÙNG / SAU khi việc trước BẮT ĐẦU
//      lag = 0 -> bắt đầu cùng ngày; lag = 2 -> bắt đầu sau việc trước 2 ngày làm việc
// =========================================================================

function _schedTasks(tasks) {
  if (Array.isArray(tasks)) return tasks;
  return (typeof AppState !== 'undefined' && AppState && Array.isArray(AppState.tasks)) ? AppState.tasks : [];
}

// Ngày bắt đầu sớm nhất của 1 việc theo 1 liên kết
function getLinkTypeOf(link) {
  return link && link.type === 'SS' ? 'SS' : 'FS';
}

// Mốc gốc của liên kết: FS = ngày làm việc kế tiếp sau khi việc trước xong; SS = ngày bắt đầu của việc trước
function getLinkBaseDate(predTask, type, skipSundays = true) {
  if (type === 'SS') return shiftDateByWorkingDays(predTask.startDate, 0, skipSundays);
  return getNextWorkingDateStr(predTask.endDate, skipSundays);
}

function getLinkedStartDate(predTask, link, skipSundays = true) {
  const base = getLinkBaseDate(predTask, getLinkTypeOf(link), skipSundays);
  const lag = Math.round(Number(link.lag) || 0);
  return lag === 0 ? base : shiftDateByWorkingDays(base, lag, skipSundays);
}

// Tính lại độ trễ (lag) của 1 liên kết theo vị trí hiện tại của 2 việc
function computeLinkLag(predTask, succTask, type = 'FS') {
  const skip = succTask.skipSundays !== false;
  const base = getLinkBaseDate(predTask, type === 'SS' ? 'SS' : 'FS', skip);
  return getSignedWorkingDaysGap(base, succTask.startDate, skip);
}

// Cập nhật lag của toàn bộ liên kết theo vị trí hiện tại (gọi sau mỗi lần lưu)
function refreshAllLinkLags(tasks) {
  const list = _schedTasks(tasks);
  const byId = new Map(list.map(t => [t.id, t]));
  list.forEach(t => {
    if (!Array.isArray(t.predecessors)) return;
    t.predecessors.forEach(link => {
      const pred = byId.get(link.id);
      if (pred) link.lag = computeLinkLag(pred, t, getLinkTypeOf(link));
    });
  });
}

// Việc B có phụ thuộc (trực tiếp hoặc gián tiếp) vào A không? -> dùng để chặn liên kết vòng
function dependsOn(taskId, ancestorId, tasks) {
  const list = _schedTasks(tasks);
  const byId = new Map(list.map(t => [t.id, t]));
  const seen = new Set();
  const stack = [taskId];
  while (stack.length) {
    const id = stack.pop();
    if (id === ancestorId) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = byId.get(id);
    if (t && Array.isArray(t.predecessors)) t.predecessors.forEach(l => stack.push(l.id));
  }
  return false;
}

function addPredecessorLink(succTask, predTask, tasks, type = 'FS') {
  if (!succTask || !predTask || succTask.id === predTask.id) return false;
  if (dependsOn(predTask.id, succTask.id, tasks)) return false; // tạo vòng lặp
  if (!Array.isArray(succTask.predecessors)) succTask.predecessors = [];
  const t = type === 'SS' ? 'SS' : 'FS';
  const existing = succTask.predecessors.find(l => l.id === predTask.id);
  if (existing) {
    if (getLinkTypeOf(existing) === t) return false;
    existing.type = t; // đổi loại liên kết
    existing.lag = computeLinkLag(predTask, succTask, t);
    return true;
  }
  succTask.predecessors.push({ id: predTask.id, type: t, lag: computeLinkLag(predTask, succTask, t) });
  return true;
}

function removePredecessorLink(succTask, predId) {
  if (!succTask || !Array.isArray(succTask.predecessors)) return false;
  const before = succTask.predecessors.length;
  succTask.predecessors = succTask.predecessors.filter(l => l.id !== predId);
  return succTask.predecessors.length !== before;
}

// Dời các việc phía sau theo liên kết, giữ nguyên số ngày làm việc & độ trễ của từng việc.
// Trả về số việc đã bị dời.
function propagateLinkedTasks(rootIds, tasks) {
  const list = _schedTasks(tasks);
  const byId = new Map(list.map(t => [t.id, t]));
  const successors = new Map();
  list.forEach(t => {
    (t.predecessors || []).forEach(l => {
      if (!successors.has(l.id)) successors.set(l.id, []);
      successors.get(l.id).push(t);
    });
  });

  const moved = new Set();
  const queue = Array.isArray(rootIds) ? rootIds.slice() : [rootIds];
  let guard = 0;
  while (queue.length && guard++ < 5000) {
    const id = queue.shift();
    (successors.get(id) || []).forEach(succ => {
      const skip = succ.skipSundays !== false;
      let required = null;
      succ.predecessors.forEach(l => {
        const pred = byId.get(l.id);
        if (!pred) return;
        const s = getLinkedStartDate(pred, l, skip);
        if (!required || s > required) required = s;
      });
      if (!required || required === succ.startDate) return;
      const keepDays = Math.max(0.5, countWorkingDays(succ.startDate, succ.endDate, skip) || 1);
      succ.startDate = required;
      succ.endDate = computeEndDateByWorkingDays(required, keepDays, skip);
      moved.add(succ.id);
      queue.push(succ.id);
    });
  }
  return moved.size;
}

// Tự nối liên kết cho dữ liệu cũ (chưa có trường predecessors):
// chỉ nối 2 việc liền nhau trong cùng dự án khi việc sau bắt đầu SAU khi việc trước kết thúc.
// Các việc chạy song song / gối đầu sẽ không bị nối.
function inferMissingPredecessors(tasks) {
  const list = _schedTasks(tasks);
  const prevByCal = new Map();
  let inferred = 0;
  list.forEach(t => {
    if (t.visibleOnBoard === false) {
      if (!Array.isArray(t.predecessors)) t.predecessors = [];
      return;
    }
    const prev = prevByCal.get(t.calendarId);
    if (!Array.isArray(t.predecessors)) {
      t.predecessors = [];
      if (prev && t.startDate > prev.endDate) {
        t.predecessors.push({ id: prev.id, type: 'FS', lag: computeLinkLag(prev, t) });
        inferred++;
      }
    }
    prevByCal.set(t.calendarId, t);
  });
  return inferred;
}

// TỰ NỐI LIÊN KẾT cho 1 việc: nối vào "mốc" GẦN NHẤT xảy ra trước (hoặc cùng ngày) khi việc bắt đầu.
//  - Mốc FS = ngày làm việc kế tiếp sau khi 1 việc KẾT THÚC  -> nối Kết thúc → Bắt đầu
//  - Mốc SS = ngày 1 việc BẮT ĐẦU (việc đó còn đang chạy)     -> nối Bắt đầu → Bắt đầu (chạy song song / gối đầu)
//  Chọn mốc muộn nhất (sát ngày bắt đầu nhất). Bằng nhau thì ưu tiên SS (bắt đầu đồng thời).
//  Mốc cách quá maxGap ngày làm việc thì không nối. Không tạo vòng lặp, không dời ngày.
function autoLinkTask(task, tasks, opts = {}) {
  if (!task || !task.calendarId || !task.startDate) return null;
  const list = _schedTasks(tasks);
  if (!Array.isArray(task.predecessors)) task.predecessors = [];
  if (task.predecessors.length) return null;
  const maxGap = typeof opts.maxGap === 'number' ? opts.maxGap : 7;
  const allowed = opts.candidateIds ? new Set(opts.candidateIds) : null;
  const skip = task.skipSundays !== false;
  const start = shiftDateByWorkingDays(task.startDate, 0, skip);
  let best = null;
  list.forEach(c => {
    if (c === task || c.id === task.id || c.calendarId !== task.calendarId || c.visibleOnBoard === false) return;
    if (!c.startDate || !c.endDate || (allowed && !allowed.has(c.id))) return;
    if (c.startDate > task.startDate) return; // chỉ xét việc bắt đầu trước / cùng ngày
    if (dependsOn(c.id, task.id, list)) return;
    const running = c.endDate >= task.startDate;
    const type = running ? 'SS' : 'FS';
    const anchor = running ? shiftDateByWorkingDays(c.startDate, 0, skip) : getNextWorkingDateStr(c.endDate, skip);
    const lag = getSignedWorkingDaysGap(anchor, start, skip);
    if (lag < 0 || lag > maxGap) return;
    const better = !best || anchor > best.anchor ||
      (anchor === best.anchor && type === 'SS' && best.type === 'FS') ||
      // cùng mốc SS: chọn việc "dẫn đầu" (kết thúc sớm nhất) -> các việc bắt đầu đồng thời toả ra từ 1 việc, không nối chuỗi
      (anchor === best.anchor && type === 'SS' && best.type === 'SS' && c.endDate < best.c.endDate);
    if (better) best = { c, type, anchor, lag };
  });
  if (!best) return null;
  const link = { id: best.c.id, type: best.type, lag: best.lag };
  if (opts.markAuto) link.auto = true;
  task.predecessors.push(link);
  return link;
}

// Tự nối các việc CHƯA có liên kết trong 1 giai đoạn (theo thứ tự ngày bắt đầu). Trả về số liên kết đã thêm.
function autoLinkStage(calendarId, tasks, opts = {}) {
  const list = _schedTasks(tasks).filter(t => t.calendarId === calendarId && t.visibleOnBoard !== false && t.startDate);
  const sorted = list.slice().sort((a, b) => (a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : (a.endDate < b.endDate ? -1 : 1)));
  let added = 0;
  sorted.forEach((t, i) => {
    if (i === 0 || (Array.isArray(t.predecessors) && t.predecessors.length)) return;
    if (autoLinkTask(t, tasks, Object.assign({}, opts, { candidateIds: sorted.slice(0, i).map(x => x.id) }))) added++;
  });
  return added;
}

// Xoá các liên kết trỏ tới việc không còn tồn tại
function cleanupDanglingLinks(tasks) {
  const list = _schedTasks(tasks);
  const ids = new Set(list.map(t => t.id));
  list.forEach(t => {
    if (Array.isArray(t.predecessors)) {
      t.predecessors = t.predecessors.filter(l => l && ids.has(l.id) && l.id !== t.id);
    }
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    DEFAULT_DAYS_OFF_CONFIG, getDaysOffConfig, formatDateStr, parseDateStr, getHolidayInfo, getHolidayName,
    getDayOverride, isDateDayOff, calculateTaskDays, countWorkingDays, shiftDateByWorkingDays,
    getSignedWorkingDaysGap, computeEndDateByWorkingDays, getNextWorkingDateStr,
    getLinkTypeOf, getLinkBaseDate, getLinkedStartDate, computeLinkLag, refreshAllLinkLags, dependsOn, addPredecessorLink,
    removePredecessorLink, propagateLinkedTasks, inferMissingPredecessors, cleanupDanglingLinks, autoLinkTask, autoLinkStage
  };
}
