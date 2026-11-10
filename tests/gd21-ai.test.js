const {test} = require('node:test');
const assert = require('node:assert/strict');
const {AI_TIMING,setAiTiming,encrypt,handleIntegrations,callWithFallback,callGemini} = require('../integrations');
const {globalJobManager} = require('../project-hub');
const pagePayload = number => ({number,image:'data:image/jpeg;base64,YQ=='});
const quota = id => ({error:{status:'RESOURCE_EXHAUSTED',details:[{violations:[{quotaId:id}]}]}});
const response = value => Response.json({candidates:[{content:{parts:[{text:JSON.stringify(value)}]}}]});

test('Gemini tôn trọng RetryInfo và tự chuyển khóa khi hết lượt ngày', async t => {
  const original = global.fetch, timing = {...AI_TIMING};
  t.after(() => { global.fetch = original; setAiTiming(timing); });
  setAiTiming({retryDelaysMs:[0],rateWindowMs:1});
  const keys = [], times = [];
  global.fetch = async (_url,options) => {
    keys.push(options.headers['x-goog-api-key']);
    times.push(performance.now());
    if (keys.length === 1) return Response.json({error:{details:[{'@type':'type.googleapis.com/google.rpc.RetryInfo',retryDelay:'0.03s'}]}},{status:503});
    if (keys.length === 2) return Response.json(quota('GenerateRequestsPerDayPerProjectPerModel'),{status:429});
    return response({items:[]});
  };
  const ai = {provider:'gemini',key:'gd21-primary',backupKey:'gd21-secondary',model:'gemini-2.5-flash'};
  await callWithFallback(ai,ai.model,callGemini,[],[],'Test quota',undefined,{catalogue:true});
  await callWithFallback(ai,ai.model,callGemini,[],[],'Test quota again',undefined,{catalogue:true});
  assert.deepEqual(keys,['gd21-primary','gd21-primary','gd21-secondary','gd21-secondary']);
  assert.ok(times[1]-times[0] >= 28);
});

test('Catalogue dừng khi hết lượt ngày, tiếp tục cùng job và giữ các trang đã đọc', async t => {
  const original = global.fetch, timing = {...AI_TIMING};
  t.after(() => { global.fetch = original; setAiTiming(timing); });
  setAiTiming({rateWindowMs:1});
  const calls = [];
  let blocked = true;
  global.fetch = async (_url,options) => {
    const {pages} = JSON.parse(JSON.parse(options.body).contents[0].parts.at(-1).text);
    const number = pages[0].number;
    calls.push(number);
    if (number === 2 && blocked) return Response.json(quota('GenerateRequestsPerDayPerProjectPerModel'),{status:429});
    return response({items:[{page:number,code:'MS '+number,bbox:{x:.1,y:.1,w:.2,h:.2}}]});
  };
  const dataKey = 'gd21@example.com';
  const store = {get:async () => ({secrets:encrypt({aiProvider:'gemini',aiKey:'gd21-only',aiModel:'gemini-2.5-flash'})})};
  async function api(path,body,account = dataKey) {
    let result;
    await handleIntegrations({method:body ? 'POST' : 'GET',url:path},{},path,{
      dataKey:account,store,readJsonBody:async () => body,sendJson:(_res,_status,json) => { result = json; }
    });
    return result;
  }
  const {job:{id}} = await api('/api/ai/jobs/start',{kind:'catalogue',pages:[1,2,3].map(pagePayload)});
  t.after(() => globalJobManager.jobs.delete(id));
  const job = globalJobManager.getJob(id,dataKey);
  async function until(status) {
    for (let i=0;i<100 && job.status === 'running';i++) await new Promise(resolve => setTimeout(resolve,2));
    assert.equal(job.status,status);
  }
  await until('paused');
  assert.deepEqual(job.result.completedPages,[1]);
  assert.match(job.step,/1\/3 trang/);
  await assert.rejects(api('/api/ai/jobs/resume',{jobId:id},'another@example.com'),{status:404});
  blocked = false;
  await api('/api/ai/jobs/resume',{jobId:id});
  await until('done');
  assert.deepEqual(calls,[1,2,2,3]);
  assert.deepEqual(job.result.items.map(item => item.page),[1,2,3]);
  assert.equal((await api('/api/integrations/settings')).aiUsage.today,4);
});
