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
