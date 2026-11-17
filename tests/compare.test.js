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

test('so sánh: hàng đợi AI chạy nền, tiến trình, lỗi, thử lại, chạy tiếp sau khi khởi động lại', async () => {
  const data = new Map();
  const store = {get: async k => structuredClone(data.get(k) ?? null), put: async (k, v) => { data.set(k, structuredClone(v)); }};
  const steps = [];
  let failNext = false;
  const makeBoard = async (idea, categories, onStep) => {
    await onStep('AI đang soạn bảng');
    steps.push(idea);
    await new Promise(r => setTimeout(r, 20));
    if (failNext) { failNext = false; throw Object.assign(new Error('AI quá tải'), {status: 502}); }
    return {board: normalizeBoard({heading: idea, category: categories[0], columns: [col('A'), col('B')]}), issues: []};
  };
  async function call(method, path, body) {
    let out;
    await handleCompare({method}, {}, path, {store, dataKey: 'q@x.com', readJsonBody: async () => body, sendJson: (r, s, o) => { out = o; }, makeBoard});
    return out;
  }
  const until = async (fn) => { for (let i = 0; i < 200; i++) { const v = await call('GET', '/api/compare/queue'); if (fn(v)) return v; await new Promise(r => setTimeout(r, 10)); } throw new Error('Hết giờ chờ hàng đợi'); };
  let v = await call('POST', '/api/compare/queue', {ideas: ['Ý 1', ' ', 'Ý 2'], categories: ['CỬA']});
  assert.equal(v.jobs.length, 2, 'Bỏ dòng trống');
  v = await until(x => x.jobs.every(j => j.state === 'done'));
  assert.deepEqual(steps, ['Ý 1', 'Ý 2'], 'Làm lần lượt theo thứ tự');
  assert.equal(v.jobs[0].board.category, 'CỬA');
  assert.ok(v.avgMs > 0);
  v = await call('POST', '/api/compare/queue/ack', {ids: v.jobs.map(j => j.id)});
  assert.equal(v.jobs.length, 0, 'Trang đã nhận bảng thì xoá khỏi hàng đợi');
  failNext = true;
  await call('POST', '/api/compare/queue', {ideas: ['Ý lỗi'], categories: []});
  v = await until(x => x.jobs[0]?.state === 'error');
  assert.equal(v.jobs[0].error, 'AI quá tải');
  await call('POST', '/api/compare/queue/retry', {id: v.jobs[0].id});
  v = await until(x => x.jobs[0]?.state === 'done');
  // Server khởi động lại giữa chừng: việc "đang làm" quay về "chờ" và chạy tiếp khi mở trang
  const {queueKeyFor} = require('../compare');
  data.set(queueKeyFor('q@x.com'), {jobs: [{id: 'job_x', idea: 'Ý dở', categories: [], state: 'running', step: 'AI đang soạn bảng'}]});
  v = await until(x => x.jobs.find(j => j.id === 'job_x')?.state === 'done');
  assert.ok(steps.includes('Ý dở'));
});
