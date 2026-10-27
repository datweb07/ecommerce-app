# Giai đoạn 1 — Nền tảng website

Ngày: 27/10/2026. Phạm vi: chỉ `website/` và `docs/web/`; không sửa/chạy build/script của ba ứng dụng cũ hay repo root. Không đọc/in `.env` thật, không kết nối DB production, không chạy migration/index sync chung. Tài liệu Giai đoạn 0 là snapshot lịch sử; quyết định dưới đây ghi đè các mặc định ban đầu.

## Quyết định đã được duyệt

1. Cùng Clerk application với mobile. **Dev/test MongoDB riêng**, Compose replica set; production chưa quyết định, sẽ cấu hình MONGODB_URI sau. Seed 8 products có ảnh và import products tùy chọn từ nguồn read-only sang DB web local; không copy code backend cũ.
2. Stripe Checkout hosted, **test account riêng cho web**, không COD. USD/ship $10/thuế 8% qua CURRENCY/SHIPPING_FEE_CENTS/TAX_RATE. Production bắt buộc Stripe account tách biệt; không thể cách ly event chỉ bằng API key/webhook secret khác trên cùng account.
3. Admin chỉ GET orders, PATCH status tiến và POST upload signature; không CRUD products/customers/stats/moderation/dashboard mới.
4. Notifications shipped/delivered với read-state riêng + polling; không Web Push/email/CDC.
5. Không hủy đơn; review chỉ sao, thêm sửa/xóa trên web. Dùng Clerk security thật, không port mock activity/export/2FA.
6. Ưu tiên checkout/inventory đơn giản, bắt buộc không oversell/duplicate trong phạm vi API web. **Chưa chốt outbox/worker/ledger phức tạp**; ở Giai đoạn 2 phải chứng minh cơ chế tối thiểu bằng race/idempotency/expiry tests rồi ghi 2–3 dòng nếu cần tăng độ phức tạp. Không dựng các cơ chế này ở Giai đoạn 1.

## Những gì đã tạo

- pnpm workspace cục bộ, strict TypeScript (kể cả exact optional/no unchecked index), exact dependency versions + lockfile, ESLint/Prettier và scripts dev/lint/typecheck/test/build.
- Next App Router tối thiểu: server page và root layout tiếng Việt, local CSS, metadata noindex trong giai đoạn nền tảng; Cloudinary/Unsplash image allowlist. Chưa có UI/auth/business modules.
- Shared Zod health/error response types và product interchange schema phục vụ data tools; chưa định nghĩa giả hợp đồng nghiệp vụ.
- Fastify app factory không listen khi import; CORS whitelist, helmet, sensible, rate limit, body cap, request-id, sanitized logger/error handler, Swagger Zod validation/serialization, OpenAPI và health live/ready. DB connection riêng mỗi app, autoCreate/autoIndex tắt, đóng theo Fastify close hook; graceful shutdown ở server entry.
- Compose Mongo 8.0.17 replica set `rs0`, local 27018, healthcheck khởi tạo idempotent; volume dành riêng cho website. Host URI có directConnection=true để dùng localhost mapping.
- Env loader đọc duy nhất website/.env khi chạy app/data tools, không quét env của ứng dụng cũ. Templates có chú thích, keys phase 2 optional; Stripe live key bị từ chối. Browser env template tách theo convention Next.
- Seed idempotent `$setOnInsert`, không reset stock đã sửa. Import mặc định dry-run, nguồn chỉ find/projection, target hard-guard local storefront_web, giữ _id, không overwrite và không migration. Không chạy import từ legacy thật.
- Tests Vitest + MongoMemoryReplSet, request injection và transaction rollback. Mongo binary và dbPath test nằm trong `.cache` workspace, không phụ thuộc C:/Temp hoặc DB dev. Không bỏ tests để báo xanh.

## Phiên bản và kiểm tra API thực tế

Registry stable đã kiểm tra trực tiếp tại lúc tạo workspace; exact versions được pin trong manifests và lockfile:

| Thành phần | Version |
| --- | --- |
| Node workspace runtime | 26.12.1 (cục bộ, global Node 20.19.6 không đổi) |
| pnpm | 10.17.1 (packageManager pin, dùng bản bootstrap hiện có) |
| Next / React / React DOM | 16.4.3 / 19.3.1 / 19.3.1 |
| Fastify / Mongoose | 5.12.7 / 9.11.4 |
| Zod / official Zod provider | 4.6.7 / @fastify/type-provider-zod 1.0.3 |
| Swagger / Swagger UI | 9.9.2 / 6.1.2 |
| ESLint / TS parser | 10.13.0 / typescript-eslint 8.72.1 |
| TypeScript | 6.0.3 |
| Vitest / mongodb-memory-server / tsx | 5.0.5 / 11.3.0 / 4.23.15 |

Ngoại lệ TS: registry trả stable 7.0.2 nhưng parser mới nhất có peer `<6.1.0`; chọn stable mới nhất **tương thích** 6.0.3. Không che peer warning hoặc dùng @ts-ignore. Bộ eslint-config-next đầy đủ còn kéo các plugin chỉ hỗ trợ ESLint <=9; ESLint 9 đã deprecated, nên dùng Next official plugin và React Hooks plugin tương thích ESLint 10 trực tiếp. Chưa thêm package nghiệp vụ Clerk/Stripe/Cloudinary/RHF/Query/Tailwind khi chưa sử dụng.

Đã đọc exports/typings `@fastify/type-provider-zod/dist/esm/index.d.ts`, errors.d.ts, package peer constraints; dùng đúng validatorCompiler/serializerCompiler/jsonSchemaTransform/hasZodFastifySchemaValidationErrors. Đọc Next package 16.4.3, config typings và [Next Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy): Next 16 dùng proxy.ts; chưa cần proxy vì chưa có auth routes. Đã chạy Next typegen/build thực.

## Lý do cho các lựa chọn bổ sung

- Runtime Node cục bộ: Vitest 5 yêu cầu Node mới hơn global 20. Không đổi máy/toàn repo, dùng package Node exact và để scripts chạy runtime của workspace. Helper pnpm.mjs gọi JS entry bằng process.execPath để tránh nested Windows .cmd resolve nhầm runtime.
- Mongo replica set trong test: transaction thật cần replica set; inject + mock DB không chứng minh được rollback. Một instance tạm là đủ, không thêm hạ tầng bên ngoài. Test dbPath trên workspace giảm phụ thuộc dung lượng system temp.
- Không outbox/worker/payment ledger ở đây: chưa có nghiệp vụ cần chúng. Các yêu cầu checkout giữ trong kế hoạch Giai đoạn 2, lựa chọn cụ thể dựa vào failure cases có test, không xây trước.

## Kiểm chứng và giới hạn máy chạy

Kết quả các gates cuối cùng và smoke được ghi ở cuối tài liệu sau khi chạy. Trong quá trình sửa đã gặp và xử lý:

- CORS wildcard invalid làm URL refine ném exception trước env error sanitize → sửa refine total function và có regression test.
- Test phát hiện ổ C không còn dung lượng: native Mongo báo `No space left on device` khi ghi journal trong C:/Temp. Chuyển **test** dbPath vào workspace trên D, cache WiredTiger test 0.25 GiB; không thay đổi temp toàn hệ thống.
- Build/typecheck song song gặp lỗi cấp phát bộ nhớ; chuyển package builds/typechecks tuần tự. Build thực sau đó thành công.
- Docker CLI/engine 29.1.3 có thể chạy và pull image, nhưng `docker compose up -d --wait` thất bại lúc create container do `...overlayfs/metadata.db: input/output error`. Không prune/reset/move Docker data của người dùng. Compose config check hợp lệ; **chưa thể xác nhận Compose runtime** trên máy này cho đến khi ổ lưu Docker có dung lượng/engine khỏe.

## Chuẩn bị Giai đoạn 2

Xem [website README](../../website/README.md) và `.env.example` để tự điền Clerk cùng application, webhook Svix endpoint web riêng, verified admin email, Stripe account riêng chỉ test key/CLI webhook secret, Cloudinary keys. Credentials không cần cho Giai đoạn 1. Không yêu cầu gửi keys vào chat.

API mới hiện chỉ có health/docs, không có business routes. Stripe CLI guide đã chuẩn bị nhưng webhook path trả 404 cho đến Giai đoạn 2. Không triển khai go-live và chưa quyết định production database.

## Go-live checklist ban đầu (chưa thực hiện)

- [ ] Quyết định MONGODB_URI production, inventory ownership, legacy concurrency risks nếu chung DB; không migrate shared DB khi chưa duyệt.
- [ ] **Stripe production account riêng với mobile**, signing secret và event subscriptions riêng; không dùng chung account chỉ thay key.
- [ ] Review chính sách currency/rounding/shipping/tax trước live; hiện cấu hình demo USD/$10/0.08.
- [ ] Clerk production domain, allowed origins/redirects, shared application và Svix webhook delivery được kiểm thử.
- [ ] Webhook duplicate/out-of-order, stock concurrency, checkout expiry và payment reconciliation đã test trước bật thanh toán.
- [ ] Cấu hình proxy/CORS/HTTPS/log-redaction, secrets hosting, readiness, backup và rollback.
- [ ] Mở index/SEO sau khi storefront có dữ liệu thật; hiện noindex.

**Điểm dừng:** chỉ Giai đoạn 1, chờ người dùng kiểm tra trước khi viết module Giai đoạn 2.

## Biên bản kiểm chứng cuối

| Lệnh / kiểm tra | Kết quả thực tế |
| --- | --- |
| pnpm install --frozen-lockfile | Exit 0, lockfile up to date, không peer-dependency warning |
| pnpm lint | Exit 0, ESLint và Prettier xanh |
| pnpm typecheck | Exit 0, shared/API/Web và test/tooling types |
| pnpm test | Exit 0, **3 files / 22 tests passed**, không skip |
| pnpm build | Exit 0, shared + API + Next 16.4.3; `/` và `/_not-found` prerender |
| pnpm dev + HTTP thật | Home, live, ready, openapi.json, docs/ đều 200; home có nội dung tiếng Việt |
| pnpm seed chạy 2 lần | Lần đầu 8 inserts, lần hai 0; dữ liệu đang có giữ nguyên |
| pnpm import:products / -- --write --limit=100 | Fixture local: dry-run 1 valid/0 insert; write 1 insert; không nguồn legacy thật |
| docker compose config --quiet | Exit 0 |
| docker compose up -d --wait | **Chưa đạt**: Docker storage metadata.db I/O error khi create container; ổ C hết dung lượng |
| git scope / ignores | Chỉ website/docs-web; real env/cache/build/deps không vào Git; không import code cũ |

HTTP/data CLI smoke dùng Mongo replica set native **tạm trên D/cổng 27018**, vì Docker volume nằm trên ổ hết dung lượng. Đây là kiểm chứng kết nối/transactions/server thật, **không thay thế bằng chứng chạy Compose**. Smoke servers đã được dừng và trả lại các cổng 27018/3000/4000; không tạo dịch vụ nền production.

Next dev tự tạo `apps/web/AGENTS.md` theo convention phiên bản 16.4.3; giữ file hướng dẫn đọc bundled docs đúng version. `next-env.d.ts` là generated và được ignore để dev/build không làm dirty working tree. Đã đọc bundled installation/proxy docs trong package Next thực tế, không chỉ tài liệu web latest.

Việc người dùng cần làm trước tự chạy local: giải phóng dung lượng ổ lưu Docker/kiểm tra Docker Desktop rồi chạy lại `pnpm db:up`. Không dùng Docker reset/prune làm mất dữ liệu ứng dụng khác. Các integration keys chuẩn bị trước Giai đoạn 2 theo README; chưa dùng key nào ở giai đoạn nền tảng.

## Cập nhật 28/10/2026 — sửa Mongo container unhealthy

Các giới hạn Compose ghi ngày 27/10 ở trên là lịch sử. Sau khi người dùng giải phóng dung lượng và thử lại, container restart với `exec /usr/local/bin/docker-entrypoint.sh: exec format error`, healthcheck chưa chạy lần nào. Kiểm tra trực tiếp image 8.0.17 thấy entrypoint **0 byte**, libcurl báo `file too short`; `/bin/uname` chạy và cả engine/image đều amd64. Đây là filesystem image cache bị hỏng, không phải replica-set healthcheck hoặc kiến trúc sai. Tình trạng hỏng phù hợp với sự cố hết dung lượng/I/O trước đó; chưa khẳng định cơ chế hỏng cache bên trong Docker.

Đã tải image official Mongo 8.0 mới, xác minh entrypoint 14184 bytes và `mongod --version` chạy bình thường. Compose pin `mongo:8.0.34@sha256:8e7d23aa641b0ec6c86418866d5d18d74d5abf89061bc5db7bc4b80929021ef6`; giữ `platform: linux/amd64` người dùng đã thêm. Chỉ recreate container website, giữ volume hiện tại; không chạy `down -v`, rmi, prune/reset hoặc sửa app cũ.

Kiểm chứng thực tế: `pnpm db:up` exit 0; `docker compose ps` healthy, mongosh trả version 8.0.34, set rs0, myState 1, isWritablePrimary true. Như vậy trở ngại chạy Compose trước đây đã được xử lý trên máy này. Integration test binary native vẫn pin 8.0.17 riêng trong test config, không dùng image cache Docker bị hỏng. Không triển khai Giai đoạn 2.

Sau sửa, API factory kết nối Mongo Docker bằng URI local mặc định và `/health/ready` trả 200; không load file `.env` trong lần kiểm tra này. Đã chạy lại tuần tự `pnpm lint`, `pnpm typecheck`, `pnpm test` (22/22, không skip), `pnpm build`: tất cả exit 0. Container Mongo dev được giữ chạy để người dùng tiếp tục `pnpm seed`/`pnpm dev`; không ghi seed vào volume trong lần sửa này.
