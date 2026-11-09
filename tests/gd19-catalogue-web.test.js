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
});
