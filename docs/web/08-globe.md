# U3 · Địa cầu tương tác

Mốc U3.3 gồm địa cầu, marker và chuỗi chuyển cảnh đến khung xem trước vị trí. Bản đồ tile, tích hợp MapLibre/CSP cho nguồn tile và các điều khiển bản đồ thuộc U3.4. Khối hình học U2 được giữ bên dưới hướng dẫn mua sắm trên desktop.

## Cấu hình

- Đổi tọa độ, nhãn, địa chỉ (nếu có), tốc độ quay, độ nghiêng, mật độ và thời gian trong `apps/web/src/config/globe.ts`. Giao diện dùng marker đầu tiên. Mặc định tọa độ TP. Hồ Chí Minh là **PLACEHOLDER**, chỉ hiển thị “Vị trí minh họa”. Nhập địa chỉ thật trước khi dùng trang để quảng bá địa điểm.
- `NEXT_PUBLIC_GLOBE_ENABLED=false` hoặc `markers: []` trả hero về bố cục chỉ có nội dung. Đặt biến trước khi build web.
- Ba pha hiện tại dài 1,4 giây để xoay tới marker, 3,2 giây để hạ góc nhìn và 0,8 giây để hiện khung xem trước. Esc và nút quay lại tua ngược tối đa 1,2 giây. `timing.fly` dành cho chuyến bay của bản đồ U3.4, có thể chồng một phần với crossfade khi bản đồ sẵn sàng.

## Dữ liệu và renderer

Mặt nạ đất liền cục bộ là 8.100 byte, một bit mỗi ô trên lưới 360×180. Từ `website/` chạy `python apps/web/scripts/generate-globe.py` khi cần cập nhật dữ liệu. Script Python dùng thư viện chuẩn, có thể nhận bản GeoJSON bằng `--source`, và không tham gia build. Poster SVG dùng cùng mặt nạ. [Giấy phép của dữ liệu](../../website/apps/web/THIRD_PARTY_LICENSES.md)

Loader dùng lại kiểm tra năng lực thiết bị và ngân sách hai canvas của U2. Khung vuông và poster có sẵn từ HTML. Sau load và idle, canvas được nạp khi trong vùng nhìn. Dữ liệu mặt nạ được tải cùng origin; Three.js dựng lưới Fibonacci và vẽ các chấm bằng một đối tượng Points. Shader làm mờ gần rìa và bỏ nửa cầu phía sau. Marker và nhãn là lớp HTML, còn canvas chỉ để minh họa. Desktop kéo hai trục, điện thoại kéo ngang với `touch-action: pan-y` để giữ cuộn dọc. Hiện không có yêu cầu từ xa khi mở khung xem trước. Liên kết OpenStreetMap chỉ điều hướng khi người dùng bấm.

| Điều kiện                                             | Hiển thị                               |
| ----------------------------------------------------- | -------------------------------------- |
| Trình duyệt sẵn sàng, trong viewport và có WebGL2     | Canvas một lớp Points, marker HTML     |
| Đang tải, JavaScript tắt hoặc không có WebGL2         | Poster cùng khung vuông                |
| Giảm chuyển động, tiết kiệm dữ liệu hoặc thiết bị yếu | Poster và nút mở thẳng khung xem trước |
| Mất WebGL context                                     | Poster và một lần thử khởi tạo lại     |
| Ngoài vùng nhìn hoặc tab ẩn                           | Canvas được gỡ, poster giữ chỗ         |

Trong dev, mở `/_dev/components` để xem cảnh tương tác và poster mô phỏng thiết bị không có WebGL. CSP hiện ở Report-Only. U3.4 sẽ đo nguồn thực tế trước khi thêm host bản đồ vào allowlist. OpenFreeMap công bố Positron và Dark cùng hướng dẫn ghi nguồn OpenFreeMap, OpenMapTiles và OpenStreetMap. [OpenFreeMap Quick Start](https://openfreemap.org/quick_start/) · [MapLibre GL JS](https://maplibre.org/maplibre-gl-js/docs/)

## Kiểm thử và ngân sách

Ngân sách tăng tối đa khoảng 5 KB JavaScript ban đầu. Địa cầu dùng lại Three.js/R3F đã pin từ U2.3. Tại mốc này không thêm dependency runtime hay dependency tạo mask. Giữ LCP dưới 2,5 giây, CLS dưới 0,1 và TBT dưới 200 ms là mục tiêu. LCP và TBT mobile đã ngoài ngưỡng ở số đo trước U3.

Từ `website/`, chạy `pnpm e2e:public` và đặt `STOREFRONT_CAPTURE_GLOBE=1` để lưu ảnh dưới `.cache/ui-globe/`. Chạy `pnpm lighthouse --home-only --analyze` để so sánh production build với API seed cô lập.

| Trang chủ         | Performance |    LCP | CLS |    TBT |
| ----------------- | ----------: | -----: | --: | -----: |
| Trước U3, mobile  |          71 | 4,39 s |   0 | 527 ms |
| Trước U3, desktop |          97 | 0,92 s |   0 | 139 ms |
| Sau U3.3          |     Chưa đo |      — |   — |      — |

Số trước U3 là trung vị ba lượt mỗi thiết bị, báo cáo nằm trong `website/.cache/ui-globe/before/`. Bundle analyzer trước U3 ghi 816.702 byte nén cho toàn bộ phần client của route `/`, bao gồm các chunk tải sau. Đây là số theo route, chưa phải lượng JS tải ban đầu.

Lint, typecheck và bốn test logic địa cầu đạt trên bản cuối. Vitest đầy đủ đạt 163 test trên 37 suite. Production build cô lập đã compile trước lượt sửa lỗi typecheck cuối. Lượt sau trong sandbox bị dừng do Turbopack không khởi động được tiến trình PostCSS. Lượt chạy lại build/analyzer và lượt Playwright ngoài sandbox đều chưa được cấp quyền. Chưa có kết quả production build cuối, số bundle/Lighthouse sau thay đổi, ảnh/video, axe hay kiểm chứng WebGL/thiết bị cảm ứng thật. Các test trình duyệt đã được đưa vào hai project Chromium.
