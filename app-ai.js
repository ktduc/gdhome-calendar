// AI lập tiến độ, AI soát tiến độ, đồng bộ Notion, hồ sơ dự án.
// Tách từ app.js: các file app-*.js chạy nối tiếp nhau (chung phạm vi toàn cục), giữ đúng thứ tự nạp trong index.html.
// =========================================================================
// AI LẬP TIẾN ĐỘ (ảnh / Excel / PDF -> danh sách việc + liên kết) & ĐỒNG BỘ NOTION
// Server giữ khoá (ANTHROPIC_API_KEY, NOTION_TOKEN) – trình duyệt chỉ gọi /api/ai, /api/notion
// =========================================================================
const AIPlanner = { files: [], plan: null, rows: [] };

function featureEnabled(name) {
  return !!(_appConfig && _appConfig.features && _appConfig.features[name]);
}

function integrationBlockedReason() {
  if (typeof isOfflineFileMode === 'function' && isOfflineFileMode()) return 'Tính năng này cần mở web qua server (localhost hoặc Render), không dùng được khi mở file trực tiếp.';
  if (_guestMode) return 'Chế độ khách không dùng được tính năng này. Hãy đăng nhập Gmail.';
  return '';
}

// ----- Cài đặt kết nối (mỗi tài khoản tự dán khoá; server mã hoá & giữ, trình duyệt không đọc lại được) -----
let integrationSettings;
function renderNotionConnection(settings) {
  integrationSettings = settings;
  const configured = settings.notion?.configured;
  const status = document.getElementById('notion-status-msg');
  status.textContent = configured ? settings.notion.dbTitle || 'Đã kết nối Notion' : 'Mở Kết nối để chọn bảng lịch và cột ngày.';
  document.querySelectorAll('#notion-sync-modal .notion-actions button').forEach(button => { button.disabled = !configured; });
}
document.addEventListener('gdhome:connections',event => renderNotionConnection(event.detail));
function openModalById(id) {
  const m = document.getElementById(id);
  if (m) m.classList.add('active');
  if (window.lucide) window.lucide.createIcons();
}

let renderAiFileList = () => {};
function fillAiStageSelect() {
  const sel = document.getElementById('ai-target-stage');
  if (!sel) return;
  sel.innerHTML = '';
  const activeCal = getActiveCalendar();
  (AppState.projectOwners || []).forEach(o => {
    const g = document.createElement('optgroup');
    g.label = `Dự án: ${o.name || '(chưa đặt tên)'}`;
    const optNew = document.createElement('option');
    optNew.value = 'new:' + o.id;
    optNew.textContent = '＋ Giai đoạn mới (tên do AI đặt)';
    g.appendChild(optNew);
    AppState.calendars.filter(c => c.ownerId === o.id).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      g.appendChild(opt);
    });
    sel.appendChild(g);
  });
  const orphan = AppState.calendars.filter(c => !(AppState.projectOwners || []).some(o => o.id === c.ownerId));
  orphan.forEach(c => { const opt = document.createElement('option'); opt.value = c.id; opt.textContent = c.name; sel.appendChild(opt); });
  if (activeCal) sel.value = 'new:' + activeCal.ownerId;
  if (!sel.value && sel.options.length) sel.selectedIndex = 0;
}

function openAiPlanner() {
  if (AIPlanner.running) { showAiBgPanel('running', 'AI vẫn đang lập tiến độ… xong sẽ báo ở đây.'); return; }
  const msg = document.getElementById('ai-input-msg');
  const reason = integrationBlockedReason();
  if (msg) { msg.textContent = reason; msg.className = 'ai-msg' + (reason ? ' is-warn' : ''); }
  if (!reason) GDHomeConnections.settings().then(settings => { integrationSettings = settings; }).catch(error => { msg.textContent = error.message; });
  const sd = document.getElementById('ai-start-date');
  if (sd && !sd.value) sd.value = formatDateStr(new Date());
  fillAiStageSelect();
  document.getElementById('ai-step-input').style.display = '';
  document.getElementById('ai-step-review').style.display = 'none';
  openModalById('ai-planner-modal');
  document.getElementById('ai-drop-zone').focus();
}

function getAiTargetWorkDays() {
  const mode = document.getElementById('ai-limit-mode').value;
  const start = document.getElementById('ai-start-date').value || formatDateStr(new Date());
  if (mode === 'days') return Math.max(1, parseInt(document.getElementById('ai-target-days').value, 10) || 0) || null;
  if (mode === 'end') {
    const end = document.getElementById('ai-end-date').value;
    if (!end || end < start) return null;
    return Math.max(1, Math.round(countWorkingDays(start, end, true)));
  }
  return null;
}

async function runAiPlanner() {
  const msg = document.getElementById('ai-input-msg');
  const btn = document.getElementById('btn-ai-run');
  const reason = integrationBlockedReason();
  if (reason) { msg.textContent = reason; msg.className = 'ai-msg is-warn'; return; }
  if (integrationSettings?.ai?.configured === false) {
    msg.textContent = 'Mở Kết nối AI để chọn nhà cung cấp và nhập API key.';
    msg.className = 'ai-msg is-warn';
    return;
  }
  const notes = document.getElementById('ai-notes').value.trim();
  if (!AIPlanner.files.length && !notes) { msg.textContent = 'Hãy chọn ít nhất 1 ảnh / file hoặc nhập mô tả.'; msg.className = 'ai-msg is-warn'; return; }
  if (document.getElementById('ai-limit-mode').value !== 'auto' && !getAiTargetWorkDays()) {
    msg.textContent = 'Nhập số ngày hoặc ngày kết thúc (sau ngày bắt đầu).'; msg.className = 'ai-msg is-warn'; return;
  }
  if (AIPlanner.running) { msg.textContent = 'AI đang chạy yêu cầu trước, đợi xong đã nhé.'; msg.className = 'ai-msg is-warn'; return; }
  const startDate = document.getElementById('ai-start-date').value || formatDateStr(new Date());
  const targetWorkDays = getAiTargetWorkDays();
  const target = document.getElementById('ai-target-stage').value;
  const ownerId = target.startsWith('new:') ? target.slice(4) : AppState.calendars.find(c => c.id === target)?.ownerId;
  const projectName = AppState.projectOwners.find(owner => owner.id === ownerId)?.name || '';
  return GDHomeAI.run(AIPlanner,{
    onStart() {
      btn.disabled = true;
      msg.textContent = '';
      document.getElementById('ai-planner-modal').classList.remove('active');
      showAiBgPanel('running','AI đang đọc tài liệu và lập tiến độ…');
    },
    async request() {
      const files = await GDHomeAI.prepare(AIPlanner.files,notes);
      const response = await apiFetch('/api/ai/schedule',{method:'POST',body:JSON.stringify({
        ...files,startDate,targetWorkDays,projectName
      })});
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || 'Không nhận được đề xuất AI.');
      return json.plan;
    },
    onDone(plan) {
      Object.assign(AIPlanner,{plan,startDate,targetWorkDays,rows:plan.tasks.map((task,idx) => ({...task,include:true,idx}))});
      showAiReview();
      if (AIPlanner.rows.length) showAiBgPanel('done','AI đã đề xuất <b>' + AIPlanner.rows.length + '</b> công việc.','Xem & thêm vào lịch');
      else showAiBgPanel('error','AI không tìm thấy hạng mục trong tài liệu.','Mở lại');
    },
    onError(error) {
      msg.textContent = '⚠ ' + error.message;
      msg.className = 'ai-msg is-warn';
      showAiBgPanel('error',escapeHtmlAi(error.message),'Mở lại');
    },
    onFinish() { btn.disabled = false; }
  });
}

function escapeHtmlAi(t) {
  return String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

// Ô thông báo nhỏ góc phải dưới khi AI chạy nền
function showAiBgPanel(state, html, actionLabel) {
  GDHomeShell.aiNotice('ai-bg-panel',{state,body:html,label:actionLabel,onAction() {
    hideAiBgPanel();
    openModalById('ai-planner-modal');
    const review = state === 'done';
    document.getElementById('ai-step-input').style.display = review ? 'none' : '';
    document.getElementById('ai-step-review').style.display = review ? '' : 'none';
  }});
}

function hideAiBgPanel() {
  const el = document.getElementById('ai-bg-panel');
  if (el) el.style.display = 'none';
}

// Tính ngày cho từng việc theo lịch làm việc (bỏ ngày nghỉ / lễ) + liên kết FS/SS
function computeAiRowDates() {
  const start0 = shiftDateByWorkingDays(AIPlanner.startDate, 0, true);
  const rows = AIPlanner.rows;
  rows.forEach((r, i) => {
    let s = null;
    (r.dependsOn || []).forEach(d => {
      const p = rows[d.index];
      if (!p || d.index >= i || !p.include || !p.start) return;
      const cand = getLinkedStartDate({ startDate: p.start, endDate: p.end }, { type: d.type, lag: d.lag }, true);
      if (!s || cand > s) s = cand;
    });
    r.start = s || start0;
    r.end = computeEndDateByWorkingDays(r.start, r.workDays, true);
  });
  const inc = rows.filter(r => r.include);
  const maxEnd = inc.reduce((m, r) => (r.end > m ? r.end : m), start0);
  return { start: start0, end: maxEnd, workDays: inc.length ? countWorkingDays(start0, maxEnd, true) : 0, calDays: inc.length ? Math.round((parseDateStr(maxEnd) - parseDateStr(start0)) / 86400000) + 1 : 0 };
}

function fmtVnDate(str) {
  if (!str) return '';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

function showAiReview() {
  document.getElementById('ai-step-input').style.display = 'none';
  document.getElementById('ai-step-review').style.display = '';
  const plan = AIPlanner.plan || {};
  const sum = document.getElementById('ai-summary');
  sum.innerHTML = '';
  const nameLbl = document.createElement('label');
  nameLbl.textContent = 'Tên giai đoạn: ';
  const nameInp = document.createElement('input');
  nameInp.type = 'text'; nameInp.id = 'ai-stage-name'; nameInp.value = plan.stageName || 'Tiến độ AI đề xuất';
  nameLbl.appendChild(nameInp);
  const p = document.createElement('div');
  p.className = 'ai-summary-text';
  p.textContent = plan.summary || '';
  sum.appendChild(nameLbl); sum.appendChild(p);
  const target = document.getElementById('ai-target-stage').value;
  nameLbl.style.display = target.startsWith('new:') ? '' : 'none';
  const q = document.getElementById('ai-questions');
  q.innerHTML = '';
  if (plan.questions && plan.questions.length) {
    const t = document.createElement('div'); t.className = 'ai-q-title'; t.textContent = 'AI cần anh/chị xác nhận thêm:'; q.appendChild(t);
    plan.questions.forEach(x => { const li = document.createElement('div'); li.textContent = '• ' + x; q.appendChild(li); });
  }
  renderAiReviewTable();
}

function renderAiReviewTable() {
  const info = computeAiRowDates();
  const tb = document.getElementById('ai-review-body');
  tb.innerHTML = '';
  AIPlanner.rows.forEach((r, i) => {
    const tr = document.createElement('tr');
    if (!r.include) tr.className = 'is-off';
    const c0 = document.createElement('td');
    const chk = document.createElement('input'); chk.type = 'checkbox'; chk.checked = r.include;
    chk.addEventListener('change', () => { r.include = chk.checked; renderAiReviewTable(); });
    c0.appendChild(chk);
    const c1 = document.createElement('td'); c1.textContent = i + 1;
    const c2 = document.createElement('td');
    const nm = document.createElement('input'); nm.type = 'text'; nm.value = r.name; nm.title = r.note || '';
    nm.addEventListener('change', () => { r.name = nm.value.trim() || r.name; });
    c2.appendChild(nm);
    const c3 = document.createElement('td');
    const wd = document.createElement('input'); wd.type = 'number'; wd.min = '0.5'; wd.step = '0.5'; wd.value = r.workDays; wd.className = 'ai-num';
    wd.addEventListener('change', () => { r.workDays = Math.max(0.5, Math.round((parseFloat(wd.value) || 1) * 2) / 2); renderAiReviewTable(); });
    c3.appendChild(wd);
    const c4 = document.createElement('td');
    c4.textContent = (r.dependsOn || []).filter(d => d.index < i).map(d => `${d.index + 1}${d.type === 'SS' ? ' (SS)' : ''}`).join(', ');
    const c5 = document.createElement('td'); c5.textContent = r.include ? fmtVnDate(r.start) : '';
    const c6 = document.createElement('td'); c6.textContent = r.include ? fmtVnDate(r.end) : '';
    [c0, c1, c2, c3, c4, c5, c6].forEach(c => tr.appendChild(c));
    tb.appendChild(tr);
  });
  const tot = document.getElementById('ai-total');
  const over = AIPlanner.targetWorkDays && info.workDays > AIPlanner.targetWorkDays;
  tot.innerHTML = '';
  tot.textContent = `Tổng: ${fmtVnDate(info.start)} → ${fmtVnDate(info.end)} · ${info.workDays} ngày làm việc · ${info.calDays} ngày thực tế`
    + (AIPlanner.targetWorkDays ? ` (mục tiêu ${AIPlanner.targetWorkDays} ngày làm việc)` : '');
  tot.classList.toggle('is-over', !!over);
  document.getElementById('btn-ai-fit').style.display = AIPlanner.targetWorkDays && info.workDays !== AIPlanner.targetWorkDays ? '' : 'none';
}

// Co giãn thời lượng các việc để tổng vừa đúng số ngày mục tiêu
function fitAiRowsToTarget() {
  const target = AIPlanner.targetWorkDays;
  if (!target) return;
  for (let k = 0; k < 4; k++) {
    const info = computeAiRowDates();
    if (!info.workDays || info.workDays === target) break;
    const f = target / info.workDays;
    AIPlanner.rows.forEach(r => { r.workDays = Math.max(0.5, Math.round(r.workDays * f * 2) / 2); });
  }
  renderAiReviewTable();
}

function applyAiPlan() {
  const rows = AIPlanner.rows.filter(r => r.include);
  if (!rows.length) { showToast('Chưa chọn công việc nào'); return; }
  computeAiRowDates();
  const target = document.getElementById('ai-target-stage').value;
  let cal;
  if (target.startsWith('new:')) {
    const ownerId = target.slice(4);
    const name = (document.getElementById('ai-stage-name') || {}).value || 'Tiến độ AI đề xuất';
    cal = { id: 'cal_' + Date.now(), ownerId, name: name.trim(), customerName: name.trim(), color: getActiveCalendar() ? getActiveCalendar().color : '#3b82f6', visible: true };
    AppState.calendars.push(cal);
  } else {
    cal = AppState.calendars.find(c => c.id === target);
  }
  if (!cal) { showToast('Không tìm thấy giai đoạn đích'); return; }
  cal.visible = true;
  const idMap = new Map();
  const stamp = Date.now();
  AIPlanner.rows.forEach((r, i) => { if (r.include) idMap.set(i, `task_ai_${stamp}_${i}`); });
  const created = [];
  AIPlanner.rows.forEach((r, i) => {
    if (!r.include) return;
    const t = {
      id: idMap.get(i),
      calendarId: cal.id,
      title: r.name,
      startDate: r.start,
      endDate: r.end,
      color: getNextSequentialPaletteColor(cal.id) || cal.color,
      skipSundays: true,
      showCount: true,
      note: r.note || '',
      progress: 0,
      predecessors: []
    };
    AppState.tasks.push(t);
    created.push({ t, r, i });
  });
  created.forEach(({ t, r, i }) => {
    (r.dependsOn || []).forEach(d => {
      if (d.index >= i || !idMap.has(d.index)) return;
      const pred = AppState.tasks.find(x => x.id === idMap.get(d.index));
      if (pred) addPredecessorLink(t, pred, AppState.tasks, d.type);
    });
  });
  AppState.activeCalendarId = cal.id;
  hideAiBgPanel();
  document.getElementById('ai-planner-modal').classList.remove('active');
  AIPlanner.files = []; renderAiFileList();
  syncAllFromMSProject(`✨ Đã thêm ${created.length} công việc AI đề xuất vào "${cal.name}"`);
}

// ---------------------------- NOTION ----------------------------
function notionLog(text, cls = '') {
  const el = document.getElementById('notion-log');
  if (!el) return;
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = `${new Date().toLocaleTimeString('vi-VN')} – ${text}`;
  el.prepend(d);
}


function openNotionSync() {
  const reason = integrationBlockedReason();
  const st = document.getElementById('notion-status-msg');
  st.textContent = reason;
  st.className = 'ai-msg' + (reason ? ' is-warn' : '');
  document.querySelectorAll('#notion-sync-modal .notion-actions button').forEach(b => { b.disabled = true; });
  openModalById('notion-sync-modal');
  if (!reason) GDHomeConnections.settings().then(renderNotionConnection).catch(error => { st.textContent = error.message; });
}

// Dự án & giai đoạn RIÊNG cho lịch Notion (không trộn vào dự án đang chọn)
const NOTION_OWNER_ID = 'owner_notion';
function ensureNotionStage(dbId, dbTitle) {
  if (!Array.isArray(AppState.projectOwners)) AppState.projectOwners = [];
  let owner = AppState.projectOwners.find(o => o.id === NOTION_OWNER_ID);
  if (!owner) {
    owner = { id: NOTION_OWNER_ID, name: 'NOTION', collapsed: false };
    AppState.projectOwners.push(owner);
  }
  const calId = 'cal_notion_' + dbId;
  let cal = AppState.calendars.find(c => c.id === calId);
  const name = (dbTitle || 'Lịch Notion').toUpperCase();
  if (!cal) {
    cal = { id: calId, ownerId: NOTION_OWNER_ID, name, customerName: name, color: '#64748b', visible: true, isNotion: true };
    AppState.calendars.push(cal);
  } else if (cal.name !== name) {
    cal.name = name;
    cal.customerName = name;
  }
  return cal;
}

function notionSnap(t) { return [t.title, t.startDate, t.endDate].join('|'); }

async function notionPullTasks() {
  notionLog('Đang lấy lịch từ Notion…');
  const res = await apiFetch('/api/notion/pull');
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
  const cal = ensureNotionStage(json.dbId, json.dbTitle);
  const seen = new Set();
  let updated = 0, added = 0;
  json.items.forEach((it, idx) => {
    if (!it.start) return;
    seen.add(it.pageId);
    const end = it.end && it.end >= it.start ? it.end : it.start;
    let t = AppState.tasks.find(x => x.calendarId === cal.id && x.notionPageId === it.pageId);
    if (t) {
      if (t.notionSyncedAt && it.lastEdited <= t.notionSyncedAt) return; // Notion chưa sửa từ lần trước
      if (t.title !== it.name || t.startDate !== it.start || t.endDate !== end) updated++;
      t.title = it.name; t.startDate = it.start; t.endDate = end;
    } else {
      t = {
        id: `task_nt_${Date.now()}_${idx}`,
        calendarId: cal.id,
        title: it.name,
        startDate: it.start,
        endDate: end,
        color: getNextSequentialPaletteColor(cal.id) || cal.color,
        skipSundays: false, // giữ đúng ngày như trên Notion (tính theo ngày thực tế)
        showCount: true,
        note: '',
        progress: 0,
        predecessors: [],
        notionPageId: it.pageId
      };
      AppState.tasks.push(t);
      added++;
    }
    t.notionSyncedAt = it.lastEdited;
    t.notionSnap = notionSnap(t);
  });
  // Dòng đã xoá trên Notion (hoặc bỏ trống ngày) -> bỏ khỏi dự án NOTION
  const before = AppState.tasks.length;
  AppState.tasks = AppState.tasks.filter(t => t.calendarId !== cal.id || !t.notionPageId || seen.has(t.notionPageId));
  const removed = before - AppState.tasks.length;
  cal.visible = true;
  syncAllFromMSProject();
  notionLog(`Lấy về "${json.dbTitle}" (cột ngày "${json.dateProp}"): thêm ${added}, cập nhật ${updated}${removed ? `, bỏ ${removed}` : ''} việc → dự án NOTION.`, 'is-ok');
  return cal;
}

// Đẩy lại các việc trong dự án NOTION đã sửa tên/ngày trong app
async function notionPushLocalEdits() {
  const changed = AppState.tasks.filter(t => t.notionPageId && String(t.calendarId || '').startsWith('cal_notion_') && t.notionSnap && t.notionSnap !== notionSnap(t));
  if (!changed.length) { notionLog('Không có việc nào sửa trong app cần gửi lên Notion.'); return; }
  notionLog(`Đang gửi ${changed.length} việc đã sửa lên Notion…`);
  const items = changed.map(t => ({ pageId: t.notionPageId, name: t.title, start: t.startDate, end: t.endDate }));
  const res = await apiFetch('/api/notion/push', { method: 'POST', body: JSON.stringify({ items }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) throw new Error(json.message || `Lỗi ${res.status}`);
  let ok = 0, failed = 0;
  json.results.forEach(r => {
    const t = AppState.tasks.find(x => x.notionPageId === r.pageId);
    if (r.error || !t) { failed++; return; }
    t.notionSyncedAt = r.lastEdited;
    t.notionSnap = notionSnap(t);
    ok++;
  });
  saveToBackend();
  notionLog(`Đã cập nhật ${ok} việc lên Notion${failed ? `, lỗi ${failed}` : ''}.`, failed ? 'is-warn' : 'is-ok');
}


async function runNotionAction(kind) {
  const btns = document.querySelectorAll('#notion-sync-modal .notion-actions button');
  btns.forEach(b => { b.disabled = true; });
  try {
    if (kind === 'both') await notionPushLocalEdits();
    await notionPullTasks();
    showToast('Đồng bộ Notion xong');
  } catch (err) {
    notionLog('⚠ ' + err.message, 'is-warn');
  } finally {
    btns.forEach(b => { b.disabled = false; });
  }
}

const timelineReview = {running:false,plan:null,error:'',job:null};
const timelineReviewCategories = {
  sequence:'Trình tự và chồng chéo',
  missing:'Hạng mục có thể còn thiếu',
  preparation:'Việc cần chuẩn bị trước',
  risk:'Rủi ro tiến độ'
};
const timelineReviewSeverity = {high:'Cao',medium:'Trung bình',info:'Lưu ý'};

function timelineReviewNotice() {
  const state = timelineReview.running ? 'running' : timelineReview.error ? 'error' : 'done';
  const status = timelineReview.running
    ? (timelineReview.job?.step || 'Đang chuẩn bị dữ liệu Lịch…') + ' (' + (timelineReview.job?.progress || 0) + '%)'
    : timelineReview.error || 'AI đã soát tiến độ và trả về ' + timelineReview.plan.findings.length + ' mục.';
  GDHomeShell.aiNotice('ai-timeline-review-notice',{
    state,body:escapeHtmlAi(status),label:timelineReview.running ? '' : timelineReview.error ? 'Thử lại' : 'Xem kết quả',
    onAction:() => timelineReview.error ? openTimelineReview(timelineReview.projectId) : showTimelineReview()
  });
}

function openTimelineReview(projectId = getActiveCalendar()?.ownerId) {
  if (timelineReview.running) return timelineReviewNotice();
  const project = AppState.projectOwners.find(owner => owner.id === projectId);
  const reason = integrationBlockedReason() || (!project ? 'Chọn một dự án trong Lịch để soát.' : '');
  if (reason) return showToast(reason);
  const dialog = document.getElementById('ai-timeline-review-dialog');
  if (dialog.open) dialog.close();
  GDHomeShell.dialog(dialog,'<h2>AI soát tiến độ</h2><p>' + escapeHtmlAi(project.name) + '</p>' +
    '<form id="ai-timeline-review-form"><label>Loại công trình <select name="projectType">' +
    '<option value="">Chưa xác định</option><option>nhà phố</option><option>chung cư</option><option>văn phòng nhỏ</option>' +
    '</select></label> <button class="btn btn-primary">Bắt đầu soát</button></form>' +
    '<p>AI đọc các giai đoạn, công việc và liên kết Chốt mã của dự án đang chọn.</p>' +
    '<button type="button" class="btn btn-outline" data-open-connections="ai">⚙ Kết nối AI</button>');
  const form = dialog.querySelector('#ai-timeline-review-form');
  form.elements.projectType.value = timelineReview.projectId === projectId ? timelineReview.projectType || '' : '';
  form.onsubmit = event => {
    event.preventDefault();
    const projectType = form.elements.projectType.value;
    dialog.close();
    runTimelineReview(projectId,projectType);
  };
}

function runTimelineReview(projectId,projectType) {
  return GDHomeAI.run(timelineReview,{
    onStart() {
      Object.assign(timelineReview,{projectId,projectType,plan:null,error:'',job:null});
      timelineReviewNotice();
    },
    async request() {
      if (_pendingSync) await flushSaveToBackend();
      if (_pendingSync || !_scheduleReady) throw new Error('Cần lưu tiến độ lên máy chủ trước khi soát.');
      return GDHomeAI.startJob({kind:'review-timeline',projectId,projectType,version:_serverVersion},{
        onProgress(job) { timelineReview.job = job; timelineReviewNotice(); }
      });
    },
    onDone(plan) { timelineReview.plan = plan; },
    onError(error) { timelineReview.error = error.message; },
    onFinish:timelineReviewNotice
  });
}

function showTimelineReview() {
  const plan = timelineReview.plan;
  if (!plan) return;
  const dialog = document.getElementById('ai-timeline-review-dialog');
  if (dialog.open) dialog.close();
  const groups = Object.entries(timelineReviewCategories).map(([category,label]) => {
    const items = plan.findings.map((finding,index) => ({finding,index})).filter(entry => entry.finding.category === category);
    if (!items.length) return '';
    return '<section><h3>' + label + '</h3><ol>' + items.map(({finding,index}) =>
      '<li><strong>' + timelineReviewSeverity[finding.severity] + ' · ' + escapeHtmlAi(finding.title) +
      '</strong><p>' + escapeHtmlAi(finding.detail) + '</p><button class="btn btn-outline" data-review-item="' + index + '">' +
      (finding.action === 'note' ? 'Thêm ghi chú' : 'Tạo công việc') + '</button></li>').join('') + '</ol></section>';
  }).join('');
  GDHomeShell.dialog(dialog,'<h2>Kết quả soát tiến độ</h2><p>' + escapeHtmlAi(plan.projectName) + ' · ' + escapeHtmlAi(plan.model) +
    '</p>' + (groups || '<p>AI không tìm thấy mục cần lưu ý trong tiến độ này.</p>'));
  dialog.querySelectorAll('[data-review-item]').forEach(button => button.onclick = () => {
    const finding = plan.findings[Number(button.dataset.reviewItem)];
    const stage = AppState.calendars.find(item => item.id === finding.calendarId && item.ownerId === plan.projectId);
    if (!stage) return showToast('Giai đoạn đã thay đổi. Hãy soát lại tiến độ.');
    if (finding.action === 'note') {
      const task = AppState.tasks.find(item => item.id === finding.taskId && item.calendarId === stage.id);
      if (!task) return showToast('Công việc đã thay đổi. Hãy soát lại tiến độ.');
      const note = '[AI soát tiến độ] ' + finding.title + (finding.detail ? '\n' + finding.detail : '');
      if (!(task.note || '').includes(note)) {
        task.note = [task.note,note].filter(Boolean).join('\n\n');
        syncAllFromMSProject('Đã thêm ghi chú vào ' + task.title + '.');
      }
      button.disabled = true;
      button.textContent = 'Đã thêm ghi chú';
      return;
    }
    dialog.close();
    openTaskModal(null,finding.startDate || null,stage.id);
    document.getElementById('task-title').value = finding.title;
    document.getElementById('task-note').value = finding.detail;
  });
}

function setupIntegrationsUI() {
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', () => {
    const m = document.getElementById(b.dataset.closeModal);
    if (m) m.classList.remove('active');
  }));
  const aiMenu = document.getElementById('schedule-ai-menu');
  document.getElementById('btn-ai-review-timeline')?.addEventListener('click',() => { aiMenu.open = false; openTimelineReview(); });
  const openAi = () => { if (aiMenu) aiMenu.open = false; document.querySelectorAll('.hdr-dropdown.open').forEach(d => d.classList.remove('open')); openAiPlanner(); };
  ['btn-open-ai-planner', 'btn-open-ai-planner-menu'].forEach(id => { const b = document.getElementById(id); if (b) b.addEventListener('click', openAi); });
  const nb = document.getElementById('btn-open-notion-sync');
  if (nb) nb.addEventListener('click', () => { document.querySelectorAll('.hdr-dropdown.open').forEach(d => d.classList.remove('open')); openNotionSync(); });
  renderAiFileList = GDHomeAI.attachments({
    state:AIPlanner,input:document.getElementById('ai-file-input'),drop:document.getElementById('ai-drop-zone'),
    list:document.getElementById('ai-file-list'),root:document.getElementById('ai-planner-modal')
  });
  const lm = document.getElementById('ai-limit-mode');
  if (lm) lm.addEventListener('change', () => {
    document.getElementById('ai-days-wrap').style.display = lm.value === 'days' ? '' : 'none';
    document.getElementById('ai-end-wrap').style.display = lm.value === 'end' ? '' : 'none';
  });
  const on = (id, fn) => { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); };
  on('btn-ai-run', runAiPlanner);
  on('btn-ai-back', () => { document.getElementById('ai-step-input').style.display = ''; document.getElementById('ai-step-review').style.display = 'none'; });
  on('btn-ai-fit', fitAiRowsToTarget);
  on('btn-ai-apply', applyAiPlan);
  on('btn-notion-sync2', () => runNotionAction('both'));
  on('btn-notion-pull', () => runNotionAction('pull'));
}
window.addEventListener('DOMContentLoaded',setupIntegrationsUI);
document.getElementById('btn-project-profile').onclick = () => {
  const project = getTitleProject(AppState.viewMode) || getActiveProject();
  if (!project) return showToast('Chọn một dự án để mở hồ sơ.');
  GDHomeProjects.open({...project.profile,project:project.name},async profile => {
    if (_guestMode || isOfflineFileMode()) {
      if (profile.project) renameProjectAndSync(project,profile.project);
      const {project:_name,...contact} = profile;
      project.profile = {...project.profile,...contact};
      saveToBackend();
      updateUIElements();
      return;
    }
    if (_pendingSync) await flushSaveToBackend();
    if (_pendingSync) throw new Error('Lưu thay đổi Tiến độ trước khi sửa hồ sơ.');
    await GDHomeProjects.save({projectId:project.id,profile});
    await syncWithBackend();
  });
};
function refreshSharedProjectProfiles() {
  if (_guestMode || _loginOverlayShown || _pendingSync || isOfflineFileMode() || !_scheduleReady) return;
  GDHomeProjects.list().then(({projects}) => {
    let changed = false;
    for (const project of projects) {
      const owner = AppState.projectOwners.find(owner => owner.id === project.id);
      if (owner && (owner.name !== project.name || JSON.stringify(owner.profile) !== JSON.stringify(project.profile))) {
        owner.name = project.name;
        owner.profile = project.profile;
        changed = true;
      }
    }
    if (changed) {
      updateUIElements();
      renderCalendarSidebar();
    }
  }).catch(() => {});
}
window.addEventListener('focus',refreshSharedProjectProfiles);
window.addEventListener('storage',event => { if (event.key === 'gdhome-project-update') refreshSharedProjectProfiles(); });

// Tuỳ chọn tự nối liên kết + nút nối các việc cũ chưa nối
window.addEventListener('DOMContentLoaded', () => {
  const tg = document.getElementById('toggle-auto-link');
  if (tg) {
    tg.checked = AppState.autoLinkNewTasks !== false;
    tg.addEventListener('change', () => {
      AppState.autoLinkNewTasks = tg.checked;
      saveToBackend();
      showToast(tg.checked ? 'Việc mới tạo sẽ tự nối với việc trước trong cùng giai đoạn' : 'Đã tắt tự nối việc mới');
    });
  }
  const btn = document.getElementById('btn-auto-link-stages');
  if (btn) btn.addEventListener('click', () => {
    const timelineOn = !!document.querySelector('.msp-split-workspace') && !!document.querySelector('.msp-split-workspace').offsetParent;
    const cals = timelineOn && typeof getMspTargetCalendars === 'function' ? getMspTargetCalendars() : [getActiveCalendar()].filter(Boolean);
    let n = 0;
    cals.forEach(c => { n += autoLinkStage(c.id, AppState.tasks, { markAuto: true }); });
    if (!n) { showToast('Không có việc nào cần nối thêm (các việc đã có liên kết hoặc cách nhau quá xa)'); return; }
    syncAllFromMSProject(`🔗 Đã tự nối ${n} liên kết trong ${cals.length} giai đoạn (Ctrl+Z để hoàn tác)`);
  });
  const btnRe = document.getElementById('btn-auto-relink-stages');
  if (btnRe) btnRe.addEventListener('click', async () => {
    const timelineOn = !!document.querySelector('.msp-split-workspace') && !!document.querySelector('.msp-split-workspace').offsetParent;
    const cals = timelineOn && typeof getMspTargetCalendars === 'function' ? getMspTargetCalendars() : [getActiveCalendar()].filter(Boolean);
    if (!cals.length) return;
    const names = cals.map(c => c.name).slice(0, 4).join(', ') + (cals.length > 4 ? '…' : '');
    if (!await GDHomeShell.confirm(`Nối lại TOÀN BỘ liên kết trong ${cals.length} giai đoạn đang hiển thị (${names}) theo quy tắc mới?\n\nCác liên kết hiện có giữa các việc trong những giai đoạn này sẽ được thay thế. Ctrl+Z để hoàn tác.`)) return;
    const calIds = new Set(cals.map(c => c.id));
    const taskCal = new Map(AppState.tasks.map(t => [t.id, t.calendarId]));
    AppState.tasks.forEach(t => {
      if (!calIds.has(t.calendarId) || !Array.isArray(t.predecessors)) return;
      t.predecessors = t.predecessors.filter(l => taskCal.get(l.id) !== t.calendarId); // giữ liên kết khác giai đoạn
    });
    let n = 0;
    cals.forEach(c => { n += autoLinkStage(c.id, AppState.tasks, { markAuto: true }); });
    syncAllFromMSProject(`↺ Đã nối lại ${n} liên kết trong ${cals.length} giai đoạn (Ctrl+Z để hoàn tác)`);
  });
  const btnSort = document.getElementById('btn-sort-stages-by-time');
  if (btnSort) btnSort.addEventListener('click', () => {
    const timelineOn = !!document.querySelector('.msp-split-workspace') && !!document.querySelector('.msp-split-workspace').offsetParent;
    const cals = timelineOn && typeof getMspTargetCalendars === 'function' ? getMspTargetCalendars() : [getActiveCalendar()].filter(Boolean);
    if (!cals.length) return;
    sortTasksByTimeKeepLinked(new Set(cals.map(c => c.id)));
    syncAllFromMSProject(`⇅ Đã sắp lại theo thời gian trong ${cals.length} giai đoạn, giữ các việc đã nối liền nhau (Ctrl+Z để hoàn tác)`);
  });
});
