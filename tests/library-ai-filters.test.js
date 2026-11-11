const {test} = require('node:test');
const assert = require('node:assert/strict');
const {filterItems,filterGroups} = require('../library-ai-filters');
const {cataloguePagination} = require('../catalogue-web');

test('Hà Linh p0 follows adjacent page, resolves base URL and ignores last-page jump',()=>{
  const base='https://halinhjsc.vn/phao-chi-ha-linh/60.htm';
  const html='<base href="https://halinhjsc.vn/"><a href="phao-chi-ha-linh/60.htm/p0">1</a><a href="phao-chi-ha-linh/60.htm/p1">2</a><a href="phao-chi-ha-linh/60.htm/p2">3</a><a href="phao-chi-ha-linh/60.htm/p11">>></a>';
  assert.deepEqual(cataloguePagination(html,base+'/p0'),{next:base+'/p1',total:12});
  assert.deepEqual(cataloguePagination(html,base+'/p1'),{next:base+'/p2',total:12});
  assert.deepEqual(cataloguePagination(html,base+'/p11'),{next:null,total:12});
});

test('AI filter input and output stay bounded, reject unknown IDs and combine duplicate labels',()=>{
  const items=filterItems([{id:'a',name:'Phào chân tường'},{id:'b',name:'Phào nẹp tường'},{id:'a',name:'Lặp'},null]);
  assert.equal(items.length,2);
  assert.deepEqual(filterGroups([{label:' Chân tường ',ids:['a','other','a']},{label:'chân tường',ids:['b']},{label:'Trống',ids:['outside']}],items),
    [{label:'Chân tường',ids:['a','b']}]);
  assert.deepEqual(filterGroups(null,items),[]);
});
