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
    // Độ đậm của kim giờ/phút (1 = đặc như mặt gốc). Nhỏ hơn = nhạt hơn, thấy rõ chữ bên dưới.
    handAlpha: 0.55,

    // Ô giờ/phút: màu cam chủ đề nhưng nhạt hơn, sát mép phải
    panel: { x: 210, y: 62, w: 190, h: 262, r: 26 },
    // Ô lịch (ngày / Th tháng / âm lịch) và khối thời tiết gióng theo nó
    box: { x: 98, y: 62, w: 102, h: 136 },

    digitSets: {
      hour:   { prefix: 'time/hour_',   cell: [80, 112], color: '#141414', font: F, weight: 500, size: 142, noShadow: true },
      minute: { prefix: 'time/minute_', cell: [80, 112], color: '#6B3A12', font: F, weight: 500, size: 142, noShadow: true },
      sec:    { prefix: 'time/sec_',    cell: [21, 36],  color: 'orange', font: F, weight: 300, size: 38 },
      day:    { prefix: 'date/day_',    cell: [39, 58],  color: 'orange', font: F, weight: 300, size: 70 },
      month:  { prefix: 'date/month_',  cell: [16, 30],  color: 'white',  font: F, weight: 300, size: 30 },
      lunar:  { prefix: 'date/lunar_',  cell: [11, 22],  color: 'label',  font: F, weight: 400, size: 19 },
      temp:   { prefix: 'data/temp_',   cell: [17, 36],  color: 'white',  font: F, weight: 300, size: 34 },
      hilo:   { prefix: 'data/hilo_',   cell: [10, 22],  color: 'label',  font: F, weight: 400, size: 19 },
      bat:    { prefix: 'data/bat_',    cell: [15, 28],  color: 'white',  font: F, weight: 300, size: 27 },
      num:    { prefix: 'data/num_',    cell: [16, 34],  color: 'white',  font: F, weight: 300, size: 30 },
      numo:   { prefix: 'data/numo_',   cell: [16, 34],  color: 'orange', font: F, weight: 300, size: 30 },
      small:  { prefix: 'data/small_',  cell: [11, 24],  color: 'white',  font: F, weight: 400, size: 21 },
    },

    widgets: {
      // Giờ/phút trong ô cam nhạt (bên phải)
      hourTens:   { set: 'hour',   x: 225, y: 70 },
      hourOnes:   { set: 'hour',   x: 305, y: 70 },
      minTens:    { set: 'minute', x: 225, y: 196 },
      minOnes:    { set: 'minute', x: 305, y: 196 },
      // Giây: ngoài ô, ngay bên dưới, căn mép phải ô
      secTens:    { set: 'sec',    x: 357, y: 330 },
      secOnes:    { set: 'sec',    x: 378, y: 330 },

      // Ô lịch: ngày (cam) / Th + tháng / trăng + âm lịch
      dayTens:    { set: 'day',   x: 110, y: 68 },
      dayOnes:    { set: 'day',   x: 149, y: 68 },
      monthTens:  { set: 'month', x: 151, y: 130 },
      monthOnes:  { set: 'month', x: 167, y: 130 },
      lunarDayTens:   { set: 'lunar', x: 132, y: 166 },
      lunarDayOnes:   { set: 'lunar', x: 143, y: 166 },
      lunarMonthTens: { set: 'lunar', x: 161, y: 166 },
      lunarMonthOnes: { set: 'lunar', x: 172, y: 166 },
      week:       { img: 'date/week_', x: 14, y: 204, w: 186, h: 44, align: 'right' },

      // Thời tiết: gióng hàng trên / giữa / dưới với ô lịch
      weather:    { img: 'weather/', x: 30, y: 64, w: 48, h: 44 },
      temp:       { set: 'temp',  x: 16,  y: 124, align: 'left', unit: 'data/temp_c.png', unitW: 30, minus: 'data/temp_minus.png' },
      tempHiLo:   { set: 'hilo',  x: 22,  y: 166, align: 'left', sep: 'data/hilo_slash.png', minus: 'data/hilo_minus.png' },

      // Dữ liệu
      battery:    { set: 'bat',   x: 300, y: 18, align: 'left', unit: 'data/bat_pct.png', unitW: 22 },
      steps:      { set: 'num',   x: 160, y: 282, align: 'right' },
      heart:      { set: 'numo',  x: 160, y: 334, align: 'right' },
      distance:   { set: 'small', x: 112, y: 388, align: 'left', dot: 'data/small_dot.png' },

      // Kim: ảnh dựng đứng chỉ 12 giờ. pivot = tâm xoay trong ảnh; center = tâm xoay trên màn hình.
      hands: {
        center: [204, 240],
        hour:   { img: 'hands/hour.png',   w: 40, h: 197, pivot: [20, 156] },
        minute: { img: 'hands/minute.png', w: 38, h: 261, pivot: [19, 211] },
        second: { img: 'hands/second.png', w: 20, h: 273, pivot: [10, 207] },
        cap:    { img: 'hands/cap.png',    w: 16, h: 16 },
      },
    },

    // AOD: cùng vị trí; kim giờ/phút, số giờ/phút, thứ, ngày, tháng. Không giây, không dữ liệu.
    aod: {
      digitSets: {
        hour:   { prefix: 'aod/hour_',   cell: [80, 112], color: '#D9D9D9', font: F, weight: 500, size: 142, noShadow: true },
        minute: { prefix: 'aod/minute_', cell: [80, 112], color: '#B0703A', font: F, weight: 500, size: 142, noShadow: true },
        day:    { prefix: 'aod/day_',    cell: [39, 58],  color: '#C2621A', font: F, weight: 300, size: 70, noShadow: true },
        month:  { prefix: 'aod/month_',  cell: [16, 30],  color: '#BDBDBD', font: F, weight: 300, size: 30, noShadow: true },
      },
      widgets: {
        hourTens:  { set: 'hour',   x: 225, y: 70 },
        hourOnes:  { set: 'hour',   x: 305, y: 70 },
        minTens:   { set: 'minute', x: 225, y: 196 },
        minOnes:   { set: 'minute', x: 305, y: 196 },
        dayTens:   { set: 'day',    x: 110, y: 68 },
        dayOnes:   { set: 'day',    x: 149, y: 68 },
        monthTens: { set: 'month',  x: 151, y: 130 },
        monthOnes: { set: 'month',  x: 167, y: 130 },
        week:      { img: 'aod/week_', x: 14, y: 204, w: 186, h: 44, align: 'right' },
        hands: {
          hour:   { img: 'aod/hand_hour.png',   w: 40, h: 197, pivot: [20, 156] },
          minute: { img: 'aod/hand_minute.png', w: 38, h: 261, pivot: [19, 211] },
          cap:    { img: 'aod/hand_cap.png',    w: 16, h: 16 },
        },
      },
    },
  };
  if (typeof module !== 'undefined') module.exports = LAYOUT; else root.LAYOUT = LAYOUT;
})(this);
