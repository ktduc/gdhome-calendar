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
<table><tr><td>Mã sản phẩm</td><td>Quy cách</td><td>K&iacute;ch thước tủ ti&ecirc;u chuẩn (mm)</td><td>Khoảng hở</td><td>Lọt lòng</td><td>Đơn vị</td><td>Đơn giá</td></tr>
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

// Các kiểu bảng chép từ garis.vn thật (11/11/2026): số cột thay đổi, tiêu đề tách bảng riêng, ô gộp, dấu viết bằng &...;
const product = (name,tables) => `<html><body><h1>${name}</h1><img src="/uploaded/anh.jpg">${tables}</body></html>`;
const one = async html => (await importGaris('https://garis.vn/sp.html',async url => ({url,buffer:Buffer.from(html)}),validate,500)).items;

test('GĐ24i Garis: đọc bảng theo tên cột – bảng 5 cột không còn lệch đơn vị/giá, dấu được giải mã', async () => {
  const items = await one(product('Khay chia GTP3',`<table><tr><td>M&atilde; sản phẩm</td><td>Quy c&aacute;ch Rộng x S&acirc;u x Cao (mm)</td><td>K&iacute;ch thước ngăn k&eacute;o ti&ecirc;u chuẩn (mm)</td><td>Đơn vị</td><td>Đơn gi&aacute; (VN&ETH;)</td></tr></table>
    <table><tr><td>GTP39</td><td>R830* S485* C55</td><td>900</td><td>C&aacute;i</td><td>1.065.000</td></tr>
    <tr><td>GTP36</td><td>R530* S485* C55</td><td>600</td><td>C&aacute;i</td><td>Li&ecirc;n hệ</td></tr></table>
    <table><tr><td>&nbsp;Thương hiệu</td><td>&nbsp;Garis</td></tr><tr><td>Bảo h&agrave;nh</td><td>24 th&aacute;ng</td></tr></table>`));
  assert.deepEqual(items.map(item => item.code),['GTP39','GTP36']);
  const [a,b] = items;
  assert.equal(a.spec,'R830*S485*C55');
  assert.equal(a.unit,'Cái');
  assert.equal(a.price,1065000);
  assert.equal(a.priceUnit,'Cái');
  assert.equal(a.clearance,'');
  assert.equal(a.innerWidth,'');
  assert.equal(a.note,'Kích thước ngăn kéo tiêu chuẩn: 900');
  assert.equal(b.price,undefined);
});

test('GĐ24i Garis: mã có dấu cách / gạch chéo giữ nguyên vẹn, quy cách không theo mẫu R*S*C vẫn lấy', async () => {
  const head = '<table><tr><td>M&atilde; sản phẩm</td><td>Quy c&aacute;ch (mm)</td><td>Đơn vị</td><td>Đơn gi&aacute; (VNĐ)</td></tr></table>';
  const items = await one(product('Giá bát đĩa GD04C',head + `<table><tr><td>GD04. 60C</td><td>R564* S462* C190</td><td>Bộ</td><td>-</td></tr>
    <tr><td>GD04. 70C</td><td>R664* S462* C190</td><td>Bộ</td><td>-</td></tr>
    <tr><td>GCB245L/R</td><td>R(860-1060)* S510* C560</td><td>Bộ</td><td>&nbsp;</td></tr>
    <tr><td>GRAL662 GRAR662</td><td>B&aacute;nh xe c&aacute;nh l&ugrave;a</td><td>C&aacute;i</td><td>741.000</td></tr>
    <tr><td>GH3</td><td>Bản lề g&oacute;c nối 2 c&aacute;nh</td><td>C&aacute;i</td><td>61.700</td></tr></table>`));
  assert.deepEqual(items.map(item => item.code),['GD04.60C','GD04.70C','GCB245L/R','GRAL662/GRAR662','GH3']);
  assert.equal(items[2].spec,'R(860-1060)*S510*C560');
  assert.equal(items[3].price,741000);
  assert.equal(items[4].spec,'Bản lề góc nối 2 cánh');
  assert.equal(items[4].price,61700);
});

test('GĐ24i Garis: ô gộp – bộ nhiều món là 1 mã với giá dòng Tổng; đơn vị gộp áp cho mọi dòng', async () => {
  const set = await one(product('Tủ đồ khô GTG6B',`<table><tr><td>M&atilde; sản phẩm</td><td>T&ecirc;n sản phẩm</td><td>M&ocirc; tả sản phẩm</td><td>Đơn vị</td><td>Đơn gi&aacute; (VN&ETH;)</td></tr></table>
    <table><tr><td rowspan="3">GTG6B</td><td rowspan="3">Ray hộp Gigabox</td><td>2 ray hộp (m&atilde; lẻ GTG125)</td><td rowspan="3">Bộ</td><td>2.308.000</td></tr>
    <tr><td>Mặt ngăn k&eacute;o (m&atilde; lẻ GTG51)</td><td>864.000</td></tr><tr><td>Thanh n&acirc;ng cấp (m&atilde; lẻ GTG61)</td><td>370.000</td></tr>
    <tr><td colspan="4">Tổng</td><td>3.542.000</td></tr></table>`));
  assert.equal(set.length,1);
  assert.equal(set[0].code,'GTG6B');
  assert.equal(set[0].name,'Ray hộp Gigabox');
  assert.equal(set[0].price,3542000);
  const bars = await one(product('Thanh treo GI01.8',`<table><tr><td>M&atilde; sản phẩm</td><td>Quy c&aacute;ch</td><td>Đơn vị</td><td>Đơn gi&aacute;</td></tr>
    <tr><td>GI01.8.60</td><td>D&agrave;i 600</td><td rowspan="2">thanh</td><td>57.000</td></tr><tr><td>GI01.8.90</td><td>D&agrave;i 900</td><td>75.000</td></tr></table>`));
  assert.deepEqual(bars.map(item => [item.code,item.unit,item.price]),[['GI01.8.60','thanh',57000],['GI01.8.90','thanh',75000]]);
});

test('GĐ24i Garis: bộ lọc Danh mục đủ mọi trang con dù có hơn 100 mã', async () => {
  const names = Array.from({length:9},(_,i) => 'Danh mục ' + (i+1));
  const bigMenu = `<ul class="product_li"><li><a href="/pk.html">Phụ kiện</a><ul>${names.map((name,i) => `<li><a href="/c${i}.html">${name}</a></li>`).join('')}</ul></li></ul>`;
  const site = {'https://garis.vn/pk.html':`<html><body>${bigMenu}</body></html>`};
  names.forEach((name,i) => {
    site[`https://garis.vn/c${i}.html`] = `<html><body>${bigMenu}${card(`/p${i}.html`)}</body></html>`;
    site[`https://garis.vn/p${i}.html`] = product('Sản phẩm ' + i,`<table><tr><td>Mã sản phẩm</td><td>Quy cách</td></tr>${Array.from({length:15},(_,n) => `<tr><td>GX${i}${String(n).padStart(2,'0')}</td><td>R${n}</td></tr>`).join('')}</table>`);
  });
  const result = await importGaris('https://garis.vn/pk.html',async url => ({url,buffer:Buffer.from(site[url])}),validate,1500);
  assert.equal(result.items.length,135);
  assert.equal(result.sourceFilterGroups.find(group => group.key === 'web-garis-danh-muc').values.length,9);
});

test('GĐ24 Garis: dán link trang con chỉ lấy đúng trang con đó', async () => {
  const result = await importGaris('https://garis.vn/tu-do-kho.html',load,validate,500);
  assert.deepEqual(result.items.map(item => item.code),['MS660GA']);
});
