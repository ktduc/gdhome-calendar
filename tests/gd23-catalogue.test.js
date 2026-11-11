const {test} = require('node:test');
const assert = require('node:assert/strict');
const {importCatalogueUrls} = require('../catalogue-web');
test('GĐ23 web ordering table shares the nearest image and product line',async () => {
  const html = '<img src="/ML06H.png"><table><tr><th>Ma</th><th>Quy cach</th><th>Gia</th></tr>'+[75,80].map(width => '<tr><td>ML06.'+width+'HC</td><td>R'+width+'0*S372*C700</td><td>'+width+'0 (750-753)*350*700 Bo 56.490.000</td></tr>').join('')+'</table>';
  const result = await importCatalogueUrls(['https://catalogue.test/garis'],{dnsResolver:async () => [{address:'8.8.8.8'}],
    fetchFn:async url => new Response(url.endsWith('/robots.txt') ? 'User-agent: *' : html,{headers:{'Content-Type':url.endsWith('/robots.txt') ? 'text/plain' : 'text/html'}})});
  assert.equal(result.items.length,2);
  assert.equal(result.items[0].image,result.items[1].image);
  assert.equal(result.items[0].lineId,result.items[1].lineId);
  assert.equal(result.items[0].price,56490000);
  assert.equal(result.items[0].clearance,'(750-753)*350*700');
});
