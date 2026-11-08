let materialView = {}, materialViewVersion = 0, pendingMaterialView = {}, sentMaterialView = {}, materialViewTimer;
let viewAsPrint = false;

function mergeMaterialView(base,patch) {
  const merged = { ...base,...patch };
  if (patch.suggestions) merged.suggestions = {...base.suggestions,...patch.suggestions};
  if (patch.sheets) {
    merged.sheets = { ...base.sheets };
    for (const [id,values] of Object.entries(patch.sheets)) merged.sheets[id] = { ...merged.sheets[id],...values };
  }
  return merged;
}

function materialViewKey() {
  return 'gdhome-material-view:' + (materialGuest ? 'guest' : session()?.user?.email?.toLowerCase() || 'local');
}

function stashMaterialView() {
  try {
    const patch = mergeMaterialView(sentMaterialView,pendingMaterialView);
    if (Object.keys(patch).length) localStorage.setItem(materialViewKey(),JSON.stringify(patch));
    else localStorage.removeItem(materialViewKey());
  } catch { /* The server can still save when storage is full. */ }
}

function initMaterialView() {
  try { pendingMaterialView = JSON.parse(localStorage.getItem(materialViewKey())) || {}; }
  catch { pendingMaterialView = {}; }
  materialViewVersion = materials.viewVersion || 0;
  materialView = mergeMaterialView(materials.viewSettings || {},pendingMaterialView);
  density = {gon:'s',vua:'m',lon:'l'}[materialView.density] || materialView.density || 'm';
  for (const [set,values] of [[hiddenColumns,materialView.hiddenColumns],[forcedPA,materialView.forcedPA]]) {
    set.clear();
    for (const key of values || []) set.add(key);
  }
  sidebarOpen.clear();
  for (const [key,open] of Object.entries(materialView.sidebarOpen || {})) sidebarOpen.set(key,open);
  materials.columnWidths = { ...(materialView.columnWidths || materials.columnWidths) };

  if (materialServerReady && Object.keys(pendingMaterialView).length) scheduleMaterialViewSave();
}

function restoreMaterialSheetView(current) {
  const settings = Object.hasOwn(materialView.sheets || {},current.id) ? materialView.sheets[current.id] : {};
  for (const [set,values] of [[hiddenGroups,settings.hiddenGroups],[collapsed,settings.collapsed]]) {
    set.clear();
    for (const key of values || []) set.add(key);
  }
  sheetRoom = settings.room || '';
  sheetStatus = settings.status || '';
  viewAsPrint = settings.viewAsPrint === true;
}

function setMaterialView(patch) {
  if (!materialGuest && !materialServerReady) return;
  const next = mergeMaterialView(materialView,patch);
  if (JSON.stringify(next) === JSON.stringify(materialView)) return;
  materialView = next;
  if (materialGuest) {
    try { saveGuestView(materialView); }
    catch (error) { say('Không lưu được cài đặt trên máy: ' + error.message); }
    return;
  }
  pendingMaterialView = mergeMaterialView(pendingMaterialView,patch);
  stashMaterialView();
  scheduleMaterialViewSave();
}

function setMaterialSheetView(patch) {
  if (sheet.id) setMaterialView({sheets:{[sheet.id]:patch}});
}

function saveMaterialGroupsView() {
  setMaterialSheetView({hiddenGroups:[...hiddenGroups],collapsed:[...collapsed]});
}

function scheduleMaterialViewSave() {
  clearTimeout(materialViewTimer);
  materialViewTimer = setTimeout(flushMaterialView,350);
}

async function flushMaterialView() {
  if (!materialServerReady || materialGuest || Object.keys(sentMaterialView).length || !Object.keys(pendingMaterialView).length) return;
  sentMaterialView = pendingMaterialView;
  pendingMaterialView = {};
  let saved = false;
  const send = () => {
    const body = JSON.stringify({_version:materialViewVersion,patch:sentMaterialView});
    return request('/api/materials/preferences',{
      method:'POST',body,keepalive:new Blob([body]).size < 60*1024,signal:AbortSignal.timeout(15000)
    });
  };
  try {
    let result;
    try { result = await send(); }
    catch (error) {
      if (error.status !== 409) throw error;
      materialViewVersion = (await request('/api/materials/preferences'))._version;
      result = await send();
    }
    materialViewVersion = result._version;
    materials.viewVersion = result._version;
    materials.viewSettings = result.viewSettings;
    saveToolsSnapshot();
    saved = true;
  } catch (error) {
    pendingMaterialView = mergeMaterialView(sentMaterialView,pendingMaterialView);
    say('Cài đặt hiển thị đang lưu trên máy. ' + error.message);
  } finally {
    sentMaterialView = {};
    stashMaterialView();
    if (saved && Object.keys(pendingMaterialView).length) scheduleMaterialViewSave();
  }
}

window.addEventListener('pagehide',() => { if (materials) flushMaterialView(); });
