# Bật đồng bộ Microsoft To Do cho Việc cần làm (Timeline)

Việc cần làm trên Timeline vẫn dùng được khi chưa cấu hình phần này. Chỉ khi muốn đồng bộ hai chiều với Microsoft To Do mới cần làm các bước sau. Mỗi bước chỉ làm một lần.

## 1. Tạo ứng dụng trên Microsoft Entra (Azure)
1. Vào https://entra.microsoft.com, rồi chọn **App registrations → New registration**.
2. Điền:
   - Name: `GD HOME Tools`
   - Supported account types: **Accounts in any organizational directory and personal Microsoft accounts**. Chọn mục này để dùng được cả tài khoản Outlook/Hotmail cá nhân.
   - Redirect URI: chọn **Web**, nhập `https://gdhome-calendar.onrender.com/api/todos/ms/callback`
3. Bấm **Register**, rồi chép **Application (client) ID**.
4. Vào **Certificates & secrets → New client secret** và chép cột **Value**. Giá trị này chỉ hiện một lần.
5. Vào **API permissions → Add a permission → Microsoft Graph → Delegated** và thêm:
   - `Tasks.ReadWrite`
   - `User.Read`
   - `offline_access`

## 2. Khai báo trên Render
Vào Render, chọn service `gdhome-calendar`, mở **Environment** và thêm:

| Biến | Giá trị |
|---|---|
| `MS_TODO_CLIENT_ID` | Application (client) ID |
| `MS_TODO_CLIENT_SECRET` | Client secret (Value) |
| `MS_TODO_REDIRECT_URI` | `https://gdhome-calendar.onrender.com/api/todos/ms/callback` |

Lưu lại, Render sẽ tự khởi động lại.

## 3. Liên kết
Mở Timeline, bấm **☑ Việc cần làm**, rồi bấm **Liên kết Microsoft To Do** và đăng nhập Microsoft.
- Mặc định web dùng danh sách **Tasks**. Muốn dùng danh sách khác thì bấm **Đổi danh sách**.
- Web tự đồng bộ khi mở Timeline, sau mỗi thao tác và mỗi phút một lần. Bấm ⟳ để đồng bộ ngay.
- Việc tick xong ở bên nào thì bên kia cũng tick xong. Đổi tên, đặt hạn hay xoá cũng được đồng bộ hai chiều.
- Quyền Microsoft được mã hoá và lưu trên server, không nằm trong repo.
