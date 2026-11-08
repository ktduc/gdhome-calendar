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
});
