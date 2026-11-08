# GIAO VIỆC GĐ8: TINH CHỈNH & SỬA LỖI (yêu cầu anh Đức 08/11/2026)

> Làm liên tục 8.1 → 8.6, không dừng chờ duyệt. Mỗi bước: `node --test --test-isolation=none` pass → git commit cục bộ (KHÔNG push) → cập nhật `TIEN-TRINH-CHOT-MA.md` (bảng GĐ8). Claude review và deploy. Giữ quy tắc trong `LENH-CHAY-DEM-CHOT-MA.md`.
> Mỗi lỗi: viết test (unit hoặc Playwright script trong `tests/` hay `docs/`) tái hiện lỗi TRƯỚC, sửa, rồi chạy lại.

## 8.1 Không nhảy về đầu trang sau thao tác (Chốt mã)
- Hiện tại bấm **Bỏ dòng**, ＋ Dòng, ⧉ nhân bản, ↑↓, ＋PA, đổi trạng thái, bật/tắt danh mục, chốt PA… → bảng render lại và **cuộn về đầu trang**, mất vị trí.
- Yêu cầu: sau mọi thao tác **giữ nguyên vị trí cuộn** (cả cuộn dọc trang lẫn cuộn ngang `.sheet-scroll`) và **giữ focus** ở ô tương ứng (dòng kế bên nếu dòng bị xoá). Tốt nhất: chỉ cập nhật phần DOM thay đổi (dòng/nhóm) thay vì render lại toàn bảng; tối thiểu: lưu `scrollTop/scrollLeft` + id ô đang focus trước khi render và khôi phục sau `requestAnimationFrame`.
- Kiểm tra: cuộn xuống nhóm thứ 8, bỏ 1 dòng → vị trí màn hình không đổi (sai lệch ≤ 1 dòng).

## 8.2 Menu trái trang Lịch bị "nhảy" khi rê chuột
- Trang Lịch (`index.html` / `style.css` / `app.js`): rê chuột qua menu trái (`.app-sidebar`, các khối `sb-collapsible`, chip, nút) thì bố cục giật/nhảy. Tìm nguyên nhân (thường là `:hover` đổi border/padding/font-weight/kích thước, thanh cuộn hiện/ẩn làm đổi bề rộng, hoặc tooltip/hover làm reflow). Sửa: hover chỉ đổi màu/nền/bóng, dùng `outline`/`box-shadow` thay border, `scrollbar-gutter: stable` cho sidebar.
- Kiểm tra bằng Playwright: đo `getBoundingClientRect` các khối trước/sau hover phải không đổi.

## 8.3 Đồng bộ giao diện Chốt mã ↔ Lịch
- Cùng **thanh header**: vị trí logo + tên, menu GD HOME Tools, nhóm nút bên phải theo thứ tự giống Lịch (`File ▾` · `✨ AI` · `Copy ảnh ▾` (xanh lá, nút chính) · Undo/Redo icon vuông · nút chính màu xanh dương ở phải cùng: bên Lịch là "Thêm việc", bên Chốt mã là "＋ Thêm dòng/nhóm"), cùng chiều cao, bo góc, màu, font, kích thước icon (lucide).
- Cùng **menu trái**: bề rộng, nền `#eef1f5`, khối trắng thu gọn, tiêu đề khối có icon emoji giống Lịch, segmented buttons (Gọn/Vừa/Ảnh lớn giống XS/S/M/L), chip checkbox 2 cột giống "Cột & đề mục".
- Cùng **tờ nội dung**: dải tiêu đề tối + chip KPI như tờ Timeline, bảng với header cột cùng màu/viền/cỡ chữ như bảng WBS, cột kéo đổi rộng có tay cầm giống `.msp-col-resizer`.
- Dùng chung CSS (tách biến màu/kích thước ra `tools.css` hoặc file chung, không copy trùng lặp). Không làm vỡ giao diện Lịch.

## 8.4 Chọn nhiều dòng để xoá cùng lúc (Chốt mã)
- Cột checkbox đầu mỗi dòng + checkbox "chọn tất cả" trong nhóm và ở header (giống bảng WBS bên Lịch). Shift+click chọn dải, Ctrl+click chọn lẻ.
- Khi có dòng được chọn: thanh nổi "Đã chọn N dòng · Xoá · Nhân bản · Đổi trạng thái ▾ · Chuyển sang nhóm ▾ · Bỏ chọn" (giống `#msp-multisel-bar`). Phím Delete xoá dòng đã chọn (hỏi xác nhận 1 lần), Esc bỏ chọn. Hoàn tác (Ctrl+Z) khôi phục được cả lượt xoá.
- Không cho xoá dòng đã nằm trong bản đã ký (hoặc cảnh báo rõ), giữ nguyên quy tắc hiện có.

## 8.5 Dán ảnh Ctrl+V trực tiếp vào ô ảnh
- Hiện **chưa dán được** ảnh từ clipboard vào ô PA / Phối cảnh 3D như yêu cầu ban đầu. Kiểm tra mọi trường hợp: bấm chọn ô (ô có viền focus) rồi Ctrl+V; rê chuột lên ô rồi Ctrl+V; ô đang có ảnh (thêm ảnh); ảnh copy từ ShareX/Snipping Tool (`image/png` trong `clipboardData.items` chứ không phải `files`), ảnh copy từ trình duyệt/Zalo/Word (có thể là HTML `<img>` dạng data-URL hoặc URL) → đọc cả `items` (`getAsFile`) và fallback `navigator.clipboard.read()`.
- Ô ảnh phải nhận focus khi bấm (tabindex, focus rõ ràng), bấm vào ô trống KHÔNG mở dialog mà chỉ chọn ô; hiện gợi ý "Ctrl+V để dán ảnh". Paste khi focus đang ở input trong dòng thì không chiếm (trừ khi clipboard chỉ có ảnh và ô đang chọn là ô ảnh).
- Có test Playwright dán ảnh qua `ClipboardEvent` với `items` (không chỉ `files`).

## 8.6 Tinh chỉnh code chung
- Rà `material-editor.js` (dài, nhiều chuỗi HTML nối): tách hàm render dòng/nhóm, bỏ trùng lặp, đặt tên rõ, xử lý lỗi thống nhất (toast giống Lịch). Không đổi định dạng dữ liệu đã lưu.
- Kiểm tra lại hiệu năng khi bảng ~150 dòng (render < 200ms, gõ không giật).
- Cập nhật `CLAUDE_HANDOVER.md` (mục 3n), ghi **"XONG GĐ8"** cuối `TIEN-TRINH-CHOT-MA.md` kèm các bước tự kiểm tra.
