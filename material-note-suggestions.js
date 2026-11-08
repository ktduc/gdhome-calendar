// Sửa các mục bên dưới để bổ sung gợi ý theo nhóm vật liệu.
const materialNoteCommon = [
  "Cần duyệt mẫu thật trước khi đặt", "Đặt hàng trước 10 ngày", "Theo chỉ định thiết kế",
  "Đối chiếu bản vẽ và kích thước hiện trạng", "Xác nhận phương án thay thế nếu hết mã", "Kiểm tra hàng khi giao đến công trình",
  "Chốt thời điểm giao với đội thi công", "Ghi mã lô lên mẫu lưu", "Yêu cầu nhà cung cấp gửi thông số mẫu",
  "Xác nhận vật tư dự phòng trước khi đặt"
];
const materialSpecCommon = [
  "Hoàn thiện mờ", "Hoàn thiện bóng nhẹ", "Hoàn thiện nhám",
  "Màu trắng ngà", "Màu xám trung tính", "Màu đen mờ",
  "Bề mặt vân gỗ", "Bề mặt vân đá", "Kích thước theo bản vẽ shopdrawing",
  "Mép bo R3", "Cạnh thẳng mài nhẵn", "Lắp âm bề mặt",
  "Lắp nổi theo mẫu duyệt", "Phụ kiện đồng màu", "Vật liệu theo mẫu thực tế"
];
const materialSuggestionLibrary = [
  {
    name:"Sàn gỗ", match:/\bsan go\b|xong ca|san laminate|san engineered/,
    spec:[
      "Sàn gỗ công nghiệp 8 mm AC4", "Sàn gỗ công nghiệp 12 mm AC5", "Sàn gỗ xương cá 12 mm",
      "Sàn gỗ kỹ thuật sồi 15 mm", "Sàn gỗ tự nhiên sồi 18 mm", "Sàn gỗ óc chó kỹ thuật 15 mm",
      "Sàn veneer sồi phủ dầu", "Sàn vân gỗ mờ bản rộng", "Xốp lót PE 2 mm",
      "Tấm lót cao su non 2 mm", "Nẹp chữ T đồng màu sàn", "Nẹp kết thúc chữ L",
      "Len chân tường MDF phủ melamine", "Len chân tường nhựa PS trắng", "Nẹp giảm cao độ nhôm"
    ],
    note:[
      "Chốt hướng lát theo trục phòng", "So mẫu vân dưới ánh sáng cửa sổ", "Đo chênh cao tại cửa",
      "Chừa khe giãn nở theo hướng dẫn hãng", "Kiểm tra nền khô trước khi lát", "Chốt màu nẹp chuyển tiếp",
      "Bảo vệ sàn sau thi công", "Thống nhất xử lý đoạn giáp tủ"
    ]
  },
  {
    name:"Sàn nhựa", match:/\bsan nhua\b|\bspc\b|\blvt\b|\bvinyl\b/,
    spec:[
      "Sàn SPC hèm khóa 4 mm", "Sàn SPC hèm khóa 5 mm có đệm IXPE", "Sàn SPC vân đá bản lớn",
      "Sàn LVT dán keo 2 mm", "Sàn LVT dán keo 3 mm", "Sàn vinyl cuộn 2 mm",
      "Sàn PVC vân gỗ chống trượt", "Đệm IXPE 1 mm", "Keo chuyên dụng sàn LVT",
      "Vữa tự san nền", "Nẹp bo nhôm chữ L", "Nẹp chuyển tiếp chữ T",
      "Nẹp kết thúc đồng màu", "Len chân tường PVC 80 mm", "Len nhựa PS 100 mm"
    ],
    note:[
      "Kiểm tra độ phẳng nền", "Chọn loại phù hợp vị trí có nắng", "Đối chiếu màu giữa các lô",
      "Bố trí chiều vân dọc lối đi", "Chốt chi tiết giáp cửa nhôm", "Kiểm tra độ cao chân cửa",
      "Chừa vật tư thay thế cùng lô", "Kiểm tra xử lý mép tại logia"
    ]
  },
  {
    name:"Sơn", match:/\bson\b|\bba tuong\b|\bbot ba\b/,
    spec:[
      "Sơn nội thất mờ", "Sơn nội thất bóng nhẹ", "Sơn lau chùi cho tường hành lang",
      "Sơn lót kháng kiềm nội thất", "Sơn lót chống ố", "Sơn trần trắng mờ",
      "Sơn hiệu ứng bê tông", "Sơn hiệu ứng vôi", "Sơn hiệu ứng cát",
      "Sơn PU mờ cho gỗ", "Sơn PU màu bóng nhẹ", "Sơn 2K màu đặc",
      "Sơn gốc nước cho đồ gỗ", "Sơn lót gỗ trước khi phủ màu", "Bột bả nội thất hai lớp"
    ],
    note:[
      "Cần chốt mã màu sơn hoàn thiện", "Sơn 2 nước phủ", "Thử mẫu trên nền thi công thật",
      "Đối chiếu mẫu dưới đèn và ánh sáng ngày", "Chốt độ bóng trước khi đặt", "Xử lý ẩm và vết nứt trước khi sơn",
      "Ghi mã màu theo từng phòng", "Giữ lại sơn cùng lô để dặm"
    ]
  },
  {
    name:"Phào chỉ", match:/\bphao\b|\bnep chi tuong\b/,
    spec:[
      "Phào PU trắng 30 mm", "Phào PU trần 60 mm", "Phào PS vân gỗ 60 mm",
      "Phào PS chân tường 80 mm", "Phào thạch cao góc trần", "Chỉ tường PU 20 mm",
      "Chỉ tường PU 35 mm", "Phào bo cột cong dẻo", "Phào cổ trần phối đèn hắt",
      "Phào gỗ sơn trắng", "Phào MDF phủ melamine", "Nẹp kim loại chữ T 10 mm",
      "Chỉ âm nhôm 10 mm", "Len nhôm âm chân tường", "Keo dán và keo xử lý nối phào"
    ],
    note:[
      "Mã theo chỉ định thiết kế", "Cần duyệt mẫu và mã màu", "Đo cao độ phào sau hoàn thiện trần",
      "Chốt kiểu nối góc 45 độ", "So mẫu phào với màu tường", "Duyệt mặt cắt thực tế",
      "Đánh dấu khoảng hở lắp đèn", "Kiểm tra tiếp giáp ổ cắm và cửa"
    ]
  },
  {
    name:"Đá", match:/\bda\b|granite|marble|quartz|terrazzo/,
    spec:[
      "Đá thạch anh nhân tạo 20 mm", "Đá granite đen mài bóng 20 mm", "Đá granite băm mặt 20 mm",
      "Đá marble vân trắng 18 mm", "Đá nung kết 12 mm", "Đá nung kết 6 mm ốp vách",
      "Đá solid surface 12 mm", "Đá terrazzo đúc 20 mm", "Đá travertine chà lỗ",
      "Đá tự nhiên hoàn thiện honed", "Cạnh bo R3", "Cạnh vát 45 độ ghép dày",
      "Viền chống tràn mặt lavabo", "Mặt đá khoét chậu âm", "Keo ghép đá đồng màu"
    ],
    note:[
      "Duyệt mẫu đá thực tế", "Xác nhận bo cạnh và vị trí mối nối", "Chốt chiều vân và ghép đối vân",
      "Đo lại kích thước chậu và bếp", "Duyệt vị trí khoét lỗ theo thiết bị", "Chọn tấm đá cùng lô",
      "Kiểm tra phương án vận chuyển tấm lớn", "Chừa mẫu đá để đối chiếu khi lắp"
    ]
  },
  {
    name:"Gạch", match:/\bgach\b|porcelain|ceramic|op lat|lat nen/,
    spec:[
      "Gạch Porcelain 600×1200 mờ", "Gạch Porcelain 600×600 mờ", "Gạch Ceramic 300×600 bóng",
      "Gạch vân đá 800×800", "Gạch vân gỗ 150×900", "Gạch thẻ 75×300",
      "Gạch mosaic kính 25×25", "Gạch bông 200×200", "Gạch 300×300 mặt nhám",
      "Gạch ốp bếp 300×600", "Gạch khổ lớn 750×1500", "Ron 2mm keo epoxy",
      "Ron xi măng màu xám", "Keo dán gạch cho bề mặt đứng", "Nẹp góc inox 304"
    ],
    note:[
      "Kích thước 600×600", "Ron 2mm", "Chốt mạch ron theo viên mẫu",
      "Kiểm tra mã lô và tông màu", "Duyệt hướng vân trước khi lát", "Định vị viên nguyên ở mảng chính",
      "Chốt đường dốc về phễu thoát", "Dự phòng gạch cùng lô cho sửa chữa"
    ]
  },
  {
    name:"Kính", match:/\bkinh\b|\bguong\b/,
    spec:[
      "Kính cường lực trong 8 mm", "Kính cường lực trong 10 mm", "Kính dán an toàn 6.38 mm",
      "Kính dán an toàn 8.38 mm", "Kính sọc gân 5 mm", "Kính trà 8 mm",
      "Kính xám khói 8 mm", "Kính mờ phun cát", "Kính ốp bếp sơn màu 6 mm",
      "Gương bạc 5 mm mài cạnh", "Gương màu trà 5 mm", "Gương chống ố cho lavabo",
      "Bản lề vách kính inox 304", "Kẹp kính inox xước", "Gioăng chắn nước vách tắm"
    ],
    note:[
      "Xác nhận độ dày kính", "Chốt màu phụ kiện đồng bộ", "Đo ô chờ sau khi hoàn thiện",
      "Đánh dấu lỗ khoan trước khi tôi kính", "Chốt hướng mở vách tắm", "So màu kính trên nền thực tế",
      "Duyệt độ cao tay nắm", "Kiểm tra mép kính và góc tiếp xúc"
    ]
  },
  {
    name:"Giấy dán tường", match:/giay dan|wallpaper|vai dan tuong/,
    spec:[
      "Giấy dán tường vinyl vân vải", "Giấy dán tường vinyl vân bê tông", "Giấy dán tường không dệt",
      "Giấy giả lụa màu kem", "Giấy giả cỏ tự nhiên", "Giấy vân đá khổ 1.06 m",
      "Giấy trơn mờ khổ 0.53 m", "Giấy hoạ tiết lặp nhỏ", "Giấy hoạ tiết lặp lớn",
      "Tranh tường in theo khổ vách", "Vải dán tường vân linen", "Giấy nền có lớp lót",
      "Keo dán tường loại bột", "Keo dán tường chuyên dụng vinyl", "Nẹp kết thúc giấy tại góc ngoài"
    ],
    note:[
      "Chốt mẫu theo lô sản xuất", "Tính hao hụt theo bước lặp hoa văn", "Kiểm tra độ ẩm vách trước khi dán",
      "Chốt đường nối tránh tầm nhìn chính", "Duyệt màu mẫu cạnh rèm và sàn", "Chốt xử lý quanh công tắc",
      "Dự trữ một cuộn cùng lô", "Duyệt hướng hoạ tiết tại góc chuyển"
    ]
  },
  {
    name:"Nỉ và vải", match:/\bni\b|\bsofa\b|vai boc|da boc|dem ngoi|giuong boc/,
    spec:[
      "Vải nỉ dệt sợi nhỏ", "Vải bố linen pha polyester", "Vải bouclé sợi vòng",
      "Vải nhung mờ", "Vải nỉ chống bám bẩn", "Vải giả da microfiber",
      "Da PU vân lì", "Da bò phủ bảo vệ", "Mút ngồi D40",
      "Mút tựa D25", "Mút cao su non 30 mm", "Lớp bông gòn phủ mút",
      "Dây viền vải đồng màu", "Chỉ may cùng màu vải", "Khoá kéo ẩn cho vỏ đệm"
    ],
    note:[
      "Duyệt mẫu vải thực tế", "Xác nhận mã màu và độ dày vải", "So vải dưới ánh sáng phòng",
      "Thử độ đàn hồi đệm tại mẫu", "Chốt đường may và mép viền", "Đặt đủ vải cùng lô",
      "Chừa vải để bảo trì", "Xác nhận vỏ đệm có tháo giặt"
    ]
  },
  {
    name:"Rèm", match:/\brem\b|cau vong|sao go|roman/,
    spec:[
      "Rèm vải cản sáng một lớp", "Rèm hai lớp vải và voan", "Voan trắng ngà",
      "Voan dệt vân linen", "Rèm cầu vồng cản sáng", "Rèm cuốn lưới lọc sáng",
      "Rèm cuốn blackout", "Rèm Roman vải bố", "Rèm sáo gỗ lá 50 mm",
      "Rèm sáo nhôm lá 25 mm", "Ray nhôm đơn", "Ray đôi âm trần",
      "Ray uốn góc cho cửa cong", "Động cơ rèm có điều khiển", "Dây buộc rèm cùng màu"
    ],
    note:[
      "Đo lại ô cửa sau hoàn thiện", "Chốt hướng gom rèm", "Chốt khoảng cách rèm tới sàn",
      "Thử độ cản sáng của mẫu", "Chừa hốc ray và nguồn điện", "Kiểm tra tay nắm cửa không vướng rèm",
      "Thống nhất độ nhún vải", "Duyệt vị trí điều khiển rèm"
    ]
  },
  {
    name:"Công tắc và ổ cắm", match:/cong tac|o cam|mat dien|o mang|o usb/,
    spec:[
      "Công tắc đơn một chiều", "Công tắc đôi một chiều", "Công tắc hai chiều cầu thang",
      "Nút nhấn chuông", "Công tắc cảm ứng", "Công tắc dimmer tương thích LED",
      "Ổ cắm đôi có tiếp địa", "Ổ cắm đơn có nắp che", "Ổ cắm USB A/C",
      "Ổ mạng RJ45 CAT6", "Ổ tivi coax", "Ổ cắm âm bàn",
      "Mặt che 1 module", "Mặt che 3 module", "Hộp âm tường chuẩn cùng hãng"
    ],
    note:[
      "Chốt vị trí và cao độ sau bố trí nội thất", "Chọn mặt đồng màu tường", "Kiểm tra khung và module cùng hệ",
      "Chốt ổ cắm sau tivi", "Duyệt vị trí ổ âm bàn", "Kiểm tra công tắc hai chiều",
      "Xác nhận phương án gắn ở khu ẩm", "Chốt mẫu thật cạnh vật liệu ốp"
    ]
  },
  {
    name:"Đèn", match:/\bden\b|chieu sang|\bled\b/,
    spec:[
      "Downlight âm trần 7 W 3000 K", "Downlight âm trần 9 W 4000 K", "Spotlight chỉnh góc 7 W",
      "Đèn ray nam châm 48 V", "Đèn ray rọi 220 V", "Đèn thả bàn ăn ánh sáng ấm",
      "Đèn tường đầu giường", "Đèn hắt tường hai đầu", "Dải LED 24 V 3000 K",
      "Dải LED COB 24 V", "Thanh nhôm LED âm có tán quang", "Driver LED 24 V",
      "Đèn gương khu vệ sinh", "Đèn cảm biến tủ áo", "Đèn hắt chân tủ bếp"
    ],
    note:[
      "Chốt nhiệt độ màu theo phòng", "Đo lỗ khoét trần theo mẫu đèn", "Thử ánh sáng cùng mã sơn",
      "Chốt vị trí nguồn và hộp kỹ thuật", "Kiểm tra dimmer tương thích driver", "Xác nhận góc chiếu vào mảng nhấn",
      "Định vị đèn theo trục nội thất", "Dự trữ driver cùng thông số"
    ]
  },
  {
    name:"Thiết bị vệ sinh", match:/thiet bi ve sinh|lavabo|bon cau|voi sen|phieu thu|thoat san|voi lavabo/,
    spec:[
      "Chậu lavabo đặt bàn", "Chậu lavabo âm bàn", "Chậu lavabo treo tường",
      "Bồn cầu một khối xả nhấn", "Bồn cầu treo có két âm", "Nắp rửa điện tử",
      "Vòi lavabo nóng lạnh", "Vòi lavabo thân cao", "Sen tắm cây nhiệt độ",
      "Sen tắm âm tường", "Vòi xịt vệ sinh inox", "Phễu thoát sàn chống mùi",
      "Thoát sàn dài giấu gạch", "Xi phông lavabo chữ P", "Bộ phụ kiện treo khăn inox 304"
    ],
    note:[
      "Đối chiếu tâm thoát theo bản vẽ lắp", "Chốt cao độ chậu theo bàn", "Kiểm tra kích thước khoét đá",
      "Duyệt màu mạ đồng bộ phụ kiện", "Chốt khoảng mở cửa tắm", "Xác nhận đầu cấp và thoát nước",
      "Chừa cửa thăm két âm", "Kiểm tra đủ phụ kiện trong kiện"
    ]
  },
  {
    name:"Thiết bị bếp", match:/thiet bi bep|may hut|bep tu|chau rua|lo nuong|tu lanh|may rua bat|phu kien bep|\bbep\b/,
    spec:[
      "Bếp từ hai vùng nấu âm bàn", "Bếp từ ba vùng nấu", "Máy hút mùi âm tủ 700 mm",
      "Máy hút mùi áp tường 900 mm", "Lò nướng âm tủ 60 cm", "Lò vi sóng âm tủ",
      "Máy rửa bát âm bán phần 60 cm", "Máy rửa bát độc lập", "Tủ lạnh âm tủ",
      "Chậu rửa inox một hố", "Chậu rửa hai hố lắp âm", "Vòi rửa bát dây rút",
      "Giá bát nâng hạ 800 mm", "Giá xoong nồi ray giảm chấn", "Thùng rác phân loại âm tủ"
    ],
    note:[
      "Xác nhận kích thước cắt đá theo model", "Chốt khe thoáng tủ theo bản lắp", "Chừa ổ điện ở khoang bảo trì",
      "Đo đường ống hút mùi", "Chốt hướng mở máy rửa bát", "Kiểm tra vị trí cấp thoát chậu",
      "Nhận bản thông số trước khi sản xuất tủ", "Duyệt độ sâu thiết bị so với khoang"
    ]
  },
  {
    name:"Tay nắm", match:/tay nam|num tu|tay keo|tay nam am/,
    spec:[
      "Tay nắm thanh nhôm tâm 128 mm", "Tay nắm thanh tâm 160 mm", "Tay nắm thanh tâm 192 mm",
      "Tay nắm thanh tâm 320 mm", "Tay nắm inox xước", "Tay nắm đen mờ",
      "Tay nắm màu đồng xước", "Núm tròn đường kính 25 mm", "Núm gốm trắng",
      "Tay nắm âm chữ C", "Tay nắm âm chữ U", "Tay nắm âm cạnh cánh",
      "Nẹp tay nắm Gola ngang", "Nẹp tay nắm Gola đứng", "Tay nắm da có chốt đồng"
    ],
    note:[
      "Chốt tâm lỗ theo mẫu thật", "Đo chiều dày cánh để chọn vít", "Duyệt màu với bản lề và chân tủ",
      "Chốt tay nắm ngang hay dọc", "Kiểm tra cánh liền kề mở không vướng", "Đặt thử trên mẫu cánh trước khi khoan",
      "Thống nhất độ cao tay nắm", "Giữ phụ kiện dự phòng cùng màu"
    ]
  },
  {
    name:"Phụ kiện", match:/phu kien|ban le|ray truot|ray am|ray ngan keo|chan tu|ke noi/,
    spec:[
      "Bản lề giảm chấn 110°", "Bản lề góc rộng 165°", "Bản lề kính có đế",
      "Ray bi ba tầng 450 mm", "Ray âm giảm chấn 500 mm", "Ray âm nhấn mở",
      "Tay nâng cánh tủ trên", "Pát treo tủ điều chỉnh", "Thanh treo áo oval",
      "Ống treo tủ áo inox", "Chân tăng chỉnh tủ 100 mm", "Bánh xe có khoá 50 mm",
      "Chốt nam châm", "Pát liên kết kệ âm", "Nút bịt lỗ khoan đồng màu"
    ],
    note:[
      "Chốt tải trọng theo cấu tạo cánh", "Kiểm tra chiều sâu khoang trước khi chọn ray", "Đối chiếu góc mở với vách cạnh",
      "Chốt phụ kiện đồng bộ hệ tủ", "Duyệt phương án điều chỉnh sau lắp", "Kiểm tra mẫu ray trên ngăn thực tế",
      "Chốt số lượng theo bản vẽ sản xuất", "Dự phòng vít và đế lắp"
    ]
  },
  {
    name:"Gỗ và MDF", match:/\bgo\b|\bmdf\b|\bhdf\b|melamine|laminate|acrylic|plywood|veneer|\btu\b/,
    spec:[
      "MDF chống ẩm An Cường 17mm phủ Melamine", "Plywood 18mm phủ Laminate", "Cánh Acrylic bóng gương",
      "Nẹp chỉ PVC 1mm cùng màu", "MDF chống ẩm 18 mm phủ laminate", "MDF thường 9 mm làm hậu tủ",
      "HDF 6 mm làm hậu", "Plywood 12 mm phủ veneer sồi", "MDF phủ veneer óc chó mờ",
      "Gỗ sồi ghép phủ PU mờ", "Gỗ cao su ghép phủ dầu", "Gỗ nhựa PVC 18 mm cho tủ lavabo",
      "Cánh PET mờ 18 mm", "Chỉ ABS 2 mm cạnh cánh", "Melamine hai mặt đồng mã",
      "Laminate chống dấu vân tay"
    ],
    note:[
      "Duyệt mẫu vân và màu thực tế", "Xác nhận mã cạnh đồng màu", "Chốt chiều vân theo cánh tủ",
      "Đối chiếu mã thùng và mã cánh", "Xác nhận quy cách tấm hậu", "Kiểm tra mẫu dán cạnh trước sản xuất",
      "Chốt độ bóng bề mặt cánh", "Giữ tấm mẫu cùng mã để đối chiếu"
    ]
  }
];

function splitMaterialSuggestions(value) {
  return String(value || '').split(';').map(text => text.trim()).filter(Boolean);
}

function materialSuggestionCategory(group,row) {
  const title = normalized(row.name);
  const heading = normalized(group.name);
  return materialSuggestionLibrary.find(category => category.match.test(title)) ||
    materialSuggestionLibrary.find(category => category.match.test(heading));
}

function materialSuggestionChoices(group,row,field) {
  const category = materialSuggestionCategory(group,row);
  const groupKey = normalized(group.name.split('(')[0]);
  const choices = new Map();
  function add(value,count = 0) {
    const key = normalized(value);
    if (!key) return;
    if (!choices.has(key)) choices.set(key,{value,count:0});
    choices.get(key).count += count;
  }
  if (field === 'note') {
    for (const suggestion of (row.noteSuggestions || []).flatMap(splitMaterialSuggestions)) add(suggestion);
    for (const suggestion of [...(category?.note || []),...materialNoteCommon]) add(suggestion);
  } else {
    for (const suggestion of category?.spec || materialSpecCommon) add(suggestion);
  }

  const candidates = [sheet,...materials.sheets.filter(saved => saved.id !== sheet.id)];
  for (const current of candidates) for (const other of current.groups) {
    const sameGroup = normalized(other.name.split('(')[0]) === groupKey;
    for (const source of other.rows) {
      if (source.id === row.id) continue;
      const value = field === 'note' ? source.note : source.options?.[source.chosen]?.finish || source.spec;
      if (!value || (category ? materialSuggestionCategory(other,source) !== category : !sameGroup)) continue;
      const distinct = new Map(splitMaterialSuggestions(value).map(text => [normalized(text),text]));
      for (const suggestion of distinct.values()) add(suggestion,1);
    }
  }
  return {category:category?.name || group.name,choices:[...choices.values()].sort((a,b) => b.count-a.count).slice(0,120)};
}

function openMaterialSuggestions(field,group,row) {
  const key = field.dataset.field;
  const label = key === 'note' ? 'Ghi chú' : 'Chất liệu / Quy cách';
  const maxLength = key === 'note' ? 2000 : 500;
  const {category,choices} = materialSuggestionChoices(group,row,key);
  const element = dialog('<h2>' + label + ' · ' + html(row.name || group.name) + '</h2>' +
    '<form class="material-notes-form"><label>' + label + ' hiện tại<textarea name="text" maxlength="' + maxLength + '">' +
    html(field.value) + '</textarea></label><label>Tìm gợi ý<input type="search" name="query" autofocus></label>' +
    '<strong>' + html(category || 'Gợi ý chung') + '</strong><div class="material-note-choices">' + choices.map(({value,count}) =>
      '<label><input type="checkbox" name="suggestion" value="' + html(value) + '"> ' + html(value) +
      (count ? '<small class="material-suggestion-frequency" aria-hidden="true">' + count + ' lượt</small>' : '') + '</label>').join('') +
    '<p class="material-notes-empty" hidden>Không có gợi ý phù hợp.</p></div>' +
    '<p class="material-notes-message" role="status"></p><div class="toolbar">' +
    '<button type="button" data-note-cancel>Huỷ</button><button class="primary">' +
    (key === 'note' ? 'Lưu ghi chú' : 'Lưu quy cách') + '</button></div></form>');
  const form = element.querySelector('.material-notes-form');
  const query = form.elements.query;
  const entries = [...form.querySelectorAll('input[name="suggestion"]')];
  const chosen = new Set();
  query.focus();
  query.oninput = () => {
    const search = normalized(query.value);
    for (const entry of entries) entry.closest('label').hidden = !normalized(entry.value).includes(search);
    form.querySelector('.material-notes-empty').hidden = entries.some(entry => !entry.closest('label').hidden);
  };
  for (const entry of entries) entry.onchange = () => setMembership(chosen,entry.value,entry.checked);
  form.querySelector('[data-note-cancel]').onclick = () => element.close();
  form.onsubmit = event => {
    event.preventDefault();
    const manual = form.elements.text.value.trim();
    const values = [...splitMaterialSuggestions(manual),...chosen];
    const unique = new Map();
    for (const value of values) {
      const normalizedValue = normalized(value);
      if (!unique.has(normalizedValue)) unique.set(normalizedValue,value);
    }
    const value = chosen.size ? [...unique.values()].join('; ') : manual;
    if (value.length > maxLength) {
      form.querySelector('.material-notes-message').textContent = label + ' tối đa ' + maxLength.toLocaleString('vi-VN') + ' ký tự.';
      return;
    }
    if (value !== field.value) {
      field.value = value;
      field.dispatchEvent(new Event('change',{bubbles:true}));
    }
    field.defaultValue = value;
    element.close();
  };
}
