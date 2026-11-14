# Giai đoạn 3 · Nền tảng frontend

## Cấu trúc

| Thư mục                              | Trách nhiệm                                                                                |
| ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `apps/web/src/app`                   | App Router, metadata, route groups `(auth)` và `(private)`, loading và error boundaries    |
| `src/components/ui`                  | Thành phần shadcn với Radix, Tailwind và CSS tokens. Cấu hình CLI nằm ở `components.json`. |
| `src/components/layout`              | Header SSR, drawer, footer, điều hướng tài khoản và providers                              |
| `src/components/common`              | Các trạng thái trang, giá, thẻ sản phẩm, số lượng, rating và xác nhận                      |
| `src/config`, `src/hooks`, `src/lib` | Env đã validate, URL state, auth, API client, query keys, tiền tệ và từ điển               |
| `packages/shared`                    | Schema Zod và DTO dùng chung với Fastify                                                   |

Next.js 16.4.3 dùng `src/proxy.ts`. Khi thêm trang động, khai báo `params` và `searchParams` là Promise rồi await ở server. Request APIs `cookies()` và `headers()` cũng bất đồng bộ. Font Inter Latin và Vietnamese được bundle qua `next/font/local` từ dependency đã pin, nên build chạy được khi không truy cập Google Fonts.

## Routes

| Loại                 | Routes                                                                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Công khai            | `/`, `/products`, `/products/[id]`, `/sitemap.xml`, `/robots.txt`                                                                                                                                     |
| Xác thực             | `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]`                                                                                                                                                  |
| Phiên Clerk bắt buộc | `/cart`, `/wishlist`, `/checkout`, `/checkout/return`, `/account`, `/account/profile`, `/account/addresses`, `/account/orders`, `/account/orders/[id]`, `/account/notifications`, `/account/security` |
| Dev                  | `/_dev/components` được định tuyến qua `page.dev.tsx`. Production loại route ở bước build.                                                                                                            |

Proxy kiểm session trên route private và gửi khách chưa đăng nhập đến sign-in với `redirect_url` cùng origin, gồm cả đường dẫn và query. Route private render động, có metadata noindex và gửi `Cache-Control: private, no-store` cùng `X-Robots-Tag`. Sổ sitemap hiện có hai URL tĩnh. Header/footer và tất cả trang placeholder tải được ở chế độ public preview khi cả hai Clerk key trống. Khai báo một key thiếu key còn lại làm server báo lỗi tên biến.

## Lấy dữ liệu và cache

- Server Components gọi `serverApi` trong `src/lib/api/server.ts`. `apiFetch` dùng `API_INTERNAL_URL`. Catalogue gắn tag `catalogue`, categories có thêm tag `categories` và TTL 60 giây. Request ID khác nhau trên từng fetch tạo cache key khác nhau trong Next, vì vậy GET cache được để Fastify tự sinh request ID. Header SSR gọi categories, khi API lỗi vẫn có link Sản phẩm và ô tìm kiếm.
- Client Components trong Clerk Provider dùng `useApiClient()`. Fetch tới `NEXT_PUBLIC_API_URL`, gửi Clerk Bearer và `X-Request-Id`, không gửi credential cookie. Sau 401, gọi `getToken({ skipCache: true })` một lần trước khi điều hướng đăng nhập. Toàn bộ request private đặt `no-store`. QueryClient được tạo lại khi session đổi, queries mặc định stale sau 30 giây, retry tối đa một lần với lỗi ngoài 4xx. Header lấy số lượng cart và unread sau đăng nhập. Badge thông báo poll mỗi 60 giây khi tab mở.
- Client dùng `z.input` cho input và parse DTO thành công ở mọi môi trường. Checker OpenAPI chỉ đối chiếu route, method và status thành công cho 30 thao tác customer. Backend và frontend dùng trực tiếp cùng schema, nên kiểm tương đương JSON Schema từng field sẽ lặp lại hợp đồng. `ApiError` giữ code/status/details/requestId, còn nội dung hiển thị dùng thông báo tiếng Việt từ `apiErrorMessage` hoặc `toastApiError`. Chỉ hiển thị request ID cho dev. Boundary log định danh lỗi, không đưa stack ra UI.
- Khi thay đổi cart ở Giai đoạn 4, lưu version trả về từ API. Checkout gửi `{addressId, version}`, nhận quote cents, giữ nguyên UUID Idempotency-Key qua các lần retry của cùng thao tác và poll session sau redirect. Trạng thái session gồm pending, paid, expired, failed. API trả `requiresReconciliation` khi cần đối soát. Giá catalogue/cart/order dùng major USD. Quote dùng số nguyên cents. `Price` hỗ trợ cả hai và nhận currency từ config hoặc DTO, hiện chỉ chấp nhận usd theo API.
- URL filter/pagination có thể dùng `toSearchParams(await searchParams)` ở server hoặc `useUrlState()` ở client. Catalogue/orders/wishlist dùng page/limit như shared. Inbox dùng cursor. Xem [danh sách API](02-backend-api.md).

## Thêm trang hoặc thành phần

1. Thêm `page.tsx` trong `app/` hoặc trong route group private. Dùng `PageContainer`, `PageHeader`, Breadcrumb và skeleton cùng dạng với nội dung.
2. Đặt phần tương tác nhỏ nhất trong Client Component. Với biểu mẫu, dùng `useZodForm` và schema ở shared. Với query private, dùng factory `queryKeys` để mutation có thể invalidate cùng khóa.
3. Đặt nhãn nhóm theo namespace trong `lib/i18n.ts` và dùng `t()` ở cả server lẫn client. Website chỉ phát hành tiếng Việt ở giai đoạn này nên từ điển không cần prefix locale hay middleware định tuyến.
4. Dùng token semantic của light/dark và ring focus có sẵn. Mở `/_dev/components` để xem các biến thể. Thêm test bàn phím khi thêm điều khiển mới.

## Xác minh và phạm vi tiếp theo

- `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm build` đều đạt. Vitest chạy 70 test trong 13 suite, gồm 17 test web trong 3 suite, không skip. Next 16.4.3 in bảng route và không in số đo bundle theo route.
- Smoke production xác nhận `/_dev/components` trả HTTP 404 và manifest không có route này. Smoke với upstream không khả dụng xác nhận SSR vẫn render điều hướng fallback.
- Playwright Edge chạy HTTP và axe trên desktop 1440×920 và mobile 390×844, ở light/dark. Kiểm tra drawer đóng bằng Escape và trả focus về nút mở. Ảnh lưu trong `website/.cache/web-smoke`.
- Smoke kiểm SSR, dữ liệu categories từ Mongo dev, 404, redirect có return URL, robots/sitemap, OpenAPI và CORS preflight với Authorization, X-Request-Id và Idempotency-Key. CORS cho phép đúng web origin và từ chối origin ngoài danh sách.
- Đăng nhập Clerk thật, UserButton và Bearer đến GET /me cần cặp key của cùng ứng dụng đã dùng trên mobile. Dùng tài khoản thử trước khi làm luồng tài khoản ở Giai đoạn 4.
- Giai đoạn 4 điền dữ liệu và tương tác nghiệp vụ vào các route placeholder. CSP chuyển sang Giai đoạn 5 để kiểm chứng với Clerk và hosted Stripe. Giai đoạn 5 cũng thực hiện Lighthouse, luồng có đăng nhập và kiểm tra khả năng tiếp cận toàn luồng.

Tài liệu chính thức: [Next.js 16 Proxy](https://nextjs.org/docs/app/api-reference/file-conventions/proxy), [Clerk cho Next.js](https://clerk.com/docs/reference/nextjs/clerk-middleware), [shadcn và Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4).
