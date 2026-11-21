// Xuất ảnh cho mặt "Orange Block". Dùng chung font/icon/hàm vẽ với mặt Yellow Block.
// Chạy:  node watchface/fit5pro-orange/src/generate.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LAYOUT = require('./layout.js');
const ICONS = require('../../fit5pro/src/icons.js');
const { fontCss, FONT_FACES, PAGE_LIB, ICONS_HELPERS, WEATHER } = require('../../fit5pro/src/generate.cjs');

const SRC = __dirname;
const ROOT = path.join(SRC, '..');
const OUT = path.join(ROOT, 'assets');

// Thứ Hai → Chủ Nhật. [tên file, chữ hiển thị]
const WEEK = [['thu_2', 'THỨ 2'], ['thu_3', 'THỨ 3'], ['thu_4', 'THỨ 4'], ['thu_5', 'THỨ 5'],
  ['thu_6', 'THỨ 6'], ['thu_7', 'THỨ 7'], ['chu_nhat', 'CHỦ NHẬT']];
// 60 năm can chi, chỉ số 0 = Giáp Tý (vd. 1984, 2044). Chỉ số = (năm âm - 4) mod 60.
const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const CANCHI = Array.from({ length: 60 }, (_, i) => {
  const name = `${CAN[i % 10]} ${CHI[i % 12]}`;
  return [`${String(i).padStart(2, '0')}_${slug(name).replace(' ', '_')}`, name];
});

const FACE_FN = `
const LB = { font: 'BarlowSC', weight: 500, size: 15, color: 'gray', ls: 1.2 };
function midY(ctx, top, h, o) { ctx.font = font(o); return top + Math.round((h - capOf(ctx)) / 2); }

async function background(aod) {
  const { w, h } = LAYOUT.screen;
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const P = LAYOUT.panel, P2 = LAYOUT.panel2, D = LAYOUT.digitSets;

  // Khối giờ/phút + nhãn 24H
  ctx.beginPath(); ctx.roundRect(P.x, P.y, P.w, P.h, P.r);
  if (aod) { ctx.strokeStyle = col('orange'); ctx.lineWidth = 2; ctx.stroke(); }
  else { ctx.fillStyle = col('orange'); ctx.fill(); }
  const tx = P.x + P.w / 2;
  rr(ctx, tx - 32, P.y - 9, 64, 22, 9, aod ? 'black' : 'orange');
  if (aod) { ctx.beginPath(); ctx.roundRect(tx - 32, P.y - 9, 64, 22, 9); ctx.strokeStyle = col('orange'); ctx.lineWidth = 1.5; ctx.stroke(); }
  else rr(ctx, tx - 29, P.y - 6, 58, 16, 7, 'black');
  text(ctx, '24H', tx, P.y - 3, { font: 'Barlow', weight: 700, size: 14, color: 'orange', align: 'center', ls: 0.5 });

  // Dấu "/" của ngày/tháng/năm
  const dO = { ...D.date, color: aod ? '#BDBDBD' : 'white' };
  for (const x of [57, 105]) text(ctx, '/', x, midY(ctx, 190, 40, dO), { ...dO, align: 'center' });
  if (aod) return c.toDataURL('image/png');

  // Khối giây
  rr(ctx, P2.x, P2.y, P2.w, P2.h, P2.r, 'orange');
  await drawIcon(ctx, 'bell', 'black', P2.x + 18, P2.y + 18, 30, 30);
  ctx.fillStyle = '#000'; ctx.fillRect(P2.x + 70, P2.y + 9, 2.5, P2.h - 18);
  text(ctx, 'SECOND', 338, P2.y + 4, { font: 'BarlowSC', weight: 600, size: 13, color: 'black', align: 'center', ls: 0.5 });

  // Hàng trên: dự báo + bình minh
  text(ctx, 'FORECAST', 204, 12, { ...LB, align: 'center' });
  hline(ctx, 14, 394, 32);
  ctx.fillStyle = C.line; ctx.fillRect(212, 40, 1.5, 56);
  await drawIcon(ctx, 'sunrise', '#FFC21A', 226, 44, 40, 40);
  text(ctx, 'SUNRISE', 274, 74, LB);
  hline(ctx, 14, 394, 104);

  // Âm lịch: dấu "/"
  const lO = D.lunar;
  for (const x of [44.5, 79.5]) text(ctx, '/', x, midY(ctx, 232, 30, lO), { ...lO, align: 'center' });

  // Hoạt động
  hline(ctx, 14, 206, 272);
  text(ctx, 'ACTIVITY', 14, 282, LB);
  await drawIcon(ctx, 'shoe', '#7DC243', 14, 316, 32, 32);
  text(ctx, 'STEPS', 150, 324, { ...LB, size: 16 });
  await drawIcon(ctx, 'heart', '#E53935', 16, 377, 28, 28);
  text(ctx, 'BPM', 150, 384, { ...LB, size: 16 });

  // Hàng dưới
  hline(ctx, 34, 374, 434);
  text(ctx, 'POWER', 204, 439, { ...LB, size: 14, align: 'center' });
  await drawIcon(ctx, 'message', 'white', 72, 442, 34, 34);
  await drawIcon(ctx, 'phone', 'white', 302, 443, 32, 32);
  return c.toDataURL('image/png');
}

// Ảnh chữ căn trái, tự thu nhỏ nếu quá rộng; chừa chỗ cho dấu tiếng Việt.
function leftText(label, w, h, o, base) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  let size = o.size;
  ctx.letterSpacing = (o.ls || 0) + 'px';
  for (;; size--) { ctx.font = font({ ...o, size }); if (ctx.measureText(label).width <= w - 2) break; }
  ctx.fillStyle = col(o.color); ctx.fillText(label, 1, base);
  return c.toDataURL('image/png');
}

// ---- Kim: dáng kim của mặt mẫu Hybrid (thanh bạc bản đều, mũi nhọn ngắn, đuôi vát), có bóng đổ ----
function barHand(spec, o) {
  const [px, py] = spec.pivot, hw = o.width / 2;
  const lay = canvas(spec.w, spec.h), lc = lay.getContext('2d');
  if (o.shadow) { lc.shadowColor = 'rgba(0,0,0,0.85)'; lc.shadowBlur = 10; lc.shadowOffsetY = 2; }
  lc.beginPath();
  lc.moveTo(px, py - o.len);
  lc.lineTo(px + hw, py - o.len + o.taper);
  lc.lineTo(px + hw, py + o.tail - o.cut);
  lc.lineTo(px - hw, py + o.tail);
  lc.lineTo(px - hw, py - o.len + o.taper);
  lc.closePath();
  const g = lc.createLinearGradient(px - hw, 0, px + hw, 0);
  g.addColorStop(0, o.light); g.addColorStop(0.55, o.mid); g.addColorStop(1, o.dark);
  lc.fillStyle = g; lc.fill();
  const c = canvas(spec.w, spec.h), ctx = c.getContext('2d');
  ctx.globalAlpha = o.alpha; ctx.drawImage(lay, 0, 0);
  return c.toDataURL('image/png');
}
function capImg(color, ring, shadow) {
  const c = canvas(18, 18), ctx = c.getContext('2d');
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 3; }
  ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(9, 9, 7, 0, Math.PI * 2); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(9, 9, 4, 0, Math.PI * 2); ctx.fill();
  return c.toDataURL('image/png');
}
const HAND_HOUR = { len: 142, width: 12, taper: 12, tail: 27, cut: 9 };
const HAND_MIN  = { len: 197, width: 10, taper: 11, tail: 36, cut: 8 };
function hands() {
  const H = LAYOUT.widgets.hands, A = LAYOUT.aod.widgets.hands, out = {};
  const live = { light: '#EAEAEA', mid: '#D2D2D2', dark: '#B0B0B0', alpha: LAYOUT.handAlpha, shadow: true };
  const dim = { light: '#8C8C8C', mid: '#7E7E7E', dark: '#6A6A6A', alpha: 0.9, shadow: false };
  out['hands/hour.png'] = barHand(H.hour, { ...HAND_HOUR, ...live });
  out['hands/minute.png'] = barHand(H.minute, { ...HAND_MIN, ...live });
  out['hands/cap.png'] = capImg(col('orange'), '#D6D6D8', true);
  out['aod/hand_hour.png'] = barHand(A.hour, { ...HAND_HOUR, ...dim });
  out['aod/hand_minute.png'] = barHand(A.minute, { ...HAND_MIN, ...dim });
  out['aod/hand_cap.png'] = capImg('#B5561A', '#7A7A7A', false);
  return out;
}
`;

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<html><head><style>${fontCss()}</style></head><body></body></html>`);
  await page.evaluate(async (faces) => {
    for (const [fam, , weights] of faces) for (const w of weights) {
      const f = `${w} 20px ${fam}`;
      await document.fonts.load(f, 'A0ỨẬ');
      if (!document.fonts.check(f, 'A0ỨẬ')) throw new Error('Font không tải được: ' + f);
    }
  }, FONT_FACES);
  await page.addScriptTag({ content: `window.LAYOUT=${JSON.stringify(LAYOUT)};
    window.ICONS={${Object.entries(ICONS).map(([k, f]) => `${JSON.stringify(k)}:${f.toString()}`).join(',')}};
    ${ICONS_HELPERS}${PAGE_LIB}${FACE_FN}` });

  const files = await page.evaluate(async ({ WEEK, WEATHER, CANCHI }) => {
    const out = {};
    for (const s of [...Object.values(LAYOUT.digitSets), ...Object.values(LAYOUT.aod.digitSets)]) {
      for (let d = 0; d <= 9; d++) out[s.prefix + d + '.png'] = cell(String(d), s.cell[0], s.cell[1], s);
    }
    const D = LAYOUT.digitSets;
    out['data/num_c.png'] = cell('°C', 36, D.num.cell[1], D.num);
    out['data/num_minus.png'] = cell('-', 12, D.num.cell[1], D.num);
    out['data/num_empty.png'] = cell('--', 32, D.num.cell[1], D.num);
    out['data/gray_slash.png'] = cell('/', 8, D.gray.cell[1], D.gray);
    out['data/gray_minus.png'] = cell('-', 8, D.gray.cell[1], D.gray);
    out['data/small_colon.png'] = cell(':', 7, D.small.cell[1], D.small);
    out['data/small_pct.png'] = cell('%', 18, D.small.cell[1], D.small);

    const wk = { font: 'Barlow', weight: 700, size: 58, color: 'orange', ls: 0.5 };
    WEEK.forEach(([slug, label], i) => { out[`date/week_${i + 1}_${slug}.png`] = leftText(label, 196, 66, wk, 58); });
    const cc = { font: 'Barlow', weight: 500, size: 25, color: 'lunar' };
    CANCHI.forEach(([slug, label]) => { out[`date/canchi_${slug}.png`] = leftText(label, 118, 34, cc, 25); });

    for (const w of WEATHER) out[`weather/${w}.png`] = await icon(w, '#FFC21A', 66, 56);
    Object.assign(out, hands());
    out['background.png'] = await background(false);
    out['aod/background_aod.png'] = await background(true);
    return out;
  }, { WEEK, WEATHER, CANCHI });

  for (const [rel, data] of Object.entries(files)) {
    const p = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('Đã xuất', Object.keys(files).length, 'ảnh vào', OUT);

  for (const [q, name] of [['', 'preview.png'], ['&aod=1', 'preview_aod.png']]) {
    await page.goto('file://' + path.join(SRC, 'preview.html') + '?static=1' + q);
    await page.waitForFunction(() => window.__ready === true);
    await (await page.$('#face')).screenshot({ path: path.join(ROOT, name) });
  }
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
