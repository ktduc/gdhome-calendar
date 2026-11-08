const {test} = require('node:test');
const assert = require('node:assert/strict');
const {find,suggestions} = require('../material-task-matcher');

const task = (id,title,start = '2026-11-09',projectId = 'p1',stage = '') => ({id,title,start,projectId,stage});

test('Việc Tiến độ khớp vật liệu theo dấu, từ đồng nghĩa và loại việc',() => {
  const pairs = [
    ['SƠN TƯỜNG','Thi công sơn bả'],['Gạch ốp lát','Lát gạch phòng khách'],
    ['Đá','Lắp mặt đá bếp'],['Tủ gỗ','Sản xuất đồ gỗ nội thất'],
    ['Rèm','Lắp rèm phòng ngủ'],['Đèn và công tắc','Thi công điện']
  ];
  for (const [group,title] of pairs) assert.ok(find(group,[task('match',title)],'p1')?.score >= 72,group);
  assert.equal(find('Sơn tường',[task('wrong','Sơn PU cho đồ gỗ')],'p1'),null);
  assert.equal(find('Đá',[task('wrong','Đã hoàn thành gạch')],'p1'),null);
  assert.equal(find('Gạch',[task('stage','Lắp vật tư','2026-11-09','p1','Ốp lát')],'p1').task.id,'stage');
  assert.equal(find('Nhóm mới',[task('wrong','Thi công nội thất')],'p1'),null);
});

test('Việc Tiến độ ưu tiên điểm rồi ngày, giới hạn trong dự án và giữ liên kết tay',() => {
  const tasks = [
    task('outside','Sơn tường','2026-11-01','p2'),
    task('early-alias','Sơn bả','2026-11-02'),
    task('late','Sơn tường','2026-11-20'),
    task('winner','Sơn tường','2026-11-10'),
    task('no-date','Sơn tường','')
  ];
  assert.equal(find('Sơn tường',tasks,'p1').task.id,'winner');
  const groups = [
    {id:'old',name:'Sơn tường',taskId:'late'},
    {id:'clear',name:'Sơn tường',taskId:'',taskLinkMode:'manual'},
    {id:'auto',name:'Sơn tường',taskId:'early-alias',taskLinkMode:'auto',taskLinkScore:80},
    {id:'new',name:'Sơn tường'}
  ];
  assert.deepEqual(suggestions(groups,tasks,'p1').map(match => match.group.id),['new']);
  assert.deepEqual(suggestions(groups,tasks,'p1',true).map(match => [match.group.id,match.taskId]),[['auto','winner'],['new','winner']]);
});
