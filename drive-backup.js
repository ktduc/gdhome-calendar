const crypto = require('node:crypto');
const {createSnapshot} = require('./backup-snapshot');

const storeKey = 'drive-backup-links-v1';
const folderMime = 'application/vnd.google-apps.folder';
const drive = 'https://www.googleapis.com/drive/v3';
const oauthToken = 'https://oauth2.googleapis.com/token';
const folderUrl = id => 'https://drive.google.com/drive/folders/' + encodeURIComponent(id);
const fail = (status,message) => Object.assign(new Error(message),{status});
const calendar = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',
  day:'2-digit',hour:'2-digit',hourCycle:'h23'});
function vietnamDay(now) {
  const {year,month,day,hour} = Object.fromEntries(calendar.formatToParts(now).map(({type,value}) => [type,value]));
  return {date:year+'-'+month+'-'+day,hour:Number(hour)};
}

async function uploadArchive(request,accessToken,folder,name,stream,signal) {
  const init = await request('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id',{
    method:'POST',signal,headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json',
      'X-Upload-Content-Type':'application/gzip'},
    body:JSON.stringify({name,parents:[folder],mimeType:'application/gzip'})
  });
  const location = init.headers.get('location');
  if (!init.ok || !location || new URL(location).origin !== 'https://www.googleapis.com') {
    throw new Error('Drive từ chối tạo tệp sao lưu.');
  }
  const chunkSize = 4*1024*1024;
  let offset = 0, length = 0, buffers = [];
  async function send(bytes,final) {
    const end = offset+bytes.length-1;
    const response = await request(location,{method:'PUT',signal,headers:{
      Authorization:'Bearer '+accessToken,'Content-Type':'application/gzip',
      'Content-Range':'bytes '+offset+'-'+end+'/'+(final ? end+1 : '*')
    },body:bytes});
    if (final) {
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.id) throw new Error('Drive chưa xác nhận bản sao đã hoàn tất.');
      return result.id;
    }
    const range = response.headers.get('range');
    if (response.status !== 308 || (range && range !== 'bytes=0-'+end)) {
      throw new Error('Drive chưa nhận đủ một phần bản sao.');
    }
    offset = end+1;
  }
  for await (const bytes of stream) {
    buffers.push(bytes);
    length += bytes.length;
    if (length <= chunkSize) continue;
    let joined = Buffer.concat(buffers,length);
    while (joined.length > chunkSize) {
      await send(joined.subarray(0,chunkSize),false);
      joined = joined.subarray(chunkSize);
    }
    buffers = [joined];
    length = buffers[0].length;
  }
  return send(Buffer.concat(buffers,length),true);
}

function driveBackup({secret,dataDir,env = process.env,fetchFn = fetch,snapshot = createSnapshot,clock = () => new Date()}) {
  const clientId = env.GOOGLE_DRIVE_CLIENT_ID;
  const clientSecret = env.GOOGLE_DRIVE_CLIENT_SECRET;
  const redirect = env.GOOGLE_DRIVE_REDIRECT_URI;
  const available = !!(clientId && clientSecret && redirect);
  const pending = new Map(), linking = new Map(), jobs = new Map();
  const key = crypto.createHash('sha256').update('gdhome-drive-backup|'+secret).digest();
  let writes = Promise.resolve(), ticking = false;

  function encrypt(token) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm',key,iv);
    const encrypted = Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
    return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64');
  }
  function decrypt(value) {
    const buffer = Buffer.from(value,'base64');
    const cipher = crypto.createDecipheriv('aes-256-gcm',key,buffer.subarray(0,12));
    cipher.setAuthTag(buffer.subarray(12,28));
    return Buffer.concat([cipher.update(buffer.subarray(28)),cipher.final()]).toString('utf8');
  }
  async function request(url,{signal,...options} = {}) {
    const timeout = AbortSignal.timeout(60000);
    return fetchFn(url,{...options,signal:signal ? AbortSignal.any([timeout,signal]) : timeout,redirect:'manual'});
  }
  async function tokens(values,signal) {
    const response = await request(oauthToken,{method:'POST',signal,
      body:new URLSearchParams({client_id:clientId,client_secret:clientSecret,...values})});
    const result = await response.json().catch(() => ({}));
    if (!response.ok || !result.access_token) throw fail(502,'Không lấy được quyền ghi Drive. Hãy liên kết lại.');
    return result;
  }
  async function links(store) {
    return (await store.get(storeKey))?.links || {};
  }
  function change(store,account,update) {
    const next = writes.catch(() => {}).then(async () => {
      const all = {...await links(store)};
      const entry = update(all[account]);
      if (entry) all[account] = entry;
      else delete all[account];
      if (store.putMaterials) await store.putMaterials([[storeKey,{links:all}]]);
      else await store.put(storeKey,{links:all});
      return entry;
    });
    writes = next;
    return next;
  }
  function connect(account) {
    if (!available) throw fail(503,'Máy chủ chưa cấu hình Google Drive OAuth.');
    const now = clock().getTime();
    for (const [nonce,session] of pending) {
      if (session.expires > now && session.account !== account) continue;
      pending.delete(nonce);
      if (linking.get(session.account) === nonce) linking.delete(session.account);
    }
    if (pending.size >= 1000) throw fail(429,'Có quá nhiều yêu cầu liên kết. Hãy thử lại sau.');
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    pending.set(state,{account,verifier,expires:now+10*60000});
    linking.set(account,state);
    const params = new URLSearchParams({client_id:clientId,redirect_uri:redirect,response_type:'code',
      scope:'openid email https://www.googleapis.com/auth/drive.file',access_type:'offline',prompt:'consent',
      login_hint:account,state,code_challenge_method:'S256',
      code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
    return 'https://accounts.google.com/o/oauth2/v2/auth?'+params;
  }
  async function findFolder(account,token) {
    const headers = {Authorization:'Bearer '+token,'Content-Type':'application/json'};
    const marker = crypto.createHash('sha256').update(account).digest('hex');
    const query = new URLSearchParams({spaces:'drive',fields:'files(id)',
      q:"trashed=false and mimeType='"+folderMime+"' and appProperties has {key='gdhomeAccount' and value='"+marker+"'}"});
    const list = await request(drive+'/files?'+query,{headers});
    if (!list.ok) throw fail(502,'Không đọc được thư mục sao lưu trên Drive.');
    const id = (await list.json()).files?.[0]?.id;
    if (id) return id;
    const created = await request(drive+'/files?fields=id',{method:'POST',headers,
      body:JSON.stringify({name:'GD HOME - Sao lưu',mimeType:folderMime,appProperties:{gdhomeAccount:marker}})});
    if (!created.ok) throw fail(502,'Không tạo được thư mục sao lưu trên Drive.');
    const folder = (await created.json()).id;
    if (!folder) throw fail(502,'Drive chưa trả về mã thư mục.');
    return folder;
  }
  async function callback(store,params) {
    const nonce = params.get('state'), session = pending.get(nonce);
    pending.delete(nonce);
    if (!session) return false;
    const {account,verifier,expires} = session;
    try {
      if (expires <= clock().getTime() || !params.get('code')) return false;
      const {access_token,refresh_token} = await tokens({code:params.get('code'),grant_type:'authorization_code',
        redirect_uri:redirect,code_verifier:verifier});
      const profile = await request('https://openidconnect.googleapis.com/v1/userinfo',{
        headers:{Authorization:'Bearer '+access_token}
      });
      const user = await profile.json().catch(() => ({}));
      if (!profile.ok || user.email_verified !== true || user.email?.toLowerCase() !== account || !refresh_token) return false;
      const folder = await findFolder(account,access_token);
      const id = crypto.randomUUID();
      const link = await change(store,account,previous => linking.get(account) === nonce ? ({
        ...(previous?.folder === folder ? previous : {}),id,folder,token:encrypt(refresh_token),error:null
      }) : previous);
      if (link?.id !== id) return false;
      if (!link.lastAt) run(store,account,link)?.catch(() => {});
      return true;
    } finally {
      if (linking.get(account) === nonce) linking.delete(account);
    }
  }
  async function status(store,account) {
    if (!available || account === 'shared') return {available:false};
    const link = (await links(store))[account];
    return {available:true,linked:!!link,busy:jobs.has(account),folderUrl:link && folderUrl(link.folder),
      lastAt:link?.lastAt,files:link?.files,missing:link?.missing,error:link?.error};
  }
  async function unlink(store,account) {
    linking.delete(account);
    for (const [nonce,session] of pending) if (session.account === account) pending.delete(nonce);
    jobs.get(account)?.abort();
    let removed;
    await change(store,account,link => { removed = link; return undefined; });
    if (!removed) return '';
    try {
      const response = await request('https://oauth2.googleapis.com/revoke',{method:'POST',
        signal:AbortSignal.timeout(10000),body:new URLSearchParams({token:decrypt(removed.token)})});
      if (response.ok || response.status === 400) return '';
    } catch { /* The local link is already removed. */ }
    return 'Đã dừng sao lưu. Google chưa xác nhận thu hồi quyền Drive của ứng dụng.';
  }
  function run(store,account,link) {
    if (jobs.has(account)) return;
    const controller = new AbortController();
    const {signal} = controller;
    jobs.set(account,controller);
    const now = clock(), {date} = vietnamDay(now);
    return (async () => {
      let archive;
      try {
        if ((await links(store))[account]?.id !== link.id) return;
        const {access_token} = await tokens({refresh_token:decrypt(link.token),grant_type:'refresh_token'},signal);
        archive = snapshot({store,account,dataDir,signal,now});
        const name = 'GDHOME-'+now.toISOString().replace(/[:.]/g,'-')+'.ndjson.gz';
        await uploadArchive(request,access_token,link.folder,name,archive.stream,signal);
        signal.throwIfAborted();
        await change(store,account,current => current?.id === link.id ? {...current,lastDate:date,
          lastAt:now.toISOString(),files:archive.summary.files,missing:archive.summary.missing.length,error:null} : current);
      } catch (error) {
        if (!signal.aborted) await change(store,account,current => current?.id === link.id ?
          {...current,error:'Sao lưu chưa xong. '+error.message} : current);
      } finally {
        archive?.stream.destroy();
        jobs.delete(account);
      }
    })();
  }
  async function runNow(store,account) {
    const link = (await links(store))[account];
    if (!available || !link || account === 'shared') throw fail(400,'Hãy liên kết thư mục Drive trước.');
    run(store,account,link)?.catch(() => {});
  }
  async function tick(store) {
    if (!available || ticking) return;
    const {date,hour} = vietnamDay(clock());
    if (hour < 2) return;
    ticking = true;
    try {
      for (const [account,link] of Object.entries(await links(store))) {
        if (link.lastDate !== date) await run(store,account,link);
      }
    } finally { ticking = false; }
  }
  return {available,connect,callback,status,unlink,runNow,tick};
}

module.exports = {driveBackup,vietnamDay};
