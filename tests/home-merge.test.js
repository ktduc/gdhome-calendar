const test = require('node:test');
const assert = require('node:assert/strict');
const {mergeProject} = require('../project-profiles');
const {handleHome} = require('../home-page');

const memory = () => { const m = new Map(); return {get: async k => structuredClone(m.get(k)), put: async (k, v) => { m.set(k, structuredClone(v)); }}; };

test('gộp dự án: chuyển giai đoạn, bảng chốt mã, điền ô trống, xoá nguồn', async () => {
  const store = memory();
  await store.put('u', {projectOwners: [{id: 'a', name: 'A', profile: {phone: '090', custom: {c_x: '1'}}}, {id: 'b', name: 'B', profile: {phone: '', address: 'Q7'}}],
    calendars: [{id: 'c1', ownerId: 'a'}, {id: 'c2', ownerId: 'b'}], tasks: []});
  await store.put('m', {sheets: [{id: 's', projectId: 'a'}]});
  const result = await mergeProject(store, 'u', 'a', 'b', () => ({}), 'm');
  const data = await store.get('u');
  assert.deepEqual(data.projectOwners.map(o => o.id), ['b']);
  assert.equal(data.projectOwners[0].profile.phone, '090');
  assert.equal(data.projectOwners[0].profile.address, 'Q7');
  assert.equal(data.projectOwners[0].profile.custom.c_x, '1');
  assert.ok(data.calendars.every(c => c.ownerId === 'b'));
  assert.equal((await store.get('m')).sheets[0].projectId, 'b');
  assert.equal(result.movedSheets, 1);
  await assert.rejects(mergeProject(store, 'u', 'b', 'b', () => ({})), /dự án khác/);
});

test('ảnh bìa: ai cũng xem, chỉ admin được đổi', async () => {
  const store = memory();
  const call = async (method, dataKey, body, admins = ['boss@x.vn']) => {
    let out;
    await handleHome({method}, null, {store, dataKey, admins, readJsonBody: async () => body, sendJson: (res, status, data) => { out = {status, data}; }});
    return out;
  };
  const img = 'data:image/jpeg;base64,AAAA';
  assert.equal((await call('POST', 'staff@x.vn', {cover: img})).status, 403);
  assert.equal((await call('POST', 'boss@x.vn', {cover: 'javascript:1'})).status, 400);
  assert.equal((await call('POST', 'boss@x.vn', {cover: img})).status, 200);
  const view = await call('GET', null);
  assert.equal(view.data.cover, img);
  assert.equal(view.data.canEdit, false);
  // Chưa cấu hình admin: người đặt ảnh đầu tiên giữ quyền
  const open = memory();
  const call2 = async (dataKey, body) => { let out; await handleHome({method: 'POST'}, null, {store: open, dataKey, admins: [], readJsonBody: async () => body, sendJson: (r, s) => { out = s; }}); return out; };
  assert.equal(await call2('first@x.vn', {cover: img}), 200);
  assert.equal(await call2('other@x.vn', {cover: ''}), 403);
});
