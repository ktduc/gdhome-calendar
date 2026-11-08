function applyMaterialTaskLinks(updates) {
  for (const {group,taskId,score} of updates) {
    group.taskId = taskId;
    group.taskLinkMode = 'auto';
    group.taskLinkScore = score;
    if (!taskId) group.calendarId = '';
  }
}

function materialTaskUpdates(current,groups = current.groups,refresh = false) {
  return MaterialTaskMatcher.suggestions(groups,materials.schedule.tasks,current.projectId,refresh);
}

async function relinkMaterialTasks(button) {
  const current = sheet;
  button.disabled = true;
  try {
    if (materialGuest) materials.schedule = guestMaterialSchedule();
    else {
      const latest = await request('/api/materials',{signal:AbortSignal.timeout(12000)});
      materials.schedule = latest.schedule;
    }
    if (sheet !== current) return;
    const updates = materialTaskUpdates(current,current.groups,true);
    if (updates.length) modify(() => applyMaterialTaskLinks(updates));
    else renderEditor();
    const linked = updates.filter(update => update.taskId).length;
    const cleared = updates.length-linked;
    say(linked || cleared ? 'Đã liên kết ' + linked + ' nhóm, bỏ ' + cleared + ' liên kết tự động không còn phù hợp.' :
      'Không có liên kết tự động cần cập nhật.');
  } finally { button.disabled = false; }
}

function deadlineFor(group) {
  const task = materials.schedule.tasks.find(task => task.id === group.taskId && task.projectId === sheet.projectId);
  if (group.taskId && !task) return { due:group.due, status:'missing' };
  const due = task ? materialDueDate(task.start,group.leadDays,group.dayMode,materials.schedule.daysOffConfig) || group.due : group.due;
  const pending = group.rows.some(row => row.chosen == null || row.decision !== 'chosen');
  const status = !pending || !due ? '' : due < materials.schedule.today ? 'late' : due <= materials.schedule.soonDate ? 'soon' : '';
  return { due,status };
}
function scheduleControls(group) {
  const {due,status} = deadlineFor(group);
  const tasks = materials.schedule.tasks.filter(task => task.projectId === sheet.projectId);
  return '<label>Việc Tiến độ <select data-field="taskId">' + option('','Không liên kết',group.taskId) +
    (status === 'missing' ? option(group.taskId,'Cần liên kết lại',group.taskId) : '') +
    tasks.map(task => option(task.id,[task.stage,task.title,task.start].filter(Boolean).join(' · '),group.taskId)).join('') +
    '</select></label>' + (group.taskId && group.taskLinkMode === 'auto' && status !== 'missing' ?
      ' <span class="deadline material-auto-link">🔗 tự động (độ khớp ' + html(group.taskLinkScore) + '%)</span>' : '') + (group.taskId ? ' <label>Đặt trước <input type="number" data-field="leadDays" min="0" max="365" value="' + html(group.leadDays || 0) +
      '"></label> <select data-field="dayMode" aria-label="Cách tính ngày">' + option('work','Ngày làm việc',group.dayMode) + option('actual','Ngày thực tế',group.dayMode) + '</select>' : '') +
    (due ? ' <span class="deadline ' + html(status) + '">Hạn chốt ' + html(due) + '</span>' : '') +
    (status ? ' <span class="deadline ' + html(status) + '">⚠ ' + ({late:'Quá hạn',soon:'Sắp tới hạn',missing:'Cần liên kết lại'})[status] + '</span>' : '');
}
