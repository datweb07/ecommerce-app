# 5.1 · Nền tảng Playwright

Chạy từ `website/`. `pnpm e2e` chọn các nhóm đủ biến. `pnpm e2e:public`, `pnpm e2e:auth`, `pnpm e2e:payment` và `pnpm e2e:upload` chạy từng nhóm. Thêm `--list` để xem project/test mà không khởi động dịch vụ. `pnpm e2e:env` chỉ in tên biến và trạng thái có/không của môi trường tiến trình.

## Chuẩn bị trình duyệt

```powershell
$env:PLAYWRIGHT_BROWSERS_PATH = Join-Path (Get-Location) '.cache/playwright'
pnpm --filter @storefront/web exec playwright install chromium firefox webkit
pnpm e2e:public
```

Nhóm public có Chromium desktop/mobile, Firefox và WebKit. Nhóm auth có Chromium desktop/mobile. Payment và upload dùng Chromium desktop. Runner ghi screenshot và video khi có lỗi, trace khi retry lần đầu. CI thử lại một lần. Báo cáo HTML và artifacts trong `.cache/e2e/<id>/` có thể chứa dữ liệu phiên test và cần giữ nội bộ.

## Dữ liệu và rào chắn

Playwright quản lý một webServer. Harness tạo MongoMemoryReplSet trên loopback với database `web_e2e` mới cho mỗi lượt, seed 24 sản phẩm và ba banner, rồi chạy Fastify ở `127.0.0.1:39421`. Next build và start ở `localhost:39420` dùng bản sao source/config vào cache riêng. Bản sao loại file env và dùng đối số môi trường đã chọn lọc. Cách này cho test production thật mà vẫn tách build và env của ứng dụng đang chạy. Runner không kết nối Mongo ngoài loopback hoặc tái sử dụng server có sẵn. [Playwright webServer](https://playwright.dev/docs/test-webserver)

Khóa Clerk hoặc Stripe live bị từ chối kể cả khi chọn public. Lệnh hiện chỉ quản lý hai origin loopback cố định. Clerk chỉ nhận khóa test và domain development chính thức. Cloudinary chỉ được bật cho cloud test xác nhận qua `E2E_CLOUDINARY_CLOUD_NAME`. Suite nền chưa tạo ảnh hoặc giao dịch.

| Nhóm    | Biến cần truyền sẵn trong tiến trình                                                                                   |
| ------- | ---------------------------------------------------------------------------------------------------------------------- |
| Public  | Không cần khóa dịch vụ ngoài                                                                                           |
| Auth    | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`                                |
| Payment | Các biến Auth cùng `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`                                                        |
| Upload  | Các biến Auth cùng `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `E2E_CLOUDINARY_CLOUD_NAME` |

Dùng Clerk SDK chính thức để tạo bốn user development với email test ngẫu nhiên. Hai khách chạy kịch bản giỏ hàng song song. User `payer` có giỏ riêng cho Stripe. Email chính đã xác minh của user admin được truyền làm `ADMIN_EMAIL` riêng cho Fastify E2E. Clerk Playwright đăng nhập bằng ticket và lưu storageState theo vai trò. Runner đối chiếu external ID, metadata và email E2E trước khi xóa user được tạo. Mongo tạm, storageState và bản sao build được dọn khi kết thúc. Google SSO cần kiểm tay. [Clerk Playwright](https://clerk.com/docs/guides/development/testing/playwright/test-helpers)

## Luồng kiểm từ 5.2

| Tag        | Phạm vi                                                                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@public`  | Banner đổi tự động, tạm dừng và đến đúng danh mục. Bộ lọc, sort, phân trang, Back/Forward, metadata, JSON-LD, 404, sitemap, robots, guard khách và tuỳ chọn giao diện. Kiểm tra HTTP bảo mật và axe public nằm trong cùng lệnh. |
| `@auth`    | Khôi phục Clerk storageState, Bearer, quyền admin, thêm giỏ từ trang sản phẩm, cùng giỏ qua hai context, quyền sở hữu địa chỉ và giỏ, mutation wishlist, axe storefront riêng tư và admin.                                      |
| `@payment` | Tạo phiên hosted Stripe test, đọc lại chính session từ Stripe, mô phỏng completion đã ký trong E2E, kiểm tra return phản ánh trạng thái từ API, replay, đơn, giỏ, tồn kho và dọn phiên Stripe.                                  |
| `@upload`  | Kiểm tra phiên admin, ký và tải PNG vào cloud test đã xác nhận, tạo/sửa sản phẩm, điều chỉnh tồn, đọc trang public và dọn theo public ID do chính phiên test cấp.                                                               |

Nhóm payment mô phỏng sự kiện trên Checkout Session test còn mở. Kịch bản kiểm thêm quyền sở hữu, hai bước giao hàng, thông báo, xóa review và snapshot sau khi admin xóa sản phẩm. Thẻ test thành công hoặc bị từ chối, thao tác hủy hosted Checkout và Google SSO có checklist riêng. API integration với MongoDB thật và provider mock tạo bằng chứng cho tranh tồn, webhook lặp/sai chữ ký và vòng đời đơn. Các thao tác admin banner và toàn bộ vòng đời đơn vẫn cần chạy liền mạch qua tài khoản test trước khi phát hành. [Checklist storefront](04-manual-test-checklist.md) · [Checklist admin](05-admin-manual-test-checklist.md)

Kết quả 5.2–5.5 gồm 58 test Playwright public, 32 bản quét axe public không có vi phạm và 148 test Vitest trên 32 suite. Nhóm auth, payment và upload chưa chạy vì môi trường tiến trình thiếu biến test. Báo cáo riêng ghi kết quả Lighthouse và bảo mật. [Hiệu năng](06-performance-report.md) · [Tiếp cận](06-a11y-report.md) · [Bảo mật](06-security-review.md)

## Kết quả 5.1

- `pnpm lint` và `pnpm typecheck` đạt. `pnpm test --maxWorkers=1` đạt 145 test trên 32 suite, không skip.
- `pnpm e2e` build shared, API và Next production trong harness rồi chạy thành công 4 smoke test public trên Chromium desktop/mobile, Firefox và WebKit. Mỗi project kiểm tra API có 24 sản phẩm seed, trang chủ hiển thị vùng banner và `/_dev/components` trả 404 ở production.
- Auth, payment và upload chưa chạy vì tiến trình chưa có các biến test trong bảng trên. Nhóm public tự khởi động mà không cần các dịch vụ đó.
