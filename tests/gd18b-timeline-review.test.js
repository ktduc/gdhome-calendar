const {test} = require('node:test');
const assert = require('node:assert/strict');
const {setTimeout:delay} = require('node:timers/promises');
const {handleIntegrations,encrypt} = require('../integrations');
const {MaterialStore} = require('../materials');
const {globalJobManager} = require('../project-hub');

const route = '/api/ai/jobs/start';
const schedule = {
  _version:7,
  projectOwners:[{id:'p1',name:'Căn hộ mẫu'},{id:'p2',name:'Dự án khác'}],
  daysOffConfig:{sunday:true,saturdayHalf:true},
  calendars:[{id:'stage-1',ownerId:'p1',name:'Thi công'},{id:'stage-2',ownerId:'p1',name:'Bàn giao'},{id:'foreign',ownerId:'p2',name:'Khác'}],
  tasks:[
    {id:'pipes',calendarId:'stage-1',title:'Điện nước âm',startDate:'2026-11-07',endDate:'2026-11-09',visibleOnBoard:false},
    {id:'paint',calendarId:'stage-1',title:'Sơn bả',startDate:'2026-11-09',endDate:'2026-11-10',predecessors:[{id:'pipes',type:'FS',lag:0}]},
    {id:'foreign-task',calendarId:'foreign',title:'Việc riêng'}
  ]
};
function harness() {
  const dataKey = 'timeline-review-test';
  const storage = {
    get:async key => key === dataKey ? schedule : key === new MaterialStore(null,dataKey).key ? {sheets:[
      {id:'s1',projectId:'p1',title:'Bảng sơn',groups:[{taskId:'paint',name:'Màu sơn',leadDays:2,rows:[{chosen:null}]}]},
      {id:'s2',projectId:'p2',title:'Bảng riêng',groups:[{taskId:'paint',name:'Không đưa vào prompt'}]}
    ]} : {secrets:encrypt({aiProvider:'gemini',aiKey:'fixture-key',aiModel:'fixture-model'})}
  };
  const start = async body => {
    let response;
    await handleIntegrations({method:'POST'},null,route,{
      dataKey,store:storage,readJsonBody:async () => body,
      sendJson:(_res,status,value) => { assert.equal(status,200); response=value.job; }
    });
    return response;
  };
  return {dataKey,start};
}

test('Soát Lịch chạy nền, lấy đủ giai đoạn và công việc thuộc dự án, kiểm tra đầu ra',async t => {
  const {dataKey,start} = harness();
  let request;
  let unblock;
  const gate = new Promise(resolve => { unblock=resolve; });
  t.mock.method(global,'fetch',async (url,options) => {
    assert.match(url,/generativelanguage\.googleapis\.com/);
    request = JSON.parse(options.body);
    await gate;
    return Response.json({candidates:[{content:{parts:[{text:JSON.stringify({findings:[
      {category:'sequence',severity:'high',title:'Kiểm tra điện nước',action:'note',taskId:'paint',calendarId:'foreign'},
      {category:'missing',severity:'medium',title:'Nghiệm thu',action:'task',calendarId:'stage-2',startDate:'2026-11-31'},
      {category:'preparation',severity:'info',title:'Đặt đá',action:'task',calendarId:'stage-1'},
      {category:'risk',severity:'unknown',title:'Ngày nghỉ',action:'task',calendarId:'stage-1'},
      {category:'invalid',title:'Bỏ qua'},null
    ]})}]}}]});
  });
  const running = await start({kind:'review-timeline',projectId:'p1',projectType:'chung cư',version:7,tasks:[{title:'Giả mạo'}]});
  const job = globalJobManager.getJob(running.id,dataKey);
  t.after(() => { unblock(); globalJobManager.jobs.delete(running.id); });
  assert.equal(running.status,'running');
  assert.equal(globalJobManager.getJob(running.id,'other-account'),null);
  unblock();
  for (let i=0; i<50 && job.status==='running'; i++) await delay(10);
  assert.equal(job.status,'done',job.error);
  const input = JSON.parse(request.contents[0].parts[0].text);
  assert.deepEqual(input.stages.map(stage => stage.id),['stage-1','stage-2']);
  assert.deepEqual(input.tasks.map(task => task.id),['pipes','paint']);
  assert.equal(input.tasks[0].workDays,1.5);
  assert.equal(input.tasks[1].materials[0].pending,1);
  assert.deepEqual(input.tasks[1].predecessors,[{id:'pipes',type:'FS',lag:0}]);
  assert.equal(input.projectType,'chung cư');
  assert.equal(job.result.findings[1].startDate,null);
  assert.match(request.systemInstruction.parts[0].text,/đường găng/);
  assert.deepEqual(job.result.findings.map(item => [item.category,item.severity,item.action,item.calendarId]),[
    ['sequence','high','note','stage-1'],['missing','medium','task','stage-2'],
    ['preparation','info','task','stage-1'],['risk','info','task','stage-1']
  ]);
});

test('Soát Lịch từ chối dự án ngoài tài khoản và phiên bản tiến độ cũ',async () => {
  const {start} = harness();
  await assert.rejects(start({kind:'review-timeline',projectId:'unknown'}),{status:404});
  await assert.rejects(start({kind:'review-timeline',projectId:'p1',version:6}),{status:409});
});
