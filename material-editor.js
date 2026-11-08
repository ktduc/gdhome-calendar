let sheet, before = [], after = [], saveTimer, saving = false, dirty = false, conflict = false;
let density = 'm';
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
let materialToast;
function say(message) {
  byId('notice').textContent = message;
  if (message && sheet) GDHomeShell.toast(message,materialToast ||= byId('material-toast'));
}

function showImages(root = box()) {
  return Promise.all([...root.querySelectorAll('img[data-asset]')].map(async img => {
    try {
      const name = img.dataset.asset;
      if (!assetCache.has(name)) assetCache.set(name,readMaterialAsset(name).then(URL.createObjectURL)
        .catch(error => { assetCache.delete(name); throw error; }));
      img.src = await assetCache.get(name);
      await decodeMaterialThumbnail(img);
    } catch { img.alt = 'Ảnh chưa tải được'; }
  }));
}

async function readMaterialAsset(name) {
  if (materialGuest) return guestMaterialAsset(name);
  const response = await fetch('/api/materials/assets/' + name,{headers:authHeaders()});
  if (!response.ok) throw new Error('Không mở được ảnh.');
  return response.blob();
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
  if (byId('save-label')) byId('save-label').hidden = true;
  const query = new URLSearchParams(location.search);
  const requested = selectedProject || byId('project-filter')?.value || query.get('project') || materialView.projectId;
  const projectId = materials.projects.some(p => p.id === requested) ? requested : materials.projects[0]?.id;
  box().innerHTML = '<div class="panel"><label>Dự án <select id="project-filter">' + materials.projects.map(p => option(p.id,p.name,projectId)).join('') +
    '</select></label> <a class="button" href="/du-an?project=' + encodeURIComponent(projectId || '') + '" title="Mở Hồ sơ dự án & Soát bản vẽ">📁 Hồ sơ dự án</a> <button class="primary" data-action="new">Tạo từ mẫu</button> <button data-action="copy">Sao chép bảng</button> <span id="import-action"></span> <button data-action="notion">Lấy từ Notion</button> <span id="ai-actions"></span></div>' +
    materials.sheets.filter(s => s.projectId === projectId || !materials.projects.some(p => p.id === s.projectId)).map(s => '<article><button data-action="open" data-id="' + html(s.id) + '">' + html(s.title) + '</button> · ' + counts(s) + '</article>').join('') +
    (!materials.projects.length ? '<p>Tạo và lưu dự án trong Tiến độ trước.</p>' : '');
  box().insertAdjacentHTML('beforeend','<dialog id="material-dialog"></dialog>');
  byId('project-filter').onchange = event => {
    setMaterialView({projectId:event.target.value,sheetId:null});
    renderMaterialApp(event.target.value);
  };
  if (typeof installImport === 'function') installImport();
  installMaterialsAi();
}

function counts(current) {
  const rows = current.groups.flatMap(g => g.rows);
  return 'Đã chốt ' + rows.filter(r => r.chosen !== null && r.chosen !== undefined && r.decision !== 'changed').length + '/' + rows.length;
}

function setMembership(set,key,enabled) { if (enabled) set.add(key); else set.delete(key); }
async function leaveSheet(projectId = sheet.projectId) {
  await flushSave();
  if (dirty || saving) return renderEditor();
  sheet = null;
  setMaterialView({projectId,sheetId:null});
  renderMaterialApp(projectId);
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

let kpiFrame;
function scheduleKpiRefresh() {
  if (kpiFrame) return;
  kpiFrame = requestAnimationFrame(() => {
    kpiFrame = null;
    const count = byId('material-count');
    if (sheet && count) count.innerHTML = materialKpis();
  });
}

function setMaterialSaveStatus(state,detail) {
  const label = byId('save-label');
  if (!label) return;
  label.hidden = !sheet || (!materialServerReady && !materialGuest);
  const savedOnDevice = materialGuest && state !== 'error';
  GDHomeShell.saveStatus(label,savedOnDevice ? 'guest' : state,detail,state === 'saved' && !savedOnDevice ? 'Đã lưu' : undefined);
  const undoButton = document.querySelector('#material-header-actions [data-action="undo"]');
  if (undoButton) undoButton.disabled = !before.length;
}

function queueSave() {
  if (!materialServerReady && !materialGuest) return;
  dirty = true;
  clearTimeout(saveTimer);
  setMaterialSaveStatus(conflict ? 'conflict' : 'pending');
  scheduleKpiRefresh();
  saveTimer = setTimeout(flushSave, 550);
}

async function flushSave() {
  if ((!materialServerReady && !materialGuest) || saving || !dirty || conflict || !sheet) return;
  saving = true;
  setMaterialSaveStatus('saving');
  dirty = false;
  try {
    const result = materialGuest ? saveGuestMaterial(sheet) : await post('/api/materials',{_version:materials._version,sheet});
    materials._version = result._version;
    materials.library = result.library || materials.library;
    materials.presets = result.presets || materials.presets;
    if (result.profile) materials.profiles[sheet.projectId] = result.profile;
    if (!sheet.id) {
      sheet.id = result.sheet.id;
      setMaterialView({projectId:sheet.projectId,sheetId:sheet.id});
      saveMaterialGroupsView();
      setMaterialSheetView({room:sheetRoom,status:sheetStatus,viewAsPrint});
      const selector = byId('editor-sheet');
      if (selector?.options[0]) { selector.options[0].value = sheet.id; selector.options[0].textContent = sheet.title; }
    }
    const index = materials.sheets.findIndex(s => s.id === sheet.id);
    if (index < 0) materials.sheets.push(result.sheet);
    else materials.sheets[index] = result.sheet;
    saveToolsSnapshot();
    setMaterialSaveStatus(dirty ? 'pending' : 'saved');
    say('');
  } catch (error) {
    dirty = true;
    conflict = error.status === 409;
    setMaterialSaveStatus(conflict ? 'conflict' : 'error',error.message);
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
  restoreMaterialSheetView(sheet);
  if (sheet.id) setMaterialView({projectId:sheet.projectId,sheetId:sheet.id});
  before = [];
  after = [];

  renderEditor();
}

function createSheet(projectId, title, groups, meta = {}) {
  if (!projectId) return say('Chọn dự án Tiến độ trước.');
  const date = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  openSheet({ projectId,title,meta:{ project:materials.projects.find(p => p.id === projectId)?.name,date,...meta },groups });
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
  return GDHomeShell.dialog(byId('material-dialog'),markup);
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
      if (button.dataset.detail === 'crop') return await cropImage(row,slot,i,element,reopen);
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
    if (row && event.target.matches('[data-field="note"]')) return openMaterialNotes(event.target,group,row);
    const cell = event.target.closest('.image-cell');
    if (row && cell && !event.target.closest('input,select,textarea,a')) focusMaterialImageCell(cell);
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
      case 'project-profile':
        GDHomeProjects.open({...sheet.meta},patch => saveMaterialProfile(patch));
        break;
      case 'back': await leaveSheet(); break;
      case 'add-pa': modify(() => { row.paCount = Math.min(3,rowPaCount(row)+1); }); break;
      case 'remove-pa': modify(() => { row.paCount = Number(slot); }); break;
      case 'jump-group': {
        hiddenGroups.delete(button.dataset.id);
        collapsed.delete(button.dataset.id);
        saveMaterialGroupsView();
        renderEditor();
        cancelAnimationFrame(restoreViewFrame);
        box().querySelector('[data-group="' + button.dataset.id + '"]')?.scrollIntoView({block:'start'});
        break;
      }

      case 'fold':
        setMembership(collapsed,group.id,!collapsed.has(group.id));
        saveMaterialGroupsView();
        renderEditor();
        break;
      case 'density': density = button.dataset.id; setMaterialView({density}); renderEditor(); break;
      case 'image-fit': setMaterialView({imageFit:button.dataset.id}); renderEditor(); break;
      case 'font-weight': setMaterialView({fontWeight:button.dataset.id}); renderEditor(); break;
      case 'print-column': {
        const key = button.dataset.id;
        savePrintColumns(printableColumns().filter(([id]) => id === key ? !columnPrints(id) : columnPrints(id)).map(([id]) => id));
        renderEditor();
        break;
      }
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
      case 'view-image': openMaterialLightbox(row,slot); break;
      case 'pick-pa': pick(row,slot); break;
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
  if (!row && !group && projectFields.includes(key)) {
    saveMaterialProfile({[key]:value}).catch(error => { field.value = sheet?.meta?.[key] || ''; showError(error); });
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
  if (target.closest('dialog')) return;
  if (event.key === 'Escape') {
    if (GDHomeShell.closeMenus()) { event.preventDefault(); return; }
    if (viewAsPrint && byId('material-print-view')) { byId('material-print-view').click(); event.preventDefault(); return; }
  }
  if (!sheet || (!target.closest('#materials,#material-header-actions') && target !== document.body)) return;
  if (!viewAsPrint && handleRowSelectionKey(event)) return;
  const {group,row,slot} = context(target);
  if (event.ctrlKey && ['z','y','d'].includes(event.key.toLowerCase())) {
    event.preventDefault();
    if (event.key.toLowerCase() === 'd') {
      if (row) modify(() => group.rows.splice(group.rows.indexOf(row)+1,0,duplicate(row)));
    } else undo(event.key.toLowerCase() === 'y');
    return;
  }
  if (!row) return;
  if (event.altKey && event.key === 'ArrowDown' && target.matches('[data-field="note"]')) {
    event.preventDefault();
    return openMaterialNotes(target,group,row);
  }
  if (event.key === 'Enter' && target.matches('button,select,input[type=checkbox]')) return;

  const cell = target.closest('td');
  if (!cell) return;
  if (event.key === 'Enter' && target.matches('textarea') && !event.ctrlKey) return;
  if (event.key === 'Escape') { if (target.matches('input,textarea')) {
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
  const control = next?.querySelector('.pa-caption input') || next?.querySelector('input,textarea,select,[tabindex],button');
  if (control) { event.preventDefault(); control.focus(); if (control.matches('input:not([type=checkbox])')) control.select?.(); }
});

window.addEventListener('beforeunload', event => { if (dirty || saving) { event.preventDefault(); event.returnValue = ''; } });
