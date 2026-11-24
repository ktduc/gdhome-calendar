/* Mẫu trả lời khách (/mau-tra-loi): chọn xưng hô, xem trước, copy; sửa/thêm/xoá/nhân bản lưu server (/api/reply-templates). */
(() => {
  const D = window.GDHomeReplyData, S = window.GDHomeShell;
  const byId = id => document.getElementById(id);
  const esc = value => S.escape(String(value));
  const PREF = 'gdhome_reply_prefs';
  const state = {kh: 'chị', ten: '', du_an: '', q: '', group: '', sel: '', off: new Set(), editing: null,
    saved: {items: [], deleted: []}, list: []};
  const status = () => byId('save-status');

  try { Object.assign(state, JSON.parse(localStorage.getItem(PREF) || '{}')); } catch { /* không có localStorage thì dùng mặc định */ }
  const opts = () => ({kh: state.kh, ten: state.ten, du_an: state.du_an});
  const remember = () => { try { localStorage.setItem(PREF, JSON.stringify({kh: state.kh, ten: state.ten, du_an: state.du_an})); } catch { /* bỏ qua */ } };
  const find = id => state.list.find(t => t.id === id);
  const rebuild = () => { state.list = D.mergeTemplates(D.BASE, state.saved); };
  const groupsOf = () => [...new Set([...D.GROUPS, ...state.list.map(t => t.group)])].filter(g => state.list.some(t => t.group === g));

  async function persist() {
    S.saveStatus(status(), 'saving');
    try {
      state.saved = await S.api('/api/reply-templates', {method: 'POST', body: state.saved});
      rebuild();
      S.saveStatus(status(), 'saved');
      return true;
    } catch (error) {
      S.saveStatus(status(), 'error', error.message);
      S.toast('Không lưu được: ' + error.message);
      return false;
    }
  }

  function visible() {
    const q = state.q.trim().toLowerCase();
    return state.list.filter(t => (!state.group || t.group === state.group) &&
      (!q || (t.title + ' ' + t.body + ' ' + t.items.join(' ')).toLowerCase().includes(q)));
  }

  function renderBar() {
    document.querySelectorAll('#mt-kh button').forEach(b => b.classList.toggle('is-on', b.dataset.kh === state.kh));
    const v = D.varsOf(opts());
    byId('mt-who').textContent = 'Gọi khách “' + v.kh + '”, xưng “' + v.toi + '”';
  }

  function renderSide() {
    const total = state.list.length;
    byId('mt-groups').innerHTML = '<button type="button" data-g="" class="' + (state.group ? '' : 'is-on') + '"><span>Tất cả</span><b>' + total + '</b></button>' +
      groupsOf().map(g => '<button type="button" data-g="' + esc(g) + '" class="' + (state.group === g ? 'is-on' : '') + '"><span>' + esc(g) +
        '</span><b>' + state.list.filter(t => t.group === g).length + '</b></button>').join('');
    const n = state.saved.deleted.length;
    const restore = byId('mt-restore');
    restore.hidden = !n;
    restore.textContent = 'Khôi phục ' + n + ' mẫu gốc đã xoá';
  }

  function renderList() {
    const rows = visible();
    let last = '';
    byId('mt-list').innerHTML = rows.length ? rows.map(t => {
      const head = t.group !== last ? '<div class="mt-gh">' + esc(t.group) + '</div>' : '';
      last = t.group;
      const preview = D.buildMessage(t, opts()).replace(/\s+/g, ' ').slice(0, 90);
      return head + '<button type="button" class="mt-item' + (t.id === state.sel ? ' is-on' : '') + '" data-id="' + esc(t.id) + '"><strong>' + esc(t.title) +
        (t._edited ? '<span class="mt-tag">đã sửa</span>' : (t._base ? '' : '<span class="mt-tag">của anh</span>')) + '</strong><small>' + esc(preview) + '</small></button>';
    }).join('') : '<p class="mt-empty">Không có mẫu phù hợp.</p>';
  }

  function renderView() {
    const view = byId('mt-view'), t = state.editing || find(state.sel);
    if (state.editing) return renderForm(view, state.editing);
    if (!t) { view.innerHTML = '<p class="mt-empty">Chọn một mẫu ở danh sách bên trái.</p>'; return; }
    const checks = t.items.length ? '<div class="mt-checks" id="mt-checks">' + t.items.map((item, i) =>
      '<label><input type="checkbox" data-i="' + i + '"' + (state.off.has(i) ? '' : ' checked') + '><span>' +
      esc(D.applyVars(item, opts()).split('\n')[0]) + (item.includes('\n') ? ' …' : '') + '</span></label>').join('') + '</div>' : '';
    view.innerHTML = '<h2>' + esc(t.title) + '</h2><p class="mt-sub">' + esc(t.group) + (t.items.length ? ' · tick các ý muốn gửi' : '') + '</p>' + checks +
      '<pre class="mt-preview" id="mt-preview"></pre>' +
      '<div class="mt-actions"><button type="button" class="btn btn-primary" data-act="copy">Copy tin nhắn</button>' +
      '<button type="button" class="btn btn-outline" data-act="edit">Sửa</button>' +
      '<button type="button" class="btn btn-outline" data-act="dup">Nhân bản</button>' +
      (t._edited ? '<button type="button" class="btn btn-outline" data-act="reset">Về mẫu gốc</button>' : '') +
      '<button type="button" class="btn btn-outline" data-act="del">Xoá</button></div>';
    renderPreview();
  }

  function renderPreview() {
    const t = find(state.sel), el = byId('mt-preview');
    if (t && el) el.textContent = D.buildMessage(t, opts(), state.off);
  }

  function renderForm(view, t) {
    view.innerHTML = '<h2>' + (t._new ? 'Thêm mẫu mới' : 'Sửa mẫu') + '</h2><p class="mt-sub">Biến: {kh} khách, {toi} em/anh, {ten} người phụ trách, {du_an} dự án, {items} chỗ chèn danh sách.</p>' +
      '<form class="mt-form" id="mt-form"><label>Nhóm<input name="group" list="mt-group-list" maxlength="50" value="' + esc(t.group) + '"></label>' +
      '<datalist id="mt-group-list">' + groupsOf().map(g => '<option value="' + esc(g) + '">').join('') + '</datalist>' +
      '<label>Tên mẫu<input name="title" maxlength="100" required value="' + esc(t.title) + '"></label>' +
      '<label>Nội dung tin nhắn<textarea name="body" rows="10" maxlength="4000">' + esc(t.body) + '</textarea></label>' +
      '<label>Danh sách ý tick chọn (mỗi dòng một ý, có thể để trống)<small>Ý có xuống dòng bên trong: dùng kiểu “đoạn”.</small><textarea name="items" rows="5">' + esc(t.items.join('\n')) + '</textarea></label>' +
      '<label>Kiểu danh sách<select name="style"><option value="num">Đánh số 1/ 2/</option><option value="dash">Gạch đầu dòng</option><option value="block">Đoạn cách dòng</option></select></label>' +
      '<div class="mt-actions"><button type="submit" class="btn btn-primary">Lưu</button><button type="button" class="btn btn-outline" data-act="cancel">Huỷ</button></div></form>';
    view.querySelector('[name=style]').value = t.style || 'num';
  }

  function renderAll() { renderBar(); renderSide(); renderList(); renderView(); }

  function select(id) { state.sel = id; state.off = new Set(); state.editing = null; renderList(); renderView(); }

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const area = document.createElement('textarea');
      area.value = text; area.style.position = 'fixed'; area.style.opacity = '0';
      document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
    }
    S.toast('Đã copy tin nhắn');
  }

  const uid = () => 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const plain = t => ({id: t.id, group: t.group, title: t.title, body: t.body, items: t.items.slice(), style: t.style || 'num'});

  async function upsert(t) {
    const rest = state.saved.items.filter(x => x.id !== t.id);
    state.saved = {...state.saved, items: [...rest, plain(t)]};
    return persist();
  }

  async function act(name) {
    const t = find(state.sel);
    if (name === 'cancel') { state.editing = null; return renderView(); }
    if (!t) return;
    if (name === 'copy') return copy(D.buildMessage(t, opts(), state.off));
    if (name === 'edit') { state.editing = plain(t); return renderView(); }
    if (name === 'dup') {
      const copyT = {...plain(t), id: uid(), title: t.title + ' (bản sao)'};
      if (await upsert(copyT)) { state.group = ''; select(copyT.id); renderAll(); S.toast('Đã nhân bản mẫu'); }
      return;
    }
    if (name === 'reset') {
      state.saved = {...state.saved, items: state.saved.items.filter(x => x.id !== t.id)};
      if (await persist()) { renderAll(); S.toast('Đã về mẫu gốc'); }
      return;
    }
    if (name === 'del') {
      const ok = await S.confirm({title: 'Xoá mẫu', message: 'Xoá mẫu “' + t.title + '”?' + (t._base ? ' Mẫu gốc có thể khôi phục lại.' : ''), okText: 'Xoá', danger: true});
      if (!ok) return;
      state.saved = {items: state.saved.items.filter(x => x.id !== t.id),
        deleted: t._base ? [...new Set([...state.saved.deleted, t.id])] : state.saved.deleted};
      if (await persist()) { state.sel = ''; renderAll(); S.toast('Đã xoá mẫu'); }
    }
  }

  function bind() {
    byId('mt-kh').addEventListener('click', event => {
      const b = event.target.closest('button[data-kh]');
      if (!b) return;
      state.kh = b.dataset.kh; remember(); renderBar(); renderList(); renderView();
    });
    byId('mt-ten').addEventListener('input', event => { state.ten = event.target.value; remember(); renderBar(); renderList(); renderPreview(); });
    byId('mt-duan').addEventListener('input', event => { state.du_an = event.target.value; remember(); renderList(); renderPreview(); });
    byId('mt-search').addEventListener('input', event => { state.q = event.target.value; renderList(); });
    byId('mt-groups').addEventListener('click', event => {
      const b = event.target.closest('button[data-g]');
      if (!b) return;
      state.group = b.dataset.g; renderSide(); renderList();
    });
    byId('mt-list').addEventListener('click', event => {
      const b = event.target.closest('.mt-item');
      if (b) select(b.dataset.id);
    });
    byId('mt-view').addEventListener('click', event => {
      const b = event.target.closest('[data-act]');
      if (b) act(b.dataset.act);
    });
    byId('mt-view').addEventListener('change', event => {
      const box = event.target.closest('input[data-i]');
      if (!box) return;
      const i = +box.dataset.i;
      if (box.checked) state.off.delete(i); else state.off.add(i);
      renderPreview();
    });
    byId('mt-view').addEventListener('submit', async event => {
      event.preventDefault();
      const f = new FormData(event.target), t = state.editing;
      const next = {...t, group: String(f.get('group')).trim() || 'Khác', title: String(f.get('title')).trim(), body: String(f.get('body')),
        items: String(f.get('items')).split('\n').map(x => x.trim()).filter(Boolean), style: String(f.get('style'))};
      if (!next.title) return S.toast('Cần nhập tên mẫu.');
      delete next._new;
      if (await upsert(next)) { state.editing = null; state.sel = next.id; state.off = new Set(); renderAll(); S.toast('Đã lưu mẫu'); }
    });
    byId('mt-new').addEventListener('click', () => {
      state.editing = {id: uid(), group: state.group || 'Khác', title: '', body: '', items: [], style: 'num', _new: true};
      renderView(); byId('mt-view').querySelector('[name=title]')?.focus();
    });
    byId('mt-restore').addEventListener('click', async () => {
      state.saved = {...state.saved, deleted: []};
      if (await persist()) { renderAll(); S.toast('Đã khôi phục mẫu gốc'); }
    });
  }

  async function init() {
    byId('mt-ten').value = state.ten; byId('mt-duan').value = state.du_an;
    bind();
    try { state.saved = await S.api('/api/reply-templates'); }
    catch (error) { S.saveStatus(status(), 'error', error.message); S.toast('Chưa tải được mẫu đã sửa: ' + error.message); }
    rebuild();
    state.sel = state.list[0]?.id || '';
    renderAll();
  }
  init();
})();
