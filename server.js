// =========================================================================
// GD HOME - SERVER LỊCH TIẾN ĐỘ
// Chạy:  node server.js        (mặc định cổng 3000)
// Không cần cài thêm thư viện (chỉ dùng Node.js thuần).
//
// Biến môi trường (tuỳ chọn):
//   PORT          Cổng chạy server (Render.com tự đặt)
//   DATA_DIR      Thư mục chứa data.json & thư mục backups (mặc định: cùng thư mục code)
//                 -> Trên Render, gắn "Persistent Disk" rồi đặt DATA_DIR=/var/data để dữ liệu không bị mất khi deploy
//   APP_PASSWORD  Nếu đặt, mọi lệnh đọc/ghi dữ liệu phải có mật khẩu này
//   BACKUP_DAYS   Số bản sao lưu theo ngày giữ lại (mặc định 30)
// =========================================================================
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : ROOT_DIR;
const DB_FILE = path.join(DATA_DIR, 'data.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const APP_PASSWORD = process.env.APP_PASSWORD || '';
const BACKUP_DAYS = parseInt(process.env.BACKUP_DAYS || '30', 10) || 30;
const MAX_BODY_BYTES = 10 * 1024 * 1024;

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
const STATIC_DENY = new Set(['server.js']);

// -------------------------------------------------------------------------
// LƯU TRỮ DỮ LIỆU
// -------------------------------------------------------------------------
function defaultData() {
  return {
    _version: 1,
    startMonth: new Date().toISOString().slice(0, 7),
    endMonth: new Date().toISOString().slice(0, 7),
    tasks: [],
    calendars: [],
    companyName: 'GD HOME',
    companyLogo: null
  };
}

function ensureDirs() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

// Ghi an toàn: ghi ra file tạm rồi đổi tên -> không bao giờ để lại file data.json bị ghi dở
function writeFileAtomic(file, content) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, content, 'utf-8');
  fs.renameSync(tmp, file);
}

class DbReadError extends Error {}

function readDb() {
  if (!fs.existsSync(DB_FILE)) return null;
  const raw = fs.readFileSync(DB_FILE, 'utf-8');
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Dữ liệu không phải object');
    if (typeof data._version !== 'number') data._version = 0;
    return data;
  } catch (e) {
    // KHÔNG trả về {} như trước (lần lưu sau sẽ ghi đè mất sạch dữ liệu)
    throw new DbReadError(`File data.json bị lỗi, không đọc được: ${e.message}`);
  }
}

// Mỗi ngày giữ 1 bản sao lưu (bản trước lần ghi đầu tiên trong ngày), giữ BACKUP_DAYS ngày gần nhất
function backupBeforeWrite() {
  if (!fs.existsSync(DB_FILE)) return;
  const today = new Date().toISOString().slice(0, 10);
  const target = path.join(BACKUP_DIR, `data-${today}.json`);
  if (!fs.existsSync(target)) {
    fs.copyFileSync(DB_FILE, target);
  }
  const files = fs.readdirSync(BACKUP_DIR).filter(f => /^data-\d{4}-\d{2}-\d{2}\.json$/.test(f)).sort();
  while (files.length > BACKUP_DAYS) {
    fs.unlinkSync(path.join(BACKUP_DIR, files.shift()));
  }
}

function writeDb(data) {
  ensureDirs();
  backupBeforeWrite();
  writeFileAtomic(DB_FILE, JSON.stringify(data, null, 2));
}

function initDatabase() {
  ensureDirs();
  if (!fs.existsSync(DB_FILE)) {
    // Lần đầu chạy với DATA_DIR riêng: copy data.json đi kèm code (nếu có) làm dữ liệu ban đầu
    const seed = path.join(ROOT_DIR, 'data.json');
    if (DATA_DIR !== ROOT_DIR && fs.existsSync(seed)) {
      fs.copyFileSync(seed, DB_FILE);
    } else {
      writeFileAtomic(DB_FILE, JSON.stringify(defaultData(), null, 2));
    }
  }
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

function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}

function isAuthorized(req) {
  if (!APP_PASSWORD) return true;
  return safeEqual(req.headers['x-app-key'] || '', APP_PASSWORD);
}

function serveStatic(req, res, urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel === '/' || rel === '') rel = '/index.html';
  const filePath = path.normalize(path.join(ROOT_DIR, rel));
  const relFromRoot = path.relative(ROOT_DIR, filePath);
  const ext = path.extname(filePath).toLowerCase();
  const parts = relFromRoot.split(path.sep);
  const blocked =
    relFromRoot.startsWith('..') ||
    path.isAbsolute(relFromRoot) ||
    parts.some(p => p.startsWith('.') || p === 'node_modules' || p === 'backups' || p === 'tests') ||
    STATIC_DENY.has(relFromRoot) ||
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
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=60'
    });
    res.end(buf);
  });
}

// -------------------------------------------------------------------------
// API
// -------------------------------------------------------------------------
const ALLOWED_KEYS = [
  'startMonth', 'endMonth', 'scheduleMonth', 'extraWeeksTop', 'extraWeeksBottom', 'projectOwners',
  'daysOffConfig', 'calendars', 'activeCalendarId', 'tasks', 'companyName', 'companyLogo',
  'footerNote', 'showVnHolidays', 'showLunarDates'
];

async function handleApi(req, res, urlPath) {
  if (urlPath === '/api/health') {
    sendJson(res, 200, { ok: true, auth: !!APP_PASSWORD });
    return;
  }
  if (!isAuthorized(req)) {
    sendJson(res, 401, { success: false, message: 'Cần mật khẩu' });
    return;
  }

  if (urlPath === '/api/schedule' && req.method === 'GET') {
    const data = readDb() || defaultData();
    sendJson(res, 200, { success: true, data, version: data._version || 0 });
    return;
  }

  if (urlPath === '/api/schedule' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const current = readDb() || defaultData();
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
    delete updated._baseVersion; // dọn khoá rác do bản server cũ ghi vào
    delete updated._force;
    ALLOWED_KEYS.forEach(k => {
      if (body[k] !== undefined) updated[k] = body[k];
    });
    updated._version = currentVersion + 1;
    updated._updatedAt = new Date().toISOString();
    writeDb(updated);
    sendJson(res, 200, { success: true, message: 'Đã lưu tiến độ thành công!', version: updated._version });
    return;
  }

  sendJson(res, 404, { success: false, message: 'API không tồn tại' });
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  try {
    if (urlPath.startsWith('/api/')) {
      await handleApi(req, res, urlPath);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, req.url || '/');
    } else {
      res.writeHead(405);
      res.end();
    }
  } catch (err) {
    console.error('[LỖI]', err);
    const status = err.status || (err instanceof DbReadError ? 500 : 500);
    sendJson(res, status, { success: false, message: err.message || 'Lỗi server' });
  }
});

initDatabase();

if (require.main === module) {
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
    console.log(`- Dữ liệu: ${DB_FILE}`);
    console.log(`- Sao lưu hằng ngày: ${BACKUP_DIR} (giữ ${BACKUP_DAYS} ngày)`);
    if (APP_PASSWORD) console.log('- Đã bật mật khẩu (APP_PASSWORD)');
    console.log('=======================================================');
  });
}

module.exports = { server, readDb, writeDb };
