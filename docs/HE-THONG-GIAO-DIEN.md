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
