'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const { encrypt } = require('../integrations');
const {
  ProjectHubStore,
  ProjectAssets,
  suggestProjectProfile,
  handleProjectHub
} = require('../project-hub');

test('GĐ18B.3: Tự điền Hồ sơ dự án từ Notion (tìm theo SĐT trước, rồi theo tên dự án) và từ tệp hợp đồng/báo giá (AI)', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gd18b3-profile-'));
  const origFetch = global.fetch;
  const origGemini = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-gemini-key';

  t.after(async () => {
    global.fetch = origFetch;
    if (origGemini === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = origGemini;
    await fs.rm(dir, { recursive: true, force: true });
  });

  const mem = new Map();
  const store = {
    async get(k) { return mem.get(k) || null; },
    async put(k, v) { mem.set(k, v); }
  };
  const dataKey = 'u-18b3';
  const dbId = 'b'.repeat(32);

  // Cấu hình Notion Customer DB cho user
  await store.put('cfg-' + dataKey, {
    _version: 1,
    secrets: encrypt({
      notionToken: 'test-notion-token',
      notionCustomerDb: dbId,
      notionCustomerDbId: dbId,
      notionCustomerMap: {
        customer: 'Tên KH',
        address: 'Địa chỉ',
        phone: 'Điện thoại',
        email: 'Email'
      }
    })
  });

  // Tạo dự án trong schedule: trường phone đã có sẵn, các trường khác trống
  await store.put(dataKey, {
    _version: 1,
    projectOwners: [
      {
        id: 'proj_autofill',
        name: 'Masteri 1205 - Anh Đức',
        profile: {
          phone: '0912345678', // Đã có giá trị -> không được tự tích ghi đè
          customer: '',
          address: '',
          email: '',
          contract: ''
        }
      }
    ],
    calendars: [{ id: 'cal_1', ownerId: 'proj_autofill', name: 'GĐ1' }],
    tasks: []
  });

  const hubStore = new ProjectHubStore(store, dataKey);
  const assets = new ProjectAssets(dir, dataKey);

  // Tải lên 1 tệp hợp đồng CSV chứa Số hợp đồng
  const csvBuf = Buffer.from('Hợp đồng số: HĐ-2026/09-GD\nKhách hàng: Nguyễn Văn Đức\nĐịa chỉ công trình: Căn 1205 Masteri Waterfront\n', 'utf8');
  const savedDoc = await assets.save(csvBuf, '.csv', 'text/csv');
  await hubStore.saveProject('proj_autofill', rec => {
    rec.documents = [{
      id: 'doc_hd',
      type: 'quote',
      name: 'Hop-dong-thi-cong.csv',
      mime: 'text/csv',
      size: csvBuf.length,
      assetKey: savedDoc.assetKey
    }];
    return rec;
  });

  const notionQueries = [];
  global.fetch = async (url, opts = {}) => {
    const s = String(url);
    if (s.includes('api.notion.com/v1/databases/' + dbId) && (!opts.method || opts.method === 'GET')) {
      return Response.json({
        properties: {
          'Tên KH': { type: 'title' },
          'Địa chỉ': { type: 'rich_text' },
          'Điện thoại': { type: 'phone_number' },
          'Email': { type: 'email' }
        }
      });
    }
    if (s.includes('api.notion.com/v1/databases/' + dbId + '/query')) {
      notionQueries.push(s);
      return Response.json({
        results: [
          {
            object: 'page',
            id: 'page_1',
            properties: {
              'Tên KH': { type: 'title', title: [{ plain_text: 'Anh Nguyễn Văn Đức' }] },
              'Địa chỉ': { type: 'rich_text', rich_text: [{ plain_text: 'Masteri Waterfront, Gia Lâm' }] },
              'Điện thoại': { type: 'phone_number', phone_number: '0999888777' },
              'Email': { type: 'email', email: 'duc@gdhome.vn' }
            }
          }
        ],
        has_more: false
      });
    }
    if (s.includes('generativelanguage.googleapis.com')) {
      if (s.includes(':generateContent')) {
        return Response.json({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  customer: 'Anh Nguyễn Văn Đức',
                  address: 'Masteri Waterfront, Gia Lâm',
                  phone: '0912345678',
                  email: 'duc@gdhome.vn',
                  contract: 'HĐ-2026/09-GD'
                })
              }]
            }
          }]
        });
      }
      return Response.json({ models: [{ name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] }] });
    }
    return origFetch(url, opts);
  };

  let statusOut = 0;
  let dataOut = null;
  await handleProjectHub(
    { method: 'POST', url: '/api/project-hub/profile/autofill', headers: { 'content-type': 'application/json' } },
    '/api/project-hub/profile/autofill',
    {
      res: {},
      store,
      dataKey,
      dataDir: dir,
      readJsonBody: async () => ({ projectId: 'proj_autofill' }),
      sendJson: (_r, st, data) => { statusOut = st; dataOut = data; },
      defaultSchedule: () => ({ calendars: [], tasks: [] })
    }
  );

  assert.equal(statusOut, 200);
  assert.equal(dataOut.success, true);
  assert.equal(dataOut.hasSuggestions, true);
  assert.ok(notionQueries.length >= 1, 'Phải gọi Notion query');

  const byKey = Object.fromEntries(dataOut.fields.map(f => [f.key, f]));
  assert.equal(byKey.customer.proposed, 'Anh Nguyễn Văn Đức');
  assert.equal(byKey.customer.checked, true, 'Trường đang trống phải được tích chọn mặc định');
  assert.equal(byKey.address.proposed, 'Masteri Waterfront, Gia Lâm');
  assert.equal(byKey.address.checked, true);
  assert.equal(byKey.email.proposed, 'duc@gdhome.vn');
  assert.equal(byKey.email.checked, true);
  assert.equal(byKey.contract.proposed, 'HĐ-2026/09-GD');
  assert.equal(byKey.contract.checked, true);

  // Trường phone đã có giá trị '0912345678', Notion đề xuất '0999888777' -> KHÔNG được tự động tích ghi đè
  assert.equal(byKey.phone.current, '0912345678');
  assert.equal(byKey.phone.checked, false, 'Trường đang có giá trị không được tự ghi đè');
});
