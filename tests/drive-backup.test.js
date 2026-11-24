const {test} = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {createWriteStream} = require('node:fs');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const {pipeline} = require('node:stream/promises');
const {gunzipSync} = require('node:zlib');
const {createSnapshot,restoreSnapshot} = require('../backup-snapshot');
const {driveBackup} = require('../drive-backup');
const {MaterialStore} = require('../materials');
const {ProjectHubStore} = require('../project-hub');
const {libraryKey} = require('../shared-library');

function memoryStore(entries = []) {
  const values = new Map(entries);
  return {values,get:async key => structuredClone(values.get(key) ?? null),
    put:async (key,data) => values.set(key,structuredClone(data))};
}
const account = 'gdhome@example.com';
const nameFor = (buffer,extension) => createHash('sha256').update(buffer).digest('hex')+'.'+extension;

test('Khôi phục bản sao đúng tài khoản, kèm ảnh, PDF và lịch sử bản phát hành',async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'gdhome-drive-test-'));
  const archive = path.join(dir,'backup.ndjson.gz');
  const truncated = path.join(dir,'truncated.ndjson.gz');
  t.after(async () => {
    await fs.rm(archive,{force:true});
    await fs.rm(truncated,{force:true});
    await fs.rmdir(dir);
  });
  const photo = Buffer.from('Ảnh thư viện'), pdf = Buffer.from('%PDF-1.7\nFile dự án');
  const imageName = nameFor(photo,'webp'), pdfName = nameFor(pdf,'pdf');
  const materialKey = new MaterialStore(null,account).key;
  const projectKey = new ProjectHubStore(null,account).key;
  const source = memoryStore([
    [account,{_version:2,tasks:[{title:'Lắp đặt'}]}],
    [materialKey,{archiveCount:1,sheets:[]}],
    [materialKey+'-rev',{entries:[{type:'revision',value:{id:'rev',full:imageName}}]}],
    [libraryKey(account),{items:[{name:'Mẫu thư viện',full:imageName}]}],
    [projectKey,{projects:{p1:{documents:[{assetKey:pdfName},{assetKey:'render-'+imageName}]}}}],
    ['someone@example.com',{tasks:[{title:'Lịch người khác'}]}]
  ]);
  const payload = new Map([['material/'+imageName,{buf:photo,mime:'image/webp'}],
    ['project/'+pdfName,{buf:pdf,mime:'application/pdf'}]]);
  const {stream,summary} = createSnapshot({store:source,account,assets:{read:async (kind,name) => payload.get(kind+'/'+name)}});
  await pipeline(stream,createWriteStream(archive));
  assert.deepEqual(summary,{files:2,missing:[]});

  const current = memoryStore([[account,{_version:7} ],['someone@example.com',{keep:true}]]);
  const recovered = new Map(), assets = {write:async (kind,name,buf) => recovered.set(kind+'/'+name,buf)};
  const options = {store:current,account,assets};
  await assert.rejects(restoreSnapshot(archive,{...options,account:'someone@example.com'}),/tài khoản khác/);
  const bytes = await fs.readFile(archive);
  await fs.writeFile(truncated,bytes.subarray(0,-8));
  await assert.rejects(restoreSnapshot(truncated,options));
  assert.equal((await restoreSnapshot(archive,options)).files,2);
  assert.equal(recovered.size,0);
  await restoreSnapshot(archive,{...options,apply:true});
  assert.deepEqual(recovered,new Map([...payload].map(([key,value]) => [key,value.buf])));
  assert.deepEqual((await current.get(account)).tasks,[{title:'Lắp đặt'}]);
  assert.equal((await current.get(account))._version,8);
  assert.equal((await current.get(materialKey+'-rev')).entries[0].value.id,'rev');
  assert.deepEqual(await current.get('someone@example.com'),{keep:true});
});

test('OAuth Drive, sao lưu theo ngày Việt Nam và dừng khi hủy liên kết',async () => {
  const store = memoryStore([[account,{tasks:[{title:'Lắp đặt'}]}]]);
  let now = new Date('2026-11-08T20:00:00Z'), folderCreated = 0, profileEmail = 'other@example.com', revoked = false;
  const uploads = [];
  const backup = driveBackup({secret:'test-secret',dataDir:os.tmpdir(),clock:() => now,env:{
    GOOGLE_DRIVE_CLIENT_ID:'test-id',GOOGLE_DRIVE_CLIENT_SECRET:'test-secret',
    GOOGLE_DRIVE_REDIRECT_URI:'https://gdhome.test/api/drive-backup/callback'
  },fetchFn:async (url,options) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      if (options.body.get('grant_type') === 'authorization_code') assert.ok(options.body.get('code_verifier'));
      else assert.equal(options.body.get('refresh_token'),'private-refresh-token');
      return Response.json({access_token:'private-access-token',refresh_token:'private-refresh-token'});
    }
    if (url === 'https://oauth2.googleapis.com/revoke') {
      assert.equal(options.body.get('token'),'private-refresh-token');
      revoked = true;
      return new Response();
    }
    if (url.includes('/v1/userinfo')) return Response.json({email_verified:true,email:profileEmail});
    if (url.includes('/drive/v3/files?spaces=')) return Response.json({files:[]});
    if (url.includes('/upload/drive/v3/files?uploadType=')) {
      assert.deepEqual(JSON.parse(options.body).parents,['private-folder']);
      return new Response('',{headers:{Location:'https://www.googleapis.com/drive-upload-session'}});
    }
    if (url.endsWith('/drive-upload-session')) {
      assert.equal(options.headers['Content-Range'],'bytes 0-'+(options.body.length-1)+'/'+options.body.length);
      const entries = gunzipSync(options.body).toString('utf8').trim().split('\n').map(JSON.parse);
      uploads.push(entries[0].records.schedule.tasks[0].title);
      assert.equal(entries.at(-1).end,true);
      return Response.json({id:'backup-'+uploads.length});
    }
    if (url.endsWith('/drive/v3/files?fields=id')) {
      assert.equal(options.method,'POST');
      folderCreated++;
      return Response.json({id:'private-folder'});
    }
    throw new Error('Unexpected URL '+url);
  }});
  const consent = () => new URL(backup.connect(account)).searchParams;
  const parameters = query => new URLSearchParams({state:query.get('state'),code:'test-code'});
  assert.equal(await backup.callback(store,parameters(consent())),false);
  assert.equal(folderCreated,0);
  profileEmail = account;
  const query = consent();
  assert.equal(query.get('access_type'),'offline');
  assert.match(query.get('scope'),/drive\.file/);
  assert.equal(await backup.callback(store,parameters(query)),true);
  assert.equal(await backup.callback(store,parameters(query)),false);
  while ((await backup.status(store,account)).busy) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(uploads,['Lắp đặt']);
  assert.equal(folderCreated,1);
  assert.match((await backup.status(store,account)).folderUrl,/private-folder$/);
  assert.equal((await backup.status(store,'other@example.com')).linked,false);
  assert.ok(!JSON.stringify([...store.values]).includes('private-refresh-token'));
  await backup.tick(store);
  assert.equal(uploads.length,1);
  now = new Date('2026-11-09T18:00:00Z');
  await backup.tick(store);
  assert.equal(uploads.length,1);
  now = new Date('2026-11-09T19:30:00Z');
  await backup.tick(store);
  assert.equal(uploads.length,2);
  await backup.unlink(store,account);
  assert.equal(revoked,true);
  now = new Date('2026-11-10T20:00:00Z');
  await backup.tick(store);
  assert.equal(uploads.length,2);
  assert.equal((await backup.status(store,account)).linked,false);
});

test('Danh sách và khôi phục từ Drive: chặn tệp ngoài thư mục, sao lưu bản hiện tại trước khi ghi đè',async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(),'gdhome-drive-restore-'));
  t.after(() => fs.rm(dir,{recursive:true,force:true}));
  const chunks = [];
  const old = createSnapshot({store:memoryStore([[account,{_version:1,tasks:[{title:'Bản cũ'}]}]]),account,assets:{read:async () => null}});
  for await (const chunk of old.stream) chunks.push(chunk);
  const oldArchive = Buffer.concat(chunks);
  const store = memoryStore([[account,{_version:5,tasks:[{title:'Hiện tại'}]}]]);
  const events = [];
  const uploads = [];
  const backup = driveBackup({secret:'test-secret',dataDir:dir,env:{
    GOOGLE_DRIVE_CLIENT_ID:'test-id',GOOGLE_DRIVE_CLIENT_SECRET:'test-secret',
    GOOGLE_DRIVE_REDIRECT_URI:'https://gdhome.test/api/drive-backup/callback'
  },fetchFn:async (url,options = {}) => {
    if (url === 'https://oauth2.googleapis.com/token') {
      return Response.json({access_token:'access',refresh_token:'refresh'});
    }
    if (url.includes('/v1/userinfo')) return Response.json({email_verified:true,email:account});
    if (url.includes('/drive/v3/files?spaces=') && url.includes('appProperties')) return Response.json({files:[{id:'folder'}]});
    if (url.includes('/drive/v3/files?spaces=')) {
      const q = new URL(url).searchParams;
      assert.equal(q.get('q'),"'folder' in parents and trashed=false");
      assert.equal(q.get('orderBy'),'createdTime desc');
      return Response.json({files:[{id:'good-file',name:'GDHOME-a',createdTime:'2026-11-01T00:00:00Z',size:'42'}]});
    }
    if (url.includes('/upload/drive/v3/files?uploadType=')) {
      uploads.push(JSON.parse(options.body).name);
      events.push('upload');
      return new Response('',{headers:{Location:'https://www.googleapis.com/drive-upload-session'}});
    }
    if (url.endsWith('/drive-upload-session')) return Response.json({id:'safety'});
    if (url.includes('/files/outside-file?')) return Response.json({id:'outside-file',parents:['other-folder']});
    if (url.includes('/files/good-file?alt=media')) return new Response(oldArchive);
    if (url.includes('/files/good-file?')) return Response.json({id:'good-file',parents:['folder']});
    throw new Error('Unexpected URL '+url);
  }});
  const query = new URL(backup.connect(account)).searchParams;
  assert.equal(await backup.callback(store,new URLSearchParams({state:query.get('state'),code:'c'})),true);
  while ((await backup.status(store,account)).busy) await new Promise(resolve => setImmediate(resolve));
  uploads.length = 0; events.length = 0;

  assert.deepEqual(await backup.list(store,account),[{id:'good-file',name:'GDHOME-a',createdTime:'2026-11-01T00:00:00Z',size:42}]);
  await assert.rejects(backup.restore(store,account,'outside-file'),{status:404});
  assert.equal(uploads.length,0);
  assert.equal((await store.get(account)).tasks[0].title,'Hiện tại');
  await assert.rejects(backup.restore(store,'other@example.com','good-file'),{status:400});

  const result = await backup.restore(store,account,'good-file');
  assert.equal(result.files,0);
  assert.equal(uploads.length,1);
  assert.match(uploads[0],/truoc-khoi-phuc/);
  assert.equal((await store.get(account)).tasks[0].title,'Bản cũ');
  assert.deepEqual((await fs.readdir(dir)).filter(name => name.startsWith('restore-')),[]);
});
