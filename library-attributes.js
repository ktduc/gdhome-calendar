(() => {
  const labels = {size:'Kích thước',brand:'Thương hiệu',suppliers:'Đơn vị cung cấp',material:'Loại vật liệu',tone:'Tông màu',
    finish:'Bề mặt',collection:'Bộ sưu tập',subgroup:'Nhóm con phụ kiện',tags:'Tag'};
  const facetLabels = {favorite:'★ Yêu thích',review:'Duyệt mẫu',size:labels.size,brand:labels.brand,suppliers:labels.suppliers,
    material:labels.material,finish:labels.finish,collection:labels.collection,subgroup:'Nhóm phụ kiện',
    cabinetWidth:'Rộng tủ',tone:'Tông màu',grain:'Vân',tags:labels.tags};
  const listFields = new Set(['suppliers','tags','brands']);
  const clean = (value,max = 120) => typeof value === 'string' ? value.trim().replace(/\s+/g,' ').slice(0,max) : '';
  const keyFor = name => clean(name).toLocaleLowerCase('vi');
  function parsePrice(value) {
    if (typeof value === 'string') {
      value = value.trim();
      if (!/^(?:\d+(?:[.,]\d{1,2})?|\d{1,3}(?:[.,\s]\d{3})+)$/.test(value)) return;
      value = Number(/^[\d]+[.,]\d{1,2}$/.test(value) ? value.replace(',','.') : value.replace(/[.,\s]/g,''));
    }
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e10) return value;
  }
  function priceFields(item) {
    const price = parsePrice(item.price);
    const priceUnit = clean(item.priceUnit ?? (price !== undefined && !item.priceUpdatedAt ? item.unit : ''),30);
    const priceNote = clean(item.priceNote,300);
    return {...(price === undefined ? {} : {price}),...(priceUnit ? {priceUnit} : {}),...(priceNote ? {priceNote} : {}),
      ...(Number.isSafeInteger(item.priceUpdatedAt) && item.priceUpdatedAt > 0 ? {priceUpdatedAt:item.priceUpdatedAt} : {})};
  }
  function updatePrice(item,patch) {
    const keys = ['price','priceUnit','priceNote'].filter(key => Object.hasOwn(patch,key));
    const fields = priceFields(patch);
    for (const key of keys) {
      if (item[key] === fields[key]) continue;
      if (fields[key] === undefined) delete item[key];
      else item[key] = fields[key];
      item.priceUpdatedAt = Date.now();
    }
  }
  const fail = (status,message) => { throw Object.assign(new Error(message),{status}); };
  const fields = key => key === 'brand' ? ['brand','brands'] : [key];
  const isCustom = key => /^custom-[a-z0-9]{8,36}$/.test(key);
  const isSource = key => /^(?:ac|web)-[a-z0-9-]{1,55}$/.test(key);
  const palette = {'Be':'#d8c4a3','Cam':'#ef8d29','Đen':'#202020','Đỏ':'#bf3336','Hồng':'#e98baa','Nâu':'#754d35',
    'Tím':'#8862a4','Trắng':'#faf9f4','Xám':'#8c9096','Xanh Dương':'#3674a6','Xanh Lá':'#618747','Vàng':'#e6c342'};
  const colorHex = value => Object.entries(palette).find(([name]) => keyFor(name) === keyFor(value))?.[1];
  const inferredFields = input => ['ac-mau-sac','tone','material'].filter(key => Array.isArray(input) && input.includes(key));
  function estimatePhoto(pixels,width,height) {
    const samples = [[],[],[]], lights = [];
    let horizontal = 0, vertical = 0;
    for (let y=0;y<height;y++) for (let x=0;x<width;x++) {
      const index = y*width+x, p = index*4;
      for (let i=0;i<3;i++) samples[i].push(pixels[p+i]);
      const light = .2126*pixels[p]+.7152*pixels[p+1]+.0722*pixels[p+2];
      lights.push(light);
      if (x) horizontal += Math.abs(light-lights[index-1]);
      if (y) vertical += Math.abs(light-lights[index-width]);
    }
    const [r,g,b] = samples.map(channel => channel.sort((a,b) => a-b)[channel.length>>1]);
    const light = .2126*r+.7152*g+.0722*b;
    let color;
    if (Math.max(r,g,b)-Math.min(r,g,b) < 20) color = light < 62 ? 'Đen' : light > 213 ? 'Trắng' : 'Xám';
    else {
      const distance = hex => [r,g,b].reduce((sum,value,i) => sum+(value-parseInt(hex.slice(1+i*2,3+i*2),16))**2,0);
      color = Object.entries(palette).sort((a,b) => distance(a[1])-distance(b[1]))[0][0];
    }
    const average = lights.reduce((sum,value) => sum+value,0)/lights.length;
    const deviation = Math.sqrt(lights.reduce((sum,value) => sum+(value-average)**2,0)/lights.length);
    const texture = (horizontal+vertical)/(2*lights.length);
    const directional = Math.abs(horizontal-vertical)/Math.max(1,horizontal+vertical);
    return {color,tone:light >= 145 ? 'Sáng' : 'Tối',
      material:deviation < 9 || texture < 2.5 ? 'Đơn sắc' : directional >= .22 ? 'Vân gỗ' : 'Vân đá'};
  }
  function normalizeSourceFacets(input,maxValues = 60) {
    const groups = new Map();
    for (const group of (Array.isArray(input) ? input : []).slice(0,100)) {
      const {key} = group || {}, label = clean(group?.label,60);
      if (!isSource(key) || !label) continue;
      const values = (Array.isArray(group.values) ? group.values : []).map(value => clean(value)).filter(Boolean);
      if (!values.length) continue;
      const previous = groups.get(key);
      groups.set(key,{key,label,order:Number.isInteger(group.order) ? Math.max(0,Math.min(99,group.order)) : previous?.order ?? groups.size,
        values:[...new Map([...(previous?.values || []),...values].map(value => [keyFor(value),value])).values()].slice(0,maxValues)});
    }
    return [...groups.values()].sort((a,b) => a.order-b.order).slice(0,24);
  }
  function sourceFacetGroups(items,categoryId,schema = []) {
    const groups = new Map(schema.map(group => [group.key,group]));
    for (const item of items || []) {
      if (categoryId && item.categoryId !== categoryId) continue;
      for (const group of item.sourceFacets || []) if (!groups.has(group.key)) groups.set(group.key,group);
    }
    return [...groups.values()].sort((a,b) => a.order-b.order).map(({key,label,order}) => ({key,label,order}));
  }
  function mergeSourceSchema(data,categoryId,groups) {
    if (!Array.isArray(groups) || !groups.length) return;
    data.catalogueFilterGroups ||= {};
    data.catalogueFilterGroups[categoryId] = normalizeSourceFacets([...(data.catalogueFilterGroups[categoryId] || []),...groups],200);
  }
  const values = (item,key) => (isSource(key) ? item.sourceFacets?.find(group => group.key === key)?.values || [] :
    isCustom(key) ? [item.customAttributes?.[key]] :
    fields(key).flatMap(field => [item[field]].flat())).filter(value => clean(value));

  function normalizeGroups(data) {
    const names = new Set(Object.values(labels).map(keyFor)), keys = new Set();
    return (Array.isArray(data.attributeGroups) ? data.attributeGroups : []).slice(0,24).flatMap(group => {
      const name = clean(group?.name,60), key = group?.key;
      if (!isCustom(key) || !name || names.has(keyFor(name)) || keys.has(key)) return [];
      names.add(keyFor(name)); keys.add(key);
      return [{key,name}];
    });
  }
  const groupLabels = data => ({...labels,...Object.fromEntries(normalizeGroups(data).map(({key,name}) => [key,name])),
    ...Object.fromEntries(sourceFacetGroups(data.items,undefined,Object.values(data.catalogueFilterGroups || {}).flat()).map(({key,label}) => [key,label]))});
  function createGroup(data,{key,name}) {
    const groups = normalizeGroups(data);
    const group = {key,name:clean(name,60)};
    if (!isCustom(key) || !group.name || groups.length >= 24) fail(400,'Nhập tên nhóm hợp lệ. Tối đa 24 nhóm tuỳ chỉnh.');
    if (groups.some(entry => entry.key === key) || Object.values(groupLabels(data)).some(label => keyFor(label) === keyFor(group.name))) {
      fail(409,'Nhóm thuộc tính đã tồn tại.');
    }
    data.attributeGroups = [...groups,group];
    return group;
  }
  function customValues(input,groups) {
    return Object.fromEntries(groups.flatMap(({key}) => {
      const value = clean(input?.[key]);
      return value ? [[key,value]] : [];
    }));
  }
  function filterConfig(data,categoryId,input = data.filterPreferences?.[categoryId]) {
    const defaults = Object.entries(facetLabels).filter(([key]) => key !== 'favorite').map(([key,label]) =>
      ({key,label,visible:true,collapsed:false}));
    for (const {key,name} of normalizeGroups(data)) defaults.push({key,label:name,visible:false,collapsed:false});
    for (const {key,label} of sourceFacetGroups(data.items,categoryId,data.catalogueFilterGroups?.[categoryId])) {
      defaults.push({key,label,visible:true,collapsed:false});
    }
    const available = new Map(defaults.map(group => [group.key,group])), chosen = [];
    for (const row of Array.isArray(input) ? input : []) {
      const group = available.get(row?.key);
      if (!group) continue;
      available.delete(row.key);
      chosen.push({key:group.key,label:clean(row.label,60) || group.label,visible:row.visible === true,collapsed:row.collapsed === true});
    }
    return [...chosen,...available.values()];
  }
  function normalizeFilters(data) {
    return Object.fromEntries(data.categories.filter(({id}) => Array.isArray(data.filterPreferences?.[id]))
      .map(({id}) => [id,filterConfig(data,id)]));
  }
  function saveFilters(data,{categoryId,groups,collapsedKey,collapsed}) {
    if (!data.categories.some(category => category.id === categoryId)) fail(404,'Hạng mục không còn tồn tại.');
    data.filterPreferences = normalizeFilters(data);
    if (collapsedKey) {
      const config = filterConfig(data,categoryId);
      const group = config.find(group => group.key === collapsedKey);
      if (!group) fail(400,'Nhóm bộ lọc không tồn tại.');
      group.collapsed = collapsed === true;
      data.filterPreferences[categoryId] = config;
    } else if (groups === null) delete data.filterPreferences[categoryId];
    else {
      if (!Array.isArray(groups) || groups.length > 70) fail(400,'Cấu hình bộ lọc không hợp lệ.');
      data.filterPreferences[categoryId] = filterConfig(data,categoryId,groups);
    }
  }
  function filterPresets(data) {
    const ids = new Set(data.categories.map(category => category.id));
    return (Array.isArray(data.filterPresets) ? data.filterPresets : []).slice(0,100).flatMap(item => {
      const id = clean(item?.id,60), name = clean(item?.name,60), categoryId = item?.categoryId;
      if (!/^[a-z0-9-]{1,60}$/i.test(id) || !name || !ids.has(categoryId)) return [];
      const facets = Object.fromEntries(Object.entries(item.facets || {}).filter(([key]) =>
        Object.hasOwn(facetLabels,key) || isSource(key) || isCustom(key)).map(([key,values]) =>
        [key,[...new Set((Array.isArray(values) ? values : []).slice(0,60).map(value => clean(value)).filter(Boolean))]]));
      return [{id,name,categoryId,query:clean(item.query,160),facets}];
    });
  }
  function saveFilterPreset(data,patch) {
    const previous = filterPresets(data);
    if (patch.remove) {
      data.filterPresets = previous.filter(item => item.id !== patch.id);
      return;
    }
    const [preset] = filterPresets({...data,filterPresets:[patch]});
    if (!preset) fail(400,'Tên hoặc hạng mục của bộ lọc không hợp lệ.');
    const same = previous.find(item => item.categoryId === preset.categoryId && keyFor(item.name) === keyFor(preset.name));
    if (same) preset.id = same.id;
    if (!same && previous.length >= 100) fail(400,'Tối đa 100 bộ lọc nhanh.');
    data.filterPresets = [...previous.filter(item => item.id !== preset.id),preset];
  }

  function normalize(data) {
    const ids = new Set(data.categories.map(category => category.id));
    return Object.fromEntries(Object.keys(groupLabels(data)).flatMap(key => {
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
    for (const [categoryId,groups] of Object.entries(data.catalogueFilterGroups || {})) {
      for (const value of groups.find(group => group.key === key)?.values || []) {
        const row = add(value);
        if (!row.categoryIds.includes(categoryId)) row.categoryIds = [...row.categoryIds,categoryId];
      }
    }
    for (const item of data.items) {
      const seen = new Set();
      for (const value of values(item,key)) {
        const row = add(value), id = keyFor(value);
        if (row && !seen.has(id)) {
          row.count++;
          if (isSource(key) && !row.categoryIds.includes(item.categoryId)) row.categoryIds = [...row.categoryIds,item.categoryId];
        }
        seen.add(id);
      }
    }
    return [...rows.values()];
  }

  function change(data,patch,{size = value => value} = {}) {
    const {key,action} = patch || {};
    if (!Object.hasOwn(groupLabels(data),key)) fail(400,'Thuộc tính không hợp lệ.');
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

    for (const item of data.items) {
      if (isSource(key)) {
        const group = item.sourceFacets?.find(entry => entry.key === key);
        if (group) group.values = [...new Set(group.values.map(value => replaced.has(keyFor(value)) ? replacement : value).filter(Boolean))];
        continue;
      }
      if (isCustom(key)) {
        if (replaced.has(keyFor(item.customAttributes?.[key]))) {
          if (replacement) item.customAttributes[key] = replacement;
          else delete item.customAttributes[key];
        }
        continue;
      }
      for (const field of fields(key)) {
        if (listFields.has(field) && Array.isArray(item[field])) {
          item[field] = [...new Map(item[field].map(value => replaced.has(keyFor(value)) ? replacement : value)
            .filter(Boolean).map(value => [keyFor(value),value])).values()];
        } else if (replaced.has(keyFor(item[field]))) item[field] = replacement;
      }
    }
    if (isSource(key)) for (const groups of Object.values(data.catalogueFilterGroups || {})) {
      const group = groups.find(entry => entry.key === key);
      if (group) group.values = [...new Set(group.values.map(value => replaced.has(keyFor(value)) ? replacement : value).filter(Boolean))];
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
  const removedSystemCategories = data => new Set(Array.isArray(data.removedSystemCategories) ?
    data.removedSystemCategories.filter(id => !canMergeCategory(id)) : []);

  function removeCategory(data,id) {
    if (!data.categories.some(category => category.id === id)) return;
    if (data.items.some(item => item.categoryId === id)) fail(409,'Hạng mục còn mẫu. Chuyển hoặc xoá mẫu trước.');
    data.categories = data.categories.filter(category => category.id !== id);
    if (data.catalogueFilterGroups) delete data.catalogueFilterGroups[id];
    if (!canMergeCategory(id)) {
      const removed = removedSystemCategories(data);
      removed.add(id);
      data.removedSystemCategories = [...removed];
    }
  }

  function mergeCategories(data,{sourceId,targetId}) {
    if (!sourceId || !targetId || sourceId === targetId) fail(400,'Chọn hai hạng mục khác nhau.');
    if (!canMergeCategory(sourceId)) fail(400,'Hạng mục hệ thống chỉ có thể dùng làm đích gộp.');
    const source = data.categories.find(category => category.id === sourceId);
    const target = data.categories.find(category => category.id === targetId);
    if (!source || !target) fail(404,'Hạng mục đã thay đổi. Hãy chọn lại.');

    target.aliases = [...new Set([...(target.aliases || []),source.name,source.source,...(source.aliases || [])].filter(Boolean))];
    for (const item of data.items) if (item.categoryId === sourceId) item.categoryId = targetId;
    for (const record of data.imports || []) if (record.categoryId === sourceId) record.categoryId = targetId;
    for (const preset of data.filterPresets || []) if (preset.categoryId === sourceId) preset.categoryId = targetId;
    mergeSourceSchema(data,targetId,data.catalogueFilterGroups?.[sourceId]);
    if (data.catalogueFilterGroups) delete data.catalogueFilterGroups[sourceId];
    for (const rows of Object.values(data.attributes || {})) for (const row of rows) {
      if (row.categoryIds?.includes(sourceId)) {
        row.categoryIds = [...new Set(row.categoryIds.map(id => id === sourceId ? targetId : id))];
      }
    }
    data.categories = data.categories.filter(category => category.id !== sourceId);
  }

  const api = {labels,facetLabels,groupLabels,normalizeGroups,createGroup,customValues,isCustom,isSource,normalizeSourceFacets,sourceFacetGroups,mergeSourceSchema,
    palette,colorHex,inferredFields,estimatePhoto,filterConfig,normalizeFilters,saveFilters,filterPresets,saveFilterPreset,parsePrice,priceFields,updatePrice,
    normalize,view,change,canMergeCategory,removedSystemCategories,removeCategory,mergeCategories};
  if (typeof module !== 'undefined') module.exports = api;
  else window.GDHomeLibraryAttributes = api;
})();
