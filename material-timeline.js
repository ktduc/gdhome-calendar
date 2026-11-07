let materialBadges = new Map();
let lastBadgeSession;
let lastBadgeRefresh = 0;
let badgeRequest = 0;

async function refreshMaterialBadges() {
  const current = _guestMode ? null : _appConfig.authMode === 'google' ? getSession()?.token :
    _appConfig.authMode === 'password' ? getAppKey() : 'shared';
  if (current !== lastBadgeSession) {
    lastBadgeRefresh = 0;
    lastBadgeSession = current;
    materialBadges = new Map();
    document.querySelectorAll('.msp-material-badge').forEach(badge => badge.remove());
  }
  if (!current || Date.now()-lastBadgeRefresh < 15000) return;
  lastBadgeRefresh = Date.now();
  const requestId = ++badgeRequest;
  const headers = _appConfig.authMode === 'google' ? { Authorization:'Bearer '+current } :
    _appConfig.authMode === 'password' ? { 'x-app-key':current } : {};
  try {
    const response = await fetch('/api/materials/timeline',{ headers });
    if (!response.ok || lastBadgeSession !== current || requestId !== badgeRequest) return;
    const { badges } = await response.json();
    if (lastBadgeSession !== current || requestId !== badgeRequest) return;
    materialBadges = new Map(badges.map(badge => [badge.taskId,badge]));
    document.querySelectorAll('.msp-tr.task-row[data-task-id]').forEach(decorateMaterialBadge);
  } catch { /* Tiến độ vẫn hoạt động khi chưa tải được thông tin vật liệu. */ }
}

function decorateMaterialBadge(row) {
  row.querySelector('.msp-material-badge')?.remove();
  if (_guestMode) return;
  if (_appConfig.authMode === 'google' && lastBadgeSession !== getSession()?.token) return;
  const badge = materialBadges.get(row.dataset.taskId);
  if (!badge) return;
  const project = AppState.calendars.find(calendar => calendar.id === row.dataset.calId)?.ownerId;
  if (project !== badge.projectId) return;
  const link = document.createElement('a');
  link.href = '/chot-ma?project=' + encodeURIComponent(badge.projectId);
  link.className = 'msp-material-badge' + (badge.done ? ' done' : '');
  link.textContent = badge.done ? '✓' : '⚠';
  link.title = (badge.done ? 'Đã chốt vật liệu' : 'Còn vật liệu cần chốt') + ' · ' + badge.total + ' nhóm';
  link.setAttribute('aria-label',link.title);
  link.addEventListener('click',event => event.stopPropagation());
  link.addEventListener('mousedown',event => event.stopPropagation());
  row.querySelector('.col-name')?.append(link);
}

window.addEventListener('focus',refreshMaterialBadges);
setInterval(() => { if (!document.hidden) refreshMaterialBadges(); },20000);
