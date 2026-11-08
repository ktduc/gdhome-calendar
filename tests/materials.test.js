const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

test('Chốt mã: phiên bản, quyền Gmail, ảnh riêng và hồ sơ ký bất biến', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'gdhome-materials-'));
  Object.assign(process.env,{ DATA_DIR:dir,GIST_TOKEN:'',GOOGLE_CLIENT_ID:'test-client',SESSION_SECRET:'test-session',
    R2_ACCOUNT_ID:'',R2_ACCESS_KEY_ID:'',R2_SECRET_ACCESS_KEY:'',R2_BUCKET:'' });
  const { server,initStore,signSession,getStore } = require('../server');
  await initStore();
  await new Promise((resolve,reject) => { server.once('error',reject); server.listen(0,'127.0.0.1',resolve); });
  t.after(async () => { await new Promise(resolve => server.close(resolve)); await fs.rm(dir,{ recursive:true,force:true }); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const health = await fetch(origin+'/api/health').then(response => response.json());
  assert.equal(health.ready,true);
  assert.ok(health.uptime >= 0 && health.eventLoopLagMax >= 0);
  assert.ok(health.memoryUsage.rss > 0 && health.memoryUsage.heapUsed > 0);
  const email = 'a@example.com';
  const other = 'b@example.com';
  const signature = { name:'Nguyễn Văn A',strokes:[[[1,2],[30,40],[120,150]]] };
  function token(user) { return signSession({ email:user,exp:Date.now()+3600000 }); }
  async function call(route, body, user = email) {
    const response = await fetch(origin+route,{
      method:body ? 'POST' : 'GET', headers:{
        ...(user ? { Authorization:'Bearer '+token(user) } : {}), ...(body ? { 'Content-Type':'application/json' } : {})
      },body:body ? JSON.stringify(body) : undefined
    });
    return { status:response.status,data:await response.json() };
  }

  const schedule = { _version:7,projectOwners:[{ id:'project',name:'Mộc An' }],calendars:[],tasks:[] };
  await getStore().put(email,schedule);
  for (const route of ['/','/tools','/chot-ma']) assert.equal((await fetch(origin+route)).status,200);
  for (const route of ['/docs/wireframes/index.html','/materials.js','/data.json','/docs/mau-bien-ban.md']) assert.equal((await fetch(origin+route)).status,404);
  assert.equal((await call('/api/materials',null,null)).status,401);
  assert.deepEqual((await call('/api/materials')).data.projects,schedule.projectOwners);
  const file = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEAAUAmJaQAA3AA/v89WAAAAA==','base64');
  const {data:asset,status:uploadStatus} = await call('/api/materials/assets',{ image:file.toString('base64') });
  assert.equal(uploadStatus,200);
  const assetUrl = origin + '/api/materials/assets/' + asset.name;
  assert.equal((await fetch(assetUrl,{ headers:{ Authorization:'Bearer '+token(other) } })).status,404);
  assert.equal((await fetch(assetUrl,{ headers:{ Authorization:'Bearer '+token(email) } })).status,200);

  const sheet = { title:'Bảng mẫu',projectId:'project',meta:{ customer:'Khách A' },groups:[{ id:'g1',name:'Đá',rows:[
    { id:'r1',name:'Mặt bếp',supplier:'Riêng nội bộ',options:[{code:'DA1',supplier:'NCC bí mật',price:'1000000',images:[asset.name]},{code:'DA2'},{}],chosen:null }
  ] }] };
  const requests = await Promise.all([call('/api/materials',{_version:0,sheet}),call('/api/materials',{_version:0,sheet})]);
  assert.deepEqual(requests.map(result => result.status).sort(),[200,409]);
  const saved = requests.find(result => result.status === 200).data;
  const endpoint = '/api/materials/sheets/' + saved.sheet.id + '/review';
  assert.equal((await call(endpoint,null,other)).status,404);
  const issued = await call(endpoint,{ _version:1,action:'publish' });
  assert.equal(issued.status,200);
  assert.equal((await fetch(origin+issued.data.path)).status,200);
  const publicApi = issued.data.path.replace('/duyet/','/api/review/');
  const view = await call(publicApi,null,null);
  const row = view.data.sheet.groups[0].rows[0];
  assert.equal(row.supplier,undefined);
  assert.equal(row.options[0].supplier,undefined);
  assert.equal(row.options[0].price,undefined);
  assert.equal((await fetch(origin+publicApi+'/assets/'+asset.name)).status,200);
  assert.equal((await fetch(origin+publicApi+'/assets/'+'a'.repeat(64)+'.webp')).status,404);
  assert.equal((await call(publicApi+'/sign',{ ...signature,accepted:true,choices:{} },null)).status,400);
  const signed = await call(publicApi+'/sign',{ ...signature,accepted:true,choices:{ r1:1 } },null);
  assert.equal(signed.status,200);
  assert.equal(signed.data.customer.expiresAt-signed.data.customer.at,48*3600000);
  assert.equal((await call(publicApi+'/sign',{ ...signature,accepted:true,choices:{ r1:0 } },null)).status,409);
  const company = await call(endpoint,{ _version:signed.data._version,revisionId:view.data.id,action:'company',...signature,name:'Đại diện GD HOME' });
  assert.equal(company.status,200);
  const change = await call(publicApi+'/change',{ reason:'Muốn đổi màu' },null);
  assert.equal(change.status,200);
  assert.equal(change.data.company.name,'Đại diện GD HOME');
  assert.equal(change.data.customer.choices.r1,1);
  const drafts = await call('/api/materials');
  assert.equal(drafts.data.sheets[0].groups[0].rows[0].decision,'changed');
  const removingSignedRow = structuredClone(drafts.data.sheets[0]);
  removingSignedRow.groups[0].rows = [];
  const removed = await call('/api/materials',{ _version:drafts.data._version,sheet:removingSignedRow });
  assert.equal(removed.status,409);
  assert.match(removed.data.message,/đã ký/);
  assert.equal((await call('/api/materials')).data.sheets[0].groups[0].rows[0].id,'r1');
  assert.deepEqual(await getStore().get(email),schedule);
  assert.equal((await call('/api/projects',null,null)).status,401);
  assert.equal((await call('/api/projects',{projectId:'project',profile:{customer:'Sai tài khoản'}},other)).status,404);
  const profile = await call('/api/projects',{projectId:'project',profile:{customer:'Khách mới',address:'Hà Nội'}});
  assert.equal(profile.status,200);
  assert.equal((await call('/api/schedule')).data.data.projectOwners[0].profile.customer,'Khách mới');
  assert.equal((await call('/api/materials')).data.profiles.project.address,'Hà Nội');
  assert.equal((await call('/api/schedule',{_baseVersion:7,tasks:[]})).status,409);
  assert.equal((await call(publicApi,null,null)).data.sheet.meta.customer,'Khách A');
  assert.equal((await call(endpoint,{ _version:change.data._version,revisionId:view.data.id,action:'revoke' })).status,200);
  assert.equal((await call(publicApi,null,null)).status,410);

  await t.test('Xoá bản nháp theo phiên bản, lưu trữ bảng đã ký và khôi phục',async () => {
    const current = (await call('/api/materials')).data;
    const otherFile = Buffer.from(file);
    otherFile[otherFile.length-1] ^= 1;
    const orphan = (await call('/api/materials/assets',{image:otherFile.toString('base64')})).data.name;
    const draft = structuredClone(sheet);
    draft.title = 'Bản nháp được xoá';
    draft.groups[0].rows[0].render = [{full:orphan,thumb:asset.name}];
    const created = await call('/api/materials',{_version:current._version,sheet:draft});
    assert.equal(created.status,200);
    const draftId = created.data.sheet.id;
    const route = id => '/api/materials/sheets/'+id+'/lifecycle';
    const remove = {action:'remove',title:draft.title,_version:created.data._version};
    assert.equal((await call(route(draftId),remove,null)).status,401);
    assert.equal((await call(route(draftId),{...remove,_version:0},other)).status,404);
    assert.equal((await call(route(draftId),{...remove,_version:current._version})).status,409);
    assert.equal((await call(route(draftId),{...remove,title:'Sai tên'})).status,400);
    const deleted = await call(route(draftId),remove);
    assert.equal(deleted.status,200);
    assert.equal(deleted.data.outcome,'deleted');
    const {MaterialStore} = require('../materials');
    const repo = new MaterialStore(getStore(),email);
    const afterDelete = await repo.get();
    assert.equal(afterDelete.sheets.some(entry => entry.id === draftId),false);
    assert.ok(afterDelete.assetCleanupCandidates[orphan]);
    assert.equal(Object.hasOwn(afterDelete.assetCleanupCandidates,asset.name),false,'Ảnh còn trong bản phát hành phải giữ lại');

    const archived = await call(route(saved.sheet.id),{action:'remove',title:sheet.title,_version:deleted.data._version});
    assert.equal(archived.status,200);
    assert.equal(archived.data.outcome,'archived');
    const state = (await call('/api/materials')).data;
    assert.equal(state.sheets.length,0);
    assert.equal(state.archivedSheets[0].id,saved.sheet.id);
    assert.equal((await call('/api/materials',{_version:state._version,sheet:current.sheets[0]})).status,404);
    const history = await call(endpoint);
    assert.equal(history.data.revisions[0].customer.name,signature.name);
    assert.equal(history.data.revisions[0].company.name,'Đại diện GD HOME');
    assert.equal((await call(route(saved.sheet.id),{action:'restore',_version:deleted.data._version})).status,409);
    const restored = await call(route(saved.sheet.id),{action:'restore',_version:state._version});
    assert.equal(restored.status,200);
    assert.equal(restored.data.sheet.id,saved.sheet.id);
    assert.equal(restored.data.sheet.groups[0].rows[0].decision,'changed');
    assert.deepEqual(restored.data.archivedSheets,[]);
  });
});

test('Gist giới hạn mỗi lần gọi 15 giây và thử lại tối đa hai lần',async t => {
  const {GistStore} = require('../server');
  const delays = [];
  const controllers = [];
  t.mock.method(AbortSignal,'timeout',ms => {
    delays.push(ms);
    const controller = new AbortController();
    controllers.push(controller);
    return controller.signal;
  });
  let attempts = 0;
  t.mock.method(globalThis,'fetch',async (_url,options) => {
    assert.equal(options.signal,controllers.at(-1).signal);
    attempts++;
    if (attempts === 1) {
      controllers.at(-1).abort(new DOMException('Hết hạn','TimeoutError'));
      throw options.signal.reason;
    }
    if (attempts === 2) return new Response('Tạm lỗi',{status:503});
    return new Response(JSON.stringify({files:{}}));
  });
  const store = new GistStore('test','example',{});
  assert.deepEqual(await store.api('GET','/gists/example'),{files:{}});
  assert.deepEqual(delays,[15000,15000,15000]);
});

test('Gist dừng sau ba lần lỗi và không lặp tạo Gist khi không chắc kết quả',async t => {
  const {GistStore} = require('../server');
  const store = new GistStore('test','example',{});
  const fetch = t.mock.method(globalThis,'fetch',async () => { throw new TypeError('Kết nối đứt'); });
  await assert.rejects(store.api('PATCH','/gists/example',{files:{}}),/Kết nối đứt/);
  assert.equal(fetch.mock.callCount(),3);
  await assert.rejects(store.api('POST','/gists',{files:{}}),/Kết nối đứt/);
  assert.equal(fetch.mock.callCount(),4);
  await assert.rejects(store.api('GET','/gists/example',undefined,performance.now()-1),/Hết thời gian/);
  assert.equal(fetch.mock.callCount(),4);
});
