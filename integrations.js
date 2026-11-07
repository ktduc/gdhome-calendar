'use strict';
// =========================================================================
// TÍCH HỢP NGOÀI: NOTION (đồng bộ lịch) + AI (đề xuất tiến độ từ ảnh / Excel / PDF)
// 2 cách cấu hình (ưu tiên cách 1):
//  1. Mỗi người tự dán khoá ngay trong app (File ▾ → Đồng bộ Notion / nút ✨ AI → ⚙ Kết nối).
//     Khoá được MÃ HOÁ (AES-256-GCM) rồi lưu trên server (Gist bí mật), trình duyệt không đọc lại được.
//  2. Biến môi trường trên Render dùng chung cho mọi người:
//     NOTION_TOKEN, NOTION_DATABASE_ID ; ANTHROPIC_API_KEY | OPENAI_API_KEY | GEMINI_API_KEY, AI_MODEL
//     AI_DAILY_LIMIT (mặc định 40 lượt/người/ngày, chỉ áp dụng khoá chung), AI_ALLOWED_EMAILS
// =========================================================================
const crypto = require('crypto');

const ENV = {
  notionToken: (process.env.NOTION_TOKEN || '').trim(),
  notionDb: (process.env.NOTION_DATABASE_ID || '').trim(),
  anthropic: (process.env.ANTHROPIC_API_KEY || '').trim(),
  openai: (process.env.OPENAI_API_KEY || '').trim(),
  gemini: (process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY || '').trim(),
  aiModel: (process.env.AI_MODEL || '').trim()
};
const NOTION_VERSION = '2022-06-28';
const AI_DAILY_LIMIT = Math.max(1, parseInt(process.env.AI_DAILY_LIMIT || '40', 10) || 40);
const AI_ALLOWED = (process.env.AI_ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const PROVIDERS = ['gemini', 'openai', 'anthropic'];
const PROVIDER_LABEL = { gemini: 'Google Gemini', openai: 'ChatGPT (OpenAI)', anthropic: 'Claude (Anthropic)' };

// Chấp nhận cả link Notion lẫn ID 32 ký tự
function parseNotionId(raw) {
  const str = String(raw || '').split('?')[0];
  const all = str.replace(/-/g, '').match(/[0-9a-f]{32}/gi);
  return all ? all[all.length - 1] : '';
}

function envAiProvider() {
  if (ENV.anthropic) return 'anthropic';
  if (ENV.openai) return 'openai';
  if (ENV.gemini) return 'gemini';
  return '';
}

function features() {
  // Từ nay mỗi người tự kết nối được -> luôn bật nút; trạng thái chi tiết ở /api/integrations/settings
  return { notion: true, ai: true, notionShared: !!(ENV.notionToken && parseNotionId(ENV.notionDb)), aiShared: !!envAiProvider() };
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

// ------------------------- Lưu khoá riêng từng người (mã hoá) -------------------------
let _secret = 'gdhome';
function setSecret(sec) { _secret = String(sec || 'gdhome'); }
function encKey() { return crypto.createHash('sha256').update('gdhome-integrations|' + _secret).digest(); }
function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return [iv, c.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
function decrypt(str) {
  try {
    const [iv, tag, data] = String(str).split('.').map(x => Buffer.from(x, 'base64'));
    const d = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
    d.setAuthTag(tag);
    return JSON.parse(Buffer.concat([d.update(data), d.final()]).toString('utf8'));
  } catch (e) {
    return null; // khoá server đổi -> người dùng nhập lại
  }
}
const cfgKey = dataKey => 'cfg-' + String(dataKey || 'shared');
async function loadUserCfg(store, dataKey) {
  const raw = await store.get(cfgKey(dataKey)).catch(() => null);
  if (!raw || !raw.secrets) return {};
  return decrypt(raw.secrets) || {};
}
async function saveUserCfg(store, dataKey, cfg) {
  const cur = await store.get(cfgKey(dataKey)).catch(() => null);
  await store.put(cfgKey(dataKey), { _version: ((cur && cur._version) || 0) + 1, _updatedAt: new Date().toISOString(), secrets: encrypt(cfg) });
}

function resolveNotion(cfg) {
  if (cfg.notionToken && cfg.notionDb) return { token: cfg.notionToken, dbId: parseNotionId(cfg.notionDb), source: 'user' };
  if (ENV.notionToken && parseNotionId(ENV.notionDb)) return { token: ENV.notionToken, dbId: parseNotionId(ENV.notionDb), source: 'env' };
  return null;
}
function resolveAi(cfg) {
  if (cfg.aiProvider && cfg.aiKey) return { provider: cfg.aiProvider, key: cfg.aiKey, model: cfg.aiModel || '', source: 'user' };
  const p = envAiProvider();
  if (p) return { provider: p, key: ENV[p], model: ENV.aiModel, source: 'env' };
  return null;
}
const mask = k => (k ? '••••' + String(k).slice(-4) : '');

// -------------------------------------------------------------------------
// NOTION
// -------------------------------------------------------------------------
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function notionApi(nc, method, apiPath, body) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch('https://api.notion.com/v1' + apiPath, {
      method,
      headers: { Authorization: `Bearer ${nc.token}`, 'Notion-Version': NOTION_VERSION, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    });
    if (res.status === 429) { await sleep(1000 * (attempt + 1)); continue; }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg = json.message || `Notion lỗi ${res.status}`;
      if (res.status === 401) msg = 'Mã Notion không đúng, đã hết hạn hoặc đã bị thu hồi';
      if (res.status === 404) msg = 'Không thấy database Notion. Kiểm tra link (phải là link của BẢNG database). Nếu dùng mã Internal connection thì phải vào database → ••• → Connections → + Add connection';
      if (res.status === 400 && /is a page, not a database/i.test(msg)) msg = 'Link đang là 1 TRANG Notion, không phải database. Hãy tạo bảng (database) rồi copy link của bảng.';
      throw httpError(400, msg);
    }
    return json;
  }
  throw httpError(503, 'Notion đang giới hạn tốc độ, thử lại sau ít phút');
}

// Tìm (hoặc tự tạo) các cột cần thiết trong database Notion.
// Dự án / Giai đoạn là cột Select để trên Notion nhóm (Group by) như 1 dự án lớn.
const NOTION_FIELDS = {
  date: { names: ['Ngày', 'Thời gian', 'Date', 'Dates'], type: 'date' },
  project: { names: ['Dự án', 'Project'], type: 'select' },
  stage: { names: ['Giai đoạn', 'Stage', 'Hạng mục'], type: 'select' },
  progress: { names: ['Tiến độ', 'Progress', '%'], type: 'number' },
  gdId: { names: ['GDHomeID', 'GD ID'], type: 'rich_text' }
};
const _schemaCache = new Map();
async function getNotionSchema(nc) {
  const hit = _schemaCache.get(nc.dbId);
  if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.map;
  const db = await notionApi(nc, 'GET', `/databases/${nc.dbId}`);
  const entries = Object.entries(db.properties || {});
  const map = { dbTitle: plain(db.title), dbUrl: db.url };
  const titleEntry = entries.find(([, p]) => p.type === 'title');
  map.title = titleEntry ? titleEntry[0] : 'Name';
  const toAdd = {};
  Object.entries(NOTION_FIELDS).forEach(([key, def]) => {
    const okTypes = def.type === 'number' || def.type === 'date' ? [def.type] : ['select', 'rich_text', 'multi_select'];
    let found = entries.find(([n, p]) => def.names.some(x => x.toLowerCase() === n.toLowerCase()) && okTypes.includes(p.type));
    if (!found && key === 'date') found = entries.find(([, p]) => p.type === 'date');
    if (found) map[key] = { name: found[0], type: found[1].type };
    else {
      const name = def.names[0];
      toAdd[name] = { [def.type]: def.type === 'number' ? { format: 'percent' } : {} };
      map[key] = { name, type: def.type };
    }
  });
  if (Object.keys(toAdd).length) await notionApi(nc, 'PATCH', `/databases/${nc.dbId}`, { properties: toAdd });
  _schemaCache.set(nc.dbId, { at: Date.now(), map });
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
  if (p.type === 'multi_select') return (p.multi_select || []).map(x => x.name).join(', ');
  if (p.type === 'number') return p.number;
  if (p.type === 'date') return p.date;
  return null;
}
function writeProp(field, value) {
  const v = value == null ? '' : String(value);
  if (field.type === 'number') return { number: value == null ? null : value };
  if (field.type === 'select') return { select: v ? { name: v.slice(0, 95).replace(/,/g, ' ') } : null };
  if (field.type === 'multi_select') return { multi_select: v ? [{ name: v.slice(0, 95).replace(/,/g, ' ') }] : [] };
  if (field.type === 'date') return { date: value };
  return { rich_text: v ? [{ text: { content: v.slice(0, 1900) } }] : [] };
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

async function notionPull(nc) {
  const schema = await getNotionSchema(nc);
  const items = [];
  let cursor;
  for (let i = 0; i < 20; i++) {
    const q = await notionApi(nc, 'POST', `/databases/${nc.dbId}/query`, Object.assign({ page_size: 100 }, cursor ? { start_cursor: cursor } : {}));
    (q.results || []).forEach(pg => { if (!pg.archived && !pg.in_trash) items.push(pageToItem(pg, schema)); });
    if (!q.has_more) break;
    cursor = q.next_cursor;
  }
  return items;
}

async function notionPush(nc, list) {
  const schema = await getNotionSchema(nc);
  const existing = await notionPull(nc); // tìm trang đã có theo GDHomeID để không tạo trùng
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
    try {
      const page = known
        ? await notionApi(nc, 'PATCH', `/pages/${known.pageId}`, { properties })
        : await notionApi(nc, 'POST', '/pages', { parent: { database_id: nc.dbId }, properties });
      results.push({ gdId: it.gdId, pageId: page.id, lastEdited: page.last_edited_time, created: !known });
    } catch (e) {
      results.push({ gdId: it.gdId, error: e.message });
    }
    await sleep(340); // Notion giới hạn ~3 lượt/giây
  }
  return { results, dbUrl: schema.dbUrl };
}

// -------------------------------------------------------------------------
// AI ĐỀ XUẤT TIẾN ĐỘ: Gemini / ChatGPT / Claude (khoá API của người dùng hoặc khoá chung)
// -------------------------------------------------------------------------
const _modelCache = new Map();
const verNum = v => v.split('.').map(Number).reduce((a, x, i) => a + x / Math.pow(1000, i), 0);

async function listModels(ai) {
  if (ai.provider === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/models?limit=100', { headers: { 'x-api-key': ai.key, 'anthropic-version': '2023-06-01' } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw httpError(400, res.status === 401 ? 'API key Claude không đúng' : ((json.error && json.error.message) || `Claude lỗi ${res.status}`));
    return (json.data || []).map(m => m.id);
  }
  if (ai.provider === 'openai') {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${ai.key}` } });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw httpError(400, res.status === 401 ? 'API key OpenAI (ChatGPT) không đúng' : ((json.error && json.error.message) || `OpenAI lỗi ${res.status}`));
    return (json.data || []).map(m => m.id);
  }
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': ai.key } });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(400, res.status === 400 || res.status === 403 ? 'API key Gemini không đúng' : ((json.error && json.error.message) || `Gemini lỗi ${res.status}`));
  return (json.models || []).filter(m => (m.supportedGenerationMethods || []).includes('generateContent')).map(m => String(m.name).replace(/^models\//, ''));
}

function pickModel(provider, ids) {
  const best = (re) => ids.map(id => ({ id, m: id.match(re) })).filter(x => x.m).sort((a, b) => verNum(b.m[1]) - verNum(a.m[1]))[0];
  if (provider === 'anthropic') return ids.find(id => /sonnet/i.test(id)) || ids[0] || 'claude-sonnet-5-5';
  if (provider === 'openai') {
    const b = best(/^gpt-(\d+(?:\.\d+)?)$/) || best(/^gpt-(\d+(?:\.\d+)?)o?$/);
    return b ? b.id : 'gpt-4o';
  }
  const b = best(/^gemini-(\d+(?:\.\d+)?)-flash$/);
  return b ? b.id : 'gemini-2.5-flash';
}

async function resolveModel(ai) {
  if (ai.model) return ai.model;
  const ck = ai.provider + '|' + ai.key.slice(-6);
  if (_modelCache.has(ck)) return _modelCache.get(ck);
  let model;
  try { model = pickModel(ai.provider, await listModels(ai)); } catch (e) { model = pickModel(ai.provider, []); }
  _modelCache.set(ck, model);
  return model;
}

const _usage = new Map(); // email -> { day, count }
function checkSharedQuota(userKey) {
  const key = String(userKey || 'shared').toLowerCase();
  if (AI_ALLOWED.length && !AI_ALLOWED.includes(key)) throw httpError(403, 'Tài khoản này chưa được dùng khoá AI chung. Hãy bấm ⚙ Kết nối AI và dán API key của riêng mình.');
  const day = new Date().toISOString().slice(0, 10);
  const u = _usage.get(key);
  if (!u || u.day !== day) { _usage.set(key, { day, count: 1 }); return; }
  if (u.count >= AI_DAILY_LIMIT) throw httpError(429, `Đã dùng hết ${AI_DAILY_LIMIT} lượt AI chung hôm nay`);
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

function buildPrompt(body) {
  const lines = [];
  if (body.sheetText) lines.push('NỘI DUNG FILE EXCEL/CSV:\n' + String(body.sheetText).slice(0, 60000));
  if (body.notes) lines.push('GHI CHÚ CỦA NGƯỜI DÙNG: ' + String(body.notes).slice(0, 4000));
  if (body.projectName) lines.push('Tên dự án: ' + String(body.projectName).slice(0, 200));
  if (body.startDate) lines.push('Ngày bắt đầu: ' + String(body.startDate).slice(0, 10));
  if (body.targetWorkDays) lines.push(`Tổng số ngày làm việc mục tiêu: ${Number(body.targetWorkDays)} ngày (phải vừa trong khoảng này).`);
  else lines.push('Không có hạn chót: tự đề xuất thời lượng hợp lý.');
  return lines.join('\n\n') + '\n\nHãy lập danh sách công việc và trả về JSON.';
}

async function callAnthropic(ai, model, images, pdfs, text) {
  const content = [];
  images.forEach(img => content.push({ type: 'image', source: { type: 'base64', media_type: img.mediaType, data: img.data } }));
  pdfs.forEach(p => content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: p.data } }));
  content.push({ type: 'text', text });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': ai.key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model, max_tokens: 8000, system: AI_SYSTEM, messages: [{ role: 'user', content }] })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(502, res.status === 401 ? 'API key Claude không đúng' : ((json.error && json.error.message) || `Claude lỗi ${res.status}`));
  return (json.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
}

async function callOpenAI(ai, model, images, pdfs, text) {
  const content = [{ type: 'text', text }];
  images.forEach(img => content.push({ type: 'image_url', image_url: { url: `data:${img.mediaType};base64,${img.data}` } }));
  pdfs.forEach((p, i) => content.push({ type: 'file', file: { filename: `tai-lieu-${i + 1}.pdf`, file_data: `data:application/pdf;base64,${p.data}` } }));
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${ai.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: AI_SYSTEM }, { role: 'user', content }] })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw httpError(502, res.status === 401 ? 'API key OpenAI không đúng' : ((json.error && json.error.message) || `OpenAI lỗi ${res.status}`));
  return ((json.choices || [])[0] || {}).message ? json.choices[0].message.content : '';
}

async function callGemini(ai, model, images, pdfs, text) {
  const parts = [];
  images.forEach(img => parts.push({ inline_data: { mime_type: img.mediaType, data: img.data } }));
  pdfs.forEach(p => parts.push({ inline_data: { mime_type: 'application/pdf', data: p.data } }));
  parts.push({ text });
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': ai.key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: AI_SYSTEM }] },
      contents: [{ role: 'user', parts }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.4 }
    })
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    let msg = (json.error && json.error.message) || `Gemini lỗi ${res.status}`;
    if (res.status === 429) msg = 'Gemini báo hết hạn mức miễn phí (thử lại sau ít phút, hoặc bật thanh toán trong Google AI Studio)';
    throw httpError(502, msg);
  }
  const cand = (json.candidates || [])[0] || {};
  return ((cand.content || {}).parts || []).map(p => p.text || '').join('\n');
}

async function aiSchedule(ai, body, userKey) {
  const images = (Array.isArray(body.images) ? body.images.slice(0, 6) : [])
    .filter(img => img && img.data && /^image\/(png|jpeg|webp|gif)$/.test(String(img.mediaType || '')))
    .map(img => ({ mediaType: String(img.mediaType), data: String(img.data) }));
  const pdfs = (Array.isArray(body.pdfs) ? body.pdfs.slice(0, 2) : []).filter(p => p && p.data).map(p => ({ data: String(p.data) }));
  if (!images.length && !pdfs.length && !body.sheetText && !body.notes) throw httpError(400, 'Hãy chọn ảnh / file Excel hoặc nhập mô tả công việc');
  if (ai.source === 'env') checkSharedQuota(userKey);
  const text = buildPrompt(body);
  const model = await resolveModel(ai);
  const call = ai.provider === 'openai' ? callOpenAI : ai.provider === 'gemini' ? callGemini : callAnthropic;
  const plan = extractJson(await call(ai, model, images, pdfs, text));
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
  plan.model = `${PROVIDER_LABEL[ai.provider]} · ${model}`;
  return plan;
}

// -------------------------------------------------------------------------
// CÀI ĐẶT KẾT NỐI (mỗi tài khoản tự dán khoá)
// -------------------------------------------------------------------------
function settingsView(cfg) {
  const nc = resolveNotion(cfg);
  const ai = resolveAi(cfg);
  return {
    notion: nc ? { configured: true, source: nc.source, tokenMasked: nc.source === 'user' ? mask(cfg.notionToken) : '', db: nc.source === 'user' ? cfg.notionDb : '(dùng chung của server)', dbUrl: cfg.notionDbUrl || '' } : { configured: false },
    ai: ai ? { configured: true, source: ai.source, provider: ai.provider, providerLabel: PROVIDER_LABEL[ai.provider], keyMasked: ai.source === 'user' ? mask(cfg.aiKey) : '', model: ai.model || '' } : { configured: false },
    providers: PROVIDERS.map(id => ({ id, label: PROVIDER_LABEL[id] }))
  };
}

async function updateSettings(store, dataKey, body) {
  const cfg = await loadUserCfg(store, dataKey);
  if (body.clear === 'notion') { delete cfg.notionToken; delete cfg.notionDb; delete cfg.notionDbUrl; }
  if (body.clear === 'ai') { delete cfg.aiProvider; delete cfg.aiKey; delete cfg.aiModel; }
  if (body.notionToken !== undefined || body.notionDb !== undefined) {
    const token = String(body.notionToken || '').trim() || cfg.notionToken;
    const dbRaw = String(body.notionDb || '').trim() || cfg.notionDb;
    if (!token) throw httpError(400, 'Dán mã Notion (Personal access token hoặc API token)');
    const dbId = parseNotionId(dbRaw);
    if (!dbId) throw httpError(400, 'Link database Notion không đúng (cần link của BẢNG database, có chuỗi 32 ký tự)');
    _schemaCache.delete(dbId);
    const schema = await getNotionSchema({ token, dbId }); // kiểm tra thật trước khi lưu
    Object.assign(cfg, { notionToken: token, notionDb: dbRaw, notionDbUrl: schema.dbUrl || '' });
  }
  if (body.aiProvider !== undefined || body.aiKey !== undefined) {
    const provider = PROVIDERS.includes(body.aiProvider) ? body.aiProvider : cfg.aiProvider;
    const key = String(body.aiKey || '').trim() || (provider === cfg.aiProvider ? cfg.aiKey : '');
    if (!provider) throw httpError(400, 'Chọn nhà cung cấp AI');
    if (!key) throw httpError(400, 'Dán API key');
    const model = String(body.aiModel || '').trim();
    const ids = await listModels({ provider, key }); // kiểm tra key thật
    if (model && ids.length && !ids.includes(model)) throw httpError(400, `Không có model "${model}" trong tài khoản. Để trống để tự chọn.`);
    Object.assign(cfg, { aiProvider: provider, aiKey: key, aiModel: model });
    _modelCache.delete(provider + '|' + key.slice(-6));
  }
  await saveUserCfg(store, dataKey, cfg);
  return settingsView(cfg);
}

// -------------------------------------------------------------------------
// ROUTER: trả về true nếu đã xử lý
// -------------------------------------------------------------------------
async function handleIntegrations(req, res, urlPath, ctx) {
  const { sendJson, readJsonBody, dataKey, store } = ctx;
  if (urlPath === '/api/integrations/settings' && req.method === 'GET') {
    sendJson(res, 200, { success: true, ...settingsView(await loadUserCfg(store, dataKey)) });
    return true;
  }
  if (urlPath === '/api/integrations/settings' && req.method === 'POST') {
    const body = await readJsonBody(req);
    sendJson(res, 200, { success: true, ...(await updateSettings(store, dataKey, body)) });
    return true;
  }
  const needNotion = async () => {
    const nc = resolveNotion(await loadUserCfg(store, dataKey));
    if (!nc) throw httpError(400, 'Chưa kết nối Notion. Bấm "⚙ Kết nối Notion" để dán mã và link database.');
    return nc;
  };
  if (urlPath === '/api/notion/pull' && req.method === 'GET') {
    sendJson(res, 200, { success: true, items: await notionPull(await needNotion()) });
    return true;
  }
  if (urlPath === '/api/notion/push' && req.method === 'POST') {
    const nc = await needNotion();
    const body = await readJsonBody(req);
    sendJson(res, 200, { success: true, ...(await notionPush(nc, Array.isArray(body.items) ? body.items : [])) });
    return true;
  }
  if (urlPath === '/api/ai/schedule' && req.method === 'POST') {
    const ai = resolveAi(await loadUserCfg(store, dataKey));
    if (!ai) throw httpError(400, 'Chưa kết nối AI. Bấm "⚙ Kết nối AI" để chọn Gemini / ChatGPT / Claude và dán API key.');
    const body = await readJsonBody(req);
    sendJson(res, 200, { success: true, plan: await aiSchedule(ai, body, dataKey) });
    return true;
  }
  return false;
}

module.exports = { features, handleIntegrations, parseNotionId, extractJson, setSecret, encrypt, decrypt, pickModel };
