/* Mẫu trả lời khách (Zalo/Messenger) – mẫu gốc + hàm thay biến xưng hô (thuần, có test).
   Biến: {kh} = cách gọi khách (chị/anh/anh chị/em), {toi} = em/anh (khách là "em" thì mình xưng "anh"),
   {ten} = tên người phụ trách, {du_an} = tên dự án (trống -> "nhà mình").
   Mẫu có "items": danh sách ý tick chọn, chèn vào chỗ {items}; style: num (1/ 2/), dash (- ), block (đoạn cách dòng). */
(function (root) {
  const GROUPS = ['Chào & khảo sát', 'Hiện trạng & bản vẽ', 'Thiết bị', 'Màu sắc & phong cách', 'Nhu cầu từng phòng',
    'Layout & 3D', 'Hồ sơ kỹ thuật & thanh toán', 'Chốt mã vật liệu', 'Nhắc & họp online', 'Kết thúc dự án'];

  const T = (id, group, title, body, items, style) => ({id, group, title, body, items: items || [], style: style || 'num'});

  const BASE = [
    T('chao', 'Chào & khảo sát', 'Lời chào nhận dự án',
      '{toi} chào {kh} - {toi} {ten} sẽ phụ trách thiết kế {du_an} ạ'),
    T('hen-khao-sat', 'Chào & khảo sát', 'Hẹn lịch khảo sát hiện trạng',
      '{kh} ơi, để {toi} khảo sát hiện trạng {du_an} cho sát thực tế thì {kh} sắp xếp giúp {toi} thời gian thuận tiện trong tuần này nhé ạ.\n\n' +
      '{kh} cho {toi} xin giờ giấc và người nhận bàn giao nhà (nếu có) để {toi} phối hợp cho đúng hẹn ạ.'),
    T('nhac-coc', 'Chào & khảo sát', 'Nhắc thanh toán đợt 1 (đặt cọc)',
      '{kh} ơi, {toi} gửi {kh} thông tin thanh toán đợt 1 (đặt cọc) theo hợp đồng thiết kế để bên em bắt đầu triển khai {du_an} ạ.\n\n' +
      '{kh} chuyển khoản xong nhắn {toi} một tin để {toi} xác nhận và lên lịch làm việc tiếp theo nhé ạ.'),

    T('xin-ban-ve', 'Hiện trạng & bản vẽ', 'Xin bản vẽ / tài liệu hiện trạng',
      '{kh} cho {toi} xin các tài liệu sau của {du_an} để {toi} bắt đầu lên mặt bằng ạ:\n\n{items}\n\n' +
      '{kh} có file nào thì gửi {toi} qua Zalo/Messenger hoặc email giúp {toi} nhé ạ.',
      ['Bản vẽ mặt bằng kiến trúc / mặt bằng bàn giao của chủ đầu tư (file CAD hoặc PDF)',
        'Bản vẽ điện nước, vị trí cột, hộp kỹ thuật, ống gen (nếu có)',
        'Chiều cao trần, dầm và các vị trí cần lưu ý',
        'Ảnh chụp hiện trạng từng phòng',
        'Video quay một vòng nhà (nếu tiện)']),
    T('xin-so-do', 'Hiện trạng & bản vẽ', 'Xin số đo (nhà cải tạo / chưa có bản vẽ)',
      '{kh} ơi, nhà mình chưa có bản vẽ nên {toi} xin phép đo đạc lại hiện trạng ạ. Trường hợp {kh} tự đo giúp {toi} thì {kh} gửi {toi} các số đo sau nhé:\n\n{items}\n\n' +
      '{kh} chụp ảnh kèm số đo ghi tay là {toi} hiểu ngay ạ.',
      ['Chiều dài - chiều rộng từng phòng (tính thông thủy)',
        'Chiều cao từ sàn đến trần',
        'Kích thước cửa đi, cửa sổ, ô thoáng và độ cao bậu cửa',
        'Vị trí công tắc, ổ điện, điều hòa, điểm cấp thoát nước hiện có']),
    T('xin-anh-video', 'Hiện trạng & bản vẽ', 'Xin ảnh / video hiện trạng bổ sung',
      '{kh} ơi, {toi} cần xem thêm hiện trạng một số vị trí để tính phương án cho chuẩn ạ. {kh} chụp giúp {toi} thêm:\n\n{items}\n\nCảm ơn {kh} nhiều ạ.',
      ['Góc nhìn từ cửa vào của từng phòng', 'Khu vực logia / sân phơi', 'Trần và các vị trí dầm, hộp kỹ thuật', 'Nhà vệ sinh (vị trí thiết bị hiện có)'], 'dash'),

    T('note-thiet-bi', 'Thiết bị', 'Note các thiết bị sẽ sử dụng',
      'A - CÁC THIẾT BỊ SẼ SỬ DỤNG TRONG NHÀ\n\n(dự kiến mua hoặc đã có thì cho {toi} xin mã để triển khai cho đúng công năng và sát thực tế)\n\n' +
      'Trường hợp {kh} chưa chọn thì có thể nhắn {toi} những loại thiết bị dự kiến ạ (Tủ lạnh thường hay Side by side, Lò vi sóng thường hay âm tủ, ...)\n\n' +
      'Các thiết bị thì vẫn nên chọn sớm - để trường hợp sẵn hàng hoặc không - và cũng có thời gian xem đầy đủ tính năng mong muốn - Vì sau này nếu muộn thì hồ sơ cũng bị delay theo ạ\n\n{items}',
      ['Robot hút bụi - máy lọc không khí - TV (các không gian)',
        'Bếp: Tủ lạnh - Máy rửa bát - lò nướng - lò vi sóng - bếp từ - hút mùi - chậu rửa',
        'Logia: Máy giặt - máy sấy']),
    T('nhac-thiet-bi', 'Thiết bị', 'Nhắc chọn thiết bị sớm',
      '{kh} ơi, {toi} nhắc nhẹ phần thiết bị ạ. Các món dưới đây {kh} chưa gửi mã/loại dự kiến cho {toi}:\n\n{items}\n\n' +
      '{kh} chọn sớm giúp {toi} để kịp xem hàng sẵn có và đủ tính năng mong muốn, nếu để muộn thì hồ sơ kỹ thuật cũng bị delay theo ạ.',
      ['Tủ lạnh', 'Máy rửa bát', 'Lò nướng / lò vi sóng', 'Bếp từ / hút mùi / chậu rửa', 'Máy giặt / máy sấy', 'Robot hút bụi / máy lọc không khí / TV'], 'dash'),

    T('mau-phong-cach', 'Màu sắc & phong cách', 'Màu sắc & phong cách thiết kế',
      'B - MÀU SẮC & PHONG CÁCH THIẾT KẾ\n\n{items}',
      ['Màu sắc yêu thích của từng không gian (hoặc có thể chọn màu sắc theo mệnh)',
        'Phong cách {toi} có nhận là Modern Farmhouse nếu {kh} có tham khảo hình ảnh nào {kh} cứ gửi lại giúp {toi} để việc triển khai được sát ý hơn ạ']),
    T('ban-tho', 'Màu sắc & phong cách', 'Hỏi vị trí và hướng bàn thờ',
      'Ngoài ra phần bàn thờ {toi} cũng muốn hỏi thêm là phần đặt và hướng bàn thờ mình có xem thầy chưa ạ'),
    T('note-tong-hop', 'Màu sắc & phong cách', 'Note trao đổi đầu dự án (thiết bị + màu sắc + bàn thờ)',
      'Có mấy note {toi} muốn trao đổi thêm như này {kh} xem giúp {toi} nhé ạ\n\n{items}',
      ['A - CÁC THIẾT BỊ SẼ SỬ DỤNG TRONG NHÀ\n(dự kiến mua hoặc đã có thì cho {toi} xin mã để triển khai cho đúng công năng và sát thực tế)\n' +
        '1/ Robot hút bụi - máy lọc không khí - TV (các không gian)\n2/ Bếp: Tủ lạnh - Máy rửa bát - lò nướng - lò vi sóng - bếp từ - hút mùi - chậu rửa\n3/ Logia: Máy giặt - máy sấy\n' +
        'Các thiết bị nên chọn sớm để hồ sơ không bị delay ạ.',
        'B - MÀU SẮC & PHONG CÁCH THIẾT KẾ\n1/ Màu sắc yêu thích của từng không gian (hoặc chọn màu sắc theo mệnh)\n' +
        '2/ Phong cách {toi} có nhận là Modern Farmhouse, nếu {kh} có hình ảnh tham khảo thì gửi lại giúp {toi} ạ',
        'Ngoài ra phần bàn thờ {toi} cũng muốn hỏi thêm là phần đặt và hướng bàn thờ mình có xem thầy chưa ạ'], 'block'),

    T('nhu-cau-chung', 'Nhu cầu từng phòng', 'Nhu cầu sử dụng chung của gia đình',
      '{kh} cho {toi} xin một số thông tin chung về gia đình mình để {toi} bố trí công năng cho phù hợp ạ:\n\n{items}',
      ['Số người ở thường xuyên (người lớn, trẻ nhỏ, người cao tuổi) và dự kiến sau này có thêm không ạ',
        'Có nuôi thú cưng không ạ',
        'Thói quen sinh hoạt: hay tiếp khách, làm việc tại nhà, xem phim, tập thể dục...',
        'Có ai cần phòng ngủ tầng thấp / hạn chế đi lại nhiều không ạ',
        'Ngân sách dự kiến cho phần nội thất để {toi} tính phương án vật liệu phù hợp ạ']),
    T('nhu-cau-bep', 'Nhu cầu từng phòng', 'Thói quen nấu ăn & khu bếp',
      '{kh} chia sẻ giúp {toi} về thói quen sử dụng bếp để {toi} thiết kế khu bếp cho thuận tay ạ:\n\n{items}',
      ['Nhà mình nấu ăn thường xuyên không, nấu kiểu Việt (xào, rán nhiều) hay nấu đơn giản ạ',
        'Ai là người nấu chính (chiều cao để {toi} tính độ cao mặt bếp) ạ',
        'Có cần đảo bếp / bàn ăn liền bếp không ạ',
        'Số người ăn thường xuyên, có hay mời khách ăn cơm không ạ',
        'Đồ khô, gia vị, nồi chảo, đồ điện nhà mình nhiều không để {toi} chia tủ ạ',
        'Có dự định dùng lò nướng / máy rửa bát / tủ lạnh lớn không ạ']),
    T('nhu-cau-luu-tru', 'Nhu cầu từng phòng', 'Nhu cầu lưu trữ (giày, quần áo, sách, đồ thờ...)',
      '{kh} ước lượng giúp {toi} số lượng đồ cần cất để {toi} chia tủ cho đủ dùng ạ:\n\n{items}',
      ['Giày dép: khoảng bao nhiêu đôi (có giày cao gót, bốt, giày thể thao...)',
        'Quần áo: nhiều đồ treo (áo dài, vest, váy) hay đồ gấp ạ, có đồ theo mùa cần cất riêng không ạ',
        'Sách, tài liệu, đồ sưu tầm cần trưng bày hoặc cất ạ',
        'Đồ thờ cúng, đồ lễ cần cất riêng ạ',
        'Vali, đồ cồng kềnh, đồ trẻ em (xe đẩy, đồ chơi) ạ',
        'Đồ dùng sinh hoạt: máy hút bụi, đồ vệ sinh, đồ dự trữ (gạo, nước, giấy...) ạ'], 'dash'),

    T('gui-layout', 'Layout & 3D', 'Gửi phương án layout mặt bằng',
      '{kh} ơi {toi} gửi {kh} phương án layout mặt bằng công năng của {du_an} ạ.\n\n' +
      '{kh} xem giúp {toi} phần bố trí các phòng, lối đi và vị trí đặt đồ có hợp với nhu cầu sử dụng chưa, có điểm nào cần điều chỉnh thì {kh} nhắn note giúp {toi} nhé ạ.\n\n' +
      'Khi {kh} thống nhất layout, {toi} sẽ triển khai phối cảnh 3D lần 1 ạ.'),
    T('gui-3d', 'Layout & 3D', 'Gửi phương án 3D lần 1',
      '{kh} ơi {toi} gửi phương án thiết kế 3D {kh} nhé\n' +
      '{kh} xem giúp {toi} nếu có điểm nào cần hợp lý hơn về hình thức và nhu cầu sử dụng {kh} cứ nhắn note giúp {toi} (tiện thì {kh} tổng hợp theo từng không gian cũng đỡ bị sót ý và tiện theo dõi hơn)\n' +
      '{toi} sẽ phản hồi hoặc sắp xếp họp online trao đổi cho tiện nhé ạ'),
    T('gui-3d-chinh', 'Layout & 3D', 'Gửi 3D sau chỉnh sửa',
      '{kh} ơi {toi} đã chỉnh sửa phương án 3D theo các góp ý của {kh} và gửi lại {kh} xem giúp {toi} ạ.\n\n' +
      '{kh} xem các phần đã chỉnh:\n{items}\n\n' +
      'Nếu còn điểm nào cần điều chỉnh {kh} nhắn note theo từng không gian giúp {toi} nhé. Lưu ý các chỉnh sửa lớn sau khi chốt 3D có thể ảnh hưởng tiến độ hồ sơ ạ.',
      ['Phòng khách - bếp', 'Phòng ngủ master', 'Các phòng ngủ khác', 'Khu vệ sinh', 'Logia / khu phụ'], 'dash'),
    T('chot-3d', 'Layout & 3D', 'Chốt 3D & nhắc thanh toán đợt 2',
      '{kh} ơi, nếu {kh} đã ưng ý phương án 3D thì {kh} xác nhận chốt 3D giúp {toi} để {toi} chuyển sang triển khai hồ sơ kỹ thuật ạ.\n\n' +
      'Theo hợp đồng, sau khi {kh} nhận file 3D cuối cùng thì mình thanh toán đợt 2 ạ. {toi} gửi {kh} thông tin thanh toán ở bên dưới nhé.\n\n' +
      'Cảm ơn {kh} nhiều ạ.'),

    T('gui-hskt', 'Hồ sơ kỹ thuật & thanh toán', 'Gửi hồ sơ kỹ thuật (HSKT) & thanh toán đợt 3',
      '{kh} ơi, {toi} gửi {kh} bộ hồ sơ kỹ thuật thi công {du_an} ạ. Bộ hồ sơ gồm:\n\n{items}\n\n' +
      '{kh} xem và kiểm tra giúp {toi}, có điểm nào cần làm rõ thì {kh} nhắn {toi} nhé ạ.\n\n' +
      'Theo hợp đồng, sau khi bàn giao toàn bộ hồ sơ kỹ thuật thì mình thanh toán đợt 3 (còn lại) ạ. {toi} gửi {kh} thông tin thanh toán ở bên dưới nhé.',
      ['Bản vẽ mặt bằng bố trí nội thất', 'Bản vẽ điện - chiếu sáng - nước', 'Bản vẽ trần và đèn', 'Bản vẽ chi tiết từng phòng (tủ, giường, bếp...)', 'Bản vẽ ốp lát và vật liệu hoàn thiện'], 'dash'),

    T('gui-chot-ma', 'Chốt mã vật liệu', 'Gửi bảng chốt mã vật liệu',
      '{kh} ơi, {toi} gửi {kh} bảng chốt mã vật liệu của {du_an} ạ. {kh} xem giúp {toi} các hạng mục sau:\n\n{items}\n\n' +
      '{kh} chọn xong và xác nhận giúp {toi} để bên em đặt hàng kịp tiến độ thi công nhé ạ.',
      ['Gạch ốp lát', 'Sàn gỗ / ván gỗ công nghiệp', 'Sơn tường - trần', 'Thiết bị vệ sinh', 'Đèn và thiết bị điện', 'Phụ kiện tủ bếp và tủ áo'], 'dash'),
    T('nhac-chot-ma', 'Chốt mã vật liệu', 'Nhắc chốt mã vật liệu',
      '{kh} ơi, {toi} nhắc nhẹ {kh} bảng chốt mã vật liệu {du_an} còn một số hạng mục chưa xác nhận ạ.\n\n' +
      'Vật liệu cần đặt trước một thời gian nên {kh} chốt sớm giúp {toi} để không ảnh hưởng tiến độ thi công. Nếu {kh} cần tham khảo thêm mẫu thì {kh} nhắn {toi} để {toi} gửi thêm lựa chọn nhé ạ.'),

    T('nhac-phan-hoi', 'Nhắc & họp online', 'Nhắc khách phản hồi (lịch sự)',
      '{kh} ơi, {toi} xin phép nhắc nhẹ {kh} về các nội dung {toi} đã gửi trước đó ạ:\n\n{items}\n\n' +
      '{kh} dành chút thời gian xem và phản hồi giúp {toi} nhé, để {toi} kịp chỉnh sửa và giữ đúng tiến độ chung của {du_an} ạ. Nếu {kh} đang bận thì cứ báo {toi} thời điểm {kh} xem được để {toi} sắp xếp ạ.',
      ['Phương án layout mặt bằng', 'Phương án 3D', 'Hồ sơ kỹ thuật', 'Bảng chốt mã vật liệu'], 'dash'),
    T('hen-hop', 'Nhắc & họp online', 'Hẹn họp online trao đổi',
      '{kh} ơi, để trao đổi nhanh và đỡ sót ý, {toi} xin phép hẹn {kh} một buổi họp online khoảng 30 phút ạ.\n\n' +
      '{kh} chọn giúp {toi} khung giờ thuận tiện nhé (sáng / chiều / tối), {toi} sẽ gửi link họp trước giờ hẹn ạ.'),

    T('cam-on', 'Kết thúc dự án', 'Cảm ơn khách',
      '{toi} cảm ơn {kh} đã tin tưởng giao {du_an} cho {toi} và GD HOME ạ. Trong quá trình thi công nếu có điểm nào cần giải đáp về bản vẽ {kh} cứ nhắn {toi} bất cứ lúc nào nhé ạ.'),
    T('xin-review', 'Kết thúc dự án', 'Xin đánh giá / giới thiệu',
      '{kh} ơi, nếu {kh} hài lòng với quá trình làm việc, {kh} cho {toi} xin vài dòng đánh giá và vài tấm ảnh thực tế sau khi hoàn thiện {du_an} để {toi} học hỏi thêm ạ.\n\n' +
      'Nếu người quen của {kh} cần thiết kế, {kh} giới thiệu giúp {toi} nhé. {toi} cảm ơn {kh} nhiều ạ.')
  ];

  const clean = value => typeof value === 'string' ? value.trim() : '';

  function varsOf(opts) {
    const kh = clean(opts && opts.kh) || 'chị';
    return {kh, toi: clean(opts && opts.toi) || (kh.toLowerCase() === 'em' ? 'anh' : 'em'),
      ten: clean(opts && opts.ten) || 'Đức', du_an: clean(opts && opts.du_an) || 'nhà mình'};
  }

  // Khách là "em" thì bỏ giọng quá trang trọng: "nhé ạ" -> "nhé", "…không ạ?" -> "…không em?", "ạ" cuối câu/ý -> "nhé". Anh/chị/cô/chú giữ nguyên.
  function softenEnding(text, kh) {
    const s = String(text == null ? '' : text);
    if (clean(kh).toLowerCase() !== 'em') return s;
    return s.replace(/\snhé\s+ạ(?![\p{L}])/gu, ' nhé').replace(/\sạ(?=\?)/g, ' em').replace(/\sạ(?![\p{L}])/gu, ' nhé');
  }

  // Bỏ dấu + hạ chữ thường để tìm không phân biệt dấu ("nha pho" khớp "nhà phố").
  const fold = text => String(text == null ? '' : text).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd').toLowerCase();

  // Thay biến; {kh}/{toi} đứng đầu văn bản, đầu dòng hoặc sau dấu chấm câu thì viết hoa chữ đầu ("Chị ơi", "Anh chị ơi").
  function applyVars(text, opts) {
    const v = varsOf(opts);
    return softenEnding(String(text == null ? '' : text).replace(/\{(kh|toi|ten|du_an)\}/g, (all, key, offset, whole) => {
      const value = v[key];
      if (key !== 'kh' && key !== 'toi') return value;
      const before = whole.slice(0, offset);
      return !before.trim() || /\n\s*$/.test(before) || /[.!?…]\s+$/.test(before) ? value.charAt(0).toUpperCase() + value.slice(1) : value;
    }), v.kh);
  }

  // Ghép tin nhắn: items bỏ các ý trong tập `off` (chỉ số chưa tick), đánh số lại, rồi thay biến.
  function buildMessage(template, opts, off) {
    let body = String(template.body || '');
    const items = (Array.isArray(template.items) ? template.items : []).filter((_, i) => !(off && off.has(i)));
    if (Array.isArray(template.items) && template.items.length) {
      let n = 0;
      const lines = items.map(text => template.style === 'block' ? text : (template.style === 'dash' ? '- ' : ++n + '/ ') + text);
      const list = lines.join(template.style === 'block' ? '\n\n' : '\n');
      body = body.includes('{items}') ? body.replace('{items}', () => list) : body + '\n\n' + list;
    }
    return applyVars(body, opts).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  // Mẫu gốc + phần anh sửa (saved.items ghi đè theo id, id mới thì bổ sung) - bỏ các id gốc đã xoá.
  function mergeTemplates(base, saved) {
    const items = (saved && Array.isArray(saved.items)) ? saved.items : [];
    const deleted = new Set((saved && Array.isArray(saved.deleted)) ? saved.deleted : []);
    const over = new Map(items.map(t => [t.id, t]));
    const baseIds = new Set(base.map(t => t.id));
    const merged = base.filter(t => !deleted.has(t.id)).map(t => over.has(t.id) ? {...over.get(t.id), _base: true, _edited: true} : {...t, _base: true});
    return merged.concat(items.filter(t => !baseIds.has(t.id)).map(t => ({...t})));
  }

  const api = {GROUPS, BASE, applyVars, buildMessage, mergeTemplates, varsOf, softenEnding, fold};
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GDHomeReplyData = api;
})(typeof window !== 'undefined' ? window : globalThis);
