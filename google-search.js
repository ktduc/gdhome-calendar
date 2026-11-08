'use strict';
const net = require('net');
const dns = require('dns').promises;

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
    return false;
  }
  if (net.isIPv6(ip)) {
    const norm = ip.toLowerCase();
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
  const host = parsed.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw httpError(400, 'Địa chỉ máy chủ nội bộ bị chặn (SSRF protection).');
  }
  if (net.isIP(host) && isPrivateIp(host)) {
    throw httpError(400, 'Địa chỉ IP nội bộ bị chặn (SSRF protection).');
  }
  return parsed;
}

async function validateHostIp(hostname, dnsResolver = dns.lookup) {
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

async function proxyDownloadImage(targetUrl, { fetchFn = fetch, dnsResolver = dns.lookup } = {}) {
  const parsed = checkSsrfUrl(targetUrl);
  await validateHostIp(parsed.hostname, dnsResolver);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const res = await fetchFn(parsed.href, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) GDHomeTools/1.0',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
      }
    });
    if (!res.ok) throw httpError(res.status, 'Không tải được ảnh từ trang nguồn (' + res.status + ').');
    const contentType = (res.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
    if (!contentType.startsWith('image/')) {
      throw httpError(400, 'Tệp tải về không phải là ảnh hợp lệ (' + (contentType || 'unknown') + ').');
    }
    const len = Number(res.headers.get('content-length') || 0);
    if (len > 8 * 1024 * 1024) {
      throw httpError(413, 'File ảnh vượt quá giới hạn 8 MB.');
    }
    const arrayBuffer = await res.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.length > 8 * 1024 * 1024) {
      throw httpError(413, 'File ảnh vượt quá giới hạn 8 MB.');
    }
    return { buffer: buf, contentType };
  } finally {
    clearTimeout(timer);
  }
}

async function googleImageSearch(key, cx, query, { fetchFn = fetch } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];
  const url = `https://customsearch.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(q)}&searchType=image&num=10`;
  const res = await fetchFn(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw httpError(res.status, 'Lỗi tìm kiếm Google Custom Search (' + res.status + '): ' + errText.slice(0, 200));
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

module.exports = {
  isPrivateIp,
  checkSsrfUrl,
  validateHostIp,
  proxyDownloadImage,
  googleImageSearch
};
