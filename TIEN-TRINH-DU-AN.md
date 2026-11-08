# TIẾN TRÌNH GĐ11 — WEB CON "QUẢN LÝ DỰ ÁN" (`/du-an`)

- **Nhánh làm việc**: `du-an` (trong git worktree `..\timeline-calendar-duan`, hoàn toàn tách biệt với `main` để không đụng công việc của GPT/Codex).
- **Cổng chạy kiểm thử**: `3300` với `DATA_DIR` riêng.

## Trạng thái các bước

- [x] **11.0 Đề xuất nhanh (`docs/DE-XUAT-DU-AN.md`)**
  - Thiết kế cấu trúc dữ liệu `ProjectHubRecord`, `Document`, `QuoteItem`, `ReviewFinding`.
  - Thiết kế luồng lưu trữ `ProjectAssets` (R2 + fallback đĩa cục bộ `DATA_DIR/project-files`), đọc báo giá Excel/CSV/PDF, soát bản vẽ HSKT & 3D theo từng trang + đóng dấu ghi chú trực tiếp vào PDF, và đề xuất 2 chiều sang Tiến độ & Chốt mã kèm liên kết ngược `sourceQuoteItemId`.
- [ ] **11.1 Khung trang `/du-an`**
- [ ] **11.2 Tải hồ sơ (Báo giá, Bản vẽ HSKT PDF, Phối cảnh 3D)**
- [ ] **11.3 Đọc báo giá → Danh sách hạng mục chuẩn hoá**
- [ ] **11.4 Soát bản vẽ HSKT & phối cảnh 3D theo báo giá + Ghi chú vào PDF**
- [ ] **11.5 Đề xuất sang Tiến độ & Chốt mã + Liên kết ngược**
- [ ] **11.6 Liên kết dữ liệu 3 trang + Notion + AI chung**
- [ ] **11.7 Kiểm tra (Unit test + Playwright E2E) & Bàn giao**

## Nhật ký thay đổi file dùng chung (để Claude gộp nhánh `du-an` vào `main`)
*(Sẽ cập nhật chi tiết từng dòng ở mỗi bước)*
