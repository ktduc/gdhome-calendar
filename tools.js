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
  if (internal && typeof materialGuest !== 'undefined' && materialGuest && url !== '/api/config') {
    throw new Error('Chế độ khách lưu trên máy. Đăng nhập Gmail để dùng kết nối và phát hành.');
  }
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (internal && config?.authMode === 'google' && session()?.token) headers.Authorization = 'Bearer ' + session().token;
  if (internal && config?.authMode === 'password') headers['x-app-key'] = localStorage.getItem(passwordKey) || '';
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.message || 'Lỗi kết nối'), { status: response.status });
  return data;
}

function showError(error) {
  if (typeof say === 'function' && byId('materials')) say(error.message);
  else byId('notice').textContent = error.message;
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
  box.className = 'login-overlay active';
  box.innerHTML = GDHomeShell.loginCard(document.title.split(' · ')[0]);
  box.querySelector('.login-guest-btn').onclick = () => {
    materials = openGuestMaterials();
    showTools();
  };
  const message = box.querySelector('.login-msg');
  await GDHomeShell.googleSignIn({
    clientId:config.googleClientId,container:box.querySelector('.google-signin-btn'),
    onCredential:async ({credential}) => {
      try {
        message.textContent = 'Đang đăng nhập…';
        const { token,user } = await request('/api/auth/google',{method:'POST',body:JSON.stringify({credential})},false);
        localStorage.setItem(sessionKey,JSON.stringify({token,user}));
        localStorage.removeItem(guestFlagKey);
        materialGuest = false;
        await start(true);
      } catch (error) { message.textContent = error.message; }
    }
  }).catch(error => { message.textContent = error.message; });
}

async function start(afterLogin = false) {
  config ||= await request('/api/config');
  if (config.authMode === 'google' && localStorage.getItem(guestFlagKey) === '1') {
    materials = openGuestMaterials();
  } else {
    try { materials = await request('/api/materials'); }
    catch (error) {
      if (error.status !== 401) throw error;
      return signIn();
    }
  }
  let copyError;
  if (afterLogin && byId('materials')) {
    try { await importGuestMaterials(); } catch (error) { copyError = error; }
  }
  showTools();
  if (copyError) showError(copyError);
}

function showTools() {
  byId('notice').textContent = '';
  byId('login').replaceChildren();
  byId('login').className = '';
  const identity = byId('identity');
  identity.textContent = materialGuest ? '👤 Khách' : config.authMode === 'google' ? session()?.user?.email || '' : 'GD HOME';
  if (materialGuest) {
    const button = document.createElement('button');
    button.className = 'btn btn-outline btn-sm';
    button.textContent = 'Đăng nhập';
    button.onclick = async () => {
      if (typeof flushSave === 'function') await flushSave();
      if (typeof dirty !== 'undefined' && (dirty || saving)) return;
      signIn().catch(showError);
    };
    identity.append(' ',button);
  }
  if (byId('projects')) {
    byId('projects').innerHTML = materials.projects.map(project => {
      const count = materials.sheets.filter(sheet => sheet.projectId === project.id).length;
      return '<article><strong>' + html(project.name) + '</strong> <a class="button" href="/">Tiến độ</a> <a class="button" href="/chot-ma?project=' + encodeURIComponent(project.id) + '">Chốt mã · ' + count + '</a></article>';
    }).join('') || '<p>Tạo dự án trong Tiến độ trước.</p>';
  }
  if (byId('materials') && typeof renderMaterialApp === 'function') {
    sheet = null;
    initMaterialView();
    const project = new URLSearchParams(location.search).get('project');
    const previous = materials.sheets.find(sheet => sheet.id === materialView.sheetId && (!project || sheet.projectId === project));
    if (previous) openSheet(previous);
    else renderMaterialApp(project);
  }
}
document.addEventListener('DOMContentLoaded', () => { if (byId('login')) start().catch(showError); });
