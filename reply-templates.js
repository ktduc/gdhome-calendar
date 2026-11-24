// Mẫu trả lời khách (/mau-tra-loi): mẫu anh Đức sửa/thêm/xoá lưu riêng từng tài khoản (reply-v1-<hash>).
// Mẫu gốc nằm ở mau-tra-loi-data.js; ở đây chỉ giữ phần ghi đè/bổ sung theo id và danh sách id gốc đã xoá.
const crypto = require('node:crypto');

const MAX_TEMPLATES = 300;
const keyFor = dataKey => 'reply-v1-' + crypto.createHash('sha256').update(String(dataKey)).digest('hex').slice(0, 24);
const str = (value, max) => typeof value === 'string' ? value.replace(/\r/g, '').slice(0, max) : '';
const ID = /^[\w-]{1,60}$/;

function normalizeTemplate(t) {
  if (!t || typeof t !== 'object' || !ID.test(String(t.id || ''))) return null;
  const items = (Array.isArray(t.items) ? t.items : []).slice(0, 40).map(x => str(x, 800).trim()).filter(Boolean);
  const title = str(t.title, 100).trim();
  if (!title) return null;
  return {id: t.id, group: str(t.group, 50).trim() || 'Khác', title, body: str(t.body, 4000), items,
    style: ['num', 'dash', 'block'].includes(t.style) ? t.style : 'num'};
}

function normalizeDoc(body) {
  const seen = new Set();
  const items = (Array.isArray(body?.items) ? body.items : []).slice(0, MAX_TEMPLATES).map(normalizeTemplate)
    .filter(t => t && !seen.has(t.id) && seen.add(t.id));
  const deleted = [...new Set((Array.isArray(body?.deleted) ? body.deleted : []).filter(id => ID.test(String(id))))].slice(0, MAX_TEMPLATES);
  return {items, deleted};
}

async function handleReplyTemplates(req, res, urlPath, {store, dataKey, readJsonBody, sendJson}) {
  if (urlPath !== '/api/reply-templates') return sendJson(res, 404, {success: false, message: 'API không tồn tại'});
  const key = keyFor(dataKey);
  if (req.method === 'GET') return sendJson(res, 200, normalizeDoc(await store.get(key)));
  if (req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!Array.isArray(body?.items) || body.items.length > MAX_TEMPLATES) {
      return sendJson(res, 400, {success: false, message: 'Danh sách mẫu không hợp lệ (tối đa ' + MAX_TEMPLATES + ' mẫu).'});
    }
    const doc = normalizeDoc(body);
    await store.put(key, doc);
    return sendJson(res, 200, doc);
  }
  return sendJson(res, 405, {success: false, message: 'Phương thức không hỗ trợ'});
}

module.exports = {handleReplyTemplates, normalizeDoc, normalizeTemplate, keyFor, MAX_TEMPLATES};
