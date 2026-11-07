# HƯỚNG DẪN: ĐỒNG BỘ NOTION & AI LẬP TIẾN ĐỘ

Không cần vào Render nữa: **mỗi người tự dán khoá ngay trong app** (cần đăng nhập Gmail; chế độ khách không dùng được).
Khoá được **mã hoá** rồi lưu trên server (Gist bí mật), trình duyệt không đọc lại được, người khác không thấy.

---

## A. Notion: 1 database cố định chứa toàn bộ lịch ("dự án lớn")

Mở app → **File ▾ → Đồng bộ Notion…** → mục **⚙ Kết nối Notion**:

1. Mở https://www.notion.so/profile/integrations → **New integration** → tên `GD HOME Lich`, chọn workspace, Type **Internal** → **Save** → copy **Internal Integration Secret** (dạng `ntn_...`).
2. Trong Notion tạo 1 trang mới → gõ `/database` → **Database – Full page**, đặt tên vd **TIẾN ĐỘ GD HOME**. Thêm 1 cột kiểu **Date** tên `Ngày`.
3. Ở database bấm **•••** (góc phải trên) → **Connections** → chọn `GD HOME Lich` → **Confirm** (bắt buộc).
4. **Share → Copy link** của database.
5. Dán mã `ntn_...` và link vào app → **Lưu & kiểm tra**. App tự tạo thêm các cột **Dự án**, **Giai đoạn** (kiểu Select), **Tiến độ**, **GDHomeID** (đừng xoá cột này).

Trên Notion, thêm view **Timeline** hoặc **Calendar** theo cột `Ngày`, rồi **Group by → Dự án** (hoặc Giai đoạn) để xem như 1 dự án lớn chia nhóm.

Các nút trong app:
- **Chỉ đẩy lên Notion**: mỗi công việc = 1 dòng. Đẩy lại sẽ cập nhật đúng dòng cũ, không trùng.
- **Chỉ lấy từ Notion về**: dòng sửa trên Notion sau lần đồng bộ trước → cập nhật tên / ngày / tiến độ vào app. Dòng mới tạo trên Notion → thêm vào giai đoạn trùng tên.
- **Đồng bộ 2 chiều** = lấy về trước, rồi đẩy lên.

> Notion làm tròn giờ sửa theo phút: nếu đẩy lên rồi sửa trên Notion trong cùng 1 phút, lần lấy về có thể bỏ qua. Đợi qua phút rồi sửa.

---

## B. AI: chọn Gemini, ChatGPT hoặc Claude

Bấm nút **✨ AI** → mục **⚙ Kết nối AI** → chọn nhà cung cấp → dán **API key** → **Lưu & kiểm tra**.

Không có cách "đăng nhập tài khoản ChatGPT / Claude / Gemini" để dùng cho web khác: các hãng chỉ cho ứng dụng ngoài dùng qua **API key**. Gói trả tiền ChatGPT Plus / Claude Pro / Gemini Advanced **không** dùng chung cho API.

| Chọn | Lấy key ở đâu | Chi phí |
|---|---|---|
| **Google Gemini** (khuyên dùng để thử) | https://aistudio.google.com/apikey → đăng nhập Gmail → **Create API key** (dạng `AIza...`) | **Có gói miễn phí** (giới hạn số lượt/phút) |
| ChatGPT (OpenAI) | https://platform.openai.com/api-keys → **Create new secret key** (`sk-...`) | Nạp tiền ở Billing, trả theo lượt |
| Claude (Anthropic) | https://console.anthropic.com/settings/keys → **Create Key** (`sk-ant-...`) | Nạp tiền ở Billing, trả theo lượt |

Ô **Model** để trống = app tự chọn bản mới nhất (Gemini Flash / GPT mới nhất / Claude Sonnet).

Cách dùng AI: thả ảnh báo giá / bảng khối lượng / bản vẽ (Ctrl+V được), Excel/CSV hoặc PDF, hoặc chỉ gõ mô tả → chọn ngày bắt đầu & thời hạn → **Đề xuất tiến độ** → sửa trong bảng duyệt → **Thêm vào lịch** (tạo luôn liên kết FS/SS).

---

## (Tuỳ chọn) Khoá dùng chung cho mọi người qua Render
Render → service → **Environment**: `NOTION_TOKEN` + `NOTION_DATABASE_ID`, hoặc 1 trong `GEMINI_API_KEY` / `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` (+ `AI_ALLOWED_EMAILS`, `AI_DAILY_LIMIT`, `AI_MODEL`). Ai đã tự dán khoá trong app thì ưu tiên khoá riêng.
