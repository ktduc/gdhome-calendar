/* Thông tin nhân viên (/nhan-su) – trang phụ của Thống kê dự án. TAG = tên rút gọn dùng ở các cột Người bên /thong-ke */
(() => {
  'use strict';
  const Shell = window.GDHomeShell, byId = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
  const LIGHT = ['gray', 'brown', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'red'];
  const hashColor = name => LIGHT[[...norm(name)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % LIGHT.length];
  const DEFAULT_OPTIONS = {
    dept: ['Thiết kế', 'Kỹ thuật – HSKT', 'Thi công – Giám sát', 'Kinh doanh', 'Kế toán – Hành chính'],
    skills: ['3D', 'HSKT', 'Diễn hoạ', 'Kiến trúc', 'Nội thất', 'Dự toán', 'Giám sát', 'Chốt mã'],
    role: ['Trưởng phòng', 'Trưởng nhóm', 'Nhân viên', 'Thực tập'],
    status: ['Chính thức', 'Thử việc', 'Cộng tác viên', 'Đã nghỉ'],
  };
  const COLS = [
    {key: 'name', label: 'Họ tên', type: 'name'},
    {key: 'tag', label: 'TAG', type: 'text', ph: 'GD - TÊN'},
    {key: 'dept', label: 'Bộ phận', type: 'select'},
    {key: 'skills', label: 'Chuyên môn', type: 'multi'},
    {key: 'role', label: 'Chức vụ', type: 'select'},
    {key: 'status', label: 'Trạng thái', type: 'select'},
    {key: 'startAt', label: 'Ngày đi làm', type: 'date'},
    {key: 'tenure', label: 'Thâm niên', type: 'calc'},
    {key: 'birthday', label: 'Sinh nhật', type: 'date'},
    {key: 'phone', label: 'SĐT', type: 'text'},
    {key: 'email', label: 'Email', type: 'text'},
    {key: 'projects', label: 'Dự án', type: 'calc'},
    {key: 'note', label: 'Ghi chú', type: 'text'},
  ];
  const VIEWS = [['all', 'Tất cả'], ['active', 'Đang làm'], ['bday', 'Sinh nhật tháng này'], ['left', 'Đã nghỉ']];
  const PEOPLE_KEYS = ['designer3d', 'designerHskt', 'supervisor', 'contractor'];
  let doc = {items: [], options: {}, updatedAt: 0}, projects = [], view = 'all', group = '', query = '', saveTimer = 0, pop = null;
  try { ({view = 'all', group = ''} = JSON.parse(localStorage.getItem('gdhome-nhan-su')) || {}); } catch { /* bộ nhớ trình duyệt bị chặn: dùng mặc định */ }
  const keepPrefs = () => { try { localStorage.setItem('gdhome-nhan-su', JSON.stringify({view, group})); } catch { /* bỏ qua */ } };

  const optionsOf = key => {
    const list = (doc.options[key] || DEFAULT_OPTIONS[key].map(name => ({name, color: hashColor(name)}))).map(o => ({...o}));
    const known = new Set(list.map(o => norm(o.name)));
    for (const it of doc.items) for (const v of splitVals(it[key])) if (!known.has(norm(v))) { known.add(norm(v)); list.push({name: v, color: hashColor(v)}); }
    return list;
  };
  const splitVals = v => String(v || '').split(',').map(s => s.trim()).filter(Boolean);
  const chip = (key, name) => `<span class="tk-tag c-${optionsOf(key).find(o => o.name === name)?.color || hashColor(name)}">${esc(name)}</span>`;
  const isLeft = it => norm(it.status) === norm('Đã nghỉ');

  // ---------- giá trị tự tính ----------
  function tenure(startAt) {
    if (!startAt) return '';
    const d = new Date(startAt + 'T00:00:00'), now = new Date();
    let m = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth() - (now.getDate() < d.getDate() ? 1 : 0);
    if (m < 0) return 'Sắp vào';
    return (m >= 12 ? Math.floor(m / 12) + ' năm ' : '') + (m % 12 || m < 12 ? (m % 12) + ' tháng' : '');
  }
  function daysToBirthday(birthday) {
    if (!birthday) return null;
    const now = new Date(), today = new Date(now.getFullYear(), now.getMonth(), now.getDate()), [, mm, dd] = birthday.split('-').map(Number);
    let next = new Date(today.getFullYear(), mm - 1, dd);
    if (next < today) next = new Date(today.getFullYear() + 1, mm - 1, dd);
    return Math.round((next - today) / 864e5);
  }
  const bdayBadge = v => { const days = daysToBirthday(v); return days != null && days <= 7 ? `<span class="ns-bday" title="${days ? 'Còn ' + days + ' ngày' : 'Hôm nay'}">🎂${days ? days + 'd' : ''}</span>` : ''; };
  function projectsOf(tag) {
    const k = norm(tag);
    if (!k) return [];
    return projects.filter(p => [...PEOPLE_KEYS.map(f => p.profile?.[f]), p.auto?.designer3d, p.auto?.designerHskt]
      .some(v => splitVals(v).some(x => norm(x) === k))).map(p => p.profile?.project || p.name || '');
  }

  // ---------- vẽ bảng ----------
  function cell(it, col) {
    const v = it[col.key] || '';
    switch (col.type) {
      case 'name': return `<th scope="row" class="tk-col-name"><div class="tk-name"><input data-f="name" value="${esc(v)}" placeholder="Họ tên" aria-label="Họ tên"><span class="tk-links"><button type="button" class="tk-more" data-del title="Xoá nhân viên" aria-label="Xoá ${esc(v)}">🗑</button></span></div></th>`;
      case 'select': case 'multi': return `<td class="tk-col-select"><button type="button" class="tk-tags" data-pick="${col.key}" aria-label="${col.label}">${splitVals(v).map(x => chip(col.key, x)).join('')}</button></td>`;
      case 'date': return `<td class="tk-col-date ns-date"><input type="date" data-f="${col.key}" value="${esc(v)}" aria-label="${col.label}">${col.key === 'birthday' ? bdayBadge(v) : ''}</td>`;
      case 'calc': {
        if (col.key === 'tenure') return `<td class="ns-calc">${esc(isLeft(it) ? '' : tenure(it.startAt))}</td>`;
        const list = projectsOf(it.tag);
        return `<td class="ns-calc tk-num" title="${esc(list.join('\n'))}">${list.length ? `<a href="/thong-ke">${list.length} dự án</a>` : ''}</td>`;
      }
      default: return `<td class="tk-col-text ns-${col.key}"><input data-f="${col.key}" value="${esc(v)}" placeholder="${esc(col.ph || '')}" aria-label="${col.label}"></td>`;
    }
  }
  function visible() {
    const q = norm(query), month = new Date().getMonth() + 1;
    return doc.items.filter(it => {
      if (view === 'active' && isLeft(it)) return false;
      if (view === 'left' && !isLeft(it)) return false;
      if (view === 'bday' && Number(it.birthday?.slice(5, 7)) !== month) return false;
      return !q || norm([it.name, it.tag, it.dept, it.skills, it.role, it.status, it.phone, it.email, it.note].join(' ')).includes(q);
    });
  }
  function render() {
    const counts = {all: doc.items.length, active: doc.items.filter(it => !isLeft(it)).length, left: doc.items.filter(isLeft).length, bday: doc.items.filter(it => Number(it.birthday?.slice(5, 7)) === new Date().getMonth() + 1).length};
    byId('ns-views').innerHTML = VIEWS.map(([id, label]) => `<button type="button" role="tab" aria-selected="${view === id}" data-view="${id}">${label} <span class="tk-muted">${counts[id]}</span></button>`).join('');
    byId('ns-group').value = group;
    const list = visible();
    if (!doc.items.length) { byId('ns-wrap').innerHTML = '<p class="tk-empty">Chưa có nhân viên. Bấm "+ Thêm nhân viên".</p>'; return; }
    const head = `<thead><tr>${COLS.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>`;
    const row = it => `<tr data-id="${esc(it.id)}" class="${isLeft(it) ? 'is-done' : ''}">${COLS.map(c => cell(it, c)).join('')}</tr>`;
    let body;
    if (group) {
      const lanes = [...optionsOf(group).map(o => o.name), ''];
      body = lanes.map(name => {
        const rows = list.filter(it => name ? splitVals(it[group]).includes(name) : !splitVals(it[group]).length);
        return rows.length ? `<tr class="ns-group"><th colspan="${COLS.length}">${name ? chip(group, name) : '(trống)'} <span class="tk-muted">${rows.length}</span></th></tr>` + rows.map(row).join('') : '';
      }).join('');
    } else body = list.map(row).join('');
    byId('ns-wrap').innerHTML = `<table class="tk-table ns-table">${head}<tbody>${body || `<tr><td colspan="${COLS.length}" class="tk-empty">Không có ai khớp.</td></tr>`}</tbody></table>`;
  }

  // ---------- lưu ----------
  function save() {
    clearTimeout(saveTimer);
    Shell.saveStatus(byId('save-status'), 'saving');
    saveTimer = setTimeout(post, 600);
  }
  async function post(force = false) {
    try {
      const res = await Shell.api('/api/staff', {method: 'POST', body: {items: doc.items, options: doc.options, baseAt: doc.updatedAt, force}});
      doc.updatedAt = res.updatedAt;
      Shell.saveStatus(byId('save-status'), 'saved');
    } catch (error) {
      if (error.status === 409) {
        if (await Shell.ask({title: 'Danh sách đã được sửa ở nơi khác', message: 'Máy hoặc tab khác vừa lưu bản mới hơn. Ghi đè bằng bản trên máy này?\nChọn Huỷ: tải lại bản mới nhất (bỏ thay đổi vừa rồi).', okText: 'Ghi đè', danger: true})) return post(true);
        return load();
      }
      Shell.saveStatus(byId('save-status'), 'error');
      Shell.toast('Không lưu được: ' + error.message);
    }
  }
  const itemOf = el => doc.items.find(it => it.id === el.closest('tr')?.dataset.id);

  // ---------- chọn lựa chọn (giống thẻ màu bên Thống kê) ----------
  function closePop() { pop?.el.remove(); pop = null; }
  function openPicker(btn) {
    closePop();
    const it = itemOf(btn), key = btn.dataset.pick, multi = COLS.find(c => c.key === key).type === 'multi';
    const el = document.body.appendChild(Object.assign(document.createElement('div'), {className: 'tk-pop'}));
    pop = {el, it, key, multi, q: '', editing: null};
    const r = btn.getBoundingClientRect();
    el.style.left = Math.min(r.left, innerWidth - 290) + 'px';
    el.style.top = (r.bottom + 390 > innerHeight ? Math.max(8, r.top - 384) : r.bottom + 4) + 'px';
    paintPop();
    el.querySelector('input')?.focus();
  }
  function setValue(list) { pop.it[pop.key] = list.join(', '); save(); render(); }
  function storeOptions(list) { doc.options[pop.key] = list.map(o => ({name: o.name, color: o.color})); save(); render(); }
  function paintPop() {
    const {el, it, key, multi, editing} = pop, sel = splitVals(it[key]), opts = optionsOf(key);
    if (editing) {
      const o = opts.find(x => x.name === editing);
      el.innerHTML = `<div class="tk-opt-edit"><input data-rename value="${esc(o.name)}" aria-label="Tên lựa chọn">
        <div class="tk-swatches">${[...LIGHT, ...LIGHT.map(c => c + '-d')].map(c => `<button type="button" class="tk-tag c-${c}" data-color="${c}" title="${c}">${o.color === c ? '✓' : 'A'}</button>`).join('')}</div>
        <button type="button" class="btn btn-outline btn-sm" data-remove>Xoá lựa chọn này</button><button type="button" class="btn btn-sm" data-back>← Xong</button></div>`;
      return el.querySelector('[data-rename]').focus();
    }
    const q = norm(pop.q), shown = opts.filter(o => !q || norm(o.name).includes(q));
    el.innerHTML = `<div class="tk-pop-head">${sel.map(v => `<span class="tk-tag c-${opts.find(o => o.name === v)?.color || hashColor(v)}">${esc(v)}<button type="button" data-unpick="${esc(v)}" aria-label="Bỏ ${esc(v)}">×</button></span>`).join('')}
      <input data-q value="${esc(pop.q)}" placeholder="Tìm hoặc gõ lựa chọn mới…" aria-label="Tìm lựa chọn"></div>
      <div class="tk-pop-list"><small>${multi ? 'Chọn một hoặc nhiều' : 'Chọn một'} · ⋯ để đổi tên, màu</small>
      ${shown.map(o => `<div class="tk-opt" data-opt="${esc(o.name)}"><span class="tk-check">${sel.includes(o.name) ? '✓' : ''}</span><span class="tk-tag c-${o.color}">${esc(o.name)}</span><button type="button" class="tk-edit" data-edit="${esc(o.name)}" aria-label="Sửa ${esc(o.name)}">⋯</button></div>`).join('')}
      ${pop.q.trim() && !opts.some(o => norm(o.name) === q) ? `<div class="tk-opt" data-create><span class="tk-check">+</span>Tạo "${esc(pop.q.trim())}"</div>` : ''}
      ${!multi && sel.length ? '<div class="tk-opt" data-clear><span class="tk-check">×</span>Để trống</div>' : ''}</div>`;
    const input = el.querySelector('[data-q]');
    input.setSelectionRange(input.value.length, input.value.length);
  }
  function pick(name) {
    const sel = splitVals(pop.it[pop.key]);
    if (pop.multi) setValue(sel.includes(name) ? sel.filter(x => x !== name) : [...sel, name]);
    else { setValue([name]); return closePop(); }
    pop.q = ''; paintPop(); pop.el.querySelector('[data-q]').focus();
  }
  // đổi tên / xoá lựa chọn: sửa luôn ở mọi nhân viên đang dùng
  function remap(old, next) {
    for (const it of doc.items) {
      const vals = splitVals(it[pop.key]);
      if (vals.includes(old)) it[pop.key] = [...new Set(vals.map(v => v === old ? next : v).filter(Boolean))].join(', ');
    }
  }
  function popClick(e) {
    const t = e.target;
    if (t.closest('[data-edit]')) { pop.editing = t.closest('[data-edit]').dataset.edit; return paintPop(); }
    if (t.closest('[data-unpick]')) { const v = t.closest('[data-unpick]').dataset.unpick; setValue(splitVals(pop.it[pop.key]).filter(x => x !== v)); return paintPop(); }
    if (t.closest('[data-create]')) { const name = pop.q.trim(); storeOptions([...optionsOf(pop.key), {name, color: hashColor(name)}]); return pick(name); }
    if (t.closest('[data-clear]')) { setValue([]); return closePop(); }
    if (t.closest('[data-opt]')) return pick(t.closest('[data-opt]').dataset.opt);
    if (t.dataset.color) { storeOptions(optionsOf(pop.key).map(o => o.name === pop.editing ? {...o, color: t.dataset.color} : o)); return paintPop(); }
    if (t.closest('[data-remove]')) { const old = pop.editing; remap(old, ''); storeOptions(optionsOf(pop.key).filter(o => o.name !== old)); pop.editing = null; return paintPop(); }
    if (t.closest('[data-back]')) { pop.editing = null; return paintPop(); }
  }
  function popRename(input) {
    const old = pop.editing, name = input.value.trim().replace(/,/g, ' ');
    if (!name || name === old) return;
    const clash = optionsOf(pop.key).find(o => o.name !== old && norm(o.name) === norm(name));
    remap(old, clash?.name || name);
    storeOptions(optionsOf(pop.key).filter(o => !clash || o.name !== old).map(o => o.name === old ? {...o, name} : o));
    pop.editing = clash?.name || name;
  }

  // ---------- sự kiện ----------
  function wire() {
    document.addEventListener('click', async e => {
      const t = e.target;
      if (pop && pop.el.contains(t)) return popClick(e);
      if (pop && !t.closest('[data-pick]')) closePop();
      if (t.closest('[data-act=add]')) {
        doc.items.push({id: 'ns-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: '', tag: '', dept: '', skills: '', role: '', status: 'Chính thức', startAt: '', birthday: '', phone: '', email: '', note: ''});
        view = view === 'left' ? 'all' : view; query = ''; byId('ns-search').value = '';
        render(); save();
        byId('ns-wrap').querySelector('tbody tr:last-child [data-f=name]')?.focus();
        return;
      }
      if (t.closest('[data-view]')) { view = t.closest('[data-view]').dataset.view; keepPrefs(); return render(); }
      if (t.closest('[data-pick]')) return openPicker(t.closest('[data-pick]'));
      if (t.closest('[data-del]')) {
        const it = itemOf(t);
        if (it && await Shell.ask({title: 'Xoá nhân viên', message: 'Xoá "' + (it.name || 'dòng trống') + '" khỏi danh sách?', okText: 'Xoá', danger: true})) { doc.items = doc.items.filter(x => x !== it); render(); save(); }
      }
    });
    document.addEventListener('input', e => {
      if (e.target.matches('[data-q]')) { pop.q = e.target.value; return paintPop(); }
      if (e.target === byId('ns-search')) { query = e.target.value; render(); byId('ns-search').focus(); }
    });
    document.addEventListener('change', e => {
      if (e.target.matches('[data-rename]')) return popRename(e.target);
      if (e.target === byId('ns-group')) { group = e.target.value; keepPrefs(); return render(); }
      const f = e.target.dataset.f, it = f && itemOf(e.target);
      if (!it) return;
      it[f] = f === 'tag' ? e.target.value.trim().toUpperCase() : e.target.value.trim();
      save();
      // chỉ vẽ lại ô tự tính của dòng này: vẽ cả bảng sẽ xoá mất ô người dùng vừa bấm sang
      const calc = {tag: 'projects', startAt: 'tenure'}[f], tr = e.target.closest('tr');
      if (calc) { const i = COLS.findIndex(c => c.key === calc); tr.children[i].outerHTML = cell(it, COLS[i]); }
      if (f === 'birthday') { const td = e.target.parentElement; td.querySelector('.ns-bday')?.remove(); td.insertAdjacentHTML('beforeend', bdayBadge(it.birthday)); }
    });
    document.addEventListener('keydown', e => {
      if (!pop) return;
      if (e.key === 'Escape') closePop();
      else if (e.key === 'Enter' && e.target.matches('[data-q]')) {
        e.preventDefault();
        const q = norm(pop.q), hit = optionsOf(pop.key).find(o => norm(o.name) === q) || optionsOf(pop.key).find(o => q && norm(o.name).includes(q));
        if (hit) pick(hit.name); else if (pop.el.querySelector('[data-create]')) popClick({target: pop.el.querySelector('[data-create]')});
      } else if (e.key === 'Enter' && e.target.matches('[data-rename]')) e.target.blur();
    });
    addEventListener('scroll', e => { if (pop && !pop.el.contains(e.target)) closePop(); }, true);
  }

  async function load() {
    try {
      doc = await Shell.api('/api/staff');
      render();
    } catch (error) {
      byId('ns-wrap').innerHTML = `<p class="tk-empty">${error.status === 401 ? 'Cần đăng nhập. Mở <a href="/tools">Trang chủ công cụ</a> để đăng nhập Gmail rồi quay lại.' : esc(error.message)}</p>`;
      return;
    }
    try { projects = (await Shell.api('/api/project-hub/overview')).projects || []; render(); } catch { /* không có dữ liệu dự án: bỏ cột đếm */ }
  }

  document.addEventListener('DOMContentLoaded', () => { Shell.layout?.(); wire(); load(); });
  window.GDHomeNhanSu = {tenure, daysToBirthday};
})();
