function applyAntiEditWatermark(canvas, enabled = true) {
  if (!canvas || canvas.__gdWatermarked) return canvas;
  if (!enabled) return canvas;
  const w = canvas.width;
  const h = canvas.height;
  if (!w || !h) return canvas;

  // Sao lưu hình ảnh gốc sang canvas tạm rồi reset kích thước canvas chính
  // để xoá sạch mọi vùng cắt (clip path) / ma trận biến đổi (transform) mà html2canvas để lại!
  if (typeof document !== 'undefined') {
    const tmp = document.createElement('canvas');
    tmp.width = w;
    tmp.height = h;
    const tmpCtx = tmp.getContext('2d');
    if (tmpCtx) {
      tmpCtx.drawImage(canvas, 0, 0);
      canvas.width = w;
      canvas.height = h;
      const freshCtx = canvas.getContext('2d');
      if (freshCtx) freshCtx.drawImage(tmp, 0, 0);
    }
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const unit = Math.max(1, Math.round(w / 1400)); // ảnh 2x -> nét & khoảng cách gấp đôi
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // Sọc chéo 1 chiều duy nhất: từ PHẢI sang TRÁI, trên xuống dưới ( / ).
  // Nét mảnh nhất có thể (1px), xếp rất dày (cách ~3px) và rất mờ -> như lớp vân chìm phủ toàn ảnh.
  ctx.globalAlpha = 0.035;
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 1.2; // dày hơn ~20%
  ctx.lineCap = 'butt';
  const gap = 3.45 * unit; // thưa hơn 15%
  ctx.beginPath();
  for (let x = 0; x < w + h + gap; x += gap) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x - h, h);
  }
  ctx.stroke();
  ctx.restore();
  canvas.__gdWatermarked = true;
  return canvas;
}

function printExportCanvas(canvas,watermark = true) {
  applyAntiEditWatermark(canvas,watermark);
  const preview = document.createElement('dialog');
  preview.className = 'canvas-print';
  preview.setAttribute('aria-label','In / Lưu PDF A4');
  document.body.append(preview);
  document.body.classList.add('printing-canvas');
  GDHomeShell.dialog(preview,'<button class="btn btn-primary" data-print-canvas>In / Lưu PDF A4</button><img alt="Bảng xuất A4">');
  const image = preview.querySelector('img');
  image.src = canvas.toDataURL('image/png');
  preview.querySelector('[data-print-canvas]').onclick = () => window.print();
  preview.onclose = () => { document.body.classList.remove('printing-canvas'); preview.remove(); };
}

function downloadCanvas(canvas, filename, watermark = true) {
  applyAntiEditWatermark(canvas, watermark);
  const link = document.createElement('a');
  link.download = filename;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

function copyCanvasToClipboard(canvas, { watermark = true, notify = alert, fallbackName = "Bang_Tien_Do_Copied.png" } = {}) {
  applyAntiEditWatermark(canvas, watermark);
  canvas.toBlob(async (blob) => {
    if (!blob) {
      alert('Không thể tạo dữ liệu ảnh để copy.');
      return;
    }
    try {
      if (navigator.clipboard && window.ClipboardItem) {
        const item = new ClipboardItem({ 'image/png': blob });
        await navigator.clipboard.write([item]);
        notify('✅ Đã Copy ảnh vào bộ nhớ tạm! Bạn có thể bấm Ctrl+V để dán ngay vào Zalo, Word, Photoshop...');
      } else {
        throw new Error('Trình duyệt không hỗ trợ ClipboardItem');
      }
    } catch (err) {
      console.error('Copy clipboard error:', err);
      // Nếu trình duyệt chặn, tự động tải về làm phương án dự phòng
      downloadCanvas(canvas, fallbackName, watermark);
      notify('Đã tải ảnh về máy (Trình duyệt hiện tại hạn chế quyền Clipboard trực tiếp).');
    }
  }, 'image/png');
}
