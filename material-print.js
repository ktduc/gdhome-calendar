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
  return '<svg viewBox="0 0 600 190" role="img" aria-label="Chữ ký" class="signature-mark">' +
    (record.strokes || []).map(stroke => '<polyline fill="none" stroke="#222" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" points="' +
      stroke.map(point => (Number(point[0])*0.6) + ',' + (Number(point[1])*0.19)).join(' ') + '"/>').join('') + '</svg><strong>' + html(record.name) + '</strong><br><small>' + html(vnDate(record.at)) + '</small>';
}
function printImages(items, base, large = false) {
  return (items || []).map(image => {
    const name = typeof image === 'string' ? image : (large ? image.full : image.thumb);
    return /^[a-f0-9]{64}\.webp$/.test(name) ? '<div class="print-square"><img class="print-material" data-print-img="' + html(base + name) + '" alt="Mẫu vật liệu"></div>' : '';
  }).join('');
}
async function loadPrintImages(root, headers = {}) {
  await Promise.all([...root.querySelectorAll('[data-print-img]')].map(async img => {
    try {
      const source = img.dataset.printImg;
      let blob;
      if (typeof materialGuest !== 'undefined' && materialGuest && source.startsWith('/api/materials/assets/')) {
        blob = guestMaterialAsset(source.split('/').at(-1));
      } else {
        const res = await fetch(source,{headers,referrerPolicy:'no-referrer'});
        if (!res.ok) throw new Error();
        blob = await res.blob();
      }
      const url = URL.createObjectURL(blob);
      img.src = url;
      try { await img.decode(); } catch (error) { URL.revokeObjectURL(url); throw error; }
    } catch { img.alt = 'Ảnh chưa tải được'; }
  }));
}
function formatTerms(value) {
  return value.split(/\n\s*\n/).map(paragraph => '<p>' + html(paragraph).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g,'<em>$1</em>').replace(/\r?\n/g,'<br>') + '</p>').join('');
}
const materialPrintColumns = [['number','STT'],['name','Danh mục'],['render','Phối cảnh 3D'],
  ['sample','Mẫu vật liệu'],['qty','Khối lượng'],['note','Ghi chú']];
function displayMaterialUnit(unit) {
  return String(unit || '').trim().replace(/^m\^?2$/i,'m²').replace(/^m\^?3$/i,'m³');
}
function materialPrintDate(timestamp) {
  const date = new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'numeric',month:'numeric',year:'numeric'})
    .formatToParts(timestamp);
  const parts = Object.fromEntries(date.map(part => [part.type,part.value]));
  return 'ngày ' + parts.day + ' tháng ' + parts.month + ' năm ' + parts.year;
}
function hasPrintOption(option) {
  return !!(option.code || option.brand || option.finish || option.color || option.size || option.images?.length);
}

function rowsForPrint(view, base) {
  let i = 0;
  return view.sheet.groups.map(group => '<tr class="print-group"><th colspan="' + 5 + '">' + html(group.name) + '</th></tr>' +
    group.rows.map(row => {
      const index = view.customer?.choices?.[row.id] ?? row.chosen;
      const pa = row.options[index];
      const options = row.options.filter(hasPrintOption);
      const name = html(row.name) + (row.room ? '<br><small>' + html(row.room) + '</small>' : '');

      return '<tr><td>' + (++i) + '</td><td>' + name + '</td><td>' + html(pa?.finish || row.spec) + '</td><td>' +
        html([pa?.color,pa?.code,pa?.size].filter(Boolean).join(' · ')) +
        (pa ? '<br><small>' + html(options.filter(o => o !== pa && o.code).map(o => 'Dự phòng: '+o.code).join(' · ')) + '</small>' : '') +
        '</td><td>' + html(row.note) + '<div class="print-squares">' + printImages(pa?.images,base) + '</div></td></tr>';
    }).join('')).join('');
}
function printable(view,base) {
  const meta = view.sheet.meta || {};
  const settings = view.settings || {};
  const day = materialPrintDate(view.customer?.at || view.publishedAt || Date.now());
  const heading = '<div class="print-heading"><img src="/gdhome-logo.png" alt="GD HOME"><i>Hà Nội, ' + day + '</i></div>';
  const table = '<table class="print-table"><thead><tr>' +
    ['STT','Hạng mục','Chất liệu / Quy cách','Màu / Mã / Kích thước','Ghi chú / Hình ảnh minh hoạ'].map(label => '<th>' + label + '</th>').join('') +
    '</tr></thead><tbody>' + rowsForPrint(view,base) + '</tbody></table>';
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
async function showPrint(view,base,headers,stats = false,watermark = stats) {
  byId('print-preview')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'print-preview';
  overlay.innerHTML = '<div class="print-actions"><button id="do-print" disabled>In / Lưu PDF A4</button> <button id="close-print">Đóng</button><span id="print-extras"></span></div>' +
    (stats ? '' : '<article id="print-sheet" class="print-sheet">' + printable(view,base) + '</article>');
  if (stats) {
    const paper = materialPaperForExport(view.sheet);
    paper.id = 'print-sheet';
    paper.classList.toggle('watermark',watermark);
    overlay.append(paper);
  }
  document.body.append(overlay);
  document.body.classList.add('printing-material');
  byId('close-print').onclick = () => {
    overlay.querySelectorAll('img[data-print-img]').forEach(img => { if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src); });
    overlay.remove();
    document.body.classList.remove('printing-material');
  };
  byId('do-print').onclick = () => window.print();
  await Promise.all([stats ? showImages(overlay) : loadPrintImages(overlay,headers),document.fonts.ready]);
  if (overlay.isConnected) byId('do-print').disabled = false;
  return overlay;
}
