# Mặt đồng hồ "Hybrid Orange" – Huawei Watch Fit 5 Pro

![Màn hình chính và AOD](preview_all.png)

- **Kim giờ & phút** giữ y dáng mặt gốc (thanh bạc bản đều, mũi nhọn ngắn, đuôi vát qua tâm, bóng mềm, chấm tâm cam), chỉ **nhạt hơn** (độ đậm 55%).
- **Ô giờ/phút** to, **sát mép phải**, nền **cam nhạt** (màu chủ đề nhạt hơn), số giờ đen – phút nâu đậm; **bỏ "24H"**.
- **Số giây** nằm ngoài ô, ngay **bên dưới**, căn mép phải ô.
- **Ô lịch**: ngày (cam) / "Th 11" / **âm lịch** (trăng + 12/10) xếp 3 tầng trong ô.
- **Thời tiết** gióng theo 3 tầng ô lịch: icon – nhiệt độ hiện tại – **cao/thấp** (19/12).
- **Thứ tiếng Việt**, bố cục dàn **gần tràn viền** màn hình; chừa giữa mép trên cho biểu tượng hệ thống.
- **AOD**: kim giờ/phút + số giờ/phút + thứ, ngày, tháng, giữ đúng vị trí (~12% điểm ảnh sáng).

Khung **408 × 480 px**. Các bước chung (đăng ký nhà phát triển, cài Theme Studio, xuất `.hwt`, cài qua Huawei Health, bật AOD, xử lý sự cố) xem [../fit5pro/HUONG-DAN-CAI-DAT.md](../fit5pro/HUONG-DAN-CAI-DAT.md) (Bước 0–3 và 6–8). Tọa độ = góc trên-trái ảnh.

## Bước 4 – Màn hình chính

### 4.1 Nền
`assets/background.png` → X 0, Y 0. Đã có: nền chuyển màu, ô cam nhạt giờ/phút, khung ô lịch, chữ "Th", trăng + "/" âm lịch, nhãn TIMER/POWER/ACTIVITY/km/MESSAGE/ALARM, đường kẻ và các icon.

### 4.2 Giờ số (24 giờ)

| Thành phần | Ảnh (0→9) | X | Y |
|---|---|---|---|
| Giờ – chục / đơn vị | `time/hour_` (80×112) | 225 / 305 | 70 |
| Phút – chục / đơn vị | `time/minute_` (80×112) | 225 / 305 | 196 |
| Giây – chục / đơn vị | `time/sec_` | 357 / 378 | 330 |

### 4.3 Kim (Pointer)
**Tâm xoay trên màn hình: X 204, Y 240.** Ảnh kim dựng đứng chỉ 12 giờ, đã có sẵn độ nhạt và bóng – không chỉnh thêm opacity.

| Kim | Ảnh | Kích thước | Tâm xoay trong ảnh (X, Y) |
|---|---|---|---|
| Giờ | `hands/hour.png` | 40 × 197 | 20, 156 |
| Phút | `hands/minute.png` | 38 × 261 | 19, 211 |
| Giây | `hands/second.png` | 20 × 273 | 10, 207 |
| Chấm tâm cam (trên cùng) | `hands/cap.png` | 16 × 16 | đặt tại X 196, Y 232 |

### 4.4 Ô lịch & thứ

| Thành phần | Ảnh | X | Y |
|---|---|---|---|
| Ngày – chục / đơn vị | `date/day_0..9` (cam) | 110 / 149 | 68 |
| Tháng – chục / đơn vị | `date/month_0..9` | 151 / 167 | 130 |
| Ngày âm – chục / đơn vị | `date/lunar_0..9` | 132 / 143 | 166 |
| Tháng âm – chục / đơn vị | `date/lunar_0..9` | 161 / 172 | 166 |
| Thứ (căn phải theo mép ô lịch) | `date/week_1_thu_hai` … `week_7_chu_nhat` | 14 | 204 |

- Tháng dùng 2 ô số nên tháng 9 hiện "Th 09". Nếu Theme Studio có kiểu tháng không số 0 đầu, căn trái, đặt `date/month_` tại X 151 để được "Th 9".
- Thứ tự 7 ảnh thứ và lưu ý âm lịch: như mục 4.3 của hướng dẫn Yellow Block.

### 4.5 Thời tiết (gióng theo ô lịch) & dữ liệu

| Thành phần | Ảnh | X | Y | Căn |
|---|---|---|---|---|
| Icon thời tiết (ngang hàng số ngày) | `weather/*.png` (48×44) | 30 | 64 | – |
| Nhiệt độ hiện tại (ngang hàng "Th 11"; + `temp_c`, âm `temp_minus`) | `data/temp_0..9` | 16 | 124 | Trái |
| Cao / thấp (ngang hàng âm lịch; phân cách `hilo_slash`, âm `hilo_minus`) | `data/hilo_0..9` | 22 | 166 | Trái |
| Pin (+ `bat_pct`) | `data/bat_0..9` | 300 | 18 | Trái |
| Số bước (trống `num_empty`) | `data/num_0..9` | **160 = mép phải** | 282 | **Phải** |
| Nhịp tim (trống `numo_empty`) | `data/numo_0..9` (cam) | **160 = mép phải** | 334 | **Phải** |
| Quãng đường km (dấu `small_dot`) | `data/small_0..9` | 112 | 388 | Trái |

Icon thời tiết: `sunny`, `partly_cloudy`, `cloudy`, `rain`, `heavy_rain`, `thunder`, `snow`, `fog`, `wind`, `night`, `unknown` (gán như bảng của Yellow Block).

### 4.6 Vùng chạm

| Mở | X | Y | Rộng × Cao |
|---|---|---|---|
| Bấm giờ | 56 | 14 | 100 × 34 |
| Thời tiết | 10 | 60 | 84 × 136 |
| Hoạt động | 70 | 276 | 130 × 44 |
| Nhịp tim | 70 | 328 | 130 × 44 |
| Tin nhắn | 212 | 378 | 60 × 70 |
| Báo thức | 306 | 378 | 62 × 70 |

## Bước 5 – AOD (cùng vị trí màn hình chính)

| Thành phần | Ảnh | X | Y |
|---|---|---|---|
| Nền AOD (viền ô giờ/phút, khung ô lịch, "Th") | `aod/background_aod.png` | 0 | 0 |
| Giờ – chục / đơn vị | `aod/hour_0..9` | 225 / 305 | 70 |
| Phút – chục / đơn vị | `aod/minute_0..9` | 225 / 305 | 196 |
| Ngày – chục / đơn vị | `aod/day_0..9` | 110 / 149 | 68 |
| Tháng – chục / đơn vị | `aod/month_0..9` | 151 / 167 | 130 |
| Thứ | `aod/week_1_thu_hai` … `week_7_chu_nhat` | 14 | 204 |
| Kim giờ (tâm ảnh 20, 156) | `aod/hand_hour.png` | tâm xoay 204, 240 | |
| Kim phút (tâm ảnh 19, 211) | `aod/hand_minute.png` | tâm xoay 204, 240 | |
| Chấm tâm | `aod/hand_cap.png` | 196 | 232 |

Không thêm giây, kim giây, dữ liệu hay vùng chạm vào AOD.

## Kiểm tra trong Preview
- Giờ **10:08**, **14:45**, **08:00**: kim đè lên ô lịch / ô giờ vẫn đọc được.
- **Chủ nhật** ("CHỦ NHẬT"), ngày **31/12**, tháng **9**, bước **12345**, nhiệt độ **−5°C** và cao/thấp **−2/−8**, quãng đường **12.50**.

## Sửa & xuất lại ảnh

```bash
node watchface/fit5pro-hybrid/src/generate.cjs
cd watchface/fit5pro-hybrid && zip -qr HybridOrange_Fit5Pro.zip assets HUONG-DAN-CAI-DAT.md preview*.png
```

- Màu ô giờ/phút: 2 mã màu `#FFBE85` → `#FFA45E` trong hàm `background` của `src/generate.cjs`; vị trí/kích thước ô: `panel` trong `src/layout.js`.
- Độ đậm kim: `handAlpha: 0.55` trong `src/layout.js` (1 = đặc như mặt gốc).
- Mở `src/preview.html` để xem chạy giờ thật; bấm vào mặt để chuyển AOD.
