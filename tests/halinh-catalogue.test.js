const {test} = require('node:test');
const assert = require('node:assert/strict');
const {importCatalogueUrls} = require('../catalogue-web');
const options = html => ({dnsResolver:async()=>[{address:'8.8.8.8'}],fetchFn:async url=>new Response(
  url.endsWith('/robots.txt') ? 'User-agent: *\nDisallow: /phao-chi-ha-linh/' : html,
  {headers:{'Content-Type':url.endsWith('/robots.txt') ? 'text/plain' : 'text/html'}})});

test('Link nhập chủ động đọc được trang công khai chặn robots, bộ tải mặc định vẫn giữ quy tắc',async()=>{
  const url='https://halinhjsc.vn/phao-chi-ha-linh/62-phao.htm';
  const html='<base href="https://halinhjsc.vn/"><div class="itemPr"><a href="phao-chi/1-pupt-112.htm"><img src="data/Product/pupt-112.jpg" alt="Phào PUPT-112"></a></div>';
  const blocked=await importCatalogueUrls([url],options(html));
  assert.match(blocked.warnings[0],/robots/);
  const result=await importCatalogueUrls([url],{...options(html),respectRobots:false});
  assert.equal(result.items.length,1);
  assert.equal(result.items[0].image,'https://halinhjsc.vn/data/Product/pupt-112.jpg');
  assert.equal(result.items[0].detail,'https://halinhjsc.vn/phao-chi/1-pupt-112.htm');
  const internal=await importCatalogueUrls(['http://127.0.0.1/private'],{respectRobots:false});
  assert.match(internal.warnings[0],/nội bộ/);
});

test('Hà Linh ghép ảnh cùng mã ở tên file, không nhập nhầm ảnh mã gần giống',async()=>{
  const html='<base href="https://halinhjsc.vn/"><h1>Phào trần PUPT-112</h1>'+
    '<img src="data/Product/pupt-112_1641442548.jpg" alt="Phào trần PUPT-112">'+
    '<img src="/data/PUPT-112(4).jpg" width="1741" height="928" alt="">'+
    '<img src="/data/PUPT-112A.jpg"><img src="/data/PUPT-1120.jpg">';
  const result=await importCatalogueUrls(['https://halinhjsc.vn/phao-chi/1-pupt-112.htm'],options(html));
  assert.equal(result.items.length,1);
  assert.deepEqual(result.items[0].imageAlternates,['https://halinhjsc.vn/data/PUPT-112(4).jpg']);
});

test('Ảnh HTML lặp cùng mã gom thành ứng viên, mã có hậu tố giữ riêng',async()=>{
  const html='<img src="/thumb.jpg" alt="Phào PUPT-112"><img src="/full.jpg" alt="Phào trần PUPT-112">'+
    '<img src="/other.jpg" alt="Phào PUPT-112A">';
  const result=await importCatalogueUrls(['https://catalogue.test/list'],options(html));
  assert.equal(result.items.length,2);
  assert.deepEqual(result.items[0].imageAlternates,['https://catalogue.test/full.jpg']);
  assert.equal(result.items[1].code,'PUPT-112A');
});
