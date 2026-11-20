// Xuất ảnh cho mặt "Hybrid Orange". Dùng chung font, icon và hàm vẽ với mặt Yellow Block.
// Chạy:  node watchface/fit5pro-hybrid/src/generate.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const LAYOUT = require('./layout.js');
const ICONS = require('../../fit5pro/src/icons.js');
const { fontCss, FONT_FACES, PAGE_LIB, ICONS_HELPERS, WEEK, WEATHER } = require('../../fit5pro/src/generate.cjs');

const SRC = __dirname;
const ROOT = path.join(SRC, '..');
const OUT = path.join(ROOT, 'assets');

// Mã vẽ riêng của mặt này (chạy trong trang).
const FACE_FN = `
const L = { font: 'BarlowSC', weight: 500, size: 15, color: 'gray', ls: 1 };
function strokeRR(ctx, x, y, w, h, r, color, lw) {
  ctx.beginPath(); ctx.roundRect(x, y, w, h, r); ctx.strokeStyle = col(color); ctx.lineWidth = lw; ctx.stroke();
}
function midY(ctx, top, h, o) { ctx.font = font(o); return top + Math.round((h - capOf(ctx)) / 2); }

async function background(aod) {
  const { w, h } = LAYOUT.screen;
  const c = canvas(w, h), ctx = c.getContext('2d');
  if (aod) { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h); }
  else {
    const g = ctx.createRadialGradient(204, 210, 0, 204, 210, 340);
    g.addColorStop(0, '#2C2C2F'); g.addColorStop(0.6, '#161618'); g.addColorStop(1, '#050505');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
  }
  const D = LAYOUT.digitSets;

  // Ô ngày + chữ "TH" trước số tháng
  strokeRR(ctx, 96, 96, 80, 100, 3, aod ? '#3A3A3C' : 'box', 1.5);
  text(ctx, 'TH', 102, midY(ctx, 158, 30, { ...L, size: 16 }), { ...L, size: 16, ls: 0.5 });
  text(ctx, '24H', 352, 186, { ...L, size: 16 });
  if (aod) return c.toDataURL('image/png');

  // Hàng trên
  await drawIcon(ctx, 'stopwatch', 'gray', 92, 38, 18, 18);
  text(ctx, 'TIMER', 113, 42, L);
  text(ctx, 'POWER', 206, 42, L);
  hline(ctx, 206, 282, 92);
  text(ctx, 'CALENDAR', 96, 74, L);

  // Âm lịch: biểu tượng trăng + dấu "/"
  await drawIcon(ctx, 'night', 'orange', 16, 187, 17, 17);
  text(ctx, '/', 63.5, midY(ctx, 184, 22, D.lunar), { ...D.lunar, align: 'center' });

  // Hoạt động
  hline(ctx, 12, 196, 262);
  text(ctx, 'ACTIVITY', 112, 274, { ...L, align: 'center' });
  await drawIcon(ctx, 'shoe', 'orange', 157, 298, 26, 26);
  await drawIcon(ctx, 'heart', 'white', 159, 349, 22, 22);
  text(ctx, 'km', 60, midY(ctx, 402, 24, { ...L, size: 16 }), { ...L, size: 16 });
  await drawIcon(ctx, 'pin', 'orange', 158, 401, 24, 24);

  // Phím tắt dưới
  await drawIcon(ctx, 'message_dot', 'white', 222, 386, 36, 36);
  text(ctx, 'MESSAGE', 240, 428, { ...L, size: 13, align: 'center' });
  await drawIcon(ctx, 'alarm', 'white', 313, 386, 34, 34);
  text(ctx, 'ALARM', 330, 428, { ...L, size: 13, align: 'center' });
  return c.toDataURL('image/png');
}

// Kim: ảnh dựng đứng chỉ 12 giờ, hơi trong suốt để vẫn đọc được thông tin bên dưới.
function hand(spec, pts, fill, alpha, groove) {
  const c = canvas(spec.w, spec.h), ctx = c.getContext('2d');
  ctx.globalAlpha = alpha;
  ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
  if (groove) {
    ctx.globalCompositeOperation = 'destination-out'; ctx.globalAlpha = 0.45;
    ctx.fillRect(spec.w / 2 - 1, groove[0], 2, groove[1] - groove[0]);
  }
  return c.toDataURL('image/png');
}
function hands() {
  const H = LAYOUT.widgets.hands, out = {};
  const silver = '#E2E2E6';
  out['hands/hour.png'] = hand(H.hour, [[11, 2], [20.5, 42], [15, 128], [14, 150], [8, 150], [7, 128], [1.5, 42]], silver, 0.55, [22, 112]);
  out['hands/minute.png'] = hand(H.minute, [[9, 2], [16.5, 38], [12, 196], [11.5, 222], [6.5, 222], [6, 196], [1.5, 38]], silver, 0.55, [20, 180]);
  {
    const s = H.second, c = canvas(s.w, s.h), ctx = c.getContext('2d');
    ctx.globalAlpha = 0.9; ctx.fillStyle = col('orange');
    ctx.fillRect(s.pivot[0] - 1.25, 4, 2.5, s.h - 8);
    ctx.beginPath(); ctx.arc(s.pivot[0], s.h - 14, 5, 0, Math.PI * 2); ctx.fill();
    out['hands/second.png'] = c.toDataURL('image/png');
  }
  {
    const s = H.cap, c = canvas(s.w, s.h), ctx = c.getContext('2d');
    ctx.fillStyle = '#D0D0D4'; ctx.beginPath(); ctx.arc(10, 10, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col('orange'); ctx.beginPath(); ctx.arc(10, 10, 3.5, 0, Math.PI * 2); ctx.fill();
    out['hands/cap.png'] = c.toDataURL('image/png');
  }
  return out;
}

function weekImage(label, o, stroke) {
  const c = canvas(168, 48), ctx = c.getContext('2d');
  ctx.font = font(o); ctx.letterSpacing = (o.ls || 0) + 'px'; ctx.textAlign = 'center';
  if (ctx.measureText(label).width > 168) throw new Error('Chữ thứ quá dài: ' + label);
  if (stroke) { ctx.strokeStyle = col(o.color); ctx.lineWidth = stroke; ctx.lineJoin = 'round'; ctx.strokeText(label, 84, 38); }
  else { ctx.fillStyle = col(o.color); ctx.fillText(label, 84, 38); }
  return c.toDataURL('image/png');
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

  const files = await page.evaluate(async ({ WEEK, WEATHER }) => {
    const out = {};
    const digitSets = (sets) => {
      for (const s of Object.values(sets)) for (let d = 0; d <= 9; d++) out[s.prefix + d + '.png'] = cell(String(d), s.cell[0], s.cell[1], s);
    };
    digitSets(LAYOUT.digitSets);
    digitSets(LAYOUT.aod.digitSets);

    const D = LAYOUT.digitSets;
    out['data/num_pct.png'] = cell('%', 20, D.num.cell[1], D.num);
    out['data/num_c.png'] = cell('°C', 30, D.num.cell[1], D.num);
    out['data/num_minus.png'] = cell('-', 11, D.num.cell[1], D.num);
    out['data/num_empty.png'] = cell('--', 28, D.num.cell[1], D.num);
    out['data/numo_empty.png'] = cell('--', 28, D.numo.cell[1], D.numo);
    out['data/small_dot.png'] = cell('.', 6, D.small.cell[1], D.small);

    const wk = { font: 'BarlowSC', weight: 600, size: 34, color: '#E5E5EA', ls: 1 };
    WEEK.forEach(([slug, label], i) => {
      out[`date/week_${i + 1}_${slug}.png`] = weekImage(label, wk);
      out[`aod/week_${i + 1}_${slug}.png`] = weekImage(label, wk, 1.3);
    });
    for (const w of WEATHER) out[`weather/${w}.png`] = await icon(w, 'white', 52, 40);
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
