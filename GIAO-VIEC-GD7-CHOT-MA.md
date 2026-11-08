# GIAO VIỆC GĐ7: CHỐT MÃ ĐỒNG BỘ VỚI LỊCH + NOTION + AI (yêu cầu anh Đức 08/11/2026)

> Làm liên tục 7.1 → 7.5, không dừng chờ duyệt. Mỗi bước: `node --test --test-isolation=none` pass → git commit cục bộ (không push) → cập nhật `TIEN-TRINH-CHOT-MA.md` (thêm bảng GĐ7). Claude review và deploy.
> Giữ nguyên quy tắc trong `LENH-CHAY-DEM-CHOT-MA.md` (không đụng dữ liệu, không --force, file mới phải thêm vào `git add` của `Cap-Nhat-Web-Len-Mang.bat`).

## 7.1 Bố cục giống web Lịch + bật/tắt phương án & danh mục
- **Giao diện đồng bộ với web Tiến độ** (`index.html`, `style.css`): cùng header 56px (logo GD HOME + tên công cụ + menu GD HOME Tools, các nút dạng `File ▾`, `Copy ảnh ▾`, `✨ AI`, `Undo/Redo`), **menu trái** nền xám `#eef1f5` với các khối trắng thu gọn được (`sb-collapsible`), font/màu/nút giống hệt. Vùng bảng có **dải tiêu đề tối** giống tờ Timeline: "BẢNG CHỐT MÃ VẬT LIỆU – <tên dự án>" + chip KPI (Nhóm · Hạng mục · Đã chốt x/y · Hạn gần nhất).
- **Menu trái** gồm:
  1. *Dự án & khách hàng*: chọn dự án (lấy từ Tiến độ), thông tin khách (xem 7.3), danh sách bảng của dự án.
  2. *Danh mục*: danh sách nhóm (MÃ GỖ, SƠN…) có **checkbox bật/tắt hiển thị**, kéo đổi thứ tự, nút **＋ Thêm danh mục**, đếm "đã chốt/tổng" từng nhóm, bấm tên để cuộn tới nhóm.
  3. *Hiển thị*: mật độ dòng (Gọn/Vừa/Ảnh lớn), **bật/tắt cột** (Phối cảnh 3D, Quy cách, KL, Đơn vị, NCC, Ghi chú, Trạng thái) giống "Cột & đề mục" bên Lịch, lọc theo phòng/trạng thái.
- **Phương án**: mặc định mỗi dòng **chỉ hiện PA1**. Nút nhỏ "＋ PA" trong dòng để thêm PA2, rồi PA3 (tối đa 3). Cột PA2/PA3 chỉ hiện khi có ít nhất 1 dòng dùng đến (hoặc bật trong *Hiển thị*). Xoá PA trống thì cột tự ẩn lại. Bản khách và A4 chỉ in các PA có dữ liệu.

## 7.2 Cột chỉnh được kích thước
- Kéo mép phải tiêu đề cột để đổi độ rộng (giống `.msp-col-resizer` bên Timeline), nháy đúp để về mặc định. Lưu theo tài khoản (trong dữ liệu Chốt mã, khoá `columnWidths`). Cột Hạng mục tự co theo chữ dài nhất nếu chưa chỉnh tay.

## 7.3 Liên kết dự án bên Lịch + đồng bộ Notion
- **Hồ sơ dự án dùng chung**: mỗi dự án Tiến độ (`projectOwners[].id`) có hồ sơ: Tên dự án, Địa chỉ, Tên khách, SĐT, Email, Số hợp đồng. Chọn dự án là **tự điền** vào bảng chốt mã + biên bản A4 (Bên A). Sửa ở Chốt mã thì lưu vào hồ sơ dự án (không ghi đè dữ liệu lịch; tên dự án đổi thì báo trước).
- **Đồng bộ từ Notion**: dùng lại kết nối Notion của tài khoản (`integrations.js`, khoá đã mã hoá). Trong cài đặt Notion thêm ô **"Link database Khách hàng / Dự án"** (khác bảng lịch). Màn hình **Lấy từ Notion**: tải danh sách dòng, **ô tìm/lọc** theo tên/địa chỉ/SĐT, **ghép cột** (chọn cột Notion nào là Dự án / Địa chỉ / Tên khách / SĐT / Email, nhớ lựa chọn), chọn 1 dòng → điền vào hồ sơ dự án đang chọn, hoặc **tạo dự án mới** ở Tiến độ với tên đó (nếu chưa có). Chỉ đọc từ Notion, không ghi ngược.
- API gợi ý: `GET /api/notion/customers?q=` (server lọc + phân trang), `POST /api/integrations/settings {notionCustomerDb, notionCustomerMap}`. Test với fetch giả lập như `tests/` hiện có.

## 7.4 Xuất ảnh giống bên Lịch
- Nút **Copy ảnh ▾**: Copy ảnh bảng (Ctrl+V vào Zalo), Tải PNG, Tải PDF A4; tuỳ chọn: tất cả / chỉ nhóm đang bật / chỉ dòng đã chốt / theo phòng. Ảnh xuất **ẩn ô nhập, nút, PA trống**, có tiêu đề + thông tin khách + logo + sọc chìm (`export-canvas.js`). Dùng html2canvas như bên Lịch.

## 7.5 AI đề xuất hạng mục từ khối lượng hợp đồng
- Nút **✨ AI** trên header: thả **hợp đồng / bảng khối lượng / báo giá** (PDF, Excel, CSV, ảnh; dán Ctrl+V) → AI lọc ra **danh mục vật liệu cần chốt mã**: nhóm (khớp 17 nhóm mẫu hoặc tạo nhóm mới), hạng mục, vị trí/phòng, khối lượng + đơn vị, quy cách gợi ý, ghi chú.
- Dùng lại hạ tầng AI có sẵn (`integrations.js`: Gemini/OpenAI/Claude theo key của tài khoản, `callWithFallback`, chạy nền + ô thông báo góc phải như bên Lịch). Endpoint mới `POST /api/ai/materials` với system prompt riêng, trả JSON `{groups:[{name, rows:[{name, room, qty, unit, spec, note}]}], questions[]}`.
- Bảng duyệt trước khi thêm: tick chọn dòng, sửa nhanh, chọn "gộp vào bảng hiện tại" (ghép vào nhóm trùng tên, bỏ dòng trùng) hoặc "tạo bảng mới".

## Hoàn thành
- Kiểm tra trên localhost đủ 7.1–7.5 (có mô tả các bước bấm thử trong TIEN-TRINH), cập nhật `CLAUDE_HANDOVER.md` (mục 3m), ghi **"XONG GĐ7"** cuối `TIEN-TRINH-CHOT-MA.md`.
