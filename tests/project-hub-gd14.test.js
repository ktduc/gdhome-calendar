const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const {
  BUILDING_TYPES,
  guessBuildingType,
  getBuildingContextPrompt,
  generateScheduleProposal,
  generateMaterialsProposal,
  globalJobManager,
  ProjectAssets,
  ProjectHubStore
} = require('../project-hub');

test('GĐ14 B2: Loại công trình trong ngữ cảnh AI và đề xuất', () => {
  // 1. Danh mục loại công trình
  assert.deepEqual(BUILDING_TYPES, ['Chung cư', 'Nhà phố', 'Văn phòng nhỏ', 'Khác']);

  // 2. Tự động đoán theo tên và địa chỉ
  assert.equal(guessBuildingType('Chung cư Masteri Waterfront', 'Gia Lâm, Hà Nội'), 'Chung cư');
  assert.equal(guessBuildingType('Căn hộ 1205 Vinhomes Smart City', 'Tây Mỗ, Nam Từ Liêm'), 'Chung cư');
  assert.equal(guessBuildingType('Nhà phố liền kề Shophouse', 'Phố Huế, Hai Bà Trưng'), 'Nhà phố');
  assert.equal(guessBuildingType('Biệt thự song lập Ecopark', 'Số 25 ngõ 10 đường Trúc'), 'Nhà phố');
  assert.equal(guessBuildingType('Văn phòng công ty Techcom', 'Tòa nhà văn phòng Keangnam'), 'Văn phòng nhỏ');
  assert.equal(guessBuildingType('Co-working Space Tầng 5', 'Office Building Cầu Giấy'), 'Văn phòng nhỏ');
  assert.equal(guessBuildingType('Khu triển lãm', 'Địa điểm khảo sát'), 'Khác');

  // 3. System Prompt theo từng loại
  const ccPrompt = getBuildingContextPrompt('Chung cư');
  assert.ok(ccPrompt.includes('CHUNG CƯ'));
  assert.ok(ccPrompt.includes('Không có phần móng'));
  assert.ok(ccPrompt.includes('thang máy hàng'));

  const npPrompt = getBuildingContextPrompt('Nhà phố');
  assert.ok(npPrompt.includes('NHÀ PHỐ'));
  assert.ok(npPrompt.includes('nhiều tầng'));
  assert.ok(npPrompt.includes('móng/cột/dầm'));

  const vpPrompt = getBuildingContextPrompt('Văn phòng nhỏ');
  assert.ok(vpPrompt.includes('VĂN PHÒNG NHỎ'));
  assert.ok(vpPrompt.includes('sàn nâng'));
  assert.ok(vpPrompt.includes('vách kính'));

  // 4. Đề xuất Tiến độ tuỳ biến theo Loại công trình
  const sampleItems = [
    { id: '0', name: 'Đổ móng và xây trát tường', category: 'Phần thô & Xây trát' },
    { id: '1', name: 'Sơn bả tường', category: 'Trần & Sơn bả' },
    { id: '2', name: 'Cửa vách kính', category: 'Nhôm kính & Cửa' }
  ];

  const schedChungCu = generateScheduleProposal('proj_1', sampleItems, [], 'Chung cư');
  assert.ok(!schedChungCu.tasks.some(t => t.title.includes('móng/cột/dầm')));

  const schedNhaPho = generateScheduleProposal('proj_2', sampleItems, [], 'Nhà phố');
  assert.ok(schedNhaPho.tasks.some(t => t.title.includes('móng/cột/dầm')));

  const schedVanPhong = generateScheduleProposal('proj_3', sampleItems, [], 'Văn phòng nhỏ');
  assert.ok(schedVanPhong.tasks.some(t => t.title.includes('sàn nâng')));
});

test('GĐ14 B1 & B3: API Gán ảnh 3D vào Chốt mã và Background Job AI phân tích', async t => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gdhome-gd14-api-'));
  const origEnv = { ...process.env };
  Object.assign(process.env, {
    DATA_DIR: dir,
    GIST_TOKEN: '',
    GOOGLE_CLIENT_ID: 'test-client',
    SESSION_SECRET: 'test-session-secret'
  });

  const { server, initStore, signSession, getStore } = require('../server');
  await initStore();

  if (!server.listening) {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(0, '127.0.0.1', resolve);
    });
  }

  t.after(async () => {
    process.env = origEnv;
    if (server.listening) {
      await new Promise(r => server.close(r));
    }
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  });

  const origin = 'http://127.0.0.1:' + server.address().port;
  const store = getStore();
  const email = 'user_b1b3@gdhome.vn';
  const token = signSession({ email, exp: Date.now() + 3600000 });
  const dataKey = email;
  const matKey = 'mat-v1-' + crypto.createHash('sha256').update(dataKey).digest('hex');

  // Tạo trước bảng Chốt mã cho test B1
  const sheetId = 'sheet_test_1';
  const rowId = 'row_test_sofa';
  await store.put(matKey, {
    _version: 1,
    sheets: [
      {
        id: sheetId,
        title: 'Bảng Chốt mã Masteri',
        projectId: 'proj_masteri',
        groups: [
          {
            id: 'grp_sofa',
            name: 'ĐỒ RỜI & SOFA',
            rows: [
              {
                id: rowId,
                name: 'Sofa da bò cao cấp',
                render: [],
                options: [{ images: [] }]
              }
            ]
          }
        ]
      }
    ]
  });

  const postJson = async (urlPath, body) => {
    const res = await fetch(`${origin}${urlPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(body)
    });
    return { status: res.status, data: await res.json() };
  };

  const getJson = async (urlPath) => {
    const res = await fetch(`${origin}${urlPath}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return { status: res.status, data: await res.json() };
  };

  // --- KIỂM TRA B1: Gán ảnh phối cảnh 3D vào Chốt mã ---
  const testAssetKey = 'render-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.webp';
  const res1 = await postJson('/api/project-hub/renders/assign-to-materials', {
    projectId: 'proj_masteri',
    assetKey: testAssetKey,
    sheetId,
    rowId
  });

  assert.equal(res1.status, 200);
  assert.equal(res1.data.success, true);
  assert.equal(res1.data.assignedImage, '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.webp');

  const updatedMat1 = await store.get(matKey);
  const targetRow1 = updatedMat1.sheets[0].groups[0].rows[0];
  assert.deepEqual(targetRow1.render, ['0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef.webp']);

  // Gán vào toàn bộ nhóm
  const testAssetKey2 = 'render-9999999999abcdef0123456789abcdef0123456789abcdef0123456789abcdef.webp';
  const res2 = await postJson('/api/project-hub/renders/assign-to-materials', {
    projectId: 'proj_masteri',
    assetKey: testAssetKey2,
    sheetId,
    groupName: 'ĐỒ RỜI & SOFA'
  });
  assert.equal(res2.status, 200);
  assert.equal(res2.data.success, true);

  const updatedMat2 = await store.get(matKey);
  const targetRow2 = updatedMat2.sheets[0].groups[0].rows[0];
  assert.ok(targetRow2.render.includes('9999999999abcdef0123456789abcdef0123456789abcdef0123456789abcdef.webp'));

  // --- KIỂM TRA B3: Background Job phân tích AI & AutoPush ---
  const hubStore = new ProjectHubStore(store, dataKey);
  await hubStore.saveProject('proj_job_test', rec => {
    rec.name = 'Dự án Căn hộ Test Job';
    rec.buildingType = 'Chung cư';
    rec.quoteItems = [
      { id: 'item_1', name: 'Sofa góc nỉ', category: 'Đồ rời & Sofa/Rèm', room: 'Phòng khách' },
      { id: 'item_2', name: 'Tủ bếp Acrylic', category: 'Đồ gỗ nội thất', room: 'Bếp' }
    ];
    return rec;
  });

  // 1. Khởi động Job với cờ skipAi: true và autoPush: true
  const startRes = await postJson('/api/project-hub/jobs/start', {
    projectId: 'proj_job_test',
    skipAi: true,
    autoPush: true
  });
  assert.equal(startRes.status, 200);
  assert.equal(startRes.data.success, true);
  const job = startRes.data.job;
  assert.ok(job.id);
  assert.equal(job.projectId, 'proj_job_test');

  // 2. Thăm dò status
  const statusRes = await getJson(`/api/project-hub/jobs/status?jobId=${job.id}`);
  assert.equal(statusRes.status, 200);
  assert.ok(statusRes.data.job);
  assert.ok(statusRes.data.job.progress >= 5);

  // 3. Active job
  const activeRes = await getJson(`/api/project-hub/jobs/active?projectId=proj_job_test`);
  assert.equal(activeRes.status, 200);
  assert.ok(activeRes.data.job);
  assert.equal(activeRes.data.job.id, job.id);

  // Đợi job xong trong nền
  let completedJob = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 50));
    const poll = await getJson(`/api/project-hub/jobs/status?jobId=${job.id}`);
    if (poll.data.job?.status === 'done') {
      completedJob = poll.data.job;
      break;
    }
  }

  assert.ok(completedJob, 'Job phải hoàn thành tự động');
  assert.equal(completedJob.status, 'done');
  assert.equal(completedJob.progress, 100);
  assert.equal(completedJob.result.scheduleProposed, true);
  assert.equal(completedJob.result.materialsProposed, true);

  // 4. Kiểm tra autoPush đã đẩy đề xuất sang Tiến độ & Chốt mã trong nền
  const schedule = await store.get(dataKey);
  assert.ok(schedule.tasks.length > 0, 'Phải tự động tạo công việc Tiến độ');

  // 5. Kiểm tra huỷ Job
  const testCancelJob = globalJobManager.createJob({
    projectId: 'proj_cancel_test',
    projectName: 'Dự án Huỷ',
    dataKey,
    runFn: async (j, signal) => {
      return new Promise(resolve => {
        const t = setTimeout(() => resolve({ ok: true }), 1000);
        t.unref?.();
        signal.addEventListener('abort', () => {
          clearTimeout(t);
          resolve({ aborted: true });
        });
      });
    }
  });

  const cancelRes = await postJson('/api/project-hub/jobs/cancel', { jobId: testCancelJob.id });
  assert.equal(cancelRes.status, 200);
  assert.equal(cancelRes.data.cancelled, true);

  const cancelledPoll = await getJson(`/api/project-hub/jobs/status?jobId=${testCancelJob.id}`);
  assert.equal(cancelledPoll.data.job.status, 'cancelled');
});
