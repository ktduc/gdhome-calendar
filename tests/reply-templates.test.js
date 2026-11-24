const test = require('node:test');
const assert = require('node:assert/strict');
const {applyVars, buildMessage, mergeTemplates, softenEnding, fold, BASE} = require('../mau-tra-loi-data.js');
const {normalizeDoc} = require('../reply-templates.js');

test('thay biến xưng hô, viết hoa đầu câu', () => {
  assert.equal(applyVars('{toi} chào {kh} - {toi} {ten} sẽ phụ trách {du_an} ạ', {kh: 'chị'}), 'Em chào chị - em Đức sẽ phụ trách nhà mình ạ');
  assert.equal(applyVars('{kh} ơi, {toi} gửi {kh} nhé', {kh: 'anh chị', ten: 'Nam'}), 'Anh chị ơi, em gửi anh chị nhé');
  assert.equal(applyVars('Xin chào.\n{kh} xem giúp {toi}. {toi} cảm ơn', {kh: 'em'}), 'Xin chào.\nEm xem giúp anh. Anh cảm ơn');
});

test('mọi mẫu gốc thay hết biến ở cả 4 cách gọi', () => {
  assert.ok(BASE.length >= 15 && BASE.length <= 25);
  for (const kh of ['chị', 'anh', 'anh chị', 'em']) for (const t of BASE) {
    const text = buildMessage(t, {kh, du_an: 'căn A1201'});
    assert.doesNotMatch(text, /\{[a-z_]+\}/, t.id);
  }
});

test('checklist chỉ giữ ý được tick và đánh số lại', () => {
  const t = BASE.find(x => x.id === 'note-thiet-bi');
  const text = buildMessage(t, {kh: 'anh'}, new Set([0]));
  assert.match(text, /1\/ Bếp:/);
  assert.match(text, /2\/ Logia:/);
  assert.doesNotMatch(text, /Robot hút bụi/);
});

test('ghép mẫu gốc với phần đã sửa theo id', () => {
  const merged = mergeTemplates(BASE, {items: [{...BASE[0], title: 'Sửa'}, {id: 'moi', group: 'Khác', title: 'Mới', body: 'x', items: []}], deleted: [BASE[1].id]});
  assert.equal(merged[0].title, 'Sửa');
  assert.ok(merged[0]._edited);
  assert.ok(!merged.some(t => t.id === BASE[1].id));
  assert.equal(merged.at(-1).id, 'moi');
});

test('server lọc dữ liệu mẫu: giới hạn mẫu và độ dài', () => {
  const doc = normalizeDoc({items: [{id: 'a', title: 'T', body: 'x'.repeat(9999), items: ['i', '']}, {id: 'bad id', title: 'T'}, {id: 'a', title: 'trùng'}, {id: 'c', title: ''}], deleted: ['chao', 'sai id!']});
  assert.equal(doc.items.length, 1);
  assert.equal(doc.items[0].body.length, 4000);
  assert.deepEqual(doc.items[0].items, ['i']);
  assert.deepEqual(doc.deleted, ['chao']);
  assert.equal(normalizeDoc({items: Array.from({length: 500}, (_, i) => ({id: 'x' + i, title: 't'}))}).items.length, 300);
});

test('khách xưng "em": bỏ "ạ" cuối câu, anh/chị giữ nguyên', () => {
  assert.equal(softenEnding('Gửi giúp {toi} nhé ạ. Cảm ơn nhiều ạ!', 'em'), 'Gửi giúp {toi} nhé. Cảm ơn nhiều nhé!');
  assert.equal(softenEnding('Mình đã chốt chưa ạ?', 'em'), 'Mình đã chốt chưa em?');
  assert.equal(softenEnding('Vâng ạ, em xem\nDạ ạ', 'Em'), 'Vâng nhé, em xem\nDạ nhé');
  assert.equal(softenEnding('Dạ, bạn Hạnh ở đạo ạ', 'em'), 'Dạ, bạn Hạnh ở đạo nhé');
  assert.equal(softenEnding('Cảm ơn nhiều ạ.', 'chị'), 'Cảm ơn nhiều ạ.');
  assert.equal(applyVars('{toi} cảm ơn {kh} ạ.', {kh: 'em'}), 'Anh cảm ơn em nhé.');
  assert.match(buildMessage(BASE.find(x => x.id === 'chao'), {kh: 'em'}), /phụ trách thiết kế nhà mình nhé$/);
  assert.match(buildMessage(BASE.find(x => x.id === 'chao'), {kh: 'anh'}), /ạ$/);
});

test('tìm kiếm không phân biệt dấu', () => {
  assert.ok(fold('Nhà phố Đẹp').includes(fold('nha pho')));
  assert.equal(fold('Đường'), 'duong');
});
