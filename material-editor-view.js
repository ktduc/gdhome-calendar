function labeledInput(key, value, label) {
  return '<label><span>' + label + '</span>' + input(key,value,label) + '</label>';
}

const materialColumnLabels = Object.fromEntries(materialPrintColumns);
const materialColumns = [
  ['select',materialColumnLabels.number],['name',materialColumnLabels.name],['render',materialColumnLabels.render],
  ['pa0',materialColumnLabels.sample],['pa1','PA2'],['pa2','PA3'],['qty',materialColumnLabels.qty],['unit','ĐVT'],
  ['note',materialColumnLabels.note],['room','Vị trí'],['spec','Chất liệu / Quy cách'],
  ['supplier','NCC / Nhà thầu'],['decision','Trạng thái'],['actions','Thao tác']
];

const optionalColumns = new Set(['render','spec','qty','unit','supplier','note','decision']);
const hiddenColumns = new Set();
const forcedPA = new Set();
const hiddenGroups = new Set();
const collapsed = new Set();
const sidebarOpen = new Map();
let sheetRoom = '', sheetStatus = '', onlyUnlinkedGroups = false;
const rowState = row => row.ordered ? 'ordered' : row.decision;
const paHasData = pa => !!pa && (pa.images?.length || fields.some(key => pa[key]));
function rowPaCount(row) {
  return Math.max(1,row.paCount || 1,(row.chosen ?? -1)+1,row.options.findLastIndex(paHasData)+1);
}
function orderedMaterialColumns() {
  const columns = new Map(materialColumns);
  const order = [...new Set([...(materialView.columnOrder || []),...columns.keys()])];
  return order.filter(key => columns.has(key)).map(key => [key,columns.get(key)]);
}
function visibleColumns() {
  const count = Math.max(1,...sheet.groups.flatMap(g => g.rows.map(rowPaCount)));
  return orderedMaterialColumns().filter(([key]) => !hiddenColumns.has(key) &&
    (!/^pa[12]$/.test(key) || forcedPA.has(key) || Number(key[2]) < count));
}
function materialImageFit() { return materialView.imageFit === 'fit' ? 'fit' : 'fill'; }

function printableColumns() {
  return visibleColumns().filter(([key]) => key !== 'actions');
}
function columnPrints(key) {
  return key !== 'actions' && !materialView.printHidden?.includes(key);
}
function savePrintColumns(columns) {
  const visible = new Set(printableColumns().map(([key]) => key));
  const included = new Set(columns);
  const previouslyHidden = (materialView.printHidden || []).filter(key => !visible.has(key));
  setMaterialView({printHidden:[...previouslyHidden,...[...visible].filter(key => !included.has(key))]});
}
function printColumnCheckboxes(attribute) {
  return printableColumns().map(([key,label]) => '<label class="sb-chip"><input type="checkbox" ' +
    attribute + ' value="' + key + '"' + (columnPrints(key) ? ' checked' : '') + '> ' + html(label) + '</label>').join('');
}
function printColumnButton(key,label) {
  const enabled = columnPrints(key);
  return '<button type="button" class="print-column-button" data-action="print-column" data-id="' + key +
    '" title="' + (key === 'actions' ? 'Cột thao tác chỉ dùng trong bảng nhập' : 'Bật/tắt in cột ' + label) +
    '" aria-label="In cột ' + label + '" aria-pressed="' + enabled + '"' +
    (key === 'actions' ? ' disabled' : '') + '>' + headerIcon('printer') + '</button>';
}
function materialColumnClass(key,editing) {
  return editing && !columnPrints(key) ? ' class="is-no-print"' : '';
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
    '<button type="button" data-action="remove-sheet">' + materialSheetRemoveLabel(sheet) + '</button>' +
    '<div class="material-meta-fields">' + labeledInput('title',sheet.title,'Tên bảng') +
    [['customer','Kính gửi'],['address','Địa chỉ'],['project','Tên dự án'],['phone','SĐT'],['email','Email'],['date','Ngày'],['number','Số'],['contract','Hợp đồng']]
      .map(([key,label]) => labeledInput(key,meta[key],label)).join('') + '</div><button data-action="project-profile">Sửa hồ sơ</button> <button data-action="notion">Lấy từ Notion</button> <a class="button" href="/du-an?project=' + encodeURIComponent(sheet.projectId || '') + '" target="_blank">📁 Hồ sơ dự án</a>');
}
function assetSidebars() {
  return sidebarSection('renders','🎨 Phối cảnh 3D dự án',
    '<div class="material-sidebar-actions">' + (materialView.hideAssetPreviews !== false ? '' : '<button type="button" data-action="upload-renders" title="Ảnh JPG/PNG hoặc PDF nhiều trang, tự tách và nén">⬆ Tải ảnh / PDF</button>') +
    '<button type="button" data-action="open-renders">Danh sách</button></div><div class="material-render-strip" data-render-strip></div><p class="material-library-summary" data-render-summary></p>' +
    (materialView.hideAssetPreviews !== false ? '' : '<small class="material-library-summary">Bấm ô Phối cảnh 3D để chọn nhanh ảnh. Dùng chung với Quản lý dự án.</small>')) +
    sidebarSection('library','📚 Dữ liệu dùng chung',
    '<div class="material-sidebar-actions"><button type="button" data-action="open-library">Danh sách</button></div><div class="material-render-strip" data-library-strip></div>' +
    '<p class="material-library-summary" data-library-summary></p>' + (materialView.hideAssetPreviews !== false ? '' : '<small class="material-library-summary">Ảnh mẫu vật liệu theo hạng mục, dùng cho mọi dự án. Bấm ô Mẫu vật liệu / PA để chọn.</small>'));
}
function materialGroupVisible(group) {
  return !hiddenGroups.has(group.id) && (!onlyUnlinkedGroups || !linkedMaterialTask(group));
}
function catalogSidebar() {
  return sidebarSection('catalog','📋 Danh mục',
    '<label class="sb-chip material-unlinked-filter"><input type="checkbox" id="material-unlinked-only"' +
    (onlyUnlinkedGroups ? ' checked' : '') + '> Chỉ nhóm chưa liên kết</label>' +
    '<ul class="material-catalog">' + sheet.groups.map(group => '<li data-catalog="' + html(group.id) + '" draggable="true">' +
      '<input type="checkbox" data-group-toggle="' + html(group.id) + '" aria-label="Hiện ' + html(group.name) + '"' +
      (hiddenGroups.has(group.id) ? '' : ' checked') + '><button data-action="jump-group" data-id="' + html(group.id) + '" title="' + html(group.name) + '">' +
      html(group.name) + '</button><small>' + group.rows.filter(r => r.chosen != null && r.decision !== 'changed').length + '/' + group.rows.length +
      '</small><span title="Kéo để đổi thứ tự">⋮⋮</span></li>').join('') + '</ul><button data-action="add-group">＋ Thêm danh mục</button> ' +
    '<button data-action="relink-tasks">Tự liên kết lại tất cả</button>');
}
function displaySidebar() {
  return sidebarSection('display','⚙ Hiển thị',
    '<button type="button" data-action="toggle-asset-previews" aria-pressed="' + (materialView.hideAssetPreviews !== false) + '">' + (materialView.hideAssetPreviews !== false ? 'Hiện ảnh xem trước sidebar' : 'Ẩn ảnh xem trước sidebar') + '</button>' +
    '<div class="sb-row-label">Mật độ dòng</div><div class="sb-seg-btns material-density">' +
    Object.entries({xs:'XS',s:'S',m:'M',l:'L'}).map(([key,label]) =>
      '<button data-action="density" data-id="' + key + '" aria-pressed="' + (key === density) + '">' + label + '</button>').join('') + '</div>' +

    '<div class="sb-row-label">Khung ảnh</div><div class="sb-seg-btns material-image-fit">' +
    [['fill','Fill'],['fit','Vừa']].map(([key,label]) => '<button data-action="image-fit" data-id="' + key +
      '" aria-pressed="' + (key === materialImageFit()) + '" title="' + (key === 'fill' ? 'Cắt vừa ô' : 'Thấy toàn ảnh') + '">' + label + '</button>').join('') + '</div>' +
    '<div class="sb-row-label">Độ đậm chữ</div><div class="sb-seg-btns material-font-buttons">' +
    Object.entries({light:'Mảnh',normal:'Thường',bold:'Đậm',heavy:'Rất đậm'}).map(([key,label]) =>
      '<button data-action="font-weight" data-id="' + key + '" aria-pressed="' + (key === (materialView.fontWeight || 'normal')) + '">' + label + '</button>').join('') + '</div>' +
    '<label class="side-field">Phòng<select id="room-filter"><option value="">Tất cả</option>' +
      [...new Set(sheet.groups.flatMap(g => g.rows.map(r => r.room)).filter(Boolean))].map(r => option(r,r,sheetRoom)).join('') + '</select></label>' +
    '<label class="side-field">Trạng thái<select id="status-filter"><option value="">Tất cả</option>' +
      Object.entries({...statusLabels,ordered:'Đã đặt hàng'}).map(([key,label]) => option(key,label,sheetStatus)).join('') + '</select></label>' +
    '<label class="side-field material-preview-toggle"><span><input type="checkbox" id="material-print-view"' +
    (viewAsPrint ? ' checked' : '') + '> Xem như bản in</span></label>' +
    '<div class="sb-chip-grid">' + materialColumns.filter(([key]) => optionalColumns.has(key) || /^pa[12]$/.test(key))
      .map(([key,label]) => '<label class="sb-chip" title="' + label + '"><input type="checkbox" data-column-toggle="' + key + '"' +
        ((optionalColumns.has(key) ? !hiddenColumns.has(key) : forcedPA.has(key)) ? ' checked' : '') + '> ' +
        (optionalColumns.has(key) ? label : 'Luôn hiện ' + label) + '</label>').join('') + '</div>' +
    '<div class="sb-row-label">Cột in</div><div class="sb-chip-grid material-print-columns">' + printColumnCheckboxes('data-print-column-toggle') + '</div>' +
    '<button type="button" class="material-column-reset" data-action="reset-columns" title="Đặt lại thứ tự cột">Về mặc định</button>');
}
function materialKpis() {
  const nearest = sheet.groups.map(g => deadlineFor(g).due).filter(Boolean).sort()[0];
  return [sheet.groups.length + ' nhóm',sheet.groups.reduce((n,g) => n+g.rows.length,0) + ' hạng mục',
    counts(sheet),nearest ? 'Hạn gần nhất ' + nearest : 'Chưa có hạn'].map(value => '<span>' + html(value) + '</span>').join('');
}

const defaultColumnWidths = {select:46,room:112,render:200,spec:152,pa0:200,pa1:200,pa2:200,qty:104,unit:70,supplier:136,note:156,decision:130,actions:134};
const clampColumnWidth = width => Math.round(Math.min(720,Math.max(48,width)));

function columnWidth(key) {
  if (key === 'select') return defaultColumnWidths.select;
  const manual = materials.columnWidths?.[key];
  if (manual) return manual;
  if (key === 'name') {
    const context = document.createElement('canvas').getContext('2d');
    context.font = '13px ' + getComputedStyle(document.body).fontFamily;
    const longest = Math.max(0,...sheet.groups.flatMap(g => g.rows.map(row => context.measureText(row.name).width)));
    return Math.ceil(Math.min(460,Math.max(148,longest+24)));
  }
  return defaultColumnWidths[key];
}

function moveMaterialColumn(source,target,after) {
  if (!source || source === target) return;
  const order = orderedMaterialColumns().map(([key]) => key);
  const from = order.indexOf(source);
  if (from < 0 || !order.includes(target)) return;
  order.splice(from,1);
  order.splice(order.indexOf(target)+(after ? 1 : 0),0,source);
  setMaterialView({columnOrder:order});
  renderEditor();
}

function installColumnOrder(table) {
  const header = table.tHead;
  const kind = 'application/gdhome-column';
  let marker;
  function mark(cell,after) {
    if (marker && marker !== cell) delete marker.dataset.columnDrop;
    marker = cell;
    if (cell) cell.dataset.columnDrop = after ? 'after' : 'before';
  }
  function dropSide(event,cell) {
    const rect = cell.getBoundingClientRect();
    return event.clientX >= rect.left+rect.width/2;
  }
  header.ondragstart = event => {
    const handle = event.target.closest('[data-column-drag]');
    if (!handle) return;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(kind,handle.dataset.columnDrag);
  };
  header.ondragover = event => {
    const cell = event.target.closest('th[data-column]');
    if (!cell || !event.dataTransfer.types.includes(kind)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    mark(cell,dropSide(event,cell));
  };
  header.ondragleave = event => { if (!header.contains(event.relatedTarget)) mark(null); };
  header.ondragend = () => mark(null);
  header.ondrop = event => {
    const cell = event.target.closest('th[data-column]');
    if (!cell || !event.dataTransfer.types.includes(kind)) return;
    event.preventDefault();
    mark(null);
    moveMaterialColumn(event.dataTransfer.getData(kind),cell.dataset.column,dropSide(event,cell));
  };
  header.onkeydown = event => {
    const cell = event.target.closest('[data-column-drag]')?.closest('th');
    if (!cell || !event.altKey || !['ArrowLeft','ArrowRight'].includes(event.key)) return;
    const after = event.key === 'ArrowRight';
    const target = after ? cell.nextElementSibling : cell.previousElementSibling;
    if (!target) return;
    event.preventDefault();
    moveMaterialColumn(cell.dataset.column,target.dataset.column,after);
  };
}

function installColumnResize(table) {
  const apply = (key,width) => {
    table.querySelector('col[data-column="' + key + '"]').style.width = width + 'px';
    table.closest('.material-paper').style.width = [...table.querySelectorAll('col')]
      .reduce((sum,col) => sum+parseInt(col.style.width,10),1) + 'px';
  };
  const save = (key,width) => {
    materials.columnWidths ||= {};
    if (width == null) delete materials.columnWidths[key];
    else materials.columnWidths[key] = width;
    setMaterialView({columnWidths:{...materials.columnWidths}});
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
const focusAttributes = ['id','data-field','data-action','data-group-toggle','data-column-toggle','data-resize','data-sidebar','data-select-row','data-select-group','data-select-all','data-bulk','data-id','data-header-command','data-column-drag'];

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
  box().innerHTML = '<div class="material-workspace"><aside class="material-sidebar shell-sidebar sidebar-compact">' +
    projectSidebar() + assetSidebars() + catalogSidebar() + displaySidebar() + '</aside>' + (viewAsPrint ? renderMaterialPreview() : renderMaterialTable(columns,widths)) +
    '</div><div id="material-multiselect" class="msp-multisel-bar" hidden></div><dialog id="material-dialog"></dialog>';

  const updatedScroll = box().querySelector('.sheet-scroll');

  showImages();
  installEditorSidebar();
  if (typeof fillMaterialAssetSidebar === 'function') fillMaterialAssetSidebar();
  if (!viewAsPrint) refreshRowSelection();
  installMaterialsAi();
  if (!viewAsPrint) {
    const table = updatedScroll.querySelector('table');
    installColumnResize(table);
    installColumnOrder(table);
  }
  if (typeof installRelease === 'function') installRelease();
  window.lucide?.createIcons({root:byId('material-header-actions')});
  restoreEditorView(view);
}

function materialFontClass() { return 'msp-fw-' + (materialView.fontWeight || 'normal'); }

function materialPaperHeading(current) {
  const meta = current.meta || {};
  const date = /^\d{4}-\d{2}-\d{2}$/.test(meta.date) ? Date.parse(meta.date+'T12:00:00+07:00') : Date.now();
  const fields = [['Kính gửi',meta.customer],['Địa chỉ',meta.address],['SĐT',meta.phone],['Email',meta.email],
    ['Hợp đồng',meta.contract],['Số',meta.number]];
  return '<header class="material-paper-heading"><div class="print-heading"><img src="/gdhome-logo.png" alt="GD HOME">' +
    '<i>Hà Nội, ' + html(materialPrintDate(date || Date.now())) + '</i></div><h1>BẢNG CHỐT MÃ VẬT LIỆU – ' +
    html(meta.project || current.title) + '</h1><div class="material-paper-meta">' + fields.filter(([,value]) => value)
      .map(([label,value]) => '<span><strong>' + label + '</strong> ' + html(value) + '</span>').join('') + '</div></header>';
}

function materialColumnHeading(key,label,editing) {
  const subtitle = key === 'qty' ? ' ' + materialQuantityNote : '';
  if (!editing) return html(label) + subtitle;
  return '<span class="material-column-label" data-column-drag="' + key + '" draggable="true" tabindex="0" title="Kéo đổi thứ tự cột · Alt và mũi tên">' +
    html(label) + subtitle + '</span>' + (key === 'render' ? '<button type="button" class="header-asset-upload" data-action="upload-renders" title="Tải ảnh hoặc PDF phối cảnh 3D của dự án" aria-label="Tải ảnh hoặc PDF phối cảnh 3D"></button>' : '');
}

function renderMaterialPaper(current,columns,widths,groups,editing) {
  const width = widths.reduce((sum,value) => sum+value,0);
  const columnHeadings = columns.map(([key,label]) => '<th data-column="' + key + '"' + materialColumnClass(key,editing) + '>' + (key === 'select' ?
    '<label class="material-row-number"><input type="checkbox" data-select-all aria-label="Chọn tất cả dòng đang hiện">' + materialColumnHeading(key,label,editing) + '</label>' :
    materialColumnHeading(key,label,editing) + '<span class="msp-col-resizer" data-resize="' + key + '" tabindex="0" role="separator" aria-orientation="vertical" aria-label="Độ rộng cột ' +
    label + '" title="Kéo đổi độ rộng · Nháy đúp để đặt lại"></span>') + (editing ? printColumnButton(key,label) : '') + '</th>').join('');
  const columnSizes = columns.map(([key],index) => '<col data-column="' + key + '" style="width:' + (editing ? widths[index] + 'px' : (widths[index]/width*100) + '%') + '">').join('');
  return '<article class="material-paper ' + materialFontClass() + ' density-' + density + '" data-image-fit="' + materialImageFit() + '" style="width:' + (width+1) +
    'px">' + materialPaperHeading(current) +
    '<table class="sheet-grid print-table"><colgroup>' + columnSizes + '</colgroup><thead><tr>' +
    columnHeadings + '</tr></thead>' + renderMaterialGroups(columns,groups,editing) + '</table></article>';
}

function materialExportCodePosition(scope) {
  return scope.codePosition || (scope.showCodeOnImage === false ? 'below' : 'above');
}
function materialPaperForExport(current) {
  const columns = printableColumns().filter(([key]) => columnPrints(key));
  if (!columns.length) {
    const message = document.createElement('p');
    message.className = 'material-paper-output';
    message.textContent = 'Bật in ít nhất một cột để xem bảng.';
    return message;
  }
  const template = document.createElement('template');
  template.innerHTML = renderMaterialPaper(current,columns,columns.map(([key]) => columnWidth(key)),current.groups,false);
  const paper = template.content.firstElementChild;
  paper.classList.add('material-paper-output');
  paper.dataset.imageFit = (typeof savedMaterialExportScope === 'function' ? savedMaterialExportScope().imageFit : null) === 'fit' ? 'fit' : 'fill';
  for (const imageButton of paper.querySelectorAll('.image-open,.material-image-thumb')) {
    const slot = document.createElement('span');
    if (imageButton.tagName === 'BUTTON') {
      slot.className = imageButton.className;
      slot.append(...imageButton.childNodes);
      imageButton.replaceWith(slot);
    }
  }
  paper.querySelectorAll('button,input[type="checkbox"],[data-resize],.image-plus,.paste-cell-hint,.image-count,.material-group-controls')
    .forEach(element => element.remove());
  paper.querySelectorAll('input,textarea,select').forEach(field => {
    const value = document.createElement('span');
    value.className = 'sheet-value';
    value.dataset.field = field.dataset.field || '';
    value.textContent = field.tagName === 'SELECT' ? field.selectedOptions[0]?.textContent || '' : field.value;
    field.replaceWith(value);
  });
  paper.querySelectorAll('.image-cell').forEach(cell => cell.classList.remove('reserve'));
  const exportScope = typeof savedMaterialExportScope === 'function' ? savedMaterialExportScope() : {};
  const position = materialExportCodePosition(exportScope);
  {
    for (const group of current.groups) {
      for (const row of group.rows) {
        const rowEl = paper.querySelector('tr[data-row="' + row.id + '"]');
        if (!rowEl) continue;
        for (let i = 0; i < row.options.length; i++) {
          const pa = row.options[i];
          if (!pa?.code) continue;
          const cell = rowEl.querySelector('.image-cell[data-slot="' + i + '"]');
          const preview = cell?.querySelector('.image-preview');
          if (!preview?.querySelector('img,.paint-swatch-box')) continue;
          if (position === 'above') cell.querySelector('.pa-caption')?.remove();
          if (position === 'below') preview.querySelector('.image-code-tag')?.remove();
          else if (!preview.querySelector('.image-code-tag')) {
            const tag = document.createElement('div');
            tag.className = 'image-code-tag';
            tag.title = pa.code;
            tag.textContent = pa.code;
            preview.append(tag);
          }
        }
      }
    }
  }
  paper.querySelectorAll('[tabindex]').forEach(element => element.removeAttribute('tabindex'));
  return paper;
}

function renderMaterialPreview() {
  const groups = sheet.groups.filter(materialGroupVisible)
    .map(group => ({...group,rows:visibleGroupRows(group)})).filter(group => group.rows.length);
  const paper = materialPaperForExport({...sheet,groups});
  paper.id = 'material-table-preview';
  return '<section class="material-sheet"><div class="sheet-scroll material-preview-scroll">' + paper.outerHTML + '</div></section>';
}

function renderMaterialTable(columns,widths) {
  const groups = sheet.groups.filter(materialGroupVisible);
  return '<section class="material-sheet ' + materialFontClass() + '"><div class="material-title"><div id="material-count">' +
    materialKpis() + '</div></div>' + (materials.r2 ? '' : '<p class="asset-warning">Đang dùng thư mục ảnh tạm.</p>') +
    '<div class="sheet-scroll">' + renderMaterialPaper(sheet,columns,widths,groups,true) + '</div></section>';
}

const headerIcon = GDHomeShell.icon;
const headerMenu = GDHomeShell.dropdown;

function renderMaterialHeader() {
  const header = byId('material-header-actions');
  header.innerHTML = headerMenu('file','File','folder','<button class="hdr-menu-item" data-action="back">Danh sách bảng</button>' +
    '<button class="hdr-menu-item" data-action="remove-sheet">' + materialSheetRemoveLabel(sheet) + '</button><span id="release-actions"></span>') +
    '<span id="ai-actions" data-shell-slot="ai"></span><span id="image-actions" data-shell-slot="copy"></span><div class="hdr-undo-group" data-shell-slot="undo">' +
    '<button class="btn btn-outline hdr-icon-sq" data-action="undo" data-header-command="undo" aria-label="Hoàn tác" title="Hoàn tác · Ctrl+Z">' + headerIcon('undo-2','↶') + '</button>' +
    '<button class="btn btn-outline hdr-icon-sq" data-action="redo" data-header-command="redo" aria-label="Làm lại" title="Làm lại · Ctrl+Y">' + headerIcon('redo-2','↷') + '</button></div>' +
    headerMenu('add','Thêm dòng/nhóm','plus','<label class="side-field">Danh mục<select id="header-add-group">' +
      sheet.groups.map(group => option(group.id,group.name)).join('') + '</select></label>' +
      '<button class="hdr-menu-item" data-action="header-add-row">Thêm dòng</button><button class="hdr-menu-item" data-action="add-group">Thêm danh mục</button>','primary');
  for (const [command,slot] of [['file','file'],['add','primary']]) {
    header.querySelector('[data-header-command="' + command + '"]').closest('details').dataset.shellSlot = slot;
  }
  header.querySelector('[data-header-command="add"]').id = 'material-add';
  header.querySelector('[data-action="undo"]').disabled = !before.length;
  header.querySelector('[data-action="redo"]').disabled = !after.length;
  byId('save-label').onclick = () => conflict ? saveDraft() : flushSave();
  setMaterialSaveStatus(conflict ? 'conflict' : dirty ? 'pending' : saving ? 'saving' : 'saved');
}
function installEditorSidebar() {
  box().querySelectorAll('[data-sidebar]').forEach(section => {
    section.ontoggle = () => {
      if (!section.isConnected || (sidebarOpen.get(section.dataset.sidebar) !== false) === section.open) return;
      sidebarOpen.set(section.dataset.sidebar,section.open);
      setMaterialView({sidebarOpen:Object.fromEntries(sidebarOpen)});
    };
  });
  byId('room-filter').onchange = event => {
    sheetRoom = event.target.value;
    setMaterialSheetView({room:sheetRoom});
    renderEditor();
  };
  byId('status-filter').onchange = event => {
    sheetStatus = event.target.value;
    setMaterialSheetView({status:sheetStatus});
    renderEditor();
  };
  byId('material-unlinked-only').onchange = event => {
    onlyUnlinkedGroups = event.target.checked;
    setMaterialSheetView({onlyUnlinked:onlyUnlinkedGroups});
    renderEditor();
  };
  byId('material-print-view').onchange = event => {
    viewAsPrint = event.target.checked;
    setMaterialSheetView({viewAsPrint});
    renderEditor();
  };
  byId('editor-project').onchange = event => leaveSheet(event.target.value);
  byId('editor-sheet').onchange = async event => {
    const id = event.target.value;
    await flushSave();
    if (!dirty && !saving) openSheet(materials.sheets.find(s => s.id === id));
    else renderEditor();
  };
  const sidebar = box().querySelector('.material-sidebar');
  sidebar.onchange = event => {
    const {groupToggle,columnToggle,printColumnToggle} = event.target.dataset;
    if (printColumnToggle !== undefined) {
      const key = event.target.value;
      const checked = event.target.checked;
      const columns = printableColumns().filter(([id]) => id === key ? checked : columnPrints(id));
      savePrintColumns(columns.map(([id]) => id));
      renderEditor();
      return;
    }
    if (groupToggle) setMembership(hiddenGroups,groupToggle,!event.target.checked);
    if (columnToggle) {
      if (optionalColumns.has(columnToggle)) setMembership(hiddenColumns,columnToggle,!event.target.checked);
      else setMembership(forcedPA,columnToggle,event.target.checked);
    }
    if (groupToggle) saveMaterialGroupsView();
    if (columnToggle) setMaterialView({hiddenColumns:[...hiddenColumns],forcedPA:[...forcedPA]});
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

function visibleGroupRows(group) {
  if (collapsed.has(group.id)) return [];
  return group.rows.filter(row => (!sheetRoom || row.room === sheetRoom) && (!sheetStatus || rowState(row) === sheetStatus));
}
function renderMaterialGroups(columns,groups,editing) {
  let number = 0;
  return groups.map(group => renderGroup(group,columns,() => ++number,editing)).join('');
}
function renderGroup(group,columns,nextNumber,editing) {
  const span = columns.length;
  const unlinked = editing && !linkedMaterialTask(group);
  const heading = '<tr class="group print-group' + (unlinked ? ' material-unlinked-group' : '') + '"><th colspan="' + span + '">' +
    '<input type="checkbox" data-select-group="' + html(group.id) + '" aria-label="Chọn cả nhóm ' + html(group.name) + '"> ' +
    '<button data-action="fold">' + (collapsed.has(group.id) ? '▸' : '▾') + '</button> ' +
    input('groupName',group.name,'Nhóm') + ' <span class="material-group-controls"><label>Hạn <input type="date" data-field="due" value="' + html(group.due) + '"></label> ' +
    (unlinked ? '<button type="button" class="material-unlinked-chip" data-action="choose-group-task">Chưa liên kết Tiến độ</button> ' : '') +
    scheduleControls(group) + ' <button data-action="del-group">Bỏ nhóm</button></span></th></tr>';
  const rows = (editing ? visibleGroupRows(group) : group.rows).map(row => renderRow(row,columns,nextNumber(),editing)).join('');
  const add = !editing || collapsed.has(group.id) ? '' : '<tr><td colspan="' + span + '"><button data-action="add-row">＋ Dòng</button></td></tr>';
  return '<tbody data-group="' + html(group.id) + '">' + heading + rows + add + '</tbody>';
}

function imageCell(list, slot, content = '', state = '', removable = false, editing = true, pa = null) {
  const hasImage = list && list.length > 0;
  const isPaint = !hasImage && !!pa?.paint;
  let photo = '';
  if (hasImage) {
    photo = '<button class="image-open"' + (editing ? ' draggable="true"' : '') + ' data-action="view-image" aria-label="Xem ảnh lớn">' +
      images(list.slice(0,1),!editing) + '</button>';
  } else if (isPaint) {
    photo = '<div class="image-open paint-swatch-box" data-action="open-paint" title="Màu sơn: ' + html(pa.paint.brand + ' ' + pa.paint.code + ' – ' + pa.paint.name) + '" style="background-color:' + html(pa.paint.hex) + ';width:100%;height:100%;border-radius:4px;display:flex;align-items:flex-end;justify-content:center;padding:2px;box-sizing:border-box;cursor:pointer;"><span class="image-code-tag">' + html(pa.paint.code || pa.paint.hex) + '</span></div>';
  }
  const label = slot === 'render' ? 'Chi tiết phối cảnh 3D' : 'Chi tiết phương án ' + (Number(slot)+1);
  const isChosen = state === 'chosen';
  const choose = slot === 'render' ? '' : '<button type="button" class="image-pick' + (isChosen ? ' chosen' : '') + '" data-action="pick-pa" aria-label="' + (isChosen ? 'Bỏ chốt PA' : 'Chốt PA') + (Number(slot)+1) + '" aria-pressed="' + isChosen + '" title="' + (isChosen ? 'Phương án đã chốt · Bấm để bỏ chốt' : 'Chốt phương án') + '">' + (isChosen ? '✓ Đã chốt' : '✓') + '</button>';

  return '<div class="image-cell ' + state + (hasImage ? ' has-image' : isPaint ? ' has-paint has-image' : '') + '" tabindex="0" data-slot="' + slot +
    '" aria-label="Ô ảnh · Ctrl+V để dán ảnh" title="Ctrl+V để dán ảnh hoặc kéo thả."><div class="image-preview">' + photo +
    (!hasImage && !isPaint ? '<div class="image-empty-hint">Bấm để chọn<br>·<br>Ctrl+V để dán</div>' : '') +
    (state === 'reserve' ? '<span class="image-state">Dự phòng</span>' : '') +
    '</div>' + (list && list.length > 1 ? '<div class="material-image-thumbs">' +
      list.slice(1).map((image,i) => '<button class="material-image-thumb"' + (editing ? ' draggable="true"' : '') + ' data-action="view-image" data-index="' + (i+1) +
        '" aria-label="Xem ảnh ' + (i+2) + '">' + images([image],!editing) + '</button>').join('') + '</div>' : '') + choose + '<button type="button" class="image-detail" data-action="cell-menu" aria-label="' + label + '" title="Tuỳ chọn ô ảnh">⋯</button>' +
    (removable ? '<button class="remove-pa" data-action="remove-pa" aria-label="Xoá PA trống">×</button>' : '') + content + '</div>';
}
function _oldImageCell_disabled() {
  const hasImage = list.length > 0;
  const photo = hasImage ? '<button class="image-open" data-action="view-image" aria-label="Xem ảnh lớn">' +
    images(list.slice(0,1),!editing) + '</button>' : '';
  const label = slot === 'render' ? 'Chi tiết phối cảnh 3D' : 'Chi tiết phương án ' + (slot+1);
  const isChosen = state === 'chosen';
  const choose = slot === 'render' ? '' : '<button type="button" class="image-pick' + (isChosen ? ' chosen' : '') + '" data-action="pick-pa" aria-label="' + (isChosen ? 'Bỏ chốt PA' : 'Chốt PA') + (slot+1) + '" aria-pressed="' + isChosen + '" title="' + (isChosen ? 'Phương án đã chốt · Bấm để bỏ chốt' : 'Chốt phương án') + '">' + (isChosen ? '✓ Đã chốt' : '✓') + '</button>'; //

  return '<div class="image-cell ' + state + (hasImage ? ' has-image' : '') + '" tabindex="0" data-slot="' + slot +
    '" aria-label="Ô ảnh · Ctrl+V để dán ảnh" title="Ctrl+V để dán ảnh hoặc kéo thả."><div class="image-preview">' + photo +
    (!hasImage ? '<div class="image-empty-hint">Bấm để chọn<br>·<br>Ctrl+V để dán</div>' : '') +
    (state === 'reserve' ? '<span class="image-state">Dự phòng</span>' : '') +


    '</div>' + (list.length > 1 ? '<div class="material-image-thumbs">' +
      list.slice(1).map((image,i) => '<button class="material-image-thumb"' + (editing ? ' draggable="true"' : '') + ' data-action="view-image" data-index="' + (i+1) +
        '" aria-label="Xem ảnh ' + (i+2) + '">' + images([image],!editing) + '</button>').join('') + '</div>' : '') + choose + '<button type="button" class="image-detail" data-action="cell-menu" aria-label="' + label + '" title="Tuỳ chọn ô ảnh">⋯</button>' +
    (removable ? '<button class="remove-pa" data-action="remove-pa" aria-label="Xoá PA trống">×</button>' : '') + content + '</div>';
}


const materialDialogFields = {note:'Ghi chú',spec:'Quy cách',room:'Vị trí',supplier:'NCC'};
function materialSuggestionCell(key,field,editing) {
  const label = materialDialogFields[key];
  return editing ? '<div class="material-suggestion-cell">' + field +
    '<button type="button" data-action="clear-suggestion" aria-label="Xóa nhanh ' + label + '" title="Xóa nhanh ' +
    label + '">✕</button></div>' : field;
}
function materialTextField(key,value,label) {
  return '<textarea rows="1" data-field="' + key + '" aria-label="' + label + '" placeholder="' + label +
    '" maxlength="' + (key === 'note' ? 2000 : 500) + '">' + html(value) + '</textarea>';
}

function renderRow(row,columns,number,editing) {
  const chosen = row.options[row.chosen];
  const count = rowPaCount(row);
  const unit = input('unit',displayMaterialUnit(row.unit),'Đơn vị');
  const quantity = input('qty',row.qty,'Khối lượng');
  const combineUnit = !columns.some(([key]) => key === 'unit');
  const cells = {
    select:'<label class="material-row-number"><input type="checkbox" data-select-row="' + html(row.id) + '" aria-label="Chọn ' + html(row.name || 'dòng') + '"><span>' + number + '</span></label>',
    name:input('name',row.name,'Hạng mục'),
    room:materialSuggestionCell('room',input('room',row.room,'Vị trí'),editing),
    render:imageCell(row.render,'render','','',false,editing),
    spec:materialSuggestionCell('spec',materialTextField('spec',chosen?.finish || row.spec,'Quy cách'),editing),
    qty:combineUnit ? (editing ? '<div class="material-quantity-combined">' + quantity + unit + '</div>' :
      '<span class="sheet-value" data-field="qty">' + html(displayMaterialQuantity(row)) + '</span>') : quantity,
    unit,
    supplier:materialSuggestionCell('supplier',input('supplier',row.supplier,'NCC / Nhà thầu'),editing),
    note:materialSuggestionCell('note',materialTextField('note',row.note,'Ghi chú'),editing),
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
    const code = '<div class="pa-caption">' + materialTextField('code',pa.code,'Mã PA' + (i+1)) +
      (detail ? '<small title="' + html(detail) + '"> · ' + html(detail) + '</small>' : '') + '</div>';
    const canRemove = i > 0 && i === count-1 && !paHasData(pa) && row.chosen !== i;
    cells[key] = imageCell(pa.images,i,code,row.chosen === i ? 'chosen' : row.chosen != null ? 'reserve' : '',canRemove,editing,pa);
  }
  return '<tr data-row="' + html(row.id) + '">' + columns.map(([key]) => '<td data-column="' + key + '"' + materialColumnClass(key,editing) + '>' + cells[key] + '</td>').join('') + '</tr>';
}
