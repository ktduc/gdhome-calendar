# Kiểm thử toàn bộ Playwright trên Edge · 09/11/2026

Chạy `node docs/gd8-playwright.cjs` trên Edge headless tại `0bd1898`. Runner chạy hết các ca và trả mã lỗi nếu còn ca chưa đạt.

**58/59 đạt.** Ca 13.4 thuộc phần Quản lý dự án do Antigravity phụ trách.

| Ca | Lượt đầu | Sau sửa | Ghi chú |
|---|---|---|---|
| 8.1 | Đạt | Đạt |  |
| 8.2 | Đạt | Đạt |  |
| 8.3 | Đạt | Đạt |  |
| 8.4 | Đạt | Đạt |  |
| 8.5 | Đạt | Đạt |  |
| 8.6 | Đạt | Đạt |  |
| 9.1 | Đạt | Đạt |  |
| 9.2 | Đạt | Đạt | PNG thật, kiểm tra điểm ảnh ở khung giữ tỷ lệ. |
| 9.3 | Lỗi | Đạt | Đồng bộ màu nhóm chưa liên kết giữa bảng làm việc và bản xem trước. |
| 9.4 | Đạt | Đạt |  |
| 9.5 | Đạt | Đạt |  |
| 9.6 | Đạt | Đạt |  |
| 10.1 | Đạt | Đạt |  |
| 10.2 | Đạt | Đạt |  |
| 10.3 | Đạt | Đạt | Kiểm tra bản in Lịch và Chốt mã, gồm PDF trong Edge. |
| 10.3-guest | Đạt | Đạt |  |
| 10.4 | Lỗi | Đạt | Test mở menu AI trước khi chọn Lập tiến độ. |
| 10.5 | Đạt | Đạt |  |
| 10.6 | Đạt | Đạt |  |
| 10.6-recovery | Đạt | Đạt |  |
| 12.1 | Đạt | Đạt |  |
| 12.2 | Đạt | Đạt |  |
| 12.3 | Đạt | Đạt |  |
| 12.4 | Đạt | Đạt |  |
| 12.5 | Đạt | Đạt |  |
| 12.6 | Đạt | Đạt |  |
| 12.7 | Đạt | Đạt |  |
| 13.1 | Đạt | Đạt |  |
| 13.2 | Đạt | Đạt |  |
| 13.3 | Đạt | Đạt |  |
| 13.4 | Lỗi | Lỗi | Test chờ ảnh 3D trong #documents-tbody. GĐ18B.2 đưa ảnh vào #renders-gallery-container. Để Antigravity cập nhật. |
| 13.5 | Đạt | Đạt | PNG thật, đối chiếu bố cục và điểm ảnh. Kiểm tra PDF A4 ngang. |
| 15.1 | Đạt | Đạt |  |
| 15.2 | Đạt | Đạt |  |
| 15.3 | Đạt | Đạt |  |
| 16.1 | Đạt | Đạt |  |
| 16.2 | Đạt | Đạt |  |
| 16.3 | Đạt | Đạt | Kiểm tra mã trên ảnh, kiểu fill và viền PA đã chốt trong bản xem trước. |
| 16.4 | Đạt | Đạt |  |
| 16.5 | Đạt | Đạt |  |
| 16.6 | Đạt | Đạt |  |
| 16.7 | Đạt | Đạt |  |
| 17.0 | Đạt | Đạt |  |
| 17.1 | Đạt | Đạt |  |
| 17.2 | Đạt | Đạt |  |
| 17.3 | Đạt | Đạt | Cùng ca với 18.6, dùng html2canvas thật. |
| 17.4 | Lỗi | Đạt | Đợi trình duyệt nhận phản hồi lưu cài đặt trước khi tải lại, để tránh ảnh hưởng giữa hai ca liên tiếp. |
| 17.5 | Đạt | Đạt |  |
| 17.6 | Đạt | Đạt |  |
| 18.1 | Đạt | Đạt |  |
| 18.2 | Đạt | Đạt |  |
| 18.3 | Đạt | Đạt |  |
| 18.4 | Đạt | Đạt |  |
| 18.5 | Đạt | Đạt | Kiểm tra ba vị trí mã, xoá mã tự điền, giữ mã gõ tay và hoàn tác. |
| 18.6 | Đạt | Đạt | html2canvas thật. Kiểm tra PNG có nội dung, hộp kết quả và nhánh lỗi. Giả lập clipboard hệ thống. |
| 18.7 | Đạt | Đạt | Kiểm tra mặc định ẩn và lưu lựa chọn hiển thị qua lần tải lại. |
| 18.8 | Đạt | Đạt |  |
| 18.9 | Đạt | Đạt |  |
| 18.10 | Đạt | Đạt |  |

XONG KIEM THU
