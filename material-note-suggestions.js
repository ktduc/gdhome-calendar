// Từ khóa khớp tên hạng mục hoặc danh mục sau khi bỏ dấu.
const materialNoteDefaults = [
  [/\bson\b/, ['Cần chốt mã màu sơn hoàn thiện','Sơn 2 nước phủ']],
  [/\bphao\b/, ['Mã theo chỉ định thiết kế','Cần duyệt mẫu và mã màu']],
  [/\bgach\b/, ['Kích thước 600×600','Ron 2mm']],
  [/\bda\b/, ['Duyệt mẫu đá thực tế','Xác nhận bo cạnh và vị trí mối nối']],
  [/\bkinh\b/, ['Xác nhận độ dày kính','Chốt màu phụ kiện đồng bộ']],
  [/\b(go|melamine|pvc)\b/, ['Duyệt mẫu vân và màu thực tế','Xác nhận mã cạnh đồng màu']],
  [/\b(rem|ni)\b/, ['Duyệt mẫu vải thực tế','Xác nhận mã màu và độ dày vải']],
  [/\b(den|cong tac|o cam)\b/, ['Chốt mã thiết bị và màu hoàn thiện','Đối chiếu kích thước lắp đặt']]
];
const splitMaterialNotes = value => (value || '').split(';').map(note => note.trim()).filter(Boolean);

function materialNoteCategory(name) {
  const key = normalized(name);
  return materialNoteDefaults.find(([pattern]) => pattern.test(key));
}

function materialNoteChoices(group,row) {
  const category = materialNoteCategory(row.name) || materialNoteCategory(group.name);
  const groupKey = normalized(group.name.split('(')[0]);
  const learned = [];
  const candidates = [sheet,...materials.sheets.filter(saved => saved.id !== sheet.id)];
  for (const current of candidates) for (const other of current.groups) {
    const sameGroup = normalized(other.name.split('(')[0]) === groupKey;
    const groupCategory = materialNoteCategory(other.name);
    for (const source of other.rows) {
      if (source.id === row.id || !source.note) continue;
      const sourceCategory = materialNoteCategory(source.name) || groupCategory;
      if (category ? sourceCategory === category : sameGroup) learned.push(...splitMaterialNotes(source.note));
    }
  }
  const all = [...(row.noteSuggestions || []).flatMap(splitMaterialNotes),
    ...(category?.[1] || ['Xác nhận mẫu thực tế trước khi đặt hàng','Đối chiếu với hồ sơ thiết kế']),...learned];
  return [...new Set(all)].slice(0,100);
}

function openMaterialNotes(field,group,row) {
  const element = dialog('<h2>Ghi chú · ' + html(row.name || group.name) + '</h2>' +
    '<form class="material-notes-form"><label>Ghi chú hiện tại<textarea name="note" maxlength="2000">' +
    html(field.value) + '</textarea></label><label>Tìm gợi ý<input type="search" name="query" autofocus></label>' +
    '<div class="material-note-choices">' + materialNoteChoices(group,row).map(note =>
      '<label><input type="checkbox" name="suggestion" value="' + html(note) + '"> ' + html(note) + '</label>').join('') +
    '<p class="material-notes-empty" hidden>Không có gợi ý phù hợp.</p></div>' +
    '<p class="material-notes-message" role="status"></p><div class="toolbar">' +
    '<button type="button" data-note-cancel>Huỷ</button><button class="primary">Lưu ghi chú</button></div></form>');
  const form = element.querySelector('.material-notes-form');
  const query = form.elements.query;
  const entries = [...form.querySelectorAll('input[name="suggestion"]')];
  query.focus();
  query.oninput = () => {
    const search = normalized(query.value);
    for (const entry of entries) entry.closest('label').hidden = !normalized(entry.value).includes(search);
    form.querySelector('.material-notes-empty').hidden = entries.some(entry => !entry.closest('label').hidden);
  };
  form.querySelector('[data-note-cancel]').onclick = () => element.close();
  form.onsubmit = event => {
    event.preventDefault();
    const manual = form.elements.note.value.trim();
    const selected = entries.filter(entry => entry.checked).map(entry => entry.value);
    const value = selected.length ? [...new Set([...splitMaterialNotes(manual),...selected])].join('; ') : manual;
    if (value.length > 2000) {
      form.querySelector('.material-notes-message').textContent = 'Ghi chú tối đa 2.000 ký tự.';
      return;
    }
    if (value !== (row.note || '')) modify(() => { row.note = value; },false);
    field.value = field.defaultValue = value;
    element.close();
  };
}
