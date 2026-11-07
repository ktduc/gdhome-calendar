# HƯỚNG DẪN CÀI ĐẶT: LƯU DỮ LIỆU BỀN VỮNG & ĐĂNG NHẬP GMAIL

Áp dụng cho bản web trên Render.com. Máy nội bộ (localhost / mạng LAN) KHÔNG cần làm gì: vẫn chạy như cũ, dữ liệu lưu ở `data.json` trên máy và có sao lưu hằng ngày trong thư mục `backups`.

---

## Bước 1 – Tạo GitHub token để lưu dữ liệu vào Gist bí mật (≈ 3 phút)

Mục đích: mỗi lần cập nhật code lên Render, dữ liệu mọi người đang dùng **không bị mất**. Gist còn tự lưu **lịch sử từng phiên bản** (khôi phục được khi cần).

1. Đăng nhập GitHub → bấm ảnh đại diện (góc phải) → **Settings**.
2. Kéo xuống cuối menu trái → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Điền:
   - **Token name:** `gdhome-gist`
   - **Expiration:** chọn 1 năm (hoặc *No expiration*)
   - **Repository access:** để mặc định (*Public repositories*)
   - **Permissions → Account permissions → Gists:** chọn **Read and write**
4. Bấm **Generate token** → **copy** chuỗi `github_pat_...` (chỉ hiện 1 lần).

> Cách khác: *Tokens (classic)* → Generate new token (classic) → chỉ tick ô **gist**.

## Bước 2 – Tạo Google Client ID để đăng nhập bằng Gmail (≈ 10 phút)

1. Vào https://console.cloud.google.com → góc trên chọn **Select a project → New project** → tên `GD HOME Lich` → **Create**.
2. Menu ☰ → **APIs & Services** → **OAuth consent screen** (hoặc **Google Auth Platform → Branding**) → **Get started**:
   - App name: `Lịch Tiến Độ GD HOME`, User support email: email của anh
   - Audience: **External**
   - Contact email: email của anh → **Create**
3. Mục **Audience** → bấm **Publish app** (để mọi Gmail đăng nhập được; ứng dụng chỉ xin tên + email nên không cần Google duyệt).
   *Nếu không Publish:* thêm từng email vào **Test users** (tối đa 100).
4. Mục **Clients** (hoặc **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**, Name: `GD HOME Web`
   - **Authorized JavaScript origins** → Add URI:
     - `https://TEN-APP-CUA-ANH.onrender.com` (địa chỉ web trên Render, không có dấu `/` ở cuối)
     - `http://localhost:3000` (để thử trên máy)
   - **Authorized redirect URIs:** để trống
   - Bấm **Create** → copy **Client ID** dạng `xxxx.apps.googleusercontent.com` (KHÔNG cần Client secret).

## Bước 3 – Dán vào Render

Render Dashboard → chọn web service → **Environment** → **Add Environment Variable**:

| Key | Value |
|---|---|
| `GIST_TOKEN` | chuỗi `github_pat_...` ở Bước 1 |
| `GOOGLE_CLIENT_ID` | chuỗi `...apps.googleusercontent.com` ở Bước 2 |
| `ALLOWED_EMAILS` *(tuỳ chọn)* | chỉ cho các email này đăng nhập, cách nhau dấu phẩy. Bỏ trống = ai có Gmail cũng dùng được, **dữ liệu ai người nấy giữ** |

Bấm **Save, rebuild, and deploy**.

**Kiểm tra:** mở `https://TEN-APP-CUA-ANH.onrender.com/api/health` → thấy `"storage":"gist"` và `"auth":"google"` là xong.

---

## Chuyện gì xảy ra lần đầu?

- Server tự tạo 1 Gist **bí mật** tên *GD HOME - du lieu lich tien do* trên GitHub của anh, lấy dữ liệu `data.json` lần cuối đã đẩy lên GitHub làm **dữ liệu chung ban đầu**.
- Ai đăng nhập Gmail lần đầu sẽ được hỏi: *"Chép dữ liệu tiến độ dùng chung trước đây vào tài khoản của mình?"* → bấm OK để mang dữ liệu cũ sang.
- Nếu trình duyệt của ai đó đang giữ dữ liệu **mới hơn** server (vd: server vừa bị reset), app sẽ hỏi *"Giữ bản trên máy này và gửi lại lên server?"* → bấm **OK** để không mất dữ liệu.

## Quy trình cập nhật code từ nay

1. Sửa code trên máy chính, thử ở `http://localhost:3000`.
2. Nháy đúp `Cap-Nhat-Web-Len-Mang.bat` → code lên GitHub → Render tự cập nhật.
3. **`data.json` không còn được đẩy lên GitHub** → dữ liệu trên web (trong Gist) không bao giờ bị ghi đè bởi máy build.

## Khôi phục dữ liệu cũ (khi lỡ tay)

Mở https://gist.github.com → Gist *GD HOME - du lieu lich tien do* → tab **Revisions** → xem / copy lại phiên bản trước. Mỗi tài khoản Gmail là 1 file `user-<email>.json`; dữ liệu chung là `data.json`.

## Bật đăng nhập Gmail trên máy nội bộ (không bắt buộc)

Chỉ dùng được với `http://localhost:3000` (Google không cho đăng nhập qua địa chỉ LAN dạng `http://192.168.x.x`). Trong `Mo-Web-Lich-Tien-Do.bat`, thêm trước dòng chạy `node`:

```bat
set "GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com"
set "GIST_TOKEN=github_pat_..."
```

Không thêm thì máy nội bộ chạy như cũ (không cần đăng nhập, dữ liệu dùng chung trong `data.json`).
