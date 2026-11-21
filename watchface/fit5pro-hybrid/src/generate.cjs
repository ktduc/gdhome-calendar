// Xuất ảnh cho mặt "Hybrid Orange" (bám theo mặt gốc: font Roboto mảnh, bóng đổ, kim bạc).
// Chạy:  node watchface/fit5pro-hybrid/src/generate.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LAYOUT = require('./layout.js');
const ICONS = require('../../fit5pro/src/icons.js');
const { PAGE_LIB, ICONS_HELPERS, WEEK, WEATHER } = require('../../fit5pro/src/generate.cjs');

const SRC = __dirname;
const ROOT = path.join(SRC, '..');
const OUT = path.join(ROOT, 'assets');

const LATIN = 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD';
const VIET = 'U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB';
const WEIGHTS = [300, 400, 500];
function fontCss() {
  const css = [];
  for (const w of WEIGHTS) for (const [sub, range] of [['latin', LATIN], ['vietnamese', VIET]]) {
    const data = fs.readFileSync(path.join(SRC, 'fonts', `roboto-${sub}-${w}-normal.woff2`)).toString('base64');
    css.push(`@font-face{font-family:'Roboto';font-weight:${w};unicode-range:${range};src:url(data:font/woff2;base64,${data}) format('woff2');}`);
  }
  return css.join('\n');
}

const FACE_FN = `
// Icon thời tiết dạng đặc (trắng) như mặt gốc
const CF = 'M6.5 20H17.5A4 4 0 0 0 18 12A5.5 5.5 0 0 0 7.5 11.2A4.4 4.4 0 0 0 6.5 20Z';
const CFU = 'M6.5 16H17.5A4 4 0 0 0 18 8A5.5 5.5 0 0 0 7.5 7.2A4.4 4.4 0 0 0 6.5 16Z';
const SEP = 'stroke="#2A2A2A" stroke-width="1.4"';
Object.assign(ICONS, {
  w_sunny: (c) => svg('<circle cx="12" cy="12" r="5" fill="' + c + '"/><path d="' + rays(12, 12, 7.5, 10, [0, 45, 90, 135, 180, 225, 270, 315]) + '" ' + S(c, 1.8) + '/>'),
  w_partly_cloudy: (c) => svg('<circle cx="9" cy="8.5" r="4" fill="' + c + '"/><path d="' + rays(9, 8.5, 5.8, 7.8, [90, 135, 180, 225, 270, 315]) + '" ' + S(c, 1.6) + '/><path d="' + CF + '" fill="' + c + '" ' + SEP + '/>'),
  w_cloudy: (c) => svg('<path d="M9 8.5A4.5 4.5 0 0 1 17.6 7 3.4 3.4 0 0 1 20 13H18" fill="' + c + '" opacity=".55"/><path d="' + CF + '" fill="' + c + '" ' + SEP + '/>'),
  w_rain: (c) => svg('<path d="' + CFU + '" fill="' + c + '"/><path d="M8.5 18.5l-1 2.5M12.5 18.5l-1 2.5M16.5 18.5l-1 2.5" ' + S(c, 1.8) + '/>'),
  w_heavy_rain: (c) => svg('<path d="' + CFU + '" fill="' + c + '"/><path d="M7.5 18l-1.5 4M11 18l-1.5 4M14.5 18l-1.5 4M18 18l-1.5 4" ' + S(c, 1.8) + '/>'),
  w_thunder: (c) => svg('<path d="' + CFU + '" fill="' + c + '"/><path d="M12.8 16.5 10 20h3l-2 3.5" ' + S('#FF7F1F', 1.8) + '/>'),
  w_snow: (c) => svg('<path d="' + CFU + '" fill="' + c + '"/><path d="M8 19h.01M12 18.5h.01M16 19h.01M10 21.8h.01M14 21.8h.01" ' + S(c, 2.6) + '/>'),
  w_fog: (c) => svg('<path d="' + CFU + '" fill="' + c + '"/><path d="M4 19h16M6 22h12" ' + S(c, 1.8) + '/>'),
  w_wind: (c) => svg('<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h8" ' + S(c, 2) + '/>'),
  w_night: (c) => svg('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" fill="' + c + '"/>'),
  w_unknown: (c) => svg('<path d="' + CF + '" fill="' + c + '"/><path d="M10.6 14.2a1.5 1.5 0 1 1 2.1 1.4c-.5.2-.7.5-.7 1M12 18.4h.01" ' + S('#2A2A2A', 1.5) + '/>'),
  moon_f: (c) => svg('<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" fill="' + c + '"/>'),
});

const SH = LAYOUT.shadow;
function shadowOn(ctx) { ctx.shadowColor = SH.color; ctx.shadowBlur = SH.blur; ctx.shadowOffsetX = SH.dx; ctx.shadowOffsetY = SH.dy; }
function shadowOff(ctx) { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; }
// Ô số có bóng đổ (aod: không bóng)
function cellS(s, w, h, o, noShadow) {
  const c = canvas(w, h), ctx = c.getContext('2d');
  ctx.font = font(o); ctx.fillStyle = col(o.color);
  const base = Math.round((h + capOf(ctx)) / 2);
  if (!noShadow) shadowOn(ctx);
  ctx.textAlign = 'center'; ctx.fillText(s, w / 2, base);
  return c.toDataURL('image/png');
}
const LB = { font: 'Roboto', weight: 300, size: 17, color: 'label', ls: 0.6 };
function midY(ctx, top, h, o) { ctx.font = font(o); return top + Math.round((h - capOf(ctx)) / 2); }

async function background(aod) {
  const { w, h } = LAYOUT.screen;
  const c = canvas(w, h), ctx = c.getContext('2d');
  if (aod) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }
  else {
    const g = ctx.createRadialGradient(214, 230, 0, 214, 230, 360);
    g.addColorStop(0, '#3A3A3B'); g.addColorStop(0.55, '#202021'); g.addColorStop(1, '#080808');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const P = LAYOUT.panel, B = LAYOUT.box;
  // Ô giờ/phút: cam nhạt (AOD: chỉ viền cam tối)
  ctx.beginPath(); ctx.roundRect(P.x, P.y, P.w, P.h, P.r);
  if (aod) { ctx.strokeStyle = '#6A3A16'; ctx.lineWidth = 2; ctx.stroke(); }
  else {
    const pg = ctx.createLinearGradient(0, P.y, 0, P.y + P.h);
    pg.addColorStop(0, '#FFBE85'); pg.addColorStop(1, '#FFA45E');
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
    ctx.fillStyle = pg; ctx.fill(); ctx.restore();
  }
  // Ô lịch
  ctx.strokeStyle = aod ? '#3A3A3A' : col('box'); ctx.lineWidth = 1.5;
  ctx.strokeRect(B.x + 0.5, B.y + 0.5, B.w - 1, B.h - 1);

  if (!aod) shadowOn(ctx);
  const M = LAYOUT.digitSets.month;
  text(ctx, 'Th', 115, midY(ctx, 130, 30, M), { ...M, size: 25, color: aod ? '#BDBDBD' : 'white' });
  if (aod) return c.toDataURL('image/png');

  // Hàng trên (chừa giữa cho biểu tượng hệ thống)
  await drawIcon(ctx, 'stopwatch', 'label', 62, 21, 18, 18);
  text(ctx, 'TIMER', 84, 23, LB);
  text(ctx, 'POWER', 236, 23, LB);
  shadowOff(ctx); ctx.fillStyle = col('line'); ctx.fillRect(16, 52, 376, 1.2); shadowOn(ctx);

  // Âm lịch trong ô lịch
  await drawIcon(ctx, 'moon_f', 'orange', 113, 170, 14, 14);
  const LU = LAYOUT.digitSets.lunar;
  text(ctx, '/', 157.5, midY(ctx, 166, 22, LU), { ...LU, align: 'center' });

  // Hoạt động
  shadowOff(ctx); ctx.fillStyle = col('line'); ctx.fillRect(14, 254, 186, 1.2); shadowOn(ctx);
  text(ctx, 'ACTIVITY', 200, 263, { ...LB, size: 15, align: 'right' });
  await drawIcon(ctx, 'shoe', 'orange', 167, 286, 27, 26);
  await drawIcon(ctx, 'heart', 'white', 170, 339, 23, 23);
  text(ctx, 'km', 76, midY(ctx, 388, 24, { ...LB, size: 17 }), { ...LB, size: 17 });
  await drawIcon(ctx, 'pin', 'orange', 169, 386, 23, 27);

  // Phím tắt
  await drawIcon(ctx, 'message_dot', 'white', 222, 384, 40, 38);
  text(ctx, 'MESSAGE', 242, 430, { ...LB, size: 15, align: 'center' });
  await drawIcon(ctx, 'alarm', '#D4D4D4', 318, 385, 38, 36);
  text(ctx, 'ALARM', 337, 430, { ...LB, size: 15, align: 'center' });
  return c.toDataURL('image/png');
}

// ---- Kim: chép đúng dáng kim của mặt gốc (thanh bạc bản đều, mũi nhọn ngắn,
// đuôi vát qua tâm, bóng đổ mềm), chỉ làm nhạt bằng độ trong suốt.
function barHand(spec, o) {
  const [px, py] = spec.pivot, hw = o.width / 2;
  const lay = canvas(spec.w, spec.h), lc = lay.getContext('2d');
  if (o.shadow) { lc.shadowColor = 'rgba(0,0,0,0.6)'; lc.shadowBlur = 8; }
  lc.beginPath();
  lc.moveTo(px, py - o.len);                       // mũi
  lc.lineTo(px + hw, py - o.len + o.taper);
  lc.lineTo(px + hw, py + o.tail - o.cut);         // đuôi vát
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
function secondHand(spec, o) {
  const [px, py] = spec.pivot, c = canvas(spec.w, spec.h), ctx = c.getContext('2d');
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4;
  ctx.fillStyle = col('orange');
  ctx.fillRect(px - o.width / 2, py - o.len, o.width, o.len + o.tail);
  return c.toDataURL('image/png');
}
function capImg(color, shadow) {
  const c = canvas(16, 16), ctx = c.getContext('2d');
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 3; }
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(8, 8, 5.5, 0, Math.PI * 2); ctx.fill();
  return c.toDataURL('image/png');
}
// Kích thước đo từ ảnh mẫu (đơn vị px màn hình 408x480)
const HAND_HOUR = { len: 142, width: 12, taper: 12, tail: 27, cut: 9 };
const HAND_MIN  = { len: 197, width: 10, taper: 11, tail: 36, cut: 8 };
const HAND_SEC  = { len: 197, width: 3, tail: 56 };
function hands() {
  const H = LAYOUT.widgets.hands, A = LAYOUT.aod.widgets.hands, out = {};
  const live = { light: '#E2E2E2', mid: '#CFCFCF', dark: '#B4B4B4', alpha: LAYOUT.handAlpha, shadow: true };
  const dim = { light: '#8C8C8C', mid: '#7E7E7E', dark: '#6A6A6A', alpha: 0.85, shadow: false };
  out['hands/hour.png'] = barHand(H.hour, { ...HAND_HOUR, ...live });
  out['hands/minute.png'] = barHand(H.minute, { ...HAND_MIN, ...live });
  out['hands/second.png'] = secondHand(H.second, HAND_SEC);
  out['hands/cap.png'] = capImg(col('orange'), true);
  out['aod/hand_hour.png'] = barHand(A.hour, { ...HAND_HOUR, ...dim });
  out['aod/hand_minute.png'] = barHand(A.minute, { ...HAND_MIN, ...dim });
  out['aod/hand_cap.png'] = capImg('#B5561A', false);
  return out;
}

function weekImage(label, color, noShadow) {
  const c = canvas(186, 44), ctx = c.getContext('2d');
  ctx.font = font({ font: 'Roboto', weight: 300, size: 33 }); ctx.fillStyle = col(color); ctx.textAlign = 'right';
  if (ctx.measureText(label).width > 182) throw new Error('Chữ thứ quá dài: ' + label);
  if (!noShadow) shadowOn(ctx);
  ctx.fillText(label, 184, 35);
  return c.toDataURL('image/png');
}
`;

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(`<html><head><style>${fontCss()}</style></head><body></body></html>`);
  await page.evaluate(async (weights) => {
    for (const w of weights) {
      const f = `${w} 20px Roboto`;
      await document.fonts.load(f, 'A0ỨẬ');
      if (!document.fonts.check(f, 'A0ỨẬ')) throw new Error('Font không tải được: ' + f);
    }
  }, WEIGHTS);
  await page.addScriptTag({ content: `window.LAYOUT=${JSON.stringify(LAYOUT)};
    window.ICONS={${Object.entries(ICONS).map(([k, f]) => `${JSON.stringify(k)}:${f.toString()}`).join(',')}};
    ${ICONS_HELPERS}${PAGE_LIB}${FACE_FN}` });

  const files = await page.evaluate(async ({ WEEK, WEATHER }) => {
    const out = {};
    for (const s of Object.values(LAYOUT.digitSets)) for (let d = 0; d <= 9; d++) out[s.prefix + d + '.png'] = cellS(String(d), s.cell[0], s.cell[1], s, s.noShadow);
    for (const s of Object.values(LAYOUT.aod.digitSets)) for (let d = 0; d <= 9; d++) out[s.prefix + d + '.png'] = cellS(String(d), s.cell[0], s.cell[1], s, true);

    const D = LAYOUT.digitSets;
    out['data/bat_pct.png'] = cellS('%', 22, D.bat.cell[1], D.bat);
    out['data/temp_c.png'] = cellS('°C', 30, D.temp.cell[1], D.temp);
    out['data/temp_minus.png'] = cellS('-', 11, D.temp.cell[1], D.temp);
    out['data/num_empty.png'] = cellS('--', 26, D.num.cell[1], D.num);
    out['data/numo_empty.png'] = cellS('--', 26, D.numo.cell[1], D.numo);
    out['data/hilo_slash.png'] = cellS('/', 7, D.hilo.cell[1], D.hilo);
    out['data/hilo_minus.png'] = cellS('-', 7, D.hilo.cell[1], D.hilo);
    out['data/small_dot.png'] = cellS('.', 6, D.small.cell[1], D.small);

    WEEK.forEach(([slug, label], i) => {
      out[`date/week_${i + 1}_${slug}.png`] = weekImage(label, 'week');
      out[`aod/week_${i + 1}_${slug}.png`] = weekImage(label, '#8A8A8A', true);
    });
    for (const w of WEATHER) {
      const c = canvas(40, 38), ctx = c.getContext('2d');
      shadowOn(ctx);
      await drawIcon(ctx, 'w_' + w, 'white', 2, 2, 36, 34);
      out[`weather/${w}.png`] = c.toDataURL('image/png');
    }
    Object.assign(out, hands());
    out['background.png'] = await background(false);
    out['aod/background_aod.png'] = await background(true);
    return out;
  }, { WEEK, WEATHER });

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
