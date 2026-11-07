# HƯỚNG DẪN BẬT: ĐỒNG BỘ NOTION & AI LẬP TIẾN ĐỘ

Hai tính năng này dùng khoá bí mật, nên khoá được giữ trên **server (Render)**, trình duyệt không bao giờ thấy khoá. Chưa thêm khoá thì 2 nút vẫn hiện nhưng báo "Server chưa bật…", mọi thứ khác chạy bình thường.

Cần **đăng nhập Gmail** mới dùng được (chế độ khách không dùng được).

---

## A. Đồng bộ lịch với Notion (≈ 5 phút)

### 1. Tạo "integration" trên Notion
1. Mở https://www.notion.so/profile/integrations → **New integration**.
2. Name: `GD HOME Lich`, chọn workspace của anh, Type: **Internal** → **Save**.
3. Tab **Configuration** → copy **Internal Integration Secret** (dạng `ntn_...`).

### 2. Tạo database lịch trên Notion
1. Tạo trang mới → gõ `/database` → chọn **Database – Full page** (dạng bảng). Đặt tên vd *Tiến độ GD HOME*.
2. Chỉ cần có cột **Name** (tên) và **1 cột kiểu Date** (đặt tên `Ngày`). Các cột *Dự án, Giai đoạn, Tiến độ, GDHomeID* server **tự tạo** ở lần đồng bộ đầu.
3. Bấm **•••** góc phải trên database → **Connections** → tìm `GD HOME Lich` → **Confirm** (bắt buộc, không thì báo lỗi "không thấy database").
4. Bấm **Share → Copy link** để lấy link database.

### 3. Dán vào Render → Environment
| Key | Value |
|---|---|
| `NOTION_TOKEN` | chuỗi `ntn_...` |
| `NOTION_DATABASE_ID` | dán nguyên link database (server tự lấy mã 32 ký tự) |

### Cách dùng
**File ▾ → Đồng bộ Notion…**
- **Chỉ đẩy lên Notion**: mỗi công việc thành 1 dòng (Tên, Ngày bắt đầu → kết thúc, Dự án, Giai đoạn, Tiến độ). Đẩy lại lần sau sẽ **cập nhật đúng dòng cũ**, không tạo trùng (nhờ cột `GDHomeID`, đừng xoá cột này).
- **Chỉ lấy từ Notion về**: dòng nào sửa trên Notion **sau** lần đồng bộ trước → cập nhật tên / ngày / tiến độ vào app (việc nối phía sau tự dời nếu bật "Tự dịch việc nối phía sau"). Dòng mới tạo trên Notion → thêm vào giai đoạn trùng tên cột *Giai đoạn*, không có thì vào giai đoạn đang chọn.
- **Đồng bộ 2 chiều** = lấy về trước, rồi đẩy lên.
- Xem lịch trên Notion: thêm view **Calendar** hoặc **Timeline** cho database, chọn cột `Ngày`.

> Lưu ý: Notion làm tròn giờ sửa theo phút, nên nếu vừa đẩy lên rồi sửa trên Notion **trong cùng 1 phút** thì lần lấy về có thể bỏ qua thay đổi đó. Đợi qua phút rồi sửa là được.

---

## B. AI lập tiến độ từ ảnh / Excel (≈ 5 phút)

### 1. Lấy API key
1. Vào https://console.anthropic.com → đăng nhập → **Settings → Billing**: nạp tiền (trả theo lượt dùng, mỗi lần lập tiến độ thường chỉ vài trăm đến vài nghìn đồng tuỳ số ảnh).
2. **API Keys → Create Key** → đặt tên `gdhome` → copy chuỗi `sk-ant-...` (chỉ hiện 1 lần).

### 2. Dán vào Render → Environment
| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | chuỗi `sk-ant-...` |
| `AI_DAILY_LIMIT` *(tuỳ chọn)* | số lượt AI tối đa / người / ngày, mặc định `40` |
| `AI_ALLOWED_EMAILS` *(tuỳ chọn)* | chỉ các Gmail này được dùng AI, cách nhau dấu phẩy. **Nên đặt** nếu không giới hạn `ALLOWED_EMAILS`, để người lạ không dùng hết tiền |
| `AI_MODEL` *(tuỳ chọn)* | để trống = server tự chọn model Sonnet mới nhất |

### Cách dùng
Nút **✨ AI** trên thanh trên cùng (hoặc File ▾ → AI lập tiến độ…):
1. Kéo thả / chọn **ảnh** (báo giá, bảng khối lượng, bản vẽ, ảnh chụp tiến độ cũ – dán bằng Ctrl+V cũng được), **Excel/CSV**, hoặc **PDF**. Có thể chỉ gõ mô tả.
2. Chọn **ngày bắt đầu** và **thời hạn**: để AI tự đề xuất / trong N ngày làm việc / xong trước ngày …
3. Chọn nơi thêm: **giai đoạn mới** trong dự án (tên do AI đặt, sửa được) hoặc giai đoạn có sẵn.
4. Bấm **Đề xuất tiến độ** → xem bảng: bỏ tick việc không cần, sửa tên, sửa số ngày (ngày tự tính lại theo lịch nghỉ: Chủ nhật, chiều T7, lễ…). Nếu vượt hạn → **Co giãn cho vừa hạn**.
5. **Thêm vào lịch** → các việc được tạo kèm **liên kết FS/SS** như MS Project.

---

## Chạy trên máy nội bộ (không bắt buộc)
Thêm vào `Mo-Web-Lich-Tien-Do.bat` trước dòng chạy `node` (chỉ máy anh, không đẩy lên GitHub):
```bat
set "NOTION_TOKEN=ntn_..."
set "NOTION_DATABASE_ID=https://www.notion.so/..."
set "ANTHROPIC_API_KEY=sk-ant-..."
```

## Kiểm tra
Mở `https://TEN-APP.onrender.com/api/health` → thấy `"features":{"notion":true,"ai":true}` là đã bật.
