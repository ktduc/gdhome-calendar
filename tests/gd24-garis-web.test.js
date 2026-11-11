const { test } = require('node:test');
const assert = require('node:assert/strict');
const { importGaris } = require('../catalogue-web');

// Trang giả chỉ chép CẤU TRÚC của garis.vn (menu danh mục, thẻ .product-item, trang chi tiết có bảng mã).
const menu = `<div class="menuproduct"><ul class="product_li">
  <li><img src="/uploaded/san-pham/layer%2032.png"> <a href="/phu-kien-tu-bep.html">Phụ kiện tủ bếp</a>
    <ul class="megaproduct-li"><li><a href="/tu-bep-tren.html">Tủ bếp trên</a></li><li><a href="/tu-do-kho.html">Tủ đồ khô</a></li></ul></li>
  <li><img src="/uploaded/san-pham/layer%2033.png"> <a href="/phu-kien-tu-ao.html">Phụ kiện tủ áo</a>
    <ul class="megaproduct-li"><li><a href="/gia-treo.html">Giá treo</a></li></ul></li>
</ul></div>`;
const card = href => `<div class="product-item"><div class="product-image"><a href="${href}"><img src="/temp/x_cr_384x384.jpg"></a></div></div>`;
const detail = (name,codes) => `<html><head><script type="application/ld+json">{"@type":"Product","name":"${name}","image":"https://garis.vn/temp/-uploaded_${codes[0]}_cr_1080x1080.jpg"}</script></head>
<body>${menu}<img src="/uploaded/logo/logo.png"><img src="/uploaded/ico/zalo.png"><h1>${name}</h1><img src="/uploaded/${codes[0]}-2.jpg">
<table><tr><td>Mã sản phẩm</td><td>Quy cách</td><td>Tủ</td><td>Khoảng hở</td><td>Lọt lòng</td><td>Đơn vị</td><td>Đơn giá</td></tr>
${codes.map((code,i) => `<tr><td>${code}</td><td>R${664+i*100}*S287*C702</td><td>${700+i*100}</td><td>${664+i*100}*290</td><td>${664+i*100}</td><td>Bộ</td><td>${i ? '3,934,000 đ' : 'Liên hệ'}</td></tr>`).join('')}
</table></body></html>`;
const pages = {
  'https://garis.vn/phu-kien-tu-bep.html': `<html><body>${menu}${card('/sp-a.html')}<a href="/tu-bep-tren.html">Xem tất cả</a></body></html>`,
  'https://garis.vn/tu-bep-tren.html': `<html><body>${menu}${card('/sp-a.html')}${card('/sp-b.html')}<a href="/tu-bep-tren.html?page=2">2</a></body></html>`,
  'https://garis.vn/tu-bep-tren.html?page=2': `<html><body>${menu}${card('/sp-c.html')}</body></html>`,
  'https://garis.vn/tu-do-kho.html': `<html><body>${menu}${card('/sp-d.html')}</body></html>`,
  'https://garis.vn/sp-a.html': detail('Giá gia vị nâng hạ A',['GLAT57','GLAT58','GLAT59']),
  'https://garis.vn/sp-b.html': detail('Giá bát đĩa B',['GLSE67','GLSE68']),
  'https://garis.vn/sp-c.html': detail('Giá trang 2 C',['GLC70']),
  'https://garis.vn/sp-d.html': detail('Tủ đồ khô D',['MS660GA']),
};
const load = async url => { const html = pages[url]; if (!html) throw Object.assign(new Error('404 ' + url),{status:404}); return {url,buffer:Buffer.from(html)}; };
const validate = url => new URL(url);

test('GĐ24 Garis: đi hết trang con + phân trang, mỗi dòng bảng là 1 mã, phân loại theo menu web', async () => {
  const result = await importGaris('https://garis.vn/phu-kien-tu-bep.html',load,validate,500);
  const codes = result.items.map(item => item.code).sort();
  assert.deepEqual(codes,['GLAT57','GLAT58','GLAT59','GLC70','GLSE67','GLSE68','MS660GA']);
  assert.deepEqual(result.crawled,{categories:2,products:4});
  const a = result.items.find(item => item.code === 'GLAT58');
  assert.equal(a.lineName,'Giá gia vị nâng hạ A');
  assert.equal(a.spec,'R764*S287*C702');
  assert.equal(a.cabinetWidth,'800');
  assert.equal(a.price,3934000);
  assert.equal(a.brand,'Garis');
  assert.equal(a.subgroup,'Tủ bếp trên');
  assert.equal(a.image,'https://garis.vn/uploaded/GLAT57.jpg');
  assert.ok(a.imageAlternates.every(url => !/logo|\/ico\//.test(url)));
  assert.equal(result.items.find(item => item.code === 'GLAT57').price,undefined);
  assert.equal(result.items.find(item => item.code === 'MS660GA').subgroup,'Tủ đồ khô');
  assert.deepEqual(result.sourceFilterGroups.find(group => group.key === 'web-garis-danh-muc').values.sort(),['Tủ bếp trên','Tủ đồ khô']);
  // Các mã cùng trang chi tiết dùng chung dòng sản phẩm (1 ảnh – nhiều mã).
  assert.equal(new Set(result.items.filter(item => item.lineName === 'Giá gia vị nâng hạ A').map(item => item.lineId)).size,1);
});

test('GĐ24 Garis: dán link trang con chỉ lấy đúng trang con đó', async () => {
  const result = await importGaris('https://garis.vn/tu-do-kho.html',load,validate,500);
  assert.deepEqual(result.items.map(item => item.code),['MS660GA']);
});
