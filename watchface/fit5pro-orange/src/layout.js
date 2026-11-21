// Bố cục mặt "Orange Block" cho Huawei Watch Fit 5 Pro (408 x 480), dàn gần tràn viền.
// Tọa độ x, y = góc trên-trái của ảnh. Dùng chung cho generate.cjs và preview.html.
(function (root) {
  const LAYOUT = {
    screen: { w: 408, h: 480 },
    colors: { orange: '#FF7A1A', white: '#FFFFFF', gray: '#8E8E93', lunar: '#B4B4B8', line: '#3A3A3C', black: '#000000' },
    // Độ đậm của kim giờ/phút (1 = đặc). Kim có bóng đổ như mặt mẫu Hybrid.
    handAlpha: 0.72,

    // Khối cam: giờ/phút và giây
    panel:  { x: 214, y: 112, w: 186, h: 246, r: 22 },
    panel2: { x: 214, y: 364, w: 186, h: 66,  r: 20 },

    digitSets: {
      big:   { prefix: 'time/big_',   cell: [80, 112], color: 'black',  font: 'Barlow', weight: 700, size: 144 },
      sec:   { prefix: 'time/sec_',   cell: [32, 50],  color: 'black',  font: 'Barlow', weight: 700, size: 60 },
      date:  { prefix: 'date/date_',  cell: [19, 40],  color: 'white',  font: 'Barlow', weight: 700, size: 36 },
      lunar: { prefix: 'date/lunar_', cell: [13, 30],  color: 'lunar',  font: 'Barlow', weight: 500, size: 25 },
      num:   { prefix: 'data/num_',   cell: [18, 36],  color: 'white',  font: 'Barlow', weight: 500, size: 34 },
      small: { prefix: 'data/small_', cell: [13, 28],  color: 'white',  font: 'Barlow', weight: 500, size: 25 },
      gray:  { prefix: 'data/gray_',  cell: [11, 22],  color: 'gray',   font: 'Barlow', weight: 500, size: 20 },
    },

    widgets: {
      // Giờ / phút / giây (bên phải)
      hourTens:   { set: 'big', x: 227, y: 124 },
      hourOnes:   { set: 'big', x: 307, y: 124 },
      minTens:    { set: 'big', x: 227, y: 240 },
      minOnes:    { set: 'big', x: 307, y: 240 },
      secTens:    { set: 'sec', x: 306, y: 376 },
      secOnes:    { set: 'sec', x: 338, y: 376 },

      // Lịch (bên trái): THỨ 7 / 21/11/2026 / 13/10/ Bính Ngọ
      week:       { img: 'date/week_', x: 12, y: 118, w: 196, h: 66 },
      dayTens:    { set: 'date', x: 14,  y: 190 },
      dayOnes:    { set: 'date', x: 33,  y: 190 },
      monthTens:  { set: 'date', x: 62,  y: 190 },
      monthOnes:  { set: 'date', x: 81,  y: 190 },
      year1:      { set: 'date', x: 110, y: 190 },
      year2:      { set: 'date', x: 129, y: 190 },
      year3:      { set: 'date', x: 148, y: 190 },
      year4:      { set: 'date', x: 167, y: 190 },
      lunarDayTens:   { set: 'lunar', x: 14, y: 232 },
      lunarDayOnes:   { set: 'lunar', x: 27, y: 232 },
      lunarMonthTens: { set: 'lunar', x: 49, y: 232 },
      lunarMonthOnes: { set: 'lunar', x: 62, y: 232 },
      canchi:     { img: 'date/canchi_', x: 90, y: 230, w: 118, h: 34 },

      // Thời tiết & bình minh (hàng trên)
      temp:       { set: 'num',   x: 24,  y: 40, align: 'left', unit: 'data/num_c.png', unitW: 36, minus: 'data/num_minus.png' },
      tempHiLo:   { set: 'gray',  x: 38,  y: 78, align: 'left', sep: 'data/gray_slash.png', minus: 'data/gray_minus.png' },
      weather:    { img: 'weather/', x: 136, y: 40, w: 66, h: 56 },
      sunrise:    { set: 'small', x: 274, y: 42, align: 'left', sep: 'data/small_colon.png' },

      // Hoạt động & pin
      steps:      { set: 'num',   x: 52,  y: 312, align: 'left' },
      heart:      { set: 'num',   x: 52,  y: 372, align: 'left' },
      battery:    { set: 'small', x: 204, y: 450, align: 'center', unit: 'data/small_pct.png', unitW: 18 },

      // Kim (dáng kim mặt Hybrid, có bóng đổ). pivot = tâm xoay trong ảnh; center = tâm xoay trên màn hình.
      hands: {
        center: [210, 246],
        hour:   { img: 'hands/hour.png',   w: 44, h: 201, pivot: [22, 158] },
        minute: { img: 'hands/minute.png', w: 42, h: 265, pivot: [21, 213] },
        cap:    { img: 'hands/cap.png',    w: 18, h: 18 },
      },
    },

    // AOD: ô giờ/phút + ngày/tháng/năm + kim giờ/phút, cùng vị trí.
    aod: {
      digitSets: {
        big:  { prefix: 'aod/big_',  cell: [80, 112], color: 'orange', font: 'Barlow', weight: 700, size: 144, stroke: 2.5 },
        date: { prefix: 'aod/date_', cell: [19, 40],  color: '#BDBDBD', font: 'Barlow', weight: 700, size: 36 },
      },
      widgets: {
        hourTens:  { set: 'big',  x: 227, y: 124 },
        hourOnes:  { set: 'big',  x: 307, y: 124 },
        minTens:   { set: 'big',  x: 227, y: 240 },
        minOnes:   { set: 'big',  x: 307, y: 240 },
        dayTens:   { set: 'date', x: 14,  y: 190 },
        dayOnes:   { set: 'date', x: 33,  y: 190 },
        monthTens: { set: 'date', x: 62,  y: 190 },
        monthOnes: { set: 'date', x: 81,  y: 190 },
        year1:     { set: 'date', x: 110, y: 190 },
        year2:     { set: 'date', x: 129, y: 190 },
        year3:     { set: 'date', x: 148, y: 190 },
        year4:     { set: 'date', x: 167, y: 190 },
        hands: {
          hour:   { img: 'aod/hand_hour.png',   w: 44, h: 201, pivot: [22, 158] },
          minute: { img: 'aod/hand_minute.png', w: 42, h: 265, pivot: [21, 213] },
          cap:    { img: 'aod/hand_cap.png',    w: 18, h: 18 },
        },
      },
    },
  };
  if (typeof module !== 'undefined') module.exports = LAYOUT; else root.LAYOUT = LAYOUT;
})(this);
