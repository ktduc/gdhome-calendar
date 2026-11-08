const MaterialTaskMatcher = (() => {
  const aliases = [
    ['son-go',/son (go|pu|2k)|phu pu/],
    ['son-tuong',/son (ba|tuong|tran)|ba tuong|bot ba/],
    ['son',/\bson\b/],
    ['phao',/\bphao\b|chi tuong/],
    ['san-go',/san go|xong ca|san laminate/],
    ['san-nhua',/san nhua|\bspc\b|\blvt\b|vinyl/],
    ['da',/\bda\b(?! boc)|marble|granite|quartz|solid surface/],
    ['gach',/\bgach\b|op lat|lat nen|op tuong|porcelain|ceramic/],
    ['kinh',/\bkinh\b|\bguong\b/],
    ['giay-dan',/giay dan|vai dan tuong|wallpaper/],
    ['rem',/\brem\b|sao go|rem cuon/],
    ['vai',/\bni\b|\bsofa\b|vai boc|da boc|dem boc/],
    ['dien',/\bdien\b|\bden\b|cong tac|o cam|chieu sang|\bled\b/],
    ['ve-sinh',/thiet bi ve sinh|lavabo|bon cau|voi sen|thoat san/],
    ['thiet-bi-bep',/thiet bi bep|bep tu|may hut mui|chau rua|may rua bat/],
    ['go',/\bgo\b|\bmdf\b|melamine|plywood|laminate|\btu (bep|ao|giay|tivi|ruou)\b|^tu$|\b(cat|lap|dong) tu$|san xuat noi that/],
    ['phu-kien',/phu kien|tay nam|ban le|ray truot|ray ngan keo/]
  ];
  const ignored = new Set('thi cong hoan thien lap dat san xuat thi cong hang muc vat lieu nhom mau cho cua va theo'.split(' '));

  function normalize(value) {
    return String(value || '').replace(/(^|\s)đã(?=\s)/giu,'$1').toLowerCase().normalize('NFD')
      .replace(/\p{M}/gu,'').replace(/đ/g,'d').replace(/[^a-z0-9]+/g,' ').trim();
  }
  function signature(value) {
    const name = normalize(value);
    return {name,kind:aliases.find(([,pattern]) => pattern.test(name))?.[0],
      words:[...new Set(name.split(' ').filter(word => word && !ignored.has(word) && !/^\d+$/.test(word)))]};
  }
  function sharesPaintFamily(a,b) {
    return a && b && (a === 'son' && b.startsWith('son-') || b === 'son' && a.startsWith('son-'));
  }
  function score(needle,title,stage) {
    if (!needle.words.length || !title.name) return 0;
    if (needle.name === title.name) return 100;
    const overlap = needle.words.filter(word => title.words.includes(word)).length;
    const coverage = overlap/needle.words.length;
    if (needle.kind && title.kind && needle.kind !== title.kind && !sharesPaintFamily(needle.kind,title.kind)) return 0;
    if (needle.words.length > 1 && (' '+title.name+' ').includes(' '+needle.name+' ')) return 96;
    if (needle.kind && needle.kind === title.kind) return 85+Math.round(9*coverage);
    if (sharesPaintFamily(needle.kind,title.kind)) return 78+Math.round(4*coverage);
    if (overlap >= 2 && coverage >= .6) return 74+Math.round(10*coverage);
    if (needle.kind && !title.kind && needle.kind === stage.kind) return 72;
    return 0;
  }

  function prepare(tasks,projectId) {
    return tasks.filter(task => task.projectId === projectId && task.id).map(task => ({
      task,title:signature(task.title),stage:signature(task.stage),
      start:/^\d{4}-\d{2}-\d{2}$/.test(task.start) ? task.start : '9999-12-31'
    }));
  }
  function best(groupName,candidates) {
    const needle = signature(String(groupName || '').split('(')[0]);
    let match;
    for (const candidate of candidates) {
      const points = score(needle,candidate.title,candidate.stage);
      if (points < 72) continue;
      if (!match || points > match.score || (points === match.score &&
          (candidate.start < match.start || (candidate.start === match.start && candidate.task.id < match.task.id)))) {
        match = {task:candidate.task,score:points,start:candidate.start};
      }
    }
    return match ? {task:match.task,score:match.score} : null;
  }

  function suggestions(groups,tasks,projectId,refresh = false) {
    const candidates = prepare(tasks,projectId);
    return groups.flatMap(group => {
      if (group.taskLinkMode === 'manual' || (group.taskId && (group.taskLinkMode !== 'auto' || !refresh))) return [];
      const match = best(group.name,candidates);
      if (!match) return refresh && group.taskId && group.taskLinkMode === 'auto' ? [{group,taskId:'',score:0}] : [];
      if (group.taskId === match.task.id && group.taskLinkScore === match.score) return [];
      return [{group,taskId:match.task.id,score:match.score}];
    });
  }

  return {find:(groupName,tasks,projectId) => best(groupName,prepare(tasks,projectId)),suggestions};
})();

if (typeof module !== 'undefined') module.exports = MaterialTaskMatcher;
