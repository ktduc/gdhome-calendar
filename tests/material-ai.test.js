const { test } = require('node:test');
const assert = require('node:assert/strict');
const { handleIntegrations,encrypt } = require('../integrations');

test('AI Chốt mã dùng kết nối tài khoản, nhận ảnh/PDF và trả nhóm vật liệu đã chuẩn hóa', async t => {
  t.mock.method(global,'fetch',async (url,options) => {
    assert.match(url,/generativelanguage\.googleapis\.com.*generateContent/);
    assert.equal(options.headers['x-goog-api-key'],'test-gemini');
    const body = JSON.parse(options.body);
    assert.match(body.systemInstruction.parts[0].text,/MÃ GỖ/);
    assert.match(body.systemInstruction.parts[0].text,/chốt mã vật liệu/);
    assert.deepEqual(body.contents[0].parts.slice(0,2).map(part => part.inline_data.mime_type),['image/webp','application/pdf']);
    const plan = { groups:[{name:'ĐÁ',rows:[{name:'Mặt bếp',room:'Bếp',qty:2.5,unit:'m²',spec:'Đá trắng',note:'',code:'ignored'},null]}],
      questions:['Cần xác nhận chiều dày'] };
    return Response.json({ candidates:[{content:{parts:[{text:JSON.stringify(plan)}]}}] });
  });
  let result;
  const store = { get:async()=>({ secrets:encrypt({ aiProvider:'gemini',aiKey:'test-gemini',aiModel:'fixture' }) }) };
  await handleIntegrations({ method:'POST' },{},'/api/ai/materials',{
    store,dataKey:'sample',readJsonBody:async()=>({images:[{mediaType:'image/webp',data:'sample'}],pdfs:[{data:'sample'}]}),
    sendJson:(res,status,value)=>{ assert.equal(status,200); result=value.plan; }
  });
  assert.deepEqual(result.groups[0].rows,[{name:'Mặt bếp',room:'Bếp',qty:'2.5',unit:'m²',spec:'Đá trắng',note:''}]);
  assert.deepEqual(result.questions,['Cần xác nhận chiều dày']);
});

test('AI chỉ đọc tài liệu thuộc dự án của dataKey và báo bỏ qua tệp vượt 14 MB', async t => {
  const {attachProjectAiDocuments,ProjectAssets,ProjectHubStore} = require('../project-hub');
  const store = {get: async key => key === new ProjectHubStore(null,'owner').key ? {projects:{p1:{documents:[
    {id:'quote',name:'Báo giá.csv',assetKey:'safe.csv',size:20},
    {id:'large',name:'Large.pdf',assetKey:'large.pdf',size:15*1024*1024}
  ]}}} : null};
  const reads = t.mock.method(ProjectAssets.prototype,'read',async key => {
    assert.equal(key,'safe.csv');
    return {buf:Buffer.from('name,qty\nOak,12'),mime:'text/csv'};
  });
  const payload = {projectId:'p1',documentIds:['quote','large']};
  await assert.rejects(attachProjectAiDocuments({store,dataKey:'other',dataDir:'.'},payload),{status:404});
  await assert.rejects(attachProjectAiDocuments({store,dataKey:'owner',dataDir:'.'},{...payload,documentIds:['foreign']}),{status:404});
  assert.equal(reads.mock.callCount(),0);
  const result = await attachProjectAiDocuments({store,dataKey:'owner',dataDir:'.'},payload);
  assert.match(result.body.sheetText,/Oak,12/);
  assert.deepEqual(result.aiSkipped.map(doc => doc.id),['large']);
});
