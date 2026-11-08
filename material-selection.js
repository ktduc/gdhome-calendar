const selectedMaterialRows = new Set();
let materialRangeAnchor = null;

const rowCheckboxes = (root = box()) => [...root.querySelectorAll('[data-select-row]')];
const selectedRows = () => sheet.groups.flatMap(group => group.rows.filter(row => selectedMaterialRows.has(row.id)));

function syncSelectAll(checkbox,rows) {
  const count = rows.filter(input => selectedMaterialRows.has(input.dataset.selectRow)).length;
  checkbox.checked = !!count && count === rows.length;
  checkbox.indeterminate = !!count && count < rows.length;
  checkbox.disabled = rows.length === 0;
}

function refreshRowSelection() {
  const rowInputs = rowCheckboxes();
  for (const input of rowInputs) {
    input.checked = selectedMaterialRows.has(input.dataset.selectRow);
    input.closest('tr').classList.toggle('material-selected',input.checked);
  }
  syncSelectAll(box().querySelector('[data-select-all]'),rowInputs);
  for (const input of box().querySelectorAll('[data-select-group]')) {
    syncSelectAll(input,rowCheckboxes(input.closest('tbody')));
  }
  const toolbar = byId('material-multiselect');
  const count = selectedRows().length;
  toolbar.hidden = count === 0;
  toolbar.innerHTML = count ? '<strong>Đã chọn ' + count + ' dòng</strong>' +
    '<button data-action="bulk-delete">Xoá</button><button data-action="bulk-duplicate">Nhân bản</button>' +
    '<select data-bulk="decision" aria-label="Đổi trạng thái"><option value="">Đổi trạng thái ▾</option>' +
    Object.entries({...statusLabels,ordered:'Đã đặt hàng'}).map(([key,label]) => option(key,label)).join('') + '</select>' +
    '<select data-bulk="group" aria-label="Chuyển sang nhóm"><option value="">Chuyển sang nhóm ▾</option>' +
    sheet.groups.map(group => option(group.id,group.name)).join('') + '</select><button data-action="bulk-clear">Bỏ chọn</button>' : '';
}

function clearRowSelection() {
  selectedMaterialRows.clear();
  materialRangeAnchor = null;
  refreshRowSelection();
}

function handleRowSelectionClick(event) {
  const target = event.target;
  if (target.matches('[data-select-all],[data-select-group]')) {
    const root = target.matches('[data-select-all]') ? box() : target.closest('tbody');
    for (const input of rowCheckboxes(root)) setMembership(selectedMaterialRows,input.dataset.selectRow,target.checked);
    materialRangeAnchor = null;
    refreshRowSelection();
    return true;
  }
  const modified = event.ctrlKey || event.metaKey || event.shiftKey;
  const row = target.closest('tr[data-row]');
  const input = target.matches('[data-select-row]') ? target :
    modified && !target.closest('input,select,textarea,button,a') && row?.querySelector('[data-select-row]');
  if (!input) return false;
  const id = input.dataset.selectRow;
  if (event.shiftKey && materialRangeAnchor) {
    const visible = rowCheckboxes().map(checkbox => checkbox.dataset.selectRow);
    const from = visible.indexOf(materialRangeAnchor);
    const to = visible.indexOf(id);
    if (from >= 0) for (const rowId of visible.slice(Math.min(from,to),Math.max(from,to)+1)) selectedMaterialRows.add(rowId);
    else selectedMaterialRows.add(id);
  } else {
    setMembership(selectedMaterialRows,id,!selectedMaterialRows.has(id));
    materialRangeAnchor = id;
  }
  refreshRowSelection();
  return true;
}

function handleRowSelectionKey(event) {
  if (!selectedMaterialRows.size) return false;
  if (event.key === 'Escape') clearRowSelection();
  else if (event.key === 'Delete' && !event.target.closest('input:not([type=checkbox]),textarea,select,[contenteditable]')) {
    removeMaterialRows(selectedRows());
  } else return false;
  event.preventDefault();
  return true;
}

function canRemoveRows(rows) {
  const protectedIds = new Set(materials.signedRows?.[sheet.id] || []);
  if (!rows.some(row => protectedIds.has(row.id))) return true;
  say('Không thể xoá dòng thuộc bản đã ký. Bỏ chọn các dòng đó rồi thử lại.');
  return false;
}

function removeMaterialRows(rows) {
  if (!rows.length || !canRemoveRows(rows) || !confirm('Xoá ' + rows.length + ' dòng khỏi bản nháp?')) return;
  const ids = new Set(rows.map(row => row.id));
  modify(() => {
    for (const group of sheet.groups) group.rows = group.rows.filter(row => !ids.has(row.id));
    for (const id of ids) selectedMaterialRows.delete(id);
    materialRangeAnchor = null;
  });
}

function duplicateMaterialRows() {
  modify(() => {
    for (const group of sheet.groups) {
      group.rows = group.rows.flatMap(row => selectedMaterialRows.has(row.id) ? [row,duplicate(row)] : [row]);
    }
  });
}

const requiresChosenOption = decision => decision === 'ordered' || decision === 'chosen';

function setRowDecision(row,decision) {
  if (requiresChosenOption(decision) && row.chosen == null) return false;
  row.ordered = decision === 'ordered';
  row.decision = row.ordered ? 'chosen' : decision;
  if (decision === 'draft' || decision === 'sent') row.chosen = null;
  return true;
}

function applyBulkChange(field) {
  const value = field.value;
  field.value = '';
  if (!value) return;
  const rows = selectedRows();
  if (field.dataset.bulk === 'decision') {
    if (requiresChosenOption(value) && rows.some(row => row.chosen == null)) {
      say('Chọn PA cho mọi dòng trước khi chốt hoặc đặt hàng.');
      return;
    }
    modify(() => rows.forEach(row => setRowDecision(row,value)));
    return;
  }
  const destination = sheet.groups.find(group => group.id === value);
  if (!destination) return;
  modify(() => {
    for (const group of sheet.groups) {
      if (group === destination) continue;
      destination.rows.push(...group.rows.filter(row => selectedMaterialRows.has(row.id)));
      group.rows = group.rows.filter(row => !selectedMaterialRows.has(row.id));
    }
  });
}
