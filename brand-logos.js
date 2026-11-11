const {checkSsrfUrl} = require('./google-search');
function logoCandidates(html,base) {
  const result = [];
  const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)].map(match => [match[1].toLowerCase(),match[2] ?? match[3]]));
  function add(value,score,title) {
    if (value && typeof value === 'object') value = value.url || value.contentUrl;
    if (typeof value !== 'string') return;
    try {
      const url = checkSsrfUrl(new URL(value.replace(/&amp;/g,'&'),base).href).href;
      if (!result.some(item => item.url === url)) result.push({url,score:score+(/\.(svg|png)(?:[?#]|$)/i.test(url) ? 100 : 0),title});
    } catch { /* Ignore invalid or private URLs. */ }
  }
  for (const match of html.matchAll(/<(link|meta|img)\b[^>]*>/gi)) {
    const item = attrs(match[0]);
    if (/icon/i.test(item.rel || '')) add(item.href,parseInt(item.sizes) || (/apple/i.test(item.rel) ? 180 : 16),'Biểu tượng website');
    if (/og:logo/i.test(item.property || item.name || '')) add(item.content,1000,'Logo website');
    if (match[1].toLowerCase() === 'img' && /logo/i.test([item.id,item.class,item.alt,item.src].join(' '))) add(item['data-src'] || item.src,800,'Logo hãng');
  }
  for (const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const nodes = [JSON.parse(match[1])];
      for (let i=0;i<nodes.length && i<200;i++) {
        const node = nodes[i];
        if (!node || typeof node !== 'object') continue;
        if (/Organization/i.test(String(node['@type']))) add(node.logo,1200,'Organization.logo');
        for (const value of Object.values(node)) if (typeof value === 'object') nodes.push(...(Array.isArray(value) ? value : [value]));
      }
    } catch { /* Ignore invalid JSON-LD. */ }
  }
  return result.sort((a,b) => b.score-a.score).slice(0,6);
}
module.exports = {logoCandidates};
