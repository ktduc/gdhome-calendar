(function(root,factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GDHomeProductLines = api;
})(typeof window === 'object' ? window : globalThis,() => {
  const fields = ['gallery','lineId','lineName','description','features','otherSpecs','drawing','video','warranty','series','clearance','pairing','kemTu','note'];
  function metadata(item) {
    return Object.fromEntries(fields.filter(key => Object.hasOwn(item,key)).map(key => [key,
      Array.isArray(item[key]) ? item[key].slice(0,30).map(value => String(value).slice(0,500)) : String(item[key] ?? '').slice(0,key === 'description' ? 3000 : 1000)]));
  }
  function group(items) {
    const groups = new Map();
    for (const item of items) {
      const key = item.lineId ? item.categoryId + ':' + item.lineId : item.id;
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(item);
    }
    return [...groups.values()];
  }
  function tableRow(text) {
    const code = text.match(/\b[A-Z]{1,6}\d{2,}(?:[.-][A-Z0-9]+)*[A-Z0-9]*\b/i)?.[0];
    const spec = text.match(/R\s*\d{2,4}\s*[x×*]\s*S\s*\d{2,4}\s*[x×*]\s*C\s*\d{2,4}/i)?.[0];
    if (!code || !spec) return null;
    const after = text.slice(text.indexOf(spec)+spec.length);
    const price = after.match(/\d{1,3}(?:[.,]\d{3}){2,3}|\b\d{6,10}\b/)?.[0];
    const cabinetWidth = after.match(/\b\d{3,4}\b/)?.[0] || spec.match(/R\s*(\d+)/i)?.[1];
    const clearance = after.match(/\(?\d{3,4}(?:\s*-\s*\d{3,4})?\)?\s*[x×*]\s*\d{2,4}\s*[x×*]\s*\d{2,4}/)?.[0] || '';
    return {code:code.toUpperCase(),spec:spec.replace(/\s+/g,'').toUpperCase(),cabinetWidth,clearance,
      price:price ? Number(price.replace(/[.,]/g,'')) : undefined,unit:/\bbộ\b/i.test(after) || /Bộ/i.test(after) ? 'Bộ' : '',
      kemTu:/HC$/i.test(code) ? 'có' : /HK$/i.test(code) ? 'không' : '',note:price ? after.slice(after.indexOf(price)+price.length).trim() : ''};
  }
  return {fields,metadata,group,tableRow};
});
