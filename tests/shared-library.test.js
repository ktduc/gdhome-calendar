const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleLibrary, categoryForGroup, defaultLibrary, cleanView } = require('../shared-library');
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
  return { call,data };
}

test('Dữ liệu dùng chung: hạng mục mặc định, thêm/xoá ảnh, tách theo tài khoản', async () => {
  const { call } = harness();
  const first = await call('/api/library');
  assert.equal(first.status,200);
  assert.equal(first.data.categories.length,17);
  assert.equal(first.data.categories[5].name,'GẠCH ỐP LÁT');

  const category = first.data.categories[5].id;
  const added = await call('/api/library/items',{ categoryId:category,items:[{ full:a,thumb:b,name:'Viglacera 60x60' }] });
  assert.equal(added.status,200);
  assert.equal(added.data.items.length,1);
  assert.equal(added.data.added[0].name,'Viglacera 60x60');
  // Thêm lại cùng ảnh vào cùng hạng mục không tạo bản trùng.
  assert.equal((await call('/api/library/items',{ categoryId:category,items:[{ full:a,thumb:b }] })).data.items.length,1);
  assert.equal((await call('/api/library/items',{ categoryId:'khong-co',items:[{ full:a,thumb:b }] })).status,400);
  assert.equal((await call('/api/library/items',{ categoryId:category,items:[{ full:'../x',thumb:b }] })).status,400);

  const id = added.data.items[0].id;
  assert.equal((await call('/api/library/items/update',{ id,used:true })).data.items[0].used,1);
  assert.equal((await call('/api/library/categories/delete',{ id:category })).status,409);

  const created = await call('/api/library/categories',{ name:'Đá ốp mặt tiền' });
  assert.equal(created.data.category.name,'Đá ốp mặt tiền');
  assert.equal((await call('/api/library/categories',{ name:'đá ốp mặt tiền' })).data.category.id,created.data.category.id);

  // Tài khoản khác không thấy ảnh.
  assert.equal((await call('/api/library',null,'v@example.com')).data.items.length,0);

  assert.equal((await call('/api/library/items/delete',{ ids:[id] })).data.items.length,0);
  assert.equal((await call('/api/library/categories/delete',{ id:category })).status,200);
});

test('Dữ liệu dùng chung: ghép nhóm vật liệu với hạng mục', () => {
  const library = defaultLibrary();
  assert.equal(categoryForGroup(library,'GẠCH ỐP LÁT (sảnh, WC, logia)').name,'GẠCH ỐP LÁT');
  assert.equal(categoryForGroup(library,'Sàn gỗ').name,'SÀN GỖ');
  assert.equal(categoryForGroup(library,'Thiết bị vệ sinh').name,'THIẾT BỊ VỆ SINH');
  assert.equal(categoryForGroup(library,'Hạng mục lạ'),null);
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

test('Màu sơn trong PA được giữ khi lưu, mã màu sai bị bỏ', () => {
  const sheet = cleanSheet({ groups:[{ id:'g',name:'SƠN TƯỜNG',rows:[{ id:'r',name:'Sơn tường',render:[],
    options:[{ code:'30YY 72/107',paint:{kind:'paint',brand:'Dulux',code:'30YY 72/107',name:'Ivory Lace',hex:'#F5F0E1',x:'<b>'},images:[] },
      { paint:{brand:'Jotun',code:'9918',hex:'red'},images:[] },{ images:[] }] }] }] });
  const [first,second] = sheet.groups[0].rows[0].options;
  assert.deepEqual(first.paint,{kind:'paint',brand:'Dulux',code:'30YY 72/107',name:'Ivory Lace',hex:'#f5f0e1'});
  assert.equal(second.paint,undefined);
});
