// Bố cục mặt "Orange Block" cho Huawei Watch Fit 5 Pro (408 x 480).
// Vị trí, cỡ chữ đo trực tiếp từ giao diện mẫu; chỉ thêm kim giờ/phút có bóng đổ.
// Tọa độ x, y = góc trên-trái của ảnh. Dùng chung cho generate.cjs và preview.html.
(function (root) {
  // Ô số được căn sao cho mép trên chữ số (capTop) đúng như mẫu.
  const CAP = { Barlow: 0.70, Roboto: 0.711 };
  const set = (o) => ({ ...o, capH: Math.round(CAP[o.font] * o.size) });
  const at = (s, x, capTop) => ({ x, y: capTop - Math.round((s.cell[1] - s.capH) / 2) });

  const S = {
    big:   set({ prefix: 'time/big_',   cell: [64, 96], color: 'black',  font: 'Barlow', weight: 700, size: 114 }),
    sec:   set({ prefix: 'time/sec_',   cell: [30, 46], color: 'black',  font: 'Barlow', weight: 700, size: 50 }),
    date:  set({ prefix: 'date/date_',  cell: [17, 36], color: 'white',  font: 'Roboto', weight: 700, size: 32 }),
    lunar: set({ prefix: 'date/lunar_', cell: [15, 34], color: 'lunar',  font: 'Roboto', weight: 300, size: 29 }),
    temp:  set({ prefix: 'data/temp_',  cell: [17, 32], color: 'white',  font: 'Barlow', weight: 500, size: 31 }),
    hilo:  set({ prefix: 'data/hilo_',  cell: [10, 22], color: 'gray',   font: 'Barlow', weight: 500, size: 19 }),
    sun:   set({ prefix: 'data/sun_',   cell: [10, 22], color: 'white',  font: 'Barlow', weight: 500, size: 20 }),
    act:   set({ prefix: 'data/act_',   cell: [15, 32], color: 'act',    font: 'Roboto', weight: 300, size: 28 }),
    bat:   set({ prefix: 'data/bat_',   cell: [19, 36], color: 'white',  font: 'Roboto', weight: 300, size: 34 }),
  };
  const AS = {
    big:  set({ ...S.big,  prefix: 'aod/big_',  color: 'orange', stroke: 2.2 }),
    date: set({ ...S.date, prefix: 'aod/date_', color: '#A8A8A8' }),
  };

  // Ngày/tháng/năm: 21/11/2026 (mép trên số y 213)
  const dateRow = (s) => ({
    dayTens: { set: 'date', ...at(s, 30, 213) },  dayOnes: { set: 'date', ...at(s, 47, 213) },
    monthTens: { set: 'date', ...at(s, 76, 213) }, monthOnes: { set: 'date', ...at(s, 93, 213) },
    year1: { set: 'date', ...at(s, 122, 213) }, year2: { set: 'date', ...at(s, 139, 213) },
    year3: { set: 'date', ...at(s, 156, 213) }, year4: { set: 'date', ...at(s, 173, 213) },
  });
  const timeBlock = (s) => ({
    hourTens: { set: 'big', ...at(s, 266, 145) }, hourOnes: { set: 'big', ...at(s, 330, 145) },
    minTens:  { set: 'big', ...at(s, 266, 236) }, minOnes:  { set: 'big', ...at(s, 330, 236) },
  });
  const HANDS = {
    hour:   { img: 'hands/hour.png',   w: 44, h: 201, pivot: [22, 158] },
    minute: { img: 'hands/minute.png', w: 42, h: 265, pivot: [21, 213] },
    cap:    { img: 'hands/cap.png',    w: 18, h: 18 },
  };

  const LAYOUT = {
    screen: { w: 408, h: 480 },
    colors: {
      orange: '#FF7300', white: '#FFFFFF', gray: '#6E6E6E', lunar: '#8A8A8A', act: '#9A9A9A',
      dim: '#4E4E4E', line: '#3A3A3A', pill: '#1E1E1E', pillText: '#FFB27A', black: '#000000',
    },
    // Độ đậm kim giờ/phút (1 = đặc). Kim có bóng đổ đậm để nổi trên mọi nền.
    handAlpha: 0.9,

    panel:  { x: 259, y: 114, w: 142, h: 217, r: 12 },
    panel2: { x: 259, y: 337, w: 142, h: 61,  r: 10 },
    // Dấu "/" in sẵn trên nền (tâm x)
    dateSlashes: [70, 116],
    lunarSlashes: [65, 105],

    digitSets: S,
    widgets: {
      ...timeBlock(S.big),
      secTens: { set: 'sec', ...at(S.sec, 329, 360) },
      secOnes: { set: 'sec', ...at(S.sec, 359, 360) },

      // Thứ: chữ cam, mép trên chữ hoa y 155 (ảnh chừa 16px phía trên cho dấu)
      week: { img: 'date/week_', x: 23, y: 139, w: 232, h: 66, base: 54 },
      ...dateRow(S.date),
      // Âm lịch: 13/10/ B Ngọ (mép trên số y 251)
      lunarDayTens:   { set: 'lunar', ...at(S.lunar, 30, 251) },
      lunarDayOnes:   { set: 'lunar', ...at(S.lunar, 45, 251) },
      lunarMonthTens: { set: 'lunar', ...at(S.lunar, 70, 251) },
      lunarMonthOnes: { set: 'lunar', ...at(S.lunar, 85, 251) },
      canchi: { img: 'date/canchi_', x: 124, y: 241, w: 110, h: 46, base: 31 },

      temp:     { set: 'temp', ...at(S.temp, 61, 57), align: 'left', unit: 'data/temp_c.png', unitW: 33, minus: 'data/temp_minus.png' },
      tempHiLo: { set: 'hilo', ...at(S.hilo, 86, 87), align: 'left', sep: 'data/hilo_slash.png', minus: 'data/hilo_minus.png' },
      weather:  { img: 'weather/', x: 143, y: 55, w: 56, h: 48 },
      sunrise:  { set: 'sun', ...at(S.sun, 286, 68), align: 'left', sep: 'data/sun_colon.png' },

      steps:   { set: 'act', ...at(S.act, 66, 323), align: 'left' },
      heart:   { set: 'act', ...at(S.act, 66, 361), align: 'left' },
      battery: { set: 'bat', ...at(S.bat, 210, 446), align: 'center', unit: 'data/bat_pct.png', unitW: 24 },

      hands: { center: [204, 240], ...HANDS },
    },

    // AOD: ô giờ/phút + ngày/tháng/năm + kim giờ/phút, cùng vị trí.
    aod: {
      digitSets: AS,
      widgets: {
        ...timeBlock(AS.big),
        ...dateRow(AS.date),
        hands: {
          hour:   { ...HANDS.hour,   img: 'aod/hand_hour.png' },
          minute: { ...HANDS.minute, img: 'aod/hand_minute.png' },
          cap:    { ...HANDS.cap,    img: 'aod/hand_cap.png' },
        },
      },
    },
  };
  if (typeof module !== 'undefined') module.exports = LAYOUT; else root.LAYOUT = LAYOUT;
})(this);
