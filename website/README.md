# ShopEase — Web storefront

Workspace độc lập cho customer website. Giai đoạn 1 chỉ có nền tảng, trang Next tối thiểu, health/OpenAPI và công cụ dữ liệu. Chưa có đăng nhập, catalogue API hay thanh toán. Không dùng code từ `backend/`, `mobile/`, `admin/`.

## Chạy local trong khoảng 10 phút

Chuẩn bị Git, Node >=20.19 để bootstrap, pnpm 10.17.1 và Docker Desktop **đang chạy Linux engine**, ổ đĩa còn dung lượng. Runtime Node 26.12.1 được cài riêng trong workspace; không đổi Node của app cũ. Lần đầu tải dependencies/image có thể lâu hơn tùy mạng. Chưa cần Clerk/Stripe/Cloudinary keys.

Tất cả lệnh dưới đây chạy trong `website/`, không chạy script ở root repo:

```powershell
cd D:\ecommerce-app\website
pnpm install --frozen-lockfile
pnpm db:up
pnpm seed
pnpm dev
```

- Web: [localhost:3000](http://localhost:3000).
- API live/ready: [health/live](http://localhost:4000/health/live), [health/ready](http://localhost:4000/health/ready).
- OpenAPI: [openapi.json](http://localhost:4000/openapi.json); Swagger UI: [docs/](http://localhost:4000/docs/).
- Ctrl+C dừng các process dev. `pnpm db:down` dừng Mongo và giữ dữ liệu volume.
- Mongo chỉ bind loopback `127.0.0.1:27018`; DB `storefront_web`, replica set `rs0`. Địa chỉ member nội bộ là localhost:27017; app trên host dùng `directConnection=true`. Không expose Mongo này ra internet.

Nếu muốn thay cấu hình, tự sao chép `.env.example` → `website/.env`; chưa cần điền các secret trống. API dùng dotenv với đường dẫn cố định tới file này, cả dev và build. Web dùng `apps/web/.env.local` khi cần; có template `apps/web/.env.example`. Hai nơi không tự kế thừa nhau. Không gửi nội dung `.env` vào chat/log/Git.

```powershell
Copy-Item .env.example .env
# Khi đến phần tích hợp frontend Clerk:
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

Next 16 dùng convention `src/proxy.ts` khi thêm Clerk guard ở giai đoạn frontend; hiện chưa thêm proxy/auth giả. Dependencies pin exact cùng `pnpm-lock.yaml`. TypeScript 6.0.3 là ngoại lệ tương thích: parser `typescript-eslint` mới nhất hiện yêu cầu TS <6.1; TS stable 7 chưa phù hợp. ESLint 10 dùng `@next/eslint-plugin-next` chính thức và React Hooks plugin trực tiếp để tránh peer constraints cũ của bộ `eslint-config-next` đầy đủ.

## Seed và import products

`pnpm seed` tạo **8 sản phẩm / 4 categories** (Electronics, Fashion, Sports, Accessories), ảnh HTTPS Unsplash. ID ổn định, `$setOnInsert`: chạy lại không tăng bản sao và không ghi đè stock/name bạn đã sửa. Giá theo major USD như legacy. Chưa tạo users/orders/reviews giả.

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

Mọi response có `x-request-id`. Header client chỉ được dùng nếu 8–64 ký tự an toàn; còn lại sinh UUID. Error: `{error:{code,message},requestId}`, không có stack/raw validation payload. Lỗi nội bộ không log object chứa URI/secrets; access log bỏ query string, redact authorization/cookie/set-cookie. Body tối đa 1 MiB; rate limit mặc định 100 request/phút/IP, health được miễn để probe không gây false failure. Chưa trust proxy tùy ý; phải cấu hình proxy cụ thể khi deploy. CORS exact origins qua `CORS_ORIGINS`, không wildcard, Bearer auth sẽ được thêm ở Giai đoạn 2. DB autoCreate/autoIndex tắt, close hook dọn connection, SIGINT/SIGTERM đóng app.

## Chuẩn bị trước Giai đoạn 2

Tự điền secret trong file local, không commit:

| Dịch vụ / nơi lấy                                                  | API website/.env                                                 | Web apps/web/.env.local                             |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------- |
| Clerk Dashboard → API keys, **cùng application mobile**            | CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY                          | NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY |
| Clerk Dashboard → Webhooks → endpoint web mới                      | CLERK_WEBHOOK_SIGNING_SECRET                                     | —                                                   |
| Clerk/đơn vị vận hành xác định admin                               | ADMIN_EMAIL (identity verified)                                  | —                                                   |
| Stripe Dashboard → **account riêng cho web, test mode** → API keys | STRIPE_SECRET_KEY (`sk_test_...`)                                | Hosted Checkout không cần public Stripe key         |
| Stripe CLI local listener                                          | STRIPE_WEBHOOK_SECRET                                            | —                                                   |
| Cloudinary Console → API keys                                      | CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET | —                                                   |

Giai đoạn 1 cho phép bỏ trống các integration keys, không khởi tạo SDK giả. Nếu nhập Stripe live key, env validation từ chối ngay. `CURRENCY=usd`, `SHIPPING_FEE_CENTS=1000`, `TAX_RATE=0.08`; TAX_RATE là tỷ lệ 0–1, không phải số phần trăm 8. Đổi currency sau này cần xác nhận lại đơn vị giá/rounding; chưa có payment implementation.

## Stripe CLI — dùng từ Giai đoạn 2

Cài Stripe CLI theo [tài liệu chính thức](https://docs.stripe.com/stripe-cli/install), đăng nhập **web test account**, chạy:

```powershell
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://localhost:4000/api/v1/webhooks/stripe
```

Tự copy signing secret `whsec_...` CLI cung cấp vào STRIPE_WEBHOOK_SECRET rồi restart API. Secret CLI khác secret endpoint Dashboard. Giai đoạn 1 route webhook **chưa tồn tại, sẽ trả 404**. Sau Giai đoạn 2, tạo Checkout session thật từ web API test, hoàn tất bằng [test payment methods](https://docs.stripe.com/testing), đối chiếu webhook với order và thử replay cùng event để chứng minh không duplicate. Event giả bằng `stripe trigger checkout.session.completed` chỉ kiểm tra delivery/signature, không thay cho checkout có ID/metadata hợp lệ của hệ thống.

## Troubleshooting và giới hạn hiện tại

- Mongo chưa chạy: API fail fast, không chuyển sang database legacy. Kiểm tra Docker Desktop, `docker compose ps`, `docker compose logs mongo`.
- Nếu Docker báo `metadata.db: input/output error`, kiểm tra dung lượng ổ lưu Docker và tình trạng Docker Desktop. Không dùng prune/reset xóa dữ liệu tùy tiện.
- Nếu container báo `exec format error`, xem log trước khi sửa healthcheck. Ngày 28/10/2026, image Mongo 8.0.17 trong cache có entrypoint 0 byte và libcurl bị cắt cụt, dù kiến trúc đúng amd64. Đã chuyển sang Mongo 8.0.34 pin digest trong Compose; `pnpm db:up` đã chạy thành công, container healthy và `rs0` có PRIMARY. Thay container giữ nguyên volume, không cần `down -v`/prune/reset. Hãy giữ đủ dung lượng ổ lưu Docker.
- API startup chỉ in tên biến sai hoặc thông báo connection chung; không in giá trị. `PORT` phải là integer 1–65535, CORS phải exact origin (không trailing path).
- Có thể build/test foundation mà không có Clerk/Stripe/Cloudinary account. Các module nghiệp vụ, CI/CD và deploy chưa thuộc Giai đoạn 1.

Quyết định/biên bản nghiệm thu chi tiết: [docs/web/01-foundation.md](../docs/web/01-foundation.md). **Dừng sau Giai đoạn 1; chờ duyệt trước Giai đoạn 2.**
