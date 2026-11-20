# Mặt đồng hồ "Hybrid Orange" – Huawei Watch Fit 5 Pro

![Màn hình chính và AOD](preview_all.png)

Giữ nguyên thiết kế mặt gốc (font Roboto mảnh, bóng đổ, nền xám chuyển tối, màu cam/trắng/xám, kim bạc). Chỉ cải tiến:
- **Kim giờ & phút giữ dáng cũ, làm mờ ~60%**: vẫn đọc được thông tin bên dưới.
- **Tháng viết tắt**: "Th 11" (tháng 9 → "Th 9" hiển thị "Th 09"; xem ghi chú 4.4).
- **Thứ tiếng Việt**: THỨ HAI … CHỦ NHẬT.
- **Số giờ/phút đậm hơn** (vẫn Roboto, từ nét mảnh lên Medium) và có **nền bo góc** làm nổi khối số.
- **Âm lịch** (12/10 kèm trăng cam) dưới nhiệt độ – theo yêu cầu trước.
- **AOD**: kim giờ/phút + số giờ/phút + thứ, ngày, tháng, **giữ nguyên vị trí** màn hình chính, màu dịu trên nền đen (~10% điểm ảnh sáng). Không giây, không dữ liệu.

Khung **408 × 480 px**. Các bước chung (đăng ký nhà phát triển, cài Theme Studio, xuất `.hwt`, cài qua Huawei Health, bật AOD, xử lý sự cố) xem [../fit5pro/HUONG-DAN-CAI-DAT.md](../fit5pro/HUONG-DAN-CAI-DAT.md) (Bước 0–3 và 6–8). Dưới đây là phần riêng cho mặt này. Tọa độ = góc trên-trái ảnh.

## Bước 4 – Màn hình chính

### 4.1 Nền
`assets/background.png` → X 0, Y 0. Đã có: nền chuyển màu, khung bo quanh giờ/phút, ô ngày, chữ "Th", nhãn TIMER/POWER/CALENDAR/ACTIVITY/24H/km/MESSAGE/ALARM, đường kẻ, dấu "/" âm lịch và các icon (bấm giờ, trăng, giày, tim, vị trí, tin nhắn, báo thức).

### 4.2 Giờ số (24 giờ)

| Thành phần | Ảnh (0→9) | X | Y |
|---|---|---|---|
| Giờ – chục / đơn vị | `time/hour_` | 214 / 280 | 124 |
| Phút – chục / đơn vị | `time/minute_` | 212 / 283 | 250 |
| Giây – chục / đơn vị | `time/sec_` | 364 / 384 | 290 |

### 4.3 Kim (Pointer)
**Tâm xoay trên màn hình: X 196, Y 232.** Ảnh kim dựng đứng chỉ 12 giờ, đã có sẵn độ mờ và bóng – không chỉnh thêm opacity.

| Kim | Ảnh | Kích thước | Tâm xoay trong ảnh (X, Y) |
|---|---|---|---|
| Giờ | `hands/hour.png` | 40 × 176 | 20, 150 |
| Phút | `hands/minute.png` | 36 × 262 | 18, 228 |
| Giây | `hands/second.png` | 20 × 270 | 10, 214 |
| Nắp tâm (trên cùng) | `hands/cap.png` | 24 × 24 | đặt tại X 184, Y 220 |

### 4.4 Lịch

| Thành phần | Ảnh | X | Y |
|---|---|---|---|
| Ngày – chục / đơn vị | `date/day_0..9` (cam) | 98 / 131 | 108 |
| Tháng – chục / đơn vị | `date/month_0..9` | 138 / 153 | 166 |
| Thứ (căn phải theo mép ô ngày) | `date/week_1_thu_hai` … `week_7_chu_nhat` | 2 | 220 |
| Ngày âm – chục / đơn vị | `date/lunar_0..9` | 40 / 51 | 194 |
| Tháng âm – chục / đơn vị | `date/lunar_0..9` | 68 / 79 | 194 |

- Tháng dùng 2 ô số cố định nên tháng 9 hiện "Th 09". Nếu Theme Studio cho tháng kiểu **số không có số 0 đầu, căn trái**, đặt bộ `date/month_` tại X 138 căn trái để được "Th 9".
- Thứ tự 7 ảnh thứ và lưu ý về âm lịch: như mục 4.3 của hướng dẫn Yellow Block.

### 4.5 Dữ liệu

| Thành phần | Ảnh | X | Y | Căn |
|---|---|---|---|---|
| Pin (+ `bat_pct`) | `data/bat_0..9` | 212 | 60 | Trái |
| Icon thời tiết | `weather/*.png` (40×38, trắng đặc) | 30 | 116 | – |
| Nhiệt độ (+ `temp_c`, âm `temp_minus`) | `data/temp_0..9` | 20 | 158 | Trái |
| Số bước (trống `num_empty`) | `data/num_0..9` | **142 = mép phải** | 302 | **Phải** |
| Nhịp tim (trống `numo_empty`) | `data/numo_0..9` (cam) | **142 = mép phải** | 360 | **Phải** |
| Quãng đường km (dấu `small_dot`) | `data/small_0..9` | 104 | 412 | Trái |

Icon thời tiết: tên file giống bảng của Yellow Block (`sunny`, `partly_cloudy`, `cloudy`, `rain`, `heavy_rain`, `thunder`, `snow`, `fog`, `wind`, `night`, `unknown`).

### 4.6 Vùng chạm

| Mở | X | Y | Rộng × Cao |
|---|---|---|---|
| Bấm giờ | 98 | 34 | 84 × 30 |
| Thời tiết | 10 | 110 | 80 × 80 |
| Hoạt động | 60 | 296 | 120 × 40 |
| Nhịp tim | 60 | 354 | 120 × 40 |
| Tin nhắn | 210 | 382 | 58 × 72 |
| Báo thức | 294 | 382 | 58 × 72 |

## Bước 5 – AOD (cùng vị trí màn hình chính)

| Thành phần | Ảnh | X | Y |
|---|---|---|---|
| Nền AOD (khung bo giờ/phút, ô ngày, "Th", "24H") | `aod/background_aod.png` | 0 | 0 |
| Giờ – chục / đơn vị | `aod/hour_0..9` | 214 / 280 | 124 |
| Phút – chục / đơn vị | `aod/minute_0..9` | 212 / 283 | 250 |
| Ngày – chục / đơn vị | `aod/day_0..9` | 98 / 131 | 108 |
| Tháng – chục / đơn vị | `aod/month_0..9` | 138 / 153 | 166 |
| Thứ | `aod/week_1_thu_hai` … `week_7_chu_nhat` | 2 | 220 |
| Kim giờ (tâm ảnh 20, 150) | `aod/hand_hour.png` | tâm xoay 196, 232 | |
| Kim phút (tâm ảnh 18, 228) | `aod/hand_minute.png` | tâm xoay 196, 232 | |
| Nắp tâm | `aod/hand_cap.png` | 184 | 220 |

Không thêm giây, kim giây, dữ liệu hay vùng chạm vào AOD.

## Kiểm tra trong Preview
- Giờ **10:08**, **14:45**: kim đè lên ô ngày / số giờ vẫn đọc được.
- **Chủ nhật** ("CHỦ NHẬT"), ngày **31/12**, tháng **9** ("Th 09" hoặc "Th 9"), bước **12345**, nhiệt độ **−5°C**, quãng đường **12.50**.

## Sửa & xuất lại ảnh

```bash
node watchface/fit5pro-hybrid/src/generate.cjs
cd watchface/fit5pro-hybrid && zip -qr HybridOrange_Fit5Pro.zip assets HUONG-DAN-CAI-DAT.md preview*.png
```

- Độ mờ kim: số `alpha: 0.6` trong hàm `hands()` của `src/generate.cjs` (0 = trong suốt, 1 = đặc).
- Bố cục: `src/layout.js`. Font Roboto (Apache 2.0) trong `src/fonts/`.
- Mở `src/preview.html` để xem chạy giờ thật; bấm vào mặt để chuyển AOD.
