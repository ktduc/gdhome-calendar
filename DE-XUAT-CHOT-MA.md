# Đề xuất Giai đoạn 0 — GD HOME Tools và Bảng chốt mã vật liệu

**Trình anh Đức duyệt · 07/11/2026**
[Wireframe 5 màn hình](docs/wireframes/index.html) · Mở trực tiếp trong trình duyệt, dùng thanh điều hướng để xem từng màn hình.

> Đây là đề xuất Giai đoạn 0. Quyết định triển khai theo bản review và được ghi trong mục 3l của [CLAUDE_HANDOVER.md](CLAUDE_HANDOVER.md).

## 1. Hiện trạng và phương án kiến trúc

Một dịch vụ Render, một `server.js`, giao diện HTML/CSS/JS thuần. Tái sử dụng logo, màu đỏ GD HOME, phiên Gmail và các chế độ truy cập hiện hành. Hai hướng dẫn cài đặt và Notion/AI là căn cứ để giữ nguyên cấu hình tích hợp khi đổi tuyến.

| Tuyến dự kiến | Vị trí và nhiệm vụ |
|---|---|
| `/` | `tools/index.html`, trang chủ và danh sách dự án của tài khoản đang đăng nhập |
| `/tien-do` | Route trả `index.html` hiện có, dùng URL tài nguyên tuyệt đối. Nút về trang chủ. |
| `/chot-ma`, `/chot-ma/:sheetId` | `chot-ma/` chứa giao diện danh sách, bảng nhập và CSS riêng |
| `/duyet/:token` | Giao diện khách trên điện thoại, chỉ truy cập bản được phát hành |
| `/api/projects`, `/api/materials/*`, `/api/review/*` | Danh sách dự án rút gọn, thao tác nội bộ theo chủ sở hữu, và API riêng theo quyền link khách |
| `shared/`, `materials.js` | Giao diện chung và module nghiệp vụ chốt mã phía server, phân tuyến từ server hiện tại |

- Dự án chính là `projectOwners`, giai đoạn là `calendars` có `ownerId`, công việc thuộc giai đoạn. Khóa liên kết dự án là cặp định danh tài khoản hiện hành và `projectOwners[].id`. Không ghép theo tên. Trang chủ đọc danh sách rút gọn từ kho lịch theo phiên, mỗi dự án có hai nút mở đúng ngữ cảnh. Trường hợp dữ liệu chỉ có trên trình duyệt thì dùng luồng phục hồi/nhập hiện hành trước khi tạo liên kết. Guest tiếp tục dùng Tiến độ cục bộ.
- Giữ API `/api/schedule`, tên khóa localStorage theo email/guest, dữ liệu Gist/FileStore, xác thực và tích hợp AI/Notion. Route `/` cũ mở trang chủ có nút **Mở Tiến độ** nổi bật ngay đầu trang. Bookmark mới dùng `/tien-do`. Link mở theo dự án dùng ID và kiểm tra quyền. Dữ liệu dự án bị xóa hoặc ID đổi do nhập lại sẽ hiện **Cần liên kết lại**, giữ nguyên bảng và hồ sơ đã ký.
- GistStore hiện gom ghi và flush sau. Kiểm tra `_version` của lịch diễn ra trước khi ghi, chưa phải giao dịch trên kho. Chọn **Postgres cho Chốt mã** (đề xuất Supabase, kết nối từ server), vì sửa bảng, ký, ghi lịch sử và khóa phiên bản cần giao dịch nguyên tử. Supabase Auth không cần thiết. Lưu bằng cập nhật có điều kiện theo version, trả 409 và hiển thị bản máy/bản server để xử lý; báo **Đã lưu** sau commit. Dùng khóa idempotency cho ký/gửi yêu cầu để xử lý nhấn hai lần và retry.
- Tiến độ tiếp tục ở kho hiện có, không cần chuyển dữ liệu. Nếu sau này duyệt hợp nhất, sao lưu có phiên bản theo tài khoản, nhập thử theo ID và checksum, kiểm đếm dự án/giai đoạn/công việc và xác nhận `_version`; chỉ đổi nơi đọc/ghi sau đối soát, giữ nguồn và kế hoạch đồng bộ ngược trước rollback. GĐ1 kiểm tra trạng thái auto-deploy thực tế: tài liệu giao việc và bàn giao ghi khác nhau.
- Khi triển khai, chỉ cho phép phục vụ tài nguyên được liệt kê theo route; giữ tài liệu, bản sao lưu và khóa ngoài vùng public. Đưa các file chạy production vào danh sách deploy tường minh. Kiểm tra riêng `data.json` vì file đang được Git theo dõi và có thay đổi sẵn trong workspace.

## 2. Tám ý áp dụng từ công cụ tham khảo

| Nguồn | Áp dụng ở GD HOME |
|---|---|
| [Programa — Product Library trong Schedule](https://programa.design/blog/new-schedule-enhancements) | Gõ hãng, mã, màu hoặc bề mặt ngay trong ô PA. Enter điền bản sao thông số và ảnh để chỉnh độc lập theo dự án. |
| [Programa — chia sẻ và PDF](https://programa.design/changelog) | Tạo bản khách và bản mua hàng từ cùng dữ liệu với danh sách trường riêng. Ẩn giá mua/NCC ở API khách theo mặc định. |
| [Programa — FF&E schedules](https://programa.design/features/schedules-for-interior-designers) | Mỗi dự án có danh sách bảng với tiến độ duyệt và phiên bản phát hành để biết khách đang xem bản nào. |
| [Houzz Pro — Selections Tracker](https://pro.houzz.com/pro-help/r/how-to-maximize-the-selections-tracker-as-a-gc) | Đổi cách nhóm/lọc theo phòng, danh mục, NCC, trạng thái chốt. Trạng thái mua hàng tách khỏi quyết định duyệt. |
| [Houzz Pro — cài đặt màn hình khách](https://pro.houzz.com/pro-help/r/how-to-customize-what-your-client-can-see-on-their-room-plan) | Xem trước đúng dữ liệu khách nhận. Chọn một PA mỗi dòng, rồi xác nhận và ký toàn bộ bản đã chọn. |
| [Mydoma — Product Sourcing & Curation](https://mydomastudio.com/wp-content/uploads/2022/06/Mydoma-Studio-the-Premier-Platform-for-Interior-Designers-Releases-Mydoma-NEXT-to-Address-Changes-in-the-Interior-Design-Industry.pdf) | Đưa mã đã chốt về thư viện theo hãng + mã + biến thể; dùng lại ảnh và kiểm tra trùng khi lưu. |
| [SketchUp LayOut — nhập bảng tính](https://help.sketchup.com/en/layout/adding-tables-document) | Chọn tab, nhận diện header gộp PA1/PA2, xem trước ánh xạ, báo dòng lỗi và xác nhận rồi mới nhập. |
| [Airtable — mẫu có bản ghi con](https://support.airtable.com/articles/9772992207-using-record-templates-in-airtable) | Khởi tạo đủ 17 nhóm và dòng con theo đúng mục 0 của giao việc, kể cả nhóm trống. Tick bỏ nhóm, nhân bản dự án cũ với ID mới, bỏ dấu chốt/lịch sử/link/hạn cũ. |

## 3. Lưu ảnh

| Phương án | Chi phí tham khảo | Riêng tư và vận hành | Tốc độ tại Việt Nam |
|---|---|---|---|
| **Cloudflare R2 Standard** | 10 GB-tháng, 1 triệu thao tác A và 10 triệu B miễn phí mỗi tháng; egress miễn phí. Vượt lưu trữ khoảng 0,015 USD/GB-tháng. [Giá](https://developers.cloudflare.com/r2/pricing/) | Bucket private, URL ký ngắn hạn. Dùng kho độc lập với deploy. [URL ký](https://developers.cloudflare.com/r2/api/s3/presigned-urls/) | Đo trực tiếp thumbnail và ảnh lớn từ mạng VN; URL ký S3 không mặc định là CDN cache. |
| Supabase Storage | Free 1 GB lưu file, có hạn mức egress, project Free có thể tạm dừng khi không hoạt động. [Giá](https://supabase.com/pricing) | Private bucket và URL ký. Ít hệ thống hơn nếu dùng cả Postgres. [Quyền bucket](https://supabase.com/docs/guides/storage/buckets/fundamentals) | Singapore là ứng viên thử nghiệm nếu có trong gói/vùng lúc tạo; cần đo. |
| Cloudinary | Free 25 credits/tháng dùng chung cho lưu, tải và xử lý. [Giá](https://cloudinary.com/pricing) | CDN và biến đổi ảnh sẵn; cấu hình authenticated delivery cho ảnh gốc và biến thể. [Quyền ảnh](https://cloudinary.com/documentation/control_access_to_media) | Có CDN; đo trên tuyến authenticated của ứng dụng. |
| Google Drive API | Dùng quota API và dung lượng tài khoản đang có. [Quota](https://developers.google.com/workspace/drive/api/guides/limits) | Giữ thư mục riêng, app phải được cấp quyền Drive ngoài đăng nhập Gmail và phục vụ ảnh theo quyền; phụ thuộc chủ tài khoản. [OAuth scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth) | Đường tải qua proxy Render có thêm chặng; đo thực tế nếu chọn. |

**Chọn R2 Standard private.** 100 bảng × 40 dòng × 3 PA × 2 ảnh × 200 KB ≈ 4,8 GB cho ảnh mẫu, trước ảnh phối cảnh, ảnh thu nhỏ và các bản lưu. Nén WebP phía client, cạnh dài ≤ 1.600 px, mục tiêu khoảng 200 KB; crop có xem trước, kiểm tra định dạng/kích thước phía server. Dùng ảnh thu nhỏ khi cuộn bảng và chỉ tải ảnh lớn khi mở. Kiểm tra thử mạng văn phòng và 4G tại VN ở GĐ2, ghi p50/p95 khi tải ảnh lần đầu và khi tải lại.

DB giữ ID tài sản, object key bất biến và metadata. Với nội bộ, server kiểm tra quyền trước khi cấp URL. Với khách, server chỉ cấp URL khoảng 60 giây cho ảnh thuộc bản phát hành còn hiệu lực; thu hồi link dừng cấp URL mới, URL đã cấp còn hiệu lực đến khi hết hạn. Tệp tải lên có trạng thái chờ, chỉ gắn vào bảng sau khi xác nhận đã lưu. Dọn tệp bỏ dở sau thời gian chờ, giữ ảnh còn tham chiếu bởi thư viện hoặc bản đã ký. Sao lưu DB và ảnh độc lập, kiểm tra khôi phục theo object key. Dùng tài khoản dự án có người quản lý, tách bucket thử nghiệm và sản xuất.

## 4. Mô hình dữ liệu đề xuất

| Thực thể | Khóa và trường chính |
|---|---|
| ProjectProfile | `accountId, scheduleProjectId` duy nhất, khách `name, phone, email, installationAddress`, thông tin công ty/đại diện/chức vụ, `contractNo`; tên dự án lấy từ Tiến độ |
| Sheet | `id, projectProfileId, title, documentNo, templateVersion, version, createdAt, updatedAt, archivedAt`; tiến độ duyệt tính từ dòng và bản phát hành |
| Group | `id, sheetId, position, name, hint, manualDueDate, linkedCalendarId, linkedTaskId, leadDays, leadDayMode` |
| Row | `id, groupId, position, name, room, qty, unit, note, contractor, supplier, renderAssetIds, chosenOptionId, decisionState, orderState, chosenAt, chosenBy` |
| Option | `id, rowId, slot 1–3, brand, code, color, size, finish, supplier, priceMinor?, currency, orderedAssetIds, libraryItemId?`; mỗi slot duy nhất trong dòng, PA được chọn phải cùng dòng |
| Asset | `id, accountId, objectKey, thumbnailKey, hash, mime, width, height, bytes, state, createdAt`; ảnh xếp thứ tự theo nơi sử dụng |
| LibraryItem / Preset | Mã thư viện thuộc tài khoản với nhóm, thông số PA, ảnh và lượt dùng; preset theo loại phòng/đơn vị/KT/bề mặt/NCC/màu, giá trị hiển thị và khóa chuẩn hóa |
| Revision / ReviewLink | Bản phát hành bất biến gồm dữ liệu khách được xem, danh sách ảnh, điều khoản và version gốc. Link lưu hash token, revision, hạn và trạng thái thu hồi. |
| Approval / AuditEvent | Bản chốt bất biến, các PA đã chọn, người ký, ảnh chữ ký, thời điểm server, hạn đổi, xác nhận Bên B nếu có; audit thêm mới với ai/lúc nào/trước/sau/lý do và revision liên quan |

- Luồng hiển thị **Chưa chọn → Đã gửi khách → Khách đã chốt → Đã đặt hàng**, thêm **Đổi mã** khi có yêu cầu điều chỉnh; tách trạng thái duyệt và đặt hàng để giữ lịch sử đơn cũ. PA khác vẫn là dự phòng. Xóa PA đã chốt phải xử lý quyết định trước. Tính KPI theo dòng cần duyệt và chỉ báo quá hạn với nhóm còn dòng chưa chốt.
- Khi khách mở link, họ chọn từng dòng và ký một lượt trên bản phát hành. Nếu có bản mới hoặc link hết hạn, hướng khách xin link mới. Khi ký, kiểm tra revision, đủ lựa chọn và quyền; ghi chữ ký và snapshot trong cùng giao dịch. Dùng token ngẫu nhiên, chống đoán và giới hạn lượt gọi; không ghi token vào log, tắt cache trang duyệt và referrer. Nội dung phát hành không chứa giá mua/ghi chú nội bộ. Chữ ký điện tử, chữ ký Bên B và điều khoản cuối cần duyệt nghiệp vụ.
- Đề xuất hạn đổi **48 giờ kể từ thời điểm ký** theo đồng hồ server, hiển thị giờ Việt Nam. Khách gửi yêu cầu kèm lý do, GD HOME xác nhận tồn kho và phát hành phụ lục/bản mới. Bản đã ký giữ nguyên. Bản đổi không tự gia hạn cửa sổ ban đầu. Sau hạn, nút yêu cầu trên link đóng; ngoại lệ nội bộ phải ghi lý do.
- GĐ5 tính hạn từ ngày bắt đầu task trừ lead time; mặc định đề xuất ngày làm việc theo lịch Tiến độ, hỗ trợ ngày thực tế, dùng hạn thủ công khi không liên kết. Task bị xóa hiện cảnh báo và giữ lần tính cuối để tham khảo. Đọc trạng thái vật liệu để vẽ ✓/⚠ trên task, không dùng phần trăm hoàn thành thi công để biểu diễn duyệt vật liệu. Nếu nhiều nhóm chung task, ✓ khi tất cả nhóm đã chốt.

## 5. Luồng nhập, xuất và tiêu chí duyệt

- Trang chủ → chọn dự án → danh sách bảng → tạo từ mẫu hoặc sao chép → chỉnh bảng. Nhập bằng mũi tên/Tab/Enter, gõ để sửa, Esc, Ctrl+Z/Y, Ctrl+D; tiêu đề và cột nhận diện cố định. Ô preset có chip và ô tìm, xác nhận giá trị mới để lưu dùng lại. Mỗi nhóm thu gọn, đổi thứ tự, thêm dòng nhanh. Ô PA mở chi tiết, cho dán Ctrl+V hoặc kéo thả, crop, xem lớn, sắp và xóa ảnh. Xung đột lưu giữ bản nháp, hiển thị khác biệt để người dùng xử lý.
- Nhập Excel hoặc Google Sheet qua .xlsx xuất ra. Ánh xạ header, tab dữ liệu điền sẵn, PA1/PA2 và ảnh nhúng; báo ảnh công thức/URL cần kiểm tra, dòng thiếu và dữ liệu sẽ ghi trước khi xác nhận. GĐ3 xác thực trên bản mẫu thật.
- Xuất Biên bản A4 từ snapshot đã ký, gồm logo, số hợp đồng, Bên A/B, bảng, Điều 2–4, hai chữ ký. Header bảng lặp khi qua trang. Bảng thống kê PDF/ảnh lọc theo phòng, giữ ảnh và sọc chìm khi chọn. Excel mua hàng dùng PA chốt, khối lượng, đơn vị và NCC, tùy chọn cột giá. Sọc chìm là dấu nhận diện, hồ sơ đối chiếu dựa trên bản đã ký.
- Kiểm tra bản trình duyệt bằng năm mục trong wireframe. Mở **Biên bản A4** để xem bố cục hai trang mẫu. Tên, mã và ảnh là dữ liệu minh họa. Mẫu gốc biên bản và Sheet không có trong repo khảo sát, nên điều khoản và phân trang hiện chỉ là bố cục để duyệt.

## Câu hỏi cho anh Đức

1. Anh duyệt dùng R2 private cho ảnh và Postgres riêng cho Chốt mã chứ? Ai đứng tên quản lý hai tài khoản kho?
2. Danh sách dùng chung theo từng Gmail như hiện tại có đủ cho đợt đầu, hay cần nhiều Gmail cùng làm một dự án? Đề xuất mặc định theo từng Gmail cho tới khi chốt quyền nhóm.
3. “Tối đa 02 ngày” tính đúng 48 giờ hay hết ngày lịch thứ hai? Bên B ký online hay ký sau khi in? Khách chỉ gửi yêu cầu đổi hay được chốt lại trực tiếp?
4. Anh gửi bản Biên bản A4 và Sheet/.xlsx mẫu có tab **DỮ LIỆU ĐIỀN SẴN** để khớp điều khoản, logo, ô gộp và ảnh. Xác nhận khách có được xem giá bán hoặc NCC theo từng bảng không.
5. Lead time mặc định tính ngày làm việc hay ngày thực tế? Anh duyệt cách link cũ mở trang chủ với nút Tiến độ ngay đầu trang chứ?

## Kiểm tra và điểm dừng

`npm test` được gọi nhưng môi trường báo `spawn EPERM` khi Node tạo tiến trình con. Chạy lại bằng `node --test --test-isolation=none`, **18/18 test đạt**. Giai đoạn 0 chỉ thêm tài liệu và wireframe. Giai đoạn 1–5, cập nhật script deploy (cả hai bản), kiểm tra Render và việc triển khai đang chờ duyệt.
