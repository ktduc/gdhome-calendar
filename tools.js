const byId = id => document.getElementById(id);
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const sessionKey = 'gdhome_session';
const passwordKey = 'gdhome_app_key';
let config;
let materials;

function session() {
  try { return JSON.parse(localStorage.getItem(sessionKey)); }
  catch { return null; }
}

async function request(url, options = {}, internal = true) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (internal && config?.authMode === 'google' && session()?.token) headers.Authorization = 'Bearer ' + session().token;
  if (internal && config?.authMode === 'password') headers['x-app-key'] = localStorage.getItem(passwordKey) || '';
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || 'Lỗi kết nối'), { status: response.status });
  return data;
}

function showError(error) {
  byId('notice').textContent = error.message;
}

async function signIn() {
  const box = byId('login');
  if (config.authMode === 'password') {
    box.innerHTML = '<form><label>Mật khẩu <input type="password" required></label> <button>Mở công cụ</button></form>';
    box.querySelector('form').onsubmit = event => {
      event.preventDefault();
      localStorage.setItem(passwordKey, box.querySelector('input').value);
      start().catch(showError);
    };
    return;
  }
  if (!window.google?.accounts) await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Không tải được đăng nhập Google.'));
    document.head.append(script);
  });
  google.accounts.id.initialize({ client_id: config.googleClientId, callback: async ({ credential }) => {
    try {
      const { token, user } = await request('/api/auth/google', { method: 'POST', body: JSON.stringify({ credential }) });
      localStorage.setItem(sessionKey, JSON.stringify({ token, user }));
      await start();
    } catch (error) { showError(error); }
  } });
  google.accounts.id.renderButton(box, { theme: 'outline', locale: 'vi', width: 270 });
}

async function start() {
  config ||= await request('/api/config');
  try { materials = await request('/api/materials'); }
  catch (error) {
    if (error.status !== 401) throw error;
    return signIn();
  }
  byId('notice').textContent = '';
  byId('login').replaceChildren();
  byId('identity').textContent = config.authMode === 'google' ? session()?.user?.email || '' : 'GD HOME';
  if (byId('projects')) {
    byId('projects').innerHTML = materials.projects.map(project => {
      const count = materials.sheets.filter(sheet => sheet.projectId === project.id).length;
      return '<article><strong>' + html(project.name) + '</strong> <a class="button" href="/">Tiến độ</a> <a class="button" href="/chot-ma?project=' + encodeURIComponent(project.id) + '">Chốt mã · ' + count + '</a></article>';
    }).join('') || '<p>Tạo dự án trong Tiến độ trước.</p>';
  }
  if (byId('materials') && typeof renderMaterialApp === 'function') renderMaterialApp();
}
document.addEventListener('DOMContentLoaded', () => { if (byId('login')) start().catch(showError); });
