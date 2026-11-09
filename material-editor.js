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
  // config có thể chưa tải xong khi bảng hiện từ bản lưu trên máy (máy chủ chậm): vẫn gửi phiên đăng nhập nếu có.
  const mode = typeof config === 'undefined' ? undefined : config?.authMode;
  if (mode === 'password') return { 'x-app-key':localStorage.getItem(passwordKey) || '' };
  const token = session()?.token;
  return token && (mode === 'google' || !mode) ? { Authorization:'Bearer ' + token } : {};
}

function images(list, large = false) {
  return (list || []).map(image => {
    const name = typeof image === 'string' ? image : (large ? image.full : image.thumb);
    const view = typeof image === 'object' && window.GDHomeAssets ? GDHomeAssets.viewStyle(image.view) : '';
    return GDHomeImages.isAssetName(name) ? '<img data-asset="' + name + '" alt="Ảnh vật liệu"' + view + '>' : '';
  }).join('');
}

function materialSheetRemoveLabel(current) {
  return materials.publishedSheetIds?.includes(current.id) ? 'Lưu trữ bảng' : 'Xoá bảng';
}

function renderMaterialApp(selectedProject) {
  if (sheet) return renderEditor();
  byId('material-header-actions').replaceChildren();
  if (byId('save-label')) byId('save-label').hidden = true;
  const query = new URLSearchParams(location.search);
  const requested = selectedProject || byId('project-filter')?.value || query.get('project') || materialView.projectId;
  const projectId = materials.projects.some(p => p.id === requested) ? requested : materials.projects[0]?.id;
  const inProject = item => item.projectId === projectId || !materials.projects.some(p => p.id === item.projectId);
  const archived = (materials.archivedSheets || []).filter(inProject).sort((a,b) => b.archivedAt-a.archivedAt);
  box().innerHTML = '<div class="panel"><label>Dự án <select id="project-filter">' + materials.projects.map(p => option(p.id,p.name,projectId)).join('') +
    '</select></label> <a class="button" href="/du-an?project=' + encodeURIComponent(projectId || '') + '" title="Mở Hồ sơ dự án & Soát bản vẽ">📁 Hồ sơ dự án</a> <button class="primary" data-action="new">Tạo từ mẫu</button> <button data-action="copy">Sao chép bảng</button> <span id="import-action"></span> <button data-action="notion">Lấy từ Notion</button> <span id="ai-actions"></span></div>' +
    materials.sheets.filter(inProject).map(item => '<article class="material-sheet-list-item"><button data-action="open" data-id="' +
      html(item.id) + '">' + html(item.title) + '</button> <span>' + counts(item) + '</span><button data-action="remove-sheet" data-id="' +
      html(item.id) + '">' + materialSheetRemoveLabel(item) + '</button></article>').join('') +
    (archived.length ? '<details class="panel" id="material-archive"><summary>Đã lưu trữ (' + archived.length + ')</summary>' +
      archived.map(item => '<article class="material-sheet-list-item"><strong>' + html(item.title) + '</strong><small>' +
        html(vnDate(item.archivedAt)) + '</small><button data-action="archived-history" data-id="' + html(item.id) +
        '">Biên bản / Lịch sử</button><button data-action="restore-sheet" data-id="' + html(item.id) +
        '">Khôi phục</button></article>').join('') + '</details>' : '') +

    (!materials.projects.length ? '<p>Tạo và lưu dự án trong Tiến độ trước.</p>' : '');
  box().insertAdjacentHTML('beforeend','<dialog id="material-dialog"></dialog>');
  byId('project-filter').onchange = event => {
    setMaterialView({projectId:event.target.value,sheetId:null});
    renderMaterialApp(event.target.value);
  };
  if (typeof installImport === 'function') installImport();
  installMaterialsAi();
}

const materialLifecyclePath = id => '/api/materials/sheets/' + encodeURIComponent(id) + '/lifecycle';
function finishMaterialLifecycle(target,result) {
  materials._version = result._version;
  if (result.archivedSheets) materials.archivedSheets = result.archivedSheets;
  if (result.publishedSheetIds) materials.publishedSheetIds = result.publishedSheetIds;
  materials.sheets = materials.sheets.filter(item => item.id !== target.id);
  if (result.sheet) materials.sheets.push(result.sheet);
  if (sheet?.id === target.id) sheet = null;
  setMaterialView({projectId:target.projectId,sheetId:null});
  saveToolsSnapshot();
  renderMaterialApp(target.projectId);
  say({deleted:'Đã xoá bản nháp.',archived:'Đã lưu trữ bảng. Có thể xem biên bản hoặc khôi phục trong mục Đã lưu trữ.',
    restored:'Đã khôi phục bảng.'}[result.outcome]);
}

async function confirmMaterialSheetRemoval(id) {
  if (sheet) {
    await flushSave();
    if (dirty || saving || conflict) throw new Error('Cần lưu bảng trước khi xoá hoặc lưu trữ.');
    id = sheet.id;
  }
  const target = materials.sheets.find(item => item.id === id);
  if (!target) return;
  const version = materials._version;
  const label = materialSheetRemoveLabel(target);
  const archived = label === 'Lưu trữ bảng';
  const element = dialog('<h2>' + label + '</h2><p>' + (archived ?
    'Bảng đã phát hành sẽ chuyển vào mục Đã lưu trữ. Biên bản và link khách được giữ lại.' :
    'Bản nháp sẽ bị xoá vĩnh viễn.') + '</p><form id="material-lifecycle-form" class="stack">' +
    '<p><strong>' + html(target.title) + '</strong></p><label>Gõ đúng tên bảng <input name="confirmation" autocomplete="off" autofocus required></label>' +
    '<p role="status"></p><button class="primary" disabled>' + label + '</button></form>');
  const form = byId('material-lifecycle-form');
  const confirmation = form.elements.confirmation;
  const submit = form.querySelector('button');
  const close = element.querySelector('.close-dialog');
  const status = form.querySelector('[role=status]');
  let busy = false;
  const matches = () => confirmation.value.trim() === target.title.trim();
  form.oninput = () => { submit.disabled = !matches() || busy; };
  const blockCancel = event => { if (busy) event.preventDefault(); };
  element.addEventListener('cancel',blockCancel);
  element.addEventListener('close',() => element.removeEventListener('cancel',blockCancel),{once:true});
  form.onsubmit = async event => {
    event.preventDefault();
    if (!matches() || busy) return;
    busy = submit.disabled = close.disabled = confirmation.disabled = true;
    status.textContent = 'Đang xử lý…';
    try {
      const result = materialGuest ? deleteGuestMaterial(id) :
        await post(materialLifecyclePath(id),{action:'remove',title:confirmation.value,_version:version});
      element.close();
      finishMaterialLifecycle(target,result);
    } catch (error) {
      status.textContent = error.message + (error.status === 409 ? ' Tải lại trang trước khi thử lại.' : '');
    } finally {
      busy = close.disabled = confirmation.disabled = false;
      submit.disabled = !matches();
    }
  };
}

async function restoreMaterialSheet(button) {
  const target = materials.archivedSheets?.find(item => item.id === button.dataset.id);
  if (!target) return;
  button.disabled = true;
  try {
    const result = await post(materialLifecyclePath(target.id),{action:'restore',_version:materials._version});
    finishMaterialLifecycle(target,result);
  } finally { button.disabled = false; }
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

let materialEditRevision = 0, pendingMaterialDeletion;
function modify(change, render = true, recoverDeletion = false) {
  const snapshot = structuredClone(sheet);
  const earlierDeletion = recoverDeletion && pendingMaterialDeletion?.sheet === sheet ? pendingMaterialDeletion : null;
  before.push(snapshot);
  if (before.length > 50) before.shift();
  after = [];
  change();
  queueSave();
  if (recoverDeletion) pendingMaterialDeletion = {sheet,snapshot:earlierDeletion?.snapshot || snapshot,
    revision:materialEditRevision,undoEntries:Math.min((earlierDeletion?.undoEntries || 0)+1,before.length)};
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
  materialEditRevision++;
  pendingMaterialDeletion = null;
  dirty = true;
  clearTimeout(saveTimer);
  setMaterialSaveStatus(conflict ? 'conflict' : 'pending');
  scheduleKpiRefresh();
  saveTimer = setTimeout(flushSave, 550);
}

async function flushSave() {
  if ((!materialServerReady && !materialGuest) || saving || !dirty || conflict || !sheet) return;
  const deletion = pendingMaterialDeletion;
  pendingMaterialDeletion = null;
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
      setMaterialSheetView({room:sheetRoom,status:sheetStatus,viewAsPrint,onlyUnlinked:onlyUnlinkedGroups});
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
    // A rejected deletion can be reverted if no newer edit depends on its state.
    const restore = deletion && deletion.sheet === sheet && deletion.revision === materialEditRevision;
    if (restore) {
      deletion.snapshot.id ||= sheet.id;
      sheet = deletion.snapshot;
      before.splice(-deletion.undoEntries);
      renderEditor();
    }
    setMaterialSaveStatus(conflict ? 'conflict' : 'error',error.message);
    say((restore ? 'Đã khôi phục mục vừa xoá. ' : '') + error.message + (conflict ? ' Có thể sao lưu bản nháp bằng nút bên dưới.' : ' Bấm “Lưu lại” để thử lại.'));
    const button = document.createElement('button');
    button.textContent = conflict ? 'Tải bản nháp JSON' : 'Lưu lại';
    button.onclick = () => conflict ? saveDraft() : flushSave();
    byId('notice').append(' ',button);
    return;
  } finally { saving = false; }
  if (dirty) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(flushSave,550);
  }
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
  const links = materialServerReady ? materialTaskUpdates(sheet) : [];
  if (links.length) modify(() => applyMaterialTaskLinks(links));
  else renderEditor();
}

function versionedMaterialTitle(projectId,title,date) {
  const suffix = /(?:\s+\(bản sao\)|\s+-\s+V\d+(?:\s+\(\d{2}\/\d{2}\))?)+$/i;
  const baseTitle = value => value.trim().replace(suffix,'').trim().slice(0,178);
  const base = baseTitle(title) || 'Bảng chốt mã mới';
  const nameKey = value => value.normalize('NFC').toLocaleLowerCase('vi').replace(/\s+/g,' ');
  const related = [...materials.sheets,...(materials.archivedSheets || [])]
    .filter(item => item.projectId === projectId && nameKey(baseTitle(item.title)) === nameKey(base));
  const names = new Set(related.map(item => nameKey(item.title)));
  const [,month,day] = date.split('-');
  for (let version = related.length + 1;;version++) {
    const proposed = base + ' - V' + version;
    if (!names.has(nameKey(proposed))) return proposed;
    const dated = proposed + ' (' + day + '/' + month + ')';
    if (!names.has(nameKey(dated))) return dated;
  }
}

function createSheet(projectId, title, groups, meta = {}) {
  if (!projectId) return say('Chọn dự án Tiến độ trước.');
  const date = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date());
  openSheet({ projectId,title:versionedMaterialTitle(projectId,title,date),meta:{ project:materials.projects.find(p => p.id === projectId)?.name,date,...meta },groups });
  queueSave();
}

function duplicate(row) {
  return { ...structuredClone(row), id:uid(), chosen:null, decision:'draft', ordered:false };
}

function pick(row, slot) {
  const i = Number(slot);
  if (slot === 'render' || !row.options[i]) return;
  const pa = row.options[i];
  if (row.chosen === i) {
    modify(() => { row.chosen = null; row.decision = 'draft'; });
    return;
  }
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
    '"><div class="toolbar">' + (pa ? fields.map(k => input(k,pa[k],labels[k])).join('') + (row.chosen === Number(slot) ? '<button data-detail="pick" class="danger">✕ Bỏ chốt PA</button>' : '<button data-detail="pick">✓ Chốt PA</button>') : '') +
    '</div><label>Thêm ảnh <input type="file" accept="image/*" multiple data-detail="upload"></label><div class="detail-images">' +
    list.map((image,i) => '<article>' + images([image],true) + '<button data-detail="left" data-index="' + i + '">←</button> <button data-detail="crop" data-index="' +
      i + '">Vùng nhìn</button> <button data-detail="remove" data-index="' + i + '">Xóa</button></article>').join('') + '</div></div>');
  showImages(element);
  element.onclose = () => { if (!element.open && sheet && element.isConnected) renderEditor(); };
  const signal = detailSignal();
  let editedField;
  element.addEventListener('input', event => {
    const key = event.target.dataset.field;
    if (!key || !pa || pa[key] === event.target.value) return;
    const apply = () => { pa[key] = event.target.value; if (key === 'code') pa.autoName = false; };
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
      if (button.dataset.detail === 'remove') modify(() => removeMaterialImage(list,i,pa),true,true);
      if (button.dataset.detail === 'left' && i > 0) modify(() => { [list[i-1],list[i]] = [list[i],list[i-1]]; },false);
      if (button.dataset.detail === 'crop') {
        const view = await GDHomeAssets.editView(list[i]);
        if (view) modify(() => { setImageView(list,i,view); },false);
        return reopen();
      }
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

let menu, suggestionAnchor, positionSuggestionMenu;
document.addEventListener('pointerdown',event => {
  if (menu?.isConnected && event.target !== suggestionAnchor && !menu.contains(event.target)) menu.remove();
},true);
window.addEventListener('scroll',event => {
  if (menu?.isConnected && !menu.contains(event.target)) positionSuggestionMenu?.();
},true);
function suggestions(field,pa,refresh = false) {
  menu?.remove();
  const key = materialSuggestionField(field.dataset.field);
  if (!materialSuggestionFields.has(key) || key === 'note' || (!pa && key === 'spec')) return;
  const rowContext = context(field);
  const row = rowContext.row || (pa ? activeDetail?.row : undefined);
  const group = rowContext.group || (row && sheet.groups.find(group => group.rows.includes(row)));
  const query = normalized(field.value);
  const catalog = materialCustomChoices(key,group);
  const matches = value => normalized(value).includes(query) && !catalog.hidden.has(normalized(value));
  const presets = [...new Set([...(initialPresets[field.dataset.field] || []),...(materials.presets[field.dataset.field] || []),
    ...(sheet.presets?.[field.dataset.field] || []),...(key === 'name' ? materialTemplate.flatMap(([, ...names]) => names) : [])])].filter(matches);
  if (key === 'code' && !pa) pa = row?.options[Number(rowContext.slot)];
  const library = librarySuggestions(field.dataset.field,field.value.toLocaleLowerCase(),pa)
    .filter(choice => !catalog.hidden.has(normalized(choice.value)) && !catalog.keys.has(normalized(choice.value)));
  const apply = value => {
    field.value = value;
    field.dispatchEvent(new Event('change',{bubbles:true}));
  };
  const choices = [...catalog.items.filter(item => matches(item.value)).map(item => ({
    label:'★ ' + item.value,apply:() => { useMaterialSuggestion(key,item); apply(item.value); }
  })), ...library,...presets.filter(value => !catalog.keys.has(normalized(value))).map(value => ({label:value,apply:() => apply(value)}))].slice(0,9);
  menu = document.createElement('div');
  menu.className = 'suggestions';
  const currentMenu = menu;
  suggestionAnchor = field;
  choices.forEach((choice,i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = (choice.label.startsWith('★ ') ? '' : (i+1) + ' · ') + choice.label;
    button.onmousedown = event => event.preventDefault();
    button.onclick = () => { currentMenu.remove(); choice.apply(field); };
    currentMenu.append(button);
  });
  currentMenu.append(materialSuggestionActions(key,group,() => field.value,() => suggestions(field,pa,true)));
  (field.closest('dialog') || document.body).append(currentMenu);
  field.addEventListener('blur', () => { setTimeout(() => { if (!currentMenu.contains(document.activeElement)) currentMenu.remove(); }, 120); }, { once: true });
  const place = () => {
    if (!field.isConnected) { currentMenu.remove(); return; }
    const rect = field.getBoundingClientRect();
    if (rect.bottom < 0 || rect.top > innerHeight) { currentMenu.remove(); return; }
    const width = Math.min(innerWidth-16,Math.max(240,rect.width));
    currentMenu.style.width = width + 'px';
    currentMenu.style.left = Math.max(8,Math.min(rect.left,innerWidth-width-8)) + 'px';
    const below = innerHeight - rect.bottom - 8;
    const above = rect.top - 8;
    const useAbove = below < 210 && above > below;
    currentMenu.style.maxHeight = Math.max(64,Math.min(360,useAbove ? above : below)) + 'px';
    currentMenu.style.top = (useAbove ? rect.top-currentMenu.offsetHeight : rect.bottom) + 'px';
  };
  positionSuggestionMenu = place;
  place();
  field.onkeydown = event => {
    const number = Number(event.key);
    if (event.altKey && number > 0 && choices[number-1]) {
      event.preventDefault(); event.stopPropagation(); currentMenu.remove(); choices[number-1].apply(field);
    }
    if (event.key === 'Escape' && currentMenu.isConnected) {
      event.preventDefault(); event.stopPropagation(); currentMenu.remove();
    }
  };
  currentMenu.onkeydown = event => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation();
    currentMenu.remove();
  };
  field.onblur = event => { if (!currentMenu.contains(event.relatedTarget)) currentMenu.remove(); };
  currentMenu.onfocusout = event => {
    if (event.relatedTarget !== field && !currentMenu.contains(event.relatedTarget)) currentMenu.remove();
  };

  if (refresh && currentMenu.isConnected) currentMenu.querySelector('[data-suggestion-add]').focus({preventScroll:true});
}


document.addEventListener('click', async event => {
  if (!event.target.closest('#materials,#material-header-actions')) return;
  if (sheet && handleRowSelectionClick(event)) return;
  const button = event.target.closest('[data-action]');
  const {group,row,slot} = context(event.target);
  if (!button) {
    if (row && event.target.matches('.material-suggestion-cell [data-field]')) {
      return openMaterialSuggestions(event.target,group,row);
    }
    const cell = event.target.closest('.image-cell');
    if (row && cell && !event.target.closest('input,select,textarea,a')) {
      focusMaterialImageCell(cell);
      if (!cell.classList.contains('has-image') && !box().querySelector('.material-paper-output')) openAssetPicker(cell,row,group,slot);
    }
    return;
  }
  try {

    switch (button.dataset.action) {
      case 'open-paint': if (row && slot != null) openAssetPicker(button.closest('.image-cell'), row, group, slot); break;
      case 'open': openSheet(materials.sheets.find(s => s.id === button.dataset.id)); break;
      case 'remove-sheet':
        if (button.closest('.hdr-dropdown')) button.closest('.hdr-dropdown').open = false;
        await confirmMaterialSheetRemoval(button.dataset.id);
        break;
      case 'archived-history': {
        const current = materials.archivedSheets?.find(item => item.id === button.dataset.id);
        if (current) await historyDialog(current);
        break;
      }
      case 'restore-sheet': await restoreMaterialSheet(button); break;
      case 'new': createSheet(byId('project-filter').value,'Bảng chốt mã mới',makeTemplate()); break;
      case 'copy': {
        const options = materials.sheets.map((s,i) => (i+1) + '. ' + s.title).join('\n');
        const index = Number(prompt('Chọn số bảng nguồn:\n' + options)) - 1;
        const source = materials.sheets[index];
        if (source) createSheet(byId('project-filter').value,source.title,source.groups.map(g => ({
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
      case 'remove-pa': modify(() => { row.paCount = Number(slot); },true,true); break;
      case 'jump-group': {
        const destination = sheet.groups.find(group => group.id === button.dataset.id);
        if (onlyUnlinkedGroups && destination && linkedMaterialTask(destination)) {
          onlyUnlinkedGroups = false;
          setMaterialSheetView({onlyUnlinked:false});
        }
        hiddenGroups.delete(button.dataset.id);
        collapsed.delete(button.dataset.id);
        saveMaterialGroupsView();
        renderEditor();
        cancelAnimationFrame(restoreViewFrame);
        box().querySelector('[data-group="' + button.dataset.id + '"]')?.scrollIntoView({block:'start'});
        break;
      }

      case 'choose-group-task': {
        const picker = button.closest('tbody').querySelector('select[data-field="taskId"]');
        picker.focus({preventScroll:true});
        try { picker.showPicker?.(); } catch { /* Focus leaves the native dropdown ready for keyboard selection. */ }
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
      case 'reset-columns': setMaterialView({columnOrder:[]}); renderEditor(); break;
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
      case 'relink-tasks': await relinkMaterialTasks(button); break;
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
      case 'clear-suggestion': {
        const field = button.closest('.material-suggestion-cell').querySelector('[data-field]');
        saveMaterialSuggestionValue(field,'');
        break;
      }
      case 'cell-menu': openImageCellMenu(button,row,group,slot); break;
      case 'detail': editDetail(row,slot); break;
      case 'view-image': openMaterialLightbox(row,slot,Number(button.dataset.index || 0)); break;
      case 'pick-asset': {
        const cell = button.closest('.image-cell');
        focusMaterialImageCell(cell);
        openAssetPicker(cell,row,group,slot);
        break;
      }
      case 'toggle-asset-previews':
        setMaterialView({hideAssetPreviews:materialView.hideAssetPreviews === false});
        renderEditor();
        break;
      case 'upload-renders': await uploadProjectRenders(); break;
      case 'open-renders':
        GDHomeAssets.openRenders({projectId:sheet.projectId,projectName:materialProjectName(),onPick:pickedRenderForSelection()});
        break;
      case 'open-library': GDHomeAssets.openLibrary({categoryId:button.dataset.category,onPick:pickedLibraryForSelection()}); break;
      case 'render-strip': {
        const items = await GDHomeAssets.loadRenders(sheet.projectId);
        const item = items.find(entry => entry.id === button.dataset.id);
        const apply = pickedRenderForSelection();
        if (item && apply) apply(item);
        else if (item) window.open(await GDHomeAssets.assetUrl(item.full),'_blank');
        break;
      }
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

    } else if (row && key === 'spec' && row.chosen != null) {
      row.options[row.chosen].finish = value;
      if (!value) row.spec = '';
    } else if (row) { row[key] = value; learnPreset(key,value); }
    else if (group && key === 'taskId') {
      group.taskId = value;
      group.taskLinkMode = 'manual';
      delete group.taskLinkScore;
    } else if (group && key === 'groupName') {
      group.name = value;
      applyMaterialTaskLinks(materialTaskUpdates(sheet,[group],true));
    } else if (group) group[key] = value;
    else if (key === 'title') sheet.title = value;
    else (sheet.meta ||= {})[key] = value;
  },!!group && !row && ['taskId','groupName','leadDays','dayMode','due'].includes(key));
});

let editingCode;
function updateInlineCode(field, pa) {
  if (pa.code === field.value) return;
  const apply = () => { pa.code = field.value; pa.autoName = false; };
  if (editingCode === field) { apply(); queueSave(); }
  else modify(apply,false);
  editingCode = field;
}

document.addEventListener('focusout', event => {
  if (editingCode === event.target) editingCode = null;
});

document.addEventListener('focusin', event => {
  if (sheet && event.target.closest('.sheet-grid') && event.target.matches('input,textarea[data-field=code]')) suggestions(event.target);
});
document.addEventListener('input', event => {
  const field = event.target;
  if (!sheet || !field.closest('.sheet-grid') || !field.matches('input,textarea[data-field=code]')) return;
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
  if (event.altKey && event.key === 'ArrowDown' && target.matches('.material-suggestion-cell [data-field]')) {
    event.preventDefault();
    return openMaterialSuggestions(target,group,row);
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


// ---------------------------------------------------------------- Thư viện ảnh (phối cảnh 3D dự án + dữ liệu dùng chung)
function setImageView(list,index,view) {
  const item = list[index];
  if (!item) return;
  const entry = typeof item === 'string' ? {full:item,thumb:item} : {...item};
  if (!view || (view.x === 0.5 && view.y === 0.5 && view.z === 1)) delete entry.view;
  else entry.view = {x:view.x,y:view.y,z:view.z};
  list[index] = entry;
}
function materialProjectName() {
  return materials.projects.find(project => project.id === sheet?.projectId)?.name || sheet?.meta?.project || '';
}
function addPickedImage(row,slot,item,extra) {
  if (!item || !sheet?.groups.some(group => group.rows.includes(row))) return;
  const list = slot === 'render' ? row.render : row.options[Number(slot)]?.images;
  if (!list) return;
  if (list.some(image => (typeof image === 'string' ? image : image.full) === item.full)) return say('Ảnh đã có trong ô.');
  if (list.length >= 8) return say('Mỗi ô tối đa 8 ảnh.');
  modify(() => {
    list.push({full:item.full,thumb:item.thumb});
    extra?.();
  });
}
function selectedCellTarget(kind) {
  const selected = selectedImageCell;
  if (!selected || selected.sheetId !== sheet?.id) return null;
  const isRender = selected.slot === 'render';
  if ((kind === 'render') !== isRender) return null;
  for (const group of sheet.groups) {
    const row = group.rows.find(entry => entry.id === selected.rowId);
    if (row) return {group,row,slot:selected.slot};
  }
  return null;
}
function pickedRenderForSelection() {
  const target = selectedCellTarget('render');
  return target ? item => addPickedImage(target.row,'render',item) : null;
}
function pickedLibraryForSelection() {
  const target = selectedCellTarget('library');
  return target ? item => libraryPicked(target.row,target.slot,item) : null;
}
function removeMaterialImage(list,index,pa) {
  const [image] = list.splice(index,1);
  if (!image || !pa?.code || pa.autoName === false) return;
  const full = typeof image === 'string' ? image : image.full;
  const autoFilled = pa.autoNameAsset ? pa.autoNameAsset === full :
    (pa.autoName === true && !list.length) || GDHomeAssets.libraryItemMatches(full,pa.code);
  if (!autoFilled) return;
  pa.code = '';
  delete pa.autoName;
  delete pa.autoNameAsset;
  if (pa.autoColor === pa.color) pa.color = '';
  delete pa.autoColor;
}
function libraryPicked(row,slot,item) {
  if (item.kind === 'paint') return paintPicked(row,slot,item);
  if (item.kind === 'wood') return woodPicked(row,slot,item);
  const pa = row.options[Number(slot)];
  addPickedImage(row,slot,item,() => { if (pa && !pa.code && (item.code || item.name)) { pa.code = item.code || item.name; pa.autoName = true; pa.autoNameAsset = item.full; } });
}
let openCellMenuElement = null;
function closeCellMenu() {
  if (openCellMenuElement) { openCellMenuElement.remove(); openCellMenuElement = null; }
}
function openImageCellMenu(anchor, row, group, slot) {
  closeCellMenu();
  const pa = slot === 'render' ? null : row.options[Number(slot)];
  const list = pa ? pa.images : row.render;
  const hasImage = list && list.length > 0;
  const isChosen = row.chosen === Number(slot);

  const menu = document.createElement('div');
  menu.className = 'image-cell-dropdown-menu';
  menu.style.cssText = 'position:fixed;z-index:10000;background:#fff;border:1px solid #cbd5e1;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.18);padding:4px;display:flex;flex-direction:column;gap:2px;min-width:185px;font-size:12px;font-family:var(--gd-font,sans-serif);';

  const addItem = (icon, text, onClick, danger = false) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.innerHTML = '<span style="width:16px;display:inline-block;text-align:center">' + icon + '</span> ' + html(text);
    btn.style.cssText = 'display:flex;align-items:center;gap:6px;padding:6px 10px;border:none;background:transparent;text-align:left;border-radius:4px;cursor:pointer;color:' + (danger ? '#dc2626' : '#1e293b') + ';font-size:12px;';
    btn.onmouseover = () => { btn.style.background = danger ? '#fef2f2' : '#f1f5f9'; };
    btn.onmouseout = () => { btn.style.background = 'transparent'; };
    btn.onclick = e => { e.stopPropagation(); closeCellMenu(); onClick(); };
    menu.appendChild(btn);
  };

  const addDivider = () => {
    const hr = document.createElement('div');
    hr.style.cssText = 'height:1px;background:#e2e8f0;margin:3px 0;';
    menu.appendChild(hr);
  };

  if (slot === 'render') {
    addItem('🎨', 'Chọn từ phối cảnh 3D', () => {
      const cell = anchor.closest('.image-cell');
      focusMaterialImageCell(cell);
      openAssetPicker(cell, row, group, slot);
    });
  } else {
    let pickLabel = 'Chọn từ thư viện';
    if (isPaintGroup(group?.name)) pickLabel = 'Chọn màu sơn (Dulux, Jotun)';
    else if (isWoodGroup(group?.name)) pickLabel = 'Chọn mã gỗ';
    addItem('🖼', pickLabel, () => {
      const cell = anchor.closest('.image-cell');
      focusMaterialImageCell(cell);
      openAssetPicker(cell, row, group, slot);
    });
  }

  addItem('⬆', 'Tải ảnh lên…', async () => {
    const files = await GDHomeAssets.filePicker('image/*');
    if (files.length) attachImages(row, slot, files, true).catch(showError);
  });

  if (hasImage) {
    addItem('🔍', 'Chỉnh vùng nhìn…', async () => {
      const view = await GDHomeAssets.editView(list[0]);
      if (view) modify(() => { setImageView(list, 0, view); }, false);
    });
    addItem('🗑', 'Xoá ảnh', () => {
      modify(() => removeMaterialImage(list,0,pa),true,true);
    }, true);
  } else if (pa?.paint) {
    addItem('🗑', 'Xoá màu sơn', () => {
      modify(() => {
        pa.paint = null;
        pa.brand = '';
        pa.code = '';
        pa.color = '';
      });
    }, true);
  }

  if (slot !== 'render') {
    addDivider();
    if (isChosen) {
      addItem('✕', 'Bỏ chốt phương án', () => pick(row, slot), true);
    } else {
      addItem('✓', 'Chốt phương án này', () => pick(row, slot));
    }
    addItem('⚙', 'Chi tiết phương án…', () => editDetail(row, slot));
  }

  document.body.appendChild(menu);
  openCellMenuElement = menu;

  const rect = anchor.getBoundingClientRect();
  const menuWidth = 190;
  let left = rect.right - menuWidth;
  if (left < 8) left = 8;
  if (left + menuWidth > window.innerWidth - 8) left = window.innerWidth - menuWidth - 8;
  let top = rect.bottom + 4;
  if (top + 160 > window.innerHeight - 8) {
    top = Math.max(8, rect.top - 160);
  }
  menu.style.left = left + 'px';
  menu.style.top = top + 'px';

  const onDocClick = e => {
    if (!menu.contains(e.target) && e.target !== anchor) {
      closeCellMenu();
      document.removeEventListener('pointerdown', onDocClick, true);
    }
  };
  setTimeout(() => document.addEventListener('pointerdown', onDocClick, true), 0);
}

function isPaintGroup(name) {
  return /SƠN/i.test(name || '');
}
function isWoodGroup(name) {
  return /MÃ GỖ|MA GO/i.test(name || '');
}

function openAssetPicker(cell,row,group,slot) {
  if (!window.GDHomeAssets || !row) return;
  if (slot === 'render') {
    GDHomeAssets.pickRender(cell,{projectId:sheet.projectId,groupName:group?.name,onPick:item => addPickedImage(row,'render',item)});
  } else if (isPaintGroup(group?.name)) {
    GDHomeAssets.pickPaint(cell,{groupName:group?.name,onPick:paint => {
      if (paint.kind === 'paint') paintPicked(row,slot,paint);
      else libraryPicked(row,slot,paint);
    }});
  } else if (isWoodGroup(group?.name)) {
    GDHomeAssets.pickWood(cell,{groupName:group?.name,onPick:wood => {
      if (wood.kind === 'wood') woodPicked(row,slot,wood);
      else libraryPicked(row,slot,wood);
    }});
  } else {
    GDHomeAssets.pickLibrary(cell,{groupName:group?.name,onPick:item => libraryPicked(row,slot,item)});
  }
}

function paintPicked(row,slot,paint) {
  const pa = row.options[Number(slot)];
  if (!pa) return;
  modify(() => {
    pa.paint = paint;
    pa.brand = paint.brand;
    pa.code = paint.code;
    pa.color = paint.name;
  });
  if (!paint.id) savePaintToSharedLibrary(paint,sheet.groups.find(group => group.rows.includes(row))?.name);
  else GDHomeAssets.updateItem({id:paint.id,used:true}).catch(showError);
}

async function savePaintToSharedLibrary(paint,groupName) {
  if (!window.GDHomeAssets || !paint) return;
  try {
    const data = await GDHomeAssets.loadLibrary();
    const cat = GDHomeAssets.categoryFor(data,groupName) || data.categories.find(category => category.id === 'cat-3');
    if (!cat) return;
    const {added} = await GDHomeAssets.addItems(cat.id,[paint]);
    if (added[0]) await GDHomeAssets.updateItem({id:added[0].id,used:true});
  } catch (err) {
    console.warn('savePaintToSharedLibrary:', err);
  }
}

function woodPicked(row,slot,wood) {
  const pa = row.options[Number(slot)];
  if (!pa) return;
  modify(() => {
    pa.brand = wood.brand;
    pa.code = wood.code;
    pa.autoName = !!wood.full;
    pa.autoNameAsset = wood.full;
    if (wood.finish) pa.finish = wood.finish;
    if (wood.full && pa.images.length < 8 && !pa.images.some(img => (typeof img === 'string' ? img : img.full) === wood.full)) {
      pa.images.push({full:wood.full,thumb:wood.thumb});
    }
    if (!pa.color) { pa.color = wood.name; pa.autoColor = wood.full ? wood.name : undefined; }
    if (!row.spec) row.spec = wood.collection;
  });
}
async function uploadProjectRenders() {
  const files = await GDHomeAssets.filePicker('image/*,application/pdf');
  if (!files.length) return;
  const result = await GDHomeAssets.uploadRenders(sheet.projectId,files,message => say(message));
  say(result.message);
  fillMaterialAssetSidebar(true);
}
let assetSidebarRevision = 0;
async function fillMaterialAssetSidebar(force = false) {
  const revision = ++assetSidebarRevision;
  const renderSummary = box().querySelector('[data-render-summary]');
  const strip = box().querySelector('[data-render-strip]');
  if (strip && sheet) {
    try {
      const items = await GDHomeAssets.loadRenders(sheet.projectId,force);
      if (!strip.isConnected || revision !== assetSidebarRevision) return;
      if (renderSummary) renderSummary.textContent = items.length + ' ảnh 3D';
      strip.innerHTML = materialView.hideAssetPreviews !== false ? '' : items.slice(0,items.length > 10 ? 9 : 10).map(item => '<button type="button" data-action="render-strip" data-id="' + html(item.id) +
        '" title="' + html((item.page ? 'Trang ' + item.page + ' · ' : '') + (item.room || item.name)) + ' — bấm để gắn vào ô 3D đang chọn"><img data-lib-asset="' + html(item.thumb) + '" alt=""></button>').join('') +
        (items.length > 10 ? '<button type="button" class="more" data-action="open-renders">+' + (items.length-9) + '</button>' : '') +
        '';
      GDHomeAssets.hydrate(strip);
    } catch (error) {
      if (revision === assetSidebarRevision && renderSummary) renderSummary.textContent = error.message;
    }
  }
  const summary = box().querySelector('[data-library-summary]');
  if (summary) {
    try {
      const data = await GDHomeAssets.loadLibrary();
      if (!summary.isConnected || revision !== assetSidebarRevision) return;
      const images = data.items.filter(item => item.thumb);
      summary.textContent = images.length + ' ảnh mẫu · ' + data.categories.length + ' hạng mục';
      const preview = box().querySelector('[data-library-strip]');
      if (!preview) return;
      preview.innerHTML = materialView.hideAssetPreviews !== false ? '' : images.slice(0,images.length > 10 ? 9 : 10).map(item =>
        '<button type="button" data-action="open-library" data-category="' + html(item.categoryId) + '" title="' + html(item.name) +
        '"><img data-lib-asset="' + html(item.thumb) + '" alt="' + html(item.name || 'Ảnh mẫu') + '"></button>').join('') +
        (images.length > 10 ? '<button type="button" class="more" data-action="open-library">+' + (images.length-9) + '</button>' : '');
      GDHomeAssets.hydrate(preview);
    } catch (error) { summary.textContent = error.message; }
  }
}

document.addEventListener('gdhome:library-changed',() => fillMaterialAssetSidebar());
document.addEventListener('gdhome:renders-changed',event => {
  if (event.detail === sheet?.projectId) fillMaterialAssetSidebar();
});
