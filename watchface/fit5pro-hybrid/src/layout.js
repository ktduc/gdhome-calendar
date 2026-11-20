// Bố cục mặt đồng hồ "Hybrid Orange" cho Huawei Watch Fit 5 Pro (408 x 480).
// Tọa độ x, y = góc trên-trái của ảnh. Dùng chung cho generate.cjs và preview.html.
(function (root) {
  const LAYOUT = {
    screen: { w: 408, h: 480 },
    colors: {
      orange: '#FF7A1A', white: '#FFFFFF', gray: '#8E8E93', dim: '#9C9CA1',
      line: '#3A3A3C', box: '#5A5A5E', black: '#000000',
    },

    digitSets: {
      hour:   { prefix: 'time/hour_',   cell: [66, 88], color: 'white',  font: 'Barlow', weight: 700, size: 112 },
      minute: { prefix: 'time/minute_', cell: [66, 96], color: 'dim',    font: 'Barlow', weight: 700, size: 124 },
      sec:    { prefix: 'time/sec_',    cell: [18, 32], color: 'orange', font: 'Barlow', weight: 700, size: 32 },
      day:    { prefix: 'date/day_',    cell: [32, 50], color: 'orange', font: 'Barlow', weight: 700, size: 56 },
      month:  { prefix: 'date/month_',  cell: [18, 30], color: 'white',  font: 'Barlow', weight: 700, size: 32 },
      lunar:  { prefix: 'date/lunar_',  cell: [12, 22], color: 'orange', font: 'Barlow', weight: 600, size: 20 },
      num:    { prefix: 'data/num_',    cell: [17, 30], color: 'white',  font: 'Barlow', weight: 600, size: 30 },
      numo:   { prefix: 'data/numo_',   cell: [17, 30], color: 'orange', font: 'Barlow', weight: 600, size: 30 },
      small:  { prefix: 'data/small_',  cell: [13, 24], color: 'white',  font: 'Barlow', weight: 600, size: 23 },
    },

    widgets: {
      // Giờ số (bên phải)
      hourTens:   { set: 'hour',   x: 212, y: 116 },
      hourOnes:   { set: 'hour',   x: 278, y: 116 },
      minTens:    { set: 'minute', x: 212, y: 232 },
      minOnes:    { set: 'minute', x: 278, y: 232 },
      secTens:    { set: 'sec',    x: 352, y: 290 },
      secOnes:    { set: 'sec',    x: 370, y: 290 },

      // Lịch (ô ngày + thứ + âm lịch)
      dayTens:    { set: 'day',   x: 100, y: 102 },
      dayOnes:    { set: 'day',   x: 132, y: 102 },
      monthTens:  { set: 'month', x: 128, y: 158 },
      monthOnes:  { set: 'month', x: 146, y: 158 },
      week:       { img: 'date/week_', x: 28, y: 204, w: 168, h: 48 },
      // Âm lịch: dưới nhiệt độ, có biểu tượng trăng phía trước (in sẵn trên nền)
      lunarDayTens:   { set: 'lunar', x: 36, y: 184 },
      lunarDayOnes:   { set: 'lunar', x: 48, y: 184 },
      lunarMonthTens: { set: 'lunar', x: 67, y: 184 },
      lunarMonthOnes: { set: 'lunar', x: 79, y: 184 },

      // Dữ liệu
      battery:    { set: 'num',   x: 206, y: 58,  align: 'left',  unit: 'data/num_pct.png', unitW: 20 },
      weather:    { img: 'weather/', x: 22, y: 100, w: 52, h: 40 },
      temp:       { set: 'num',   x: 16,  y: 146, align: 'left', unit: 'data/num_c.png', unitW: 30, minus: 'data/num_minus.png' },
      steps:      { set: 'num',   x: 150, y: 296, align: 'right' },
      heart:      { set: 'numo',  x: 150, y: 346, align: 'right' },
      distance:   { set: 'small', x: 92,  y: 402, align: 'left', dot: 'data/small_dot.png' },

      // Kim (ảnh dựng đứng, chỉ 12 giờ). pivot = tâm xoay trong ảnh; center = tâm xoay trên màn hình.
      hands: {
        center: [200, 236],
        hour:   { img: 'hands/hour.png',   w: 22, h: 150, pivot: [11, 128] },
        minute: { img: 'hands/minute.png', w: 18, h: 222, pivot: [9, 196] },
        second: { img: 'hands/second.png', w: 12, h: 250, pivot: [6, 206] },
        cap:    { img: 'hands/cap.png',    w: 20, h: 20 },
      },
    },

    // AOD: cùng vị trí màn hình chính, nét viền, không giây, không kim, không dữ liệu.
    aod: {
      digitSets: {
        hour:   { prefix: 'aod/hour_',   cell: [66, 88], color: 'white',  font: 'Barlow', weight: 700, size: 112, stroke: 2.5 },
        minute: { prefix: 'aod/minute_', cell: [66, 96], color: 'dim',    font: 'Barlow', weight: 700, size: 124, stroke: 2.5 },
        day:    { prefix: 'aod/day_',    cell: [32, 50], color: 'orange', font: 'Barlow', weight: 700, size: 56,  stroke: 1.8 },
        month:  { prefix: 'aod/month_',  cell: [18, 30], color: 'white',  font: 'Barlow', weight: 700, size: 32,  stroke: 1.4 },
      },
      widgets: {
        hourTens:  { set: 'hour',   x: 212, y: 116 },
        hourOnes:  { set: 'hour',   x: 278, y: 116 },
        minTens:   { set: 'minute', x: 212, y: 232 },
        minOnes:   { set: 'minute', x: 278, y: 232 },
        dayTens:   { set: 'day',    x: 100, y: 102 },
        dayOnes:   { set: 'day',    x: 132, y: 102 },
        monthTens: { set: 'month',  x: 128, y: 158 },
        monthOnes: { set: 'month',  x: 146, y: 158 },
        week:      { img: 'aod/week_', x: 28, y: 204, w: 168, h: 48 },
      },
    },
  };
  if (typeof module !== 'undefined') module.exports = LAYOUT; else root.LAYOUT = LAYOUT;
})(this);
