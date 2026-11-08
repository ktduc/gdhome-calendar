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
| 9.2 | ✅ | nới bảng in và căn ảnh vuông ngang hàng |
| 9.3 | ✅ | đồng bộ thứ tự cột và hình thức bảng nhập với bản in |
| 9.4 | ✅ | dùng font Roboto chung với Tiến độ cho bảng và bản in |
| 9.5 | ✅ | mở ảnh lớn có chuyển, cắt, xoá và tách nút chốt PA |
| 9.6 | ✅ | giữ ghi chú mới trống và thêm gợi ý theo danh mục |
| 9.7 | ✅ | kiểm thử PNG và A4 trên Edge, cập nhật bàn giao |

Bước kế tiếp GĐ9: Hoàn thành 9.1–9.7. Chờ review trước khi triển khai.

### Kiểm tra GĐ9

- `node --test --test-isolation=none` đạt 23/23.
- `node docs/gd8-playwright.cjs` đạt 12/12 trên Edge với dữ liệu tạm. Có thể truyền `9.1 9.2 9.3 9.4 9.5 9.6` để chỉ chạy GĐ9, và dùng biến `PLAYWRIGHT_PATH` để trỏ đến Playwright cài ngoài dự án.
- Ở màn hình 1050 px, hai khung 3D và PA đều 92×92 px, cùng tọa độ mép trên. Kiểm tra thêm ở 375 px, chế độ in và ca PA1 chỉ có mã còn PA2 có ảnh. Logo bản thống kê rộng 224 px. PNG được vẽ bằng html2canvas và kiểm tra điểm ảnh, PDF A4 được tạo trong bộ nhớ.
- Xác nhận font Roboto trên Tiến độ, bảng nhập, trang duyệt và biên bản. Thử chuyển, cắt, xoá ảnh trong lightbox và chốt PA bằng ✓. Gợi ý ghi chú theo loại hạng mục, ghi chú AI và ghi chú đã dùng đều hiện sau khi tải lại.
- Hướng dẫn và phạm vi thay đổi đã cập nhật ở mục 3o của `CLAUDE_HANDOVER.md`.

XONG GĐ9

## Giai đoạn 10

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 10.1 | ✅ | tách bộ giao diện chung cho GD HOME Tools |
| 10.2 | ✅ | lưu cài đặt Chốt mã theo tài khoản và khôi phục bảng đang mở |
| 10.3 | ✅ | đồng bộ thao tác, xuất ảnh PDF và chế độ khách |
| 10.4 | ✅ | gom màn Kết nối và dùng chung luồng AI |
| 10.5 | ✅ | hợp nhất hồ sơ theo ID dự án của Tiến độ |
| 10.6 | ✅ | kiểm thử giao diện ở 1440 và 1920 px, cập nhật bàn giao |

Bước kế tiếp GĐ10: Hoàn thành 10.1–10.6. Tiếp tục GĐ12 theo yêu cầu.

- 10.1: tài liệu tích hợp ở `docs/HE-THONG-GIAO-DIEN.md`. Ảnh header và sidebar Lịch ở 1440/1920 px trùng từng byte trước và sau khi tách. Playwright 10.1, 8.3, 9.5 đạt.

- 10.2: `viewSettings` có `viewVersion` riêng trong cùng kho Chốt mã. API dùng chung hàng đợi ghi với bảng, bản tạm localStorage giữ thay đổi chưa gửi. Playwright 10.2 xác nhận khôi phục sau khi xoá localStorage, kể cả độ rộng, lọc, danh mục và chế độ xem như bản in.

- 10.3: Playwright kiểm tra cụm nút thẳng hàng ở 1440/1920 px, Esc, độ đậm, ghi nhớ sọc chìm, PDF A4 và dán ảnh ở chế độ khách không gọi API Chốt mã. Bảng đối chiếu nằm trong `docs/HE-THONG-GIAO-DIEN.md`.

- 10.4: cấu hình lưu tại `/api/integrations/settings`. Playwright đổi model/cột ngày ở Lịch, đọc từ Chốt mã, dán ảnh và mở duyệt AI trên cả hai trang với phản hồi giả lập.

- 10.5: `projectOwners[].profile` là hồ sơ dùng chung; tên chuẩn lấy từ `projectOwners[].name`. Playwright sửa hai chiều giữa Lịch và Chốt mã; test API xác nhận cô lập tài khoản, 409 cho dữ liệu Lịch cũ và hồ sơ của bản đã ký giữ nguyên.

- 10.6: Node 23/23 và Playwright 19/19 trên Edge. Chụp header và sidebar Lịch/Chốt mã ở 1440 và 1920 px; các cụm lệnh cùng toạ độ ngang. Kiểm tra lưu trên server, hồ sơ hai chiều, khách, Esc, PDF và cấu hình AI/Notion giả lập. Tài liệu tích hợp ghi tại mục 3p trong `CLAUDE_HANDOVER.md`.

XONG GĐ10

### Bổ sung GĐ10.6 theo báo lỗi Render

- Chẩn đoán Render. Đo request từ lúc nhận đến lúc hoàn tất hoặc đóng, ghi cả request còn chờ sau 3 giây. Giám sát event loop mỗi giây và ghi URL đang xử lý khi trễ quá 2 giây. Health trả uptime, bộ nhớ, độ trễ cao nhất và trạng thái sẵn sàng. Gist có timeout tối đa 15 giây mỗi lần, thử lại hai lần với lỗi tạm thời và giới hạn 60 giây cho một lượt khởi tạo. Khi Gist chưa sẵn sàng, trang tĩnh và health vẫn trả lời, thao tác dữ liệu chờ lượt kết nối tiếp theo. Test Node 25/25.
- Phục hồi cài đặt khi API chậm hoặc lỗi. Lịch và Chốt mã dựng khung và đọc bản lưu theo tài khoản ngay, hiện trạng thái kết nối và tự thử lại sau 3 giây. Bản hiển thị tạm chỉ đọc. Các lệnh lưu dữ liệu và cài đặt chờ GET thành công. Playwright 10.6-recovery giữ cột/nhóm đã tắt qua GET bị trì hoãn, 503 và lượt thử lại. Không phát sinh POST trong ca này.

Commit chẩn đoán `1f9ef08` đã lên `origin/main` để Claude đối chiếu Render. Bản giữ cài đặt nằm trong commit cục bộ `ded19f9`.

XONG GĐ10

## Giai đoạn 12

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 12.1 | ✅ | dùng cùng bố cục bảng làm việc cho ảnh và PDF |
| 12.2 | ✅ | lưu và đồng bộ nút in trên từng cột |
| 12.3 | ✅ | thêm khung ảnh vuông Fill và Vừa cho 3D và PA |
| 12.4 | ✅ | đóng xem trước bằng Esc và thu chữ ghi chú quy cách |
| 12.5 | ✅ | thêm gợi ý Ghi chú và Quy cách cho 17 nhóm vật liệu |
| 12.6 | ✅ | kéo đổi thứ tự cột và lưu cho bảng xuất |
| 12.7 | ✅ | tự liên kết việc Tiến độ theo độ khớp và giữ chọn tay |

Bước kế tiếp GĐ12: Hoàn thành 12.1–12.7.

- 12.1: dùng cùng bộ dựng đầu tờ, cột, nhóm và dòng. Thao tác được bỏ khỏi bản xuất. PDF thống kê thu đều vào A4 ngang. Ca Playwright 12.1 đối chiếu thứ tự, tỷ lệ cột trong ±5%, kích thước ô ảnh và logo; ca 9.2 xác nhận ảnh PNG thực tế.

- 12.2: cột tắt in vẫn sửa được và tô xám. Trạng thái dùng chung giữa tiêu đề, sidebar và Copy ảnh. Playwright xác nhận bỏ cột ở bản xuất và phục hồi sau khi xoá localStorage.

- 12.3: Fill mặc định cắt giữa khung và Vừa giữ toàn ảnh. Cả hai áp dụng cho 3D/PA và ảnh xuất. Biên bản mới chụp lại tuỳ chọn khi phát hành; bản cũ dùng Vừa. Playwright đo khung và ảnh ở hai chế độ, đối chiếu ảnh xuất.

- 12.4: xem trước dùng hộp thoại, Esc hoặc bấm nền để đóng. Chữ Ghi chú/Quy cách bằng 85% cỡ hạng mục và cùng cỡ giữa bảng làm việc và bản xuất. Kiểm tra thống kê, PNG và A4 trang khách.

- 12.5: mỗi nhóm có 15–16 Quy cách và 18 Ghi chú mặc định, cộng giá trị đã dùng. Tìm không dấu, chọn nhiều theo thứ tự chọn, xếp gợi ý theo tần suất. Playwright kiểm tra học quy cách và lưu vào PA đã chốt.

- 12.6: kéo nhãn cột có vạch chỉ trước/sau, Alt+mũi tên để đổi bằng bàn phím và Về mặc định để khôi phục. Playwright kiểm tra kéo, lưu qua server và thứ tự giống nhau khi xuất.

- 12.7: khớp tên không dấu, từ đồng nghĩa và giai đoạn trong cùng dự án. Ưu tiên điểm cao hơn, rồi ngày bắt đầu sớm hơn. Ghi tỷ lệ khớp và giữ lựa chọn tay, kể cả chọn không liên kết. Test kiểm tra đối chiếu, tải lại và badge Tiến độ.
- Kiểm thử cuối đạt 27/27 Node và 27/27 Playwright trên Edge. `origin/main` dừng ở commit chẩn đoán Render `1f9ef08`. Bản giữ cài đặt và GĐ12 nằm trong các commit cục bộ.

XONG GĐ12

## Giai đoạn 13

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 13.1 | ✅ | giữ bảng xuất trong khổ giấy và bỏ viền nhập liệu |
| 13.2 | ✅ | ảnh 3D và PA lấp đầy cột và mở được từng ảnh |
| 13.3 | ✅ | thêm và quản lý gợi ý dùng chung theo tài khoản |
| 13.4 | ✅ | nén ảnh trong trình duyệt và dùng chung ảnh theo hash |
| 13.5 | ✅ | đối chiếu bảng làm việc với PNG và xác nhận PDF A4 ngang |

Bước kế tiếp GĐ13: Hoàn thành 13.1–13.5; đồng bộ origin/main, kiểm thử lại và push.

- 13.1: test tái hiện tràn 16 px và viền dashed; bản sửa qua 6 cấu hình khổ/cột, Node 36/36 và Playwright 28/28.

- 13.2: ảnh chính vuông theo độ rộng cột, ảnh phụ ở dải riêng; PDF dùng ảnh đầy đủ, trang khách có lightbox. Node 36/36; Playwright qua 28 ca hồi quy và ca 13.2.

- 13.3: gợi ý tự thêm dùng theo nhóm hoặc mọi nhóm, đánh ★, đếm lượt chọn, sửa, xóa và kéo đổi thứ tự. Đã kiểm tra xóa localStorage, dùng ở dự án khác và sửa/xóa trên server. Node 36/36, Playwright 30/30.

- 13.4: PNG mẫu 4000×3000 từ 5.315.529 byte xuống 102.812 byte, ảnh đầy đủ 1600×1200, thumbnail 480×360. Kiểm tra PNG trong suốt, dự phòng JPEG, byte PDF giữ nguyên, kho B2 giả lập chỉ PUT một lần cho cùng hash. Node 36/36, Playwright 31/31.

- 13.5: đo độ rộng và vị trí cột, so điểm ảnh với PNG thật, xác nhận PDF A4 ngang. Ảnh so sánh trong docs/gd13/ và bàn giao mục 3q. Kiểm thử trước rebase: Node 36/36, Playwright 32/32.

XONG GĐ13
