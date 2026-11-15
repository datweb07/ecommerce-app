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
