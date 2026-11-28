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
  const at1 = (await call('POST', '/api/site-plans/abc123', {data: plan})).json.updatedAt;
  await new Promise(r => setTimeout(r, 5));
  await call('POST', '/api/site-plans/abc123', {data: plan, baseAt: at1});
  assert.equal((await call('POST', '/api/site-plans/abc123', {data: plan, baseAt: at1})).status, 409, 'bản cũ không ghi đè im lặng');
  assert.equal((await call('POST', '/api/site-plans/abc123', {data: plan, baseAt: at1, force: true})).status, 200);
  assert.equal((await call('POST', '/api/site-plans/abc123/delete', {})).status, 200);
  assert.equal((await call('GET', '/api/site-plans')).json.plans.length, 0);
  assert.equal((await call('GET', '/api/site-plans/abc123')).status, 404);
});

test('đợt 2–3: trần, ghi chú, bảng kê, mô tả phòng, mặt đứng, đọc DXF', () => {
  const C = require('../ve-hien-trang-core.js');
  const p = C.samplePlan(), f = p.floors[0];
  f.ceilItems = [{id: 'a', type: 'downlight', x: 1000, y: 1000, size: 90, dim: true}, {id: 'b', type: 'downlight', x: 2000, y: 1000, size: 90}];
  f.ceilLines = [{id: 'l', pts: [[300, 300], [2900, 300]], level: 3000}];
  f.notes = [{id: 'n', x: 0, y: -2000, text: 'Nứt chân tường'}];
  f.schedCeil = true;
  const ceil = C.floorPrimitives(p, f, {mode: 'ceil'});
  assert.ok(ceil.some(q => q.hit === 'ci:a') && ceil.some(q => q.hit === 'cl:l'));
  assert.ok(!ceil.some(q => q.layer === 'THIETBI'), 'trần không vẽ ổ cắm');
  assert.ok(ceil.some(q => q.t === 'text' && q.s === '1000' && q.hit === 'ci:a'), 'dim downlight tới tường');
  assert.ok(ceil.some(q => q.hit === 'sched:ceil' && q.s === '2'), 'bảng kê đếm 2 downlight');
  assert.ok(!ceil.some(q => q.hit === 'note:n'), 'ghi chú mặt bằng không hiện ở trần');
  assert.ok(C.floorPrimitives(p, f).some(q => q.hit === 'note:n'));
  const d = C.parseRoomDescription('vẽ một phòng 3 mét 5 nhân 4 mét, cửa đi phía trước rộng 900 cách 300, cửa sổ bên phải 1200, cột góc trên trái');
  assert.deepEqual([d.w, d.h], [3500, 4000]);
  const {room, columns} = C.roomFromDescription(d);
  assert.equal(room.openings.length, 2);
  assert.equal(room.openings[0].seg, 2);
  assert.equal(room.openings[0].at, 3500 - 300 - 900);
  assert.equal(columns.length, 1);
  const ev = C.elevPrimitives(p, f.rooms[0], 1);
  assert.ok(ev.some(q => q.t === 'text' && q.s === '3300'), 'chiều cao tường');
  const parsed = C.parseDxf(C.toDxf(C.floorPrimitives(p, f)));
  assert.ok(parsed.count > 50 && Math.abs(parsed.mmPerUnit - 1) < 1e-9);
  const r = C.rectRoom(0, 0, 3000, 4000);
  C.setSegLength(r, 0, 3500, 'end');
  assert.deepEqual(r.pts[1], [3500, 0]);
  assert.deepEqual(r.pts[2], [3000, 4000]);
});

test('đọc số đo kiểu nói: rưỡi, 3m5, 3,5 / 1.500, câu có cả kích thước + cửa; DXF bỏ paper space; cửa không lọt ra khi rút tường', () => {
  const C = require('../ve-hien-trang-core.js');
  assert.equal(C.parseCommand('ngang 3 mét rưỡi')[0].len, 3500);
  assert.equal(C.parseCommand('ngang 3m5')[0].len, 3500);
  for (const t of ['phòng 3,5m x 4m', 'phòng 3.5 x 4', 'phòng 3.500 x 4.000', 'phòng 3m5 nhân 4m']) assert.deepEqual([C.parseRoomDescription(t).w, C.parseRoomDescription(t).h], [3500, 4000], t);
  const d = C.parseRoomDescription('phòng 4 x 5 cửa sổ bên phải 1,2');
  assert.deepEqual([d.w, d.h, d.openings[0].w, d.openings[0].side], [4000, 5000, 1200, 'right']);
  const dxf = ['0', 'SECTION', '2', 'ENTITIES', '0', 'LINE', '8', '0', '10', '0', '20', '0', '11', '1000', '21', '0', '0', 'LINE', '67', '1', '8', '0', '10', '0', '20', '0', '11', '297000', '21', '0', '0', 'ENDSEC', '0', 'EOF'].join('\n');
  assert.equal(C.parseDxf(dxf).count, 1);
  const r = C.rectRoom(0, 0, 3000, 4000);
  r.openings = [{id: 'o', seg: 0, at: 2000, w: 900, type: 'window'}];
  C.setSegLength(r, 0, 1500);
  assert.equal(r.openings[0].at, 600);
});
