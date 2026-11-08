'use strict';

const crypto = require('node:crypto');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const mac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();

/**
 * Đọc cấu hình Object Storage từ biến môi trường:
 * 1. Ưu tiên Backblaze B2 chuẩn S3 (bộ tên S3_*):
 *    S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET
 * 2. Tiếp theo Backblaze B2 (bộ tên B2_*):
 *    B2_ENDPOINT, B2_REGION, B2_KEY_ID, B2_APP_KEY, B2_BUCKET
 * 3. Tương thích ngược Cloudflare R2 cũ:
 *    R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
 * 4. Fallback: 'temp' (lưu đĩa cục bộ DATA_DIR)
 */
function resolveStorageConfig() {
  const s3Endpoint = (process.env.S3_ENDPOINT || '').trim();
  const s3Access = (process.env.S3_ACCESS_KEY_ID || '').trim();
  const s3Secret = (process.env.S3_SECRET_ACCESS_KEY || '').trim();
  const s3Bucket = (process.env.S3_BUCKET || '').trim();
  let s3Region = (process.env.S3_REGION || '').trim();

  if (s3Endpoint && s3Access && s3Secret && s3Bucket) {
    let cleanEndpoint = s3Endpoint;
    if (!/^https?:\/\//i.test(cleanEndpoint)) {
      cleanEndpoint = 'https://' + cleanEndpoint;
    }
    const url = new URL(cleanEndpoint);
    const host = url.host;
    if (!s3Region) {
      const m = host.match(/^s3[.-]([a-z0-9-]+)\.backblazeb2\.com/i) || host.match(/^s3[.-]([a-z0-9-]+)\.amazonaws\.com/i);
      s3Region = m ? m[1] : 'us-east-1';
    }
    return {
      kind: 'b2',
      endpoint: url.origin,
      host,
      region: s3Region,
      accessKey: s3Access,
      secretKey: s3Secret,
      bucket: s3Bucket
    };
  }

  const b2Endpoint = (process.env.B2_ENDPOINT || '').trim();
  const b2KeyId = (process.env.B2_KEY_ID || '').trim();
  const b2AppKey = (process.env.B2_APP_KEY || '').trim();
  const b2Bucket = (process.env.B2_BUCKET || '').trim();
  let b2Region = (process.env.B2_REGION || '').trim();

  if (b2Endpoint && b2KeyId && b2AppKey && b2Bucket) {
    let cleanEndpoint = b2Endpoint;
    if (!/^https?:\/\//i.test(cleanEndpoint)) {
      cleanEndpoint = 'https://' + cleanEndpoint;
    }
    const url = new URL(cleanEndpoint);
    const host = url.host;
    if (!b2Region) {
      const m = host.match(/^s3[.-]([a-z0-9-]+)\.backblazeb2\.com/i) || host.match(/^s3[.-]([a-z0-9-]+)\.amazonaws\.com/i);
      b2Region = m ? m[1] : 'us-east-1';
    }
    return {
      kind: 'b2',
      endpoint: url.origin,
      host,
      region: b2Region,
      accessKey: b2KeyId,
      secretKey: b2AppKey,
      bucket: b2Bucket
    };
  }

  const r2Account = (process.env.R2_ACCOUNT_ID || '').trim();
  const r2Access = (process.env.R2_ACCESS_KEY_ID || '').trim();
  const r2Secret = (process.env.R2_SECRET_ACCESS_KEY || '').trim();
  const r2Bucket = (process.env.R2_BUCKET || '').trim();

  if (r2Account && r2Access && r2Secret && r2Bucket) {
    const host = `${r2Account}.r2.cloudflarestorage.com`;
    return {
      kind: 'r2',
      endpoint: `https://${host}`,
      host,
      region: 'auto',
      accessKey: r2Access,
      secretKey: r2Secret,
      bucket: r2Bucket
    };
  }

  return {
    kind: 'temp',
    endpoint: '',
    host: '',
    region: '',
    accessKey: '',
    secretKey: '',
    bucket: ''
  };
}

function getStorageKind() {
  return resolveStorageConfig().kind;
}

function isConfigured() {
  return getStorageKind() !== 'temp';
}

function canonicalUri(bucket, key) {
  const fullPath = '/' + bucket + '/' + key.replace(/^\/+/, '');
  return fullPath.split('/').map(seg => (seg === '' ? '' : encodeURIComponent(seg))).join('/');
}

/**
 * Ký URL ngắn hạn theo chuẩn AWS Signature Version 4 (Query string authentication)
 * Hỗ trợ path-style URL chuẩn cho Backblaze B2, Cloudflare R2, MinIO, AWS S3.
 */
function signedUrl(method, key, options = {}) {
  const config = options.config || resolveStorageConfig();
  if (config.kind === 'temp') {
    throw Object.assign(new Error('Chưa cấu hình Object Storage (B2/R2).'), { status: 500 });
  }

  const uri = canonicalUri(config.bucket, key);
  const stamp = (options.timestamp || new Date()).toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = stamp.slice(0, 8);
  const expires = String(options.expires || 60);
  const scope = `${date}/${config.region}/s3/aws4_request`;

  const queryParams = [
    ['X-Amz-Algorithm', 'AWS4-HMAC-SHA256'],
    ['X-Amz-Credential', `${config.accessKey}/${scope}`],
    ['X-Amz-Date', stamp],
    ['X-Amz-Expires', expires],
    ['X-Amz-SignedHeaders', 'host']
  ];

  // Sắp xếp các tham số truy vấn theo thứ tự từ điển (RFC 3986)
  queryParams.sort((a, b) => a[0].localeCompare(b[0]));

  const canonicalQuery = queryParams
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');

  const canonicalHeaders = `host:${config.host}\n`;
  const signedHeaders = 'host';
  const payloadHash = 'UNSIGNED-PAYLOAD';

  const canonicalRequest = [
    method.toUpperCase(),
    uri,
    canonicalQuery,
    canonicalHeaders,
    signedHeaders,
    payloadHash
  ].join('\n');

  const stringToSign = [
    'AWS4-HMAC-SHA256',
    stamp,
    scope,
    hash(canonicalRequest)
  ].join('\n');

  const signingKey = mac(mac(mac(mac('AWS4' + config.secretKey, date), config.region), 's3'), 'aws4_request');
  const signature = mac(signingKey, stringToSign).toString('hex');

  return `${config.endpoint}${uri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

/**
 * Tải đối tượng lên Object Storage qua PUT
 */
async function putObject(key, buffer, mime = 'application/octet-stream', options = {}) {
  const url = signedUrl('PUT', key, options);
  const timeoutMs = options.timeout || 30000;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': mime },
    body: buffer,
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!res.ok) {
    throw Object.assign(new Error(`Không ghi được tệp lên Object Storage (${res.status}).`), { status: 502 });
  }
  return { key, size: buffer.length, mime };
}

/**
 * Tải đối tượng từ Object Storage qua GET
 */
async function getObject(key, options = {}) {
  const url = signedUrl('GET', key, options);
  const timeoutMs = options.timeout || 30000;
  const res = await fetch(url, {
    method: 'GET',
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (res.status === 404) {
    throw Object.assign(new Error('Không tìm thấy tài liệu trên Object Storage.'), { status: 404 });
  }
  if (!res.ok) {
    throw Object.assign(new Error(`Không mở được tài liệu từ Object Storage (${res.status}).`), { status: 502 });
  }

  const arrayBuf = await res.arrayBuffer();
  const mime = res.headers.get('content-type') || 'application/octet-stream';
  const buf = Buffer.from(arrayBuf);
  return { buffer: buf, buf, mime, status: res.status };
}

/**
 * Kiểm tra tồn tại đối tượng qua HEAD
 */
async function headObject(key, options = {}) {
  const url = signedUrl('HEAD', key, options);
  const timeoutMs = options.timeout || 15000;
  const res = await fetch(url, {
    method: 'HEAD',
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (res.status === 404) {
    return { exists: false, status: 404 };
  }
  return {
    exists: res.ok,
    status: res.status,
    size: parseInt(res.headers.get('content-length') || '0', 10),
    mime: res.headers.get('content-type')
  };
}

/**
 * Xoá đối tượng qua DELETE
 */
async function deleteObject(key, options = {}) {
  const url = signedUrl('DELETE', key, options);
  const timeoutMs = options.timeout || 15000;
  const res = await fetch(url, {
    method: 'DELETE',
    signal: AbortSignal.timeout(timeoutMs)
  });
  return { ok: res.ok, status: res.status };
}

module.exports = {
  resolveStorageConfig,
  getStorageKind,
  isConfigured,
  canonicalUri,
  signedUrl,
  putObject,
  getObject,
  headObject,
  deleteObject,
  hash,
  mac
};
