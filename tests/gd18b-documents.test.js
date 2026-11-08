'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { handleProjectHub, ProjectHubStore } = require('../project-hub');

test('GĐ18B.2: API sắp xếp lại thứ tự ảnh / trang PDF tách (reorder) và xoá cập nhật ngay', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gd18b2-docs-'));
  t.after(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  const mem = new Map();
  const store = {
    async get(k) { return mem.get(k) || null; },
    async put(k, v) { mem.set(k, v); }
  };
  const dataKey = 'u-18b2';
  const hubStore = new ProjectHubStore(store, dataKey);

  await hubStore.saveProject('proj-r', rec => {
    rec.documents = [
      { id: 'doc_quote', type: 'quote', name: 'Bao-gia.xlsx', size: 1024 },
      { id: 'doc_r1', type: 'render', name: 'PhoiCanh_trang_1.webp', sourcePdf: 'PhoiCanh.pdf', pageNumber: 1, size: 2048 },
      { id: 'doc_r2', type: 'render', name: 'PhoiCanh_trang_2.webp', sourcePdf: 'PhoiCanh.pdf', pageNumber: 2, size: 2048 },
      { id: 'doc_r3', type: 'render', name: 'PhoiCanh_trang_3.webp', sourcePdf: 'PhoiCanh.pdf', pageNumber: 3, size: 2048 }
    ];
    return rec;
  });

  const callHub = async (urlPath, body) => {
    let statusOut = 0;
    let dataOut = null;
    await handleProjectHub(
      { method: 'POST', url: urlPath, headers: { 'content-type': 'application/json' } },
      urlPath,
      {
        res: {},
        store,
        dataKey,
        dataDir: dir,
        readJsonBody: async () => body,
        sendJson: (_r, st, data) => { statusOut = st; dataOut = data; },
        defaultSchedule: () => ({ calendars: [], tasks: [] })
      }
    );
    return { status: statusOut, data: dataOut };
  };

  // Kéo đổi thứ tự: đưa trang 3 lên trước trang 1
  const reorderRes = await callHub('/api/project-hub/documents/reorder', {
    projectId: 'proj-r',
    documentIds: ['doc_quote', 'doc_r3', 'doc_r1', 'doc_r2']
  });
  assert.equal(reorderRes.status, 200);
  assert.deepEqual(reorderRes.data.documents.map(d => d.id), ['doc_quote', 'doc_r3', 'doc_r1', 'doc_r2']);

  // Xoá doc_r1 trả về ngay danh sách mới
  const delRes = await callHub('/api/project-hub/documents/delete', {
    projectId: 'proj-r',
    documentId: 'doc_r1'
  });
  assert.equal(delRes.status, 200);
  assert.deepEqual(delRes.data.documents.map(d => d.id), ['doc_quote', 'doc_r3', 'doc_r2']);
});

test('GĐ18B.2: Giao diện client có lưới 120px, lightbox chung, kéo thả đổi thứ tự và phát BroadcastChannel(gdhome-assets)', async () => {
  const clientCode = await fs.readFile(path.join(__dirname, '..', 'project-hub-client.js'), 'utf8');
  const cssCode = await fs.readFile(path.join(__dirname, '..', 'shell.css'), 'utf8');
  const shellCode = await fs.readFile(path.join(__dirname, '..', 'shell.js'), 'utf8');

  assert.match(clientCode, /new BroadcastChannel\(['"]gdhome-assets['"]\)/, 'Phải phát qua BroadcastChannel("gdhome-assets")');
  assert.match(shellCode, /new BroadcastChannel\(['"]gdhome-assets['"]\)/, 'shell.js phải lắng nghe BroadcastChannel("gdhome-assets") để đồng bộ Chốt mã');
  assert.match(clientCode, /hub-thumb-grid-120/, 'Phải render lưới thumbnail 120px');
  assert.match(clientCode, /draggable="true"/, 'Phải cho phép kéo đổi thứ tự');
  assert.match(clientCode, /GDHomeShell\.lightbox/, 'Phải dùng lightbox chung của GDHomeShell');
  assert.match(cssCode, /\.hub-thumb-120\s*\{\s*width:\s*120px;\s*height:\s*120px;/, 'CSS thumbnail đúng 120px');
});
