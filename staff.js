// Thông tin nhân viên (/nhan-su): 1 tài liệu / tài khoản = {items, options, updatedAt}
const crypto = require('node:crypto');

const keyFor = dataKey => 'staff-v1-' + crypto.createHash('sha256').update(String(dataKey)).digest('hex').slice(0, 24);
const MAX_ITEMS = 300;
const FIELDS = {name: 120, tag: 40, dept: 200, skills: 300, role: 120, status: 60, startAt: 10, birthday: 10, phone: 40, email: 120, note: 1000};
const OPTION_KEYS = ['dept', 'skills', 'role', 'status'];
const COLORS = /^(gray|brown|orange|yellow|green|blue|purple|pink|red)(-d)?$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';

function normalizeItem(x) {
  const out = {id: /^[\w-]{4,40}$/.test(x?.id) ? x.id : crypto.randomUUID()};
  for (const [k, max] of Object.entries(FIELDS)) out[k] = str(x?.[k], max);
  for (const k of ['startAt', 'birthday']) if (out[k] && !DATE.test(out[k])) out[k] = '';
  return out;
}
function normalizeDoc(doc) {
  const items = (Array.isArray(doc?.items) ? doc.items : []).slice(0, MAX_ITEMS).map(normalizeItem);
  const options = {};
  for (const k of OPTION_KEYS) {
    const list = Array.isArray(doc?.options?.[k]) ? doc.options[k] : null;
    if (list) options[k] = list.slice(0, 100).map(o => ({name: str(o?.name, 80), color: COLORS.test(o?.color) ? o.color : 'gray'})).filter(o => o.name);
  }
  return {items, options, updatedAt: Number(doc?.updatedAt) || 0};
}

async function handleStaff(req, res, urlPath, {store, dataKey, readJsonBody, sendJson}) {
  if (urlPath !== '/api/staff') return sendJson(res, 404, {success: false, message: 'API không tồn tại'});
  const key = keyFor(dataKey);
  if (req.method === 'GET') return sendJson(res, 200, normalizeDoc(await store.get(key)));
  if (req.method !== 'POST') return sendJson(res, 405, {success: false, message: 'Phương thức không hỗ trợ'});
  const body = await readJsonBody(req);
  if (!Array.isArray(body?.items) || body.items.length > MAX_ITEMS) return sendJson(res, 400, {success: false, message: 'Danh sách nhân viên không hợp lệ (tối đa ' + MAX_ITEMS + ').'});
  const cur = normalizeDoc(await store.get(key));
  // máy / tab khác vừa lưu bản mới hơn -> không ghi đè im lặng
  if (!body.force && typeof body.baseAt === 'number' && cur.updatedAt > body.baseAt) return sendJson(res, 409, {success: false, message: 'Danh sách vừa được sửa ở máy hoặc tab khác.', updatedAt: cur.updatedAt});
  const doc = {...normalizeDoc(body), updatedAt: Date.now()};
  await store.put(key, doc);
  return sendJson(res, 200, doc);
}

module.exports = {handleStaff, normalizeDoc, keyFor};
