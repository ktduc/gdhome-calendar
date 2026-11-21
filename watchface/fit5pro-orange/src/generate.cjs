// Xuất ảnh cho mặt "Orange Block". Dùng chung font/icon/hàm vẽ với mặt Yellow Block.
// Chạy:  node watchface/fit5pro-orange/src/generate.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LAYOUT = require('./layout.js');
const ICONS = require('../../fit5pro/src/icons.js');
const { fontCss, FONT_FACES, PAGE_LIB, ICONS_HELPERS, WEATHER } = require('../../fit5pro/src/generate.cjs');

const ROBOTO_DIR = path.join(__dirname, '..', '..', 'fit5pro-hybrid', 'src', 'fonts');
const ROBOTO_W = [300, 400, 500, 700];
function robotoCss() {
  const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
  const VIET = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
  const css = [];
  for (const w of ROBOTO_W) for (const [sub, range] of [['latin', LATIN], ['vietnamese', VIET]]) {
    const data = fs.readFileSync(path.join(ROBOTO_DIR, `roboto-${sub}-${w}-normal.woff2`)).toString('base64');
    css.push(`@font-face{font-family:'Roboto';font-weight:${w};unicode-range:${range};src:url(data:font/woff2;base64,${data}) format('woff2');}`);
  }
  return css.join('\n');
}

const SRC = __dirname;
const ROOT = path.join(SRC, '..');
const OUT = path.join(ROOT, 'assets');

// Thứ Hai → Chủ Nhật. [tên file, chữ hiển thị]
const WEEK = [['thu_2', 'THỨ 2'], ['thu_3', 'THỨ 3'], ['thu_4', 'THỨ 4'], ['thu_5', 'THỨ 5'],
  ['thu_6', 'THỨ 6'], ['thu_7', 'THỨ 7'], ['chu_nhat', 'CHỦ NHẬT']];
// 60 năm can chi, chỉ số 0 = Giáp Tý (vd. 1984, 2044). Chỉ số = (năm âm - 4) mod 60.
// Hiển thị viết tắt can như mẫu ("B Ngọ"); riêng Ất giữ nguyên chữ.
const CAN = ['Giáp', 'Ất', 'Bính', 'Đinh', 'Mậu', 'Kỷ', 'Canh', 'Tân', 'Nhâm', 'Quý'];
const CAN_SHORT = ['G', 'Ất', 'B', 'Đ', 'M', 'K', 'C', 'T', 'N', 'Q'];
const CHI = ['Tý', 'Sửu', 'Dần', 'Mão', 'Thìn', 'Tỵ', 'Ngọ', 'Mùi', 'Thân', 'Dậu', 'Tuất', 'Hợi'];
const slug = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const CANCHI = Array.from({ length: 60 }, (_, i) => {
  const name = `${CAN[i % 10]} ${CHI[i % 12]}`;
  return [`${String(i).padStart(2, '0')}_${slug(name).replace(' ', '_')}`, `${CAN_SHORT[i % 10]} ${CHI[i % 12]}`];
});

const FACE_FN = `
function midY(ctx, top, h, o) { ctx.font = font(o); return top + Math.round((h - capOf(ctx)) / 2); }
// Đường kẻ mảnh, mờ (giống nhau cho cả trên và dưới)
function thin(ctx, x, y, w, h) { ctx.fillStyle = col('line'); ctx.fillRect(x, y, w, h); }

async function background(aod) {
  const { w, h } = LAYOUT.screen;
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  const P = LAYOUT.panel, P2 = LAYOUT.panel2, D = LAYOUT.digitSets;

  // Khối giờ/phút + nhãn 24H (AOD giữ nguyên như màn hình chính)
  ctx.beginPath(); ctx.roundRect(P.x, P.y, P.w, P.h, P.r);
  ctx.fillStyle = col('orange'); ctx.fill();
  const tx = P.x + P.w / 2;
  ctx.beginPath(); ctx.roundRect(tx - 25, P.y + 4, 50, 20, 10); ctx.fillStyle = col('pill'); ctx.fill();
  text(ctx, '24H', tx, P.y + 7, { font: 'Barlow', weight: 500, size: 20, color: 'pillText', align: 'center' });

  // Dấu "/" của ngày/tháng/năm và âm lịch
  for (const x of LAYOUT.dateSlashes) text(ctx, '/', x, 213, { ...D.date, align: 'center' });
  for (const x of LAYOUT.lunarSlashes) text(ctx, '/', x, 253, { ...D.lunar, align: 'center' });
  if (aod) return c.toDataURL('image/png');

  // Khối giây
  rr(ctx, P2.x, P2.y, P2.w, P2.h, P2.r, 'orange');
  await drawIcon(ctx, 'bell', 'black', 277, 352, 27, 27);
  ctx.fillStyle = '#000'; ctx.fillRect(320, 342, 3, 51);
  text(ctx, 'SECOND', 331, 342, { font: 'Roboto', weight: 400, size: 17, color: 'black' });

  // Hàng trên: dự báo + bình minh (đường kẻ mảnh, mờ như bên dưới)
  text(ctx, 'FORECAST', 205, 27, { font: 'BarlowSC', weight: 500, size: 21, color: 'gray', ls: 1.4, align: 'center' });
  thin(ctx, 129, 45, 156, 1);
  thin(ctx, 223, 63, 1, 38);
  await drawIcon(ctx, 'sunrise', '#FFC21A', 231, 61, 36, 36);
  text(ctx, 'SUNRISE', 280, 88, { font: 'BarlowSC', weight: 500, size: 17, color: 'gray', ls: 1 });

  // Hoạt động (màu dịu như mẫu)
  thin(ctx, 16, 283, 180, 1);
  text(ctx, 'ACTIVITY', 40, 294, { font: 'Roboto', weight: 400, size: 17, color: 'dim' });
  await drawIcon(ctx, 'shoe', '#5C7F35', 37, 317, 27, 27);
  text(ctx, 'STEPS', 146, 334, { font: 'Roboto', weight: 400, size: 14, color: 'dim' });
  await drawIcon(ctx, 'heart', '#8E2B2B', 40, 361, 21, 21);
  text(ctx, 'BPM', 123, 371, { font: 'Roboto', weight: 400, size: 14, color: 'dim' });

  // Hàng dưới
  thin(ctx, 48, 410, 314, 1);
  await drawIcon(ctx, 'message', '#E6E6E6', 81, 427, 34, 34);
  text(ctx, 'POWER', 205, 420, { font: 'Roboto', weight: 400, size: 21, color: 'gray', align: 'center' });
  await drawIcon(ctx, 'phone', 'white', 279, 425, 34, 34);
  return c.toDataURL('image/png');
}

// Ảnh thứ: dãn/ép ngang (giữ chiều cao chữ) để nét chữ chạy đúng từ mép trái tới mép phải khối ngày.
function justText(label, spec, o, left, right) {
  const c = canvas(spec.w, spec.h), ctx = c.getContext('2d');
  ctx.font = font(o); ctx.fillStyle = col(o.color);
  const m = ctx.measureText(label);
  const inkL = -m.actualBoundingBoxLeft, inkW = m.actualBoundingBoxRight + m.actualBoundingBoxLeft;
  const sx = (right - left) / inkW;
  ctx.setTransform(sx, 0, 0, 1, (left - spec.x) - inkL * sx, 0);
  ctx.fillText(label, 0, spec.base);
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
  if (o.shadow) { lc.shadowColor = 'rgba(0,0,0,0.9)'; lc.shadowBlur = 9; lc.shadowOffsetY = 0; }
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
  const H = LAYOUT.widgets.hands, out = {};
  const live = { light: '#EAEAEA', mid: '#D2D2D2', dark: '#B0B0B0', alpha: LAYOUT.handAlpha, shadow: true };
  out['hands/hour.png'] = barHand(H.hour, { ...HAND_HOUR, ...live });
  out['hands/minute.png'] = barHand(H.minute, { ...HAND_MIN, ...live });
  out['hands/cap.png'] = capImg(col('orange'), '#D6D6D8', true);
  return out;
}
`;

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<html><head><style>${fontCss()}\n${robotoCss()}</style></head><body></body></html>`);
  await page.evaluate(async (faces) => {
    for (const [fam, , weights] of faces) for (const w of weights) {
      const f = `${w} 20px ${fam}`;
      await document.fonts.load(f, 'A0ỨẬ');
      if (!document.fonts.check(f, 'A0ỨẬ')) throw new Error('Font không tải được: ' + f);
    }
    for (const w of [300, 400, 500, 700]) { await document.fonts.load(w + ' 20px Roboto', 'A0ỨẬ'); }
  }, FONT_FACES);
  await page.addScriptTag({ content: `window.LAYOUT=${JSON.stringify(LAYOUT)};
    window.ICONS={${Object.entries(ICONS).map(([k, f]) => `${JSON.stringify(k)}:${f.toString()}`).join(',')}};
    ${ICONS_HELPERS}${PAGE_LIB}${FACE_FN}` });

  const files = await page.evaluate(async ({ WEEK, WEATHER, CANCHI }) => {
    const out = {};
    for (const s of Object.values(LAYOUT.digitSets)) {
      for (let d = 0; d <= 9; d++) out[s.prefix + d + '.png'] = cell(String(d), s.cell[0], s.cell[1], s);
    }
    const D = LAYOUT.digitSets;
    out['data/temp_c.png'] = cell('°C', 33, D.temp.cell[1], D.temp);
    out['data/temp_minus.png'] = cell('-', 11, D.temp.cell[1], D.temp);
    out['data/hilo_slash.png'] = cell('/', 7, D.hilo.cell[1], D.hilo);
    out['data/hilo_minus.png'] = cell('-', 7, D.hilo.cell[1], D.hilo);
    out['data/sun_colon.png'] = cell(':', 5, D.sun.cell[1], D.sun);
    out['data/act_empty.png'] = cell('--', 28, D.act.cell[1], D.act);
    out['data/bat_pct.png'] = cell('%', 24, D.bat.cell[1], D.bat);

    const W = LAYOUT.widgets;
    const wk = { font: 'Roboto', weight: 500, size: 53, color: 'orange' };
    WEEK.forEach(([slug, label], i) => { out[`date/week_${i + 1}_${slug}.png`] = justText(label, W.week, wk, LAYOUT.dateBlock.left, LAYOUT.dateBlock.right); });
    const cc = { font: 'Roboto', weight: 300, size: 22, color: 'lunar' };
    CANCHI.forEach(([slug, label]) => { out[`date/canchi_${slug}.png`] = leftText(label, W.canchi.w, W.canchi.h, cc, W.canchi.base); });

    for (const w of WEATHER) out[`weather/${w}.png`] = await icon(w, '#FFC21A', 56, 48);
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
