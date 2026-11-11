const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'C:/Users/KTDUC/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

async function run() {
  const dir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gdhome-gd23b-'));
  Object.assign(process.env, { DATA_DIR: dir, GIST_TOKEN: '', GOOGLE_CLIENT_ID: '', APP_PASSWORD: '', R2_ACCOUNT_ID: '' });
  const { server, initStore, getStore } = require('../../server');
  await initStore();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const schedule = {
    _version: 1, startMonth: '2026-11', endMonth: '2026-11', activeCalendarId: 'c1',
    projectOwners: [{ id: 'p1', name: 'Biệt thự Gamuda' }],
    calendars: [{ id: 'c1', ownerId: 'p1', name: 'Thi công', visible: true, color: '#a00' }],
    tasks: []
  };
  await getStore().put('shared', schedule);

  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  });

  const pagesInfo = [
    { url: '/', name: 'lich', file: 'sau-lich-1440.png' },
    { url: '/chot-ma', name: 'chot-ma', file: 'sau-chot-ma-1440.png' },
    { url: '/du-an', name: 'du-an', file: 'sau-du-an-1440.png' },
    { url: '/tools', name: 'tools', file: 'sau-tools-1440.png' },
    { url: '/giao-viec', name: 'giao-viec', file: 'sau-giao-viec-1440.png' }
  ];

  const measurements = [];

  for (const item of pagesInfo) {
    const page = await context.newPage();
    try {
      await page.goto(baseUrl + item.url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1000);

      // Chụp ảnh sau 1440px
      const outPath = path.join(__dirname, item.file);
      await page.screenshot({ path: outPath, fullPage: false });
      console.log('Saved screenshot:', item.file);

      // Đo kích thước & vị trí
      const m = await page.evaluate(() => {
        const header = document.querySelector('.app-header');
        const hRect = header ? header.getBoundingClientRect() : null;

        const toggleBtn = document.getElementById('btn-toggle-sidebar') || document.querySelector('.shell-sidebar-toggle');
        const tRect = toggleBtn ? toggleBtn.getBoundingClientRect() : null;

        const avatar = document.querySelector('.shell-user-avatar') || document.querySelector('.user-chip-avatar');
        const aRect = avatar ? avatar.getBoundingClientRect() : null;

        return {
          header: hRect ? { y: Math.round(hRect.y), height: Math.round(hRect.height) } : null,
          toggle: tRect ? { x: Math.round(tRect.x), y: Math.round(tRect.y), width: Math.round(tRect.width), height: Math.round(tRect.height) } : null,
          avatar: aRect ? { x: Math.round(aRect.x), y: Math.round(aRect.y), width: Math.round(aRect.width), height: Math.round(aRect.height), right: Math.round(window.innerWidth - aRect.right) } : null
        };
      });

      console.log(`${item.name}:`, JSON.stringify(m));
      measurements.push({ name: item.name, ...m });
    } finally {
      await page.close();
    }
  }

  await browser.close();
  await new Promise(resolve => server.close(resolve));
  await fs.promises.rm(dir, { recursive: true, force: true });

  // Kiểm tra đo lường trên 5 trang
  assert.equal(measurements.length, 5, 'Phải đo đủ 5 trang');

  for (const m of measurements) {
    assert.ok(m.header, `${m.name} phải có header`);
    assert.equal(m.header.y, 0, `${m.name} header y phải là 0`);
    assert.ok(Math.abs(m.header.height - 52) <= 1, `${m.name} header height phải là 52px (±1px), thực tế: ${m.header.height}`);

    assert.ok(m.toggle, `${m.name} phải có nút toggle ☰`);
    assert.ok(Math.abs(m.toggle.y - 10) <= 1, `${m.name} toggle y phải là 10px (±1px), thực tế: ${m.toggle.y}`);
    assert.ok(Math.abs(m.toggle.width - 32) <= 1, `${m.name} toggle width phải là 32px (±1px), thực tế: ${m.toggle.width}`);
    assert.ok(Math.abs(m.toggle.height - 32) <= 1, `${m.name} toggle height phải là 32px (±1px), thực tế: ${m.toggle.height}`);

    assert.ok(m.avatar, `${m.name} phải có avatar`);
    assert.ok(Math.abs(m.avatar.width - 28) <= 1, `${m.name} avatar width phải là 28px (±1px), thực tế: ${m.avatar.width}`);
    assert.ok(Math.abs(m.avatar.height - 28) <= 1, `${m.name} avatar height phải là 28px (±1px), thực tế: ${m.avatar.height}`);
    assert.ok(Math.abs(m.avatar.y - 12) <= 1, `${m.name} avatar y phải là 12px (±1px), thực tế: ${m.avatar.y}`);
  }

  // So sánh giữa các trang
  const first = measurements[0];
  for (let i = 1; i < measurements.length; i++) {
    const cur = measurements[i];
    assert.ok(Math.abs(cur.header.height - first.header.height) <= 1, `Header height khác nhau giữa ${first.name} và ${cur.name}`);
    assert.ok(Math.abs(cur.toggle.y - first.toggle.y) <= 1, `Toggle y khác nhau giữa ${first.name} và ${cur.name}`);
    assert.ok(Math.abs(cur.toggle.width - first.toggle.width) <= 1, `Toggle width khác nhau giữa ${first.name} và ${cur.name}`);
    assert.ok(Math.abs(cur.toggle.height - first.toggle.height) <= 1, `Toggle height khác nhau giữa ${first.name} và ${cur.name}`);
    assert.ok(Math.abs(cur.avatar.width - first.avatar.width) <= 1, `Avatar width khác nhau giữa ${first.name} và ${cur.name}`);
    assert.ok(Math.abs(cur.avatar.height - first.avatar.height) <= 1, `Avatar height khác nhau giữa ${first.name} và ${cur.name}`);
    assert.ok(Math.abs(cur.avatar.y - first.avatar.y) <= 1, `Avatar y khác nhau giữa ${first.name} và ${cur.name}`);
    assert.ok(Math.abs(cur.avatar.right - first.avatar.right) <= 1, `Avatar right khác nhau giữa ${first.name} (${first.avatar.right}) và ${cur.name} (${cur.avatar.right})`);
  }

  console.log('TẤT CẢ ĐO LƯỜNG PLAYWRIGHT ĐẠT CHUẨN ĐỒNG BỘ 5 TRANG (±1px)!');
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
