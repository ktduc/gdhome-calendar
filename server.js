// =========================================================================
// GD HOME - SERVER LỊCH TIẾN ĐỘ
// Chạy:  node server.js        (mặc định cổng 3000)
// Không cần cài thêm thư viện (chỉ dùng Node.js >= 18).
//
// Biến môi trường (tất cả đều tuỳ chọn):
//   PORT              Cổng chạy server (Render.com tự đặt)
//   DATA_DIR          Thư mục chứa data.json & backups (mặc định: cùng thư mục code)
//   GIST_TOKEN        Token GitHub (quyền "gist") -> dữ liệu được lưu vào 1 Gist BÍ MẬT trên GitHub,
//                     cập nhật code / Render khởi động lại KHÔNG mất dữ liệu. Gist có sẵn lịch sử phiên bản.
//   GIST_ID           (tuỳ chọn) ID Gist muốn dùng. Bỏ trống -> server tự tìm / tự tạo Gist tên "GD HOME - du lieu lich tien do".
//   GOOGLE_CLIENT_ID  Bật Đăng nhập bằng Gmail. Mỗi tài khoản Gmail có dữ liệu riêng.
//   ALLOWED_EMAILS    (tuỳ chọn) Chỉ cho các email này đăng nhập, cách nhau dấu phẩy. Bỏ trống = ai có Gmail cũng dùng được (dữ liệu riêng từng người).
//   SESSION_SECRET    (tuỳ chọn) Khoá ký phiên đăng nhập. Bỏ trống -> tự sinh từ các biến trên.
//   APP_PASSWORD      Mật khẩu chung (chỉ dùng khi KHÔNG bật đăng nhập Gmail)
//   BACKUP_DAYS       Số bản sao lưu theo ngày giữ lại trên máy (mặc định 30)
// =========================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const integrations = require('./integrations');
const { handleMaterials, MaterialStore } = require('./materials');
const { handlePublicReview } = require('./material-review');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : ROOT_DIR;
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const BACKUP_DAYS = parseInt(process.env.BACKUP_DAYS || '30', 10) || 30;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
const GITHUB_TOKEN = (process.env.GIST_TOKEN || '').trim(); // dùng tên riêng để không trùng biến GITHUB_TOKEN của công cụ khác
const GIST_ID_ENV = (process.env.GIST_ID || '').trim();
const GIST_DESC = 'GD HOME - du lieu lich tien do';
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const AUTH_MODE = GOOGLE_CLIENT_ID ? 'google' : (APP_PASSWORD ? 'password' : 'none');
const SESSION_SECRET = process.env.SESSION_SECRET ||
  crypto.createHash('sha256').update(`gdhome|${GOOGLE_CLIENT_ID}|${GITHUB_TOKEN}|${APP_PASSWORD}|${ROOT_DIR}`).digest('hex');
const SESSION_DAYS = 30;
integrations.setSecret(SESSION_SECRET);
const SHARED_KEY = 'shared'; // dữ liệu chung (khi không bật đăng nhập) = data.json cũ

// Chỉ cho phép tải các file giao diện, KHÔNG cho tải data.json / backups / server.js / .bat qua trình duyệt
const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};
const STATIC_FILES = new Set(['index.html', 'style.css', 'app.js', 'scheduler.js', 'holidays-data.js', 'gdhome-icon.png', 'gdhome-logo.png', 'tools.html', 'shell.css', 'shell.js', 'tools-menu.css', 'tools.css', 'tools.js', 'chot-ma.html', 'material-template.js', 'material-preferences.js', 'material-editor.js', 'material-editor-view.js', 'material-selection.js', 'material-image-ui.js', 'material-import.js', 'material-note-suggestions.js', 'duyet.html', 'material-print.js', 'material-customer.js', 'material-release.js', 'material-deadlines.js', 'material-projects.js', 'material-ai.js', 'material-timeline.js', 'export-canvas.js']);

const ALLOWED_KEYS = [
  'startMonth', 'endMonth', 'scheduleMonth', 'scheduleMonthManualFor', 'extraWeeksTop', 'extraWeeksBottom', 'projectOwners',
  'daysOffConfig', 'calendars', 'activeCalendarId', 'tasks', 'companyName', 'companyLogo',
  'footerNote', 'showVnHolidays', 'showLunarDates', 'customTaskTitles'
];

function defaultData() {
  const ym = new Date().toISOString().slice(0, 7);
  return { _version: 0, startMonth: ym, endMonth: ym, tasks: [], calendars: [], companyName: 'GD HOME', companyLogo: null };
}

// Tên file lưu dữ liệu theo khoá: 'shared' -> data.json ; email -> user-<email>.json
function fileNameForKey(key) {
  if (key === SHARED_KEY) return 'data.json';
  return 'user-' + String(key).toLowerCase().replace(/[^a-z0-9._@-]/g, '_').replace(/@/g, '_at_') + '.json';
}

class DbReadError extends Error {}

function parseData(raw, label) {
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dữ liệu không phải object');
    if (typeof data._version !== 'number') data._version = 0;
    delete data._baseVersion;
    delete data._force;
    return data;
  } catch (e) {
    // KHÔNG trả về {} (lần lưu sau sẽ ghi đè mất sạch dữ liệu)
    throw new DbReadError(`${label} bị lỗi, không đọc được: ${e.message}`);
  }
}

// -------------------------------------------------------------------------
// LƯU TRỮ 1: FILE TRÊN MÁY (mặc định)
// -------------------------------------------------------------------------
class FileStore {
  constructor(dir) {
    this.dir = dir;
    this.kind = 'file';
  }
  async init() {
    fs.mkdirSync(this.dir, { recursive: true });
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
  filePath(key) {
    return path.join(this.dir, fileNameForKey(key));
  }
  async get(key) {
    const f = this.filePath(key);
    if (!fs.existsSync(f)) return null;
    return parseData(fs.readFileSync(f, 'utf-8'), fileNameForKey(key));
  }
  async put(key, data) {
    const f = this.filePath(key);
    fs.mkdirSync(this.dir, { recursive: true });
    this.backupBeforeWrite(key, f);
    const tmp = `${f}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, f); // ghi an toàn: không bao giờ để lại file ghi dở
  }
  // Mỗi ngày giữ 1 bản sao lưu (trước lần ghi đầu tiên trong ngày), giữ BACKUP_DAYS ngày
  backupBeforeWrite(key, f) {
    if (!fs.existsSync(f)) return;
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    const base = fileNameForKey(key).replace(/\.json$/, '');
    const today = new Date().toISOString().slice(0, 10);
    const target = path.join(BACKUP_DIR, `${base}-${today}.json`);
    if (!fs.existsSync(target)) fs.copyFileSync(f, target);
    const files = fs.readdirSync(BACKUP_DIR).filter(n => n.startsWith(base + '-') && /\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    while (files.length > BACKUP_DAYS) fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
  async flush() {}
  info() { return { storage: 'file', dir: this.dir }; }
}

// -------------------------------------------------------------------------
// LƯU TRỮ 2: GITHUB GIST BÍ MẬT (bền vững, có lịch sử phiên bản)
// Đọc toàn bộ Gist 1 lần lúc khởi động -> giữ trong bộ nhớ; ghi thì cập nhật bộ nhớ ngay,
// đẩy lên GitHub sau ~1.5 giây (gom nhiều lần lưu), tự thử lại nếu lỗi mạng.
// Đồng thời vẫn ghi 1 bản ra file trên máy (dự phòng).
// -------------------------------------------------------------------------
class GistStore {
  constructor(token, gistId, fallbackFileStore) {
    this.token = token;
    this.gistId = gistId || '';
    this.kind = 'gist';
    this.cache = new Map();
    this.dirty = new Set();
    this.timer = null;
    this.flushing = null;
    this.local = fallbackFileStore;
    this.lastError = null;
    this.lastSyncAt = null;
  }
  async api(method, url, body) {
    const res = await fetch(`https://api.github.com${url}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gdhome-calendar-server',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`GitHub ${method} ${url} -> ${res.status}: ${txt.slice(0, 200)}`);
    return txt ? JSON.parse(txt) : {};
  }
  async init() {
    await this.local.init();
    if (!this.gistId) {
      // Tìm Gist cũ theo mô tả (để không phải cấu hình GIST_ID)
      for (let page = 1; page <= 5 && !this.gistId; page++) {
        const list = await this.api('GET', `/gists?per_page=100&page=${page}`);
        const found = (list || []).find(g => g.description === GIST_DESC);
        if (found) this.gistId = found.id;
        if (!list || list.length < 100) break;
      }
    }
    if (!this.gistId) {
      // Tạo Gist bí mật mới, lấy dữ liệu data.json đang có trên máy làm dữ liệu ban đầu
      let seed = null;
      try { seed = await this.local.get(SHARED_KEY); } catch (e) { seed = null; }
      const created = await this.api('POST', '/gists', {
        description: GIST_DESC,
        public: false,
        files: { 'data.json': { content: JSON.stringify(seed || defaultData(), null, 2) } }
      });
      this.gistId = created.id;
      console.log(`- Đã tạo Gist bí mật mới để lưu dữ liệu: ${this.gistId}`);
    }
    const gist = await this.api('GET', `/gists/${this.gistId}`);
    for (const [name, file] of Object.entries(gist.files || {})) {
      let content = file.content;
      if (file.truncated && file.raw_url) {
        const r = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${this.token}` } });
        content = await r.text();
      }
      try {
        this.cache.set(name, parseData(content, `Gist/${name}`));
      } catch (e) {
        console.error('[GIST]', e.message);
      }
    }
    this.lastSyncAt = new Date().toISOString();
  }
  async get(key) {
    const name = fileNameForKey(key);
    if (this.cache.has(name)) return JSON.parse(JSON.stringify(this.cache.get(name)));
    return null;
  }
  async put(key, data) {
    const name = fileNameForKey(key);
    this.cache.set(name, JSON.parse(JSON.stringify(data)));
    this.dirty.add(name);
    try { await this.local.put(key, data); } catch (e) { /* bản dự phòng trên máy: bỏ qua lỗi */ }
    this.schedule(1500);
  }
  // Hồ sơ ký và bản phát hành chỉ báo thành công sau khi Gist nhận cả lần ghi.
  async putMaterials(writes) {
    const files = Object.fromEntries(writes.map(([key,data]) => [
      fileNameForKey(key), { content: JSON.stringify(data, null, 2) }
    ]));
    try {
      await this.api('PATCH', `/gists/${this.gistId}`, { files });
    } catch {
      throw Object.assign(new Error('Chưa lưu được Chốt mã lên GitHub Gist. Thử lại.'), { status: 503 });
    }
    for (const [key,data] of writes) {
      this.cache.set(fileNameForKey(key), JSON.parse(JSON.stringify(data)));
      try { await this.local.put(key,data); } catch (error) { console.error('[Chốt mã] Lỗi ghi bản dự phòng:', error.code); }
    }
  }
  schedule(ms) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => { this.flush().catch(() => {}); }, ms);
  }
  async flush() {
    if (this.flushing) return this.flushing;
    if (this.dirty.size === 0) return;
    const names = Array.from(this.dirty);
    this.dirty.clear();
    const files = {};
    names.forEach(n => { files[n] = { content: JSON.stringify(this.cache.get(n), null, 2) }; });
    this.flushing = this.api('PATCH', `/gists/${this.gistId}`, { files })
      .then(() => { this.lastError = null; this.lastSyncAt = new Date().toISOString(); })
      .catch(err => {
        this.lastError = err.message;
        console.error('[GIST] Lỗi đẩy dữ liệu, sẽ thử lại:', err.message);
        names.forEach(n => this.dirty.add(n));
        this.schedule(10000);
      })
      .finally(() => { this.flushing = null; });
    return this.flushing;
  }
  info() {
    return { storage: 'gist', gistId: this.gistId, pending: this.dirty.size, lastSyncAt: this.lastSyncAt, lastError: this.lastError };
  }
}

let store = null;

async function initStore() {
  const fileStore = new FileStore(DATA_DIR);
  if (GITHUB_TOKEN) {
    const gs = new GistStore(GITHUB_TOKEN, GIST_ID_ENV, fileStore);
    try {
      await gs.init();
      store = gs;
      return;
    } catch (e) {
      console.error('[GIST] Không kết nối được GitHub Gist -> tạm lưu file trên máy:', e.message);
    }
  }
  await fileStore.init();
  store = fileStore;
}

// -------------------------------------------------------------------------
// ĐĂNG NHẬP
// -------------------------------------------------------------------------
function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function signSession(payload) {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(body).digest());
  return `${body}.${sig}`;
}
function verifySession(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sig] = token.split('.');
  const expect = b64url(crypto.createHmac('sha256', SESSION_SECRET).update(body).digest());
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8'));
    if (!p.email || !p.exp || p.exp < Date.now()) return null;
    return p;
  } catch (e) {
    return null;
  }
}

// Xác thực ID token của Google qua endpoint chính thức tokeninfo
async function verifyGoogleCredential(credential) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
  if (!res.ok) throw Object.assign(new Error('Token Google không hợp lệ'), { status: 401 });
  const info = await res.json();
  if (info.aud !== GOOGLE_CLIENT_ID) throw Object.assign(new Error('Token không dành cho ứng dụng này'), { status: 401 });
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(info.iss)) throw Object.assign(new Error('Nguồn token không hợp lệ'), { status: 401 });
  if (String(info.email_verified) !== 'true') throw Object.assign(new Error('Email Google chưa xác minh'), { status: 401 });
  if (Number(info.exp) * 1000 < Date.now()) throw Object.assign(new Error('Token đã hết hạn'), { status: 401 });
  const email = String(info.email || '').toLowerCase();
  if (ALLOWED_EMAILS.length && !ALLOWED_EMAILS.includes(email)) {
    throw Object.assign(new Error(`Email ${email} chưa được cấp quyền dùng ứng dụng này`), { status: 403 });
  }
  return { email, name: info.name || email, picture: info.picture || '' };
}

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// Trả về khoá dữ liệu của người đang gọi API, hoặc null nếu chưa đăng nhập
function resolveDataKey(req) {
  if (AUTH_MODE === 'google') {
    const auth = req.headers.authorization || '';
    const sess = verifySession(auth.startsWith('Bearer ') ? auth.slice(7) : '');
    return sess ? sess.email : null;
  }
  if (AUTH_MODE === 'password') {
    return safeEqual(req.headers['x-app-key'] || '', APP_PASSWORD) ? SHARED_KEY : null;
  }
  return SHARED_KEY;
}

// -------------------------------------------------------------------------
// HTTP HELPERS
// -------------------------------------------------------------------------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > MAX_BODY_BYTES) {
        reject(Object.assign(new Error('Dữ liệu gửi lên quá lớn (> 10MB)'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        const txt = Buffer.concat(chunks).toString('utf-8');
        resolve(txt ? JSON.parse(txt) : {});
      } catch (e) {
        reject(Object.assign(new Error('JSON không hợp lệ'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/tools') rel = '/tools.html';
  if (rel === '/chot-ma') rel = '/chot-ma.html';
  if (rel.startsWith('/duyet/') && /^[A-Za-z0-9_-]+$/.test(rel.slice(7))) rel = '/duyet.html';
  const filePath = path.normalize(path.join(ROOT_DIR, rel));
  const relFromRoot = path.relative(ROOT_DIR, filePath);
  const ext = path.extname(filePath).toLowerCase();
  const parts = relFromRoot.split(path.sep);
  const blocked =
    relFromRoot.startsWith('..') ||
    path.isAbsolute(relFromRoot) ||
    parts.some(p => p.startsWith('.') || p.startsWith('_') || p === 'node_modules' || p === 'backups' || p === 'tests') ||
    !STATIC_FILES.has(relFromRoot) ||
    !STATIC_MIME[ext];
  if (blocked) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
    return;
  }
  fs.readFile(filePath, (err, buf) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': STATIC_MIME[ext],
      'Cache-Control': rel === '/duyet.html' ? 'no-store' : ext === '.html' ? 'no-cache' : 'public, max-age=60',
      'Referrer-Policy': 'no-referrer'
    });
    res.end(buf);
  });
}

// -------------------------------------------------------------------------
// API
// -------------------------------------------------------------------------
async function handleApi(req, res, urlPath) {
  if (urlPath === '/api/health') {
    sendJson(res, 200, { ok: true, auth: AUTH_MODE, ...(store ? store.info() : {}), features: integrations.features() });
    return;
  }

  // Cấu hình cho giao diện (không cần đăng nhập)
  if (urlPath === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      authMode: AUTH_MODE,
      googleClientId: GOOGLE_CLIENT_ID || null,
      storage: store ? store.kind : 'file',
      features: integrations.features()
    });
    return;
  }

  // Đăng nhập Google: nhận ID token -> trả phiên đăng nhập của ứng dụng (30 ngày)
  if (urlPath === '/api/auth/google' && req.method === 'POST') {
    if (AUTH_MODE !== 'google') {
      sendJson(res, 400, { success: false, message: 'Chưa bật đăng nhập Google trên server (thiếu GOOGLE_CLIENT_ID)' });
      return;
    }
    const body = await readJsonBody(req);
    const user = await verifyGoogleCredential(String(body.credential || ''));
    const token = signSession({ email: user.email, name: user.name, picture: user.picture, exp: Date.now() + SESSION_DAYS * 86400000 });
    const existing = await store.get(user.email);
    let legacyAvailable = false;
    if (!existing) {
      const legacy = await store.get(SHARED_KEY).catch(() => null);
      legacyAvailable = !!(legacy && Array.isArray(legacy.tasks) && legacy.tasks.length > 0);
    }
    sendJson(res, 200, { success: true, token, user, isNewUser: !existing, legacyAvailable });
    return;
  }

  if (urlPath.startsWith('/api/review/')) {
    return handlePublicReview(req,urlPath,{ res,store,MaterialStore,readJsonBody,sendJson,dataDir:DATA_DIR,secret:SESSION_SECRET });
  }

  const dataKey = resolveDataKey(req);
  if (!dataKey) {
    sendJson(res, 401, { success: false, message: AUTH_MODE === 'google' ? 'Cần đăng nhập Google' : 'Cần mật khẩu', authMode: AUTH_MODE });
    return;
  }

  if (urlPath === '/api/materials' || urlPath.startsWith('/api/materials/')) {
    return handleMaterials(req, urlPath, { res, store, dataKey, readJsonBody, sendJson, dataDir: DATA_DIR, secret: SESSION_SECRET, defaultSchedule: defaultData });
  }

  // Người mới đăng nhập: chép dữ liệu chung cũ (data.json) vào tài khoản của mình
  if (urlPath === '/api/import-legacy' && req.method === 'POST') {
    if (dataKey === SHARED_KEY) {
      sendJson(res, 400, { success: false, message: 'Không cần nhập khi chưa bật đăng nhập' });
      return;
    }
    const legacy = await store.get(SHARED_KEY);
    if (!legacy) {
      sendJson(res, 404, { success: false, message: 'Không có dữ liệu chung cũ' });
      return;
    }
    const current = await store.get(dataKey);
    const copy = Object.assign({}, legacy, { _version: (current && current._version ? current._version : 0) + 1, _updatedAt: new Date().toISOString() });
    await store.put(dataKey, copy);
    sendJson(res, 200, { success: true, version: copy._version });
    return;
  }

  // Notion + AI (chỉ cho người đã đăng nhập)
  if (urlPath.startsWith('/api/notion/') || urlPath.startsWith('/api/ai/') || urlPath.startsWith('/api/integrations/')) {
    if (await integrations.handleIntegrations(req, res, urlPath, { sendJson, readJsonBody, dataKey, store })) return;
  }

  if (urlPath === '/api/schedule' && req.method === 'GET') {
    const data = (await store.get(dataKey)) || defaultData();
    sendJson(res, 200, { success: true, data, version: data._version || 0, storage: store.kind });
    return;
  }

  if (urlPath === '/api/schedule' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const current = (await store.get(dataKey)) || defaultData();
    const currentVersion = current._version || 0;
    const baseVersion = body._baseVersion;

    // Máy khác đã lưu sau lần cuối máy này tải về -> báo xung đột, không ghi đè
    if (typeof baseVersion === 'number' && baseVersion !== currentVersion && !body._force) {
      sendJson(res, 409, {
        success: false,
        message: 'Dữ liệu trên server đã được cập nhật từ máy khác',
        data: current,
        version: currentVersion
      });
      return;
    }
    if (!Array.isArray(body.tasks)) {
      sendJson(res, 400, { success: false, message: 'Thiếu danh sách công việc (tasks)' });
      return;
    }

    const updated = Object.assign({}, current);
    delete updated._baseVersion;
    delete updated._force;
    ALLOWED_KEYS.forEach(k => {
      if (body[k] !== undefined) updated[k] = body[k];
    });
    updated._version = currentVersion + 1;
    updated._updatedAt = new Date().toISOString();
    await store.put(dataKey, updated);
    sendJson(res, 200, { success: true, message: 'Đã lưu tiến độ thành công!', version: updated._version, storage: store.kind });
    return;
  }

  sendJson(res, 404, { success: false, message: 'API không tồn tại' });
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  try {
    if (urlPath.startsWith('/api/')) {
      if (!store) {
        sendJson(res, 503, { success: false, message: 'Server đang khởi động, thử lại sau vài giây' });
        return;
      }
      await handleApi(req, res, urlPath);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, req.url || '/');
    } else {
      res.writeHead(405);
      res.end();
    }
  } catch (err) {
    console.error('[LỖI]', err.message);
    sendJson(res, err.status || 500, { success: false, message: err.message || 'Lỗi server' });
  }
});

// Render / Windows tắt server -> đẩy nốt dữ liệu chưa lên Gist
async function gracefulExit() {
  try { if (store) await Promise.race([store.flush(), new Promise(r => setTimeout(r, 8000))]); } catch (e) { /* bỏ qua */ }
  process.exit(0);
}
process.on('SIGTERM', gracefulExit);
process.on('SIGINT', gracefulExit);

if (require.main === module) {
  initStore().then(() => {
    // Lắng nghe trên mọi địa chỉ (0.0.0.0) để máy khác cùng Wi-Fi/LAN truy cập được
    server.listen(PORT, '0.0.0.0', () => {
      console.log('=======================================================');
      console.log('🚀 Server Lịch Tiến Độ đang chạy tại:');
      console.log(`- Trực tiếp trên máy này: http://localhost:${PORT}`);
      const interfaces = os.networkInterfaces();
      for (const iface in interfaces) {
        for (const alias of interfaces[iface]) {
          if (alias.family === 'IPv4' && !alias.internal) {
            console.log(`- Máy khác trong cùng Wi-Fi/LAN truy cập: http://${alias.address}:${PORT}`);
          }
        }
      }
      const info = store.info();
      console.log(info.storage === 'gist'
        ? `- Lưu dữ liệu: GitHub Gist bí mật (${info.gistId}) - cập nhật code không mất dữ liệu`
        : `- Lưu dữ liệu: file trên máy tại ${DATA_DIR} (sao lưu hằng ngày trong thư mục backups)`);
      console.log(`- Đăng nhập: ${AUTH_MODE === 'google' ? 'Google (Gmail)' : AUTH_MODE === 'password' ? 'Mật khẩu chung' : 'Không yêu cầu'}`);
      console.log('=======================================================');
    });
  });
}

module.exports = { server, initStore, signSession, verifySession, fileNameForKey, getStore: () => store };
