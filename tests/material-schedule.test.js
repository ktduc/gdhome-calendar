const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dueDate,scheduleInfo } = require('../material-schedule');

test('Hạn chốt dùng ngày lễ, nghỉ riêng, nửa thứ Bảy và ngày thực tế', () => {
  const config = { holidays:true, sunday:true, saturdayHalf:true,overrides:{ '2026-11-23':'off' } };
  assert.equal(dueDate('2026-11-25',1,'work',config),'2026-11-20');
  assert.equal(dueDate('2026-11-25',1,'actual',config),'2026-11-24');
  assert.equal(dueDate('2026-11-25',0,'work',config),'2026-11-25');
  assert.equal(dueDate('2026-02-30',3,'work',config),'');
});
test('✓ chỉ khi mọi nhóm cùng công việc đã chốt, liên kết lạc dự án có cảnh báo', () => {
  const schedule = { calendars:[{id:'c1',ownerId:'p1'}],tasks:[{id:'t1',calendarId:'c1',startDate:'2026-11-26'}] };
  const group = {id:'g1',taskId:'t1',leadDays:1,rows:[{chosen:0,decision:'chosen'}]};
  const s1 = {id:'s1',projectId:'p1',groups:[group,{...group,id:'g2',rows:[{chosen:0,decision:'changed'}]}]};
  const s2 = {id:'s2',projectId:'p2',groups:[group]};
  const data = {sheets:[s1,s2]};
  const info = scheduleInfo(data,schedule);
  assert.deepEqual(info.badges,[{taskId:'t1',projectId:'p1',done:false,total:2}]);
  assert.equal(info.groups.s2.g1.status,'missing');
  s1.groups[1].rows[0].decision = 'chosen';
  assert.equal(scheduleInfo(data,schedule).badges[0].done,true);
});
