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

## 3f. Cập nhật 07/11/2026 - lần 5 (cấu trúc mới, Gist, Gmail)
- **Cấu trúc 3 cấp:** `projectOwners` = DỰ ÁN (quản lý), `calendars` = GIAI ĐOẠN (`ownerId` trỏ về dự án), `tasks` = CÔNG VIỆC. Tên khoá dữ liệu giữ nguyên. Timeline có dòng Dự án (WBS 1) → Giai đoạn (1.1) → Việc (1.1.1); XML MS Project xuất/nhập 3 cấp. Phạm vi mặc định `mspScope = 'active-project'` (chỉ hiện dự án đang chọn). Hàm: `getProjectOfCalendar`, `getActiveProject`, `getMspTargetCalendars`.
- **Thư viện tiêu đề** trong bảng tạo nhanh: `TASK_TITLE_LIBRARY` (6 nhóm) + `AppState.customTaskTitles` ("Của tôi", lưu server).
- **Server:** lưu trữ `FileStore` (mặc định) hoặc `GistStore` khi có `GIST_TOKEN` (tự tìm/tạo Gist bí mật "GD HOME - du lieu lich tien do", file `data.json` + `user-<email>.json`). Đăng nhập Google khi có `GOOGLE_CLIENT_ID` (`/api/config`, `/api/auth/google`, `/api/import-legacy`), phiên ký HMAC 30 ngày. Hướng dẫn: `HUONG-DAN-CAI-DAT.md`.
- **Client:** `bootstrapAuthAndData()`, màn hình đăng nhập, khoá localStorage theo email (`getLocalStateKey`). Tự phát hiện server bị reset (phiên bản server < phiên bản trình duyệt đã lưu) → hỏi giữ bản trên máy.
- `.bat` không còn đẩy `data.json` lên GitHub.
- Xuất ảnh Timeline: không còn tự chèn tên khách hàng (ô ẩn) sau tiêu đề; tiêu đề để trống thì xuất trống. Sọc chéo chìm rõ hơn (alpha 0.13). Ngày mùng 1: nhãn đỏ trên nền đỏ rất nhạt.

## 3g. Trạng thái triển khai (07/11/2026 16:05)
- Render: https://gdhome-calendar.onrender.com (service srv-dbfg4bks728c73fas8vg), commit 81fa8a2. Env: `GIST_TOKEN` (GitHub classic token "gdhome-gist", quyền gist, không hết hạn), `GOOGLE_CLIENT_ID` = 683671728426-bbmsuj7jpu621a1s2f38f23pe5mrevnf.apps.googleusercontent.com. Render KHÔNG tự deploy khi push -> cần bấm Manual Deploy > Deploy latest commit.
- /api/health: auth=google, storage=gist (Gist 381e7840dba484fda0cf7b95f7e6420c).
- Google Cloud project `gd-home-lich-tien-do` (tài khoản ktduc.mx@gmail.com), OAuth client "GD HOME Web", origins: https://gdhome-calendar.onrender.com, http://localhost:3000. Đang ở chế độ Testing, test users: ktduc.mx@gmail.com, ktduc.gd@gmail.com. Muốn mọi Gmail đăng nhập: cần thêm trang chính sách quyền riêng tư + homepage ở Branding rồi Publish.

## 3h. Mới hoàn thành (07/11/2026 - Task 1 → 5 trong GIAO-VIEC-ANTIGRAVITY.md)
1. **Task 1 (Ngày mùng 1 đồng nhất màn hình & ảnh xuất)**: Gộp 2 khối CSS trùng của `.day-month-label.is-month-first` thành 1 chỗ duy nhất (`color: #dc2626; font-weight: 800; font-size: 15px;`, bỏ nền đỏ `#fee2e2`). Với `.msp-gantt-day-cell.is-month-first` chỉ giữ vạch dọc đỏ `box-shadow: inset 2px 0 0 #dc2626`, bỏ `background-color: #fef2f2`.
2. **Task 2 (Sọc chéo chìm & chữ chìm chống chỉnh sửa ảnh)**: Cập nhật `applyAntiEditWatermark(canvas)` với lớp sọc chéo chính (`globalAlpha = 0.20`, `lineWidth = 1.6 * unit`, `gap = 14 * unit`), lớp chéo ngược (`0.08`), và chữ chìm lặp lại `"GD HOME"` nghiêng `-30°` (`alpha = 0.06`, font `18px * unit`). Mặc định `AppState.exportWatermark = true`. Thêm `?v=20261107` sau `style.css`, `holidays-data.js`, `scheduler.js`, `app.js` trong `index.html`.
3. **Task 3 (Chế độ KHÁCH không cần đăng nhập)**: Thêm nút `#btn-guest-mode` (`"👤 Dùng thử – chế độ khách (không cần đăng nhập)"`) trong `#login-overlay`. Bấm vào khởi tạo dữ liệu trống (`1` dự án `"DỰ ÁN MỚI"` + `1` giai đoạn `"GIAI ĐOẠN 1"`, `0` việc), chỉ lưu trình duyệt tại `timeline_calendar_state::guest` và cờ `gdhome_guest = '1'`, không gọi `/api/schedule`. Header hiện chip `"👤 Khách"` + nút `"Đăng nhập"` (hỏi chép dữ liệu khách vào tài khoản khi đăng nhập Gmail); `setSaveStatus` hiện `"💾 Chế độ khách – chỉ lưu trên máy này"`.
4. **Task 4 (Tối ưu thanh Header 56px)**: Gom gọn thành menu `"📁 File ▾"` (Mở `.xml/.csv/.json`, Xuất MS Project `.xml`, Xuất JSON sao lưu), cụm `"📋 Copy ảnh"` + `"▾"` (Xuất ảnh tuỳ chọn, Chọn vùng xuất), 2 nút icon Undo/Redo cạnh nhau (`34×34px`), nút `"＋ Thêm việc"` nổi bật, và nút chọn khoảng tháng gọn `"Tháng MM/YYYY → MM/YYYY ▾"` bung popover. Giữ nguyên toàn bộ `id` nút cũ; chữ trên các nút chính ("File", "Copy ảnh", "Thêm việc") luôn hiển thị rõ từ `1024px` đến `3440px`.
5. **Task 5 (Review & dọn code)**: Gộp các selector lặp ở cuối `style.css` (`.sidebar-compact`, `.msp-summary-dur-*`); bỏ gọi `normalizeAppState()` thừa trong `getActiveCalendar` / `getVisibleTasks`; tách `renderMSProjectView` thành các hàm con (`renderMspKpiSummary`, `renderMspDayHeaders`, `renderMspProjectHeaderRow`, `renderMspGridBackground`, `renderMspDependencyArrows`); thêm nút ẩn/hiện 3 nút thiết kế (`3D / CHỈNH SỬA 3D / HSKT`) trên bảng tạo nhanh (`#btn-toggle-design-tags`). Pass 14/14 unit test (`npm test`).

## 3i. Chỉnh thêm 07/11/2026 (Claude, sau Antigravity)
- Sọc chìm ảnh xuất: CHỈ 1 chiều "/" (phải → trái, trên xuống), nét dày 5px*unit, rất nhạt (alpha 0.05), cách 34px*unit; bỏ chiều ngược & chữ "GD HOME".
- Dòng DỰ ÁN trên Timeline: nền xám xanh sáng hơn (#52637a), chữ trắng (cả trên màn hình lẫn ảnh xuất).
- Thanh tổng giai đoạn/dự án mỏng (5–6px) và màu xám xanh thay vì đen.
- Tên dự án trên tiêu đề: theo dự án đang hiển thị (`getTitleProject(mode)`); từ 2 dự án trở lên thì ẩn ô tên dự án.
- Tháng lập bảng tự theo tháng hiện tại (`getAutoScheduleMonth`); tự gõ tháng khác chỉ giữ trong tháng đó (`scheduleMonthManualFor`). Chọn khoảng tháng xem KHÔNG còn đổi tháng lập bảng.
- Cache file tĩnh: `?v=20261107b`.

- Copy/xuất ảnh Bảng Lịch (nút Copy ảnh & phạm vi "Toàn bộ"): chỉ giữ các tuần có công việc, bỏ tuần trống (`getWeeksWithTasks`). Chọn vùng / theo ngày tuỳ chọn vẫn giữ nguyên. Cache `?v=20261107c`.

- Sọc chìm ảnh xuất: nét 1px, cách 3px*unit (≈9% khoảng cách cũ), alpha 0.035. Sidebar nền xám nhạt #eef1f5, các khối trắng. Lọc Timeline "1/2 tuần tới": nhãn vàng `#msp-scope-badge` sau tên dự án trên tiêu đề (có cả trong ảnh xuất). Cache `?v=20261107d`.

## 3j. Đợt 07/11/2026 (Claude): Esc, tiêu đề cố định, độ đậm chữ, Notion, AI
- **Esc** (`handleEscapeKey`): đóng lần lượt lớp trên cùng – menu chuột phải → menu thả header → bảng tạo nhanh → hộp thoại (`.modal-overlay.active`, trừ đăng nhập) → chế độ cắt vùng → vùng quét chọn → bỏ focus ô nhập → bỏ chọn nhiều việc.
- **Tiêu đề ngày/thứ cố định khi cuộn** (Timeline): `updateStickyHeaders` dùng `translateY` cho `.msp-table-header` + `.msp-gantt-header` (khung Gantt có overflow-x nên CSS sticky không ăn); gọi cuối `renderMSProjectView` + sự kiện scroll (capture). Ảnh xuất reset transform. Bảng Lịch đã có `.sheet-sticky-top` sẵn.
- **Độ đậm chữ** Timeline: `AppState.mspFontWeight` (light/normal/bold/heavy), nút `#msp-font-weight-btns`, class `msp-fw-*` trên `.msp-split-workspace`; đậm dùng `-webkit-text-stroke` để giữ thứ bậc chữ.
- **Sọc chìm**: cách `3.45*unit` (+15%), nét `1.2px` (+20%).
- **Notion** (`integrations.js`, env `NOTION_TOKEN`, `NOTION_DATABASE_ID`): `/api/notion/push`, `/api/notion/pull`; tự thêm cột Dự án/Giai đoạn/Tiến độ/GDHomeID; task lưu `notionPageId`, `notionSyncedAt`. UI: File ▾ → Đồng bộ Notion… (`#notion-sync-modal`).
- **AI lập tiến độ** (env `ANTHROPIC_API_KEY`, tuỳ chọn `AI_MODEL`, `AI_DAILY_LIMIT`, `AI_ALLOWED_EMAILS`): `/api/ai/schedule` nhận ảnh (thu nhỏ 1568px), PDF, text Excel (SheetJS 0.18.5 cdnjs nạp khi cần) → AI trả JSON `{stageName, tasks:[{name, workDays, dependsOn:[{index,type,lag}]}], questions}`; client tự tính ngày theo lịch nghỉ, bảng duyệt, "Co giãn cho vừa hạn", tạo việc + liên kết FS/SS. UI: nút ✨ AI (`#ai-planner-modal`).
- `/api/config` và `/api/health` trả `features: {notion, ai}`. `integrations.js` đã thêm vào `Cap-Nhat-Web-Len-Mang.bat` (BẮT BUỘC đẩy lên, thiếu là server lỗi). Hướng dẫn: `HUONG-DAN-NOTION-AI.md`. Cache `?v=20261107e`.

## 4. Các script hỗ trợ trên Desktop
- `C:\Users\KTDUC\Desktop\Mo-Web-Lich-Tien-Do.bat`: Nháy đúp để khởi động nhanh server `localhost:3000` và tự mở trình duyệt.
- `C:\Users\KTDUC\Desktop\Cap-Nhat-Web-Len-Mang.bat`: Nháy đúp để tự động commit và đẩy code lên GitHub / Render.com.
- `C:\Users\KTDUC\Desktop\gdhome-calendar-files\index.html`: Bản chạy offline trực tiếp không cần server.

---

## 5. Hướng dẫn bàn giao cho Claude
Khi chuyển sang Claude, hãy gửi đoạn tóm tắt dưới đây để Claude nắm trọn vẹn ngữ cảnh và tiếp tục phát triển ngay mà không cần khảo sát lại từ đầu.
