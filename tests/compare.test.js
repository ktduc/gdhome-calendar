const test = require('node:test');
const assert = require('node:assert/strict');
const {handleCompare, normalizeBoard, reviewBoard, defaultDoc} = require('../compare');

const col = (name, extra = {}) => ({name, desc: 'Mô tả', stats: 'Giá thành: 2   Độ cứng: 3', pros: ['A', 'B', 'C'], cons: ['D', 'E', 'F'], ...extra});

test('so sánh: chuẩn hoá bảng AI, 2–3 cột, rà soát lỗi', () => {
  assert.equal(normalizeBoard({columns: [col('Một')]}), null, 'Dưới 2 cột thì bỏ');
  const b = normalizeBoard({heading: 'cửa có khuôn và giấu khuôn', category: 'cửa', columns: [col('A'), col('B'), col('C'), col('D')]});
  assert.equal(b.columns.length, 3, 'Tối đa 3 cột');
  assert.equal(b.heading, 'CỬA CÓ KHUÔN VÀ GIẤU KHUÔN');
  assert.equal(b.category, 'CỬA');
  assert.equal(b.status, 'new');
  assert.deepEqual(reviewBoard(b), []);
  const bad = normalizeBoard({heading: 'X', columns: [col('A', {pros: ['chỉ 1']}), col('B', {stats: 'Độ bền: 4'})]});
  const issues = reviewBoard(bad);
  assert.ok(issues.some(i => i.includes('Cột 1 cần 3')));
  assert.ok(issues.some(i => i.includes('cùng tiêu chí')));
  assert.ok(reviewBoard(null).length);
  assert.equal(normalizeBoard({columns: [col('A', {image: {full: '../x'}}), col('B', {image: {full: 'a'.repeat(64) + '.webp'}})]}).columns.map(c => c.image?.full ?? null)[0], null, 'Chặn đường dẫn ảnh lạ');
});

test('so sánh: lưu theo tài khoản, chống ghi đè phiên bản cũ', async () => {
  const data = new Map();
  const store = {get: async k => structuredClone(data.get(k) ?? null), put: async (k, v) => { data.set(k, structuredClone(v)); }};
  async function call(method, body, dataKey = 'u@x.com') {
    let out;
    try {
      await handleCompare({method}, {}, '/api/compare', {store, dataKey, readJsonBody: async () => body, sendJson: (r, s, o) => { out = {status: s, ...o}; }});
    } catch (e) { out = {status: e.status, message: e.message}; }
    return out;
  }
  const first = await call('GET');
  assert.deepEqual(first.categories.map(c => c.name), defaultDoc().categories.map(c => c.name));
  const saved = await call('POST', {_baseVersion: 0, categories: first.categories, boards: [{heading: 'Test', columns: [col('A'), col('B')], categoryId: 'cat-cua'}], queue: [{idea: 'So sánh A và B'}]});
  assert.equal(saved._version, 1);
  assert.equal(saved.boards[0].categoryId, 'cat-cua');
  assert.equal((await call('POST', {_baseVersion: 0, categories: [], boards: []})).status, 409, 'Bản cũ không ghi đè');
  const again = await call('GET');
  assert.equal(again.boards.length, 1);
  assert.equal(again.queue[0].idea, 'So sánh A và B');
  assert.equal((await call('GET', null, 'khac@x.com')).boards.length, 0, 'Tài khoản khác không thấy');
});
