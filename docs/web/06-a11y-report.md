# 5.4 · Tiếp cận

`pnpm e2e:public` chạy axe WCAG 2.0, 2.1 và 2.2 AA trên Chromium desktop và mobile, light/dark. Báo cáo có 32 bản quét, 0 vi phạm. Kịch bản bao phủ trang chủ, catalogue, kết quả rỗng, chi tiết, sign-in/sign-up fallback và 404. Các bài kiểm tra mở dialog tìm kiếm hoặc bộ lọc, nhấn Escape và kiểm tra trả focus. Bài reflow kiểm tra 320 CSS px và reduced motion. Playwright kiểm tra nút cuộn trả focus về nội dung, chủ đề được giữ và carousel có nút tạm dừng. [Playwright accessibility testing](https://playwright.dev/docs/accessibility-testing)

Nhóm `@auth` có cấu hình axe cho màn hình tài khoản, cart/checkout và các trang admin với storageState theo vai trò. Chưa chạy vì thiếu Clerk development. Chưa kiểm có dữ liệu ở trang chi tiết admin và checkout, dialog private, zoom 200% trên thiết bị thật, đi toàn bộ luồng chỉ bằng bàn phím hoặc với NVDA/VoiceOver. Checklist tay storefront/admin dùng để kiểm tra form, focus và thông báo sau khi có tài khoản test.
