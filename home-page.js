// Trang chủ (/tools): ảnh bìa dùng chung cho mọi tài khoản, chỉ admin được đổi.
// Admin = ADMIN_EMAILS (env) hoặc email đầu trong ALLOWED_EMAILS; chưa cấu hình thì người đầu tiên đặt ảnh bìa giữ quyền.
const KEY = 'home-v1';
const MAX_COVER = 1_500_000;   // data URL ảnh JPEG/WebP đã nén ở trình duyệt (~1.1 MB ảnh)
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

function adminOf(doc, admins) {
  return admins.length ? admins : (doc.owner ? [doc.owner] : []);
}

async function handleHome(req, res, {store, dataKey, admins, readJsonBody, sendJson}) {
  const doc = await store.get(KEY) || {};
  const list = adminOf(doc, admins);
  const canEdit = !!dataKey && (!list.length || list.includes(dataKey));
  if (req.method === 'GET') return sendJson(res, 200, {cover: doc.cover || '', position: doc.position || 50, canEdit});
  if (req.method !== 'POST') return sendJson(res, 405, {message: 'Phương thức không hỗ trợ'});
  if (!canEdit) return sendJson(res, 403, {message: 'Chỉ tài khoản quản trị được đổi ảnh bìa.'});
  const body = await readJsonBody(req);
  const cover = String(body?.cover ?? doc.cover ?? '');
  if (cover && (cover.length > MAX_COVER || !IMAGE.test(cover))) return sendJson(res, 400, {message: 'Ảnh bìa không hợp lệ hoặc quá lớn.'});
  const position = Math.min(100, Math.max(0, Number(body?.position ?? doc.position ?? 50) || 0));
  const next = {cover, position, owner: doc.owner || (admins.length ? '' : dataKey), updatedAt: new Date().toISOString()};
  await store.put(KEY, next);
  return sendJson(res, 200, {cover, position, canEdit: true});
}

module.exports = {handleHome, KEY};
