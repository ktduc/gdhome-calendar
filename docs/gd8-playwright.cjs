// node docs/gd8-playwright.cjs [8.1 ... 9.6]
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
  await cell.locator('.image-plus').click();
  assert.equal(await pasteFixture(page,'items'),true,'paste vào ô đã focus');
  await cell.locator('img').waitFor().catch(async error => { throw new Error((await page.locator('#notice').textContent()) || error.message); });
  await pasteFixture(page,'html');
  await cell.locator('.image-count').getByText('+1',{exact:true}).waitFor();

  const view = page.locator('[data-row="g1-r2"] [data-slot="render"]');
  await page.locator('header.app-header .app-logo').focus();
  await view.hover();
  await pasteFixture(page,'items');
  await view.locator('img').waitFor();

  const fallback = page.locator('[data-row="g1-r3"] [data-slot="render"]');
  await fallback.locator('.image-plus').click();
  await page.evaluate(base64 => {
    const blob = new Blob([Uint8Array.from(atob(base64),c => c.charCodeAt(0))],{type:'image/png'});
    Object.defineProperty(navigator.clipboard,'read',{configurable:true,value:async () => [
      {types:['image/png'],getType:async () => blob}
    ]});
  },imageFixture);
  await pasteFixture(page,'fallback');
  await fallback.locator('img').waitFor();
  await pasteFixture(page,'url');
  await fallback.locator('.image-count').getByText('+1',{exact:true}).waitFor();

  const code = cell.locator('input[data-field="code"]');
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
    const code = document.querySelector('tr[data-row] input[data-field=code]');
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
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  const measure = () => page.locator('#print-sheet').evaluate(root => {
    const images = [...root.querySelectorAll('.print-square img')];
    const bounds = node => {
      const {top,width,height} = node.getBoundingClientRect();
      return {top,width,height};
    };
    return { slots:images.map(img => bounds(img.parentElement)),images:images.map(bounds),
      originals:images.map(img => img.naturalWidth/img.naturalHeight),logo:bounds(root.querySelector('.print-heading img')).width };
  });
  function verifyFit(metrics) {
    assert.equal(metrics.slots.length,2);
    assert.deepEqual(metrics.slots[0],metrics.slots[1]);
    assert.equal(metrics.slots[0].width,metrics.slots[0].height);
    assert.deepEqual(metrics.images[0],metrics.images[1]);
    metrics.images.forEach((img,i) => assert.ok(Math.abs(img.width/img.height-metrics.originals[i]) < 0.01));
  }
  const desktop = await measure();
  verifyFit(desktop);
  assert.ok(desktop.logo >= 120*1.8);
  assert.equal(await page.locator('.print-qty').textContent(),'141,90 m²');
  assert.equal(await page.locator('.print-option-caption').textContent(),'TEST-01');
  await page.evaluate(() => {
    window.downloadCanvas = canvas => {
      const root = document.querySelector('#print-sheet').getBoundingClientRect();
      const slot = document.querySelector('.print-square').getBoundingClientRect();
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
  assert.ok(print.logo >= 120*1.8);
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
  assert.deepEqual(await page.locator('.print-option-caption').allTextContents(),['PA2 ','PA1 TEST-01']);
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
  const images = await row.locator('.image-open img').evaluateAll(nodes => nodes.map(node => {
    const {top,width,height} = node.getBoundingClientRect();
    return {top,width,height,fit:getComputedStyle(node).objectFit};
  }));
  assert.equal(images.length,2);
  assert.deepEqual(images[0],images[1]);
  assert.equal(images[0].width,images[0].height);
  assert.equal(images[0].fit,'contain');
  const groupColor = await page.locator('.sheet-grid .group th').first().evaluate(el => getComputedStyle(el).backgroundColor);
  const form = await openImageScope(page);
  await form.getByRole('button',{name:'Xem trước'}).click();
  await page.locator('#stats-copy').waitFor();
  assert.deepEqual(await page.locator('#print-sheet thead th').allTextContents(),headers);
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
  await lightbox.getByRole('button',{name:'Cắt ảnh'}).click();
  await page.locator('.crop-dialog').getByRole('button',{name:'Lưu ảnh cắt'}).click();
  await page.locator('.crop-dialog').waitFor({state:'detached'});
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
  const note = newRow.locator('input[data-field="note"]');
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
  const expected = 'So khớp mẫu dưới ánh sáng tự nhiên; Sơn 2 nước phủ; Sơn mẫu tại phòng khách';
  assert.equal(await note.inputValue(),expected);
  await page.waitForFunction(() => document.querySelector('#save-label').textContent === 'Đã lưu');
  await openMaterials(page);
  assert.equal(await note.inputValue(),expected);
};

async function openImageScope(page) {
  await page.locator('#material-copy').click();
  const form = page.locator('#material-image-scope');
  await form.waitFor();
  return form;
}

async function addFixtureImage(page,slot) {
  const cell = page.locator('[data-row="g1-r1"] [data-slot="' + slot + '"]');
  const previous = await cell.locator('.image-count').count() ? Number(await cell.locator('.image-count').textContent())+1 :
    await cell.locator('img').count();
  await cell.focus();
  assert.equal(await pasteFixture(page,'items'),true);
  if (previous) await cell.locator('.image-count').getByText('+' + previous,{exact:true}).waitFor();
  else await cell.locator('img[src]').waitFor();
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

function viewPosition(page) {
  return page.locator('.sheet-scroll').evaluate(el => ({top:el.scrollTop,left:el.scrollLeft,page:window.scrollY}));
}
async function openMaterials(page) {
  await page.goto('/chot-ma');
  const listButton = page.getByRole('button',{name:'Bảng mẫu GĐ8',exact:true});
  const firstRow = page.locator('[data-row="g1-r1"]');
  await listButton.or(firstRow).first().waitFor();
  if (await listButton.isVisible()) await listButton.click();
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
      await getStore().put('shared',structuredClone(schedule));
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
      finally { await page.close(); }
    }
  } finally {
    if (browser) await browser.close();
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await rm(dir,{ recursive:true,force:true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
