// Bố cục mặt đồng hồ "Yellow Block" cho Huawei Watch Fit 5 Pro.
// Tọa độ tính bằng pixel trên khung 408 x 480 (x, y = góc trên-trái của ảnh).
// Dùng chung cho generate.cjs (xuất ảnh) và preview.html (xem thử).
(function (root) {
  const LAYOUT = {
    screen: { w: 408, h: 480 },
    colors: { yellow: '#FFC21A', white: '#FFFFFF', gray: '#8E8E93', line: '#3A3A3C', black: '#000000' },

    // Các nhóm số dùng ảnh rời 0..9. cell = kích thước mỗi ảnh số.
    digitSets: {
      big:   { prefix: 'time/big_',   cell: [72, 92], color: 'black',  font: 'Barlow', weight: 700, size: 118 },
      sec:   { prefix: 'time/sec_',   cell: [34, 50], color: 'black',  font: 'Barlow', weight: 700, size: 62 },
      day:   { prefix: 'date/day_',   cell: [27, 42], color: 'white',  font: 'Barlow', weight: 700, size: 46 },
      lunar: { prefix: 'date/lunar_', cell: [13, 24], color: 'yellow', font: 'Barlow', weight: 600, size: 21 },
      num:   { prefix: 'data/num_',   cell: [18, 34], color: 'white',  font: 'Barlow', weight: 500, size: 32 },
      small: { prefix: 'data/small_', cell: [12, 24], color: 'white',  font: 'Barlow', weight: 500, size: 21 },
      gray:  { prefix: 'data/gray_',  cell: [10, 20], color: 'gray',   font: 'Barlow', weight: 500, size: 18 },
    },

    // Phần tử động (đặt trong Theme Studio). align: left | center | right
    widgets: {
      // Khối giờ vàng – bên phải
      hourTens:   { set: 'big', x: 226, y: 140 },
      hourOnes:   { set: 'big', x: 298, y: 140 },
      minTens:    { set: 'big', x: 226, y: 228 },
      minOnes:    { set: 'big', x: 298, y: 228 },
      secTens:    { set: 'sec', x: 300, y: 352 },
      secOnes:    { set: 'sec', x: 334, y: 352 },

      // Lịch – bên trái
      week:       { img: 'date/week_', x: 24, y: 146, w: 178, h: 56 },
      dayTens:    { set: 'day', x: 26,  y: 200 },
      dayOnes:    { set: 'day', x: 53,  y: 200 },
      monthTens:  { set: 'day', x: 98,  y: 200 },
      monthOnes:  { set: 'day', x: 125, y: 200 },
      lunarDayTens:   { set: 'lunar', x: 48, y: 248 },
      lunarDayOnes:   { set: 'lunar', x: 61, y: 248 },
      lunarMonthTens: { set: 'lunar', x: 82, y: 248 },
      lunarMonthOnes: { set: 'lunar', x: 95, y: 248 },

      temp:       { set: 'num',   x: 30,  y: 60,  align: 'left',  digits: 3, unit: 'data/unit_c.png', unitW: 34, minus: 'data/num_minus.png' },
      tempHiLo:   { set: 'gray',  x: 40,  y: 94,  align: 'left',  sep: 'data/gray_slash.png' },
      weather:    { img: 'weather/', x: 140, y: 60, w: 64, h: 46 },
      sunrise:    { set: 'small', x: 280, y: 60,  align: 'left',  sep: 'data/small_colon.png' },

      steps:      { set: 'num', x: 58, y: 318, align: 'left', digits: 5 },
      heart:      { set: 'num', x: 58, y: 362, align: 'left', digits: 3 },
      battery:    { set: 'num', x: 204, y: 436, align: 'center', digits: 3, unit: 'data/unit_pct.png', unitW: 22 },
    },

    // Màn hình chờ AOD: chỉ thứ, ngày/tháng, giờ:phút (không giây).
    aod: {
      colors: { time: '#FFC21A', text: '#B0B0B0' },
      digitSets: {
        time: { prefix: 'aod/time_', cell: [72, 96], color: '#FFC21A', font: 'Barlow', weight: 700, size: 122, stroke: 3 },
        date: { prefix: 'aod/date_', cell: [27, 42], color: '#B0B0B0', font: 'Barlow', weight: 600, size: 44 },
      },
      widgets: {
        week:      { img: 'aod/week_', x: 54, y: 120, w: 300, h: 56 },
        dayTens:   { set: 'date', x: 141, y: 184 },
        dayOnes:   { set: 'date', x: 168, y: 184 },
        monthTens: { set: 'date', x: 213, y: 184 },
        monthOnes: { set: 'date', x: 240, y: 184 },
        hourTens:  { set: 'time', x: 46,  y: 262 },
        hourOnes:  { set: 'time', x: 118, y: 262 },
        minTens:   { set: 'time', x: 218, y: 262 },
        minOnes:   { set: 'time', x: 290, y: 262 },
      },
    },
  };
  if (typeof module !== 'undefined') module.exports = LAYOUT; else root.LAYOUT = LAYOUT;
})(this);
