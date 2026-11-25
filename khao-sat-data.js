/* Bộ câu hỏi "Khảo sát nhu cầu trước thiết kế" – dùng chung trình duyệt (khao-sat.js, mau-tra-loi) và Node (survey.js).
 * Câu trả lời lưu dạng {id câu: 'giá trị' | ['giá trị',…] | 'chữ', 'id.khac': 'chữ ô Khác'}.
 * showIf (nhóm hoặc câu): {q, in:[…]} / {q, notIn:[…]} hoặc mảng nhiều điều kiện (phải đúng hết); q phải đang hiện.
 * optIf: {giá trị: điều kiện} – ẩn riêng 1 lựa chọn (vd "gầm cầu thang" khi là chung cư).
 * sub: {giá trị: 'a:Nhãn;b:Nhãn|c:Nhãn'} – tích nhỏ trong ô (vd Lò nướng → Âm tủ), lưu ở 'id.giá trị': ['a',…]; ';' trong cùng nhóm = chỉ chọn 1, '|' tách nhóm độc lập.
 * Lựa chọn khong / chua_biet ở câu chọn nhiều là phủ định: chọn nó thì bỏ các ô khác và ngược lại.
 * type 'date': 'YYYY-MM-DD' (kèm ngày âm khi hiện); type 'rooms': [{who, items:[…], bed, mat, pc:[…], mau:[…], note}] – mỗi phòng ngủ 1 phần tử, số phòng theo pn_so.
 * type 'number': số (vd diện tích), thanh trượt min..max + ô nhập; unit hiện kèm.
 * type 'note': ghi chú riêng 1 không gian, kèm phong cách / màu riêng ở 'id.pc' / 'id.mau' (trống = theo phần chung).
 * Thêm: max (chọn tối đa), one: [[giá trị…]] (trong câu chọn nhiều, mỗi nhóm chỉ 1), heads: [[tiêu đề, [giá trị…]]] (chia nhóm khi hiện),
 *   hint: {giá trị: 'ghi chú nhỏ'}, note: 'gợi ý' (ô ghi chú 'id.ghi_chu'), color: true (ô tự chọn màu 'id.mau_khac' = '#rrggbb').
 * Thứ tự nhóm: tổng thể (công trình, gia đình, phong cách, ngân sách) → đặc thù nhà → kĩ thuật → từng không gian. */
(root => {
  const clean = value => String(value == null ? '' : value).trim();
  const TEXT_MAX = 1000, OTHER_MAX = 300;

  // 'a:Nhãn A;b:Nhãn B' -> [{v:'a', l:'Nhãn A'}]
  const parseOptions = text => String(text || '').split(';').map(part => {
    const i = part.indexOf(':');
    return {v: part.slice(0, i).trim(), l: part.slice(i + 1).trim()};
  }).filter(o => o.v && o.l);
  // Q(id, loại, nhãn ngắn (dùng khi tóm tắt), câu hỏi, 'giá trị:nhãn;…', {other, showIf})
  const Q = (id, type, short, text, options, extra = {}) => ({id, type, short, text, options: parseOptions(options), ...extra,
    sub: extra.sub && Object.fromEntries(Object.entries(extra.sub).map(([v, t]) => [v, t.split('|').flatMap((part, g) => parseOptions(part).map(o => ({...o, g})))]))});
  const EXCLUSIVE = ['khong', 'chua_biet'];
  // Ngày âm (lịch Trung Hoa của Intl; shortcut: có thể lệch 1 ngày với âm lịch VN ở vài năm hiếm, khi cần chính xác thì dùng bảng âm lịch VN)
  const lunarText = value => {
    try {
      const parts = new Intl.DateTimeFormat('vi-VN-u-ca-chinese', {day: 'numeric', month: 'numeric'}).formatToParts(new Date(value + 'T12:00:00'));
      const get = type => parts.find(p => p.type === type)?.value;
      return get('day') ? get('day') + '/' + get('month') + ' âm lịch' : '';
    } catch { return ''; }
  };
  const dateText = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !isNaN(new Date(value)) ? value.split('-').reverse().join('/') + (lunarText(value) ? ' (' + lunarText(value) + ')' : '') : '';
  // Bảng phòng ngủ: chọn phòng cho ai → các lựa chọn của phòng đó
  const ROOM = {
    who: parseOptions('vo_chong:Vợ chồng;con_trai:Con trai;con_gai:Con gái;hai_con:2 con ở chung;em_be:Em bé;ong_ba:Ông bà;khach:Khách;giup_viec:Giúp việc;da_nang:Đa năng / làm việc'),
    items: parseOptions('wc_rieng:WC riêng;wic:Phòng thay đồ;trang_diem:Bàn trang điểm;lam_viec:Góc làm việc;ban_hoc:Bàn học;giuong_tang_hoc:Giường tầng thang hộc;giuong_tang_khi:Giường tầng thang khỉ;goc_choi:Góc chơi, tủ đồ chơi;' +
      'tv:TV;ban_cong:Cửa ra ban công;gan_wc:Gần WC, chống trơn;sofa_giuong:Sofa giường;co_hoc:Giường có hộc chứa đồ'),
    itemFor: {wic: ['vo_chong'], trang_diem: ['vo_chong', 'con_gai'], lam_viec: ['vo_chong', 'khach', 'da_nang'], ban_hoc: ['con_trai', 'con_gai', 'hai_con'], giuong_tang_hoc: ['hai_con'], giuong_tang_khi: ['hai_con'],
      goc_choi: ['con_trai', 'con_gai', 'hai_con', 'em_be'], tv: ['vo_chong', 'ong_ba', 'khach'], ban_cong: ['vo_chong'], gan_wc: ['ong_ba'], sofa_giuong: ['da_nang']},
    beds: parseOptions('1m:1m;1m2:1m2;1m4:1m4;1m6:1m6;1m8:1m8;2m:2m trở lên'),
    mats: parseOptions('go:Giường gỗ;da:Bọc da;ni:Bọc nỉ')
  };
  const STYLES = () => QUESTION_BY_ID.ps_phong_cach.options.filter(o => !EXCLUSIVE.includes(o.v)), COLORS = () => QUESTION_BY_ID.ps_mau.options;
  const pickList = (value, list) => [...new Set(Array.isArray(value) ? value.filter(v => list.some(o => o.v === v)) : [])];
  const lookText = (pc, mau) => [pc.length && 'phong cách ' + pc.map(v => STYLES().find(o => o.v === v)?.l).join(', '), mau.length && 'màu ' + mau.map(v => COLORS().find(o => o.v === v)?.l).join(', ')].filter(Boolean).join('; ');
  const roomItems = who => ROOM.items.filter(o => !ROOM.itemFor[o.v] || ROOM.itemFor[o.v].includes(who));
  const roomCount = answers => Math.min(5, Number(answers.pn_so) || 0);
  const OTHER = {other: true};

  const RESIDENTIAL = {q: 'loai_nha', in: ['chung_cu', 'nha_pho', 'biet_thu']};
  const HOUSE = {q: 'loai_nha', in: ['nha_pho', 'biet_thu']};
  const FLAT = {q: 'loai_nha', in: ['chung_cu']};
  const KIDS = {q: 'thanh_vien', in: ['tre_nho', 'tre_hoc', 'thanh_thieu']};
  const ELDERLY = {q: 'thanh_vien', in: ['ong_ba']};
  const AM_TU = 'am_tu:Âm tủ';
  // Ghi chú riêng từng không gian: phong cách, màu, điều cần lưu ý – thay cho các câu hỏi lặt vặt
  const NOTE = (id, room) => Q(id, 'note', 'Lưu ý riêng ' + room, 'Phong cách, màu sắc hoặc điều cần lưu ý riêng cho ' + room + '? (nếu khác phần chung)', '');

  const GROUPS = [
    // ---------------------------------------------------------------- TỔNG THỂ
    {id: 'chung', title: 'Thông tin chung', intro: 'Vài câu đầu để GD HOME biết mình đang cần thiết kế gì.', questions: [
      Q('loai_nha', 'one', 'Loại công trình', 'Công trình cần thiết kế là loại nào?', 'chung_cu:Chung cư;nha_pho:Nhà phố;biet_thu:Biệt thự;van_phong:Văn phòng;cua_hang:Cửa hàng / showroom;khac:Loại khác'),
      Q('tinh_trang', 'one', 'Tình trạng hiện tại', 'Công trình đang ở tình trạng nào?', 'tho:Mới nhận bàn giao thô;co_ban:Đã hoàn thiện cơ bản, cần làm lại nội thất;dang_o:Đang ở, cần cải tạo;xay_moi:Đang xây mới / chưa có nhà'),
      Q('dien_tich', 'number', 'Diện tích', 'Diện tích sử dụng khoảng bao nhiêu?', '', {min: 20, max: 500, step: 5, unit: 'm²'}),
      Q('dia_chi', 'text', 'Địa chỉ / dự án', 'Địa chỉ hoặc tên dự án? (ghi ngắn)', ''),
      Q('muc_dich', 'one', 'Mục đích sử dụng', 'Mình dùng công trình để làm gì?', 'o_chinh:Để ở lâu dài;nghi_duong:Nghỉ dưỡng / ở không thường xuyên;cho_thue:Cho thuê;kinh_doanh:Kinh doanh, làm việc', {showIf: RESIDENTIAL})
    ]},
    {id: 'gia_dinh', title: 'Gia đình & thói quen', intro: 'Hiểu người ở thì mới thiết kế đúng nhu cầu.', showIf: RESIDENTIAL, questions: [
      Q('so_nguoi', 'one', 'Số người ở', 'Có bao nhiêu người thường xuyên ở trong nhà?', '1:1 người;2:2 người;3_4:3 - 4 người;5_6:5 - 6 người;7:Từ 7 người trở lên'),
      Q('thanh_vien', 'many', 'Thành viên', 'Trong nhà có những ai?', 'vo_chong:Vợ chồng;tre_nho:Trẻ nhỏ dưới 6 tuổi;tre_hoc:Trẻ đi học;thanh_thieu:Thanh thiếu niên;ong_ba:Ông bà / người lớn tuổi;giup_viec:Người giúp việc ở lại;khach_o_lai:Khách / họ hàng hay ở lại', OTHER),
      Q('thu_cung', 'many', 'Thú cưng', 'Nhà có nuôi thú cưng không?', 'khong:Không nuôi;cho:Chó;meo:Mèo;chim_ca:Chim / cá / thú nhỏ', OTHER),
      Q('thoi_quen', 'many', 'Thói quen sinh hoạt', 'Cả nhà hay làm gì ở nhà?', 'nau_an:Nấu ăn hàng ngày;tiep_khach:Tiếp khách, tụ tập bạn bè;lam_viec:Làm việc tại nhà;xem_phim:Xem phim, chơi game;the_thao:Tập gym, yoga;doc_sach:Đọc sách;cay_canh:Trồng cây, chăm sưu tầm;nhac:Nhạc cụ, karaoke', OTHER),
    ]},
    {id: 'phong_cach', title: 'Phong cách & màu sắc', intro: 'Định hướng chung cho cả nhà – các phòng sẽ theo hướng này, chỗ nào khác thì ghi ở từng phòng.', questions: [
      Q('ps_phong_cach', 'many', 'Phong cách ưa thích', 'Mình thích phong cách nào? (chọn tối đa 3)', 'hien_dai:Hiện đại;luxury:Sang trọng (Luxury);toi_gian:Tối giản (Minimalist);japandi:Japandi;' +
        'modern_farmhouse:Modern Farmhouse;scandinavian:Bắc Âu (Scandinavian);tan_co_dien:Tân cổ điển;wabi_sabi:Wabi-sabi;' +
        'indochine:Indochine;industrial:Industrial (công nghiệp);rustic:Rustic (mộc mạc);mid_century:Mid-century Modern;boho:Boho;dia_trung_hai:Địa Trung Hải;chua_biet:Chưa biết, cần tư vấn',
        {max: 3, note: 'Nếu chọn nhiều phong cách: phong cách nào cho khu vực nào?', heads: [['Hiện đại · tối giản', ['hien_dai', 'luxury', 'toi_gian', 'japandi']],
          ['Mộc · ấm · cổ điển', ['modern_farmhouse', 'scandinavian', 'tan_co_dien', 'wabi_sabi']], ['Cá tính · vùng miền', ['indochine', 'industrial', 'rustic', 'mid_century', 'boho', 'dia_trung_hai']]], ...OTHER}),
      Q('ps_mau', 'many', 'Màu yêu thích', 'Màu sắc chủ đạo yêu thích?', 'trang_kem:Trắng, kem;pastel:Pastel nhẹ;vang_dong:Vàng đồng;go_sang:Gỗ sáng;mau_dat:Màu đất;go_toi:Gỗ tối (óc chó);xanh_la:Xanh lá, xanh rêu;xanh_navy:Xanh navy;xam:Xám;den:Đen', {color: true, ...OTHER}),
      Q('ps_vat_lieu', 'many', 'Vật liệu', 'Vật liệu muốn thấy trong nhà?', 'go_tn:Gỗ tự nhiên;da:Đá, đá nung;kim_loai:Kim loại;kinh:Kính;vai:Vải, boucle;da_that:Da;may_tre:Mây tre, cói;gach_bong:Gạch bông;giay_dan_tuong:Giấy dán tường;be_tong:Bê tông, xi măng', OTHER),
      Q('ps_tong_the', 'many', 'Lựa chọn chung cả nhà', 'Một số lựa chọn ảnh hưởng tới hình thức cả nhà?', 'canh_tron:Cánh tủ trơn, tay nắm âm / ẩn;tay_nam:Cánh tủ có tay nắm trang trí;van_go:Ưu tiên vân gỗ ở chỗ hay chạm;canh_son:Cánh tủ sơn màu;it_vat_lieu:Ít loại vật liệu, gọn và dễ phối', OTHER),
      Q('ps_anh_sang', 'one', 'Ánh sáng đèn', 'Ánh sáng đèn mong muốn?', 'trang:Trắng sáng, rõ ràng;vang:Vàng ấm, thư giãn;ket_hop:Kết hợp theo từng khu'),
      Q('ps_rem', 'many', 'Rèm', 'Loại rèm mong muốn?', 'vai:Rèm vải 2 lớp (voan + cản sáng);cuon:Rèm cuốn;sao:Rèm sáo gỗ / nhôm;dien:Rèm điện;cau_vong:Rèm cầu vồng;chua_biet:Chưa biết, cần tư vấn'),
      Q('ps_tham_khao', 'text', 'Hình ảnh tham khảo', 'Link Pinterest / hình ảnh nhà mình thích (nếu có)?', '')
    ]},
    {id: 'ngan_sach', title: 'Ngân sách & thời gian', intro: 'Để GD HOME đề xuất phương án sát thực tế.', questions: [
      Q('ns_noi_that', 'one', 'Ngân sách nội thất', 'Ngân sách nội thất dự kiến (không gồm phần thô)?', 'duoi_200:Dưới 200 triệu;200_400:200 - 400 triệu;400_700:400 - 700 triệu;700_1000:700 triệu - 1 tỷ;tren_1000:Trên 1 tỷ;chua_biet:Chưa xác định, cần tư vấn'),
      Q('ns_gom', 'many', 'Hạng mục trong ngân sách', 'Ngân sách đó đã gồm những hạng mục nào?', 'thiet_ke:Thiết kế;thi_cong:Thi công hoàn thiện;noi_that_roi:Nội thất rời;den:Đèn;rem:Rèm;decor:Đồ trang trí;thiet_bi:Thiết bị bếp, điện tử', OTHER),
      Q('ns_vao_o', 'one', 'Thời gian vào ở', 'Mong muốn vào ở sau bao lâu?', 'duoi_2:Dưới 2 tháng;3_4:3 - 4 tháng;5_6:5 - 6 tháng;tren_6:Trên 6 tháng;chua_biet:Chưa xác định', OTHER),
      Q('ns_nhap_trach', 'date', 'Ngày nhập trạch', 'Ngày dự kiến nhập trạch (nếu đã xem ngày)?', ''),
      Q('ns_uu_tien', 'many', 'Ưu tiên', 'Điều quan trọng nhất với mình? (chọn tối đa 3)', 'ben:Bền, dùng lâu;dep:Đẹp, ấn tượng;re:Chi phí hợp lý;de_ve_sinh:Dễ vệ sinh, ít bảo trì;tien_do:Thi công nhanh;thong_minh:Tiện nghi, công nghệ;luu_tru:Nhiều chỗ chứa đồ;suc_khoe:An toàn, thân thiện sức khoẻ', {max: 3}),
      Q('ns_quyet_dinh', 'one', 'Người quyết định', 'Ai cùng quyết định thiết kế? (nên có 1 người đại diện trao đổi với GD HOME)', 'mot:Mình tự quyết;vo_chong:Hai vợ chồng;gia_dinh:Cả gia đình (bố mẹ, anh chị em)')
    ]},
    // ---------------------------------------------------------------- ĐẶC THÙ CÔNG TRÌNH
    {id: 'nha_pho', title: 'Nhà phố / biệt thự', intro: 'Những điểm đặc thù của nhà nhiều tầng.', showIf: HOUSE, questions: [
      Q('so_tang', 'one', 'Số tầng', 'Nhà có mấy tầng (tính cả tum, hầm nếu có)?', '2:2 tầng;3:3 tầng;4:4 tầng;5:5 tầng;6:Từ 6 tầng'),
      Q('thang_may', 'one', 'Thang máy', 'Có dùng thang máy không? (ảnh hưởng nhiều tới mặt bằng, kết cấu và điện 3 pha)', 'co_san:Đã có sẵn;se_lap:Sẽ lắp thang máy;du_phong:Chừa hố dự phòng, lắp sau;khong:Không dùng thang máy'),
      Q('cau_thang', 'one', 'Cầu thang', 'Cầu thang hiện tại ra sao?', 'giu:Giữ nguyên;doi_mat:Chỉ ốp lại bậc, đổi lan can;lam_lai:Muốn làm lại kiểu mới;chua_co:Chưa xây'),
      Q('gieng_troi', 'one', 'Giếng trời', 'Giếng trời / khoảng thông tầng?', 'giu:Có sẵn, muốn giữ và trang trí;them:Muốn mở thêm lấy sáng;khong:Không có / không cần'),
      Q('tho_tang_tren', 'one', 'Phòng thờ', 'Phòng thờ đặt ở đâu?', 'tang_tren:Tầng trên cùng;tang_khac:Một tầng khác;phong_khach:Góc trong phòng khách;khong:Không cần phòng thờ'),
      Q('san_gara', 'many', 'Sân / gara', 'Tầng trệt cần bố trí gì?', 'xe_may:Chỗ để xe máy;o_to_1:Gara 1 ô tô;o_to_2:Gara 2 ô tô trở lên;san_vuon:Sân trước / sân vườn;tieu_canh:Tiểu cảnh, cây xanh;khu_giat:Khu giặt phơi', OTHER),
      Q('chong_nong_am', 'many', 'Vấn đề nhiệt / ẩm', 'Nhà đang gặp vấn đề nào về nóng, ẩm, thấm?', 'tang_nong:Tầng trên cùng rất nóng;tay:Tường hướng tây nắng gắt;nom_am:Nồm, ẩm mốc;tham:Thấm dột;gio_lua:Gió lùa mạnh;toi:Thiếu sáng, bí;khong:Chưa thấy vấn đề', OTHER),
      Q('huong_nha', 'one', 'Hướng nhà', 'Hướng mặt tiền (nếu biết)?', 'dong:Đông;tay:Tây;nam:Nam;bac:Bắc;khac:Đông Nam / Tây Bắc / chưa rõ'),
      Q('ban_cong_san_thuong', 'many', 'Ban công / sân thượng', 'Ban công, sân thượng muốn dùng thế nào?', 'giat_phoi:Giặt phơi;cay_canh:Vườn rau, cây cảnh;tra_ca_phe:Góc trà, cà phê;bbq:Tiệc nướng;khong:Không cần quan tâm', OTHER),
      Q('be_boi_gym', 'many', 'Tiện ích riêng', 'Biệt thự: cần tiện ích riêng nào?', 'be_boi:Bể bơi;vuon:Sân vườn lớn;gym:Phòng gym;giai_tri:Phòng karaoke / chiếu phim;ham_ruou:Hầm rượu;bbq:Khu BBQ ngoài trời', {showIf: {q: 'loai_nha', in: ['biet_thu']}, ...OTHER})
    ]},
    {id: 'chung_cu', title: 'Căn hộ chung cư', intro: 'Các lưu ý riêng khi cải tạo trong chung cư.', showIf: FLAT, questions: [
      Q('quy_dinh_bql', 'one', 'Quy định ban quản lý', 'Đã nắm quy định thi công của ban quản lý toà nhà chưa?', 'da_biet:Đã nắm, đã có quy định;chua_biet:Chưa biết, nhờ GD HOME hỏi giúp'),
      Q('cai_tao_tho', 'one', 'Mức cải tạo', 'Mức độ cải tạo mong muốn?', 'chi_noi_that:Chỉ làm nội thất, giữ nguyên hiện trạng;nhe:Cải tạo nhẹ (đổi gạch, sơn, trần, điện nước);lon:Muốn đục phá / dời vách nếu được phép'),
      Q('logia', 'one', 'Logia / máy giặt', 'Máy giặt và phơi đồ bố trí thế nào?', 'logia:Ở logia, có che chắn;wc:Trong WC;giau_tu:Giấu máy giặt trong tủ;chua_biet:Chưa biết, cần tư vấn', {sub: {logia: 'say:Có máy sấy|dat_cao:Đặt cao, đỡ cúi', giau_tu: 'say:Có máy sấy|dat_cao:Đặt cao, đỡ cúi'}}),
      Q('view_nang', 'one', 'Ánh sáng / view', 'Căn hộ có đặc điểm gì về ánh sáng, view?', 'nang_tay:Nắng chiều gay gắt;toi:Hơi tối, ít sáng;view_dep:View đẹp, muốn tận dụng;binh_thuong:Bình thường')
    ]},
    {id: 'van_phong', title: 'Văn phòng / cửa hàng', intro: 'Nhu cầu không gian làm việc, kinh doanh.', showIf: {q: 'loai_nha', in: ['van_phong', 'cua_hang']}, questions: [
      Q('nhan_su', 'one', 'Số nhân sự', 'Số người làm việc / phục vụ cùng lúc?', 'duoi_10:Dưới 10 người;10_30:10 - 30 người;30_60:30 - 60 người;tren_60:Trên 60 người'),
      Q('khu_vuc', 'many', 'Khu vực cần có', 'Cần những khu vực nào?', 'le_tan:Lễ tân / quầy thu ngân;lam_viec:Khu làm việc chung;giam_doc:Phòng giám đốc;hop:Phòng họp;tiep_khach:Khu tiếp khách;pantry:Pantry / bếp nhỏ;kho:Kho, lưu trữ hồ sơ;server:Phòng máy chủ;nghi:Phòng nghỉ;trung_bay:Khu trưng bày sản phẩm', OTHER),
      Q('thuong_hieu', 'one', 'Nhận diện thương hiệu', 'Có cần thể hiện nhận diện thương hiệu (logo, màu) trong thiết kế?', 'co:Có, đã có bộ nhận diện;chua:Muốn GD HOME gợi ý;khong:Không cần'),
      Q('thiet_bi_vp', 'many', 'Hạ tầng thiết bị', 'Hạ tầng kỹ thuật cần lưu ý?', 'mang:Mạng, cáp, tủ rack;man_hinh:Màn hình / máy chiếu họp;camera:Camera, chấm công;in_an:Khu máy in;dieu_hoa:Điều hoà trung tâm', OTHER),
      Q('khach_den', 'one', 'Khách đến', 'Khách hàng ghé trực tiếp nhiều không?', 'nhieu:Nhiều, cần ấn tượng ngay cửa;it:Ít, chủ yếu nội bộ')
    ]},
    // ---------------------------------------------------------------- KĨ THUẬT
    {id: 'ky_thuat', title: 'Kĩ thuật điện - nước - trần', intro: 'Chốt sớm để đặt sẵn ống chờ, đường điện, vị trí thiết bị – tránh đục sửa về sau.', showIf: RESIDENTIAL, questions: [
      Q('kt_dien', 'many', 'Điện - mạng', 'Về điện và mạng, nhà mình có / cần gì?', 'ba_pha:Điện 3 pha (thang máy, máy lớn);mat_troi:Điện mặt trời;du_phong:Máy phát / bộ lưu điện dự phòng;sac_xe:Ổ sạc xe điện;tu_dien:Đã có vị trí tủ điện tổng;wifi:Wifi phủ toàn nhà;lan:Ổ mạng LAN các phòng;camera:Camera an ninh;chua_biet:Chưa rõ, cần tư vấn',
        {optIf: {ba_pha: HOUSE, mat_troi: HOUSE, sac_xe: HOUSE, tu_dien: HOUSE}, ...OTHER}),
      Q('kt_nuoc', 'many', 'Nước', 'Nước nóng và thiết bị nước?', 'nl_mat_troi:Nước nóng năng lượng mặt trời;nong_tong:Nóng tổng (heat pump / bình lớn);co_binh:Đã có bình nóng lạnh;binh_phong:Bình nóng lạnh từng phòng;nong_bep:Cần kéo nước nóng ra bếp (hiện chưa có);loc_tong:Lọc tổng đầu nguồn;be_nuoc:Bể nước ngầm / bồn mái;tang_ap:Bơm tăng áp',
        {optIf: {nl_mat_troi: HOUSE, nong_tong: HOUSE, be_nuoc: HOUSE, tang_ap: HOUSE, co_binh: {q: 'tinh_trang', in: ['co_ban', 'dang_o']}}, ...OTHER}),
      Q('dieu_hoa', 'one', 'Điều hoà', 'Điều hoà dự kiến?', 'treo:Treo tường;am_tran:Âm trần nối ống gió / cassette;trung_tam:Điều hoà trung tâm (VRV);giu_hien_trang:Giữ hệ thống hiện có;chua_biet:Chưa biết, cần tư vấn',
        {optIf: {trung_tam: HOUSE}}),
      Q('kt_dan_nong', 'one', 'Dàn nóng', 'Dàn nóng điều hoà đặt ở đâu?', 'mai:Đưa lên mái;ban_cong:Ban công / logia;bql:Vị trí toà nhà quy định;chua_biet:Chưa rõ, cần tư vấn',
        {optIf: {mai: HOUSE, bql: FLAT}, showIf: {q: 'dieu_hoa', notIn: ['giu_hien_trang']}}),
      Q('kt_tran', 'many', 'Trần', 'Trần nhà mong muốn?', 'phang:Trần thạch cao phẳng;giat_cap:Trần giật cấp, có hắt sáng;lo_be_tong:Để lộ trần bê tông;quat_tran:Quạt trần;quat_dh:Quạt điều hoà đa năng;thoat_mui:Ống thoát mùi bếp đi trong trần', OTHER),
      Q('kt_den', 'many', 'Kiểu đèn', 'Kiểu đèn chiếu sáng?', 'downlight:Đèn âm trần (downlight);spot:Đèn rọi (spotlight) điểm nhấn;ray:Đèn ray nam châm;led_hat:LED hắt trần / tủ;tha:Đèn thả, đèn trang trí;chua_biet:Chưa biết, cần tư vấn'),
    ]},
    // ---------------------------------------------------------------- TỪNG KHÔNG GIAN
    {id: 'khach', title: 'Sảnh & phòng khách', intro: 'Lối vào, không gian tiếp khách và sinh hoạt chung.', showIf: RESIDENTIAL, questions: [
      Q('sanh', 'many', 'Sảnh / lối vào', 'Khu lối vào cần gì?', 'tu_giay:Tủ giày (cánh thoáng, tránh mùi);ghe:Ghế ngồi đi giày (kéo ra từ tủ);guong:Gương soi toàn thân;moc:Móc treo áo, túi;khong:Không cần gì thêm', OTHER),
      Q('pk_sofa', 'one', 'Kiểu sofa', 'Bộ ghế phòng khách mong muốn?', 'goc_l:Sofa góc chữ L;van:Sofa văng + ghế đơn;thap:Sofa thấp / ngồi bệt;ghe_go:Bộ bàn ghế gỗ;chua_biet:Chưa biết, cần tư vấn',
        {sub: {goc_l: 'da:Da;ni:Nỉ / vải|cung:Đệm cứng;mem:Đệm mềm', van: 'da:Da;ni:Nỉ / vải|cung:Đệm cứng;mem:Đệm mềm', thap: 'da:Da;ni:Nỉ / vải'}}),
      Q('pk_tv', 'many', 'TV / giải trí', 'Giải trí trong phòng khách?', 'tv_treo:TV treo tường;tv_frame:TV khung tranh (Frame);tv_ke:TV đặt trên kệ;tv_di_dong:TV di động (chân bánh xe);khong_tv:Không dùng TV;may_chieu:Máy chiếu;game:Máy chơi game (PlayStation…);am_thanh:Dàn âm thanh / loa',
        {one: [['tv_treo', 'tv_frame', 'tv_ke', 'tv_di_dong', 'khong_tv']], heads: [['Loại TV (chọn 1)', ['tv_treo', 'tv_frame', 'tv_ke', 'tv_di_dong', 'khong_tv']], ['Thiết bị kèm', ['may_chieu', 'game', 'am_thanh']]]}),
      Q('pk_chuc_nang', 'many', 'Chức năng thêm', 'Phòng khách cần thêm gì?', 'ke_sach:Kệ sách;trung_bay:Tủ trưng bày / sưu tầm;ruou:Tủ / quầy rượu;doc_sach:Góc đọc sách;piano:Piano / nhạc cụ;goc_tre:Góc chơi cho trẻ', OTHER),
      NOTE('pk_ghi_chu', 'phòng khách')
    ]},
    {id: 'bep', title: 'Bếp & phòng ăn', intro: 'Thói quen nấu nướng quyết định cách bố trí bếp.', showIf: RESIDENTIAL, questions: [
      Q('bep_nau', 'one', 'Mức độ nấu ăn', 'Nhà mình nấu ăn nhiều không?', 'nhieu:Nấu hàng ngày, nhiều món (chiên xào nhiều);vua:Nấu vài bữa trong tuần;it:Ít khi nấu, chủ yếu hâm nóng / ăn ngoài'),
      Q('bep_nguoi_nau', 'one', 'Chiều cao người nấu', 'Người nấu chính cao khoảng bao nhiêu? (để chọn chiều cao mặt bếp)', 'duoi_155:Dưới 1m55;155_165:1m55 - 1m65;tren_165:Trên 1m65',
        {hint: {duoi_155: 'Mặt bếp ~810 - 830 mm', '155_165': 'Mặt bếp ~830 - 860 mm', tren_165: 'Mặt bếp ~860 - 890 mm'}}),
      Q('bep_kieu', 'one', 'Kiểu tủ bếp', 'Dáng tủ bếp mong muốn?', 'chu_i:Chữ I (thẳng);chu_l:Chữ L;chu_u:Chữ U;song_song:Song song 2 dãy;chua_biet:Chưa biết, cần tư vấn'),
      Q('bep_kin', 'one', 'Bếp mở / kín', 'Bếp nên mở hay kín?', 'mo:Bếp mở liền phòng khách;kin:Bếp kín, tách mùi bằng cửa kính;bep_doi:Bếp đôi (bếp nấu nặng + bếp trưng bày)'),
      Q('bep_dao', 'one', 'Đảo bếp / quầy bar', 'Có muốn đảo bếp hoặc quầy bar không?', 'dao:Có đảo bếp;bar:Quầy bar nhỏ;khong:Không cần'),
      Q('bep_thiet_bi', 'many', 'Thiết bị bếp', 'Thiết bị bếp dự kiến?', 'tu:Bếp từ;gas:Bếp gas;hut_mui:Máy hút mùi;lo_nuong:Lò nướng;lo_vi_song:Lò vi sóng;rua_bat:Máy rửa bát;tu_lanh_lon:Tủ lạnh lớn (side-by-side);loc_nuoc:Máy lọc nước;tu_ruou:Tủ bảo quản rượu / thực phẩm;may_xay:Máy xay, ép, nồi chiên đặt cố định',
        {sub: {lo_nuong: AM_TU, lo_vi_song: AM_TU, loc_nuoc: AM_TU, rua_bat: 'am_tu:Âm tủ|dat_cao:Đặt cao, đỡ cúi', tu_lanh_lon: 'am_tu:Âm tủ;am_tuong:Âm tường'}, hint: {rua_bat: 'Mặt bếp 860 - 890 mm'}, ...OTHER}),
      Q('bep_luu_tru', 'many', 'Lưu trữ bếp', 'Cần chỗ cất đồ bếp nào?', 'do_kho:Tủ đồ khô, kho thực phẩm;gia_vi:Kệ gia vị gần bếp;noi_chao:Ngăn kéo nồi chảo;bat_dia:Tủ chén bát lớn;thung_rac:Thùng rác phân loại âm tủ', OTHER),
      Q('ban_an', 'one', 'Bàn ăn', 'Bàn ăn dùng cho bao nhiêu người?', 'bon:4 người;sau:6 người;tam:8 người trở lên;mo_rong:Bàn kéo dài được;chi_bar:Chỉ ăn ở quầy bar / đảo bếp'),
      NOTE('bep_ghi_chu', 'bếp')
    ]},
    {id: 'ngu', title: 'Phòng ngủ', intro: 'Không gian nghỉ ngơi cho từng thành viên.', showIf: RESIDENTIAL, questions: [
      Q('pn_so', 'one', 'Số phòng ngủ', 'Cần bao nhiêu phòng ngủ?', '1:1 phòng;2:2 phòng;3:3 phòng;4:4 phòng;5:5 phòng trở lên'),
      Q('pn_phong', 'rooms', 'Từng phòng ngủ', 'Từng phòng dành cho ai, cần gì?', '', {showIf: {q: 'pn_so', notIn: []}}),
      Q('pn_rem_sang', 'one', 'Ánh sáng phòng ngủ', 'Ánh sáng và độ ồn phòng ngủ?', 'toi:Cần tối, cản sáng hoàn toàn;tu_nhien:Thích nhiều ánh sáng tự nhiên;chong_on:Cần cách âm (đường ồn, hàng xóm)'),
      NOTE('pn_ghi_chu', 'các phòng ngủ')
    ]},
    {id: 'wc', title: 'Nhà vệ sinh', intro: 'Chi tiết khu vệ sinh và tắm giặt.', showIf: RESIDENTIAL, questions: [
      Q('wc_so', 'one', 'Số WC', 'Cần bao nhiêu nhà vệ sinh?', '1:1;2:2;3:3;4:4 trở lên'),
      Q('wc_doi', 'one', 'Dời vị trí WC', 'Có dời / thêm WC so với hiện trạng không? (phải tính lại đường ống)', 'khong:Giữ nguyên vị trí;co:Có dời / thêm WC mới;chua_biet:Chưa biết, cần tư vấn'),
      Q('wc_thiet_bi', 'many', 'Thiết bị WC', 'Thiết bị mong muốn?', 'vach_kinh:Vách kính tắm đứng;bon_tam:Bồn tắm nằm;bon_cau:Bồn cầu thường;bon_cau_tt:Bồn cầu thông minh;sen_cay:Sen cây;lavabo:Lavabo đơn;lavabo_doi:Lavabo đôi;tu_guong:Tủ gương;' +
        'quat_4in1:Quạt điều hoà 4 trong 1 (sưởi, hút, thổi, đèn);den_suoi:Đèn sưởi;xong_hoi:Xông hơi;tieu_nam:Tiểu nam;ban_dung:Bàn vệ sinh',
        {one: [['quat_4in1', 'den_suoi']], optIf: {tieu_nam: HOUSE}, sub: {bon_tam: 'xay:Bồn xây;doc_lap:Bồn độc lập', bon_cau: 'bet:Đặt sàn;treo:Treo tường', bon_cau_tt: 'bet:Đặt sàn;treo:Treo tường',
          sen_cay: 'am_tran:Âm trần;treo_tuong:Treo tường', lavabo: 'treo:Treo tường;dat_san:Đặt sàn / tủ', lavabo_doi: 'treo:Treo tường;dat_san:Đặt sàn / tủ'}, ...OTHER}),
      Q('wc_an_toan', 'one', 'An toàn', 'WC cần lưu ý an toàn (người già, trẻ nhỏ)?', 'co:Có (sàn chống trơn, tay vịn, tránh bậc);khong:Không đặc biệt', {showIf: [RESIDENTIAL, {q: 'thanh_vien', in: ['ong_ba', 'tre_nho']}]})
    ]},
    {id: 'lam_viec', title: 'Làm việc & học tập', intro: 'Góc làm việc, học bài tại nhà.', showIf: RESIDENTIAL, questions: [
      Q('lv_ai', 'many', 'Người cần chỗ làm việc', 'Ai cần chỗ làm việc, học tập tại nhà?', 'chu_nha:Chủ nhà;vo_chong:Cả hai vợ chồng;con:Con học bài;khong:Không ai cần', OTHER),
      Q('lv_kieu', 'one', 'Kiểu góc làm việc', 'Chỗ làm việc mong muốn?', 'phong_rieng:Phòng làm việc riêng;goc:Góc nhỏ trong phòng ngủ / khách;ban_doi:Bàn dài dùng chung;chua_biet:Chưa biết, cần tư vấn', {showIf: {q: 'lv_ai', notIn: ['khong']}}),
      Q('lv_thiet_bi', 'many', 'Thiết bị làm việc', 'Thiết bị làm việc?', 'laptop:Laptop;hai_man:2 màn hình trở lên;pc:Máy tính để bàn cấu hình cao;in:Máy in;quay:Quay phim / livestream;sach:Nhiều sách, tài liệu', {showIf: {q: 'lv_ai', notIn: ['khong']}, ...OTHER}),
      Q('lv_ghe', 'many', 'Ghế làm việc', 'Ghế làm việc?', 'chong_gu:Ghế chống gù (cho con);cong_thai_hoc:Ghế công thái học;thuong:Ghế thường;chua_biet:Chưa biết, cần tư vấn', {showIf: {q: 'lv_ai', notIn: ['khong']}})
    ]},
    {id: 'tho', title: 'Thờ cúng', intro: 'Không gian tâm linh của gia đình.', note: 'Nên nhờ thầy xem hướng và vị trí đặt bàn thờ trước khi thiết kế, vì ảnh hưởng nhiều tới bố trí cả nhà.', showIf: RESIDENTIAL, questions: [
      Q('tho_co', 'one', 'Bàn thờ', 'Nhà có cần bàn thờ không?', 'phong_rieng:Phòng thờ riêng;tu_tho:Bàn thờ đặt sàn, dưới làm tủ thờ;treo:Bàn thờ treo tường;khong:Không cần',
        {sub: {treo: 'huong:Có chỗ để hương|chan_khoi:Có tấm chắn khói'}}),
      Q('tho_loai', 'many', 'Thờ gì', 'Thờ những gì?', 'gia_tien:Gia tiên;phat:Phật;than_tai:Thần tài - Thổ địa;khac:Khác', {showIf: {q: 'tho_co', notIn: ['khong']}, ...OTHER}),
      Q('tho_vi_tri', 'one', 'Vị trí', 'Vị trí đặt bàn thờ trong căn hộ?', 'phong_khach:Phòng khách;canh_bep:Gần bếp / hành lang;chua_biet:Chưa biết, cần tư vấn', {showIf: [FLAT, {q: 'tho_co', notIn: ['khong', 'phong_rieng']}]}),
      Q('tho_ghi_chu', 'text', 'Ghi chú thờ cúng', 'Ghi chú thêm về thờ cúng (hướng thầy đã xem, kích thước bàn thờ cũ, đồ thờ cần giữ…)?', '', {showIf: {q: 'tho_co', notIn: ['khong']}})
    ]},
    {id: 'luu_tru', title: 'Lưu trữ & đồ đạc', intro: 'Càng đủ thông tin, tủ thiết kế càng vừa với đồ của mình.', showIf: RESIDENTIAL, questions: [
      Q('lt_quan_ao', 'one', 'Lượng quần áo', 'Lượng quần áo, túi xách, phụ kiện?', 'it:Vừa phải, tủ âm là đủ;nhieu:Nhiều, cần tủ lớn;rat_nhieu:Rất nhiều, nên có phòng thay đồ', {sub: {nhieu: 'vay_dai:Nhiều váy, áo dài', rat_nhieu: 'vay_dai:Nhiều váy, áo dài'}}),
      Q('lt_giay', 'one', 'Lượng giày dép', 'Số lượng giày dép của cả nhà?', 'it:Dưới 10 đôi;vua:10 - 30 đôi;nhieu:Trên 30 đôi / sưu tầm'),
      Q('lt_khac', 'many', 'Đồ cồng kềnh', 'Đồ cồng kềnh cần chỗ cất?', 'vali:Vali, đồ du lịch;xe_dap:Xe đạp, đồ thể thao;golf:Gậy golf;gym:Thiết bị gym tại nhà;tet:Đồ Tết, đồ cúng;tre_em:Đồ trẻ em (xe đẩy, đồ chơi);dung_cu:Dụng cụ sửa chữa;hut_bui:Máy hút bụi, robot, thang;thuc_pham:Kho thực phẩm khô, nước uống', OTHER),
      Q('lt_kho', 'one', 'Kho', 'Có cần phòng / ngăn kho riêng?', 'phong:Có, phòng kho riêng;gam:Tận dụng gầm cầu thang / hộc;khong:Không cần', {optIf: {gam: HOUSE}})
    ]},
    {id: 'thong_minh', title: 'Thiết bị thông minh', intro: 'Chọn mức nhà thông minh phù hợp ngân sách.', showIf: RESIDENTIAL, questions: [
      Q('tb_muc', 'one', 'Nhà thông minh', 'Mức độ nhà thông minh mong muốn?', 'khong:Không cần;co_ban:Cơ bản (đèn, rèm, ổ cắm);nhieu:Nhiều, điều khiển toàn nhà;chua_biet:Chưa biết, cần tư vấn'),
      Q('tb_loai', 'many', 'Thiết bị muốn có', 'Muốn điều khiển những gì?', 'den:Đèn theo cảnh;rem:Rèm điện;khoa:Khoá vân tay / thẻ;camera:Camera an ninh;dieu_hoa:Điều hoà thông minh;am_thanh:Loa âm thanh đa vùng;cam_bien:Cảm biến (khói, rò nước, chuyển động);robot:Robot hút bụi, lau nhà', {sub: {robot: 'nuoc:Chờ cấp + thoát nước'}, showIf: {q: 'tb_muc', in: ['co_ban', 'nhieu', 'chua_biet']}, ...OTHER})
    ]},
    {id: 'ket', title: 'Ghi chú thêm', intro: 'Gần xong rồi!', questions: [
      Q('cuoi_ghi_chu', 'text', 'Sở thích, mong muốn', 'Mình THÍCH gì, mong muốn điều gì ở ngôi nhà mới?', ''),
      Q('ps_khong_thich', 'text', 'Điều không thích', 'Điều gì mình chắc chắn KHÔNG thích?', '')
    ]}
  ];

  GROUPS.forEach(group => group.questions.forEach(q => { q.group = group.id; }));
  const QUESTIONS = GROUPS.flatMap(group => group.questions);
  const QUESTION_BY_ID = Object.fromEntries(QUESTIONS.map(q => [q.id, q]));

  const asList = value => Array.isArray(value) ? value.map(String) : value == null || value === '' ? [] : [String(value)];
  function conditionOk(cond, answers, visible) {
    if (!cond) return true;
    if (Array.isArray(cond)) return cond.every(c => conditionOk(c, answers, visible));
    if (!visible.has(cond.q)) return false;
    const given = asList(answers[cond.q]);
    if (cond.in) return given.some(v => cond.in.includes(v));
    return given.length > 0 && !given.some(v => (cond.notIn || []).includes(v));
  }

  // Các nhóm kèm câu đang hiện theo câu trả lời hiện tại (nhóm không còn câu nào thì bỏ).
  function visibleGroups(answers) {
    answers = answers || {};
    const visible = new Set();
    const out = [];
    for (const group of GROUPS) {
      // Nhóm ẩn thì mọi câu của nhóm ẩn; điều kiện trong nhóm xét theo các câu đã hiện trước đó.
      const groupOk = conditionOk(group.showIf, answers, visible);
      const questions = [];
      for (const q of group.questions) {
        if (!groupOk || !conditionOk(q.showIf, answers, visible)) continue;
        const options = q.optIf ? q.options.filter(o => conditionOk(q.optIf[o.v], answers, visible)) : q.options;
        visible.add(q.id);
        questions.push(options === q.options ? q : {...q, options});
      }
      if (questions.length) out.push({...group, questions});
    }
    return out;
  }
  const visibleQuestions = answers => visibleGroups(answers).flatMap(group => group.questions);

  // Làm sạch câu trả lời từ khách: chỉ id câu có thật, giá trị nằm trong danh sách đáp án, giới hạn độ dài.
  function cleanAnswers(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    for (const q of QUESTIONS) {
      const value = raw[q.id];
      if (q.type === 'number') { const n = Number(value); if (value !== '' && value != null && Number.isFinite(n) && n > 0 && n <= 100000) out[q.id] = Math.round(n * 10) / 10; continue; }
      if (q.type === 'date') { if (typeof value === 'string' && dateText(value)) out[q.id] = value; continue; }
      if (q.type === 'rooms') {
        const pick = (v, list) => list.some(o => o.v === v) ? v : '';
        const rooms = Array.isArray(value) ? value.slice(0, 5).map(r => {
          const who = pick(r?.who, ROOM.who), ok = new Set(who ? roomItems(who).map(o => o.v) : []);
          return {who, items: [...new Set(Array.isArray(r?.items) ? r.items.filter(v => ok.has(v)) : [])], bed: pick(r?.bed, ROOM.beds), mat: pick(r?.mat, ROOM.mats),
            pc: pickList(r?.pc, STYLES()), mau: pickList(r?.mau, COLORS()), note: typeof r?.note === 'string' ? r.note.replace(/\s+/g, ' ').trim().slice(0, OTHER_MAX) : ''};
        }) : [];
        if (rooms.some(r => r.who || r.items.length || r.bed || r.mat || r.pc.length || r.mau.length || r.note)) out[q.id] = rooms;
        continue;
      }
      if (q.type === 'note') {
        for (const [k, list] of [['pc', STYLES()], ['mau', COLORS()]]) { const picked = pickList(raw[q.id + '.' + k], list); if (picked.length) out[q.id + '.' + k] = picked; }
      }
      if (q.type === 'text' || q.type === 'note') {
        const text = typeof value === 'string' ? value.replace(/\r/g, '').trim().slice(0, TEXT_MAX) : '';
        if (text) out[q.id] = text;
        continue;
      }
      const allowed = new Set(q.options.map(o => o.v));
      if (q.type === 'one') {
        if (typeof value === 'string' && allowed.has(value)) out[q.id] = value;
      } else if (Array.isArray(value) || typeof value === 'string') {   // chuỗi: câu cũ 'one' nay thành 'many'
        let list = [...new Set([].concat(value).filter(v => typeof v === 'string' && allowed.has(v)))];
        if (list.some(v => !EXCLUSIVE.includes(v))) list = list.filter(v => !EXCLUSIVE.includes(v));   // "Không" lẫn với lựa chọn khác: bỏ "Không"
        for (const group of q.one || []) list = list.filter(v => !group.includes(v) || v === list.find(x => group.includes(x)));
        if (q.max) list = list.slice(0, q.max);
        if (list.length) out[q.id] = list;
      }
      // Tích nhỏ trong ô (Âm tủ…): chỉ giữ khi ô chính đang chọn
      for (const [v, subs] of Object.entries(q.sub || {})) {
        const group = new Map(subs.map(s => [s.v, s.g])), seen = new Set();   // mỗi nhóm loại trừ giữ 1
        const picked = Array.isArray(raw[q.id + '.' + v]) ? raw[q.id + '.' + v].filter(s => group.has(s) && !seen.has(group.get(s)) && seen.add(group.get(s))) : [];
        if (picked.length && asList(out[q.id]).includes(v)) out[q.id + '.' + v] = [...new Set(picked)];
      }
      const other = q.other && typeof raw[q.id + '.khac'] === 'string' ? raw[q.id + '.khac'].replace(/\s+/g, ' ').trim().slice(0, OTHER_MAX) : '';
      if (other) out[q.id + '.khac'] = other;
      const note = q.note && typeof raw[q.id + '.ghi_chu'] === 'string' ? raw[q.id + '.ghi_chu'].replace(/\s+/g, ' ').trim().slice(0, OTHER_MAX) : '';
      if (note) out[q.id + '.ghi_chu'] = note;
      if (q.color && /^#[0-9a-f]{6}$/i.test(raw[q.id + '.mau_khac'])) out[q.id + '.mau_khac'] = raw[q.id + '.mau_khac'].toLowerCase();
    }
    return out;
  }

  function answerText(q, answers) {
    const labels = new Map(q.options.map(o => [o.v, o.l]));
    const withSub = v => {
      const subs = asList(answers[q.id + '.' + v]).map(s => (q.sub?.[v] || []).find(x => x.v === s)?.l).filter(Boolean);
      return labels.get(v) && labels.get(v) + (subs.length ? ' (' + subs.join(', ') + ')' : '');
    };
    if (q.type === 'date') return dateText(answers[q.id]);
    if (q.type === 'number') return answers[q.id] ? answers[q.id] + ' ' + (q.unit || '') : '';
    if (q.type === 'rooms') return (Array.isArray(answers[q.id]) ? answers[q.id] : []).slice(0, roomCount(answers)).map((r, i) => {
      const label = (list, v) => list.find(o => o.v === v)?.l;
      const bits = [...(r.items || []).map(v => label(ROOM.items, v)), r.bed && 'giường ' + label(ROOM.beds, r.bed), label(ROOM.mats, r.mat), lookText(r.pc || [], r.mau || []), clean(r.note)].filter(Boolean);
      return (r.who || bits.length) && 'P' + (i + 1) + ' ' + (label(ROOM.who, r.who) || '?') + (bits.length ? ': ' + bits.join(', ') : '');
    }).filter(Boolean).join(' | ');
    if (q.type === 'note') return [clean(answers[q.id]), lookText(asList(answers[q.id + '.pc']), asList(answers[q.id + '.mau']))].filter(Boolean).join(' · ');
    const parts = q.type === 'text' ? [clean(answers[q.id])] : asList(answers[q.id]).map(withSub).filter(Boolean);
    const other = clean(answers[q.id + '.khac']);
    if (other) parts.push('Khác: ' + other);
    if (answers[q.id + '.mau_khac']) parts.push('Màu khác: ' + clean(answers[q.id + '.mau_khac']));
    if (clean(answers[q.id + '.ghi_chu'])) parts.push('Ghi chú: ' + clean(answers[q.id + '.ghi_chu']));
    return parts.filter(Boolean).join(', ');
  }

  // Bản tóm tắt nhu cầu theo nhóm (chỉ nhóm / câu đang hiện và đã trả lời) để copy; bước đầu cho "tổng hợp thành nhiệm vụ".
  function summarize(answers, projectName) {
    answers = answers || {};
    const blocks = [];
    for (const group of visibleGroups(answers)) {
      const lines = group.questions.map(q => [q, answerText(q, answers)]).filter(([, text]) => text)
        .map(([q, text]) => '- ' + q.short + ': ' + text);
      if (lines.length) blocks.push(group.title.toUpperCase() + '\n' + lines.join('\n'));
    }
    if (!blocks.length) return '';
    return ('NHU CẦU KHÁCH' + (projectName ? ' - ' + projectName : '') + '\n\n' + blocks.join('\n\n')).trim();
  }

  const api = {GROUPS, QUESTIONS, QUESTION_BY_ID, EXCLUSIVE, ROOM, roomItems, roomCount, lunarText, parseOptions, visibleGroups, visibleQuestions, cleanAnswers, summarize, answerText};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GDHomeSurveyData = api;
})(typeof window !== 'undefined' ? window : globalThis);
