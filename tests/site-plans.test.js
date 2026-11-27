const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../ve-hien-trang-core.js');
const {handleSitePlans} = require('../site-plans.js');

test('vẽ hiện trạng: đọc số tiếng Việt', () => {
  const n = t => C.parseCommand(t).map(a => a.len);
  assert.deepEqual(n('1.500'), [1500]);
  assert.deepEqual(n('một nghìn năm trăm'), [1500]);
  assert.deepEqual(n('nghìn rưỡi'), [1500]);
  assert.deepEqual(n('hai nghìn tư'), [2400]);
  assert.deepEqual(n('3 mét 5'), [3500]);
  assert.deepEqual(n('8,5 m'), [8500]);
  assert.deepEqual(n('35 phân'), [350]);
  assert.deepEqual(n('1200+1500'), [2700]);
  assert.deepEqual(n('ba trăm tư'), [340]);
});

test('vẽ hiện trạng: lệnh vẽ đoạn, loại đoạn, lệnh điều khiển', () => {
  assert.deepEqual(C.parseCommand('dọc 3500'), [{type: 'seg', dir: 'v', len: 3500, kind: null}]);
  assert.deepEqual(C.parseCommand('ngang 1200 cửa sổ'), [{type: 'seg', dir: 'h', len: 1200, kind: 'window'}]);
  assert.deepEqual(C.parseCommand('900 cửa đi'), [{type: 'seg', dir: null, len: 900, kind: 'door'}]);
  assert.deepEqual(C.parseCommand('cửa sổ'), [{type: 'kind', kind: 'window'}]);
  assert.deepEqual(C.parseCommand('xuống 2 mét'), [{type: 'seg', dir: 'down', len: 2000, kind: null}]);
  assert.deepEqual(C.parseCommand('khép kín').map(a => a.type), ['close']);
  assert.deepEqual(C.parseCommand('dọc 3500 ngang 4000 tiếp tục').map(a => a.type + (a.len || '')), ['seg3500', 'seg4000', 'continue']);
  // dọc lần đầu đi lên, lần sau đảo chiều
  assert.deepEqual(C.stepVector('v', null, null, null), [0, -1]);
  assert.deepEqual(C.stepVector('v', null, [0, -1], null), [0, 1]);
});

test('vẽ hiện trạng: phòng, tường dày ra ngoài, sửa chiều dài giữ vuông', () => {
  const plan = C.newPlan();
  const room = C.rectRoom(0, 0, 3000, 4000, 'P1');
  assert.equal(C.area(room), 12e6);
  assert.equal(C.perimeter(room), 14000);
  // tường dày ra phía ngoài: góc ngoài của đoạn trên ở (-140,-140) -> (3140,-140)
  const q = C.wallQuad(plan, room, 0);
  assert.deepEqual(q.map(p => p.map(Math.round)), [[0, 0], [3000, 0], [3140, -140], [-140, -140]]);
  C.setSegLength(room, 0, 3500);
  assert.deepEqual(room.pts, [[0, 0], [3500, 0], [3500, 4000], [0, 4000]]);
  C.setSegLength(room, 1, 3600);
  assert.deepEqual(room.pts, [[0, 0], [3500, 0], [3500, 3600], [0, 3600]]);
  // vẽ ngược chiều kim vẫn dày ra ngoài
  const ccw = {...C.rectRoom(0, 0, 1000, 1000), pts: [[0, 0], [0, 1000], [1000, 1000], [1000, 0]], openings: []};
  assert.deepEqual(C.wallQuad(plan, ccw, 0)[3].map(Math.round), [-140, -140]);
});

test('vẽ hiện trạng: nét phác tay làm gọn thành phòng vuông', () => {
  const path = [];
  for (let x = 0; x <= 3010; x += 50) path.push([x, (x % 100) / 10]);
  for (let y = 0; y <= 2990; y += 50) path.push([3010, y]);
  for (let x = 3010; x >= 0; x -= 50) path.push([x, 2990]);
  for (let y = 2990; y >= 30; y -= 50) path.push([0, y]);
  const r = C.simplifySketch(path, 80);
  assert.equal(r.closed, true);
  assert.deepEqual(r.pts, [[0, 0], [3000, 0], [3000, 3000], [0, 3000]]);
});

test('vẽ hiện trạng: dim tường ghi cửa, xuất DXF có lớp và chữ tiếng Việt', () => {
  const plan = C.samplePlan();
  const prims = C.floorPrimitives(plan, plan.floors[0]);
  const texts = prims.filter(p => p.t === 'text').map(p => p.s);
  assert.ok(texts.includes('3200') && texts.includes('1350') && texts.includes('900'), 'dim tường + cửa');
  assert.ok(texts.includes('+400') && texts.some(s => s.startsWith('S = 11,52')), 'cao độ thiết bị, diện tích phòng');
  const dxf = C.toDxf(prims);
  assert.match(dxf, /^0\r\nSECTION/);
  assert.match(dxf, /\r\nTUONG\r\n/);
  assert.match(dxf, /P1 \\U\+2013 Ph\\U\+00F2ng ng\\U\+1EE7/);
  assert.ok(dxf.trim().endsWith('EOF'));
  assert.ok(C.bounds(prims).x1 > 8900);
});

test('vẽ hiện trạng: API lưu / danh sách / đọc / xoá theo tài khoản', async () => {
  const data = new Map();
  const store = {get: async key => structuredClone(data.get(key) ?? null), put: async (key, value) => { data.set(key, structuredClone(value)); }};
  const call = async (method, url, body, dataKey = 'a@x.vn') => {
    let out;
    try { await handleSitePlans({method}, {}, url, {store, dataKey, readJsonBody: async () => body, sendJson: (_r, status, json) => { out = {status, json}; }}); }
    catch (e) { out = {status: e.status, json: {message: e.message}}; }
    return out;
  };
  const plan = C.samplePlan();
  assert.equal((await call('POST', '/api/site-plans/abc123', {name: 'Nhà A', projectId: 'p1', data: plan})).status, 200);
  const list = (await call('GET', '/api/site-plans')).json.plans;
  assert.equal(list.length, 1);
  assert.equal(list[0].rooms, 4);
  assert.equal((await call('GET', '/api/site-plans/abc123')).json.data.floors.length, 2);
  assert.equal((await call('GET', '/api/site-plans')).json.plans.length, 1);
  assert.equal((await call('GET', '/api/site-plans', null, 'b@x.vn')).json.plans.length, 0, 'tài khoản khác không thấy');
  assert.equal((await call('GET', '/api/site-plans/abc123', null, 'b@x.vn')).status, 404);
  assert.equal((await call('POST', '/api/site-plans/abc123', {name: 'x', data: [1]})).status, 400);
  assert.equal((await call('POST', '/api/site-plans/../x', {data: {}})).status, 404);
  assert.equal((await call('POST', '/api/site-plans/abc123', {data: {big: 'x'.repeat(1024 * 1024 + 10)}})).status, 413);
  assert.equal((await call('POST', '/api/site-plans/abc123/delete', {})).status, 200);
  assert.equal((await call('GET', '/api/site-plans')).json.plans.length, 0);
  assert.equal((await call('GET', '/api/site-plans/abc123')).status, 404);
});
