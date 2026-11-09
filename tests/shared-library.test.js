const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleLibrary, categoryForGroup, defaultLibrary, cleanView, libraryKey } = require('../shared-library');
const { MaterialStore } = require('../materials');
const { cleanSheet } = require('../material-review');

const a = 'a'.repeat(64) + '.webp', b = 'b'.repeat(64) + '.webp';

function harness() {
  const data = new Map();
  const store = { get:async key => structuredClone(data.get(key) ?? null), put:async (key,value) => { data.set(key,structuredClone(value)); } };
  async function call(urlPath,body,dataKey = 'u@example.com') {
    let status, payload;
    const res = {};
    const sendJson = (_res,code,json) => { status = code; payload = json; };
    const req = { method:body ? 'POST' : 'GET' };
    try {
      await handleLibrary(req,urlPath,{ res,store,dataKey,readJsonBody:async () => body,sendJson });
    } catch (error) { status = error.status || 500; payload = { message:error.message }; }
    return { status,data:payload };
  }
  return { call,data,store };
}

test('Dữ liệu dùng chung: hạng mục mặc định, thêm/xoá ảnh, tách theo tài khoản', async () => {
  const { call } = harness();
  const first = await call('/api/library');
  assert.equal(first.status,200);
  assert.equal(first.data.categories.length,19);
  assert.equal(first.data.categories[5].name,'GẠCH ỐP LÁT');

  const category = first.data.categories[5].id;
  const added = await call('/api/library/items',{ categoryId:category,items:[{ full:a,thumb:b,name:'Viglacera 60x60' }] });
  assert.equal(added.status,200);
  assert.equal(added.data.items.filter(item => item.full).length,1);
  assert.equal(added.data.added[0].name,'Viglacera 60x60');
  // Thêm lại cùng ảnh vào cùng hạng mục không tạo bản trùng.
  assert.equal((await call('/api/library/items',{ categoryId:category,items:[{ full:a,thumb:b }] })).data.items.filter(item => item.full).length,1);
  assert.equal((await call('/api/library/items',{ categoryId:'khong-co',items:[{ full:a,thumb:b }] })).status,400);
  assert.equal((await call('/api/library/items',{ categoryId:category,items:[{ full:'../x',thumb:b }] })).status,400);

  const id = added.data.items[0].id;
  assert.equal((await call('/api/library/items/update',{ id,used:true })).data.items[0].used,1);
  assert.equal((await call('/api/library/categories/delete',{ id:category })).status,409);

  const created = await call('/api/library/categories',{ name:'Đá ốp mặt tiền' });
  assert.equal(created.data.category.name,'Đá ốp mặt tiền');
  assert.equal((await call('/api/library/categories',{ name:'đá ốp mặt tiền' })).data.category.id,created.data.category.id);

  // Tài khoản khác không thấy ảnh.
  assert.equal((await call('/api/library',null,'v@example.com')).data.items.filter(item => item.full).length,0);

  assert.equal((await call('/api/library/items/delete',{ ids:[id] })).data.items.filter(item => item.full).length,0);
  assert.equal((await call('/api/library/categories/delete',{ id:category })).status,200);
});

test('Dữ liệu dùng chung: ghép nhóm vật liệu với hạng mục', () => {
  const library = defaultLibrary();
  assert.equal(categoryForGroup(library,'GẠCH ỐP LÁT (sảnh, WC, logia)').name,'GẠCH ỐP LÁT');
  assert.equal(categoryForGroup(library,'Sàn gỗ').name,'SÀN GỖ');
  assert.equal(categoryForGroup(library,'Thiết bị vệ sinh').name,'THIẾT BỊ VỆ SINH');
  assert.equal(categoryForGroup(library,'Hạng mục lạ'),null);
});

test('Gộp hạng mục giữ ID mẫu, lịch sử nhập và phạm vi thuộc tính', async () => {
  const {call} = harness();
  const sourceId = 'cat-6', targetId = 'cat-5';
  const added = await call('/api/library/items',{categoryId:sourceId,items:[{full:a,thumb:b,name:'Mẫu gạch'}]});
  const id = added.data.added[0].id;
  await call('/api/library/attributes',{action:'save',key:'tags',name:'Tag mẫu',categoryIds:[sourceId,targetId]});
  await call('/api/library/imports',{imports:[{id:'nhap-1',source:'https://example.com/gach',categoryId:sourceId,status:'done',itemIds:[id]}]});
  assert.equal((await call('/api/library/categories/merge',{sourceId:'ancuong-wood',targetId})).status,400);
  assert.equal((await call('/api/library/categories/merge',{sourceId,targetId:'missing'})).status,404);
  assert.equal((await call('/api/library/categories/merge',{sourceId,targetId})).status,200);

  const {data} = await call('/api/library');
  assert.ok(!data.categories.some(category => category.id === sourceId));
  const item = data.items.find(entry => entry.id === id);
  assert.deepEqual([item.categoryId,item.full,item.thumb],[targetId,a,b]);
  assert.deepEqual(data.attributes.tags[0].categoryIds,[targetId]);
  assert.deepEqual([data.imports[0].categoryId,data.imports[0].itemIds],[targetId,[id]]);
  assert.equal(categoryForGroup(data,'GẠCH ỐP LÁT (sảnh, WC, logia)').id,targetId);
});

test('Cùng mã và hãng vẫn có thể lưu riêng ở hạng mục đích đã chọn', async () => {
  const {call} = harness();
  const item = {code:'G-161',brand:'Hãng mẫu',name:'Gạch',full:a,thumb:b};
  for (const categoryId of ['cat-6','cat-5']) {
    const result = await call('/api/library/items',{categoryId,items:[item]});
    assert.equal(result.status,200);
    assert.equal(result.data.added[0].categoryId,categoryId);
  }
  const retry = await call('/api/library/items',{categoryId:'cat-5',items:[item]});
  assert.equal(retry.data.skipped,1);
  assert.deepEqual(retry.data.items.filter(entry => entry.code === item.code).map(entry => entry.categoryId).sort(),['cat-5','cat-6']);
});

test('Vùng nhìn ảnh: giữ x/y/z hợp lệ, bỏ giá trị mặc định', () => {
  assert.equal(cleanView({x:0.5,y:0.5,z:1}),undefined);
  assert.deepEqual(cleanView({x:2,y:-1,z:9}),{x:1,y:0,z:6});
  const sheet = cleanSheet({ groups:[{ id:'g',name:'Nhóm',rows:[{ id:'r',name:'Dòng',
    render:[{ full:a,thumb:b,view:{x:0.3,y:0.6,z:1.5,evil:'<script>'} },{ full:a,thumb:b,view:{x:0.5,y:0.5,z:1} }],
    options:[{ images:[] },{ images:[] },{ images:[] }] }] }] });
  const render = sheet.groups[0].rows[0].render;
  assert.deepEqual(render[0].view,{x:0.3,y:0.6,z:1.5});
  assert.equal(render[1].view,undefined);
});

test('GĐ20.17 chỉ lưu kích thước đầu tiên của mỗi mẫu', async () => {
  const {call} = harness();
  const added = await call('/api/library/items',{categoryId:'cat-6',items:[
    {name:'Gạch A',full:a,thumb:a,size:['600×600','300x600']},
    {name:'Gạch B',full:b,thumb:b,size:'300x600, 600x600'}
  ]});
  assert.equal(added.status,200);
  assert.deepEqual(added.data.added.map(item => item.size),['600x600','300x600']);
  assert.equal((await call('/api/library/items/update',{id:added.data.added[0].id,size:'60cm x 30cm; 300x300'})).data.items
    .find(item => item.id === added.data.added[0].id).size,'600x300');
});

test('GĐ20.11 đổi tên, gộp và xoá giá trị theo tài khoản', async () => {
  const {call} = harness();
  const items = await call('/api/library/items',{categoryId:'cat-6',items:[
    {full:a,thumb:a,brand:'Hãng A',suppliers:['Kho 1'],finish:'Mờ'},
    {full:b,thumb:b,brand:'Hãng B',suppliers:['Kho 2']}
  ]});
  assert.equal(items.status,200);
  const modify = (action,data) => call('/api/library/attributes',{key:'brand',action,...data});
  assert.equal((await modify('save',{previous:'Hãng A',name:'Hãng C',categoryIds:['cat-6']})).status,200);
  const merged = await modify('merge',{target:'Hãng B',names:['Hãng B','Hãng C']});
  assert.deepEqual(merged.data.items.filter(item => item.full).map(item => item.brand),['Hãng B','Hãng B']);
  assert.equal((await modify('delete',{previous:'Hãng B'})).status,409);
  const outsider = await call('/api/library/attributes',null,'other@example.com');
  assert.ok(!outsider.data.attributes.brand.some(row => row.name === 'Hãng B'));
  assert.equal((await modify('delete',{previous:'Hãng B',confirm:true})).status,200);
  const result = await call('/api/library/attributes');
  assert.ok(!result.data.attributes.brand.some(row => row.name === 'Hãng B' || row.name === 'Hãng C'));
  assert.equal(result.data.attributes.finish.find(row => row.name === 'Mờ').count,1);
});

test('GĐ20.9 chuẩn hoá và lưu lịch sử nhập riêng theo tài khoản', async () => {
  const {call} = harness();
  const entry = {id:'import-1',source:'https://example.com/gach/?utm_source=a&p=2#anh',name:'Gạch',
    categoryId:'cat-6',status:'partial',count:0};
  assert.equal((await call('/api/library/imports',{imports:[entry]})).status,200);
  const completed = await call('/api/library/imports',{imports:[{...entry,status:'done',count:1,itemIds:['one']}]});
  assert.equal(completed.data.imports.length,1);
  assert.equal(completed.data.imports[0].source,'https://example.com/gach?p=2');
  assert.equal((await call('/api/library/imports',null,'other@example.com')).data.imports.length,0);
  assert.equal((await call('/api/library/imports',{deleteId:entry.id})).data.imports.length,0);
});

test('Màu sơn trong PA được giữ khi lưu, mã màu sai bị bỏ', () => {
  const sheet = cleanSheet({ groups:[{ id:'g',name:'SƠN TƯỜNG',rows:[{ id:'r',name:'Sơn tường',render:[],
    options:[{ code:'30YY 72/107',paint:{kind:'paint',brand:'Dulux',code:'30YY 72/107',name:'Ivory Lace',hex:'#F5F0E1',x:'<b>'},images:[] },
      { paint:{brand:'Jotun',code:'9918',hex:'red'},images:[] },{ images:[] }] }] }] });
  const [first,second] = sheet.groups[0].rows[0].options;
  assert.deepEqual(first.paint,{kind:'paint',brand:'Dulux',code:'30YY 72/107',name:'Ivory Lace',hex:'#f5f0e1'});
  assert.equal(second.paint,undefined);
});

test('GĐ20.4 gộp mã theo tài khoản, giữ ảnh đích, nối PA và hoàn tác', async () => {
  const account = 'merge@example.com';
  const {call,store} = harness();
  const material = new MaterialStore(store,account);
  const add = items => call('/api/library/items',{categoryId:'cat-1',items},account);
  const first = await add([{code:'MFC-MS 461 SC01',full:a,thumb:a,brand:'Hãng A',tags:['Vân'],suppliers:['Kho A']}]);
  const second = await add([{code:'MFC MS461 SC01',full:b,thumb:b,brand:'Hãng B',tags:['Mờ'],suppliers:['Kho B']}]);
  const target = first.data.added[0], source = second.data.added[0];
  const merge = {targetId:target.id,ids:[target.id,source.id]};
  await call('/api/library/items/update',{id:target.id,used:true},account);
  await call('/api/library/items/update',{id:source.id,used:true},account);
  await material.update(0,data => {
    data.sheets.push({id:'sheet',groups:[{id:'group',rows:[{id:'row',options:[
      {libraryItemId:source.id}, {libraryItemId:target.id}, {}
    ]}]}]});
  });
  assert.equal((await call('/api/library/items/merge',merge,'other@example.com')).status,404);
  const originalPut = store.put;
  store.put = async (key,value) => {
    if (key === libraryKey(account)) throw new Error('Lỗi giả lập khi lưu thư viện');
    return originalPut(key,value);
  };
  assert.equal((await call('/api/library/items/merge',merge,account)).status,500);
  store.put = originalPut;
  const options = async () => (await material.get()).sheets[0].groups[0].rows[0].options;
  assert.equal((await options())[0].libraryItemId,source.id,'Lỗi lưu thư viện khôi phục tham chiếu PA');
  const merged = await call('/api/library/items/merge',merge,account);
  assert.equal(merged.status,200,merged.data.message);
  assert.ok(!merged.data.items.some(item => item.id === source.id));
  const item = merged.data.items.find(item => item.id === target.id);
  assert.deepEqual([item.full,item.used,item.tags,item.suppliers,item.brands],[a,2,['Vân','Mờ'],['Kho A','Kho B'],['Hãng A','Hãng B']]);
  assert.equal((await options())[0].libraryItemId,target.id);
  const undone = await call('/api/library/items/merge',{undo:merged.data.undoToken},account);
  assert.equal(undone.status,200,undone.data.message);
  assert.ok(undone.data.items.some(item => item.id === source.id));
  assert.deepEqual((await options()).map(pa => pa.libraryItemId),[source.id,target.id,undefined]);
});
