// =========================================================================
// GD HOME - TODO LIST CỦA TIMELINE + ĐỒNG BỘ 2 CHIỀU MICROSOFT TO DO
// Lưu riêng từng tài khoản (todo-v1-<hash>), không đụng dữ liệu tiến độ.
// Microsoft: OAuth 2.0 (PKCE + client secret) qua Microsoft Graph, quyền Tasks.ReadWrite.
// Cấu hình trên server: MS_TODO_CLIENT_ID, MS_TODO_CLIENT_SECRET, MS_TODO_REDIRECT_URI, (MS_TODO_TENANT=common)
// =========================================================================
const crypto = require('crypto');

const GRAPH = 'https://graph.microsoft.com/v1.0';
const SCOPE = 'offline_access User.Read Tasks.ReadWrite';
const TZ = 'SE Asia Standard Time';
const MAX_TITLE = 255;
const MAX_ITEMS = 2000;
const DONE_KEEP_DAYS = 60;

function fail(status, message) {
  return Object.assign(new Error(message), {status});
}

function storeKeyFor(dataKey) {
  return 'todo-v1-' + crypto.createHash('sha256').update(String(dataKey)).digest('hex').slice(0, 24);
}

function cleanTitle(value) {
  // Giữ xuống dòng (Shift+Enter), gộp khoảng trắng thừa, tối đa 2 dòng trống liền nhau
  return String(value || '').replace(/\r\n?/g, '\n').replace(/[^\S\n]+/g, ' ').replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, MAX_TITLE);
}

function cleanDate(value) {
  const s = String(value || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function publicItem(item) {
  return {id:item.id, title:item.title, done:!!item.done, due:item.due || '', taskId:item.taskId || '',
    star:!!item.star, order:typeof item.order === 'number' ? item.order : 0,
    createdAt:item.createdAt, updatedAt:item.updatedAt, doneAt:item.doneAt || '', msLinked:!!item.msId};
}

// Việc mới luôn lên đầu danh sách (giống Microsoft To Do)
function topOrder(items) {
  return items.reduce((min, item) => Math.min(min, typeof item.order === 'number' ? item.order : 0), 0) - 1;
}

function todoSync({secret, env = process.env, fetchFn = fetch, clock = () => new Date()} = {}) {
  const clientId = env.MS_TODO_CLIENT_ID;
  const clientSecret = env.MS_TODO_CLIENT_SECRET;
  const redirect = env.MS_TODO_REDIRECT_URI;
  const tenant = /^[A-Za-z0-9.-]+$/.test(env.MS_TODO_TENANT || '') ? env.MS_TODO_TENANT : 'common';
  const available = !!(clientId && clientSecret && redirect);
  const authBase = `https://login.microsoftonline.com/${tenant}/oauth2/v2.0`;
  const encKey = crypto.createHash('sha256').update('gdhome-ms-todo|' + String(secret || 'gdhome')).digest();
  const queues = new Map(), pending = new Map(), accessCache = new Map();

  const nowIso = () => clock().toISOString();

  function encrypt(text) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encKey, iv);
    const data = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
  }
  function decrypt(value) {
    const buf = Buffer.from(String(value || ''), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', encKey, buf.subarray(0, 12));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  }

  // Ghi tuần tự theo tài khoản để không mất thay đổi khi nhiều yêu cầu tới cùng lúc
  function withData(store, dataKey, fn) {
    const key = storeKeyFor(dataKey);
    const prev = queues.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(async () => {
      const raw = await store.get(key);
      const data = raw && typeof raw === 'object' ? raw : {};
      data.items = Array.isArray(data.items) ? data.items : [];
      const before = JSON.stringify(data);
      const result = await fn(data);
      if (JSON.stringify(data) !== before) await store.put(key, data);
      return result;
    });
    queues.set(key, next);
    next.finally(() => { if (queues.get(key) === next) queues.delete(key); }).catch(() => {});
    return next;
  }

  function msView(data) {
    const ms = data.ms;
    if (!available) return {available:false};
    if (!ms || !ms.token) return {available:true, linked:false, error:(ms && ms.error) || ''};
    return {available:true, linked:true, account:ms.account || '', listId:ms.listId || '', listName:ms.listName || '',
      lastSyncAt:ms.lastSyncAt || '', error:ms.error || ''};
  }

  function view(data) {
    return {items:data.items.filter(item => !item.deleted).map(publicItem), ms:msView(data)};
  }

  function prune(data) {
    const limit = clock().getTime() - DONE_KEEP_DAYS * 86400000;
    data.items = data.items.filter(item => !(item.done && !item.deleted && item.doneAt && Date.parse(item.doneAt) < limit && (!item.msId || item.syncedAt >= item.updatedAt)));
    if (data.items.length > MAX_ITEMS) data.items = data.items.slice(-MAX_ITEMS);
  }

  // ---------------------------------------------------------------- OAuth
  async function tokenRequest(values) {
    const res = await fetchFn(authBase + '/token', {method:'POST', signal:AbortSignal.timeout(30000),
      headers:{'Content-Type':'application/x-www-form-urlencoded'},
      body:new URLSearchParams({client_id:clientId, client_secret:clientSecret, scope:SCOPE, ...values})});
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.access_token) {
      const err = fail(502, 'Microsoft từ chối quyền truy cập To Do. Hãy liên kết lại.');
      err.relink = json.error === 'invalid_grant';
      throw err;
    }
    return json;
  }

  function connect(dataKey) {
    if (!available) throw fail(503, 'Máy chủ chưa cấu hình Microsoft To Do (MS_TODO_CLIENT_ID…).');
    const now = clock().getTime();
    for (const [nonce, session] of pending) if (session.expires <= now || session.dataKey === dataKey) pending.delete(nonce);
    if (pending.size >= 1000) throw fail(429, 'Quá nhiều yêu cầu liên kết, thử lại sau.');
    const state = crypto.randomBytes(32).toString('base64url');
    const verifier = crypto.randomBytes(32).toString('base64url');
    pending.set(state, {dataKey, verifier, expires:now + 10 * 60000});
    const params = new URLSearchParams({client_id:clientId, response_type:'code', redirect_uri:redirect,
      response_mode:'query', scope:SCOPE, state, prompt:'select_account', code_challenge_method:'S256',
      code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
    return authBase + '/authorize?' + params;
  }

  async function callback(store, params) {
    const nonce = params.get('state');
    const session = pending.get(nonce);
    pending.delete(nonce);
    if (!session || session.expires <= clock().getTime() || !params.get('code')) return false;
    const tok = await tokenRequest({grant_type:'authorization_code', code:params.get('code'),
      redirect_uri:redirect, code_verifier:session.verifier});
    if (!tok.refresh_token) return false;
    const headers = {Authorization:'Bearer ' + tok.access_token};
    const me = await fetchFn(GRAPH + '/me?$select=mail,userPrincipalName', {headers, signal:AbortSignal.timeout(30000)});
    const user = await me.json().catch(() => ({}));
    const listsRes = await fetchFn(GRAPH + '/me/todo/lists', {headers, signal:AbortSignal.timeout(30000)});
    const lists = (await listsRes.json().catch(() => ({}))).value || [];
    const list = lists.find(l => l.wellknownListName === 'defaultList') || lists[0];
    await withData(store, session.dataKey, data => {
      data.ms = {token:encrypt(tok.refresh_token), account:user.mail || user.userPrincipalName || '',
        listId:list ? list.id : '', listName:list ? list.displayName : '', lastSyncAt:'', error:''};
      // Liên kết lại: các việc cũ coi như chưa đẩy lên danh sách mới
      data.items.forEach(item => { delete item.msId; delete item.msModified; delete item.syncedAt; });
      data.items = data.items.filter(item => !item.deleted);
    });
    accessCache.delete(session.dataKey);
    return true;
  }

  async function accessToken(dataKey, data) {
    const cached = accessCache.get(dataKey);
    if (cached && cached.expires > clock().getTime() + 60000) return cached.token;
    const tok = await tokenRequest({grant_type:'refresh_token', refresh_token:decrypt(data.ms.token)});
    if (tok.refresh_token) data.ms.token = encrypt(tok.refresh_token);
    accessCache.set(dataKey, {token:tok.access_token, expires:clock().getTime() + (Number(tok.expires_in) || 3600) * 1000});
    return tok.access_token;
  }

  async function graph(token, method, url, body) {
    const res = await fetchFn(url.startsWith('http') ? url : GRAPH + url, {method, signal:AbortSignal.timeout(30000),
      headers:{Authorization:'Bearer ' + token, 'Content-Type':'application/json', Prefer:`outlook.timezone="${TZ}"`},
      body:body === undefined ? undefined : JSON.stringify(body)});
    if (res.status === 404) return {notFound:true};
    if (res.status === 204) return {};
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw fail(502, 'Microsoft To Do báo lỗi ' + res.status + (json.error && json.error.code ? ' (' + json.error.code + ')' : ''));
    return json;
  }

  function remoteFields(r) {
    return {title:cleanTitle(r.title) || '(không tên)', done:r.status === 'completed', star:r.importance === 'high',
      due:r.dueDateTime && r.dueDateTime.dateTime ? String(r.dueDateTime.dateTime).slice(0, 10) : ''};
  }
  function toRemote(item) {
    return {title:item.title, status:item.done ? 'completed' : 'notStarted', importance:item.star ? 'high' : 'normal',
      dueDateTime:item.due ? {dateTime:item.due + 'T00:00:00', timeZone:TZ} : null};
  }

  async function syncData(dataKey, data) {
    const ms = data.ms;
    if (!ms || !ms.token || !ms.listId) return;
    try {
      const token = await accessToken(dataKey, data);
      const base = `/me/todo/lists/${encodeURIComponent(ms.listId)}/tasks`;
      const remote = new Map();
      let url = base + '?$top=100&$filter=' + encodeURIComponent("status ne 'completed'");
      for (let page = 0; url && page < 30; page++) {
        const json = await graph(token, 'GET', url);
        if (json.notFound) throw fail(404, 'Danh sách Microsoft To Do đã bị xoá. Hãy chọn danh sách khác.');
        (json.value || []).forEach(r => remote.set(r.id, r));
        url = json['@odata.nextLink'] || '';
      }
      const now = nowIso();
      const known = new Set();
      const removed = new Set();
      let lookups = 0;
      for (const item of data.items) {
        if (!item.msId) continue;
        known.add(item.msId);
        const dirty = !item.syncedAt || item.updatedAt > item.syncedAt;
        if (item.deleted) {
          await graph(token, 'DELETE', `${base}/${encodeURIComponent(item.msId)}`);
          removed.add(item);
          continue;
        }
        let r = remote.get(item.msId);
        if (!r) {
          if (item.done && !dirty) continue;           // đã xong ở cả 2 bên
          if (lookups++ >= 50) continue;
          const one = await graph(token, 'GET', `${base}/${encodeURIComponent(item.msId)}`);
          if (one.notFound) { removed.add(item); continue; }   // đã xoá bên Microsoft
          r = one;
        }
        const remoteChanged = r.lastModifiedDateTime !== item.msModified;
        if (remoteChanged && (!dirty || Date.parse(r.lastModifiedDateTime) >= Date.parse(item.updatedAt))) {
          const f = remoteFields(r);
          if (f.done && !item.done) item.doneAt = now;
          Object.assign(item, f);
          item.updatedAt = now;
        } else if (dirty) {
          const out = await graph(token, 'PATCH', `${base}/${encodeURIComponent(item.msId)}`, toRemote(item));
          if (out.notFound) { removed.add(item); continue; }
          r = out;
        }
        item.msModified = r.lastModifiedDateTime;
        item.syncedAt = item.updatedAt;
      }
      // Việc trên web chưa liên kết mà bên Microsoft đã có việc trùng tên (vd. liên kết lại sau khi ngắt) -> ghép, không tạo bản sao
      const titleKey = value => String(value || '').trim().toLocaleLowerCase('vi');
      const unlinked = data.items.filter(item => !item.msId && !item.deleted && !item.done);
      for (const r of remote.values()) {
        if (known.has(r.id)) continue;
        const f = remoteFields(r);
        const same = unlinked.find(item => !item.msId && titleKey(item.title) === titleKey(f.title));
        if (same) {
          Object.assign(same, f, {msId:r.id, msModified:r.lastModifiedDateTime, updatedAt:now, syncedAt:now});
          continue;
        }
        data.items.push({id:'td_' + crypto.randomUUID(), ...f, order:topOrder(data.items), createdAt:now, updatedAt:now,
          msId:r.id, msModified:r.lastModifiedDateTime, syncedAt:now});
      }
      for (const item of data.items) {
        if (item.msId || item.deleted || item.done) continue;
        const r = await graph(token, 'POST', base, toRemote(item));
        item.msId = r.id;
        item.msModified = r.lastModifiedDateTime;
        item.syncedAt = item.updatedAt;
      }
      data.items = data.items.filter(item => !removed.has(item) && !(item.deleted && !item.msId));
      ms.lastSyncAt = now;
      ms.error = '';
    } catch (err) {
      ms.error = err.message || 'Lỗi đồng bộ Microsoft To Do';
      if (err.relink) { ms.token = ''; ms.error = 'Quyền Microsoft To Do đã hết hạn. Hãy liên kết lại.'; }
      accessCache.delete(dataKey);
    }
  }

  // ---------------------------------------------------------------- API
  async function handle(req, res, urlPath, {store, dataKey, readJsonBody, sendJson}) {
    const method = req.method;
    if (urlPath === '/api/todos' && method === 'GET') {
      return sendJson(res, 200, await withData(store, dataKey, data => view(data)));
    }
    if (urlPath === '/api/todos' && method === 'POST') {
      const body = await readJsonBody(req);
      const title = cleanTitle(body.title);
      if (!title) return sendJson(res, 400, {message:'Nhập nội dung công việc.'});
      return sendJson(res, 200, await withData(store, dataKey, data => {
        const now = nowIso();
        const item = {id:'td_' + crypto.randomUUID(), title, done:false, due:cleanDate(body.due), star:!!body.star,
          order:topOrder(data.items), createdAt:now, updatedAt:now};
        data.items.push(item);
        prune(data);
        return {item:publicItem(item), ...view(data)};
      }));
    }
    // Kéo thả đổi thứ tự: nhận danh sách id theo thứ tự mới (thứ tự chỉ lưu trên web, Graph không có API thứ tự)
    if (urlPath === '/api/todos/order' && method === 'POST') {
      const body = await readJsonBody(req);
      const ids = Array.isArray(body.ids) ? body.ids.map(String).slice(0, MAX_ITEMS) : [];
      return sendJson(res, 200, await withData(store, dataKey, data => {
        const byId = new Map(data.items.map(item => [item.id, item]));
        ids.forEach((id, index) => { const item = byId.get(id); if (item) item.order = index; });
        return view(data);
      }));
    }
    if (urlPath === '/api/todos/sync' && method === 'POST') {
      return sendJson(res, 200, await withData(store, dataKey, async data => { await syncData(dataKey, data); prune(data); return view(data); }));
    }
    if (urlPath === '/api/todos/ms/connect' && method === 'POST') {
      return sendJson(res, 200, {url:connect(dataKey)});
    }
    if (urlPath === '/api/todos/ms/lists' && method === 'GET') {
      return sendJson(res, 200, await withData(store, dataKey, async data => {
        if (!data.ms || !data.ms.token) throw fail(400, 'Chưa liên kết Microsoft To Do.');
        const token = await accessToken(dataKey, data);
        const json = await graph(token, 'GET', '/me/todo/lists');
        return {lists:(json.value || []).map(l => ({id:l.id, name:l.displayName, isDefault:l.wellknownListName === 'defaultList'}))};
      }));
    }
    if (urlPath === '/api/todos/ms/list' && method === 'POST') {
      const body = await readJsonBody(req);
      return sendJson(res, 200, await withData(store, dataKey, async data => {
        if (!data.ms || !data.ms.token) throw fail(400, 'Chưa liên kết Microsoft To Do.');
        if (body.listId !== data.ms.listId) {
          data.ms.listId = String(body.listId || '').slice(0, 300);
          data.ms.listName = cleanTitle(body.listName);
          // Việc đã đồng bộ thuộc danh sách cũ -> bỏ khỏi web (vẫn còn bên Microsoft); việc chưa từng đồng bộ thì đưa sang danh sách mới
          data.items = data.items.filter(item => !item.msId && !item.deleted);
          await syncData(dataKey, data);
        }
        return view(data);
      }));
    }
    if (urlPath === '/api/todos/ms/unlink' && method === 'POST') {
      accessCache.delete(dataKey);
      return sendJson(res, 200, await withData(store, dataKey, data => {
        delete data.ms;
        data.items.forEach(item => { delete item.msId; delete item.msModified; delete item.syncedAt; });
        data.items = data.items.filter(item => !item.deleted);
        return view(data);
      }));
    }
    const m = urlPath.match(/^\/api\/todos\/(td_[A-Za-z0-9-]{1,60})$/);
    if (m && (method === 'PATCH' || method === 'DELETE')) {
      const body = method === 'PATCH' ? await readJsonBody(req) : {};
      return sendJson(res, 200, await withData(store, dataKey, data => {
        const item = data.items.find(i => i.id === m[1] && !i.deleted);
        if (!item) throw fail(404, 'Không tìm thấy công việc.');
        const now = nowIso();
        if (method === 'DELETE') {
          item.deleted = true;
          if (!item.msId) data.items = data.items.filter(i => i !== item);
        } else {
          if (body.title !== undefined) {
            const title = cleanTitle(body.title);
            if (!title) throw fail(400, 'Nội dung không được để trống.');
            item.title = title;
          }
          if (body.due !== undefined) item.due = cleanDate(body.due);
          if (body.taskId !== undefined) item.taskId = String(body.taskId || '').slice(0, 120);
          if (body.star !== undefined) item.star = !!body.star;
          if (body.done !== undefined) {
            item.done = !!body.done;
            item.doneAt = item.done ? now : '';
          }
        }
        item.updatedAt = now;
        return view(data);
      }));
    }
    return sendJson(res, 404, {message:'API todo không tồn tại'});
  }

  return {available, connect, callback, handle, storeKeyFor, _syncData:syncData, _withData:withData};
}

module.exports = {todoSync, storeKeyFor};
