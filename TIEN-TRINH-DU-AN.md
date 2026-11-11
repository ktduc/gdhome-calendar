# TIẾN TRÌNH GĐ11 — WEB CON "QUẢN LÝ DỰ ÁN" (`/du-an`)

- **Nhánh làm việc**: `du-an` (trong git worktree `..\timeline-calendar-duan`, hoàn toàn tách biệt với `main` để không đụng công việc của GPT/Codex).
- **Cổng chạy kiểm thử**: `3300` với `DATA_DIR` riêng (đã kiểm tra khởi động, phục vụ `/du-an` HTTP 200, `/api/project-hub/overview` thành công).
- **Trạng thái**: **XONG GĐ11** (toàn bộ 11.0 → 11.7 đã hoàn tất, 26/26 tests `node --test` vượt qua 100%).

---

## Trạng thái các bước

- [x] **11.0 Đề xuất nhanh (`docs/DE-XUAT-DU-AN.md`)**
  - Thiết kế cấu trúc dữ liệu `ProjectHubRecord`, `Document`, `QuoteItem`, `ReviewFinding`.
  - Thiết kế luồng lưu trữ `ProjectAssets` (R2 + fallback đĩa cục bộ `DATA_DIR/project-files`), đọc báo giá Excel/CSV/PDF, soát bản vẽ HSKT & 3D theo từng trang + đóng dấu ghi chú trực tiếp vào PDF, và đề xuất 2 chiều sang Tiến độ & Chốt mã kèm liên kết ngược `sourceQuoteItemId`.
- [x] **11.1 Khung trang `/du-an`**
  - Thêm thẻ menu GD HOME Tools trong `shell.js` (`['/du-an', 'Quản lý dự án']`).
  - Thêm thẻ web con "Quản lý dự án" trên `/tools` (`tools.html`).
  - Giao diện `du-an.html` đồng bộ chuẩn GD HOME: header, logo, menu shell, tài khoản identity.
  - Thanh chọn dự án tích hợp (dùng chung `projectOwners` và `profile` từ Lịch & Chốt mã).
  - Hộp thoại tạo dự án mới và sửa hồ sơ khách hàng (tạo tự động cả trong Tiến độ `data.calendars` và Quản lý dự án).
  - Thẻ thông tin tổng quan khách hàng (Khách, SĐT, Địa chỉ, Số HĐ) kèm 3 thẻ trạng thái liên kết:
    - **Tiến độ**: số việc, thanh % tiến độ trực quan, ngày kết thúc + nút "📅 Mở Tiến độ" nhảy thẳng sang đúng dự án.
    - **Chốt mã**: đã chốt x/y mục, cảnh báo mục quá hạn + nút "🏷 Mở Chốt mã" nhảy thẳng sang đúng dự án.
    - **Hồ sơ**: tổng số tài liệu (báo giá/bản vẽ/3D) và số vấn đề HSKT còn mở.
- [x] **11.2 Tải hồ sơ (Báo giá, Bản vẽ HSKT PDF, Phối cảnh 3D)**
  - Vùng kéo thả tệp (`#upload-dropzone`) + chọn nhiều tệp từ máy tính.
  - Hỗ trợ dán ảnh trực tiếp từ Clipboard bằng <kbd>Ctrl+V</kbd>.
  - Phân loại tự động theo định dạng và tên file: Báo giá (`quote`), Bản vẽ HSKT (`drawing`), Phối cảnh 3D (`render`).
  - Lưu trữ an toàn qua `ProjectAssets` (`DATA_DIR/project-files/<accountHash>/...`) kèm sha256.
  - Quản lý phiên bản tự động: tải lại file trùng tên sẽ tăng `version: 2, 3...` và lưu lại lịch sử trong `history[]`.
  - Xem trước tài liệu: xem ảnh 3D và nhúng xem trước PDF bản vẽ trực tiếp trong trình duyệt.
- [x] **11.3 Đọc báo giá → Danh sách hạng mục chuẩn hoá**
  - Đọc từ bảng tính Excel (`.xlsx`, `.xls`) và file `.csv`.
  - Tự động nhận diện dòng tiêu đề và ánh xạ các cột: STT, Mã VT, Tên hạng mục, Phòng/Khu vực, Quy cách / Chất liệu, Khối lượng, ĐVT, Đơn giá, Thành tiền, Ghi chú.
  - Tự động nhận biết các tiêu đề khu vực / phòng (VD: `I. PHÒNG KHÁCH`, `BẾP`, `PHẦN THÔ`) để phân nhóm.
  - Phân loại tự động hạng mục vào các nhóm công việc: `Phần thô & Xây trát`, `Điện nước (MEP)`, `Trần & Sơn bả`, `Ốp lát đá & gạch`, `Đồ gỗ nội thất`, `Đồ rời & Sofa/Rèm`, `Thiết bị & Phụ kiện`, `Nhôm kính & Cửa`.
  - Bảng hạng mục tương tác trên giao diện: sửa trực tiếp từng ô, lọc theo phòng, tìm kiếm từ khoá, thêm dòng mới, lưu vào cơ sở dữ liệu qua `/api/project-hub/quote/save`.
- [x] **11.4 Soát bản vẽ HSKT & phối cảnh 3D theo báo giá + Ghi chú vào PDF**
  - Thuật toán `computeReviewCoverage` đối chiếu từng hạng mục báo giá với danh sách các trang bản vẽ HSKT và ảnh render 3D.
  - Ma trận phát hiện lỗi:
    - `missing_drawing` (Mức độ Cao): Hạng mục có trong báo giá nhưng thiếu bản vẽ chi tiết HSKT.
    - `missing_3d` (Mức độ Trung bình): Đồ nội thất / đồ rời / thiết bị chính chưa thấy trên phối cảnh 3D.
    - `qty_mismatch` (Mức độ Trung bình/Cao): Lệch khối lượng giữa ghi chú trên bản vẽ và số lượng báo giá.
  - **Đóng dấu & ghi chú trực tiếp vào file PDF** bằng `pdf-lib`:
    - Chèn **Trang 0 (Trang Bìa Tổng Hợp)** với dải màu đỏ GD HOME, thống kê số lượng vấn đề (Cao, Trung bình, Thấp) và bảng chi tiết các điểm cần bổ sung kèm số trang tương ứng.
    - Trên các trang bản vẽ liên quan: vẽ khung chữ nhật viền đỏ cảnh báo nổi bật kèm nhãn sticky note đỏ `[GD HOME] ...`.
    - Bảo toàn font và chuẩn hoá ký tự ASCII an toàn cho PDF standard fonts.
    - Nút "📥 Tải PDF Đã Ghi Chú Cảnh Báo" tải trực tiếp bản PDF đã đánh dấu, giữ nguyên file PDF gốc.
  - Màn hình duyệt kết quả: lọc theo mức độ (Cao, Trung bình, Thấp), trạng thái (Chưa xử lý, Đã xử lý, Bỏ qua), cập nhật trực tiếp ghi chú của KTS/QS.
- [x] **11.5 Đề xuất sang Tiến độ & Chốt mã + Liên kết ngược**
  - **Đề xuất Tiến độ**: chuyển đổi các hạng mục báo giá thành chuỗi công việc thi công có liên kết logic `FS`, phân bổ số ngày theo giai đoạn chuẩn (`generateScheduleProposal`), lưu `sourceQuoteItemIds` cho mỗi công việc; xem trước và bấm 1 nút đẩy vào Lịch Tiến Độ của dự án.
  - **Đề xuất Chốt mã**: lọc các hạng mục cần chọn vật tư, tự động gom nhóm vào 17 nhóm mẫu chuẩn GD HOME (`generateMaterialsProposal`), gắn `sourceQuoteItemId`; xem trước và bấm 1 nút đẩy vào bảng Chốt mã của dự án.
- [x] **11.6 Liên kết dữ liệu 3 trang + Notion + AI chung**
  - Hồ sơ dự án dùng chung thống nhất: từ Quản lý dự án mở thẳng Tiến độ và Chốt mã đúng ID dự án (`?project=...`).
  - Từ Lịch Tiến Độ (`index.html`, `app.js`): bổ sung nút shortcut `📁` mở trực tiếp Hồ sơ dự án của từng chủ sở hữu/dự án.
  - Từ Chốt Mã Vật Liệu (`material-editor.js`, `material-editor-view.js`): bổ sung nút `📁 Hồ sơ dự án` ở cả màn hình chọn dự án và thanh công cụ soạn thảo bảng chốt mã.
- [x] **11.7 Kiểm tra (Unit test + E2E) & Bàn giao**
  - Bộ kiểm thử `tests/project-hub.test.js`:
    - Test 1: Chuẩn hoá dữ liệu báo giá, ma trận phủ kiểm tra HSKT & 3D, đóng dấu ghi chú PDF bằng `pdf-lib`, đề xuất tiến độ & chốt mã.
    - Test 2: Server API `/api/project-hub/...`, tạo dự án, tải tệp, kiểm tra tăng phiên bản (v1 -> v2), lưu báo giá, cập nhật trạng thái phát hiện, đồng bộ 3 trang.
    - Test 3: Kịch bản E2E hoàn chỉnh: tạo dự án -> tải báo giá CSV + bản vẽ PDF mẫu + 2 ảnh 3D -> chạy soát HSKT -> tải PDF đã đóng dấu kiểm tra số trang (3 trang) -> đẩy sang Lịch Tiến Độ & Chốt Mã Vật Liệu.
  - Chạy `npm test` (`node --test`): toàn bộ **26/26 tests PASS 100%**.

---

## Danh mục file mới & file sửa

### File mới (thuộc web con Quản lý dự án)
1. `docs/DE-XUAT-DU-AN.md`: Tài liệu đề xuất kỹ thuật và mô hình dữ liệu GĐ11.
2. `du-an.html`: Trang giao diện Quản lý dự án (`/du-an`).
3. `project-hub.css`: Bộ định dạng CSS cho Quản lý dự án (chuẩn giao diện GD HOME).
4. `project-hub-client.js`: Script xử lý frontend cho Quản lý dự án.
5. `project-hub.js`: Module backend xử lý kho lưu trữ `ProjectHubStore`, `ProjectAssets`, đọc báo giá, soát HSKT, đóng dấu PDF bằng `pdf-lib`, sinh đề xuất Tiến độ và Chốt mã.
6. `tests/project-hub.test.js`: Bộ kiểm thử tự động toàn diện cho GĐ11.

### File dùng chung đã sửa (ghi nhận để Claude dễ gộp vào `main`)
1. `server.js`:
   - Thêm import `const { handleProjectHub } = require('./project-hub');`.
   - Bổ sung `du-an.html`, `project-hub.css`, `project-hub-client.js` vào tập hợp `STATIC_FILES`.
   - Bổ sung định tuyến `if (rel === '/du-an') rel = '/du-an.html';` trong `serveStatic`.
   - Hỗ trợ tham số `?token=` trong `resolveDataKey` phục vụ tải PDF/tài liệu trực tiếp.
   - Bổ sung định tuyến API `if (urlPath === '/api/project-hub' || urlPath.startsWith('/api/project-hub/'))` chuyển quyền xử lý cho `handleProjectHub`.
2. `shell.js`:
   - Thêm liên kết `['/du-an', 'Quản lý dự án']` vào menu `GDHomeShell.menu`.
3. `tools.html` & `tools.js`:
   - Bổ sung thẻ bài viết "Quản lý dự án" dẫn tới `/du-an` trên trang `/tools` và nút "Hồ sơ dự án" (`/du-an?project=<id>`) cho từng dự án trong danh sách "Dự án của tôi".
4. `app.js`:
   - Bổ sung nút liên kết `📁` mở Hồ sơ dự án tương ứng trong danh sách dự án ở sidebar Lịch Tiến Độ.
5. `material-editor.js` & `material-editor-view.js`:
   - Bổ sung nút "📁 Hồ sơ dự án" trong màn hình danh sách dự án và thanh công cụ soạn thảo bảng chốt mã.
6. `Cap-Nhat-Web-Len-Mang.bat`:
   - Bổ sung các file mới (`du-an.html`, `project-hub.css`, `project-hub.js`, `project-hub-client.js`, `docs/DE-XUAT-DU-AN.md`, `TIEN-TRINH-DU-AN.md`) vào danh sách sao lưu và lệnh `git add`.
7. `package.json` & `package-lock.json`:
   - Đã cài đặt thư viện `pdf-lib` phục vụ đóng dấu và ghi chú trực tiếp vào file PDF HSKT.

---
**XONG GĐ11**

---

## Bổ sung sau Claude Review GĐ11 (Hoàn thiện 7 mục)

- [x] **1. AI soát bản vẽ thật qua `integrations.js`**
  - Tích hợp `callWithFallback`, `resolveAi`, `loadUserCfg`, `callGemini` từ `integrations.js` vào `project-hub.js`.
  - Phân tích PDF bản vẽ HSKT qua Gemini, trích xuất danh sách `{ pageNumber, drawingType, room, title, items, quantities }` lưu vào `extractedPages`.
  - Phân tích ảnh phối cảnh 3D bằng AI, trích xuất `{ room, detectedItems }` lưu vào tài liệu render.
  - Khi chưa cấu hình key AI: trả mã lỗi 400 và thông báo rõ ràng "Chưa kết nối AI. Hãy vào ⚙ Kết nối để dán API key (Gemini / ChatGPT / Claude).", tuyệt đối không tạo kết quả giả.
  - Frontend hiển thị thông báo chạy nền góc phải dưới qua `GDHomeShell.aiNotice` đồng bộ trải nghiệm Lịch.
  - Kiểm thử tự động với mock fetch giả lập thành công 100%.

- [x] **2. Lưu file Cloudflare R2 & cảnh báo lưu đĩa tạm**
  - Cập nhật `ProjectAssets` tích hợp Cloudflare R2 ký URL AWS4 HMAC-SHA256 tương tự `material-assets.js` khi có đủ các biến môi trường `R2_*`.
  - Khi chưa cấu hình R2: lưu đĩa cục bộ `DATA_DIR/project-files` nhưng trả `storageInfo: { r2: false, warning: 'Lưu tạm – sẽ mất khi server khởi động lại' }`.
  - Giao diện hiển thị huy hiệu cảnh báo màu vàng trong sidebar: `⚠️ Lưu tạm – sẽ mất khi server khởi động lại (chưa cấu hình Cloudflare R2)`.

- [x] **3. Upload nhị phân thô tới 60MB cho HSKT**
  - Bổ sung hàm `readRawBody(req, limit = 60 * 1024 * 1024)` trong `server.js` và truyền vào `handleProjectHub`.
  - Endpoint `POST /api/project-hub/documents/upload` hỗ trợ nhận body nhị phân trực tiếp (không base64), nhận metadata qua query params hoặc headers (`x-project-id`, `x-file-name`, `x-doc-type`, `x-room`).
  - Khi tệp vượt quá 60MB: từ chối với HTTP 413 "Tệp vượt quá giới hạn 60MB".
  - Frontend client gửi trực tiếp đối tượng `File` nhị phân qua `fetch` không làm đầy bộ nhớ trình duyệt.

- [x] **4. Bảo mật: Bỏ đọc token từ query URL, tải file qua Authorization header**
  - Loại bỏ hoàn toàn đoạn đọc `req.url.includes('token=')` trong hàm `resolveDataKey` của `server.js` (không làm lộ token phiên trong thanh địa chỉ và lịch sử trình duyệt).
  - Client mở và tải tệp qua hàm `fetchAssetBlobUrl` có header `Authorization: Bearer <token>`, chuyển thành Object URL (Blob URL) để xem trước (iframe/img) hoặc tải xuống (`<a download>`).

- [x] **5. Font Unicode tiếng Việt cho PDF ghi chú đóng dấu**
  - Cài đặt `@pdf-lib/fontkit` vào `package.json` và `package-lock.json`.
  - Tải lưu sẵn 2 file font TTF Unicode chuẩn: `fonts/Roboto-Regular.ttf` và `fonts/Roboto-Bold.ttf`.
  - Cập nhật `annotateDrawingPdf`: đăng ký `pdfDoc.registerFontkit(fontkit)` và nhúng 2 font Roboto Unicode.
  - Văn bản ghi chú, bảng tổng hợp phát hiện và các nhãn callout trên từng trang bản vẽ nay hiển thị đầy đủ dấu tiếng Việt chuẩn mực ("GD HOME – BÁO CÁO SOÁT HỒ SƠ BẢN VẼ HSKT", "Thiếu bản vẽ HSKT: Tủ áo cánh kính lùa", "Tổng số vấn đề: ...").

- [x] **6. Giao diện chuẩn GĐ10 (`shell.css`/`shell.js`, `docs/HE-THONG-GIAO-DIEN.md`)**
  - Header 56px với thanh công cụ `.shell-toolbar` chuẩn thứ tự slot GĐ10:
    - Slot 1: `File ▾` (Tạo dự án mới, Tải tài liệu, Tải bản vẽ có dấu, Tải lại dữ liệu).
    - Slot 2: `✨ AI ▾` (Soát bản vẽ bằng AI, ⚙ Kết nối AI).
    - Slot 3: `Copy ảnh ▾` (Sao chép ma trận soát, Sao chép tóm tắt báo giá).
    - Slot 4: `Undo/Redo` (`.hdr-undo-group`).
    - Slot 5: Nút xanh chính (`.btn-primary`: 🚀 Soát bản vẽ).
    - Theo sau bởi `.save-status` và `.shell-account`.
  - Sidebar rộng 262px nền `#eef1f5` (`.shell-sidebar.sidebar-compact`) với 3 khối thu gọn `details.sb-collapsible`:
    - Chọn dự án (chọn dự án, nút tạo mới, sửa hồ sơ, mở Tiến độ / Chốt mã, cảnh báo R2).
    - Hồ sơ dự án (Khách hàng, SĐT, Địa chỉ, Số hợp đồng).
    - Danh sách tài liệu (thống kê số lượng, danh sách tệp nhanh, nút tải tệp mới).
  - Nút ⚙ Kết nối dùng chung dialog của `integrations-client.js`.

- [x] **7. Cập nhật `Cap-Nhat-Web-Len-Mang.bat`**
  - Bổ sung `package-lock.json` và thư mục `fonts` vào danh sách sao lưu và lệnh `git add`.

---
**XONG GĐ11 SỬA**

---

## GĐ11.8: Nâng cấp kho lưu trữ sang Backblaze B2 (Chuẩn S3 AWS SigV4)

- [x] **1. Module dùng chung `object-storage.js`**
  - Hỗ trợ chuẩn AWS Signature Version 4 (Query string auth) cho mọi dịch vụ S3-compatible.
  - Đọc cấu hình `S3_*` (`S3_ENDPOINT`, `S3_REGION`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_BUCKET`) và `B2_*` (`B2_ENDPOINT`, `B2_REGION`, `B2_KEY_ID`, `B2_APP_KEY`, `B2_BUCKET`), ưu tiên `S3_*` -> `B2_*` -> `R2_*`.
  - Tự động nhận diện region từ endpoint URL (vd `s3.us-west-004.backblazeb2.com` -> `us-west-004`), tự bổ sung `https://` nếu thiếu.
  - Duy trì hỗ trợ tương thích ngược cho Cloudflare R2 (`R2_*`).
  - Cung cấp path-style URL, các hàm `putObject`, `getObject`, `headObject`, `deleteObject` với `AbortSignal.timeout`.
- [x] **2. Tích hợp `material-assets.js` và `project-hub.js` dùng chung module**
  - Khóa theo tài khoản người dùng (`assets/<accountHash>/...` và `project-files/<accountHash>/...`).
  - Khi có B2/R2, `storageInfo.configured === true` và `storageInfo.warning === null` (hết cảnh báo lưu tạm).
- [x] **3. `/api/health` và `/api/config`**
  - Trả về `objectStorage: 'b2' | 'r2' | 'temp'` (bảo mật tuyệt đối, không lộ khoá bí mật).
- [x] **4. Bộ Unit Test `tests/object-storage.test.js`**
  - Kiểm thử định tuyến cấu hình, tính toán chữ ký AWS SigV4 theo chuẩn xác định, mock fetch PUT/GET/HEAD/DELETE, `/api/health`, và tích hợp tài sản dự án (34/34 tests pass 100%).
- [x] **5. Hướng dẫn & Tự động hoá triển khai**
  - Cập nhật `HUONG-DAN-R2.md` hướng dẫn chi tiết Backblaze B2 (tạo bucket private `gdhome-files`, Application Key Read/Write, cấu hình 5 biến Render).
  - Cập nhật `Cap-Nhat-Web-Len-Mang.bat` thêm `object-storage.js` vào danh sách sao lưu và `git add`.

---

## GĐ14 — PHẦN B: Quản lý dự án (B1 → B3)

- [x] **B1. Phối cảnh 3D dạng PDF cả nhà & gắn vào Chốt mã**
  - Mục tải 3D nhận cả file PDF nhiều trang (1 file phối cảnh 3D tổng thể cho cả căn hộ/nhà phố).
  - Tách từng trang tự động bằng `pdf.js` (`pdfjsLib`) ngay trên trình duyệt, render canvas và nén ảnh WebP 1600px chuẩn GĐ13 qua `window.GDHomeImages.compress`.
  - Tải lên server kèm `pageNumber`, `sourcePdf`; AI tự động phân tích gắn không gian/phòng (`room`) và hạng mục phát hiện được (`items`/`detectedItems`).
  - Giao diện thư viện ảnh 3D phân nhóm trực quan theo phòng (`renders-room-grid`), lazy load thumbnail, xem trước chi tiết.
  - Tích hợp tính năng **🏷 Gắn vào Chốt mã**: mở modal chọn bảng Chốt mã, chọn gắn vào toàn bộ Nhóm (`groupName`) hoặc Hạng mục cụ thể (`rowId`) qua API `POST /api/project-hub/renders/assign-to-materials`, tự động cập nhật mảng `row.render` mà không sửa trực tiếp file `material-*.js`.

- [x] **B2. Loại công trình trong ngữ cảnh AI**
  - Thêm trường `Loại công trình` (`buildingType`): `Chung cư` / `Nhà phố` / `Văn phòng nhỏ` / `Khác` vào cấu trúc hồ sơ dự án (`project-profiles.js`, `project-hub.js`, `du-an.html`).
  - Tự động đoán loại công trình từ tên và địa chỉ (`guessBuildingType`) trên cả server lẫn client khi người dùng nhập form, cho phép sửa thủ công.
  - Tích hợp vào System Prompt của AI (`getBuildingContextPrompt`):
    - **Chung cư**: không móng/mái ngoài trời, chú ý hộp kỹ thuật MEP, ban quản lý toà nhà, quy định tiếng ồn và giờ giấc, vận chuyển thang máy hàng.
    - **Nhà phố**: nhiều tầng, kết cấu móng/cột/dầm, cầu thang bộ, chống thấm sàn mái và ban công, mặt tiền ngoài trời, an toàn nhà liền kề.
    - **Văn phòng nhỏ**: trần thả/thạch cao khung nổi, sàn nâng kỹ thuật/thảm, vách kính/vách thạch cao ngăn phòng, mạng LAN, camera, PCCC.
    - **Khác**: phân tích bám sát hồ sơ thực tế.
  - Tuỳ biến trình tự đề xuất Tiến độ thi công (`generateScheduleProposal`) và Chốt mã vật tư (`generateMaterialsProposal`) theo đặc thù từng loại công trình.

- [x] **B3. AI phân tích chạy nền (Background Job) phía server**
  - Chuyển toàn bộ quá trình phân tích AI và tạo đề xuất thành background job (`HubJobManager`) với `jobId` duy nhất, lưu trạng thái chạy trong kho.
  - Các endpoint API: `POST /api/project-hub/jobs/start`, `GET /api/project-hub/jobs/status`, `GET /api/project-hub/jobs/active`, `POST /api/project-hub/jobs/cancel`.
  - Khi chuyển trang sang Tiến độ (`/`), Chốt mã (`/chot-ma`) hay tải lại trang, job vẫn tiếp tục chạy độc lập trên server.
  - Tích hợp ô thông báo góc phải (`GDHomeShell.aiNotice`) dùng chung trong `shell.js` ở mọi trang:
    - Trạng thái `running`: spinner + tên dự án + bước hiện tại kèm % tiến trình + nút "Huỷ".
    - Trạng thái `done`: icon ✅ + tên dự án + nút "Xem kết quả" (chuyển hướng về `/du-an`).
    - Trạng thái `error`: icon ⚠️ + lý do lỗi cụ thể.
  - Hỗ trợ cờ `autoPush: true`: tự động đẩy đề xuất sang Lịch Tiến Độ và Bảng Chốt Mã ngay trong nền khi hoàn tất, kể cả khi người dùng đã rời trang.
  - Bộ kiểm thử tự động `tests/project-hub-gd14.test.js` kiểm tra đầy đủ B1, B2, B3 (38/38 tests toàn bộ dự án pass 100%).

---
**XONG GĐ14B**


## GĐ18B — Giao diện chung, Quản lý dự án, AI

- [x] **18B.4. Sửa tận gốc lỗi AI timeout & chạy nền bền vững**
  - Tăng timeout mỗi lần gọi Gemini/OpenAI/Claude lên 120s (`AI_TIMING.callTimeoutMs = 120000`), tự động thử lại 2 lần (`retries = 2`) với lỗi tạm thời (429, 503, timeout, lỗi mạng), không retry vô ích khi sai key (401/403) hoặc tệp quá lớn (413/400).
  - PDF lớn (>10 trang) tự động chia nhỏ ≤10 trang/lần (`splitPdfPages`) hoặc tải qua Gemini File API (`geminiUploadFile`), cập nhật % tiến trình và số trang đang đọc vào `HubJobManager` (không ngắt khi chuyển tab).
  - Chuẩn hoá thông báo lỗi tiếng Việt (`AI_ERROR_TEXT`) nêu rõ nguyên nhân (chưa có key, key sai, hết hạn mức, tệp quá lớn, hết thời gian) kèm nút **Thử lại** / **⚙ Mở Kết nối AI** trong `shell.js` và `project-hub-client.js`.
  - Thêm nút **Kiểm tra kết nối AI** trong `⚙ Kết nối` (`integrations-client.js` → `POST /api/ai/test`) báo rõ hãng AI, model và thời gian phản hồi.
  - Thêm bộ kiểm thử `tests/gd18b-ai.test.js` (giả lập chậm 90s, lỗi 429, lỗi 400, chia PDF 15 trang, kiểm tra kết nối).
- [x] **18B.2. Quản lý dự án: ảnh tách từ PDF & phối cảnh 3D hiện dạng lưới 120px**
  - Tài liệu hợp đồng, báo giá, bản vẽ HSKT giữ nguyên dạng bảng danh sách; nhóm ảnh 3D và các trang tách từ PDF hiển thị dạng lưới thumbnail `120px` (`.hub-thumb-grid-120`, `.hub-thumb-120`).
  - Bấm vào ảnh mở `GDHomeShell.lightbox` chung để xem lớn, chuyển ảnh trước/sau hoặc xoá trực tiếp trong lightbox.
  - Hỗ trợ kéo thả (`draggable="true"` + API `POST /api/project-hub/documents/reorder`) để đổi thứ tự ảnh.
  - Xoá tài liệu cập nhật giao diện tức thì (`applyLocalDocumentsUpdate`) không chờ F5, đồng thời phát `BroadcastChannel('gdhome-assets')` để tab Chốt mã tự làm mới.
  - Thêm bộ kiểm thử `tests/gd18b-documents.test.js`.
- [x] **18B.3. Hồ sơ dự án tự điền (Notion + AI đọc hợp đồng/báo giá)**
  - Bổ sung đầy đủ 5 trường trong hộp Hồ sơ dự án (`Tên khách hàng`, `Địa chỉ`, `SĐT`, `Email`, `Hợp đồng`) cùng nút **✨ Tự điền** và chấm báo đỏ (`.profile-suggest-dot`).
  - API `POST /api/project-hub/profile/autofill` (`suggestProjectProfile`):
    - (a) Tìm trên Notion Customer DB theo SĐT trước, sau đó theo tên dự án.
    - (b) Trích xuất từ các tệp hợp đồng / báo giá đã tải lên (Excel, CSV, PDF) kết hợp AI.
  - Hiển thị bảng đối chiếu **Hiện tại → Đề xuất** từng trường có ô tích chọn và nút **Áp dụng**; các trường đang có giá trị không bị tự tích ghi đè (`checked: false`).
  - Tự động chạy ngầm (`runSilentProfileAutofill`) khi tạo dự án mới hoặc tải hợp đồng/báo giá lên và bật chấm báo đề xuất.
  - Thêm bộ kiểm thử `tests/gd18b-profile-autofill.test.js`.

- [x] **18B.5. Lịch: AI soát tiến độ (GPT thực hiện phần AI Lịch song song)**
  - Tích hợp soát tiến độ thông qua background job AI (`integrations.js`, `TIMELINE_REVIEW_SYSTEM`).
  - Hộp thoại duyệt các nhóm phát hiện tiến độ trên trang Lịch (`ai-timeline-review-dialog`).
  - Đã có test `tests/gd18b-timeline-review.test.js`.
- [x] **18B.1. Đồng bộ khung giao diện giữa các trang (/, /chot-ma, /du-an, /tools)**
  - **Header đồng bộ**: Logo GD HOME, menu GD HOME Tools (`.gd-tools-menu`), thanh nút lệnh (`.shell-toolbar`), nút tài khoản (`.shell-account`) chuẩn vị trí, kích thước và màu sắc.
  - **Nút ẩn/hiện thanh bên trái**: Dùng chung biểu tượng `menu` (`☰`), kích thước 32px, ở đầu `.header-left`, tự động nhớ trạng thái theo từng trang qua `localStorage.getItem('gdhome_sidebar_hidden:' + location.pathname)`.
  - **Màu sắc & Bo góc hộp thoại, Popover, Menu và Toast**: Dùng chung bộ biến màu nền be ghi nhạt `--gd-overlay-bg: #f4f1ec`, viền `--gd-overlay-border: #d8d2c8`, bo góc `--gd-overlay-radius: 10px`, đổ bóng `--gd-overlay-shadow: 0 10px 28px rgba(15, 23, 42, 0.16)`. Tiêu đề 16px và nút đóng `×` 28px đồng bộ.
  - **Nút bấm đồng bộ chiều cao 32px**: `.btn`, `.btn-primary` (`#1a73e8`), `.btn-outline`, `.btn-danger` (`#d93025`), `.btn-success` (`#188038`).
  - **Bảng đối chiếu lớp Chốt mã cần chuyển đổi**: Đã lập bảng ánh xạ chi tiết giữa các lớp đặc thù của Chốt mã (`.material-header`, `#material-add`, `.material-sidebar`, `.crop-dialog`, ...) sang lớp dùng chung của Shell trong `docs/HE-THONG-GIAO-DIEN.md`.
  - **Ảnh chụp đối chiếu 1440px**: Đã chụp 4 trang (`lich-1440.png`, `chot-ma-1440.png`, `du-an-1440.png`, `tools-1440.png`) lưu vào `docs/gd18/`.
  - **Kiểm thử tự động**: Thêm `tests/gd18b-shell-ui.test.js`, toàn bộ test suite 65/65 pass 100%, Playwright 10.1, 10.3, 10.6 đạt 100%.

---
**XONG GĐ18B**


## GĐ23B — Đồng bộ khung giao diện & Tool "Giao việc · Tổng hợp nhà thầu"

- [x] **23B.1. Kế hoạch + thực hiện đồng bộ khung giao diện**
  - Đã lập tài liệu kế hoạch và bảng đối chiếu 11 thành phần trên cả 5 trang: `docs/gd23/KE-HOACH-DONG-BO-GIAO-DIEN.md`.
  - Đã chụp ảnh trước (1440px) lưu tại `docs/gd23/`: `truoc-lich-1440.png`, `truoc-chot-ma-1440.png`, `truoc-du-an-1440.png`, `truoc-tools-1440.png`.
  - Layout chung `GDHomeShell.layout()`:
    - Header cao chuẩn 52px: `[☰ ẩn/hiện thanh bên] [logo + tên trang] [menu Tools] … [nhóm nút lệnh của trang] [trạng thái lưu] [hồ sơ đăng nhập]`.
    - Thanh bên trái đồng bộ độ rộng 260px (`--gd-sidebar-width: 260px`), cùng nút gập và lưu trạng thái per-page qua `localStorage['gdhome_sidebar_hidden:' + location.pathname]`.
    - Hồ sơ đăng nhập: avatar tròn 28px (`.shell-user-avatar`) + tên rút gọn ở góc phải mọi trang. Bấm mở menu: email, Kết nối, Sao lưu, Đăng xuất. Ở chế độ khách hiện nút "Đăng nhập".
    - Màu lệnh chính `#1a73e8`, nút Copy ảnh màu xanh lá `#188038` được giữ nguyên. Nền be ghi cho hộp thoại và popover.
    - Chốt mã chỉ sửa qua `GDHomeShell.layout()` tự động, không sửa file tĩnh của Chốt mã.
    - Playwright đo vị trí, kích thước header (height 52px), nút ☰ (x 16px, y 10px, 32x32px) và avatar (x 1393px, y 12px, 28x28px, right 19px) giống nhau 100% (±0px, đạt yêu cầu ±1px) trên cả 5 trang.
    - Đã chụp ảnh sau (1440px) lưu tại `docs/gd23/`: `sau-lich-1440.png`, `sau-chot-ma-1440.png`, `sau-du-an-1440.png`, `sau-tools-1440.png`, `sau-giao-viec-1440.png`.

- [x] **23B.2. Tool "Giao việc · Tổng hợp nhà thầu" + Ghép PDF hồ sơ giao việc**
  - **WorkManager backend (`work-manager.js`)**:
    - Quản lý danh bạ nhà thầu (CRUD: tên, SĐT, nhóm việc/hạng mục, đánh giá sao, ghi chú, trạng thái).
    - Quản lý phiếu giao việc (CRUD: dự án, công việc liên kết từ Lịch, nhà thầu, hạng mục, khối lượng, phạm vi, ngày bắt đầu, deadline, trạng thái, ghi chú).
    - Tự động tính trạng thái quá hạn (`isOverdue`, số ngày quá hạn) dựa trên ngày giờ Việt Nam.
    - Tìm kiếm tiếng Việt không dấu chuẩn hóa qua `removeAccents`.
    - Cách ly dữ liệu theo tài khoản (`work-v1-${hash}` bằng SHA-256 từ `dataKey`).
    - API endpoints: `/api/work/overview`, `/api/work/contractors`, `/api/work/assignments`.
  - **Giao diện người dùng (`/giao-viec`, `giao-viec.html`, `giao-viec.js`, `giao-viec.css`)**:
    - Bộ lọc dự án, bộ lọc hạng mục, thanh tìm kiếm tiếng Việt không dấu tức thời.
    - Danh sách nhà thầu trực quan dạng card, đánh giá sao, gắn thẻ hạng mục.
    - Bảng phiếu giao việc có badge trạng thái (Chưa giao, Đang làm, Quá hạn đỏ rực với số ngày trễ, Hoàn thành, Tạm dừng).
    - Xuất bảng tổng hợp giao việc ra file Excel (.xlsx) qua SheetJS.
    - Tích hợp trang Lịch: huy hiệu nhà thầu trực tiếp trên thanh công việc và popover chỉnh sửa nhanh.
  - **Ghép PDF hồ sơ giao việc (PDF Builder)**:
    - Nạp bản vẽ PDF từ Quản lý dự án (`/api/project-hub/project?id=...`).
    - Hiển thị danh sách thumbnail các trang PDF trực quan (hỗ trợ PDF.js và fallback PDFLib canvas).
    - Chọn từng trang cụ thể (Check/Uncheck, Chọn tất cả, Bỏ chọn), kéo thả đổi thứ tự trang.
    - Tùy chọn sinh tự động trang bìa chuẩn nhận diện GD HOME (khung xanh thương hiệu, tên dự án, hạng mục, nhà thầu, khối lượng, phạm vi, ngày phát hành, số trang bản vẽ).
    - Trích xuất và ghép đúng các trang đã chọn thành file PDF mới tải về máy và tự động lưu vào Quản lý dự án.
  - **Kiểm thử**:
    - Bộ kiểm thử tự động `tests/gd23b-work.test.js` gồm 5 test cases (CRUD nhà thầu, CRUD phiếu & cảnh báo quá hạn, cách ly tài khoản, Server HTTP API, và Playwright E2E tạo nhà thầu, tạo phiếu, chọn 3 trang PDF giả và tạo PDF ghép 4 trang có bìa và 3 trang không bìa).
    - Toàn bộ 91/91 test trong hệ thống vượt qua 100%.

---
**XONG GĐ23B**

## GĐ24

| Bước | Kết quả | Kiểm thử |
| --- | --- | --- |
| 24.1 | Tiêu đề và ghi chú riêng Lịch/Timeline, sửa tại chỗ bằng contenteditable hoặc Cài đặt. Giữ dòng ngày nghỉ chung, lưu root fields và ghi đè theo dự án ở projectOwners. Đổi mặc định Timeline cũ sang thi công khi nạp dữ liệu, giữ tiêu đề đã tự sửa và ghi chú trống. Áp dụng vào nguồn in/PNG/PDF, đủ lưu server/local/undo. | Node 94/94. Edge 24.1, 24.1-legacy, 24.1-export, 10.5 đạt; xuất dùng html2canvas thật ở cả chế độ PNG và in. |
| 24.2 | Thêm ca chống lặp DOM trên 5 trang ở 1280/1920/2560px, đợi ổn định 2 giây rồi đo childList 2 giây, bắt cả việc gỡ/gắn lại cùng node. Bấm menu và bật/tắt thanh bên thật. Bổ sung CSS thu gọn cho work-app-layout của Giao việc. Sửa nội dung tại chỗ tự lưu ngay khi nhập và lưu lúc blur. | Edge 15/15 tổ hợp đạt, tất cả 0 mutation; 24.1/24.1-legacy/24.1-export đạt. Node 94/94. |

Trang chủ Tools không có thanh bên nên ca kiểm thử xác nhận nút ☰ ẩn trên 3 kích thước; menu và phép đo DOM vẫn kiểm tra đầy đủ. Bốn trang còn lại kiểm tra cả trạng thái thực của thanh bên sau bấm. Bản sửa layout() GĐ23G được giữ nguyên.
