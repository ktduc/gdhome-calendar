# Mặt đồng hồ "Orange Block" – Huawei Watch Fit 5 Pro

![Màn hình chính và AOD](preview_all.png)

Theo giao diện mẫu bạn gửi (khối giờ cam bên phải, thứ / ngày tháng năm / âm lịch bên trái), thêm:
- **Kim giờ & phút** dáng kim bạc của mặt mẫu Hybrid, **có bóng đổ**, độ đậm 72% (vẫn thấy chữ bên dưới).
- Bố cục **dàn gần tràn viền** (lề ~12px, khối cam sát mép phải).
- **Âm lịch có năm can chi** đầy đủ: "13/10/ Bính Ngọ".
- **AOD**: ô giờ/phút (viền cam, số nét viền) + ngày/tháng/năm + kim giờ/phút, cùng vị trí (~9% điểm ảnh sáng).

Khung **408 × 480 px**. Các bước chung (đăng ký nhà phát triển, cài Theme Studio, xuất `.hwt`, cài qua Huawei Health, bật AOD, xử lý sự cố) xem [../fit5pro/HUONG-DAN-CAI-DAT.md](../fit5pro/HUONG-DAN-CAI-DAT.md) (Bước 0–3 và 6–8). Tọa độ = góc trên-trái ảnh.

## Bước 4 – Màn hình chính

**Nền:** `assets/background.png` → X 0, Y 0 (đã có khối cam, nhãn 24H, khối giây + chuông + chữ SECOND, nhãn FORECAST/SUNRISE/ACTIVITY/STEPS/BPM/POWER, đường kẻ, các dấu "/", icon bình minh/giày/tim/tin nhắn/điện thoại).

### Giờ (24 giờ)

| Thành phần | Ảnh (0→9) | X | Y |
|---|---|---|---|
| Giờ – chục / đơn vị | `time/big_` (80×112) | 227 / 307 | 124 |
| Phút – chục / đơn vị | `time/big_` | 227 / 307 | 240 |
| Giây – chục / đơn vị | `time/sec_` (32×50) | 306 / 338 | 376 |

### Kim (Pointer) – tâm xoay trên màn hình **X 210, Y 246**

| Kim | Ảnh | Kích thước | Tâm xoay trong ảnh |
|---|---|---|---|
| Giờ | `hands/hour.png` | 44 × 201 | 22, 158 |
| Phút | `hands/minute.png` | 42 × 265 | 21, 213 |
| Nắp tâm (trên cùng) | `hands/cap.png` | 18 × 18 | đặt tại X 201, Y 237 |

Ảnh kim đã có sẵn bóng và độ đậm – không chỉnh thêm opacity. Mặt này không có kim giây (giây hiện bằng số).

### Lịch

| Thành phần | Ảnh | X | Y |
|---|---|---|---|
| Thứ (THỨ 2 … THỨ 7, CHỦ NHẬT) | `date/week_1_thu_2` … `week_7_chu_nhat` | 12 | 118 |
| Ngày – chục / đơn vị | `date/date_0..9` | 14 / 33 | 190 |
| Tháng – chục / đơn vị | `date/date_0..9` | 62 / 81 | 190 |
| Năm – 4 chữ số | `date/date_0..9` | 110 / 129 / 148 / 167 | 190 |
| Ngày âm – chục / đơn vị | `date/lunar_0..9` | 14 / 27 | 232 |
| Tháng âm – chục / đơn vị | `date/lunar_0..9` | 49 / 62 | 232 |
| Năm can chi | `date/canchi_00_giap_ty` … `canchi_59_quy_hoi` | 90 | 230 |

**Năm can chi:** 60 ảnh, số thứ tự = (năm âm − 4) chia lấy dư 60 (vd. Bính Ngọ 2026 = `canchi_42`). Nếu Theme Studio có thành phần năm âm lịch nhận ảnh theo can chi thì gán 60 ảnh này; nếu không, có thể bỏ ảnh can chi (vẫn còn ngày/tháng âm) hoặc báo lại để in cố định một năm lên nền.

### Thời tiết, hoạt động, pin

| Thành phần | Ảnh | X | Y | Căn |
|---|---|---|---|---|
| Nhiệt độ (+ `num_c`, âm `num_minus`) | `data/num_0..9` | 24 | 40 | Trái |
| Cao / thấp (phân cách `gray_slash`, âm `gray_minus`) | `data/gray_0..9` | 38 | 78 | Trái |
| Icon thời tiết | `weather/*.png` (66×56) | 136 | 40 | – |
| Giờ bình minh (dấu `small_colon`) | `data/small_0..9` | 274 | 42 | Trái |
| Số bước (trống `num_empty`) | `data/num_0..9` | 52 | 312 | Trái |
| Nhịp tim (trống `num_empty`) | `data/num_0..9` | 52 | 372 | Trái |
| Pin (+ `small_pct`) | `data/small_0..9` | 204 (tâm) | 450 | Giữa |

Icon thời tiết: `sunny`, `partly_cloudy`, `cloudy`, `rain`, `heavy_rain`, `thunder`, `snow`, `fog`, `wind`, `night`, `unknown` (gán như bảng của Yellow Block).

### Vùng chạm

| Mở | X | Y | Rộng × Cao |
|---|---|---|---|
| Thời tiết | 14 | 36 | 196 × 66 |
| Báo thức (chuông) | 214 | 364 | 72 × 66 |
| Hoạt động | 10 | 306 | 196 × 48 |
| Nhịp tim | 10 | 364 | 196 × 48 |
| Tin nhắn | 62 | 438 | 56 × 40 |
| Cuộc gọi | 292 | 438 | 56 × 40 |

## Bước 5 – AOD (cùng vị trí)

| Thành phần | Ảnh | X | Y |
|---|---|---|---|
| Nền AOD (viền khối cam, 24H, dấu "/") | `aod/background_aod.png` | 0 | 0 |
| Giờ – chục / đơn vị | `aod/big_0..9` | 227 / 307 | 124 |
| Phút – chục / đơn vị | `aod/big_0..9` | 227 / 307 | 240 |
| Ngày / tháng / năm | `aod/date_0..9` | như bảng Lịch | 190 |
| Kim giờ (tâm ảnh 22, 158) | `aod/hand_hour.png` | tâm xoay 210, 246 | |
| Kim phút (tâm ảnh 21, 213) | `aod/hand_minute.png` | tâm xoay 210, 246 | |
| Nắp tâm | `aod/hand_cap.png` | 201 | 237 |

## Sửa & xuất lại ảnh

```bash
node watchface/fit5pro-orange/src/generate.cjs
cd watchface/fit5pro-orange && zip -qr OrangeBlock_Fit5Pro.zip assets HUONG-DAN-CAI-DAT.md preview*.png
```

- Độ đậm kim: `handAlpha` trong `src/layout.js` (1 = đặc).
- Màu cam: `colors.orange` trong `src/layout.js`.
- Mở `src/preview.html` để xem chạy giờ thật; bấm vào mặt để chuyển AOD.
