const crypto = require('node:crypto');

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}

const id = () => crypto.randomUUID();
const blank = () => ({ _version: 0, sheets: [], presets: {}, library: [], settings: {}, revisions: [], approvals: [], audit: [] });
const queues = new Map();

class MaterialStore {
  constructor(store, account) {
    this.store = store;
    this.key = 'mat-v1-' + crypto.createHash('sha256').update(account).digest('hex');
  }

  async get() {
    const data = await this.store.get(this.key) || blank();
    const archive = await this.store.get(this.key + '-rev');
    if (archive) {
      const entries = archive.entries.slice(0, data.archiveCount || 0);
      data.revisions = [...entries.filter(e => e.type === 'revision').map(e => e.value), ...data.revisions];
    }
    return data;
  }

  async update(version, edit) {
    const previous = queues.get(this.key) || Promise.resolve();
    const pending = previous.catch(() => {}).then(async () => {
      const data = await this.get();
      if (version !== undefined && version !== data._version) fail(409, 'Có thay đổi trên máy khác. Hãy giữ bản nháp và tải lại để đối chiếu.');
      const result = await edit(data);
      data._version++;
      const compact = data.archiveCount || Buffer.byteLength(JSON.stringify(data, null, 2)) > 800000;
      if (compact) {
        const entries = data.revisions.map(value => ({ type: 'revision', value }));
        // Append before publishing the count. Readers only read entries committed by the main file.
        await this.store.put(this.key + '-rev', { entries });
        data.archiveCount = entries.length;
        data.revisions = [];
      }
      await this.store.put(this.key, data);
      return { _version: data._version, ...result };
    });
    queues.set(this.key, pending);
    try { return await pending; }
    finally { if (queues.get(this.key) === pending) queues.delete(this.key); }
  }
}

async function handleMaterials(req, url, { store, dataKey, readJsonBody, sendJson, res }) {
  const materials = new MaterialStore(store, dataKey);
  const schedule = await store.get(dataKey) || {};
  const projects = (schedule.projectOwners || []).map(({ id, name }) => ({ id, name }));
  if (url === '/api/materials' && req.method === 'GET') {
    const { _version, sheets, presets, library, settings } = await materials.get();
    return sendJson(res, 200, { _version, sheets, presets, library, settings, projects });
  }
  if (url === '/api/materials' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (!Number.isSafeInteger(body?._version)) fail(400, 'Thiếu phiên bản dữ liệu.');
    const saved = await materials.update(body._version, data => {
      const sheet = body.sheet;
      if (!sheet || typeof sheet.title !== 'string' || !sheet.title.trim() || !Array.isArray(sheet.groups)) fail(400, 'Bảng không hợp lệ.');
      const index = sheet.id ? data.sheets.findIndex(s => s.id === sheet.id) : -1;
      if (sheet.id && index < 0) fail(404, 'Không tìm thấy bảng.');
      if (!projects.some(p => p.id === sheet.projectId) && data.sheets[index]?.projectId !== sheet.projectId) fail(400, 'Chọn dự án Tiến độ trước.');
      const updated = { id: sheet.id || id(), projectId: sheet.projectId, title: sheet.title.trim().slice(0, 200), groups: sheet.groups };
      if (index < 0) data.sheets.push(updated);
      else data.sheets[index] = updated;
      return { sheet: updated };
    });
    return sendJson(res, 200, saved);
  }
  fail(404, 'Không tìm thấy API Chốt mã.');
}

module.exports = { MaterialStore, handleMaterials, fail, id };
