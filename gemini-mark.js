// =========================================================================
// GD HOME - Tự xoá logo Gemini (ngôi sao 4 cánh) ở góc dưới phải ảnh do Gemini tạo (ảnh vuông, ảnh ghép 3:2…).
// Xử lý ngay trên máy (canvas), không gọi AI: dò ngôi sao ở góc dưới phải,
// chỉ chọn sát hình ngôi sao rồi lấp bằng điểm ảnh xung quanh (giống Fill của Photoshop).
// removeGeminiMark(blob) -> Promise<Blob|null>  (null = không thấy logo, giữ ảnh gốc)
// =========================================================================
(function () {
  const star = (dx, dy, R) => Math.abs(dx / R) ** (2 / 3) + Math.abs(dy / R) ** (2 / 3);   // hình sao 4 cánh lõm (astroid)

  // Logo là lớp trắng mờ phủ lên ảnh: dọc theo mép ngôi sao, điểm ngay bên trong luôn sáng hơn điểm ngay bên ngoài,
  // kể cả khi nền có hoa văn (vân gỗ, gạch…). Đo ở các cặp điểm trong/ngoài theo pháp tuyến mép, chỉ ở đoạn cánh đủ dày.
  const pairCache = new Map();
  function pairs(R, n) {
    const key = R + '/' + n;
    if (pairCache.has(key)) return pairCache.get(key);
    const out = [], g = 2;
    // Cánh sao dày ~R·sin³t: chỉ lấy đoạn mép mà cánh dày hơn khoảng đo
    const lo = Math.asin(Math.min(0.95, Math.cbrt((g + 1) / R))), hi = Math.PI / 2 - lo;
    for (let q = 0; q < 4; q++) for (let i = 0; i < n; i++) {
      const t = q * Math.PI / 2 + lo + (hi - lo) * (i + 0.5) / n, c = Math.cos(t), s = Math.sin(t);
      const bx = R * Math.sign(c) * Math.abs(c) ** 3, by = R * Math.sign(s) * Math.abs(s) ** 3;
      let nx = Math.sign(c) * Math.abs(s), ny = Math.sign(s) * Math.abs(c);
      const len = Math.hypot(nx, ny); nx /= len; ny /= len;
      out.push([Math.round(bx - nx * g), Math.round(by - ny * g), Math.round(bx + nx * g), Math.round(by + ny * g)]);
    }
    // Cặp "cùng khoảng cách tới tâm": điểm giữa cánh vs điểm ở khe lõm giữa 2 cánh. Đốm sáng tròn / quầng đèn
    // sáng dần vào tâm nên cặp mép ở trên cũng "trong sáng hơn ngoài", nhưng ở cùng bán kính thì không chênh.
    const radial = [];
    for (const k of n > 4 ? [0.5, 0.6, 0.7, 0.8] : [0.55, 0.75]) for (let q = 0; q < 4; q++) {
      const a = q * Math.PI / 2, r = k * R;
      for (const s of [-1, 1]) {
        const b = a + s * Math.PI / 4;
        radial.push([Math.round(r * Math.cos(a)), Math.round(r * Math.sin(a)), Math.round(r * Math.cos(b)), Math.round(r * Math.sin(b))]);
      }
    }
    // Lõi sao đặc (đường chéo gần tâm) sáng hơn khe lõm ngoài mép: loại dấu "+" mảnh như ron gạch giao nhau
    // (điểm (0,3R; 0,2R) vẫn nằm trong thân cánh sao, nhưng nằm ngoài vạch "+" mảnh)
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const [a, b] of n > 4 ? [[0.3, 0.2], [0.2, 0.3]] : [[0.25, 0.25]]) {
      radial.push([Math.round(sx * a * R), Math.round(sy * b * R), Math.round(sx * 0.48 * R), Math.round(sy * 0.48 * R)]);
    }
    const res = {edge: out, radial};
    pairCache.set(key, res);
    return res;
  }
  // Điểm: tỷ lệ cặp mà trong sáng hơn ngoài rõ rệt (mép + cùng bán kính) + độ chênh trung vị ở mép
  function edgeScore(Lum, W, cx, cy, R, n) {
    const {edge, radial} = pairs(R, n), diffs = [], rel = [];
    let pos = 0, pos2 = 0;
    for (const [ix, iy, ox, oy] of edge) {
      const out = Lum[(cy + oy) * W + cx + ox], dif = Lum[(cy + iy) * W + cx + ix] - out;
      diffs.push(dif);
      rel.push(dif / Math.max(8, 255 - out));      // lớp trắng độ mờ a nâng sáng đúng a·(255 − nền)
      if (dif > 2) pos++;
    }
    for (const [ix, iy, ox, oy] of radial) if (Lum[(cy + iy) * W + cx + ix] - Lum[(cy + oy) * W + cx + ox] > 2) pos2++;
    diffs.sort((a, b) => a - b);
    rel.sort((a, b) => a - b);
    return {frac: Math.min(pos / edge.length, pos2 / radial.length), med: diffs[diffs.length >> 1], alpha: rel[rel.length >> 1]};
  }

  // Chấm kỹ quanh từng ứng viên: tâm ±reach px, bán kính theo dải [r0, r1] của ứng viên
  function refine(Lum, W, H, cands, reach) {
    let best = null;
    for (const c of cands) for (let R = c.r0; R <= c.r1; R++) for (let dy = -reach; dy <= reach; dy++) for (let dx = -reach; dx <= reach; dx++) {
      const cx = c.cx + dx, cy = c.cy + dy, pad = Math.ceil(R * 1.1) + 3;
      if (cx - pad < 0 || cy - pad < 0 || cx + pad >= W || cy + pad >= H) continue;
      const s = edgeScore(Lum, W, cx, cy, R, 16), rank = s.frac * 100 + Math.min(s.med, 40);
      if (!best || rank > best.rank) best = {cx, cy, R, rank, ...s};
    }
    return best;
  }
  // Vị trí quen thuộc [cỡ logo, lề tới mép logo]: ảnh 1024 px logo 48 px lề 96 px (đo ảnh mẫu); 48/32, 96/64 theo cỡ ảnh
  function known(Lum, W, H) {
    const M = Math.min(W, H);
    const cands = [[M * 0.046875, M * 0.09375], [48, 96], [96, 192], [64, 128], [48, 32], [96, 64]].map(([size, margin]) =>
      ({cx: Math.round(W - margin - size / 2), cy: Math.round(H - margin - size / 2), r0: Math.round(size * 0.44), r1: Math.round(size * 0.6)}));
    return refine(Lum, W, H, cands, 6);
  }

  function detect(Lum, W, H) {
    const M = Math.min(W, H), side = Math.round(M * 0.32), Rmin = Math.max(16, Math.round(M * 0.018)), Rmax = Math.round(M * 0.06);
    // Bước 1: quét thô cả góc dưới phải bằng ít cặp điểm, giữ ~30 chỗ khớp nhất
    const top = [];
    for (let R = Rmin; R <= Rmax; R += Math.max(1, Math.round(R * 0.07))) {
      const pad = Math.ceil(R * 1.1) + 3, step = R < 20 ? 1 : 2;
      for (let cy = Math.max(pad, H - side); cy < H - pad; cy += step) for (let cx = Math.max(pad, W - side); cx < W - pad; cx += step) {
        const s = edgeScore(Lum, W, cx, cy, R, 4);
        if (s.frac < 0.8) continue;
        const rank = s.frac * 100 + Math.min(s.med, 40);
        if (top.length >= 30 && rank <= top[top.length - 1].rank) continue;
        const near = top.findIndex(c => Math.abs(c.cx - cx) <= R * 0.5 && Math.abs(c.cy - cy) <= R * 0.5);
        if (near >= 0) { if (top[near].rank < rank) top[near] = {cx, cy, R, rank}; else continue; }
        else top.push({cx, cy, R, rank});
        top.sort((a, b) => b.rank - a.rank);
        top.length = Math.min(top.length, 30);
      }
    }
    // Bước 2: chấm kỹ bằng nhiều cặp điểm, tinh chỉnh tâm ±2 px và bán kính ±10 %
    return refine(Lum, W, H, top.map(c => ({cx: c.cx, cy: c.cy, r0: Math.round(c.R * 0.9), r1: Math.round(c.R * 1.1)})), 2);
  }

  // Lấp vùng chọn: bóc dần từ mép vào (lấy trung bình điểm đã biết), rồi làm mịn kiểu Laplace
  function fill(d, W, H, mask) {
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
    const img = ctx.getImageData(0, 0, W, H), d = img.data, Lum = new Float32Array(W * H);
    for (let k = 0; k < W * H; k++) Lum[k] = 0.299 * d[k * 4] + 0.587 * d[k * 4 + 1] + 0.114 * d[k * 4 + 2];
    // Phần lớn cặp điểm trong mép sáng hơn ngoài mép (ngẫu nhiên trên hoa văn chỉ ~50–80 %).
    // Ở vị trí quen thuộc tin hơn nên ngưỡng thấp hơn (nền vân gỗ đậm vẫn nhận); quét rộng cả góc đòi chặt hơn.
    const good = (h, min) => h && h.frac >= min && h.med >= 3 && h.alpha >= 0.15;   // logo Gemini mờ ~30–50 %
    let hit = known(Lum, W, H), min = 0.78;
    if (!good(hit, min)) { hit = detect(Lum, W, H); min = 0.85; }
    removeGeminiMark.last = hit;   // để kiểm thử xem điểm dò
    if (!good(hit, min)) return null;
    // Chọn sát ngôi sao rồi nới đều 2 px theo mép (ăn hết viền mờ khử răng cưa)
    const mask = [], lim = Math.ceil(hit.R * 1.3), grow = 2, inStar = (dx, dy) => star(dx, dy, hit.R) <= 1;
    for (let dy = -lim; dy <= lim; dy++) for (let dx = -lim; dx <= lim; dx++) {
      let hitNear = false;
      for (let ey = -grow; ey <= grow && !hitNear; ey++) for (let ex = -grow; ex <= grow && !hitNear; ex++) hitNear = inStar(dx + ex, dy + ey);
      const X = hit.cx + dx, Y = hit.cy + dy;
      if (hitNear && X > 0 && Y > 0 && X < W - 1 && Y < H - 1) mask.push(Y * W + X);
    }
    fill(d, W, H, mask);
    ctx.putImageData(img, 0, 0);
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  }
  window.removeGeminiMark = removeGeminiMark;
})();
