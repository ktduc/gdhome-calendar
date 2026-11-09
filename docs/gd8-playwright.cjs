// node docs/gd8-playwright.cjs [8.1 ... 9.6]
// PLAYWRIGHT_PATH may point to a local Playwright installation. Uses installed Edge.
const assert = require('node:assert/strict');
const { mkdtemp,rm,writeFile } = require('node:fs/promises');
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

  await page.setViewportSize({width:690,height:560});
  const next = page.locator('[data-row="g8-r2"] [data-action="del-row"]');
  await next.scrollIntoViewIfNeeded();
  const mobileBefore = await viewPosition(page);
  assert.ok(mobileBefore.page > 0,'test phải có cuộn cả trang');
  page.once('dialog',dialog => dialog.accept());
  await next.click();
  await page.waitForFunction(() => document.activeElement?.closest('[data-row]')?.dataset.row === 'g8-r3');
  const mobileAfter = await viewPosition(page);
  assert.equal(mobileAfter.page,mobileBefore.page);
  assert.equal(mobileAfter.left,mobileBefore.left);
  assert.ok(Math.abs(mobileAfter.top-mobileBefore.top) <= 75);
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

cases['8.3'] = async page => {
  await page.goto('/');
  const metrics = await page.evaluate(() => ({
    height:document.querySelector('.app-header').getBoundingClientRect().height,
    sidebar:document.querySelector('.app-sidebar').getBoundingClientRect().width,
    primary:getComputedStyle(document.querySelector('#btn-add-task')).backgroundColor,
    copy:getComputedStyle(document.querySelector('#btn-quick-copy-clipboard')).backgroundColor
  }));
  await openMaterials(page);
  const header = page.locator('header.app-header');
  assert.equal(await header.count(),1,'Chốt mã phải dùng header chung');
  const order = await header.locator('[data-header-command]').evaluateAll(nodes => nodes.map(node => node.dataset.headerCommand));
  assert.deepEqual(order,['file','ai','copy','undo','redo','add']);
  assert.deepEqual(await page.evaluate(() => ({
    height:document.querySelector('.app-header').getBoundingClientRect().height,
    sidebar:document.querySelector('.material-sidebar').getBoundingClientRect().width,
    primary:getComputedStyle(document.querySelector('#material-add')).backgroundColor,
    copy:getComputedStyle(document.querySelector('#material-copy')).backgroundColor
  })),metrics);
  await header.getByText('Thêm dòng/nhóm').click();
  await header.getByRole('button',{name:'Thêm danh mục',exact:true}).click();
  await page.locator('[data-field="groupName"][value="Nhóm mới"]').waitFor();
};

cases['8.4'] = async page => {
  await openMaterials(page);
  const select = id => page.locator('[data-select-row="' + id + '"]');
  await select('g1-r1').click();
  await select('g1-r4').click({modifiers:['Shift']});
  await select('g1-r6').click({modifiers:['Control']});
  await page.getByText('Đã chọn 5 dòng',{exact:true}).waitFor();
  page.once('dialog',dialog => dialog.accept());
  await page.keyboard.press('Delete');
  assert.equal(await page.locator('tr[data-row]').count(),145);
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('tr[data-row]').count(),150);
  await page.locator('input[data-select-group="g1"]').click();
  await page.getByText('Đã chọn 15 dòng',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await page.getByText('Đã chọn 15 dòng',{exact:true}).waitFor({state:'hidden'});
  await page.locator('input[data-select-all]').click();
  await page.getByText('Đã chọn 150 dòng',{exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await select('g1-r1').click();
  await select('g1-r2').click();
  await page.getByRole('combobox',{name:'Đổi trạng thái',exact:true}).selectOption('sent');
  assert.equal(await page.locator('[data-row="g1-r1"] [data-field="decision"]').inputValue(),'sent');
  assert.equal(await page.locator('[data-row="g1-r2"] [data-field="decision"]').inputValue(),'sent');
  await page.getByRole('combobox',{name:'Chuyển sang nhóm',exact:true}).selectOption('g2');
  assert.equal(await page.locator('[data-group="g2"] [data-row="g1-r1"]').count(),1);
  await page.locator('#material-multiselect [data-action="bulk-duplicate"]').click();
  assert.equal(await page.locator('tr[data-row]').count(),152);
};

const imageFixture = 'iVBORw0KGgoAAAANSUhEUgAAAMAAAAB4CAIAAAArJ2pIAAABCUlEQVR42u3VQQ3AIAxA0W3hOie42w0BszA5mMAJBrCwcCEp7zko/Sln/Z4DZl2eAAEhIASEgEBACAgBISAQEAJCQAgIBISAEBACAgEhINZKUQd7273tUkvuLhC+MAQEAkJACAgBgYAQEAJCQCAgBISAEBACAgEhIASEgEBACAgBISAQEAJCQAgIBISAEBACQkAgIASEgBAQCAgBISAEBAJCQAgIAYGAEBACQkAICASEgBAQAgIBISAEhIBAQAgIASEgEBACQkAICASEgBAQAkJAICAEhIAQEPyRog5WcrddFwgBISAQEAJCQAgIBISAEBACQkAgIASEgBAQCAgBISAEBAJCQAiIiAZB4QdWS5tt1wAAAABJRU5ErkJggg==';
cases['8.5'] = async page => {
  await openMaterials(page);
  const cell = page.locator('[data-row="g1-r1"] [data-slot="0"]');
  await (cell.locator('.image-plus').or(cell)).first().click();
  assert.equal(await pasteFixture(page,'items'),true,'paste vào ô đã focus');
  await cell.locator('img').waitFor().catch(async error => { throw new Error((await page.locator('#notice').textContent()) || error.message); });
  await pasteFixture(page,'html');
  await cell.locator('.material-image-thumbs img[src]').waitFor();

  const view = page.locator('[data-row="g1-r2"] [data-slot="render"]');
  await page.locator('header.app-header .app-logo').focus();
  await view.hover();
  await pasteFixture(page,'items');
  await view.locator('img').waitFor();

  const fallback = page.locator('[data-row="g1-r3"] [data-slot="render"]');
  await (fallback.locator('.image-plus').or(fallback)).first().click();
  await page.evaluate(base64 => {
    const blob = new Blob([Uint8Array.from(atob(base64),c => c.charCodeAt(0))],{type:'image/png'});
    Object.defineProperty(navigator.clipboard,'read',{configurable:true,value:async () => [
      {types:['image/png'],getType:async () => blob}
    ]});
  },imageFixture);
  await pasteFixture(page,'fallback');
  await fallback.locator('img').waitFor();
  await pasteFixture(page,'url');
  await fallback.locator('.material-image-thumbs img[src]').waitFor();

  const code = cell.locator('[data-field="code"]');
  await code.focus();
  const intercepted = await pasteFixture(page,'text');
  assert.equal(intercepted,false,'Không chiếm Ctrl+V khi nhập mã văn bản');
};

function pasteFixture(page,mode) {
  return page.evaluate(({base64,mode}) => {
    const event = new ClipboardEvent('paste',{bubbles:true,cancelable:true});
    const file = new File([Uint8Array.from(atob(base64),c => c.charCodeAt(0))],'snip.png',{type:'image/png'});
    const item = { kind:'file',type:'image/png',getAsFile:() => file };
    Object.defineProperty(event,'clipboardData',{value:{
      files:[],items:mode === 'items' ? [item] : [],types:mode === 'text' ? ['text/plain'] : [],
      getData:type => mode === 'html' && type === 'text/html' ? '<img src="data:image/png;base64,'+base64+'">' :
        mode === 'url' && type === 'text/html' ? '<img src="/gdhome-icon.png">' :
          mode === 'text' && type === 'text/plain' ? 'Mã PA' : ''
    }});
    return !document.activeElement.dispatchEvent(event);
  },{base64:imageFixture,mode});
}

cases['8.6'] = async page => {
  await openMaterials(page);
  assert.equal(await page.locator('tr[data-row]').count(),150);
  const metrics = await page.evaluate(() => {
    const render = [];
    for (let i=0;i<5;i++) {
      const start = performance.now();
      renderEditor();
      document.querySelector('.sheet-grid').getBoundingClientRect();
      render.push(performance.now()-start);
    }
    const code = document.querySelector('tr[data-row] [data-field=code]');
    const keypress = [];
    code.focus({preventScroll:true});
    for (const letter of 'GD8PERF') {
      const start = performance.now();
      code.value += letter;
      code.dispatchEvent(new InputEvent('input',{bubbles:true,data:letter,inputType:'insertText'}));
      keypress.push(performance.now()-start);
    }
    return { maxRender:Math.max(...render),maxInput:Math.max(...keypress),focusRetained:code === document.activeElement };
  });
  console.log(JSON.stringify(metrics));
  assert.ok(metrics.maxRender < 200,'150 dòng phải render dưới 200 ms');
  assert.ok(metrics.maxInput < 50 && metrics.focusRetained,'Nhập mã không được dựng lại ô');
  await page.locator('[data-row="g1-r2"] .image-cell[data-slot="0"] [data-action="pick-pa"]').click();
  await page.locator('.toast-notification.show').filter({hasText:'Điền thông tin hoặc thêm ảnh'}).waitFor();
};

cases['9.1'] = async page => {
  await openMaterials(page);
  await page.locator('[data-group-toggle="g2"]').uncheck();
  const form = await openImageScope(page);
  assert.equal(await form.locator('[name="groups"] option:checked').textContent(),'Chỉ nhóm đang bật');
  assert.equal(await form.locator('[name="rows"]').inputValue(),'all');
  assert.equal(await form.locator('[name="room"]').inputValue(),'');
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  assert.equal(await page.locator('#print-sheet .print-group').count(),9);
  assert.equal(await page.locator('#print-sheet .print-group').getByText('Nhóm 2',{exact:true}).count(),0);
  await page.locator('#close-print').click();
  await openImageScope(page);
  await form.locator('[name="groups"]').selectOption('all');
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  assert.equal(await page.locator('#print-sheet .print-group').count(),10);
  await openMaterials(page);
  await openImageScope(page);
  assert.equal(await form.locator('[name="groups"]').inputValue(),'all','Nhớ lựa chọn sau khi tải lại');
};

cases['9.2'] = async page => {
  await openMaterials(page);
  await page.locator('[data-action=image-fit][data-id=fit]').click();
  await addFixtureImage(page,'render');
  await addFixtureImage(page,'0');
  await page.evaluate(() => modify(() => {
    const row = sheet.groups[0].rows[0];
    row.qty = '141,90';
    row.unit = 'm2';
    row.options[0].code = 'TEST-01';
    sheet.groups = [{ ...sheet.groups[0],rows:[row] }];
  }));
  const form = await openImageScope(page);
  await form.locator('select[name="imageFit"]').selectOption('fit');
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  const measure = () => page.locator('#print-sheet').evaluate(root => {
    const images = [...root.querySelectorAll('.image-open img')];
    const bounds = node => {
      const {top,width,height} = node.getBoundingClientRect();
      return {top,width,height};
    };
    return { slots:images.map(img => bounds(img.parentElement)),images:images.map(bounds),
      originals:images.map(img => img.naturalWidth/img.naturalHeight),logo:bounds(root.querySelector('.print-heading img')).width };
  });
  function verifyFit(metrics) {
    assert.equal(metrics.slots.length,2);
    assert.equal(metrics.slots[0].top,metrics.slots[1].top);
    metrics.slots.forEach(slot => assert.ok(Math.abs(slot.width-slot.height) < 1));
    metrics.images.forEach((img,i) => assert.ok(Math.abs(img.width/img.height-metrics.originals[i]) < 0.01));
  }
  const desktop = await measure();
  verifyFit(desktop);
  assert.ok(desktop.logo >= 120*1.8);
  assert.equal(await page.locator('#print-sheet [data-row] [data-column=qty]').textContent(),'141,90');
  assert.equal(await page.locator('#print-sheet [data-row] [data-column=unit]').textContent(),'m²');
  await page.evaluate(() => {
    window.downloadCanvas = canvas => {
      const root = document.querySelector('#print-sheet').getBoundingClientRect();
      const slot = document.querySelector('#print-sheet .image-open').getBoundingClientRect();
      const pixel = (x,y) => [...canvas.getContext('2d').getImageData(Math.round(x*2),Math.round(y*2),1,1).data];
      const x = slot.left-root.left+slot.width/2;
      window.gd9Png = { width:canvas.width,top:pixel(x,slot.top-root.top+4),center:pixel(x,slot.top-root.top+slot.height/2) };
    };
  });
  await page.locator('#stats-download').click();
  await page.waitForFunction(() => window.gd9Png || document.querySelector('#export-image-status')?.textContent,{},{timeout:20000});
  const png = await page.evaluate(() => window.gd9Png);
  assert.ok(png,(await page.locator('#export-image-status').textContent()) || 'Thiếu canvas PNG');
  assert.ok(png.width > 1400);
  assert.deepEqual(png.top,[255,255,255,255],'PNG có khoảng trắng giữ tỷ lệ ảnh');
  assert.notDeepEqual(png.center,png.top,'PNG chứa ảnh thật trong khung');

  await page.setViewportSize({width:375,height:720});
  verifyFit(await measure());
  await page.setViewportSize({width:1050,height:720});
  await page.emulateMedia({media:'print'});
  const print = await measure();
  verifyFit(print);
  const zoom = await page.locator('#print-sheet').evaluate(root => parseFloat(getComputedStyle(root).zoom));
  assert.ok(print.logo/zoom >= 120*1.8);
  assert.ok((await page.pdf({preferCSSPageSize:true})).length > 1000);
  await page.emulateMedia({media:'screen'});
  await page.locator('#close-print').click();
  await page.evaluate(() => modify(() => {
    const row = sheet.groups[0].rows[0];
    row.options[1].images = row.options[0].images.splice(0);
  }));
  await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  verifyFit(await measure());
  assert.equal(await page.locator('#print-sheet [data-column=pa1] img').count(),1);
  console.log('Khung ảnh ' + desktop.slots[0].width + '×' + desktop.slots[0].height + ' px, logo ' + desktop.logo + ' px');
};

cases['9.3'] = async page => {
  await openMaterials(page);
  await addFixtureImage(page,'render');
  await addFixtureImage(page,'0');
  const columns = ['select','name','render','pa0','qty','note'];
  const headers = await page.locator('.sheet-grid thead th').evaluateAll((cells,keys) =>
    cells.filter(cell => keys.includes(cell.dataset.column)).map(cell => cell.textContent.trim()),columns);
  const row = page.locator('[data-row="g1-r1"]');
  const images = await row.locator('.image-open').evaluateAll(nodes => nodes.map(node => {
    const {top,width,height} = node.getBoundingClientRect();
    return {top,width,height};
  }));
  assert.equal(images.length,2);
  assert.equal(images[0].top,images[1].top);
  images.forEach(({width,height}) => assert.ok(Math.abs(width-height)<1));
  const groupColor = await page.locator('.sheet-grid .group th').first().evaluate(el => getComputedStyle(el).backgroundColor);
  const form = await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  assert.deepEqual(await page.locator('#print-sheet thead th').evaluateAll((cells,keys) =>
    cells.filter(cell => keys.includes(cell.dataset.column)).map(cell => cell.textContent.trim()),columns),headers);
  assert.equal(await page.locator('#print-sheet .print-group th').first().evaluate(el => getComputedStyle(el).backgroundColor),groupColor);
};

cases['9.4'] = async page => {
  await page.goto('/');
  const bodyFont = () => page.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
  const scheduleFont = await bodyFont();
  assert.match(scheduleFont,/Roboto/);
  await openMaterials(page);
  assert.equal(await bodyFont(),scheduleFont);
  await addFixtureImage(page,'0');
  await page.locator('[data-header-command="file"]').click();
  await page.locator('#material-publish').click();
  const issued = await page.locator('#issued-link').inputValue();
  await page.goto(issued);
  await page.locator('#customer-print').click();
  await page.locator('#do-print:enabled').waitFor();
  assert.equal(await bodyFont(),scheduleFont);
  assert.equal(await page.locator('#print-sheet').evaluate(el => getComputedStyle(el).fontFamily),scheduleFont);
  assert.ok((await page.locator('.print-heading img').boundingBox()).width >= 120*1.8);
  assert.doesNotMatch(await page.locator('#print-sheet').textContent(),/CỘNG HÒA XÃ HỘI CHỦ NGHĨA/);
};

cases['9.5'] = async page => {
  await openMaterials(page);
  await addFixtureImage(page,'0');
  await addFixtureImage(page,'0');
  const pa = page.locator('[data-row="g1-r1"] [data-slot="0"]');
  const pick = pa.getByRole('button',{name:'Chốt PA1'});
  const photo = pa.getByRole('button',{name:'Xem ảnh lớn'});
  await photo.click();
  const lightbox = page.locator('dialog.material-lightbox');
  assert.equal(await lightbox.locator('output').textContent(),'1 / 2');
  assert.equal(await pick.getAttribute('aria-pressed'),'false');
  await page.keyboard.press('ArrowRight');
  assert.equal(await lightbox.locator('output').textContent(),'2 / 2');
  await lightbox.getByRole('button',{name:'Chỉnh vùng nhìn'}).click();
  await page.locator('.asset-view-dialog input[type=range]').fill('2');
  await page.locator('.asset-view-dialog').getByRole('button',{name:'Lưu vùng nhìn'}).click();
  await page.locator('.asset-view-dialog').waitFor({state:'detached'});
  assert.match(await pa.locator('.material-image-thumb img').first().getAttribute('style'),/--view:scale\(2\)/);
  assert.equal(await lightbox.locator('output').textContent(),'2 / 2');
  page.once('dialog',dialog => dialog.accept());
  await lightbox.getByRole('button',{name:'Xoá ảnh'}).click();
  assert.equal(await lightbox.locator('output').textContent(),'1 / 1');
  await page.keyboard.press('Escape');
  await lightbox.waitFor({state:'detached'});
  await photo.click();
  await page.mouse.click(0,0);
  await lightbox.waitFor({state:'detached'});
  await pick.click();
  assert.equal(await pick.getAttribute('aria-pressed'),'true');
};

cases['9.6'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => modify(() => {
    const group = sheet.groups[0];
    group.name = 'Sơn tường';
    group.rows[1].note = 'Sơn mẫu tại phòng khách';
    mergeAiRows(sheet.groups,[{group:'Sơn tường',name:'Sơn trần',room:'',note:'So khớp mẫu dưới ánh sáng tự nhiên'}]);
  }));
  const newRow = page.locator('tr[data-row]').filter({has:page.locator('input[data-field="name"][value="Sơn trần"]')});
  const note = newRow.locator('textarea[data-field="note"]');
  assert.equal(await note.inputValue(),'');
  await page.waitForFunction(() => document.querySelector('#save-label').textContent === 'Đã lưu');
  await openMaterials(page);
  assert.equal(await note.inputValue(),'','Ghi chú AI chỉ là gợi ý sau khi tải lại');
  await note.click();
  const notes = page.locator('.material-notes-form');
  const find = notes.getByRole('searchbox',{name:'Tìm gợi ý'});
  await find.fill('nuoc phu');
  await notes.getByRole('checkbox',{name:'Sơn 2 nước phủ'}).check();
  await find.fill('anh sang');
  await notes.getByRole('checkbox',{name:'So khớp mẫu dưới ánh sáng tự nhiên'}).check();
  await find.fill('phong khach');
  await notes.getByRole('checkbox',{name:'Sơn mẫu tại phòng khách'}).check();
  await notes.getByRole('button',{name:'Lưu ghi chú'}).click();
  const expected = 'Sơn 2 nước phủ; So khớp mẫu dưới ánh sáng tự nhiên; Sơn mẫu tại phòng khách';
  assert.equal(await note.inputValue(),expected);
  await page.waitForFunction(() => document.querySelector('#save-label').textContent === 'Đã lưu');
  await openMaterials(page);
  assert.equal(await note.inputValue(),expected);
};

async function openImageScope(page) {
  const settingsBtn = page.locator('#material-export-settings');
  if (await settingsBtn.count() > 0) {
    await page.locator('.hdr-split-caret').click();
    await settingsBtn.click();
  } else {
    await page.locator('#material-copy').click();
  }
  const form = page.locator('#material-image-scope');
  await form.waitFor();
  return form;
}

async function addFixtureImage(page,slot) {
  const cell = page.locator('[data-row="g1-r1"] [data-slot="' + slot + '"]');
  const previous = await cell.locator('img').count();
  await cell.focus();
  assert.equal(await pasteFixture(page,'items'),true);
  await cell.locator('img[src]').nth(previous).waitFor();
}

cases['10.1'] = async page => {
  const destination = process.env.GD_SHELL_SCREENSHOTS;
  for (const width of [1440,1920]) {
    await page.setViewportSize({width,height:900});
    await page.goto('/');
    await page.locator('.project-owner-header').first().waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const [name,selector] of [['header','.app-header'],['sidebar','.app-sidebar']]) {
      const target = page.locator(selector);
      assert.equal(Math.round((await target.boundingBox())[name === 'header' ? 'height' : 'width']),name === 'header' ? 56 : 262);
      if (destination) await target.screenshot({path:path.join(destination,'lich-'+width+'-'+name+'.png'),animations:'disabled'});
    }
  }
};

cases['10.2'] = async page => {
  await openMaterials(page);
  await page.locator('[data-action="density"][data-id="l"]').click();
  await page.locator('[data-column-toggle="supplier"]').uncheck();
  await page.locator('[data-column-toggle="pa1"]').check();
  await page.locator('[data-group-toggle="g2"]').uncheck();
  await page.locator('[data-group="g3"] [data-action="fold"]').click();
  await page.locator('[data-sidebar="project"] summary').click();
  await page.locator('[data-resize="qty"]').press('ArrowRight');
  await page.locator('[data-catalog="g4"]').dragTo(page.locator('[data-catalog="g1"]'));
  await page.evaluate(() => modify(() => { sheet.groups.find(g => g.id === 'g1').rows[0].room = 'Phòng khách'; }));
  await page.locator('#room-filter').selectOption('Phòng khách');
  await page.locator('#status-filter').selectOption('draft');
  await page.locator('#material-print-view').check();
  const form = await openImageScope(page);
  await form.locator('[name="groups"]').selectOption('all');
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  await page.waitForFunction(async () => {
    const data = await fetch('/api/materials/preferences').then(res => res.json());
    return data.viewSettings?.sheets?.['gd8-sheet']?.viewAsPrint && data.viewSettings.export?.groups === 'all';
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('#material-table-preview').waitFor();
  assert.equal(await page.locator('#editor-sheet').inputValue(),'gd8-sheet');
  assert.equal(await page.locator('#editor-project').inputValue(),'p1');
  assert.equal(await page.locator('[data-sidebar="project"]').getAttribute('open'),null);
  assert.equal(await page.locator('#room-filter').inputValue(),'Phòng khách');
  assert.equal(await page.locator('#status-filter').inputValue(),'draft');
  assert.equal(await page.locator('[data-group-toggle="g2"]').isChecked(),false);
  assert.equal(await page.locator('[data-catalog]').first().getAttribute('data-catalog'),'g4');
  assert.equal(await page.locator('[data-action="density"][data-id="l"]').getAttribute('aria-pressed'),'true');
  await page.locator('#material-print-view').uncheck();
  await page.locator('#room-filter').selectOption('');
  assert.equal(await page.locator('[data-group="g3"] tr[data-row]').count(),0);
  assert.equal(await page.locator('col[data-column="supplier"]').count(),0);
  assert.equal(await page.locator('col[data-column="pa1"]').count(),1);
  assert.ok(await page.locator('col[data-column="qty"]').evaluate(col => parseInt(col.style.width,10)) > 104);
  await openImageScope(page);
  assert.equal(await form.locator('[name="groups"]').inputValue(),'all');
};

cases['10.3'] = async page => {
  for (const width of [1440,1920]) {
    await page.setViewportSize({width,height:900});
    const buttons = () => page.locator('.app-header [data-shell-slot]').evaluateAll(nodes =>
      Object.fromEntries(nodes.map(node => [node.dataset.shellSlot,Math.round(node.getBoundingClientRect().x)])));
    await page.goto('/');
    await page.locator('.project-owner-header').first().waitFor();
    const schedule = await buttons();
    await openMaterials(page);
    assert.deepEqual(await buttons(),schedule,'Các cụm lệnh cần thẳng vị trí ở ' + width + ' px');
  }
  await page.locator('[data-action="font-weight"][data-id="heavy"]').click();
  await page.locator('.material-sheet.msp-fw-heavy').waitFor();
  await page.locator('[data-header-command="file"]').click();
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('.hdr-dropdown[open]').count(),0);
  const form = await openImageScope(page);
  await form.locator('[name="watermark"]').uncheck();
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  assert.equal(await page.locator('#print-sheet.watermark').count(),0);
  await page.keyboard.press('Escape');
  await page.locator('#print-sheet').waitFor({state:'detached'});
  await openImageScope(page);
  assert.equal(await form.locator('[name="watermark"]').isChecked(),false);

  await page.goto('/');
  await page.locator('#btn-image-menu-toggle').click();
  await page.locator('#btn-open-export-modal').click();
  await page.locator('#btn-print-export').click();
  await page.locator('.canvas-print img[src]').waitFor({timeout:20000});
  assert.ok((await page.pdf({preferCSSPageSize:true})).length > 1000);
  await page.keyboard.press('Escape');
  await page.locator('.canvas-print').waitFor({state:'detached'});
};

cases['10.3-guest'] = async page => {
  await page.route('**/api/config',route => route.fulfill({json:{authMode:'google',googleClientId:'test'}}));
  await page.route('https://accounts.google.com/**',route => route.fulfill({body:
    'window.google={accounts:{id:{initialize(){},renderButton(){},prompt(){}}}};'}));
  let materialCalls = 0;
  await page.route('**/api/materials**',route => {
    materialCalls++;
    return route.fulfill({status:401,json:{message:'Cần đăng nhập'}});
  });
  await page.goto('/chot-ma');
  await page.locator('.login-guest-btn').click();
  const initial = materialCalls;
  await page.locator('[data-action="new"]').click();
  await page.locator('.sheet-grid').waitFor();
  await page.locator('.image-cell[data-slot="render"]').first().focus();
  assert.equal(await pasteFixture(page,'items'),true);
  await page.locator('.image-cell[data-slot="render"] img[src]').first().waitFor();
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('gdhome_materials::guest'))?.sheets[0]?.groups[0]?.rows[0]?.render.length);
  await page.reload();
  await page.locator('.image-cell[data-slot="render"] img[src]').first().waitFor();
  assert.match(await page.locator('#save-label').textContent(),/Chế độ khách/);
  assert.equal(materialCalls,initial);
};

cases['10.4'] = async page => {
  const config = {
    success:true,notion:{configured:true,source:'user',db:'Bảng Lịch',dateProps:['Ngày','Hạn'],dateProp:'Ngày'},
    notionCustomerDb:'Bảng Khách',notionCustomerMap:{},ai:{configured:true,source:'user',provider:'gemini',providerLabel:'Gemini',model:''},
    providers:[{id:'gemini',label:'Gemini'},{id:'openai',label:'ChatGPT'},{id:'anthropic',label:'Claude'}]
  };
  await page.route('**/api/integrations/settings',route => {
    if (route.request().method() === 'POST') {
      const patch = route.request().postDataJSON();
      if (patch.aiModel !== undefined) config.ai.model = patch.aiModel;
      if (patch.notionDateProp) config.notion.dateProp = patch.notionDateProp;
    }
    return route.fulfill({json:config});
  });
  const openConnections = async () => {
    await page.locator('.gd-tools-menu summary').click();
    await page.getByRole('button',{name:'⚙ Kết nối',exact:true}).click();
    await page.locator('.connection-dialog [name=aiModel]').waitFor();
  };
  await page.goto('/');
  await openConnections();
  await page.locator('[name=aiModel]').fill('model-thu');
  await page.locator('[data-connection-form=ai] button[type]:not([data-clear-connection]), [data-connection-form=ai] .btn-primary').first().click();
  await page.locator('.connection-message').getByText('Đã lưu kết nối.').waitFor();
  await page.locator('[name=notionDateProp]').selectOption('Hạn');
  await page.waitForFunction(() => document.querySelector('[name=notionDateProp]').value === 'Hạn' &&
    document.querySelector('.connection-message').textContent === 'Đã lưu kết nối.');
  await page.keyboard.press('Escape');
  await openMaterials(page);
  await openConnections();
  assert.equal(await page.locator('[name=aiModel]').inputValue(),'model-thu');
  assert.equal(await page.locator('[name=notionDateProp]').inputValue(),'Hạn');
  assert.equal(await page.locator('[name=notionCustomerDb]').inputValue(),'Bảng Khách');
  await page.keyboard.press('Escape');
  await page.route('**/api/ai/materials',route => {
    assert.equal(route.request().postDataJSON().images.length,1);
    return route.fulfill({json:{plan:{groups:[{name:'Sơn',rows:[{name:'Sơn tường'}]}],questions:[]}}});
  });
  await page.locator('#material-ai').click();
  await page.locator('.material-ai-drop').focus();
  assert.equal(await pasteFixture(page,'items'),true);
  await page.locator('#material-ai-file-list button[title="Xem ảnh lớn"]').click();
  await page.locator('.shell-lightbox').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#material-ai-form button.primary').click();
  await page.locator('#material-ai-job').getByRole('button',{name:'Duyệt đề xuất'}).click();
  await page.locator('#material-ai-review').waitFor();
  await page.goto('/');
  await page.route('**/api/ai/schedule',route => {
    assert.equal(route.request().postDataJSON().images.length,1);
    return route.fulfill({json:{success:true,plan:{stageName:'Sơn',tasks:[{name:'Sơn tường',workDays:2,dependsOn:[]}],questions:[]}}});
  });
  await page.locator('#schedule-ai-menu summary').click();
  await page.locator('#btn-open-ai-planner').click();
  await page.locator('#ai-drop-zone').focus();
  assert.equal(await pasteFixture(page,'items'),true);
  await page.locator('#btn-ai-run').click();
  await page.locator('#ai-bg-panel').getByRole('button',{name:'Xem & thêm vào lịch'}).click();
  await page.locator('#ai-review-body tr').first().waitFor();
};

cases['10.5'] = async page => {
  await openMaterials(page);
  await page.locator('[data-action="project-profile"]').click();
  const form = page.locator('.project-profile-form');
  await form.locator('[name=project]').fill('Căn hộ đồng bộ');
  await form.locator('[name=customer]').fill('Anh Kiểm Thử');
  await form.locator('[name=address]').fill('88 Đường Mẫu');
  await form.getByRole('button',{name:'Lưu hồ sơ'}).click();
  await form.waitFor({state:'detached'});
  assert.equal(await page.locator('.material-meta-fields [data-field=customer]').inputValue(),'Anh Kiểm Thử');
  await page.goto('/');
  await page.locator('[data-project-summary]:visible').getByText('Anh Kiểm Thử · 88 Đường Mẫu').waitFor();
  await page.locator('#btn-project-settings').click();
  await page.locator('#btn-project-profile').click();
  assert.equal(await form.locator('[name=project]').inputValue(),'Căn hộ đồng bộ');
  await form.locator('[name=contract]').fill('HD-DONG-BO');
  await form.getByRole('button',{name:'Lưu hồ sơ'}).click();
  await form.waitFor({state:'detached'});
  await openMaterials(page);
  assert.equal(await page.locator('.material-meta-fields [data-field=contract]').inputValue(),'HD-DONG-BO');
  const projects = await page.evaluate(() => fetch('/api/projects').then(response => response.json()));
  assert.deepEqual(projects.projects[0].profile,{project:'Căn hộ đồng bộ',customer:'Anh Kiểm Thử',address:'88 Đường Mẫu',contract:'HD-DONG-BO'});
};

cases['10.6'] = async page => {
  const destination = process.env.GD_SHELL_SCREENSHOTS;
  for (const width of [1440,1920]) {
    await page.setViewportSize({width,height:900});
    for (const [tool,open,sidebar] of [
      ['lich',async () => { await page.goto('/'); await page.locator('.project-owner-header').first().waitFor(); },'.app-sidebar'],
      ['chot-ma',() => openMaterials(page),'.material-sidebar']
    ]) {
      await open();
      await page.evaluate(() => document.fonts.ready);
      for (const [name,selector] of [['header','.app-header'],['sidebar',sidebar]]) {
        const element = page.locator(selector);
        const bounds = await element.boundingBox();
        assert.equal(Math.round(bounds[name === 'header' ? 'height' : 'width']),name === 'header' ? 56 : 262);
        if (destination) await element.screenshot({path:path.join(destination,tool+'-'+width+'-'+name+'.png'),animations:'disabled'});
      }
    }
  }
};

cases['10.6-recovery'] = async page => {
  async function slowReload(routeName,assertLocal,assertRestored) {
    let releaseFirstRead;
    const firstRead = new Promise(resolve => { releaseFirstRead = resolve; });
    let reads = 0;
    const writes = [];
    const requests = request => {
      if (request.method() === 'POST' && /\/api\/(schedule|materials)(?:\/preferences)?$/.test(request.url())) writes.push(request.url());
    };
    page.on('request',requests);
    const pattern = '**' + routeName;
    await page.route(pattern,async route => {
      if (route.request().method() !== 'GET') return route.continue();
      reads++;
      if (reads === 1) {
        await firstRead;
        return route.fulfill({status:503,json:{message:'Đang kết nối máy chủ…'}});
      }
      return route.continue();
    });
    await page.reload({waitUntil:'domcontentloaded'});
    try { await assertLocal(); }
    finally { releaseFirstRead(); }
    await assertRestored();
    assert.ok(reads >= 2,'Tự thử lại sau 503');
    assert.deepEqual(writes,[],'Không ghi dữ liệu hoặc mặc định khi tải chậm/lỗi');
    await page.unroute(pattern);
    page.off('request',requests);
  }

  await page.goto('/');
  await page.waitForFunction(() => document.querySelector('#save-status-indicator').dataset.saveState === 'saved');
  await page.evaluate(async () => {
    AppState.mspVisibility.colProg = false;
    AppState.mspRowHeight = 'tall';
    updateUIElements();
    await saveToBackend();
  });
  await slowReload('/api/schedule',async () => {
    await page.locator('#save-status-indicator').getByText('Đang kết nối máy chủ…').waitFor();
    assert.equal(await page.evaluate(() => AppState.mspVisibility.colProg),false);
    assert.equal(await page.evaluate(() => AppState.mspRowHeight),'tall');
    assert.equal(await page.locator('.app-body-layout').evaluate(node => node.inert),true);
    await page.evaluate(() => Promise.all([saveToBackend(),flushSaveToBackend({force:true})]));
  },async () => {
    await page.locator('#save-status-indicator[data-save-state=saved]').waitFor({timeout:12000});
    assert.equal(await page.evaluate(() => AppState.mspVisibility.colProg),false);
  });

  await openMaterials(page);
  await page.locator('[data-column-toggle=supplier]').uncheck();
  await page.locator('[data-group-toggle=g2]').uncheck();
  await page.waitForFunction(() => {
    const view = JSON.parse(localStorage.getItem('gdhome-tools-snapshot:local'))?.viewSettings;
    return view?.hiddenColumns?.includes('supplier') && view?.sheets?.['gd8-sheet']?.hiddenGroups?.includes('g2');
  });
  await slowReload('/api/materials',async () => {
    await page.locator('#tools-connection').waitFor();
    assert.equal(await page.locator('[data-column-toggle=supplier]').isChecked(),false);
    assert.equal(await page.locator('[data-group-toggle=g2]').isChecked(),false);
    assert.equal(await page.locator('#materials').evaluate(node => node.inert),true);
    await page.evaluate(async () => { setMaterialView({hiddenColumns:[]}); queueSave(); await Promise.all([flushSave(),flushMaterialView()]); });
  },async () => {
    await page.locator('#tools-connection').waitFor({state:'hidden',timeout:12000});
    assert.equal(await page.locator('[data-column-toggle=supplier]').isChecked(),false);
    assert.equal(await page.locator('[data-group-toggle=g2]').isChecked(),false);
  });
};

cases['12.1'] = async page => {
  await openMaterials(page);
  await addFixtureImage(page,'render');
  await addFixtureImage(page,'0');
  await page.locator('[data-resize="name"]').press('ArrowRight');
  const measure = root => root.evaluate(paper => {
    const cols = [...paper.querySelectorAll('thead th[data-column]:not([data-column=actions])')];
    const widths = cols.map(col => col.getBoundingClientRect().width);
    const total = widths.reduce((sum,width) => sum+width,0);
    return {
      columns:cols.map(col => col.dataset.column),ratios:widths.map(width => width/total),
      images:[...paper.querySelectorAll('[data-row="g1-r1"] .image-open')].map(slot => [slot.offsetWidth,slot.offsetHeight]),
      title:paper.querySelector('h1').textContent,logo:paper.querySelector('.print-heading img').getBoundingClientRect().width
    };
  });
  const work = await measure(page.locator('.material-paper'));
  const form = await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  const exported = await measure(page.locator('#print-sheet'));
  assert.deepEqual(exported.columns,work.columns);
  assert.equal(exported.images.length,work.images.length);
  exported.images.forEach(([width,height]) => assert.ok(Math.abs(width-height) <= 1 && width > 0));
  assert.equal(exported.title,work.title);
  assert.equal(exported.logo,work.logo);
  exported.ratios.forEach((ratio,index) => assert.ok(Math.abs(ratio-work.ratios[index])/work.ratios[index] <= 0.05));
  assert.equal(await page.locator('#print-sheet :is(button,input,select)').count(),0);
  assert.ok((await page.pdf({preferCSSPageSize:true})).length > 1000);
};

cases['12.2'] = async page => {
  await openMaterials(page);
  const printNote = page.locator('#materials th[data-column=note] button[data-action=print-column]');
  const note = page.locator('[data-row="g1-r1"] td[data-column=note]');
  await printNote.click();
  assert.equal(await printNote.getAttribute('aria-pressed'),'false');
  assert.match(await note.getAttribute('class'),/is-no-print/);
  assert.equal(await note.locator('textarea').isEditable(),true);
  assert.equal(await page.locator('[data-print-column-toggle][value=note]').isChecked(),false);
  const form = await openImageScope(page);
  await form.locator('.export-print-columns summary').click();
  assert.equal(await form.locator('[name=printColumn][value=note]').isChecked(),false);
  await form.locator('[name=printColumn][value=spec]').uncheck();
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  assert.equal(await page.locator('#print-sheet [data-column=note], #print-sheet [data-column=spec]').count(),0);
  await page.locator('#close-print').click();
  await page.waitForFunction(async () => {
    const {viewSettings} = await fetch('/api/materials/preferences').then(res => res.json());
    return ['spec','note'].every(key => viewSettings.printHidden?.includes(key));
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await printNote.waitFor();
  assert.equal(await printNote.getAttribute('aria-pressed'),'false');
  assert.equal(await page.locator('[data-print-column-toggle][value=spec]').isChecked(),false);
  await page.locator('[data-print-column-toggle][value=note]').check();
  assert.equal(await printNote.getAttribute('aria-pressed'),'true');
};

cases['12.3'] = async page => {
  await openMaterials(page);
  await addFixtureImage(page,'render');
  await addFixtureImage(page,'0');
  const row = page.locator('#materials [data-row="g1-r1"]');
  const sizes = root => root.locator('.image-open').evaluateAll(slots => slots.map(slot => {
    const img = slot.querySelector('img');
    return [slot.offsetWidth,slot.offsetHeight,img.offsetWidth,img.offsetHeight];
  }));
  await row.locator('img[data-image-axis]').last().waitFor();
  const fill = await sizes(row);
  assert.equal(fill.length,2);
  for (const [width,height,iw,ih] of fill) {
    assert.equal(width,height);
    assert.equal(ih,height);
    assert.ok(iw > width);
  }
  const form = await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  for (const [width,height,iw,ih] of await sizes(page.locator('#print-sheet [data-row="g1-r1"]'))) {
    assert.ok(Math.abs(width-height) <= 1 && Math.abs(height-ih) <= 1 && iw > width);
  }
  await page.locator('#close-print').click();
  await page.locator('[data-action=image-fit][data-id=fit]').click();
  await row.locator('img[data-image-axis]').last().waitFor();
  for (const [width,height,iw,ih] of await sizes(row)) {
    assert.equal(width,height);
    assert.equal(iw,width);
    assert.ok(ih < height);
  }
  await page.locator('[data-action=density][data-id=xs]').click();
  await row.locator('img[data-image-axis]').last().waitFor();
  assert.equal((await sizes(row))[0][0],fill[0][0]);
};

cases['12.4'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => modify(() => {
    const row = sheet.groups[0].rows[0];
    row.note = 'Ghi chú mẫu';
    row.spec = 'Quy cách mẫu';
  }));
  const readSizes = root => root.locator('[data-row="g1-r1"]').evaluate(row =>
    ['name','note','spec'].map(key => parseFloat(getComputedStyle(row.querySelector('[data-field="'+key+'"]')).fontSize)));
  const work = await readSizes(page.locator('#materials'));
  assert.ok(Math.abs(work[1]/work[0]-.85) < .03 && Math.abs(work[2]/work[0]-.85) < .03);
  const form = await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('dialog#print-preview[open]').waitFor();
  assert.deepEqual(await readSizes(page.locator('#print-sheet')),work);
  await page.keyboard.press('Escape');
  await page.locator('#print-preview').waitFor({state:'detached'});
  await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  await page.mouse.click(0,0);
  await page.locator('#print-preview').waitFor({state:'detached'});

  await addFixtureImage(page,'0');
  await page.locator('[data-header-command="file"]').click();
  await page.locator('#material-publish').click();
  await page.goto(await page.locator('#issued-link').inputValue());
  await page.locator('#customer-print').click();
  await page.locator('#do-print:enabled').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#print-preview').waitFor({state:'detached'});
};

cases['12.5'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => modify(() => {
    const group = sheet.groups[0];
    group.name = 'Gỗ MDF';
    group.rows[0].name = 'Tủ MDF';
    group.rows[0].options[0].code = 'PA-TEST';
    group.rows[0].chosen = 0;
    group.rows[0].decision = 'chosen';
    group.rows[1].spec = 'MDF 17 mm vân sồi đặt riêng';
    group.rows[2].spec = 'MDF 17 mm vân sồi đặt riêng';
    group.rows[3].spec = 'MDF 18 mm ép vân óc chó';
  }));
  const field = page.locator('[data-row="g1-r1"] textarea[data-field=spec]');
  await field.click();
  const form = page.locator('.material-notes-form');
  const choices = form.locator('input[name=suggestion]');
  assert.ok(await choices.count() >= 15);
  assert.equal(await choices.first().inputValue(),'MDF 17 mm vân sồi đặt riêng');
  const search = form.getByRole('searchbox',{name:'Tìm gợi ý'});
  await search.fill('plywood');
  await form.getByRole('checkbox',{name:'Plywood 18mm phủ Laminate'}).check();
  await search.fill('bong guong');
  await form.getByRole('checkbox',{name:'Cánh Acrylic bóng gương'}).check();
  await form.getByRole('button',{name:'Lưu quy cách'}).click();
  const expected = 'Plywood 18mm phủ Laminate; Cánh Acrylic bóng gương';
  assert.equal(await field.inputValue(),expected);
  assert.equal(await page.evaluate(() => sheet.groups[0].rows[0].options[0].finish),expected);
  await page.locator('[data-row="g1-r1"] textarea[data-field=note]').click();
  assert.ok(await choices.count() >= 15);
  await form.getByRole('checkbox',{name:'Chốt chiều vân theo cánh tủ'}).waitFor();
  await page.keyboard.press('Escape');
  const library = await page.evaluate(() => materialSuggestionLibrary.map(group => [group.spec.length,group.note.length+materialNoteCommon.length]));
  assert.ok(library.length >= 16);
  assert.ok(library.every(([spec,note]) => spec >= 15 && spec <= 30 && note >= 15 && note <= 30));
};

cases['12.6'] = async page => {
  await page.setViewportSize({width:1550,height:900});
  await openMaterials(page);
  const order = root => root.locator('thead th[data-column]').evaluateAll(cells => cells.map(cell => cell.dataset.column));
  const work = page.locator('#materials .sheet-grid');
  const original = await order(work);
  const from = work.locator('[data-column-drag=qty]');
  const target = work.locator('th[data-column=render]');
  await from.dragTo(target,{targetPosition:{x:5,y:10}});
  const moved = await order(work);
  assert.equal(moved.indexOf('qty')+1,moved.indexOf('render'));
  await page.waitForFunction(async () => {
    const {viewSettings} = await fetch('/api/materials/preferences').then(res => res.json());
    const order = viewSettings.columnOrder || [];
    return order.includes('qty') && order.indexOf('qty')+1 === order.indexOf('render');
  });
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await work.waitFor();
  assert.deepEqual(await order(work),moved);
  const form = await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  assert.deepEqual(await order(page.locator('#print-sheet')),moved.filter(key => key !== 'actions'));
  await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Về mặc định',exact:true}).click();
  assert.deepEqual(await order(work),original);
};

cases['12.7'] = async page => {
  const schedule = await page.request.get('/api/schedule').then(response => response.json());
  const tasks = [
    {id:'late-paint',title:'Thi công sơn bả',calendarId:'c1',startDate:'2026-11-25',endDate:'2026-11-26'},
    {id:'early-paint',title:'Thi công sơn bả',calendarId:'c1',startDate:'2026-11-12',endDate:'2026-11-13'},
    {id:'tile',title:'Lát gạch phòng khách',calendarId:'c1',startDate:'2026-11-10',endDate:'2026-11-11'}
  ];
  const saved = await page.request.post('/api/schedule',{data:{_baseVersion:schedule.version,tasks}});
  assert.equal(saved.status(),200);
  await openMaterials(page);
  const group = page.locator('[data-group="g1"]');
  const group2 = page.locator('[data-group="g2"]');
  await group.locator('[data-field=groupName]').fill('Sơn tường');
  await group.locator('[data-field=groupName]').blur();
  assert.equal(await group.locator('[data-field=taskId]').inputValue(),'early-paint');
  await group.getByText(/tự động \(độ khớp \d+%\)/).waitFor();
  await group2.locator('[data-field=groupName]').fill('Gạch ốp lát');
  await group2.locator('[data-field=groupName]').blur();
  assert.equal(await group2.locator('[data-field=taskId]').inputValue(),'tile');
  await group.locator('[data-field=taskId]').selectOption('late-paint');
  await page.locator('[data-action=relink-tasks]').click();
  await page.waitForFunction(() => document.querySelector('#save-label').dataset.saveState === 'saved');
  await openMaterials(page);
  assert.equal(await group.locator('[data-field=taskId]').inputValue(),'late-paint');
  assert.equal(await group.locator('.material-auto-link').count(),0);
  assert.equal(await group2.locator('[data-field=taskId]').inputValue(),'tile');
  const timeline = await page.request.get('/api/materials/timeline').then(response => response.json());
  assert.ok(timeline.badges.some(badge => badge.taskId === 'tile'));
};

function viewPosition(page) {
  return page.locator('.sheet-scroll').evaluate(el => ({top:el.scrollTop,left:el.scrollLeft,page:window.scrollY}));
}
async function openMaterials(page) {
  await page.goto('/chot-ma');
  await page.locator('#materials:not([inert])').waitFor();
  const listButton = page.getByRole('button',{name:'Bảng mẫu GĐ8',exact:true});
  const firstRow = page.locator('[data-row="g1-r1"]');
  await listButton.or(firstRow).first().waitFor();
  if (await listButton.isVisible()) await listButton.click();
  await page.locator('[data-row="g1-r1"]').waitFor();
}

cases['15.1'] = async page => {
  // Menu thả xuống tự đóng khi bấm ra ngoài hoặc Esc; hộp thoại đóng khi bấm nền tối.
  await openMaterials(page);
  for (const selector of ['.gd-tools-menu','details.hdr-dropdown']) {
    const menu = page.locator(selector).first();
    await menu.locator('summary').click();
    assert.equal(await menu.evaluate(d => d.open),true);
    await page.mouse.click(1000,700);
    assert.equal(await menu.evaluate(d => d.open),false,selector + ' đóng khi bấm ra ngoài');
    await menu.locator('summary').click();
    await page.keyboard.press('Escape');
    assert.equal(await menu.evaluate(d => d.open),false,selector + ' đóng khi Esc');
  }
  await page.locator('.gd-tools-menu summary').click();
  await page.locator('[data-open-library]').click();
  const library = page.locator('dialog.asset-library-dialog');
  await library.waitFor();
  await page.mouse.click(5,5);
  await library.waitFor({state:'detached'});
};

cases['15.2'] = async page => {
  // Dữ liệu dùng chung: tải ảnh vào hạng mục, chọn nhanh cho ô PA theo nhóm, vùng nhìn lưu lại sau khi tải trang.
  await openMaterials(page);
  await page.locator('[data-sidebar=library] .material-sidebar-actions [data-action=open-library]').click();
  const library = page.locator('dialog.asset-library-dialog');
  await library.waitFor();
  const file = {name:'mau-go.png',mimeType:'image/png',buffer:Buffer.from(imageFixture,'base64')};
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'),library.locator('.asset-drop').click()]);
  await chooser.setFiles(file);
  await library.locator('.asset-card').first().waitFor();
  await page.keyboard.press('Escape');
  const pa = page.locator('[data-row="g1-r2"] [data-slot="0"]');
  await pa.click();
  const picker = page.locator('.asset-popover');
  await picker.locator('.asset-card').first().waitFor();
  await page.keyboard.press('Escape');
  await picker.waitFor({state:'detached'});
  await pa.click();
  await picker.locator('[data-asset-pick]').first().click();
  await pa.locator('img[src]').first().waitFor();
  await pa.locator('[data-action=view-image]').first().click();
  await page.getByRole('button',{name:'Chỉnh vùng nhìn'}).click();
  await page.locator('.asset-view-dialog input[type=range]').fill('1.6');
  await page.getByRole('button',{name:'Lưu vùng nhìn'}).click();
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => document.querySelector('#save-label')?.dataset.saveState === 'saved');
  await page.reload();
  await pa.locator('img[src]').first().waitFor();
  assert.match(await pa.locator('img').first().getAttribute('style'),/--view:scale\(1\.6\)/);
};

cases['15.3'] = async page => {
  // Độ đậm chữ giống nhau ở bảng nhập, ảnh xuất và biên bản A4 khi in.
  await openMaterials(page);
  const weights = selector => page.evaluate(selector => {
    const root = document.querySelector(selector);
    const value = query => getComputedStyle(root.querySelector(query)).fontWeight;
    return [value('tbody tr:not(.group):not(.print-group) td:nth-child(2)'),value('tr.group th, tr.print-group th'),value('thead th')];
  },selector);
  for (const weight of ['light','bold','heavy']) {
    await page.evaluate(weight => { setMaterialView({fontWeight:weight}); renderEditor(); },weight);
    const editing = await weights('.material-paper');
    await page.evaluate(() => showPrint({sheet},'/api/materials/assets/',authHeaders(),true,true));
    assert.deepEqual(await weights('#print-sheet'),editing,weight + ': ảnh xuất');
    await page.locator('#close-print').click();
    await page.evaluate(() => showPrint({sheet},'/api/materials/assets/',authHeaders()));
    await page.emulateMedia({media:'print'});
    assert.deepEqual((await weights('#print-sheet')).slice(0,2),editing.slice(0,2),weight + ': biên bản A4 khi in');
    await page.emulateMedia({media:'screen'});
    await page.locator('#close-print').click();
  }
};

cases['13.1'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => {
    ['pa1','pa2'].forEach(key => forcedPA.add(key));
    hiddenColumns.clear();
    materials.columnWidths = Object.fromEntries(printableColumns().map(([key]) => [key,245]));
    sheet.groups[0].rows[0].chosen = 0;
  });
  for (const width of [1050,1440,1920]) {
    await page.setViewportSize({width,height:720});
    for (const count of [6,12]) {
      const preview = page.locator('#print-sheet');
      await page.evaluate(async count => {
        const columns = printableColumns().map(([key]) => key);
        savePrintColumns(columns.slice(0,count));
        await showStatistics({...sheet,groups:[{...sheet.groups[0],rows:[sheet.groups[0].rows[0]]}]},'png',false);
      },count);
      await page.locator('#stats-download').waitFor();
      const layout = await preview.evaluate(paper => {
        const table = paper.querySelector('table');
        const box = paper.getBoundingClientRect();
        const edge = table.getBoundingClientRect().right;
        return {paperRight:box.right,tableRight:edge,paperWidth:box.width,
          frame:paper.parentElement.clientWidth,columns:table.querySelectorAll('thead th').length,
          controls:paper.querySelectorAll('input,textarea,select,button').length,
          dashed:[...table.querySelectorAll('*')].filter(node => node.getBoundingClientRect().width &&
            getComputedStyle(node).borderTopStyle === 'dashed').length};
      });
      assert.equal(layout.columns,count);
      assert.ok(Math.abs(layout.tableRight-layout.paperRight) <= 1,JSON.stringify(layout));
      assert.ok(layout.paperWidth <= Math.min(1054,layout.frame),JSON.stringify(layout));
      assert.equal(layout.controls,0);
      assert.equal(layout.dashed,0);
      await page.locator('#close-print').click();
    }
  }
};

cases['13.2'] = async page => {
  await openMaterials(page);
  await addFixtureImage(page,'render');
  await addFixtureImage(page,'0');
  await page.evaluate(() => modify(() => {
    const row = sheet.groups[0].rows[0];
    row.render.push(row.render[0],row.render[0]);
    row.options[0].code = 'MÃ VUÔNG';
    sheet.groups = [{...sheet.groups[0],rows:sheet.groups[0].rows.slice(0,2)}];
    materials.columnWidths = {render:245,pa0:200};
  }));
  const read = root => root.evaluate(paper => {
    const row = paper.querySelector('[data-row]');
    return {sizes:[...row.querySelectorAll('.image-open')].map(slot => [slot.offsetWidth,slot.offsetHeight,slot.closest('td').offsetWidth]),
      row:row.offsetHeight,empty:row.nextElementSibling.offsetHeight,thumbs:row.querySelectorAll('.material-image-thumbs img').length};
  });
  const work = page.locator('.material-paper');
  const initial = await read(work);
  for (const [w,h,cell] of initial.sizes) assert.ok(Math.abs(w-h)<=1 && cell-w<=10,JSON.stringify(initial));
  assert.ok(initial.row >= 245 && initial.empty < 100);
  assert.equal(initial.thumbs,2);
  await page.locator('[data-action=density][data-id=xs]').click();
  assert.deepEqual((await read(work)).sizes,initial.sizes);
  await page.locator('[data-resize=render]').press('ArrowRight');
  assert.equal((await read(work)).sizes[0][0],initial.sizes[0][0]+12);
  await page.locator('.material-image-thumbs button').first().click();
  assert.equal(await page.locator('.shell-lightbox output').textContent(),'2 / 3');
  await page.keyboard.press('Escape');
  await page.locator('[data-row=g1-r1] [data-slot="0"] [data-action=pick-pa]').click();
  await page.locator('[data-header-command="file"]').click();
  await page.locator('#material-publish').click();
  await page.goto(await page.locator('#issued-link').inputValue());
  const photo = page.locator('#review .print-square img').first();
  await photo.waitFor();
  assert.ok(await photo.evaluate(img => {
    const square = img.closest('.print-square'), parent = square.parentElement;
    return Math.abs(square.offsetWidth-square.offsetHeight) <= 1 && square.offsetWidth >= parent.clientWidth-2;
  }));
  await photo.click();
  await page.locator('.shell-lightbox figure img[src]').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#customer-print').click();
  await page.locator('#do-print:enabled').waitFor();
  assert.equal(await page.locator('#print-sheet .print-square img').count(),2);
  assert.equal(await page.locator('#print-sheet .material-image-thumb img').count(),2);
};

cases['13.3'] = async page => {
  await openMaterials(page);
  const field = page.locator('[data-row=g1-r1] [data-field=room]');
  const value = 'Ban công thử GĐ13';
  await field.fill(value);
  await page.locator('.suggestions').getByLabel('Dùng cho mọi nhóm').check();
  await page.locator('.suggestions').getByRole('button',{name:"＋ Thêm '"+value+"' vào gợi ý",exact:true}).click();
  await page.waitForFunction(async value => {
    const {viewSettings} = await fetch('/api/materials/preferences').then(r => r.json());
    return viewSettings.suggestions?.room?.some(item => item.value === value && !item.group);
  },value);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await field.waitFor();
  await field.fill('Ban cong thu');
  await page.locator('.suggestions').getByRole('button',{name:'★ '+value}).waitFor();
  await page.evaluate(() => {
    createSheet('gd13-other','Bảng dự án thứ hai',[newGroup('Nhóm khác',['Dòng khác'])]);
  });
  const other = page.locator('[data-row] [data-field=room]').first();
  await other.focus();
  await page.locator('.suggestions').getByRole('button',{name:'★ '+value}).click();
  assert.equal(await other.inputValue(),value);
  await other.fill('');
  await page.locator('.suggestions').getByRole('button',{name:'Quản lý gợi ý',exact:true}).click();
  const manager = page.getByRole('dialog',{name:'Quản lý gợi ý'});
  const item = manager.locator('[data-suggestion-item]:has(input[value="' + value + '"])');
  await item.getByRole('textbox').fill('Ban công đã sửa GĐ13');
  await item.getByRole('button',{name:'Lưu',exact:true}).click();
  const edited = manager.locator('[data-suggestion-item]:has(input[value="Ban công đã sửa GĐ13"])');
  await edited.getByRole('button',{name:'Xóa',exact:true}).click();
  await manager.getByRole('button',{name:'Xong',exact:true}).click();
  await other.fill('Ban cong thu');
  assert.equal(await page.locator('.suggestions').getByRole('button',{name:'★ '+value}).count(),0);
  await page.waitForFunction(async value => {
    const {viewSettings} = await fetch('/api/materials/preferences').then(r => r.json());
    return viewSettings.suggestions?.room?.some(item => item.value === value && item.disabled) &&
      viewSettings.suggestions.room.some(item => item.value === 'Ban công đã sửa GĐ13' && item.disabled);
  },value);
  await page.locator('[data-row] textarea[data-field=note]').first().click();
  await page.getByRole('searchbox',{name:'Tìm gợi ý'}).fill('Gợi ý mới cho nhóm khác');
  await page.getByRole('button',{name:"＋ Thêm 'Gợi ý mới cho nhóm khác' vào gợi ý",exact:true}).click();
  await page.locator('.material-note-choices').getByText('★ Gợi ý mới cho nhóm khác',{exact:true}).waitFor();
  const scope = await page.evaluate(() => materialView.suggestions.note[0].group);
  assert.equal(scope,'nhom khac');
};

cases['13.4'] = async page => {
  await openMaterials(page);
  const original = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'),{width:4000,height:3000});
    const ctx = canvas.getContext('2d');
    const pixels = ctx.createImageData(4000,3000);
    let seed = 12345;
    for (let y=0; y<3000; y++) for (let x=0; x<4000; x++) {
      const i = (y*4000+x)*4;
      for (let c=0; c<3; c++) {
        seed = (Math.imul(seed,1664525)+1013904223)|0;
        pixels.data[i+c] = y < 320 ? seed >>> 24 : (x/19+y/17+c*38)%255;
      }
      pixels.data[i+3] = 255;
    }
    ctx.putImageData(pixels,0,0);
    window.gd13LargeImage = await new Promise(resolve => canvas.toBlob(resolve));
    return window.gd13LargeImage.size;
  });
  assert.ok(original > 4500000 && original < 7000000,original);
  const stored = await page.evaluate(async () => {
    const image = await uploadImage(window.gd13LargeImage);
    const full = await readMaterialAsset(image.full);
    const thumb = await readMaterialAsset(image.thumb);
    const a = await createImageBitmap(full), b = await createImageBitmap(thumb);
    return {image,type:full.type,bytes:full.size,full:[a.width,a.height],thumb:[b.width,b.height]};
  });
  assert.deepEqual(stored.full,[1600,1200]);
  assert.deepEqual(stored.thumb,[480,360]);
  assert.equal(stored.type,'image/webp');
  assert.ok(stored.bytes < 400000,JSON.stringify(stored));
  console.log('Nén ảnh: '+original+' → '+stored.bytes+' byte');

  const small = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'),{width:80,height:40});
    canvas.getContext('2d').fillRect(10,10,20,20);
    const png = await new Promise(resolve => canvas.toBlob(resolve));
    const image = await uploadImage(png);
    const result = await readMaterialAsset(image.full);
    return {equalSize:png.size === result.size,type:result.type,same:image.full === image.thumb};
  });
  assert.deepEqual(small,{equalSize:true,type:'image/png',same:true});
  const jpeg = await page.evaluate(async () => {
    const native = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function(callback,type,quality) {
      return native.call(this,callback,type === 'image/webp' ? 'image/png' : type,quality);
    };
    try {
      const image = await uploadImage(window.gd13LargeImage);
      return (await readMaterialAsset(image.full)).type;
    } finally { HTMLCanvasElement.prototype.toBlob = native; }
  });
  assert.equal(jpeg,'image/jpeg');

  const largePng = await page.evaluate(async () => {
    const reader = new FileReader();
    return new Promise(resolve => { reader.onload = () => resolve(reader.result.split(',')[1]); reader.readAsDataURL(window.gd13LargeImage); });
  });
  await page.goto('/du-an?project=p1');
  await page.getByRole('heading',{name:'Căn hộ mẫu GĐ8',exact:true}).waitFor();
  const fileInput = page.locator('#file-input');
  await fileInput.setInputFiles({name:'Test phối cảnh GĐ13.png',mimeType:'image/png',buffer:Buffer.from(largePng,'base64')});
  // GĐ18B.2: ảnh 3D hiện ở lưới #renders-gallery-container, bấm ảnh mở lightbox chung.
  const row = page.locator('#renders-gallery-container [data-render-doc-id]').filter({hasText:'Test phối cảnh GĐ13.png'});
  await row.waitFor({timeout:15000});
  await row.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector('#renders-gallery-container img[data-hub-thumbnail]')?.naturalWidth === 480);
  assert.equal(await row.locator('img').evaluate(img => img.naturalWidth),480);
  assert.equal(await row.locator('img').getAttribute('data-hub-thumbnail'),'render-'+stored.image.thumb);
  await row.locator('.render-card-thumb-wrap').click();
  await page.waitForFunction(() => [...document.querySelectorAll('dialog[open] img')].some(img => img.naturalWidth === 1600),null,{timeout:15000});
  await page.keyboard.press('Escape');
  const {PDFDocument} = require('pdf-lib');
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const pdfBytes = Buffer.from(await pdf.save());
  const upload = page.waitForResponse(response => response.url().includes('documents/upload') && response.url().includes('draw-gd13.pdf'));
  await fileInput.setInputFiles({name:'draw-gd13.pdf',mimeType:'application/pdf',buffer:pdfBytes});
  const {documents} = await (await upload).json();
  const document = documents.find(item => item.name === 'draw-gd13.pdf');
  const response = await page.request.get('/api/project-hub/assets/'+document.assetKey);
  assert.deepEqual(await response.body(),pdfBytes);
};

cases['13.5'] = async page => {
  await page.setViewportSize({width:1600,height:900});
  await openMaterials(page);
  await addFixtureImage(page,'render');
  await addFixtureImage(page,'0');
  await page.evaluate(() => modify(() => {
    const group = sheet.groups[0];
    group.name = 'Gạch ốp lát';
    const [first,second] = group.rows;
    Object.assign(first,{name:'Gạch lát sảnh',room:'Sảnh',note:'Đối chiếu mẫu dưới ánh sáng tự nhiên',qty:'14,50',unit:'m2'});
    Object.assign(first.options[0],{code:'G-601',color:'Trắng ngà',size:'600×600'});
    Object.assign(second,{name:'Gạch ốp tường',room:'Bếp',qty:'5,20',unit:'m2'});
    sheet.groups = [{...group,rows:[first,second]}];
    sheet.title = 'Bảng mẫu GĐ13';
    sheet.meta = {...sheet.meta,project:'Căn hộ mẫu GĐ13',date:'2026-11-08'};
    for (const key of ['spec','supplier','decision']) hiddenColumns.add(key);
    materials.columnWidths = {name:155,render:245,pa0:200,qty:72,unit:52,note:136,room:100};
  }));
  const work = page.locator('#materials .material-paper');
  await work.locator('.image-open img[data-image-axis]').last().waitFor();
  await page.mouse.move(14,14);
  await page.evaluate(() => document.fonts.ready);
  const workPng = await work.screenshot({animations:'disabled'});
  const measure = paper => {
    const bounds = paper.getBoundingClientRect();
    const box = node => {
      const rect = node.getBoundingClientRect();
      return [rect.x-bounds.x,rect.y-bounds.y,rect.width,rect.height].map(Math.round);
    };
    return {
      headings:[...paper.querySelectorAll('thead th[data-column]:not([data-column=actions])')].map(col => [col.textContent.trim(),...box(col)]),
      images:[...paper.querySelectorAll('.image-open')].map(box),width:bounds.width,height:bounds.height
    };
  };
  const workLayout = await work.evaluate(measure);
  const form = await openImageScope(page);
  await form.locator('[name=watermark]').uncheck();
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-download').waitFor();
  const preview = page.locator('#print-sheet');
  const printLayout = await preview.evaluate(measure);
  assert.deepEqual(printLayout.headings.map(([name]) => name),workLayout.headings.map(([name]) => name));
  for (const [i,[,x,,width]] of printLayout.headings.entries()) {
    assert.ok(Math.abs(x-workLayout.headings[i][1]) <= 2,JSON.stringify({i,workLayout,printLayout}));
    assert.ok(Math.abs(width-workLayout.headings[i][3]) <= 2,JSON.stringify({i,workLayout,printLayout}));
  }
  assert.deepEqual(printLayout.images.map(([,,w,h]) => [w,h]),workLayout.images.map(([,,w,h]) => [w,h]));
  await page.evaluate(() => { window.downloadCanvas = canvas => { window.gd13Export = canvas.toDataURL('image/png'); }; });
  await page.locator('#stats-download').click();
  await page.waitForFunction(() => window.gd13Export || document.querySelector('#export-image-status')?.textContent,null,{timeout:20000});
  const png = await page.evaluate(async ({workPng,workLayout,printLayout}) => {
    const data = window.gd13Export;
    if (!data) return {error:document.querySelector('#export-image-status').textContent};
    async function sample(source,layout,scale) {
      const image = await createImageBitmap(await fetch(source).then(response => response.blob()));
      const canvas = Object.assign(document.createElement('canvas'),{width:image.width,height:image.height});
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image,0,0);
      return {width:image.width,height:image.height,colors:layout.images.map(([x,y,w,h]) =>
        [0.16,0.5,0.84].map(at => [...ctx.getImageData(Math.round((x+w*at)*scale),Math.round((y+h/2)*scale),1,1).data]))};
    }
    return {data,work:await sample('data:image/png;base64,'+workPng,workLayout,1),exported:await sample(data,printLayout,2)};
  },{workPng:workPng.toString('base64'),workLayout,printLayout});
  assert.ok(png.data,png.error);
  assert.ok(Math.abs(png.exported.width - printLayout.width*2) <= 2);
  assert.ok(Math.abs(png.exported.height - printLayout.height*2) <= 2);
  png.work.colors.forEach((image,i) => image.forEach((pixel,j) => {
    assert.notDeepEqual(pixel,[255,255,255,255]);
    assert.ok(pixel.every((value,channel) => Math.abs(value-png.exported.colors[i][j][channel]) < 20),
      JSON.stringify({pixel,exported:png.exported.colors[i][j]}));
  }));
  const {PDFDocument} = require('pdf-lib');
  const pdf = await PDFDocument.load(await page.pdf({preferCSSPageSize:true}));
  const {width,height} = pdf.getPage(0).getSize();
  assert.ok(Math.abs(width-841.9)<2 && Math.abs(height-595.3)<2,JSON.stringify({width,height}));
  if (process.env.GD13_SCREENSHOTS) {
    const destination = process.env.GD13_SCREENSHOTS;
    await writeFile(path.join(destination,'2-bang-lam-viec.png'),workPng);
    await writeFile(path.join(destination,'3-anh-xuat.png'),Buffer.from(png.data.split(',')[1],'base64'));
  }
};

cases['16.1'] = async page => {
  await openMaterials(page);
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  assert.ok(await cell.locator('.image-empty-hint').isVisible(), 'Ô trống phải có chữ gợi ý mờ');
  await cell.click();
  await page.locator('.asset-popover').waitFor();
  await pasteFixture(page, 'items');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.asset-popover').count(), 0, 'Popover thư viện phải đóng sau khi dán');
  await cell.locator('.image-open img').waitFor();
  assert.equal(await cell.locator('[data-action="cell-menu"]').count(), 1, 'Chỉ 1 nút ⋯ góc trên phải');
  await cell.locator('[data-action="cell-menu"]').click();
  await page.locator('.image-cell-dropdown-menu').waitFor();
  assert.ok(await page.locator('.image-cell-dropdown-menu').getByText('Chỉnh vùng nhìn').isVisible());
  assert.ok(await page.locator('.image-cell-dropdown-menu').getByText('Xoá ảnh').isVisible());
  await page.keyboard.press('Escape');
};

cases['16.2'] = async page => {
  await openMaterials(page);
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  await cell.focus();
  await pasteFixture(page, 'items');
  await cell.locator('.image-open img').waitFor();
  // Chốt PA
  await cell.locator('[data-action="pick-pa"]').click();
  const badge = cell.locator('.image-pick.chosen');
  await badge.waitFor();
  assert.equal(await badge.textContent(), '✓ Đã chốt');
  assert.ok((await badge.getAttribute('title')).includes('bỏ chốt'));
  // Bỏ chốt bằng cách bấm lại vào nhãn
  await badge.click();
  await page.waitForTimeout(200);
  assert.equal(await cell.locator('.image-pick.chosen').count(), 0, 'Đã bỏ chốt PA');
  // Hoàn tác
  await page.keyboard.press('Control+z');
  await page.waitForTimeout(200);
  assert.equal(await cell.locator('.image-pick.chosen').count(), 1, 'Hoàn tác khôi phục trạng thái đã chốt');
  // Kiểm tra menu ⋯ có Bỏ chốt
  await cell.locator('[data-action="cell-menu"]').click();
  await page.locator('.image-cell-dropdown-menu').waitFor();
  assert.ok(await page.locator('.image-cell-dropdown-menu').getByText('Bỏ chốt phương án').isVisible());
  await page.locator('.image-cell-dropdown-menu').getByText('Bỏ chốt phương án').click();
  await page.waitForTimeout(200);
  assert.equal(await cell.locator('.image-pick.chosen').count(), 0, 'Bỏ chốt qua menu ⋯');
};

cases['16.3'] = async page => {
  await openMaterials(page);
  const row = page.locator('[data-row="g1-r1"]');
  const codeInput = row.locator('[data-field="code"]').first();
  await codeInput.fill('MFC 7241 T');
  await codeInput.dispatchEvent('change');
  const cell = row.locator('.image-cell[data-slot="0"]');
  await cell.focus();
  await pasteFixture(page, 'items');
  await cell.locator('.image-open img').waitFor();
  await cell.locator('[data-action="pick-pa"]').click();
  await cell.locator('.image-pick.chosen').waitFor();

  const form = await openImageScope(page);
  await form.locator('select[name="imageFit"]').selectOption('fill');
  assert.equal(await form.locator('[name=codePosition]').inputValue(),'above');
  await form.getByRole('button', { name: 'Xem trước' }).click();

  await page.locator('#stats-copy').waitFor();
  const printSheet = page.locator('#print-sheet');
  assert.equal(await printSheet.getAttribute('data-image-fit'), 'fill', 'Bản xuất phải có data-image-fit=fill');
  const tag = printSheet.locator('.image-code-tag').first();
  await tag.waitFor();
  assert.equal(await tag.textContent(), 'MFC 7241 T', 'Tag mã đè lên ảnh cạnh dưới');
  assert.ok(await printSheet.locator('.image-cell.chosen').count() > 0, 'Bản xuất vẫn giữ viền đỏ PA đã chốt');
  await page.locator('#close-print').click();
};

cases['16.4'] = async page => {
  await openMaterials(page);
  // Bấm nút Copy ảnh chính -> chạy trực tiếp, KHÔNG mở modal #material-image-scope
  await page.evaluate(() => { window.html2canvas = async () => document.createElement('canvas'); });
  await page.locator('#material-copy').click();
  const result = page.locator('#material-copy-result[open]');
  await result.waitFor({timeout:20000});
  assert.equal(await page.locator('#material-image-scope').count(),0,'Copy ảnh không hiện modal cài đặt');
  await result.getByRole('button',{name:'Đóng',exact:true}).last().click();
  await result.waitFor({state:'detached'});

  // Mở menu ▾ -> bấm ⚙ Cài đặt xuất…
  await page.locator('.hdr-split-caret').click();
  await page.locator('#material-export-settings').click();
  const form = page.locator('#material-image-scope');
  await form.waitFor();
  assert.ok(await form.isVisible(), 'Modal cài đặt xuất hiển thị');

  // Đổi tuỳ chọn và bấm Lưu cài đặt
  await form.locator('select[name="imageFit"]').selectOption('fit');
  await form.locator('[name=codePosition]').selectOption('below');
  await page.locator('#save-export-settings-only').click();
  await page.waitForTimeout(300);
  assert.equal(await page.locator('#material-image-scope').isVisible(), false, 'Modal đóng sau khi lưu');

  // Mở lại kiểm tra tuỳ chọn đã lưu
  await page.locator('.hdr-split-caret').click();
  await page.locator('#material-export-settings').click();
  await form.waitFor();
  assert.equal(await form.locator('select[name="imageFit"]').inputValue(), 'fit');
  assert.equal(await form.locator('[name=codePosition]').inputValue(),'below');
  await page.locator('#material-dialog').press('Escape');
};

cases['16.5'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => modify(() => {
    sheet.groups[0].name = 'SƠN TƯỜNG + TRẦN';
  }));
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  await cell.click();
  const popover = page.locator('.asset-popover');
  await popover.waitFor();
  assert.ok(await popover.getByText('Chọn màu sơn').isVisible(), 'Mở bảng chọn màu sơn');

  const searchInput = popover.locator('input[type="search"]');
  await searchInput.fill('30YY');
  await page.waitForTimeout(300);
  const card = popover.locator('[data-paint-code="30YY 72/107"]');
  await card.waitFor();
  await card.click();

  await cell.locator('.paint-swatch-box').waitFor();
  assert.ok(await cell.locator('.image-code-tag').getByText('30YY 72/107').isVisible(), 'Có tag mã màu sơn trên swatch');
  const codeVal = await page.locator('[data-row="g1-r1"] [data-field="code"]').first().inputValue();
  assert.equal(codeVal, '30YY 72/107', 'Tự điền mã sơn vào ô mã PA');

  // Kiểm tra bảng xuất có khối màu
  await page.locator('#material-print-view').check();
  await page.locator('#material-table-preview').waitFor();
  assert.ok(await page.locator('#material-table-preview .paint-swatch-box').count() > 0, 'Bản xuất có khối màu sơn');
};

cases['16.6'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => modify(() => {
    sheet.groups[0].name = 'MÃ GỖ (Melamine, PVC…)';
  }));
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  await cell.click();
  const popover = page.locator('.asset-popover');
  await popover.waitFor();
  assert.ok(await popover.getByText('Mã gỗ',{exact:true}).isVisible(), 'Mở bảng chọn mã gỗ An Cường');

  const searchInput = popover.locator('input[type="search"]');
  await searchInput.fill('7241');
  await page.waitForTimeout(300);
  const card = popover.locator('[data-wood-code="MFC 7241 T"]');
  await card.waitFor();
  await card.click();

  const codeVal = await page.locator('[data-row="g1-r1"] [data-field="code"]').first().inputValue();
  assert.equal(codeVal, 'MFC 7241 T', 'Tự điền mã gỗ');
  const specVal = await page.locator('[data-row="g1-r1"] [data-field="spec"]').inputValue();
  assert.equal(specVal, 'Melamine MFC', 'Tự điền dòng sản phẩm vào quy cách');
};

cases['16.7'] = async page => {
  await openMaterials(page);
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  await cell.click();
  const popover = page.locator('.asset-popover');
  await popover.waitFor();

  const box = await popover.boundingBox();
  assert.ok(box.width >= 550 && box.width <= 570, 'Chiều rộng popover ~560px (thực tế: ' + box.width + ')');
  const bg = await popover.evaluate(el => getComputedStyle(el).backgroundColor);
  assert.ok(bg.includes('244, 241, 236') || bg.includes('#f4f1ec'), 'Màu nền popover là be-ghi nhạt #f4f1ec');

  const searchInput = popover.locator('input[type="search"]');
  await searchInput.fill('KhongTonTai9999');
  await page.waitForTimeout(300);
  const fallback = popover.locator('.asset-google-fallback');
  await fallback.waitFor();
  assert.ok(await fallback.getByText('Mở Google Ảnh "KhongTonTai9999"').isVisible(), 'Hiện nút mở Google Ảnh kèm từ khoá');
  assert.ok(await fallback.getByText('Ctrl+V').isVisible(), 'Có hướng dẫn dán Ctrl+V');
  await page.keyboard.press('Escape');
};

cases['18.6'] = async page => {
  await openMaterials(page);
  await addFixtureImage(page,'0');
  await page.evaluate(() => modify(() => {
    sheet.groups = [{...sheet.groups[0],rows:sheet.groups[0].rows.slice(0,2)}];
    materialView.export = {watermark:false};
  }));
  await page.locator('.image-open img[data-image-axis]').first().waitFor();
  await page.evaluate(() => {
    const showModal = HTMLDialogElement.prototype.showModal;
    window.printPreviewOpened = false;
    HTMLDialogElement.prototype.showModal = function () {
      if (this.id === 'print-preview') window.printPreviewOpened = true;
      return showModal.call(this);
    };
    Object.defineProperty(navigator,'clipboard',{value:{write:async items => {
      const root = document.querySelector('.material-paper-output[aria-hidden=true]');
      if (!root || root.getBoundingClientRect().left >= 0) throw new Error('Bản xuất phải nằm ngoài màn hình');
      window.gd18CopyBlob = await items[0].getType('image/png');
    }}});
  });
  await page.locator('#material-copy').click();
  const result = page.locator('#material-copy-result');
  const status = result.getByRole('status');
  await status.waitFor({timeout:20000});
  assert.match(await status.textContent(),/Đã copy vào bộ nhớ/);
  const png = await page.evaluate(async () => {
    const image = await createImageBitmap(window.gd18CopyBlob);
    const canvas = Object.assign(document.createElement('canvas'),{width:80,height:80});
    const ctx = canvas.getContext('2d');
    ctx.drawImage(image,0,0,80,80);
    const pixels = ctx.getImageData(0,0,80,80).data;
    let nonwhite = 0;
    for (let i=0; i<pixels.length; i+=4) if (Math.min(pixels[i],pixels[i+1],pixels[i+2]) < 200) nonwhite++;
    return {width:image.width,height:image.height,nonwhite};
  });
  assert.ok(png.width > 200 && png.height > 100 && png.nonwhite > 30,JSON.stringify(png));
  assert.equal(await page.evaluate(() => window.printPreviewOpened),false);
  await result.locator('img').waitFor();
  assert.match(await result.getByRole('link',{name:'Tải PNG'}).getAttribute('href'),/^blob:/);
  await result.getByRole('button',{name:'Mở xem lớn'}).click();
  assert.ok((await result.getAttribute('class')).includes('is-large'));
  await page.keyboard.press('Escape');
  await result.waitFor({state:'detached'});
  await page.evaluate(() => { window.html2canvas = async () => { throw new Error('Test clipboard'); }; });
  await page.locator('#material-copy').click();
  await result.getByText(/Test clipboard/).waitFor();
  assert.equal(await page.evaluate(() => window.printPreviewOpened),false);
  await page.mouse.click(1,1);
  await result.waitFor({state:'detached'});
};

cases['17.3'] = cases['18.6'];

cases['17.2'] = async page => {
  await page.goto('/');
  const deleteButton = page.locator('.project-owner-header').filter({hasText:'Căn hộ mẫu GĐ8'}).locator('.owner-mini-btn.del');
  const dialog = page.locator('#delete-schedule-project');
  await deleteButton.dispatchEvent('click');
  assert.ok(await dialog.getByText('2 giai đoạn · 1 công việc').isVisible());
  assert.ok(await dialog.locator('#move-project-stages').isDisabled());
  assert.ok(await dialog.locator('#delete-project-all').isDisabled());
  await dialog.locator('#delete-project-target').selectOption('gd13-other');
  await dialog.locator('#move-project-stages').click();
  assert.equal(await page.evaluate(() => AppState.calendars.find(c => c.id === 'c1').ownerId),'gd13-other');
  await page.locator('.toast-notification.show').getByRole('button',{name:'Hoàn tác'}).click();
  await deleteButton.dispatchEvent('click');
  await dialog.locator('#delete-project-confirm').fill('Căn hộ mẫu GĐ8');
  await dialog.locator('#delete-project-all').click();
  assert.equal(await page.evaluate(() => AppState.tasks.some(t => t.id === 'gd17-task')),false);
  await page.keyboard.press('Control+z');
  assert.equal(await page.evaluate(() => AppState.tasks.some(t => t.id === 'gd17-task')),true);
};

cases['17.0'] = async page => {
  const asset = 'a'.repeat(64) + '.webp';
  await page.route('**/api/materials/assets/' + asset,route => route.fulfill({status:404}));
  let documents = [{id:'render-test',name:'3D mẫu',type:'render',assetKey:'render-' + asset}];
  await page.route('**/api/project-hub/project?id=p1',route => route.fulfill({json:{project:{hub:{documents}}}}));
  await page.route('**/api/project-hub/documents/delete',route => {
    documents = [];
    return route.fulfill({json:{ok:true}});
  });
  await openMaterials(page);
  const data = await page.evaluate(async asset => {
    const {categories} = await GDHomeAssets.loadLibrary();
    return GDHomeAssets.addItems(categories[0].id,[{name:'Ảnh mẫu',full:asset,thumb:asset}]);
  },asset);
  assert.equal(data.added.length,1);
  await page.locator('[data-library-summary]').filter({hasText:'1 ảnh mẫu'}).waitFor();
  await page.locator('.material-sidebar-actions [data-action=open-library]').click();
  page.on('dialog',dialog => dialog.accept());
  await page.locator('.asset-library-dialog [data-asset-remove]').click();
  await page.locator('.asset-library-dialog').getByText('Chưa có ảnh trong hạng mục này.').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('[data-library-summary]').filter({hasText:'0 ảnh mẫu'}).waitFor();
  await page.locator('[data-render-summary]').filter({hasText:'1 ảnh 3D'}).waitFor();
  await page.locator('[data-sidebar=renders] [data-action=open-renders]').click();
  await page.locator('.asset-render-dialog [data-asset-remove]').click();
  await page.locator('.asset-render-dialog').getByText('Dự án chưa có phối cảnh 3D.').waitFor();
  assert.equal(await page.locator('[data-render-strip] [data-id=render-test]').count(),0);
};

cases['18.1'] = async page => {
  const asset = 'a'.repeat(64) + '.webp';
  await page.route('**/api/materials/assets/' + asset,route => route.fulfill({status:404}));
  let documents = [{id:'render-test',name:'3D mẫu',type:'render',assetKey:'render-' + asset}];
  await page.route('**/api/project-hub/project?id=p1',async route => {
    const response = {project:{hub:{documents}}};
    await new Promise(resolve => setTimeout(resolve,1500));
    return route.fulfill({json:response});
  });
  await page.route('**/api/project-hub/documents/delete',async route => {
    await new Promise(resolve => setTimeout(resolve,1500));
    documents = [];
    return route.fulfill({json:{ok:true}});
  });
  for (const pattern of ['**/api/materials*','**/api/library*','**/api/library/items/delete']) {
    await page.route(pattern,async route => { await new Promise(resolve => setTimeout(resolve,1500)); await route.continue(); });
  }
  await openMaterials(page);
  const data = await page.evaluate(async asset => {
    const {categories} = await GDHomeAssets.loadLibrary();
    return GDHomeAssets.addItems(categories[0].id,[{name:'Ảnh mẫu',full:asset,thumb:asset}]);
  },asset);
  assert.equal(data.added.length,1);
  await page.locator('[data-library-summary]').filter({hasText:'1 ảnh mẫu'}).waitFor();
  await page.locator('.material-sidebar-actions [data-action=open-library]').click();
  page.on('dialog',dialog => dialog.accept());
  await page.locator('.asset-library-dialog [data-asset-remove]').click();
  await page.locator('.asset-library-dialog [data-asset-remove]').waitFor({state:'detached',timeout:100});
  await page.keyboard.press('Escape');
  await page.locator('[data-library-summary]').filter({hasText:'0 ảnh mẫu'}).waitFor();
  await page.locator('[data-render-summary]').filter({hasText:'1 ảnh 3D'}).waitFor();
  await page.locator('[data-sidebar=renders] [data-action=open-renders]').click();
  await page.locator('.asset-render-dialog [data-asset-remove]').click();
  await page.locator('.asset-render-dialog [data-asset-remove]').waitFor({state:'detached',timeout:100});
  assert.equal(await page.locator('[data-render-strip] [data-id=render-test]').count(),0);
  await page.keyboard.press('Escape');
  await page.evaluate(asset => modify(() => {
    const row = sheet.groups[0].rows[0];
    row.options[0].images = [{full:asset,thumb:asset}];
    row.paCount = 3;
  }),asset);
  const row = page.locator('[data-row="g1-r1"]');
  const cell = row.locator('.image-cell[data-slot="0"]');
  await cell.locator('[data-action=cell-menu]').click();
  await page.locator('.image-cell-dropdown-menu').getByRole('button',{name:/Xoá ảnh/}).click();
  await cell.locator('.image-open').waitFor({state:'detached',timeout:100});
  const removePa = row.locator('[data-action=remove-pa]').last();
  await removePa.click();
  await row.locator('.image-cell[data-slot="2"]').waitFor({state:'detached',timeout:100});
  await page.waitForFunction(() => !saving && !dirty);
  await page.route('**/api/materials',async route => {
    if (route.request().method() !== 'POST') return route.fallback();
    await new Promise(resolve => setTimeout(resolve,1500));
    return route.fulfill({status:503,json:{message:'Máy chủ đang bận'}});
  });
  await row.locator('[data-action=del-row]').dispatchEvent('click');
  await row.waitFor({state:'detached',timeout:100});
  await page.locator('#notice').getByText(/Đã khôi phục mục vừa xoá/).waitFor();
  await row.waitFor();
};

cases['17.1'] = async page => {
  await page.route('**/api/project-hub/project?id=p1',route => route.fulfill({json:{project:{hub:{documents:[
    {id:'quote',type:'quote',name:'Báo giá.pdf',assetKey:'quote.pdf',size:2048},
    {id:'drawing',type:'drawing',name:'Bản vẽ.pdf',assetKey:'drawing.pdf',size:3072}
  ]}}}}));
  await page.route('**/api/ai/materials',route => {
    const payload = route.request().postDataJSON();
    assert.deepEqual(payload.documentIds,['quote']);
    assert.deepEqual(payload.pdfs,[]);
    assert.equal(payload.projectId,'p1');
    return route.fulfill({json:{plan:{groups:[],questions:[],model:'Test'},aiSkipped:[]}});
  });
  await openMaterials(page);
  await page.locator('#material-ai').click();
  const form = page.locator('#material-ai-form');
  assert.ok(await form.locator('[value=quote]').isChecked());
  assert.ok(!(await form.locator('[value=drawing]').isChecked()));
  const send = form.getByRole('button',{name:'Gửi AI đề xuất'});
  await form.locator('[value=quote]').uncheck();
  assert.ok(await send.isDisabled());
  await form.locator('[value=quote]').check();
  await send.click();
  await page.getByRole('button',{name:'Duyệt đề xuất'}).waitFor();
};

cases['18.7'] = async page => {
  const asset = 'a'.repeat(64) + '.webp';
  const documents = Array.from({length:13},(_,i) => ({id:'render-' + i,name:'Mẫu ' + i,type:'render',assetKey:'render-' + asset}));
  await page.route('**/api/project-hub/project?id=p1',route => route.fulfill({json:{project:{hub:{documents}}}}));
  await page.route('**/api/materials/assets/' + asset,route => route.fulfill({status:404}));
  await openMaterials(page);
  const strip = page.locator('[data-render-strip]');
  await page.locator('[data-render-summary]').filter({hasText:'13 ảnh 3D'}).waitFor();
  assert.equal(await strip.locator('img').count(),0);
  const display = page.locator('[data-sidebar=display]');
  if (await display.getAttribute('open') === null) await display.locator('summary').click();
  const toggle = display.locator('[data-action=toggle-asset-previews]');
  await toggle.click();
  await strip.getByText('+4',{exact:true}).waitFor();
  assert.equal(await strip.locator('img').count(),9);
  const boxes = await strip.locator('button').evaluateAll(items => items.map(item => item.getBoundingClientRect().toJSON()));
  assert.ok(boxes.every(box => box.width <= 40 && box.height <= 40));
  assert.equal(new Set(boxes.map(box => box.y)).size,2);
  await page.waitForFunction(() => materials.viewSettings?.hideAssetPreviews === false && !Object.keys(sentMaterialView).length);
  await page.reload();
  await strip.getByText('+4',{exact:true}).waitFor();
  await page.waitForFunction(() => !Object.keys(pendingMaterialView).length && !Object.keys(sentMaterialView).length);
};
cases['17.4'] = cases['18.7'];

cases['17.5'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => GDHomeConnections.open('google'));
  const form = page.locator('[data-connection-form=google]');
  assert.equal(await form.locator('[name=imageSearchProvider]').inputValue(),'serper');
  await form.locator('[name=imageSearchProvider]').selectOption('brave');
  await form.locator('[name=imageSearchKey]').fill('test-brave-secret');
  await form.getByRole('button',{name:'Lưu kết nối'}).click();
  await page.getByText('Đã lưu kết nối.').waitFor();
  const cfg = await page.request.get('/api/integrations/settings').then(response => response.json());
  assert.equal(cfg.imageSearch.provider,'brave');
  assert.equal(cfg.imageSearch.configured,true);
  assert.ok(!JSON.stringify(cfg).includes('test-brave-secret'));
  await form.getByRole('button',{name:'Gỡ kết nối'}).click();
  await page.getByText('Đã gỡ kết nối.').waitFor();
  const fallback = await page.request.get('/api/google/search?q=oak').then(response => response.json());
  assert.equal(fallback.configured,false);
};

async function testCatalogue(page,useAi = false,withGuide = false) {
  const {PDFDocument,rgb,StandardFonts} = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const colors = [];
  for (let n=0;n<2;n++) {
    const sheet = pdf.addPage([600,600]);
    for (let i=0;i<9;i++) {
      const id = n*9+i;
      const color = [((id*71+70)%200+20)/255,((id*37+80)%200+20)/255,((id*131+90)%200+20)/255];
      colors.push(color.map(value => Math.round(value*255)));
      const x = 30+(i%3)*190, y = 430-Math.floor(i/3)*190;
      sheet.drawRectangle({x,y,width:150,height:130,color:rgb(...color)});
      sheet.drawText('MS ' + (3000+id) + ' - Oak ' + (id+1),{x:x+12,y:y-10,size:10,font});
    }
  }
  if (process.env.PDFJS_TEST_DIR) await page.route('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/**',route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1);
    return route.fulfill({path:path.join(process.env.PDFJS_TEST_DIR,name),contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}});
  });
  if (useAi) {
    await page.route('**/api/ai/jobs/start',route => {
      const body = route.request().postDataJSON();
      assert.equal(body.kind,'catalogue');
      assert.equal(body.pages.length,2);
      assert.match(body.pages[0].image,/^data:image\/jpeg;base64,/);
      assert.ok(body.pages[0].text.some(label => /MS 3000/.test(label.text) && label.x > 0));
      if (withGuide) {
        assert.equal(body.guide.prompt,'Chỉ lấy ô vân hình chữ nhật.');
        const [example] = body.guide.examples;
        assert.match(example.image,/^data:image\/jpeg;base64,/);
        assert.ok(example.crop.x > .2 && example.codeBox);
      }
      return route.fulfill({json:{success:true,job:{id:'test-catalogue',status:'running'}}});
    });
    await page.route('**/api/project-hub/jobs/status?jobId=test-catalogue',route => route.fulfill({json:{job:{status:'done',result:{items:colors.map((_,id) => {
      const i = id%9;
      return {page:Math.floor(id/9)+1,code:'MS '+(3000+id),name:'Oak '+(id+1),size:'60x60',confidence:.95,
        bbox:{x:(30+(i%3)*190)/600,y:(40+Math.floor(i/3)*190)/600,w:150/600,h:130/600}};
    })}}}}));
  }
  await openMaterials(page);
  await page.locator('[data-sidebar=library] .material-sidebar-actions [data-action=open-library]').click();
  await page.locator('.asset-library-dialog [data-cat=ancuong-wood]').click();
  await page.locator('[data-import-wood]').click();
  const modal = page.locator('.wood-catalogue-dialog');
  await modal.locator('[name=pdf]').setInputFiles({name:'fixture-ancuong.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await modal.locator('[name=collection]').fill('Vân gỗ thử');
  await modal.locator('[name=finish]').fill('Mờ');
  if (useAi) {
    await modal.locator('[name=useAi]').check();
    await modal.locator('[name=suppliers]').fill('Kho A');
  }
  if (withGuide) {
    const example = await page.evaluate(() => {
      const canvas = Object.assign(document.createElement('canvas'),{width:200,height:100});
      canvas.getContext('2d').fillRect(0,0,200,100);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await modal.locator('[name=guidePrompt]').fill('Chỉ lấy ô vân hình chữ nhật.');
    await modal.locator('[name=guideImages]').setInputFiles({name:'mau.png',mimeType:'image/png',buffer:Buffer.from(example,'base64')});
    for (const field of ['crop','codeBox']) {
      await modal.locator('[data-guide-box=' + field + ']').click();
      const crop = page.locator('.wood-crop-dialog');
      const box = await crop.locator('.wood-crop-frame').boundingBox();
      await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
      await page.mouse.down();
      await page.mouse.move(box.x+box.width/2+10,box.y+box.height/2);
      await page.mouse.up();
      await crop.getByRole('button',{name:'Áp dụng khung cắt'}).click();
    }
    await modal.locator('[name=guideName]').fill('Vân ngang');
    await modal.locator('[data-guide-save]').click();
    await modal.locator('[name=guidePrompt]').fill('');
    await modal.locator('[name=guidePreset]').selectOption('');
    await modal.locator('[name=guidePreset]').selectOption('Vân ngang');
    assert.equal(await modal.locator('[name=guidePrompt]').inputValue(),'Chỉ lấy ô vân hình chữ nhật.');
  }
  await modal.getByRole('button',{name:'Đọc PDF'}).click();
  const save = modal.locator('[data-save-wood]');
  await page.waitForFunction(() => !document.querySelector('.wood-catalogue-controls [type=submit]')?.disabled,null,{timeout:25000});
  assert.ok(await save.isEnabled(),await modal.getByRole('status').textContent());
  const cards = modal.locator('.wood-catalogue-card');
  assert.equal(await cards.count(),18);
  const pixels = await cards.evaluateAll(cards => cards.map(card => {
    const canvas = card.querySelector('canvas'), ctx = canvas.getContext('2d');
    return {code:card.querySelector('[data-wood-code-input]').value,ratio:canvas.width/canvas.height,
      rgb:[...ctx.getImageData(Math.floor(canvas.width/2),Math.floor(canvas.height/2),1,1).data.slice(0,3)]};
  }));
  for (const [i,entry] of pixels.entries()) {
    assert.equal(entry.code,'MS ' + (3000+i));
    if (withGuide) assert.ok(Math.abs(entry.ratio-2) < .02);
    assert.ok(entry.rgb.every((value,ch) => Math.abs(value-colors[i][ch]) < 12),JSON.stringify(entry));
  }
  await cards.first().locator('[data-show-catalogue-detail]').click();
  await modal.locator('[data-edit-wood-crop]').click();
  const crop = page.locator('.wood-crop-dialog');
  const frame = crop.locator('.wood-crop-frame');
  const before = await frame.boundingBox();
  await page.mouse.move(before.x+before.width/2,before.y+before.height/2);
  await page.mouse.down();
  await page.mouse.move(before.x+before.width/2+8,before.y+before.height/2+3);
  await page.mouse.up();
  assert.ok((await frame.boundingBox()).x > before.x);
  await crop.getByRole('button',{name:'Áp dụng khung cắt'}).click();
  await cards.last().locator('[data-wood-include]').uncheck();
  await save.click();
  await modal.getByText('Đã lưu 17 mã · bỏ qua 0 mã trùng.').waitFor({timeout:25000});
  await save.click();
  await modal.getByText('Đã lưu 0 mã · bỏ qua 17 mã trùng.').waitFor();
  if (useAi) {
    await modal.locator('[name=suppliers]').fill('Kho B');
    await save.click();
    await modal.getByText('Đã lưu 0 mã · bỏ qua 17 mã trùng.').waitFor();
    const library = await page.request.get('/api/library').then(response => response.json());
    const matches = library.items.filter(item => item.code === 'MS 3000');
    assert.equal(matches.length,1);
    assert.deepEqual(matches[0].suppliers,['Kho A','Kho B']);
    assert.equal(matches[0].size,'600x600');
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await page.evaluate(() => modify(() => { sheet.groups[0].name = 'MÃ GỖ'; }));
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  await cell.click();
  const picker = page.locator('.asset-popover');
  await picker.getByLabel('Dòng sản phẩm').selectOption('Vân gỗ thử');
  await picker.locator('input[type=search]').fill('van go thu');
  await picker.locator('[data-wood-code="MS 3000"]').click();
  assert.equal(await page.locator('[data-row="g1-r1"] [data-field=code]').first().inputValue(),'MS 3000');
  await cell.locator('.image-open img').waitFor();
}
cases['17.6'] = page => testCatalogue(page);
cases['19.5'] = page => testCatalogue(page,true);
cases['20.6'] = page => testCatalogue(page,true,true);

cases['18.2'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => {
    const anchor = document.createElement('button');
    anchor.style.cssText = 'position:fixed;top:90vh;left:50vw';
    document.body.append(anchor);
    GDHomeAssets.pickLibrary(anchor,{});
  });
  const panel = page.locator('.asset-popover');
  await panel.waitFor();
  const bounds = await panel.boundingBox();
  const {height,width} = page.viewportSize();
  assert.equal(await panel.getAttribute('data-direction'),'above');
  assert.ok(bounds.y >= 0 && bounds.y+bounds.height <= height && bounds.height >= 400);
  assert.ok(bounds.x >= 0 && bounds.x+bounds.width <= width);
};

cases['18.5'] = async page => {
  await openMaterials(page);
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  await cell.focus();
  await pasteFixture(page,'items');
  await cell.locator('.image-open img').waitFor();
  await page.evaluate(() => modify(() => Object.assign(sheet.groups[0].rows[0].options[0],{code:'MFC 416 EV',autoName:true})));
  const check = position => page.evaluate(position => {
    materialView.export = {codePosition:position};
    const cell = materialPaperForExport(sheet).querySelector('[data-row="g1-r1"] .image-cell[data-slot="0"]');
    return [!!cell.querySelector('.image-code-tag'),!!cell.querySelector('.pa-caption')];
  },position);
  assert.deepEqual(await check('above'),[true,false]);
  assert.deepEqual(await check('below'),[false,true]);
  assert.deepEqual(await check('both'),[true,true]);
  await cell.locator('[data-action=cell-menu]').click();
  await page.locator('.image-cell-dropdown-menu').getByRole('button',{name:/Xoá ảnh/}).click();
  assert.equal(await cell.locator('[data-field=code]').inputValue(),'');
  await page.evaluate(() => undo(false));
  assert.equal(await cell.locator('[data-field=code]').inputValue(),'MFC 416 EV');
  await cell.locator('[data-field=code]').fill('Mã gõ tay');
  await cell.locator('[data-action=cell-menu]').click();
  await page.locator('.image-cell-dropdown-menu').getByRole('button',{name:/Xoá ảnh/}).click();
  assert.equal(await cell.locator('[data-field=code]').inputValue(),'Mã gõ tay');
};

cases['18.4'] = async page => {
  await openMaterials(page);
  const label = 'MFC 612 T · Óc Chó Walnut Elegance với tên rất dài để kiểm tra xuống dòng';
  const code = page.locator('[data-row="g1-r1"] .pa-caption textarea').first();
  await code.fill(label);
  assert.ok(await code.evaluate(field => field.clientHeight > 2*parseFloat(getComputedStyle(field).lineHeight)));
  await page.evaluate(() => { materialView.export = {codePosition:'below'}; });
  await page.locator('.hdr-split-caret').click();
  await page.locator('[data-image-mode=preview]').click();
  const printed = page.locator('#print-sheet [data-row="g1-r1"] .pa-caption .sheet-value').first();
  assert.equal(await printed.textContent(),label);
  assert.ok(await printed.evaluate(field => field.offsetHeight > 2*parseFloat(getComputedStyle(field).lineHeight)));
};

cases['18.3'] = async page => {
  await openMaterials(page);
  const asset = 'a'.repeat(64) + '.webp';
  await page.route('**/api/materials/assets/' + asset,route => route.fulfill({status:404}));
  const brands = await page.evaluate(async asset => {
    await GDHomeAssets.addItems('ancuong-wood',[
      {code:'MS 7241',brand:'Minh Long',name:'Gỗ óc chó',collection:'Vân gỗ',full:asset,thumb:asset},
      {code:'MS 7241',brand:'Hãng thử',name:'Sồi trắng',collection:'Laminate',full:asset,thumb:asset}
    ]);
    const {woods} = await GDHomeAssets.loadWoodData();
    return woods.filter(item => item.code === 'MS 7241' || item.code === 'MFC 7241 T').map(item => item.brand).sort();
  },asset);
  assert.deepEqual(brands,['An Cường','Hãng thử','Minh Long']);
  await page.evaluate(() => modify(() => { sheet.groups[0].name = 'MÃ GỖ'; }));
  const cell = page.locator('[data-row="g1-r1"] .image-cell[data-slot="0"]');
  await cell.click();
  const picker = page.locator('.asset-popover');
  await picker.getByLabel('Hãng',{exact:true}).selectOption('Minh Long');
  await picker.getByLabel('Dòng sản phẩm').selectOption('Vân gỗ');
  await picker.locator('input[type=search]').fill('go oc cho');
  await picker.locator('[data-wood-code="MS 7241"]').click();
  assert.equal(await page.evaluate(() => sheet.groups[0].rows[0].options[0].brand),'Minh Long');
  await page.locator('[data-sidebar=library] .material-sidebar-actions [data-action=open-library]').click();
  await page.locator('.asset-library-dialog [data-cat=ancuong-wood]').click();
  await page.locator('[data-import-wood]').click();
  await page.locator('.wood-catalogue-dialog [name=brand]').fill('Hãng tự nhập');
  assert.equal(await page.locator('.wood-catalogue-dialog [name=brand]').inputValue(),'Hãng tự nhập');
};

cases['18.10'] = async page => {
  const asset = 'a'.repeat(64) + '.webp';
  let uploads = 0;
  await page.route('**/api/materials/assets**',route => {
    if (route.request().method() === 'POST') uploads++;
    return route.fulfill({status:404});
  });
  await openMaterials(page);
  await page.evaluate(asset => modify(() => {
    const row = sheet.groups[0].rows[0];
    row.render = [{full:asset,thumb:asset}];
    row.options[0].images = [{full:asset,thumb:asset}];
  }),asset);
  const from = slot => page.locator('[data-row=g1-r1] [data-slot="' + slot + '"] .image-open');
  const to = slot => page.locator('[data-row=g1-r2] [data-slot="' + slot + '"]');
  await from('render').dragTo(to('render'));
  await to('render').locator('.image-open').waitFor();
  await from('render').waitFor();
  const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
  await from('0').dispatchEvent('dragstart',{dataTransfer});
  await to('0').dispatchEvent('dragover',{dataTransfer,shiftKey:true});
  assert.ok((await to('0').getAttribute('class')).includes('material-image-drop-target'));
  await to('0').dispatchEvent('drop',{dataTransfer,shiftKey:true});
  await to('0').locator('.image-open').waitFor();
  assert.equal(await from('0').count(),0);
  const target = await page.evaluate(() => sheet.groups[0].rows[1]);
  assert.equal(target.render[0].full,asset);
  assert.equal(target.options[0].images[0].thumb,asset);
  assert.equal(uploads,0);
  await page.evaluate(() => undo(false));
  await from('0').waitFor();
  assert.equal(await to('0').locator('.image-open').count(),0);
};

cases['18.9'] = async page => {
  await openMaterials(page);
  const candidates = await page.evaluate(() => {
    const original = materials.sheets;
    try {
      materials.sheets = [
        {projectId:'p1',title:'Tủ bếp - V2'},
        {projectId:'p2',title:'Tủ bếp - V1'}
      ];
      return [
        versionedMaterialTitle('p1','Tủ bếp - V2 (bản sao)','2026-11-09'),
        versionedMaterialTitle('p2','Tủ bếp','2026-11-09'),
        versionedMaterialTitle('p3','Tủ bếp','2026-11-09')
      ];
    } finally { materials.sheets = original; }
  });
  assert.deepEqual(candidates,['Tủ bếp - V2 (09/11)','Tủ bếp - V2','Tủ bếp - V1']);
  await page.evaluate(() => {
    createSheet('p1','Bảng chốt mã mới',[newGroup('Nhóm',['Dòng'])]);
  });
  await page.waitForFunction(() => sheet.id && sheet.title === 'Bảng chốt mã mới - V1');
  await page.evaluate(() => createSheet('p1',sheet.title,[newGroup('Nhóm',['Dòng'])]));
  await page.waitForFunction(() => sheet.id && sheet.title === 'Bảng chốt mã mới - V2');
  const list = await page.request.get('/api/materials').then(r => r.json());
  assert.deepEqual(list.sheets.filter(item => item.title.startsWith('Bảng chốt mã mới')).map(item => item.title).sort(),
    ['Bảng chốt mã mới - V1','Bảng chốt mã mới - V2']);
};

cases['18.8'] = async page => {
  const asset = 'a'.repeat(64) + '.webp';
  await page.route('**/api/materials/assets/' + asset,route => route.fulfill({status:404}));
  await page.route('**/api/project-hub/project?id=p1',route => route.fulfill({json:{project:{hub:{documents:[]}}}}));
  await page.route('**/api/google/search?*',route => route.fulfill({json:{configured:true,items:[
    {title:'Mẫu trực tuyến',link:'https://example.com/oak.png',thumbnail:'data:image/png;base64,' + imageFixture}
  ]}}));
  await page.route('**/api/google/proxy-image',route => {
    assert.equal(route.request().postDataJSON().url,'https://example.com/oak.png');
    return route.fulfill({contentType:'image/png',body:Buffer.from(imageFixture,'base64')});
  });
  await openMaterials(page);
  const category = await page.evaluate(async asset => {
    const data = await GDHomeAssets.loadLibrary();
    const category = data.categories[0].id;
    await GDHomeAssets.addItems(category,[{name:'Oak mẫu trong kho',full:asset,thumb:asset}]);
    return category;
  },asset);
  const cell = id => page.locator('[data-row="g1-r' + id + '"] .image-cell[data-slot="0"]');
  const panel = page.locator('.asset-popover');
  await cell(1).click();
  await panel.getByLabel('Hạng mục').selectOption(category);
  await panel.locator('input[type=search]').fill('Oak');
  await panel.getByRole('heading',{name:'Tìm trên mạng'}).waitFor();
  assert.equal(await panel.locator('.asset-card').count(),1);
  assert.ok(await panel.locator('[data-save-online-image]').isChecked());
  const saved = page.waitForResponse(response => response.url().endsWith('/api/library/items') && response.request().method() === 'POST');
  await panel.locator('[data-google-idx="0"]').click();
  await saved;
  await cell(1).locator('.image-open img').waitFor();
  assert.ok((await page.request.get('/api/library').then(r => r.json())).items.some(item => item.name === 'Mẫu trực tuyến' && item.categoryId === category));
  await cell(2).click();
  await panel.locator('input[type=search]').fill('Riêng');
  await panel.locator('[data-save-online-image]').uncheck();
  let saves = 0;
  page.on('request',request => { if (request.url().endsWith('/api/library/items') && request.method() === 'POST') saves++; });
  await panel.locator('[data-google-idx="0"]').click();
  await cell(2).locator('.image-open img').waitFor();
  assert.equal(saves,0);
  await page.locator('[data-sidebar=library] .material-sidebar-actions [data-action=open-library]').click();
  const library = page.locator('.asset-library-dialog');
  await library.locator('input[type=search]').fill('Oak');
  await library.getByRole('heading',{name:'Tìm trên mạng'}).waitFor();
  await library.locator('.close-dialog').click();
  await library.waitFor({state:'detached'});
  for (const picker of ['pickPaint','pickWood','pickRender']) {
    await page.evaluate(picker => GDHomeAssets[picker](document.querySelector('.image-cell'),{projectId:'p1'}),picker);
    const search = panel.locator('input[type=search]');
    await search.fill('Catalogue999');
    assert.equal(await search.inputValue(),'Catalogue999',picker);
    await panel.getByRole('heading',{name:'Tìm trên mạng'}).waitFor().catch(async error => { throw new Error(picker + ': ' + await panel.textContent(),{cause:error}); });
    await page.keyboard.press('Escape');
  }
};

cases['19.1'] = async page => {
  await openMaterials(page);
  assert.ok(await page.locator('.image-empty-hint').count());
  await page.locator('.hdr-split-caret').click();
  await page.locator('[data-image-mode=preview]').click();
  const paper = page.locator('#print-sheet');
  await paper.waitFor();
  assert.doesNotMatch(await paper.innerHTML(),/Bấm để chọn|Ctrl\+V/);
  assert.equal(await paper.locator('.image-empty-hint').count(),0);
};

cases['19.2'] = async page => {
  await openMaterials(page);
  const library = () => page.request.get('/api/library').then(r => r.json());
  const seeded = await library();
  const paint = seeded.items.find(item => item.kind === 'paint' && item.code === '30YY 72/107');
  assert.ok(paint.builtin && !paint.full);
  assert.equal((await library()).items.length,seeded.items.length);
  await page.evaluate(() => modify(() => { sheet.groups[0].name = 'SƠN TƯỜNG'; }));
  await page.locator('[data-row=g1-r1] [data-slot="0"]').click();
  await page.locator('[data-paint-code="30YY 72/107"]').click();
  await page.waitForFunction(async id => (await fetch('/api/library').then(r => r.json())).items.find(item => item.id === id)?.used === 1,paint.id);
  await page.request.post('/api/library/items/delete',{data:{ids:[paint.id]}});
  assert.ok(!(await library()).items.some(item => item.id === paint.id));
  assert.ok(!(await library()).items.some(item => item.kind === 'paint' && item.code === paint.code && item.brand === paint.brand));
};

cases['19.3'] = async page => {
  await openMaterials(page);
  await page.evaluate(async () => {
    await GDHomeAssets.addItems('cat-6',[
      {name:'Gạch 60x60',brand:'Hãng A',tags:['mờ'],suppliers:['Kho A','Kho B'],full:'a'.repeat(64)+'.webp',thumb:'a'.repeat(64)+'.webp'},
      {name:'Gạch 30x60',brand:'Hãng A',tags:['bóng'],suppliers:['Kho B'],full:'b'.repeat(64)+'.webp',thumb:'b'.repeat(64)+'.webp'}
    ]);
    GDHomeAssets.openLibrary({categoryId:'cat-6'});
  });
  const dialog = page.locator('.asset-library-dialog');
  await dialog.getByRole('button',{name:'600×600 (1)'}).click();
  await dialog.getByRole('button',{name:'Kho A (1)'}).click();
  assert.equal(await dialog.locator('.asset-card').count(),1);
  assert.match(await dialog.locator('.asset-card').textContent(),/600×600.*Hãng A/s);
};

cases['19.4'] = async page => {
  await openMaterials(page);
  await page.route('**/api/materials/assets/*',route => route.fulfill({status:404}));
  const ids = await page.evaluate(async () => {
    const {added} = await GDHomeAssets.addItems('cat-6',['a','b','c'].map(letter => ({
      name:letter,full:letter.repeat(64)+'.webp',thumb:letter.repeat(64)+'.webp'
    })));
    GDHomeAssets.openLibrary({categoryId:'cat-6'});
    return added.map(item => item.id);
  });
  const dialog = page.locator('.asset-library-dialog');
  await dialog.locator('[data-bulk-select]').first().click();
  await dialog.locator('[data-bulk-select]').last().click({modifiers:['Shift']});
  assert.equal(await dialog.locator('[data-bulk-select]:checked').count(),3);
  page.once('dialog',prompt => prompt.accept('mờ'));
  await dialog.locator('[data-bulk=addTags]').click();
  await dialog.locator('[data-facet=tags][data-value="mờ"]').waitFor();
  const read = () => page.request.get('/api/library').then(r => r.json()).then(data => data.items.filter(item => ids.includes(item.id)));
  assert.ok((await read()).every(item => item.tags.includes('mờ')));
  await dialog.locator('[data-bulk=undo]').click();
  await dialog.locator('[data-facet=tags][data-value="mờ"]').waitFor({state:'detached'});
  assert.ok((await read()).every(item => !item.tags.includes('mờ')));
};

cases['19.7'] = async page => {
  let saved;
  await page.route('**/api/integrations/settings',route => {
    if (route.request().method() === 'POST') saved = route.request().postDataJSON().notionCustomerMap;
    return route.fulfill({json:{ai:{},notion:{},providers:[],notionCustomerDb:'Mẫu'}});
  });
  await page.route('**/api/notion/customers?preview=1',route => route.fulfill({json:{
    columns:[{name:'Cột lạ',type:'place'}],map:{},items:['Phố A','Phố B','Phố C'].map(value => ({values:{'Cột lạ':value}}))
  }}));
  await page.goto('/');
  await page.evaluate(() => GDHomeConnections.open('notion-profile'));
  const form = page.locator('[data-profile-map-form]');
  await form.locator('[name=address]').selectOption('Cột lạ');
  await form.getByText('Phố A · Phố B · Phố C').waitFor();
  await form.getByRole('button',{name:'Lưu ánh xạ'}).click();
  await page.getByText('Đã lưu ánh xạ hồ sơ.').waitFor();
  assert.equal(saved.address,'Cột lạ');
};

cases['19.6'] = async page => {
  await page.route('**/api/catalogue/web',route => {
    assert.deepEqual(route.request().postDataJSON().urls,['https://example.com/gach']);
    return route.fulfill({json:{items:[{name:'Gạch mẫu',code:'G-19',size:'60x60',brand:'Hãng mẫu',supplier:'example.com',
      image:'https://example.com/gach.png'}]}});
  });
  await page.route('**/api/catalogue/image',route => {
    assert.equal(route.request().postDataJSON().url,'https://example.com/gach.png');
    return route.fulfill({contentType:'image/png',body:Buffer.from(imageFixture,'base64')});
  });
  await openMaterials(page);
  await page.evaluate(() => GDHomeAssets.openLibrary({categoryId:'cat-6'}));
  await page.locator('[data-import-wood]').click();
  const modal = page.locator('.wood-catalogue-dialog');
  await modal.getByRole('tab',{name:'Từ link website'}).click();
  await modal.locator('[name=urls]').fill('https://example.com/gach');
  await modal.getByRole('button',{name:'Đọc website'}).click();
  const card = modal.locator('.wood-catalogue-card');
  await card.waitFor();
  assert.equal(await card.locator('[data-catalogue-supplier]').inputValue(),'example.com');
  await card.locator('[data-catalogue-supplier]').fill('Kho gạch');
  await modal.locator('[data-save-wood]').click();
  await modal.getByText('Đã lưu 1 mã · bỏ qua 0 mã trùng.').waitFor();
  const library = await page.request.get('/api/library').then(r => r.json());
  const item = library.items.find(item => item.code === 'G-19');
  assert.equal(item.categoryId,'cat-6');
  assert.equal(item.size,'600x600');
  assert.deepEqual(item.suppliers,['Kho gạch']);
};

cases['19.11'] = async page => {
  await openMaterials(page);
  await page.evaluate(() => GDHomeAssets.openLibrary({categoryId:'cat-6'}));
  await page.locator('[data-folder-input]').evaluate((input,base64) => {
    const file = new File([Uint8Array.from(atob(base64),c => c.charCodeAt(0))],'Mẫu.png',{type:'image/png'});
    Object.defineProperty(file,'webkitRelativePath',{value:'SÀN/LOẠI 1 - AMBON FLOOR/Mẫu.png'});
    Object.defineProperty(input,'files',{value:[file]});
    input.dispatchEvent(new Event('change'));
  },imageFixture);
  const review = page.locator('.asset-folder-dialog');
  assert.equal(await review.getByLabel('Tag thư mục').inputValue(),'Sàn, Loại 1, Ambon Floor');
  await review.locator('[data-folder-save]').click();
  await review.getByText(/Hoàn tất/).waitFor();
  const data = await page.request.get('/api/library').then(r => r.json());
  assert.deepEqual(data.items.find(item => item.name === 'Mẫu').tags,['Sàn','Loại 1','Ambon Floor']);
};

async function drawAnCuongTile(pdf,sheet,x,y,code) {
  const {rgb} = require('pdf-lib');
  const qr = await pdf.embedPng(await require('qrcode').toBuffer('GDHOME-' + code,{margin:0,scale:6}));
  sheet.drawRectangle({x:x+5,y:y+67,width:139,height:213,color:rgb(.65,.48,.32)});
  sheet.drawText('MFC-MS ' + code + ' SC01',{x:x+5,y:y+43,size:10});
  sheet.drawText('SONOMA OAK',{x:x+5,y:y+24,size:9});
  sheet.drawImage(qr,{x:x+104,y:y+5,width:40,height:40});
}

async function openAnCuongReview(page,pdf) {
  if (process.env.PDFJS_TEST_DIR) await page.route('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/**',route =>
    route.fulfill({path:path.join(process.env.PDFJS_TEST_DIR,new URL(route.request().url()).pathname.split('/').at(-1)),
      contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}}));
  await openMaterials(page);
  await page.evaluate(() => GDHomeAssets.openLibrary({categoryId:'ancuong-wood'}));
  await page.locator('[data-import-wood]').click();
  const modal = page.locator('.wood-catalogue-dialog');
  await modal.locator('[name=layout]').selectOption('ancuong');
  await modal.locator('[name=collection]').fill('An Cường mẫu');
  await modal.locator('[name=useAi]').check();
  await modal.locator('[name=pdf]').setInputFiles({name:'demo.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await modal.getByRole('button',{name:'Đọc PDF'}).click();
  await page.waitForFunction(() => !document.querySelector('.wood-catalogue-dialog [type=submit]').disabled);
  return modal;
}

function anCuongCropContainsCard(canvas) {
  const {width,height} = canvas;
  const ctx = canvas.getContext('2d');
  const [red] = ctx.getImageData(Math.floor(width/2),Math.floor(height/3),1,1).data;
  const countDark = (left,top,w,h) => {
    const pixels = ctx.getImageData(left,top,w,h).data;
    return pixels.filter((value,i) => i%4 === 0 && value < 85).length;
  };
  return red > 100 && red < 210 &&
    countDark(0,Math.floor(height*.80),Math.floor(width*.66),Math.floor(height*.16)) > width*.15 &&
    countDark(Math.floor(width*.72),Math.floor(height*.83),Math.floor(width*.27),Math.floor(height*.16)) > width;
}

cases['19.8'] = async page => {
  const pdf = await require('pdf-lib').PDFDocument.create();
  await drawAnCuongTile(pdf,pdf.addPage([150,287]),0,0,461);
  const modal = await openAnCuongReview(page,pdf);
  const card = modal.locator('.wood-catalogue-card');
  await card.waitFor({timeout:15000});
  assert.equal(await card.locator('[data-wood-code-input]').inputValue(),'MS 461');
  assert.equal(await card.locator('[data-wood-name-input]').inputValue(),'SONOMA OAK');
  assert.equal(await modal.locator('[data-catalogue-field=finish]').inputValue(),'SC01');
  assert.equal(await modal.locator('[data-catalogue-field=material]').inputValue(),'MFC');
  await page.waitForFunction(() => !document.querySelector('[data-save-wood]').disabled);
  assert.ok(await card.locator('canvas').evaluate(anCuongCropContainsCard),'Khung gồm ô vân, dòng mã và QR');
};

cases['20.1'] = async page => {
  const pdf = await require('pdf-lib').PDFDocument.create();
  const certificate = pdf.addPage([450,861]);
  certificate.drawText('ISO 9001 / SA 8000',{x:40,y:700,size:30});
  certificate.drawText('MFC-MS 777 SC01',{x:40,y:200,size:12});
  const sheet = pdf.addPage([450,861]);
  for (let i=0; i<9; i++) await drawAnCuongTile(pdf,sheet,(i%3)*150,Math.floor(i/3)*287,461+i);
  await page.addInitScript(() => { Object.defineProperty(window,'BarcodeDetector',{value:undefined}); });
  let calls = 0;
  await page.route('**/api/ai/jobs/start',route => {
    calls++;
    return route.abort();
  });
  const modal = await openAnCuongReview(page,pdf);
  const cards = modal.locator('.wood-catalogue-card');
  assert.equal(await cards.count(),9,await modal.locator('[role=status]').innerText());
  assert.deepEqual((await cards.locator('[data-wood-code-input]').evaluateAll(inputs => inputs.map(input => input.value))).sort(),
    Array.from({length:9},(_,i) => 'MS ' + (461+i)));
  assert.equal(calls,0,'Không gọi AI cho trang chứng chỉ hoặc trang có lớp văn bản');
  assert.equal(await cards.locator('[data-wood-include]:checked').count(),9);
  for (const canvas of await cards.locator('canvas').all()) assert.ok(await canvas.evaluate(anCuongCropContainsCard));
  await modal.locator('[data-save-wood]').click();
  await modal.getByText(/Đã lưu 9 mã/).waitFor();
  const data = await page.request.get('/api/library').then(r => r.json());
  const saved = data.items.find(item => item.code === 'MS 461' && item.full);
  assert.ok(saved?.view?.y < .45,'Vùng nhìn mặc định đặt vào ô vân');
};

cases['20.5'] = async page => {
  await page.setViewportSize({width:1440,height:900});
  const pdf = await require('pdf-lib').PDFDocument.create();
  const sheet = pdf.addPage([450,861]);
  for (let i=0; i<9; i++) await drawAnCuongTile(pdf,sheet,(i%3)*150,Math.floor(i/3)*287,800+i);
  const modal = await openAnCuongReview(page,pdf);
  const cards = modal.locator('.wood-catalogue-card');
  assert.equal(await cards.count(),9);
  await modal.locator('[data-catalogue-select=clear]').click();
  await cards.first().scrollIntoViewIfNeeded();
  const a = await cards.first().locator('canvas').boundingBox();
  const c = await cards.nth(2).locator('canvas').boundingBox();
  const f = await cards.nth(5).locator('canvas').boundingBox();
  assert.equal(a.y,f.y,'Ít nhất 6 thẻ cùng hàng');
  assert.ok((await cards.first().boundingBox()).height <= 122);
  async function marquee(from,to) {
    await page.mouse.move(from.x+18,from.y+30);
    await page.mouse.down();
    await page.mouse.move(to.x+42,to.y+58,{steps:5});
    await page.mouse.up();
  }
  await marquee(a,c);
  assert.equal(await modal.locator('[data-catalogue-count]').textContent(),'Đã chọn 3/9');
  await page.keyboard.down('Alt');
  await marquee(a,a);
  await page.keyboard.up('Alt');
  assert.equal(await modal.locator('[data-catalogue-count]').textContent(),'Đã chọn 2/9');
  await modal.locator('[data-catalogue-filter]').selectOption('selected');
  assert.equal(await modal.locator('.wood-catalogue-card:visible').count(),2);
  await modal.locator('[data-catalogue-filter]').selectOption('all');
  await cards.first().focus();
  await page.keyboard.press('Control+a');
  assert.equal(await modal.locator('[data-catalogue-count]').textContent(),'Đã chọn 9/9');
  await modal.locator('[data-batch-collection]').fill('Dòng vân mới');
  await modal.locator('[data-catalogue-assign]').click();
  await cards.first().locator('[data-show-catalogue-detail]').click();
  assert.equal(await modal.locator('[data-catalogue-field=collection]').inputValue(),'Dòng vân mới');
  await cards.first().locator('canvas').dblclick({position:{x:35,y:40}});
  const preview = page.locator('.asset-view-dialog');
  await preview.waitFor();
  await page.keyboard.press('ArrowRight');
  await preview.locator('[data-view=previous]:enabled').waitFor();
  await page.keyboard.press('Escape');
  await preview.waitFor({state:'detached'});
};

cases['20.2'] = async page => {
  const pdf = await require('pdf-lib').PDFDocument.create();
  const sheet = pdf.addPage([300,287]);
  await drawAnCuongTile(pdf,sheet,0,0,8761);
  await drawAnCuongTile(pdf,sheet,150,0,8762);
  const modal = await openAnCuongReview(page,pdf);
  await modal.locator('[name=category]').selectOption('cat-1');
  await page.evaluate(() => {
    window.libraryChanges = 0;
    document.addEventListener('gdhome:library-changed',() => window.libraryChanges++);
  });
  await modal.locator('[data-save-wood]').click();
  await modal.getByText(/Đã lưu 2 mã/).waitFor();
  assert.ok(await page.evaluate(() => window.libraryChanges > 0));
  await modal.locator('.close-dialog').click();
  await page.locator('.asset-library-dialog .close-dialog').click();
  await page.evaluate(() => modify(() => { sheet.groups[0].name = 'MÃ GỖ'; }));
  await page.locator('[data-row=g1-r1] .image-cell[data-slot="0"]').click();
  const picker = page.locator('.asset-popover');
  await picker.locator('input[type=search]').fill('876');
  for (const code of ['MS 8761','MS 8762']) {
    const sample = picker.locator('[data-wood-code="' + code + '"] img');
    await sample.waitFor();
    await page.waitForFunction(node => !!node.naturalWidth,await sample.elementHandle());
  }
};

cases['20.3'] = async page => {
  await openMaterials(page);
  const [a,b] = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'),{width:200,height:100});
    const ctx = canvas.getContext('2d'), items = [];
    for (const [i,color] of ['#bb5533','#2277aa'].entries()) {
      ctx.fillStyle = color;
      ctx.fillRect(0,0,200,100);
      const full = await GDHomeAssets.storeAsset(await new Promise(resolve => canvas.toBlob(resolve)));
      items.push({full,thumb:full,kind:'wood',code:'TEST205'+i,name:'Vân '+i,brand:'Hãng '+i,...(i ? {view:{x:.6,y:.5,z:1.2}} : {})});
    }
    modify(() => { sheet.groups[0].name = 'MÃ GỖ'; });
    return (await GDHomeAssets.addItems('cat-1',items)).added;
  });
  const cell = page.locator('[data-row=g1-r1] .image-cell[data-slot="0"]');
  async function pick(code) {
    await cell.locator('[data-action=cell-menu]').click();
    await page.getByRole('button',{name:'Chọn mã gỗ'}).click();
    const picker = page.locator('.asset-popover');
    await picker.locator('input[type=search]').fill(code);
    await picker.locator('[data-wood-code="' + code + '"]').click();
  }
  await pick(a.code);
  assert.equal(await cell.locator('.image-open img').getAttribute('data-asset'),a.thumb);
  await pick(b.code);
  assert.equal(await cell.locator('.image-open img').getAttribute('data-asset'),b.thumb);
  assert.equal(await page.locator('[data-row=g1-r1] [data-field=code]').first().inputValue(),b.code);
  await page.waitForFunction(async id => {
    const data = await fetch('/api/materials').then(r => r.json());
    return data.sheets[0].groups[0].rows[0].options[0].libraryItemId === id;
  },b.id);
  const current = await page.evaluate(() => sheet.groups[0].rows[0].options[0]);
  assert.deepEqual(current.images,[{full:b.full,thumb:b.thumb,view:b.view}]);
  assert.equal(current.brand,b.brand);
  assert.equal(current.color,b.name);
  assert.equal(current.imageSource,'library');
  await page.locator('#material-header-actions [data-action=undo]').click();
  assert.equal(await cell.locator('.image-open img').getAttribute('data-asset'),a.thumb);
  assert.equal(await page.locator('[data-row=g1-r1] [data-field=code]').first().inputValue(),a.code);
  await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'),{width:20,height:20});
    const blob = await new Promise(resolve => canvas.toBlob(resolve));
    await attachImages(sheet.groups[0].rows[0],'0',[new File([blob],'manual.png',{type:'image/png'})],true);
  });
  const manual = await page.evaluate(() => sheet.groups[0].rows[0].options[0]);
  assert.equal(manual.imageSource,'manual');
  assert.notEqual(manual.images[0].full,a.full);
  assert.equal(manual.images[1].full,a.full);
};

cases['19.9'] = async page => {
  await openMaterials(page);
  const {PDFDocument,rgb} = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([360,160]);
  sheet.drawRectangle({x:0,y:0,width:360,height:160,color:rgb(.1,.3,.55)});
  sheet.drawRectangle({x:12,y:34,width:275,height:90,color:rgb(.95,.95,.95)});
  sheet.drawText('30',{x:335,y:132,size:12,color:rgb(1,1,1)});
  sheet.drawText('120',{x:307,y:74,size:12,color:rgb(1,1,1)});
  sheet.drawText('KT1210',{x:135,y:8,size:14,color:rgb(1,1,1)});
  if (process.env.PDFJS_TEST_DIR) await page.route('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/**',route =>
    route.fulfill({path:path.join(process.env.PDFJS_TEST_DIR,new URL(route.request().url()).pathname.split('/').at(-1)),
      contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}}));
  await page.evaluate(() => GDHomeAssets.openLibrary({categoryId:'cat-4'}));
  await page.locator('[data-import-wood]').click();
  const modal = page.locator('.wood-catalogue-dialog');
  await modal.locator('[name=layout]').selectOption('phao');
  await modal.locator('[name=useAi]').uncheck();
  await modal.locator('[name=brand]').fill('Mẫu');
  await modal.locator('[name=collection]').fill('Phào');
  await modal.locator('[name=pdf]').setInputFiles({name:'phao.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await modal.getByRole('button',{name:'Đọc PDF'}).click();
  const card = modal.locator('.wood-catalogue-card');
  await card.waitFor({timeout:15000});
  assert.equal(await card.locator('[data-wood-code-input]').inputValue(),'KT1210');
  assert.equal(await modal.locator('[data-catalogue-field=size]').inputValue(),'30x120');
  assert.equal(await modal.locator('[name=display]').inputValue(),'pad');
  await modal.locator('[data-save-wood]').click();
  await modal.getByText(/Đã lưu 1 mã/).waitFor();
  const item = (await page.request.get('/api/library').then(r => r.json())).items.find(item => item.code === 'KT1210');
  assert.equal(item.size,'30x120');
  assert.equal(item.display,'pad');
  assert.ok(!item.square && !item.originalFull);
  await modal.locator('.close-dialog').click();
  const library = page.locator('.asset-library-dialog');
  const saved = library.locator('[data-asset-id="' + item.id + '"]');
  await saved.locator('summary').click();
  await saved.locator('[data-asset-display]').selectOption('fit');
  await page.waitForFunction(async id => (await fetch('/api/library').then(r => r.json())).items.find(item => item.id === id)?.display === 'fit',item.id);
  assert.equal((await page.request.get('/api/library').then(r => r.json())).items.find(entry => entry.id === item.id).full,item.full);
};

cases['20.7'] = async page => {
  await openMaterials(page);
  const result = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'),{width:2000,height:1000});
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#115588';
    ctx.fillRect(0,0,2000,1000);
    const file = new File([await new Promise(resolve => canvas.toBlob(resolve))],'test-pad.png',{type:'image/png'});
    const [item] = await GDHomeAssets.uploadToLibrary('cat-4',[file],() => {},'pad');
    const dimensions = await Promise.all([item.full,item.thumb].map(async name => {
      const bitmap = await createImageBitmap(await fetch(await GDHomeAssets.assetUrl(name)).then(r => r.blob()));
      return [bitmap.width,bitmap.height];
    }));
    const print = document.createElement('div');
    print.dataset.imageFit = 'fill';
    print.innerHTML = printImages([item],'/api/materials/assets/',true);
    document.body.append(print);
    const img = print.querySelector('img');
    img.src = await GDHomeAssets.assetUrl(item.full);
    await decodeMaterialThumbnail(img);
    return {dimensions,display:img.dataset.display,fit:getComputedStyle(img).objectFit,pad:img.parentElement.style.getPropertyValue('--pad-color')};
  });
  assert.deepEqual(result.dimensions,[[1600,800],[480,240]]);
  assert.equal(result.display,'pad');
  assert.equal(result.fit,'contain');
  assert.ok(result.pad.startsWith('rgb('));
};

cases['20.8'] = async page => {
  await openMaterials(page);
  const items = await page.evaluate(async () => {
    const canvas = Object.assign(document.createElement('canvas'),{width:300,height:150});
    const ctx = canvas.getContext('2d');
    for (const [index,color] of ['#ad9966','#335577'].entries()) {
      ctx.fillStyle = color;
      ctx.fillRect(0,0,300,150);
      const blob = await new Promise(resolve => canvas.toBlob(resolve));
      await GDHomeAssets.uploadToLibrary('cat-4',[new File([blob],'Xem '+index+'.png',{type:'image/png'})]);
    }
    GDHomeAssets.openLibrary({categoryId:'cat-4'});
    return (await GDHomeAssets.loadLibrary()).items.filter(item => item.categoryId === 'cat-4');
  });
  const cards = page.locator('.asset-library-dialog .asset-card');
  await cards.first().locator('.asset-thumb').dblclick();
  const preview = page.locator('.asset-view-dialog');
  const stage = preview.locator('.asset-view-stage');
  await stage.waitFor();
  const box = await stage.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+54,box.y+box.height/2);
  await page.mouse.up();
  await page.keyboard.press('ArrowRight');
  await preview.getByRole('heading',{name:items[1].name}).waitFor();
  let data = await page.request.get('/api/library').then(r => r.json());
  assert.ok(data.items.find(item => item.id === items[0].id).view?.x < .48);
  await page.keyboard.press('F2');
  await preview.locator('[name=code]').fill('KT301');
  await preview.locator('[name=name]').fill('Mẫu đã đổi');
  await preview.locator('[name=name]').press('Enter');
  await preview.getByRole('heading',{name:'KT301 · Mẫu đã đổi'}).waitFor();
  await page.keyboard.press('Escape');
  await preview.waitFor({state:'detached'});
  await cards.first().locator('.asset-thumb').focus();
  await page.keyboard.press('F2');
  await cards.first().locator('[name=name]').fill('Huỷ thay đổi');
  await page.keyboard.press('Escape');
  assert.equal(await cards.first().locator('.asset-identity-editor').count(),0);
  data = await page.request.get('/api/library').then(r => r.json());
  assert.equal(data.items.find(item => item.id === items[0].id).name,items[0].name);
  assert.equal(data.items.find(item => item.id === items[1].id).code,'KT301');
};

cases['19.10'] = async page => {
  const {PDFDocument,rgb} = require('pdf-lib');
  const pdf = await PDFDocument.create();
  const sheet = pdf.addPage([400,500]);
  sheet.drawRectangle({x:10,y:155,width:380,height:330,color:rgb(.5,.65,.7)});
  sheet.drawText('Ma dat hang    Quy cach    Kich thuoc tu    Don gia',{x:12,y:132,size:10});
  for (let i=0;i<3;i++) {
    const width = 700+i*100;
    sheet.drawText('GL06.'+(70+i*10)+'AG   R'+(width-36)+'*S265*C550   '+width+'   '+(width-36)+'   Bo   15.390.000',
      {x:12,y:104-i*25,size:10});
  }
  if (process.env.PDFJS_TEST_DIR) await page.route('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/**',route =>
    route.fulfill({path:path.join(process.env.PDFJS_TEST_DIR,new URL(route.request().url()).pathname.split('/').at(-1)),
      contentType:'application/javascript',headers:{'access-control-allow-origin':'*'}}));
  await openMaterials(page);
  await page.evaluate(() => GDHomeAssets.openLibrary({categoryId:'kitchen-accessories'}));
  await page.locator('[data-import-wood]').click();
  const modal = page.locator('.wood-catalogue-dialog');
  await modal.locator('[name=useAi]').uncheck();
  await modal.locator('[name=brand]').fill('Garis');
  await modal.locator('[name=collection]').fill('Mẫu bếp');
  await modal.locator('[name=pdf]').setInputFiles({name:'bep.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});
  await modal.getByRole('button',{name:'Đọc PDF'}).click();
  const cards = modal.locator('.wood-catalogue-card');
  await cards.last().waitFor({timeout:15000});
  assert.equal(await cards.count(),3);
  await cards.first().locator('[data-show-catalogue-detail]').click();
  assert.equal(await modal.locator('[data-catalogue-field=spec]').inputValue(),'R664*S265*C550');
  assert.equal(await modal.locator('[data-catalogue-field=cabinetWidth]').inputValue(),'700');
  await modal.locator('[data-save-wood]').click();
  await modal.getByText(/Đã lưu 3 mã/).waitFor();
  const library = await page.request.get('/api/library').then(r => r.json());
  const items = library.items.filter(item => item.categoryId === 'kitchen-accessories');
  assert.equal(items.length,3);
  assert.equal(new Set(items.map(item => item.full)).size,1);
  const item = items.find(item => item.code === 'GL06.70AG');
  assert.equal(item.price,15390000);
  assert.equal(item.innerWidth,664);
  assert.ok(item.tags.includes('Tủ 700'));
};

async function main() {
  const dir = await mkdtemp(path.join(os.tmpdir(),'gdhome-gd8-'));
  Object.assign(process.env,{ DATA_DIR:dir,GIST_TOKEN:'',GOOGLE_CLIENT_ID:'',APP_PASSWORD:'',R2_ACCOUNT_ID:'' });
  const { server,initStore,getStore } = require('../server');
  const { MaterialStore } = require('../materials');
  const {libraryKey,defaultLibrary} = require('../shared-library');
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
      const caseSchedule = structuredClone(schedule);
      if (['13.3','17.2'].includes(key)) caseSchedule.projectOwners.push({id:'gd13-other',name:'Dự án thứ hai'});
      if (key === '17.2') {
        caseSchedule.calendars.push({id:'other-cal',ownerId:'gd13-other',name:'Khác',visible:true,color:'#a00'});
        caseSchedule.tasks.push({id:'gd17-task',calendarId:'c1',title:'Việc mẫu',startDate:'2026-11-02',endDate:'2026-11-03'});
      }
      await getStore().put('shared',caseSchedule);
      await getStore().put(libraryKey('shared'),defaultLibrary());
      await repository.update(undefined,data => { data.sheets = [structuredClone(fixture)]; data.viewSettings = {}; return {}; });
      const page = await browser.newPage({ baseURL:'http://127.0.0.1:'+server.address().port,viewport:{width:1050,height:720},acceptDownloads:false });
      page.setDefaultTimeout(4000);
      const pageErrors = [];
      page.on('pageerror',error => pageErrors.push(error.message));
      try {
        await cases[key](page);
        assert.deepEqual(pageErrors,[],'Lỗi JavaScript trên trang');
        console.log(key+' đạt');
      }
      catch (error) {
        console.error(key+' lỗi',error);
        process.exitCode = 1;
      } finally { await page.close(); }
    }
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await rm(dir,{ recursive:true,force:true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
