function installRelease() {
  byId('release-actions').innerHTML = [['publish','Phát hành link khách'],['history','Biên bản / Lịch sử'],
    ['settings','Điều khoản mẫu'],['buy','Excel mua hàng']].map(([key,label]) =>
      '<button class="hdr-menu-item" id="material-' + key + '">' + label + '</button>').join('');
  byId('image-actions').innerHTML = '<div class="hdr-split-group shell-copy-controls"><button class="btn btn-success hdr-split-main" id="material-copy" data-header-command="copy" data-image-mode="copy">' +
    headerIcon('copy') + '<span class="btn-label">Copy ảnh</span></button><details class="hdr-dropdown">' +
    '<summary class="btn btn-success hdr-split-caret" aria-label="Tuỳ chọn xuất ảnh"><span class="hdr-caret">▾</span></summary>' +
    '<div class="hdr-dropdown-menu"><button class="hdr-menu-item" data-image-mode="copy">Copy ảnh bảng</button>' +
    '<button class="hdr-menu-item" data-image-mode="preview">Xem trước</button>' +
    '<button class="hdr-menu-item" data-image-mode="png">Tải PNG</button><button class="hdr-menu-item" data-image-mode="pdf">Tải PDF A4</button>' +
    '<hr style="margin:4px 0;border:0;border-top:1px solid #cbd5e1">' +
    '<button class="hdr-menu-item" id="material-export-settings" data-action="export-settings">⚙ Cài đặt xuất…</button></div></details></div>';
  byId('image-actions').onclick = event => {
    const settingsBtn = event.target.closest('#material-export-settings,[data-action="export-settings"]');
    if (settingsBtn) {
      byId('image-actions').querySelector('details').open = false;
      safeRelease(() => statistics('settings'));
      return;
    }
    const mode = event.target.closest('[data-image-mode]')?.dataset.imageMode;
    if (!mode) return;
    byId('image-actions').querySelector('details').open = false;
    safeRelease(() => runDirectExport(mode));
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
const releasePath = (id = sheet.id) => '/api/materials/sheets/' + encodeURIComponent(id) + '/review';
function replaceSaved(result) {
  materials._version = result._version;
  if (!result.sheet) return;
  materials.sheets[materials.sheets.findIndex(s => s.id === result.sheet.id)] = result.sheet;
  sheet = structuredClone(result.sheet);
  sheet.meta = {...sheet.meta,...materials.profiles?.[sheet.projectId]};
}
async function publish() {
  const result = await post(releasePath(),{ _version:materials._version,action:'publish',imageFit:materialImageFit() });
  replaceSaved(result);
  materials.publishedSheetIds = [...new Set([...(materials.publishedSheetIds || []),sheet.id])];
  saveToolsSnapshot();
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
async function historyDialog(archived) {
  const result = await request(releasePath(archived?.id));
  const element = dialog('<h2>Biên bản và lịch sử</h2>' + (archived ? '<p>Đã lưu trữ · ' + html(archived.title) + '</p>' :
    '<button id="refresh-material">Tải lại bảng từ máy chủ</button>') +
    [...result.revisions].reverse().map((view,i) => '<article><strong>Bản ' + (result.revisions.length-i) + ' · ' + html(vnDate(view.publishedAt)) +
      '</strong><p>' + (view.revoked?'Đã thu hồi · ':'') + (view.customer?'A đã ký':'Chờ A ký') + ' · ' + (view.company?'B đã ký':'Chờ B ký') +
      '</p>' + (view.customer || view.company ? '<div class="print-signatures history-signatures"><div><strong>Bên A</strong>' + signatureMark(view.customer) +
        '</div><div><strong>Bên B</strong>' + signatureMark(view.company) + '</div></div>' : '') +
      '<button data-print-revision="' + view.id + '">Biên bản A4</button> ' +
      (!archived && view.customer && !view.company ? '<button data-company="' + view.id + '">Bên B xác nhận</button> ' : '') +
      (archived || view.revoked ? '' : '<button data-revoke="' + view.id + '">Thu hồi link</button>') + '</article>').join('') +
    '<ol>' + [...result.audit].reverse().map(entry => '<li>' + html(vnDate(entry.at) + ' · ' + entry.actor + ' · ' +
      ({ published:'Phát hành',revoked:'Thu hồi', 'customer-signed':'Bên A ký','company-signed':'Bên B ký','change-requested':'Yêu cầu đổi','draft-choice':'Sửa phương án bản nháp', 'sheet-archived':'Lưu trữ bảng','sheet-restored':'Khôi phục bảng' })[entry.event] +
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
  const refresh = byId('refresh-material');
  if (refresh) refresh.onclick = async () => {
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
const exportLabels = {copy:'Copy ảnh bảng',png:'Tải PNG',pdf:'Tải PDF A4',settings:'⚙ Cài đặt xuất'};
function materialExportKey() {
  return 'gdhome-material-export:' + (session()?.user?.email?.toLowerCase() || 'local');
}
function savedMaterialExportScope() {
  if (materialView.export) return materialView.export;
  try { return JSON.parse(localStorage.getItem(materialExportKey())) || {}; }
  catch { return {}; }
}
async function runDirectExport(mode) {
  const saved = savedMaterialExportScope();
  const watermark = saved.watermark !== false;
  const filtered = { ...sheet,groups:sheet.groups
    .filter(group => saved.groups !== 'visible' || materialGroupVisible(group))
    .map(group => ({ ...group,rows:group.rows.filter(row =>
      (saved.rows !== 'chosen' || (row.chosen != null && row.decision === 'chosen')) &&
      (!saved.room || row.room === saved.room)) }))
    .filter(group => group.rows.length) };
  if (!filtered.groups.length) {
    if (window.GDHomeShell?.toast) GDHomeShell.toast('Phạm vi xuất không có dòng vật liệu nào. Hãy kiểm tra Cài đặt xuất.');
    else alert('Phạm vi xuất không có dòng vật liệu nào.');
    return;
  }
  if (mode === 'copy') {
    const root = materialPaperForExport(filtered);
    root.style.cssText += ';position:fixed;left:-10000px;top:0;';
    root.setAttribute('aria-hidden','true');
    document.body.append(root);
    try {
      await Promise.all([showImages(root),document.fonts.ready]);
      const canvas = await captureStatsImage(root);
      applyAntiEditWatermark(canvas,watermark);
      const blob = await new Promise(resolve => canvas.toBlob(resolve,'image/png'));
      if (!blob) throw new Error('Không tạo được ảnh PNG.');
      await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);
      const count = filtered.groups.reduce((n,group) => n + group.rows.length,0);
      window.GDHomeShell?.toast?.('Đã copy ảnh bảng (' + count + ' dòng)');
    } catch (error) {
      const toast = document.createElement('div');
      window.GDHomeShell?.toast?.('Không copy được ảnh: ' + error.message + ' ',toast);
      const preview = document.createElement('button');
      preview.textContent = 'Xem trước';
      preview.onclick = () => { toast.remove(); showStatistics(filtered,'copy',watermark); };
      toast.append(preview);
      setTimeout(() => toast.remove(),10000);
    } finally {
      clearPrintImages(root);
      root.remove();
    }
    return;
  }
  await showStatistics(filtered,mode,watermark);
  if (mode === 'pdf') byId('do-print')?.click();
}
function statistics(mode) {
  const rooms = [...new Set(sheet.groups.flatMap(g => g.rows.map(row => row.room)).filter(Boolean))];
  const saved = savedMaterialExportScope();
  const element = dialog('<h2>' + exportLabels[mode] + '</h2><form id="material-image-scope" class="shell-export-scope">' +
    '<label><span>Danh mục</span><select name="groups">' +
    option('visible','Chỉ nhóm đang bật',saved.groups === 'all' ? 'all' : 'visible') + option('all','Tất cả',saved.groups) + '</select></label>' +
    '<label><span>Dòng</span><select name="rows">' + option('all','Tất cả',saved.rows !== 'chosen' ? 'all' : '') +
    option('chosen','Chỉ dòng đã chốt',saved.rows) + '</select></label>' +
    '<label><span>Phòng</span><select name="room"><option value="">Tất cả</option>' +
    rooms.map(room => option(room,room,saved.room)).join('') + '</select></label>' +
    '<label><span>Ảnh</span><select name="imageFit"><option value="fill"' + (saved.imageFit !== 'fit' ? ' selected' : '') + '>Fill đầy ô</option><option value="fit"' + (saved.imageFit === 'fit' ? ' selected' : '') + '>Vừa khung (giữ nguyên)</option></select></label>' +
    '<label class="export-code-toggle"><span>Hiện mã trên ảnh</span><input name="showCodeOnImage" type="checkbox"' + (saved.showCodeOnImage !== false ? ' checked' : '') + '></label>' +
    '<label class="export-watermark-toggle"><span>Sọc chìm</span><input name="watermark" type="checkbox"' + (saved.watermark === false ? '' : ' checked') + '></label>' +
    '<details class="export-print-columns"><summary>Cột in</summary><div class="sidebar-compact"><div class="sb-chip-grid">' +
    printColumnCheckboxes('name="printColumn"') + '</div></div></details>' +
    '<p id="export-scope-status" role="status"></p><div style="display:flex;gap:6px;justify-content:flex-end"><button type="button" id="save-export-settings-only" class="btn">Lưu cài đặt</button><button class="primary">Xem trước</button></div></form>');

  const form = byId('material-image-scope');
  byId('save-export-settings-only').onclick = () => {
    const scope = new FormData(form);
    const watermark = scope.has('watermark');
    const columns = scope.getAll('printColumn');
    if (columns.length) savePrintColumns(columns);
    setMaterialView({export:{groups:scope.get('groups'),rows:scope.get('rows'),room:scope.get('room'),watermark,imageFit:scope.get('imageFit') || 'fill',showCodeOnImage:scope.has('showCodeOnImage')}});
    element.close();
    window.GDHomeShell?.toast?.('Đã lưu cài đặt xuất.');
  };

  form.onsubmit = async event => {
    event.preventDefault();
    const scope = new FormData(event.target);
    const watermark = scope.has('watermark');
    const columns = scope.getAll('printColumn');
    if (!columns.length) { byId('export-scope-status').textContent = 'Bật in ít nhất một cột.'; return; }
    savePrintColumns(columns);
    setMaterialView({export:{groups:scope.get('groups'),rows:scope.get('rows'),room:scope.get('room'),watermark,imageFit:scope.get('imageFit') || 'fill',showCodeOnImage:scope.has('showCodeOnImage')}});
    const filtered = { ...sheet,groups:sheet.groups
      .filter(group => scope.get('groups') !== 'visible' || materialGroupVisible(group))
      .map(group => ({ ...group,rows:group.rows.filter(row =>
        (scope.get('rows') !== 'chosen' || (row.chosen != null && row.decision === 'chosen')) &&
        (!scope.get('room') || row.room === scope.get('room'))) }))
      .filter(group => group.rows.length) };
    if (!filtered.groups.length) { byId('export-scope-status').textContent = 'Phạm vi này không có dòng vật liệu.'; return; }
    element.close();
    renderEditor();
    await showStatistics(filtered,mode === 'settings' ? 'copy' : mode,watermark);
  };
}
async function showStatistics(filtered,mode,watermark) {
  try {
    const overlay = await showPrint({ sheet:filtered },'/api/materials/assets/',authHeaders(),true,watermark);
    if (!overlay.isConnected) return;
    byId('print-extras').innerHTML = ' <button id="stats-download">Tải PNG</button> <button id="stats-copy">Copy ảnh</button> <span id="export-image-status" role="status"></span>';
    const download = byId('stats-download');
    const copy = byId('stats-copy');
    const print = byId('do-print');
    const selected = { copy,png:download,pdf:print }[mode];
    selected?.classList.add('primary');
    selected?.focus();
    download.onclick = () => exportStatsImage(false,watermark).catch(showExportError);
    copy.onclick = () => exportStatsImage(true,watermark).catch(showExportError);
  } catch (error) { showError(error); }
}
function showExportError(error) {
  const notice = byId('export-image-status');
  if (notice) notice.textContent = error.message;
}

let canvasLoader;
async function captureStatsImage(root) {
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
  if (root.scrollHeight > 12000) throw new Error('Bảng quá dài để xuất một ảnh. Lọc theo phòng hoặc dùng PDF.');
  return html2canvas(root,{
    scale:2,backgroundColor:'#fff',windowWidth:Math.max(innerWidth,root.offsetWidth+32),
    onclone:doc => {
      doc.getElementById('print-sheet')?.classList.remove('watermark');
      const preview = doc.getElementById('print-preview');
      if (preview) preview.style.overflow = 'visible';
    }
  });
}
async function exportStatsImage(copy,watermark = true) {
  const canvas = await captureStatsImage(byId('print-sheet'));
  if (copy) return copyCanvasToClipboard(canvas,{ watermark,notify:message => { const notice = byId('export-image-status'); if (notice) notice.textContent = message; },fallbackName:'GD-HOME-vat-lieu.png' });
  downloadCanvas(canvas,'GD-HOME-vat-lieu.png',watermark);
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
