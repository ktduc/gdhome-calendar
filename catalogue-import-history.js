(() => {
  function sourceKey(value) {
    if (typeof value !== 'string' || value.length > 2000) return '';
    if (/^sha256:[a-f0-9]{64}$/.test(value)) return value;
    try {
      const url = new URL(value);
      if (!['http:','https:'].includes(url.protocol) || url.username || url.password) return '';
      url.hash = '';
      for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key);
      url.searchParams.sort();
      return url.toString().replace(/\/(?=\?|$)/,'');
    } catch { return ''; }
  }
  const text = (value,max) => typeof value === 'string' ? value.trim().slice(0,max) : '';
  function normalize(item) {
    const source = sourceKey(item?.source), id = text(item?.id,60);
    if (!source || !/^[a-zA-Z0-9_-]+$/.test(id) || !['partial','done','error'].includes(item.status)) return null;
    const strings = (list,max,length) => [...new Set((Array.isArray(list) ? list : []).map(value => text(value,length)).filter(Boolean))].slice(0,max);
    return {id,source,name:text(item.name,200),at:Number.isFinite(item.at) && item.at > 0 ? item.at : Date.now(),
      categoryId:text(item.categoryId,60),brand:text(item.brand,80),suppliers:strings(item.suppliers,30,80),
      count:Math.min(5000,Math.max(0,Math.floor(Number(item.count) || 0))),status:item.status,itemIds:strings(item.itemIds,5000,60)};
  }
  function apply(data,patch) {
    const current = Array.isArray(data.imports) ? data.imports : [];
    if (typeof patch?.deleteId === 'string') {
      data.imports = current.filter(item => item.id !== patch.deleteId);
      return;
    }
    const inputs = Array.isArray(patch?.imports) ? patch.imports : [];
    const entries = inputs.map(normalize);
    if (!entries.length || entries.length > 50 || entries.some(entry => !entry)) {
      throw Object.assign(new Error('Nguồn nhập không hợp lệ.'),{status:400});
    }
    const upserts = new Map(entries.map(item => [item.id,item]));
    data.imports = [...upserts.values(),...current.filter(item => !upserts.has(item.id))].sort((a,b) => b.at-a.at).slice(0,200);
  }
  const api = {sourceKey,normalize,apply};
  if (typeof module !== 'undefined') module.exports = api;
  else window.GDHomeCatalogueHistory = api;
})();
