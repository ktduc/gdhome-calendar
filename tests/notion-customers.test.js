const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleIntegrations,encrypt } = require('../integrations');

test('Notion khách hàng giữ ghép cột, lọc tên và điện thoại qua trang, chỉ đọc', async t => {
  const database = 'a'.repeat(32);
  const calls = [];
  const properties = { 'Tên KH':{type:'title'}, 'Địa chỉ':{type:'rich_text'}, 'Điện thoại':{type:'phone_number'} };
  const customer = (id,name,phone) => ({ object:'page',id,properties:{
    'Tên KH':{ type:'title',title:[{plain_text:name}] },
    'Điện thoại':{ type:'phone_number',phone_number:phone }
  } });
  t.mock.method(global,'fetch',async (url,options) => {
    const body = options.body ? JSON.parse(options.body) : {};
    calls.push({ url,method:options.method,body });
    assert.equal(options.headers.Authorization,'Bearer test-notion');
    if (options.method === 'GET') return Response.json({properties});
    assert.match(url,/\/databases\/.+\/query$/);
    return Response.json(body.start_cursor ? { results:[customer('two','Anh Đức','090 123 456')],has_more:false } :
      { results:[customer('one','Khách khác','091')],has_more:true,next_cursor:'page-two' });
  });
  let data = { secrets:encrypt({notionToken:'test-notion'}) };
  const store = { get:async()=>data,put:async(key,value)=>{ data = value; } };
  async function call(method,url,body) {
    let result;
    await handleIntegrations({ method,url },{},url.split('?')[0],{
      store,dataKey:'sample',readJsonBody:async()=>body,sendJson:(res,status,value)=>{ assert.equal(status,200); result=value; }
    });
    return result;
  }
  const map = { customer:'Tên KH',address:'Địa chỉ',phone:'Điện thoại' };
  await call('POST','/api/integrations/settings',{ notionCustomerDb:database,notionCustomerMap:map });
  assert.deepEqual((await call('GET','/api/integrations/settings')).notionCustomerMap,map);
  const page = await call('GET','/api/notion/customers');
  assert.equal(page.items[0].id,'one');
  assert.equal(page.nextCursor,'page-two');
  for (const q of ['anh duc','090123']) {
    const filtered = await call('GET','/api/notion/customers?q='+encodeURIComponent(q));
    assert.equal(filtered.items[0].values['Tên KH'],'Anh Đức');
    assert.equal(filtered.nextCursor,null);
  }
  assert.ok(calls.every(c => c.method === 'GET' || c.url.endsWith('/query')));
});
