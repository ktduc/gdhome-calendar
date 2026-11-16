const test = require('node:test');
const assert = require('node:assert/strict');
const {todoSync, storeKeyFor} = require('../todo-sync');

function memStore() {
  const m = new Map();
  return {get: async k => (m.has(k) ? JSON.parse(JSON.stringify(m.get(k))) : null), put: async (k, v) => { m.set(k, JSON.parse(JSON.stringify(v))); }, m};
}

// Giả lập Microsoft Graph + đăng nhập Microsoft
function fakeMs() {
  const tasks = new Map();
  let seq = 0, tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 10, 16, 0, 0, ++tick)).toISOString();
  const add = (title, extra = {}) => { const id = 'ms' + (++seq); tasks.set(id, {id, title, status: 'notStarted', lastModifiedDateTime: stamp(), ...extra}); return id; };
  const calls = [];
  const json = (status, body) => ({ok: status < 400, status, json: async () => body});
  async function fetchFn(url, opts = {}) {
    const method = opts.method || 'GET';
    calls.push(method + ' ' + url);
    if (url.includes('/oauth2/v2.0/token')) {
      const p = new URLSearchParams(opts.body);
      if (p.get('refresh_token') === 'bad') return json(400, {error: 'invalid_grant'});
      return json(200, {access_token: 'AT', refresh_token: 'RT2', expires_in: 3600});
    }
    if (url.endsWith('/me?$select=mail,userPrincipalName')) return json(200, {mail: 'a@b.c'});
    if (url.endsWith('/me/todo/lists')) return json(200, {value: [{id: 'L1', displayName: 'Tasks', wellknownListName: 'defaultList'}]});
    const m = url.match(/\/lists\/L1\/tasks(?:\/([^?]+))?(\?.*)?$/);
    if (!m) return json(404, {});
    const id = m[1] && decodeURIComponent(m[1]);
    const body = opts.body ? JSON.parse(opts.body) : {};
    if (!id && method === 'GET') return json(200, {value: [...tasks.values()].filter(t => t.status !== 'completed')});
    if (!id && method === 'POST') { const nid = add(body.title, {status: body.status, importance: body.importance, dueDateTime: body.dueDateTime}); return json(201, tasks.get(nid)); }
    if (!tasks.has(id)) return json(404, {});
    if (method === 'GET') return json(200, tasks.get(id));
    if (method === 'PATCH') { Object.assign(tasks.get(id), body, {lastModifiedDateTime: stamp()}); return json(200, tasks.get(id)); }
    if (method === 'DELETE') { tasks.delete(id); return {ok: true, status: 204, json: async () => ({})}; }
    return json(400, {});
  }
  return {tasks, add, fetchFn, calls, touch: (id, patch) => Object.assign(tasks.get(id), patch, {lastModifiedDateTime: stamp()})};
}

const env = {MS_TODO_CLIENT_ID: 'cid', MS_TODO_CLIENT_SECRET: 'sec', MS_TODO_REDIRECT_URI: 'https://x/api/todos/ms/callback'};

function harness(ms) {
  const store = memStore();
  let t = Date.UTC(2026, 10, 16, 1);
  const sync = todoSync({secret: 's', env, fetchFn: ms.fetchFn, clock: () => new Date(t += 1000)});
  async function call(method, path, body) {
    let out;
    const res = {};
    await sync.handle({method}, res, path, {store, dataKey: 'u@x.com', readJsonBody: async () => body || {},
      sendJson: (r, status, obj) => { out = {status, ...obj}; }});
    return out;
  }
  return {store, sync, call};
}

async function link(h) {
  const url = new URL(h.sync.connect('u@x.com'));
  assert.equal(url.origin, 'https://login.microsoftonline.com');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  const ok = await h.sync.callback(h.store, new URLSearchParams({state: url.searchParams.get('state'), code: 'C'}));
  assert.equal(ok, true);
}

test('todo: thêm, sửa, tick xong, xoá – lưu riêng theo tài khoản', async () => {
  const h = harness(fakeMs());
  const a = await h.call('POST', '/api/todos', {title: '  Gọi thợ điện  '});
  assert.equal(a.item.title, 'Gọi thợ điện');
  assert.equal(a.ms.available, true);
  assert.equal(a.ms.linked, false);
  await h.call('PATCH', '/api/todos/' + a.item.id, {done: true, due: '2026-11-20', taskId: 'task_1'});
  let v = await h.call('GET', '/api/todos');
  assert.equal(v.items[0].done, true);
  assert.equal(v.items[0].due, '2026-11-20');
  assert.equal(v.items[0].taskId, 'task_1');
  await h.call('DELETE', '/api/todos/' + a.item.id);
  v = await h.call('GET', '/api/todos');
  assert.equal(v.items.length, 0);
  assert.ok(h.store.m.has(storeKeyFor('u@x.com')));
  assert.equal((await h.call('POST', '/api/todos', {title: '   '})).status, 400);
  const multi = await h.call('POST', '/api/todos', {title: ' Dòng 1  \r\n  Dòng 2\n\n\n\nDòng 3 '});
  assert.equal(multi.item.title, 'Dòng 1\nDòng 2\n\nDòng 3', 'Giữ xuống dòng');
});

test('todo: không có cấu hình Microsoft thì báo chưa sẵn sàng', async () => {
  const sync = todoSync({secret: 's', env: {}});
  assert.equal(sync.available, false);
  assert.throws(() => sync.connect('u'), /chưa cấu hình/);
});

test('todo: callback sai state bị từ chối', async () => {
  const h = harness(fakeMs());
  assert.equal(await h.sync.callback(h.store, new URLSearchParams({state: 'xx', code: 'C'})), false);
});

test('todo: đồng bộ 2 chiều với Microsoft To Do', async () => {
  const ms = fakeMs();
  const remoteId = ms.add('Việc từ điện thoại');
  const h = harness(ms);
  const local = await h.call('POST', '/api/todos', {title: 'Việc trên web'});
  await link(h);
  let v = await h.call('POST', '/api/todos/sync');
  assert.equal(v.ms.linked, true);
  assert.equal(v.ms.listName, 'Tasks');
  assert.equal(v.ms.error, '');
  assert.deepEqual(v.items.map(i => i.title).sort(), ['Việc trên web', 'Việc từ điện thoại']);
  assert.ok([...ms.tasks.values()].some(t => t.title === 'Việc trên web'), 'đẩy việc mới lên Microsoft');
  // token được mã hoá, không lưu dạng rõ
  assert.ok(!JSON.stringify([...h.store.m.values()]).includes('RT2'));

  // Web: tick xong + đặt hạn -> Microsoft cập nhật
  await h.call('PATCH', '/api/todos/' + local.item.id, {done: true, due: '2026-11-25'});
  await h.call('POST', '/api/todos/sync');
  const pushed = [...ms.tasks.values()].find(t => t.title === 'Việc trên web');
  assert.equal(pushed.status, 'completed');
  assert.equal(pushed.dueDateTime.dateTime, '2026-11-25T00:00:00');

  // Microsoft: đổi tên + hoàn thành -> web cập nhật
  ms.touch(remoteId, {title: 'Việc đã đổi tên', status: 'completed'});
  v = await h.call('POST', '/api/todos/sync');
  const pulled = v.items.find(i => i.title === 'Việc đã đổi tên');
  assert.ok(pulled);
  assert.equal(pulled.done, true);

  // Microsoft mở lại việc -> web bỏ tick
  ms.touch(remoteId, {status: 'notStarted'});
  v = await h.call('POST', '/api/todos/sync');
  assert.equal(v.items.find(i => i.title === 'Việc đã đổi tên').done, false);

  // Xoá trên web -> xoá trên Microsoft
  await h.call('DELETE', '/api/todos/' + pulled.id);
  v = await h.call('POST', '/api/todos/sync');
  assert.equal(ms.tasks.has(remoteId), false);
  assert.equal(v.items.some(i => i.id === pulled.id), false);

  // Xoá trên Microsoft -> web bỏ việc
  const third = await h.call('POST', '/api/todos', {title: 'Việc thứ ba'});
  await h.call('POST', '/api/todos/sync');
  const msId = [...ms.tasks.values()].find(t => t.title === 'Việc thứ ba').id;
  ms.tasks.delete(msId);
  v = await h.call('POST', '/api/todos/sync');
  assert.equal(v.items.some(i => i.id === third.item.id), false);
});

test('todo: việc mới lên đầu, kéo thả đổi thứ tự, sao ưu tiên đồng bộ "Quan trọng"', async () => {
  const ms = fakeMs();
  const h = harness(ms);
  const a = await h.call('POST', '/api/todos', {title: 'A'});
  const b = await h.call('POST', '/api/todos', {title: 'B'});
  let v = await h.call('GET', '/api/todos');
  const sorted = items => items.slice().sort((x, y) => x.order - y.order).map(i => i.title);
  assert.deepEqual(sorted(v.items), ['B', 'A']);
  v = await h.call('POST', '/api/todos/order', {ids: [a.item.id, b.item.id]});
  assert.deepEqual(sorted(v.items), ['A', 'B']);
  await link(h);
  await h.call('PATCH', '/api/todos/' + b.item.id, {star: true});
  await h.call('POST', '/api/todos/sync');
  assert.equal([...ms.tasks.values()].find(t => t.title === 'B').importance, 'high');
  assert.equal([...ms.tasks.values()].find(t => t.title === 'A').importance, 'normal');
  const aId = [...ms.tasks.values()].find(t => t.title === 'A').id;
  ms.touch(aId, {importance: 'high'});
  v = await h.call('POST', '/api/todos/sync');
  assert.equal(v.items.find(i => i.title === 'A').star, true);
  // Thứ tự không bị đồng bộ làm xáo trộn
  assert.deepEqual(sorted(v.items), ['A', 'B']);
});

test('todo: quyền Microsoft hết hạn -> báo liên kết lại, không làm hỏng danh sách', async () => {
  const ms = fakeMs();
  const h = harness(ms);
  await h.call('POST', '/api/todos', {title: 'Giữ nguyên'});
  await link(h);
  const key = storeKeyFor('u@x.com');
  const raw = h.store.m.get(key);
  // Giả lập refresh token bị thu hồi
  const sync2 = todoSync({secret: 's', env, fetchFn: async (url, opts) => url.includes('/token') ? {ok: false, status: 400, json: async () => ({error: 'invalid_grant'})} : ms.fetchFn(url, opts)});
  await h.store.put(key, raw);
  let out;
  await sync2.handle({method: 'POST'}, {}, '/api/todos/sync', {store: h.store, dataKey: 'u@x.com', readJsonBody: async () => ({}), sendJson: (r, s, o) => { out = o; }});
  assert.equal(out.ms.linked, false);
  assert.equal(out.items.length, 1);
});
