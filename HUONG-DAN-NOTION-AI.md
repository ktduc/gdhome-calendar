# HƯỚNG DẪN: ĐỒNG BỘ NOTION & AI LẬP TIẾN ĐỘ

Không cần vào Render nữa: **mỗi người tự dán khoá ngay trong app** (cần đăng nhập Gmail; chế độ khách không dùng được).
Khoá được **mã hoá** rồi lưu trên server (Gist bí mật), trình duyệt không đọc lại được, người khác không thấy.

---

## A. Notion: lấy lịch (tên + 1 cột ngày) vào dự án riêng "NOTION"

Mở app → **File ▾ → Đồng bộ Notion…** → mục **⚙ Kết nối Notion**:

1. Mở https://app.notion.com/developers (Developer tools) → tab **Personal access tokens** → **New token** → tên `GD HOME`, tick **Notion API**, hạn **1 year** → **Create token** → copy mã (chỉ hiện 1 lần). Mã này dùng quyền của chính anh nên **không cần** bước thêm Connections.
2. Mở bảng lịch có sẵn trên Notion (vd *DEADLINE*) → **Share → Copy link**. Dán link của trang chứa bảng cũng được, app tự tìm bảng đầu tiên trong trang.
3. Dán mã + link vào app → **Lưu & kiểm tra**.
4. Ô **Lấy ngày từ cột**: chọn đúng cột ngày cần lấy (vd *Deadline*) nếu bảng có nhiều cột ngày.
5. *(Nếu không có tab Personal access tokens)*: tab **Connections** → **Internal connections → Create a new connection** → tab **Configuration** copy **API token**; rồi vào bảng → **•••** → **Connections** → **+ Add connection** → chọn kết nối đó.

Cách hoạt động:
- **Chỉ đọc Tên + 1 cột ngày**. App **không thêm, không sửa cột nào khác** trên Notion.
- Lịch được đưa vào **dự án riêng "NOTION"** (giai đoạn = tên bảng Notion), **không trộn** vào dự án / giai đoạn đang chọn.
- **Lấy lịch Notion về**: thêm dòng mới, cập nhật dòng đã sửa, bỏ dòng đã xoá hoặc bỏ trống ngày.
- **Đồng bộ 2 chiều**: việc trong dự án NOTION mà anh kéo / sửa ngày / sửa tên trong app → ghi ngược lên Notion (chỉ Tên + cột ngày đã chọn), rồi lấy bản mới về.
- Việc từ Notion tính theo **ngày thực tế** (giữ đúng ngày như Notion, không tự né Chủ nhật).


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

> Personal access token hết hạn sau thời gian đã chọn (tối đa 1 năm): khi app báo "Mã Notion không đúng, đã hết hạn" thì tạo mã mới và dán lại.
