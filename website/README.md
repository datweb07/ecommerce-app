# ShopEase — Web storefront

Workspace độc lập cho customer website. Storefront có catalogue, giỏ hàng, wishlist, tài khoản, địa chỉ, Stripe Checkout, đơn hàng, đánh giá sao và inbox. Xem [kiến trúc frontend và danh sách route](../docs/web/03-frontend-foundation.md).

## Chạy local trong khoảng 10 phút

Chuẩn bị Git, Node >=20.19, pnpm 10.17.1 và Docker Desktop chạy Linux engine. Workspace dùng Node 26.12.1. Catalogue, health, Swagger và seed chạy với cấu hình mặc định. Các route tích hợp cần keys tương ứng trong `.env`.

Tất cả lệnh dưới đây chạy trong `website/`, không chạy script ở root repo:

```powershell
cd D:\ecommerce-app\website
pnpm install --frozen-lockfile
pnpm db:up
pnpm seed
pnpm dev
```

- Web: [localhost:3000](http://localhost:3000).
- Thư viện thành phần ở dev: [/_dev/components](http://localhost:3000/_dev/components).
- Chạy `pnpm --filter @storefront/web smoke:catalogue` sau khi seed và dev đang chạy để kiểm tra các trang công khai. Sau khi điền Clerk và Stripe test keys, dùng checklist để nghiệm thu tài khoản và thanh toán. Xem [tài liệu tính năng](../docs/web/04-storefront-features.md) và [checklist kiểm thử](../docs/web/04-manual-test-checklist.md).
- API live/ready: [health/live](http://localhost:4000/health/live), [health/ready](http://localhost:4000/health/ready).
- OpenAPI: [openapi.json](http://localhost:4000/openapi.json); Swagger UI: [docs/](http://localhost:4000/docs/).
- Ctrl+C dừng các process dev. `pnpm db:down` dừng Mongo và giữ dữ liệu volume.
- Mongo chỉ bind loopback `127.0.0.1:27018`; DB `storefront_web`, replica set `rs0`. Địa chỉ member nội bộ là localhost:27017; app trên host dùng `directConnection=true`. Không expose Mongo này ra internet.

Nếu muốn thay cấu hình, tự sao chép `.env.example` → `website/.env`; chưa cần điền các secret trống. API dùng dotenv với đường dẫn cố định tới file này, cả dev và build. Web dùng `apps/web/.env.local` khi cần; có template `apps/web/.env.example`. Hai nơi không tự kế thừa nhau. Không gửi nội dung `.env` vào chat/log/Git.

```powershell
Copy-Item .env.example .env
# Web đọc các origin và cấu hình Clerk từ file riêng:
Copy-Item apps/web/.env.example apps/web/.env.local
```

## Cấu trúc và kiểm chứng

```text
apps/web/         Next 16.4.3, React 19.3.1, App Router, TypeScript strict
apps/api/         Fastify 5.12.7 factory, Mongo connection, plugins, data tools
packages/shared/ Zod 4 contracts và inferred types, không có secrets/DB imports
scripts/         bootstrap pnpm/runtime và dev process lifecycle trên Windows/Linux
```

```powershell
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

`lint` gồm ESLint và Prettier. `typecheck` kiểm tra cả API tests. `test` dùng MongoMemoryReplSet thật, **không kết nối database dev/legacy**; tải Mongo 8.0.17 lần đầu vào `website/.cache/mongodb` (Windows archive khoảng 756 MB), dữ liệu tạm nằm trong `.cache/` của workspace và được dọn sau test. Cần internet lần đầu và dung lượng trống. Không được coi tests skipped là thành công. Build/typecheck chạy tuần tự để giảm mức dùng tài nguyên.

Root scripts gọi pnpm qua JS entry point vì nested Windows `.cmd` với runtime Node cục bộ có thể resolve sai đường dẫn. Không cần cài Node mới toàn máy. `.gitignore` loại `.env*`, `.cache`, `node_modules`, `dist`, `.next` và cho phép `.env.example`.

Next 16 dùng `src/proxy.ts` để bảo vệ route riêng tư. Dependencies pin exact cùng `pnpm-lock.yaml`. TypeScript 6.0.3 nằm trong peer range của parser `typescript-eslint`. ESLint 10 dùng plugin Next.js, React Hooks và bộ rule jsx-a11y. jsx-a11y 6.10.2 mới nhất khai báo peer đến ESLint 9, nên đã kiểm chứng trực tiếp với ESLint 10 qua lượt lint toàn workspace.

Sau khi seed và để `pnpm dev` chạy, mở terminal khác để chạy smoke HTTP, CORS, OpenAPI, Playwright và axe. Mặc định dùng Microsoft Edge đã cài. Đặt `SMOKE_BROWSER_CHANNEL=chrome` nếu muốn dùng Chrome.

```powershell
pnpm --filter @storefront/web smoke
```

Ảnh lưu trong `.cache/web-smoke/`. Khi Web và API dùng port/domain khác, cập nhật `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`, `API_INTERNAL_URL`, `WEB_ORIGIN` và `CORS_ORIGINS` ở đúng file mẫu. Đặt `SMOKE_SITE_URL` và `SMOKE_API_URL` tương ứng khi chạy smoke.

## Quản trị

Đặt `ADMIN_EMAIL` ở cấu hình API theo email chính đã xác minh trên Clerk. Đăng nhập bằng tài khoản đó rồi mở [localhost:3000/admin](http://localhost:3000/admin). Tài khoản thiếu quyền nhận 404 ở giao diện và 403 ở API. Xem [hướng dẫn quản trị](../docs/web/05-admin-frontend.md), [checklist kiểm thử thật](../docs/web/05-admin-manual-test-checklist.md), [Swagger local](http://localhost:4000/docs/) và [hợp đồng Admin API](../docs/web/05-admin-api.md).

Cloudinary web cần Dynamic Folders và các biến `CLOUDINARY_*` trong file mẫu API để ký và xác minh ảnh. Đặt `WEB_ORIGIN` trùng origin của `NEXT_PUBLIC_SITE_URL` để chấp nhận đích banner tuyệt đối cùng origin. Banner API và catalogue trang chủ có TTL 60 giây.

Chạy `pnpm build` rồi `pnpm --filter @storefront/web smoke:admin` để kiểm tra redirect trên bản production cục bộ, axe và chụp các trang quản trị bằng dữ liệu fixture trong trình duyệt. Ảnh nằm ở `.cache/admin/`. Dùng tài khoản thật theo checklist để nghiệm thu Clerk và Cloudinary.

## Seed và import products

`pnpm seed` tạo **8 sản phẩm / 4 categories** (Electronics, Fashion, Sports, Accessories) và **3 banner mẫu** liên kết các danh mục tương ứng. Ảnh banner trong `apps/web/public/banners` lấy từ ảnh sản phẩm mẫu. ID ổn định, `$setOnInsert` giữ các bản ghi bạn đã sửa. Giá theo major USD như legacy. Chưa tạo users/orders/reviews giả.

Import tùy chọn: tự điền `LEGACY_PRODUCTS_URI` trong `.env`, dùng Mongo account **chỉ có quyền read trên database nguồn**. Không dùng credentials readWrite. Script chỉ thực hiện `find` với projection trên collection products; không tạo model/index/migration trên nguồn. Không có dữ liệu production nào được import tự động.

```powershell
# Mặc định dry-run, tối đa 1000 records, chỉ in số lượng:
pnpm import:products
# Ghi vào local storefront_web sau khi tự kiểm tra dry-run:
pnpm import:products -- --write --limit=1000
```

Đích seed/import bị giới hạn cứng: `mongodb://localhost:<port>/storefront_web` hoặc `127.0.0.1`, không user/password và không remote/SRV. Import giữ `_id`, timestamps và fields tương thích; loại field ngoài allowlist, đếm record không hợp lệ, không overwrite target trùng ID. `--limit` từ 1–10000; chạy lại với cùng limit không duplicate. Chỉ copy products, không copy quan hệ/users/cart/orders/reviews; `averageRating`/`totalReviews` được giữ như snapshot nguồn, chưa có review detail tương ứng trong DB web. Khi cần refresh các aggregate này phải có quyết định riêng.

## API nền tảng

| Route             | Hành vi                                |
| ----------------- | -------------------------------------- |
| GET /health/live  | 200 khi process sẵn sàng phục vụ       |
| GET /health/ready | ping Mongo, 200 hoặc 503 theo kết nối  |
| GET /openapi.json | spec sinh từ Zod, chỉ development/test |
| GET /docs/        | Swagger UI, chỉ development/test       |

Response API có `x-request-id`. Lỗi theo dạng `{error:{code,message},requestId}`. Access log bỏ query string và redact authorization/cookie/set-cookie. Body tối đa 1 MiB. Rate limit mặc định 100 request/phút/IP, checkout có hạn mức riêng. Private API dùng Clerk Bearer JWT. Cấu hình exact origins qua `CORS_ORIGINS`. API tạo index additive và đóng connection khi shutdown.

## Chuẩn bị nghiệm thu Clerk và Stripe ở Giai đoạn 5

Tự điền secret trong file local, không commit:

| Dịch vụ / nơi lấy                                                  | API website/.env                                                 | Web apps/web/.env.local                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------- |
| Clerk Dashboard → API keys, **cùng application mobile**            | CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY                          | NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY |
| Clerk Dashboard → Webhooks → endpoint web mới                      | CLERK_WEBHOOK_SIGNING_SECRET                                     | —                                                   |
| Clerk/đơn vị vận hành xác định admin                               | ADMIN_EMAIL (identity verified)                                  | —                                                   |
| Stripe Dashboard → **account riêng cho web, test mode** → API keys | STRIPE_SECRET_KEY (`sk_test_...`)                                | Hosted Checkout không cần public Stripe key         |
| Stripe CLI local listener                                          | STRIPE_WEBHOOK_SECRET                                            | —                                                   |
| Cloudinary Console → API keys                                      | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | —                                                   |

Có thể để trống integration keys tới khi thử tính năng tương ứng. Stripe nhận test key. Giá checkout mặc định `CURRENCY=usd`, `SHIPPING_FEE_CENTS=1000`, `TAX_RATE=0.08`. TAX_RATE là tỷ lệ từ 0 đến 1. Checkout dùng USD để khớp cách lưu giá legacy.

Điền cả hai khóa Clerk của web để thử đăng nhập, UserButton và Bearer đến API. Khi cả hai khóa trống, website có chế độ xem trước công khai và các route private vẫn chuyển sang trang đăng nhập.

## Stripe CLI — dùng từ Giai đoạn 2

Cài Stripe CLI theo [tài liệu chính thức](https://docs.stripe.com/stripe-cli/install), đăng nhập **web test account**, chạy:

```powershell
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://localhost:4000/api/v1/webhooks/stripe
```

Dùng signing secret của CLI cho `STRIPE_WEBHOOK_SECRET` rồi restart API. Quy trình thử session thật, thẻ test và replay nằm trong [hướng dẫn Stripe cục bộ](../docs/web/stripe-local-testing.md).

## Troubleshooting và giới hạn hiện tại

- Mongo chưa chạy: API fail fast, không chuyển sang database legacy. Kiểm tra Docker Desktop, `docker compose ps`, `docker compose logs mongo`.
- Nếu Docker báo `metadata.db: input/output error`, kiểm tra dung lượng ổ lưu Docker và tình trạng Docker Desktop. Không dùng prune/reset xóa dữ liệu tùy tiện.
- Nếu container báo `exec format error`, xem log trước khi sửa healthcheck. Ngày 28/10/2026, image Mongo 8.0.17 trong cache có entrypoint 0 byte và libcurl bị cắt cụt, dù kiến trúc đúng amd64. Đã chuyển sang Mongo 8.0.34 pin digest trong Compose; `pnpm db:up` đã chạy thành công, container healthy và `rs0` có PRIMARY. Thay container giữ nguyên volume, không cần `down -v`/prune/reset. Hãy giữ đủ dung lượng ổ lưu Docker.
- API startup chỉ in tên biến sai hoặc thông báo connection chung; không in giá trị. `PORT` phải là integer 1–65535, CORS phải exact origin (không trailing path).
- Test tích hợp dùng adapter thử ở ranh giới Clerk/Stripe. Giao diện nghiệp vụ và CI/CD thuộc các giai đoạn sau.

Danh sách route, tài liệu từng module và các giới hạn vận hành nằm trong [API backend Giai đoạn 2](../docs/web/02-backend-api.md). Upload Cloudinary dùng dynamic folder mode. Hợp đồng ký upload và giới hạn dung lượng được ghi trong [tài liệu Admin](../docs/web/02-7-admin.md).
