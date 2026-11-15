# 4.U · Theme, cuộn đầu trang và mascot

## Công tắc giao diện

Storefront và admin dùng chung `ThemeToggle`. `next-themes` áp dụng class trên HTML trước khi hydrate, CSS xác định vị trí núm và icon. Sau khi mount, công tắc dùng `resolvedTheme` cho `aria-checked`. Lần bật đầu tiên lưu lựa chọn sáng hoặc tối, sau đó trình duyệt dùng lựa chọn đã lưu.

View Transition dùng snapshot gốc và loang tròn 400 ms từ tâm công tắc. `disableTransitionOnChange` giữ màu nền đổi đồng bộ, còn núm và icon dùng keyframes riêng 240 ms. Nếu trình duyệt thiếu API hoặc bật reduced motion, màu đổi tức thì. [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) · [next-themes](https://github.com/pacocoursey/next-themes)

## Cuộn đầu trang

Storefront và admin dùng chung nút 44 px với góc 2 px theo hình học phẳng của thiết kế. Sentinel ở đầu document và root margin 400 px xác định ngưỡng. Nút ở z-40, header z-30, dialog và drawer z-50. Vị trí cộng safe area ở cạnh phải và cạnh dưới.

Sau `scrollend`, focus về `#content` với `preventScroll`. Trình duyệt cũ dùng timer dự phòng. Reduced motion cuộn và đặt focus ngay. Listener scroll passive qua một rAF là đường dự phòng cho trình duyệt thiếu IntersectionObserver.

## Khảo sát mascot

| Giải pháp | Kết quả |
| --- | --- |
| [oneko.js](https://github.com/adryd325/oneko.js/) | Script JS theo con trỏ, mã MIT, có cập nhật tháng 10/2025. Repo không cung cấp typings riêng và tài liệu chưa nêu rõ giấy phép cho riêng sprite GIF. |
| [svelte-neko](https://github.com/yuna0x0/svelte-neko) | Port Svelte 5 có kiểu props và mã MIT. Luồng chính bám con trỏ. Hợp đồng component là của Svelte. |
| [Oneko cho React](https://github.com/0xdhrv/oneko) | Registry React có types và mã MIT. Có pointer, naps và zoomies. Tài liệu tách giấy phép mã khỏi các sprite và chưa mô tả bộ hành vi đi lang thang, giật mình và kéo thả theo yêu cầu. |
| [Shimeji-ee](https://github.com/DalekCraft2/Shimeji-Desktop) | Mascot Java cho desktop. |
| [Rive React](https://github.com/rive-app/rive-react) | Runtime React/TypeScript được bảo trì, mã MIT. Hành vi và đồ họa của mascot phải được tác giả xây dựng trong asset `.riv` hoặc điều khiển từ ứng dụng. |

Chọn phương án B với sprite SVG tự vẽ trong repo. Không cần thêm runtime bên thứ ba hoặc cấp phép lại artwork từ oneko. [Ghi chú giấy phép sprite](https://github.com/0xdhrv/oneko/blob/main/docs/skins.md)

## Engine

`src/lib/mascot/engine.ts` là state machine TypeScript nhận đồng hồ, RNG, kích thước viewport, tọa độ/vận tốc trỏ và hình chữ nhật cần tránh. Vận tốc dùng px/giây, dt kẹp ở 50 ms. Engine không đọc DOM hoặc asset. Khi rơi, mascot đáp ở mép dưới hoặc ở ngay phía trên vùng tránh cắt đường rơi, rồi nảy một lần. Khi viewport bị che kín, engine trả `visible: false` cho đến khi có chỗ an toàn.

## Tùy chỉnh và tích hợp

- Đổi kích thước, tốc độ đi/chạy, thời gian ngủ và danh sách route ẩn trong `website/apps/web/src/config/mascot.ts`. Thay ảnh ở `public/mascot/`; cập nhật manifest gồm kích thước ô, lưới, khung/hướng và lật gương. Asset gốc `shop-cat.svg` do dự án vẽ, gồm 12 ô 32 px trong lưới 4×3. Không dùng sprite hoặc mã oneko.
- `NEXT_PUBLIC_MASCOT_ENABLED=false` trong env web trước build tắt nhân vật và nút footer. Với mặc định `true`, nút footer lưu lựa chọn theo origin. Lỗi storage chỉ giới hạn lựa chọn trong phiên trang hiện tại.
- Storefront nạp sprite sau load và idle bằng một chunk động. Mascot ở z-20, dừng khi hộp thoại mở hoặc tab ẩn và ẩn hoàn toàn với reduced motion. Vùng chạm có kích thước sprite. Header, banner, phần thanh toán giỏ, nút cuộn và toast là vùng tránh. Các rect được đọc tối đa mỗi 500 ms khi viewport ổn định.
- Mobile dùng chạm và kéo thả. Các phản ứng con trỏ chỉ dành cho chuột. Phần thanh toán giỏ có khoảng trống cạnh phải trên mobile dành cho nút cuộn lên.

## Kiểm chứng

`pnpm lint` và `pnpm typecheck` đạt. Lượt test toàn workspace sau tích hợp đạt 139 test trong 30 suite, 0 skip. Lượt chạy lại riêng web đạt 74 test trong 16 suite, 0 skip. Vitest dùng RNG và đồng hồ giả cho engine, jsdom cho theme, scroll, footer preference, modal và vòng lặp rAF.

Chạy `pnpm build` rồi `pnpm --filter @storefront/web smoke:ui-extras` từ `website/` để chạy suite trình duyệt. Script tạo Fastify và MongoDB seed tạm từ bản build hiện có. Ảnh CDN trong bộ kiểm thử được thay bằng ảnh cục bộ để loại biến động mạng khi đo. Script ghi ảnh và số đo A/B mascot bật/tắt vào `.cache/ui-extras/`, gồm LCP, CLS và ước lượng TBT từ PerformanceObserver. Kiểm tra route bảo vệ dùng phiên khách, nên xác nhận redirect và sự vắng mặt của mascot trên luồng khách.

Lượt E2E, axe và đo trình duyệt chưa có kết quả trên máy này. Yêu cầu chạy Next, Fastify, MongoDB tạm và Edge ngoài sandbox bị từ chối. Edge headless cũng thoát ngay khi khởi động trong sandbox.
