// Khảo sát nhu cầu trước thiết kế: mỗi dự án có 1 link riêng /khao-sat/<token> cho khách (không cần đăng nhập).
// Lưu: 'survey-v1-<hash dataKey>' = {projects:{<projectId>:{token,name,answers,createdAt,updatedAt,submittedAt}}}
//      'survey-index-v1' = {tokens:{<sha256(token)>:{k:dataKey,p:projectId}}} để tra token -> tài khoản + dự án.
// Route công khai chỉ đọc/ghi đúng khảo sát của token; không trả dữ liệu nào khác của dự án/tài khoản.
const crypto = require('node:crypto');
const {cleanAnswers, QUESTION_BY_ID} = require('./khao-sat-data');

const INDEX_KEY = 'survey-index-v1';
const MAX_BODY = 64 * 1024;
const sha = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const keyFor = dataKey => 'survey-v1-' + sha(dataKey).slice(0, 24);
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/;
const PROJECT_ID = /^[\w.-]{1,80}$/;
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };

// Ghi index + hồ sơ khảo sát tuần tự trong 1 tiến trình để 2 lần tạo link cùng lúc không đè nhau.
let chain = Promise.resolve();
const exclusive = job => { const run = chain.then(job); chain = run.catch(() => {}); return run; };

const publicEntry = entry => ({name: entry.name || '', answers: entry.answers || {}, updatedAt: entry.updatedAt || 0, submittedAt: entry.submittedAt || 0});

async function find(store, token) {
  if (!TOKEN.test(token)) fail(404, 'Link không hợp lệ.');
  const hit = (await store.get(INDEX_KEY))?.tokens?.[sha(token)];
  const entry = hit && (await store.get(keyFor(hit.k)))?.projects?.[hit.p];
  if (!entry || entry.token !== token) fail(404, 'Link khảo sát không tồn tại hoặc đã bị thu hồi.');
  return {hit, entry};
}

async function readBody(req, readJsonBody) {
  if (Number(req.headers['content-length'] || 0) > MAX_BODY) fail(413, 'Dữ liệu gửi lên quá lớn.');
  const body = await readJsonBody(req);
  if (JSON.stringify(body).length > MAX_BODY) fail(413, 'Dữ liệu gửi lên quá lớn.');
  return body;
}

// /api/survey/<token>: GET đọc câu trả lời đã lưu, POST {answers, submit} lưu nháp / gửi
async function handleSurveyPublic(req, res, urlPath, {store, readJsonBody, sendJson}) {
  const match = /^\/api\/survey\/([^/]+)$/.exec(urlPath);
  if (!match) fail(404, 'API không tồn tại');
  const token = match[1];
  if (req.method === 'GET') return sendJson(res, 200, publicEntry((await find(store, token)).entry));
  if (req.method !== 'POST') fail(405, 'Phương thức không hỗ trợ');
  const body = await readBody(req, readJsonBody);
  const answers = cleanAnswers(body?.answers);
  const entry = await exclusive(async () => {
    const {hit} = await find(store, token);
    const doc = await store.get(keyFor(hit.k));
    const current = doc.projects[hit.p];
    current.answers = answers;
    current.updatedAt = Date.now();
    if (body?.submit === true) current.submittedAt = current.updatedAt;
    await store.put(keyFor(hit.k), doc);
    return current;
  });
  return sendJson(res, 200, publicEntry(entry));
}

// /api/surveys/link (POST {projectId, name}) tạo/lấy link; /api/surveys (GET) danh sách khảo sát đã có trả lời; /api/surveys/<projectId> (GET) xem câu trả lời; cần đăng nhập
async function handleSurveyAdmin(req, res, urlPath, {store, dataKey, readJsonBody, sendJson}) {
  const key = keyFor(dataKey);
  if (urlPath === '/api/surveys/link' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const projectId = String(body?.projectId || '');
    if (!PROJECT_ID.test(projectId)) fail(400, 'Thiếu mã dự án.');
    const name = typeof body.name === 'string' ? body.name.trim().slice(0, 120) : '';
    const entry = await exclusive(async () => {
      const doc = (await store.get(key)) || {};
      doc.projects = doc.projects || {};
      let current = doc.projects[projectId];
      if (current?.token) {
        if (name && name !== current.name) { current.name = name; await store.put(key, doc); }
        return current;
      }
      const token = crypto.randomBytes(24).toString('base64url');
      current = doc.projects[projectId] = {...current, token, name, answers: current?.answers || {}, createdAt: Date.now()};
      const index = (await store.get(INDEX_KEY)) || {};
      index.tokens = {...index.tokens, [sha(token)]: {k: dataKey, p: projectId}};
      await store.put(INDEX_KEY, index);
      await store.put(key, doc);
      return current;
    });
    return sendJson(res, 200, {projectId, token: entry.token, path: '/khao-sat/' + entry.token, ...publicEntry(entry)});
  }
  if (urlPath === '/api/surveys' && req.method === 'GET') {
    // Danh sách khách đã có câu trả lời (đang điền / đã gửi), mới nhất trước
    const projects = (await store.get(key))?.projects || {};
    const surveys = Object.entries(projects).filter(([, e]) => e.updatedAt || e.submittedAt)
      .map(([projectId, e]) => ({projectId, token: e.token, path: '/khao-sat/' + e.token, ...publicEntry(e)}))
      .sort((a, b) => Math.max(b.updatedAt, b.submittedAt) - Math.max(a.updatedAt, a.submittedAt));
    return sendJson(res, 200, {surveys});
  }
  const match = /^\/api\/surveys\/([^/]+)$/.exec(urlPath);
  if (match && req.method === 'GET') {
    let projectId = '';
    try { projectId = decodeURIComponent(match[1]); } catch { /* id hỏng -> báo như chưa có */ }
    if (!PROJECT_ID.test(projectId)) fail(400, 'Mã dự án không hợp lệ.');
    const entry = (await store.get(key))?.projects?.[projectId];
    return sendJson(res, 200, entry ? {projectId, token: entry.token, path: '/khao-sat/' + entry.token, ...publicEntry(entry)}
      : {projectId, token: null, path: '', name: '', answers: {}, updatedAt: 0, submittedAt: 0});
  }
  return sendJson(res, 404, {success: false, message: 'API không tồn tại'});
}

// /api/survey-images: ảnh minh hoạ phong cách dùng chung mọi phiếu (khách xem không cần đăng nhập), chỉ quản trị được dán / đổi
const IMAGES_KEY = 'survey-images-v1';
const IMAGE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const MAX_IMAGE = 400_000;   // ảnh đã nén ở trình duyệt (~300 KB)
async function handleSurveyImages(req, res, {store, dataKey, admins, readJsonBody, sendJson}) {
  const doc = await store.get(IMAGES_KEY) || {};
  const canEdit = !!dataKey && (!admins.length || admins.includes(dataKey));
  if (req.method === 'GET') return sendJson(res, 200, {images: doc.images || {}, canEdit});
  if (req.method !== 'POST') fail(405, 'Phương thức không hỗ trợ');
  if (!canEdit) fail(403, 'Chỉ tài khoản quản trị được đổi ảnh minh hoạ.');
  const body = await readJsonBody(req);
  const key = String(body?.key || ''), image = body?.image ? String(body.image) : '';
  if (!QUESTION_BY_ID.ps_phong_cach.options.some(o => o.v === key)) fail(400, 'Phong cách không có trong phiếu.');
  if (image && (image.length > MAX_IMAGE || !IMAGE.test(image))) fail(400, 'Ảnh không hợp lệ hoặc quá lớn.');
  const images = {...doc.images};
  if (image) images[key] = image; else delete images[key];
  await store.put(IMAGES_KEY, {images, updatedAt: new Date().toISOString()});
  return sendJson(res, 200, {images, canEdit});
}

module.exports = {handleSurveyPublic, handleSurveyAdmin, keyFor, INDEX_KEY, handleSurveyImages};
