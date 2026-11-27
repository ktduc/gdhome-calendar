// Vẽ hiện trạng – phần lõi dùng chung trình duyệt + Node (test): đọc lệnh, hình học tường, nét vẽ, xuất DXF.
// Đơn vị mm, trục x sang phải, y xuống dưới (như SVG). Điểm phòng = mặt trong tường (thông thủy), tường dày ra phía ngoài.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GDPlanCore = api;
})(typeof self !== 'undefined' ? self : this, () => {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const mul = (a, k) => [a[0] * k, a[1] * k];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
  const len = a => Math.hypot(a[0], a[1]);
  const unit = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l]; };
  const round = (v, step = 1) => Math.round(v / step) * step;

  // ---------- Đọc số / lệnh (gõ hoặc giọng nói) ----------
  const DIGIT = {khong: 0, không: 0, một: 1, mot: 1, mốt: 1, hai: 2, ba: 3, bốn: 4, bon: 4, tư: 4, năm: 5, nam: 5, lăm: 5, lam: 5, sáu: 6, sau: 6, bảy: 7, bay: 7, bẩy: 7, tám: 8, tam: 8, chín: 9, chin: 9};
  // "một nghìn năm trăm" = 1500, "nghìn rưỡi" = 1500, "hai nghìn tư" = 2400, "ba trăm tư" = 340
  function wordsToNumber(words) {
    let total = 0, section = 0, pending = null, last = 1, used = false;
    for (const w of words) {
      if (w in DIGIT) { pending = DIGIT[w]; used = true; }
      else if (w === 'mười' || w === 'muoi') { section += 10; pending = null; last = 1; used = true; }
      else if (w === 'mươi') { section += (pending ?? 1) * 10; pending = null; last = 1; used = true; }
      else if (w === 'trăm' || w === 'tram') { section += (pending ?? 1) * 100; pending = null; last = 100; used = true; }
      else if (['nghìn', 'nghin', 'ngàn', 'ngan'].includes(w)) { total += (section + (pending ?? (section ? 0 : 1))) * 1000; section = 0; pending = null; last = 1000; used = true; }
      else if (w === 'rưỡi' || w === 'ruoi') { section += last / 2; pending = null; last = 1; }
      else if (w === 'linh' || w === 'lẻ') { last = 10; }
      else return null;
    }
    if (!used) return null;
    if (pending != null) section += last >= 10 && section % last === 0 ? pending * last / 10 : pending;
    return total + section;
  }
  const UNIT_M = ['m', 'mét', 'met', 'thước'], UNIT_CM = ['cm', 'phân', 'phan', 'xăng', 'xen'], UNIT_MM = ['mm', 'li', 'ly'];
  // Tách chữ thành dãy {num}/{word}; số dạng 1.500 = 1500, 8,5 = 8.5
  function tokens(text) {
    const out = [];
    const raw = String(text || '').toLowerCase().normalize('NFC').replace(/(\d)\s*\+\s*(\d)/g, '$1+$2').replace(/(\d)(m|mm|cm)\b/g, '$1 $2').split(/[\s;]+/).filter(Boolean);
    let words = [];
    const flush = () => { if (!words.length) return; const n = wordsToNumber(words); if (n != null) out.push({num: n}); else words.forEach(w => out.push({word: w})); words = []; };
    for (const t of raw) {
      const w = t.replace(/[.,!?]+$/, '');
      if (/^\d[\d.,+]*$/.test(w)) {
        flush();
        const sum = w.split('+').reduce((s, part) => s + (/^\d{1,3}(\.\d{3})+$/.test(part) ? Number(part.replace(/\./g, '')) : Number(part.replace(',', '.'))), 0);
        out.push({num: sum, raw: w});
      } else if (wordsToNumber([w]) != null || ['trăm', 'mươi', 'mười', 'nghìn', 'ngàn', 'rưỡi', 'linh', 'lẻ'].includes(w)) words.push(w);
      else { flush(); out.push({word: w}); }
    }
    flush();
    return out;
  }
  // Gom số + đơn vị: "3 mét 5" = 3500, "8,5 m" = 8500, "35 phân" = 350, mặc định mm
  function lengths(toks) {
    const out = [];
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t.num == null) { out.push(t); continue; }
      const next = toks[i + 1]?.word;
      if (UNIT_M.includes(next)) {
        let mm = t.num * 1000;
        const frac = toks[i + 2];
        if (frac?.num != null && !UNIT_M.concat(UNIT_CM, UNIT_MM).includes(toks[i + 3]?.word)) { mm += Number('0.' + String(frac.raw || frac.num).replace(/\D/g, '')) * 1000; i++; }
        out.push({len: Math.round(mm)}); i++;
      } else if (UNIT_CM.includes(next)) { out.push({len: Math.round(t.num * 10)}); i++; }
      else if (UNIT_MM.includes(next)) { out.push({len: Math.round(t.num)}); i++; }
      else out.push({len: Math.round(t.num)});
    }
    return out;
  }
  const PHRASES = [
    [/cửa\s*sổ|cua\s*so/g, ' #window '], [/cửa\s*đi|cua\s*di|cửa\s*chính|\bcửa\b/g, ' #door '], [/lối\s*đi|loi\s*di|ô\s*mở|o\s*mo/g, ' #open '],
    [/kết\s*thúc|ket\s*thuc|xong/g, ' #finish '], [/khép\s*kín|khep\s*kin|đóng\s*lại/g, ' #close '], [/tiếp\s*tục|tiep\s*tuc|vẽ\s*tiếp/g, ' #continue '],
    [/quay\s*lại|hoàn\s*tác|hoan\s*tac|xoá\s*đoạn|xóa\s*đoạn/g, ' #undo '], [/gợi\s*ý|goi\s*y/g, ' #suggest '], [/\bvách\b|\bvach\b/g, ' #partition '],
    [/\bdọc\b|\bdoc\b/g, ' #v '], [/\bngang\b/g, ' #h '], [/\blên\b|\blen\b|\btrên\b/g, ' #up '], [/\bxuống\b|\bxuong\b|\bdưới\b/g, ' #down '],
    [/\btrái\b|\btrai\b/g, ' #left '], [/\bphải\b|\bphai\b/g, ' #right '], [/\bdừng\b|\bdung\b|tắt\s*micro/g, ' #stop ']
  ];
  // -> [{type:'seg', dir, len, kind}] | {type:'kind', kind} | {type:'finish'|'close'|'continue'|'undo'|'suggest'|'stop'}
  function parseCommand(text) {
    let s = ' ' + String(text || '').toLowerCase().normalize('NFC') + ' ';
    for (const [re, tag] of PHRASES) s = s.replace(re, tag);
    const items = lengths(tokens(s));
    const actions = [];
    let dir = null, kind = null;
    const KIND = {'#window': 'window', '#door': 'door', '#open': 'open', '#partition': 'partition'};
    const DIRS = ['#v', '#h', '#up', '#down', '#left', '#right'];
    for (const it of items) {
      if (it.len != null) {
        if (actions.length && actions[actions.length - 1].type === 'seg' && actions[actions.length - 1].len == null) actions[actions.length - 1].len = it.len;
        else actions.push({type: 'seg', dir, len: it.len, kind});
        dir = null; kind = null;
      } else if (DIRS.includes(it.word)) {
        const d = it.word.slice(1);
        const lastSeg = actions[actions.length - 1];
        if (lastSeg?.type === 'seg' && lastSeg.len == null) lastSeg.dir = d; else actions.push({type: 'seg', dir: d, len: null, kind: null});
      } else if (KIND[it.word]) {
        const lastSeg = actions[actions.length - 1];
        if (lastSeg?.type === 'seg' && !lastSeg.kind) lastSeg.kind = KIND[it.word];   // "1200 cửa sổ" / "dọc 1200 cửa sổ"
        else if (KIND[it.word] === 'partition') actions.push({type: 'kind', kind: 'partition'});
        else actions.push({type: 'kind', kind: KIND[it.word]});
      } else if (['#finish', '#close', '#continue', '#undo', '#suggest', '#stop'].includes(it.word)) actions.push({type: it.word.slice(1)});
    }
    return actions.filter(a => a.type !== 'seg' || a.len != null || a.dir);
  }
  // Hướng của 1 lệnh: dọc lần đầu đi lên rồi đảo chiều so với đoạn dọc trước; ngang lần đầu sang phải
  function stepVector(dir, prev, lastV, lastH) {
    switch (dir) {
      case 'up': return [0, -1];
      case 'down': return [0, 1];
      case 'left': return [-1, 0];
      case 'right': return [1, 0];
      case 'v': return lastV ? [0, -lastV[1]] : [0, -1];
      case 'h': return lastH ? [-lastH[0], 0] : [1, 0];
      default: return prev || [1, 0];
    }
  }

  // ---------- Hình học phòng ----------
  const segCount = room => room.closed ? room.pts.length : Math.max(0, room.pts.length - 1);
  const segEnds = (room, i) => [room.pts[i], room.pts[(i + 1) % room.pts.length]];
  const segLen = (room, i) => len(sub(...segEnds(room, i).reverse()));
  function signedArea(pts) {
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  const area = room => room.closed ? Math.abs(signedArea(room.pts)) : 0;
  const perimeter = room => Array.from({length: segCount(room)}, (_, i) => segLen(room, i)).reduce((a, b) => a + b, 0);
  const side = room => signedArea(room.pts) >= 0 ? 1 : -1;
  // Pháp tuyến ra phía ngoài phòng của đoạn i
  function normal(room, i) {
    const [a, b] = segEnds(room, i), d = unit(sub(b, a)), s = side(room);
    return [s * d[1], -s * d[0]];
  }
  const segInfo = (plan, room, i) => {
    const seg = room.segs?.[i] || {};
    const k = seg.k || 'wall';
    return {k, t: k === 'open' ? 0 : k === 'partition' ? (seg.t || plan.partition || 100) : (seg.t || plan.wall || 140)};
  };
  function intersect(p, d, q, e) {
    const cross = d[0] * e[1] - d[1] * e[0];
    if (Math.abs(cross) < 1e-9) return null;
    const t = ((q[0] - p[0]) * e[1] - (q[1] - p[1]) * e[0]) / cross;
    return add(p, mul(d, t));
  }
  // Góc ngoài tại đỉnh j (giữa đoạn j-1 và j); đoạn hở / đầu mút thì vuông góc
  function outerCorner(plan, room, j, ofSeg) {
    const n = room.pts.length, count = segCount(room);
    const prev = room.closed ? (j - 1 + n) % n : j - 1, next = j < count ? j : -1;
    const own = segInfo(plan, room, ofSeg), ownN = normal(room, ofSeg);
    const other = ofSeg === next ? prev : next;
    if (other < 0 || other >= count || other === ofSeg) return add(room.pts[j], mul(ownN, own.t));
    const oi = segInfo(plan, room, other);
    if (oi.k === 'open' || own.k === 'open' || oi.t !== own.t && (oi.k === 'partition') !== (own.k === 'partition')) return add(room.pts[j], mul(ownN, own.t));
    const [a1, b1] = segEnds(room, ofSeg), [a2, b2] = segEnds(room, other);
    const p = intersect(add(a1, mul(ownN, own.t)), sub(b1, a1), add(a2, mul(normal(room, other), oi.t)), sub(b2, a2));
    return p && len(sub(p, room.pts[j])) < Math.max(own.t, oi.t) * 6 ? p : add(room.pts[j], mul(ownN, own.t));
  }
  function wallQuad(plan, room, i) {
    const [a, b] = segEnds(room, i), j2 = (i + 1) % room.pts.length;
    return [a, b, outerCorner(plan, room, j2, i), outerCorner(plan, room, i, i)];
  }
  // Đổi chiều dài đoạn i: mọi đỉnh nằm phía cuối đoạn (theo hướng đoạn) dời theo -> tường đối diện co / giãn, phòng giữ vuông
  function setSegLength(room, i, value) {
    const [a, b] = segEnds(room, i), d = unit(sub(b, a)), delta = value - segLen(room, i);
    if (!delta) return;
    const endProj = dot(b, d), startProj = dot(a, d);
    const bi = (i + 1) % room.pts.length;
    room.pts = room.pts.map((p, k) => k === bi || (k !== i && dot(p, d) > endProj - 1 && dot(p, d) > startProj + 1) ? add(p, mul(d, delta)) : p);
    // cửa / thiết bị nằm trên các đoạn bị kéo theo không đổi vị trí tương đối; cửa "cả đoạn" giãn theo đoạn
    for (const op of room.openings || []) if (op.full) op.w = segLen(room, op.seg);
  }
  function centroid(room) {
    const pts = room.pts;
    const a = signedArea(pts);
    if (!room.closed || Math.abs(a) < 1) { const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]); return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2]; }
    let cx = 0, cy = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length], f = p[0] * q[1] - q[0] * p[1]; cx += (p[0] + q[0]) * f; cy += (p[1] + q[1]) * f; }
    return [cx / (6 * a), cy / (6 * a)];
  }
  function pointInPoly(p, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj - xi) * (p[1] - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  // Chiếu điểm lên đoạn gần nhất: {room, seg, at (mm từ đầu đoạn), dist}
  function nearestSeg(floor, p, filter = () => true) {
    let best = null;
    for (const room of floor.rooms) for (let i = 0; i < segCount(room); i++) {
      if (!filter(room, i)) continue;
      const [a, b] = segEnds(room, i), L = len(sub(b, a)), d = unit(sub(b, a));
      const at = Math.max(0, Math.min(L, dot(sub(p, a), d)));
      const dist = len(sub(p, add(a, mul(d, at))));
      if (!best || dist < best.dist) best = {room, seg: i, at, dist, len: L};
    }
    return best;
  }
  // Làm gọn nét phác tay: Douglas-Peucker, bẻ về 0/45/90°, làm tròn 100, gần điểm đầu thì khép kín
  function simplifySketch(path, tol) {
    const rdp = (pts) => {
      if (pts.length < 3) return pts;
      const [a, b] = [pts[0], pts[pts.length - 1]], d = unit(sub(b, a));
      let far = 0, idx = 0;
      pts.forEach((p, k) => { const v = sub(p, a), dist = Math.abs(v[0] * d[1] - v[1] * d[0]); if (dist > far) { far = dist; idx = k; } });
      return far > tol ? [...rdp(pts.slice(0, idx + 1)).slice(0, -1), ...rdp(pts.slice(idx))] : [a, b];
    };
    const raw = rdp(path);
    if (raw.length < 2) return null;
    const closed = raw.length > 3 && len(sub(raw[0], raw[raw.length - 1])) < tol * 4;
    const corners = closed ? raw.slice(0, -1) : raw;
    const pts = [[round(corners[0][0], 100), round(corners[0][1], 100)]];
    for (let k = 1; k < corners.length; k++) {
      const v = sub(corners[k], corners[k - 1]), ang = Math.round(Math.atan2(v[1], v[0]) / (Math.PI / 4)) * (Math.PI / 4);
      const L = round(len(v), 100);
      if (L) pts.push(add(pts[pts.length - 1], [round(Math.cos(ang) * L, 1), round(Math.sin(ang) * L, 1)]));
    }
    return pts.length > 1 ? {pts, closed: closed && pts.length > 2} : null;
  }

  // ---------- Thiết bị mặt bằng (gắn tường) ----------
  // h = cao độ mặc định (mm); vẽ trong hệ (u dọc tường, v hướng vào phòng)
  const DEVICES = {
    o_cam: {label: 'Ổ cắm', h: 350, note: 'mép dưới'},
    cong_tac: {label: 'Công tắc', h: 1200, note: 'mép trên'},
    dieu_hoa: {label: 'Điều hoà', h: 2300, note: 'đáy', w: 800},
    tu_dien: {label: 'Tủ điện', h: 1130, note: 'đáy', w: 300},
    den_tuong: {label: 'Đèn tường', h: 1800},
    mang: {label: 'Ổ mạng / TV', h: 350},
    cap_nuoc: {label: 'Cấp nước', h: 500},
    thoat_nuoc: {label: 'Thoát nước', h: 0},
    lavabo: {label: 'Lavabo', h: 800, w: 600},
    xi_bet: {label: 'Xí bệt', h: 0, w: 400},
    voi_sen: {label: 'Vòi sen', h: 1100},
    binh_nl: {label: 'Bình nóng lạnh', h: 1800, w: 500}
  };
  function deviceShape(type, w) {
    const P = (...pts) => ({t: 'poly', pts, close: true}), L = (a, b) => ({t: 'line', a, b}), C = (c, r) => ({t: 'circle', c, r});
    switch (type) {
      case 'o_cam': return [L([0, 0], [0, 70]), {t: 'poly', close: false, pts: Array.from({length: 9}, (_, k) => [80 * Math.cos(Math.PI * k / 8), 70 + 80 * Math.sin(Math.PI * k / 8)])}, L([-80, 70], [80, 70])];
      case 'cong_tac': return [L([0, 0], [0, 90]), C([0, 140], 50), L([35, 175], [110, 250])];
      case 'dieu_hoa': return [P([-w / 2, 0], [w / 2, 0], [w / 2, 220], [-w / 2, 220]), L([-w / 2 + 60, 150], [w / 2 - 60, 150])];
      case 'tu_dien': return [P([-w / 2, 0], [w / 2, 0], [w / 2, 140], [-w / 2, 140]), L([-w / 2, 140], [w / 2, 0])];
      case 'den_tuong': return [L([0, 0], [0, 60]), C([0, 130], 70), L([-50, 80], [50, 180]), L([50, 80], [-50, 180])];
      case 'mang': return [L([0, 0], [0, 70]), P([-70, 70], [70, 70], [0, 190])];
      case 'cap_nuoc': return [C([0, 70], 45)];
      case 'thoat_nuoc': return [C([0, 90], 60), L([-42, 48], [42, 132]), L([42, 48], [-42, 132])];
      case 'lavabo': return [P([-w / 2, 0], [w / 2, 0], [w / 2, 450], [-w / 2, 450]), {t: 'circle', c: [0, 240], r: Math.min(w / 2 - 70, 170)}];
      case 'xi_bet': return [P([-w / 2, 0], [w / 2, 0], [w / 2, 170], [-w / 2, 170]), {t: 'circle', c: [0, 400], r: w / 2 - 20}];
      case 'voi_sen': return [L([0, 0], [0, 180]), C([0, 260], 80), C([0, 260], 25)];
      case 'binh_nl': return [P([-w / 2, 0], [w / 2, 0], [w / 2, 380], [-w / 2, 380]), C([0, 190], 130)];
      default: return [C([0, 80], 60)];
    }
  }

  // ---------- Nét vẽ 1 tầng: dùng chung cho SVG và DXF ----------
  const COLOR = {wall: '#1f2329', wallFill: '#c9ced8', outer: '#6b7280', door: '#d9822b', window: '#3b82c4', dim: '#2f8a3c', dev: '#b3245d', text: '#1f2329', col: '#4b5563'};
  function devicePlace(plan, room, dev) {
    const [a, b] = segEnds(room, dev.seg), d = unit(sub(b, a)), n = normal(room, dev.seg), m = mul(n, -1);
    const sign = dev.flip ? -1 : 1;
    const at = Math.min(Math.max(dev.at, 0), segLen(room, dev.seg));
    const origin = add(a, mul(d, at));
    return {origin, map: ([u, v]) => add(origin, add(mul(d, u * sign), mul(m, v))), d, m};
  }
  function floorPrimitives(plan, floor, opts = {}) {
    const out = [], font = plan.font || 150, showDims = opts.dims !== false && plan.showDims !== false;
    const push = (p, extra) => out.push(Object.assign(p, extra));
    for (const room of floor.rooms) {
      const count = segCount(room);
      if (room.closed && room.pts.length > 2) push({t: 'poly', pts: room.pts, close: true, fill: opts.roomFill || 'rgba(255,255,255,.55)', layer: 'PHONG', hit: 'room:' + room.id});
      // tường
      for (let i = 0; i < count; i++) {
        const info = segInfo(plan, room, i), hit = 'seg:' + room.id + ':' + i;
        if (info.k === 'open') { push({t: 'line', a: segEnds(room, i)[0], b: segEnds(room, i)[1], stroke: COLOR.outer, w: 1, dash: '6 4', layer: 'TUONG', hit}); continue; }
        const q = wallQuad(plan, room, i);
        push({t: 'poly', pts: q, close: true, fill: COLOR.wallFill, layer: 'TUONG', hit});
        // nét trong / ngoài ngắt tại cửa
        const [a, b] = segEnds(room, i), d = unit(sub(b, a)), n = normal(room, i), L = segLen(room, i);
        const gaps = (room.openings || []).filter(op => op.seg === i).map(op => [op.at, op.at + op.w]).sort((x, y) => x[0] - y[0]);
        let from = 0;
        const piece = (s0, s1, first, last) => {
          if (s1 - s0 < 0.5 && !first && !last) return;
          push({t: 'line', a: add(a, mul(d, s0)), b: add(a, mul(d, s1)), stroke: COLOR.wall, w: 2.4, layer: 'TUONG', hit});
          push({t: 'line', a: first ? q[3] : add(add(a, mul(d, s0)), mul(n, info.t)), b: last ? q[2] : add(add(a, mul(d, s1)), mul(n, info.t)), stroke: COLOR.outer, w: 1, layer: 'TUONG', hit});
        };
        for (const [g0, g1] of gaps) { if (g0 > from) piece(from, g0, from === 0, false); from = Math.max(from, g1); }
        if (from < L) piece(from, L, from === 0, true);
        if (!room.closed && i === 0) push({t: 'line', a: q[0], b: q[3], stroke: COLOR.outer, w: 1, layer: 'TUONG'});
        if (!room.closed && i === count - 1) push({t: 'line', a: q[1], b: q[2], stroke: COLOR.outer, w: 1, layer: 'TUONG'});
      }
      // cửa
      for (const op of room.openings || []) {
        if (op.seg >= count) continue;
        const [a, b] = segEnds(room, op.seg), d = unit(sub(b, a)), n = normal(room, op.seg), t = segInfo(plan, room, op.seg).t;
        const p0 = add(a, mul(d, op.at)), p1 = add(a, mul(d, op.at + op.w)), o0 = add(p0, mul(n, t)), o1 = add(p1, mul(n, t));
        const hit = 'op:' + room.id + ':' + op.id;
        push({t: 'poly', pts: [p0, p1, o1, o0], close: true, fill: opts.bg || '#ffffff', layer: 'BG', hit});
        const color = op.type === 'window' ? COLOR.window : COLOR.door;
        push({t: 'line', a: p0, b: o0, stroke: color, w: 1.6, layer: 'CUA', hit});
        push({t: 'line', a: p1, b: o1, stroke: color, w: 1.6, layer: 'CUA', hit});
        if (op.type === 'window') {
          [0, .5, 1].forEach(f => push({t: 'line', a: add(p0, mul(n, t * f)), b: add(p1, mul(n, t * f)), stroke: color, w: f === .5 ? 1.6 : 1, layer: 'CUA', hit}));
        } else if (op.type === 'door') {
          const leaves = op.leaves === 2 ? [[p0, d, op.w / 2], [p1, mul(d, -1), op.w / 2]] : [[op.hinge === 'r' ? p1 : p0, op.hinge === 'r' ? mul(d, -1) : d, op.w]];
          const into = op.swing === 'out' ? n : mul(n, -1), base = op.swing === 'out' ? t : 0;
          for (const [h0, dir, w] of leaves) {
            const h = add(h0, mul(n, base)), tip = add(h, mul(into, w)), closeP = add(h, mul(dir, w));
            push({t: 'line', a: h, b: tip, stroke: color, w: 2, layer: 'CUA', hit});
            const a0 = Math.atan2(into[1], into[0]), a1 = Math.atan2(dir[1], dir[0]);
            let delta = a1 - a0; while (delta > Math.PI) delta -= 2 * Math.PI; while (delta < -Math.PI) delta += 2 * Math.PI;
            push({t: 'arc', c: h, r: w, a0, a1: a0 + delta, stroke: color, w: 1, dash: '8 6', layer: 'CUA', hit, end: closeP});
          }
        } else push({t: 'line', a: add(p0, mul(n, t / 2)), b: add(p1, mul(n, t / 2)), stroke: COLOR.outer, w: 1, dash: '6 4', layer: 'CUA', hit});
      }
      // thiết bị
      for (const dev of room.devices || []) {
        if (dev.seg >= count) continue;
        const spec = DEVICES[dev.type] || {label: dev.type}, {map, origin, m} = devicePlace(plan, room, dev), hit = 'dev:' + room.id + ':' + dev.id;
        const w = dev.w || spec.w || 0;
        for (const s of deviceShape(dev.type, w)) {
          if (s.t === 'line') push({t: 'line', a: map(s.a), b: map(s.b), stroke: COLOR.dev, w: 1.6, layer: 'THIETBI', hit});
          else if (s.t === 'poly') push({t: 'poly', pts: s.pts.map(map), close: s.close !== false, fill: 'none', stroke: COLOR.dev, w: 1.6, layer: 'THIETBI', hit});
          else if (s.t === 'circle') push({t: 'circle', c: map(s.c), r: s.r, stroke: COLOR.dev, w: 1.6, fill: 'none', layer: 'THIETBI', hit});
        }
        push({t: 'circle', c: map([0, 150]), r: 260, fill: 'transparent', stroke: 'none', layer: 'HIT', hit});
        const h = dev.h ?? spec.h;
        if (h) {
          const p = add(origin, mul(m, 380 + (w ? 120 : 0)));
          const ang = Math.atan2(m[1], m[0]) * 180 / Math.PI;
          push({t: 'text', p, s: '+' + h, size: font * .85, rot: readable(ang), fill: COLOR.dev, layer: 'THIETBI', hit});
        }
      }
      // ghi tên phòng
      if (room.pts.length > 1) {
        const c = centroid(room), lines = [room.name || 'Phòng'];
        if (room.closed) lines.push('S = ' + (area(room) / 1e6).toFixed(2).replace('.', ',') + ' m²');
        if (room.ceil) lines.push('Trần +' + room.ceil);
        lines.forEach((s, k) => push({t: 'text', p: add(c, [0, (k - (lines.length - 1) / 2) * font * 1.5]), s, size: k ? font * .9 : font * 1.1, weight: k ? 400 : 700, fill: COLOR.text, layer: 'CHU', hit: 'room:' + room.id}));
      }
      if (showDims) for (let i = 0; i < count; i++) dimsForSeg(plan, room, i, font, plan.devDims !== false).forEach(p => out.push(p));
    }
    for (const col of floor.columns || []) {
      const c = [col.x, col.y], hw = col.w / 2, hh = col.h / 2, rot = (col.rot || 0) * Math.PI / 180;
      const R = ([x, y]) => add(c, [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]);
      const hit = 'col:' + col.id;
      if (col.round) push({t: 'circle', c, r: hw, fill: COLOR.col, stroke: COLOR.wall, w: 1.4, layer: 'COT', hit});
      else {
        const q = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]].map(R);
        push({t: 'poly', pts: q, close: true, fill: COLOR.col, stroke: COLOR.wall, w: 1.4, layer: 'COT', hit});
        push({t: 'line', a: q[0], b: q[2], stroke: '#9ca3af', w: 1, layer: 'COT', hit});
        push({t: 'line', a: q[1], b: q[3], stroke: '#9ca3af', w: 1, layer: 'COT', hit});
      }
    }
    for (const dim of floor.dims || []) dimLine(dim.a, dim.b, dim.off || 0, String(Math.round(len(sub(dim.b, dim.a)))), font, 'fdim:' + dim.id).forEach(p => out.push(p));
    return out;
  }
  const readable = ang => { let a = ang; while (a > 90) a -= 180; while (a <= -90) a += 180; return a; };
  // 1 đường kích thước từ a đến b, dời ra phía pháp tuyến 1 khoảng off (âm = phía kia)
  function dimLine(a, b, off, text, font, hit, ext = 0) {
    const d = unit(sub(b, a)), n = [d[1], -d[0]], o = mul(n, off);
    const A = add(a, o), B = add(b, o), sgn = Math.sign(off) || 1, tick = mul(add(d, mul(n, 1)), 70 / Math.SQRT2);
    const out = [
      {t: 'line', a: A, b: B, stroke: COLOR.dim, w: 1, layer: 'DIM', hit},
      {t: 'line', a: add(a, mul(n, sgn * ext)), b: add(A, mul(n, sgn * 80)), stroke: COLOR.dim, w: .8, layer: 'DIM', hit},
      {t: 'line', a: add(b, mul(n, sgn * ext)), b: add(B, mul(n, sgn * 80)), stroke: COLOR.dim, w: .8, layer: 'DIM', hit},
      {t: 'line', a: sub(A, tick), b: add(A, tick), stroke: COLOR.dim, w: 1.4, layer: 'DIM', hit},
      {t: 'line', a: sub(B, tick), b: add(B, tick), stroke: COLOR.dim, w: 1.4, layer: 'DIM', hit}
    ];
    if (len(sub(b, a)) > 1) out.push({t: 'text', p: add(mul(add(A, B), .5), mul(n, sgn * font * .75)), s: text, size: font, rot: readable(Math.atan2(d[1], d[0]) * 180 / Math.PI), fill: COLOR.dim, layer: 'DIM', hit});
    return out;
  }
  // Dim 1 đoạn tường: lớp chia (cửa, thiết bị) sát tường, lớp tổng ngoài cùng; ghi phía ngoài phòng
  function dimsForSeg(plan, room, i, font, devDims) {
    const [a, b] = segEnds(room, i), L = segLen(room, i), d = unit(sub(b, a)), n = normal(room, i), t = segInfo(plan, room, i).t;
    if (L < 1) return [];
    const marks = new Set([0, Math.round(L)]);
    for (const op of room.openings || []) if (op.seg === i) { marks.add(Math.round(op.at)); marks.add(Math.round(op.at + op.w)); }
    if (devDims) for (const dev of room.devices || []) if (dev.seg === i) marks.add(Math.round(dev.at));
    const ticks = [...marks].filter(v => v >= 0 && v <= L + 0.5).sort((x, y) => x - y);
    const along = v => add(a, mul(d, v));
    // dimLine dời theo pháp tuyến trái của (A->B) = [d.y,-d.x]; đổi dấu nếu khác pháp tuyến ra ngoài
    const sgn = Math.sign(dot([d[1], -d[0]], n)) || 1, base = t + 350, hit = 'seg:' + room.id + ':' + i, out = [];
    if (ticks.length > 2) {
      for (let k = 1; k < ticks.length; k++) out.push(...dimLine(along(ticks[k - 1]), along(ticks[k]), sgn * base, String(ticks[k] - ticks[k - 1]), font * .9, hit, t + 60));
      out.push(...dimLine(a, b, sgn * (base + font * 3), String(Math.round(L)), font, hit, t + 60));
    } else out.push(...dimLine(a, b, sgn * base, String(Math.round(L)), font, hit, t + 60));
    return out;
  }
  function bounds(prims) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    const take = p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); };
    for (const p of prims) {
      if (p.t === 'poly') p.pts.forEach(take);
      else if (p.t === 'line') { take(p.a); take(p.b); }
      else if (p.t === 'circle' || p.t === 'arc') { take(sub(p.c, [p.r, p.r])); take(add(p.c, [p.r, p.r])); }
      else if (p.t === 'text') { take(sub(p.p, [p.size * p.s.length * .3, p.size])); take(add(p.p, [p.size * p.s.length * .3, p.size])); }
    }
    return x0 === Infinity ? null : {x0, y0, x1, y1};
  }

  // ---------- Xuất DXF (R12, mm 1:1, trục y lật lên) ----------
  const DXF_LAYERS = {TUONG: 7, CUA: 30, THIETBI: 6, DIM: 3, CHU: 7, COT: 8, PHONG: 9};
  const dxfText = s => String(s).replace(/[^\x20-\x7e]/g, ch => '\\U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
  function toDxf(prims) {
    const L = [];
    const e = (...pairs) => { for (let k = 0; k < pairs.length; k += 2) L.push(String(pairs[k]), String(pairs[k + 1])); };
    const f = v => (Math.round(v * 1000) / 1000).toString();
    e(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC');
    e(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, Object.keys(DXF_LAYERS).length);
    for (const [name, color] of Object.entries(DXF_LAYERS)) e(0, 'LAYER', 2, name, 70, 0, 62, color, 6, 'CONTINUOUS');
    e(0, 'ENDTAB', 0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    const line = (a, b, layer) => e(0, 'LINE', 8, layer, 10, f(a[0]), 20, f(-a[1]), 30, 0, 11, f(b[0]), 21, f(-b[1]), 31, 0);
    for (const p of prims) {
      const layer = DXF_LAYERS[p.layer] != null ? p.layer : null;
      if (!layer || p.layer === 'PHONG') continue;
      if (p.t === 'line') line(p.a, p.b, layer);
      else if (p.t === 'poly') p.pts.forEach((pt, k) => { if (k < p.pts.length - 1 || p.close) line(pt, p.pts[(k + 1) % p.pts.length], layer); });
      else if (p.t === 'circle') e(0, 'CIRCLE', 8, layer, 10, f(p.c[0]), 20, f(-p.c[1]), 30, 0, 40, f(p.r));
      else if (p.t === 'arc') {
        const deg = v => v * 180 / Math.PI, lo = Math.min(p.a0, p.a1), hi = Math.max(p.a0, p.a1);
        e(0, 'ARC', 8, layer, 10, f(p.c[0]), 20, f(-p.c[1]), 30, 0, 40, f(p.r), 50, f(-deg(hi)), 51, f(-deg(lo)));
      } else if (p.t === 'text') e(0, 'TEXT', 8, layer, 10, f(p.p[0]), 20, f(-p.p[1]), 30, 0, 40, f(p.size), 1, dxfText(p.s), 50, f(-(p.rot || 0)), 72, 1, 73, 2, 11, f(p.p[0]), 21, f(-p.p[1]), 31, 0);
    }
    e(0, 'ENDSEC', 0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  // ---------- Dữ liệu ----------
  function newPlan(meta = {}) {
    return {v: 1, name: meta.name || 'Bản vẽ mới', address: meta.address || '', surveyor: meta.surveyor || '', projectId: meta.projectId || '',
      wall: meta.wall || 140, partition: 100, snap: meta.snap || 10, font: 150, showDims: true, devDims: true, grid: true,
      floors: [{id: uid(), name: 'Tầng 1', rooms: [], columns: [], dims: []}], active: 0};
  }
  // Phòng chữ nhật có cửa đi ở tường dưới
  function rectRoom(x, y, w, h, name) {
    return {id: uid(), name: name || 'Phòng', closed: true, ceil: 0, pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], segs: [],
      openings: [{id: uid(), seg: 2, at: Math.max(0, w - 600 - 900), w: 900, type: 'door', hinge: 'l', swing: 'in'}], devices: []};
  }
  function samplePlan() {
    const plan = newPlan({name: 'Nhà mẫu – khảo sát hiện trạng'});
    const f = plan.floors[0];
    const p1 = rectRoom(0, 0, 3200, 3600, 'P1 – Phòng ngủ');
    p1.ceil = 3300;
    p1.openings.push({id: uid(), seg: 3, at: 1350, w: 900, type: 'window'});
    p1.devices.push({id: uid(), type: 'o_cam', seg: 1, at: 600, h: 400}, {id: uid(), type: 'o_cam', seg: 1, at: 3000, h: 400}, {id: uid(), type: 'cong_tac', seg: 2, at: 750, h: 1250}, {id: uid(), type: 'dieu_hoa', seg: 3, at: 1800, h: 2350});
    const p2 = {id: uid(), name: 'P2 – Phòng làm việc', closed: true, ceil: 3200, pts: [[4400, 0], [8900, 0], [8900, 3400], [4400, 3400]], segs: [],
      openings: [{id: uid(), seg: 0, at: 1200, w: 1500, type: 'window'}, {id: uid(), seg: 3, at: 1700, w: 900, type: 'door', hinge: 'r', swing: 'in'}], devices: []};
    const p3 = {id: uid(), name: 'P3 – Phòng cạnh chéo', closed: true, ceil: 3300, pts: [[4400, 5400], [7000, 5400], [8000, 6400], [8000, 9400], [4400, 9400]], segs: [], openings: [], devices: []};
    f.rooms.push(p1, p2, p3);
    f.columns.push({id: uid(), x: 4400 + 100 - 30, y: 5400 + 100 - 30, w: 200, h: 200});
    plan.floors.push({id: uid(), name: 'Tầng 2', rooms: [rectRoom(0, 0, 4000, 5000, 'P4 – Phòng khách')], columns: [], dims: []});
    return plan;
  }

  return {uid, add, sub, mul, dot, len, unit, round, wordsToNumber, tokens, parseCommand, stepVector, segCount, segEnds, segLen, signedArea, area, perimeter,
    normal, segInfo, wallQuad, setSegLength, centroid, pointInPoly, nearestSeg, simplifySketch, DEVICES, floorPrimitives, dimLine, bounds, toDxf, newPlan, rectRoom, samplePlan, COLOR, readable};
});
