// Biểu tượng SVG (viewBox 0 0 24 24). Hàm nhận màu, trả chuỗi SVG.
(function (root) {
  const svg = (body, extra = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ${extra}>${body}</svg>`;
  const S = (c, w = 1.7) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;

  const CLOUD = 'M6.5 19H17.5A3.5 3.5 0 0 0 17.5 12A5 5 0 0 0 8 11.5A3.75 3.75 0 0 0 6.5 19Z';
  const CLOUD_UP = 'M6.5 15H17.5A3.5 3.5 0 0 0 17.5 8A5 5 0 0 0 8 7.5A3.75 3.75 0 0 0 6.5 15Z';
  const rays = (cx, cy, r1, r2, angles) => angles.map((a) => {
    const t = (a * Math.PI) / 180;
    return `M${(cx + r1 * Math.cos(t)).toFixed(2)} ${(cy + r1 * Math.sin(t)).toFixed(2)}L${(cx + r2 * Math.cos(t)).toFixed(2)} ${(cy + r2 * Math.sin(t)).toFixed(2)}`;
  }).join('');

  const ICONS = {
    // ---- thời tiết ----
    sunny: (c) => svg(`<circle cx="12" cy="12" r="4.2" ${S(c)}/><path d="${rays(12, 12, 6.8, 9.3, [0, 45, 90, 135, 180, 225, 270, 315])}" ${S(c)}/>`),
    partly_cloudy: (c) => svg(`<circle cx="9" cy="9" r="3.6" ${S(c)}/><path d="${rays(9, 9, 5.6, 7.6, [90, 135, 180, 225, 270, 315])}" ${S(c)}/><path d="${CLOUD}" fill="#000" stroke="${c}" stroke-width="1.7" stroke-linejoin="round"/>`),
    cloudy: (c) => svg(`<path d="M8 9.5A4.5 4.5 0 0 1 16.5 8" ${S(c)}/><path d="${CLOUD}" ${S(c)}/>`),
    rain: (c) => svg(`<path d="${CLOUD_UP}" ${S(c)}/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" ${S(c)}/>`),
    heavy_rain: (c) => svg(`<path d="${CLOUD_UP}" ${S(c)}/><path d="M7.5 17.5l-1.5 4M11 17.5l-1.5 4M14.5 17.5l-1.5 4M18 17.5l-1.5 4" ${S(c)}/>`),
    thunder: (c) => svg(`<path d="${CLOUD_UP}" ${S(c)}/><path d="M12.5 16l-2.5 3.5h3l-2 3.5" ${S(c)}/>`),
    snow: (c) => svg(`<path d="${CLOUD_UP}" ${S(c)}/><path d="M8 19h.01M12 18h.01M16 19h.01M10 21.5h.01M14 21.5h.01" ${S(c, 2.4)}/>`),
    fog: (c) => svg(`<path d="${CLOUD_UP}" ${S(c)}/><path d="M4 18.5h16M6 21.5h12" ${S(c)}/>`),
    wind: (c) => svg(`<path d="M3 9h11a2.5 2.5 0 1 0-2.5-2.5M3 13h15a2.5 2.5 0 1 1-2.5 2.5M3 17h8" ${S(c)}/>`),
    night: (c) => svg(`<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" ${S(c)}/>`),
    unknown: (c) => svg(`<path d="${CLOUD}" ${S(c)}/><path d="M10.5 13.6a1.6 1.6 0 1 1 2.2 1.5c-.5.2-.7.6-.7 1.1M12 17.6h.01" ${S(c, 1.5)}/>`),

    // ---- biểu tượng tĩnh ----
    sunrise: (c) => svg(`<path d="M7 17.5A5 5 0 0 1 17 17.5Z" fill="${c}"/><path d="M2.5 17.5h19M7 20.5h10M12 2.5v5.5M9.5 5l2.5-2.5L14.5 5" ${S(c, 1.8)}/><path d="${rays(12, 17.5, 7.2, 9, [200, 235, 305, 340])}" ${S(c, 1.8)}/>`),
    bell: (c) => svg(`<path d="M12 2.8a1.5 1.5 0 0 1 1.5 1.5v.5A6.2 6.2 0 0 1 18.2 11v4.2l2 2.6H3.8l2-2.6V11a6.2 6.2 0 0 1 4.7-6.2v-.5A1.5 1.5 0 0 1 12 2.8ZM9.6 19.4h4.8a2.4 2.4 0 0 1-4.8 0Z" fill="${c}"/>`),
    shoe: (c) => svg(`<path d="M5.5 9.5 7.7 11l2.2-1.5 3.4 4.2 5.3 1.6c1.6.5 2.6 1.4 2.6 2.7v.3H3.2v-4.4Z" fill="${c}"/><path d="M3.2 19.3h18v1.2c0 .5-.4.9-.9.9H4.1a.9.9 0 0 1-.9-.9Z" fill="${c}"/><path d="M1 7.5h4M2 10h2.2M1 12.5h2" ${S(c, 1.5)}/><path d="M10.6 12.4l1.4-.9M11.9 14l1.4-.9" stroke="#000" stroke-width="1.2" stroke-linecap="round"/>`),
    heart: (c) => svg(`<path d="M12 20.5S3 15 3 9.3C3 6.6 5 4.5 7.6 4.5c1.9 0 3.5 1.1 4.4 2.7.9-1.6 2.5-2.7 4.4-2.7C19 4.5 21 6.6 21 9.3 21 15 12 20.5 12 20.5Z" fill="${c}"/>`),
    message: (c) => svg(`<path d="M7 3h10a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4h-6l-4.5 3.8V17A4 4 0 0 1 3 13V7a4 4 0 0 1 4-4Z" fill="${c}"/><circle cx="8" cy="10" r="1.4" fill="#3A3A3C"/><circle cx="12" cy="10" r="1.4" fill="#3A3A3C"/><circle cx="16" cy="10" r="1.4" fill="#3A3A3C"/>`),
    phone: (c) => svg(`<path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.6 21 3 13.4 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1Z" fill="${c}"/><path d="M21 3l-6 6M15 4.5V9h4.5" ${S(c, 1.8)}/>`),
    stopwatch: (c) => svg(`<circle cx="12" cy="13.5" r="7.5" ${S(c, 1.8)}/><path d="M12 13.5V9.5M9.5 2.5h5M12 2.5V6M18.2 6.8l1.3-1.3" ${S(c, 1.8)}/>`),
    pin: (c) => svg(`<path d="M12 22s-6.5-6.4-6.5-11.5a6.5 6.5 0 0 1 13 0C18.5 15.6 12 22 12 22Z" fill="${c}"/><circle cx="12" cy="10.5" r="2.4" fill="#000"/>`),
    alarm: (c) => svg(`<path d="M12 4.5a1.3 1.3 0 0 1 1.3 1.3v.4A5.5 5.5 0 0 1 17.4 11.5v3.7l1.7 2.3H4.9l1.7-2.3v-3.7a5.5 5.5 0 0 1 4.1-5.3v-.4A1.3 1.3 0 0 1 12 4.5ZM10 19h4a2 2 0 0 1-4 0Z" fill="${c}"/><path d="M3.5 9.5a8.5 8.5 0 0 1 2.6-5M20.5 9.5a8.5 8.5 0 0 0-2.6-5M1 10a11 11 0 0 1 3-7M23 10a11 11 0 0 0-3-7" ${S(c, 1.4)}/>`),
    message_dot: (c) => svg(`<path d="M5 6h10a3.5 3.5 0 0 1 3.5 3.5v5A3.5 3.5 0 0 1 15 18h-5l-4 3.3V18a3.5 3.5 0 0 1-4.5-3.5v-5A3.5 3.5 0 0 1 5 6Z" fill="${c}"/><circle cx="6.5" cy="12" r="1.2" fill="#3A3A3C"/><circle cx="10" cy="12" r="1.2" fill="#3A3A3C"/><circle cx="13.5" cy="12" r="1.2" fill="#3A3A3C"/><circle cx="19" cy="5" r="3.6" fill="#FF3B30" stroke="#1C1C1E" stroke-width="1.2"/>`),
  };
  if (typeof module !== 'undefined') module.exports = ICONS; else root.ICONS = ICONS;
})(this);
