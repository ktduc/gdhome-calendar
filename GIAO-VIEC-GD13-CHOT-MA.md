# GIAO VIỆC GĐ13: ẢNH TO VUÔNG, BẢN XUẤT KHÔNG TRÀN, TÙY CHỌN TỰ THÊM, NÉN ẢNH (anh Đức 08/11/2026)

> Làm liên tục 13.1 → 13.5. Mỗi bước: viết test/Playwright tái hiện lỗi TRƯỚC → sửa → `node --test` + Playwright pass → commit. Xong hết: `git pull --rebase origin main` → test lại → `git push origin main` (KHÔNG --force). Cập nhật `TIEN-TRINH-CHOT-MA.md` (bảng GĐ13), ghi "XONG GĐ13". Ảnh lỗi: `docs/gd13/1-xuat-loi.png`.

## 13.1 Bản xuất / xem trước bị tràn khổ giấy
- Ảnh `1-xuat-loi.png`: bảng rộng hơn tờ giấy trắng, cột "Vị trí" và cột sau bị lòi ra ngoài mép phải (mũi tên cam). Tiêu đề, ngày và logo căn theo tờ giấy, nhưng bảng thì không.
- Yêu cầu: tổng độ rộng các cột ĐANG IN luôn vừa khổ (A4 ngang hoặc khổ ảnh). Nếu tổng rộng hơn, co tỉ lệ các cột chữ (giữ cột ảnh vuông theo 13.2) hoặc thu cả bảng bằng scale, KHÔNG để tràn. Viền phải bảng trùng mép phải nội dung giấy. Cột tắt máy in thì không chiếm chỗ.
- Ô nhập rỗng không được hiện viền đứt đỏ trong bản xuất (ô "Mẫu vật liệu" dòng 1 trong ảnh). Ảnh xuất ẩn mọi ô nhập, nút, viền focus, placeholder.
- Playwright: ở 1050, 1440 và 1920 px, với 6–12 cột đang in: `table.right <= paper.right` và không có phần tử `input`/viền dashed nào hiển thị trong vùng xuất.

## 13.2 Ảnh to, vuông, lấp đầy ô; dòng tự giãn
- Ảnh Phối cảnh 3D và ảnh PA hiện **vuông, rộng bằng toàn bộ bề rộng ô** (trừ đệm khoảng 4 px), `object-fit: cover`, như khung cam trong ảnh. Dòng **tự giãn chiều cao** theo ảnh (cột rộng 245 px thì ảnh khoảng 237×237 và dòng cao tương ứng).
- Áp dụng ở màn hình làm việc, xem trước, PNG, PDF A4 và trang khách `/duyet`. Làm thế nào thì xuất ra thế ấy.
- Nhiều ảnh trong một ô: ảnh đầu to vuông, các ảnh sau là dải thumbnail nhỏ bên dưới, hoặc lưới 2×2 nếu đủ 4 ảnh. Bấm ảnh mở lightbox như cũ.
- Kéo rộng cột ảnh thì ảnh to theo. Mật độ Gọn/Vừa/Ảnh lớn vẫn có tác dụng với các cột chữ, nhưng ảnh luôn lấp đầy theo bề rộng cột.
- Dòng không có ảnh giữ chiều cao bình thường, không bị giãn.

## 13.3 Mọi trường gợi ý luôn có "＋ Thêm tùy chọn"
- Ghi chú, Quy cách, Vị trí, ĐVT, NCC, Tên hạng mục và mọi trường có danh sách gợi ý: cuối danh sách luôn có dòng **"＋ Thêm '<chữ đang gõ>' vào gợi ý"** và nút **"Quản lý gợi ý"** (sửa/xoá/kéo thứ tự).
- Tùy chọn tự thêm lưu theo tài khoản trên server (cùng kho viewSettings/preferences), dùng lại cho mọi bảng, mọi dự án. Gắn theo nhóm vật liệu nếu đang ở nhóm đó, kèm lựa chọn "dùng cho mọi nhóm".
- Tùy chọn tự thêm hiện trên cùng, kèm dấu ★. Dùng nhiều thì xếp lên đầu.
- Test: thêm, tải lại vẫn còn, sang dự án khác vẫn thấy, xoá được.

## 13.4 Nén ảnh tối đa khi dán / tải lên
- Ngay trên trình duyệt trước khi gửi lên server: thu cạnh dài nhất về **1600 px** (đủ in A4), xuất **WebP chất lượng 0,8**, fallback JPEG 0,82 nếu trình duyệt không hỗ trợ WebP. Ảnh đã nhỏ hơn thì giữ nguyên kích thước, chỉ đổi định dạng nếu file nhỏ đi.
- Thêm bản thumbnail 480 px cho màn hình làm việc (tải nhanh), bản 1600 px dùng cho xuất, PDF và lightbox.
- Giữ nguyên ảnh PNG có nền trong suốt (logo): WebP lossless hoặc PNG.
- Cùng một ảnh (cùng hash) chỉ lưu một lần trên B2.
- Hiện dung lượng trước → sau (ví dụ "3,2 MB → 210 KB") trong toast nhỏ khi dán.
- Áp dụng cho Chốt mã (PA, 3D) và Quản lý dự án (ảnh 3D). PDF bản vẽ giữ nguyên.
- Test: ảnh PNG 4000×3000 khoảng 5 MB sau nén phải nhỏ hơn 400 KB, cạnh dài 1600 px.

## 13.5 Kiểm tra & bàn giao
- Playwright so sánh màn hình làm việc với PNG xuất cùng một bảng (13.1 + 13.2) và chụp ảnh đặt vào `docs/gd13/`.
- Cập nhật `CLAUDE_HANDOVER.md` (mục 3q). Ghi "XONG GĐ13".
