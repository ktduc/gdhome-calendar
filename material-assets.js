const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const names = ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET'];
const r2 = names.every(name => process.env[name]);
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const mac = (key, value) => crypto.createHmac('sha256', key).update(value).digest();

function signedUrl(method, key) {
  const [account, access, secret, bucket] = names.map(name => process.env[name]);
  const host = account + '.r2.cloudflarestorage.com';
  const uri = '/' + encodeURIComponent(bucket) + '/' + key;
  const stamp = new Date().toISOString().replace(/[-:]|\.\d{3}/g, '');
  const date = stamp.slice(0, 8);
  const scope = date + '/auto/s3/aws4_request';
  const query = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256', 'X-Amz-Credential': access + '/' + scope,
    'X-Amz-Date': stamp, 'X-Amz-Expires': '60', 'X-Amz-SignedHeaders': 'host'
  }).toString();
  const canonical = [method, uri, query, 'host:' + host + '\n', 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const signingKey = mac(mac(mac(mac('AWS4' + secret, date), 'auto'), 's3'), 'aws4_request');
  const signature = mac(signingKey, ['AWS4-HMAC-SHA256', stamp, scope, hash(canonical)].join('\n')).toString('hex');
  return 'https://' + host + uri + '?' + query + '&X-Amz-Signature=' + signature;
}

function dimensions(buf) {
  if (buf.length < 30 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return [];
  switch (buf.toString('ascii', 12, 16)) {
    case 'VP8X': return [1 + buf.readUIntLE(24, 3), 1 + buf.readUIntLE(27, 3)];
    case 'VP8L': {
      const n = buf.readUInt32LE(21);
      return [1 + (n & 16383), 1 + ((n >>> 14) & 16383)];
    }
    case 'VP8 ': return [buf.readUInt16LE(26) & 16383, buf.readUInt16LE(28) & 16383];
    default: return [];
  }
}

class MaterialAssets {
  constructor(dataDir, accountKey) {
    this.dir = path.join(dataDir, 'assets', accountKey);
    this.prefix = accountKey + '/';
  }

  async save(encoded) {
    const buf = Buffer.from(typeof encoded === 'string' ? encoded : '', 'base64');
    const limit = r2 ? 1600 : 1000;
    const [width, height] = dimensions(buf);
    if (!width || !height || Math.max(width, height) > limit || buf.length > (r2 ? 350000 : 150000)) {
      throw Object.assign(new Error('Ảnh WebP vượt kích thước cho phép hoặc không hợp lệ.'), { status: 400 });
    }
    const name = hash(buf) + '.webp';
    if (r2) {
      const response = await fetch(signedUrl('PUT', this.prefix + name), { method: 'PUT', signal:AbortSignal.timeout(20000), headers: { 'Content-Type': 'image/webp' }, body: buf });
      if (!response.ok) throw Object.assign(new Error('Không ghi được ảnh lên R2.'), { status: 502 });
    } else {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(path.join(this.dir, name), buf, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    }
    return name;
  }

  async send(res, name) {
    if (!/^[a-f0-9]{64}\.webp$/.test(name)) throw Object.assign(new Error('Không tìm thấy ảnh.'), { status: 404 });
    let bytes;
    if (r2) {
      const response = await fetch(signedUrl('GET',this.prefix + name),{signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw Object.assign(new Error('Không mở được ảnh R2.'), { status: response.status === 404 ? 404 : 502 });
      bytes = Buffer.from(await response.arrayBuffer());
    } else {
      bytes = await fs.readFile(path.join(this.dir, name)).catch(error => {
        if (error.code === 'ENOENT') throw Object.assign(new Error('Không tìm thấy ảnh.'), { status: 404 });
        throw error;
      });
    }
    res.writeHead(200, { 'Content-Type': 'image/webp', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(bytes);
  }
}
module.exports = { MaterialAssets, r2 };
