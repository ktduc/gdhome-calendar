// Kiểm tra bộ tính ngày làm việc & liên kết tiến độ.  Chạy:  node --test
const test = require('node:test');
const assert = require('node:assert');

const hol = require('../holidays-data.js');
global.VIETNAM_HOLIDAYS = hol.VIETNAM_HOLIDAYS;
global.getVnHolidayInfo = hol.getVnHolidayInfo;
global.AppState = { daysOffConfig: { holidays: true, saturday: false, saturdayHalf: false, sunday: true, overrides: {} }, tasks: [] };
const S = require('../scheduler.js');

function cfg(over) {
  global.AppState.daysOffConfig = Object.assign({ holidays: true, saturday: false, saturdayHalf: false, sunday: true, overrides: {} }, over || {});
}

test('Ngày làm bù được tính là ngày đi làm (kể cả Thứ 7 khi nghỉ T7)', () => {
  cfg({ saturday: true });
  assert.strictEqual(S.isDateDayOff('2026-01-10').isOff, false); // T7 làm bù Tết DL
  assert.strictEqual(S.isDateDayOff('2026-08-22').isOff, false); // T7 làm bù Quốc khánh
  assert.strictEqual(S.isDateDayOff('2026-08-29').isOff, true);  // T7 thường
});

test('Giáng sinh, 31/12, Phục sinh KHÔNG phải ngày nghỉ', () => {
  cfg();
  ['2026-12-24', '2026-12-25', '2026-12-31'].forEach(d => assert.strictEqual(S.isDateDayOff(d).isOff, false, d));
});

test('Ngày lễ chính thức là ngày nghỉ', () => {
  cfg();
  ['2026-01-01', '2026-02-17', '2026-04-27', '2026-04-30', '2026-05-01', '2026-08-31', '2026-09-01', '2026-09-02', '2026-11-24']
    .forEach(d => assert.strictEqual(S.isDateDayOff(d).isOff, true, d));
});

test('Tắt "Ngày lễ" thì ngày lễ là ngày làm việc', () => {
  cfg({ holidays: false });
  assert.strictEqual(S.isDateDayOff('2026-09-02').isOff, false);
});

test('Ngày tự đánh dấu ưu tiên cao nhất', () => {
  cfg({ overrides: { '2026-11-08': 'work', '2026-11-10': 'off' } });
  assert.strictEqual(S.isDateDayOff('2026-11-08').isOff, false); // CN đi làm
  assert.strictEqual(S.isDateDayOff('2026-11-10').isOff, true);  // T3 nghỉ riêng
});

test('Đếm ngày làm việc có nửa ngày chiều Thứ 7', () => {
  cfg({ saturdayHalf: true });
  // 02/11 (T2) -> 08/11 (CN): 5 ngày + 0.5 (T7) = 5.5
  assert.strictEqual(S.countWorkingDays('2026-11-02', '2026-11-08'), 5.5);
  assert.strictEqual(S.computeEndDateByWorkingDays('2026-11-02', 5.5), '2026-11-07');
  assert.strictEqual(S.computeEndDateByWorkingDays('2026-11-02', 6), '2026-11-09');
});

test('Ngày kết thúc nhảy qua Chủ nhật & ngày lễ 24/11', () => {
  cfg();
  // 23/11 (T2) + 3 ngày làm việc: 23, 25, 26 (24/11 nghỉ)
  assert.strictEqual(S.computeEndDateByWorkingDays('2026-11-23', 3), '2026-11-26');
});

test('Liên kết FS: dời việc trước -> việc sau dời theo, việc song song giữ nguyên', () => {
  cfg();
  const A = { id: 'A', calendarId: 'c', startDate: '2026-11-02', endDate: '2026-11-04' };
  const B = { id: 'B', calendarId: 'c', startDate: '2026-11-05', endDate: '2026-11-06' };
  const P = { id: 'P', calendarId: 'c', startDate: '2026-11-02', endDate: '2026-11-03' }; // song song, không nối
  const tasks = [A, P, B];
  S.addPredecessorLink(B, A, tasks);
  assert.deepStrictEqual(B.predecessors, [{ id: 'A', type: 'FS', lag: 0 }]);
  A.endDate = '2026-11-06'; // kéo dài A thêm 2 ngày
  const moved = S.propagateLinkedTasks(['A'], tasks);
  assert.strictEqual(moved, 1);
  assert.strictEqual(B.startDate, '2026-11-07');
  assert.strictEqual(B.endDate, '2026-11-09'); // giữ 2 ngày làm việc, bỏ qua CN 08/11
  assert.strictEqual(P.startDate, '2026-11-02');
});

test('Giữ khoảng cách (lag) khi dời', () => {
  cfg();
  const A = { id: 'A', startDate: '2026-11-02', endDate: '2026-11-03' };
  const B = { id: 'B', startDate: '2026-11-06', endDate: '2026-11-06' }; // cách 2 ngày làm việc
  const tasks = [A, B];
  S.addPredecessorLink(B, A, tasks);
  assert.strictEqual(B.predecessors[0].lag, 2);
  A.endDate = '2026-11-04';
  S.propagateLinkedTasks(['A'], tasks);
  assert.strictEqual(B.startDate, '2026-11-07');
});

test('Chặn liên kết vòng lặp', () => {
  const A = { id: 'A', startDate: '2026-11-02', endDate: '2026-11-03' };
  const B = { id: 'B', startDate: '2026-11-04', endDate: '2026-11-05', predecessors: [{ id: 'A', type: 'FS', lag: 0 }] };
  assert.strictEqual(S.addPredecessorLink(A, B, [A, B]), false);
});

test('Tự nối dữ liệu cũ: chỉ nối khi việc sau bắt đầu sau khi việc trước kết thúc', () => {
  cfg();
  const tasks = [
    { id: '1', calendarId: 'c', startDate: '2026-11-06', endDate: '2026-11-09' },
    { id: '2', calendarId: 'c', startDate: '2026-11-06', endDate: '2026-11-10' },
    { id: '3', calendarId: 'c', startDate: '2026-11-11', endDate: '2026-11-12' },
    { id: '4', calendarId: 'x', startDate: '2026-11-20', endDate: '2026-11-21' }
  ];
  S.inferMissingPredecessors(tasks);
  assert.deepStrictEqual(tasks[1].predecessors, []);
  assert.strictEqual(tasks[2].predecessors[0].id, '2');
  assert.deepStrictEqual(tasks[3].predecessors, []); // dự án khác
});

test('Xoá liên kết trỏ tới việc đã bị xoá', () => {
  const tasks = [{ id: 'B', predecessors: [{ id: 'gone', type: 'FS', lag: 0 }] }];
  S.cleanupDanglingLinks(tasks);
  assert.deepStrictEqual(tasks[0].predecessors, []);
});
