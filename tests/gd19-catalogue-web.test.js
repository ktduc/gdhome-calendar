const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {importCatalogueUrls,cataloguePagination} = require('../catalogue-web');

test('Nhập catalogue lấy Product, og:image, ảnh lưới và tôn trọng robots.txt', async t => {
  const seen = [];
  const server = http.createServer((req,res) => {
    seen.push(req.url);
    if (req.url === '/robots.txt') {
      res.setHeader('Content-Type','text/plain');
      res.end('User-agent: *\nDisallow: /private*\nAllow: /private/ok$');
      return;
    }
    if (req.url === '/redirect') {
      res.writeHead(302,{Location:'/private/a'});
      res.end();
      return;
    }
    res.setHeader('Content-Type','text/html; charset=utf-8');
    if (req.url === '/grid') {
      res.end('<title>Gạch thử</title><img alt="Gạch 60x60" data-sku="G-002" src="/grid.png"><meta property="og:image" content="/cover.jpg">');
      return;
    }
    res.end('<meta property="og:site_name" content="Kho Mẫu"><script type="application/ld+json">' +
      JSON.stringify({'@graph':[{'@type':'Product',name:'Gạch mẫu',sku:'G-001',size:'60x60',image:'/gach.png'}]}) + '</script>');
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const local = 'http://127.0.0.1:' + server.address().port;
  const options = {dnsResolver:async () => [{address:'8.8.8.8'}],
    fetchFn:(url,settings) => fetch(new URL(new URL(url).pathname,local),settings)};
  const result = await importCatalogueUrls(['https://catalogue.test/products','https://catalogue.test/grid','https://catalogue.test/redirect'],options);
  assert.deepEqual(result.items.map(item => [item.code,item.image,item.supplier]),[
    ['G-001','https://catalogue.test/gach.png','Kho Mẫu'],
    ['G-002','https://catalogue.test/grid.png','catalogue.test'],
    ['','https://catalogue.test/cover.jpg','catalogue.test']
  ]);
  assert.ok(result.needsAi);
  assert.match(result.warnings[0],/robots\.txt/);
  assert.equal(seen.filter(url => url === '/robots.txt').length,1);
  assert.ok(!seen.includes('/private/a'));
  const blocked = await importCatalogueUrls([local+'/products']);
  assert.match(blocked.warnings[0],/nội bộ/);
});

test('GĐ20.10 dò phân trang theo rel, nhãn, rồi mẫu URL', () => {
  const url = 'https://catalogue.test/gach?loai=op';
  assert.deepEqual(cataloguePagination(
    '<link rel="next" href="?loai=op&page=2"><button data-href="?loai=op&page=4">Tiếp</button>' +
    '<a href="?loai=op&page=9">9</a>',url),{next:'https://catalogue.test/gach?loai=op&page=2',total:9});
  assert.equal(cataloguePagination('<link rel="next" href="http://127.0.0.1/admin">' +
    '<a href="?loai=op&p=3" aria-label="Trang sau">→</a><a href="?loai=op&p=2">2</a>',url).next,
  'https://catalogue.test/gach?loai=op&p=3');
  assert.equal(cataloguePagination('<a href="/gach/page/3?loai=op">3</a><a href="/gach/page/9?loai=op">9</a>',
    'https://catalogue.test/gach/page/2?loai=op').next,'https://catalogue.test/gach/page/3?loai=op');
  assert.equal(cataloguePagination('<a href="https://other.test/page/2">Next</a>',url).next,null);
  assert.equal(cataloguePagination('<a class="next page-numbers" href="/gach/page/6">&rarr;</a>',
    'https://catalogue.test/gach/page/5/').next,'https://catalogue.test/gach/page/6');
});

test('Đọc tên, kích thước và mã gạch từ HTML sản phẩm sau lỗi nguồn tạm thời', async () => {
  let attempts = 0;
  const options = {dnsResolver:async () => [{address:'8.8.8.8'}],fetchFn:async url => {
    if (url.endsWith('/robots.txt')) return new Response('User-agent: *',{headers:{'Content-Type':'text/plain'}});
    if (++attempts === 1) return new Response('',{status:429,headers:{'Retry-After':'0'}});
    return new Response('<title>Danh mục</title><img alt="Logo" src="/logo.png">' +
      '<a href="/san-pham/gach-a/"><img data-lazy-src="/a.jpg" src="/placeholder.png"></a>' +
      '<a href="/san-pham/gach-a/"><strong>Gạch bông</strong> 30&times;30 G7B30316</a>' +
      '<a href="/san-pham/gach-b/"><img src="/b.jpg" alt="Gạch men 20x20 G7-30866"></a>' +
      '<a rel="next" href="/gach/page/6/">→</a>',{headers:{'Content-Type':'text/html'}});
  }};
  const result = await importCatalogueUrls(['https://catalogue.test/gach/page/5/'],options);
  assert.equal(attempts,2);
  assert.deepEqual(result.items.map(({code,name,size,image}) => [code,name,size,image]),[
    ['G7B30316','Gạch bông 30×30 G7B30316','30×30','https://catalogue.test/a.jpg'],
    ['G7-30866','Gạch men 20x20 G7-30866','20x20','https://catalogue.test/b.jpg']
  ]);
  assert.equal(result.next,'https://catalogue.test/gach/page/6/');
  assert.equal(result.needsAi,false);
});

test('Ưu tiên ảnh Product, OG, gallery và srcset có độ phân giải cao', async () => {
  const documents = {
    '/san-pham/mau':'<meta property="og:image" content="/og.jpg"><a href="/gallery.jpg"><img data-zoom-image="/zoom.jpg"></a>' +
      '<script type="application/ld+json">{"@type":"Product","sku":"X-001","image":[{"url":"/low.jpg","width":320,"height":320},{"url":"/full.jpg","width":1600,"height":1600}]}</script>',
    '/grid':'<a href="/san-pham/a"><img alt="Mẫu A-100" src="/small.jpg" srcset="/small.jpg 300w, /big.jpg 1800w, /mid.jpg 900w"></a>' +
      '<a href="/san-pham/b"><img alt="Mẫu B-100" width="400" srcset="/b1.jpg 1x, /b3.jpg 3x, /b2.jpg 2x"></a>' +
      '<a href="/san-pham/c"><img alt="Mẫu C-100" src="/wp-content/uploads/2026/photo-247x296.jpg"></a>' +
      '<a href="/san-pham/logo"><img alt="Logo" src="/logo.png"></a>'
  };
  const options = {dnsResolver:async () => [{address:'8.8.8.8'}],fetchFn:async url => {
    const name = new URL(url).pathname;
    return new Response(name === '/robots.txt' ? 'User-agent: *' : documents[name],{
      headers:{'Content-Type':name === '/robots.txt' ? 'text/plain' : 'text/html'}
    });
  }};
  const detail = (await importCatalogueUrls(['https://catalogue.test/san-pham/mau'],options)).items[0];
  assert.deepEqual([detail.image,...detail.imageAlternates].map(url => new URL(url).pathname),
    ['/full.jpg','/low.jpg','/og.jpg','/gallery.jpg','/zoom.jpg']);
  const listing = await importCatalogueUrls(['https://catalogue.test/grid'],options);
  assert.deepEqual(listing.items.map(item => new URL(item.image).pathname),['/big.jpg','/b3.jpg','/wp-content/uploads/2026/photo.jpg']);
});
