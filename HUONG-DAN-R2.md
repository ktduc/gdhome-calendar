# Cấu hình Cloudflare R2 cho Chốt mã

1. Trong Cloudflare Dashboard, mở **R2 Object Storage**, bật R2 và tạo bucket Standard dành riêng cho GD HOME. Để tắt quyền truy cập công khai và r2.dev.
2. Mở **Manage R2 API Tokens**. Tạo token **Object Read & Write**, chỉ cấp quyền trên bucket vừa tạo.
3. Sao chép Account ID, Access Key ID và Secret Access Key. Trong Render, mở dịch vụ GD HOME và nhập `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` trong Environment. Lưu khoá trong kho mật khẩu của công ty.
4. Sau khi deploy, mở Chốt mã, kiểm tra cảnh báo ảnh đã hết. Dán một ảnh, tải lại và thử xem ảnh ở phiên khách được cấp link. Thử truy cập ảnh qua phiên khác không có quyền.
5. Để thử trên localhost, có thể bỏ bốn biến. Chế độ tạm dùng `DATA_DIR/assets` (mặc định `assets/` trong repo), tối đa 150 KB và 1000 px mỗi ảnh. Sao lưu nếu cần giữ dữ liệu thử. Khi chuyển sang R2, chuyển các object giữ nguyên key trước khi tắt quyền đọc ảnh từ ổ cũ.

[Tài liệu Cloudflare R2](https://developers.cloudflare.com/r2/)
