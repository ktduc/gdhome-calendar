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
  const download = (url,type,beforeRequest) => downloadPublicResource(url,{...options,type,beforeRequest});
  return (url,type) => download(url,type,async parsed => {
    if (!cache.has(parsed.origin)) cache.set(parsed.origin,download(parsed.origin+'/robots.txt','text')
      .then(({buffer}) => robotsRules(buffer.toString('utf8')))
      .catch(error => { if (error.status === 404 || error.status === 410) return []; throw error; }));
    const rules = await cache.get(parsed.origin);
    if (!allowedPath(rules,parsed)) throw Object.assign(new Error('Trang nguồn chặn đường dẫn này qua robots.txt.'),{status:403});
  });
}

const decode = value => String(value || '').replace(/&(amp|quot|apos|lt|gt|nbsp|#\d+|#x[0-9a-f]+);/gi,(_,entity) => {
  const names = {amp:'&',quot:'"',apos:"'",lt:'<',gt:'>',nbsp:' '};
  if (names[entity.toLowerCase()]) return names[entity.toLowerCase()];
  const code = entity[1]?.toLowerCase() === 'x' ? parseInt(entity.slice(2),16) : Number(entity.slice(1));
  return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
}).trim();
function attributes(tag) {
  return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(([,key,double,single,bare]) => [key.toLowerCase(),decode(double ?? single ?? bare)]));
}
const first = value => Array.isArray(value) ? value[0] : value;
function extractProducts(html,url,validateUrl = checkSsrfUrl) {
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
    if (!record.image || items.length >= 60) return;
    let image;
    try { image = validateUrl(new URL(record.image,url).href).href; } catch { return; }
    const key = [image,record.code || ''].join('|');
    if (seen.has(key) || (!record.code && items.some(item => item.image === image))) return;
    seen.add(key);
    items.push({name:decode(record.name || title).slice(0,160),code:decode(record.code).slice(0,80),
      size:decode(record.size).slice(0,80),brand:decode(record.brand).slice(0,80),supplier:decode(supplier).slice(0,80),image});
  }
  for (const block of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script\s*>/gi)) {
    try {
      const queue = [JSON.parse(block[1])];
      for (let i=0; i<queue.length && i<2500 && items.length<60; i++) {
        const node = queue[i];
        if (!node || typeof node !== 'object') continue;
        if ([node['@type']].flat().some(type => typeof type === 'string' && /(?:^|\/)Product$/.test(type))) {
          const img = first(node.image), brand = first(node.brand);
          add({name:node.name,code:node.sku || node.mpn || node.productID,size:node.size,
            brand:typeof brand === 'object' ? brand?.name : brand,image:typeof img === 'object' ? img?.url || img?.contentUrl : img});
        }
        for (const child of Object.values(node)) if (child && typeof child === 'object') queue.push(child);
      }
    } catch { /* A malformed script does not prevent HTML fallback. */ }
  }
  const structured = items.length > 0;
  if (!structured) {
    for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
      const attrs = attributes(match[0]);
      const source = attrs['data-src'] || attrs.src || attrs.srcset?.split(/\s/)[0];
      if (!source || /logo|sprite|icon|avatar|pixel|banner/i.test(source) || (attrs.width && Number(attrs.width)<100)) continue;
      if (!attrs.alt && !/product|san-pham/i.test(attrs.class || '')) continue;
      add({name:attrs.alt || attrs.title,code:attrs['data-sku'],size:attrs['data-size'],image:source});
    }
    if (meta['og:image']) {
      add({name:title,code:meta['product:retailer_item_id'],image:meta['og:image']});
    }
  }
  return {items,structured};
}

async function importCatalogueUrls(urls,options = {}) {
  const load = catalogueDownloader(options);
  const validate = options.validateUrl || checkSsrfUrl;
  const items = [], warnings = [];
  let needsAi = false;
  for (const url of urls) {
    try {
      const page = await load(url,'html');
      const result = extractProducts(page.buffer.toString('utf8'),page.url,validate);
      needsAi ||= !result.structured;
      items.push(...result.items.filter(candidate => !items.some(item => item.image === candidate.image && item.code === candidate.code)));
      if (items.length >= 60) break;
    } catch (error) { warnings.push(error.message); }
  }
  return {items:items.slice(0,60),warnings,needsAi};
}

module.exports = {importCatalogueUrls,catalogueDownloader};
