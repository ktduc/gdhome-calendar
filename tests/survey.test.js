const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../khao-sat-data.js');
const {handleSurveyPublic, handleSurveyAdmin} = require('../survey.js');

const ids = answers => D.visibleQuestions(answers).map(q => q.id);

test('mỗi khách thấy khoảng 40-78 câu (nhà ở), id duy nhất, mọi showIf / optIf / sub trỏ tới thứ có thật', () => {
  for (const loai of ['chung_cu', 'nha_pho', 'biet_thu']) {
    const n = ids({loai_nha: loai, thanh_vien: ['tre_hoc', 'ong_ba'], tho_co: 'tu_tho', tb_muc: 'nhieu', lv_ai: ['chu_nha']}).length;
    assert.ok(n >= 40 && n <= 78, loai + ' ' + n);
  }
  assert.equal(new Set(D.QUESTIONS.map(q => q.id)).size, D.QUESTIONS.length);
  for (const x of [...D.GROUPS, ...D.QUESTIONS]) for (const c of [].concat(x.showIf || [])) assert.ok(D.QUESTION_BY_ID[c.q], c.q);
  for (const q of D.QUESTIONS) {
    for (const [v, c] of Object.entries(q.optIf || {})) { assert.ok(q.options.some(o => o.v === v), q.id + '.' + v); for (const x of [].concat(c)) assert.ok(D.QUESTION_BY_ID[x.q]); }
    for (const v of Object.keys(q.sub || {})) assert.ok(q.options.some(o => o.v === v) && v !== 'khac', q.id + '.' + v);
  }
  for (const q of D.QUESTIONS) if (['one', 'many'].includes(q.type)) assert.ok(q.options.length >= 2, q.id);
});

test('câu hỏi đổi theo loại công trình', () => {
  assert.deepEqual(ids({}).slice(0, 4), ['loai_nha', 'tinh_trang', 'dien_tich', 'dia_chi']);
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

test('câu phụ thuộc: bảng phòng ngủ, chi tiết thờ, nhà thông minh', () => {
  const base = {loai_nha: 'nha_pho'};
  assert.ok(!ids(base).includes('pn_phong') && ids({...base, pn_so: '3'}).includes('pn_phong'));
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
    'loai_nha.khac': 'không có ô khác', dia_chi: 'a'.repeat(5000), dien_tich: '85.5', thu_cung: 'cho'});
  assert.equal(clean.loai_nha, 'nha_pho');
  assert.ok(!('so_tang' in clean) && !('hack' in clean) && !('loai_nha.khac' in clean));
  assert.deepEqual(clean.thu_cung, ['cho'], 'chuỗi ở câu chọn nhiều (câu cũ đổi loại) vẫn giữ');
  assert.deepEqual(clean.thanh_vien, ['vo_chong']);
  assert.ok(clean['thanh_vien.khac'].length <= 300);
  assert.equal(clean.dia_chi.length, 1000);
  assert.equal(clean.dien_tich, 85.5);
  assert.ok(!('dien_tich' in D.cleanAnswers({dien_tich: 'abc'})));
  assert.deepEqual(D.cleanAnswers('x'), {});
  assert.deepEqual(D.cleanAnswers([1]), {});
});

test('thứ tự tổng thể → chi tiết; lựa chọn ẩn theo loại nhà; tích nhỏ trong ô', () => {
  const order = D.visibleGroups({loai_nha: 'nha_pho'}).map(g => g.id);
  assert.ok(order.indexOf('phong_cach') < order.indexOf('ky_thuat') && order.indexOf('ky_thuat') < order.indexOf('khach'), order.join());
  const opts = (a, id) => D.visibleQuestions(a).find(q => q.id === id).options.map(o => o.v);
  assert.ok(!opts({loai_nha: 'chung_cu'}, 'lt_kho').includes('gam') && opts({loai_nha: 'nha_pho'}, 'lt_kho').includes('gam'), 'gầm cầu thang chỉ cho nhà phố');
  assert.ok(!opts({loai_nha: 'chung_cu'}, 'kt_dien').includes('ba_pha'));
  assert.ok(!opts({loai_nha: 'chung_cu'}, 'kt_dien').includes('tu_dien') && !opts({loai_nha: 'chung_cu'}, 'kt_nuoc').includes('nong_tong'));
  assert.ok(opts({loai_nha: 'chung_cu', tinh_trang: 'co_ban'}, 'kt_nuoc').includes('co_binh') && !opts({loai_nha: 'chung_cu', tinh_trang: 'tho'}, 'kt_nuoc').includes('co_binh'));
  const a = D.cleanAnswers({bep_thiet_bi: ['lo_nuong', 'tu_lanh_lon'], 'bep_thiet_bi.lo_nuong': ['am_tu', 'la'], 'bep_thiet_bi.tu_lanh_lon': ['am_tuong'], 'bep_thiet_bi.rua_bat': ['am_tu']});
  assert.deepEqual(a['bep_thiet_bi.lo_nuong'], ['am_tu']);
  assert.ok(!('bep_thiet_bi.rua_bat' in a), 'bỏ tích nhỏ khi ô chính chưa chọn');
  assert.equal(D.answerText(D.QUESTION_BY_ID.bep_thiet_bi, a), 'Lò nướng (Âm tủ), Tủ lạnh lớn (side-by-side) (Âm tường)');
});

test('loại trừ: "Không" và tích nhỏ cùng nhóm; ngày nhập trạch; bảng phòng ngủ', () => {
  const a = D.cleanAnswers({thu_cung: ['khong', 'cho'], sanh: ['khong'], bep_thiet_bi: ['tu_lanh_lon', 'rua_bat'], 'bep_thiet_bi.tu_lanh_lon': ['am_tu', 'am_tuong'],
    'bep_thiet_bi.rua_bat': ['am_tu', 'dat_cao'], ns_nhap_trach: '2027-01-15', pn_so: '2',
    pn_phong: [{who: 'vo_chong', items: ['wic', 'ban_hoc', 'x'], bed: '1m8', mat: 'go'}, {who: 'la', items: ['wc_rieng'], bed: '9m'}, {who: 'khach'}]});
  assert.deepEqual(a.thu_cung, ['cho']);
  assert.deepEqual(a.sanh, ['khong']);
  assert.deepEqual(a['bep_thiet_bi.tu_lanh_lon'], ['am_tu'], 'Âm tủ / Âm tường chỉ chọn 1');
  assert.deepEqual(a['bep_thiet_bi.rua_bat'], ['am_tu', 'dat_cao'], 'nhóm độc lập giữ cả hai');
  assert.equal(a.ns_nhap_trach, '2027-01-15');
  assert.ok(!('ns_nhap_trach' in D.cleanAnswers({ns_nhap_trach: '15/01/2027'})));
  assert.equal(D.answerText(D.QUESTION_BY_ID.ns_nhap_trach, a), '15/01/2027 (8/12 âm lịch)');
  assert.deepEqual(a.pn_phong[0], {who: 'vo_chong', items: ['wic'], bed: '1m8', mat: 'go', pc: [], mau: [], note: ''}, 'bàn học không dành cho phòng vợ chồng');
  assert.deepEqual(a.pn_phong[1], {who: '', items: [], bed: '', mat: '', pc: [], mau: [], note: ''});
  assert.equal(D.answerText(D.QUESTION_BY_ID.pn_phong, a), 'P1 Vợ chồng: Phòng thay đồ, giường 1m8, Giường gỗ', 'chỉ tính số phòng đã chọn');
  assert.ok(!('pn_phong' in D.cleanAnswers({pn_phong: 'x'})));
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

test('server: danh sách khảo sát chỉ gồm khách đã có trả lời, mới nhất trước, theo tài khoản', async () => {
  const {pub, adm} = harness();
  const a = (await adm('POST', '/api/surveys/link', {projectId: 'a', name: 'A'})).json.token;
  const b = (await adm('POST', '/api/surveys/link', {projectId: 'b', name: 'B'})).json.token;
  await adm('POST', '/api/surveys/link', {projectId: 'c', name: 'C chưa điền'});
  await pub('POST', '/api/survey/' + a, {answers: {loai_nha: 'nha_pho'}, submit: true});
  await new Promise(resolve => setTimeout(resolve, 5));
  await pub('POST', '/api/survey/' + b, {answers: {loai_nha: 'chung_cu'}});
  const list = (await adm('GET', '/api/surveys')).json.surveys;
  assert.deepEqual(list.map(x => x.projectId), ['b', 'a']);
  assert.ok(list[1].submittedAt > 0 && !list[0].submittedAt);
  assert.deepEqual((await adm('GET', '/api/surveys', null, 'khac@x.vn')).json.surveys, []);
});

test('server: giới hạn kích thước body công khai', async () => {
  const {pub, adm} = harness();
  const {json} = await adm('POST', '/api/surveys/link', {projectId: 'p1'});
  const url = '/api/survey/' + json.token;
  assert.equal((await pub('POST', url, {answers: {}}, 'u1', {'content-length': '999999'})).status, 413);
  assert.equal((await pub('POST', url, {answers: {dia_chi: 'x'.repeat(100)}, pad: 'y'.repeat(70000)})).status, 413);
});

test('ảnh minh hoạ phong cách: ai cũng xem, chỉ quản trị dán / xoá, chặn ảnh lạ', async () => {
  const {handleSurveyImages} = require('../survey.js');
  const data = new Map();
  const store = {get: async key => structuredClone(data.get(key) ?? null), put: async (key, value) => { data.set(key, structuredClone(value)); }};
  const call = async (method, body, dataKey, admins = ['admin@x.vn']) => {
    let out;
    try { await handleSurveyImages({method}, {}, {store, dataKey, admins, readJsonBody: async () => body, sendJson: (_r, status, json) => { out = {status, json}; }}); }
    catch (error) { out = {status: error.status, json: {message: error.message}}; }
    return out;
  };
  const img = 'data:image/jpeg;base64,AAAA';
  assert.equal((await call('POST', {key: 'japandi', image: img}, 'khac@x.vn')).status, 403);
  assert.equal((await call('POST', {key: 'japandi', image: img})).status, 403, 'chưa đăng nhập');
  assert.equal((await call('POST', {key: 'la', image: img}, 'admin@x.vn')).status, 400);
  assert.equal((await call('POST', {key: 'japandi', image: 'javascript:x'}, 'admin@x.vn')).status, 400);
  assert.equal((await call('POST', {key: 'japandi', image: img}, 'admin@x.vn')).status, 200);
  const view = await call('GET');
  assert.deepEqual(view.json, {images: {japandi: img}, canEdit: false});
  await call('POST', {key: 'japandi', image: ''}, 'admin@x.vn');
  assert.deepEqual((await call('GET')).json.images, {});
});

test('tối đa 3 phong cách, TV chọn 1 loại, ghi chú phòng kèm phong cách / màu riêng', () => {
  const a = D.cleanAnswers({ps_phong_cach: ['hien_dai', 'japandi', 'boho', 'rustic'], pk_tv: ['tv_treo', 'tv_di_dong', 'game'], wc_thiet_bi: ['quat_4in1', 'den_suoi'],
    pk_ghi_chu: 'ấm', 'pk_ghi_chu.pc': ['japandi', 'chua_biet'], 'pk_ghi_chu.mau': ['xam'], 'ps_mau.mau_khac': '#AABBCC', 'ps_mau.mau_khac2': 'x'});
  assert.deepEqual(a.ps_phong_cach, ['hien_dai', 'japandi', 'boho']);
  assert.deepEqual(a.pk_tv, ['tv_treo', 'game']);
  assert.deepEqual(a.wc_thiet_bi, ['quat_4in1']);
  assert.deepEqual(a['pk_ghi_chu.pc'], ['japandi']);
  assert.equal(D.answerText(D.QUESTION_BY_ID.pk_ghi_chu, a), 'ấm · phong cách Japandi; màu Xám');
  assert.equal(a['ps_mau.mau_khac'], '#aabbcc');
  assert.ok(!('ps_mau.mau_khac' in D.cleanAnswers({'ps_mau.mau_khac': 'red'})));
});
