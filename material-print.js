const vnDate = timestamp => new Intl.DateTimeFormat('vi-VN',{ dateStyle:'short', timeStyle:'short', timeZone:'Asia/Ho_Chi_Minh' }).format(timestamp);
function signaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  let strokes = [], stroke, pointer, points = 0;
  canvas.onpointerdown = event => {
    if (pointer != null || strokes.length >= 30 || points >= 1200) return;
    pointer = event.pointerId;
    canvas.setPointerCapture(pointer);
    stroke = [];
    strokes.push(stroke);
    draw(event);
  };
  canvas.onpointermove = event => { if (pointer === event.pointerId) draw(event); };
  canvas.onpointerup = canvas.onpointercancel = event => { if (pointer === event.pointerId) { pointer = null; stroke = null; } };
  function draw(event) {
    if (points >= 1200) return;
    const rect = canvas.getBoundingClientRect();
    const point = [event.clientX-rect.left,event.clientY-rect.top].map((v,i) => Math.max(0,Math.min(1000,Math.round(v*1000/(i?rect.height:rect.width)))));
    const last = stroke.at(-1);
    if (last && Math.abs(last[0]-point[0])+Math.abs(last[1]-point[1]) < 4) return;
    stroke.push(point); points++;
    if (!last) return;
    ctx.beginPath(); ctx.moveTo(last[0]*canvas.width/1000,last[1]*canvas.height/1000);
    ctx.lineTo(point[0]*canvas.width/1000,point[1]*canvas.height/1000); ctx.stroke();
  }
  return { strokes:() => strokes.filter(s => s.length > 1), clear:() => { strokes = []; points = 0; ctx.clearRect(0,0,canvas.width,canvas.height); } };
}
function signatureForm(prefix) {
  return '<label>Họ và tên người ký <input id="' + prefix + '-name" required maxlength="150" autocomplete="name"></label>' +
    '<canvas class="signature-pad" id="' + prefix + '-pad" width="600" height="190" aria-label="Vùng vẽ chữ ký"></canvas><button type="button" id="' + prefix + '-clear">Xóa chữ ký</button>';
}
function setupSignature(prefix) {
  const pad = signaturePad(byId(prefix+'-pad'));
  byId(prefix+'-clear').onclick = pad.clear;
  return () => ({ name:byId(prefix+'-name').value, strokes:pad.strokes() });
}
function signatureMark(record) {
  if (!record) return '<p>Chờ ký</p>';
  return '<svg viewBox="0 0 1000 1000" preserveAspectRatio="none" role="img" aria-label="Chữ ký" class="signature-mark">' +
    (record.strokes || []).map(stroke => '<polyline fill="none" stroke="#222" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" points="' +
      stroke.map(point => point.map(Number).join(',')).join(' ') + '"/>').join('') + '</svg><strong>' + html(record.name) + '</strong><br><small>' + html(vnDate(record.at)) + '</small>';
}
function printImages(items, base, large = false) {
  return (items || []).map(image => {
    const name = typeof image === 'string' ? image : (large ? image.full : image.thumb);
    return /^[a-f0-9]{64}\.webp$/.test(name) ? '<img class="print-material" data-print-img="' + html(base + name) + '" alt="Mẫu vật liệu">' : '';
  }).join('');
}
async function loadPrintImages(root, headers = {}) {
  await Promise.all([...root.querySelectorAll('[data-print-img]')].map(async img => {
    try {
      const res = await fetch(img.dataset.printImg,{ headers,referrerPolicy:'no-referrer' });
      if (!res.ok) throw new Error();
      const url = URL.createObjectURL(await res.blob());
      img.src = url;
      try { await img.decode(); } catch (error) { URL.revokeObjectURL(url); throw error; }
    } catch { img.alt = 'Ảnh chưa tải được'; }
  }));
}
function formatTerms(value) {
  return value.split(/\n\s*\n/).map(paragraph => '<p>' + html(paragraph).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/\r?\n/g,'<br>') + '</p>').join('');
}
function rowsForPrint(view, base, stats) {
  let i = 0;
  return view.sheet.groups.map(group => '<tr class="print-group"><th colspan="' + (stats ? 6 : 5) + '">' + html(group.name) + '</th></tr>' +
    group.rows.map(row => {
      const index = view.customer?.choices?.[row.id] ?? row.chosen;
      const pa = row.options[index];
      const options = row.options.filter(o => o.code || o.brand || o.finish || o.color || o.size || o.images?.length);
      const name = html(row.name) + (row.room ? '<br><small>' + html(row.room) + '</small>' : '');
      if (stats) return '<tr><td>' + (++i) + '</td><td>' + name + '</td><td>' + printImages(row.render,base) + '</td><td>' +
        options.map(o => '<div>' + (o === pa ? '✓ ' : '') + html([o.brand,o.code,o.color,o.size,o.finish].filter(Boolean).join(' · ')) +
          '<br>' + printImages(o.images,base) + '</div>').join('') + '</td><td>' + html([row.qty,row.unit].filter(Boolean).join(' ')) + '</td><td>' + html(row.note) + '</td></tr>';
      return '<tr><td>' + (++i) + '</td><td>' + name + '</td><td>' + html(pa?.finish || row.spec) + '</td><td>' +
        html([pa?.color,pa?.code,pa?.size].filter(Boolean).join(' · ')) +
        (pa ? '<br><small>' + html(options.filter(o => o !== pa && o.code).map(o => 'Dự phòng: '+o.code).join(' · ')) + '</small>' : '') +
        '</td><td>' + html(row.note) + '<br>' + printImages(pa?.images,base) + '</td></tr>';
    }).join('')).join('');
}
function printable(view, base, stats = false) {
  const { meta } = view.sheet;
  const settings = view.settings || {};
  const date = new Intl.DateTimeFormat('vi-VN',{ timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'numeric',year:'numeric' })
    .formatToParts(view.customer?.at || view.publishedAt || Date.now());
  const parts = Object.fromEntries(date.map(p => [p.type,p.value]));
  const day = 'ngày ' + parts.day + ' tháng ' + parts.month + ' năm ' + parts.year;
  const heading = '<div class="print-heading"><img src="/gdhome-logo.png" alt="GD HOME"><i>Hà Nội, ' + day + '</i></div>';
  const table = '<table class="print-table"><thead><tr>' + (stats ?
    ['STT','Danh mục','Phối cảnh 3D','Mẫu vật liệu','Khối lượng','Ghi chú'] :
    ['STT','Hạng mục','Chất liệu / Quy cách','Màu / Mã / Kích thước','Ghi chú / Hình ảnh minh hoạ']).map(t => '<th>' + t + '</th>').join('') +
    '</tr></thead><tbody>' + rowsForPrint(view,base,stats) + '</tbody></table>';
  if (stats) return heading + '<h1>BẢNG THỐNG KÊ VẬT LIỆU</h1><p>Kính gửi ' + html(meta.customer) + ' · Dự án ' + html(meta.project) +
    ' · Số ' + html(meta.number) + '</p>' + table;
  return heading + '<h1>BIÊN BẢN XÁC NHẬN</h1><div class="print-center">* * *<br><strong><i>(V/v: Thống nhất quy cách vật liệu, kích thước thiết bị nội thất)</i></strong></div>' +
    '<p><strong>BÊN A: CHỦ ĐẦU TƯ - KHÁCH HÀNG</strong><br>Họ và tên khách hàng - Ông/Bà: ' + html(meta.customer) +
    '<br>Địa chỉ lắp đặt: ' + html(meta.address) + '<br>Số điện thoại liên hệ: ' + html(meta.phone) + '</p>' +
    '<p><strong>BÊN B: CÔNG TY CP NỘI THẤT GD</strong><br><i>(là Nhà thầu sản xuất, lắp đặt nội thất cho Bên A)</i>' +
    '<br>Người đại diện: ' + html(settings.representative) + ' · Chức vụ: ' + html(settings.position) + '<br>Địa chỉ: ' + html(settings.address) + '</p>' +
    '<p>Hôm nay ' + day + ' Tại trụ sở văn phòng Công ty cổ phần nội thất GD<br>Hai bên cùng nhau thống nhất ký biên bản xác nhận với điều khoản dưới đây:</p>' +
    '<p><strong>Điều 1. Nội dung công việc</strong><br>Căn cứ theo hợp đồng thiết kế số: ' + html(meta.contract || 'TK-………') +
    '. Bên A ủy nhiệm cho bên B chỉ định và cùng nhau thống nhất quy cách vật liệu, thông tin / kích thức thiết bị nhằm phục vụ cho công tác thi công lắp đặt nội thất:</p>' +
    '<p><strong>(Ghi chú : mỗi mã vật liệu có thể chốt từ 1 tới 3 mã trong trường hợp thực tế nhà cung cấp không có sản phẩm có sẵn ảnh hưởng tới tiến độ thi công căn hộ )</strong></p>' +
    table + '<div class="print-terms">' + formatTerms(settings.terms || '') + '</div><div class="print-signatures"><div><strong>ĐẠI DIỆN BÊN A</strong>' +
    signatureMark(view.customer) + '</div><div><strong>ĐẠI DIỆN BÊN B</strong>' + signatureMark(view.company) + '</div></div>';
}
async function showPrint(view,base,headers,stats = false) {
  byId('print-preview')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'print-preview';
  overlay.innerHTML = '<div class="print-actions"><button id="do-print" disabled>In / Lưu PDF A4</button> <button id="close-print">Đóng</button><span id="print-extras"></span></div>' +
    '<article id="print-sheet" class="' + (stats?'watermark':'') + '">' + printable(view,base,stats) + '</article>';
  document.body.append(overlay);
  document.body.classList.add('printing-material');
  byId('close-print').onclick = () => {
    overlay.querySelectorAll('img[data-print-img]').forEach(img => { if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); });
    overlay.remove();
    document.body.classList.remove('printing-material');
  };
  byId('do-print').onclick = () => window.print();
  await loadPrintImages(overlay,headers);
  if (overlay.isConnected) byId('do-print').disabled = false;
  return overlay;
}
