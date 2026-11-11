const test = require('node:test');
const assert = require('node:assert/strict');
const {logoCandidates} = require('../brand-logos');
const brands = require('../library-brands');
test('GĐ23 logo prioritizes Organization SVG and large touch icons',() => {
  const result = logoCandidates('<link rel="icon" sizes="16x16" href="/small.png"><link rel="apple-touch-icon" sizes="512x512" href="/large.png"><script type="application/ld+json">{"@type":"Organization","logo":{"url":"/brand.svg"}}</script><img class="logo" src="http://127.0.0.1/private.png">','https://example.com');
  assert.deepEqual(result.map(item => item.url),['https://example.com/brand.svg','https://example.com/large.png','https://example.com/small.png']);
});
test('GĐ23 brands retain ordering, aliases, logo and category statistics',() => {
  const records = brands.normalize([{id:'b',name:'New',aliases:['Old'],order:1,logo:'a'.repeat(64)+'.png'},{id:'a',name:'First',order:0}],
    [{brand:'Old',categoryId:'cat-6'},{brand:'New',categoryId:'cat-5'}]);
  assert.equal(records[0].id,'a');
  assert.deepEqual(brands.find(records,'Old').categories,['cat-6','cat-5']);
  assert.equal(brands.find(records,'New').logo,'a'.repeat(64)+'.png');
});
