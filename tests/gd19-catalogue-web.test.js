const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {importCatalogueUrls,cataloguePagination,catalogueDownloader} = require('../catalogue-web');

test('GĐ21.10 bộ tải dùng chung robots và giãn các yêu cầu đồng thời theo nguồn', async () => {
  const starts = [];
  const download = catalogueDownloader({minimumIntervalMs:30,dnsResolver:async () => [{address:'8.8.8.8'}],
    fetchFn:async url => {
      const pathname = new URL(url).pathname;
      starts.push({pathname,time:Date.now()});
      const rules = pathname === '/robots.txt';
      return new Response(rules ? 'User-agent: *' : 'fixture',{headers:{'Content-Type':rules ? 'text/plain' : 'image/png'}});
    }});
  await Promise.all(['/a.png','/b.png','/c.png'].map(path => download('https://catalogue.test'+path,'image')));
  assert.equal(starts[0]?.pathname,'/robots.txt');
  assert.deepEqual(starts.slice(1).map(({pathname}) => pathname).sort(),['/a.png','/b.png','/c.png']);
  assert.ok(starts.slice(1).every((entry,index) => entry.time-starts[index].time >= 25),JSON.stringify(starts));
});

test('GĐ21.10 An Cường đọc cả thẻ ẩn, tách mã và ánh xạ đúng thứ tự web', async () => {
  const groups = [['Loại Sản Phẩm','Melamine'],['Kích Thước (mm)','1220*2440'],['Màu Sắc','Nâu']];
  const html = groups.map(([title,value],i) => '<div class="box-filter-search"><div class="dropdown-title"><span>'+title+
    '</span></div><div class="dropdown-menu-filter"><ul><li><label class="click-filter-search" name=".option-'+(i+1)+'">'+value+
    '</label></li></ul></div></div>').join('') + Array.from({length:4},(_,i) =>
    '<div class="product-box" data-page="'+(i+1)+'" data-options="option-3 option-1 option-2"><div class="pic"><div>'+
    '<img data-src="/products/products-thumb/'+i+'.jpg"></div></div><div class="product-title"><div class="h-group">Melamine</div>'+
    '<h2>MFC - MS '+(701+i)+' SH</h2><h3>Mẫu kiểm thử '+i+'</h3></div><a class="link-load" href="/melamine/'+i+'.html">Chi tiết</a></div>').join('');
  const result = await importCatalogueUrls(['https://ancuong.com/melamine.html'],{dnsResolver:async () => [{address:'8.8.8.8'}],
    fetchFn:async url => new Response(url.endsWith('/robots.txt') ? 'User-agent: *' : html,
      {headers:{'Content-Type':url.endsWith('/robots.txt') ? 'text/plain' : 'text/html'}})});
  assert.equal(result.items.length,4);
  assert.deepEqual(result.items.map(({code}) => code),['701','702','703','704']);
  const [first] = result.items;
  assert.deepEqual([first.material,first.finish,first.rawCode],['MFC','SH','MFC - MS 701 SH']);
  assert.deepEqual(first.sourceFacets.map(({label,values}) => [label,values[0]]),groups);
  assert.deepEqual(result.sourceFilterGroups.map(({label}) => label),groups.map(([label]) => label));
  assert.match(first.image,/products-full\/0\.jpg$/);
  assert.equal(result.needsAi,false);
});

test('GĐ21.10 website khác nhận dạng thẻ lặp và suy ra bộ lọc theo class', async () => {
  const html = '<fieldset><legend>Dòng sản phẩm</legend><label><input type="checkbox" value="line-oak">Sồi</label></fieldset>' +
    Array.from({length:6},(_,i) => '<article class="design-card line-oak" data-sku="Q'+i+'"><h3>Mẫu '+i+
      '</h3><img src="/'+i+'.png"></article>').join('');
  const result = await importCatalogueUrls(['https://catalogue.test/products'],{dnsResolver:async () => [{address:'8.8.8.8'}],
    fetchFn:async url => new Response(url.endsWith('/robots.txt') ? 'User-agent: *' : html,
      {headers:{'Content-Type':url.endsWith('/robots.txt') ? 'text/plain' : 'text/html'}})});
  assert.equal(result.items.length,6);
  assert.deepEqual(result.items[5].sourceFacets[0],{key:'web-dong-san-pham',label:'Dòng sản phẩm',order:0,values:['Sồi']});
});

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
      '<script type="application/ld+json">{"@type":"Product","sku":"X-001","image":[{"url":"/low.jpg","width":320,"height":320},{"url":"/full.jpg","width":1600,"height":1600}],"offers":{"priceCurrency":"VND","price":"320.000","priceSpecification":{"unitText":"m²"}}}</script>',
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
  assert.equal(detail.price,320000);
  assert.equal(detail.priceUnit,'m²');
  assert.deepEqual([detail.image,...detail.imageAlternates].map(url => new URL(url).pathname),
    ['/full.jpg','/low.jpg','/og.jpg','/gallery.jpg','/zoom.jpg']);
  const listing = await importCatalogueUrls(['https://catalogue.test/grid'],options);
  assert.deepEqual(listing.items.map(item => new URL(item.image).pathname),['/big.jpg','/b3.jpg','/wp-content/uploads/2026/photo.jpg']);
});
