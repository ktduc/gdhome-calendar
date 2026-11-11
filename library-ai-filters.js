const clean = value => typeof value === 'string' ? value.trim().slice(0,160) : '';
function filterItems(input) {
  const seen = new Set();
  return (Array.isArray(input) ? input : []).slice(0,200).flatMap(item => {
    const id = clean(item?.id), name = clean(item?.name), code = clean(item?.code);
    if (!id || seen.has(id) || (!name && !code)) return [];
    seen.add(id); return [{id,name,code}];
  });
}
function filterGroups(input,items) {
  const ids = new Set(items.map(item => item.id)), groups = new Map();
  for (const group of (Array.isArray(input) ? input : []).slice(0,40)) {
    const label = clean(group?.label).slice(0,80);
    if (!label || !Array.isArray(group.ids)) continue;
    const key = label.toLocaleLowerCase('vi');
    if (!groups.has(key)) groups.set(key,{label,ids:new Set()});
    for (const id of group.ids) if (ids.has(id)) groups.get(key).ids.add(id);
  }
  return [...groups.values()].filter(group => group.ids.size).map(group => ({label:group.label,ids:[...group.ids]}));
}
module.exports = {filterItems,filterGroups};
