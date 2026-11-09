const {createHash} = require('node:crypto');
const {createReadStream} = require('node:fs');
const {Readable} = require('node:stream');
const {createGzip,createGunzip} = require('node:zlib');
const {MaterialStore} = require('./materials');
const {MaterialAssets,imageName} = require('./material-assets');
const {ProjectAssets,ProjectHubStore} = require('./project-hub');
const {libraryKey,defaultLibrary} = require('./shared-library');

const format = 'gdhome-account-backup/v1';
const digest = input => createHash('sha256').update(input).digest('hex');
const projectFile = name => /^[a-f0-9]{64}\.[a-z0-9]+$/.test(name);

function repositories(store,account) {
  const materials = new MaterialStore(store,account).key;
  return {
    schedule:[account,{calendars:[],tasks:[],projectOwners:[]}],
    materials:[materials,{sheets:[],revisions:[]}],
    revisions:[materials+'-rev',{entries:[]}],
    library:[libraryKey(account),defaultLibrary()],
    projects:[new ProjectHubStore(store,account).key,{projects:{}}]
  };
}

function referencedFiles(records) {
  const files = new Set();
  function visit(value,key = '') {
    if (typeof value === 'string') {
      if (/assetkey$/i.test(key) && value.startsWith('render-') && imageName(value.slice(7))) files.add('material/'+value.slice(7));
      else if (/assetkey$/i.test(key) && projectFile(value)) files.add('project/'+value);
      else if (imageName(value)) files.add('material/'+value);
    } else if (Array.isArray(value)) {
      for (const entry of value) visit(entry,key);
    } else if (value && typeof value === 'object') {
      for (const [name,entry] of Object.entries(value)) visit(entry,name);
    }
  }
  visit(records);
  return files;
}

function checkRevisions(records) {
  const count = records.materials?.archiveCount || 0;
  if (count && (!Array.isArray(records.revisions?.entries) || records.revisions.entries.length < count)) {
    throw new Error('Kho bản phát hành chưa đầy đủ. Hãy kiểm tra đồng bộ trước khi sao lưu hoặc khôi phục.');
  }
}

function accountAssets(store,account,dataDir) {
  const material = new MaterialAssets(dataDir,new MaterialStore(store,account).key);
  const project = new ProjectAssets(dataDir,account);
  return {
    read: (kind,name) => (kind === 'material' ? material : project).read(name),
    async write(kind,name,buffer,mime) {
      if (kind === 'material') await material.saveBuffer(buffer);
      else await project.save(buffer,name.slice(name.lastIndexOf('.')),mime);
    }
  };
}

function createSnapshot({store,account,dataDir,signal,assets = accountAssets(store,account,dataDir),now = new Date()}) {
  const summary = {files:0,missing:[]};
  async function* lines() {
    const records = Object.fromEntries(await Promise.all(Object.entries(repositories(store,account))
      .map(async ([name,[key]]) => [name,await store.get(key)])));
    checkRevisions(records);
    const refs = referencedFiles(records);
    yield JSON.stringify({format,account:digest(account),createdAt:now.toISOString(),records})+'\n';
    for (const ref of refs) {
      signal?.throwIfAborted();
      const [kind,name] = ref.split('/');
      let file;
      try { file = await assets.read(kind,name); }
      catch (error) {
        if (error.status !== 404 && error.code !== 'ENOENT') throw error;
        summary.missing.push(ref);
        continue;
      }
      if (digest(file.buf) !== name.split('.')[0]) throw new Error('Tệp gốc sai mã kiểm tra: ' + name);
      summary.files++;
      yield JSON.stringify({ref,mime:file.mime,base64:file.buf.toString('base64')})+'\n';
    }
    yield JSON.stringify({end:true,files:summary.files,missing:summary.missing})+'\n';
  }
  const input = Readable.from(lines());
  const gzip = createGzip();
  input.on('error',error => gzip.destroy(error));
  gzip.on('close',() => input.destroy());
  return {stream:input.pipe(gzip),summary};
}

async function* snapshotLines(path) {
  const input = createReadStream(path);
  const gzip = createGunzip();
  input.on('error',error => gzip.destroy(error));
  let pending = [];
  try {
    for await (const chunk of input.pipe(gzip).setEncoding('utf8')) {
      const parts = chunk.split('\n');
      pending.push(parts[0]);
      if (parts.length === 1) continue;
      yield pending.join('');
      for (let i=1;i<parts.length-1;i++) yield parts[i];
      pending = [parts.at(-1)];
    }
    if (pending.join('')) throw new Error('Bản sao thiếu dòng kết thúc.');
  } finally {
    input.destroy();
    gzip.destroy();
  }
}

async function inspectSnapshot(path,{account,writeAsset}) {
  let header, footer, refs;
  const verified = new Set();
  for await (const line of snapshotLines(path)) {
    const entry = JSON.parse(line);
    if (footer) throw new Error('Bản sao có nội dung dư sau phần kết thúc.');
    if (!header) {
      const keys = Object.keys(repositories(null,account));
      if (entry.format !== format || entry.account !== digest(account) ||
          !entry.records || Object.keys(entry.records).length !== keys.length || !keys.every(key =>
            Object.hasOwn(entry.records,key) && (entry.records[key] === null || (
              typeof entry.records[key] === 'object' && !Array.isArray(entry.records[key]))))) {
        throw new Error('Bản sao sai định dạng hoặc thuộc tài khoản khác.');
      }
      header = entry;
      checkRevisions(entry.records);
      refs = referencedFiles(entry.records);
    } else if (entry.end === true) {
      footer = entry;
    } else {
      if (!refs.has(entry.ref) || verified.has(entry.ref) || typeof entry.base64 !== 'string') {
        throw new Error('Bản sao có tệp trùng hoặc không có trong danh sách.');
      }
      const [kind,name] = entry.ref.split('/');
      const buffer = Buffer.from(entry.base64,'base64');
      if (digest(buffer) !== name.split('.')[0]) throw new Error('Tệp sao lưu sai mã kiểm tra: '+name);
      if (writeAsset) await writeAsset(kind,name,buffer,entry.mime);
      verified.add(entry.ref);
    }
  }
  const missing = [...(refs || [])].filter(ref => !verified.has(ref));
  if (!footer || footer.files !== verified.size || !Array.isArray(footer.missing) ||
      missing.length !== footer.missing.length || missing.some(ref => !footer.missing.includes(ref))) {
    throw new Error('Bản sao bị cắt hoặc thiếu tệp chưa được ghi nhận.');
  }
  return {records:header.records,createdAt:header.createdAt,files:verified.size,missing};
}

async function restoreSnapshot(path,{store,account,dataDir,apply,allowMissing,assets = accountAssets(store,account,dataDir)}) {
  const checked = await inspectSnapshot(path,{account});
  if (!apply) return checked;
  if (checked.missing.length && !allowMissing) throw new Error('Bản sao có tệp đã mất ở nguồn. Cần xác nhận --allow-missing để khôi phục phần còn lại.');
  const snapshot = await inspectSnapshot(path,{account,writeAsset:assets.write});
  if (snapshot.createdAt !== checked.createdAt || (snapshot.missing.length && !allowMissing)) {
    throw new Error('Bản sao đã thay đổi trong lúc kiểm tra.');
  }
  const writes = await Promise.all(Object.entries(repositories(store,account)).map(async ([name,[key,fallback]]) => {
    const previous = await store.get(key);
    const data = {...(snapshot.records[name] || fallback),
      _version:Math.max(previous?._version || 0,snapshot.records[name]?._version || 0)+1,
      _updatedAt:new Date().toISOString()};
    return {key,previous:previous || fallback,data};
  }));
  if (store.putMaterials) {
    await store.putMaterials(writes.map(({key,data}) => [key,data]));
    return snapshot;
  }
  const written = [];
  try {
    for (const write of writes) {
      await store.put(write.key,write.data);
      written.push(write);
    }
  } catch (error) {
    for (const {key,previous} of written.reverse()) await store.put(key,previous);
    await store.flush?.();
    throw error;
  }
  await store.flush?.();
  if (store.dirty?.size) throw new Error('Bản khôi phục chưa đồng bộ xong với Gist. Kiểm tra kết nối máy chủ.');
  return snapshot;
}

module.exports = {createSnapshot,inspectSnapshot,restoreSnapshot};
