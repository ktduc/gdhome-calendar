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

- **Bổ sung (07/11 tối)**: bỏ tick "Tiến độ %" ở CỘT & ĐỀ MỤC → Timeline ẩn luôn % trên nhãn dự án/giai đoạn, thanh tô tiến độ và tooltip (`mspShowProgress()`).
- **Kết nối riêng từng tài khoản** (không cần Render): `/api/integrations/settings` GET/POST; khoá Notion + AI lưu mã hoá AES-256-GCM (khoá dẫn xuất từ SESSION_SECRET) trong store key `cfg-<email>` (Gist file `user-cfg-<email>.json`). Lưu là kiểm tra thật (Notion đọc database, AI liệt kê model). AI hỗ trợ 3 nhà cung cấp: `gemini` (generateContent, tự chọn gemini-x-flash mới nhất), `openai` (chat/completions JSON mode, tự chọn gpt-N mới nhất), `anthropic`. Env cũ vẫn làm khoá chung dự phòng (thêm GEMINI_API_KEY / OPENAI_API_KEY). Cột Dự án/Giai đoạn trên Notion tạo kiểu Select để Group by. Cache `?v=20261107f`.

- **Notion đổi cách làm (theo yêu cầu)**: CHỈ đọc/ghi Tên + 1 cột Date do người dùng chọn (`notionDateProp`, ô "Lấy ngày từ cột"), KHÔNG tạo/sửa cột trên Notion. Link trang chứa inline database tự dò `child_database`. `parseNotionId` lấy 32 hex ở CUỐI đoạn link. Lịch vào dự án riêng `owner_notion` "NOTION", giai đoạn `cal_notion_<dbId>` = tên bảng; task có `notionPageId`, `notionSyncedAt`, `notionSnap` (title|start|end lúc đồng bộ). "Đồng bộ 2 chiều" = đẩy việc sửa trong app (snap khác) rồi kéo về; dòng xoá/bỏ ngày trên Notion bị bỏ khỏi app. Task Notion `skipSundays:false`. Cache `?v=20261107h`.

- **AI chạy nền**: bấm "Đề xuất tiến độ" → đọc file xong thì ẩn cửa sổ AI, hiện ô `#ai-bg-panel` góc phải dưới (đang chạy / ✅ xong → "Xem & thêm vào lịch" / ⚠ lỗi → "Mở lại"). Server `callWithFallback`: lỗi quá tải (503 high demand, 429, 5xx) → thử lại 2 lần rồi tự đổi model nhẹ hơn cùng hãng (Gemini: các bản flash / flash-lite khác), chỉ khi người dùng để trống ô Model. Cache `?v=20261107i`.

- **Tự nối liên kết**: `autoLinkTask` / `autoLinkStage` trong scheduler.js (FS với việc cùng giai đoạn kết thúc gần nhất trước đó, cách ≤ 7 ngày LV; nếu không có thì SS với việc đang chạy; chặn vòng lặp; không dời ngày). `autoLinkFreshTasks()` chạy đầu `saveToBackend`: chỉ việc id `task_<13 số>` tạo < 60 giây, chưa có link, tối đa 3 việc/lần (bỏ qua nhập file/AI/Notion). Tuỳ chọn `AppState.autoLinkNewTasks` (mặc định bật, ô "Tự nối việc mới tạo") + nút "🔗 Tự nối các việc chưa nối" (giai đoạn đang hiển thị, Ctrl+Z hoàn tác). 17 test pass. Cache `?v=20261107j`.

- **Tự nối – quy tắc mới (mốc gần nhất)**: mỗi việc ứng viên (cùng giai đoạn, bắt đầu ≤ ngày bắt đầu) tạo 1 mốc: đã xong → FS (mốc = ngày LV sau khi kết thúc); còn đang chạy → SS (mốc = ngày bắt đầu). Chọn mốc muộn nhất (≤ ngày bắt đầu, cách ≤ 7 ngày LV); bằng nhau ưu tiên SS; nhiều việc bắt đầu cùng ngày toả ra từ việc "dẫn đầu" (kết thúc sớm nhất) thay vì nối chuỗi. Link tự động có `auto: true`. Nút "↺ Nối lại tất cả" xoá liên kết trong-giai-đoạn của các giai đoạn đang hiển thị (giữ liên kết khác giai đoạn) rồi nối lại. 18 test. Cache `?v=20261107k`.

## 3k. Giai đoạn 0 — GD HOME Tools và Bảng chốt mã vật liệu

- Đề xuất và câu hỏi cần duyệt ở [DE-XUAT-CHOT-MA.md](DE-XUAT-CHOT-MA.md). Wireframe tĩnh gồm năm màn hình ở [docs/wireframes/index.html](docs/wireframes/index.html).
- Đề xuất dùng lại Gmail và ID dự án Tiến độ, giữ kho Tiến độ hiện tại, dùng Postgres riêng cho Chốt mã và R2 Standard private cho ảnh. Đây là thiết kế chờ duyệt.
- `npm test` gặp `spawn EPERM` trong môi trường thực thi. `node --test --test-isolation=none` đạt 18/18. Giai đoạn 1 chờ anh Đức duyệt. Bản A4 và Sheet gốc cần bổ sung để đối chiếu.

## 3l. GD HOME Tools và Chốt mã vật liệu (GĐ1–6)

- Quyết định triển khai theo REVIEW-GD0-CHOT-MA.md. `/` giữ Tiến độ, `/tools` là trang công cụ, `/chot-ma` là trình nhập, `/duyet/:token` là bản khách. Menu dùng chung, dùng lại `gdhome_session` và quyền theo Gmail. Server chỉ phục vụ danh sách file UI; tài liệu và kho dữ liệu ở ngoài tuyến tĩnh.
- `materials.js` có MaterialStore theo khóa `mat-v1-<băm tài khoản>`, dùng FileStore/GistStore. API `GET/POST /api/materials` giữ `_version`, từ chối xung đột với 409. Lịch sử ký và audit append-only, revisions chuyển sang file kho riêng quanh 800 KB. Khi dùng Gist, Chốt mã chờ GitHub nhận lần ghi trước khi báo đã lưu. Một tiến trình Render giữ hàng đợi ghi theo tài khoản; không chạy nhiều instance ghi cùng Gist.
- `material-assets.js` giữ ảnh riêng, dùng R2 Standard với URL ký 60 giây gọi phía server. Cài `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` theo HUONG-DAN-R2.md. Thiếu biến dùng `DATA_DIR/assets` để thử. Khi dùng Gist/R2 thật, đặt `SESSION_SECRET` ổn định để giữ hiệu lực link khách qua các lần triển khai.
- `material-editor.js`, `material-template.js`, `material-image-ui.js`, `material-import.js` xử lý mẫu, thao tác bảng, ảnh WebP, thư viện và nhập CSV/XLSX. SheetJS 0.18.5 tải theo nhu cầu từ CDN giống phần AI. Bản nhập giữ giá trị ô, tham chiếu ảnh cần kiểm tra thủ công.
- `material-review.js` xử lý `/api/materials/settings`, `/api/materials/sheets/:id/review`, `/api/review/:token[/sign|/change|/assets/:id]`. Token mã hóa, chỉ lưu hash trong revision, link chưa ký 14 ngày. Sau khi ký có 48 giờ yêu cầu đổi; không sửa bản đã ký. Chữ ký A/B lưu bằng nét vẽ. Điều 2–4 mặc định ở `material-terms.js` (chép nguyên văn mẫu), chỉnh được và chụp theo bản phát hành. Server khởi động được khi thiếu `docs/`.
- `material-print.js` và `material-release.js` dựng Biên bản A4, thống kê ảnh và Excel nội bộ. Xuất PNG/copy dùng chung `export-canvas.js` với Tiến độ. Bản A4 không quốc hiệu, xuất PDF qua hộp in.
- `material-schedule.js` tính hạn bằng `scheduler.js`. `/api/materials/timeline` trả trạng thái rút gọn. `material-timeline.js` hiện ✓/⚠ trên Timeline, không ghi tiến độ thi công.
- Chi tiết chạy thử và giới hạn trong [TIEN-TRINH-CHOT-MA.md](TIEN-TRINH-CHOT-MA.md). Test 21/21, đã chạy localhost với dữ liệu thử. Claude review trước khi push/deploy và chép bản .bat cập nhật sang Desktop.

- **GĐ6 hoàn thiện**: các nút dòng nằm ngang, tiêu đề cột dính khi cuộn, mật độ Gọn/Vừa/Ảnh lớn đo được khoảng 44/72/130 px với thumbnail Vừa 90×64. Nhãn khách nằm trên ô, Xuất gom hai chức năng. Gõ mã tại PA và chọn từ thư viện bằng Alt+1…9.
- Crop trong `material-image-ui.js` dùng khung kéo bốn góc, hỗ trợ phím mũi tên ở từng góc, Lưu/Huỷ. Nét ký giữ tỷ lệ 600×190 trong khung vẽ, bản khách, lịch sử và A4. Hai script trên `index.html` có phiên bản cache, `material-terms.js` đã vào danh sách deploy.
- Kiểm tra GĐ6: 21/21 test; localhost đã tạo bảng, dán/chốt, thử crop, duyệt và ký A/B, mở lịch sử và A4, gửi yêu cầu đổi, thấy ⚠ trên Timeline. Thử khởi động module server trên bản sao không có `docs/`.
## 3m. Chốt mã GĐ7

- Menu trái có hồ sơ, danh mục kéo đổi thứ tự, hiển thị cột, mật độ và bộ lọc. Mỗi dòng mở PA1 trước, thêm bằng ＋ PA. Dữ liệu cũ vẫn mở đủ các PA đã có dữ liệu. Độ rộng cột lưu trong `columnWidths` của kho Chốt mã theo tài khoản.
- Hồ sơ trong `profiles[projectOwners.id]` của kho Chốt mã. Tên trong hồ sơ và biên bản có thể khác tên Lịch sau khi xác nhận. `POST /api/materials/profile` điền hồ sơ hoặc thêm dự án và giai đoạn bên Lịch, giữ lịch hiện có. Hồ sơ được chụp vào bản phát hành mới.
- `GET /api/notion/customers?q=&cursor=` dùng kết nối đã lưu, database khách riêng, ghép cột theo tài khoản. Lọc tên/địa chỉ/SĐT và phân trang phía server. Giữ phiên bản API Notion của tích hợp Lịch. `material-projects.js` điều khiển hộp chọn.
- Menu Copy ảnh có bộ lọc nhóm đang bật, dòng đã chốt và phòng. Bản xuất dùng logo, hồ sơ và watermark; PDF A4 lưu qua hộp in. PNG và clipboard dùng html2canvas cùng `export-canvas.js`.
- `POST /api/ai/materials` dùng nhà cung cấp của tài khoản qua `callWithFallback`, prompt nhóm vật liệu riêng. `material-ai.js` nhận PDF, Excel, CSV hoặc ảnh, báo tiến độ góc phải và cho sửa, chọn dòng. Khi gộp, bỏ trùng theo nhóm, tên hạng mục và vị trí.
- 23/23 test đạt. Kiểm tra localhost với Notion và Gemini giả lập. Các bước bấm thử và giới hạn trong [TIEN-TRINH-CHOT-MA.md](TIEN-TRINH-CHOT-MA.md).

## 3n. Chốt mã GĐ8

- `material-editor-view.js` dựng header, sidebar, nhóm và dòng. Khi dựng lại, khôi phục cuộn trang, cuộn sidebar và cuộn ngang/dọc của bảng. Focus theo ID dòng và cột, chuyển sang dòng kế bên nếu dòng cũ bị xoá.
- Lịch và Chốt mã dùng chung nút, thanh header, checkbox dạng chip, tay nắm đổi độ rộng và toast trong `tools-menu.css`. Sidebar Lịch dành sẵn vị trí cho nút hover để chiều cao không đổi.
- `material-selection.js` quản lý chọn theo dòng, dải hoặc nhóm. Mỗi lượt xoá/nhân bản/đổi trạng thái/chuyển nhóm dùng một bước hoàn tác. API từ chối xoá dòng thuộc bản đã ký và cung cấp ID được bảo vệ cho giao diện.
- Dán ảnh trực tiếp bằng `clipboardData.items`, `files`, ảnh trong HTML hoặc `navigator.clipboard.read()`. Link ảnh phụ thuộc quyền đọc từ trang nguồn. Khi trang nguồn chặn, có thể sao chép ảnh dưới dạng bitmap hoặc kéo tệp vào ô.
- Test Node đạt 23/23. Kịch bản Playwright tại `docs/gd8-playwright.cjs` kiểm tra cả sáu bước với 150 dòng mẫu trên Edge. Xem cách chạy và số đo tại [TIEN-TRINH-CHOT-MA.md](TIEN-TRINH-CHOT-MA.md).

## 3o. Chốt mã GĐ9

- Hộp Copy ảnh mặc định lấy nhóm đang bật, mọi dòng và mọi phòng. Lựa chọn đã áp dụng lưu theo Gmail trên trình duyệt hoặc theo phiên bản dùng chung khi không có Gmail.
- Bảng nhập và bản thống kê dùng cùng tên, thứ tự cột chính và màu đầu nhóm. Bản thống kê và biên bản A4 dùng Roboto chung với Tiến độ. Trên desktop, logo rộng 224 px và khung ảnh rộng 92 px. Nhãn PA nằm dưới ảnh, tự ẩn khi chỉ có PA1. Bản thống kê xếp các PA có ảnh lên trước các PA chỉ có thông tin để ảnh luôn bắt đầu ngang với cột phối cảnh.
- `material-print.js` đặt ảnh giữ tỷ lệ trong khung vuông để bản xem trước, PNG và A4 có cùng bố cục. PNG dùng kích thước ảnh thực vì html2canvas không hỗ trợ `object-fit`. [Danh sách CSS của html2canvas](https://html2canvas.hertzen.com/features)
- Bấm ảnh để xem ảnh lớn trong `material-image-ui.js`. Dùng mũi tên để chuyển ảnh trong ô, Esc hoặc bấm nền tối để đóng. Có thể cắt và xoá ảnh tại đây. Nút ✓ riêng chốt PA.
- Ghi chú mới mặc định trống. Bấm ô hoặc Alt+↓ để tìm và chọn nhiều gợi ý. `material-note-suggestions.js` chứa danh sách mặc định và lấy thêm ghi chú đã dùng ở các hạng mục cùng loại trong bảng nháp của tài khoản. Ghi chú do AI tạo và tham chiếu ảnh nhập lưu trong `noteSuggestions` của bản nháp. Trường Ghi chú nhập trực tiếp từ Excel/CSV vẫn là nội dung của dòng.
- `docs/gd8-playwright.cjs` kiểm tra GĐ8 và GĐ9 trên Edge với kho tạm. Ca GĐ9 đo ảnh 3D và PA thẳng hàng, kiểm tra canvas PNG, tạo PDF A4 trong bộ nhớ và thử quy trình ghi chú sau khi tải lại. Xem lệnh chạy tại [TIEN-TRINH-CHOT-MA.md](TIEN-TRINH-CHOT-MA.md).

## 3p. Đồng bộ giao diện GD HOME Tools (GĐ10)

- `shell.css` và `shell.js` dùng chung cho các trang. Header 56 px, sidebar 262 px, Roboto, nút File / AI / Copy ảnh / Undo-Redo / nút chính, toast, trạng thái lưu, modal, thanh chọn nhiều và lightbox. Hợp đồng CSS/JS cho Quản lý dự án trong [HE-THONG-GIAO-DIEN.md](docs/HE-THONG-GIAO-DIEN.md).
- `GET/POST /api/materials/preferences` lưu tùy chọn Chốt mã theo tài khoản. `viewVersion` độc lập với phiên bản bản nháp, cùng hàng đợi ghi trong kho Chốt mã. Bản tạm localStorage giữ thay đổi chưa gửi. Tuỳ chọn nhóm và lọc lưu theo bảng; mật độ, độ đậm, cột, khối menu và phạm vi xuất lưu theo tài khoản.
- Chốt mã có chế độ khách lưu bản nháp và ảnh trên trình duyệt, dùng chung cờ đăng nhập với Lịch. Có thể chuyển các bảng khách vào tài khoản khi đăng nhập qua Chốt mã. Tính năng kết nối và phát hành dùng phiên tài khoản.
- Menu **⚙ Kết nối** dùng `integrations-client.js` và `/api/integrations/settings`. `ai-client.js` dùng chung cho chọn/dán ảnh, chuẩn bị tệp và chạy nền; mỗi tool dựng bảng duyệt theo nghiệp vụ.
- `GET/POST /api/projects` và `projects-client.js` chia sẻ hồ sơ qua `projectOwners[].profile` và tên dự án qua `projectOwners[].name`. Lịch hiện tên khách và địa chỉ ở tiêu đề. Hệ thống đọc hồ sơ Chốt mã cũ khi chưa có trường mới và lưu ảnh chụp hồ sơ theo bản đã phát hành.
- Lịch có xuất PDF A4 ngang từ vùng đã chọn. Chốt mã hỗ trợ PDF thống kê nhiều trang và biên bản A4. PNG và clipboard dùng chung thông số sọc chìm trong `export-canvas.js`.
- Chạy `node --test --test-isolation=none` và `node docs/gd8-playwright.cjs`. Dùng `GD_SHELL_SCREENSHOTS` trỏ đến thư mục muốn chụp header/sidebar ở 1440 và 1920 px. Chi tiết trong [TIEN-TRINH-CHOT-MA.md](TIEN-TRINH-CHOT-MA.md).

## 4. Các script hỗ trợ trên Desktop
- `C:\Users\KTDUC\Desktop\Mo-Web-Lich-Tien-Do.bat`: Nháy đúp để khởi động nhanh server `localhost:3000` và tự mở trình duyệt.
- `C:\Users\KTDUC\Desktop\Cap-Nhat-Web-Len-Mang.bat`: Nháy đúp để tự động commit và đẩy code lên GitHub / Render.com.
- `C:\Users\KTDUC\Desktop\gdhome-calendar-files\index.html`: Bản chạy offline trực tiếp không cần server.

---

## 5. Hướng dẫn bàn giao cho Claude
Khi chuyển sang Claude, hãy gửi đoạn tóm tắt dưới đây để Claude nắm trọn vẹn ngữ cảnh và tiếp tục phát triển ngay mà không cần khảo sát lại từ đầu.
