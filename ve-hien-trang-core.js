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
    const raw = String(text || '').toLowerCase().normalize('NFC').replace(/(\d)\s*\+\s*(\d)/g, '$1+$2').replace(/(\d)(mm|cm|m)(?=\d)/g, '$1 $2 ').replace(/(\d)(m|mm|cm)\b/g, '$1 $2').split(/[\s;]+/).filter(Boolean);
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
        if (frac?.word === 'rưỡi' || frac?.word === 'ruoi') { mm += 500; i++; }
        else if (frac?.num != null && !UNIT_M.concat(UNIT_CM, UNIT_MM).includes(toks[i + 3]?.word)) { mm += Number('0.' + String(frac.raw || frac.num).replace(/\D/g, '')) * 1000; i++; }
        out.push({len: Math.round(mm)}); i++;
      } else if (UNIT_CM.includes(next)) { out.push({len: Math.round(t.num * 10)}); i++; }
      else if (UNIT_MM.includes(next)) { out.push({len: Math.round(t.num)}); i++; }
      else out.push({len: t.num < 100 && !Number.isInteger(t.num) ? t.num : Math.round(t.num)});   // 3,5 không đơn vị: để người gọi hiểu là mét
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
  // mode: 'square' giữ vuông (tường phía cuối dời theo) · 'shift' dời cả phần sau · 'end' chỉ dời điểm cuối
  function setSegLength(room, i, value, mode = 'square') {
    const [a, b] = segEnds(room, i), d = unit(sub(b, a)), delta = value - segLen(room, i);
    if (!delta) return;
    const endProj = dot(b, d), startProj = dot(a, d);
    const bi = (i + 1) % room.pts.length;
    if (mode === 'end') room.pts = room.pts.map((p, k) => k === bi ? add(p, mul(d, delta)) : p);
    else if (mode === 'shift') room.pts = room.pts.map((p, k) => (bi === 0 ? k === 0 : k > i) ? add(p, mul(d, delta)) : p);
    else room.pts = room.pts.map((p, k) => k === bi || (k !== i && dot(p, d) > endProj - 1 && dot(p, d) > startProj + 1) ? add(p, mul(d, delta)) : p);
    // cửa / thiết bị nằm trên các đoạn bị kéo theo không đổi vị trí tương đối; cửa "cả đoạn" giãn theo đoạn
    for (const op of room.openings || []) { const L = segLen(room, op.seg); if (op.full) op.w = L; else op.at = Math.max(0, Math.min(op.at, L - op.w)); }
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
    const out = [], font = opts.font || plan.font || 150, showDims = opts.dims !== false && plan.showDims !== false, ceil = opts.mode === 'ceil';
    const push = (p, extra) => out.push(Object.assign(p, extra));
    const rooms = opts.only ? floor.rooms.filter(r => opts.only.includes(r.id)) : floor.rooms;
    const inScope = p => !opts.only || rooms.some(r => r.closed && pointInPoly(p, r.pts));
    for (const room of rooms) {
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
        if (ceil) { [0, t].forEach(o => push({t: 'line', a: add(p0, mul(n, o)), b: add(p1, mul(n, o)), stroke: COLOR.outer, w: .8, dash: '6 5', layer: 'CUA', hit})); continue; }
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
      for (const dev of ceil ? [] : room.devices || []) {
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
        if (room.ceil) lines.push((room.gyps && ceil ? 'Trần BT +' : 'Trần +') + room.ceil);
        if (room.gyps && ceil) lines.push('Trần TC +' + room.gyps);
        lines.forEach((s, k) => push({t: 'text', p: add(c, [0, (k - (lines.length - 1) / 2) * font * 1.5]), s, size: k ? font * .9 : font * 1.1, weight: k ? 400 : 700, fill: COLOR.text, layer: 'CHU', hit: 'room:' + room.id}));
      }
      if (showDims) for (let i = 0; i < count; i++) dimsForSeg(plan, room, i, font, plan.devDims !== false, ceil).forEach(p => out.push(p));
    }
    for (const col of (floor.columns || []).filter(c => inScope([c.x, c.y]))) {
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
    for (const dim of (floor.dims || []).filter(d => (d.mode || 'plan') === (ceil ? 'ceil' : 'plan') && inScope(d.a))) dimLine(dim.a, dim.b, dim.off || 0, String(Math.round(len(sub(dim.b, dim.a)))), font, 'fdim:' + dim.id).forEach(p => out.push(p));
    if (ceil) {
      for (const line of (floor.ceilLines || []).filter(l => inScope(l.pts[0]))) ceilLinePrims(line, font, opts.sel === 'cl:' + line.id ? floor : null).forEach(p => out.push(p));
      for (const item of (floor.ceilItems || []).filter(c => inScope([c.x, c.y]))) {
        ceilItemPrims(item).forEach(p => out.push(p));
        if (item.dim || plan.ceilDims === 'all' || opts.sel === 'ci:' + item.id) ceilItemDims(floor, item, font).forEach(p => out.push(p));
      }
    }
    const mode = ceil ? 'ceil' : 'plan', mine = x => (x.mode || 'plan') === mode;
    for (const note of (floor.notes || []).filter(n => mine(n) && inScope([n.x, n.y]))) notePrims(note, font).forEach(p => out.push(p));
    for (const ar of (floor.arrows || []).filter(a => mine(a) && inScope(a.pts[0]))) arrowPrims(ar, font).forEach(p => out.push(p));
    if (opts.photos !== false) (floor.photos || []).forEach((ph, k) => { if (inScope([ph.x, ph.y])) photoPrims(ph, k + 1, font).forEach(p => out.push(p)); });
    if (opts.schedule ?? (ceil ? floor.schedCeil : floor.schedPlan)) {
      const b = bounds(out);
      if (b) scheduleTable(scheduleRows(plan, {...floor, rooms}, ceil ? 'ceil' : 'plan'), add([b.x1 + 1200, b.y0], floor['sched' + (ceil ? 'Ceil' : 'Plan') + 'Off'] || [0, 0]), font, ceil ? 'ceil' : 'plan').forEach(p => out.push(p));
    }
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
  function dimsForSeg(plan, room, i, font, devDims, totalOnly) {
    const [a, b] = segEnds(room, i), L = segLen(room, i), d = unit(sub(b, a)), n = normal(room, i), t = segInfo(plan, room, i).t;
    if (L < 1) return [];
    const marks = new Set([0, Math.round(L)]);
    if (!totalOnly) for (const op of room.openings || []) if (op.seg === i) { marks.add(Math.round(op.at)); marks.add(Math.round(op.at + op.w)); }
    if (devDims && !totalOnly) for (const dev of room.devices || []) if (dev.seg === i) marks.add(Math.round(dev.at));
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
  const DXF_LAYERS = {TUONG: 7, CUA: 30, THIETBI: 6, DIM: 3, CHU: 7, COT: 8, PHONG: 9, TRAN: 5, GHICHU: 1, ANH: 4, BANGKE: 7, MATDUNG: 7};
  const dxfText = s => String(s).replace(/[^\x20-\x7e]/g, ch => '\\U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0'));
  function toDxf(prims) {
    const L = [];
    const e = (...pairs) => { for (let k = 0; k < pairs.length; k += 2) L.push(String(pairs[k]), String(pairs[k + 1])); };
    const f = v => (Math.round(v * 1000) / 1000).toString();
    e(0, 'SECTION', 2, 'HEADER', 9, '$ACADVER', 1, 'AC1009', 9, '$INSUNITS', 70, 4, 0, 'ENDSEC');
    e(0, 'SECTION', 2, 'TABLES', 0, 'TABLE', 2, 'LAYER', 70, Object.keys(DXF_LAYERS).length);
    for (const [name, color] of Object.entries(DXF_LAYERS)) e(0, 'LAYER', 2, name, 70, 0, 62, color, 6, 'CONTINUOUS');
    // font TrueType để chữ tiếng Việt (\U+) hiện đúng trong AutoCAD, không rơi về txt.shx
    e(0, 'ENDTAB', 0, 'TABLE', 2, 'STYLE', 70, 1, 0, 'STYLE', 2, 'STANDARD', 70, 0, 40, 0, 41, 1, 50, 0, 71, 0, 42, 2.5, 3, 'arial.ttf', 4, '', 0, 'ENDTAB');
    e(0, 'ENDSEC', 0, 'SECTION', 2, 'ENTITIES');
    const line = (a, b, layer) => e(0, 'LINE', 8, layer, 10, f(a[0]), 20, f(-a[1]), 30, 0, 11, f(b[0]), 21, f(-b[1]), 31, 0);
    for (const p of prims) {
      const layer = DXF_LAYERS[p.layer] != null ? p.layer : null;
      if (!layer || p.layer === 'PHONG') continue;
      if (p.t === 'line') line(p.a, p.b, layer);
      else if (p.t === 'poly') p.pts.forEach((pt, k) => { if (k < p.pts.length - 1 || p.close) line(pt, p.pts[(k + 1) % p.pts.length], layer); });
      else if (p.t === 'circle') e(0, 'CIRCLE', 8, layer, 10, f(p.c[0]), 20, f(-p.c[1]), 30, 0, 40, f(p.r));
      else if (p.t === 'arc') {
        const deg = v => v * 180 / Math.PI, lo = Math.min(p.a0, p.a1), hi = Math.max(p.a0, p.a1);
        const n360 = v => ((v % 360) + 360) % 360;
        e(0, 'ARC', 8, layer, 10, f(p.c[0]), 20, f(-p.c[1]), 30, 0, 40, f(p.r), 50, f(n360(-deg(hi))), 51, f(n360(-deg(lo))));
      } else if (p.t === 'text') e(0, 'TEXT', 8, layer, 10, f(p.p[0]), 20, f(-p.p[1]), 30, 0, 40, f(p.size), 1, dxfText(p.s), 50, f(-(p.rot || 0)), 72, p.anchor === 'start' ? 0 : p.anchor === 'end' ? 2 : 1, 73, 2, 11, f(p.p[0]), 21, f(-p.p[1]), 31, 0);
    }
    e(0, 'ENDSEC', 0, 'EOF');
    return L.join('\r\n') + '\r\n';
  }

  // ---------- Mặt bằng trần ----------
  // size: số = đường kính / cạnh vuông (mm), 'AxB' = chữ nhật
  const CEIL = {
    downlight: {label: 'Downlight', sizes: [60, 76, 90, 110, 125, 135, 150, 175, 200], def: 90, round: true},
    op_tran: {label: 'Đèn ốp trần', sizes: [300, 400, 500, 600], def: 400, round: true},
    den_tha: {label: 'Đèn thả', sizes: [300, 400, 500], def: 400, round: true},
    den_ray: {label: 'Đèn ray', sizes: ['1000x60', '1500x60', '2000x60'], def: '1000x60'},
    quat_tran: {label: 'Quạt trần', sizes: [1200, 1400], def: 1200, round: true},
    cua_thoi: {label: 'Cửa gió thổi', sizes: ['600x150', '1000x150', '300x300'], def: '1000x150'},
    cua_hoi: {label: 'Cửa gió hồi', sizes: ['600x300', '600x600'], def: '600x300'},
    dh_cassette: {label: 'ĐH âm trần', sizes: ['840x840', '600x600'], def: '840x840'},
    lo_tham: {label: 'Lỗ thăm trần', sizes: [300, 450, 600], def: 450},
    bao_khoi: {label: 'Báo khói', sizes: [100], def: 100, round: true},
    dau_phun: {label: 'Đầu phun', sizes: [80], def: 80, round: true}
  };
  const sizeWH = s => { const m = String(s).match(/^(\d+)\s*[x×]\s*(\d+)$/); return m ? [+m[1], +m[2]] : [+s || 100, +s || 100]; };
  const sizeText = (type, s) => (CEIL[type]?.round ? 'Ø' : '') + String(s).replace('x', '×');
  const C_CEIL = '#c2410c';
  function ceilItemPrims(item) {
    const spec = CEIL[item.type] || {}, [w, h] = sizeWH(item.size ?? spec.def), c = [item.x, item.y], hit = 'ci:' + item.id;
    const rot = (item.rot || 0) * Math.PI / 180, R = ([x, y]) => add(c, [x * Math.cos(rot) - y * Math.sin(rot), x * Math.sin(rot) + y * Math.cos(rot)]);
    const st = {stroke: C_CEIL, w: 1.4, layer: 'TRAN', hit}, out = [], r = w / 2;
    const L = (a, b, extra) => out.push({t: 'line', a: R(a), b: R(b), ...st, ...extra});
    const box = (x0, y0, x1, y1) => out.push({t: 'poly', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].map(R), close: true, fill: 'none', ...st});
    if (spec.round) {
      out.push({t: 'circle', c, r, fill: 'none', ...st});
      if (item.type === 'downlight' || item.type === 'dau_phun') { const k = r * 1.5; L([-k, 0], [k, 0], {w: .8}); L([0, -k], [0, k], {w: .8}); }
      else if (item.type === 'op_tran') out.push({t: 'circle', c, r: r * .7, fill: 'none', ...st, w: .8});
      else if (item.type === 'den_tha') { const k = r * .7; L([-k, -k], [k, k]); L([k, -k], [-k, k]); }
      else if (item.type === 'quat_tran') for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3; L([Math.cos(a) * r * .15, Math.sin(a) * r * .15], [Math.cos(a) * r * .95, Math.sin(a) * r * .95], {w: 2}); }
      else if (item.type === 'bao_khoi') out.push({t: 'circle', c, r: r * .35, fill: C_CEIL, ...st});
    } else {
      const hw = w / 2, hh = h / 2;
      box(-hw, -hh, hw, hh);
      if (item.type === 'cua_thoi') for (let k = 1; k < 4; k++) L([-hw + 40, -hh + k * h / 4], [hw - 40, -hh + k * h / 4], {w: .8});
      else if (item.type === 'cua_hoi') for (let x = -hw + h / 3; x < hw; x += h / 3) L([x, -hh], [Math.max(-hw, x - h), hh], {w: .8});
      else if (item.type === 'dh_cassette') { box(-hw * .6, -hh * .6, hw * .6, hh * .6); L([-hw, -hh], [-hw * .6, -hh * .6]); L([hw, -hh], [hw * .6, -hh * .6]); L([hw, hh], [hw * .6, hh * .6]); L([-hw, hh], [-hw * .6, hh * .6]); }
      else if (item.type === 'lo_tham') { L([-hw, -hh], [hw, hh], {dash: '8 6', w: .8}); L([hw, -hh], [-hw, hh], {dash: '8 6', w: .8}); }
      else if (item.type === 'den_ray') L([-hw, 0], [hw, 0], {w: .8});
    }
    out.push({t: 'circle', c, r: Math.max(w, h) / 2 + 120, fill: 'transparent', stroke: 'none', layer: 'HIT', hit});
    return out;
  }
  // Tia từ p theo dir tới cạnh đa giác gần nhất -> khoảng cách
  function rayDist(pts, p, dir) {
    let best = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], e = sub(pts[(i + 1) % pts.length], a), cross = dir[0] * e[1] - dir[1] * e[0];
      if (Math.abs(cross) < 1e-9) continue;
      const w = sub(a, p), t = (w[0] * e[1] - w[1] * e[0]) / cross, s = (w[0] * dir[1] - w[1] * dir[0]) / cross;
      if (t > 0.5 && s >= -1e-6 && s <= 1 + 1e-6) best = Math.min(best, t);
    }
    return best;
  }
  // Dim thiết bị trần tới tường gần nhất theo 2 phương (trong phòng chứa nó)
  function ceilItemDims(floor, item, font) {
    const p = [item.x, item.y], room = floor.rooms.find(r => r.closed && pointInPoly(p, r.pts));
    if (!room) return [];
    const out = [], hit = 'ci:' + item.id;
    for (const pair of [[[-1, 0], [1, 0]], [[0, -1], [0, 1]]]) {
      const [dir, D] = pair.map(d => [d, rayDist(room.pts, p, d)]).sort((x, y) => x[1] - y[1])[0];
      if (!isFinite(D)) continue;
      const wallP = add(p, mul(dir, D));
      out.push(...dimLine(wallP, p, 0, String(Math.round(D)), font * .85, hit).map(q => ({...q, stroke: C_CEIL, fill: q.t === 'text' ? C_CEIL : q.fill})));
    }
    return out;
  }
  // Đường giật cấp / hắt LED: đa tuyến, ghi cao độ
  function ceilLinePrims(line, font, showDims) {
    const out = [], hit = 'cl:' + line.id, pts = line.pts, n = pts.length;
    for (let k = 0; k < n - 1 + (line.closed ? 1 : 0); k++) {
      const a = pts[k], b = pts[(k + 1) % n];
      out.push({t: 'line', a, b, stroke: C_CEIL, w: 1.6, dash: line.led ? '14 6 3 6' : null, layer: 'TRAN', hit});
      out.push({t: 'line', a, b, stroke: 'transparent', w: 14, layer: 'HIT', hit});
      if (showDims && len(sub(b, a)) > 1) out.push(...dimLine(a, b, -260, String(Math.round(len(sub(b, a)))), font * .85, hit));
    }
    if (n > 1 && (line.level || line.led)) {
      const a = pts[0], b = pts[1], d = unit(sub(b, a));
      out.push({t: 'text', p: add(mul(add(a, b), .5), mul([-d[1], d[0]], font * 1.2)), s: (line.level ? '+' + line.level : '') + (line.led ? ' LED hắt' : ''), size: font * .85, rot: readable(Math.atan2(d[1], d[0]) * 180 / Math.PI), fill: C_CEIL, layer: 'TRAN', hit});
    }
    return out;
  }

  // ---------- Ghi chú, mũi tên, ảnh ----------
  const C_NOTE = '#b91c1c';
  function wrapText(text, maxChars) {
    const out = [];
    for (const para of String(text || '').split('\n')) {
      let line = '';
      for (const w of para.split(/\s+/).filter(Boolean)) {
        if (line && (line + ' ' + w).length > maxChars) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
      }
      out.push(line);
    }
    return out;
  }
  // Khung ghi chú: x,y = góc trên trái; w = rộng khung (mm)
  function notePrims(note, font) {
    const size = note.size || font, color = note.color || C_NOTE, hit = 'note:' + note.id, pad = size * .6, w = note.w || size * 16;
    const raw = wrapText(note.text, Math.max(6, Math.floor((w - 2 * pad) / (size * .55))));
    const lines = raw.map((s, k) => note.list === 'dot' && s ? '• ' + s : note.list === 'num' && s ? (k + 1) + '. ' + s : s);
    const title = note.showTitle !== false ? (note.title || 'GHI CHÚ') : null, rows = (title ? 1 : 0) + lines.length, lh = size * 1.45;
    const h = rows * lh + pad * 2, x = note.x, y = note.y, out = [];
    if (note.frame !== false) out.push({t: 'poly', pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], close: true, fill: 'rgba(255,255,255,.85)', stroke: color, w: 1.2, layer: 'GHICHU', hit});
    else out.push({t: 'poly', pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], close: true, fill: 'transparent', stroke: 'none', layer: 'HIT', hit});
    let row = 0;
    const put = (s, bold) => { out.push({t: 'text', p: [x + pad, y + pad + (row + .5) * lh], s, size, anchor: 'start', weight: bold ? 700 : note.bold ? 700 : 400, fill: color, layer: 'GHICHU', hit}); row++; };
    if (title) put(title, true);
    lines.forEach(s => put(s));
    return out;
  }
  // Mũi tên: pts[0] = đầu mũi tên, pts[cuối] = chân có chữ
  function arrowPrims(ar, font) {
    const size = ar.size || font, color = ar.color || C_NOTE, hit = 'ar:' + ar.id, pts = ar.pts, out = [];
    for (let k = 1; k < pts.length; k++) {
      out.push({t: 'line', a: pts[k - 1], b: pts[k], stroke: color, w: 1.4, layer: 'GHICHU', hit});
      out.push({t: 'line', a: pts[k - 1], b: pts[k], stroke: 'transparent', w: 14, layer: 'HIT', hit});
    }
    if (pts.length > 1) {
      const d = unit(sub(pts[1], pts[0])), hl = size * 1.1, sp = .4;
      const wing = s => add(pts[0], mul([d[0] * Math.cos(s) - d[1] * Math.sin(s), d[0] * Math.sin(s) + d[1] * Math.cos(s)], hl));
      out.push({t: 'poly', pts: [pts[0], wing(sp), wing(-sp)], close: true, fill: color, stroke: color, w: 1, layer: 'GHICHU', hit});
      const tail = pts[pts.length - 1], dir = sub(tail, pts[pts.length - 2]), right = dir[0] >= 0;
      if (ar.text) wrapText(ar.text, 40).forEach((s, k) => out.push({t: 'text', p: add(tail, [right ? size * .4 : -size * .4, (k - .0) * size * 1.4 - size * .5]), s, size, anchor: right ? 'start' : 'end', fill: color, layer: 'GHICHU', hit}));
    }
    return out;
  }
  function photoPrims(ph, no, font) {
    const r = font * 1.3, c = [ph.x, ph.y], hit = 'ph:' + ph.id;
    return [{t: 'circle', c, r, fill: '#0ea5e9', stroke: '#ffffff', w: 2, layer: 'ANH', hit},
      {t: 'text', p: c, s: String(no), size: font * 1.2, weight: 700, fill: '#ffffff', layer: 'ANH', hit}];
  }

  // ---------- Bảng kê thiết bị ----------
  function scheduleRows(plan, floor, mode) {
    const map = new Map();
    const bump = (key, name, spec) => { const r = map.get(key) || {name, spec, qty: 0}; r.qty++; map.set(key, r); };
    if (mode === 'ceil') for (const it of floor.ceilItems || []) { const s = it.size ?? CEIL[it.type]?.def; bump(it.type + '|' + s, CEIL[it.type]?.label || it.type, sizeText(it.type, s)); }
    else for (const room of floor.rooms) for (const dev of room.devices || []) { const h = dev.h ?? DEVICES[dev.type]?.h; bump(dev.type + '|' + h, DEVICES[dev.type]?.label || dev.type, h ? '+' + h : ''); }
    return [...map.values()];
  }
  function scheduleTable(rows, origin, font, mode) {
    if (!rows.length) return [];
    const hit = 'sched:' + mode, cw = [2.6, 10, 6, 3].map(v => v * font), W = cw.reduce((a, b) => a + b, 0), rh = font * 2, out = [];
    const [x0, y0] = origin, H = (rows.length + 2) * rh;
    const ln = (a, b) => out.push({t: 'line', a, b, stroke: COLOR.text, w: 1, layer: 'BANGKE', hit});
    out.push({t: 'poly', pts: [[x0, y0], [x0 + W, y0], [x0 + W, y0 + H], [x0, y0 + H]], close: true, fill: '#ffffff', stroke: COLOR.text, w: 1.4, layer: 'BANGKE', hit});
    for (let k = 1; k <= rows.length + 1; k++) ln([x0, y0 + k * rh], [x0 + W, y0 + k * rh]);
    let x = x0;
    cw.slice(0, -1).forEach(w => { x += w; ln([x, y0 + rh], [x, y0 + H]); });
    const txt = (s, col, row, bold) => {
      const cx = x0 + cw.slice(0, col).reduce((a, b) => a + b, 0) + (col === 1 ? font * .4 : cw[col] / 2);
      out.push({t: 'text', p: [cx, y0 + (row + .5) * rh], s, size: font * .9, anchor: col === 1 ? 'start' : 'middle', weight: bold ? 700 : 400, fill: COLOR.text, layer: 'BANGKE', hit});
    };
    out.push({t: 'text', p: [x0 + W / 2, y0 + rh / 2], s: mode === 'ceil' ? 'BẢNG KÊ THIẾT BỊ TRẦN' : 'BẢNG KÊ THIẾT BỊ', size: font, weight: 700, fill: COLOR.text, layer: 'BANGKE', hit});
    ['STT', 'Thiết bị', mode === 'ceil' ? 'Quy cách' : 'Cao độ', 'SL'].forEach((s, c) => txt(s, c, 1, true));
    rows.forEach((r, k) => [String(k + 1), r.name, r.spec, String(r.qty)].forEach((s, c) => txt(s, c, k + 2)));
    return out;
  }

  // ---------- "Vẽ một phòng 3m5 nhân 4m, cửa đi phía trước rộng 900 cách trái 300, cửa sổ bên phải 1200, cột góc trên trái" ----------
  // Tường: trên (top) = phía sau, dưới (bottom) = phía trước. pos = khoảng cách từ trái (tường trên/dưới) hoặc từ trên (tường trái/phải)
  function parseRoomDescription(text) {
    let s = ' ' + String(text || '').toLowerCase().normalize('NFC') + ' ';
    s = s.replace(/(một|1)\s+(phòng|căn)/g, ' $2').replace(/phía\s*trước|mặt\s*trước|\btrước\b/g, ' #down ').replace(/phía\s*sau|mặt\s*sau/g, ' #up ').replace(/\bnhân\b|\bx\b|×|\*/g, ' ');
    s = s.replace(/(\d)[.,](?=\d)/g, '$1\u0001');
    const clauses = s.split(/[,;.\n]|\bvà\b|\brồi\b/).map(c => c.replace(/\u0001/g, ','));
    const out = {w: 0, h: 0, openings: [], columns: []};
    for (const raw of clauses) {
      let c = ' ' + raw + ' ';
      for (const [re, tag] of PHRASES) c = c.replace(re, tag);
      const items = lengths(tokens(c.replace(/\bcách\b/g, ' #at ').replace(/\brộng\b|\brong\b|\bdài\b/g, ' #w '))).map(t => t.len != null && t.len < 100 ? {len: Math.round(t.len * 1000)} : t);   // mô tả phòng: số < 100 = mét
      const words = items.filter(t => t.word).map(t => t.word), nums = items.filter(t => t.len != null).map(t => t.len);
      const sideOf = () => words.includes('#down') ? 'bottom' : words.includes('#up') ? 'top' : words.includes('#left') ? 'left' : words.includes('#right') ? 'right' : null;
      const type = words.includes('#window') ? 'window' : words.includes('#door') ? 'door' : words.includes('#open') ? 'open' : null;
      if (!out.w && nums.length >= 2 && (!type || !items.slice(0, items.findIndex(t => t.len != null)).some(t => ['#window', '#door', '#open'].includes(t.word)))) {
        out.w = nums[0]; out.h = nums[1];
        if (!type) continue;
        items.splice(0, items.findIndex((t, k) => t.len != null && k > items.findIndex(x => x.len != null)) + 1);
        nums.splice(0, 2);
      }
      if (type) {
        let w = null, at = null;
        items.forEach((t, k) => { if (t.len == null) return; const prev = items[k - 1]?.word; if (prev === '#at') at = t.len; else if (w == null) w = t.len; else if (at == null) at = t.len; });
        out.openings.push({type, side: sideOf() || 'bottom', w: w || (type === 'window' ? 1200 : 900), pos: at});
      } else if (/\bcột\b|\bcot\b/.test(raw)) {
        const v = words.includes('#up') ? 'top' : 'bottom', hz = words.includes('#left') ? 'left' : 'right';
        out.columns.push({corner: v + '-' + hz, size: nums[0] || 220});
      }
    }
    return out.w && out.h ? out : null;
  }
  // rectRoom: đoạn 0 trên (trái->phải), 1 phải (trên->dưới), 2 dưới (phải->trái), 3 trái (dưới->trên)
  function roomFromDescription(desc, x = 0, y = 0, name) {
    const {w, h} = desc, room = rectRoom(x, y, w, h, name);
    room.openings = [];
    const SEG = {top: 0, right: 1, bottom: 2, left: 3};
    for (const op of desc.openings) {
      const seg = SEG[op.side], L = seg % 2 ? h : w, ow = Math.min(op.w, L), pos = op.pos ?? (L - ow) / 2;
      const at = seg === 0 || seg === 1 ? pos : L - pos - ow;
      room.openings.push({id: uid(), seg, at: Math.max(0, Math.min(L - ow, at)), w: ow, type: op.type, hinge: 'l', swing: 'in'});
    }
    const columns = desc.columns.map(c => {
      const s = c.size, cx = c.corner.endsWith('left') ? x + s / 2 : x + w - s / 2, cy = c.corner.startsWith('top') ? y + s / 2 : y + h - s / 2;
      return {id: uid(), x: cx, y: cy, w: s, h: s};
    });
    return {room, columns};
  }

  // ---------- Mặt đứng 1 tường (nhìn từ trong phòng) ----------
  // Hệ toạ độ: u = 0..L trái->phải theo người nhìn, y = -cao độ (sàn y=0)
  function elevFrame(room, i) {
    const [a, b] = segEnds(room, i), n = normal(room, i), right = [-n[1], n[0]], L = segLen(room, i);
    const flip = dot(right, sub(b, a)) < 0;
    return {L, H: room.ceil || 3000, flip, u: at => flip ? L - at : at};
  }
  function elevPrimitives(plan, room, i, opts = {}) {
    const font = opts.font || plan.font || 150, {L, H, u} = elevFrame(room, i), out = [], st = (hit, extra) => ({stroke: COLOR.wall, w: 1.4, layer: 'MATDUNG', hit, ...extra});
    const box = (x0, y0, x1, y1, hit, extra) => out.push({t: 'poly', pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], close: true, fill: 'none', ...st(hit, extra)});
    box(0, 0, L, -H, 'wall', {w: 2.4, fill: '#ffffff'});
    out.push({t: 'line', a: [-400, 0], b: [L + 400, 0], ...st(null, {w: 2.4})});
    if (room.gyps) {
      out.push({t: 'line', a: [0, -room.gyps], b: [L, -room.gyps], ...st('wall', {stroke: C_CEIL, dash: '14 8'})});
      out.push({t: 'text', p: [L / 2, -room.gyps + font * .8], s: 'Trần thạch cao +' + room.gyps, size: font * .85, fill: C_CEIL, layer: 'MATDUNG', hit: 'wall'});
    }
    if (room.skirt) out.push({t: 'line', a: [0, -room.skirt], b: [L, -room.skirt], ...st('wall', {w: .8})});
    const xMarks = new Set([0, Math.round(L)]), yMarks = new Set([0, H]);
    for (const op of (room.openings || []).filter(o => o.seg === i)) {
      const x0 = Math.min(u(op.at), u(op.at + op.w)), x1 = x0 + op.w, hit = 'op:' + room.id + ':' + op.id;
      const color = op.type === 'window' ? COLOR.window : COLOR.door;
      const bottom = op.type === 'window' ? (op.sill ?? 900) : 0, top = op.type === 'window' ? bottom + (op.hw ?? 1400) : (op.h ?? 2100);
      box(x0, -bottom, x1, -top, hit, {stroke: color, fill: '#ffffff', w: 1.6, dash: op.type === 'open' ? '8 5' : null});
      if (op.type === 'door') { out.push({t: 'line', a: [x0, 0], b: [(x0 + x1) / 2, -top], ...st(hit, {stroke: color, w: .8, dash: '8 6'})}, {t: 'line', a: [x1, 0], b: [(x0 + x1) / 2, -top], ...st(hit, {stroke: color, w: .8, dash: '8 6'})}); }
      if (op.type === 'window') { out.push({t: 'line', a: [(x0 + x1) / 2, -bottom], b: [(x0 + x1) / 2, -top], ...st(hit, {stroke: color, w: .8})}); }
      [x0, x1].forEach(v => xMarks.add(Math.round(v)));
      [bottom, top].forEach(v => yMarks.add(v));
    }
    const ELEV = {dieu_hoa: [null, 280], tu_dien: [null, 400], lavabo: [null, 180], xi_bet: [null, 400], binh_nl: [null, 800], o_cam: [86, 86], cong_tac: [86, 86], mang: [86, 86], den_tuong: [200, 200]};
    for (const dev of (room.devices || []).filter(d => d.seg === i)) {
      const spec = DEVICES[dev.type] || {label: dev.type}, h = dev.h ?? spec.h ?? 0, x = u(dev.at), hit = 'dev:' + room.id + ':' + dev.id;
      const [ew, eh] = ELEV[dev.type] || [80, 80], w = ew || dev.w || spec.w || 80;
      // ổ cắm ghi mép dưới, công tắc mép trên, còn lại đáy
      const y0 = dev.type === 'cong_tac' ? -h + eh : -h;
      box(x - w / 2, y0, x + w / 2, y0 - eh, hit, {stroke: COLOR.dev, w: 1.6});
      out.push({t: 'circle', c: [x, y0 - eh / 2], r: Math.max(w, eh) / 2 + 150, fill: 'transparent', stroke: 'none', layer: 'HIT', hit});
      out.push({t: 'text', p: [x, y0 - eh - font * .8], s: spec.label + (h ? ' +' + h : ''), size: font * .75, fill: COLOR.dev, layer: 'MATDUNG', hit});
      xMarks.add(Math.round(x)); if (h) yMarks.add(h);
    }
    // dim ngang dưới, dim cao bên phải
    const xs = [...xMarks].filter(v => v >= 0 && v <= L + .5).sort((p, q) => p - q), ys = [...yMarks].sort((p, q) => p - q);
    if (xs.length > 2) for (let k = 1; k < xs.length; k++) out.push(...dimLine([xs[k - 1], 0], [xs[k], 0], -350, String(xs[k] - xs[k - 1]), font * .85, 'wall'));
    out.push(...dimLine([0, 0], [L, 0], xs.length > 2 ? -350 - font * 3 : -350, String(Math.round(L)), font, 'wall'));
    if (ys.length > 2) for (let k = 1; k < ys.length; k++) out.push(...dimLine([L, -ys[k - 1]], [L, -ys[k]], -350, String(ys[k] - ys[k - 1]), font * .85, 'wall'));
    out.push(...dimLine([L, 0], [L, -H], ys.length > 2 ? -350 - font * 3 : -350, String(H), font, 'wall'));
    out.push({t: 'text', p: [-450, -font * .6], s: '±0', size: font, anchor: 'end', fill: COLOR.text, layer: 'MATDUNG'});
    out.push({t: 'text', p: [-450, -H], s: '+' + H, size: font, anchor: 'end', fill: COLOR.text, layer: 'MATDUNG'});
    const ev = room.elev?.[i] || {};
    (ev.notes || []).forEach(n => out.push(...notePrims(n, font)));
    (ev.arrows || []).forEach(a => out.push(...arrowPrims(a, font)));
    return out;
  }

  // ---------- Đọc DXF làm nền (LINE, LWPOLYLINE, POLYLINE, CIRCLE, ARC, INSERT/BLOCK) ----------
  // -> {segs: [x1,y1,x2,y2,...] (y đã lật xuống), mmPerUnit, bounds}; shortcut: bỏ qua bulge cung tròn & chữ, cần thì thêm sau
  function parseDxf(text, maxSegs = 12000) {
    const lines = String(text).split(/\r?\n/), ents = [];
    for (let k = 0; k + 1 < lines.length; k += 2) {
      const c = Number(lines[k].trim()), v = lines[k + 1].trim();
      if (c === 0) ents.push({type: v, g: []}); else if (ents.length) ents[ents.length - 1].g.push([c, v]);
    }
    const get = (e, c) => e.g.find(p => p[0] === c)?.[1];
    const num = (e, c, def = 0) => { const v = get(e, c); return v == null ? def : Number(v); };
    const all = (e, c) => e.g.filter(p => p[0] === c).map(p => Number(p[1]));
    const blocks = {}, top = [];
    let section = null, block = null, units = 0;
    for (const e of ents) {
      if (e.type === 'SECTION') {
        section = get(e, 2);
        if (section === 'HEADER') { const k = e.g.findIndex(p => p[0] === 9 && p[1] === '$INSUNITS'); if (k >= 0) units = Number(e.g[k + 1]?.[1]) || 0; }
        continue;
      }
      if (e.type === 'ENDSEC') { section = null; continue; }
      if (section === 'BLOCKS') {
        if (e.type === 'BLOCK') { block = {base: [num(e, 10), num(e, 20)], ents: []}; blocks[get(e, 2)] = block; }
        else if (e.type === 'ENDBLK') block = null;
        else if (block) block.ents.push(e);
      } else if (section === 'ENTITIES' && num(e, 67) !== 1) top.push(e);
    }
    const segs = [];
    function draw(list, T, depth) {
      const seg = (a, b) => { if (segs.length < 400000) { const p = T(a), q = T(b); segs.push([p[0], -p[1], q[0], -q[1]]); } };
      const path = (pts, closed) => { for (let k = 1; k < pts.length; k++) seg(pts[k - 1], pts[k]); if (closed && pts.length > 2) seg(pts[pts.length - 1], pts[0]); };
      let pl = null;
      for (const e of list) {
        switch (e.type) {
          case 'LINE': seg([num(e, 10), num(e, 20)], [num(e, 11), num(e, 21)]); break;
          case 'LWPOLYLINE': { const xs = all(e, 10), ys = all(e, 20); path(xs.map((x, k) => [x, ys[k]]), num(e, 70) & 1); break; }
          case 'POLYLINE': pl = {pts: [], closed: num(e, 70) & 1}; break;
          case 'VERTEX': if (pl) pl.pts.push([num(e, 10), num(e, 20)]); break;
          case 'SEQEND': if (pl) { path(pl.pts, pl.closed); pl = null; } break;
          case 'CIRCLE': case 'ARC': {
            const c = [num(e, 10), num(e, 20)], r = num(e, 40), a0 = e.type === 'ARC' ? num(e, 50) : 0;
            let a1 = e.type === 'ARC' ? num(e, 51) : 360; if (a1 <= a0) a1 += 360;
            const n = Math.max(4, Math.ceil((a1 - a0) / 15)), pts = [];
            for (let k = 0; k <= n; k++) { const t = (a0 + (a1 - a0) * k / n) * Math.PI / 180; pts.push([c[0] + r * Math.cos(t), c[1] + r * Math.sin(t)]); }
            path(pts, false); break;
          }
          case 'INSERT': {
            const b = blocks[get(e, 2)];
            if (!b || depth > 4) break;
            const p = [num(e, 10), num(e, 20)], sx = num(e, 41, 1), sy = num(e, 42, 1), r = num(e, 50) * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
            draw(b.ents, q => { const x = (q[0] - b.base[0]) * sx, y = (q[1] - b.base[1]) * sy; return T([p[0] + x * cs - y * sn, p[1] + x * sn + y * cs]); }, depth + 1);
            break;
          }
        }
      }
    }
    draw(top, p => p, 0);
    let list = segs.filter(s => isFinite(s[0] + s[1] + s[2] + s[3]) && (s[0] !== s[2] || s[1] !== s[3]));
    if (list.length > maxSegs) list = list.sort((p, q) => Math.hypot(q[2] - q[0], q[3] - q[1]) - Math.hypot(p[2] - p[0], p[3] - p[1])).slice(0, maxSegs);
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const s of list) { x0 = Math.min(x0, s[0], s[2]); x1 = Math.max(x1, s[0], s[2]); y0 = Math.min(y0, s[1], s[3]); y1 = Math.max(y1, s[1], s[3]); }
    // gốc về (0,0) để làm tròn gọn; số nguyên theo đơn vị bản vẽ (mm thì 1 mm)
    const q = (x1 - x0) > 5e5 || !(x1 > x0) ? 1 : (x1 - x0) < 200 ? 1000 : 1;
    const flat = [];
    for (const s of list) flat.push(Math.round((s[0] - x0) * q) / q, Math.round((s[1] - y0) * q) / q, Math.round((s[2] - x0) * q) / q, Math.round((s[3] - y0) * q) / q);
    return {segs: flat, mmPerUnit: {1: 25.4, 4: 1, 5: 10, 6: 1000}[units] || 1, w: x1 - x0, h: y1 - y0, count: list.length, total: segs.length};
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
    normal, segInfo, wallQuad, setSegLength, centroid, pointInPoly, nearestSeg, simplifySketch, DEVICES, floorPrimitives, dimLine, bounds, toDxf, newPlan, rectRoom, samplePlan, COLOR, readable,
    CEIL, sizeWH, sizeText, wrapText, scheduleRows, parseRoomDescription, roomFromDescription, elevFrame, elevPrimitives, parseDxf, rayDist};
});
