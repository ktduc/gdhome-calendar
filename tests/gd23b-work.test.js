const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { WorkManager, workStoreKey, removeAccents, DEFAULT_CATEGORIES } = require('../work-manager');

// Mock in-memory store
function createMockStore() {
  const map = new Map();
  return {
    async get(key) {
      const val = map.get(key);
      return val ? structuredClone(val) : null;
    },
    async put(key, val) {
      map.set(key, structuredClone(val));
    },
    async delete(key) {
      map.delete(key);
    }
  };
}

test('GĐ23B.2: WorkManager CRUD nhà thầu & tìm kiếm tiếng Việt không dấu', async () => {
  const store = createMockStore();
  const manager = new WorkManager(store, 'test_user_1');

  // 1. Tạo mới nhà thầu
  const c1 = await manager.saveContractor({
    name: 'Đội thợ sơn Minh Quân',
    categories: ['Sơn bả', 'Trần thạch cao'],
    contactPerson: 'Nguyễn Văn Minh',
    phone: '0912345678',
    zalo: '0912345678',
    email: 'minhquan@gmail.com',
    area: 'Hà Nội & lân cận',
    rating: 5,
    notes: 'Tay nghề cao, thi công nhanh sạch'
  });

  assert.ok(c1.id, 'Phải sinh ID nhà thầu');
  assert.equal(c1.name, 'Đội thợ sơn Minh Quân');
  assert.equal(c1.rating, 5);

  const c2 = await manager.saveContractor({
    name: 'Công ty Cơ Điện Hoàng Long',
    categories: ['Điện nước (MEP)'],
    contactPerson: 'Trần Long',
    phone: '0988776655',
    area: 'TP.HCM',
    rating: 4
  });

  // 2. Lấy danh sách
  const all = await manager.listContractors();
  assert.equal(all.length, 2);

  // 3. Lọc theo hạng mục
  const sonBa = await manager.listContractors({ category: 'Sơn bả' });
  assert.equal(sonBa.length, 1);
  assert.equal(sonBa[0].name, 'Đội thợ sơn Minh Quân');

  const mep = await manager.listContractors({ category: 'Điện nước (MEP)' });
  assert.equal(mep.length, 1);
  assert.equal(mep[0].name, 'Công ty Cơ Điện Hoàng Long');

  // 4. Tìm kiếm không dấu
  const search1 = await manager.listContractors({ search: 'minh quan' });
  assert.equal(search1.length, 1);

  const search2 = await manager.listContractors({ search: 'hoang long' });
  assert.equal(search2.length, 1);

  const search3 = await manager.listContractors({ search: 'ha noi' });
  assert.equal(search3.length, 1);

  // 5. Cập nhật nhà thầu
  const updated = await manager.saveContractor({ id: c1.id, name: 'Đội thợ sơn Minh Quân PRO', rating: 4 });
  assert.equal(updated.name, 'Đội thợ sơn Minh Quân PRO');
  assert.equal(updated.rating, 4);

  // 6. Xoá nhà thầu
  const delOk = await manager.deleteContractor(c2.id);
  assert.equal(delOk, true);
  const remaining = await manager.listContractors();
  assert.equal(remaining.length, 1);
});

test('GĐ23B.2: WorkManager CRUD phiếu giao việc & cảnh báo quá hạn', async () => {
  const store = createMockStore();
  const manager = new WorkManager(store, 'test_user_1');

  // Tạo phiếu giao việc quá hạn (kết thúc trong quá khứ, chưa Xong)
  const pastDate = '2026-01-01';
  const a1 = await manager.saveAssignment({
    projectId: 'p1',
    projectName: 'Căn hộ Ecopark',
    taskId: 't-paint',
    taskTitle: 'Sơn bả hoàn thiện',
    contractorId: 'c1',
    contractorName: 'Đội thợ sơn Minh Quân',
    category: 'Sơn bả',
    scope: 'Bả 2 lớp, lót 1, phủ 2',
    quantity: '300 m2',
    startDate: '2025-12-20',
    endDate: pastDate,
    status: 'Đang làm',
    notes: 'Đúng màu Jotun'
  });

  assert.ok(a1.id);
  assert.equal(a1.isOverdue, true, 'Việc có endDate trong quá khứ và chưa Xong phải là quá hạn');

  // Tạo phiếu giao việc tương lai (không quá hạn)
  const a2 = await manager.saveAssignment({
    projectId: 'p1',
    projectName: 'Căn hộ Ecopark',
    taskId: 't-wood',
    taskTitle: 'Lắp đồ gỗ',
    contractorName: 'Xưởng mộc An Phát',
    category: 'Gỗ nội thất',
    startDate: '2026-12-01',
    endDate: '2026-12-20',
    status: 'Đã gửi'
  });
  assert.equal(a2.isOverdue, false);

  // Danh sách phiếu
  const list = await manager.listAssignments();
  assert.equal(list.length, 2);

  // Lọc theo trạng thái
  const dangLam = await manager.listAssignments({ status: 'Đang làm' });
  assert.equal(dangLam.length, 1);

  // Cập nhật trạng thái sang Xong -> hết quá hạn
  const done = await manager.saveAssignment({ id: a1.id, status: 'Xong' });
  assert.equal(done.isOverdue, false, 'Khi trạng thái Xong thì không còn báo quá hạn');

  // Xoá phiếu
  await manager.deleteAssignment(a2.id);
  const afterDel = await manager.listAssignments();
  assert.equal(afterDel.length, 1);
});

test('GĐ23B.2: Cách ly tài khoản (Account Isolation)', async () => {
  const store = createMockStore();
  const userA = new WorkManager(store, 'user_a@gmail.com');
  const userB = new WorkManager(store, 'user_b@gmail.com');

  assert.notEqual(userA.key, userB.key, 'Store key của 2 tài khoản phải khác nhau');
  assert.ok(userA.key.startsWith('work-v1-'), 'Key phải có định dạng work-v1-<hash>');

  // User A tạo nhà thầu & phiếu
  await userA.saveContractor({ name: 'Nhà thầu của A' });
  await userA.saveAssignment({ contractorName: 'Nhà thầu của A', scope: 'Việc của A' });

  // User B không thấy dữ liệu của A
  const bContractors = await userB.listContractors();
  const bAssignments = await userB.listAssignments();
  assert.equal(bContractors.length, 0, 'User B không được thấy nhà thầu của User A');
  assert.equal(bAssignments.length, 0, 'User B không được thấy phiếu giao việc của User A');
});

test('GĐ23B.2: Server API /api/work/overview, /api/work/contractors, /api/work/assignments', async () => {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gdhome-api-work-'));
  Object.assign(process.env, { DATA_DIR: dir, GIST_TOKEN: '', GOOGLE_CLIENT_ID: '', APP_PASSWORD: '', R2_ACCOUNT_ID: '' });
  const { server, initStore } = require('../server');
  await initStore();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET /api/work/overview
    const resOverview = await fetch(`${baseUrl}/api/work/overview`);
    assert.equal(resOverview.status, 200);
    const dataOverview = await resOverview.json();
    assert.equal(dataOverview.success, true);
    assert.ok(Array.isArray(dataOverview.categories));
    assert.ok(Array.isArray(dataOverview.statuses));

    // 2. POST /api/work/contractors (tạo nhà thầu)
    const resCreateC = await fetch(`${baseUrl}/api/work/contractors`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Đội thợ trần thạch cao Vĩnh Tường',
        categories: ['Trần thạch cao'],
        phone: '0933221100'
      })
    });
    assert.equal(resCreateC.status, 200);
    const cData = await resCreateC.json();
    assert.equal(cData.success, true);
    const contractorId = cData.contractor.id;

    // 3. GET /api/work/contractors
    const resListC = await fetch(`${baseUrl}/api/work/contractors`);
    const listC = await resListC.json();
    assert.equal(listC.contractors.length, 1);
    assert.equal(listC.contractors[0].name, 'Đội thợ trần thạch cao Vĩnh Tường');

    // 4. POST /api/work/assignments (tạo phiếu giao việc)
    const resCreateA = await fetch(`${baseUrl}/api/work/assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contractorId,
        contractorName: 'Đội thợ trần thạch cao Vĩnh Tường',
        category: 'Trần thạch cao',
        scope: 'Đóng trần giật cấp phòng khách & bếp',
        quantity: '85 m2',
        startDate: '2026-11-12',
        endDate: '2026-11-15',
        status: 'Đã gửi'
      })
    });
    assert.equal(resCreateA.status, 200);
    const aData = await resCreateA.json();
    assert.equal(aData.success, true);
    const assignmentId = aData.assignment.id;

    // 5. GET /api/work/assignments
    const resListA = await fetch(`${baseUrl}/api/work/assignments`);
    const listA = await resListA.json();
    assert.equal(listA.assignments.length, 1);
    assert.equal(listA.assignments[0].scope, 'Đóng trần giật cấp phòng khách & bếp');

    // 6. Xoá phiếu và nhà thầu
    const resDelA = await fetch(`${baseUrl}/api/work/assignments/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: assignmentId })
    });
    assert.equal(resDelA.status, 200);

    const resDelC = await fetch(`${baseUrl}/api/work/contractors/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contractorId })
    });
    assert.equal(resDelC.status, 200);
  } finally {
    await new Promise(resolve => server.close(resolve));
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});

test('GĐ23B.2: Playwright tạo nhà thầu, tạo phiếu, chọn 3 trang PDF giả và tạo PDF ghép', async () => {
  const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/KTDUC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gdhome-pw-work-'));
  Object.assign(process.env, { DATA_DIR: dir, GIST_TOKEN: '', GOOGLE_CLIENT_ID: '', APP_PASSWORD: '', R2_ACCOUNT_ID: '' });
  const { server, initStore, getStore } = require('../server');
  await initStore();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  // 1. Tạo 1 file PDF giả gồm 5 trang có đánh số rõ ràng
  const mockPdfDoc = await PDFDocument.create();
  const font = await mockPdfDoc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < 5; i++) {
    const page = mockPdfDoc.addPage([500, 700]);
    page.drawText(`BAN VE CHI TIET - TRANG ${i + 1}`, { x: 50, y: 650, size: 20, font, color: rgb(0.1, 0.1, 0.1) });
    page.drawRectangle({ x: 50, y: 100, width: 400, height: 500, borderColor: rgb(0.2, 0.4, 0.8), borderWidth: 2 });
  }
  const mockPdfBytes = await mockPdfDoc.save();
  const base64Pdf = Buffer.from(mockPdfBytes).toString('base64');

  // Khởi tạo dự án và nạp file PDF mẫu vào Quản lý dự án
  const schedule = {
    _version: 1, startMonth: '2026-11', endMonth: '2026-11', activeCalendarId: 'c1',
    projectOwners: [{ id: 'proj-pw', name: 'Biệt thự Gamuda GĐ23B' }],
    calendars: [{ id: 'c1', ownerId: 'proj-pw', name: 'Thi công', visible: true, color: '#a00' }],
    tasks: [{ id: 'task-pw-1', calendarId: 'c1', title: 'Sơn bả tầng 1-3', startDate: '2026-11-12', endDate: '2026-11-18' }]
  };
  await getStore().put('shared', schedule);

  // Tải file PDF mẫu qua API Project Hub
  const uploadRes = await fetch(`${baseUrl}/api/project-hub/documents/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      projectId: 'proj-pw',
      name: 'HSKT-Kien-Truc-Mau.pdf',
      type: 'drawing',
      dataBase64: base64Pdf,
      mime: 'application/pdf'
    })
  });
  assert.equal(uploadRes.status, 200, 'Tải tài liệu PDF mẫu phải thành công');

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  page.on('console', msg => console.log('PW CONSOLE:', msg.text()));
  page.on('pageerror', err => console.log('PW ERROR:', err));

  try {
    // 2. Mở trang /giao-viec
    await page.goto(`${baseUrl}/giao-viec`, { waitUntil: 'networkidle' });

    // 3. Tạo nhà thầu mới qua modal UI
    await page.click('#btn-add-contractor');
    await page.waitForSelector('#dialog-contractor[open]');
    await page.fill('#contractor-name', 'Đội thợ sơn Hưng Phát');
    await page.fill('#contractor-phone', '0987654321');
    await page.click('#btn-save-contractor');
    await page.waitForSelector('#dialog-contractor', { state: 'hidden' });

    // 4. Tạo phiếu giao việc mới qua modal UI
    await page.click('#btn-add-assignment');
    await page.waitForSelector('#dialog-assignment[open]');
    await page.selectOption('#assign-project', 'proj-pw');
    await page.selectOption('#assign-contractor', { index: 1 });
    await page.fill('#assign-category', 'Sơn bả');
    await page.fill('#assign-scope', 'Bả 2 lớp + sơn lót + sơn hoàn thiện');
    await page.fill('#assign-quantity', '450 m2');
    await page.click('#btn-save-assignment');
    await page.waitForSelector('#dialog-assignment', { state: 'hidden' });

    // Kiểm tra dòng phiếu đã hiện trên bảng
    await page.waitForSelector('#table-assignments tr[data-assignment-id]');
    const tableText = await page.innerText('#table-assignments');
    assert.ok(tableText.includes('Đội thợ sơn Hưng Phát'));
    assert.ok(tableText.includes('Sơn bả'));

    // 5. Mở bộ ghép PDF (PDF Builder)
    await page.click('#btn-open-pdf-builder');
    await page.waitForSelector('#dialog-pdf-builder[open]');
    await page.selectOption('#pdf-project-select', 'proj-pw');

    // Chờ thumbnails các trang PDF được render
    await page.waitForSelector('.pdf-thumb-item', { timeout: 10000 });
    const thumbsCount = await page.locator('.pdf-thumb-item').count();
    assert.equal(thumbsCount, 5, 'Phải render đủ 5 trang từ PDF giả');

    // Bỏ chọn tất cả, sau đó chọn đúng 3 trang (Trang 1, Trang 3, Trang 5 - index 0, 2, 4)
    await page.click('#btn-pdf-deselect-all');
    const checkboxes = page.locator('.pdf-thumb-checkbox');
    await checkboxes.nth(0).check();
    await checkboxes.nth(2).check();
    await checkboxes.nth(4).check();

    const selectedCount = await page.innerText('#selected-pages-count');
    assert.equal(selectedCount, '3', 'Phải chọn đúng 3 trang');

    // Bật tuỳ chọn trang bìa
    await page.check('#pdf-opt-cover');

    // Thiết lập bắt file tải về khi bấm "Tạo PDF"
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#btn-execute-pdf-build')
    ]);

    const downloadedPath = await download.path();
    assert.ok(downloadedPath, 'Phải tải về file PDF');

    // 6. Kiểm tra file PDF đầu ra bằng pdf-lib
    const downloadedBytes = await fs.promises.readFile(downloadedPath);
    const resultDoc = await PDFDocument.load(downloadedBytes);

    // Vì bật trang bìa tự sinh + 3 trang bản vẽ đã chọn -> Tổng cộng đúng 4 trang (bìa + 3 trang)
    assert.equal(resultDoc.getPageCount(), 4, 'PDF đầu ra phải có đúng 4 trang (1 trang bìa + 3 trang bản vẽ chọn)');

    // Kiểm tra tiếp: tắt trang bìa -> đầu ra có đúng 3 trang
    await page.click('#btn-open-pdf-builder');
    await page.waitForSelector('#dialog-pdf-builder[open]');
    await page.waitForSelector('.pdf-thumb-item');
    await page.click('#btn-pdf-deselect-all');
    await page.locator('.pdf-thumb-checkbox').nth(1).check();
    await page.locator('.pdf-thumb-checkbox').nth(2).check();
    await page.locator('.pdf-thumb-checkbox').nth(3).check();
    await page.uncheck('#pdf-opt-cover');

    const [download2] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      page.click('#btn-execute-pdf-build')
    ]);
    const downloadedPath2 = await download2.path();
    const resultDoc2 = await PDFDocument.load(await fs.promises.readFile(downloadedPath2));
    assert.equal(resultDoc2.getPageCount(), 3, 'Khi tắt trang bìa, PDF đầu ra có đúng 3 trang');

    console.log('PLAYWRIGHT TEST GĐ23B.2 THÀNH CÔNG: TẠO NHÀ THẦU, TẠO PHIẾU, CHỌN 3 TRANG PDF VÀ XUẤT ĐÚNG THỨ TỰ!');
  } finally {
    await browser.close();
    await new Promise(resolve => server.close(resolve));
    await fs.promises.rm(dir, { recursive: true, force: true });
  }
});
