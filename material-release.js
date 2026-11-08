function installRelease() {
  byId('release-actions').innerHTML = [['publish','Phát hành link khách'],['history','Biên bản / Lịch sử'],
    ['settings','Điều khoản mẫu'],['buy','Excel mua hàng']].map(([key,label]) =>
      '<button class="hdr-menu-item" id="material-' + key + '">' + label + '</button>').join('');
  byId('image-actions').innerHTML = '<div class="hdr-split-group"><button class="btn btn-success hdr-split-main" id="material-copy" data-header-command="copy" data-image-mode="copy">' +
    headerIcon('copy') + '<span class="btn-label">Copy ảnh</span></button><details class="hdr-dropdown">' +
    '<summary class="btn btn-success hdr-split-caret" aria-label="Tuỳ chọn xuất ảnh"><span class="hdr-caret">▾</span></summary>' +
    '<div class="hdr-dropdown-menu"><button class="hdr-menu-item" data-image-mode="copy">Copy ảnh bảng</button>' +
    '<button class="hdr-menu-item" data-image-mode="png">Tải PNG</button><button class="hdr-menu-item" data-image-mode="pdf">Tải PDF A4</button></div></details></div>';
  byId('image-actions').onclick = event => {
    const mode = event.target.closest('[data-image-mode]')?.dataset.imageMode;
    if (!mode) return;
    byId('image-actions').querySelector('details').open = false;
    safeRelease(() => statistics(mode));
  };

  byId('material-publish').onclick = () => safeRelease(publish);
  byId('material-history').onclick = () => safeRelease(historyDialog);
  byId('material-settings').onclick = () => safeRelease(settingsDialog);
  byId('material-buy').onclick = event => { event.target.closest('details').open = false; safeRelease(exportPurchasing); };
}
async function safeRelease(task) {
  try {
    await flushSave();
    if (dirty || saving || conflict || !sheet?.id) throw new Error('Cần lưu bảng trước.');
    await task();
  } catch (error) { showError(error); }
}
const releasePath = () => '/api/materials/sheets/' + sheet.id + '/review';
function replaceSaved(result) {
  materials._version = result._version;
  if (!result.sheet) return;
  materials.sheets[materials.sheets.findIndex(s => s.id === result.sheet.id)] = result.sheet;
  sheet = structuredClone(result.sheet);
}
async function publish() {
  const result = await post(releasePath(),{ _version:materials._version,action:'publish' });
  replaceSaved(result);
  renderEditor();
  const url = location.origin + result.path;
  dialog('<h2>Đã phát hành</h2><p>Link chưa ký có hiệu lực 14 ngày. Mỗi lần phát hành lại sẽ thu hồi link chưa ký cũ.</p><input id="issued-link" readonly value="' +
    html(url) + '"> <a class="button" href="' + html(result.path) + '" target="_blank" rel="noopener noreferrer">Mở bản khách</a>');
  byId('issued-link').select();
}
async function settingsDialog() {
  const result = await request('/api/materials/settings');
  const settings = result.settings;
  const element = dialog('<h2>Điều khoản mẫu</h2><form id="settings-form" class="stack">' +
    [['representative','Đại diện Bên B'],['position','Chức vụ'],['address','Địa chỉ Bên B']].map(([key,label]) =>
      '<label>' + label + '<input name="' + key + '" value="' + html(settings[key]) + '"></label>').join('') +
    '<label>Điều 2–4<textarea name="terms" rows="16" required>' + html(settings.terms) + '</textarea></label>' +
    '<p>TODO · Bổ sung phần cuối câu “…lập một bản Biên bản hợp” từ bản giấy.</p><button class="primary">Lưu cài đặt</button></form>');
  byId('settings-form').onsubmit = async event => {
    event.preventDefault();
    try {
      const saved = await post('/api/materials/settings',{ _version:result._version,settings:Object.fromEntries(new FormData(event.target)) });
      // A remote signing may have changed the draft since this editor opened.
      if (saved._version === materials._version+1) materials._version = saved._version;
      element.close();
      say('Đã lưu điều khoản mẫu.');
    } catch (error) { showError(error); }
  };
}
async function historyDialog() {
  const result = await request(releasePath());
  const element = dialog('<h2>Biên bản và lịch sử</h2><button id="refresh-material">Tải lại bảng từ máy chủ</button>' +
    [...result.revisions].reverse().map((view,i) => '<article><strong>Bản ' + (result.revisions.length-i) + ' · ' + html(vnDate(view.publishedAt)) +
      '</strong><p>' + (view.revoked?'Đã thu hồi · ':'') + (view.customer?'A đã ký':'Chờ A ký') + ' · ' + (view.company?'B đã ký':'Chờ B ký') +
      '</p>' + (view.customer || view.company ? '<div class="print-signatures history-signatures"><div><strong>Bên A</strong>' + signatureMark(view.customer) +
        '</div><div><strong>Bên B</strong>' + signatureMark(view.company) + '</div></div>' : '') +
      '<button data-print-revision="' + view.id + '">Biên bản A4</button> ' +
      (view.customer && !view.company ? '<button data-company="' + view.id + '">Bên B xác nhận</button> ' : '') +
      (view.revoked ? '' : '<button data-revoke="' + view.id + '">Thu hồi link</button>') + '</article>').join('') +
    '<ol>' + [...result.audit].reverse().map(entry => '<li>' + html(vnDate(entry.at) + ' · ' + entry.actor + ' · ' +
      ({ published:'Phát hành',revoked:'Thu hồi', 'customer-signed':'Bên A ký','company-signed':'Bên B ký','change-requested':'Yêu cầu đổi','draft-choice':'Sửa phương án bản nháp' })[entry.event] +
      (entry.reason ? ' · '+entry.reason : entry.row ? ' · '+entry.row+' · '+(entry.previous.code || '—')+' → '+(entry.next.code || '—') : '')) + '</li>').join('') + '</ol>');
  element.onclick = event => {
    const { printRevision,company,revoke } = event.target.dataset;
    const view = result.revisions.find(r => r.id === (printRevision || company || revoke));
    if (!view) return;
    if (printRevision) { element.close(); return showPrint(view,'/api/materials/assets/',authHeaders()).catch(showError); }
    if (company) { element.close(); return companyDialog(view,result._version); }
    if (confirm('Thu hồi link bản này?')) safeRelease(async () => {
      const saved = await post(releasePath(),{ _version:result._version,action:'revoke',revisionId:view.id });
      if (saved._version === materials._version+1) materials._version = saved._version;
      element.close(); await historyDialog();
    });
  };
  byId('refresh-material').onclick = async () => {
    try {
      const data = await request('/api/materials');
      const fresh = data.sheets.find(s => s.id === sheet.id);
      materials = data;
      openSheet(fresh);
    } catch (error) { showError(error); }
  };
}
function companyDialog(view,version) {
  const element = dialog('<h2>Bên B xác nhận</h2><p>Xác nhận bản khách đã ký ngày ' + html(vnDate(view.customer.at)) +
    '</p><form id="company-form">' + signatureForm('company') + ' <button class="primary">Ký xác nhận</button></form>');
  const readSignature = setupSignature('company');
  byId('company-name').value = view.settings.representative;
  byId('company-form').onsubmit = event => {
    event.preventDefault();
    safeRelease(async () => {
      const saved = await post(releasePath(),{ _version:version,action:'company',revisionId:view.id,...readSignature() });
      if (saved._version === materials._version+1) materials._version = saved._version;
      element.close();
      await historyDialog();
    });
  };
}
const exportLabels = {copy:'Copy ảnh bảng',png:'Tải PNG',pdf:'Tải PDF A4'};
function materialExportKey() {
  return 'gdhome-material-export:' + (session()?.user?.email?.toLowerCase() || 'local');
}
function savedMaterialExportScope() {
  if (materialView.export) return materialView.export;
  try { return JSON.parse(localStorage.getItem(materialExportKey())) || {}; }
  catch { return {}; }
}
function statistics(mode) {
  const rooms = [...new Set(sheet.groups.flatMap(g => g.rows.map(row => row.room)).filter(Boolean))];
  const saved = savedMaterialExportScope();
  const element = dialog('<h2>' + exportLabels[mode] + '</h2><form id="material-image-scope">' +
    '<label><span>Danh mục</span><select name="groups">' +
    option('visible','Chỉ nhóm đang bật',saved.groups === 'all' ? 'all' : 'visible') + option('all','Tất cả',saved.groups) + '</select></label>' +
    '<label><span>Dòng</span><select name="rows">' + option('all','Tất cả',saved.rows !== 'chosen' ? 'all' : '') +
    option('chosen','Chỉ dòng đã chốt',saved.rows) + '</select></label>' +
    '<label><span>Phòng</span><select name="room"><option value="">Tất cả</option>' +
    rooms.map(room => option(room,room,saved.room)).join('') + '</select></label>' +
    '<p id="export-scope-status" role="status"></p><button class="primary">Xem trước</button></form>');

  byId('material-image-scope').onsubmit = async event => {
    event.preventDefault();
    const scope = new FormData(event.target);
    setMaterialView({export:Object.fromEntries(scope)});
    const filtered = { ...sheet,groups:sheet.groups
      .filter(group => scope.get('groups') !== 'visible' || !hiddenGroups.has(group.id))
      .map(group => ({ ...group,rows:group.rows.filter(row =>
        (scope.get('rows') !== 'chosen' || (row.chosen != null && row.decision === 'chosen')) &&
        (!scope.get('room') || row.room === scope.get('room'))) }))
      .filter(group => group.rows.length) };
    if (!filtered.groups.length) { byId('export-scope-status').textContent = 'Phạm vi này không có dòng vật liệu.'; return; }
    element.close();
    await showStatistics(filtered,mode);
  };
}
async function showStatistics(filtered,mode) {
  try {
    const overlay = await showPrint({ sheet:filtered },'/api/materials/assets/',authHeaders(),true);
    if (!overlay.isConnected) return;
    byId('print-extras').innerHTML = ' <button id="stats-download">Tải PNG</button> <button id="stats-copy">Copy ảnh</button> <span id="export-image-status" role="status"></span>';
    const download = byId('stats-download');
    const copy = byId('stats-copy');
    const print = byId('do-print');
    const selected = { copy,png:download,pdf:print }[mode];
    selected.classList.add('primary');
    selected.focus();
    download.onclick = () => exportStatsImage(false).catch(showExportError);
    copy.onclick = () => exportStatsImage(true).catch(showExportError);
  } catch (error) { showError(error); }
}
function showExportError(error) {
  const notice = byId('export-image-status');
  if (notice) notice.textContent = error.message;
}

let canvasLoader;
async function exportStatsImage(copy) {
  if (!window.html2canvas) {
    canvasLoader ||= new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
      script.onload = resolve;
      script.onerror = () => { canvasLoader = null; reject(new Error('Không tải được bộ xuất ảnh.')); };
      document.head.append(script);
    });
    await canvasLoader;
  }
  const root = byId('print-sheet');
  if (root.scrollHeight > 12000) throw new Error('Bảng quá dài để xuất một ảnh. Lọc theo phòng hoặc dùng PDF.');
  const canvas = await html2canvas(root,{ scale:2,backgroundColor:'#fff',onclone:doc => doc.getElementById('print-sheet').classList.remove('watermark') });
  if (copy) return copyCanvasToClipboard(canvas,{ notify:message => { const notice = byId('export-image-status'); if (notice) notice.textContent = message; },fallbackName:'GD-HOME-vat-lieu.png' });
  downloadCanvas(canvas,'GD-HOME-vat-lieu.png');
}
async function exportPurchasing() {
  const includePrice = confirm('Thêm cột giá vào bản Excel mua hàng?');
  const XLSX = await loadXlsx();
  const lines = [['Nhóm','Hạng mục','Phòng','PA','Hãng','Mã','Màu','Kích thước','Quy cách','Khối lượng','Đơn vị','NCC / Nhà thầu',...(includePrice?['Giá']:[]),'Ghi chú']];
  for (const group of sheet.groups) for (const row of group.rows) {
    if (row.chosen == null || row.decision !== 'chosen' || (sheetRoom && row.room !== sheetRoom)) continue;
    const pa = row.options[row.chosen];
    lines.push([group.name,row.name,row.room,row.chosen+1,pa.brand,pa.code,pa.color,pa.size,pa.finish || row.spec,row.qty,row.unit,
      pa.supplier || row.supplier,...(includePrice?[pa.price]:[]),row.note]);
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet(lines),'Mua hàng');
  XLSX.writeFile(book,'GD-HOME-mua-hang.xlsx');
}
