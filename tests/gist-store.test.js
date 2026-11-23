const { test } = require('node:test');
const assert = require('node:assert/strict');

test('GistStore: thay đổi đến lúc đang gửi vẫn được gửi tiếp', async () => {
  const { GistStore } = require('../server');
  const local = { init:async () => {}, put:async () => {}, get:async () => null };
  const gist = new GistStore('token','gist-id',local);
  const sent = [];
  let release;
  gist.api = async (method,url,body) => {
    sent.push(Object.keys(body.files));
    if (sent.length === 1) await new Promise(resolve => { release = resolve; });
    return {};
  };
  await gist.put('a@example.com',{v:1});
  const first = gist.flush();              // lượt 1 bắt đầu và đang treo
  await new Promise(resolve => setImmediate(resolve));
  await gist.put('b@example.com',{v:2});  // đến trong lúc đang gửi
  await new Promise(resolve => setTimeout(resolve,1700)); // hẹn giờ 1,5 s nổ khi lượt 1 vẫn đang gửi
  release();
  await first;
  await new Promise(resolve => setTimeout(resolve,1700));
  clearTimeout(gist.timer);
  assert.equal(sent.length,2,'phải có lượt gửi thứ hai');
  assert.deepEqual(sent[1],['user-b_at_example.com.json']);
  assert.equal(gist.dirty.size,0);
});

test('GistStore: GitHub hết hạn mức -> Chốt mã vẫn lưu được (giữ chờ), không gọi GitHub tới giờ mở lại', async () => {
  const { GistStore } = require('../server');
  const local = { init:async () => {}, put:async () => {}, get:async () => null };
  const gist = new GistStore('token','gist-id',local);
  let calls = 0;
  gist.api = async () => {
    calls++;
    throw Object.assign(new Error('GitHub Gist HTTP 403: API rate limit exceeded'),{upstreamStatus:403,rateLimited:true,resetAt:Date.now() + 3600000});
  };
  await gist.putMaterials([['materials',{v:1}]]);          // không ném lỗi
  await gist.putMaterials([['materials',{v:2}]]);          // đang khoá: không gọi GitHub nữa
  await gist.flush();
  clearTimeout(gist.timer);
  assert.equal(calls,1);
  assert.deepEqual(await gist.get('materials'),{v:2});
  assert.ok(gist.dirty.size >= 1,'còn chờ đẩy lên Gist');
  assert.ok(gist.info().githubBlockedUntil);
});

test('GistStore: chép dự phòng sang B2; GitHub khoá lúc khởi động -> mở từ B2, phần chưa lên Gist đẩy khi mở lại', async () => {
  const { GistStore } = require('../server');
  const local = { init:async () => {}, put:async () => {}, get:async () => null };
  const bucket = new Map();
  const objects = {
    ready:() => true,
    put:async (key,buf) => { bucket.set(key,Buffer.from(buf)); },
    get:async key => { if (!bucket.has(key)) throw Object.assign(new Error('404'),{status:404}); const buf = bucket.get(key); return {buf,buffer:buf}; }
  };
  // Máy 1: GitHub khoá giữa chừng, tắt server -> chép sang B2 cả phần đang chờ
  const a = new GistStore('token','gist-id',local);
  a.objects = objects;
  a.api = async () => { throw Object.assign(new Error('rate limit'),{upstreamStatus:403,rateLimited:true,resetAt:Date.now() + 3600000}); };
  a.cache.set('data.json',{v:'cũ'});
  await a.put('a@example.com',{v:'mới'});
  clearTimeout(a.timer);
  await a.flush();                                   // lỗi -> đánh dấu đang khoá
  clearTimeout(a.timer);
  await a.mirror();
  assert.deepEqual(JSON.parse(bucket.get('gist-mirror/user-a_at_example.com.json')),{v:'mới'});
  // Máy 2 khởi động khi GitHub vẫn khoá: đọc từ B2, không gọi PATCH tới giờ mở lại
  const b = new GistStore('token','gist-id',local);
  b.objects = objects;
  let patches = 0;
  b.api = async method => { if (method === 'PATCH') patches++; throw Object.assign(new Error('rate limit'),{upstreamStatus:403,rateLimited:true,resetAt:Date.now() + 3600000}); };
  await b.init();
  clearTimeout(b.timer);
  assert.equal((await b.get('a@example.com')).v,'mới');
  assert.deepEqual([...b.dirty],['user-a_at_example.com.json'],'chỉ phần chưa lên Gist mới chờ đẩy');
  assert.match(b.info().lastError,/bản dự phòng B2/);
  await b.flush();
  clearTimeout(b.timer);
  assert.equal(patches,0);
});

test('GistStore: lưu Chốt mã liên tục chỉ gọi GitHub tối đa 1 lần / 2 giây, gửi kèm tệp khác đang chờ', async () => {
  const { GistStore } = require('../server');
  const local = { init:async () => {}, put:async () => {}, get:async () => null };
  const gist = new GistStore('token','gist-id',local);
  const sent = [];
  gist.api = async (method,url,body) => { sent.push({at:Date.now(),files:Object.keys(body.files)}); return {}; };
  await gist.put('shared',{v:1});
  clearTimeout(gist.timer);
  await gist.putMaterials([['materials',{v:1}]]);
  await gist.putMaterials([['materials',{v:2}]]);
  clearTimeout(gist.timer);
  assert.equal(sent.length,2);
  assert.ok(sent[0].files.includes('data.json'),'tệp Lịch đang chờ đi kèm');
  assert.ok(sent[1].at - sent[0].at >= 1900,'giãn nhịp 2 giây');
  assert.deepEqual(await gist.get('materials'),{v:2});
});
