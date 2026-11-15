# 4.U · Theme, cuộn đầu trang và mascot

## Công tắc giao diện

Storefront và admin dùng chung `ThemeToggle`. `next-themes` áp dụng class trên HTML trước khi hydrate, CSS xác định vị trí núm và icon. Sau khi mount, công tắc dùng `resolvedTheme` cho `aria-checked`. Lần bật đầu tiên lưu lựa chọn sáng hoặc tối, sau đó trình duyệt dùng lựa chọn đã lưu.

View Transition dùng snapshot gốc và loang tròn 400 ms từ tâm công tắc. `disableTransitionOnChange` giữ màu nền đổi đồng bộ, còn núm và icon dùng keyframes riêng 240 ms. Nếu trình duyệt thiếu API hoặc bật reduced motion, màu đổi tức thì. [View Transitions](https://developer.mozilla.org/en-US/docs/Web/API/Document/startViewTransition) · [next-themes](https://github.com/pacocoursey/next-themes)
