// Bảng thống kê dự án (/thong-ke): mỗi dự án 1 dòng như bảng Notion cũ, sửa thẳng trên ô.
// Ô để trống thì hiện giá trị "tự" (chữ xám) lấy từ Lịch / Chốt mã do server tính (project-table.js).
// Nhập: hợp đồng thiết kế (Word / dán chữ, contract-parse.js) và bảng Notion xuất CSV.
(() => {
  const esc = value => GDHomeShell.escape(value ?? '');
  const byId = id => document.getElementById(id);
  const api = (url, body) => GDHomeShell.api(url, body ? {method: 'POST', body} : {});
  const toast = message => GDHomeShell.toast(message);
  const PREF_KEY = 'gdhome-thong-ke-v1';
  const STAGES = ['Thi công', 'TC xong chưa QT', 'Thiết kế', 'TK xong chưa QT', 'Hoàn thành', 'Tạm dừng'];
  // Các phần của bảng (cùng 1 dữ liệu, lọc theo Giai đoạn); thứ tự ưu tiên từ trên xuống
  const SECTIONS = [
    {id: 'tc', label: 'THI CÔNG', stages: ['Thi công'], color: '#b45309'},
    {id: 'tcqt', label: 'TC XONG CHƯA QT', stages: ['TC xong chưa QT'], color: '#b91c1c'},
    {id: 'tk', label: 'THIẾT KẾ', stages: ['Thiết kế'], color: '#1d4ed8'},
    {id: 'tkqt', label: 'TK XONG CHƯA QT', stages: ['TK xong chưa QT'], color: '#7c3aed'},
    {id: 'khac', label: 'CHỜ · KHÁC', stages: null, color: '#0f766e'},   // giai đoạn tự đặt (vd "Chưa kí", "Đã gửi layout - chờ")
    {id: 'xong', label: 'ĐÃ QT · TẠM DỪNG', stages: ['Hoàn thành', 'Tạm dừng'], color: '#6b7280', collapsed: true},
  ];
  const STATUS3D = ['Chưa làm', 'Đang triển khai', 'Chờ phản hồi', 'Xong lần 1', 'Xong lần 2', 'Xong lần 3', 'Đang chỉnh sửa', 'Đã chốt'];
  const STATUS_HSKT = ['Chưa làm', 'Đang triển khai', 'Đã gửi', 'Đang chỉnh sửa', 'Đã chốt'];
  const MATERIALS = ['Chưa làm', 'Đang làm', 'Xong'];
  // Cột mặc định, gom theo giai đoạn: thông tin khách -> thiết kế -> thi công -> tiền. auto(p) = giá trị tự tính khi ô tay để trống.
  // Anh tự đổi thứ tự (kéo tiêu đề), độ rộng (kéo mép phải), tên, ẩn/hiện và thêm cột riêng ở menu Cột; cấu hình lưu trên server.
  const COLS = [
    {key: 'project', label: 'Dự án', type: 'name'},
    {key: 'customer', label: 'Khách / Bên A', type: 'text', hidden: true},
    {key: 'address', label: 'Vị trí', type: 'text'},
    {key: 'phone', label: 'SĐT', type: 'text'},
    {key: 'email', label: 'Email', type: 'text', hidden: true},
    {key: 'contractNo', label: 'Số HĐ', type: 'text', hidden: true},
    {key: 'signedAt', label: 'Ngày ký HĐTK', type: 'date'},
    {key: 'stage', label: 'Giai đoạn', type: 'select', options: STAGES, auto: p => p.profile.constructionSignedAt ? 'Thi công' : 'Thiết kế'},
    {key: 'designer3d', label: 'Người làm 3D', type: 'people', auto: p => p.auto?.designer3d},
    {key: 'status3d', label: 'Trạng thái 3D', type: 'select', options: STATUS3D, auto: p => p.auto?.status3d},
    {key: 'designerHskt', label: 'Người làm HSKT', type: 'people', auto: p => p.auto?.designerHskt},
    {key: 'statusHskt', label: 'Trạng thái HSKT', type: 'select', options: STATUS_HSKT, auto: p => p.auto?.statusHskt},
    {key: 'deadline', label: 'Hạn sắp tới', type: 'deadline', readonly: true},
    {key: 'deadlineLabel', label: 'Việc sắp tới', type: 'deadlineLabel', readonly: true},
    {key: 'daysLeft', label: 'Số ngày còn', type: 'daysLeft', readonly: true},
    {key: 'materialsStatus', label: 'Chốt mã VL', type: 'select', options: MATERIALS, auto: p => materialsAuto(p)},
    {key: 'constructionSignedAt', label: 'Ngày ký HĐTC', type: 'date'},
    {key: 'furnishAt', label: 'Ngày lên đồ', type: 'date'},
    {key: 'supervisor', label: 'Giám sát', type: 'people'},
    {key: 'contractor', label: 'Thầu thi công', type: 'people'},
    {key: 'checkDo', label: 'Check đồ', type: 'check'},
    {key: 'area', label: 'Diện tích m²', type: 'number', sum: true},
    {key: 'designPrice', label: 'Đơn giá TK', type: 'money'},
    {key: 'designValue', label: 'Giá trị HĐTK', type: 'money', sum: true, auto: p => designValueAuto(p)},
    {key: 'constructionValue', label: 'Giá trị thi công ƯT', type: 'money', sum: true},
    {key: 'payments', label: 'Thanh toán', type: 'payments', readonly: true},
    {key: 'note', label: 'Ghi chú', type: 'text', hidden: true},
  ];
  // Kiểu cho cột anh tự thêm (giống thuộc tính Notion)
  const CUSTOM_TYPES = [['text', 'Chữ'], ['number', 'Số'], ['money', 'Tiền'], ['date', 'Ngày'], ['select', 'Chọn 1'], ['people', 'Người'], ['check', 'Ô tick']];
  const VIEWS = [
    ['all', 'Tất cả'], ['design', 'Đang thiết kế'], ['build', 'Thi công'], ['soon', 'Deadline 7 ngày'],
    ['late', 'Trễ hạn'], ['pay', 'Chờ thu tiền'], ['done', 'Hoàn thành'],
  ];
  let projects = [], prefs = {view: 'all', group: '', mode: 'sections', hidden: null, sort: null, collapsed: null};
  try { Object.assign(prefs, JSON.parse(localStorage.getItem(PREF_KEY)) || {}); } catch { /* trình duyệt chặn bộ nhớ: dùng mặc định */ }
  if (!prefs.v2) { prefs.mode = 'sections'; prefs.v2 = true; }   // lần đầu có chia phần: mở chế độ Theo phần
  prefs.collapsed ||= SECTIONS.filter(s => s.collapsed).map(s => s.id);
  let schema = {columns: [], custom: [], sections: {}}, ALL = [];
  // Danh sách cột đã áp cấu hình: cột mặc định + cột riêng, theo thứ tự / tên / độ rộng / ẩn đã lưu
  function refreshCols() {
    const base = [...COLS, ...schema.custom.map(c => ({key: c.id, label: c.label, type: c.type, options: c.options, sum: ['number', 'money'].includes(c.type), custom: true}))];
    const conf = new Map(schema.columns.map((c, i) => [c.key, {...c, i}]));
    const hiddenDefault = prefs.hidden || COLS.filter(col => col.hidden).map(col => col.key);   // máy đã chỉnh ẩn cột trước khi có cấu hình chung
    ALL = base.map((col, d) => {
      const c = conf.get(col.key);
      return {...col, baseLabel: col.label, label: c?.label || col.label, width: c?.width || 0, hidden: c ? c.hidden : hiddenDefault.includes(col.key), order: c ? c.i : 1000 + d};
    }).sort((a, b) => (a.key === 'project' ? -1 : b.key === 'project' ? 1 : a.order - b.order));
  }
  refreshCols();
  let schemaTimer, schemaDirty = false;
  // Lưu cấu hình cột: gộp các lần chỉnh liên tiếp (400 ms); now = lưu ngay và chờ xong (trước khi nhập dữ liệu vào cột mới)
  function saveSchema(now = false) {
    schemaDirty = true;
    schema.columns = ALL.map(c => ({key: c.key, ...(c.label !== c.baseLabel ? {label: c.label} : {}), ...(c.width ? {width: c.width} : {}), hidden: c.hidden}));
    refreshCols();
    render();
    clearTimeout(schemaTimer);
    const post = async () => {
      const status = byId('save-status');
      GDHomeShell.saveStatus(status, 'saving');
      try { await api('/api/project-hub/table-schema', {schema}); schemaDirty = false; GDHomeShell.saveStatus(status, 'saved'); } catch (error) { GDHomeShell.saveStatus(status, 'error', error.message); toast('Không lưu được cấu hình cột: ' + error.message); }
    };
    if (now) return post();
    schemaTimer = setTimeout(post, 400);
  }
  const remember = () => { try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* bỏ qua */ } };

  // ------------------------------------------------------------ giá trị
  const num = value => Number(String(value ?? '').replace(/[^\d.]/g, '')) || 0;
  const fmtMoney = value => value === '' || value == null ? '' : Math.round(num(value)).toLocaleString('vi-VN');
  const fmtDate = iso => iso ? iso.slice(8, 10) + '/' + iso.slice(5, 7) + '/' + iso.slice(0, 4) : '';
  function materialsAuto(p) {
    const m = p.stats?.materials;
    if (!m?.totalRows) return '';
    return m.confirmedRows >= m.totalRows ? 'Xong' : m.confirmedRows ? 'Đang làm' : 'Chưa làm';
  }
  function designValueAuto(p) {
    const {area, designPrice, vat} = p.profile;
    return area && designPrice ? String(Math.round(num(area) * num(designPrice) * (1 + (Number(vat) || 0) / 100))) : '';
  }
  const colOf = key => ALL.find(col => col.key === key);
  function val(p, key) {
    if (key === 'project') return p.name;
    if (key === 'deadline') return p.auto?.deadline?.end || '';
    if (key === 'deadlineLabel') return p.auto?.deadline?.label || '';
    if (key === 'daysLeft') return p.auto?.deadline ? String(p.auto.deadline.daysLeft) : '';
    const manual = /^c_/.test(key) ? p.profile.custom?.[key] : p.profile[key];
    if (manual) return manual;
    return colOf(key)?.auto?.(p) || '';
  }
  function paymentDue(p, pay) {
    if (pay.paidAt || !num(pay.amount)) return false;
    const m = pay.milestone || pay.label || '', s3 = val(p, 'status3d'), sh = val(p, 'statusHskt');
    if (/ký/i.test(m)) return true;
    if (/3D/i.test(m)) return s3 === 'Đã chốt' || ['Đang triển khai', 'Đã gửi', 'Đang chỉnh sửa', 'Đã chốt'].includes(sh);
    if (/HSKT|kỹ thuật/i.test(m)) return ['Đã gửi', 'Đã chốt'].includes(sh);
    return false;
  }
  const duePayments = p => (p.profile.payments || []).filter(pay => paymentDue(p, pay));
  const daysLeft = p => p.auto?.deadline ? p.auto.deadline.daysLeft : null;

  function visible() {
    const q = byId('tk-search').value.trim().toLowerCase();
    let list = projects.filter(p => {
      const stage = val(p, 'stage');
      switch (prefs.view) {
        case 'design': return stage === 'Thiết kế';
        case 'build': return stage === 'Thi công';
        case 'soon': return daysLeft(p) !== null && daysLeft(p) <= 7;
        case 'late': return p.auto?.overdue?.length > 0;
        case 'pay': return duePayments(p).length > 0;
        case 'done': return stage === 'Hoàn thành';
        default: return true;
      }
    });
    if (q) list = list.filter(p => [p.name, ...Object.values(p.profile).filter(v => typeof v === 'string'), ...Object.values(p.profile.custom || {}), p.auto?.designer3d, p.auto?.designerHskt]
      .join(' ').toLowerCase().includes(q));
    const sort = prefs.sort || {key: 'deadline', dir: 1};
    const col = colOf(sort.key);
    const key = p => {
      const v = val(p, sort.key);
      if (col && ['number', 'money', 'daysLeft'].includes(col.type)) return v === '' ? '' : Number(String(v).replace(/[^\d.-]/g, '')) || 0;
      return String(v || '').toLowerCase();
    };
    return list.sort((a, b) => {
      const x = key(a), y = key(b);
      if (x === '') return y === '' ? 0 : 1;   // ô trống luôn xuống cuối
      if (y === '') return -1;
      return (x > y ? 1 : x < y ? -1 : 0) * sort.dir;
    });
  }
  function groupKeys(p) {
    const v = val(p, prefs.group);
    const keys = colOf(prefs.group)?.type === 'people' ? String(v).split(',').map(s => s.trim()).filter(Boolean) : [v];
    return keys.length && keys[0] ? keys : ['(trống)'];
  }

  // ------------------------------------------------------------ vẽ bảng
  function cell(p, col) {
    const v = (col.custom ? p.profile.custom?.[col.key] : p.profile[col.key]) ?? '', auto = col.auto?.(p) || '', f = `data-id="${esc(p.id)}" data-f="${col.key}"`;
    switch (col.type) {
      case 'name':
        return `<div class="tk-name"><input ${f} value="${esc(p.name)}" aria-label="Tên dự án">
          <span class="tk-links"><a href="/du-an?project=${encodeURIComponent(p.id)}" title="Hồ sơ dự án">📁</a><a href="/?project=${encodeURIComponent(p.id)}" title="Lịch tiến độ">📅</a><a href="/chot-ma?project=${encodeURIComponent(p.id)}" title="Chốt mã">🏷</a></span></div>`;
      case 'date': return `<input type="date" ${f} value="${esc(v)}">`;
      case 'check': return `<input type="checkbox" ${f} ${v ? 'checked' : ''} aria-label="${esc(col.label)}">`;
      case 'number': return `<input class="tk-num" inputmode="decimal" ${f} value="${esc(v ? String(v).replace('.', ',') : '')}" placeholder="${esc(auto)}">`;
      case 'money': return `<input class="tk-num" inputmode="numeric" ${f} value="${esc(fmtMoney(v || ''))}" placeholder="${esc(fmtMoney(auto))}">`;
      case 'select': {
        const options = [...new Set([...(col.options || []), v].filter(Boolean))];
        return `<select ${f} class="${v ? '' : 'is-auto'}" data-tone="${esc(v || auto)}"><option value="">${auto ? 'tự: ' + esc(auto) : '—'}</option>` +
          options.map(o => `<option${o === v ? ' selected' : ''}>${esc(o)}</option>`).join('') + '</select>';
      }
      case 'people': return `<input ${f} list="tk-people" value="${esc(v)}" placeholder="${esc(auto)}">`;
      case 'deadline': {
        const d = p.auto?.deadline, late = p.auto?.overdue || [];
        const lateChip = late.length ? `<span class="tk-chip is-late" title="${esc(late.map(t => t.label + ' ' + fmtDate(t.end)).join('\n'))}">Trễ ${late.length}</span>` : '';
        if (!d) return lateChip || '<span class="tk-muted">—</span>';
        const left = d.daysLeft === 0 ? 'hôm nay' : 'còn ' + d.daysLeft + ' ngày';
        return `<span class="tk-deadline">${fmtDate(d.start)}${d.start !== d.end ? ' → ' + fmtDate(d.end) : ''}</span> <small class="tk-left">${left}</small>${lateChip}`;
      }
      case 'daysLeft': {
        const d = p.auto?.deadline;
        return d ? `<span class="tk-num tk-left">${d.daysLeft === 0 ? 'Hôm nay' : d.daysLeft + ' ngày'}</span>` : '';
      }
      case 'deadlineLabel': return p.auto?.deadline ? `<span class="tk-chip">${esc(p.auto.deadline.label)}</span>` : '';
      case 'payments': {
        const list = p.profile.payments || [], paid = list.filter(x => x.paidAt).length, due = duePayments(p);
        if (!list.length) return `<button type="button" class="tk-pay" data-pay="${esc(p.id)}">+ đợt</button>`;
        return `<button type="button" class="tk-pay${due.length ? ' is-due' : ''}" data-pay="${esc(p.id)}" title="${esc(list.map(x => x.label + ': ' + fmtMoney(x.amount) + (x.paidAt ? ' ✓ ' + fmtDate(x.paidAt) : '')).join('\n'))}">${paid}/${list.length} đợt${due.length ? ' · chờ thu ' + fmtMoney(due.reduce((s, x) => s + num(x.amount), 0)) : ''}</button>`;
      }
      default: return `<input ${f} value="${esc(v)}" placeholder="${esc(auto)}">`;
    }
  }
  function rowClass(p) {
    const left = daysLeft(p), stage = val(p, 'stage');
    if (stage === 'Hoàn thành' || stage === 'Tạm dừng') return 'is-done';
    if (p.auto?.overdue?.length) return 'is-late';
    if (left !== null && left <= 2) return 'is-soon';
    return '';
  }
  const cols = () => ALL.filter(col => !col.hidden);
  const widthStyle = col => col.width ? ` style="width:${col.width}px;min-width:${col.width}px;max-width:${col.width}px"` : '';
  // Cột hiện trong 1 phần: phần đã chọn riêng thì theo phần đó, chưa chọn thì theo menu Cột chung
  const sectionCols = id => { const hidden = schema.sections?.[id]?.hidden; return hidden ? ALL.filter(col => col.key === 'project' || !hidden.includes(col.key)) : cols(); };
  function sumRow(list, label, shown) {
    return `<tr class="tk-sum"><th>${esc(label)} <small>${list.length} dự án</small></th>` +
      shown.slice(1).map(col => { if (!col.sum) return '<td></td>'; const s = list.reduce((t, p) => t + num(val(p, col.key)), 0); return `<td>${col.type === 'money' ? fmtMoney(s) : s.toLocaleString('vi-VN')}</td>`; }).join('') + '</tr>';
  }
  function renderTable(list) {
    byId('tk-wrap').className = 'tk-wrap';
    byId('tk-wrap').innerHTML = tableHtml(list, cols()) + (list.length ? '' : '<p class="tk-empty">Không có dự án nào trong chế độ xem này.</p>');
  }
  // Theo phần: mỗi phần 1 bảng, thẻ màu tên phần xoay dọc bên trái; bấm thẻ để thu gọn, ⚙ chọn cột hiện của phần
  function renderSections(list) {
    const wrap = byId('tk-wrap');
    wrap.className = 'tk-wrap is-sections';
    wrap.innerHTML = SECTIONS.map(sec => {
      const known = SECTIONS.flatMap(s => s.stages || []);
      const items = list.filter(p => sec.stages ? sec.stages.includes(val(p, 'stage')) : !known.includes(val(p, 'stage'))), closed = prefs.collapsed.includes(sec.id);
      return `<section class="tk-sec${closed || !items.length ? ' is-collapsed' : ''}${!closed && !items.length ? ' is-empty' : ''}" data-sec="${sec.id}" style="--sec:${sec.color}">
        <div class="tk-sec-side"><button type="button" class="tk-sec-tag" data-sec-toggle="${sec.id}" title="${closed ? 'Mở' : 'Thu gọn'} phần ${esc(sec.label)}">${esc(sec.label)} <small>${items.length}</small></button>
        <button type="button" class="tk-sec-cfg" data-sec-cols="${sec.id}" title="Chọn cột hiện trong phần ${esc(sec.label)}" aria-label="Chọn cột hiện">⚙</button></div>
        <div class="tk-sec-body">${closed ? '' : items.length ? tableHtml(items, sectionCols(sec.id)) : '<p class="tk-empty">Chưa có dự án ở giai đoạn này.</p>'}</div></section>`;
    }).join('');
  }
  // Chọn thuộc tính hiện cho 1 phần (như Property visibility của Notion)
  function openSectionCols(id) {
    const sec = SECTIONS.find(s => s.id === id), shown = new Set(sectionCols(id).map(col => col.key));
    const dialog = openDialog('Cột hiện · ' + sec.label, `<p class="tk-muted">Chỉ áp dụng cho phần ${esc(sec.label)}. Tên, thứ tự, độ rộng cột dùng chung mọi phần.</p>
      <p><button type="button" class="btn btn-outline btn-sm" data-all="1">Hiện hết</button> <button type="button" class="btn btn-outline btn-sm" data-all="0">Ẩn hết</button>
      <button type="button" class="btn btn-outline btn-sm" data-shared>Theo menu Cột chung</button></p>
      <div class="tk-sec-list">${ALL.slice(1).map(col => `<label><input type="checkbox" value="${col.key}" ${shown.has(col.key) ? 'checked' : ''}> ${esc(col.label)}</label>`).join('')}</div>`, false);
    const save = () => {
      schema.sections = {...schema.sections, [id]: {hidden: [...dialog.querySelectorAll('.tk-sec-list input:not(:checked)')].map(c => c.value)}};
      saveSchema();
    };
    dialog.addEventListener('change', save);
    dialog.addEventListener('click', e => {
      if (e.target.dataset.all) { dialog.querySelectorAll('.tk-sec-list input').forEach(c => { c.checked = e.target.dataset.all === '1'; }); save(); }
      if (e.target.matches('[data-shared]')) { const {[id]: _, ...rest} = schema.sections; schema.sections = rest; saveSchema(); dialog.close(); }
    });
  }
  function tableHtml(list, shown) {
    const sort = prefs.sort || {key: 'deadline', dir: 1};
    const head = '<thead><tr>' + shown.map((col, i) => `<th data-sort="${col.key}" class="tk-col-${col.type}"${i ? ' draggable="true" title="Bấm để sắp xếp · kéo để đổi chỗ · kéo mép phải để chỉnh độ rộng"' : ''}${widthStyle(col)}>${esc(col.label)}${sort.key === col.key ? (sort.dir > 0 ? ' ▲' : ' ▼') : ''}<span class="tk-resize" data-resize="${col.key}" title="Kéo để chỉnh độ rộng · bấm đúp để về tự động"></span></th>`).join('') + '</tr></thead>';
    const row = p => `<tr class="${rowClass(p)}" data-row="${esc(p.id)}">` + shown.map((col, i) => i ? `<td class="tk-col-${col.type}" data-c="${col.key}"${widthStyle(col)}>${cell(p, col)}</td>` : `<th scope="row" class="tk-col-name" data-c="${col.key}"${widthStyle(col)}>${cell(p, col)}</th>`).join('') + '</tr>';
    let body;
    if (prefs.group) {
      const groups = new Map();
      for (const p of list) for (const k of groupKeys(p)) (groups.get(k) || groups.set(k, []).get(k)).push(p);
      const order = colOf(prefs.group)?.options || [];
      const keys = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99) || a.localeCompare(b, 'vi'));
      body = keys.map(k => `<tbody><tr class="tk-group"><th colspan="${shown.length}">${esc(k)} <small>${groups.get(k).length}</small></th></tr>${groups.get(k).map(row).join('')}</tbody>`).join('');
    } else body = '<tbody>' + list.map(row).join('') + '</tbody>';
    return `<table class="tk-table">${head}${body}<tfoot>${sumRow(list, 'Tổng', shown)}</tfoot></table>`;
  }
  function renderBoard(list) {
    const field = ['stage', 'status3d', 'statusHskt'].includes(prefs.group) ? prefs.group : 'stage';
    const col = colOf(field);
    const lanes = [...new Set([...col.options, ...list.map(p => val(p, field)).filter(Boolean)])];
    const card = p => `<article class="tk-card ${rowClass(p)}" draggable="true" data-row="${esc(p.id)}">
      <a href="/du-an?project=${encodeURIComponent(p.id)}"><strong>${esc(p.name)}</strong></a>
      <small>${esc(p.profile.address || '')}</small>
      <div>${cell(p, colOf('deadline'))} ${cell(p, colOf('deadlineLabel'))}</div>
      <small>${esc([val(p, 'designer3d'), val(p, 'designerHskt')].filter(Boolean).join(' · '))}</small></article>`;
    byId('tk-wrap').className = 'tk-wrap';
    byId('tk-wrap').innerHTML = `<div class="tk-board" data-field="${field}">` + ['', ...lanes].map(lane => {
      const items = list.filter(p => (val(p, field) || '') === lane);
      if (!lane && !items.length) return '';
      return `<section class="tk-lane" data-lane="${esc(lane)}"><h3>${esc(lane || '(trống)')} <small>${items.length}</small></h3>${items.map(card).join('')}</section>`;
    }).join('') + '</div>';
  }
  // Menu Cột: bật/tắt, đổi tên, xoá cột riêng, thêm thuộc tính mới
  function renderColsMenu() {
    const typeName = type => CUSTOM_TYPES.find(t => t[0] === type)?.[1] || '';
    byId('tk-cols').innerHTML = '<p class="tk-muted">Tick để hiện · sửa tên trực tiếp · kéo tiêu đề cột trên bảng để đổi chỗ</p>' +
      ALL.slice(1).map(col => `<div class="tk-col-row"><input type="checkbox" data-show="${col.key}" ${col.hidden ? '' : 'checked'} aria-label="Hiện cột ${esc(col.label)}">` +
        `<input class="tk-col-label" data-rename="${col.key}" value="${esc(col.label)}" placeholder="${esc(col.baseLabel)}" aria-label="Tên cột">` +
        (col.custom ? `<small class="tk-muted">${typeName(col.type)}</small><button type="button" class="tk-x" data-del-col="${col.key}" aria-label="Xoá cột ${esc(col.label)}">×</button>` : '') + '</div>').join('') +
      `<form class="tk-col-add"><b>+ Thêm thuộc tính</b><input name="label" placeholder="Tên cột, vd: Hướng nhà" required>
        <select name="type">${CUSTOM_TYPES.map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select>
        <input name="options" placeholder="Các lựa chọn, cách nhau bằng dấu phẩy" hidden><button class="btn btn-primary btn-sm">Thêm cột</button></form>` +
      '<button type="button" class="btn btn-outline btn-sm" data-reset-cols>↺ Thứ tự, độ rộng, tên về mặc định</button>';
  }
  const newColId = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function addCustom(label, type, options = []) {
    const id = newColId();
    schema.custom.push({id, label, type, options});
    refreshCols();
    return id;
  }

  function render() {
    byId('tk-views').innerHTML = VIEWS.map(([id, label]) => {
      const count = id === 'late' ? projects.filter(p => p.auto?.overdue?.length).length : id === 'pay' ? projects.filter(p => duePayments(p).length).length : 0;
      return `<button type="button" role="tab" aria-selected="${prefs.view === id}" data-view="${id}">${label}${count ? ` <b>${count}</b>` : ''}</button>`;
    }).join('');
    byId('tk-group').innerHTML = '<option value="">Không nhóm</option>' + ALL.filter(col => ['select', 'people'].includes(col.type)).map(col => `<option value="${col.key}">${esc(col.label)}</option>`).join('');
    if (!colOf(prefs.group)) prefs.group = '';
    byId('tk-group').value = prefs.group;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('is-on', b.dataset.mode === prefs.mode));
    if (!byId('tk-cols').contains(document.activeElement)) renderColsMenu();
    const people = [...new Set(projects.flatMap(p => ALL.filter(col => col.type === 'people').map(col => col.key).flatMap(k => String(val(p, k)).split(',').map(s => s.trim()))).filter(Boolean))].sort();
    (byId('tk-people') || document.body.appendChild(Object.assign(document.createElement('datalist'), {id: 'tk-people'}))).innerHTML = people.map(n => `<option value="${esc(n)}">`).join('');
    const list = visible();
    if (prefs.mode === 'board') renderBoard(list); else if (prefs.mode === 'sections') renderSections(list); else renderTable(list);
  }

  // ------------------------------------------------------------ lưu
  async function saveProfile(id, patch, {create = false} = {}) {
    const status = byId('save-status');
    GDHomeShell.saveStatus(status, 'saving');
    try {
      const result = await api('/api/projects', create ? {create: true, profile: patch} : {projectId: id, profile: patch});
      GDHomeShell.saveStatus(status, 'saved');
      return result.project;
    } catch (error) {
      GDHomeShell.saveStatus(status, 'error', error.message);
      toast('Không lưu được: ' + error.message);
      throw error;
    }
  }
  async function saveField(id, field, value) {
    const p = projects.find(x => x.id === id);
    if (!p) return;
    const project = await saveProfile(id, colOf(field)?.custom ? {custom: {...p.profile.custom, [field]: value}} : {[field]: value});
    p.profile = project.profile;
    p.name = project.name;
    render();
  }
  function readInput(input) {
    const col = colOf(input.dataset.f);
    if (col.type === 'check') return input.checked ? '1' : '';
    if (col.type === 'money') return input.value.replace(/[^\d]/g, '');
    if (col.type === 'number') { const n = parseFloat(input.value.replace(/\./g, '').replace(',', '.')); return Number.isFinite(n) ? String(n) : ''; }
    if (col.type === 'people') return input.value.split(',').map(s => s.trim()).filter(Boolean).join(', ');
    return input.value.trim();
  }

  // ------------------------------------------------------------ hộp thoại dùng chung
  function openDialog(title, body, wide = true) {
    const dialog = document.createElement('dialog');
    dialog.className = 'tk-dialog' + (wide ? ' is-wide' : '');
    document.body.append(dialog);
    GDHomeShell.dialog(dialog, `<h2>${esc(title)}</h2>${body}`);
    dialog.addEventListener('close', () => dialog.remove(), {once: true});
    dialog.showModal();
    return dialog;
  }

  // Thanh toán theo đợt
  function openPayments(id) {
    const p = projects.find(x => x.id === id);
    const list = (p.profile.payments || []).map(x => ({...x}));
    const dialog = openDialog('Thanh toán · ' + p.name, '<form class="tk-pay-form"><table class="tk-mini"><thead><tr><th>Đợt</th><th>Mốc</th><th>Số tiền</th><th>Ngày thu</th><th></th></tr></thead><tbody></tbody></table>' +
      '<p><button type="button" class="btn btn-outline btn-sm" data-add>+ Thêm đợt</button></p><div class="tk-actions"><button class="btn btn-primary">Lưu</button></div></form>', false);
    const tbody = dialog.querySelector('tbody'), form = dialog.querySelector('form');
    const paint = () => { tbody.innerHTML = list.map((x, i) => `<tr data-i="${i}"><td><input name="label" value="${esc(x.label)}"></td><td><select name="milestone">${['Ký hợp đồng', 'Chốt 3D', 'Giao HSKT', 'Khác'].map(m => `<option${m === x.milestone ? ' selected' : ''}>${m}</option>`).join('')}</select></td>` +
      `<td><input name="amount" class="tk-num" value="${esc(fmtMoney(x.amount))}"></td><td><input type="date" name="paidAt" value="${esc(x.paidAt)}"></td><td><button type="button" class="tk-x" data-del="${i}" aria-label="Xoá đợt">×</button></td></tr>`).join(''); };
    paint();
    form.oninput = e => { const tr = e.target.closest('tr[data-i]'); if (tr) list[tr.dataset.i][e.target.name] = e.target.name === 'amount' ? e.target.value.replace(/[^\d]/g, '') : e.target.value; };
    form.onclick = e => {
      if (e.target.matches('[data-add]')) { list.push({label: 'Đợt ' + (list.length + 1), milestone: 'Khác', amount: '', paidAt: ''}); paint(); }
      if (e.target.dataset.del) { list.splice(Number(e.target.dataset.del), 1); paint(); }
    };
    form.onsubmit = async e => {
      e.preventDefault();
      await saveField(id, 'payments', list);
      dialog.close();
    };
  }

  // ------------------------------------------------------------ nhập HĐTK
  const norm = s => String(s || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase().replace(/[^a-z0-9]/g, '');
  function matchProject(profile) {
    const phone = norm(profile.phone), name = norm(String(profile.customer || '').replace(/^(anh|chị|ông|bà)\s+/i, ''));
    return projects.find(p => phone && norm(p.profile.phone) === phone)
      || projects.find(p => name.length > 4 && (norm(p.name).includes(name) || norm(p.profile.customer).includes(name)));
  }
  function milestoneDates(milestones, start, name) {
    let from = start, out = [];
    for (const m of milestones) {
      const s = out.length ? getNextWorkingDateStr(out[out.length - 1].endDate, true) : from;
      out.push({kind: m.kind, days: m.days, title: m.prefix + ' - ' + name.toUpperCase(), startDate: s, endDate: computeEndDateByWorkingDays(s, m.days, true)});
    }
    return out;
  }
  const CONTRACT_FIELDS = [['customer', 'Khách / Bên A'], ['representative', 'Người đại diện'], ['phone', 'SĐT'], ['email', 'Email'], ['taxCode', 'Mã số thuế'],
    ['contractNo', 'Số HĐ'], ['signedAt', 'Ngày ký', 'date'], ['address', 'Vị trí công trình'], ['customerAddress', 'Địa chỉ Bên A'], ['area', 'Diện tích m²'],
    ['designPrice', 'Đơn giá TK'], ['vat', 'VAT %'], ['designValue', 'Giá trị HĐTK'], ['note', 'Ghi chú']];
  function openContract() {
    const dialog = openDialog('Nhập hợp đồng thiết kế', `<div class="tk-contract-src">
      <button type="button" class="btn btn-outline" data-pick>📄 Chọn file Word (.docx)</button>
      <span class="tk-muted">hoặc dán đoạn chữ hợp đồng (Ctrl+V) rồi bấm Đọc</span>
      <textarea rows="5" placeholder="Dán nội dung hợp đồng vào đây…"></textarea>
      <button type="button" class="btn btn-primary btn-sm" data-read>Đọc hợp đồng</button></div><div class="tk-contract-out"></div>`);
    const out = dialog.querySelector('.tk-contract-out'), area = dialog.querySelector('textarea');
    const show = text => {
      const parsed = GDHomeContract.parseContract(text);
      if (!parsed.profile.customer && !parsed.profile.contractNo) { out.innerHTML = '<p class="tk-muted">Không nhận ra hợp đồng theo mẫu GD HOME. Kiểm tra lại đoạn chữ.</p>'; return; }
      renderContractForm(out, parsed, dialog);
    };
    const input = byId('tk-file-docx');
    dialog.querySelector('[data-pick]').onclick = () => { input.value = ''; input.click(); };
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      try { show(await GDHomeContract.docxText(await file.arrayBuffer())); } catch (error) { out.innerHTML = `<p class="tk-muted">${esc(error.message)}</p>`; }
    };
    dialog.querySelector('[data-read]').onclick = () => show(area.value);
    area.addEventListener('paste', () => setTimeout(() => area.value.length > 200 && show(area.value)));
  }
  function renderContractForm(out, {profile, payments, milestones}, dialog) {
    const match = matchProject(profile);
    const name = match?.name || profile.customer || '';
    out.innerHTML = `<form class="tk-contract-form">
      <div class="tk-grid"><label>Dự án<select name="target"><option value="">+ Tạo dự án mới</option>${projects.map(p => `<option value="${esc(p.id)}"${p === match ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select></label>
      <label>Tên dự án<input name="project" value="${esc(name)}" required></label>
      ${CONTRACT_FIELDS.map(([k, label, type]) => `<label>${label}<input name="${k}" ${type === 'date' ? 'type="date"' : ''} value="${esc(['designPrice', 'designValue'].includes(k) ? fmtMoney(profile[k] || '') : profile[k] || '')}"></label>`).join('')}</div>
      <h3>Thanh toán</h3><table class="tk-mini"><tbody>${payments.map((x, i) => `<tr><td>${esc(x.label)}</td><td><input class="tk-num" data-pay="${i}" value="${esc(fmtMoney(x.amount))}"></td></tr>`).join('') || '<tr><td class="tk-muted">Không thấy các đợt thanh toán.</td></tr>'}</tbody></table>
      <h3><label><input type="checkbox" name="makeTasks" ${milestones.length && !(match?.auto?.taskCount) ? 'checked' : ''} ${milestones.length ? '' : 'disabled'}> Tạo mốc tiến độ trên Lịch (giai đoạn THIẾT KẾ)</label></h3>
      <div class="tk-grid"><label>Người làm 3D<input name="who3d" list="tk-people"></label><label>Người làm HSKT<input name="whoHskt" list="tk-people"></label></div>
      <table class="tk-mini tk-ms"><thead><tr><th>Việc</th><th>Ngày LV</th><th>Bắt đầu</th><th>Kết thúc</th></tr></thead><tbody></tbody></table>
      ${match?.auto?.taskCount ? '<p class="tk-muted">Dự án này đã có ' + match.auto.taskCount + ' việc trên Lịch – bỏ chọn nếu không muốn thêm mốc.</p>' : ''}
      <div class="tk-actions"><button class="btn btn-primary">Lưu vào dự án</button></div></form>`;
    const form = out.querySelector('form'), msBody = form.querySelector('.tk-ms tbody');
    let rows = [];
    const paintMs = () => {
      const start = form.elements.signedAt.value || new Date().toISOString().slice(0, 10);
      rows = milestoneDates(milestones, start, form.elements.project.value || 'DỰ ÁN');
      msBody.innerHTML = rows.map(r => `<tr><td>${esc(r.title)}</td><td>${r.days}</td><td>${fmtDate(r.startDate)}</td><td>${fmtDate(r.endDate)}</td></tr>`).join('');
    };
    paintMs();
    form.elements.signedAt.onchange = paintMs;
    form.elements.project.oninput = paintMs;
    form.elements.target.onchange = () => { const p = projects.find(x => x.id === form.elements.target.value); if (p) form.elements.project.value = p.name; paintMs(); };
    form.onsubmit = async e => {
      e.preventDefault();
      const f = form.elements, patch = {project: f.project.value.trim()};
      for (const [k] of CONTRACT_FIELDS) { const v = f[k].value.trim(); if (v) patch[k] = ['designPrice', 'designValue'].includes(k) ? v.replace(/[^\d]/g, '') : v; }
      const pays = payments.map((x, i) => ({...x, amount: form.querySelector(`[data-pay="${i}"]`).value.replace(/[^\d]/g, '')}));
      const tasks = f.makeTasks?.checked ? rows.map(r => ({...r, assignee: r.kind === 'hskt' ? f.whoHskt.value : f.who3d.value})) : [];
      const button = form.querySelector('.tk-actions button');
      button.disabled = true;
      try {
        const res = await api('/api/project-hub/contract/apply', {projectId: f.target.value || undefined, profile: patch, payments: pays, tasks});
        toast(`Đã lưu "${res.project.name}"` + (res.tasksAdded ? ` và tạo ${res.tasksAdded} mốc trên Lịch.` : '.'));
        dialog.close();
        await load();
      } catch (error) { toast(error.message); button.disabled = false; }
    };
  }

  // ------------------------------------------------------------ nhập CSV Notion
  function parseCsv(text) {
    const rows = [[]];
    let field = '', quoted = false;
    text = text.replace(/^﻿/, '');
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (c === '"' && text[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { rows[rows.length - 1].push(field); field = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; rows[rows.length - 1].push(field); field = ''; rows.push([]); }
      else field += c;
    }
    rows[rows.length - 1].push(field);
    return rows.filter(r => r.some(x => x.trim()));
  }
  const CSV_MAP = {duan: 'project', ten: 'project', name: 'project', vitri: 'address', diachi: 'address', phone: 'phone', sdt: 'phone', sodienthoai: 'phone',
    ngaykihdtk: 'signedAt', ngaykyhdtk: 'signedAt', ngayki: 'signedAt', ngayky: 'signedAt', trienkhai3d: 'designer3d', trangthai3d: 'status3d',
    trienkhaihskt: 'designerHskt', trangthaihskt: 'statusHskt', ngaykihdtc: 'constructionSignedAt', ngaykyhdtc: 'constructionSignedAt', ngaylendo: 'furnishAt',
    giamsat: 'supervisor', trangthai: 'stage', mavl: 'materialsStatus', thauthicong: 'contractor', checkdo: 'checkDo', dientich: 'area',
    giatrihd: 'constructionValue', giatrithicong: 'constructionValue', dongiatk: 'designPrice', dongia: 'designPrice', ghichu: 'note', khachhang: 'customer', email: 'email'};
  const MONTHS = {january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12};
  function csvDate(v) {
    const first = String(v).split('→')[0].trim();
    let m = first.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    m = first.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    m = first.match(/^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
    if (m && MONTHS[m[1].toLowerCase()]) return `${m[3]}-${String(MONTHS[m[1].toLowerCase()]).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
    return '';
  }
  const STAGE_ALIAS = {xongthietke: 'TK xong chưa QT', tkxong: 'TK xong chưa QT', xongthicong: 'TC xong chưa QT', tcxong: 'TC xong chưa QT', daquyettoan: 'Hoàn thành'};
  // Cột Notion tự tính (công thức / rollup): bảng này tự tính lại từ Lịch nên mặc định không tạo cột riêng
  const CSV_AUTO = new Set(['deadlinesaptoi', 'nddeadline', 'songayconlai', 'songayconl', 'gdhomeid', 'tiendo']);
  function csvValue(field, raw) {
    const v = String(raw || '').trim();
    if (!v) return '';
    const col = colOf(field);
    if (col?.type === 'date') return csvDate(v);
    if (field === 'checkDo') return /^(yes|true|1|x|có|✓)$/i.test(v) ? '1' : '';
    if (field === 'materialsStatus') return /done|xong/i.test(v) ? 'Xong' : /progress|đang/i.test(v) ? 'Đang làm' : /not|chưa/i.test(v) ? 'Chưa làm' : v;
    if (field === 'designPrice') return /k$/i.test(v) ? String(num(v) * 1000) : String(num(v));
    if (['constructionValue', 'area'].includes(field)) return String(num(v.replace(/,(?=\d{3}\b)/g, '')));
    if (field === 'stage' && STAGE_ALIAS[norm(v)]) return STAGE_ALIAS[norm(v)];
    if (col?.options) return col.options.find(o => norm(o) === norm(v)) || v.charAt(0) + v.slice(1).toLowerCase();
    return v;
  }
  function openCsv() {
    const input = byId('tk-file-csv');
    input.value = '';
    input.onchange = async () => {
      const file = input.files[0];
      if (!file) return;
      // Notion xuất ra file .zip: lấy file .csv bên trong
      const text = /\.zip$/i.test(file.name) ? await GDHomeContract.zipText(await file.arrayBuffer(), name => /\.csv$/i.test(name)) : await file.text();
      if (text == null) return GDHomeShell.alert('Trong file zip không có bảng .csv.');
      const rows = parseCsv(text);
      const raw = rows.shift();
      const head = raw.map(h => CSV_MAP[norm(h)] || ALL.find(col => col.custom && norm(col.label) === norm(h))?.key || '');
      // Cột Notion chưa có trong bảng: đề nghị tạo cột riêng, đoán kiểu ngày / số theo dữ liệu
      const unknown = raw.map((h, i) => ({i, label: h.trim(), auto: CSV_AUTO.has(norm(h)), values: rows.map(r => String(r[i] || '').trim()).filter(Boolean)})).filter(x => !head[x.i] && x.label && x.values.length);
      if (!head.includes('project')) return GDHomeShell.alert('Không thấy cột "Dự án" trong file CSV. Xuất bảng Notion bằng Export → Markdown & CSV.');
      const seen = new Map(), used = new Set();
      const items = rows.map(r => {
        const profile = {};
        head.forEach((f, i) => { const v = f && csvValue(f, r[i]); if (v && !profile[f]) { if (/^c_/.test(f)) (profile.custom ||= {})[f] = v; else profile[f] = v; } });
        if (!profile.project) return null;
        const n = (seen.get(norm(profile.project)) || 0) + 1;   // 2 dòng trùng tên trong Notion: giữ cả hai, thêm (2)
        seen.set(norm(profile.project), n);
        if (n > 1) profile.project += ` (${n})`;
        // Ghép với dự án đã có: trùng tên, trùng SĐT, hoặc tên khách nằm trong tên dự án; mỗi dự án chỉ ghép 1 dòng
        let match = projects.find(p => norm(p.name) === norm(profile.project)) || matchProject({phone: profile.phone, customer: profile.project});
        if (match && used.has(match.id)) match = null;
        if (match) used.add(match.id);
        return {profile, match, row: r};
      }).filter(Boolean);
      const options = projects.map(p => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
      const dialog = openDialog('Nhập bảng Notion (CSV)', `<p>${items.length} dự án · ${items.filter(x => x.match).length} ghép vào dự án đã có (cập nhật), ${items.filter(x => !x.match).length} tạo mới. Kiểm tra cột "Vào dự án" trước khi nhập.
        Cột nhận ra: ${[...new Set(head.filter(Boolean))].map(f => colOf(f)?.label || f).join(', ')}.</p>
        ${unknown.length ? `<p><b>Cột chưa có trong bảng</b> – tick để tạo cột riêng:</p><p class="tk-csv-new">${unknown.map((x, n) => `<label${x.auto ? ' title="Notion tự tính; bảng này tự tính lại từ Lịch"' : ''}><input type="checkbox" data-new="${n}" ${x.auto ? '' : 'checked'}> ${esc(x.label)}${x.auto ? ' <small class="tk-muted">(tự tính)</small>' : ''}</label>`).join(' ')}</p>` : ''}
        <label><input type="checkbox" name="overwrite"> Ghi đè ô đã có dữ liệu (mặc định chỉ điền ô trống)</label>
        <div class="tk-csv-list"><table class="tk-mini"><tbody>${items.map((x, i) => `<tr><td><input type="checkbox" data-i="${i}" checked></td><td>${esc(x.profile.project)}</td><td><select data-t="${i}" aria-label="Vào dự án"><option value="">+ Tạo mới</option>${options.replace(`value="${esc(x.match?.id)}"`, `value="${esc(x.match?.id)}" selected`)}</select></td><td class="tk-muted">${Object.keys(x.profile).length - 1} ô</td></tr>`).join('')}</tbody></table></div>
        <div class="tk-actions"><span class="tk-muted" role="status"></span><button type="button" class="btn btn-primary" data-go>Nhập</button></div>`);
      dialog.querySelector('[data-go]').onclick = async e => {
        e.target.disabled = true;
        const overwrite = dialog.querySelector('[name=overwrite]').checked, status = dialog.querySelector('[role=status]');
        const chosen = [...dialog.querySelectorAll('[data-i]:checked')].map(c => ({...items[c.dataset.i], match: projects.find(p => p.id === dialog.querySelector(`[data-t="${c.dataset.i}"]`).value)}));
        const created = [...dialog.querySelectorAll('[data-new]:checked')].map(c => unknown[c.dataset.new]);
        for (const x of created) {
          const type = x.values.every(v => csvDate(v)) ? 'date' : x.values.every(v => /^-?[\d.,]+$/.test(v)) ? 'number' : 'text';
          const id = addCustom(x.label.slice(0, 60), type);
          for (const item of items) { const v = type === 'date' ? csvDate(item.row[x.i] || '') : type === 'number' ? String(num(String(item.row[x.i] || '').replace(/,(?=\d{3}\b)/g, ''))) : String(item.row[x.i] || '').trim(); if (v && v !== '0') (item.profile.custom ||= {})[id] = v; }
        }
        if (created.length) await saveSchema(true);
        let done = 0;
        for (const {profile, match} of chosen) {
          try {
            if (match) {
              const patch = Object.fromEntries(Object.entries(profile).filter(([k]) => k !== 'project' && k !== 'custom' && (overwrite || !match.profile[k])));
              const custom = Object.fromEntries(Object.entries(profile.custom || {}).filter(([k]) => overwrite || !match.profile.custom?.[k]));
              if (Object.keys(custom).length) patch.custom = {...match.profile.custom, ...custom};
              if (Object.keys(patch).length) await saveProfile(match.id, patch);
            } else await saveProfile(null, profile, {create: true});
          } catch { /* đã báo lỗi; nhập tiếp dòng sau */ }
          status.textContent = `Đã nhập ${++done}/${chosen.length}…`;
        }
        dialog.close();
        toast(`Đã nhập ${done} dự án từ Notion.`);
        await load();
      };
    };
    input.click();
  }

  // ------------------------------------------------------------ sự kiện
  function wire() {
    byId('tk-search').oninput = () => render();
    byId('tk-group').onchange = e => { prefs.group = e.target.value; remember(); render(); };
    byId('tk-views').onclick = e => { const b = e.target.closest('[data-view]'); if (b) { prefs.view = b.dataset.view; remember(); render(); } };
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { prefs.mode = b.dataset.mode; remember(); render(); });
    const menu = byId('tk-cols');
    menu.onchange = e => {
      const t = e.target;
      if (t.dataset.show) { colOf(t.dataset.show).hidden = !t.checked; saveSchema(); }
      if (t.dataset.rename) { const col = colOf(t.dataset.rename); col.label = t.value.trim().slice(0, 60) || col.baseLabel; t.blur(); saveSchema(); }
      if (t.name === 'type') t.form.elements.options.hidden = t.value !== 'select';
    };
    menu.onkeydown = e => { if (e.key === 'Enter' && e.target.dataset.rename) e.target.blur(); };
    menu.onsubmit = e => {
      e.preventDefault();
      const f = e.target.elements, label = f.label.value.trim().slice(0, 60);
      if (!label) return;
      addCustom(label, f.type.value, f.type.value === 'select' ? f.options.value.split(',').map(s => s.trim()).filter(Boolean) : []);
      saveSchema();
      renderColsMenu();
      toast(`Đã thêm cột "${label}".`);
    };
    menu.onclick = async e => {
      const del = e.target.closest('[data-del-col]')?.dataset.delCol;
      if (del && await GDHomeShell.confirm({title: 'Xoá cột', message: `Xoá cột "${colOf(del).label}"? Dữ liệu đã nhập trong cột này sẽ không hiện nữa.`, okText: 'Xoá cột', danger: true})) {
        schema.custom = schema.custom.filter(c => c.id !== del);
        ALL = ALL.filter(c => c.key !== del);
        saveSchema(); renderColsMenu();
      }
      if (e.target.closest('[data-reset-cols]')) {
        schema.columns = [];
        prefs.hidden = null; remember();
        refreshCols(); saveSchema(); renderColsMenu();
      }
    };
    document.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'contract') openContract();
      if (act === 'csv') openCsv();
      if (act === 'new') GDHomeShell.prompt?.('Tên dự án mới', '').then(async name => {
        if (!name?.trim()) return;
        await saveProfile(null, {project: name.trim()}, {create: true});
        await load();
      });
    });
    const wrap = byId('tk-wrap');
    // Kéo mép phải tiêu đề = chỉnh độ rộng; bấm đúp = về tự động
    let resizing = false, resizedAt = 0, dragCol = null;
    wrap.addEventListener('pointerdown', e => {
      const handle = e.target.closest('.tk-resize');
      if (!handle) return;
      e.preventDefault();
      resizing = true;
      const key = handle.dataset.resize, th = handle.parentElement, x0 = e.clientX, w0 = Math.round(th.getBoundingClientRect().width);
      const cells = [th, ...wrap.querySelectorAll(`[data-c="${key}"]`)], draggable = th.draggable;
      th.draggable = false;   // không để trình duyệt bắt đầu kéo cột khi đang chỉnh độ rộng
      handle.setPointerCapture?.(e.pointerId);
      let width = w0;
      const move = ev => { width = Math.max(60, Math.round(w0 + ev.clientX - x0)); for (const c of cells) Object.assign(c.style, {width: width + 'px', minWidth: width + 'px', maxWidth: width + 'px'}); };
      const up = () => {
        document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
        th.draggable = draggable; resizing = false; resizedAt = Date.now();
        if (width !== w0) { colOf(key).width = width; saveSchema(); }
      };
      document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    });
    wrap.addEventListener('dblclick', e => {
      const handle = e.target.closest('.tk-resize');
      if (handle) { colOf(handle.dataset.resize).width = 0; saveSchema(); return; }
      // Bấm đúp tiêu đề cột = đổi tên cột
      const th = e.target.closest('thead th[data-sort]');
      if (th) GDHomeShell.prompt('Tên cột', colOf(th.dataset.sort).label).then(name => {
        if (name == null) return;
        const col = colOf(th.dataset.sort);
        col.label = name.trim().slice(0, 60) || col.baseLabel;
        saveSchema();
      });
    });
    wrap.addEventListener('click', e => {
      const th = e.target.closest('thead th[data-sort]');
      if (th && (e.target.closest('.tk-resize') || Date.now() - resizedAt < 300)) return;
      if (th) {
        const key = th.dataset.sort, cur = prefs.sort || {key: 'deadline', dir: 1};
        prefs.sort = {key, dir: cur.key === key ? -cur.dir : 1};
        remember(); render();
      }
      const toggle = e.target.closest('[data-sec-toggle]')?.dataset.secToggle;
      if (toggle) { prefs.collapsed = prefs.collapsed.includes(toggle) ? prefs.collapsed.filter(x => x !== toggle) : [...prefs.collapsed, toggle]; remember(); render(); }
      const secCols = e.target.closest('[data-sec-cols]')?.dataset.secCols;
      if (secCols) openSectionCols(secCols);
      const pay = e.target.closest('[data-pay]');
      if (pay && pay.tagName === 'BUTTON') openPayments(pay.dataset.pay);
    });
    wrap.addEventListener('change', e => {
      const input = e.target.closest('[data-f]');
      if (!input) return;
      const value = input.dataset.f === 'project' ? input.value.trim() : readInput(input);
      if (input.dataset.f === 'project' && !value) return render();
      saveField(input.dataset.id, input.dataset.f, value).catch(() => render());
    });
    wrap.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.matches('input[data-f]')) e.target.blur();
    });
    // Kanban: kéo thẻ sang cột khác = đổi trạng thái
    // Bảng: kéo tiêu đề cột sang chỗ khác = đổi thứ tự
    const dropSide = (e, th) => { const r = th.getBoundingClientRect(); return th.cellIndex === 0 || e.clientX > r.left + r.width / 2 ? 'after' : 'before'; };
    const clearDrop = () => wrap.querySelectorAll('.tk-drop-before, .tk-drop-after').forEach(th => th.classList.remove('tk-drop-before', 'tk-drop-after'));
    wrap.addEventListener('dragstart', e => {
      if (resizing) return e.preventDefault();
      const th = e.target.closest?.('thead th[data-sort]');
      if (th) { dragCol = th.dataset.sort; e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-col', dragCol); return; }
      const card = e.target.closest('.tk-card'); if (card) e.dataTransfer.setData('text/plain', card.dataset.row);
    });
    wrap.addEventListener('dragend', () => { dragCol = null; clearDrop(); });
    wrap.addEventListener('dragover', e => {
      const th = dragCol && e.target.closest('thead th[data-sort]');
      if (th) { e.preventDefault(); clearDrop(); if (th.dataset.sort !== dragCol) th.classList.add('tk-drop-' + dropSide(e, th)); return; }
      if (!dragCol && e.target.closest('.tk-lane')) e.preventDefault();
    });
    wrap.addEventListener('drop', e => {
      const th = dragCol && e.target.closest('thead th[data-sort]');
      if (th) {
        e.preventDefault();
        const from = dragCol, side = dropSide(e, th);
        dragCol = null; clearDrop();
        if (th.dataset.sort === from) return;
        const moved = ALL.find(c => c.key === from), rest = ALL.filter(c => c.key !== from);
        rest.splice(rest.findIndex(c => c.key === th.dataset.sort) + (side === 'after' ? 1 : 0), 0, moved);
        ALL = rest;
        return saveSchema();
      }
      const lane = e.target.closest('.tk-lane'), id = e.dataTransfer.getData('text/plain');
      if (!lane || !id) return;
      e.preventDefault();
      saveField(id, wrap.querySelector('.tk-board').dataset.field, lane.dataset.lane);
    });
  }

  async function load() {
    try {
      const res = await api('/api/project-hub/overview');
      projects = res.projects || [];
      // đang chờ lưu cấu hình cột thì giữ bản trên máy
      if (res.tableSchema && !schemaDirty) { schema = {columns: res.tableSchema.columns || [], custom: res.tableSchema.custom || [], sections: res.tableSchema.sections || {}}; refreshCols(); }
      render();
    } catch (error) {
      byId('tk-wrap').innerHTML = `<p class="tk-empty">${error.status === 401 ? 'Cần đăng nhập. Mở <a href="/tools">Trang chủ công cụ</a> để đăng nhập Gmail rồi quay lại.' : esc(error.message)}</p>`;
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    GDHomeShell.layout?.();
    wire();
    load();
    window.addEventListener('focus', () => { if (!document.querySelector('.tk-dialog[open]') && !document.activeElement?.matches('[data-f]')) load(); });
  });
  window.GDHomeThongKe = {parseCsv, csvValue, csvDate};
})();
