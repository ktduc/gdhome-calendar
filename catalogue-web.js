const {downloadPublicResource,checkSsrfUrl} = require('./google-search');

function robotsRules(text) {
  const groups = [];
  let group;
  for (const line of text.split(/\r?\n/)) {
    const match = /^\s*(user-agent|allow|disallow)\s*:\s*([^#]*)/i.exec(line);
    if (!match) continue;
    const value = match[2].trim();
    if (match[1].toLowerCase() === 'user-agent') {
      if (!group || group.rules.length) { group = {agents:[],rules:[]}; groups.push(group); }
      group.agents.push(value.toLowerCase());
    } else if (group && value && value.length <= 2000 && group.rules.length < 2000) group.rules.push({path:value,allow:match[1].toLowerCase() === 'allow'});
  }
  const specific = groups.filter(group => group.agents.some(agent => agent !== '*' && agent && 'gdhometools'.includes(agent)));
  return (specific.length ? specific : groups.filter(group => group.agents.includes('*'))).flatMap(group => group.rules);
}

function allowedPath(rules,url) {
  const path = url.pathname + url.search;
  const matches = rules.filter(({path:pattern}) => {
    const exact = pattern.endsWith('$');
    const parts = (exact ? pattern.slice(0,-1) : pattern).split('*');
    const prefix = parts.shift();
    if (!path.startsWith(prefix)) return false;
    if (!parts.length) return !exact || path === prefix;
    let cursor = prefix.length;
    const suffix = exact ? parts.pop() : '';
    if (exact && !path.endsWith(suffix)) return false;
    const limit = path.length-suffix.length;
    for (const part of parts) {
      const index = path.indexOf(part,cursor);
      if (index < 0 || index+part.length > limit) return false;
      cursor = index+part.length;
    }
    return cursor <= limit;
  });
  matches.sort((a,b) => b.path.length-a.path.length || Number(b.allow)-Number(a.allow));
  return !matches.length || matches[0].allow;
}

function catalogueDownloader(options = {}) {
  const cache = new Map();
  async function download(url,type,beforeRequest) {
    const request = () => downloadPublicResource(url,{...options,type,beforeRequest});
    try { return await request(); }
    catch (error) {
      if (![429,500,502,503,504].includes(error.status)) throw error;
      const header = error.retryAfter;
      const delay = header ? (/^\d+$/.test(header) ? Number(header)*1000 : Date.parse(header)-Date.now()) : 1000;
      if (delay > 5000) throw error;
      await new Promise(resolve => setTimeout(resolve,Math.max(750,delay || 0)));
      return request();
    }
  }
  return (url,type) => download(url,type,async parsed => {
    if (!cache.has(parsed.origin)) cache.set(parsed.origin,download(parsed.origin+'/robots.txt','text')
      .then(({buffer}) => robotsRules(buffer.toString('utf8')))
      .catch(error => { if (error.status === 404 || error.status === 410) return []; throw error; }));
    const rules = await cache.get(parsed.origin);
    if (!allowedPath(rules,parsed)) throw Object.assign(new Error('Trang nguồn chặn đường dẫn này qua robots.txt.'),{status:403});
  });
}

const decode = value => String(value || '').replace(/&(amp|quot|apos|lt|gt|nbsp|times|ndash|mdash|#\d+|#x[0-9a-f]+);/gi,(_,entity) => {
  const names = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' ',times:'×',ndash:'–',mdash:'—'};
  if (names[entity.toLowerCase()]) return names[entity.toLowerCase()];
  const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
  return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}).trim();
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(([,key,double,single,bare]) => [key.toLowerCase(),decode(double ?? single ?? bare)]));
}
const first = value => Array.isArray(value) ? value[0] : value;
const readable = value => decode(String(value || '').replace(/<[^>]*>/g,' ')).replace(/\s+/g,' ').trim();
const nonProductImage = /(?:^|[/_.-])(?:logo|sprite|icon|avatar|pixel|banner|placeholder)(?:[/_.-]|$)/i;
function srcsetImages(attrs) {
  const width = Number(attrs.width) || 300;
  return ['srcset','data-srcset','data-lazy-srcset'].flatMap(key => String(attrs[key] || '').split(',').flatMap(value => {
    const match = value.trim().match(/^(\S+)(?:\s+(\d+(?:\.\d+)?)([wx]))?$/);
    if (!match) return [];
    return [{url:match[1],width:match[3] === 'x' ? Number(match[2])*width : Number(match[2]) || width}];
  })).sort((a,b) => b.width-a.width).map(item => item.url);
}
const zoomImages = attrs => [attrs['data-zoom-image'],attrs['data-large'],attrs['data-large_image'],attrs['data-large-image']];
const imageSources = attrs => [...zoomImages(attrs),...srcsetImages(attrs),attrs['data-original'],attrs['data-src'],attrs['data-lazy-src'],attrs.src].filter(Boolean);
const imageLink = url => /\.(?:jpe?g|webp|png|avif|gif|bmp)(?:[?#]|$)/i.test(url || '');
function galleryImages(html) {
  return [...html.matchAll(/<(?:img|a)\b[^>]*>/gi)].flatMap(([tag]) => {
    const attrs = attributes(tag);
    return [...zoomImages(attrs),imageLink(attrs.href) && attrs.href].filter(Boolean);
  });
}
function productImages(input) {
  return [input].flat().map(value => typeof value === 'string' ? {url:value,area:0} : {
    url:value?.contentUrl || value?.url,area:(Number(value?.width) || 0)*(Number(value?.height) || 0)
  }).filter(item => item.url).sort((a,b) => b.area-a.area).map(item => item.url);
}
function productLinks(html,url) {
  const products = new Map();
  for (const [,tag,content] of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi)) {
    const link = attributes(tag);
    if (!link.href || !(/\/(?:san-pham|products?)\//i.test(link.href) || /woocommerce-loopproduct-link|woocommerce-loop-product__link/i.test(link.class || ''))) continue;
    let href;
    try {
      const product = new URL(link.href,url);
      href = product.origin + product.pathname.replace(/\/$/,'');
    } catch { continue; }
    const record = products.get(href) || {};
    const img = content.match(/<img\b[^>]*>/i)?.[0];
    if (img && !record.images?.length) {
      const attrs = attributes(img);
      record.images = imageSources(attrs);
      record.code = attrs['data-sku'] || link['data-sku'];
      record.size = attrs['data-size'];
      record.name ||= attrs.alt || attrs.title;
    }
    const title = content.match(/<h[2-6]\b[^>]*>([\s\S]*?)<\/h[2-6]\s*>/i)?.[1];
    record.name ||= readable(title || (!img ? content : ''));
    products.set(href,record);
  }
  return products.values();
}

function nameCode(name) {
  const code = name.match(/(?:^|[\s:–—])([A-Z]{1,4}\s+\d{3,}[A-Z0-9]*|(?=[A-Z0-9_-]*\d)(?=[A-Z0-9_-]*[A-Z])[A-Z0-9][A-Z0-9_-]{3,})$/)?.[1] || '';
  return /^(?:\d+X\d+|\d+(?:CM|MM|KG|ML|L))$/.test(code) ? '' : code;
}
function extractProducts(html,url,validateUrl,maxItems) {
  const meta = {};
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs.property || attrs.name) meta[attrs.property || attrs.name] = attrs.content;
  }
  const supplier = meta['og:site_name'] || new URL(url).hostname;
  const title = meta['og:title'] || decode(html.match(/<title[^>]*>([^<]*)/i)?.[1]);
  const items = [];
  const seen = new Set();
  function add(record) {
    if (!record.images?.length || items.length >= maxItems) return;
    const candidates = [...new Set(record.images.flatMap(source => {
      try {
        const absolute = validateUrl(new URL(source,url).href);
        if (nonProductImage.test(absolute.pathname)) return [];
        const original = new URL(absolute);
        if (/\/wp-content\/uploads\//i.test(original.pathname)) {
          original.pathname = original.pathname.replace(/-\d+x\d+(?=\.[a-z]+$)/i,'');
        }
        return [original.href,absolute.href];
      } catch { return []; }
    }))].slice(0,6);
    const [image,...imageAlternates] = candidates;
    if (!image) return;
    const name = readable(record.name || title);
    const code = readable(record.code) || nameCode(name);
    const size = readable(record.size) || name.match(/\b\d{2,4}\s*(?:cm|mm)?\s*[×x*]\s*\d{2,4}(?:\s*(?:cm|mm))?\b/i)?.[0] || '';
    const key = [image,code].join('|');
    if (seen.has(key) || (!code && items.some(item => item.image === image))) return;
    seen.add(key);
    items.push({name:name.slice(0,160),code:code.slice(0,80),
      size:size.slice(0,80),brand:decode(record.brand).slice(0,80),supplier:decode(supplier).slice(0,80),image,
      ...(imageAlternates.length ? {imageAlternates} : {})});
  }
  const structured = [];
  for (const block of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try {
      const queue = [JSON.parse(block[1])];
      for (let i=0; i<queue.length && i<2500 && structured.length<maxItems; i++) {
        const node = queue[i];
        if (!node || typeof node !== 'object') continue;
        if ([node['@type']].flat().some(type => typeof type === 'string' && /(?:^|\/)Product$/.test(type))) {
          const brand = first(node.brand);
          structured.push({name:node.name,code:node.sku || node.mpn || node.productID,size:node.size,
            brand:typeof brand === 'object' ? brand?.name : brand,images:productImages(node.image)});
        }
        for (const child of Object.values(node)) if (child && typeof child === 'object') queue.push(child);
      }
    } catch { /* A malformed script does not prevent HTML fallback. */ }
  }
  const singleProduct = /^(?:og:)?product$/i.test(meta['og:type'] || '') || /\/(?:san-pham|products?)\/[^/]+\/?$/i.test(new URL(url).pathname);
  const gallery = singleProduct || structured.length === 1 ? [meta['og:image'],...galleryImages(html)].filter(Boolean) : [];
  for (const record of structured) add({...record,images:[...record.images,...gallery]});
  if (!items.length && singleProduct) add({name:title,code:meta['product:retailer_item_id'],images:gallery});
  if (!items.length) for (const record of productLinks(html,url)) add(record);
  if (!items.length) {
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      const attrs = attributes(match[0]);
      if (!attrs.alt && !/product|san-pham/i.test(attrs.class || '')) continue;
      add({name:attrs.alt || attrs.title,code:attrs['data-sku'],size:attrs['data-size'],images:imageSources(attrs)});
    }
    if (meta['og:image']) {
      add({name:title,code:meta['product:retailer_item_id'],images:[meta['og:image']]});
    }
  }
  return items;
}

function cataloguePagination(html,url,validate = checkSsrfUrl) {
  const page = new URL(url);
  const number = value => {
    const raw = value.searchParams.get('page') || value.searchParams.get('p') || value.pathname.match(/\/page\/(\d+)\/?$/i)?.[1];
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
  };
  const current = number(page) || 1;
  const base = value => {
    const copy = new URL(value);
    copy.pathname = copy.pathname.replace(/\/page\/\d+\/?$/i,'').replace(/\/$/,'');
    copy.searchParams.delete('page');
    copy.searchParams.delete('p');
    copy.searchParams.sort();
    return copy.origin + copy.pathname + copy.search;
  };
  function destination(href) {
    if (!href || href.startsWith('#')) return null;
    try {
      const candidate = validate(new URL(href,page).href);
      candidate.hash = '';
      return candidate.origin === page.origin && candidate.href !== page.href ? candidate : null;
    } catch { return null; }
  }
  let explicit;
  for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
    const attrs = attributes(match[0]);
    if (attrs.rel?.toLowerCase().split(/\s+/).includes('next')) explicit ||= destination(attrs.href);
  }
  let named;
  const numbered = [];
  for (const match of html.matchAll(/<(a|button)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)) {
    const attrs = attributes(match[2]), candidate = destination(attrs.href || attrs['data-href'] || attrs.formaction);
    if (!candidate) continue;
    if (attrs.rel?.toLowerCase().split(/\s+/).includes('next')) explicit ||= candidate;
    const caption = decode(match[3].replace(/<[^>]*>/g,'')).toLocaleLowerCase('vi').replace(/\s+/g,' ');
    const isNext = /^(?:›|»|next(?: page)?|tiếp(?: theo)?|trang tiếp(?: theo)?|sau|trang sau)$/i;
    if (isNext.test(caption) || isNext.test(attrs['aria-label'] || '') ||
      /(?:^|\s)next(?:\s|$)/.test(attrs.class || '') && /(?:^|\s)page-numbers(?:\s|$)/.test(attrs.class || '')) named ||= candidate;
    const n = number(candidate);
    if (n && Number(caption) === n && base(candidate) === base(page)) numbered.push({candidate,n});
  }
  const inferred = numbered.filter(({n}) => n === current+1)[0]?.candidate;
  const total = numbered.length ? Math.max(current,...numbered.map(({n}) => n)) : null;
  return {next:(explicit || named || inferred)?.href || null,total};
}

async function importCatalogueUrls(urls,options = {}) {
  const load = catalogueDownloader(options);
  const validate = options.validateUrl || checkSsrfUrl;
  const maxItems = urls.length === 1 ? 600 : 60;
  const items = [], warnings = [];
  let needsAi = false;
  let pagination;
  for (const url of urls) {
    try {
      const page = await load(url,'html');
      const html = page.buffer.toString('utf8');
      const result = extractProducts(html,page.url,validate,maxItems);
      if (urls.length === 1) pagination = cataloguePagination(html,page.url,validate);
      needsAi ||= result.some(item => !item.name || !item.code || !item.size);
      items.push(...result.filter(candidate => !items.some(item => item.image === candidate.image && item.code === candidate.code)));
      if (items.length >= maxItems) break;
    } catch (error) { warnings.push(error.message); }
  }
  return {items:items.slice(0,maxItems),warnings,needsAi,...(pagination || {})};
}

module.exports = {importCatalogueUrls,catalogueDownloader,cataloguePagination};
