# BÀN GIAO DỰ ÁN: GD HOME - LẬP TIẾN ĐỘ THI CÔNG & MS PROJECT TIMELINE (GANTT)

## 1. Vị trí mã nguồn & Tài nguyên trên máy
- **Thư mục làm việc chính**: `C:\Users\KTDUC\.gemini\antigravity\scratch\timeline-calendar`
- **Thư mục đồng bộ dự phòng ngoài Desktop**: `C:\Users\KTDUC\Desktop\gdhome-calendar-files`
- **GitHub Repository**: `https://github.com/ktduc/gdhome-calendar.git` (nhánh `main`)
- **Web Server local**: Node.js HTTP server chạy trên cổng `3000` (`http://localhost:3000` hoặc mạng LAN `http://192.168.100.220:3000`).

---

## 2. Kiến trúc & Công nghệ dự án
- **Frontend thuần (Vanilla JS, CSS3, HTML5)**, không dùng framework nặng, tải cực nhanh:
  - `index.html`: Giao diện chia 2 chế độ xem (Bảng Lịch Google Calendar & Biểu đồ Timeline / WBS MS Project).
  - `style.css`: Giao diện tối ưu theo chuẩn Microsoft Project & Google Calendar, hỗ trợ responsive, kéo dãn cột như Excel.
  - `app.js`: Toàn bộ logic ứng dụng (~5.600 dòng), đồng bộ 2 chiều giữa 2 chế độ xem.
  - `holidays-data.js`: Dữ liệu ngày lễ VN + phân loại (`off` nghỉ / `work` làm bù / `observance` chỉ hiển thị) + `VN_HOLIDAY_FIXES` sửa tay theo lịch chính thức.
  - `scheduler.js`: Bộ tính ngày làm việc (ngày nghỉ, 0.5 ngày T7, làm bù, ngày tự đánh dấu) + liên kết tiến độ FS (`predecessors`). Có test: `npm test`.
  - `server.js`: Node.js thuần (không cần express). `GET/POST /api/schedule`, có `_version` chống ghi đè giữa 2 máy (409), ghi file an toàn + sao lưu hằng ngày vào `backups/`, mật khẩu tuỳ chọn `APP_PASSWORD`, `DATA_DIR` cho ổ đĩa lưu trữ trên Render.
  - `tests/scheduler.test.js`: test cho bộ tính ngày.
- **Thư viện bên ngoài**:
  - `lucide` (Icon vector)
  - `html2canvas` (Chụp xuất ảnh PNG & Copy vào Clipboard không bao giờ bị cắt chữ)

---

## 3. Các tính năng cốt lõi đã hoàn thiện
1. **Đồng bộ 2 chiều hoàn hảo**:
   - Chế độ 1: Bảng lịch tháng (Google Calendar).
   - Chế độ 2: Timeline Microsoft Project (WBS bên trái + Biểu đồ Gantt bên phải).
   - Mọi thay đổi về ngày, tên việc, tiến độ, thêm/xóa mục trên bảng này đều tự động đồng bộ sang bảng kia và lưu vào `data.json` / `localStorage`.
2. **Hệ thống Hoàn tác (Undo / Redo) 50 bước**:
   - Phím tắt `Ctrl + Z` để Undo, `Ctrl + Y` để Redo.
   - Có nút Undo trên header.
3. **Quản lý Ngày nghỉ (Days Off Config)**:
   - Tùy chọn Ngày lễ Việt Nam, Chủ nhật, Cả ngày Thứ 7, hoặc Nghỉ chiều Thứ 7 (`0.5` ngày làm việc).
   - Chân trang tự động cập nhật câu ghi chú ngày làm việc.
   - Thanh Gantt có gạch chéo 1 chiều mờ dịu mắt cho các ngày nghỉ, hiển thị đồng bộ 100% khi xuất ảnh.
4. **Phân biệt Ngày làm việc & Ngày thực tế**:
   - Menu chuột phải vào công việc có tùy chọn 1-click chuyển đổi giữa Ngày làm việc (trừ ngày nghỉ, có gạch chéo) và Ngày thực tế (tính cả ngày nghỉ, không gạch chéo che chữ).
   - Dòng tiêu đề Dự án hiển thị cả 2 thông số: `... ngày LV • ... ngày TT`.
5. **Đường nối tiến độ Finish-to-Start (FS)**:
   - Vẽ bằng SVG nét mảnh (`1.15px`), bo góc tròn cong mềm mại (`r = 4px`) chuẩn MS Project.
6. **Thao tác chọn nhiều việc & Kéo di chuyển đồng thời**:
   - Checkbox từng dòng hoặc giữ `Ctrl`/`Shift` để chọn nhiều mục.
   - Kéo 1 thanh Gantt bất kỳ sẽ kéo theo toàn bộ các mục đang chọn.
   - Nút `🔃 Theo ngày` trên tiêu đề cột để tự động xếp lại theo trình tự thời gian.
7. **Tùy chỉnh giao diện & Xuất file**:
   - Tiêu đề Timeline tự gõ độc lập không bị đè.
   - Dòng Dự án chữ đỏ đậm (`#b91c1c`, 13.5px, bold 900), nền tối hơn (`#e2e8f0`).
   - 4 bộ Palette màu (mỗi bộ 20 màu, 2 hàng), có chế độ tự nhảy màu tuần tự.
   - Hỗ trợ Mở & Xuất file chuẩn định dạng Microsoft Project XML (`.xml`), CSV, JSON.
   - Xuất ảnh PNG sắc nét (2x HD) và Copy trực tiếp vào Clipboard để dán vào Zalo/Word/Photoshop.

---

## 3b. Cập nhật 07/11/2026 (Claude)
- Ngày lễ: làm bù (10/01, 22/08/2026) tính là ngày đi làm; Giáng sinh, 31/12, Phục sinh không còn bị trừ; 24/11 Ngày Văn hoá VN là ngày nghỉ (NQ 28/2026/QH16).
- Chuột phải vào ô ngày (Bảng Lịch hoặc tiêu đề ngày trên Gantt) để tự đánh dấu Ngày nghỉ riêng / Ngày đi làm (`daysOffConfig.overrides`).
- Liên kết tiến độ thật: `task.predecessors = [{id, type:'FS', lag}]`. Mũi tên, tự dịch việc phía sau, xuất/nhập XML MS Project đều theo liên kết. Dữ liệu cũ được tự nối 1 lần (chỉ nối khi việc sau bắt đầu sau khi việc trước kết thúc). Chuột phải vào việc để nối / bỏ nối.
- Undo: mọi thay đổi đều đi qua `saveToBackend()` (tự chụp Undo, gom lưu 0.6s); có mốc Undo ban đầu; Undo cũng lưu lên server.
- Trạng thái lưu hiển thị ở góc dưới trái (Đã lưu / Lỗi lưu / Chỉ lưu trên máy này).
- An toàn: escape HTML tên việc; ghim lucide@0.468.0; server không cho tải data.json/backups qua trình duyệt; .bat không còn `push --force`.

## 3c. Cập nhật 07/11/2026 - lần 2
- Timeline: giữ chuột trái & kéo ngang trên vùng trống của 1 dòng để chọn khoảng ngày -> bảng tạo nhanh việc mới (thuộc dự án của dòng đó). Nháy đúp = việc 1 ngày. Code: `setupGanttRangeSelection()`.
- Dòng Dự án: `LV` = ngày làm việc trong khoảng từ ngày bắt đầu sớm nhất đến ngày kết thúc muộn nhất của dự án (= ngày thực tế trừ ngày nghỉ), KHÔNG cộng dồn số ngày của từng việc.
- Thêm độ cao dòng "Rất thấp" (24px) và độ rộng cột "Rất rộng" (62px), "Cực rộng" (84px).
- Giao diện responsive: header tự ẩn chữ nút theo độ rộng màn hình (1024 → 3440px), cột tên tự giới hạn trên màn hình nhỏ, trục ngày Gantt kéo dài kín màn hình siêu rộng, Bảng Lịch nở rộng trên màn hình ≥2000px. Ảnh xuất KHÔNG phụ thuộc kích thước màn hình (`_mspExportRendering`).
- `Mo-Web-Lich-Tien-Do.bat` tự tắt server cũ ở cổng 3000 trước khi chạy.

## 3d. Cập nhật 07/11/2026 - lần 3
- Liên kết có 2 loại: FS (làm sau khi xong) và SS (bắt đầu cùng). Mũi tên kiểu MS Project: FS ra từ cuối thanh rồi cắm xuống đầu thanh sau; SS ra từ đầu thanh, chạy dọc xuống rồi vào đầu thanh sau. Xuất/nhập XML: Type 1 = FS, Type 3 = SS.
- Chọn dự án trong bảng "Thêm công việc" chỉ hiện các dự án cùng nhóm "Dự án của ..." với dự án đang chọn.
- Ngày mùng 1 đầu tháng: số đỏ, to hơn (Bảng Lịch + Gantt có vạch đỏ đầu tháng).
- Thanh bên trái gọn lại: 5 mục thu gọn được (Dự án / Hiển thị Timeline / Ngày nghỉ / Bảng màu / Cột & đề mục), nhớ trạng thái mở-đóng.
- Bỏ nhãn đỏ "MS PROJECT"; hàng tiêu đề cột cao 68px (+20%); KPI "Tổng: x ngày LV • y ngày TT".
- Ảnh xuất / Copy ảnh có sọc chéo chìm mờ chống chỉnh sửa (`applyAntiEditWatermark`), tắt được trong hộp "Xuất ảnh".
- Thêm 2 bảng màu: "Gạch nung / Gỉ sắt" (rust) và "Lông vũ / Nâu Đá" (eagle, đã giảm tương phản).

## 3e. Liên kết nhóm (nét đậm)
- Chọn nhiều việc -> chuột phải -> "Liên kết nhóm ... (làm lần lượt / bắt đầu cùng)": nối FS/SS, đánh dấu `link.emphasis = true` (vẽ nét đậm #0b4f8a 2.4px) và xếp các việc đứng liền nhau (`calendar.hasManualTaskOrder = true`, không tự sắp theo ngày nữa). Nút "🔃 Theo ngày" xếp lại theo thời gian. Code: `linkSelectedTasksAsGroup()`.
- Mũi tên FS đi ra từ đáy cuối thanh, chạy theo khe giữa 2 dòng -> không đè lên nhãn ngày.

## 4. Các script hỗ trợ trên Desktop
- `C:\Users\KTDUC\Desktop\Mo-Web-Lich-Tien-Do.bat`: Nháy đúp để khởi động nhanh server `localhost:3000` và tự mở trình duyệt.
- `C:\Users\KTDUC\Desktop\Cap-Nhat-Web-Len-Mang.bat`: Nháy đúp để tự động commit và đẩy code lên GitHub / Render.com.
- `C:\Users\KTDUC\Desktop\gdhome-calendar-files\index.html`: Bản chạy offline trực tiếp không cần server.

---

## 5. Hướng dẫn bàn giao cho Claude
Khi chuyển sang Claude, hãy gửi đoạn tóm tắt dưới đây để Claude nắm trọn vẹn ngữ cảnh và tiếp tục phát triển ngay mà không cần khảo sát lại từ đầu.
