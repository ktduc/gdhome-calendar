const crypto = require('node:crypto');
const { scheduleInfo, tasksFor } = require('./material-schedule');
const { MaterialAssets, imageName, maxImageBytes, isConfigured } = require('./material-assets');
const { cleanSheet, handleInternalReview, assetNames } = require('./material-review');
const {projectList,profileFor,writeProjectProfile} = require('./project-profiles');

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

const id = () => crypto.randomUUID();
const blank = () => ({ _version: 0, sheets: [], presets: {}, library: [], settings: {}, revisions: [], approvals: [], audit: [] });
const queues = new Map();
const widthKeys = new Set(['name','room','render','spec','pa0','pa1','pa2','qty','unit','supplier','note','decision','actions']);
function cleanColumnWidths(widths) {
  return Object.fromEntries(Object.entries(widths).filter(([key,value]) => widthKeys.has(key) && Number.isFinite(value))
    .map(([key,value]) => [key,Math.min(720,Math.max(48,Math.round(value)))]));
}

const suggestionFields = ['note','spec','room','unit','supplier','name','brand','code','color','size'];
function cleanMaterialSuggestions(patch,previous) {
  const result = {...previous};
  for (const key of suggestionFields) {
    if (!Array.isArray(patch[key])) continue;
    const clean = new Map();
    for (const item of patch[key].slice(0,80)) {
      if (!item || typeof item.value !== 'string' || typeof item.group !== 'string') continue;
      const value = item.value.trim().slice(0,500);
      const group = item.group.trim().slice(0,160);
      if (!value) continue;
      const entry = {value,group,count:Math.min(100000,Math.max(0,Math.floor(Number(item.count) || 0)))};
      if (item.disabled === true) entry.disabled = true;
      clean.set(JSON.stringify([group,value.toLocaleLowerCase()]),entry);
    }
    result[key] = [...clean.values()];
  }
  return result;
}

function cleanMaterialView(patch,previous = {},sheets = [],archived = []) {
  const result = { ...previous };
  const flags = (value,allowed) => Array.isArray(value) ? [...new Set(value.filter(key => allowed.includes(key)))] : [];
  const validIds = value => Array.isArray(value) ? [...new Set(value.filter(key => typeof key === 'string' && /^[\w-]{1,80}$/.test(key)))].slice(0,100) : [];
  if (['gon','vua','lon','xs','s','m','l'].includes(patch.density)) result.density = patch.density;
  if (['light','normal','bold','heavy'].includes(patch.fontWeight)) result.fontWeight = patch.fontWeight;
  if (Object.hasOwn(patch,'hiddenColumns')) result.hiddenColumns = flags(patch.hiddenColumns,['render','spec','qty','unit','supplier','note','decision']);
  if (Object.hasOwn(patch,'forcedPA')) result.forcedPA = flags(patch.forcedPA,['pa1','pa2']);
  if (['fill','fit'].includes(patch.imageFit)) result.imageFit = patch.imageFit;
  if (Object.hasOwn(patch,'columnOrder')) result.columnOrder = flags(patch.columnOrder,['select',...widthKeys]);
  if (Object.hasOwn(patch,'printHidden')) result.printHidden = flags(patch.printHidden,['select',...widthKeys].filter(key => key !== 'actions'));
  if (patch.columnWidths && typeof patch.columnWidths === 'object') result.columnWidths = cleanColumnWidths(patch.columnWidths);
  if (patch.sidebarOpen && typeof patch.sidebarOpen === 'object') {
    result.sidebarOpen = { ...previous.sidebarOpen,...Object.fromEntries(['project','catalog','display']
      .filter(key => typeof patch.sidebarOpen[key] === 'boolean').map(key => [key,patch.sidebarOpen[key]])) };
  }
  if (patch.projectId === null || typeof patch.projectId === 'string') result.projectId = patch.projectId?.slice(0,120) ?? null;
  if (patch.sheetId === null || sheets.some(sheet => sheet.id === patch.sheetId)) result.sheetId = patch.sheetId;
  if (patch.export && typeof patch.export === 'object') {
    result.export = {groups:patch.export.groups === 'all' ? 'all' : 'visible',rows:patch.export.rows === 'chosen' ? 'chosen' : 'all',
      room:typeof patch.export.room === 'string' ? patch.export.room.slice(0,500) : '',
      watermark:patch.export.watermark !== false};
  }
  if (patch.suggestions && typeof patch.suggestions === 'object') {
    result.suggestions = cleanMaterialSuggestions(patch.suggestions,previous.suggestions);
  }
  if (patch.sheets && typeof patch.sheets === 'object') {
    result.sheets = Object.fromEntries([...sheets,...archived].flatMap(sheet => {
      const values = patch.sheets[sheet.id];
      const view = { ...previous.sheets?.[sheet.id] };
      if (values && typeof values === 'object') {
        for (const key of ['hiddenGroups','collapsed']) if (Object.hasOwn(values,key)) view[key] = validIds(values[key]);
        if (typeof values.room === 'string') view.room = values.room.slice(0,500);
        if (['','draft','sent','chosen','changed','ordered'].includes(values.status)) view.status = values.status;
        if (typeof values.viewAsPrint === 'boolean') view.viewAsPrint = values.viewAsPrint;
        if (typeof values.onlyUnlinked === 'boolean') view.onlyUnlinked = values.onlyUnlinked;
      }
      return Object.keys(view).length ? [[sheet.id,view]] : [];
    }));
  }
  return result;
}

class MaterialStore {
  constructor(store, account, explicitKey) {
    this.store = store;
    this.key = explicitKey || 'mat-v1-' + crypto.createHash('sha256').update(account).digest('hex');
  }

  async get() {
    const data = await this.store.get(this.key) || blank();
    const archive = await this.store.get(this.key + '-rev');
    if (data.archiveCount && (!Array.isArray(archive?.entries) || archive.entries.length < data.archiveCount)) fail(503,'Kho bản phát hành chưa đầy đủ. Thử lại sau khi đồng bộ.');
    if (archive) {
      const entries = archive.entries.slice(0, data.archiveCount || 0);
      data.revisions = [...entries.filter(e => e.type === 'revision').map(e => e.value), ...data.revisions];
    }
    return data;
  }

  async update(version, edit, revisionKey = '_version') {
    const previous = queues.get(this.key) || Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      const data = await this.get();
      const currentVersion = data[revisionKey] || 0;
      if (version !== undefined && version !== currentVersion) fail(409, 'Có thay đổi trên máy khác. Hãy giữ bản nháp và tải lại để đối chiếu.');
      const revisionCount = data.revisions.length;
      const result = await edit(data);
      data[revisionKey] = currentVersion+1;
      const writes = [];
      const compact = data.archiveCount || Buffer.byteLength(JSON.stringify(data, null, 2)) > 800000;
      if (compact) {
        const entries = data.revisions.map(value => ({ type: 'revision', value }));
        // Append before publishing the count. Readers only read entries committed by the main file.
        if (!data.archiveCount || revisionCount !== data.revisions.length) writes.push([this.key + '-rev', { entries }]);
        data.archiveCount = entries.length;
        data.revisions = [];
      }
      writes.push([this.key,data]);
      if (this.store.putMaterials) await this.store.putMaterials(writes);
      else for (const [key,value] of writes) await this.store.put(key,value);
      return { _version:data[revisionKey], ...result };
    });
    queues.set(this.key, pending);
    try { return await pending; }
    finally { if (queues.get(this.key) === pending) queues.delete(this.key); }
  }
}

function signedRowsBySheet(data) {
  const signed = new Set(data.approvals.filter(record => record.kind === 'customer' || record.kind === 'company')
    .map(record => record.revisionId));
  const rows = new Map();
  for (const revision of data.revisions) {
    if (!signed.has(revision.id)) continue;
    if (!rows.has(revision.sheet.id)) rows.set(revision.sheet.id,new Set());
    const ids = rows.get(revision.sheet.id);
    for (const group of revision.sheet.groups) for (const row of group.rows) ids.add(row.id);
  }
  return rows;
}


function materialLifecycleSummary(data) {
  return {
    archivedSheets:(data.archivedSheets || []).map(({id,title,projectId,archivedAt}) => ({id,title,projectId,archivedAt})),
    publishedSheetIds:[...new Set(data.revisions.map(revision => revision.sheet.id))]
  };
}

function flagUnusedMaterialAssets(data,removed,at) {
  const candidates = assetNames(removed);
  if (!candidates.size) return;
  for (const sheet of [...data.sheets,...(data.archivedSheets || []),...data.revisions.map(revision => revision.sheet)]) {
    for (const name of assetNames(sheet)) candidates.delete(name);
  }
  for (const item of data.library) for (const image of item.images || []) {
    for (const name of typeof image === 'string' ? [image] : [image?.full,image?.thumb]) {
      if (imageName(name)) candidates.delete(name);
    }
  }
  // Only mark candidates. A future cleanup must recheck references, including the project hub's shared 3D assets.
  if (candidates.size) {
    data.assetCleanupCandidates ||= {};
    for (const name of candidates) data.assetCleanupCandidates[name] = at;
  }
}

function applyMaterialLifecycle(data,sheetId,body,actor) {
  const at = Date.now();
  const archive = data.archivedSheets ||= [];
  if (body.action === 'restore') {
    const index = archive.findIndex(sheet => sheet.id === sheetId);
    if (index < 0) fail(404,'Không tìm thấy bảng đã lưu trữ.');
    const [{archivedAt,...sheet}] = archive.splice(index,1);
    data.sheets.push(sheet);
    data.audit.push({sheetId,at,actor,event:'sheet-restored'});
    return {outcome:'restored',sheet,...materialLifecycleSummary(data)};
  }
  if (body.action !== 'remove') fail(400,'Hành động không hợp lệ.');
  const index = data.sheets.findIndex(sheet => sheet.id === sheetId);
  if (index < 0) fail(404,'Không tìm thấy bảng.');
  if (typeof body.title !== 'string' || body.title.trim() !== data.sheets[index].title) fail(400,'Nhập đúng tên bảng để xác nhận.');
  const [sheet] = data.sheets.splice(index,1);
  if (data.viewSettings?.sheetId === sheetId) data.viewSettings.sheetId = null;
  if (data.revisions.some(revision => revision.sheet.id === sheetId)) {
    archive.push({...sheet,archivedAt:at});
    data.audit.push({sheetId,at,actor,event:'sheet-archived'});
    return {outcome:'archived',...materialLifecycleSummary(data)};
  }
  if (data.viewSettings?.sheets) delete data.viewSettings.sheets[sheetId];
  data.audit = data.audit.filter(event => event.sheetId !== sheetId);
  flagUnusedMaterialAssets(data,sheet,at);
  return {outcome:'deleted',...materialLifecycleSummary(data)};
}

async function handleMaterials(req, url, { store, dataKey, readJsonBody, readRawBody, sendJson, res, dataDir, secret, defaultSchedule }) {
  const materials = new MaterialStore(store, dataKey);
  const assets = new MaterialAssets(dataDir, materials.key);
  const resolveProfile = async (sheet,legacy) => {
    const owner = (await store.get(dataKey))?.projectOwners?.find(project => project.id === sheet.projectId);
    return owner ? profileFor(owner,legacy) : legacy.profiles?.[sheet.projectId];
  };
  if (url === '/api/materials/assets' && req.method === 'POST') {
    if (/^image\/(webp|png|jpeg)$/.test(req.headers['content-type'] || '')) {
      const {name} = await assets.saveBuffer(await readRawBody(req,maxImageBytes));
      return sendJson(res,200,{name});
    }
    const body = await readJsonBody(req);
    return sendJson(res, 200, { name: await assets.save(body.image) });
  }
  if (url.startsWith('/api/materials/assets/') && req.method === 'GET') {
    return assets.send(res, url.split('/').at(-1));
  }
  if (url.includes('/review') || url === '/api/materials/settings') {
    const result = await handleInternalReview(req,url,{ res,repo:materials,account:dataKey,readJsonBody,sendJson,secret,resolveProfile });
    if (result === false) fail(404, 'Không tìm thấy API duyệt.');
    return;
  }
  const lifecycle = /^\/api\/materials\/sheets\/([\w-]{1,80})\/lifecycle$/.exec(url);
  if (lifecycle && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!Number.isSafeInteger(body?._version)) fail(400,'Thiếu phiên bản dữ liệu.');
    const saved = await materials.update(body._version,data => applyMaterialLifecycle(data,lifecycle[1],body,dataKey));
    return sendJson(res,200,saved);
  }
  const schedule = await store.get(dataKey) || {};
  const projects = (schedule.projectOwners || []).map(({ id, name }) => ({ id, name }));
  if (url === '/api/materials/profile' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!Number.isSafeInteger(body?._version)) fail(400,'Thiếu phiên bản dữ liệu.');
    const result = await materials.update(body._version,data => writeProjectProfile(store,dataKey,body,defaultSchedule,data));
    return sendJson(res,200,result);
  }
  if (url === '/api/materials/timeline' && req.method === 'GET') {
    const data = await materials.get();
    return sendJson(res,200,{ badges:scheduleInfo(data,schedule).badges });
  }
  if (url === '/api/materials/preferences') {
    if (req.method === 'GET') {
      const data = await materials.get();
      return sendJson(res,200,{ _version:data.viewVersion || 0,viewSettings:data.viewSettings || {} });
    }
    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (!Number.isSafeInteger(body?._version) || !body.patch || typeof body.patch !== 'object' || Array.isArray(body.patch)) {
        fail(400,'Thiếu phiên bản hoặc cài đặt hiển thị.');
      }
      const result = await materials.update(body._version,data => {
        data.viewSettings = cleanMaterialView(body.patch,data.viewSettings,data.sheets,data.archivedSheets);
        return { viewSettings:data.viewSettings };
      },'viewVersion');
      return sendJson(res,200,result);
    }
  }
  if (url === '/api/materials' && req.method === 'GET') {
    const data = await materials.get();
    const { _version, sheets, presets, library, settings } = data;
    const sharedProjects = projectList(schedule,data);
    return sendJson(res, 200, { _version, sheets, ...materialLifecycleSummary(data), presets, library, settings, projects, r2: isConfigured(), viewVersion:data.viewVersion || 0, viewSettings:data.viewSettings || {}, columnWidths:data.columnWidths || {}, profiles:Object.fromEntries(sharedProjects.map(project => [project.id,project.profile])), signedRows:Object.fromEntries([...signedRowsBySheet(data)].map(([id,rows]) => [id,[...rows]])), schedule:scheduleInfo(data,schedule) });
  }
  if (url === '/api/materials' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!Number.isSafeInteger(body?._version)) fail(400, 'Thiếu phiên bản dữ liệu.');
    const saved = await materials.update(body._version, async data => {
      if (body.columnWidths && typeof body.columnWidths === 'object') data.columnWidths = cleanColumnWidths(body.columnWidths);
      const sheet = body.sheet;
      if (!sheet || typeof sheet.title !== 'string' || !sheet.title.trim() || !Array.isArray(sheet.groups)) fail(400, 'Bảng không hợp lệ.');
      const index = sheet.id ? data.sheets.findIndex(s => s.id === sheet.id) : -1;
      if (sheet.id && index < 0) fail(404, 'Không tìm thấy bảng.');
      if (!projects.some(p => p.id === sheet.projectId) && data.sheets[index]?.projectId !== sheet.projectId) fail(400, 'Chọn dự án Tiến độ trước.');
      const updated = { id: sheet.id || id(), projectId: sheet.projectId, title: sheet.title.trim().slice(0, 200), ...cleanSheet(sheet) };
      for (const [key, values] of Object.entries(sheet.presets || {})) {
        if (!['room','unit','size','finish','color','supplier'].includes(key) || !Array.isArray(values)) continue;
        const merged = new Map((data.presets[key] || []).map(v => [v.toLocaleLowerCase(),v]));
        for (const value of values) if (typeof value === 'string' && value.trim()) merged.set(value.trim().toLocaleLowerCase(), value.trim().slice(0,200));
        data.presets[key] = [...merged.values()].slice(-250);
      }

      const tasks = new Map(tasksFor(schedule).map(task => [task.id,task]));
      for (const group of updated.groups) {
        if (!group.taskId) { group.calendarId = ''; continue; }
        const task = tasks.get(group.taskId);
        if (task?.projectId === updated.projectId) group.calendarId = task.calendarId;
        else if (!data.sheets[index]?.groups.some(old => old.id === group.id && old.taskId === group.taskId)) fail(400,'Công việc không thuộc dự án.');
      }
      if (index >= 0) {
        const older = new Map(data.sheets[index].groups.flatMap(group => group.rows).map(row => [row.id,row]));
        const retained = new Set(updated.groups.flatMap(group => group.rows.map(row => row.id)));
        const signedRows = signedRowsBySheet(data).get(updated.id);
        if (signedRows && [...signedRows].some(rowId => older.has(rowId) && !retained.has(rowId))) {
          fail(409,'Không thể xoá dòng thuộc bản đã ký.');
        }
        for (const row of updated.groups.flatMap(group => group.rows)) {
          const old = older.get(row.id);
          const choice = row => row?.chosen != null ? row.options[row.chosen] : null;
          if (!old || (!choice(row) && !choice(old))) continue;
          const summary = row => ({ slot:row.chosen, code:choice(row)?.code || '', color:choice(row)?.color || '', size:choice(row)?.size || '', finish:choice(row)?.finish || '', decision:row.decision });
          const previous = summary(old);
          const next = summary(row);
          if (JSON.stringify(previous) !== JSON.stringify(next)) data.audit.push({
            sheetId:updated.id, at:Date.now(),event:'draft-choice',actor:dataKey,row:row.name,previous,next
          });
        }
      }
      if (index < 0) data.sheets.push(updated);
      else data.sheets[index] = updated;
      for (const group of updated.groups) for (const row of group.rows) {
        if (row.decision !== 'chosen' || !row.options[row.chosen]?.code) continue;
        const pa = row.options[row.chosen];
        const signature = [pa.brand,pa.code,pa.color,pa.size,pa.finish].map(v => String(v || '').trim().toLocaleLowerCase()).join('|');
        const entry = { ...pa, name:row.name, group:group.name, signature };
        const existing = data.library.findIndex(item => item.signature === signature);
        if (existing < 0) data.library.push(entry);
        else data.library[existing] = entry;
      }
      if (body.profilePatch) await writeProjectProfile(store,dataKey,{projectId:updated.projectId,profile:body.profilePatch},defaultSchedule,data);
      const profile = await resolveProfile(updated,data);
      return {sheet:updated,library:data.library,presets:data.presets,profile};
    });
    return sendJson(res, 200, saved);
  }
  fail(404, 'Không tìm thấy API Chốt mã.');
}

module.exports = { MaterialStore, handleMaterials, fail, id };
