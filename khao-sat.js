/* Trang khách điền khảo sát (/khao-sat/<token>): từng bước theo nhóm, câu hỏi đổi theo loại công trình, tự lưu nháp. */
(() => {
  const D = window.GDHomeSurveyData;
  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const token = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
  const DRAFT = 'gdhome_survey_' + token;
  const state = {answers: {}, step: 0, done: false, submittedAt: 0, busy: false, error: ''};

  const store = {
    read() { try { return JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch { return null; } },
    write() { try { localStorage.setItem(DRAFT, JSON.stringify({at: Date.now(), answers: state.answers})); } catch { /* không có localStorage thì bỏ qua */ } }
  };
  const api = async (method, body) => {
    const res = await fetch('/api/survey/' + encodeURIComponent(token), {method, headers: {'Content-Type': 'application/json'}, body: body && JSON.stringify(body)});
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Không kết nối được máy chủ');
    return data;
  };
  const saveDraft = () => api('POST', {answers: state.answers, submit: false}).catch(() => {});

  const has = (id, v) => [].concat(state.answers[id] ?? []).includes(v);
  const time = ms => new Date(ms).toLocaleString('vi-VN', {hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric'});

  function questionHtml(q) {
    const label = esc(q.text) + (q.type === 'many' ? ' <span class="ks-hint">(chọn được nhiều)</span>' : '');
    if (q.type === 'text') {
      return '<div class="ks-q"><label class="ks-qt" for="q-' + q.id + '">' + label + '</label><textarea id="q-' + q.id + '" data-q="' + q.id + '" maxlength="1000">' + esc(state.answers[q.id] || '') + '</textarea></div>';
    }
    const kind = q.type === 'many' ? 'checkbox' : 'radio';
    const opts = q.options.map(o => '<label class="ks-opt"><input type="' + kind + '" name="' + q.id + '" data-q="' + q.id + '" value="' + esc(o.v) + '"' +
      (has(q.id, o.v) ? ' checked' : '') + '><span>' + esc(o.l) + '</span></label>').join('');
    const other = q.other ? '<input type="text" data-other="' + q.id + '" maxlength="300" placeholder="Khác… (ghi rõ)" value="' + esc(state.answers[q.id + '.khac'] || '') + '">' : '';
    return '<fieldset class="ks-q ks-' + q.type + '"><legend>' + label + '</legend><div class="ks-opts' + (q.options.length > 5 ? ' ks-grid2' : '') + '">' + opts + '</div>' + other + '</fieldset>';
  }

  function render() {
    const groups = D.visibleGroups(state.answers);
    state.step = Math.min(state.step, groups.length - 1);
    const group = groups[state.step], main = byId('ks-main'), nav = byId('ks-nav');
    byId('ks-bar').style.width = (state.done ? 100 : (state.step + 1) / groups.length * 100) + '%';
    nav.hidden = state.done;
    if (state.done) {
      main.innerHTML = '<div class="ks-thanks"><h2>Cảm ơn mình đã điền khảo sát!</h2><p>GD HOME đã nhận được câu trả lời và sẽ dựa vào đó để lên phương án thiết kế phù hợp nhất. ' +
        'Nếu cần bổ sung, mình có thể mở lại link này để sửa và gửi lại bất cứ lúc nào.</p><button type="button" class="ks-btn ks-ghost" id="ks-edit">Sửa lại câu trả lời</button></div>';
      return;
    }
    main.innerHTML = (state.step === 0 && state.submittedAt ? '<p class="ks-notice">Mình đã gửi khảo sát lúc ' + time(state.submittedAt) + '. Có thể chỉnh sửa rồi gửi lại.</p>' : '') +
      '<h2 class="ks-title">' + esc(group.title) + '</h2><p class="ks-intro">' + esc(group.intro || '') + '</p>' + group.questions.map(questionHtml).join('') +
      (state.error ? '<p class="ks-notice" role="alert">' + esc(state.error) + '</p>' : '');
    const last = state.step === groups.length - 1;
    byId('ks-step').textContent = 'Bước ' + (state.step + 1) + '/' + groups.length;
    byId('ks-back').disabled = state.step === 0 || state.busy;
    const next = byId('ks-next');
    next.textContent = last ? 'Gửi cho GD HOME' : 'Tiếp tục';
    next.disabled = state.busy || (state.step === 0 && !state.answers.loai_nha);
  }

  const signature = () => D.visibleQuestions(state.answers).map(q => q.id).join();

  function onAnswer(el) {
    const before = signature();
    const id = el.dataset.q;
    if (el.type === 'checkbox') {
      const list = new Set([].concat(state.answers[id] ?? []));
      el.checked ? list.add(el.value) : list.delete(el.value);
      if (list.size) state.answers[id] = [...list]; else delete state.answers[id];
    } else if (el.type === 'radio') state.answers[id] = el.value;
    else if (el.value.trim()) state.answers[id] = el.value; else delete state.answers[id];
    store.write();
    if (signature() !== before || (id === 'loai_nha')) { const y = scrollY; render(); scrollTo(0, y); }
  }

  async function move(delta) {
    const groups = D.visibleGroups(state.answers);
    state.error = '';
    if (delta > 0 && state.step === groups.length - 1) {
      state.busy = true; render();
      try {
        const saved = await api('POST', {answers: state.answers, submit: true});
        state.submittedAt = saved.submittedAt; state.done = true;
      } catch (error) { state.error = 'Chưa gửi được: ' + error.message + '. Câu trả lời vẫn được lưu trên máy, mình thử lại giúp nhé.'; }
      state.busy = false; render(); scrollTo(0, 0);
      return;
    }
    state.step = Math.max(0, state.step + delta);
    saveDraft(); render(); scrollTo(0, 0);
  }

  function bind() {
    const main = byId('ks-main');
    main.addEventListener('change', event => { if (event.target.dataset.q && event.target.type !== 'text') onAnswer(event.target); });
    main.addEventListener('input', event => {
      const el = event.target;
      if (el.tagName === 'TEXTAREA') onAnswer(el);
      else if (el.dataset.other) {
        if (el.value.trim()) state.answers[el.dataset.other + '.khac'] = el.value; else delete state.answers[el.dataset.other + '.khac'];
        store.write();
      }
    });
    main.addEventListener('click', event => { if (event.target.id === 'ks-edit') { state.done = false; state.step = 0; render(); scrollTo(0, 0); } });
    byId('ks-back').addEventListener('click', () => move(-1));
    byId('ks-next').addEventListener('click', () => move(1));
  }

  async function init() {
    bind();
    try {
      const data = await api('GET');
      byId('ks-project').textContent = data.name || 'GD HOME';
      state.answers = data.answers || {}; state.submittedAt = data.submittedAt || 0;
      const draft = store.read();
      if (draft && draft.at > (data.updatedAt || 0) && draft.answers) state.answers = draft.answers;
      render();
    } catch (error) {
      byId('ks-main').innerHTML = '<p class="ks-error">' + esc(error.message) + '</p>';
    }
  }
  init();
})();
