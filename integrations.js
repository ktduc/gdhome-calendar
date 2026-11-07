'use strict';
// =========================================================================
// TÍCH HỢP NGOÀI: NOTION (đồng bộ lịch) + AI (đề xuất tiến độ từ ảnh / Excel)
// Cấu hình bằng biến môi trường trên Render (không lưu khoá trong code):
//   NOTION_TOKEN, NOTION_DATABASE_ID          -> bật đồng bộ Notion
//   ANTHROPIC_API_KEY, AI_MODEL (tuỳ chọn)    -> bật AI lập tiến độ
//   AI_DAILY_LIMIT (mặc định 40 lượt/người/ngày), AI_ALLOWED_EMAILS (tuỳ chọn)
// =========================================================================

const NOTION_TOKEN = (process.env.NOTION_TOKEN || '').trim();
const NOTION_DB_RAW = (process.env.NOTION_DATABASE_ID || '').trim();
const NOTION_VERSION = '2022-06-28';
const ANTHROPIC_API_KEY = (process.env.ANTHROPIC_API_KEY || '').trim();
const AI_MODEL_ENV = (process.env.AI_MODEL || '').trim();
const AI_DAILY_LIMIT = Math.max(1, parseInt(process.env.AI_DAILY_LIMIT || '40', 10) || 40);
const AI_ALLOWED = (process.env.AI_ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// Chấp nhận cả link Notion lẫn ID 32 ký tự
function parseNotionId(raw) {
  const m = String(raw || '').replace(/-/g, '').match(/[0-9a-f]{32}/i);
  return m ? m[0] : '';
}
const NOTION_DB_ID = parseNotionId(NOTION_DB_RAW);

function features() {
  return { notion: !!(NOTION_TOKEN && NOTION_DB_ID), ai: !!ANTHROPIC_API_KEY };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// -------------------------------------------------------------------------
// NOTION
// -------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function notionApi(method, apiPath, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.notion.com/v1' + apiPath, {
      method,
      headers: {
        Authorization: `Bearer ${NOTION_TOKEN}`,
        'Notion-Version': NOTION_VERSION,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg = json.message || `Notion lỗi ${res.status}`;
      if (res.status === 401) msg = 'NOTION_TOKEN không đúng hoặc đã bị thu hồi';
      if (res.status === 404) msg = 'Không thấy database Notion. Kiểm tra NOTION_DATABASE_ID và đã bấm "Connections → thêm integration" trong database chưa';
      throw httpError(502, msg);
    }
    return json;
  }
  throw httpError(503, 'Notion đang giới hạn tốc độ, thử lại sau ít phút');
}

// Tìm (hoặc tự tạo) các cột cần thiết trong database Notion
const NOTION_FIELDS = {
  date: { names: ['Ngày', 'Thời gian', 'Date', 'Dates'], type: 'date' },
  project: { names: ['Dự án', 'Project'], type: 'rich_text' },
  stage: { names: ['Giai đoạn', 'Stage', 'Hạng mục'], type: 'rich_text' },
  progress: { names: ['Tiến độ', 'Progress', '%'], type: 'number' },
  gdId: { names: ['GDHomeID', 'GD ID'], type: 'rich_text' }
};
let _schemaCache = null;
async function getNotionSchema() {
  if (_schemaCache && Date.now() - _schemaCache.at < 5 * 60 * 1000) return _schemaCache.map;
  const db = await notionApi('GET', `/databases/${NOTION_DB_ID}`);
  const props = db.properties || {};
  const entries = Object.entries(props);
  const map = {};
  const titleEntry = entries.find(([, p]) => p.type === 'title');
  map.title = titleEntry ? titleEntry[0] : 'Name';
  const toAdd = {};
  Object.entries(NOTION_FIELDS).forEach(([key, def]) => {
    let found = entries.find(([n, p]) => def.names.some(x => x.toLowerCase() === n.toLowerCase()) && (p.type === def.type || (def.type === 'rich_text' && ['select', 'rich_text'].includes(p.type))));
    if (!found && key === 'date') found = entries.find(([, p]) => p.type === 'date');
    if (found) map[key] = { name: found[0], type: found[1].type };
    else {
      const name = def.names[0];
      toAdd[name] = { [def.type]: def.type === 'number' ? { format: 'percent' } : {} };
      map[key] = { name, type: def.type };
    }
  });
  if (Object.keys(toAdd).length) {
    await notionApi('PATCH', `/databases/${NOTION_DB_ID}`, { properties: toAdd });
  }
  _schemaCache = { at: Date.now(), map };
  return map;
}

const plain = arr => (Array.isArray(arr) ? arr.map(t => t.plain_text || '').join('') : '');
function readProp(page, field) {
  if (!field) return null;
  const p = (page.properties || {})[field.name];
  if (!p) return null;
  if (p.type === 'rich_text') return plain(p.rich_text);
  if (p.type === 'title') return plain(p.title);
  if (p.type === 'select') return p.select ? p.select.name : '';
  if (p.type === 'number') return p.number;
  if (p.type === 'date') return p.date;
  return null;
}
function writeProp(field, value) {
  if (field.type === 'number') return { number: value == null ? null : value };
  if (field.type === 'select') return { select: value ? { name: String(value).slice(0, 95).replace(/,/g, ' ') } : null };
  if (field.type === 'date') return { date: value };
  return { rich_text: value ? [{ text: { content: String(value).slice(0, 1900) } }] : [] };
}

function pageToItem(page, schema) {
  const date = readProp(page, schema.date) || {};
  const prog = readProp(page, schema.progress);
  return {
    pageId: page.id,
    url: page.url,
    name: plain(((page.properties || {})[schema.title] || {}).title),
    start: date.start ? String(date.start).slice(0, 10) : null,
    end: date.end ? String(date.end).slice(0, 10) : (date.start ? String(date.start).slice(0, 10) : null),
    project: readProp(page, schema.project) || '',
    stage: readProp(page, schema.stage) || '',
    progress: typeof prog === 'number' ? Math.round(prog * 100) : null,
    gdId: readProp(page, schema.gdId) || '',
    lastEdited: page.last_edited_time
  };
}

async function notionPull() {
  const schema = await getNotionSchema();
  const items = [];
  let cursor;
  for (let i = 0; i < 20; i++) {
    const q = await notionApi('POST', `/databases/${NOTION_DB_ID}/query`, Object.assign({ page_size: 100 }, cursor ? { start_cursor: cursor } : {}));
    (q.results || []).forEach(pg => { if (!pg.archived && !pg.in_trash) items.push(pageToItem(pg, schema)); });
    if (!q.has_more) break;
    cursor = q.next_cursor;
  }
  return items;
}

async function notionPush(list) {
  const schema = await getNotionSchema();
  // Tìm trang đã có theo GDHomeID để không tạo trùng
  const existing = await notionPull();
  const byGd = new Map(existing.filter(x => x.gdId).map(x => [x.gdId, x]));
  const byPage = new Map(existing.map(x => [x.pageId.replace(/-/g, ''), x]));
  const results = [];
  for (const it of list.slice(0, 400)) {
    if (!it || !it.gdId || !it.start) continue;
    const properties = {
      [schema.title]: { title: [{ text: { content: String(it.name || '(Không tên)').slice(0, 1900) } }] },
      [schema.date.name]: { date: { start: it.start, end: it.end && it.end !== it.start ? it.end : null } },
      [schema.project.name]: writeProp(schema.project, it.project || ''),
      [schema.stage.name]: writeProp(schema.stage, it.stage || ''),
      [schema.progress.name]: writeProp(schema.progress, typeof it.progress === 'number' ? it.progress / 100 : null),
      [schema.gdId.name]: writeProp(schema.gdId, it.gdId)
    };
    const known = (it.notionPageId && byPage.get(String(it.notionPageId).replace(/-/g, ''))) || byGd.get(it.gdId);
    let page;
    try {
      if (known) page = await notionApi('PATCH', `/pages/${known.pageId}`, { properties });
      else page = await notionApi('POST', '/pages', { parent: { database_id: NOTION_DB_ID }, properties });
      results.push({ gdId: it.gdId, pageId: page.id, lastEdited: page.last_edited_time, created: !known });
    } catch (e) {
      results.push({ gdId: it.gdId, error: e.message });
    }
    await sleep(340); // Notion giới hạn ~3 lượt/giây
  }
  return results;
}

// -------------------------------------------------------------------------
// AI ĐỀ XUẤT TIẾN ĐỘ (Anthropic Messages API)
// -------------------------------------------------------------------------
let _modelCache = null;
async function resolveModel() {
  if (AI_MODEL_ENV) return AI_MODEL_ENV;
  if (_modelCache) return _modelCache;
  try {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=50', {
      headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' }
    });
    const json = await res.json();
    const ids = (json.data || []).map(m => m.id);
    _modelCache = ids.find(id => /sonnet/i.test(id)) || ids[0] || 'claude-sonnet-5-5';
  } catch (e) {
    _modelCache = 'claude-sonnet-5-5';
  }
  return _modelCache;
}

const _usage = new Map(); // email -> { day, count }
function checkAiQuota(userKey) {
  const key = String(userKey || 'shared').toLowerCase();
  if (AI_ALLOWED.length && !AI_ALLOWED.includes(key)) throw httpError(403, 'Tài khoản này chưa được bật AI (AI_ALLOWED_EMAILS)');
  const day = new Date().toISOString().slice(0, 10);
  const u = _usage.get(key);
  if (!u || u.day !== day) { _usage.set(key, { day, count: 1 }); return; }
  if (u.count >= AI_DAILY_LIMIT) throw httpError(429, `Đã dùng hết ${AI_DAILY_LIMIT} lượt AI hôm nay`);
  u.count++;
}

const AI_SYSTEM = `Bạn là kỹ sư lập tiến độ thi công nội thất & cải tạo nhà ở Việt Nam (công ty GD HOME).
Nhiệm vụ: đọc tài liệu người dùng gửi (ảnh bảng khối lượng, báo giá, bản vẽ, ảnh tiến độ cũ, file Excel đã chuyển thành văn bản, ghi chú) rồi lọc ra các HẠNG MỤC CÔNG VIỆC cần làm và đề xuất tiến độ.
Quy tắc:
- Gộp các dòng vật tư lặt vặt thành hạng mục thi công có ý nghĩa (vd "Thi công trần thạch cao", "Sơn bả hoàn thiện"). Bỏ dòng tổng tiền, thuế, ghi chú không phải công việc.
- Sắp đúng trình tự thi công thực tế (khảo sát/thiết kế → phá dỡ → điện nước âm → xây trát/chống thấm → trần → ốp lát → sơn → lắp đồ gỗ → thiết bị → vệ sinh bàn giao), chỉ giữ hạng mục có liên quan tài liệu.
- workDays = số NGÀY LÀM VIỆC hợp lý (số nguyên ≥ 1, có thể 0.5). Không tính ngày nghỉ.
- dependsOn = danh sách số thứ tự (bắt đầu từ 0) các việc phải xong trước (FS) hoặc bắt đầu cùng (SS). Cho phép chạy song song khi hợp lý.
- Nếu có tổng số ngày làm việc mục tiêu thì tổng đường găng phải vừa khít hoặc ngắn hơn.
- Tên công việc tiếng Việt ngắn gọn (≤ 60 ký tự).
- Nếu thiếu thông tin quan trọng, vẫn đề xuất phương án hợp lý nhất và ghi câu hỏi vào "questions".
Chỉ trả về MỘT khối JSON hợp lệ, không thêm chữ nào khác, theo mẫu:
{"stageName":"...","summary":"1-2 câu tóm tắt","tasks":[{"name":"...","workDays":3,"dependsOn":[{"index":0,"type":"FS","lag":0}],"note":"..."}],"questions":["..."]}`;

function extractJson(text) {
  const s = String(text || '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw httpError(502, 'AI không trả về dữ liệu đúng định dạng, thử lại');
  return JSON.parse(s.slice(start, end + 1));
}

async function aiSchedule(body, userKey) {
  const content = [];
  const images = Array.isArray(body.images) ? body.images.slice(0, 6) : [];
  images.forEach(img => {
    const mt = String(img.mediaType || '');
    if (!/^image\/(png|jpeg|webp|gif)$/.test(mt) || !img.data) return;
    content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: String(img.data) } });
  });
  const pdfs = Array.isArray(body.pdfs) ? body.pdfs.slice(0, 2) : [];
  pdfs.forEach(p => { if (p && p.data) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: String(p.data) } }); });
  const lines = [];
  if (body.sheetText) lines.push('NỘI DUNG FILE EXCEL/CSV:\n' + String(body.sheetText).slice(0, 60000));
  if (body.notes) lines.push('GHI CHÚ CỦA NGƯỜI DÙNG: ' + String(body.notes).slice(0, 4000));
  if (body.projectName) lines.push('Tên dự án: ' + String(body.projectName).slice(0, 200));
  if (body.startDate) lines.push('Ngày bắt đầu: ' + String(body.startDate).slice(0, 10));
  if (body.targetWorkDays) lines.push(`Tổng số ngày làm việc mục tiêu: ${Number(body.targetWorkDays)} ngày (phải vừa trong khoảng này).`);
  else lines.push('Không có hạn chót: tự đề xuất thời lượng hợp lý.');
  if (!content.length && !body.sheetText && !body.notes) throw httpError(400, 'Hãy chọn ảnh / file Excel hoặc nhập mô tả công việc');
  content.push({ type: 'text', text: lines.join('\n\n') + '\n\nHãy lập danh sách công việc và trả về JSON.' });
  checkAiQuota(userKey);

  const model = await resolveModel();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8000, system: AI_SYSTEM, messages: [{ role: 'user', content }] })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json.error && json.error.message) || `AI lỗi ${res.status}`;
    if (res.status === 401) throw httpError(502, 'ANTHROPIC_API_KEY không đúng');
    throw httpError(502, msg);
  }
  const text = (json.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  const plan = extractJson(text);
  if (!Array.isArray(plan.tasks)) plan.tasks = [];
  plan.tasks = plan.tasks.slice(0, 120).map(t => ({
    name: String(t.name || '').slice(0, 120),
    workDays: Math.max(0.5, Math.min(365, Math.round((Number(t.workDays) || 1) * 2) / 2)),
    dependsOn: (Array.isArray(t.dependsOn) ? t.dependsOn : []).map(d => (typeof d === 'number' ? { index: d, type: 'FS', lag: 0 } : d))
      .filter(d => d && Number.isInteger(Number(d.index)))
      .map(d => ({ index: Number(d.index), type: d.type === 'SS' ? 'SS' : 'FS', lag: Math.round(Number(d.lag) || 0) })),
    note: String(t.note || '').slice(0, 300)
  })).filter(t => t.name);
  plan.questions = Array.isArray(plan.questions) ? plan.questions.slice(0, 6).map(String) : [];
  plan.model = model;
  return plan;
}

// -------------------------------------------------------------------------
// ROUTER: trả về true nếu đã xử lý
// -------------------------------------------------------------------------
async function handleIntegrations(req, res, urlPath, ctx) {
  const { sendJson, readJsonBody, dataKey } = ctx;
  if (urlPath === '/api/notion/pull' && req.method === 'GET') {
    if (!features().notion) throw httpError(400, 'Chưa cấu hình NOTION_TOKEN / NOTION_DATABASE_ID trên server');
    sendJson(res, 200, { success: true, items: await notionPull() });
    return true;
  }
  if (urlPath === '/api/notion/push' && req.method === 'POST') {
    if (!features().notion) throw httpError(400, 'Chưa cấu hình NOTION_TOKEN / NOTION_DATABASE_ID trên server');
    const body = await readJsonBody(req);
    const results = await notionPush(Array.isArray(body.items) ? body.items : []);
    sendJson(res, 200, { success: true, results });
    return true;
  }
  if (urlPath === '/api/ai/schedule' && req.method === 'POST') {
    if (!features().ai) throw httpError(400, 'Chưa cấu hình ANTHROPIC_API_KEY trên server');
    const body = await readJsonBody(req);
    const plan = await aiSchedule(body, dataKey);
    sendJson(res, 200, { success: true, plan });
    return true;
  }
  return false;
}

module.exports = { features, handleIntegrations, parseNotionId, extractJson };
