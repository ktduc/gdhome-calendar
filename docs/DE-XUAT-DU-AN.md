# ĐỀ XUẤT KỸ THUẬT GĐ11 — WEB CON "QUẢN LÝ DỰ ÁN" (`/du-an`)

## 1. Mục tiêu & Tổng quan Kiến trúc

Web con **Quản lý dự án** (`/du-an`) đóng vai trò là **Hồ sơ trung tâm (Single Source of Truth)** của mỗi dự án nội thất – xây dựng tại GD HOME, kết nối chặt chẽ hai chiều với **Lịch Tiến Độ** (`/`) và **Chốt Mã Vật Liệu** (`/chot-ma`):

```
                   ┌──────────────────────────────────────────┐
                   │        QUẢN LÝ DỰ ÁN (/du-an)            │
                   │  • Hồ sơ KH & Hợp đồng (dùng chung)      │
                   │  • Kho Hồ sơ: Báo giá, Bản vẽ PDF, 3D    │
                   │  • Bảng Hạng mục Báo giá chuẩn hoá       │
                   │  • AI Soát HSKT & 3D + Ghi chú vào PDF   │
                   └───────────┬──────────────────┬───────────┘
     Đề xuất việc / giai đoạn  │                  │ Đề xuất 17 nhóm vật liệu
     (lưu sourceQuoteItemId)   ▼                  ▼ (lưu sourceQuoteItemId)
             ┌──────────────────────┐        ┌──────────────────────┐
             │  LỊCH TIẾN ĐỘ (/)    │◄──────►│  CHỐT MÃ (/chot-ma)  │
             └──────────────────────┘        └──────────────────────┘
```

---

## 2. Cấu trúc Dữ liệu (Data Models)

Toàn bộ dữ liệu của `/du-an` được lưu trong kho `ProjectHubStore` (key `proj-v1-<sha256(dataKey)>` qua `store.get`/`store.put` của `server.js`, tương thích cả `FileStore` lẫn `GistStore`) và liên kết trực tiếp với `projectOwners[].id` của Lịch Tiến Độ.

### 2.1. `ProjectHubRecord` (theo từng `projectId` = `projectOwners[].id`)
```json
{
  "projectId": "proj_1",
  "updatedAt": "2026-11-08T10:00:00.000Z",
  "documents": [],
  "quoteItems": [],
  "reviewFindings": [],
  "reviewSummary": {
    "lastRunAt": "2026-11-08T10:05:00.000Z",
    "annotatedAssetKey": "abc123...def.pdf",
    "sourceDrawingDocId": "doc_draw_1",
    "pageTags": [
      {
        "docId": "doc_draw_1",
        "pageNumber": 1,
        "drawingType": "mat_bang",
        "room": "Phòng khách",
        "title": "MB bố trí nội thất Phòng khách",
        "detectedItems": ["Sofa", "Bàn trà", "Kệ tivi", "Sàn gỗ"],
        "quantities": [{ "name": "Sàn gỗ", "qty": 28, "unit": "m²" }]
      }
    ],
    "renderTags": [
      {
        "docId": "doc_3d_1",
        "room": "Phòng khách",
        "detectedItems": ["Sofa", "Bàn trà", "Kệ tivi", "Đèn thả"]
      }
    ]
  },
  "pushLinks": {
    "schedule": {
      "lastPushedAt": "2026-11-08T10:10:00.000Z",
      "calendarId": "cal_1",
      "items": {
        "qi_1": { "taskId": "task_101", "hash": "Sofa văng|1|bộ|Phòng khách", "title": "Sản xuất & lắp đặt Sofa văng" }
      }
    },
    "materials": {
      "lastPushedAt": "2026-11-08T10:12:00.000Z",
      "sheetId": "sheet_1",
      "items": {
        "qi_1": { "rowId": "row_201", "groupId": "grp_1", "hash": "Sofa văng|1|bộ|Phòng khách|Nỉ Hàn Quốc" }
      }
    }
  }
}
```

### 2.2. `Document` (Tài liệu tải lên dự án)
| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | `string` | Mã tài liệu (`doc_<timestamp>_<rand>`) |
| `type` | `'quote' \| 'drawing' \| 'render'` | Phân loại: Báo giá (`quote`), Bản vẽ HSKT (`drawing`), Phối cảnh 3D (`render`) |
| `name` | `string` | Tên file gốc (VD: `HSKT-Noi-That-T1.pdf`, `PC-Phong-Khach-01.jpg`) |
| `room` | `string` | Phòng / Khu vực gắn với tài liệu (VD: `Phòng khách`, `Ngủ master`, `Cả nhà`) |
| `mime` | `string` | MIME type (`application/pdf`, `application/vnd.openxmlformats...`, `image/jpeg`, ...) |
| `size` | `number` | Dung lượng byte |
| `assetKey` | `string` | Khóa lưu trữ trong `ProjectAssets` (`<64-hex>.<ext>`) |
| `pages` | `number` | Số trang (với PDF) hoặc `1` (với ảnh/bảng tính) |
| `version` | `number` | Phiên bản hiện hành (`1, 2, 3...`), tự tăng khi tải lại file trùng tên + loại |
| `history` | `Array<{version, assetKey, size, uploadedAt, note}>` | Lịch sử các phiên bản trước để tra cứu / khôi phục |
| `extractedPages` | `Array<{pageNumber, text, drawingType, room, items}>` | Dữ liệu text/nhãn trích xuất từ từng trang PDF |
| `uploadedAt` | `string` | ISO timestamp |

### 2.3. `QuoteItem` (Hạng mục Báo giá chuẩn hoá)
| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | `string` | Mã định danh (`qi_<id>`) |
| `stt` | `string` | Số thứ tự trong báo giá (`1`, `1.1`, `A.2`...) |
| `code` | `string` | Mã hiệu hạng mục / vật tư (`NT-PK-01`, `GO-MDF-02`...) |
| `name` | `string` | Tên hạng mục công việc / nội thất |
| `room` | `string` | Phòng / Khu vực (`Phòng khách`, `Bếp`, `Ngủ master`, `Ngủ con`, `WC`, `Sảnh`, `Cả nhà`...) |
| `category` | `string` | Nhóm công việc (`Phần thô & Xây trát`, `Điện nước (MEP)`, `Trần & Sơn bả`, `Ốp lát đá & gạch`, `Đồ gỗ nội thất`, `Đồ rời & Sofa/Rèm`, `Thiết bị & Phụ kiện`, `Nhôm kính & Cửa`, `Khác`) |
| `spec` | `string` | Quy cách / Chất liệu / Kích thước (`MDF lõi xanh chống ẩm phủ Melamine An Cường 2400x600x2650`) |
| `qty` | `number` | Khối lượng chuẩn hoá (số thực, VD `14.5`) |
| `unit` | `string` | Đơn vị tính (`m²`, `md`, `bộ`, `cái`, `m³`, `gói`) |
| `unitPrice` | `number` | Đơn giá (VNĐ) |
| `amount` | `number` | Thành tiền (VNĐ) |
| `note` | `string` | Ghi chú báo giá |
| `sourceDocId` | `string` | ID tài liệu báo giá gốc |
| `updatedAt` | `string` | ISO timestamp lần sửa cuối (dùng để phát hiện thay đổi so với Tiến độ / Chốt mã) |

### 2.4. `ReviewFinding` (Điểm phát hiện khi soát Hồ sơ Kỹ thuật & 3D theo Báo giá)
| Trường | Kiểu | Mô tả |
|---|---|---|
| `id` | `string` | Mã phát hiện (`rf_<id>`) |
| `quoteItemId` | `string \| null` | Liên kết tới `QuoteItem.id` (bằng `null` nếu là `unquoted_drawing`) |
| `type` | `'missing_drawing' \| 'missing_3d' \| 'qty_mismatch' \| 'unquoted_drawing'` | Loại sai lệch: Thiếu bản vẽ HSKT, Thiếu phối cảnh 3D, Lệch khối lượng/quy cách, Có trên bản vẽ/3D nhưng chưa có trong báo giá |
| `severity` | `'high' \| 'medium' \| 'low'` | Mức độ nghiêm trọng (`high`: Thiếu bản vẽ/lệch KL lớn/chưa báo giá; `medium`: Thiếu 3D đồ nội thất chính; `low`: Khác biệt nhỏ về ghi chú) |
| `status` | `'open' \| 'resolved' \| 'ignored'` | Trạng thái xử lý (`open`: Chưa xử lý, `resolved`: Đã xử lý, `ignored`: Bỏ qua) |
| `room` | `string` | Phòng / Khu vực liên quan |
| `title` | `string` | Tiêu đề ngắn gọn (VD: `Thiếu bản vẽ chi tiết: Tủ giày kịch trần`) |
| `detail` | `string` | Mô tả chi tiết phát hiện & đối chiếu |
| `drawingDocId` | `string` | ID bản vẽ PDF liên quan (nếu có) |
| `pageNumber` | `number` | Số trang trên PDF để gắn ghi chú / nhảy tới trang (1-indexed) |
| `bbox` | `[number, number, number, number]` | Toạ độ tương đối `[xRatio, yRatio, wRatio, hRatio]` (`0..1`) trên trang PDF để vẽ khung callout |
| `renderDocId` | `string` | ID ảnh phối cảnh 3D liên quan (nếu có) |
| `note` | `string` | Ghi chú phản hồi của kiến trúc sư / QS |

---

## 3. Luồng Xử lý Chính & Giới hạn Kỹ thuật

### 3.1. Lưu trữ File (`ProjectAssets`)
- Mở rộng mô hình của `MaterialAssets` (`material-assets.js`):
  - Hỗ trợ đầy đủ MIME:
    - Báo giá: `.xlsx`, `.xls`, `.csv`, `.pdf`
    - Bản vẽ: `.pdf`
    - Phối cảnh 3D: `.jpg`, `.jpeg`, `.png`, `.webp`
  - **Giới hạn dung lượng**: Tối đa **25 MB / file** cho PDF/Excel và **10 MB / file** cho ảnh.
  - **Cơ chế lưu trữ kép**:
    - Nếu tài khoản cấu hình Cloudflare R2 (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`): cấp pre-signed `PUT`/`GET` URL trực tiếp tới R2 تحت prefix `project-files/<accountHash>/<assetKey>`.
    - Nếu chưa bật R2 (hoặc chạy cục bộ): tự động lưu xuống đĩa tại `path.join(DATA_DIR, 'project-files', accountHash, assetKey)` và phục vụ qua `/api/project-hub/assets/:key` (kèm header `Content-Type` chuẩn để `pdf.js` và `<img>` đọc trực tiếp).

### 3.2. Đọc Báo giá (`11.3`)
1. **Excel / CSV**:
   - Đọc bằng SheetJS (`xlsx.full.min.js`) ngay trên trình duyệt kết hợp bộ phân tích cột thông minh (`parseQuoteSheetRows` trong `project-hub.js`, chạy được cả trên Node unit test lẫn trình duyệt).
   - Tự động nhận diện hàng tiêu đề và ghép các cột tiếng Việt phổ biến (`STT`, `Mã hiệu`, `Tên hạng mục / Nội dung công việc`, `Phòng / Khu vực / Vị trí`, `Quy cách / Chất liệu / Diễn giải`, `ĐVT`, `Khối lượng / SL`, `Đơn giá`, `Thành tiền`, `Ghi chú`), đồng thời tự nhận diện các **dòng tiêu đề nhóm / phòng** (VD: `I. PHÒNG KHÁCH`, `A. PHẦN ĐỒ GỖ`) để gán `room` và `category` cho các dòng bên dưới.
   - Hiển thị hộp thoại **Ghép cột & Xem trước** trước khi nhập vào bảng chuẩn hoá.
2. **Báo giá PDF / Ảnh chụp**:
   - Gửi qua `/api/project-hub/ai-quote` sử dụng `integrations.js` (OpenAI / Gemini / Claude đã cấu hình của tài khoản) hoặc trích xuất từ text layer PDF để trả về danh sách `QuoteItem[]`.

### 3.3. Soát Bản vẽ HSKT & Phối cảnh 3D theo Báo giá + Ghi chú vào PDF (`11.4`)
1. **Chiến lược chia trang PDF để không vượt giới hạn AI**:
   - File bản vẽ HSKT thường từ 15–80 trang. Không gửi nguyên file PDF nặng cho AI một lần.
   - Trên trình duyệt, `pdf.js` đọc từng trang PDF:
     - Trích xuất toàn bộ `textContent` kèm toạ độ từng cụm chữ (`items[].str`, `transform`) trên mỗi trang (rất nhẹ, chỉ vài KB/trang).
     - Với các trang ít chữ hoặc khi bật chế độ AI Vision, xuất ảnh thumbnail trang ở kích thước tối ưu (`<= 1024px`, JPEG quality `0.72`) theo từng lô tối đa 6 trang/lần gọi.
2. **Đối chiếu & Sinh Ma trận phủ (`Coverage Matrix`)**:
   - Bộ máy đối chiếu (`analyzeProjectReview` trong `project-hub.js` + `/api/project-hub/ai-review`) kết hợp kết quả phân tích AI và bộ so khớp ngữ nghĩa tiếng Việt (bỏ dấu, từ đồng nghĩa nội thất: *tủ áo ↔ tủ quần áo, kệ tv ↔ kệ tivi, bàn phấn ↔ bàn trang điểm, lavabo ↔ chậu rửa, vách đầu giường ↔ ốp đầu giường*...):
     - Gắn nhãn từng trang PDF: `drawingType` (`mat_bang`, `mat_dung`, `mat_cat`, `chi_tiet`, `mep`, `bia`), `room`, `detectedItems`, và các con số kích thước/khối lượng (`m2`, `md`, `mm`).
     - Gắn nhãn từng ảnh 3D: `room`, `detectedItems`.
     - Lập **Ma trận phủ**: Với mỗi `QuoteItem`, xác định:
       - Có bản vẽ HSKT không? Thuộc trang nào (`drawingPages: [2, 5]`)?
       - Có ảnh phối cảnh 3D không? Thuộc ảnh nào (`renderDocs: ['PC-PK-01.jpg']`)?
     - Sinh `ReviewFinding[]` theo 4 nhóm:
       1. `missing_drawing`: Hạng mục có trong báo giá nhưng không xuất hiện trên bất kỳ trang bản vẽ HSKT nào.
       2. `missing_3d`: Hạng mục nội thất/hoàn thiện nhìn thấy (đồ gỗ, sofa, đèn, đá, giấy dán tường...) có trong báo giá nhưng phòng/hạng mục đó chưa có ảnh phối cảnh 3D.
       3. `qty_mismatch`: Khối lượng hoặc kích thước ghi trên trang bản vẽ lệch `> 5%` so với khối lượng/quy cách trong báo giá.
       4. `unquoted_drawing`: Chi tiết nội thất xuất hiện rõ trên bản vẽ HSKT hoặc phối cảnh 3D nhưng chưa có dòng tương ứng trong báo giá (nguy cơ phát sinh / sót khối lượng).
3. **Ghi chú trực tiếp vào PDF (`annotatePdfWithFindings`)**:
   - Sử dụng thư viện chuẩn **`pdf-lib`** (hoặc bộ ghi PDF tương thích 100% chuẩn PDF 1.7 kèm font ASCII/Vietnamese transliteration an toàn cho mọi trình đọc PDF như Edge, Chrome, Adobe Reader, Foxit):
     - **Trang 1 (Trang Tổng Hợp Kiểm Soát Hồ Sơ -插入 vào đầu file)**: Bảng tổng hợp kết quả soát hồ sơ của dự án (Tổng số hạng mục báo giá, % độ phủ bản vẽ, % độ phủ 3D, danh sách các điểm `ReviewFinding` kèm số trang tham chiếu và mức độ nghiêm trọng).
     - **Trên từng trang bản vẽ gốc**: Vẽ khung viền cảnh báo màu đỏ/cam (`callout box` + nhãn mã lỗi `[#F1 - Lech KL]` / `[#F2 - Chua bao gia]`) tại vị trí `bbox` tìm thấy và dải banner tóm tắt các phát hiện của trang đó ở góc trên trang.
     - Lưu thành asset mới (`annotatedAssetKey`) để người dùng xem trực tiếp hoặc tải xuống (`<TenBanVe>-SOAT-HSKT.pdf`), **giữ nguyên tuyệt đối file PDF gốc**.

### 3.4. Đề xuất sang Tiến độ & Chốt mã + Liên kết ngược (`11.5`)
1. **Đề xuất sang Lịch Tiến Độ**:
   - Từ `QuoteItem[]`, gom nhóm theo trình tự thi công chuẩn của GD HOME:
     1. *Công tác chuẩn bị & Tháo dỡ / Xây trát* (`workDays` ước lượng theo khối lượng)
     2. *Thi công Điện nước (MEP) & Điều hoà* (`FS` sau Xây trát)
     3. *Thi công Trần thạch cao & Sơn bả* (`FS` sau MEP)
     4. *Thi công Ốp lát gạch đá & Sàn gỗ* (`FS` sau Sơn bả)
     5. *Đo đạc & Sản xuất đồ nội thất tại xưởng* (`SS` song song với phần thô, `workDays` tính theo số lượng hạng mục đồ gỗ)
     6. *Lắp đặt đồ gỗ nội thất & Nhôm kính* (`FS` sau Sàn gỗ & Sản xuất xưởng)
     7. *Lắp đặt Thiết bị bếp, TBVS, Đèn & Đồ rời (Sofa, Rèm)* (`FS` sau Lắp đặt nội thất)
     8. *Vệ sinh công nghiệp & Nghiệm thu bàn giao* (`FS` cuối cùng)
   - Sử dụng `scheduler.js` (`shiftDateByWorkingDays`, `calculateTaskDays`) để tính ngày bắt đầu/kết thúc chuẩn theo cấu hình ngày nghỉ của dự án.
   - Mỗi task lưu `sourceQuoteItemId` (hoặc `sourceQuoteItemIds: [...]`) và `sourceQuoteSnapshot`.
2. **Đề xuất sang Bảng Chốt Mã Vật Liệu**:
   - Tự động lọc các `QuoteItem` cần chốt mẫu/mã với chủ đầu tư và phân vào đúng **17 nhóm chuẩn** trong `material-template.js` (`MÃ GỖ (Melamine, PVC…)`, `SƠN GỖ`, `SƠN TƯỜNG + TRẦN`, `PHÀO CHỈ`, `ĐÁ ỐP LÁT...`, `GẠCH ỐP LÁT...`, `KÍNH...`, `GIẤY DÁN TƯỜNG`, `NỈ BỌC...`, `RÈM...`, `SÀN GỖ`, `SÀN NHỰA LOGIA`, `ĐÈN`, `CÔNG TẮC – Ổ CẮM`, `BẾP`, `THIẾT BỊ VỆ SINH`, `TAY NẮM`).
   - Mỗi dòng vật liệu lưu `sourceQuoteItemId` và `sourceQuoteHash`.
3. **Liên kết ngược & Cảnh báo thay đổi**:
   - Khi một `QuoteItem` bị sửa khối lượng, quy cách, tên hoặc bị xoá sau khi đã đẩy sang Tiến độ / Chốt mã, hệ thống so sánh `sourceQuoteHash` và hiển thị **cảnh báo màu cam (`⚠ Báo giá đã thay đổi`)** ngay trên bảng Báo giá cũng như nút **"Đồng bộ lại những mục thay đổi"** sang Tiến độ và Chốt mã.
