const { formatDateStr,parseDateStr,materialDueDate,DEFAULT_DAYS_OFF_CONFIG } = require('./scheduler');
const { getVnHolidayInfo } = require('./holidays-data');

const vnToday = () => new Intl.DateTimeFormat('en-CA',{ timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit' }).format(new Date());
const validDate = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && formatDateStr(parseDateStr(value)) === value;
const chosen = row => row.chosen != null && row.decision === 'chosen';

function dueDate(start,days,mode,config) { return materialDueDate(start,days,mode,config,getVnHolidayInfo); }

function tasksFor(schedule) {
  const calendars = new Map((schedule.calendars || []).map(cal => [cal.id,cal]));
  return (schedule.tasks || []).filter(task => calendars.has(task.calendarId) && task.visibleOnBoard !== false)
    .map(task => ({ id:task.id, title:task.title, start:task.startDate, projectId:calendars.get(task.calendarId).ownerId,
      calendarId:task.calendarId, stage:calendars.get(task.calendarId).name }));
}

function scheduleInfo(data,schedule) {
  const today = vnToday();
  const soon = parseDateStr(today);
  soon.setDate(soon.getDate()+3);
  const soonDate = formatDateStr(soon);
  const tasks = tasksFor(schedule);
  const byId = new Map(tasks.map(task => [task.id,task]));
  const badges = new Map();
  const groups = {};
  for (const sheet of data.sheets) for (const group of sheet.groups) {
    const task = byId.get(group.taskId);
    const match = task && task.projectId === sheet.projectId ? task : null;
    const due = match ? dueDate(match.start,group.leadDays || 0,group.dayMode,schedule.daysOffConfig) : validDate(group.due) ? group.due : '';
    const complete = group.rows.length > 0 && group.rows.every(chosen);
    const pending = !complete && group.rows.length > 0;
    const status = group.taskId && !match ? 'missing' : !pending || !due ? '' : due < today ? 'late' : due <= soonDate ? 'soon' : '';
    (groups[sheet.id] ||= {})[group.id] = { due, status };
    if (!match || !group.rows.length) continue;
    const badge = badges.get(match.id) || { taskId:match.id, projectId:sheet.projectId, done:true, total:0 };
    badge.done &&= complete;
    badge.total++;
    badges.set(match.id,badge);
  }
  return { groups,badges:[...badges.values()],tasks, daysOffConfig:schedule.daysOffConfig || DEFAULT_DAYS_OFF_CONFIG,today,soonDate };
}

module.exports = { dueDate,tasksFor,scheduleInfo };
