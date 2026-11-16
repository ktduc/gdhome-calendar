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
- Sao ☆/★ ở bên phải tương ứng với "Quan trọng" trong Microsoft To Do. Việc có sao luôn nằm trên cùng.
- Thứ tự kéo thả chỉ lưu trên web. Microsoft không cho ứng dụng ngoài đọc hay ghi thứ tự.

## 4. Kéo việc lên Timeline
- **Thả thường:** việc thành hạng mục trong dự án riêng **TODO → VIỆC CẦN LÀM**. Dự án này luôn nằm cuối danh sách, dưới dự án NOTION, và chỉnh được như mọi dự án khác (kéo thanh, sửa ngày, nối việc…).
- **Gõ thêm hạng mục ngay trong dự án TODO:** hạng mục đó tự thành việc trong danh sách.
- **Xoá việc trong danh sách:** thanh của việc đó trong dự án TODO cũng bị xoá.
- **Giữ Shift khi thả lên dòng dự án khác, hoặc bấm 📁 trên việc rồi chọn dự án:** việc vào dự án đó. Nếu việc đã có thanh thì thanh được chuyển sang dự án mới.
- **Việc đã thành hạng mục:** hạn của việc đi theo hạng mục.
  - Hạng mục đổi ngày hoặc đổi tên thì việc đổi theo.
  - Hạng mục lên 100% thì việc được tick xong.
  - Hạng mục bị xoá thì việc trở về danh sách, bỏ luôn ngày (bên Microsoft To Do cũng bỏ hạn).
- Nội dung việc được nhiều dòng: Enter để lưu, Shift+Enter để xuống dòng.
- Chữ trong cửa sổ đậm hay nhạt theo tuỳ chọn **Độ đậm chữ** của Timeline.

## 5. Người khác muốn dùng
App "GD HOME Tools" trên Entra dùng chung cho mọi người, không cần tạo thêm.
- Mỗi người đăng nhập web bằng Google của mình rồi bấm **Liên kết Microsoft To Do** trong Timeline.
- Danh sách việc và liên kết Microsoft lưu riêng theo từng tài khoản Google, không lẫn với nhau.
- **Tài khoản Microsoft cá nhân** (Outlook, Hotmail, Gmail đăng ký Microsoft): liên kết được ngay.
- **Tài khoản công ty / trường học:** quản trị viên của tổ chức đó có thể phải đồng ý cho app. Nếu Microsoft báo "cần quản trị viên phê duyệt", đó là cài đặt của tổ chức, không phải lỗi web.
- **Nhiều người cùng xem một danh sách:** tạo danh sách trong Microsoft To Do, bấm **Chia sẻ** cho người kia. Sau đó mỗi người trên web chọn **Đổi danh sách** sang danh sách chung đó.
