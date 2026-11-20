// Xuất toàn bộ ảnh PNG cho mặt đồng hồ bằng Chromium (Playwright) + canvas.
// Chạy:  node watchface/fit5pro/src/generate.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LAYOUT = require('./layout.js');
const ICONS = require('./icons.js');

const SRC = __dirname;
const OUT = path.join(SRC, '..', 'assets');

// Thứ Hai → Chủ Nhật. [tên file, chữ hiển thị]
const WEEK = [['thu_hai', 'THỨ HAI'], ['thu_ba', 'THỨ BA'], ['thu_tu', 'THỨ TƯ'], ['thu_nam', 'THỨ NĂM'],
  ['thu_sau', 'THỨ SÁU'], ['thu_bay', 'THỨ BẢY'], ['chu_nhat', 'CHỦ NHẬT']];
const WEATHER = ['sunny', 'partly_cloudy', 'cloudy', 'rain', 'heavy_rain', 'thunder', 'snow', 'fog', 'wind', 'night', 'unknown'];

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const VIET = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
const FONT_FACES = [['Barlow', 'barlow', [500, 600, 700]], ['BarlowSC', 'barlow-semi-condensed', [500, 600, 700]]];

function fontCss() {
  const css = [];
  for (const [fam, file, weights] of FONT_FACES) for (const w of weights) for (const [sub, range] of [['latin', LATIN], ['vietnamese', VIET]]) {
    const data = fs.readFileSync(path.join(SRC, 'fonts', `${file}-${sub}-${w}-normal.woff2`)).toString('base64');
    css.push(`@font-face{font-family:'${fam}';font-weight:${w};unicode-range:${range};src:url(data:font/woff2;base64,${data}) format('woff2');}`);
  }
  return css.join('\n');
}

// Mã chạy trong trang: các hàm vẽ canvas.
const PAGE_LIB = `
const C = LAYOUT.colors;
const col = (k) => C[k] || k;
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function font(o) { return o.weight + ' ' + o.size + 'px ' + o.font; }
function capOf(ctx) { return ctx.measureText('0').actualBoundingBoxAscent; }
// Vẽ chữ: y = mép trên của chữ hoa/số. align left|center|right
function text(ctx, s, x, y, o) {
  ctx.font = font(o); ctx.fillStyle = col(o.color); ctx.letterSpacing = (o.ls || 0) + 'px';
  ctx.textAlign = o.align || 'left'; ctx.textBaseline = 'alphabetic';
  const cap = ctx.measureText('H').actualBoundingBoxAscent;
  ctx.fillText(s, x, y + cap);
}
// Ảnh ô cố định, chữ căn giữa ngang, baseline thống nhất theo số '0'.
function cell(s, w, h, o, align) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.font = font(o); ctx.fillStyle = col(o.color); ctx.letterSpacing = (o.ls || 0) + 'px';
  const cap = capOf(ctx);
  const base = Math.round((h + cap) / 2);
  if (align === 'left') { ctx.textAlign = 'left'; ctx.fillText(s, 0, base); }
  else { ctx.textAlign = 'center'; ctx.fillText(s, w / 2, base); }
  return c.toDataURL('image/png');
}
function loadSvg(str) {
  return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej;
    i.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(str); });
}
async function icon(name, color, w, h) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  const img = await loadSvg(ICONS[name](col(color)).replace('<svg ', '<svg width="' + w + '" height="' + h + '" preserveAspectRatio="xMidYMid meet" '));
  ctx.drawImage(img, 0, 0, w, h);
  return c.toDataURL('image/png');
}
async function drawIcon(ctx, name, color, x, y, w, h) {
  const img = await loadSvg(ICONS[name](col(color)).replace('<svg ', '<svg width="' + w + '" height="' + h + '" '));
  ctx.drawImage(img, x, y, w, h);
}
function rr(ctx, x, y, w, h, r, fill) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.fillStyle = col(fill); ctx.fill(); }
function hline(ctx, x1, x2, y) { ctx.fillStyle = C.line; ctx.fillRect(x1, y, x2 - x1, 1.5); }
`;

// Nền tĩnh 408x480: khung vàng, đường kẻ, nhãn, icon cố định.
const BG_FN = `async function background(withBlack) {
  const { w, h } = LAYOUT.screen;
  const c = canvas(w, h), ctx = c.getContext('2d');
  if (withBlack) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }
  const L = { font: 'BarlowSC', weight: 500, size: 17, color: 'gray', ls: 1.2 };
  // Hàng trên: dự báo
  text(ctx, 'FORECAST', 204, 26, { ...L, align: 'center' });
  hline(ctx, 26, 382, 50);
  ctx.fillStyle = C.line; ctx.fillRect(220, 60, 1.5, 44);
  await drawIcon(ctx, 'sunrise', 'yellow', 234, 60, 36, 36);
  text(ctx, 'SUNRISE', 280, 88, { ...L, size: 15 });
  hline(ctx, 26, 382, 114);

  // Khối giờ vàng – bên phải
  rr(ctx, 212, 122, 172, 204, 18, 'yellow');
  rr(ctx, 268, 113, 60, 22, 9, 'yellow');
  rr(ctx, 271, 116, 54, 16, 7, 'black');
  text(ctx, '24H', 298, 119, { font: 'Barlow', weight: 700, size: 14, color: 'yellow', align: 'center', ls: 0.5 });

  // Khối giây
  rr(ctx, 212, 332, 172, 72, 18, 'yellow');
  await drawIcon(ctx, 'bell', 'black', 230, 352, 32, 32);
  ctx.fillStyle = '#000'; ctx.fillRect(283, 342, 2.5, 52);
  text(ctx, 'SECOND', 334, 338, { font: 'BarlowSC', weight: 600, size: 14, color: 'black', align: 'center', ls: 0.5 });

  // Cột trái: lịch
  text(ctx, 'CALENDAR', 26, 128, L);
  const dayO = LAYOUT.digitSets.day;
  ctx.font = font(dayO);
  const dCap = capOf(ctx);
  text(ctx, '/', 89, 200 + Math.round((42 - dCap) / 2), { ...dayO, align: 'center' });
  // Âm lịch
  await drawIcon(ctx, 'night', 'yellow', 25, 250, 20, 20);
  const lu = LAYOUT.digitSets.lunar;
  ctx.font = font(lu);
  const lCap = capOf(ctx);
  text(ctx, '/', 78, 248 + Math.round((24 - lCap) / 2), { ...lu, align: 'center' });
  text(ctx, 'ÂL', 113, 248 + Math.round((24 - lCap) / 2), { font: 'BarlowSC', weight: 600, size: 21, color: 'gray' });
  hline(ctx, 26, 198, 280);

  // Cột trái: hoạt động
  text(ctx, 'ACTIVITY', 26, 292, L);
  await drawIcon(ctx, 'shoe', '#3DDC84', 24, 320, 30, 30);
  text(ctx, 'STEPS', 152, 328, { ...L, size: 15, ls: 0.6 });
  await drawIcon(ctx, 'heart', '#FF3B30', 25, 365, 28, 28);
  text(ctx, 'BPM', 152, 372, { ...L, size: 15, ls: 0.6 });

  // Hàng dưới
  hline(ctx, 26, 382, 412);
  text(ctx, 'POWER', 204, 420, { ...L, align: 'center' });
  await drawIcon(ctx, 'message', 'white', 78, 424, 36, 36);
  await drawIcon(ctx, 'phone', 'white', 294, 424, 34, 34);
  return c.toDataURL('image/png');
}`;

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
    ${ICONS_HELPERS}${PAGE_LIB}${BG_FN}` });

  const files = await page.evaluate(async ({ WEEK, WEATHER }) => {
    const out = {};
    const sets = LAYOUT.digitSets;
    for (const [, s] of Object.entries(sets)) {
      for (let d = 0; d <= 9; d++) out[s.prefix + d + '.png'] = cell(String(d), s.cell[0], s.cell[1], s);
    }
    const n = sets.num, g = sets.gray, sm = sets.small;
    out['data/num_minus.png'] = cell('-', 12, n.cell[1], n);
    out['data/unit_c.png'] = cell('°C', 34, n.cell[1], n);
    out['data/unit_pct.png'] = cell('%', 22, n.cell[1], n);
    out['data/gray_slash.png'] = cell('/', 8, g.cell[1], g);
    out['data/gray_minus.png'] = cell('-', 8, g.cell[1], g);
    out['data/small_colon.png'] = cell(':', 6, sm.cell[1], sm);
    out['data/num_empty.png'] = cell('--', 30, n.cell[1], n);

    // Ảnh thứ: chừa chỗ phía trên cho dấu tiếng Việt (và dấu nặng phía dưới).
    const wk = { font: 'BarlowSC', weight: 700, size: 40, color: 'yellow', ls: 0 };
    WEEK.forEach(([slug, label], i) => {
      const c = canvas(178, 56), ctx = c.getContext('2d');
      ctx.font = font(wk); ctx.fillStyle = col(wk.color); ctx.letterSpacing = wk.ls + 'px';
      if (ctx.measureText(label).width > 178) throw new Error('Chữ thứ quá dài: ' + label);
      ctx.fillText(label, 0, 44);
      out[`date/week_${i + 1}_${slug}.png`] = c.toDataURL('image/png');
    });
    for (const w of WEATHER) out[`weather/${w}.png`] = await icon(w, 'yellow', 64, 46);
    out['background.png'] = await background(true);
    out['background_transparent.png'] = await background(false);
    return out;
  }, { WEEK, WEATHER });

  for (const [rel, data] of Object.entries(files)) {
    const p = path.join(OUT, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(data.split(',')[1], 'base64'));
  }
  console.log('Đã xuất', Object.keys(files).length, 'ảnh vào', OUT);

  // Ảnh xem thử ghép từ đúng các asset vừa xuất.
  await page.goto('file://' + path.join(SRC, 'preview.html') + '?static=1');
  await page.waitForFunction(() => window.__ready === true);
  const el = await page.$('#face');
  await el.screenshot({ path: path.join(SRC, '..', 'preview.png') });
  await browser.close();
}

const ICONS_HELPERS = `
const svg = (body, extra = '') => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' + extra + '>' + body + '</svg>';
const S = (c, w = 1.7) => 'fill="none" stroke="' + c + '" stroke-width="' + w + '" stroke-linecap="round" stroke-linejoin="round"';
const CLOUD = 'M6.5 19H17.5A3.5 3.5 0 0 0 17.5 12A5 5 0 0 0 8 11.5A3.75 3.75 0 0 0 6.5 19Z';
const CLOUD_UP = 'M6.5 15H17.5A3.5 3.5 0 0 0 17.5 8A5 5 0 0 0 8 7.5A3.75 3.75 0 0 0 6.5 15Z';
const rays = (cx, cy, r1, r2, angles) => angles.map((a) => { const t = a * Math.PI / 180;
  return 'M' + (cx + r1 * Math.cos(t)).toFixed(2) + ' ' + (cy + r1 * Math.sin(t)).toFixed(2) + 'L' + (cx + r2 * Math.cos(t)).toFixed(2) + ' ' + (cy + r2 * Math.sin(t)).toFixed(2); }).join('');
`;

main().catch((e) => { console.error(e); process.exit(1); });
