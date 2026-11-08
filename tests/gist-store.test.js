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
