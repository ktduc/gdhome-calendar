'use strict';
const net = require('net');
const dns = require('dns').promises;
const http = require('node:http');
const https = require('node:https');
const {Readable} = require('node:stream');

function publicFetch(url,{signal,headers}) {
  return new Promise((resolve,reject) => {
    const transport = url.startsWith('https:') ? https : http;
    const request = transport.get(url,{signal,headers,lookup(host,options,callback) {
      dns.lookup(host,{all:true}).then(addresses => {
        if (!addresses.length || addresses.some(entry => isPrivateIp(entry.address))) {
          callback(httpError(400,'Địa chỉ IP nội bộ bị chặn (SSRF protection).'));
          return;
        }
        if (options.all) callback(null,addresses);
        else callback(null,addresses[0].address,addresses[0].family);
      },callback);
    }},response => {
      resolve({status:response.statusCode,ok:response.statusCode >= 200 && response.statusCode < 300,
        headers:new Headers(response.headers),body:Readable.toWeb(response)});
    });
    request.on('error',reject);
  });
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function isPrivateIp(ip) {
  if (!ip) return true;
  if (net.isIPv4(ip)) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4 || parts.some(isNaN)) return true;
    const [a, b] = parts;
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true;  // 10.0.0.0/8 private
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 private
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0) return true;   // 0.0.0.0/8
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
    if (a >= 224) return true; // multicast / dành riêng
    return false;
  }
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
    const mapped = norm.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    if (mapped) return isPrivateIp(mapped[1]); // IPv4 nằm trong IPv6 (::ffff:127.0.0.1)
    if (norm.startsWith('::ffff:')) return true;
    if (norm === '::1' || norm === '::') return true;
    if (norm.startsWith('fc') || norm.startsWith('fd')) return true; // fc00::/7
    if (norm.startsWith('fe8') || norm.startsWith('fe9') || norm.startsWith('fea') || norm.startsWith('feb')) return true; // fe80::/10
    return false;
  }
  return false;
}

function checkSsrfUrl(targetUrl) {
  let parsed;
  try {
    parsed = new URL(targetUrl);
  } catch {
    throw httpError(400, 'URL không hợp lệ.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw httpError(400, 'Chỉ hỗ trợ giao thức HTTP và HTTPS.');
  }
  if (parsed.username || parsed.password) throw httpError(400,'URL không được chứa thông tin đăng nhập.');
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw httpError(400, 'Địa chỉ máy chủ nội bộ bị chặn (SSRF protection).');
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw httpError(400, 'Địa chỉ IP nội bộ bị chặn (SSRF protection).');
  }
  return parsed;
}

async function validateHostIp(hostname, dnsResolver = dns.lookup) {
  hostname = String(hostname || '').replace(/^\[|\]$/g, '');
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) throw httpError(400, 'Địa chỉ IP nội bộ bị chặn (SSRF protection).');
    return;
  }
  try {
    const lookup = await dnsResolver(hostname, { all: true });
    const entries = Array.isArray(lookup) ? lookup : [lookup];
    for (const entry of entries) {
      if (isPrivateIp(entry.address)) {
        throw httpError(400, 'Địa chỉ IP nội bộ bị chặn (SSRF protection).');
      }
    }
  } catch (err) {
    if (err.status) throw err;
    throw httpError(400, 'Không phân giải được tên miền: ' + hostname);
  }
}

async function downloadPublicResource(targetUrl, {
  fetchFn = publicFetch,dnsResolver = dns.lookup,validateUrl = checkSsrfUrl,type = 'image',beforeRequest
} = {}) {
  let parsed = validateUrl(targetUrl);
  await validateHostIp(parsed.hostname, dnsResolver);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    let res;
    // Tự đi theo chuyển hướng và kiểm tra lại từng địa chỉ, để không bị dẫn vào mạng nội bộ.
    for (let hop = 0; ; hop++) {
      await beforeRequest?.(parsed);
      res = await fetchFn(parsed.href, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GDHomeTools/1.0',
          'Accept': type === 'image' ? 'image/webp,image/apng,image/*,*/*;q=0.8' : type === 'html' ? 'text/html,application/xhtml+xml' : 'text/plain'
        }
      });
      if (![301, 302, 303, 307, 308].includes(res.status)) break;
      if (hop >= 3) throw httpError(400, 'Ảnh chuyển hướng quá nhiều lần.');
      const location = res.headers.get('location');
      if (!location) throw httpError(400, 'Chuyển hướng không hợp lệ.');
      await res.body?.cancel?.().catch(() => {});
      parsed = validateUrl(new URL(location, parsed).href);
      await validateHostIp(parsed.hostname, dnsResolver);
    }
    if (!res.ok) {
      await res.body?.cancel?.().catch(() => {});
      throw Object.assign(httpError(res.status, 'Không tải được nội dung từ trang nguồn (' + res.status + ').'),{
        retryAfter:res.headers.get('retry-after')
      });
    }
    const contentType = (res.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    const valid = type === 'image' ? contentType.startsWith('image/') : type === 'html' ?
      ['text/html','application/xhtml+xml'].includes(contentType) : ['text/plain',''].includes(contentType);
    if (!valid) {
      await res.body?.cancel?.().catch(() => {});
      const reason = type === 'image' ? 'Tệp tải về không phải là ảnh hợp lệ' : 'Định dạng tải về không phù hợp';
      throw httpError(400,reason + ' (' + (contentType || 'không rõ') + ').');
    }
    const len = Number(res.headers.get('content-length') || 0);
    if (len > 8 * 1024 * 1024) {
      await res.body?.cancel?.().catch(() => {});
      throw httpError(413, 'Tệp vượt quá giới hạn 8 MB.');
    }
    // Đọc dần và dừng ngay khi vượt 8 MB (kể cả khi trang nguồn không báo dung lượng).
    const chunks = [];
    let size = 0;
    if (res.body && typeof res.body.getReader === 'function') {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 8 * 1024 * 1024) {
          try { await reader.cancel(); } catch {}
          throw httpError(413, 'File ảnh vượt quá giới hạn 8 MB.');
        }
        chunks.push(Buffer.from(value));
      }
    } else {
      chunks.push(Buffer.from(await res.arrayBuffer()));
      size = chunks[0].length;
      if (size > 8 * 1024 * 1024) throw httpError(413, 'File ảnh vượt quá giới hạn 8 MB.');
    }
    const buf = Buffer.concat(chunks);
    return {buffer:buf,contentType,url:parsed.href};
  } finally {
    clearTimeout(timer);
  }
}

async function proxyDownloadImage(url,options) {
  const {buffer,contentType} = await downloadPublicResource(url,{...options,type:'image'});
  return {buffer,contentType};
}

async function googleImageSearch(key, cx, query, { fetchFn = fetch } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = `https://customsearch.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&searchType=image&num=10`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000),redirect:'error' });
  if (!res.ok) {
    throw httpError(res.status, 'Lỗi tìm kiếm Google Custom Search (' + res.status + ').');
  }
  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items.map(item => ({
    title: item.title || '',
    link: item.link || '',
    thumbnail: item.image?.thumbnailLink || item.link || '',
    width: item.image?.width || 0,
    height: item.image?.height || 0,
    contextLink: item.image?.contextLink || ''
  }));
}

async function imageSearch({provider,key,cx},query,{fetchFn = fetch} = {}) {
  const q = String(query || '').trim().slice(0,500);
  if (!q || !key) return [];
  if (provider === 'google') return googleImageSearch(key,cx,q,{fetchFn});
  const serper = provider === 'serper';
  if (!serper && provider !== 'brave') throw httpError(400,'Nhà cung cấp tìm ảnh không hợp lệ.');
  const url = serper ? 'https://google.serper.dev/images' :
    'https://api.search.brave.com/res/v1/images/search?' + new URLSearchParams({q,count:'10',safesearch:'strict'});
  const options = serper ? {method:'POST',headers:{'X-API-KEY':key,'Content-Type':'application/json'},body:JSON.stringify({q,num:10})} :
    {method:'GET',headers:{'X-Subscription-Token':key,Accept:'application/json'}};
  const response = await fetchFn(url,{...options,signal:AbortSignal.timeout(8000),redirect:'error'});
  if (!response.ok) throw httpError(response.status,'Lỗi tìm ảnh (' + response.status + ').');
  const data = await response.json();
  const results = serper ? data.images : data.results;
  return (Array.isArray(results) ? results : []).filter(Boolean).slice(0,10).map(item => {
    const link = serper ? item.imageUrl : item.properties?.url;
    return {title:item.title || '',link,thumbnail:(serper ? item.thumbnailUrl : item.thumbnail?.src) || link,
      width:(serper ? item.imageWidth : item.properties?.width) || 0,
      height:(serper ? item.imageHeight : item.properties?.height) || 0,contextLink:(serper ? item.link : item.url) || ''};
  }).filter(item => /^https?:\/\//i.test(item.link || ''));
}

module.exports = {
  imageSearch,
  isPrivateIp,
  checkSsrfUrl,
  validateHostIp,
  proxyDownloadImage,
  downloadPublicResource,
  googleImageSearch
};
