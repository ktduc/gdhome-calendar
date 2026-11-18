// =========================================================================
// GD HOME - Tự xoá logo Gemini (ngôi sao 4 cánh) ở góc dưới phải ảnh do Gemini tạo (ảnh vuông, ảnh ghép 3:2…).
// Xử lý ngay trên máy (canvas), không gọi AI: dò đúng chỗ ngôi sao quanh vị trí quen thuộc,
// chỉ chọn sát hình ngôi sao rồi lấp bằng điểm ảnh xung quanh (giống Fill của Photoshop).
// removeGeminiMark(blob) -> Promise<Blob|null>  (null = không thấy logo, giữ ảnh gốc)
// =========================================================================
(function () {
  // Ảnh 1024 px: logo 48 px, cách mép phải/dưới 96 px (đo trên ảnh mẫu). Ảnh ghép không vuông / cỡ khác: dò thêm vài cỡ, lề quen thuộc.
  const GUESSES = (W, H) => { const M = Math.min(W, H); return [[M * 0.046875, M * 0.09375], [48, 96], [96, 192], [64, 128], [48, 32], [96, 64]]; };
  const star = (dx, dy, R) => Math.abs(dx / R) ** (2 / 3) + Math.abs(dy / R) ** (2 / 3);   // hình sao 4 cánh lõm (astroid)

  function find(d, W, H) {
    const L = (X, Y) => { const k = (Y * W + X) * 4; return 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; };
    const found = [];
    for (const [size, margin] of GUESSES(W, H)) {
      let best = null;
      const x0 = Math.round(W - margin - size / 2), y0 = Math.round(H - margin - size / 2), box = Math.ceil(size * 0.8);
      if (x0 - box < 0 || y0 - box < 0 || x0 + box + 6 >= W || y0 + box + 6 >= H) continue;
      for (let R = Math.round(size * 0.44); R <= Math.round(size * 0.56); R++) {
        for (let cy = y0 - 6; cy <= y0 + 6; cy++) for (let cx = x0 - 6; cx <= x0 + 6; cx++) {
          let a = 0, a2 = 0, na = 0, b = 0, nb = 0;
          const lim = Math.ceil(R * 1.4);
          for (let dy = -lim; dy <= lim; dy += 2) for (let dx = -lim; dx <= lim; dx += 2) {
            const v = star(dx, dy, R), l = L(cx + dx, cy + dy);
            if (v <= 0.7) { a += l; a2 += l * l; na++; } else if (v >= 1.3) { b += l; nb++; }
          }
          const mean = a / na, sd = Math.sqrt(Math.max(0, a2 / na - mean * mean)), score = mean - b / nb;
          if (!best || score - sd * 0.5 > best.rank) best = {cx, cy, R, score, sd, rank: score - sd * 0.5};
        }
      }
      if (best) found.push(best);
    }
    return found;    // mỗi vị trí dò 1 ứng viên; chọn theo độ khớp hình ở dưới
  }

  // Dò rộng (khi các vị trí quen thuộc không thấy, vd ảnh ghép 3:2 có cỡ / lề logo khác): quét cả vùng góc dưới phải,
  // so độ sáng trong hình sao với vành ngoài bằng điểm mẫu thưa, giữ ~10 chỗ nổi nhất để chấm độ khớp hình ở bước sau
  function sweep(d, W, H) {
    const L = (X, Y) => { const k = (Y * W + X) * 4; return 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2]; };
    const M = Math.min(W, H), side = Math.round(M * 0.32), top = [];
    for (let R = Math.max(8, Math.round(M * 0.012)); R <= Math.round(M * 0.06); R += Math.max(1, Math.round(R * 0.12))) {
      const ins = [], ring = [], st = Math.max(1, Math.round(R / 5)), lim = Math.ceil(R * 1.6);
      for (let dy = -lim; dy <= lim; dy += st) for (let dx = -lim; dx <= lim; dx += st) {
        const v = star(dx, dy, R);
        if (v <= 0.55) ins.push([dx, dy]); else if (v >= 1.5) ring.push([dx, dy]);
      }
      const pad = lim + 2, step = Math.max(2, Math.round(R / 6));
      for (let cy = Math.max(pad, H - side); cy <= H - pad; cy += step) for (let cx = Math.max(pad, W - side); cx <= W - pad; cx += step) {
        let a = 0, a2 = 0, b = 0, b2 = 0;
        for (const [dx, dy] of ins) { const l = L(cx + dx, cy + dy); a += l; a2 += l * l; }
        for (const [dx, dy] of ring) { const l = L(cx + dx, cy + dy); b += l; b2 += l * l; }
        const mi = a / ins.length, mo = b / ring.length;
        if (mi - mo < 2) continue;
        const vi = Math.max(0, a2 / ins.length - mi * mi), vo = Math.max(0, b2 / ring.length - mo * mo);
        const t = (mi - mo) / Math.sqrt(vi / ins.length + vo / ring.length + 0.25);
        const near = top.findIndex(c => Math.abs(c.cx - cx) < R && Math.abs(c.cy - cy) < R);
        if (near >= 0) { if (top[near].t < t) top[near] = {cx, cy, R, t, score: mi - mo, sd: Math.sqrt(vi)}; continue; }
        if (top.length < 10 || t > top[top.length - 1].t) { top.push({cx, cy, R, t, score: mi - mo, sd: Math.sqrt(vi)}); top.sort((p, q) => q.t - p.t); top.length = Math.min(top.length, 10); }
      }
    }
    return top;
  }

  // Độ khớp hình: tương quan giữa độ sáng và mặt nạ ngôi sao trong ô vuông quanh tâm (mảng trắng tròn/vuông cho điểm thấp)
  function shapeMatch(d, W, {cx, cy, R}, box = R, step = 1) {
    let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
    for (let dy = -box; dy <= box; dy += step) for (let dx = -box; dx <= box; dx += step) {
      const k = ((cy + dy) * W + cx + dx) * 4, l = 0.299 * d[k] + 0.587 * d[k + 1] + 0.114 * d[k + 2], m = star(dx, dy, R) <= 1 ? 1 : 0;
      n++; sx += m; sy += l; sxx += m * m; syy += l * l; sxy += m * l;
    }
    const cov = sxy / n - (sx / n) * (sy / n), vx = sxx / n - (sx / n) ** 2, vy = syy / n - (sy / n) ** 2;
    return vx > 0 && vy > 0 ? cov / Math.sqrt(vx * vy) : 0;
  }

  // Lấp vùng chọn: bóc dần từ mép vào (lấy trung bình điểm đã biết), rồi làm mịn kiểu Laplace
  function fill(d, W, H, mask, x0, y0, x1, y1) {
    const known = new Uint8Array(W * H).fill(1);
    for (const k of mask) known[k] = 0;
    let todo = mask.slice();
    while (todo.length) {
      const next = [], done = [];
      for (const k of todo) {
        const X = k % W, Y = (k / W) | 0;
        let r = 0, g = 0, bl = 0, n = 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const q = (Y + dy) * W + X + dx;
          if ((dx || dy) && known[q]) { r += d[q * 4]; g += d[q * 4 + 1]; bl += d[q * 4 + 2]; n++; }
        }
        if (n) { d[k * 4] = r / n; d[k * 4 + 1] = g / n; d[k * 4 + 2] = bl / n; done.push(k); } else next.push(k);
      }
      for (const k of done) known[k] = 1;
      if (!done.length) break;
      todo = next;
    }
    for (let it = 0; it < 40; it++) for (const k of mask) for (let ch = 0; ch < 3; ch++) {
      d[k * 4 + ch] = (d[(k - 1) * 4 + ch] + d[(k + 1) * 4 + ch] + d[(k - W) * 4 + ch] + d[(k + W) * 4 + ch]) / 4;
    }
  }

  async function removeGeminiMark(blob) {
    let bmp;
    try { bmp = await createImageBitmap(blob); } catch { return null; }
    const W = bmp.width, H = bmp.height;
    if (Math.min(W, H) < 300) return null;
    const canvas = Object.assign(document.createElement('canvas'), {width: W, height: H});
    const ctx = canvas.getContext('2d', {willReadFrequently: true});
    ctx.drawImage(bmp, 0, 0);
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    // Tinh chỉnh tâm và bán kính theo độ khớp hình (đầu cánh nhọn dài hơn phần sáng giữa), chọn ứng viên khớp nhất
    const refine = (cands, reach) => {
      let best = null;
      for (const cand of cands) {
        let top = null;
        for (let R = Math.round(cand.R * 0.85); R <= Math.round(cand.R * 1.35); R++) for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
          const corr = shapeMatch(d, W, {cx: cand.cx + dx, cy: cand.cy + dy, R}, Math.ceil(cand.R * 1.4), 2);
          if (!top || corr > top.corr) top = {cx: cand.cx + dx, cy: cand.cy + dy, R, corr};
        }
        if (!best || top.corr > best.corr) best = {...cand, ...top};
      }
      return best;
    };
    // Ngôi sao là lớp trắng mờ phẳng: sáng hơn xung quanh, đều màu bên trong và đúng hình sao 4 cánh lõm.
    // Nền sáng (tường, sàn trắng) chỉ chênh ~5 mức sáng -> ngưỡng chênh thấp, độ khớp hình sao mới là chốt chặn
    // (đo: logo thật 0,79–0,98; mảng sáng khác ≤ 0,33)
    const ok = (h, min = 0.6) => h && h.score >= 3 && h.sd <= 16 && h.corr >= min;
    let hit = refine(find(d, W, H), 3);
    let minCorr = 0.6;
    // Vị trí quen thuộc không thấy: quét cả góc (ảnh ghép 3:2…). Quét rộng dễ gặp chỗ na ná hơn nên đòi khớp hình cao hơn
    // (đo: logo thật dò rộng ≥ 0,88; ảnh không logo cao nhất 0,55)
    if (!ok(hit)) { hit = refine(sweep(d, W, H), 4); minCorr = 0.72; }
    removeGeminiMark.last = hit;   // để kiểm thử xem điểm dò
    if (!ok(hit, minCorr)) return null;
    // Chọn sát ngôi sao rồi nới đều 2 px theo mép (ăn hết viền mờ khử răng cưa)
    const mask = [], lim = Math.ceil(hit.R * 1.3), grow = 2, inStar = (dx, dy) => star(dx, dy, hit.R) <= 1;
    for (let dy = -lim; dy <= lim; dy++) for (let dx = -lim; dx <= lim; dx++) {
      let hitNear = false;
      for (let ey = -grow; ey <= grow && !hitNear; ey++) for (let ex = -grow; ex <= grow && !hitNear; ex++) hitNear = inStar(dx + ex, dy + ey);
      if (hitNear) mask.push((hit.cy + dy) * W + hit.cx + dx);
    }
    fill(d, W, H, mask);
    ctx.putImageData(img, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }
  window.removeGeminiMark = removeGeminiMark;
})();
