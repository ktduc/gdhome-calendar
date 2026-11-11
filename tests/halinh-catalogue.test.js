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

test('Hà Linh giữ đầy đủ mã có khoảng trắng sau dấu gạch',async()=>{
  const html='<h1>Phào chỉ tường cao cấp PUNT- 161VG</h1><img src="/data/Product/punt-161vg_1761017235.jpg" alt="Phào PUNT- 161VG">'+
    '<img src="/data/PUNT-161VG.jpg" alt=""><img src="/data/PUNT-161.jpg" alt="">';
  const result=await importCatalogueUrls(['https://halinhjsc.vn/phao-chi/2516-punt-161vg.htm'],options(html));
  assert.equal(result.items[0].code,'PUNT-161VG');
  assert.deepEqual(result.items[0].imageAlternates,['https://halinhjsc.vn/data/PUNT-161VG.jpg']);
});

test('Hà Linh đọc hậu tố file làm lại và bỏ carousel sản phẩm ngoài danh mục',async()=>{
  const html='<div id="main"><div class="itemPr"><a href="/phao-chi/1.htm"><img src="/data/Product/pukt-41b.jpg" alt="Phào PUKT-41B"></a></div></div>'+
    '<div id="demo"><div class="itemPr"><img src="/other.jpg" alt="Ngoài danh mục PUNT-161"></div></div>';
  const listing=await importCatalogueUrls(['https://halinhjsc.vn/phao-chi-ha-linh/63.htm'],{...options(html),respectRobots:false});
  assert.deepEqual(listing.items.map(item=>item.code),['PUKT-41B']);
  const detail=await importCatalogueUrls(['https://halinhjsc.vn/phao-chi/1.htm'],options('<h1>Phào PUKT-41B</h1><img src="/data/Product/pukt-41b.jpg" alt="Phào PUKT-41B"><img src="/data/pukt-41b-lam-lai.gif">'));
  assert.deepEqual(detail.items[0].imageAlternates,['https://halinhjsc.vn/data/pukt-41b-lam-lai.gif']);
});

test('Vicostone đọc ảnh nền mặt tấm, mã và ảnh gốc thay cho ảnh đại diện trang',async()=>{
  const html='<meta property="og:image" content="/logo.svg">'+['BQ6984','BC3020','BS110'].map(code=>
    '<div class="section-products-item"><article class="card2-product"><div class="card2-product-front">'+
    '<div class="card-image-display" data-background-image="/-/media/'+code+'-fullslab.jpg?as=0&amp;h=260"></div></div>'+
    '<div class="card2-product-overlay"><div data-background-image="/-/media/'+code+'-room.jpg"></div></div>'+
    '<h4 class="card2-title">Tên đá '+code+'</h4></article></div>').join('');
  const result=await importCatalogueUrls(['https://vicostone.com/vi-vn/product'],options(html));
  assert.deepEqual(result.items.map(item=>item.code),['BQ6984','BC3020','BS110']);
  assert.equal(result.items[0].image,'https://vicostone.com/-/media/BQ6984-fullslab.jpg');
  assert.deepEqual(result.items[0].imageAlternates,['https://vicostone.com/-/media/BQ6984-fullslab.jpg?as=0&h=260']);
});
