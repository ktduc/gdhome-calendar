# KẾ HOẠCH ĐỒNG BỘ KHUNG GIAO DIỆN GD HOME TOOLS (GĐ23B.1)

Tài liệu thiết kế và kế hoạch đồng bộ khung giao diện trên toàn bộ 5 trang của hệ thống:
1. `/` (Lập tiến độ thi công)
2. `/chot-ma` (Chốt mã vật liệu)
3. `/du-an` (Quản lý dự án & Hồ sơ HSKT/3D)
4. `/tools` (Trang chủ GD HOME Tools)
5. `/giao-viec` (Giao việc · Tổng hợp nhà thầu - tool mới GĐ23B.2)

---

## 1. BẢNG ĐỐI CHIẾU HIỆN TRẠNG VÀ PHƯƠNG ÁN ĐỒNG BỘ

| Thành phần | `/` (Lịch Tiến Độ) | `/chot-ma` (Chốt Mã) | `/du-an` (Quản Lý Dự Án) | `/tools` (Trang Chủ) | `/giao-viec` (Giao Việc) | Phương án chuẩn hóa GDHomeShell.layout() |
|---|---|---|---|---|---|---|
| **Header** | Chiều cao 56px, flex-between, sticky top. Thứ tự left: [☰, menu Tools, logo]. | Chiều cao 56px, left: [menu Tools, logo], chưa có sẵn ☰ trong HTML tĩnh. | Chiều cao 56px, left: [☰, menu Tools, logo]. | Chiều cao 56px, left: [menu Tools, logo]. | Khởi tạo với layout chuẩn. | **Đồng bộ chuẩn 52px** (`--gd-header-height: 52px`), sticky top, z-index 100. Thứ tự: `[☰ ẩn/hiện thanh bên] [logo + tên trang] [menu Tools] … [nhóm nút lệnh của trang] [trạng thái lưu] [hồ sơ đăng nhập]`. |
| **Logo** | `.app-logo` (icon 30px + text "Lịch Tiến Độ"). | `a.app-logo` href `/chot-ma` (icon 30px + text "Chốt mã vật liệu"). | `a.app-logo` href `/du-an` (icon 30px + text "Quản lý dự án"). | `a.app-logo` href `/tools` (icon 30px + text "Trang chủ"). | `a.app-logo` href `/giao-viec` (icon 30px + text "Giao việc · Nhà thầu"). | Tất cả đều là thẻ `<a>` (trang chủ hoặc reload trang hiện tại), chứa `img.header-logo-img` 28px + `span` tên trang, font weight 600, color `#1e293b`. |
| **Menu GD HOME Tools** | `<details class="gd-tools-menu" data-shell-menu>` đứng trước logo. | `<details class="gd-tools-menu" data-shell-menu>` đứng trước logo. | Đứng trước logo. | Đứng trước logo. | Đứng sau logo. | **Chuyển vị trí đứng ngay sau Logo**: `[☰] [Logo] [Menu Tools]`. Bổ sung mục `/giao-viec` (Giao việc · Nhà thầu) vào danh sách điều hướng. Tự đóng khi click ngoài / Esc. |
| **Nút ẩn/hiện thanh bên (☰)** | `#btn-toggle-sidebar` 32px ở đầu `.header-left`, ẩn `.app-sidebar`. | Chưa có trực tiếp trên markup (chèn động qua JS), ẩn `.material-sidebar`. | `#btn-toggle-sidebar` 32px ở đầu `.header-left`, ẩn `.shell-sidebar`. | Ẩn vì trang chủ không có thanh bên cố định. | `#btn-toggle-sidebar` 32px ở đầu `.header-left`, ẩn `.shell-sidebar`. | **Chuẩn hóa nút ☰ 32px** tròn ở vị trí đầu tiên của `.header-left`. Gập/mở sidebar cùng hiệu ứng, lưu trạng thái riêng biệt theo trang qua `localStorage['gdhome_sidebar_hidden:' + location.pathname]`. |
| **Hồ sơ đăng nhập (Avatar + Tên + Menu)** | Hiện gồm `#btn-user-account`, `#guest-mode-chip`, `#btn-guest-login` phân mảnh. | Tương tự Lịch / Tools, hiển thị email hoặc text "Khách". | Chỉ có `#identity`. | Dùng `#identity` + nút đăng nhập. | Dùng layout chuẩn. | **Avatar tròn 28px (`user-chip-avatar`) + tên rút gọn** ở góc phải mọi trang (`.shell-account`). Bấm mở dropdown menu: Email đầy đủ, ⚙ Kết nối, 💾 Sao lưu, 🚪 Đăng xuất. Ở chế độ khách: hiện nút "Đăng nhập" (kèm badge Khách). |
| **Nhóm nút lệnh (Toolbar)** | `.shell-toolbar`: File, AI, Copy ảnh (xanh lá), Undo, + Thêm việc (xanh `#1a73e8`). | `.material-header-actions`: File, Copy ảnh, Lọc, Xuất PDF, Thêm dòng. | `.shell-toolbar`: File, AI, Copy ảnh, Undo, Soát bản vẽ. | Không có toolbar phức tạp. | `.shell-toolbar`: File (Excel), Copy ảnh, Thêm phiếu / Thêm nhà thầu. | Nhóm nút lệnh nằm trong `.shell-toolbar`. Nút "Copy ảnh" màu xanh lá `--gd-success: #188038` được giữ nguyên. Nút thao tác chính màu xanh dương `--gd-primary: #1a73e8`. Chiều cao nút 32px. |
| **Thanh bên trái (Sidebar)** | `.app-sidebar` rộng 262px, nền `#eef1f5`. | `.material-sidebar` rộng 260px, nền `#eef1f5`. | `.shell-sidebar` rộng 262px, nền `#eef1f5`. | Không có thanh bên. | `.shell-sidebar` rộng 260px, nền `#eef1f5`. | **Thống nhất độ rộng chính xác 260px** (`--gd-sidebar-width: 260px;`), nền `#eef1f5`, viền phải `1px solid #dadce0`. Áp dụng chung logic đóng mở và nhớ trạng thái. |
| **Vùng nội dung** | Cuộn riêng (`#calendar-view`), header dính đỉnh. | Cuộn riêng (`.material-main`, `.material-workspace`), cố định header. | Cuộn riêng (`.hub-main-content`, `overflow-y: auto`), chiều cao 100vh - 52px. | Cuộn theo trang. | Cuộn riêng (`.work-main-content`, `overflow-y: auto`), chiều cao 100vh - 52px. | **Nội dung cuộn riêng**: `height: calc(100vh - 52px)`, `overflow-y: auto`. Header cố định hoàn toàn không bị cuộn trôi. |
| **Hộp thoại (Dialog / Modal)** | Mix giữa `<div class="modal-overlay">` và `<dialog>`. Nền be ghi. | `.shell-dialog`, `.crop-dialog`. Nền be ghi. | `.hub-dialog`, `<dialog>`. Nền be ghi. | Native `<dialog>` / GDHomeShell.dialog. | Native `<dialog>` / GDHomeShell.dialog. | **100% dùng native `<dialog>`** hoặc class `.shell-dialog`. Nền be ghi nhạt `--gd-overlay-bg: #f4f1ec`, viền `--gd-overlay-border: #d8d2c8`, bo góc 10px, tiêu đề 16px, nút đóng × 28px bo góc 6px. Đóng khi click ngoài hoặc nhấn Esc. |
| **Toast thông báo** | `.toast-notification` fixed bottom, nền be ghi. | `#material-toast`. Nền be ghi. | `#hub-toast`. Nền be ghi. | `.toast-notification`. | `.toast-notification`. | Dùng chung `GDHomeShell.toast(message)`, nền be ghi `--gd-overlay-bg: #f4f1ec`, viền `#d8d2c8`, chữ `#1e293b`, bo góc 10px, shadow `0 10px 28px rgba(15,23,42,0.16)`. Tự tắt sau 3.2s. |
| **Trạng thái lưu** | `.save-status` ở góc dưới hoặc inline toolbar. | `#save-label.save-status`. | `#save-status.save-status.is-inline`. | `#tools-connection`. | `.save-status.is-inline`. | Dùng chung `GDHomeShell.saveStatus(element, state)` hiển thị ở thanh header (ngay trước hồ sơ đăng nhập) với các trạng thái chuẩn: ✓ Đã lưu, ⟳ Đang lưu…, ● Chưa lưu, 💾 Chế độ khách, ⚠ Lỗi. |

---

## 2. KẾ HOẠCH TRIỂN KHAI BƯỚC 2 (23B.1 THỰC HIỆN)

### 2.1. Cập nhật `shell.css`
- Thiết lập `--gd-header-height: 52px;` và `--gd-sidebar-width: 260px;`.
- Chuẩn hóa layout flex header với căn chỉnh dọc hoàn hảo `align-items: center`, `height: 52px`.
- Chuẩn hóa avatar tài khoản: hình tròn `width: 28px; height: 28px; border-radius: 50%; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: #1a73e8; color: #fff; font-weight: 700; font-size: 13px;`.
- Chuẩn hóa tên người dùng rút gọn: `max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 500; color: #1e293b;`.
- Chuẩn hóa menu tài khoản thả xuống (Dropdown popover) với nền `#f4f1ec`, viền `#d8d2c8`, bo góc 10px:
  - Header: Email người dùng.
  - Mục "⚙ Kết nối" (gọi `GDHomeConnections.open()`).
  - Mục "💾 Sao lưu" (gọi sao lưu Drive / tải snapshot JSON).
  - Mục "🚪 Đăng xuất" (xóa session và tải lại trang).
- Ở chế độ khách: hiển thị pill "👤 Khách" và nút "Đăng nhập" (`.btn-primary .btn-sm`).

### 2.2. Xây dựng hàm `GDHomeShell.layout(options)` trong `shell.js`
- Tự động sắp xếp lại và gắn các thành phần chuẩn vào `.app-header`:
  1. `.header-left`:
     - Nút ☰ `#btn-toggle-sidebar` (kích thước 32px, có tooltip, aria-expanded).
     - Logo trang `a.app-logo` (icon 28px + tên trang).
     - Menu Tools `<details class="gd-tools-menu" data-shell-menu>` (sau logo, hỗ trợ phím Esc).
  2. `.header-right`:
     - Toolbar trang `.shell-toolbar` (giữ nguyên các nút File, AI, Copy ảnh màu xanh `#188038`, Undo/Redo, nút chính màu xanh `#1a73e8`).
     - Trạng thái lưu `.save-status`.
     - Khu vực tài khoản `.shell-account`: avatar 28px tròn + tên rút gọn + dropdown menu tài khoản (hoặc nút Đăng nhập khi ở chế độ khách).
- Tự động khởi tạo và chuẩn hóa sidebar:
  - Rộng đúng 260px.
  - Áp dụng nhớ trạng thái gập/mở theo URL: `localStorage.getItem('gdhome_sidebar_hidden:' + location.pathname)`.
  - Phím tắt / click nút ☰ kích hoạt `GDHomeShell.toggleSidebar()`.
- Chốt mã (`/chot-ma`):
  - **Không sửa file chot-ma.html và material-*.js**.
  - `GDHomeShell.layout()` tự động nhận diện trang `/chot-ma` (thông qua `location.pathname === '/chot-ma'` hoặc `.material-header`), tái cấu trúc header động qua DOM, chèn nút ☰ ở đầu, xếp logo, menu Tools, trạng thái lưu và avatar đúng vị trí.

### 2.3. Bổ sung mục `/giao-viec` vào danh sách công cụ GD HOME Tools
- Trong `shell.js` menu links:
  `['/', 'Lập tiến độ'], ['/chot-ma', 'Chốt mã vật liệu'], ['/du-an', 'Quản lý dự án'], ['/giao-viec', 'Giao việc · Nhà thầu'], ['/tools', 'Trang chủ']`.
- Trong `tools.html`: thêm card công cụ "Giao việc · Tổng hợp nhà thầu".

### 2.4. Khung trang `/giao-viec` (`giao-viec.html`)
- Thiết lập khung trang sử dụng `GDHomeShell.layout()` chuẩn 52px header, sidebar 260px, vùng cuộn nội dung riêng biệt.
- Khai báo routing và file tĩnh trong `server.js`.

### 2.5. Kiểm thử Playwright
- Viết test suite tự động kiểm tra vị trí và kích thước:
  - Header: `y == 0`, `height == 52px` (±1px) trên cả 5 trang.
  - Nút ☰: `x` cách lề trái ~16px, `y` căn giữa header ~10px, kích thước 32x32px (±1px).
  - Avatar tài khoản: nằm ở góc phải, kích thước 28x28px tròn (±1px).
- Chụp ảnh kiểm chứng sau khi hoàn thiện (1440px) lưu vào `docs/gd23/`:
  - `sau-lich-1440.png`
  - `sau-chot-ma-1440.png`
  - `sau-du-an-1440.png`
  - `sau-tools-1440.png`
  - `sau-giao-viec-1440.png`
