(() => {
  const labels = {size:'Kích thước',brand:'Thương hiệu',suppliers:'Đơn vị cung cấp',material:'Loại vật liệu',
    finish:'Bề mặt',collection:'Bộ sưu tập',subgroup:'Nhóm con phụ kiện',tags:'Tag'};
  const listFields = new Set(['suppliers','tags','brands']);
  const clean = (value,max = 120) => typeof value === 'string' ? value.trim().replace(/\s+/g,' ').slice(0,max) : '';
  const keyFor = name => clean(name).toLocaleLowerCase('vi');
  const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };
  const fields = key => key === 'brand' ? ['brand','brands'] : [key];
  const values = (item,key) => fields(key).flatMap(field => [item[field]].flat()).filter(value => clean(value));

  function normalize(data) {
    const ids = new Set(data.categories.map(category => category.id));
    return Object.fromEntries(Object.keys(labels).flatMap(key => {
      if (!Array.isArray(data.attributes?.[key])) return [];
      const seen = new Set();
      return [[key,data.attributes[key].slice(0,5000).flatMap(entry => {
        const name = clean(entry?.name);
        if (!name || seen.has(keyFor(name))) return [];
        seen.add(keyFor(name));
        const categoryIds = [...new Set(Array.isArray(entry.categoryIds) ? entry.categoryIds.filter(id => ids.has(id)) : [])];
        return [{name,categoryIds,...(key === 'suppliers' ? {phone:clean(entry.phone,40),note:clean(entry.note,300)} : {})}];
      })]];
    }));
  }

  function view(data,key) {
    const rows = new Map((data.attributes?.[key] || []).map(row => [keyFor(row.name),{...row,count:0}]));
    function add(name,extra = {}) {
      const id = keyFor(name);
      if (!id) return null;
      if (!rows.has(id)) rows.set(id,{name:clean(name),categoryIds:[],count:0,...extra});
      return rows.get(id);
    }
    if (key === 'suppliers') for (const entry of data.suppliers || []) add(entry.name,{phone:entry.phone,note:entry.note});
    for (const item of data.items) {
      const seen = new Set();
      for (const value of values(item,key)) {
        const row = add(value), id = keyFor(value);
        if (row && !seen.has(id)) row.count++;
        seen.add(id);
      }
    }
    return [...rows.values()];
  }

  function change(data,patch,{size = value => value} = {}) {
    const {key,action} = patch || {};
    if (!Object.hasOwn(labels,key)) fail(400,'Thuộc tính không hợp lệ.');
    const name = value => key === 'size' ? size(clean(value)) : clean(value,key === 'suppliers' || key === 'tags' || key === 'brand' || key === 'material' || key === 'subgroup' ? 80 : 120);
    const rows = view(data,key);
    const find = value => rows.find(row => keyFor(row.name) === keyFor(value));
    const previous = patch.previous ? find(patch.previous) : null;
    let replaced = new Set(), replacement = '', result;
    if (action === 'save') {
      replacement = name(patch.name);
      if (!replacement) fail(400,'Nhập giá trị hợp lệ.');
      if (patch.previous && !previous) fail(404,'Không tìm thấy giá trị thuộc tính.');
      if (find(replacement) && find(replacement) !== previous) fail(409,'Giá trị đã có. Dùng Gộp để hợp nhất.');
      if (previous) replaced.add(keyFor(previous.name));
      result = {name:replacement,categoryIds:Array.isArray(patch.categoryIds) ? patch.categoryIds : (previous?.categoryIds || [])};
      if (key === 'suppliers') Object.assign(result,{phone:clean(patch.phone ?? previous?.phone,40),note:clean(patch.note ?? previous?.note,300)});
    } else if (action === 'merge') {
      const target = find(patch.target);
      const selected = [...new Set((Array.isArray(patch.names) ? patch.names : []).map(find))];
      if (!target || selected.includes(undefined) || !selected.includes(target) || selected.length < 2) fail(400,'Chọn ít nhất hai giá trị và một giá trị đích.');
      replaced = new Set(selected.map(row => keyFor(row.name)));
      replacement = target.name;
      result = {...target,categoryIds:selected.some(row => !row.categoryIds.length) ? [] : [...new Set(selected.flatMap(row => row.categoryIds))]};
      if (key === 'suppliers') for (const field of ['phone','note']) result[field] ||= selected.find(row => row[field])?.[field] || '';
    } else if (action === 'delete') {
      if (!previous) fail(404,'Không tìm thấy giá trị thuộc tính.');
      if (previous.count && patch.confirm !== true) fail(409,'Giá trị đang được dùng. Cần xác nhận xoá.');
      replaced.add(keyFor(previous.name));
    } else if (action === 'move') {
      if (!previous || ![-1,1].includes(patch.step)) fail(400,'Thứ tự không hợp lệ.');
      const index = rows.indexOf(previous), next = index + patch.step;
      if (next >= 0 && next < rows.length) [rows[index],rows[next]] = [rows[next],rows[index]];
    } else fail(400,'Thao tác thuộc tính không hợp lệ.');

    for (const item of data.items) for (const field of fields(key)) {
      if (listFields.has(field) && Array.isArray(item[field])) {
        item[field] = [...new Map(item[field].map(value => replaced.has(keyFor(value)) ? replacement : value)
          .filter(Boolean).map(value => [keyFor(value),value])).values()];
      } else if (replaced.has(keyFor(item[field]))) item[field] = replacement;
    }
    let next = rows.filter(row => !replaced.has(keyFor(row.name)));
    if (result) {
      const original = action === 'merge' ? find(patch.target) : previous;
      const index = original ? rows.slice(0,rows.indexOf(original)).filter(row => !replaced.has(keyFor(row.name))).length : next.length;
      next.splice(index,0,result);
    }
    data.attributes = normalize({...data,attributes:{...data.attributes,[key]:next}});
    if (key === 'suppliers') data.suppliers = data.attributes[key].map(({name,phone,note}) => ({name,phone,note}));
  }

  const canMergeCategory = id => !['ancuong-wood','cat-3','kitchen-accessories'].includes(id);
  function mergeCategories(data,{sourceId,targetId}) {
    if (!sourceId || !targetId || sourceId === targetId) fail(400,'Chọn hai hạng mục khác nhau.');
    if (!canMergeCategory(sourceId)) fail(400,'Hạng mục hệ thống chỉ có thể dùng làm đích gộp.');
    const source = data.categories.find(category => category.id === sourceId);
    const target = data.categories.find(category => category.id === targetId);
    if (!source || !target) fail(404,'Hạng mục đã thay đổi. Hãy chọn lại.');

    target.aliases = [...new Set([...(target.aliases || []),source.name,source.source,...(source.aliases || [])].filter(Boolean))];
    for (const item of data.items) if (item.categoryId === sourceId) item.categoryId = targetId;
    for (const record of data.imports || []) if (record.categoryId === sourceId) record.categoryId = targetId;
    for (const rows of Object.values(data.attributes || {})) for (const row of rows) {
      if (row.categoryIds?.includes(sourceId)) {
        row.categoryIds = [...new Set(row.categoryIds.map(id => id === sourceId ? targetId : id))];
      }
    }
    data.categories = data.categories.filter(category => category.id !== sourceId);
  }

  const api = {labels,normalize,view,change,canMergeCategory,mergeCategories};
  if (typeof module !== 'undefined') module.exports = api;
  else window.GDHomeLibraryAttributes = api;
})();
