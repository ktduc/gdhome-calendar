const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../khao-sat-data.js');
const {handleSurveyPublic, handleSurveyAdmin} = require('../survey.js');

const ids = answers => D.visibleQuestions(answers).map(q => q.id);

test('mỗi khách thấy khoảng 40-72 câu (nhà ở), id duy nhất, mọi showIf trỏ tới câu có thật', () => {
  for (const loai of ['chung_cu', 'nha_pho', 'biet_thu']) {
    const n = ids({loai_nha: loai, thanh_vien: ['tre_hoc', 'ong_ba'], tho_co: 'tu_tho', tb_muc: 'nhieu', lv_ai: ['chu_nha']}).length;
    assert.ok(n >= 40 && n <= 72, loai + ' ' + n);
  }
  assert.equal(new Set(D.QUESTIONS.map(q => q.id)).size, D.QUESTIONS.length);
  for (const x of [...D.GROUPS, ...D.QUESTIONS]) for (const c of [].concat(x.showIf || [])) assert.ok(D.QUESTION_BY_ID[c.q], c.q);
  for (const q of D.QUESTIONS) if (q.type !== 'text') assert.ok(q.options.length >= 2, q.id);
});

test('câu hỏi đổi theo loại công trình', () => {
  assert.deepEqual(ids({}).slice(0, 3), ['loai_nha', 'tinh_trang', 'dien_tich']);
  assert.ok(!ids({}).includes('so_tang'));
  const house = ids({loai_nha: 'nha_pho'});
  assert.ok(house.includes('so_tang') && house.includes('thang_may') && house.includes('gieng_troi') && house.includes('tho_tang_tren'));
  assert.ok(!house.includes('quy_dinh_bql') && !house.includes('be_boi_gym'));
  const flat = ids({loai_nha: 'chung_cu'});
  assert.ok(flat.includes('quy_dinh_bql') && flat.includes('logia') && !flat.includes('so_tang'));
  assert.ok(ids({loai_nha: 'biet_thu'}).includes('be_boi_gym'));
  const office = ids({loai_nha: 'van_phong'});
  assert.ok(office.includes('nhan_su') && !office.includes('pn_so') && !office.includes('bep_nau'));
});

test('câu phụ thuộc: phòng trẻ em, ông bà, chi tiết thờ, nhà thông minh', () => {
  const base = {loai_nha: 'nha_pho'};
  assert.ok(!ids(base).includes('pn_con') && !ids(base).includes('pn_ong_ba'));
  assert.ok(ids({...base, thanh_vien: ['tre_hoc']}).includes('pn_con'));
  assert.ok(ids({...base, thanh_vien: ['ong_ba']}).includes('pn_ong_ba'));
  assert.ok(!ids(base).includes('tho_loai') && ids({...base, tho_co: 'phong_rieng'}).includes('tho_loai'));
  assert.ok(!ids({...base, tho_co: 'khong'}).includes('tho_loai'));
  assert.ok(!ids({...base, tb_muc: 'khong'}).includes('tb_loai') && ids({...base, tb_muc: 'nhieu'}).includes('tb_loai'));
});

test('summarize: chỉ câu đang hiện và đã trả lời, gom theo nhóm, có ô Khác', () => {
  const answers = {loai_nha: 'nha_pho', so_tang: '4', thang_may: 'se_lap', chong_nong_am: ['tang_nong', 'nom_am'], 'chong_nong_am.khac': 'gió lùa cầu thang',
    quy_dinh_bql: 'da_biet', ps_phong_cach: ['japandi', 'modern_farmhouse']};
  const text = D.summarize(answers, 'Nhà A');
  assert.match(text, /^NHU CẦU KHÁCH - Nhà A/);
  assert.match(text, /NHÀ PHỐ \/ BIỆT THỰ\n- Số tầng: 4 tầng\n- Thang máy: Sẽ lắp thang máy/);
  assert.match(text, /Vấn đề nhiệt \/ ẩm: Tầng trên cùng rất nóng, Nồm, ẩm mốc, Khác: gió lùa cầu thang/);
  assert.match(text, /Phong cách ưa thích: Japandi, Modern Farmhouse/);
  assert.doesNotMatch(text, /quản lý/i, 'câu của chung cư bị ẩn khi là nhà phố');
  assert.equal(D.summarize({}), '');
});

test('cleanAnswers: bỏ id lạ, đáp án ngoài danh sách, cắt độ dài', () => {
  const clean = D.cleanAnswers({loai_nha: 'nha_pho', so_tang: 'xx', hack: 'y', thanh_vien: ['vo_chong', 'vo_chong', 'la'], 'thanh_vien.khac': ' x '.repeat(400),
    'loai_nha.khac': 'không có ô khác', dien_tich: 'a'.repeat(5000), thu_cung: 'cho'});
  assert.equal(clean.loai_nha, 'nha_pho');
  assert.ok(!('so_tang' in clean) && !('hack' in clean) && !('loai_nha.khac' in clean) && !('thu_cung' in clean));
  assert.deepEqual(clean.thanh_vien, ['vo_chong']);
  assert.ok(clean['thanh_vien.khac'].length <= 300);
  assert.equal(clean.dien_tich.length, 1000);
  assert.deepEqual(D.cleanAnswers('x'), {});
  assert.deepEqual(D.cleanAnswers([1]), {});
});

// Kho giả + response giả để thử route mà không cần mở server
function harness() {
  const data = new Map();
  const store = {get: async key => structuredClone(data.get(key) ?? null), put: async (key, value) => { data.set(key, structuredClone(value)); }};
  const call = async (handler, method, url, body, dataKey = 'u1', headers = {}) => {
    let out;
    const res = {};
    const sendJson = (_res, status, json) => { out = {status, json}; };
    const req = {method, headers};
    try { await handler(req, res, url, {store, dataKey, sendJson, readJsonBody: async () => body}); }
    catch (error) { out = {status: error.status || 500, json: {message: error.message}}; }
    return out;
  };
  return {data, call, pub: (...a) => call(handleSurveyPublic, ...a), adm: (...a) => call(handleSurveyAdmin, ...a)};
}

test('server: tạo link ổn định, khách lưu / gửi, chủ xem lại; token sai bị từ chối', async () => {
  const {pub, adm, data} = harness();
  const link = await adm('POST', '/api/surveys/link', {projectId: 'p1', name: 'Căn A'});
  assert.equal(link.status, 200);
  assert.match(link.json.token, /^[A-Za-z0-9_-]{32}$/);
  assert.equal((await adm('POST', '/api/surveys/link', {projectId: 'p1'})).json.token, link.json.token, 'tạo lại vẫn là link cũ');
  assert.equal((await adm('POST', '/api/surveys/link', {projectId: '../x'})).status, 400);

  const url = '/api/survey/' + link.json.token;
  assert.equal((await pub('GET', url)).json.name, 'Căn A');
  const saved = await pub('POST', url, {answers: {loai_nha: 'nha_pho', so_tang: '3', rac: 'x'}, submit: true});
  assert.equal(saved.status, 200);
  assert.ok(saved.json.submittedAt > 0);
  assert.deepEqual(saved.json.answers, {loai_nha: 'nha_pho', so_tang: '3'});
  const draft = await pub('POST', url, {answers: {loai_nha: 'nha_pho'}, submit: false});
  assert.equal(draft.json.submittedAt, saved.json.submittedAt, 'lưu nháp không đổi trạng thái đã gửi');

  const view = await adm('GET', '/api/surveys/p1');
  assert.equal(view.json.token, link.json.token);
  assert.deepEqual(view.json.answers, {loai_nha: 'nha_pho'});
  assert.equal((await adm('GET', '/api/surveys/chua-co')).json.token, null);
  assert.equal((await adm('GET', '/api/surveys/p1', null, 'khac@x.vn')).json.token, null, 'tài khoản khác không thấy');

  assert.equal((await pub('GET', '/api/survey/ngan')).status, 404);
  assert.equal((await pub('GET', '/api/survey/' + 'a'.repeat(32))).status, 404);
  const secret = JSON.stringify([...data.entries()]);
  assert.ok(!JSON.stringify((await pub('GET', url)).json).includes('u1'), 'không lộ khoá tài khoản');
  assert.ok(secret.includes(link.json.token));
});

test('server: giới hạn kích thước body công khai', async () => {
  const {pub, adm} = harness();
  const {json} = await adm('POST', '/api/surveys/link', {projectId: 'p1'});
  const url = '/api/survey/' + json.token;
  assert.equal((await pub('POST', url, {answers: {}}, 'u1', {'content-length': '999999'})).status, 413);
  assert.equal((await pub('POST', url, {answers: {dien_tich: 'x'.repeat(100)}, pad: 'y'.repeat(70000)})).status, 413);
});
