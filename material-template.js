const materialTemplate = [
  ['MÃ GỖ (Melamine, PVC…)', 'Melamine vân gỗ', 'Melamine trắng (gỗ sơn trắng đồng màu 101SH)', 'PVC vân gỗ', 'PVC trắng'],
  ['SƠN GỖ', 'Sơn đồ gỗ màu'],
  ['SƠN TƯỜNG + TRẦN', 'Sơn tường trắng (trắng ngà, cả nhà)', 'Sơn tường màu'],
  ['PHÀO CHỈ', 'Phào chỉ tường (phòng khách / ngủ master / ngủ con)', 'Phào cổ trần (cả nhà)'],
  ['ĐÁ ỐP LÁT (sảnh, bếp, lavabo, bậu cửa)', 'Đá mặt bếp', 'Đá ốp tường bếp', 'Đá lavabo'],
  ['GẠCH ỐP LÁT (sảnh, WC, logia)', 'Gạch lát sảnh KT 600×300', 'Gạch lát sàn WC 600×600 / 300×300', 'Gạch ốp tường WC 600×600 / 200×300', 'Điểm nhấn'],
  ['KÍNH (bếp, cánh, vách tắm)', 'Kính cánh tủ', 'Kính vách tắm (+ phụ kiện)', 'Kính bếp'],
  ['GIẤY DÁN TƯỜNG', 'Theo phòng'],
  ['NỈ BỌC (sofa, giường, đôn, ghế, đệm đi giày)', 'Nỉ ghế đi giày', 'Nỉ vách đầu giường', 'Nỉ đôn trang điểm', 'Đệm cứng / lún', 'Nỉ bọc sofa'],
  ['RÈM (thả, cầu vồng, sáo, roman)', 'Rèm thả theo phòng'],
  ['SÀN GỖ', 'Thẳng / xương cá lát chéo / xương cá thẳng tường', 'Phào chân tường (trắng / đồng màu sàn)', 'Nẹp chênh cote / giao sàn / kết sàn'],
  ['SÀN NHỰA LOGIA'],
  ['ĐÈN', 'Đèn chiếu sáng', 'Đèn trang trí'],
  ['CÔNG TẮC – Ổ CẮM', 'Làm mới'],
  ['BẾP', 'Phụ kiện bếp', 'Thiết bị bếp'],
  ['THIẾT BỊ VỆ SINH'],
  ['TAY NẮM', 'Tay nắm cánh tủ', 'Tay nắm dài', 'Núm cánh tủ']
];
const initialPresets = {
  room: ['Cả nhà','Phòng khách','Ngủ master','Ngủ con','WC','Bếp','Logia'],
  unit: ['m²','md','bộ','cái'], size: ['600×300','600×600','300×300','200×300'],
  finish: ['Mờ','Bóng','Vân gỗ'], color: ['Trắng','Trắng ngà'], supplier: []
};

if (typeof module !== 'undefined' && module.exports) module.exports = materialTemplate;
