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
const { handleLibrary } = require('./shared-library');
const {projectList,writeProjectProfile,withScheduleWrite} = require('./project-profiles');
const { handlePublicReview } = require('./material-review');
const { handleProjectHub } = require('./project-hub');
const { getStorageKind } = require('./object-storage');
const { driveBackup } = require('./drive-backup');
const { handleWorkApi } = require('./work-manager');

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
const backups = driveBackup({secret:SESSION_SECRET,dataDir:DATA_DIR});
const SHARED_KEY = 'shared'; // dữ liệu chung (khi không bật đăng nhập) = data.json cũ

// Chỉ cho phép tải các file giao diện, KHÔNG cho tải data.json / backups / server.js / .bat qua trình duyệt
const STATIC_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp'
};
const STATIC_FILES = new Set(['index.html', 'style.css', 'app.js', 'scheduler.js', 'holidays-data.js', 'gdhome-icon.png', 'gdhome-logo.png', 'tools.html', 'shell.css', 'shell.js', 'integrations-client.js', 'ai-client.js', 'projects-client.js', 'tools-menu.css', 'tools.css', 'tools.js', 'chot-ma.html', 'material-template.js', 'material-guest.js', 'material-preferences.js', 'material-editor.js', 'material-editor-view.js', 'material-selection.js', 'material-image-ui.js', 'image-compression.js', 'material-import.js', 'material-note-suggestions.js', 'duyet.html', 'material-print.js', 'material-customer.js', 'material-release.js', 'material-task-matcher.js', 'material-deadlines.js', 'material-projects.js', 'material-ai.js', 'material-match.js', 'material-timeline.js', 'export-canvas.js', 'du-an.html', 'project-hub.css', 'project-hub-client.js', 'catalogue-import-history.js', 'library-attributes.js', 'asset-library.js', 'product-lines.js', 'library-brands.js', 'brand-manager.js', 'logo-processing.js', 'asset-library.css', 'data/paint-dulux.json', 'data/paint-jotun.json', 'data/wood-ancuong.json', 'giao-viec.html', 'giao-viec.js', 'giao-viec.css']);

const ALLOWED_KEYS = [
  'startMonth', 'endMonth', 'scheduleMonth', 'scheduleMonthManualFor', 'extraWeeksTop', 'extraWeeksBottom', 'projectOwners',
  'daysOffConfig', 'calendars', 'activeCalendarId', 'tasks', 'companyName', 'companyLogo',
  'footerNote', 'designNote', 'constructionNote', 'designCustomTitlePrefix', 'mspCustomTitlePrefix', 'showVnHolidays', 'showLunarDates', 'customTaskTitles'
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
const GIST_TIMEOUT_MS = 15000;
const GIST_INIT_BUDGET_MS = 60000;

async function gistRequest(url,options,deadline = Infinity) {
  // Creating a Gist is not idempotent. The next init searches by description before trying again.
  const attempts = options.method === 'POST' ? 1 : 3;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const remaining = Math.floor(deadline-performance.now());
    if (remaining <= 0) throw new Error('Hết thời gian kết nối GitHub Gist.');
    try {
      const response = await fetch(url,{...options,signal:AbortSignal.timeout(Math.min(remaining,GIST_TIMEOUT_MS))});
      const body = await response.text();
      if (response.ok) return body;
      throw Object.assign(new Error('GitHub Gist HTTP ' + response.status + ': ' + body.slice(0,200)),{upstreamStatus:response.status});
    } catch (error) {
      const status = error.upstreamStatus;
      if (attempt+1 === attempts || (status && status !== 429 && status < 500)) throw error;
      console.error('[GIST] Thử lại ' + options.method + ' (' + (attempt+1) + '/2):',error.message);
    }
  }
}

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
  async api(method,url,body,deadline) {
    const text = await gistRequest(`https://api.github.com${url}`,{
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'gdhome-calendar-server',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    },deadline);
    return text ? JSON.parse(text) : {};
  }
  async init() {
    await this.local.init();
    const deadline = performance.now()+GIST_INIT_BUDGET_MS;
    if (!this.gistId) {
      // Tìm Gist cũ theo mô tả (để không phải cấu hình GIST_ID)
      for (let page = 1; page <= 5 && !this.gistId; page++) {
        const list = await this.api('GET', `/gists?per_page=100&page=${page}`,undefined,deadline);
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
      },deadline);
      this.gistId = created.id;
      console.log(`- Đã tạo Gist bí mật mới để lưu dữ liệu: ${this.gistId}`);
    }
    const gist = await this.api('GET', `/gists/${this.gistId}`,undefined,deadline);
    for (const [name, file] of Object.entries(gist.files || {})) {
      let content = file.content;
      if (file.truncated && file.raw_url) {
        content = await gistRequest(file.raw_url,{method:'GET',headers:{Authorization:`Bearer ${this.token}`}},deadline);
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
    if (this.flushing) await this.flushing;
    const pending = writes.map(([key]) => fileNameForKey(key)).filter(name => this.dirty.delete(name));
    const files = Object.fromEntries(writes.map(([key,data]) => [
      fileNameForKey(key), { content: JSON.stringify(data, null, 2) }
    ]));
    try {
      await this.api('PATCH', `/gists/${this.gistId}`, { files });
    } catch {
      for (const name of pending) this.dirty.add(name);
      if (pending.length) this.schedule(1500);
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
    let failed = false;
    this.flushing = this.api('PATCH', `/gists/${this.gistId}`, { files })
      .then(() => { this.lastError = null; this.lastSyncAt = new Date().toISOString(); })
      .catch(err => {
        failed = true;
        this.lastError = err.message;
        console.error('[GIST] Lỗi đẩy dữ liệu, sẽ thử lại:', err.message);
        names.forEach(n => this.dirty.add(n));
        this.schedule(10000);
      })
      .finally(() => {
        this.flushing = null;
        // Thay đổi đến trong lúc đang gửi: lượt hẹn giờ khi đó đã bị bỏ qua, phải hẹn lại để không bị kẹt.
        if (!failed && this.dirty.size) this.schedule(1500);
      });
    return this.flushing;
  }
  info() {
    return { storage: 'gist', gistId: this.gistId, pending: this.dirty.size, lastSyncAt: this.lastSyncAt, lastError: this.lastError };
  }
}

let store = null;
let storeRetry;
let initializingStore;
async function initStore() {
  if (initializingStore) return initializingStore;
  initializingStore = (async () => {
    const fileStore = new FileStore(DATA_DIR);
    if (GITHUB_TOKEN) {
      const gist = new GistStore(GITHUB_TOKEN,GIST_ID_ENV,fileStore);
      await gist.init();
      store = gist;
    } else {
      await fileStore.init();
      store = fileStore;
    }
    return store;
  })();
  try { return await initializingStore; }
  finally { initializingStore = null; }
}

function connectStore() {
  initStore().then(ready => {
    console.log('[STORE] Sẵn sàng:',ready.kind);
    if (AUTH_MODE === 'google' && backups.available) {
      const tick = () => backups.tick(ready).catch(() => console.error('[DRIVE] Không chạy được lịch sao lưu.'));
      setInterval(tick,15*60000).unref();
      tick();
    }
  }).catch(error => {
    console.error('[STORE] Khởi tạo thất bại. Thử lại sau 10 giây:',error);
    clearTimeout(storeRetry);
    storeRetry = setTimeout(connectStore,10000);
    storeRetry.unref();
  });
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
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`,{signal:AbortSignal.timeout(15000)});
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
    const rawToken = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    const sess = verifySession(rawToken);
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

const MAX_UPLOAD_BYTES = 60 * 1024 * 1024; // 60MB cho upload tệp nhị phân HSKT

function readRawBody(req, limit = MAX_UPLOAD_BYTES) {
  return new Promise((resolve, reject) => {
    const lenHeader = parseInt(req.headers['content-length'] || '0', 10);
    if (lenHeader > limit) {
      req.resume();
      reject(Object.assign(new Error(`Tệp vượt quá giới hạn ${Math.round(limit / (1024 * 1024))}MB`), { status: 413 }));
      return;
    }
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > limit) {
        req.resume();
        reject(Object.assign(new Error(`Tệp vượt quá giới hạn ${Math.round(limit / (1024 * 1024))}MB`), { status: 413 }));
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  if (rel === '/tools') rel = '/tools.html';
  if (rel === '/chot-ma') rel = '/chot-ma.html';
  if (rel === '/du-an') rel = '/du-an.html';
  if (rel === '/giao-viec') rel = '/giao-viec.html';
  if (rel === '/favicon.ico') rel = '/gdhome-icon.png';
  if (rel.startsWith('/duyet/') && /^[A-Za-z0-9_-]+$/.test(rel.slice(7))) rel = '/duyet.html';
  const filePath = path.normalize(path.join(ROOT_DIR, rel));
  const relFromRoot = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
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
    sendJson(res,200,{
      ok:!!store,ready:!!store,auth:AUTH_MODE,objectStorage:getStorageKind(),...(store ? store.info() : {}),
      features:integrations.features(),uptime:process.uptime(),memoryUsage:process.memoryUsage(),eventLoopLagMax
    });
    return;
  }

  // Cấu hình cho giao diện (không cần đăng nhập)
  if (urlPath === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, {
      authMode: AUTH_MODE,
      googleClientId: GOOGLE_CLIENT_ID || null,
      storage: store ? store.kind : 'file',
      objectStorage: getStorageKind(),
      features: {...integrations.features(),driveBackup:AUTH_MODE === 'google' && backups.available}
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

  if (urlPath === '/api/drive-backup/callback' && req.method === 'GET') {
    let linked = false;
    try {
      if (AUTH_MODE === 'google') linked = await backups.callback(store,new URL(req.url,'http://localhost').searchParams);
    } catch { console.error('[DRIVE] Không hoàn tất được liên kết OAuth.'); }
    res.writeHead(303,{Location:'/tools?drive-backup=' + (linked ? 'linked' : 'error'),
      'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
    return res.end();
  }

  const dataKey = resolveDataKey(req);
  if (!dataKey) {
    sendJson(res, 401, { success: false, message: AUTH_MODE === 'google' ? 'Cần đăng nhập Google' : 'Cần mật khẩu', authMode: AUTH_MODE });
    return;
  }
  if (urlPath === '/api/drive-backup' && req.method === 'GET') {
    return sendJson(res,200,await backups.status(store,dataKey));
  }
  if (urlPath.startsWith('/api/drive-backup/')) {
    if (AUTH_MODE !== 'google') return sendJson(res,403,{message:'Đăng nhập Google để dùng sao lưu Drive.'});
    if (req.method === 'POST' && urlPath === '/api/drive-backup/connect') {
      return sendJson(res,200,{url:backups.connect(dataKey)});
    }
    if (req.method === 'POST' && urlPath === '/api/drive-backup/run') {
      await backups.runNow(store,dataKey);
      return sendJson(res,202,await backups.status(store,dataKey));
    }
    if (req.method === 'POST' && urlPath === '/api/drive-backup/unlink') {
      const notice = await backups.unlink(store,dataKey);
      return sendJson(res,200,{...await backups.status(store,dataKey),notice});
    }
  }

  if (urlPath === '/api/projects') {
    const legacy = await store.get(new MaterialStore(store,dataKey).key) || {};
    if (req.method === 'GET') {
      const schedule = await store.get(dataKey) || defaultData();
      return sendJson(res,200,{projects:projectList(schedule,legacy),version:schedule._version || 0});
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!body || typeof body.profile !== 'object' || !body.profile) {
        return sendJson(res,400,{message:'Thiếu hồ sơ dự án.'});
      }
      return sendJson(res,200,await writeProjectProfile(store,dataKey,body,defaultData,legacy));
    }
  }

  if (urlPath === '/api/project-hub' || urlPath.startsWith('/api/project-hub/')) {
    return handleProjectHub(req, urlPath, { res, store, dataKey, readJsonBody, readRawBody, sendJson, dataDir: DATA_DIR, secret: SESSION_SECRET, defaultSchedule: defaultData });
  }
  if (urlPath === '/api/library' || urlPath.startsWith('/api/library/')) {
    return handleLibrary(req, urlPath, { res, store, dataKey, readJsonBody, sendJson });
  }
  if (urlPath === '/api/work' || urlPath.startsWith('/api/work/')) {
    return handleWorkApi(req, res, urlPath, { sendJson, readJsonBody, dataKey, store, defaultSchedule: defaultData });
  }
  if (urlPath === '/api/materials' || urlPath.startsWith('/api/materials/')) {
    return handleMaterials(req, urlPath, { res, store, dataKey, readJsonBody, readRawBody, sendJson, dataDir: DATA_DIR, secret: SESSION_SECRET, defaultSchedule: defaultData });
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
  if (urlPath.startsWith('/api/notion/') || urlPath.startsWith('/api/ai/') || urlPath.startsWith('/api/integrations/') || urlPath.startsWith('/api/google/') || urlPath.startsWith('/api/catalogue/')) {
    if (await integrations.handleIntegrations(req, res, urlPath, { sendJson, readJsonBody, dataKey, store, dataDir:DATA_DIR })) return;
  }

  if (urlPath === '/api/schedule' && req.method === 'GET') {
    const data = (await store.get(dataKey)) || defaultData();
    const legacy = await store.get(new MaterialStore(store,dataKey).key) || {};
    const profiles = new Map(projectList(data,legacy).map(project => [project.id,project.profile]));
    const projectOwners = (data.projectOwners || []).map(owner => ({...owner,profile:profiles.get(owner.id)}));
    sendJson(res, 200, { success: true, data:{...data,projectOwners}, version: data._version || 0, storage: store.kind });
    return;
  }

  if (urlPath === '/api/schedule' && req.method === 'POST') {
    const body = await readJsonBody(req);
    return withScheduleWrite(dataKey,async () => {
      const current = await store.get(dataKey) || defaultData();
      const currentVersion = current._version || 0;
      if (typeof body._baseVersion === 'number' && body._baseVersion !== currentVersion && !body._force) {
        return sendJson(res,409,{success:false,message:'Dữ liệu trên server đã được cập nhật từ máy khác',data:current,version:currentVersion});
      }
      if (!Array.isArray(body.tasks)) return sendJson(res,400,{success:false,message:'Thiếu danh sách công việc (tasks)'});
      const updated = {...current};
      delete updated._baseVersion;
      delete updated._force;
      ALLOWED_KEYS.forEach(key => { if (body[key] !== undefined) updated[key] = body[key]; });
      if (Array.isArray(body.projectOwners)) {
        const existing = new Map((current.projectOwners || []).map(owner => [owner.id,owner.profile]));
        updated.projectOwners = body.projectOwners.map(owner => {
          const {profile,...fields} = owner;
          return existing.get(owner.id) ? {...fields,profile:existing.get(owner.id)} : fields;
        });
      }
      updated._version = currentVersion+1;
      updated._updatedAt = new Date().toISOString();
      await store.put(dataKey,updated);
      return sendJson(res,200,{success:true,message:'Đã lưu tiến độ thành công!',version:updated._version,storage:store.kind});
    });
  }

  sendJson(res, 404, { success: false, message: 'API không tồn tại' });
}

const activeRequests = new Map();
let eventLoopLagMax = 0;
let nextLoopCheck = performance.now()+1000;
const loopMonitor = setInterval(() => {
  const now = performance.now();
  const lag = Math.max(0,Math.round(now-nextLoopCheck));
  nextLoopCheck = now+1000;
  eventLoopLagMax = Math.max(eventLoopLagMax,lag);
  if (lag > 2000) {
    console.error('[EVENT LOOP LAG]',{ms:lag,active:[...activeRequests.values()].map(request => ({
      method:request.method,url:request.url,ms:Math.round(now-request.start)
    }))});
  }
  for (const request of activeRequests.values()) {
    const ms = Math.round(now-request.start);
    if (ms < 3000 || request.reportedSlow) continue;
    request.reportedSlow = true;
    console.error('[REQUEST STILL RUNNING]',{method:request.method,url:request.url,ms});
  }
},1000);
loopMonitor.unref();

function safeRequestUrl(url) {
  return url.replace(/^(\/api\/review\/|\/duyet\/)[^/]+/,'$1[ẩn]');
}

const server = http.createServer(async (req,res) => {
  const urlPath = (req.url || '/').split('?')[0];
  const request = {method:req.method,url:safeRequestUrl(urlPath),start:performance.now()};
  activeRequests.set(res,request);
  function finish() {
    if (!activeRequests.delete(res)) return;
    const ms = Math.round(performance.now()-request.start);
    if (ms >= 3000 || res.statusCode >= 400 || !res.writableFinished) {
      const details = {method:request.method,url:request.url,ms,status:res.statusCode,closed:!res.writableFinished};
      if (res.statusCode >= 400 || !res.writableFinished) console.error('[REQUEST ERROR]',details);
      else console.warn('[REQUEST SLOW]',details);
    }
  }
  res.once('finish',finish);
  res.once('close',finish);
  try {
    if (urlPath.startsWith('/api/')) {
      if (!store && !['/api/health','/api/config'].includes(urlPath)) {
        return sendJson(res,503,{success:false,message:'Đang kết nối máy chủ…'});
      }
      await handleApi(req,res,urlPath);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req,res,req.url || '/');
    } else {
      res.writeHead(405);
      res.end();
    }
  } catch (error) {
    console.error('[REQUEST EXCEPTION]',request.method,request.url,error);
    if (res.headersSent) res.destroy();
    else sendJson(res,error.status || 500,{success:false,message:error.message || 'Lỗi server'});
  }
});

// Render / Windows tắt server -> đẩy nốt dữ liệu chưa lên Gist
async function gracefulExit() {
  const deadline = Date.now() + 8000;
  try {
    // Gửi hết cả những thay đổi đến trong lúc đang gửi dở.
    while (store && Date.now() < deadline) {
      await Promise.race([store.flush(), new Promise(r => setTimeout(r, Math.max(0, deadline - Date.now())))]);
      if (!store.dirty?.size || store.lastError) break;
    }
  } catch (e) { /* bỏ qua */ }
  process.exit(0);
}
process.on('SIGTERM', gracefulExit);
process.on('SIGINT', gracefulExit);

if (require.main === module) {
  process.on('uncaughtException',error => {
    console.error('[UNCAUGHT EXCEPTION]',error);
    process.exit(1);
  });
  process.on('unhandledRejection',reason => console.error('[UNHANDLED REJECTION]',reason));
  server.listen(PORT,'0.0.0.0',() => {
    console.log('GD HOME Tools đang nghe tại cổng',PORT);
    connectStore();
  });
}

module.exports = { server, GistStore, initStore, signSession, verifySession, fileNameForKey, getStore: () => store };
