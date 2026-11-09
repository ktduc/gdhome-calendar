// Thư viện dữ liệu dùng chung (ảnh mẫu vật liệu theo hạng mục) cho mọi công cụ GD HOME.
// Ảnh nằm trong kho ảnh Chốt mã của tài khoản (/api/materials/assets), nên dùng thẳng cho ô PA mà không cần sao chép.
const crypto = require('node:crypto');
const materialTemplate = require('./material-template');
const { imageName } = require('./material-assets');
const attributes = require('./library-attributes');
const importHistory = require('./catalogue-import-history');

const libraryKey = dataKey => 'lib-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
const text = (value, max = 160) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const shortName = name => text(name.replace(/\s*\(.*\)\s*$/, ''), 80) || text(name, 80);
const queues = new Map();
const bulkUndo = new Map();
const mergeUndo = new Map();
const woodCategory = {id:'ancuong-wood',name:'Mã gỗ'};
const woodSeed = require('./data/wood-ancuong.json').woods.map((wood,i) => ({
  ...wood,id:'ancuong-seed-' + i,categoryId:woodCategory.id,brand:'An Cường',finish:'',kind:'wood',builtin:true,createdAt:1
}));
const kitchenCategory = {id:'kitchen-accessories',name:'PHỤ KIỆN BẾP',subgroups:[
  'Giá bát đĩa nâng hạ','Giá bát đĩa','Giá xoong nồi','Giá dao thớt gia vị','Thùng gạo','Thùng rác',
  'Tủ đồ khô','Góc liên hoàn','Ray / bản lề','Tay nâng'
]};
const paintCategory = {id:'cat-3',name:'SƠN TƯỜNG / TRẦN'};
const paintSeed = ['dulux','jotun'].flatMap(key => {
  const {brand,colors} = require('./data/paint-' + key + '.json');
  return colors.map((color,index) => ({...color,id:'paint-' + key + '-' + index,categoryId:paintCategory.id,kind:'paint',brand,builtin:true,createdAt:1}));
});
const validHex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const cleanDisplay = value => ['fill','fit','pad'].includes(value) ? value : undefined;
const kindOf = item => ['image','paint','wood'].includes(item.kind) ? item.kind : (item.code ? 'wood' : 'image');
const woodKey = code => text(code,80).toUpperCase().replace(/\s+/g,'');
const woodItemKey = item => text(item.brand || 'An Cường',80).toLowerCase() + ':' + woodKey(item.code);
const woodMeta = item => ({brand:text(item.brand,80) || 'An Cường',code:text(item.code,80),collection:text(item.collection,120),finish:text(item.finish,120),material:text(item.material,80),tone:text(item.tone,40),grain:text(item.grain,40)});

const stringList = values => [...new Set((Array.isArray(values) ? values : []).map(value => text(value,80)).filter(Boolean))].slice(0,30);
function materialSize(value,firstOnly = true) {
  const first = Array.isArray(value) ? value[0] : value;
  const label = String(first || '');
  const match = (firstOnly ? label.split(/[,;]/,1)[0] : label).match(/\b(\d{2,4})(?:\s*(cm|mm))?(?:\s*[x×*]\s*|\s+)(\d{2,4})(?:\s*(cm|mm))?\b/i);
  if (!match) return '';
  const unit = match[4] || match[2];
  const factor = unit ? (unit.toLowerCase() === 'cm' ? 10 : 1) : (+match[1] < 100 && +match[3] < 100 ? 10 : 1);
  return (+match[1]*factor) + 'x' + (+match[3]*factor);
}
function itemMetadata(item) {
  const number = (value,max) => Math.min(max,Math.max(0,Math.round(Number(String(value || '').replace(/[.,\s]/g,'')) || 0)));
  const cabinetWidth = number(item.cabinetWidth,20000);
  const tags = stringList([...(Array.isArray(item.tags) ? item.tags : []),...(cabinetWidth ? ['Tủ '+cabinetWidth] : [])]);
  const suppliedSize = Object.hasOwn(item,'size');
  return {brand:text(item.brand,80),size:materialSize(suppliedSize ? item.size : item.name,suppliedSize),tags,suppliers:stringList(item.suppliers),
    ...Object.fromEntries(['material','finish','collection','subgroup'].filter(key => Object.hasOwn(item,key))
      .map(key => [key,text(item[key],['finish','collection'].includes(key) ? 120 : 80)])),
    ...(Array.isArray(item.brands) ? {brands:stringList(item.brands)} : {}),
    ...(item.spec ? {spec:text(item.spec,160)} : {}),...(item.subgroup ? {subgroup:text(item.subgroup,80)} : {}),
    ...(cabinetWidth ? {cabinetWidth} : {}),...(item.innerWidth ? {innerWidth:number(item.innerWidth,20000)} : {}),
    ...(item.unit ? {unit:text(item.unit,30)} : {}),...(item.price ? {price:number(item.price,1e10)} : {})};
}
function supplierRecord(item) {
  return {name:text(item?.name,80),phone:text(item?.phone,40),note:text(item?.note,300)};
}

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

function defaultLibrary() {
  return {
    _version: 0,
    categories: materialTemplate.map(([name], index) => ({ id: 'cat-' + (index + 1), name: shortName(name), source: name })),
    items: [],
    woodSeeded:false
  };
}

function cleanView(view) {
  if (!view || typeof view !== 'object') return undefined;
  const num = (value, low, high, fallback) => Number.isFinite(Number(value)) ? Math.min(high, Math.max(low, Number(value))) : fallback;
  const result = { x: num(view.x, 0, 1, 0.5), y: num(view.y, 0, 1, 0.5), z: num(view.z, 1, 6, 1) };
  return result.x === 0.5 && result.y === 0.5 && result.z === 1 ? undefined : result;
}

function normalize(data) {
  const base = data && typeof data === 'object' ? data : defaultLibrary();
  const categories = (Array.isArray(base.categories) ? base.categories : [])
    .filter(c => c && typeof c.id === 'string' && text(c.name))
    .slice(0, 200).map(c => ({ id: c.id.slice(0, 60), name: text(c.name, 80), ...(c.source ? { source: text(c.source, 160) } : {}) }));
  const genericWood = categories.find(c => c.id === 'cat-1' && c.name.toLocaleLowerCase('vi') === 'mã gỗ');
  if (genericWood) genericWood.name = 'Mẫu ảnh gỗ';
  const wood = categories.find(c => c.id === woodCategory.id);
  if (wood) wood.name = woodCategory.name;
  else categories.push({...woodCategory});
  if (!categories.some(c => c.id === paintCategory.id)) categories.push({...paintCategory});
  const kitchen = categories.find(c => c.id === kitchenCategory.id);
  if (kitchen) kitchen.subgroups = [...kitchenCategory.subgroups];
  else categories.push({...kitchenCategory});
  const ids = new Set(categories.map(c => c.id));
  const items = (Array.isArray(base.items) ? base.items : [])
    .filter(item => item && (kindOf(item) === 'paint' ? validHex(item.hex) && woodKey(item.code) : (imageName(item.full) && imageName(item.thumb)) || (kindOf(item) === 'wood' && woodKey(item.code))))
    .slice(0, 5000).map(item => ({
      id: String(item.id || crypto.randomUUID()).slice(0, 60),
      categoryId: ids.has(item.categoryId) ? item.categoryId : (categories[0]?.id || ''),
      ...itemMetadata(item),
      kind:kindOf(item),
      ...(imageName(item.originalFull) && imageName(item.originalThumb) ? {originalFull:item.originalFull,originalThumb:item.originalThumb} : {}),
      ...(item.square ? {square:true} : {}),
      ...(cleanDisplay(item.display) ? {display:item.display} : {}),
      ...(cleanView(item.view) ? {view:cleanView(item.view)} : {}),
      ...(Number.isFinite(item.order) ? {order:item.order} : {}),
      ...(item.builtin || item.id?.startsWith?.('ancuong-seed-') ? {builtin:true} : {}),
      ...(item.hidden ? {hidden:true} : {}),
      ...(kindOf(item) === 'paint' ? {hex:item.hex.toLowerCase()} : {}),
      name: text(item.name, 160),
      note: text(item.note, 500),
      ...(imageName(item.full) && imageName(item.thumb) ? {full:item.full,thumb:item.thumb} : {}),
      ...(woodKey(item.code) ? {...woodMeta(item),brand:text(item.brand,80) || (!Object.hasOwn(item,'brand') && kindOf(item) === 'wood' ? 'An Cường' : '')} : {}),
      createdAt: Number(item.createdAt) || Date.now(),
      ...(item.favorite === true ? {favorite:true} : {}),
      ...(Number.isFinite(item.lastUsedAt) && item.lastUsedAt > 0 ? {lastUsedAt:item.lastUsedAt} : {}),
      ...(Number(item.used) > 0 ? { used: Math.min(1e6, Math.floor(Number(item.used))) } : {})
    }));
  if (!base.woodSeeded) {
    const keys = new Set(items.filter(item => item.categoryId === woodCategory.id).map(woodItemKey));
    items.push(...woodSeed.filter(item => !keys.has(woodItemKey(item))));
  }
  if (!base.paintSeeded) {
    const keys = new Set(items.filter(item => item.kind === 'paint').map(woodItemKey));
    items.push(...paintSeed.filter(item => !keys.has(woodItemKey(item))));
  }
  return { _version: Number(base._version) || 0, categories, items,suppliers:(Array.isArray(base.suppliers) ? base.suppliers : []).map(supplierRecord).filter(item => item.name).slice(0,500),
    attributes:attributes.normalize({...base,categories}),imports:(Array.isArray(base.imports) ? base.imports : [])
      .slice(0,200).map(importHistory.normalize).filter(Boolean),woodSeeded:true,paintSeeded:true };
}

// Ghép tên nhóm vật liệu (vd "GẠCH ỐP LÁT (sảnh, WC, logia)") với một hạng mục thư viện.
function categoryForGroup(library, groupName) {
  const fold = value => String(value || '').normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/gi, 'd').toLowerCase()
    .replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  const target = fold(groupName);
  if (!target) return null;
  let best = null, bestScore = 0;
  for (const category of library.categories) {
    const names = [category.name, category.source].map(fold).filter(Boolean);
    for (const name of names) {
      if (name === target) return category;
      const a = new Set(name.split(' ')), b = target.split(' ');
      const overlap = b.filter(word => a.has(word)).length;
      const score = overlap / Math.max(a.size, b.length);
      if (score > bestScore) { bestScore = score; best = category; }
    }
  }
  return bestScore >= 0.5 ? best : null;
}

async function mutate(store, key, change, persist = data => store.put(key,data)) {
  const previous = queues.get(key) || Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const data = normalize(await store.get(key));
    const result = await change(data);
    data._version += 1;
    await persist(data,result);
    return { data, result };
  });
  queues.set(key, run);
  try { return await run; } finally { if (queues.get(key) === run) queues.delete(key); }
}

function mergeLibraryItems(data,body) {
  const ids = Array.isArray(body.ids) ? [...new Set(body.ids)] : [];
  if (ids.length < 2 || ids.length > 5000 || !ids.includes(body.targetId)) fail(400,'Chọn mã đích và ít nhất một mã khác.');
  const byId = new Map(data.items.map(item => [item.id,item]));
  const selected = ids.map(id => byId.get(id));
  if (selected.some(item => !item)) fail(404,'Có mã không thuộc thư viện của tài khoản.');
  const target = byId.get(body.targetId);
  target.tags = stringList(selected.flatMap(item => item.tags || []));
  target.suppliers = stringList(selected.flatMap(item => item.suppliers || []));
  target.brands = stringList(selected.flatMap(item => [item.brand,...(item.brands || [])]));
  target.used = Math.min(1e6,selected.reduce((sum,item) => sum+(item.used || 0),0));
  if (selected.some(item => item.favorite)) target.favorite = true;
  const lastUsedAt = Math.max(...selected.map(item => item.lastUsedAt || 0));
  if (lastUsedAt) target.lastUsedAt = lastUsedAt;
  const removed = new Set(ids.filter(id => id !== target.id));
  data.items = data.items.filter(item => !removed.has(item.id));
  return {removed,targetId:target.id};
}

function changeMaterialReferences(data,result) {
  const changes = [];
  const undo = new Map((result.undo?.changes || []).map(change => [JSON.stringify([change.sheetId,change.rowId,change.slot]),change]));
  for (const sheet of [...data.sheets,...(data.archivedSheets || [])]) for (const group of sheet.groups) for (const row of group.rows) {
    for (const [slot,pa] of row.options.entries()) {
      const from = pa.libraryItemId;
      const reversed = undo.get(JSON.stringify([sheet.id,row.id,slot]));
      const to = result.removed?.has(from) ? result.targetId : reversed && reversed.to === from ? reversed.from : undefined;
      if (!to) continue;
      pa.libraryItemId = to;
      changes.push({sheetId:sheet.id,rowId:row.id,slot,from,to});
    }
  }
  return changes;
}

async function mergeWithMaterials(store,key,dataKey,body) {
  const {MaterialStore} = require('./materials');
  const materialStore = new MaterialStore(store,dataKey);
  return mutate(store,key,data => {
    if (body.undo) {
      const undo = mergeUndo.get(key);
      if (!undo || undo.token !== body.undo || undo.version !== data._version || undo.expires <= Date.now()) {
        fail(409,'Thư viện đã thay đổi hoặc đã hết thời gian hoàn tác.');
      }
      data.items = undo.items;
      return {undo};
    }
    const items = structuredClone(data.items);
    return {...mergeLibraryItems(data,body),items};
  },async (data,result) => {
    const referenceUpdate = await materialStore.update(result.undo?.changes.length ? result.undo.materialVersion : undefined,materials => ({
      changes:changeMaterialReferences(materials,result)
    }),'_version',[[key,data]]);
    result.referenceChanges = referenceUpdate.changes;
    result.materialVersion = referenceUpdate._version;
    if (result.undo) mergeUndo.delete(key);
    else {
      const snapshot = {token:crypto.randomUUID(),items:result.items,version:data._version,changes:result.referenceChanges,
        materialVersion:result.materialVersion,expires:Date.now()+300000};
      mergeUndo.set(key,snapshot);
      result.undoToken = snapshot.token;
      setTimeout(() => { if (mergeUndo.get(key) === snapshot) mergeUndo.delete(key); },300000).unref();
    }
  });
}

async function handleLibrary(req, urlPath, { res, store, dataKey, readJsonBody, sendJson }) {
  const key = libraryKey(dataKey);
  if (urlPath === '/api/library/imports' && req.method === 'GET') {
    const data = normalize(await store.get(key));
    return sendJson(res,200,{imports:data.imports});
  }
  if (urlPath === '/api/library/attributes' && req.method === 'GET') {
    const data = normalize(await store.get(key));
    return sendJson(res,200,{categories:data.categories,attributes:Object.fromEntries(Object.keys(attributes.labels).map(key => [key,attributes.view(data,key)]))});
  }
  if (urlPath === '/api/library' && req.method === 'GET') {
    const stored = await store.get(key);
    if (!stored?.paintSeeded || !stored?.woodSeeded) {
      const {data} = await mutate(store,key,() => {});
      return sendJson(res,200,data);
    }
    return sendJson(res,200,normalize(stored));
  }
  if (req.method !== 'POST') fail(405, 'Phương thức không hỗ trợ.');
  const body = await readJsonBody(req);
  if (urlPath === '/api/library/imports') {
    const {data} = await mutate(store,key,data => importHistory.apply(data,body));
    return sendJson(res,200,data);
  }
  if (urlPath === '/api/library/attributes') {
    const {data} = await mutate(store,key,data => attributes.change(data,body,{size:materialSize}));
    return sendJson(res,200,data);
  }
  const ensure = async data => {
    if (!data.categories.length) Object.assign(data, defaultLibrary(), { _version: data._version, items: data.items });
  };

  if (urlPath === '/api/library/items') {
    const list = Array.isArray(body.items) ? body.items : [body];
    if (!list.length || list.length > 50) fail(400, 'Mỗi lần thêm từ 1 đến 50 ảnh.');
    const { data, result } = await mutate(store, key, async data => {
      await ensure(data);
      const categoryId = data.categories.some(c => c.id === body.categoryId) ? body.categoryId : null;
      if (!categoryId) fail(400, 'Chọn hạng mục cho ảnh.');
      const added = [];
      let skipped = 0;
      for (const item of list) {
        const kind = item.kind || (item.code && categoryId === woodCategory.id ? 'wood' : 'image');
        if (!['image','wood','paint'].includes(kind)) fail(400,'Loại mẫu không hợp lệ.');
        if (kind === 'paint' ? !validHex(item.hex) || !woodKey(item.code) : !imageName(item.full) || !imageName(item.thumb)) fail(400,'Mẫu vật liệu không hợp lệ.');
        const metadata = item.code ? {...woodMeta(item),brand:text(item.brand,80) || (kind === 'wood' ? 'An Cường' : '')} : {};
        const key = woodKey(metadata.code);
        const existing = data.items.find(entry => entry.categoryId === categoryId &&
          (key ? entry.code && woodItemKey(entry) === woodItemKey(metadata) : entry.kind === 'image' && entry.full === item.full));
        if (key && existing) {
          existing.suppliers = stringList([...(existing.suppliers || []),...stringList(item.suppliers)]);
          existing.tags = stringList([...(existing.tags || []),...stringList(item.tags)]);
          if (kind !== 'paint' && !existing.full) {
            Object.assign(existing,metadata,{name:text(item.name,160) || existing.name,full:item.full,thumb:item.thumb,view:cleanView(item.view),display:cleanDisplay(item.display)});
            added.push(existing);
          } else skipped++;
          continue;
        }
        if (existing) { added.push(existing); continue; }
        const entry = { id: crypto.randomUUID(), categoryId, name: text(item.name, 160), note: text(item.note, 500),
          kind,...(kind === 'paint' ? {hex:item.hex.toLowerCase()} : {full:item.full,thumb:item.thumb,view:cleanView(item.view),display:cleanDisplay(item.display)}),createdAt: Date.now(),...itemMetadata(item),...metadata,
          ...(imageName(item.originalFull) && imageName(item.originalThumb) ? {originalFull:item.originalFull,originalThumb:item.originalThumb,square:!!item.square} : {}) };
        data.items.unshift(entry);
        added.push(entry);
      }
      if (data.items.length > 5000) fail(400, 'Thư viện đã đủ 5.000 ảnh.');
      return {added,skipped};
    });
    return sendJson(res, 200, { ...data, ...result });
  }
  if (urlPath === '/api/library/items/bulk') {
    const {data,result} = await mutate(store,key,data => {
      if (body.undo) {
        const previous = bulkUndo.get(key);
        if (!previous || previous.token !== body.undo || previous.version !== data._version || previous.expires < Date.now()) {
          fail(409,'Thư viện đã thay đổi hoặc đã hết thời gian hoàn tác.');
        }
        data.items = previous.items;
        return {undoToken:null};
      }
      const ids = new Set(Array.isArray(body.ids) ? body.ids.slice(0,5000).filter(id => typeof id === 'string') : []);
      const original = structuredClone(data.items);
      const categoryId = body.categoryId;
      if (categoryId && !data.categories.some(category => category.id === categoryId)) fail(400,'Hạng mục không hợp lệ.');
      const set = body.set || {};
      const addTags = stringList(body.addTags), removeTags = new Set(stringList(body.removeTags));
      const addSuppliers = stringList(body.addSuppliers), removeSuppliers = new Set(stringList(body.removeSuppliers));
      const metadata = itemMetadata(set);
      for (const item of data.items) {
        if (!ids.has(item.id)) continue;
        if (categoryId) item.categoryId = categoryId;
        for (const field of ['brand','size']) if (Object.hasOwn(set,field)) item[field] = metadata[field];
        item.tags = stringList([...(item.tags || []),...addTags]).filter(tag => !removeTags.has(tag));
        item.suppliers = stringList([...(item.suppliers || []),...addSuppliers]).filter(name => !removeSuppliers.has(name));
      }
      if (body.delete === true) data.items = data.items.filter(item => !ids.has(item.id));
      if (Array.isArray(body.order)) {
        const ordered = new Map(body.order.slice(0,5000).map((id,index) => [id,index]));
        for (const item of data.items) if (ids.has(item.id) && ordered.has(item.id)) item.order = ordered.get(item.id);
      }
      return {undoToken:crypto.randomUUID(),items:original};
    });
    if (result.undoToken) {
      const snapshot = {token:result.undoToken,version:data._version,items:result.items,expires:Date.now()+300000};
      bulkUndo.set(key,snapshot);
      setTimeout(() => { if (bulkUndo.get(key) === snapshot) bulkUndo.delete(key); },300000).unref();
    } else bulkUndo.delete(key);
    return sendJson(res,200,{...data,undoToken:result.undoToken});
  }
  if (urlPath === '/api/library/items/merge') {
    const {data,result} = await mergeWithMaterials(store,key,dataKey,body || {});
    return sendJson(res,200,{...data,undoToken:result.undoToken || null,
      referenceChanges:result.referenceChanges,materialVersion:result.materialVersion});
  }
  if (urlPath === '/api/library/items/update') {
    const { data } = await mutate(store, key, data => {
      const item = data.items.find(entry => entry.id === body.id);
      if (!item) fail(404, 'Không tìm thấy ảnh.');
      if (typeof body.name === 'string') item.name = text(body.name, 160);
      if (typeof body.code === 'string' && body.code.trim() !== (item.code || '')) {
        const code = text(body.code,80);
        if (!code && (item.kind === 'paint' || !item.full)) fail(400,'Nhập mã mẫu.');
        if (code && data.items.some(entry => entry !== item && entry.code && woodItemKey(entry) === woodItemKey({...item,code}))) {
          fail(409,'Mã này đã có trong thư viện.');
        }
        item.code = code;
      }
      if (Object.hasOwn(body,'view')) item.view = cleanView(body.view);
      if (cleanDisplay(body.display)) item.display = body.display;
      if (typeof body.square === 'boolean') {
        if (![body.full,body.thumb,body.originalFull,body.originalThumb].every(imageName)) fail(400,'Ảnh gốc hoặc ảnh vuông không hợp lệ.');
        Object.assign(item,{square:body.square,full:body.full,thumb:body.thumb,originalFull:body.originalFull,originalThumb:body.originalThumb});
      }
      if (typeof body.hidden === 'boolean') item.hidden = body.hidden;
      if (item.kind === 'paint' && validHex(body.hex)) item.hex = body.hex.toLowerCase();
      const metadata = itemMetadata(body);
      for (const field of Object.keys(attributes.labels)) {
        if (Object.hasOwn(body,field)) item[field] = metadata[field];
      }
      if (typeof body.note === 'string') item.note = text(body.note, 500);
      if (data.categories.some(c => c.id === body.categoryId)) item.categoryId = body.categoryId;
      if (typeof body.favorite === 'boolean') item.favorite = body.favorite;
      if (body.used === true) {
        item.used = Math.min(1e6,(item.used || 0) + 1);
        item.lastUsedAt = Date.now();
      }
    });
    return sendJson(res, 200, data);
  }
  if (urlPath === '/api/library/items/delete') {
    const ids = new Set(Array.isArray(body.ids) ? body.ids : [body.id]);
    const { data } = await mutate(store, key, data => { data.items = data.items.filter(item => !ids.has(item.id)); });
    return sendJson(res, 200, data);
  }
  if (urlPath === '/api/library/suppliers') {
    const supplier = supplierRecord(body);
    if (!supplier.name) fail(400,'Nhập tên đơn vị cung cấp.');
    const {data} = await mutate(store,key,data => {
      const previous = text(body.previousName,80) || supplier.name;
      data.suppliers = data.suppliers.filter(item => item.name !== previous && item.name !== supplier.name);
      data.suppliers.push(supplier);
      if (previous !== supplier.name) for (const item of data.items) {
        item.suppliers = stringList((item.suppliers || []).map(name => name === previous ? supplier.name : name));
      }
    });
    return sendJson(res,200,data);
  }
  if (urlPath === '/api/library/categories') {
    const name = text(body.name, 80);
    if (!name) fail(400, 'Nhập tên hạng mục.');
    const { data, result } = await mutate(store, key, async data => {
      await ensure(data);
      if (body.id) {
        const category = data.categories.find(c => c.id === body.id);
        if (!category) fail(404, 'Không tìm thấy hạng mục.');
        category.name = name;
        return category;
      }
      const existing = data.categories.find(c => c.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'));
      if (existing) return existing;
      const category = { id: 'cat-' + crypto.randomUUID().slice(0, 8), name };
      data.categories.push(category);
      return category;
    });
    return sendJson(res, 200, { ...data, category: result });
  }
  if (urlPath === '/api/library/categories/delete') {
    if (body.id === woodCategory.id) fail(400,'Không thể xoá hạng mục Mã gỗ.');
    const { data } = await mutate(store, key, data => {
      if (data.items.some(item => item.categoryId === body.id)) fail(409, 'Hạng mục còn ảnh. Chuyển hoặc xoá ảnh trước.');
      data.categories = data.categories.filter(c => c.id !== body.id);
    });
    return sendJson(res, 200, data);
  }
  if (urlPath === '/api/library/categories/order') {
    const order = Array.isArray(body.order) ? body.order : [];
    const { data } = await mutate(store, key, data => {
      const rank = new Map(order.map((id, index) => [id, index]));
      data.categories.sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9));
    });
    return sendJson(res, 200, data);
  }
  fail(404, 'API thư viện không tồn tại.');
}

module.exports = { handleLibrary, libraryKey, defaultLibrary, normalize, categoryForGroup, cleanView, cleanDisplay, materialSize };
