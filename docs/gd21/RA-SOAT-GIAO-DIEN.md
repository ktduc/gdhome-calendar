# Rà soát giao diện GĐ21.7

Playwright chạy Microsoft Edge ở 1280 × 860, 1440 × 860, 1920 × 860 và 390 × 844. Dữ liệu mẫu gồm một dự án, một bảng Chốt mã và 720 mẫu gạch trong cùng hạng mục. Ảnh minh hoạ do bộ kiểm thử tạo.

| Trang | Phạm vi kiểm tra ở cả bốn chiều rộng |
| --- | --- |
| Lịch | Header, menu công cụ, thêm việc, thêm giai đoạn, AI lập tiến độ, AI soát tiến độ, cài đặt, menu và tuỳ chọn xuất, đồng bộ Notion |
| Chốt mã | Header, AI, xuất, thư viện, bảng thuộc tính, tuỳ chỉnh cột lọc, nhập catalogue, tìm mã trùng, quản lý phối cảnh 3D, bộ chọn vật liệu, gỗ, sơn và phối cảnh |
| Quản lý dự án | Header, menu File và hộp tạo dự án |
| Tools | Header và hộp kết nối AI |

| Lỗi quan sát được | Sửa |
| --- | --- |
| Catalogue và Tìm mã trùng chạm mép trái, tràn khỏi màn hình 390 px về bên phải | Tính chiều rộng hộp gồm cả viền và đệm, chừa mép hai bên |
| Checkbox trong catalogue nằm trên một dòng riêng so với nhãn | Căn checkbox và nhãn cạnh nhau, cho nhãn xuống dòng khi cần |
| Tên hạng mục chỉ còn “GẠ…” trên điện thoại, thanh thao tác trống vẫn chiếm chỗ | Dùng một dòng cho tên hạng mục, cho phép xuống dòng, bỏ thanh thao tác khi rỗng |
| Hộp Thêm việc tràn xuống đáy, hai hộp Thêm việc và Thêm giai đoạn phát sinh cuộn ngang ở 390 px, Tab có thể ra nền | Giới hạn theo chiều cao màn hình, cuộn phần nội dung, giữ Tab trong hộp đang mở |
| Menu xuất Lịch mở sang trái quá 60 px ở 390 px | Căn trái theo nút trên màn hình hẹp |
| Đổi tab, lọc hoặc tìm kiếm dựng lại thư viện và mất điểm Tab | Khôi phục focus và vị trí con trỏ, dùng viền focus theo màu giao diện |
| Menu thẻ có thể khuất dưới thanh thao tác khi cuộn | Đưa menu đang mở lên trên thanh thao tác và dùng cơ chế đóng khi bấm ngoài của shell |
| Thư viện dựng cả lưới và gọi tải ảnh ngay khi mở | Chia trang 96 mẫu khi kết quả trên 300 mẫu, tải ảnh gần vùng nhìn bằng IntersectionObserver và `loading="lazy"` |

| Màn hình | Thư viện trước / sau | Catalogue trước / sau |
| --- | --- | --- |
| 1280 px | [Trước](before-thu-vien-1280.png) · [Sau](after-thu-vien-1280.png) | [Trước](before-catalogue-1280.png) · [Sau](after-catalogue-1280.png) |
| 390 px | [Trước](before-thu-vien-390.png) · [Sau](after-thu-vien-390.png) | [Trước](before-catalogue-390.png) · [Sau](after-catalogue-390.png) |

Chạy lại ca riêng bằng `node docs/gd8-playwright.cjs 21.7`. Đặt `GD21_SCREENSHOTS=after` để ghi lại ảnh sau khi sửa.

Ở 1440 px trên máy kiểm thử với máy chủ cục bộ, mở thư viện mất 105,3 ms, lọc kích thước 61 ms và tìm theo tên 70,1 ms. Lưới dựng 96 thẻ cho trang đầu và yêu cầu 42 ảnh đến lúc ảnh đầu hiển thị. Đây là số đo trên dữ liệu mẫu và mạng cục bộ.
