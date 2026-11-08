# Hướng dẫn cấu hình kho lưu trữ ảnh & hồ sơ (Backblaze B2 / Cloudflare R2)

Hệ thống hỗ trợ chuẩn tương thích **Amazon S3 (AWS Signature Version 4)** để lưu trữ ảnh vật tư (Chốt mã) và hồ sơ bản vẽ / hợp đồng / 3D (Quản lý dự án).

Anh Đức và đội ngũ nên dùng **Backblaze B2** vì:
- **Hoàn toàn miễn phí 10 GB đầu tiên**, không bao giờ bị tính phí nếu dùng trong mức này.
- **Không yêu cầu thẻ tín dụng** (Credit Card) khi đăng ký tài khoản.
- Tốc độ và độ ổn định cao, tương thích 100% chuẩn S3 API.

---

## I. Cấu hình Backblaze B2 (Khuyên dùng - Không cần thẻ tín dụng)

### Bước 1: Đăng ký tài khoản Backblaze B2
1. Truy cập [https://www.backblaze.com/b2/cloud-storage.html](https://www.backblaze.com/b2/cloud-storage.html).
2. Đăng ký tài khoản miễn phí (chỉ cần email & mật khẩu, không hỏi thẻ ngân hàng).

### Bước 2: Tạo Bucket riêng tư (`gdhome-files`)
1. Trong menu bên trái của B2 Cloud Storage, chọn **Buckets** -> bấm **Create a Bucket**.
2. **Bucket Unique Name**: đặt tên duy nhất, ví dụ `gdhome-files` (hoặc `gdhome-files-hanoi` nếu tên đã bị trùng).
3. **Files in Bucket are**: chọn **Private** (bảo mật, không cho phép truy cập công khai không qua ký phiên).
4. Các mục Default Encryption, Object Lock để mặc định -> Bấm **Create a Bucket**.
5. Ghi nhớ tên Bucket và **Endpoint** S3 hiển thị trên bucket (ví dụ: `s3.us-west-004.backblazeb2.com`).

### Bước 3: Tạo Application Key (Khoá truy cập)
1. Trong menu bên trái, chọn **Application Keys** -> bấm **Add a New Application Key**.
2. **Name of Key**: ví dụ `gdhome-render-app`.
3. **Allow access to Bucket(s)**: chọn đúng bucket vừa tạo (`gdhome-files`).
4. **Type of Access**: chọn **Read and Write**.
5. Bấm **Create New Key**.
6. **QUAN TRỌNG**: Sao chép ngay 2 thông tin sau (chỉ hiển thị 1 lần duy nhất):
   - `keyID` (chính là S3 Access Key ID)
   - `applicationKey` (chính là S3 Secret Access Key)

### Bước 4: Cài đặt 5 biến môi trường trên Render.com
1. Mở trang quản lý dịch vụ GD HOME trên **Render.com** -> chọn mục **Environment**.
2. Thêm hoặc cập nhật 5 biến môi trường sau:
   - `S3_ENDPOINT`: `https://s3.us-west-004.backblazeb2.com` (thay bằng endpoint hiển thị ở Bước 2)
   - `S3_REGION`: `us-west-004` (vùng tương ứng trên endpoint, hoặc có thể bỏ trống vì server tự động nhận diện từ endpoint)
   - `S3_ACCESS_KEY_ID`: dán mã `keyID` ở Bước 3
   - `S3_SECRET_ACCESS_KEY`: dán mã `applicationKey` ở Bước 3
   - `S3_BUCKET`: `gdhome-files` (tên bucket đã tạo ở Bước 2)
3. Bấm **Save Changes**. Render sẽ tự động khởi động lại dịch vụ trong ~30 giây.

---

## II. Kiểm tra sau khi cài đặt

1. Kiểm tra trạng thái hệ thống:
   - Mở đường dẫn `/api/health` trên trình duyệt: trường `"objectStorage"` sẽ trả về `"b2"`.
2. Kiểm tra giao diện Quản lý dự án (`/du-an`):
   - Huy hiệu màu vàng cảnh báo *"⚠️ Lưu tạm – sẽ mất khi server khởi động lại"* đã tự động **biến mất**.
   - Thử tải lên một bản vẽ PDF hoặc ảnh phối cảnh 3D.
3. Kiểm tra Chốt mã (`/chot-ma`):
   - Dán một ảnh mẫu vật tư -> ảnh hiển thị sắc nét và lưu an toàn vĩnh viễn trên B2.

---

## III. Hỗ trợ tương thích ngược (Cloudflare R2)

Nếu công ty vẫn muốn sử dụng **Cloudflare R2**, hệ thống tiếp tục hỗ trợ 100% thông qua 4 biến môi trường cũ:
- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

*(Khi cả biến S3_* và R2_* đều có mặt, server sẽ ưu tiên dùng S3_* của Backblaze B2).*

---

## IV. Môi trường phát triển cục bộ (Localhost)

Khi chạy thử nghiệm trên máy tính cá nhân (`node server.js`), bạn **không bắt buộc** phải điền các biến trên:
- Server tự động chuyển sang chế độ `temp`: lưu tệp trực tiếp trong thư mục `DATA_DIR/assets` và `DATA_DIR/project-files`.
- Giúp lập trình viên có thể làm việc offline hoặc kiểm thử nhanh mà không phụ thuộc vào kết nối mạng bên ngoài.
