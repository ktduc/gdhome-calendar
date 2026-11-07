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

function renderMaterialApp() {
  if (sheet) return renderEditor();
  const query = new URLSearchParams(location.search);
  const requested = byId('project-filter')?.value || query.get('project');
  const projectId = materials.projects.some(p => p.id === requested) ? requested : materials.projects[0]?.id;
  box().innerHTML = '<div class="panel"><label>Dự án <select id="project-filter">' + materials.projects.map(p => option(p.id,p.name,projectId)).join('') +
    '</select></label> <button class="primary" data-action="new">Tạo từ mẫu</button> <button data-action="copy">Sao chép bảng</button> <span id="import-action"></span></div>' +
    materials.sheets.filter(s => s.projectId === projectId || !materials.projects.some(p => p.id === s.projectId)).map(s => '<article><button data-action="open" data-id="' + html(s.id) + '">' + html(s.title) + '</button> · ' + counts(s) + '</article>').join('') +
    (!materials.projects.length ? '<p>Tạo và lưu dự án trong Tiến độ trước.</p>' : '');
  byId('project-filter').onchange = () => renderMaterialApp();
  if (typeof installImport === 'function') installImport();
}

function counts(current) {
  const rows = current.groups.flatMap(g => g.rows);
  return 'Đã chốt ' + rows.filter(r => r.chosen !== null && r.chosen !== undefined && r.decision !== 'changed').length + '/' + rows.length;
}

function renderEditor() {
  const meta = sheet.meta || {};
  box().innerHTML = '<div class="panel" id="material-meta"><div class="toolbar"><button data-action="back">← Danh sách</button>' +
    '<button data-action="undo">Hoàn tác</button><button data-action="redo">Làm lại</button><button data-action="density">' +
    ({ gon:'Gọn', vua:'Vừa', lon:'Ảnh lớn' })[density] + '</button><label>Phòng <select id="room-filter"><option value="">Tất cả</option>' +
    [...new Set(sheet.groups.flatMap(g => g.rows.map(r => r.room)).filter(Boolean))].map(r => option(r,r,sheetRoom)).join('') +
    '</select></label><strong id="material-count">' + counts(sheet) + '</strong><span id="save-label">' + (conflict?'Xung đột':dirty?'Chờ lưu':saving?'Đang lưu':'Đã lưu') +
    '</span><span id="release-actions"></span></div><div class="toolbar">' + input('title',sheet.title,'Tên bảng') +
    [['customer','Kính gửi'],['address','Địa chỉ'],['project','Dự án'],['phone','SĐT'],['email','Email'],['date','Ngày'],['number','Số'],['contract','Hợp đồng']].map(([key,label]) => input(key,meta[key],label)).join('') +
    '</div>' + (materials.r2 ? '' : '<p class="asset-warning">Chưa bật kho ảnh · Đang dùng thư mục ảnh tạm trên máy chủ.</p>') + '</div>' +
    '<div class="sheet-scroll density-' + density + '"><table class="sheet-grid"><thead><tr>' +
    ['Hạng mục','Vị trí','Phối cảnh 3D','Chất liệu / Quy cách','Phương án 1','Phương án 2','Phương án 3','Khối lượng','Đơn vị','NCC / Nhà thầu','Ghi chú','Trạng thái',''].map(t => '<th>' + t + '</th>').join('') +
    '</tr></thead>' + sheet.groups.map(renderGroup).join('') + '</table></div><button data-action="add-group">＋ Thêm nhóm</button><dialog id="material-dialog"></dialog>';
  showImages();
  byId('room-filter').onchange = event => { sheetRoom = event.target.value; renderEditor(); };
  if (typeof installRelease === 'function') installRelease();
}

let sheetRoom = '';
const collapsed = new Set();
function renderGroup(group) {
  return '<tbody data-group="' + html(group.id) + '"><tr class="group"><th colspan="13"><button data-action="fold">' + (collapsed.has(group.id) ? '▸' : '▾') + '</button> ' +
    input('groupName',group.name,'Nhóm') + ' <label>Hạn <input type="date" data-field="due" value="' + html(group.due) + '"></label> ' +
    (typeof scheduleControls === 'function' ? scheduleControls(group) : '') + ' <button data-action="del-group">Bỏ nhóm</button></th></tr>' +
    (collapsed.has(group.id) ? '' : group.rows.filter(r => !sheetRoom || r.room === sheetRoom).map(renderRow).join('') + '<tr><td colspan="13"><button data-action="add-row">＋ Dòng</button></td></tr>') + '</tbody>';
}

function renderRow(row) {
  const chosen = row.options[row.chosen];
  return '<tr data-row="' + html(row.id) + '"><td>' + input('name',row.name,'Hạng mục') + '</td><td>' + input('room',row.room,'Vị trí') +
    '</td><td><div class="image-cell" tabindex="0" data-slot="render">' + (images(row.render) || '＋ Dán ảnh 3D') + '<button data-action="detail">⋯</button></div></td><td>' +
    input('spec',chosen?.finish || row.spec,'Quy cách') + '</td>' +
    row.options.map((pa,i) => '<td><div class="image-cell' + (row.chosen === i ? ' chosen' : row.chosen != null ? ' reserve' : '') +
      '" tabindex="0" data-slot="' + i + '" title="Bấm ảnh để chốt, Ctrl+V để dán ảnh">' + (images(pa.images) || '<span>＋ Ảnh</span>') +
      '<div>' + html([pa.color,pa.code,pa.size].filter(Boolean).join(' · ')) + '</div>' +
      (row.chosen === i ? '<strong>✓ Đã chọn</strong>' : row.chosen != null ? '<small>Dự phòng</small>' : '') + ' <button data-action="detail" aria-label="Chi tiết phương án">⋯</button></div></td>').join('') +
    '<td>' + input('qty',row.qty,'Khối lượng') + '</td><td>' + input('unit',row.unit,'Đơn vị') + '</td><td>' + input('supplier',row.supplier,'NCC / Nhà thầu') +
    '</td><td>' + input('note',row.note,'Ghi chú') + '</td><td><select data-field="decision" aria-label="Trạng thái">' +
    Object.entries(statusLabels).map(([key,label]) => option(key,label,row.ordered?'ordered':row.decision)).join('') +
    option('ordered','Đã đặt hàng',row.ordered?'ordered':row.decision) + '</select></td><td><button data-action="duplicate" title="Nhân bản dòng">⧉</button> <button data-action="del-row" title="Bỏ dòng">×</button></td></tr>';
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
  if (byId('material-count')) byId('material-count').textContent = counts(sheet);
  saveTimer = setTimeout(flushSave, 550);
}

async function flushSave() {
  if (saving || !dirty || conflict || !sheet) return;
  saving = true;
  dirty = false;
  try {
    const result = await post('/api/materials', { _version:materials._version, sheet });
    materials._version = result._version;
    materials.library = result.library || materials.library;
    materials.presets = result.presets || materials.presets;
    if (!sheet.id) sheet.id = result.sheet.id;
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

function openSheet(value) {
  sheet = structuredClone(value);
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
  element.addEventListener('change', async event => {
    const key = event.target.dataset.field;
    try {
      if (key && pa) {
        if (event.target.dataset.libraryApplied) { delete event.target.dataset.libraryApplied; return; }
        modify(() => { pa[key] = event.target.value; learnPreset(key,pa[key]); }, false);
      }
      if (event.target.dataset.detail === 'upload') { await attachImages(row,slot,event.target.files); reopen(); }
    } catch (error) { showError(error); }
  }, { once:false, signal:detailSignal(element) });
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
  field.onblur = () => setTimeout(() => menu?.remove(),120);
}

document.addEventListener('click', async event => {
  if (!event.target.closest('#materials')) return;
  const button = event.target.closest('[data-action]');
  const {group,row,slot} = context(event.target);
  if (!button) {
    if (row && slot && slot !== 'render' && event.target.closest('.image-cell') && row.options[Number(slot)].images.length) pick(row,slot);
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
      case 'back':
        await flushSave();
        if (!dirty && !saving) { sheet = null; renderMaterialApp(); }
        break;
      case 'density': density = ({ gon:'vua', vua:'lon', lon:'gon' })[density]; renderEditor(); break;
      case 'fold': if (collapsed.has(group.id)) collapsed.delete(group.id); else collapsed.add(group.id); renderEditor(); break;
      case 'add-group': modify(() => sheet.groups.push(newGroup('Nhóm mới'))); break;
      case 'del-group': if (confirm('Bỏ nhóm và các dòng khỏi bản nháp?')) modify(() => sheet.groups.splice(sheet.groups.indexOf(group),1)); break;
      case 'add-row': modify(() => group.rows.push(newRow())); break;
      case 'del-row': if (confirm('Bỏ dòng khỏi bản nháp?')) modify(() => group.rows.splice(group.rows.indexOf(row),1)); break;
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
  if (!sheet || !key || !field.closest('#materials') || field.closest('dialog')) return;
  const {group,row} = context(field);
  const value = field.value;
  modify(() => {
    if (row && key === 'decision') {
      if (['ordered','chosen'].includes(value) && row.chosen == null) {
        field.value = row.decision;
        say('Chọn PA trước khi chốt hoặc đặt hàng.');
        return;
      }
      row.ordered = value === 'ordered';
      row.decision = row.ordered ? 'chosen' : value;
      if (['draft','sent'].includes(value)) row.chosen = null;
    } else if (row && key === 'spec' && row.chosen != null) row.options[row.chosen].finish = value;
    else if (row) { row[key] = value; learnPreset(key,value); }
    else if (group) group[key === 'groupName' ? 'name' : key] = value;
    else if (key === 'title') sheet.title = value;
    else (sheet.meta ||= {})[key] = value;
  },!!group && !row && ['taskId','leadDays','dayMode','due'].includes(key));
});

document.addEventListener('focusin', event => {
  if (sheet && event.target.closest('.sheet-grid') && event.target.matches('input')) suggestions(event.target);
});
document.addEventListener('input', event => {
  if (sheet && event.target.closest('.sheet-grid') && event.target.matches('input')) suggestions(event.target);
});

document.addEventListener('keydown', event => {
  const target = event.target;
  if (!sheet || !target.closest('#materials') || target.closest('dialog')) return;
  const {group,row,slot} = context(target);
  if (event.ctrlKey && ['z','y','d'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    if (event.key.toLowerCase() === 'd') {
      if (row) modify(() => group.rows.splice(group.rows.indexOf(row)+1,0,duplicate(row)));
    } else undo(event.key.toLowerCase() === 'y');
    return;
  }
  if (!row) return;
  if (slot != null && event.key === ' ' && slot !== 'render') { event.preventDefault(); pick(row,slot); return; }
  const cell = target.closest('td');
  if (!cell) return;
  if (event.key === 'Escape') { if (target.tagName === 'INPUT') target.value = target.defaultValue; target.blur(); return; }
  const rows = [...box().querySelectorAll('tr[data-row]')];
  const index = rows.indexOf(cell.parentElement);
  const col = cell.cellIndex;
  let next;
  if (['ArrowUp','ArrowDown','Enter'].includes(event.key)) next = rows[index + (event.key === 'ArrowUp' || event.shiftKey ? -1 : 1)]?.cells[col];
  if (['Tab','ArrowLeft','ArrowRight'].includes(event.key)) {
    const direction = event.key === 'ArrowLeft' || event.shiftKey ? -1 : 1;
    next = cell.parentElement.cells[col+direction] || rows[index+direction]?.cells[direction > 0 ? 0 : rows[index+direction].cells.length-1];
  }
  const control = next?.querySelector('input,select,[tabindex],button');
  if (control) { event.preventDefault(); control.focus(); control.select?.(); }
});

window.addEventListener('beforeunload', event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } });
