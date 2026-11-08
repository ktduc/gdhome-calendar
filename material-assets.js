const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const { isConfigured, putObject, getObject, headObject, signedUrl, getStorageKind } = require('./object-storage');

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const imageMimes = {webp:'image/webp',png:'image/png',jpg:'image/jpeg'};
const imageName = value => typeof value === 'string' && /^[a-f0-9]{64}\.(webp|jpg|png)$/.test(value);
const maxImageBytes = 11 * 1024 * 1024; // Worst-case 1600px lossless RGBA PNG.

function dimensions(buf) {
  if (buf.length >= 30 && buf.toString('ascii',0,4) === 'RIFF' && buf.toString('ascii',8,12) === 'WEBP') {
    switch (buf.toString('ascii',12,16)) {
      case 'VP8X': return ['webp',1+buf.readUIntLE(24,3),1+buf.readUIntLE(27,3)];
      case 'VP8L': {
        const n = buf.readUInt32LE(21);
        return ['webp',1+(n&16383),1+((n>>>14)&16383)];
      }
      case 'VP8 ': return ['webp',buf.readUInt16LE(26)&16383,buf.readUInt16LE(28)&16383];
      default: return [];
    }
  }
  if (buf.length >= 33 && buf.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')) && buf.toString('ascii',12,16) === 'IHDR') {
    return ['png',buf.readUInt32BE(16),buf.readUInt32BE(20)];
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    // JPEG dimensions are in a Start of Frame segment. Reject malformed lengths.
    for (let i = 2; i+4 <= buf.length && buf[i] === 0xff;) {
      const marker = buf[i+1];
      if (marker === 0xff) { i++; continue; }
      if (marker === 0xda || marker === 0xd9) break;
      const length = buf.readUInt16BE(i+2);
      if (length < 2 || i+2+length > buf.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker) && length >= 8) {
        return ['jpg',buf.readUInt16BE(i+7),buf.readUInt16BE(i+5)];
      }
      i += 2+length;
    }
  }
  return [];
}

const uploading = new Map();
async function putImageOnce(key,buf,mime) {
  if (!uploading.has(key)) uploading.set(key,(async () => {
    const head = await headObject(key,{timeout:15000});
    if (head.exists) return;
    if (head.status !== 404) throw Object.assign(new Error('Không kiểm tra được ảnh trong kho (' + head.status + ').'),{status:502});
    await putObject(key,buf,mime,{timeout:20000});
  })().finally(() => uploading.delete(key)));
  await uploading.get(key);
}


class MaterialAssets {
  constructor(dataDir, accountKey) {
    this.dir = path.join(dataDir, 'assets', accountKey);
    this.prefix = accountKey + '/';
  }

  async save(encoded) {
    return (await this.saveBuffer(Buffer.from(typeof encoded === 'string' ? encoded : '','base64'))).name;
  }

  async saveBuffer(buf,maxSide = 1600) {
    const [ext,width,height] = dimensions(buf);
    if (!width || !height || Math.max(width,height) > maxSide || buf.length > maxImageBytes) {
      throw Object.assign(new Error('Ảnh WebP, PNG hoặc JPEG không hợp lệ hoặc vượt kích thước cho phép.'),{status:400});
    }
    const name = hash(buf) + '.' + ext;
    const mime = imageMimes[ext];
    if (isConfigured()) {
      await putImageOnce(this.prefix + name,buf,mime);
    } else {
      await fs.mkdir(this.dir,{recursive:true});
      await fs.writeFile(path.join(this.dir,name),buf,{flag:'wx'}).catch(error => { if (error.code !== 'EEXIST') throw error; });
    }
    return {name,mime,size:buf.length};
  }

  async read(name) {
    if (!imageName(name)) throw Object.assign(new Error('Không tìm thấy ảnh.'),{status:404});
    let buf;
    if (isConfigured()) {
      buf = (await getObject(this.prefix + name,{timeout:20000})).buffer;
    } else {
      buf = await fs.readFile(path.join(this.dir,name)).catch(error => {
        if (error.code === 'ENOENT') throw Object.assign(new Error('Không tìm thấy ảnh.'),{status:404});
        throw error;
      });
    }
    return {buf,mime:imageMimes[name.split('.').at(-1)]};
  }

  async send(res,name) {
    const {buf,mime} = await this.read(name);
    res.writeHead(200,{'Content-Type':mime,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
    res.end(buf);
  }
}


module.exports = {
  MaterialAssets,imageName,maxImageBytes,
  get r2() { return isConfigured(); },
  isConfigured,
  getStorageKind,
  signedUrl
};
