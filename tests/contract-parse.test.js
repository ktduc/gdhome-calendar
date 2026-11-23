const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const {parseContract, docxText} = require('../contract-parse.js');
const {projectRow, taskKind, designFeeAfterDiscount} = require('../project-table.js');

// Đoạn chữ theo mẫu HĐTK GD HOME (dữ liệu giả)
const sample = [
  'HỢP ĐỒNG THIẾT KẾ NỘI THẤT', 'Số: HDKT/GD-TK/05032026', '(V/v: Thiết kế nội thất)',
  'Hôm nay, ngày      tháng 03 năm 2026, tại văn phòng Công ty Cổ phần Nội thất GD, chúng tôi gồm;',
  'ĐẠI DIỆN BÊN A\t: CHỦ ĐẦU TƯ', 'Đại diện\t: Bà Nguyễn Thị Mẫu', 'Điện thoại\t: 0912 000 111',
  'Địa chỉ                      : Số 1 Phố Thử, Hà Nội.',
  'ĐẠI DIỆN BÊN B\t: CÔNG TY CỔ PHẦN NỘI THẤT GD', 'Địa chỉ\t: Số 35 ngách 16', 'Điện thoại\t: 0999999999',
  '- Bên A đồng ý giao khoán và bên B đồng ý nhận thầu về việc: “Thiết kế nội thất” cho bên A có địa chỉ tại Căn 1201, Tòa Mẫu, Hà Nội',
  '- Khối lượng thiết kế : 85,5 m2                             Đơn giá thiết kế: 250.000 VNĐ',
  '- Thuế VAT 8%',
  '- Giá trị hợp đồng bao gồm thuế VAT 8%: 23.085.000 VND (Bằng chữ: …)',
  '- Đợt 1: Ngay sau khi 2 bên ký kết hợp đồng này, Bên A đặt cọc cho Bên B số tiền là: 11.542.500 VNĐ (…).',
  '- Đợt 2: Ngay sau khi Bên A nhận file dữ liệu bản vẽ phối cảnh 3D nội thất cuối cùng từ Bên B, Bên A tạm ứng cho Bên B số tiền là: 6.925.500 VNĐ (…).',
  '- Đợt 3: Ngay sau khi Bên B bàn giao toàn bộ file dữ liệu hồ sơ kỹ thuật thi công cho Bên A, Bên A thanh toán số tiền còn lại là 4.617.000 VNĐ (…)',
  ' Giai đoạn triển khai layout: sau 05 ngày làm việc từ ngày chính thức kí hợp đồng bên B trình bên A bản layout bố trí mặt bằng đầu tiên.',
  ' Sau 12 ngày làm việc kể từ ngày ký hợp đồng và chốt layout mặt bằng, bên B trình cho bên A phương án thiết kế phối cảnh 3D lần 01.',
  ' Trong 10 ngày tiếp theo, hai bên bàn bạc, chỉnh sửa và thống nhất phương án cuối cùng.',
  ' Thời gian triển khai và bàn giao hồ sơ kỹ thuật chi tiết nội thất: 08 ngày kể từ ngày thống nhất phương án thiết kế phối cảnh 3D cuối cùng.',
  ' Phòng khách: 40 m2', ' Phòng ngủ: 45,5 m2',
].join('\n');

test('HĐTK: lấy hồ sơ, thanh toán và mốc tiến độ từ chữ hợp đồng', () => {
  const {profile, payments, milestones} = parseContract(sample);
  assert.equal(profile.customer, 'Chị Nguyễn Thị Mẫu');
  assert.equal(profile.phone, '0912000111');
  assert.equal(profile.contractNo, 'HDKT/GD-TK/05032026');
  assert.equal(profile.signedAt, '2026-03-05');
  assert.equal(profile.address, 'Căn 1201, Tòa Mẫu, Hà Nội');
  assert.equal(profile.customerAddress, 'Số 1 Phố Thử, Hà Nội.');
  assert.equal(profile.area, '85.5');
  assert.equal(profile.designPrice, '250000');
  assert.equal(profile.designValue, '23085000');
  assert.equal(profile.representative, undefined);
  assert.match(profile.note, /Phòng khách: 40 m²; Phòng ngủ: 45,5 m²/);
  assert.deepEqual(payments.map(p => [p.milestone, p.amount]), [['Ký hợp đồng', '11542500'], ['Chốt 3D', '6925500'], ['Giao HSKT', '4617000']]);
  assert.deepEqual(milestones.map(m => [m.kind, m.days]), [['layout', 5], ['3d', 12], ['edit3d', 10], ['hskt', 8]]);
});

test('HĐTK: đọc chữ từ file .docx (zip nén deflate)', async () => {
  const xml = Buffer.from('<w:document><w:body><w:p><w:r><w:t>HỢP ĐỒNG</w:t></w:r></w:p><w:p><w:r><w:t>Số: A&amp;B</w:t><w:tab/><w:t>x</w:t></w:r></w:p></w:body></w:document>');
  const data = zlib.deflateRawSync(xml), name = Buffer.from('word/document.xml');
  const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(8, 8);
  local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);
  const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(8, 10);
  central.writeUInt32LE(data.length, 20); central.writeUInt32LE(xml.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(0, 42);
  const offset = local.length + name.length + data.length;
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + name.length, 12); end.writeUInt32LE(offset, 16);
  const zip = Buffer.concat([local, name, data, central, name, end]);
  assert.equal(await docxText(zip), 'HỢP ĐỒNG\nSố: A&B\tx\n');
});

test('Bảng dự án: hạn sắp tới, trễ hạn, trạng thái 3D/HSKT và người làm suy từ Lịch', () => {
  const schedule = {
    calendars: [{id: 'c1', ownerId: 'p1'}, {id: 'c2', ownerId: 'p2'}],
    tasks: [
      {id: 't1', calendarId: 'c1', title: '3D - CHỊ A', startDate: '2026-11-01', endDate: '2026-11-10', progress: 100, assignee: 'GD-NHẬT'},
      {id: 't2', calendarId: 'c1', title: 'CHỈNH SỬA 3D - CHỊ A', startDate: '2026-11-18', endDate: '2026-11-25', assignee: 'GD-NHẬT, TỊNH VŨ'},
      {id: 't3', calendarId: 'c1', title: 'HSKT - CHỊ A', startDate: '2026-11-26', endDate: '2026-12-05', assignee: 'MAI ANH'},
      {id: 't4', calendarId: 'c1', title: 'GỬI HỒ SƠ - CHỊ A', startDate: '2026-11-15', endDate: '2026-11-16'},
      {id: 't5', calendarId: 'c2', title: '3D - KHÁC', startDate: '2026-11-01', endDate: '2026-11-02'},
    ],
  };
  const row = projectRow({id: 'p1'}, schedule, '2026-11-20');
  assert.deepEqual(row.deadline, {start: '2026-11-18', end: '2026-11-25', label: 'CHỈNH SỬA 3D', daysLeft: 5, taskId: 't2'});
  assert.deepEqual(row.overdue, [{end: '2026-11-16', label: 'GỬI HỒ SƠ', taskId: 't4'}]);
  assert.equal(row.status3d, 'Đang chỉnh sửa');
  assert.equal(row.statusHskt, 'Chưa làm');
  assert.equal(row.designer3d, 'GD-NHẬT, TỊNH VŨ');
  assert.equal(row.designerHskt, 'MAI ANH');
  assert.equal(projectRow({id: 'p1'}, schedule, '2026-12-20').statusHskt, 'Đã gửi');
  assert.equal(projectRow({id: 'p1'}, schedule, '2026-12-20').status3d, 'Xong lần 2');
  assert.equal(taskKind('HSKT - X'), 'hskt');
  assert.equal(designFeeAfterDiscount(100e6, 5e9), 0);
  assert.equal(designFeeAfterDiscount(100e6, 3e9), 50e6);
  assert.equal(designFeeAfterDiscount(100e6, 1e9), 100e6);
});
