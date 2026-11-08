# Hệ thống giao diện GD HOME Tools

Nạp `shell.css` trước CSS của trang và `shell.js` trước JS của trang. Khi phát hành, cập nhật phiên bản cache của các tệp đổi. Trang Quản lý dự án có thể dùng trực tiếp hai tệp này và đăng ký chúng trong danh sách tệp tĩnh của server.

| Thành phần | Class hoặc API | Cách dùng |
| --- | --- | --- |
| Màu, font và kích thước | `--gd-font`, `--gd-sidebar-width`, `--gd-sidebar-background`, `--gd-header-height`, `--gd-primary`, `--gd-success`, `--gd-radius`, `--gd-control-radius`, `--gd-icon-size` | Dùng Roboto và các biến chung trong CSS trang. Nạp Roboto và Lucide 0.468.0 như `index.html`. |
| Header 56 px | `.app-header`, `.header-left`, `.app-logo`, `.header-logo-img`, `.header-right`, `.shell-toolbar` | Bên trái có menu, logo và tên tool. Bên phải theo thứ tự File, AI, Copy ảnh, Undo/Redo, nút chính. Lệnh riêng của tool có thể đặt sau cụm này hoặc trong File. |
| Menu công cụ | `<details class="gd-tools-menu" data-shell-menu></details>` | Shell tự điền các đường dẫn khi tải. Với markup tạo sau, gọi `GDHomeShell.menu(details)`. |
| Nút và menu lệnh | `.btn .btn-outline`, `.btn-primary`, `.btn-success`, `.hdr-split-group`, `.hdr-split-main`, `.hdr-split-caret`, `.hdr-undo-group`, `.hdr-icon-sq`, `.hdr-menu-item` | Dùng nút xanh lá cho Copy ảnh và xanh dương cho nút chính. `GDHomeShell.dropdown(command,label,glyph,body,variant)` trả markup menu details. `body` là markup nội bộ đã escape dữ liệu nhập. |
| Sidebar | `.shell-sidebar.sidebar-compact`, `.sb-collapsible`, `.sb-head`, `.sb-body`, `.sb-row-label`, `.sb-seg-btns`, `.sb-chip-grid`, `.sb-chip` | Sidebar rộng 262 px, nền `#eef1f5`. Dùng details/summary cho mục gập, `aria-pressed` cho nút phân đoạn. Đặt `--gd-segments` theo số nút. Chip xếp hai cột. |
| Toast | `GDHomeShell.toast(message[,element])`, `.toast-notification` | Nhận văn bản, tự ẩn sau 3,2 giây. Truyền nút chứa có sẵn nếu cần giữ ID cũ. |
| Lưu | `GDHomeShell.saveStatus(element,state[,detail,shortLabel])`, `.save-status`, `.is-inline` | Trạng thái `saved`, `pending`, `saving`, `error`, `conflict`, `offline`, `guest`. Đặt `role="status"` với phần tử thông báo. |
| Chọn nhiều | `.msp-multisel-bar`, `.msp-multisel-actions`, `.msp-multisel-btn` | Hiện “Đã chọn N” và thao tác của tool. Dùng `hidden` hoặc ẩn bar khi N = 0. |
| Hộp thoại | `GDHomeShell.dialog(element,markup)`, `.shell-dialog`; `.modal-overlay` / `.modal-card` cho Lịch hiện có | Dùng native dialog cho trang mới. Hàm mở modal, thêm nút đóng và giữ hành vi Esc của trình duyệt. |
| AI chạy nền | `GDHomeShell.aiNotice(id,{state,body,label,onAction,onClose})` | Trạng thái `running`, `done`, `error`. `body` là markup nội bộ đã escape dữ liệu nhập. Nút xem mở phần duyệt của tool. |
| Lightbox | `GDHomeShell.lightbox({title,count,render,crop,remove,onClose,onError})` | `count()` trả số ảnh. `render(index,figure)` dựng ảnh. `crop(index,dialog,refresh)` và `remove(index)` tùy chọn; remove trả true khi đã xoá. Esc/bấm nền để đóng, mũi tên đổi ảnh. |
| Escape | `GDHomeShell.closeMenus()` | Trả true nếu đã đóng một menu. Gọi sau khi kiểm tra dialog đang mở, trước khi bỏ chọn hoặc bỏ focus. Native dialog tự xử lý Esc. |
| Icon | `GDHomeShell.icon(name[,fallback])`, `GDHomeShell.icons()` | Hàm đầu trả markup Lucide có aria-hidden, hàm sau nâng cấp các icon sau khi dựng lại DOM. Đặt nhãn truy cập trên nút chứa icon. |

```html
<link rel="stylesheet" href="/shell.css?v=gd101">
<script src="/shell.js?v=gd101" defer></script>
<header class="app-header">
  <div class="header-left">
    <details class="gd-tools-menu" data-shell-menu></details>
    <a class="app-logo" href="/du-an"><img class="header-logo-img" src="/gdhome-icon.png" alt="GD HOME">Quản lý dự án</a>
  </div>
  <div class="header-right shell-toolbar" id="project-actions"></div>
</header>
<aside class="shell-sidebar sidebar-compact">
  <details class="sb-collapsible" open>
    <summary class="sb-head">Hiển thị</summary>
    <div class="sb-body"><!-- Tuỳ chọn của tool --></div>
  </details>
</aside>
```

## Đối chiếu Lịch và Chốt mã

| Tính năng | Lịch | Chốt mã | Cách áp dụng |
|---|---|---|---|
| Header, menu trái, modal, toast, trạng thái lưu, AI chạy nền | ✓ | ✓ | Dùng shell. Gắn `data-shell-slot` theo thứ tự `file`, `ai`, `copy`, `undo`, `primary` trong `.shell-toolbar`, rồi tới `.shell-account`. |
| Cột/đầu bảng cố định, kéo đổi độ rộng, nháy đúp và phím mũi tên | ✓ | ✓ | Giữ cách cuộn theo bố cục từng bảng. |
| Mật độ XS/S/M/L và độ đậm Mảnh/Thường/Đậm/Rất đậm | ✓ | ✓ | Chốt mã tính cả kích thước ảnh theo mật độ. |
| Chọn nhiều, thanh thao tác, nhân bản và hoàn tác | ✓ | ✓ | Lịch dịch ngày theo nhóm và giữ liên kết. Chốt mã đổi trạng thái, chuyển nhóm, giữ bảo vệ dòng thuộc bản đã ký. |
| Xem ảnh lớn, Esc và điều hướng ảnh | ✓ | ✓ | Lịch mở được logo trong bảng. Chốt mã mở ảnh trong ô, có cắt/xoá và nút chốt PA riêng. |
| Tiêu đề theo dự án và ngày hiện tại | ✓ | ✓ | Lịch hiển thị tháng lập bảng; Chốt mã mặc định ngày theo giờ Việt Nam khi tạo bảng. |
| Copy ảnh, PNG, PDF A4, bật/tắt sọc chìm | ✓ | ✓ | Lịch có chọn phạm vi ngày và chế độ quét vùng. Chốt mã có lọc nhóm/dòng/phòng. PNG/clipboard dùng cùng `export-canvas.js`. PDF Lịch vừa khổ A4 ngang, PDF Chốt mã in bảng nhiều trang. |
| Màn đăng nhập, phiên theo tài khoản, chế độ khách | ✓ | ✓ | Chia sẻ thẻ đăng nhập và Google Sign-In. Khách lưu cục bộ, kể cả ảnh Chốt mã, có thể chép bảng sang tài khoản khi đăng nhập. |
| Xung đột 409 | ✓ | ✓ | Chốt mã bảo toàn bản nháp hiện tại và cho lưu JSON để đối chiếu. |
| Tuỳ chọn hiển thị theo tài khoản | ✓ | ✓ | Chốt mã ghi `/api/materials/preferences` với phiên bản riêng, khôi phục từ server và giữ thay đổi chưa gửi ở localStorage. |
| Liên kết FS/SS, lịch nghỉ, âm lịch, XML MS Project | ✓ | ✗ | Nghiệp vụ Lịch. Chốt mã dùng lịch làm việc và liên kết tới việc để tính hạn vật liệu. |
| Duyệt mã, chữ ký, biên bản và Excel mua hàng | ✗ | ✓ | Nghiệp vụ Chốt mã. Lịch đọc ✓/⚠ theo việc liên quan. |

Các lệnh đăng nhập của shell dùng `GDHomeShell.loginCard(title)` và `GDHomeShell.googleSignIn({clientId,container,onCredential,autoSelect})`. Tuỳ chọn xuất của Lịch và Chốt mã giữ bộ lọc tương ứng với từng loại dữ liệu.

Nạp `integrations-client.js` sau `shell.js` để dùng nút **⚙ Kết nối** trong menu. Nút tắt của từng luồng dùng `data-open-connections="notion"` hoặc `data-open-connections="ai"`. Mọi trang đọc và lưu tại `/api/integrations/settings` qua `GDHomeConnections.settings([patch])`. Sau khi lưu, sự kiện `gdhome:connections` mang cấu hình đã che khoá. Biểu mẫu ghép cột của trình nhập Notion gắn với bảng kết quả nhập.

Nạp `ai-client.js` để dùng `GDHomeAI.attachments({state,input,drop,list,root,onChange})`, `GDHomeAI.prepare(files,notes)` và `GDHomeAI.run(state,{request,onStart,onDone,onError,onFinish})`. Hai tool dùng chung trình chọn/dán/xem ảnh, nén tài liệu, chạy nền và thanh báo để mở duyệt. Bảng duyệt giữ các trường nghiệp vụ của mỗi tool.

Hồ sơ dự án đặt tại `projectOwners[].profile`, theo ID dự án; tên lấy từ `projectOwners[].name`. Quản lý dự án có thể dùng `GDHomeProjects.list()` và `GDHomeProjects.save({projectId,profile})` trong `projects-client.js`. API `GET /api/projects` trả `{projects:[{id,name,profile}],version}`; `POST /api/projects` nhận các trường sửa và trả `{project,profile,version}`. Dùng `create:true` với `profile.project` để tạo dự án và giai đoạn đầu. Trang hiển thị lại hồ sơ khi quay lại tab. Tên Lịch là tên chuẩn khi đọc hồ sơ cũ; các trường liên hệ cũ được lấy từ Chốt mã khi chưa có hồ sơ mới. Bản đã phát hành lưu ảnh chụp hồ sơ tại thời điểm phát hành.


## GĐ18B.1: Đồng bộ khung giao diện 4 trang (Lịch, Chốt mã, Quản lý dự án, Tools)

### 1. Bộ biến màu & kích thước chung (:root)
- Chiều cao nút: `--gd-btn-height: 32px` (áp dụng cho mọi `.btn`, `button.button`, `a.button`, icon buttons).
- Nền hộp thoại / popover / toast: `--gd-overlay-bg: #f4f1ec` (be ghi nhạt).
- Viền hộp thoại / popover / toast: `--gd-overlay-border: #d8d2c8`.
- Bo góc: `--gd-overlay-radius: 10px`.
- Đổ bóng: `--gd-overlay-shadow: 0 10px 28px rgba(15, 23, 42, 0.16)`.

### 2. Cấu trúc Header chuẩn ở mọi trang
Mọi trang (`/`, `/chot-ma`, `/du-an`, `/tools`) dùng chung cấu trúc:
```html
<header class="app-header">
  <div class="header-left">
    <!-- Nút toggle sidebar nếu trang có thanh bên trái -->
    <button type="button" class="icon-btn shell-sidebar-toggle" id="btn-toggle-sidebar" title="Ẩn/Hiện thanh bên trái">
      <i data-lucide="menu">☰</i>
    </button>
    <details class="gd-tools-menu" data-shell-menu></details>
    <a class="app-logo" href="...">
      <img src="/gdhome-icon.png" class="header-logo-img" alt="GD HOME">
      <span>Tên trang</span>
    </a>
  </div>
  <div class="header-right">
    <div class="shell-toolbar">
      <!-- Các slot lệnh: file, ai, copy, undo, primary -->
    </div>
    <div class="shell-account">
      <strong id="identity"></strong>
    </div>
  </div>
</header>
```

### 3. Nút ẩn/hiện thanh bên trái (Sidebar Toggle)
- Icon `menu` (hoặc fallback `☰`), kích thước 32px, nằm ở đầu `.header-left`.
- Tự động khởi tạo bởi `GDHomeShell.initSidebarToggle()` cho bất kỳ trang nào có sidebar (`.app-sidebar`, `.material-sidebar`, `.shell-sidebar`).
- Lưu trạng thái ẩn/hiện theo từng trang: `localStorage.getItem('gdhome_sidebar_hidden:' + location.pathname)`.
- Khi thu gọn: gán `is-sidebar-collapsed` lên `body` và `collapsed` lên sidebar element.

### 4. Bảng đối chiếu lớp Chốt mã cần chuyển đổi sang lớp dùng chung

| Thành phần ở Chốt mã | Lớp / ID hiện tại ở Chốt mã | Lớp / ID chuẩn Shell cần chuyển đổi | Ghi chú |
|---|---|---|---|
| Header Chốt mã | `.material-header` | `.app-header` | Đã dùng biến chung; có thể bỏ tiền tố `material-` |
| Vùng nút lệnh header | `#material-header-actions` | `.shell-toolbar` | Gắn slot `data-shell-slot="file/ai/copy/undo/primary"` |
| Nút thêm dòng/nhóm | `#material-add` | `[data-shell-slot="primary"] .btn-primary` | Màu xanh dương `#1a73e8`, chiều cao 32px |
| Nút sao chép ảnh | `#material-copy` | `[data-shell-slot="copy"] .btn-success` | Màu xanh lá `#188038`, chiều cao 32px |
| Trạng thái lưu | `#save-label.save-status` | `.save-status.is-inline` | Nằm trong `.shell-toolbar` |
| Thông báo toast | `#material-toast` | `.toast-notification` | Dùng chung hàm `GDHomeShell.toast()` |
| Khung làm việc | `.material-workspace` | `.shell-workspace` | Layout grid 2 cột (sidebar + main) |
| Thanh bên trái | `.material-sidebar` | `.shell-sidebar.sidebar-compact` | Rộng 262px, nền `#eef1f5` |
| Tiêu đề khối thu gọn | `.material-sidebar summary` | `.sb-head` | Chữ hoa 11.5px, màu `#334155` |
| Thân khối thu gọn | `.material-sidebar-body` | `.sb-body` | Padding chuẩn 0 8px 8px |
| Nhóm nút phân đoạn | `.material-density`, `.material-font-buttons` | `.sb-seg-btns` | Nút nhỏ chọn XS/S/M/L, đậm/nhạt |
| Trường thông tin dự án | `.material-meta-fields` | `.sidebar-meta-item` / `.sidebar-compact` | Hiển thị thông tin khách/dự án |
| Hộp thoại cắt ảnh | `.crop-dialog` | `.shell-dialog.crop-dialog` | Nền `#f4f1ec`, viền `#d8d2c8`, bo góc 10px |
| Menu gợi ý ghi chú | `.suggestions` | `.suggestions` / `.hdr-dropdown-menu` | Nền `#f4f1ec`, viền `#d8d2c8`, đổ bóng overlay |
| Biểu mẫu ghi chú | `.material-notes-form` | `.shell-dialog-form` | Dùng layout grid chuẩn của shell |
| Xem ảnh lớn | `[data-action="pick-pa"]` | `GDHomeShell.lightbox` | Dùng chung lightbox xem ảnh và cắt ảnh |
