// Bố cục mặt "Hybrid Orange" cho Huawei Watch Fit 5 Pro (408 x 480), bám theo mặt gốc.
// Tọa độ x, y = góc trên-trái của ảnh. Dùng chung cho generate.cjs và preview.html.
(function (root) {
  const F = 'Roboto';
  const LAYOUT = {
    screen: { w: 408, h: 480 },
    colors: {
      orange: '#FF7F1F', white: '#FFFFFF', label: '#8E8E8E', week: '#B8B8B8',
      minute: '#8C8C8C', line: '#3C3C3C', box: '#6A6A6A', black: '#000000',
    },
    // Bóng đổ nhẹ dưới chữ/số như mặt gốc
    shadow: { color: 'rgba(0,0,0,0.65)', blur: 5, dx: 0, dy: 2 },

    digitSets: {
      hour:   { prefix: 'time/hour_',   cell: [66, 92],  color: 'white',  font: F, weight: 500, size: 116 },
      minute: { prefix: 'time/minute_', cell: [71, 102], color: 'minute', font: F, weight: 500, size: 126 },
      sec:    { prefix: 'time/sec_',    cell: [20, 32],  color: 'orange', font: F, weight: 300, size: 35 },
      day:    { prefix: 'date/day_',    cell: [33, 56],  color: 'orange', font: F, weight: 300, size: 66 },
      month:  { prefix: 'date/month_',  cell: [15, 32],  color: 'white',  font: F, weight: 300, size: 30 },
      lunar:  { prefix: 'date/lunar_',  cell: [11, 22],  color: 'label',  font: F, weight: 400, size: 19 },
      temp:   { prefix: 'data/temp_',   cell: [17, 34],  color: 'white',  font: F, weight: 300, size: 34 },
      bat:    { prefix: 'data/bat_',    cell: [16, 30],  color: 'white',  font: F, weight: 300, size: 29 },
      num:    { prefix: 'data/num_',    cell: [17, 32],  color: 'white',  font: F, weight: 400, size: 31 },
      numo:   { prefix: 'data/numo_',   cell: [17, 32],  color: 'orange', font: F, weight: 400, size: 31 },
      small:  { prefix: 'data/small_',  cell: [12, 26],  color: 'white',  font: F, weight: 400, size: 22 },
    },

    widgets: {
      // Giờ số (bên phải, trên nền bo góc)
      hourTens:   { set: 'hour',   x: 214, y: 124 },
      hourOnes:   { set: 'hour',   x: 280, y: 124 },
      minTens:    { set: 'minute', x: 212, y: 250 },
      minOnes:    { set: 'minute', x: 283, y: 250 },
      secTens:    { set: 'sec',    x: 364, y: 290 },
      secOnes:    { set: 'sec',    x: 384, y: 290 },

      // Lịch: ô ngày (ngày cam + "Th" + tháng), thứ tiếng Việt, âm lịch
      dayTens:    { set: 'day',   x: 98,  y: 108 },
      dayOnes:    { set: 'day',   x: 131, y: 108 },
      monthTens:  { set: 'month', x: 138, y: 166 },
      monthOnes:  { set: 'month', x: 153, y: 166 },
      week:       { img: 'date/week_', x: 2, y: 220, w: 170, h: 44, align: 'right' },
      lunarDayTens:   { set: 'lunar', x: 40, y: 194 },
      lunarDayOnes:   { set: 'lunar', x: 51, y: 194 },
      lunarMonthTens: { set: 'lunar', x: 68, y: 194 },
      lunarMonthOnes: { set: 'lunar', x: 79, y: 194 },

      // Dữ liệu
      battery:    { set: 'bat',   x: 212, y: 60,  align: 'left',  unit: 'data/bat_pct.png', unitW: 24 },
      weather:    { img: 'weather/', x: 30, y: 116, w: 40, h: 38 },
      temp:       { set: 'temp',  x: 20,  y: 158, align: 'left',  unit: 'data/temp_c.png', unitW: 30, minus: 'data/temp_minus.png' },
      steps:      { set: 'num',   x: 142, y: 302, align: 'right' },
      heart:      { set: 'numo',  x: 142, y: 360, align: 'right' },
      distance:   { set: 'small', x: 104, y: 412, align: 'left', dot: 'data/small_dot.png' },

      // Kim: ảnh dựng đứng chỉ 12 giờ. pivot = tâm xoay trong ảnh; center = tâm xoay trên màn hình.
      hands: {
        center: [196, 232],
        hour:   { img: 'hands/hour.png',   w: 40, h: 176, pivot: [20, 150] },
        minute: { img: 'hands/minute.png', w: 36, h: 262, pivot: [18, 228] },
        second: { img: 'hands/second.png', w: 20, h: 270, pivot: [10, 214] },
        cap:    { img: 'hands/cap.png',    w: 24, h: 24 },
      },
    },

    // AOD: cùng vị trí; có kim giờ/phút, số giờ/phút, thứ, ngày, tháng. Không giây, không dữ liệu.
    aod: {
      digitSets: {
        hour:   { prefix: 'aod/hour_',   cell: [66, 92],  color: '#C8C8C8', font: F, weight: 500, size: 116 },
        minute: { prefix: 'aod/minute_', cell: [71, 102], color: '#6E6E6E', font: F, weight: 500, size: 126 },
        day:    { prefix: 'aod/day_',    cell: [33, 56],  color: '#C2621A', font: F, weight: 300, size: 66 },
        month:  { prefix: 'aod/month_',  cell: [15, 32],  color: '#BDBDBD', font: F, weight: 300, size: 30 },
      },
      widgets: {
        hourTens:  { set: 'hour',   x: 214, y: 124 },
        hourOnes:  { set: 'hour',   x: 280, y: 124 },
        minTens:   { set: 'minute', x: 212, y: 250 },
        minOnes:   { set: 'minute', x: 283, y: 250 },
        dayTens:   { set: 'day',    x: 98,  y: 108 },
        dayOnes:   { set: 'day',    x: 131, y: 108 },
        monthTens: { set: 'month',  x: 138, y: 166 },
        monthOnes: { set: 'month',  x: 153, y: 166 },
        week:      { img: 'aod/week_', x: 2, y: 220, w: 170, h: 44, align: 'right' },
        hands: {
          hour:   { img: 'aod/hand_hour.png',   w: 40, h: 176, pivot: [20, 150] },
          minute: { img: 'aod/hand_minute.png', w: 36, h: 262, pivot: [18, 228] },
          cap:    { img: 'aod/hand_cap.png',    w: 24, h: 24 },
        },
      },
    },
  };
  if (typeof module !== 'undefined') module.exports = LAYOUT; else root.LAYOUT = LAYOUT;
})(this);
