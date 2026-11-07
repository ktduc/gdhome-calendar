# Tiến trình Chốt mã vật liệu

| GĐ | Trạng thái | Bước đã làm |
|---|---|---|
| 1 | ✅ | 1.1 Menu, `/tools`, `/chot-ma`, phiên Gmail và MaterialStore có 409 · `cf83efd` |
| 2 | ✅ | 2.1 Mẫu 17 nhóm, bảng nhập, tự lưu/Undo/Redo · 2.2 Ảnh R2/tạm, thumbnail và preset · `22d0f27` |
| 3 | ✅ | 3.1 Thư viện mã, xem trước và nhập XLSX/CSV, tab preset · `76045e7` |
| 4 | ✅ | 4.1 Bản phát hành, duyệt và ký A/B, 48 giờ và lịch sử · 4.2 A4, thống kê ảnh, Excel mua hàng · `f2c0a07` |
| 5 | ✅ | 5.1 Gắn nhóm với công việc, tính hạn, ✓/⚠ trên Timeline · `50421a6` |
| Rà soát | ✅ | Kiểm thử localhost, sửa nhập PA trước khi mất focus, tách CSS công cụ, dùng chung hàm xuất ảnh và ghi Chốt mã bền vững khi dùng Gist. |
| 6 | 🔄 | 6.1 ✅ Mật độ bảng, nhãn khách, menu Xuất và nhập mã tại ô · Tiếp theo 6.2 crop và chữ ký |

Bước tiếp theo: Claude review các commit trên `main`, đối chiếu checklist dưới đây rồi chép script deploy sang Desktop theo lệnh chạy đêm. Tất cả commit là cục bộ.

## Kiểm thử nhanh

1. Chạy `node --test --test-isolation=none` (21/21). Để thử riêng, đặt `DATA_DIR` vào thư mục thử nghiệm, để trống các biến Gmail/Gist/R2 và chạy `node server.js`. Thêm và lưu dự án có một giai đoạn và công việc trong Tiến độ.
2. Từ `/`, mở **GD HOME Tools → Trang chủ → Chốt mã** ở dự án vừa tạo. Tạo bảng từ mẫu, thử điền vị trí/khối lượng bằng bàn phím, đổi Gọn/Vừa/Ảnh lớn, Ctrl+D, Ctrl+Z/Y. Chọn ô PA/3D, dán ảnh hoặc kéo thả. Thử menu gợi ý và Alt+1…9. Mở chi tiết PA, điền mã/quy cách, chốt, chờ **Đã lưu** rồi tải lại.
3. Tạo một bảng khác bằng **Nhập Excel / CSV**, kiểm tra tab/dòng tiêu đề và ánh xạ. Gõ mã đã chốt vào ô mã PA để xem gợi ý. Xuất **Excel mua hàng** hai lần để kiểm tra tùy chọn giá.
4. Mở **Điều khoản mẫu**, chỉnh tên đại diện và địa chỉ Bên B. Phát hành link với một bảng thử đã có PA, mở link ở cửa sổ riêng, chọn PA và ký thử. Trong **Biên bản / Lịch sử**, chọn **Bên B xác nhận**, vẽ chữ ký và mở **Biên bản A4**. Kiểm tra hai chữ ký, Điều 2–4, giá/NCC ẩn và không có quốc hiệu. **In / Lưu PDF A4** dùng hộp in trình duyệt. Bản **Thống kê ảnh** có PNG, copy ảnh và PDF qua hộp in.
5. Trên link khách đã ký, xem đếm ngược và gửi lý do đổi. Trên Chốt mã, mở lịch sử và tải lại bảng; trạng thái hiện **Đổi mã**. Phát hành bản mới nếu chấp thuận đổi. Link chưa ký hết hạn sau 14 ngày hoặc bị thu hồi khi phát hành lại.
6. Gắn một nhóm với công việc, nhập lead time, đổi giữa ngày làm việc và ngày thực tế. Mở Timeline xem ⚠. Chốt hết các dòng thuộc các nhóm cùng công việc, quay về Timeline xem ✓ (tự làm mới khi quay lại hoặc sau một nhịp thăm dò). Hạn sắp đến báo trong 3 ngày lịch. Nửa ngày thứ Bảy được tính 0,5 ngày làm việc.

Đã kiểm tra trên trình duyệt localhost với dữ liệu giả lập: trang chủ theo dự án → mẫu 17 nhóm → tự lưu → gắn công việc → nhập/chốt mã → phát hành → trang khách → xem biên bản A4. Test tích hợp dùng FileStore cô lập, phiên Gmail ký giả lập, xung đột ghi, cách ly ảnh, che giá/NCC, ký A/B, yêu cầu đổi và thu hồi. Test ngày làm việc và tổng hợp ✓/⚠ độc lập.

## Câu hỏi cho anh Đức

- Mẫu giấy chép thiếu phần cuối câu Điều 2 (“…lập một bản Biên bản hợp”). Giữ nguyên trong Điều khoản mẫu để anh bổ sung.
- Xin một bản Excel đại diện nếu cần xác nhận ánh xạ ô gộp và tab preset. Bản nhập xử lý giá trị bảng và báo tham chiếu ảnh; ảnh nhúng, ảnh công thức cần dán lại.
- Chưa chạy trên Render/Gmail/Gist/R2 thật theo phạm vi commit cục bộ. Kho ảnh tạm chỉ dùng để thử. Hướng dẫn cấu hình ở `HUONG-DAN-R2.md`. Chưa đối chiếu bản in thực tế từ máy in GD HOME.

XONG
