// Thư viện dữ liệu dùng chung (ảnh mẫu vật liệu theo hạng mục) cho mọi công cụ GD HOME.
// Ảnh nằm trong kho ảnh Chốt mã của tài khoản (/api/materials/assets), nên dùng thẳng cho ô PA mà không cần sao chép.
const crypto = require('node:crypto');
const materialTemplate = require('./material-template');
const { imageName } = require('./material-assets');

const libraryKey = dataKey => 'lib-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');
const text = (value, max = 160) => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, max) : '';
const shortName = name => text(name.replace(/\s*\(.*\)\s*$/, ''), 80) || text(name, 80);
const queues = new Map();
const woodCategory = {id:'ancuong-wood',name:'Mã gỗ'};
const woodSeed = require('./data/wood-ancuong.json').woods.map((wood,i) => ({
  ...wood,id:'ancuong-seed-' + i,categoryId:woodCategory.id,brand:'An Cường',finish:'',kind:'wood',builtin:true,createdAt:1
}));
const paintCategory = {id:'cat-3',name:'SƠN TƯỜNG / TRẦN'};
const paintSeed = ['dulux','jotun'].flatMap(key => {
  const {brand,colors} = require('./data/paint-' + key + '.json');
  return colors.map((color,index) => ({...color,id:'paint-' + key + '-' + index,categoryId:paintCategory.id,kind:'paint',brand,builtin:true,createdAt:1}));
});
const validHex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const kindOf = item => item.kind || (item.code ? 'wood' : 'image');
const woodKey = code => text(code,80).toUpperCase().replace(/\s+/g,'');
const woodItemKey = item => text(item.brand || 'An Cường',80).toLowerCase() + ':' + woodKey(item.code);
const woodMeta = item => ({brand:text(item.brand,80) || 'An Cường',code:text(item.code,80),collection:text(item.collection,120),finish:text(item.finish,120)});

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
  const ids = new Set(categories.map(c => c.id));
  const items = (Array.isArray(base.items) ? base.items : [])
    .filter(item => item && (kindOf(item) === 'paint' ? validHex(item.hex) && woodKey(item.code) : (imageName(item.full) && imageName(item.thumb)) || (kindOf(item) === 'wood' && woodKey(item.code))))
    .slice(0, 5000).map(item => ({
      id: String(item.id || crypto.randomUUID()).slice(0, 60),
      categoryId: ids.has(item.categoryId) ? item.categoryId : (categories[0]?.id || ''),
      kind:kindOf(item),
      ...(item.builtin || item.id?.startsWith?.('ancuong-seed-') ? {builtin:true} : {}),
      ...(item.hidden ? {hidden:true} : {}),
      ...(kindOf(item) === 'paint' ? {hex:item.hex.toLowerCase()} : {}),
      name: text(item.name, 160),
      note: text(item.note, 500),
      ...(imageName(item.full) && imageName(item.thumb) ? {full:item.full,thumb:item.thumb} : {}),
      ...(woodKey(item.code) ? woodMeta(item) : {}),
      createdAt: Number(item.createdAt) || Date.now(),
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
  return { _version: Number(base._version) || 0, categories, items,woodSeeded:true,paintSeeded:true };
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

async function mutate(store, key, change) {
  const previous = queues.get(key) || Promise.resolve();
  const run = previous.catch(() => {}).then(async () => {
    const data = normalize(await store.get(key));
    const result = await change(data);
    data._version += 1;
    await store.put(key, data);
    return { data, result };
  });
  queues.set(key, run);
  try { return await run; } finally { if (queues.get(key) === run) queues.delete(key); }
}

async function handleLibrary(req, urlPath, { res, store, dataKey, readJsonBody, sendJson }) {
  const key = libraryKey(dataKey);
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
        const metadata = kind === 'image' ? {} : woodMeta(item);
        const key = woodKey(metadata.code);
        const existing = data.items.find(entry => (key ? entry.kind === kind && woodItemKey(entry) === woodItemKey(metadata) : entry.categoryId === categoryId && entry.kind === 'image' && entry.full === item.full));
        if (key && existing) {
          if (kind === 'wood' && !existing.full) {
            Object.assign(existing,metadata,{name:text(item.name,160) || existing.name,full:item.full,thumb:item.thumb});
            added.push(existing);
          } else skipped++;
          continue;
        }
        if (existing) { added.push(existing); continue; }
        const entry = { id: crypto.randomUUID(), categoryId, name: text(item.name, 160), note: text(item.note, 500),
          kind,...(kind === 'paint' ? {hex:item.hex.toLowerCase()} : {full:item.full,thumb:item.thumb}),createdAt: Date.now(),...metadata };
        data.items.unshift(entry);
        added.push(entry);
      }
      if (data.items.length > 5000) fail(400, 'Thư viện đã đủ 5.000 ảnh.');
      return {added,skipped};
    });
    return sendJson(res, 200, { ...data, ...result });
  }
  if (urlPath === '/api/library/items/update') {
    const { data } = await mutate(store, key, data => {
      const item = data.items.find(entry => entry.id === body.id);
      if (!item) fail(404, 'Không tìm thấy ảnh.');
      if (typeof body.name === 'string') item.name = text(body.name, 160);
      if (typeof body.hidden === 'boolean') item.hidden = body.hidden;
      if (item.kind === 'paint' && validHex(body.hex)) item.hex = body.hex.toLowerCase();
      if (typeof body.note === 'string') item.note = text(body.note, 500);
      if (data.categories.some(c => c.id === body.categoryId)) item.categoryId = body.categoryId;
      if (body.used === true) item.used = (item.used || 0) + 1;
    });
    return sendJson(res, 200, data);
  }
  if (urlPath === '/api/library/items/delete') {
    const ids = new Set(Array.isArray(body.ids) ? body.ids : [body.id]);
    const { data } = await mutate(store, key, data => { data.items = data.items.filter(item => !ids.has(item.id)); });
    return sendJson(res, 200, data);
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

module.exports = { handleLibrary, libraryKey, defaultLibrary, normalize, categoryForGroup, cleanView };
