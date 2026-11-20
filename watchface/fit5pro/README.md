# Mặt đồng hồ "Yellow Block" – Huawei Watch Fit 5 Pro

![preview](preview_all.png)

👉 **Hướng dẫn dựng & cài chi tiết từng bước: [HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md)**

Bộ ảnh và bố cục dựng theo mẫu: khối giờ vàng 24H và ô giây kèm chuông báo thức nằm **bên phải**; cột **bên trái** hiển thị thứ bằng tiếng Việt, ngày/tháng dạng số (03/11), ngày âm lịch (25/09 ÂL) và hoạt động (bước chân, nhịp tim); hàng trên thời tiết + bình minh, hàng dưới pin + 2 phím tắt (tin nhắn, cuộc gọi).

- Khung thiết kế: **408 × 480 px**, đúng độ phân giải màn hình Watch Fit 5 Pro (1,92" AMOLED).
- Phông chữ: Barlow / Barlow Semi Condensed (giấy phép SIL OFL, dùng thương mại được).

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `assets/background.png` | Nền tĩnh (đã gồm khung vàng, nhãn, đường kẻ, dấu "/" của ngày và âm lịch, chữ "ÂL", icon trăng/chuông/giày/tim/tin nhắn/điện thoại/bình minh) |
| `assets/time/big_0..9.png` | Số giờ & phút (đen, 72×92) |
| `assets/time/sec_0..9.png` | Số giây (đen, 34×50) |
| `assets/date/week_1_thu_hai … week_7_chu_nhat.png` | Thứ tiếng Việt: THỨ HAI … CHỦ NHẬT (vàng, 178×56) |
| `assets/date/day_0..9.png` | Số ngày và số tháng dương lịch (trắng, 27×42) |
| `assets/date/lunar_0..9.png` | Số ngày/tháng âm lịch (vàng, 13×24) |
| `assets/data/num_0..9.png` + `unit_c`, `unit_pct`, `num_minus`, `num_empty` | Số trắng cho nhiệt độ, bước, nhịp tim, pin (18×34) |
| `assets/data/gray_0..9.png` + `gray_slash`, `gray_minus` | Nhiệt độ cao/thấp (xám, 10×20) |
| `assets/data/small_0..9.png` + `small_colon` | Giờ bình minh (trắng, 12×24) |
| `assets/weather/*.png` | 11 icon thời tiết vàng (64×46) |
| `assets/aod/` | Màn hình AOD: nền `background_aod`, số giờ nét viền `time_0..9` (72×92), số ngày nét viền `date_0..9` (27×42), thứ nét viền `week_*` (178×56) |
| `YellowBlock_Fit5Pro.zip` | Toàn bộ `assets/` + hướng dẫn, để tải về máy Windows |
| `src/` | Mã nguồn: `layout.js` (tọa độ), `icons.js`, `generate.cjs` (xuất ảnh), `preview.html` (xem thử chạy giờ thật) |

## Tọa độ đặt trong Theme Studio (x, y = góc trên-trái)

| Phần tử | Ảnh | x | y | Căn |
|---|---|---|---|---|
| Nền | background.png | 0 | 0 | – |
| Giờ – chục / đơn vị | time/big_ | 226 / 298 | 140 | – |
| Phút – chục / đơn vị | time/big_ | 226 / 298 | 228 | – |
| Giây – chục / đơn vị | time/sec_ | 300 / 334 | 352 | – |
| Thứ | date/week_ | 24 | 146 | – |
| Ngày – chục / đơn vị | date/day_ | 26 / 53 | 200 | – |
| Tháng (số) – chục / đơn vị | date/day_ | 98 / 125 | 200 | – |
| Ngày âm – chục / đơn vị | date/lunar_ | 48 / 61 | 248 | – |
| Tháng âm – chục / đơn vị | date/lunar_ | 82 / 95 | 248 | – |
| Nhiệt độ hiện tại (+ °C) | data/num_ | 30 | 60 | Trái |
| Nhiệt độ cao / thấp | data/gray_ | 40 | 94 | Trái |
| Icon thời tiết | weather/ | 140 | 60 | – |
| Giờ bình minh | data/small_ | 280 | 60 | Trái |
| Số bước | data/num_ | 58 | 318 | Trái |
| Nhịp tim | data/num_ | 58 | 362 | Trái |
| Pin (+ %) | data/num_ | 204 (tâm) | 436 | Giữa |

## Màn hình AOD

Giữ đúng vị trí màn hình chính cho liền mạch; chỉ hiện thứ, ngày/tháng và giờ:phút (không giây), toàn bộ dạng nét viền, ~7% điểm ảnh sáng. Tọa độ và cách dựng: xem [HUONG-DAN-CAI-DAT.md](HUONG-DAN-CAI-DAT.md#bước-5--dựng-màn-hình-aod-luôn-hiển-thị).

## Sửa giao diện & xuất lại ảnh

```bash
node watchface/fit5pro/src/generate.cjs
```

Sau khi xuất lại ảnh, tạo lại file zip: `cd watchface/fit5pro && zip -qr YellowBlock_Fit5Pro.zip assets HUONG-DAN-CAI-DAT.md preview*.png`.

Lệnh xuất lại toàn bộ `assets/`, `preview.png`, `preview_aod.png`. Bấm vào mặt đồng hồ trong `preview.html` để chuyển giữa màn hình chính và AOD. Mở `src/preview.html` trong trình duyệt để xem chạy theo giờ thật (thêm `?static=1` để giữ 22:42:07 ngày 03/11/2026). Ngày âm trong bản xem thử lấy từ lịch âm Trung Hoa của trình duyệt, có thể lệch 1 ngày so với lịch Việt Nam ở một số tháng.
Đổi màu ở `colors`, đổi vị trí ở `widgets`, đổi cỡ chữ ở `digitSets` trong `src/layout.js`; nhãn và nền tĩnh nằm trong hàm `background` của `generate.cjs`.
