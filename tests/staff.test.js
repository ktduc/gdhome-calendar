const test = require('node:test');
const assert = require('node:assert');
const {handleStaff, normalizeDoc} = require('../staff');

function harness() {
  const db = new Map(), out = {};
  const store = {get: async k => db.get(k) ?? null, put: async (k, v) => { db.set(k, v); }};
  const call = (method, body) => handleStaff({method}, null, '/api/staff', {store, dataKey: 'k1', readJsonBody: async () => body, sendJson: (res, status, data) => { out.status = status; out.data = data; }}).then(() => ({...out}));
  return {call};
}

test('nhân viên: chuẩn hoá dữ liệu, bỏ ngày sai, giữ màu hợp lệ', () => {
  const d = normalizeDoc({items: [{id: 'abcd', name: ' An ', tag: 'GD - AN', startAt: '2025-13', birthday: '2000-02-27'}], options: {dept: [{name: 'Thiết kế', color: 'blue'}, {name: 'X', color: 'evil;'}]}});
  assert.equal(d.items[0].name, 'An');
  assert.equal(d.items[0].startAt, '');
  assert.equal(d.items[0].birthday, '2000-02-27');
  assert.deepEqual(d.options.dept, [{name: 'Thiết kế', color: 'blue'}, {name: 'X', color: 'gray'}]);
});

test('nhân viên: lưu, đọc lại, chặn ghi đè bản cũ (409) trừ khi force', async () => {
  const {call} = harness();
  const a = await call('POST', {items: [{id: 'abcd', name: 'An', tag: 'GD - AN'}], baseAt: 0});
  assert.equal(a.status, 200);
  assert.equal((await call('GET')).data.items[0].tag, 'GD - AN');
  assert.equal((await call('POST', {items: [], baseAt: a.data.updatedAt - 1})).status, 409);
  assert.equal((await call('POST', {items: [], baseAt: a.data.updatedAt - 1, force: true})).status, 200);
  assert.equal((await call('POST', {items: 'x'})).status, 400);
});
