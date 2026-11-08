const {test} = require('node:test');
const assert = require('node:assert/strict');
const {imageSearch} = require('../google-search');

for (const [provider,fixture] of Object.entries({
  serper:{images:[{title:'Oak',imageUrl:'https://example.com/oak.png',thumbnailUrl:'https://example.com/thumb.png'}]},
  brave:{results:[{title:'Oak',properties:{url:'https://example.com/oak.png'},thumbnail:{src:'https://example.com/thumb.png'}}]},
  google:{items:[{title:'Oak',link:'https://example.com/oak.png',image:{thumbnailLink:'https://example.com/thumb.png'}}]}
})) test('Image search: ' + provider,async () => {
  const [item] = await imageSearch({provider,key:'secret',cx:'id'},'gỗ oak',{fetchFn:async (url,options) => {
    const parsed = new URL(url);
    if (provider === 'serper') {
      assert.equal(parsed.href,'https://google.serper.dev/images');
      assert.equal(options.method,'POST');
      assert.equal(options.headers['X-API-KEY'],'secret');
      assert.equal(JSON.parse(options.body).q,'gỗ oak');
    } else {
      assert.equal(parsed.searchParams.get('q'),'gỗ oak');
      if (provider === 'brave') {
        assert.equal(parsed.origin + parsed.pathname,'https://api.search.brave.com/res/v1/images/search');
        assert.equal(options.headers['X-Subscription-Token'],'secret');
      } else {
        assert.equal(parsed.hostname,'customsearch.googleapis.com');
        assert.equal(parsed.searchParams.get('key'),'secret');
      }
    }
    return Response.json(fixture);
  }});
  assert.equal(item.title,'Oak');
  assert.equal(item.link,'https://example.com/oak.png');
  assert.equal(item.thumbnail,'https://example.com/thumb.png');
});
