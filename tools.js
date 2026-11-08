const byId = id => document.getElementById(id);
const html = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const sessionKey = 'gdhome_session';
const passwordKey = 'gdhome_app_key';
let config;
let materials;
let materialServerReady = false;
let toolsLoad,toolsRetry;
let toolsLocalPainted = false;

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
    setToolsConnection(true);
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

function toolsSnapshotKey() {
  return 'gdhome-tools-snapshot:' + (session()?.user?.email?.toLowerCase() || 'local');
}

function saveToolsSnapshot() {
  if (!materialServerReady || materialGuest) return;
  const key = toolsSnapshotKey();
  const {projects,sheets,viewVersion,viewSettings,columnWidths,profiles,schedule,r2} = materials;
  const snapshot = {projects,sheets,viewVersion,viewSettings,columnWidths,profiles,schedule,r2};
  try { localStorage.setItem(key,JSON.stringify(snapshot)); }
  catch {
    // Preserve the sidebar even if every draft is too large for browser storage.
    const compact = sheets.map(entry => ({...entry,groups:entry.groups.map(group => ({
      ...group,rows:group.rows.map(({id,room,decision,chosen,ordered}) =>
        ({id,room,decision,chosen,ordered,render:[],options:[{images:[]},{images:[]},{images:[]}]}))
    }))}));
    try { localStorage.setItem(key,JSON.stringify({...snapshot,sheets:compact,schedule:{tasks:[]},compact:true})); }
    catch { /* Keep the existing snapshot when storage is full. */ }
  }
}

function setToolsConnection(ready) {
  materialServerReady = ready;
  const status = byId('tools-connection');
  if (status) status.hidden = ready;
  for (const id of ['materials','material-header-actions','projects']) {
    const element = byId(id);
    if (element) element.inert = !ready;
  }
}

function paintToolsSnapshot() {
  let cached;
  try { cached = JSON.parse(localStorage.getItem(toolsSnapshotKey())); } catch { /* First visit. */ }
  if (Array.isArray(cached?.sheets) && Array.isArray(cached?.projects)) {
    materials = {presets:{},library:[],profiles:{},signedRows:{},schedule:{tasks:[]},...cached};
    showTools();
    if (cached.compact) byId('notice').textContent = 'Đang hiển thị khung bảng và cài đặt lưu trên máy.';
  } else if (byId('materials')) {
    materials = null;
    sheet = null;
    byId('material-header-actions').replaceChildren();
    byId('materials').innerHTML = '<div class="material-workspace"><aside class="shell-sidebar sidebar-compact">' +
      ['Dự án & khách hàng','Danh mục','Hiển thị'].map(label =>
        '<div class="sb-collapsible"><div class="sb-head">' + label + '</div></div>').join('') +
      '</aside><section class="material-sheet"><p>Đang kết nối máy chủ…</p></section></div>';
  }
}

function start(afterLogin = false) {
  if (toolsLoad) return toolsLoad;
  clearTimeout(toolsRetry);
  toolsLoad = loadTools(afterLogin).catch(error => {
    console.warn('Chưa tải được GD HOME Tools:',error.message);
    setToolsConnection(false);
    toolsRetry = setTimeout(() => start(afterLogin),3000);
  }).finally(() => { toolsLoad = null; });
  return toolsLoad;
}

async function loadTools(afterLogin) {
  if (localStorage.getItem(guestFlagKey) === '1') {
    materials = openGuestMaterials();
    setToolsConnection(true);
    showTools();
    return;
  }
  setToolsConnection(false);
  if (!toolsLocalPainted || afterLogin) {
    paintToolsSnapshot();
    toolsLocalPainted = true;
  }
  const options = () => ({cache:'no-store',signal:AbortSignal.timeout(12000)});
  config ||= await request('/api/config',options());
  try {
    const data = await request('/api/materials',options());
    if (!Number.isSafeInteger(data?._version) || !Array.isArray(data.sheets) || !Array.isArray(data.projects)) {
      throw new Error('Dữ liệu Chốt mã chưa sẵn sàng.');
    }
    materials = data;
  } catch (error) {
    if (error.status !== 401) throw error;
    return signIn();
  }
  setToolsConnection(true);
  let copyError;
  if (afterLogin && byId('materials')) {
    try { await importGuestMaterials(); } catch (error) { copyError = error; }
  }
  showTools();
  saveToolsSnapshot();
  if (copyError) showError(copyError);
}

function showTools() {
  byId('notice').textContent = '';
  byId('login').replaceChildren();
  byId('login').className = '';
  const identity = byId('identity');
  identity.textContent = materialGuest ? '👤 Khách' : session()?.user?.email || 'GD HOME';
  if (materialGuest) {
    const button = document.createElement('button');
    button.className = 'btn btn-outline btn-sm';
    button.textContent = 'Đăng nhập';
    button.onclick = async () => {
      if (typeof flushSave === 'function') await flushSave();
      if (typeof dirty !== 'undefined' && (dirty || saving)) return;
      try {
        config ||= await request('/api/config',{signal:AbortSignal.timeout(12000)});
        await signIn();
      } catch (error) { showError(error); }
    };
    identity.append(' ',button);
  }
  if (byId('projects')) {
    byId('projects').innerHTML = materials.projects.map(project => {
      const count = materials.sheets.filter(sheet => sheet.projectId === project.id).length;
      return '<article><strong>' + html(project.name) + '</strong> <a class="button" href="/">Tiến độ</a> <a class="button" href="/chot-ma?project=' + encodeURIComponent(project.id) + '">Chốt mã · ' + count + '</a> <a class="button" href="/du-an?project=' + encodeURIComponent(project.id) + '">Hồ sơ dự án</a></article>';
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
document.addEventListener('DOMContentLoaded',() => {
  if (!byId('login')) return;
  const status = byId('tools-connection');
  if (status) status.onclick = () => start();
  start();
});
