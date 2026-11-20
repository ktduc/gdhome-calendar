// Bố cục mặt đồng hồ "Yellow Block" cho Huawei Watch Fit 5 Pro.
// Tọa độ tính bằng pixel trên khung 408 x 480 (x, y = góc trên-trái của ảnh).
// Dùng chung cho generate.cjs (xuất ảnh) và preview.html (xem thử).
(function (root) {
  const LAYOUT = {
    screen: { w: 408, h: 480 },
    colors: { yellow: '#FFC21A', white: '#FFFFFF', gray: '#8E8E93', line: '#3A3A3C', black: '#000000' },

    // Các nhóm số dùng ảnh rời 0..9. cell = kích thước mỗi ảnh số.
    digitSets: {
      big:   { prefix: 'time/big_',   cell: [72, 92], color: 'black', font: 'Barlow', weight: 700, size: 118 },
      sec:   { prefix: 'time/sec_',   cell: [34, 50], color: 'black', font: 'Barlow', weight: 700, size: 62 },
      day:   { prefix: 'date/day_',   cell: [27, 42], color: 'white', font: 'Barlow', weight: 700, size: 46 },
      num:   { prefix: 'data/num_',   cell: [18, 34], color: 'white', font: 'Barlow', weight: 500, size: 32 },
      small: { prefix: 'data/small_', cell: [12, 24], color: 'white', font: 'Barlow', weight: 500, size: 21 },
      gray:  { prefix: 'data/gray_',  cell: [10, 20], color: 'gray',  font: 'Barlow', weight: 500, size: 18 },
    },

    // Phần tử động (đặt trong Theme Studio). align: left | center | right
    widgets: {
      hourTens:   { set: 'big', x: 38,  y: 140 },
      hourOnes:   { set: 'big', x: 110, y: 140 },
      minTens:    { set: 'big', x: 38,  y: 228 },
      minOnes:    { set: 'big', x: 110, y: 228 },
      secTens:    { set: 'sec', x: 112, y: 352 },
      secOnes:    { set: 'sec', x: 146, y: 352 },

      week:       { img: 'date/week_', x: 204, y: 146, w: 180, h: 66 },
      dayTens:    { set: 'day', x: 206, y: 214 },
      dayOnes:    { set: 'day', x: 233, y: 214 },
      month:      { img: 'date/month_', x: 268, y: 214, w: 116, h: 42 },

      temp:       { set: 'num',   x: 30,  y: 60,  align: 'left',  digits: 3, unit: 'data/unit_c.png', unitW: 34, minus: 'data/num_minus.png' },
      tempHiLo:   { set: 'gray',  x: 40,  y: 94,  align: 'left',  sep: 'data/gray_slash.png' },
      weather:    { img: 'weather/', x: 140, y: 60, w: 64, h: 46 },
      sunrise:    { set: 'small', x: 280, y: 60,  align: 'left',  sep: 'data/small_colon.png' },

      steps:      { set: 'num', x: 244, y: 318, align: 'left', digits: 5 },
      heart:      { set: 'num', x: 244, y: 362, align: 'left', digits: 3 },
      battery:    { set: 'num', x: 204, y: 436, align: 'center', digits: 3, unit: 'data/unit_pct.png', unitW: 22 },
    },
  };
  if (typeof module !== 'undefined') module.exports = LAYOUT; else root.LAYOUT = LAYOUT;
})(this);
