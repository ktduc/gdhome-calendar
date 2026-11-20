// Xuất toàn bộ ảnh PNG cho mặt đồng hồ bằng Chromium (Playwright) + canvas.
// Chạy:  node watchface/fit5pro/src/generate.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LAYOUT = require('./layout.js');
const ICONS = require('./icons.js');

const SRC = __dirname;
const OUT = path.join(SRC, '..', 'assets');

const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEATHER = ['sunny', 'partly_cloudy', 'cloudy', 'rain', 'heavy_rain', 'thunder', 'snow', 'fog', 'wind', 'night', 'unknown'];

function fontCss() {
  const f = (fam, w, file) => `@font-face{font-family:'${fam}';font-weight:${w};src:url(data:font/woff2;base64,${fs.readFileSync(path.join(SRC, 'fonts', file)).toString('base64')}) format('woff2');}`;
  return [
    f('Barlow', 500, 'barlow-latin-500-normal.woff2'),
    f('Barlow', 600, 'barlow-latin-600-normal.woff2'),
    f('Barlow', 700, 'barlow-latin-700-normal.woff2'),
    f('BarlowSC', 500, 'barlow-semi-condensed-latin-500-normal.woff2'),
    f('BarlowSC', 600, 'barlow-semi-condensed-latin-600-normal.woff2'),
  ].join('\n');
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

  // Khối giờ vàng
  rr(ctx, 24, 122, 172, 204, 18, 'yellow');
  rr(ctx, 80, 113, 60, 22, 9, 'yellow');
  rr(ctx, 83, 116, 54, 16, 7, 'black');
  text(ctx, '24H', 110, 119, { font: 'Barlow', weight: 700, size: 14, color: 'yellow', align: 'center', ls: 0.5 });

  // Khối giây
  rr(ctx, 24, 332, 172, 72, 18, 'yellow');
  await drawIcon(ctx, 'bell', 'black', 42, 352, 32, 32);
  ctx.fillStyle = '#000'; ctx.fillRect(95, 342, 2.5, 52);
  text(ctx, 'SECOND', 146, 338, { font: 'BarlowSC', weight: 600, size: 14, color: 'black', align: 'center', ls: 0.5 });

  // Cột phải
  text(ctx, 'CALENDAR', 206, 128, L);
  hline(ctx, 206, 384, 266);
  text(ctx, 'ACTIVITY', 206, 280, L);
  await drawIcon(ctx, 'shoe', '#3DDC84', 208, 318, 30, 30);
  text(ctx, 'STEPS', 334, 326, { ...L, size: 16 });
  await drawIcon(ctx, 'heart', '#FF3B30', 209, 363, 28, 28);
  text(ctx, 'BPM', 334, 370, { ...L, size: 16 });

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
  await page.setContent(`<html><head><style>${fontCss()}</style></head><body>
    <span style="font-family:Barlow;font-weight:500">0</span><span style="font-family:Barlow;font-weight:600">0</span>
    <span style="font-family:Barlow;font-weight:700">0</span><span style="font-family:BarlowSC;font-weight:500">0</span>
    <span style="font-family:BarlowSC;font-weight:600">0</span></body></html>`);
  await page.evaluate(async () => { await document.fonts.ready;
    for (const f of ['500 20px Barlow', '600 20px Barlow', '700 20px Barlow', '500 20px BarlowSC', '600 20px BarlowSC']) {
      await document.fonts.load(f); if (!document.fonts.check(f)) throw new Error('Font không tải được: ' + f); } });
  await page.addScriptTag({ content: `window.LAYOUT=${JSON.stringify(LAYOUT)};
    window.ICONS={${Object.entries(ICONS).map(([k, f]) => `${JSON.stringify(k)}:${f.toString()}`).join(',')}};
    ${ICONS_HELPERS}${PAGE_LIB}${BG_FN}` });

  const files = await page.evaluate(async ({ WEEK, MONTHS, WEATHER }) => {
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

    const wk = { font: 'Barlow', weight: 600, size: 84, color: 'yellow', ls: 1 };
    WEEK.forEach((s, i) => { out[`date/week_${i + 1}_${s}.png`] = cell(s, 180, 66, wk, 'left'); });
    const mo = { font: 'Barlow', weight: 700, size: 46, color: 'white', ls: 0.5 };
    MONTHS.forEach((s, i) => { out[`date/month_${String(i + 1).padStart(2, '0')}_${s}.png`] = cell(s, 116, 42, mo, 'left'); });

    for (const w of WEATHER) out[`weather/${w}.png`] = await icon(w, 'yellow', 64, 46);
    out['background.png'] = await background(true);
    out['background_transparent.png'] = await background(false);
    return out;
  }, { WEEK, MONTHS, WEATHER });

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
