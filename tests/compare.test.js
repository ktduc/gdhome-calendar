const test = require('node:test');
const assert = require('node:assert/strict');
const {handleCompare, normalizeBoard, reviewBoard, defaultDoc} = require('../compare');

const col = (name, extra = {}) => ({name, desc: 'Mô tả', stats: 'Giá thành: 2   Độ cứng: 3', pros: ['A', 'B', 'C'], cons: ['D', 'E', 'F'], ...extra});

test('so sánh: chuẩn hoá bảng AI, 2–3 cột, rà soát lỗi', () => {
  assert.equal(normalizeBoard({columns: [col('Một')]}), null, 'Dưới 2 cột thì bỏ');
  const six = normalizeBoard({columns: 'ABCDEFG'.split('').map(n => col(n)), layout: [3, 3]});
  assert.equal(six.columns.length, 6, 'Tối đa 6 phương án');
  assert.deepEqual(six.layout, [3, 3]);
  assert.equal(normalizeBoard({columns: [col('A'), col('B'), col('C'), col('D'), col('E')], layout: [3, 3]}).layout, null, 'Thứ tự tờ sai số cột thì bỏ');
  assert.deepEqual(normalizeBoard({columns: [col('A'), col('B'), col('C'), col('D'), col('E')], layout: [3, 2]}).layout, [3, 2]);
  assert.equal(normalizeBoard({columns: [col('A'), col('')], layout: [2]}).columns.length, 2, 'Bảng tự làm giữ phương án chưa đặt tên');
  assert.equal(normalizeBoard({columns: [col('A'), col(''), col('B')]}).columns.length, 2, 'Bảng AI bỏ cột không tên');
  const b = normalizeBoard({heading: 'cửa có khuôn và giấu khuôn', category: 'cửa', columns: [col('A'), col('B'), col('C')]});
  assert.equal(b.columns.length, 3);
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

test('so sánh: bảng tự làm – AI điền chỗ trống kèm ảnh, giữ chữ người dùng; hết lượt ngày thì dừng hàng đợi', async () => {
  const {mergeFill} = require('../compare');
  const data = new Map();
  const store = {get: async k => structuredClone(data.get(k) ?? null), put: async (k, v) => { data.set(k, structuredClone(v)); }};
  const calls = [];
  let quota = false;
  const makeBoard = async (idea, categories, onStep, fill) => {
    calls.push({idea, fill});
    if (quota) throw Object.assign(new Error('Đã hết hạn mức AI hôm nay.'), {status: 429, aiCode: 'daily_quota'});
    const made = normalizeBoard({heading: 'TAY NẮM', columns: [col('Tay nắm tròn AI'), col('Tay nắm dài AI', {pros: ['Ý anh', 'X', 'Y']})]});
    return {board: mergeFill(fill.seed, made), issues: []};
  };
  async function call(method, path, body) {
    let out;
    await handleCompare({method}, {}, path, {store, dataKey: 'f@x.com', readJsonBody: async () => body, sendJson: (r, s, o) => { out = o; }, makeBoard});
    return out;
  }
  const until = async fn => { for (let i = 0; i < 200; i++) { const v = await call('GET', '/api/compare/queue'); if (fn(v)) return v; await new Promise(r => setTimeout(r, 10)); } throw new Error('Hết giờ'); };
  const board = {id: 'cmp_tu_lam', heading: '', notes: 'Tay nắm inox 304', columns: [
    {name: 'Phương án A', desc: '', pros: [], cons: []}, {name: 'Tay nắm dài', desc: 'Ý anh tự gõ', pros: ['Ý anh'], cons: []}]};
  await call('POST', '/api/compare/queue/fill', {board, images: [{mediaType: 'image/jpeg', data: 'abc', col: 1}, {mediaType: 'text/html', data: 'x'}]});
  const v = await until(x => x.jobs[0]?.state === 'done');
  const {seed, images} = calls[0].fill;
  assert.equal(calls[0].idea, 'Tay nắm dài', 'Tên mặc định "Phương án A" không gửi làm ý tưởng');
  assert.equal(seed.columns[0].name, '', 'Tên mặc định để AI đặt');
  assert.equal(seed.notes, 'Tay nắm inox 304');
  assert.deepEqual(images, [{mediaType: 'image/jpeg', data: 'abc', col: 1}], 'Chỉ nhận ảnh hợp lệ');
  const out = v.jobs[0].board;
  assert.equal(v.jobs[0].boardId, 'cmp_tu_lam');
  assert.equal(out.columns[0].name, 'Tay nắm tròn AI', 'AI đặt tên cột trống');
  assert.equal(out.columns[1].name, 'Tay nắm dài', 'Giữ tên người dùng');
  assert.equal(out.columns[1].desc, 'Ý anh tự gõ');
  assert.deepEqual(out.columns[1].pros, ['Ý anh', 'X', 'Y'], 'Ý có sẵn đứng đầu, không lặp');
  assert.equal(out.columns[0].pros.length, 3);
  await call('POST', '/api/compare/queue/ack', {ids: v.jobs.map(j => j.id)});
  // Hết lượt AI hôm nay: dừng, các việc sau báo lỗi để bấm thử lại, không gọi AI thêm
  quota = true;
  calls.length = 0;
  await call('POST', '/api/compare/queue', {ideas: ['Ý 1', 'Ý 2', 'Ý 3'], categories: []});
  const q = await until(x => x.jobs.every(j => j.state === 'error'));
  assert.equal(calls.length, 1);
  assert.ok(q.jobs[2].error.startsWith('Chưa làm: '));
});

test('so sánh: prompt cho AI khác + dán câu trả lời về; mô tả giữ xuống dòng', async () => {
  const {parseAiJson} = require('../compare');
  async function call(path, body) {
    let out;
    try { await handleCompare({method: 'POST'}, {}, path, {store: {get: async () => null}, dataKey: 'p@x.com', readJsonBody: async () => body, sendJson: (r, s, o) => { out = o; }}); }
    catch (e) { out = {status: e.status, message: e.message}; }
    return out;
  }
  const board = {id: 'cmp_tu_lam2', heading: 'Tay nắm', notes: 'Inox 304', columns: [
    {name: 'Phương án A', desc: 'Dòng 1\nGiá thành: 2   Độ bền: 3', pros: [], cons: [], image: {full: 'a'.repeat(64) + '.webp'}}, {name: 'Tay nắm dài', pros: [], cons: []}]};
  const {prompt} = await call('/api/compare/prompt', {board, categories: ['CỬA']});
  assert.ok(prompt.startsWith('Bạn là kiến trúc sư'), 'Có lời nhắc hệ thống');
  assert.ok(prompt.includes('Inox 304') && prompt.includes('ảnh 1 là của cột 1') && prompt.includes('DANH MỤC CÓ SẴN: CỬA'));
  const answer = 'Đây là kết quả:\n```json\n' + JSON.stringify({heading: 'X', columns: [col('Tay nắm tròn'), col('Khác')]}) + '\n```';
  const out = await call('/api/compare/import', {board, raw: answer});
  assert.equal(out.board.columns[0].name, 'Tay nắm tròn');
  assert.equal(out.board.columns[1].name, 'Tay nắm dài');
  assert.equal(out.board.columns[0].desc, 'Dòng 1\nGiá thành: 2   Độ bền: 3', 'Giữ xuống dòng + khoảng cách');
  assert.equal(out.board.columns[0].stats, '', 'Mô tả đã gõ thì không thêm dòng giá của AI');
  assert.equal(out.board.heading, 'TAY NẮM');
  assert.equal((await call('/api/compare/import', {board, raw: 'không có json'})).status, 400);
  assert.throws(() => parseAiJson('{sai'), /JSON/);
});
