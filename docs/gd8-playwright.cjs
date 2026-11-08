// node docs/gd8-playwright.cjs [8.1 ...]
// PLAYWRIGHT_PATH may point to a local Playwright installation. Uses installed Edge.
const assert = require('node:assert/strict');
const { mkdtemp,rm } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
const cases = {};

cases['8.1'] = async page => {
  await openMaterials(page);
  const row = page.locator('[data-row="g8-r1"]');
  const button = row.locator('[data-action="del-row"]');
  await button.scrollIntoViewIfNeeded();
  await button.focus();
  const before = await viewPosition(page);
  assert.ok(before.top > 0 && before.left > 0,'test must start below and to the right of the first row');
  page.once('dialog',dialog => dialog.accept());
  await button.click();
  await row.waitFor({state:'detached'});
  await page.waitForFunction(() => document.activeElement?.closest('[data-row]')?.dataset.row === 'g8-r2');
  const after = await viewPosition(page);
  assert.ok(Math.abs(after.top-before.top) <= 75,JSON.stringify({ before,after }));
  assert.equal(after.left,before.left);
  assert.equal(after.page,before.page);
};

cases['8.2'] = async page => {
  await page.goto('/');
  const owner = page.locator('.sidebar-compact .project-owner-header').first();
  const stage = page.locator('.sidebar-compact .calendar-list-item:not(.active-selected)').first();
  await owner.waitFor();
  for (const [item,title] of [[owner,'.project-owner-title'],[stage,'.cal-item-left']]) {
    await page.locator('.app-logo').hover();
    const bounds = () => item.evaluate((el,label) => {
      const box = node => {
        const rect = node.getBoundingClientRect();
        return [rect.x,rect.y,rect.width,rect.height];
      };
      return [box(el),box(el.querySelector(label)),box(el.closest('.app-sidebar'))];
    },title);
    const before = await bounds();
    await item.hover();
    assert.deepEqual(await bounds(),before,'Hover phải giữ vị trí và độ rộng');
  }
};

function viewPosition(page) {
  return page.locator('.sheet-scroll').evaluate(el => ({top:el.scrollTop,left:el.scrollLeft,page:window.scrollY}));
}
async function openMaterials(page) {
  await page.goto('/chot-ma');
  await page.getByRole('button',{name:'Bảng mẫu GĐ8',exact:true}).click();
  await page.locator('[data-row="g1-r1"]').waitFor();
}

async function main() {
  const dir = await mkdtemp(path.join(os.tmpdir(),'gdhome-gd8-'));
  Object.assign(process.env,{ DATA_DIR:dir,GIST_TOKEN:'',GOOGLE_CLIENT_ID:'',APP_PASSWORD:'',R2_ACCOUNT_ID:'' });
  const { server,initStore,getStore } = require('../server');
  const { MaterialStore } = require('../materials');
  let browser;
  try {
    await initStore();
    await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
    const schedule = { _version:1,startMonth:'2026-11',endMonth:'2026-11',activeCalendarId:'c1',
      projectOwners:[{id:'p1',name:'Căn hộ mẫu GĐ8'}],calendars:[
        {id:'c1',ownerId:'p1',name:'Thi công',visible:true,color:'#a00'},
        {id:'c2',ownerId:'p1',name:'Giai đoạn chưa chọn',visible:true,color:'#900'}
      ],tasks:[] };
    await getStore().put('shared',schedule);
    const repository = new MaterialStore(getStore(),'shared');
    const fixture = { id:'gd8-sheet',projectId:'p1',title:'Bảng mẫu GĐ8',meta:{project:'Căn hộ mẫu GĐ8'},groups:Array.from({length:10},(_,g)=>({
      id:'g'+(g+1),name:'Nhóm '+(g+1),rows:Array.from({length:15},(_,r)=>({
        id:'g'+(g+1)+'-r'+(r+1),name:'Dòng '+(g+1)+' / '+(r+1),room:'',decision:'draft',chosen:null,render:[],
        options:[{images:[]},{images:[]},{images:[]}]
      }))
    })) };
    browser = await chromium.launch({ channel:'msedge',headless:true });
    for (const key of process.argv.length > 2 ? process.argv.slice(2) : Object.keys(cases)) {
      await repository.update(undefined,data => { data.sheets = [structuredClone(fixture)]; return {}; });
      const page = await browser.newPage({ baseURL:'http://127.0.0.1:'+server.address().port,viewport:{width:1050,height:720},acceptDownloads:false });
      page.setDefaultTimeout(4000);
      try { await cases[key](page); console.log(key+' đạt'); }
      finally { await page.close(); }
    }
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await rm(dir,{ recursive:true,force:true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
