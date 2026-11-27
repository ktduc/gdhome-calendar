// Vẽ hiện trạng (/ve-hien-trang): mỗi tài khoản 1 danh mục + mỗi bản vẽ 1 khoá riêng.
// 'plan-idx-v1-<hash>' = {plans:{<id>:{name,projectId,updatedAt,rooms}}}; 'plan-v1-<hash>-<id>' = {id,name,projectId,data,updatedAt}
const crypto = require('node:crypto');

const hash = dataKey => crypto.createHash('sha256').update(String(dataKey)).digest('hex').slice(0, 24);
const indexKey = dataKey => 'plan-idx-v1-' + hash(dataKey);
const planKey = (dataKey, id) => 'plan-v1-' + hash(dataKey) + '-' + id;
const ID = /^[\w-]{6,60}$/;
const PROJECT_ID = /^[\w.-]{1,80}$/;
const MAX_PLAN = 1024 * 1024;   // shortcut: 1 MB JSON / bản vẽ (lưu Gist), đợt 2 có ảnh thì ảnh lên B2
const MAX_PLANS = 500;
const fail = (status, message) => { throw Object.assign(new Error(message), {status}); };
const str = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';

// Ghi danh mục tuần tự để 2 lần lưu cùng lúc không đè nhau
let chain = Promise.resolve();
const exclusive = job => { const run = chain.then(job); chain = run.catch(() => {}); return run; };

const roomCount = data => (Array.isArray(data?.floors) ? data.floors : []).reduce((n, f) => n + (Array.isArray(f?.rooms) ? f.rooms.length : 0), 0);

async function handleSitePlans(req, res, urlPath, {store, dataKey, readJsonBody, sendJson}) {
  if (urlPath === '/api/site-plans' && req.method === 'GET') {
    const plans = Object.entries((await store.get(indexKey(dataKey)))?.plans || {})
      .map(([id, p]) => ({id, ...p})).sort((a, b) => b.updatedAt - a.updatedAt);
    return sendJson(res, 200, {plans});
  }
  const match = /^\/api\/site-plans\/([^/]+)(\/delete)?$/.exec(urlPath);
  if (!match || !ID.test(match[1])) fail(404, 'Bản vẽ không tồn tại.');
  const id = match[1];
  if (req.method === 'GET' && !match[2]) {
    const doc = await store.get(planKey(dataKey, id));
    if (!doc) fail(404, 'Bản vẽ không tồn tại hoặc đã bị xoá.');
    return sendJson(res, 200, doc);
  }
  if (req.method !== 'POST') fail(405, 'Phương thức không hỗ trợ');
  if (match[2]) {
    await exclusive(async () => {
      const index = (await store.get(indexKey(dataKey))) || {};
      if (index.plans) delete index.plans[id];
      await store.put(indexKey(dataKey), index);
      await store.put(planKey(dataKey, id), null);
    });
    return sendJson(res, 200, {success: true});
  }
  const body = await readJsonBody(req);
  if (!body?.data || typeof body.data !== 'object' || Array.isArray(body.data)) fail(400, 'Thiếu dữ liệu bản vẽ.');
  if (JSON.stringify(body.data).length > MAX_PLAN) fail(413, 'Bản vẽ quá lớn (> 1 MB).');
  const name = str(body.name, 120) || 'Bản vẽ chưa đặt tên';
  const projectId = PROJECT_ID.test(String(body.projectId || '')) ? body.projectId : '';
  const doc = {id, name, projectId, data: body.data, updatedAt: Date.now()};
  await exclusive(async () => {
    const index = (await store.get(indexKey(dataKey))) || {};
    index.plans ||= {};
    if (!index.plans[id] && Object.keys(index.plans).length >= MAX_PLANS) fail(400, 'Đã đủ ' + MAX_PLANS + ' bản vẽ, xoá bớt bản cũ trước.');
    index.plans[id] = {name, projectId, updatedAt: doc.updatedAt, rooms: roomCount(body.data)};
    await store.put(planKey(dataKey, id), doc);
    await store.put(indexKey(dataKey), index);
  });
  return sendJson(res, 200, {id, updatedAt: doc.updatedAt});
}

module.exports = {handleSitePlans, indexKey, planKey};
