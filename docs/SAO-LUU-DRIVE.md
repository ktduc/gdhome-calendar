# Sao lưu và khôi phục GD HOME qua Google Drive

Mở **⚙ Kết nối → Sao lưu Google Drive → Liên kết thư mục Drive** rồi cấp quyền bằng Gmail đang đăng nhập GD HOME. Ứng dụng tạo hoặc mở lại thư mục riêng **GD HOME - Sao lưu** trong Drive của tài khoản đó. Bản đầu tiên chạy sau khi liên kết. Các bản tiếp theo chạy mỗi ngày khi máy chủ hoạt động từ 02:00 giờ Việt Nam. Có thể bấm **Sao lưu ngay** và xem trạng thái lần gần nhất. **Hủy liên kết** dừng lịch và giữ các bản sao đã tạo.

Mỗi tệp `.ndjson.gz` chứa lịch, dự án, bảng Chốt mã, bản phát hành, thư viện vật liệu và tệp đính kèm còn truy cập được. Bản sao gắn với Gmail của tài khoản. Các khóa tích hợp AI và Notion được kết nối lại riêng. Trạng thái báo số tệp đã mất ở kho nguồn nếu bản sao bị thiếu.

## Bật trên máy chủ

1. Tạo dự án Google Cloud riêng cho sao lưu, bật **Google Drive API** và tạo OAuth client loại **Web application**. Dùng dự án riêng để thao tác thu hồi quyền Drive không ảnh hưởng đăng nhập GD HOME. Đặt ứng dụng OAuth ở chế độ sử dụng lâu dài phù hợp với tài khoản quản trị.
2. Đăng ký URL chuyển hướng dạng `https://<ten-web>/api/drive-backup/callback` trong OAuth client.
3. Đặt `GOOGLE_DRIVE_CLIENT_ID`, `GOOGLE_DRIVE_CLIENT_SECRET` và `GOOGLE_DRIVE_REDIRECT_URI` trên máy chủ. Giữ `SESSION_SECRET` ổn định để máy chủ đọc được liên kết đã mã hóa.
4. Triển khai lại rồi liên kết trong menu. Kiểm tra lần đầu có tệp trong thư mục Drive và trạng thái hiển thị thời gian sao lưu.

## Khôi phục khi có sự cố

Tải tệp sao lưu từ Drive. Trên máy quản trị có mã nguồn GD HOME, chạy kiểm tra với chính Gmail đã tạo bản sao.

```sh
node restore-drive-backup.cjs gdhome.ndjson.gz ten@example.com
```

Lệnh kiểm tra xác minh tài khoản, dữ liệu và mã băm của từng tệp. Khi kiểm tra đạt, dừng tiến trình web để tránh ghi đồng thời, cấu hình kho dữ liệu và Object Storage đích trên máy quản trị rồi chạy lệnh khôi phục.

```sh
node restore-drive-backup.cjs gdhome.ndjson.gz ten@example.com --apply
```

Lệnh ghi ảnh và tài liệu trước, sau đó khôi phục dữ liệu tài khoản. Bản đã ghi nhận thiếu tệp yêu cầu thêm `--allow-missing` nếu chấp nhận khôi phục phần còn lại. Giữ `SESSION_SECRET` cũ để các liên kết duyệt còn hạn tiếp tục hoạt động. Khởi động lại web và kiểm tra lịch, dự án, bảng Chốt mã và các tệp đính kèm đã phục hồi.
