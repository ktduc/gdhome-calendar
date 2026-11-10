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

## Giai đoạn 14A

| Bước | Trạng thái | Kết quả |
|---|---|---|
| A1 | ✅ | ghi rõ khối lượng theo báo giá và gộp ĐVT khi ẩn |
| A2 | ✅ | lưu cửa sổ gợi ý khi bấm ngoài và thêm xoá nhanh |
| A3 | ✅ | đánh dấu và lọc nhóm chưa liên kết Tiến độ |
| A4 | ✅ | xoá bản nháp hoặc lưu trữ và khôi phục bảng đã phát hành |
| A5 | ⏳ | Độ rộng cột ảnh |

Bước kế tiếp GĐ14A: A5

- A1: kiểm tra nhập ĐVT trong ô Khối lượng, bật lại cột và tắt in riêng ĐVT; trang khách và biên bản có nhãn. Node 36/36, Playwright 33/33.

- A2: Ghi chú, Quy cách, Vị trí và NCC có lưu khi bấm ngoài/Enter, Shift+Enter xuống dòng trong ô nhiều dòng, Esc huỷ. Xoá nhanh trên bảng hoàn tác được. Node 36/36, Playwright 34/34.

- A3: nhóm thiếu việc hoặc độ khớp dưới ngưỡng được tô vàng; chip mở danh sách việc, bộ lọc được lưu theo bảng và không đưa cảnh báo lên bản xuất. Node 36/36, Playwright 35/35.

- A4: xác nhận bằng tên bảng; API kiểm tra tài khoản và phiên bản, giữ biên bản/link khách khi lưu trữ, cho khôi phục. Ảnh chỉ đánh dấu ứng viên dọn sau, phải kiểm tra lại tham chiếu ở cả Chốt mã và Quản lý dự án trước khi xoá khỏi B2. Node 37/37, Playwright 36/36.


## Giai đoạn 15 (Claude tự làm, 08/11/2026)

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 14A | ✅ | Gộp phần GPT làm dở (A1–A4) với phần B của Antigravity; A5: cột 3D và PA mặc định 200 px |
| 15.1 | ✅ | Menu thả xuống (File, GD HOME Tools, Copy ảnh, Thêm dòng…) đóng khi bấm ra ngoài hoặc Esc ở mọi trang; hộp thoại đóng khi bấm nền tối (trừ hộp nhập công việc bên Lịch) |
| 15.2 | ✅ | Kho phối cảnh 3D của dự án dùng chung Chốt mã ↔ Quản lý dự án: tải ảnh hoặc PDF nhiều trang (tự tách trang, nén WebP), chọn nhanh khi bấm ô Phối cảnh 3D |
| 15.3 | ✅ | Vùng nhìn ảnh: kéo/phóng to chọn vùng hiển thị trong ô vuông, không tạo ảnh mới; áp dụng màn hình, xuất ảnh, PDF, trang khách |
| 15.4 | ✅ | Dữ liệu dùng chung toàn hệ thống (`/api/library`): 17 hạng mục mặc định theo nhóm vật liệu, thêm/đổi tên/xoá hạng mục, tải ảnh (Ctrl+V, kéo thả), chọn nhanh khi bấm ô Mẫu vật liệu/PA theo đúng nhóm |
| 15.5 | ✅ | Rà giao diện: header không tràn ở điện thoại 375 px, tên nhóm dài có tooltip |

Kiểm tra: `node --test` 42/42. Playwright: 8.1–8.5, 9.1, 9.4–9.6, 10.x, 12.x, 13.1–13.4, 15.1, 15.2 đạt (9.3 lỗi sẵn từ trước, 8.6 dao động ~200 ms trong máy ảo chậm như bản trước).

XONG GĐ15


## Rà soát code (Claude, 09/11/2026)

| Mục | Kết quả |
|---|---|
| Lưu Gist | Sửa lỗi mất dữ liệu: thay đổi đến lúc đang gửi lên Gist không được gửi tiếp (hẹn giờ bị bỏ qua). Khi tắt server gửi hết phần còn lại. Có test `tests/gist-store.test.js`. |
| Ảnh | Ảnh trả về `private, max-age=31536000, immutable` (tên = mã băm) thay cho `no-store`; server giữ đệm ~48 MB ảnh lấy từ B2 → mở lại bảng không phải tải lại ảnh từ kho ở Mỹ. |
| AI soát bản vẽ | Bỏ qua file > 14 MB (giới hạn AI) kèm cảnh báo thay vì làm hỏng cả lượt và tốn bộ nhớ. |
| Tiến trình AI | Chỉ chủ tài khoản xem/huỷ được job; mã job ngẫu nhiên UUID; dọn job xong quá 2 giờ; trang Dự án ngừng thăm dò khi job mất do server khởi động lại. |
| Thư viện ảnh | Lỗi tải danh sách 3D/dữ liệu dùng chung được giữ 30 giây, không gọi lại ở mỗi lần vẽ bảng. |
| Khác | `/favicon.ico` hết 404. |

Đo: tải trang Lịch ~0,44 s (đã nén Brotli); log Render 24 giờ không có request chậm/nghẽn. Timeline 450 việc ~160–250 ms trong máy ảo chậm (khoảng 80 ms máy thật) – chấp nhận được, có thể tối ưu sau bằng gắn sự kiện chung thay vì từng dòng.

### Sửa 09/11/2026
- Dữ liệu dùng chung báo "Cannot read properties of undefined (reading 'authMode')" khi bảng hiện từ bản lưu trên máy trước lúc tải xong cấu hình: `authHeaders()` không còn phụ thuộc cấu hình đã tải.
- Độ đậm chữ: bảng nhập, ảnh/PDF xuất, biên bản A4 và bản in dùng chung một quy tắc font-weight (Mảnh 300/600, Thường 400/700–800, Đậm 600/800, Rất đậm 800/900). Nạp thêm Roboto 600/800. Playwright 15.3.
- Nút ⬆ tải 3D trên đầu cột không làm lệch bố cục bảng so với bản xuất (13.5).

## Giai đoạn 16 (09/11/2026)

| Bước | Trạng thái | Kết quả |
|---|---|---|
| 16.1 | ✅ | Ô ảnh gọn: ô trống chữ mờ "Bấm để chọn · Ctrl+V để dán", ô có ảnh chỉ 1 nút ⋯ góc trên phải mở menu tuỳ chọn, Ctrl+V dán mọi lúc (kể cả khi popover đang mở) |
| 16.2 | ✅ | Nút đỏ ✓ đổi thành nhãn "✓ Đã chốt", bấm lần nữa bỏ chốt (có hoàn tác), đưa vào menu ⋯ và chi tiết PA; bản xuất giữ viền đỏ PA đã chốt |
| 16.3 | ✅ | Ảnh xuất fill đầy ô vuông không viền trắng kể cả khi dùng vùng nhìn (--view); mã vật liệu đè lên ảnh ở cạnh dưới (chữ trắng viền tối) |
| 16.4 | ✅ | "Copy ảnh" / "Tải PNG" / "Tải PDF A4" chạy ngay với cài đặt đã lưu; thêm "⚙ Cài đặt xuất…" trong menu ▾ cạnh Copy ảnh; tuỳ chọn Fill/Vừa và Hiện mã trên ảnh lưu theo tài khoản |
| 16.5 | ✅ | Bảng màu sơn Dulux / Jotun: nạp từ `data/paint-dulux.json` và `data/paint-jotun.json`, tìm theo mã hoặc tên, tự điền mã + hãng + swatch màu hex trong ô PA và bản xuất, lưu vào Dữ liệu dùng chung |
| 16.6 | ✅ | Mã gỗ An Cường: nạp từ `data/wood-ancuong.json`, tìm theo mã hoặc tên, tự điền mã + tên + dòng sản phẩm vào quy cách |
| 16.7 | ✅ | Popover chọn to hơn (rộng ~560 px, cao tối đa 70vh, nền be-ghi #f4f1ec, lưới ~120 px); tìm không có kết quả hiển thị fallback Google Ảnh (API qua proxy bảo mật chống SSRF, giới hạn ≤ 8 MB, hoặc nút mở tab mới kèm hướng dẫn Ctrl+V) |

Kiểm tra: `node --test` 45/45. Playwright: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7 đạt 100%.

XONG GĐ16


## Giai đoạn 17 (09/11/2026)

| Bước | Kết quả |
|---|---|
| 17.3 | Copy ảnh dựng bảng ngoài màn hình, hiện thông báo sau khi ghi clipboard. Khi lỗi, có nút Xem trước. Menu xuất vẫn mở bản xem trước theo yêu cầu. |
| 17.2 | Xoá dự án ở Lịch có hai cách: chuyển giai đoạn đến dự án được chọn, hoặc gõ tên để xoá cả giai đoạn và công việc. Có Ctrl+Z và nút Hoàn tác trong 10 giây. Giữ bảng Chốt mã và hồ sơ dự án. |
| 17.0 | Xoá ảnh thư viện và ảnh 3D cập nhật danh sách, bộ đếm và ảnh thu nhỏ ngay. Thay đổi ảnh 3D từ Hồ sơ dự án làm mới kho ảnh ở tab Chốt mã. |
| 17.1 | AI dùng tài liệu đã tải lên dự án, vẫn nhận thêm tệp và ghi chú. Server đọc tài liệu theo tài khoản và báo rõ tệp bị bỏ qua. |
| 17.4 | Hai dải xem trước có tối đa 5 ảnh một hàng, không quá 44×44 px, và nút +n. Lựa chọn ẩn ảnh được lưu theo tài khoản. |
| 17.5 | Kết nối hỗ trợ Serper.dev, Brave Search và Google CSE. Tài khoản mới mặc định Serper; giữ kết nối Google cũ. Khoá chỉ lưu trên máy chủ; giữ đường mở Google Ảnh khi chưa có khoá. |
| 17.6 | Chuyển mã gỗ An Cường sang Dữ liệu dùng chung; nhập PDF, duyệt và chỉnh khung swatch, bỏ trùng khi lưu. Chọn mã theo mã, tên hoặc catalogue và đưa swatch vào PA. Danh mục đầy đủ được bổ sung từ PDF do người dùng tải lên. |

Kiểm tra: `node --test` 51/51. Playwright: 17.3, 17.2, 17.0, 17.1, 17.4, 17.5, 17.6 và hồi quy 16.3, 16.4, 16.6, 16.7. PDF mẫu do pdf-lib tạo có 2 trang và 18 mã; ca 17.6 kiểm tra vị trí cắt theo màu, kéo khung, bỏ chọn, bỏ trùng và đưa swatch vào PA.

XONG GĐ17


## GĐ18 (GPT) · 09/11/2026

| Bước | Kết quả |
|---|---|
| 18.1 | Xoá dòng, PA và ảnh cập nhật bảng ngay. Thư viện và kho 3D ẩn ảnh trong lúc gửi yêu cầu, khôi phục nếu yêu cầu thất bại. Cache thư viện bỏ qua phản hồi phiên bản cũ. Nếu máy chủ từ chối lưu thao tác xoá trong bảng, bản nháp khôi phục mục xoá khi chưa có chỉnh sửa mới. Nếu đã sửa tiếp, giữ bản nháp và cho phép hoàn tác hoặc thử lưu lại. |
| 18.2 | Popover mở xuống khi đủ chỗ, mở lên khi gần đáy, hoặc đặt giữa khi hai phía đều thiếu chỗ. Nội dung cuộn trong khung. |
| 18.5 | Vị trí mã trong bản xuất có ba lựa chọn. Mặc định hiện trên ảnh và bỏ dòng mã lặp bên dưới. Xoá ảnh dọn mã tự điền gắn với ảnh và giữ mã gõ tay. |
| 18.6 | Copy ảnh mở hộp kết quả nhỏ với ảnh, trạng thái clipboard, Tải PNG và Mở xem lớn. Đóng bằng Esc, nút Đóng hoặc bấm nền. |
| 18.7 | Sidebar mặc định ẩn ảnh xem trước. Khi bật, ảnh tối đa 40×40 px, hai hàng và nút +n. |
| 18.4 | Tên và mã dài xuống dòng trong ô PA và trong chú thích bản xuất. |
| 18.3 | Mã gỗ có hãng, catalogue và tìm không dấu. Nhập PDF hỗ trợ hãng tự nhập. Dữ liệu gỗ cũ được gán An Cường. |
| 18.10 | Kéo ảnh giữa các ô cùng loại dùng lại full/thumb. Giữ Shift để chuyển ảnh. Có dấu vị trí thả và hoàn tác. |
| 18.9 | Bảng mới, bản sao và bảng do AI tạo có hậu tố phiên bản theo tên gốc trong từng dự án. Ngày được thêm nếu phiên bản đề xuất trùng. |
| 18.8 | Hộp thư viện và các bộ chọn hiện Tìm trên mạng khi còn dưới bốn kết quả phù hợp. Ảnh tải qua proxy, có thể đưa vào ô và bỏ tích nếu không muốn lưu thêm vào hạng mục thư viện. |

`node --test` đạt 51/51. Playwright đạt cả 10 ca GĐ18-GPT và 8 ca hồi quy GĐ16–17. Ca 18.1 giả lập mạng trễ 1,5 giây và lỗi 503. Ca 18.10 kiểm tra không có request tải ảnh lên khi kéo thả. Phần GPT dùng các điểm nối sẵn có của Chốt mã, không cần thay đổi các file dùng chung do Antigravity phụ trách.

XONG GĐ18-GPT


## GĐ19

- 19.1: Ẩn gợi ý thao tác trong ô ảnh trống khi xuất.
- 19.2: Lưu mã gỗ và màu sơn dưới dạng item thư viện.
- 19.3: Thêm kích thước chuẩn, hãng, đơn vị cung cấp và bộ lọc tag.
- 19.4: Chọn dải, thao tác lô, hoàn tác và kéo thả trong thư viện.
- 19.7: Ánh xạ cột Notion với xem trước ba dòng và ghi nguồn từng trường.
- 19.5: Nhập catalogue PDF theo lô AI, đối chiếu regex, duyệt và gộp nhà cung cấp.
- 19.6: Đọc URL catalogue qua bộ tải công khai, áp dụng robots.txt và đưa ảnh vào cùng màn duyệt.

Kiểm thử cuối tại `1c06729`. `node --test` đạt **67/67**. Chạy toàn bộ `node docs/gd8-playwright.cjs` trên Edge đạt **66/66**.

| Ca Edge | Kết quả |
|---|---|
| 8.1 | Đạt |
| 8.2 | Đạt |
| 8.3 | Đạt |
| 8.4 | Đạt |
| 8.5 | Đạt |
| 8.6 | Đạt |
| 9.1 | Đạt |
| 9.2 | Đạt |
| 9.3 | Đạt |
| 9.4 | Đạt |
| 9.5 | Đạt |
| 9.6 | Đạt |
| 10.1 | Đạt |
| 10.2 | Đạt |
| 10.3 | Đạt |
| 10.3-guest | Đạt |
| 10.4 | Đạt |
| 10.5 | Đạt |
| 10.6 | Đạt |
| 10.6-recovery | Đạt |
| 12.1 | Đạt |
| 12.2 | Đạt |
| 12.3 | Đạt |
| 12.4 | Đạt |
| 12.5 | Đạt |
| 12.6 | Đạt |
| 12.7 | Đạt |
| 13.1 | Đạt |
| 13.2 | Đạt |
| 13.3 | Đạt |
| 13.4 | Đạt |
| 13.5 | Đạt |
| 15.1 | Đạt |
| 15.2 | Đạt |
| 15.3 | Đạt |
| 16.1 | Đạt |
| 16.2 | Đạt |
| 16.3 | Đạt |
| 16.4 | Đạt |
| 16.5 | Đạt |
| 16.6 | Đạt |
| 16.7 | Đạt |
| 17.0 | Đạt |
| 17.1 | Đạt |
| 17.2 | Đạt |
| 17.3 | Đạt |
| 17.4 | Đạt |
| 17.5 | Đạt |
| 17.6 | Đạt |
| 18.1 | Đạt |
| 18.2 | Đạt |
| 18.3 | Đạt |
| 18.4 | Đạt |
| 18.5 | Đạt |
| 18.6 | Đạt |
| 18.7 | Đạt |
| 18.8 | Đạt |
| 18.9 | Đạt |
| 18.10 | Đạt |
| 19.1 | Đạt |
| 19.2 | Đạt |
| 19.3 | Đạt |
| 19.4 | Đạt |
| 19.5 | Đạt |
| 19.6 | Đạt |
| 19.7 | Đạt |

XONG GĐ19

## GĐ19 bổ sung

| Bước | Kết quả |
|---|---|
| 19.11 | Nhập cây thư mục, xem trước và sửa tag theo đường dẫn. PDF vào màn nhập catalogue. |
| 19.8 | Bố cục An Cường cắt ảnh vân, tách mã, loại vật liệu, bề mặt và tên. Thêm lọc tông, vân và bộ sưu tập. |
| 19.9 | Bố cục Phào chỉ giữ mặt cắt và mã. Đệm màu viền vào ô vuông và chuyển lại ảnh gốc trên từng mẫu. |
| 19.10 | Thư viện Phụ kiện bếp có nhóm con và lọc rộng tủ. Mỗi dòng bảng mã lưu thành một mẫu cùng ảnh, có giá nội bộ. |

Kiểm thử tại `e0f475b`. `node --test` đạt **67/67**. Toàn bộ Playwright Edge đạt **70/70**, mã thoát 0.

| Ca Edge | Kết quả |
|---|---|
| 8.1 | Đạt |
| 8.2 | Đạt |
| 8.3 | Đạt |
| 8.4 | Đạt |
| 8.5 | Đạt |
| 8.6 | Đạt |
| 9.1 | Đạt |
| 9.2 | Đạt |
| 9.3 | Đạt |
| 9.4 | Đạt |
| 9.5 | Đạt |
| 9.6 | Đạt |
| 10.1 | Đạt |
| 10.2 | Đạt |
| 10.3 | Đạt |
| 10.3-guest | Đạt |
| 10.4 | Đạt |
| 10.5 | Đạt |
| 10.6 | Đạt |
| 10.6-recovery | Đạt |
| 12.1 | Đạt |
| 12.2 | Đạt |
| 12.3 | Đạt |
| 12.4 | Đạt |
| 12.5 | Đạt |
| 12.6 | Đạt |
| 12.7 | Đạt |
| 13.1 | Đạt |
| 13.2 | Đạt |
| 13.3 | Đạt |
| 13.4 | Đạt |
| 13.5 | Đạt |
| 15.1 | Đạt |
| 15.2 | Đạt |
| 15.3 | Đạt |
| 16.1 | Đạt |
| 16.2 | Đạt |
| 16.3 | Đạt |
| 16.4 | Đạt |
| 16.5 | Đạt |
| 16.6 | Đạt |
| 16.7 | Đạt |
| 17.0 | Đạt |
| 17.1 | Đạt |
| 17.2 | Đạt |
| 17.3 | Đạt |
| 17.4 | Đạt |
| 17.5 | Đạt |
| 17.6 | Đạt |
| 18.1 | Đạt |
| 18.2 | Đạt |
| 18.3 | Đạt |
| 18.4 | Đạt |
| 18.5 | Đạt |
| 18.6 | Đạt |
| 18.7 | Đạt |
| 18.8 | Đạt |
| 18.9 | Đạt |
| 18.10 | Đạt |
| 19.1 | Đạt |
| 19.2 | Đạt |
| 19.3 | Đạt |
| 19.4 | Đạt |
| 19.5 | Đạt |
| 19.6 | Đạt |
| 19.7 | Đạt |
| 19.8 | Đạt |
| 19.9 | Đạt |
| 19.10 | Đạt |
| 19.11 | Đạt |

XONG GĐ19 BỔ SUNG

## GĐ20

| Mục | Thay đổi | Kiểm thử |
|---|---|---|
| 20.1 | Bố cục An Cường nhận thẻ theo QR, cắt sát ô vân, đọc mã từ lớp văn bản và chỉ dùng AI trên trang có mẫu QR nhưng thiếu lớp văn bản. Mã sai định dạng được bỏ chọn và gắn cờ kiểm tra. | Node 67/67. Playwright Edge đạt 20.1, 19.8, 17.6, 19.5, 19.9, 19.10. |

### GĐ20 còn lại

| Mục | Commit | Nội dung đã kiểm thử | Kết quả |
|---|---|---|---|
| 20.1-SỬA | `67f215f` | Ảnh An Cường gồm ô vân, mã, tên và QR. PA lưu vùng nhìn mặc định trên phần vân. | Đạt |
| 20.7 | `3de8261` | Full 1600 px và thumb 480 px giữ tỷ lệ. Kiểu Cắt đầy ô, Vừa khung và Lấp nền lưu riêng. | Đạt |
| 20.6 | `7aa1199` | Lô AI có mô tả và ảnh minh hoạ. Khung cắt theo tỷ lệ mẫu, mẫu có tên lưu theo hạng mục và hãng trên trình duyệt. | Đạt |
| 20.8 | `9c45395` | Nháy đúp mở ảnh, lưu vùng nhìn khi chuyển mã, F2 sửa mã và tên. | Đạt |
| 20.5 | `79b67ac` | Lưới gọn, chi tiết riêng, quét chọn, giữ Alt để bỏ chọn và gán thuộc tính hàng loạt. | Đạt |
| 20.2 | `795c41a` | Hai mã vừa nhập xuất hiện cùng ảnh trong bộ chọn gỗ của PA mà không cần tải lại. | Đạt |
| 20.3 | `b351eb6` | Chọn B thay cả ảnh và mã của A. Hoàn tác khôi phục A, ảnh dán sau đó được đánh dấu thủ công. | Đạt |
| 20.4 | `cfed37e` | Nhóm mã theo chuẩn hoá, độ giống và hash ảnh. Gộp theo tài khoản, nối tham chiếu PA và hoàn tác. | Đạt |
| Hoàn thiện | `e8f889a` | Khung ảnh PNG giữ tỷ lệ và đúng nền theo kiểu hiển thị. Lưới thư viện tách dòng mã và tên. | Đạt |

Lượt hồi quy đầu phát hiện ca 19.6 còn trỏ ô nhà cung cấp vào thẻ cũ. Đã cập nhật ca để kiểm tra giá trị, sửa và lưu nhà cung cấp từ panel chi tiết. Chạy lại riêng 19.6 và 20.5 đều đạt.

### Kiểm thử cuối trên `023a4c7`

- `node --test` đạt 68/68.
- `node docs/gd8-playwright.cjs` trên Microsoft Edge đạt 78/78.

| Ca Edge | Kết quả |
|---|---|
| 8.1 | Đạt |
| 8.2 | Đạt |
| 8.3 | Đạt |
| 8.4 | Đạt |
| 8.5 | Đạt |
| 8.6 | Đạt |
| 9.1 | Đạt |
| 9.2 | Đạt |
| 9.3 | Đạt |
| 9.4 | Đạt |
| 9.5 | Đạt |
| 9.6 | Đạt |
| 10.1 | Đạt |
| 10.2 | Đạt |
| 10.3 | Đạt |
| 10.3-guest | Đạt |
| 10.4 | Đạt |
| 10.5 | Đạt |
| 10.6 | Đạt |
| 10.6-recovery | Đạt |
| 12.1 | Đạt |
| 12.2 | Đạt |
| 12.3 | Đạt |
| 12.4 | Đạt |
| 12.5 | Đạt |
| 12.6 | Đạt |
| 12.7 | Đạt |
| 13.1 | Đạt |
| 13.2 | Đạt |
| 13.3 | Đạt |
| 13.4 | Đạt |
| 13.5 | Đạt |
| 15.1 | Đạt |
| 15.2 | Đạt |
| 15.3 | Đạt |
| 16.1 | Đạt |
| 16.2 | Đạt |
| 16.3 | Đạt |
| 16.4 | Đạt |
| 16.5 | Đạt |
| 16.6 | Đạt |
| 16.7 | Đạt |
| 17.0 | Đạt |
| 17.1 | Đạt |
| 17.2 | Đạt |
| 17.3 | Đạt |
| 17.4 | Đạt |
| 17.5 | Đạt |
| 17.6 | Đạt |
| 18.1 | Đạt |
| 18.2 | Đạt |
| 18.3 | Đạt |
| 18.4 | Đạt |
| 18.5 | Đạt |
| 18.6 | Đạt |
| 18.7 | Đạt |
| 18.8 | Đạt |
| 18.9 | Đạt |
| 18.10 | Đạt |
| 19.1 | Đạt |
| 19.2 | Đạt |
| 19.3 | Đạt |
| 19.4 | Đạt |
| 19.5 | Đạt |
| 19.6 | Đạt |
| 19.7 | Đạt |
| 19.8 | Đạt |
| 19.9 | Đạt |
| 19.10 | Đạt |
| 19.11 | Đạt |
| 20.1 | Đạt |
| 20.2 | Đạt |
| 20.3 | Đạt |
| 20.4 | Đạt |
| 20.5 | Đạt |
| 20.6 | Đạt |
| 20.7 | Đạt |
| 20.8 | Đạt |

XONG GĐ20

## GĐ20 bổ sung lần 3

- 20.17. Khi đọc kích thước cũ dạng mảng hoặc danh sách phân tách bằng dấu phẩy/chấm phẩy, thư viện chỉ dùng giá trị đầu tiên. Kích thước được lưu thành một chuỗi. Mục chưa có kích thước hợp lệ để trống.

| Mục | Commit | Nội dung đã kiểm thử | Kết quả |
|---|---|---|---|
| 20.15 | `ce2a2d6` | Reset khi đổi hạng mục, bỏ lọc hết hiệu lực và có nút Bỏ lọc khi danh sách trống. | Đạt |
| 20.17 | `aa5f8b4` | Mỗi mẫu dùng một kích thước. Chọn giá trị khác thay lựa chọn cũ. | Đạt |
| 20.16 | `4d36c1d` | Nhóm lọc có số đếm và nút gập ở cột trái. Màn hẹp dùng ngăn kéo. | Đạt |
| 20.18 | `cd65408` | Sắp theo yêu thích và lượt dùng, có số lượt, thời điểm dùng và hoàn tác gắn sao. | Đạt |
| 20.11 | `9423d0b` | Danh mục thuộc tính theo tài khoản. Đổi tên, gộp, xoá có cập nhật các mẫu đang dùng. | Đạt |
| 20.9 | `fc7ef15` | Lịch sử nguồn theo URL chuẩn hoặc hash. Mở kết quả và bỏ qua mã hoặc ảnh đã có. | Đạt |
| 20.10 | `5187f7e` | Theo phân trang qua bộ tải an toàn, tự lưu với tag Chưa duyệt và duyệt hàng loạt. | Đạt |
| 20.12 | `f1a1fca` | PDF, link và ảnh thư mục cùng một hàng đợi. Chạy tối đa hai nguồn, giữ thiết lập riêng. | Đạt |
| 20.13 | `850bbd9` | Bảng chọn cao hết vùng nhìn, neo cạnh ô, nhớ độ rộng và mở toàn màn hình ở màn hẹp. | Đạt |
| 20.14 | `8fcf867` | Mã An Cường có ảnh xuất hiện ở Mã gỗ và Ảnh mẫu, kể cả khi nhập ngoài hạng mục Mã gỗ. | Đạt |
| Hoàn thiện | `d837e07` | Hạng mục có ô chọn và số đếm trong bảng chọn và hộp quản lý. | Đạt |
| Hoàn thiện | `f6e7893` | Dừng nhập giữ mẫu đã tải được, ghi trạng thái Dở và số mẫu đã lưu. | Đạt |

Ca 20.14 kiểm tra phiên Google trên máy chủ thử với phản hồi tokeninfo giả lập. Khi nhập lại PDF từ lịch sử, bộ nhập yêu cầu chọn lại tệp gốc.

### Kiểm thử cuối trên `a633449`

- `node --test` đạt 72/72.
- `node docs/gd8-playwright.cjs` trên Microsoft Edge đạt 88/88.
- Ca 15.2 chọn đúng ảnh vừa tải lên sau khi đổi cách sắp xếp. Ca 18.1 vẫn yêu cầu xoá ảnh khỏi giao diện trước khi máy chủ giả lập trả lời.

| Ca Edge | Kết quả |
|---|---|
| 8.1 | Đạt |
| 8.2 | Đạt |
| 8.3 | Đạt |
| 8.4 | Đạt |
| 8.5 | Đạt |
| 8.6 | Đạt |
| 9.1 | Đạt |
| 9.2 | Đạt |
| 9.3 | Đạt |
| 9.4 | Đạt |
| 9.5 | Đạt |
| 9.6 | Đạt |
| 10.1 | Đạt |
| 10.2 | Đạt |
| 10.3 | Đạt |
| 10.3-guest | Đạt |
| 10.4 | Đạt |
| 10.5 | Đạt |
| 10.6 | Đạt |
| 10.6-recovery | Đạt |
| 12.1 | Đạt |
| 12.2 | Đạt |
| 12.3 | Đạt |
| 12.4 | Đạt |
| 12.5 | Đạt |
| 12.6 | Đạt |
| 12.7 | Đạt |
| 13.1 | Đạt |
| 13.2 | Đạt |
| 13.3 | Đạt |
| 13.4 | Đạt |
| 13.5 | Đạt |
| 15.1 | Đạt |
| 15.2 | Đạt |
| 15.3 | Đạt |
| 16.1 | Đạt |
| 16.2 | Đạt |
| 16.3 | Đạt |
| 16.4 | Đạt |
| 16.5 | Đạt |
| 16.6 | Đạt |
| 16.7 | Đạt |
| 17.0 | Đạt |
| 17.1 | Đạt |
| 17.2 | Đạt |
| 17.3 | Đạt |
| 17.4 | Đạt |
| 17.5 | Đạt |
| 17.6 | Đạt |
| 18.1 | Đạt |
| 18.2 | Đạt |
| 18.3 | Đạt |
| 18.4 | Đạt |
| 18.5 | Đạt |
| 18.6 | Đạt |
| 18.7 | Đạt |
| 18.8 | Đạt |
| 18.9 | Đạt |
| 18.10 | Đạt |
| 19.1 | Đạt |
| 19.2 | Đạt |
| 19.3 | Đạt |
| 19.4 | Đạt |
| 19.5 | Đạt |
| 19.6 | Đạt |
| 19.7 | Đạt |
| 19.8 | Đạt |
| 19.9 | Đạt |
| 19.10 | Đạt |
| 19.11 | Đạt |
| 20.1 | Đạt |
| 20.2 | Đạt |
| 20.3 | Đạt |
| 20.4 | Đạt |
| 20.5 | Đạt |
| 20.6 | Đạt |
| 20.7 | Đạt |
| 20.8 | Đạt |
| 20.9 | Đạt |
| 20.10 | Đạt |
| 20.11 | Đạt |
| 20.12 | Đạt |
| 20.13 | Đạt |
| 20.14 | Đạt |
| 20.15 | Đạt |
| 20.16 | Đạt |
| 20.17 | Đạt |
| 20.18 | Đạt |

XONG GĐ20

## GĐ21

| Bước | Thay đổi và kiểm thử |
| --- | --- |
| 21.6 | Hộp thư viện cao cố định. Danh sách hạng mục cuộn riêng, nút thêm ở đáy, các thao tác quản lý nằm trong menu ⋯ và dải thêm ảnh có thể gập. Node 78/78. Edge 21.6, 20-category-merge-target, 20-library-ui, 20.16, 17.0 đạt. |
| 21.1 | Dò biên ảnh nhúng và vùng ảnh raster, ghép mã theo vị trí, giữ khung trong biên mẫu và đưa khung mơ hồ vào Cần kiểm tra. AI chỉ nhận trang chưa ghép được ảnh với mã. Node 78/78. Edge 21.1 và 9 ca PDF hồi quy đạt. |
| 21.2 | Giới hạn tốc độ theo khóa, đọc RetryInfo, thử lại có jitter, đổi khóa dự phòng và tiếp tục job từ trang chưa xử lý. Kết nối hiển thị số yêu cầu trong ngày và cấu hình model. Node 80/80. Edge 21.2 và 7 ca hồi quy đạt. |
| 21.3 | Chọn ảnh Product, OG, gallery và srcset lớn. Đọc kích thước ảnh thật và lọc SHA-256 trùng trước khi nén. Node 81/81. Edge 21.3 và 5 ca nhập web đạt. |
| 21.5 | Cấu hình nhóm lọc theo hạng mục, tìm trong nhóm, thêm thuộc tính riêng. Node 82/82. Edge 9/9. |
| 21.4 | Giá nội bộ, ẩn mặc định theo tài khoản, lọc/sắp xếp, đặt giá hàng loạt. Nhận giá PDF/web khi đọc được và đưa vào Excel mua hàng khi chọn cột giá. Node 83/83. Edge 8/8. |
| 21.7 | Rà soát 4 trang và các hộp chính ở 4 chiều rộng, sửa tràn và focus, lưu ảnh trước/sau. 720 mẫu, mở 105,3 ms, lọc 61 ms, tìm 70,1 ms. Node 83/83. Edge 9/9 sau sửa. |

### Toàn bộ Playwright Edge

Đạt 101/101 ca. Trên máy kiểm thử cục bộ, thư viện 720 mẫu mở trong 104.2 ms, lọc trong 60.4 ms và tìm trong 69.1 ms.

| Nhóm | Số ca đạt | Ca kiểm thử |
| --- | ---: | --- |
| 8 | 6 | 8.1, 8.2, 8.3, 8.4, 8.5, 8.6 |
| 9 | 6 | 9.1, 9.2, 9.3, 9.4, 9.5, 9.6 |
| 10 | 8 | 10.1, 10.2, 10.3, 10.3-guest, 10.4, 10.5, 10.6, 10.6-recovery |
| 12 | 7 | 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7 |
| 13 | 5 | 13.1, 13.2, 13.3, 13.4, 13.5 |
| 15 | 3 | 15.1, 15.2, 15.3 |
| 16 | 7 | 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7 |
| 17 | 7 | 17.3, 17.2, 17.0, 17.1, 17.4, 17.5, 17.6 |
| 18 | 10 | 18.6, 18.1, 18.7, 18.2, 18.5, 18.4, 18.3, 18.10, 18.9, 18.8 |
| 19 | 11 | 19.5, 19.1, 19.2, 19.3, 19.4, 19.7, 19.6, 19.11, 19.8, 19.9, 19.10 |
| 20 | 24 | 20.6, 20.1, 20.5, 20.2, 20.3, 20.4, 20.15, 20-drive-menu, 20-library-ui, 20-category-merge-target, 20.17, 20.16, 20.18, 20.11, 20.9, 20.10, 20.12, 20.12-bulk, 20.6-code, 20-pdf-fallback, 20.13, 20.14, 20.7, 20.8 |
| 21 | 7 | 21.6, 21.4, 21.5, 21.3, 21.1, 21.2, 21.7 |

XONG GĐ21

### Bổ sung 21.8 · Cắt catalogue Phào chỉ

Chọn bố cục Phào chỉ khi mở nhập catalogue từ hạng mục Phào chỉ. Ghép từng thanh dài với mã bên dưới, đọc sơ đồ kích thước cùng cột và giữ mã trên ảnh theo công tắc. Các mã chưa ghép được ảnh mở vùng cắt cục bộ để duyệt.

Node 83/83. Edge đạt 21.8, 21.1, 19.9, 20.7, 20.8 và 20-pdf-fallback. PDF mô phỏng từ ảnh tham chiếu tách đủ 20 khung và đọc đúng 20 kích thước. Thư mục docs/gd21/local chưa có trên máy kiểm thử.

Toàn bộ Playwright Edge sau bản bổ sung đạt 102/102 ca.

### 21.9 · Tách hàng Phào chỉ và đọc hết PDF

Ảnh nhúng chứa nhiều hàng được tách theo dải mã. Mẫu scan có thanh nhận diện được hiện ở Cần nhập mã. Trang trống hoặc lỗi có thông báo riêng và bộ đọc tiếp tục sang trang sau. Node 83/83. Edge 8/8, gồm PDF 4 trang có ảnh nhúng nối hai thanh, một trang trống và một trang scan.
Bổ sung sau khi đọc đặc tả phần 2. Edge xác nhận đọc đủ 40/40 trang, giữ nhật ký từng trang bỏ qua và vẫn nhận được mẫu ở trang 40.

### 21.10 · Adapter An Cường và bộ lọc từ web

Đọc 423/423 thẻ trong HTML Melamine, lấy ảnh đầy đủ từ products-full, tách mã và giữ rawCode. Lưu nhóm lọc theo hạng mục, có chip màu, cập nhật mẫu trùng và đổi ảnh khi độ phân giải tăng. Website khác có cấu trúc lặp được suy ra nhóm và có bước xem trước để đổi tên hoặc bỏ nhóm. Node 85/85. Edge 6/6 qua hai lượt, gồm nhập lại giữ ID và thay ảnh, chỉnh ánh xạ trước khi lưu.

### 21.11 · Tìm và lưu bộ lọc thông minh

Giữ giá trị có số đếm 0, hiển thị chip đang chọn, tìm không dấu theo nhiều từ trong mã, tên, tag và thuộc tính, có gợi ý. Bộ lọc nhanh lưu theo tài khoản và hạng mục. Ảnh tải tay và mẫu PDF được gợi ý màu, tông và vật liệu còn thiếu, có nhãn Tự đoán và có thể sửa từng giá trị. Node 85/85. Edge 13/13, có thêm ca Phào chỉ nối bóng qua khe 3 px và kiểm tra đoán màu từ riêng thanh phào.

21.10 bổ sung sau hồi quy. Dùng chung robots.txt theo nguồn trong 15 phút và giãn yêu cầu ở máy chủ 500 ms theo origin, kể cả khi chuyển hướng. Node 86/86 và 4 ca Edge nhập web đạt.

### Kiểm thử cuối GĐ21 phần 2

Toàn bộ Playwright Edge trên 7dbf8d1 đạt 105/105 ca. Node đạt 86/86.

| Mục | Kiểm chứng |
| --- | --- |
| 21.9 | Duyệt 40/40 trang. Tách hai thanh nối bóng qua khe 3 px. Ghi số trang và lý do bỏ qua. |
| 21.10 | Đọc 423/423 thẻ từ HTML Melamine công khai. Ca Edge kiểm tra cập nhật ảnh và thuộc tính cùng ID, chỉnh ánh xạ nhóm trước khi lưu. |
| 21.11 | Tìm oak sh, giữ giá trị đếm 0, bỏ từng chip, khôi phục bộ lọc sau tải lại và sửa màu tự đoán. |

XONG GĐ21
