# Tiến trình Chốt mã vật liệu

| GĐ | Trạng thái | Bước đã làm |
|---|---|---|
| 1 | ✅ | 1.1 Menu, `/tools`, `/chot-ma`, phiên Gmail và MaterialStore có 409 · `cf83efd` |
| 2 | ✅ | 2.1 Mẫu 17 nhóm, bảng nhập, tự lưu/Undo/Redo · 2.2 Ảnh R2/tạm, thumbnail và preset · `22d0f27` |
| 3 | ✅ | 3.1 Thư viện mã, xem trước và nhập XLSX/CSV, tab preset · `76045e7` |
| 4 | ✅ | 4.1 Bản phát hành, duyệt và ký A/B, 48 giờ và lịch sử · 4.2 A4, thống kê ảnh, Excel mua hàng · `f2c0a07` |
| 5 | ✅ | 5.1 Gắn nhóm với công việc, tính hạn, ✓/⚠ trên Timeline · `50421a6` |
| Rà soát | ✅ | Kiểm thử localhost, sửa nhập PA trước khi mất focus, tách CSS công cụ, dùng chung hàm xuất ảnh và ghi Chốt mã bền vững khi dùng Gist. |
| 6 | ✅ | 6.1 Bảng gọn, nhãn, menu Xuất và mã tại ô · 6.2 Crop và chữ ký · 6.3 Module điều khoản, cache và kiểm tra localhost |

Bước tiếp theo: Claude review commit GĐ6 và chuẩn bị triển khai. Tất cả commit là cục bộ.

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

## Kiểm tra GĐ6

- GĐ6.1: thử tạo bảng, xem menu Xuất, nhập mã PA, chọn gợi ý thư viện và dán ảnh. Dòng đo khoảng 44 / 72 / 130 px, thumbnail Vừa 90×64; tiêu đề cột giữ vị trí khi cuộn 1.440 px.
- GĐ6.2: kéo góc crop, huỷ, rồi mở lại và lưu ảnh cắt. Ký thử A/B; trang khách, lịch sử và A4 đều có tỷ lệ 600×190. Mở A4 xác nhận đủ điều khoản và không có quốc hiệu.
- GĐ6.3: phát hành link, gửi yêu cầu đổi, kiểm tra ⚠ trên Timeline và xem trước thống kê ảnh. So khớp Điều 2–4 với mẫu, nạp server từ bản sao thiếu `docs/`. Cập nhật danh sách deploy trong repo và phiên bản cache. 21/21 test đạt. Render và xuất file từ trình duyệt chưa chạy trong lượt kiểm tra này.

XONG GĐ6

## Giai đoạn 7

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 7.1 | ✅ | bố cục, danh mục và phương án theo dòng |
| 7.2 | ✅ | kéo và lưu độ rộng cột |
| 7.3 | ✅ | hồ sơ dự án và lọc khách từ Notion |
| 7.4 | ✅ | xuất ảnh và A4 theo phạm vi |
| 7.5 | ✅ | AI đọc khối lượng, duyệt và gộp hạng mục |

Bước kế tiếp GĐ7: Claude review commit GĐ7. Tất cả commit là cục bộ.

### Kiểm tra localhost GĐ7

1. Tạo bảng mẫu, bấm ＋ PA, xoá PA trống và kiểm tra cột biến mất. Bật/tắt nhóm và cột Phối cảnh 3D. Bấm tên nhóm để hiện lại và cuộn tới.
2. Kéo mép Hạng mục. Kiểm tra cột đổi từ 334 px lên 414 px, tải lại vẫn 414 px, nháy đúp về 334 px.
3. Mở Lấy từ Notion, tìm theo số điện thoại và bấm Điền dự án đang chọn. Kiểm tra ô Kính gửi và bản xem trước xuất có khách vừa chọn. Kết nối Notion và dữ liệu khách đã dùng phản hồi giả lập. Tên khác tên Lịch cần xác nhận trước khi điền.
4. Chốt một dòng, mở Copy ảnh → Tải PNG → Chỉ nhóm đang bật + Chỉ dòng đã chốt → Xem trước. Đã xác nhận bản xem trước có tiêu đề, hồ sơ, watermark và đúng một dòng. Trình duyệt từ chối quyền tải PNG trong lượt kiểm tra. PDF A4 lưu qua hộp in.
5. Mở ✨ AI, dán ảnh thử, gửi, mở Duyệt đề xuất từ ô trạng thái góc phải. Gộp hai đề xuất trùng vào bảng và xác nhận chỉ thêm một dòng. Gemini được giả lập; API test kiểm tra ảnh/PDF và chuẩn hoá JSON. Chưa dùng dữ liệu hoặc khoá thật.

XONG GĐ7

## Giai đoạn 8

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 8.1 | ✅ | giữ vị trí cuộn và focus sau thao tác |
| 8.2 | ✅ | giữ bố cục sidebar Lịch khi hover |
| 8.3 | ✅ | dùng chung header và kiểu điều khiển với Lịch |
| 8.4 | ✅ | chọn nhiều dòng, hoàn tác và bảo vệ dòng đã ký |
| 8.5 | ✅ | dán ảnh từ items, HTML và clipboard vào ô |
| 8.6 | ✅ | tách phần dựng bảng, dùng toast chung và đo 150 dòng |

Bước kế tiếp GĐ8: Claude review 6 commit cục bộ.

### Tự kiểm tra GĐ8

1. Cuộn xuống nhóm 8 và sang phải, xoá dòng. Kiểm tra vị trí cuộn và focus dòng kế bên, cả ở khổ hẹp có cuộn trang.
2. Ở Lịch, rê chuột qua tên dự án và giai đoạn. Các khung, nội dung và sidebar giữ cùng kích thước trước và sau hover.
3. So sánh header hai trang. Mở nút Thêm dòng/nhóm để thêm danh mục. Bật/tắt cột và đổi mật độ từ menu trái.
4. Shift+click để chọn dải, Ctrl+click để thêm một dòng. Thử chọn toàn nhóm, toàn bảng đang hiện, nhân bản, đổi trạng thái, chuyển nhóm, Delete và Ctrl+Z. API trả 409 nếu xoá dòng thuộc bản đã ký.
5. Click ô ảnh rồi Ctrl+V. Thử dán vào ô có ảnh, dán vào ô 3D khi hover và dán văn bản vào ô mã. Playwright gửi ClipboardEvent có items nhưng files rỗng, HTML với data URL hoặc URL cùng nguồn và mô phỏng clipboard.read().
6. Với Playwright đã cài và Edge có sẵn, chạy `node docs/gd8-playwright.cjs`. Có thể trỏ `PLAYWRIGHT_PATH` đến Playwright cài trong thư mục tạm. Script khởi động server với kho dữ liệu mẫu và chạy cả sáu ca. Không tải tệp trong lúc kiểm tra.

23/23 test Node đạt. Playwright đạt 6/6. Hai lượt đo cuối với 150 dòng có lần render chậm nhất khoảng 116–131 ms và xử lý input dưới 1 ms trên Edge headless.

XONG GĐ8

## Giai đoạn 9

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 9.1 | ✅ | mặc định nhóm đang bật và nhớ phạm vi xuất |
| 9.2 | ⏳ | Bố cục ảnh và A4 |
| 9.3 | ⏳ | Bảng nhập và bản in |
| 9.4 | ⏳ | Font Tiến độ |
| 9.5 | ⏳ | Xem ảnh và chốt PA |
| 9.6 | ⏳ | Gợi ý ghi chú |
| 9.7 | ⏳ | Kiểm tra và bàn giao |

Bước kế tiếp GĐ9: 9.2 căn bảng, ảnh và logo bản xuất.
