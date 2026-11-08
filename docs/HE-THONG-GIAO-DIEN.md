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
