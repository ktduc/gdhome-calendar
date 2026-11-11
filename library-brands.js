(function(root,factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GDHomeBrands = api;
})(typeof window === 'object' ? window : globalThis,() => {
  const key = value => String(value || '').trim().toLocaleLowerCase('vi');
  const asset = value => /^[a-f0-9]{64}\.(png|webp|jpg)$/.test(value || '');
  function normalize(records = [],items = []) {
    const brands = records.filter(item => item?.name).slice(0,500).map((item,index) => ({id:String(item.id || 'brand-'+index).slice(0,80),name:String(item.name).trim().slice(0,80),
      aliases:[...new Set((item.aliases || []).map(value => String(value).slice(0,80)))].slice(0,50),website:/^https?:\/\//i.test(item.website || '') ? String(item.website).slice(0,2000) : '',
      logo:asset(item.logo) ? item.logo : '',categories:[...new Set((item.categories || []).map(String))].slice(0,200),note:String(item.note || '').slice(0,1000),order:Number.isFinite(item.order) ? item.order : index}));
    for (const item of items) {
      if (!item.brand?.trim()) continue;
      let brand = brands.find(brand => [brand.name,...brand.aliases].some(name => key(name) === key(item.brand)));
      if (!brand) {
        brand = {id:'auto-'+encodeURIComponent(key(item.brand)).slice(0,70),name:item.brand.trim(),aliases:[],website:'',logo:'',categories:[],note:'',order:brands.length};
        brands.push(brand);
      }
      if (!brand.categories.includes(item.categoryId)) brand.categories.push(item.categoryId);
    }
    return brands.sort((a,b) => a.order-b.order || a.name.localeCompare(b.name));
  }
  const find = (brands,name) => brands?.find(brand => [brand.name,...brand.aliases].some(value => key(value) === key(name)));
  return {normalize,find};
});
