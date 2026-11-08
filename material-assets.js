const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { isConfigured, putObject, getObject, signedUrl, getStorageKind } = require('./object-storage');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');

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
    const remote = isConfigured();
    const limit = remote ? 1600 : 1000;
    const [width, height] = dimensions(buf);
    if (!width || !height || Math.max(width, height) > limit || buf.length > (remote ? 350000 : 150000)) {
      throw Object.assign(new Error('Ảnh WebP vượt kích thước cho phép hoặc không hợp lệ.'), { status: 400 });
    }
    const name = hash(buf) + '.webp';
    if (remote) {
      await putObject(this.prefix + name, buf, 'image/webp', { timeout: 20000 });
    } else {
      await fs.mkdir(this.dir, { recursive: true });
      await fs.writeFile(path.join(this.dir, name), buf, { flag: 'wx' }).catch(error => { if (error.code !== 'EEXIST') throw error; });
    }
    return name;
  }

  async send(res, name) {
    if (!/^[a-f0-9]{64}\.webp$/.test(name)) throw Object.assign(new Error('Không tìm thấy ảnh.'), { status: 404 });
    let bytes;
    if (isConfigured()) {
      const result = await getObject(this.prefix + name, { timeout: 20000 });
      bytes = result.buffer;
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

module.exports = {
  MaterialAssets,
  get r2() { return isConfigured(); },
  isConfigured,
  getStorageKind,
  signedUrl
};
