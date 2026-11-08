# GIAO VIỆC GĐ14 (anh Đức 08/11/2026)

> Phần A cho GPT làm trên `main`. Phần B cho Antigravity làm trong worktree `timeline-calendar-duan` (nhánh `du-an`), trước khi push thì `git fetch` + `git merge origin/main`.
> Mỗi bước: viết test/Playwright tái hiện TRƯỚC → sửa → `node --test` + Playwright pass → commit. Xong: `git pull --rebase` (GPT) hoặc merge (Antigravity) → test lại → push lên `origin main`, KHÔNG `--force`. Cập nhật file tiến trình, ghi "XONG GĐ14A" / "XONG GĐ14B".

## PHẦN A — Chốt mã (GPT)

### A1. Khối lượng: ghi chú "(theo báo giá)" và gộp đơn vị
- Tiêu đề cột Khối lượng có dòng phụ nhỏ "(theo báo giá)" (chữ nhỏ, nghiêng). Áp dụng ở màn hình làm việc, xem trước, PNG, PDF và trang khách.
- Khi tắt cột ĐVT (Đơn vị tính), đơn vị gộp vào ô Khối lượng: `141,90 m²`. Ô vẫn nhập được số; đơn vị là nhãn nhỏ cạnh số, bấm vào để đổi, có gợi ý ĐVT. Khi bật lại cột ĐVT thì tách ra như cũ. Dữ liệu lưu không đổi (`qty`, `unit` riêng).

### A2. Cửa sổ nhỏ Ghi chú (và mọi ô gợi ý tương tự)
- Bấm ra ngoài: đóng cửa sổ và GIỮ nội dung đang gõ (lưu luôn).
- Enter: xác nhận và đóng. Shift+Enter: xuống dòng. Esc: huỷ thay đổi, đóng.
- Trong cửa sổ có nút ✕ (biểu tượng tẩy) để xoá trắng ghi chú hiện tại.
- Ô Ghi chú nhỏ trên bảng, khi rê chuột hoặc focus, cũng hiện ✕ nhỏ để xoá nhanh (Ctrl+Z hoàn tác được).
- Áp dụng cho Quy cách, Vị trí, NCC.

### A3. Tô màu hạng mục chưa liên kết Tiến độ
- Nhóm hoặc hạng mục chưa liên kết được với việc Tiến độ (không có liên kết tay, tự liên kết không đạt ngưỡng) thì tô màu vùng tiêu đề nhóm (nền vàng nhạt, viền trái cam) và hiện chip "Chưa liên kết Tiến độ".
- Bấm chip mở chọn việc Tiến độ.
- Chỉ hiện trên màn hình làm việc, KHÔNG in ra bản xuất.
- Menu trái thêm bộ lọc "Chỉ nhóm chưa liên kết".

### A4. Xoá bảng chốt mã
- Menu File ▾ (và danh sách bảng ở menu trái) có "Xoá bảng".
- Hỏi xác nhận, gõ tên bảng hoặc bấm xác nhận 2 lần. Bảng đã phát hành hoặc đã ký thì KHÔNG xoá cứng, chỉ "Lưu trữ" (ẩn khỏi danh sách, xem lại được ở mục "Đã lưu trữ", khôi phục được). Bảng nháp xoá được thật.
- Xoá kèm ảnh không còn bảng nào dùng trên B2 (hoặc đánh dấu để dọn sau).
- API có kiểm tra quyền và phiên bản (409). Có test.

### A5. Cột ảnh rộng sẵn
- Mặc định cột Phối cảnh 3D và các cột PA rộng khoảng 200 px để ảnh vuông to ngay. Người dùng đã kéo cột thì giữ độ rộng của họ.

## PHẦN B — Quản lý dự án (Antigravity)

### B1. Phối cảnh 3D dạng PDF cả nhà
- Mục tải 3D nhận cả PDF nhiều trang (một file 3D cho cả căn).
- Tách từng trang thành ảnh, bằng pdf.js trên trình duyệt, nén WebP 1600 px như GĐ13.
- Cho AI gắn phòng và hạng mục cho từng trang.
- Hiện dạng lưới thumbnail theo phòng.
- Dùng được làm ảnh Phối cảnh 3D cho Chốt mã: chọn trang → gắn vào nhóm hoặc hạng mục.

### B2. Loại công trình trong ngữ cảnh AI
- Hồ sơ dự án thêm trường "Loại công trình": Nhà phố / Chung cư / Văn phòng nhỏ / Khác. Mặc định đoán theo tên/địa chỉ, cho sửa.
- Đưa vào system prompt của AI soát bản vẽ, đề xuất tiến độ và đề xuất vật liệu, với danh mục phòng, hạng mục điển hình của từng loại (chung cư: không móng/mái, chú ý ống kỹ thuật, ban quản lý giờ thi công; nhà phố: nhiều tầng, cầu thang, mái, mặt tiền; văn phòng: trần thả, sàn nâng/thảm, vách kính, điện nhẹ).

### B3. AI chạy nền không bị ngắt khi chuyển trang
- Phân tích AI của dự án chạy thành job phía server, có `jobId`, trạng thái lưu trong kho.
- Chuyển sang Tiến độ, Chốt mã hay tải lại trang thì job vẫn chạy.
- Ô thông báo góc phải (dùng chung `shell.js`, có ở mọi trang) hiện tiến trình %, bước hiện tại và nút "Xem kết quả" khi xong.
- Huỷ được. Lỗi thì hiện lý do và nút "Thử lại".
- Kết quả đề xuất đẩy sang Tiến độ và Chốt mã vẫn hoàn tất kể cả khi người dùng đã rời trang.
- Test với AI giả lập chậm.
