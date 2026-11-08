let sheet, before = [], after = [], saveTimer, saving = false, dirty = false, conflict = false;
let density = 'vua';
const fields = ['brand','code','finish','color','size','supplier','price'];
const labels = { brand:'Hãng', code:'Mã', finish:'Chất liệu / Quy cách', color:'Màu', size:'Kích thước', supplier:'NCC', price:'Giá', room:'Vị trí', unit:'Đơn vị' };
const statusLabels = { draft:'Chưa chọn', sent:'Đã gửi khách', chosen:'Khách đã chốt', changed:'Đổi mã' };
const uid = () => crypto.randomUUID();
const newRow = (name = '') => ({ id: uid(), name, room:'', qty:'', unit:'', supplier:'', note:'', render:[], options:[{images:[]},{images:[]},{images:[]}], decision:'draft', ordered:false, chosen:null });
const newGroup = (name, names = []) => ({ id:uid(), name, due:'', rows:names.map(newRow) });
const makeTemplate = () => materialTemplate.map(([name,...names]) => newGroup(name,names));
const box = () => byId('materials');
const input = (key, value, placeholder = '') => '<input data-field="' + key + '" value="' + html(value) + '" placeholder="' + html(placeholder) + '" aria-label="' + html(placeholder || labels[key] || key) + '">';
const option = (value, label, selected) => '<option value="' + html(value) + '"' + (value === selected ? ' selected' : '') + '>' + html(label) + '</option>';
const assetCache = new Map();

function post(url, body) { return request(url, { method:'POST', body:JSON.stringify(body) }); }
function say(message) { byId('notice').textContent = message; }

function showImages(root = box()) {
  root.querySelectorAll('img[data-asset]').forEach(async img => {
    try {
      const name = img.dataset.asset;
      if (!assetCache.has(name)) assetCache.set(name, fetch('/api/materials/assets/' + name, { headers:authHeaders() }).then(res => {
        if (!res.ok) throw new Error('Không mở được ảnh');
        return res.blob();
      }).then(URL.createObjectURL).catch(error => { assetCache.delete(name); throw error; }));
      img.src = await assetCache.get(name);
    } catch { img.alt = 'Ảnh chưa tải được'; }
  });
}

function authHeaders() {
  return config.authMode === 'google' ? { Authorization:'Bearer ' + session().token } :
    config.authMode === 'password' ? { 'x-app-key':localStorage.getItem(passwordKey) || '' } : {};
}

function images(list, large = false) {
  return (list || []).map(image => {
    const name = typeof image === 'string' ? image : (large ? image.full : image.thumb);
    return /^[a-f0-9]{64}\.webp$/.test(name) ? '<img data-asset="' + name + '" alt="Ảnh vật liệu">' : '';
  }).join('');
}

function renderMaterialApp(selectedProject) {
  if (sheet) return renderEditor();
  byId('material-header-actions').replaceChildren();
  const query = new URLSearchParams(location.search);
  const requested = selectedProject || byId('project-filter')?.value || query.get('project');
  const projectId = materials.projects.some(p => p.id === requested) ? requested : materials.projects[0]?.id;
  box().innerHTML = '<div class="panel"><label>Dự án <select id="project-filter">' + materials.projects.map(p => option(p.id,p.name,projectId)).join('') +
    '</select></label> <button class="primary" data-action="new">Tạo từ mẫu</button> <button data-action="copy">Sao chép bảng</button> <span id="import-action"></span> <button data-action="notion">Lấy từ Notion</button> <span id="ai-actions"></span></div>' +
    materials.sheets.filter(s => s.projectId === projectId || !materials.projects.some(p => p.id === s.projectId)).map(s => '<article><button data-action="open" data-id="' + html(s.id) + '">' + html(s.title) + '</button> · ' + counts(s) + '</article>').join('') +
    (!materials.projects.length ? '<p>Tạo và lưu dự án trong Tiến độ trước.</p>' : '');
  box().insertAdjacentHTML('beforeend','<dialog id="material-dialog"></dialog>');
  byId('project-filter').onchange = event => renderMaterialApp(event.target.value);
  if (typeof installImport === 'function') installImport();
  installMaterialsAi();
}

function counts(current) {
  const rows = current.groups.flatMap(g => g.rows);
  return 'Đã chốt ' + rows.filter(r => r.chosen !== null && r.chosen !== undefined && r.decision !== 'changed').length + '/' + rows.length;
}

function labeledInput(key, value, label) {
  return '<label><span>' + label + '</span>' + input(key,value,label) + '</label>';
}

const materialColumns = [
  ['select','Chọn dòng'],['name','Hạng mục'],['room','Vị trí'],['render','Phối cảnh 3D'],['spec','Chất liệu / Quy cách'],
  ['pa0','PA1'],['pa1','PA2'],['pa2','PA3'],['qty','KL'],['unit','Đơn vị'],
  ['supplier','NCC / Nhà thầu'],['note','Ghi chú'],['decision','Trạng thái'],['actions','Thao tác']
];
const optionalColumns = new Set(['render','spec','qty','unit','supplier','note','decision']);
const hiddenColumns = new Set();
const forcedPA = new Set();
const hiddenGroups = new Set();
const collapsed = new Set();
const sidebarOpen = new Map();
let sheetRoom = '', sheetStatus = '';
const rowState = row => row.ordered ? 'ordered' : row.decision;
const paHasData = pa => !!pa && (pa.images?.length || fields.some(key => pa[key]));
function rowPaCount(row) {
  return Math.max(1,row.paCount || 1,(row.chosen ?? -1)+1,row.options.findLastIndex(paHasData)+1);
}
function visibleColumns() {
  const count = Math.max(1,...sheet.groups.flatMap(g => g.rows.map(rowPaCount)));
  return materialColumns.filter(([key]) => !hiddenColumns.has(key) &&
    (!/^pa[12]$/.test(key) || forcedPA.has(key) || Number(key[2]) < count));
}
function sidebarSection(key,title,content) {
  return '<details class="sb-collapsible sidebar-section" data-sidebar="' + key + '"' + (sidebarOpen.get(key) !== false ? ' open' : '') +
    '><summary class="sb-head">' + title + '</summary><div class="material-sidebar-body">' + content + '</div></details>';
}
function projectSidebar() {
  const project = materials.projects.find(p => p.id === sheet.projectId);
  const meta = sheet.meta || {};
  return sidebarSection('project','📁 Dự án & khách hàng',
    '<label class="side-field">Dự án Tiến độ<select id="editor-project">' + option(sheet.projectId,project?.name || meta.project || 'Dự án đã lưu',sheet.projectId) +
    materials.projects.filter(p => p.id !== sheet.projectId).map(p => option(p.id,p.name,sheet.projectId)).join('') + '</select></label>' +
    '<label class="side-field">Bảng chốt mã<select id="editor-sheet">' +
    (!sheet.id ? '<option value="">Bảng mới</option>' : '') + materials.sheets.filter(s => s.projectId === sheet.projectId)
      .map(s => option(s.id,s.id === sheet.id ? sheet.title : s.title,sheet.id)).join('') + '</select></label>' +
    '<div class="material-meta-fields">' + labeledInput('title',sheet.title,'Tên bảng') +
    [['customer','Kính gửi'],['address','Địa chỉ'],['project','Tên dự án'],['phone','SĐT'],['email','Email'],['date','Ngày'],['number','Số'],['contract','Hợp đồng']]
      .map(([key,label]) => labeledInput(key,meta[key],label)).join('') + '</div><button data-action="notion">Lấy từ Notion</button>');
}
function catalogSidebar() {
  return sidebarSection('catalog','📋 Danh mục',
    '<ul class="material-catalog">' + sheet.groups.map(group => '<li data-catalog="' + html(group.id) + '" draggable="true">' +
      '<input type="checkbox" data-group-toggle="' + html(group.id) + '" aria-label="Hiện ' + html(group.name) + '"' +
      (hiddenGroups.has(group.id) ? '' : ' checked') + '><button data-action="jump-group" data-id="' + html(group.id) + '">' +
      html(group.name) + '</button><small>' + group.rows.filter(r => r.chosen != null && r.decision !== 'changed').length + '/' + group.rows.length +
      '</small><span title="Kéo để đổi thứ tự">⋮⋮</span></li>').join('') + '</ul><button data-action="add-group">＋ Thêm danh mục</button>');
}
function displaySidebar() {
  return sidebarSection('display','⚙ Hiển thị',
    '<div class="sb-row-label">Mật độ dòng</div><div class="sb-seg-btns material-density">' +
    Object.entries({gon:'Gọn',vua:'Vừa',lon:'Ảnh lớn'}).map(([key,label]) =>
      '<button data-action="density" data-id="' + key + '" aria-pressed="' + (key === density) + '">' + label + '</button>').join('') + '</div>' +

    '<label class="side-field">Phòng<select id="room-filter"><option value="">Tất cả</option>' +
      [...new Set(sheet.groups.flatMap(g => g.rows.map(r => r.room)).filter(Boolean))].map(r => option(r,r,sheetRoom)).join('') + '</select></label>' +
    '<label class="side-field">Trạng thái<select id="status-filter"><option value="">Tất cả</option>' +
      Object.entries({...statusLabels,ordered:'Đã đặt hàng'}).map(([key,label]) => option(key,label,sheetStatus)).join('') + '</select></label>' +
    '<div class="sb-chip-grid">' + materialColumns.filter(([key]) => optionalColumns.has(key) || /^pa[12]$/.test(key))
      .map(([key,label]) => '<label class="sb-chip" title="' + label + '"><input type="checkbox" data-column-toggle="' + key + '"' +
        ((optionalColumns.has(key) ? !hiddenColumns.has(key) : forcedPA.has(key)) ? ' checked' : '') + '> ' +
        (optionalColumns.has(key) ? label : 'Luôn hiện ' + label) + '</label>').join('') + '</div>');
}
function materialKpis() {
  const nearest = sheet.groups.map(g => deadlineFor(g).due).filter(Boolean).sort()[0];
  return [sheet.groups.length + ' nhóm',sheet.groups.reduce((n,g) => n+g.rows.length,0) + ' hạng mục',
    counts(sheet),nearest ? 'Hạn gần nhất ' + nearest : 'Chưa có hạn'].map(value => '<span>' + html(value) + '</span>').join('');
}

const defaultColumnWidths = {select:36,room:112,render:110,spec:152,pa0:118,pa1:118,pa2:118,qty:68,unit:75,supplier:136,note:156,decision:130,actions:134};
const clampColumnWidth = width => Math.round(Math.min(720,Math.max(48,width)));

function columnWidth(key) {
  if (key === 'select') return defaultColumnWidths.select;
  const manual = materials.columnWidths?.[key];
  if (manual) return manual;
  if (key === 'name') {
    const context = document.createElement('canvas').getContext('2d');
    context.font = '13px system-ui';
    const longest = Math.max(0,...sheet.groups.flatMap(g => g.rows.map(row => context.measureText(row.name).width)));
    return Math.ceil(Math.min(460,Math.max(148,longest+24)));
  }
  if (density === 'lon' && (key === 'render' || /^pa[012]$/.test(key))) return 176;
  return defaultColumnWidths[key];
}

function installColumnResize(table) {
  const apply = (key,width) => {
    table.querySelector('col[data-column="' + key + '"]').style.width = width + 'px';
    table.style.width = [...table.querySelectorAll('col')].reduce((sum,col) => sum+parseInt(col.style.width,10),0) + 'px';
  };
  const save = (key,width) => {
    materials.columnWidths ||= {};
    if (width == null) delete materials.columnWidths[key];
    else materials.columnWidths[key] = width;
    queueSave();
  };
  table.querySelectorAll('[data-resize]').forEach(handle => {
    const key = handle.dataset.resize;
    handle.onpointerdown = event => {
      if (event.button !== 0) return;
      event.preventDefault();
      const start = event.clientX;
      const initial = columnWidth(key);
      let width = initial;
      handle.setPointerCapture(event.pointerId);
      handle.onpointermove = move => {
        width = clampColumnWidth(initial + move.clientX-start);
        apply(key,width);
      };
      handle.onpointerup = () => { if (width !== initial) save(key,width); };
      handle.onlostpointercapture = () => {
        handle.onpointermove = null;
        handle.onpointerup = null;
        apply(key,columnWidth(key));
      };
    };
    handle.ondblclick = () => { save(key,null); apply(key,columnWidth(key)); };
    handle.onkeydown = event => {
      if (!['ArrowLeft','ArrowRight','Home'].includes(event.key)) return;
      event.preventDefault();
      event.stopPropagation();
      save(key,event.key === 'Home' ? null : clampColumnWidth(columnWidth(key) + (event.key === 'ArrowLeft' ? -12 : 12)));
      apply(key,columnWidth(key));
    };
  });
}
let restoreViewFrame;
const editorScrollAreas = ['.sheet-scroll','.material-sidebar'];
const focusAttributes = ['id','data-field','data-action','data-group-toggle','data-column-toggle','data-resize','data-sidebar','data-select-row','data-id','data-header-command'];

function captureEditorView() {
  const root = box();
  const active = document.activeElement;
  const view = {
    page:[window.scrollX,window.scrollY],
    areas:editorScrollAreas.map(selector => {
      const area = root.querySelector(selector);
      return [selector,area?.scrollLeft || 0,area?.scrollTop || 0];
    })
  };
  const inHeader = byId('material-header-actions').contains(active);
  if ((!root.contains(active) && !inHeader) || active.closest('dialog')) return view;
  const row = active.closest('[data-row]');
  const rows = row ? [...root.querySelectorAll('tr[data-row]')] : [];
  const index = rows.indexOf(row);
  const candidates = row ? [row,...rows.slice(index+1),...rows.slice(0,index).reverse()] : [];
  view.focus = {
    inHeader,
    rowIds:candidates.map(candidate => candidate.dataset.row),
    groupId:active.closest('[data-group]')?.dataset.group,
    column:active.closest('td[data-column]')?.dataset.column,
    slot:active.closest('[data-slot]')?.dataset.slot,
    keys:focusAttributes.filter(key => active.hasAttribute(key))
      .map(key => '[' + key + '="' + CSS.escape(active.getAttribute(key)) + '"]').join(''),
    range:active.selectionStart == null ? null : [active.selectionStart,active.selectionEnd,active.selectionDirection]
  };
  return view;
}

function restoreEditorView(view) {
  const root = box();
  const restoreScroll = () => {
    for (const [selector,left,top] of view.areas) {
      const area = root.querySelector(selector);
      if (area) { area.scrollLeft = left; area.scrollTop = top; }
    }
    window.scrollTo(...view.page);
  };
  restoreScroll();
  const focus = view.focus;
  if (focus) {
    let row;
    for (const id of focus.rowIds) {
      row = root.querySelector('[data-row="' + CSS.escape(id) + '"]');
      if (row) break;
    }
    const group = focus.groupId && root.querySelector('[data-group="' + CSS.escape(focus.groupId) + '"]');
    const column = row && focus.column && row.querySelector('[data-column="' + focus.column + '"]');
    const slot = column && focus.slot != null && column.querySelector('[data-slot="' + focus.slot + '"]');
    const scope = slot || column || row || group || (focus.inHeader ? byId('material-header-actions') : root);
    const target = (focus.keys && scope.querySelector(focus.keys)) || slot ||
      (row && row.querySelector('td[data-column="name"] input')) ||
      (group && group.querySelector('button[data-action="fold"]'));
    if (target) {
      target.focus({preventScroll:true});
      if (focus.range && target.selectionStart != null) target.setSelectionRange(...focus.range);
    }
  }
  cancelAnimationFrame(restoreViewFrame);
  restoreViewFrame = requestAnimationFrame(restoreScroll);
}

function renderEditor() {
  const view = captureEditorView();
  const columns = visibleColumns();
  const widths = columns.map(([key]) => columnWidth(key));
  renderMaterialHeader();
  box().innerHTML = '<div class="material-workspace"><aside class="material-sidebar sidebar-compact">' + projectSidebar() + catalogSidebar() + displaySidebar() + '</aside>' +

    '<section class="material-sheet"><div class="material-title"><h1>BẢNG CHỐT MÃ VẬT LIỆU – ' +
    html(sheet.meta?.project || materials.projects.find(p => p.id === sheet.projectId)?.name || sheet.title) +
    '</h1><div id="material-count">' + materialKpis() + '</div></div>' +
    (materials.r2 ? '' : '<p class="asset-warning">Chưa bật kho ảnh · Đang dùng thư mục ảnh tạm.</p>') +
    '<div class="sheet-scroll density-' + density + '"><table class="sheet-grid" style="width:' + widths.reduce((sum,w) => sum+w,0) +
    'px"><colgroup>' + columns.map(([key],i) => '<col data-column="' + key + '" style="width:' + widths[i] + 'px">').join('') + '</colgroup><thead><tr>' +
    columns.map(([key,label]) => '<th data-column="' + key + '">' + (key === 'select' ?
      '<input type="checkbox" data-select-all aria-label="Chọn tất cả dòng đang hiện">' :
      label + '<span class="msp-col-resizer" data-resize="' + key + '" tabindex="0" role="separator" aria-orientation="vertical" aria-label="Độ rộng cột ' +
      label + '" title="Kéo đổi độ rộng · Nháy đúp để đặt lại"></span>') + '</th>').join('') +

    '</tr></thead>' + sheet.groups.filter(g => !hiddenGroups.has(g.id)).map(g => renderGroup(g,columns)).join('') +
    '</table></div></section></div><div id="material-multiselect" hidden></div><dialog id="material-dialog"></dialog>';
  const updatedScroll = box().querySelector('.sheet-scroll');

  showImages();
  installEditorSidebar();
  refreshRowSelection();
  installMaterialsAi();
  installColumnResize(updatedScroll.querySelector('table'));
  if (typeof installRelease === 'function') installRelease();
  window.lucide?.createIcons({root:byId('material-header-actions')});
  restoreEditorView(view);
}

function headerIcon(name,label = '') {
  return '<i data-lucide="' + name + '" aria-hidden="true">' + label + '</i>';
}
function headerMenu(key,label,icon,contents,variant = 'outline') {
  return '<details class="hdr-dropdown"><summary class="btn btn-' + variant + '" data-header-command="' + key + '">' +
    headerIcon(icon) + '<span class="btn-label">' + label + '</span><span class="hdr-caret">▾</span></summary>' +
    '<div class="hdr-dropdown-menu">' + contents + '</div></details>';
}
function renderMaterialHeader() {
  const header = byId('material-header-actions');
  header.innerHTML = headerMenu('file','File','folder','<button class="hdr-menu-item" data-action="back">Danh sách bảng</button><span id="release-actions"></span>') +
    '<span id="ai-actions"></span><span id="image-actions"></span><div class="hdr-undo-group">' +
    '<button class="btn btn-outline hdr-icon-sq" data-action="undo" data-header-command="undo" aria-label="Hoàn tác" title="Hoàn tác · Ctrl+Z">' + headerIcon('undo-2','↶') + '</button>' +
    '<button class="btn btn-outline hdr-icon-sq" data-action="redo" data-header-command="redo" aria-label="Làm lại" title="Làm lại · Ctrl+Y">' + headerIcon('redo-2','↷') + '</button></div>' +
    headerMenu('add','Thêm dòng/nhóm','plus','<label class="side-field">Danh mục<select id="header-add-group">' +
      sheet.groups.map(group => option(group.id,group.name)).join('') + '</select></label>' +
      '<button class="hdr-menu-item" data-action="header-add-row">Thêm dòng</button><button class="hdr-menu-item" data-action="add-group">Thêm danh mục</button>','primary') +
    '<small id="save-label">' + (conflict ? 'Xung đột' : dirty ? 'Chờ lưu' : saving ? 'Đang lưu' : 'Đã lưu') + '</small>';
  header.querySelector('[data-header-command="add"]').id = 'material-add';
}
function installEditorSidebar() {
  box().querySelectorAll('[data-sidebar]').forEach(section => {
    section.ontoggle = () => sidebarOpen.set(section.dataset.sidebar,section.open);
  });
  for (const [id,setValue] of [
    ['room-filter',value => { sheetRoom = value; }],['status-filter',value => { sheetStatus = value; }],

  ]) byId(id).onchange = event => { setValue(event.target.value); renderEditor(); };
  byId('editor-project').onchange = event => leaveSheet(event.target.value);
  byId('editor-sheet').onchange = async event => {
    const id = event.target.value;
    await flushSave();
    if (!dirty && !saving) openSheet(materials.sheets.find(s => s.id === id));
    else renderEditor();
  };
  const sidebar = box().querySelector('.material-sidebar');
  sidebar.onchange = event => {
    const {groupToggle,columnToggle} = event.target.dataset;
    if (groupToggle) setMembership(hiddenGroups,groupToggle,!event.target.checked);
    if (columnToggle) {
      if (optionalColumns.has(columnToggle)) setMembership(hiddenColumns,columnToggle,!event.target.checked);
      else setMembership(forcedPA,columnToggle,event.target.checked);
    }
    if (groupToggle || columnToggle) renderEditor();
  };
  sidebar.ondragstart = event => {
    const item = event.target.closest('[data-catalog]');
    if (item) event.dataTransfer.setData('application/gdhome-group',item.dataset.catalog);
  };
  sidebar.ondragover = event => {
    if (event.target.closest('[data-catalog]') && event.dataTransfer.types.includes('application/gdhome-group')) event.preventDefault();
  };
  sidebar.ondrop = event => {
    const target = event.target.closest('[data-catalog]');
    const source = event.dataTransfer.getData('application/gdhome-group');
    if (!source || !target || source === target.dataset.catalog) return;
    const from = sheet.groups.findIndex(g => g.id === source);
    const to = sheet.groups.findIndex(g => g.id === target.dataset.catalog);
    if (from < 0 || to < 0) return;
    event.preventDefault();
    modify(() => sheet.groups.splice(to,0,sheet.groups.splice(from,1)[0]));
  };
}
function setMembership(set,key,enabled) { if (enabled) set.add(key); else set.delete(key); }
async function leaveSheet(projectId = sheet.projectId) {
  await flushSave();
  if (dirty || saving) return renderEditor();
  sheet = null;
  renderMaterialApp(projectId);
}
function renderGroup(group,columns) {
  return '<tbody data-group="' + html(group.id) + '"><tr class="group"><th colspan="' + columns.length + '">' +
    '<input type="checkbox" data-select-group="' + html(group.id) + '" aria-label="Chọn cả nhóm ' + html(group.name) + '"> ' +
    '<button data-action="fold">' + (collapsed.has(group.id) ? '▸' : '▾') + '</button> ' +
    input('groupName',group.name,'Nhóm') + ' <label>Hạn <input type="date" data-field="due" value="' + html(group.due) + '"></label> ' +
    (typeof scheduleControls === 'function' ? scheduleControls(group) : '') + ' <button data-action="del-group">Bỏ nhóm</button></th></tr>' +
    (collapsed.has(group.id) ? '' : group.rows.filter(r => (!sheetRoom || r.room === sheetRoom) && (!sheetStatus || rowState(r) === sheetStatus))
      .map(row => renderRow(row,columns)).join('') + '<tr><td colspan="' + columns.length + '"><button data-action="add-row">＋ Dòng</button></td></tr>') + '</tbody>';
}

function imageCell(list, slot, content = '', state = '', removable = false) {
  const hasImage = list.length > 0;
  const photo = hasImage ? images(list.slice(0,1)) : '<span class="image-plus" aria-hidden="true">＋</span>';
  const label = slot === 'render' ? 'Chi tiết phối cảnh 3D' : 'Chi tiết phương án ' + (slot+1);
  return '<div class="image-cell ' + state + (hasImage ? ' has-image' : '') + '" tabindex="0" data-slot="' + slot +
    '" title="Bấm ảnh để chốt phương án. Dán ảnh bằng Ctrl+V hoặc kéo thả."><div class="image-preview">' + photo +
    (list.length > 1 ? '<small class="image-count">+' + (list.length-1) + '</small>' : '') +
    (state ? '<span class="image-state" aria-label="' + (state === 'chosen' ? 'Đã chọn' : 'Dự phòng') + '">' + (state === 'chosen' ? '✓' : 'Dự phòng') + '</span>' : '') +
    '</div><button class="image-detail" data-action="detail" aria-label="' + label + '">⋯</button>' + (removable ? '<button class="remove-pa" data-action="remove-pa" aria-label="Xoá PA trống">×</button>' : '') + content + '</div>';
}

function renderRow(row,columns) {
  const chosen = row.options[row.chosen];
  const count = rowPaCount(row);
  const cells = {
    select:'<input type="checkbox" data-select-row="' + html(row.id) + '" aria-label="Chọn ' + html(row.name || 'dòng') + '">',
    name:input('name',row.name,'Hạng mục'),
    room:input('room',row.room,'Vị trí'),
    render:imageCell(row.render,'render'),
    spec:input('spec',chosen?.finish || row.spec,'Quy cách'),
    qty:input('qty',row.qty,'Khối lượng'),
    unit:input('unit',row.unit,'Đơn vị'),
    supplier:input('supplier',row.supplier,'NCC / Nhà thầu'),
    note:input('note',row.note,'Ghi chú'),
    decision:'<select data-field="decision" aria-label="Trạng thái">' + Object.entries({...statusLabels,ordered:'Đã đặt hàng'})
      .map(([key,label]) => option(key,label,rowState(row))).join('') + '</select>',
    actions:'<div class="row-actions">' +
      (count < 3 ? '<button class="add-pa" data-action="add-pa">＋ PA</button>' : '') +
      [['move-up','Đưa dòng lên','↑'],['move-down','Đưa dòng xuống','↓'],['duplicate','Nhân bản dòng','⧉'],['del-row','Bỏ dòng','×']]
        .map(([action,label,icon]) => '<button data-action="' + action + '" title="' + label + '" aria-label="' + label + '">' + icon + '</button>').join('') + '</div>'
  };
  for (const [i,pa] of row.options.entries()) {
    const key = 'pa' + i;
    if (i >= count && !forcedPA.has(key)) { cells[key] = ''; continue; }
    const detail = [pa.color,pa.size].filter(Boolean).join(' · ');
    const code = '<div class="pa-caption">' + input('code',pa.code,'Mã PA' + (i+1)) +
      (detail ? '<small title="' + html(detail) + '"> · ' + html(detail) + '</small>' : '') + '</div>';
    const canRemove = i > 0 && i === count-1 && !paHasData(pa) && row.chosen !== i;
    cells[key] = imageCell(pa.images,i,code,row.chosen === i ? 'chosen' : row.chosen != null ? 'reserve' : '',canRemove);
  }
  return '<tr data-row="' + html(row.id) + '">' + columns.map(([key]) => '<td data-column="' + key + '">' + cells[key] + '</td>').join('') + '</tr>';
}

function context(target) {
  const group = sheet?.groups.find(g => g.id === target.closest('[data-group]')?.dataset.group);
  const row = group?.rows.find(r => r.id === target.closest('[data-row]')?.dataset.row);
  const slot = target.closest('[data-slot]')?.dataset.slot;
  return { group,row,slot };
}

function modify(change, render = true) {
  before.push(structuredClone(sheet));
  if (before.length > 50) before.shift();
  after = [];
  change();
  queueSave();
  if (render) renderEditor();
}

function queueSave() {
  dirty = true;
  clearTimeout(saveTimer);
  if (byId('save-label')) byId('save-label').textContent = conflict ? 'Xung đột' : 'Chờ lưu';
  if (byId('material-count')) byId('material-count').innerHTML = materialKpis();
  saveTimer = setTimeout(flushSave, 550);
}

async function flushSave() {
  if (saving || !dirty || conflict || !sheet) return;
  saving = true;
  dirty = false;
  try {
    const savedMeta = materials.sheets.find(s => s.id === sheet.id)?.meta || {};
    const baseline = { ...savedMeta,...materials.profiles?.[sheet.projectId] };
    const profilePatch = Object.fromEntries(projectFields.filter(key => sheet.meta?.[key] !== undefined && sheet.meta[key] !== baseline[key])
      .map(key => [key,sheet.meta[key]]));
    const result = await post('/api/materials', { _version:materials._version, sheet, columnWidths:materials.columnWidths,
      ...(Object.keys(profilePatch).length ? {profilePatch} : {}) });
    materials._version = result._version;
    materials.library = result.library || materials.library;
    materials.presets = result.presets || materials.presets;
    materials.profiles = result.profiles || materials.profiles;
    if (!sheet.id) {
      sheet.id = result.sheet.id;
      const selector = byId('editor-sheet');
      if (selector?.options[0]) { selector.options[0].value = sheet.id; selector.options[0].textContent = sheet.title; }
    }
    const index = materials.sheets.findIndex(s => s.id === sheet.id);
    if (index < 0) materials.sheets.push(result.sheet);
    else materials.sheets[index] = result.sheet;
    if (byId('save-label')) byId('save-label').textContent = dirty ? 'Chờ lưu' : 'Đã lưu';
    say('');
  } catch (error) {
    dirty = true;
    conflict = error.status === 409;
    if (byId('save-label')) byId('save-label').textContent = 'Chưa lưu';
    say(error.message + (conflict ? ' Có thể sao lưu bản nháp bằng nút bên dưới.' : ' Bấm “Lưu lại” để thử lại.'));
    const button = document.createElement('button');
    button.textContent = conflict ? 'Tải bản nháp JSON' : 'Lưu lại';
    button.onclick = () => conflict ? saveDraft() : flushSave();
    byId('notice').append(' ',button);
    return;
  } finally { saving = false; }
  if (dirty) queueSave();
}

function saveDraft() {
  const url = URL.createObjectURL(new Blob([JSON.stringify(sheet,null,2)], {type:'application/json'}));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'ban-nhap-chot-ma.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url),1000);
}

const projectFields = ['project','address','customer','phone','email','contract'];
function openSheet(value) {
  if (!value) return;
  sheet = structuredClone(value);
  selectedMaterialRows.clear();
  materialRangeAnchor = null;
  const project = materials.projects.find(p => p.id === sheet.projectId);
  sheet.meta = { project:project?.name || '',...sheet.meta,...materials.profiles?.[sheet.projectId] };
  sheetStatus = '';
  before = [];
  after = [];
  sheetRoom = '';
  renderEditor();
}

function createSheet(projectId, title, groups, meta = {}) {
  if (!projectId) return say('Chọn dự án Tiến độ trước.');
  openSheet({ projectId,title,meta:{ project:materials.projects.find(p => p.id === projectId)?.name,...meta },groups });
  queueSave();
}

function duplicate(row) {
  return { ...structuredClone(row), id:uid(), chosen:null, decision:'draft', ordered:false };
}

function pick(row, slot) {
  const i = Number(slot);
  if (slot === 'render' || !row.options[i]) return;
  const pa = row.options[i];
  if (!pa.images.length && !['brand','code','finish','color','size'].some(key => pa[key])) {
    say('Điền thông tin hoặc thêm ảnh trước khi chốt phương án.');
    return;
  }
  modify(() => { row.chosen = i; row.decision = 'chosen'; row.ordered = false; });
}

function dialog(markup) {
  const element = byId('material-dialog');
  element.innerHTML = '<form method="dialog"><button class="close-dialog" aria-label="Đóng">×</button></form>' + markup;
  element.showModal();
  return element;
}

let activeDetail;
function editDetail(row, slot) {
  activeDetail = { row,slot };
  const pa = slot === 'render' ? null : row.options[Number(slot)];
  const list = pa?.images || row.render;
  const element = dialog('<h2>' + html(row.name) + ' · ' + (pa ? 'PA' + (Number(slot)+1) : 'Phối cảnh 3D') + '</h2><div data-slot="' + slot +
    '"><div class="toolbar">' + (pa ? fields.map(k => input(k,pa[k],labels[k])).join('') + '<button data-detail="pick">✓ Chốt PA</button>' : '') +
    '</div><label>Thêm ảnh <input type="file" accept="image/*" multiple data-detail="upload"></label><div class="detail-images">' +
    list.map((image,i) => '<article>' + images([image],true) + '<button data-detail="left" data-index="' + i + '">←</button> <button data-detail="crop" data-index="' +
      i + '">Crop</button> <button data-detail="remove" data-index="' + i + '">Xóa</button></article>').join('') + '</div></div>');
  showImages(element);
  element.onclose = () => { if (!element.open && sheet && element.isConnected) renderEditor(); };
  const signal = detailSignal();
  let editedField;
  element.addEventListener('input', event => {
    const key = event.target.dataset.field;
    if (!key || !pa || pa[key] === event.target.value) return;
    const apply = () => { pa[key] = event.target.value; };
    if (editedField !== event.target) modify(apply,false);
    else { apply(); queueSave(); }
    editedField = event.target;
  },{ signal });
  element.addEventListener('change', async event => {
    const key = event.target.dataset.field;
    try {
      if (key && pa) {
        if (pa[key] !== event.target.value) modify(() => { pa[key] = event.target.value; },false);
        learnPreset(key,pa[key] || '');
        editedField = null;
        queueSave();
      }
      if (event.target.dataset.detail === 'upload') { await attachImages(row,slot,event.target.files); reopen(); }
    } catch (error) { showError(error); }
  },{ signal });
  element.onclick = async event => {
    const button = event.target.closest('[data-detail]');
    if (!button) return;
    const i = Number(button.dataset.index);
    try {
      if (button.dataset.detail === 'pick') { element.close(); return pick(row,slot); }
      if (button.dataset.detail === 'remove') modify(() => list.splice(i,1),false);
      if (button.dataset.detail === 'left' && i > 0) modify(() => { [list[i-1],list[i]] = [list[i],list[i-1]]; },false);
      if (button.dataset.detail === 'crop') return cropImage(row,slot,i,element);
      reopen();
    } catch (error) { showError(error); }
  };
  function reopen() { if (element.open) element.close(); editDetail(row,slot); }
  if (pa) element.querySelectorAll('[data-field]').forEach(field => {
    field.addEventListener('focus', () => suggestions(field,pa));
    field.addEventListener('input', () => suggestions(field,pa));
  });
}

let detailController;
function detailSignal() {
  detailController?.abort();
  detailController = new AbortController();
  return detailController.signal;
}

function learnPreset(key, value) {
  if (!Object.hasOwn(initialPresets,key) || !value.trim()) return;
  sheet.presets ||= {};
  const values = sheet.presets[key] ||= [];
  if (!values.some(v => v.toLocaleLowerCase() === value.trim().toLocaleLowerCase())) values.push(value.trim());
}

let menu;
function suggestions(field, pa) {
  menu?.remove();
  const key = field.dataset.field;
  const q = field.value.toLocaleLowerCase();
  const presets = [...new Set([...(initialPresets[key] || []),...(materials.presets[key] || []),...(sheet.presets?.[key] || [])])]
    .filter(value => !q || value.toLocaleLowerCase().includes(q));
  if (key === 'code' && !pa) {
    const {row,slot} = context(field);
    pa = row?.options[Number(slot)];
  }
  const library = typeof librarySuggestions === 'function' ? librarySuggestions(key,q,pa) : [];
  const choices = [...library, ...presets.map(value => ({ label:value, apply:() => {
    field.value = value;
    field.dispatchEvent(new Event('change',{bubbles:true}));
  } }))].slice(0,9);
  if (!choices.length) return;
  menu = document.createElement('div');
  menu.className = 'suggestions';
  choices.forEach((choice,i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = (i+1) + ' · ' + choice.label;
    button.onmousedown = event => event.preventDefault();
    button.onclick = () => { menu?.remove(); choice.apply(field); };
    menu.append(button);
  });
  field.after(menu);
  field.onkeydown = event => {
    const number = Number(event.key);
    if (event.altKey && number > 0 && choices[number-1]) {
      event.preventDefault(); event.stopPropagation(); menu?.remove(); choices[number-1].apply(field);
    }
    if (event.key === 'Escape') menu?.remove();
  };
  const currentMenu = menu;
  field.onblur = () => setTimeout(() => currentMenu.remove(),120);
}

document.addEventListener('click', async event => {
  if (!event.target.closest('#materials,#material-header-actions')) return;
  if (sheet && handleRowSelectionClick(event)) return;
  const button = event.target.closest('[data-action]');
  const {group,row,slot} = context(event.target);
  if (!button) {
    const cell = event.target.closest('.image-cell');
    if (row && event.target.closest('.image-preview img') && cell && slot !== 'render' && row.options[Number(slot)].images.length) {
      const rowId = row.id;
      pick(row,slot);
      box().querySelector('[data-row="' + rowId + '"] [data-slot="' + slot + '"]')?.focus({ preventScroll:true });
    }
    return;
  }
  try {
    switch (button.dataset.action) {
      case 'open': openSheet(materials.sheets.find(s => s.id === button.dataset.id)); break;
      case 'new': createSheet(byId('project-filter').value,'Bảng chốt mã mới',makeTemplate()); break;
      case 'copy': {
        const options = materials.sheets.map((s,i) => (i+1) + '. ' + s.title).join('\n');
        const index = Number(prompt('Chọn số bảng nguồn:\n' + options)) - 1;
        const source = materials.sheets[index];
        if (source) createSheet(byId('project-filter').value,source.title + ' (bản sao)',source.groups.map(g => ({
          ...newGroup(g.name), rows:g.rows.map(duplicate)
        })));
        break;
      }
      case 'notion': await openNotionCustomers(); break;
      case 'back': await leaveSheet(); break;
      case 'add-pa': modify(() => { row.paCount = Math.min(3,rowPaCount(row)+1); }); break;
      case 'remove-pa': modify(() => { row.paCount = Number(slot); }); break;
      case 'jump-group': {
        hiddenGroups.delete(button.dataset.id);
        collapsed.delete(button.dataset.id);
        renderEditor();
        cancelAnimationFrame(restoreViewFrame);
        box().querySelector('[data-group="' + button.dataset.id + '"]')?.scrollIntoView({block:'start'});
        break;
      }

      case 'fold': if (collapsed.has(group.id)) collapsed.delete(group.id); else collapsed.add(group.id); renderEditor(); break;
      case 'density': density = button.dataset.id; renderEditor(); break;
      case 'header-add-row': {
        const targetGroup = sheet.groups.find(entry => entry.id === byId('header-add-group').value);
        if (targetGroup) modify(() => targetGroup.rows.push(newRow()));
        break;
      }
      case 'add-group': modify(() => sheet.groups.push(newGroup('Nhóm mới'))); break;
      case 'del-group':
        if (canRemoveRows(group.rows) && confirm('Bỏ nhóm và các dòng khỏi bản nháp?')) modify(() => sheet.groups.splice(sheet.groups.indexOf(group),1));
        break;
      case 'add-row': modify(() => group.rows.push(newRow())); break;
      case 'del-row': removeMaterialRows([row]); break;
      case 'bulk-delete': removeMaterialRows(selectedRows()); break;
      case 'bulk-duplicate': duplicateMaterialRows(); break;
      case 'bulk-clear': clearRowSelection(); break;
      case 'move-up':
      case 'move-down': {
        const current = group.rows.indexOf(row);
        const next = current + (button.dataset.action === 'move-up' ? -1 : 1);
        if (next >= 0 && next < group.rows.length) modify(() => {
          [group.rows[current],group.rows[next]] = [group.rows[next],group.rows[current]];
        });
        break;
      }
      case 'duplicate': modify(() => group.rows.splice(group.rows.indexOf(row)+1,0,duplicate(row))); break;
      case 'detail': editDetail(row,slot); break;
      case 'undo': undo(false); break;
      case 'redo': undo(true); break;
    }
  } catch (error) { showError(error); }
});

function undo(redo) {
  const from = redo ? after : before;
  const to = redo ? before : after;
  if (!from.length) return;
  to.push(sheet);
  const old = from.pop();
  old.id ||= sheet.id;
  sheet = old;
  queueSave();
  renderEditor();
}

document.addEventListener('change', event => {
  const field = event.target;
  const key = field.dataset.field;
  if (!sheet || !field.closest('#materials') || field.closest('dialog')) return;
  if (field.dataset.bulk) { applyBulkChange(field); return; }
  if (!key) return;
  const {group,row,slot} = context(field);
  const value = field.value;
  if (key === 'code' && row?.options[Number(slot)]) {
    updateInlineCode(field,row.options[Number(slot)]);
    field.defaultValue = value;
    return;
  }
  if (!row && !group && key === 'project' && value !== sheet.meta.project &&
      !confirm('Đổi tên hiển thị trong hồ sơ Chốt mã và biên bản? Tên bên Lịch giữ nguyên.')) {
    field.value = sheet.meta.project;
    return;
  }
  modify(() => {
    if (row && key === 'decision') {
      if (!setRowDecision(row,value)) {
        field.value = rowState(row);
        say('Chọn PA trước khi chốt hoặc đặt hàng.');
      }

    } else if (row && key === 'spec' && row.chosen != null) row.options[row.chosen].finish = value;
    else if (row) { row[key] = value; learnPreset(key,value); }
    else if (group) group[key === 'groupName' ? 'name' : key] = value;
    else if (key === 'title') sheet.title = value;
    else (sheet.meta ||= {})[key] = value;
  },!!group && !row && ['taskId','leadDays','dayMode','due'].includes(key));
});

let editingCode;
function updateInlineCode(field, pa) {
  if (pa.code === field.value) return;
  const apply = () => { pa.code = field.value; };
  if (editingCode === field) { apply(); queueSave(); }
  else modify(apply,false);
  editingCode = field;
}

document.addEventListener('focusout', event => {
  if (editingCode === event.target) editingCode = null;
});

document.addEventListener('focusin', event => {
  if (sheet && event.target.closest('.sheet-grid') && event.target.matches('input')) suggestions(event.target);
});
document.addEventListener('input', event => {
  const field = event.target;
  if (!sheet || !field.closest('.sheet-grid') || !field.matches('input')) return;
  if (field.dataset.field === 'code') {
    const {row,slot} = context(field);
    if (row?.options[Number(slot)]) updateInlineCode(field,row.options[Number(slot)]);
  }
  suggestions(field);
});

document.addEventListener('keydown', event => {
  const target = event.target;
  if (!sheet || (!target.closest('#materials,#material-header-actions') && target !== document.body) || target.closest('dialog')) return;
  if (handleRowSelectionKey(event)) return;
  const {group,row,slot} = context(target);
  if (event.ctrlKey && ['z','y','d'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    if (event.key.toLowerCase() === 'd') {
      if (row) modify(() => group.rows.splice(group.rows.indexOf(row)+1,0,duplicate(row)));
    } else undo(event.key.toLowerCase() === 'y');
    return;
  }
  if (!row) return;
  if (event.key === 'Enter' && target.matches('button,select,input[type=checkbox]')) return;
  if (target.matches('.image-cell') && event.key === ' ' && slot !== 'render') { event.preventDefault(); pick(row,slot); return; }
  const cell = target.closest('td');
  if (!cell) return;
  if (event.key === 'Escape') { if (target.tagName === 'INPUT') {
      target.value = target.defaultValue;
      if (target.dataset.field === 'code' && row.options[Number(slot)]) updateInlineCode(target,row.options[Number(slot)]);
    }
    target.blur(); return; }
  const rows = [...box().querySelectorAll('tr[data-row]')];
  const index = rows.indexOf(cell.parentElement);
  const col = cell.cellIndex;
  let next;
  if (['ArrowUp','ArrowDown','Enter'].includes(event.key)) next = rows[index + (event.key === 'ArrowUp' || event.shiftKey ? -1 : 1)]?.cells[col];
  if (['Tab','ArrowLeft','ArrowRight'].includes(event.key)) {
    const direction = event.key === 'ArrowLeft' || event.shiftKey ? -1 : 1;
    next = cell.parentElement.cells[col+direction] || rows[index+direction]?.cells[direction > 0 ? 0 : rows[index+direction].cells.length-1];
  }
  const control = next?.querySelector('.pa-caption input') || next?.querySelector('input,select,[tabindex],button');
  if (control) { event.preventDefault(); control.focus(); if (control.matches('input:not([type=checkbox])')) control.select?.(); }
});

window.addEventListener('beforeunload', event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } });
