/* Tab "Khảo sát khách" trong /mau-tra-loi: tạo link khảo sát cho dự án, xem câu trả lời, copy tóm tắt nhu cầu và tin nhắn mời. */
(() => {
  const S = window.GDHomeShell, R = window.GDHomeReplyData, K = window.GDHomeSurveyData;
  const byId = id => document.getElementById(id);
  const esc = value => S.escape(String(value));
  const state = {projects: [], id: '', info: null};
  const prefs = () => { try { return JSON.parse(localStorage.getItem('gdhome_reply_prefs') || '{}'); } catch { return {}; } };
  const project = () => state.projects.find(p => p.id === state.id);
  const time = ms => new Date(ms).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'});
  const fullLink = () => state.info?.path ? location.origin + state.info.path : '';

  async function copy(text, done) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = document.createElement('textarea');
      area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    S.toast(done);
  }

  function inviteMessage() {
    const p = prefs();
    return R.applyVars('{kh} ơi, {toi} {ten} gửi {kh} phiếu khảo sát nhu cầu thiết kế cho ' + (project()?.name || '{du_an}') +
      ' ạ.\n{kh} mở link bên dưới bằng điện thoại và tích chọn giúp {toi} nhé (khoảng 10 - 15 phút, có thể dừng giữa chừng và mở lại link để điền tiếp):\n' +
      fullLink() + '\nCâu nào chưa rõ {kh} cứ bỏ qua, {toi} sẽ trao đổi thêm. {toi} cảm ơn {kh} ạ!', {kh: p.kh, ten: p.ten, du_an: p.du_an});
  }

  function render() {
    const info = state.info, linked = !!info?.token;
    byId('sv-create').textContent = linked ? 'Làm mới' : 'Tạo link khảo sát';
    byId('sv-box').hidden = !linked;
    if (!state.id) { byId('sv-status').textContent = ''; byId('sv-detail').hidden = true; return; }
    byId('sv-link').value = fullLink();
    byId('sv-status').textContent = !linked ? 'Chưa tạo link khảo sát cho dự án này.' : info.submittedAt ? 'Đã gửi lúc ' + time(info.submittedAt)
      : info.updatedAt ? 'Chưa gửi - khách đang điền dở (lưu lúc ' + time(info.updatedAt) + ')' : 'Chưa gửi';
    byId('sv-status').dataset.state = info?.submittedAt ? 'sent' : 'pending';
    const summary = linked ? K.summarize(info.answers, project()?.name) : '';
    byId('sv-detail').hidden = !summary;
    byId('sv-summary').textContent = summary;
  }

  async function load() {
    state.info = null;
    if (state.id) {
      try { state.info = await S.api('/api/surveys/' + encodeURIComponent(state.id)); }
      catch (error) { S.toast('Không tải được khảo sát: ' + error.message); }
    }
    render();
  }

  async function create() {
    if (!state.id) return S.toast('Chọn dự án trước.');
    if (state.info?.token) return load();
    try {
      state.info = await S.api('/api/surveys/link', {method: 'POST', body: {projectId: state.id, name: project()?.name || ''}});
      render(); S.toast('Đã tạo link khảo sát');
    } catch (error) { S.toast('Không tạo được link: ' + error.message); }
  }

  function setTab(tab) {
    const survey = tab === 'khao-sat';
    document.querySelectorAll('.mt-tabs button').forEach(b => b.classList.toggle('is-on', b.dataset.tab === tab));
    document.querySelector('.mt-grid').hidden = survey;
    byId('sv-panel').hidden = !survey;
    byId('mt-new').hidden = survey;
    if (survey && !state.projects.length) init();
  }

  async function init() {
    try {
      const data = await S.api('/api/project-hub/overview');
      state.projects = (data.projects || []).map(p => ({id: p.id, name: p.name || p.id}));
    } catch (error) { return S.toast('Không tải được danh sách dự án: ' + error.message); }
    byId('sv-project').innerHTML = '<option value="">- Chọn dự án -</option>' + state.projects.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
    byId('sv-project').value = state.id;
  }

  document.querySelector('.mt-tabs').addEventListener('click', event => {
    const b = event.target.closest('button[data-tab]');
    if (b) setTab(b.dataset.tab);
  });
  byId('sv-project').addEventListener('change', event => { state.id = event.target.value; load(); });
  byId('sv-create').addEventListener('click', create);
  byId('sv-copy-link').addEventListener('click', () => copy(fullLink(), 'Đã copy link khảo sát'));
  byId('sv-copy-msg').addEventListener('click', () => copy(inviteMessage(), 'Đã copy tin nhắn mời'));
  byId('sv-copy-summary').addEventListener('click', () => copy(byId('sv-summary').textContent, 'Đã copy tóm tắt nhu cầu'));
  byId('sv-refresh').addEventListener('click', load);
})();
