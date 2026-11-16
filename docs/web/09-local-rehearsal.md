# 6.1 · Diễn tập production tại máy local

Các lệnh trong tài liệu này chạy từ `website/`. Docker Compose dùng project riêng `shopease-prod-rehearsal`, cổng API 4011 và 4012, Mongo 27029, database `web_rehearsal` và volume riêng. Khởi động Docker Desktop ở chế độ Linux Containers. Dùng Node 26 LTS theo `.nvmrc` và pnpm 10.17.1.

## Dựng API và kiểm tra

```powershell
cd D:\ecommerce-app\website
docker version
pnpm install --frozen-lockfile
docker compose -f docker-compose.prod.yml --profile multi config --quiet
docker compose -f docker-compose.prod.yml --profile multi up --build -d --wait
docker compose -f docker-compose.prod.yml --profile multi ps
pnpm rehearse:api
```

1. `docker version` phải có phần Server. Nếu báo thiếu named pipe, mở Docker Desktop và đợi engine sẵn sàng.
2. `ps` phải có Mongo và hai API. Nếu Mongo chưa healthy, xem `docker compose -f docker-compose.prod.yml logs mongo`. Nếu API chưa lên, xem log `api` và `api2` trong cùng project.
3. `pnpm rehearse:api` kiểm tra cả hai instance trả 200 cho liveness, readiness, catalogue, và 404 cho tài liệu. Script chạy index ở chế độ xem trước rồi áp dụng hai lần, gửi SIGTERM cho instance thứ nhất, yêu cầu exit code 0 và kiểm tra instance thứ hai còn ready.
4. Để chạy lại, dùng lệnh `up --build -d --wait` ở trên. Để dừng toàn bộ, chạy `docker compose -f docker-compose.prod.yml --profile multi down`. Volume được giữ.

Kiểm tra image bằng các lệnh sau. Chỉ đọc metadata và xác nhận không có tệp env trong thư mục ứng dụng.

```powershell
docker image inspect shopease-api:rehearsal --format '{{.Size}} {{.Config.User}}'
docker history shopease-api:rehearsal
docker run --rm shopease-api:rehearsal node --version
docker run --rm shopease-api:rehearsal sh -c 'test -z "$(find /app -name ".env*" -print -quit)"'
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock aquasec/trivy:0.76.0 image --scanners vuln --severity HIGH,CRITICAL --exit-code 1 shopease-api:rehearsal
```

Dockerfile cài từ lockfile, build shared rồi API và dùng `pnpm deploy --legacy --prod`. Cờ `--legacy` cho phép giữ cách liên kết workspace hiện tại của pnpm 10. Runtime dùng user `node` và chỉ mang theo mã đã biên dịch cùng dependency production. [pnpm deploy 10.x](https://pnpm.io/10.x/cli/deploy) · [Node.js release schedule](https://nodejs.org/en/about/previous-releases)

## Index và shutdown

- Local tự tạo index để dễ chạy thử. Với `DEPLOY_ENV=staging` hoặc `production`, API khởi động với autoIndex/autoCreate tắt và bước release tạo index riêng. `pnpm db:indexes --dry-run` kết nối đúng DB rồi in kế hoạch từ schema, còn `pnpm db:indexes --apply` tạo additive index. Xung đột definition hoặc duplicate key cần điều tra trước khi deploy. Hai lệnh đọc biến tiến trình `DEPLOY_ENV`, `MONGODB_URI`, và tùy chọn `MONGO_MAX_POOL_SIZE`. Chạy `pnpm --filter @storefront/shared build` rồi `pnpm --filter @storefront/api build` trước khi gọi script ngoài Docker.
- SIGTERM bắt đầu drain HTTP và dừng nhận công việc quét mới. Tác vụ quét đã nhận được chờ xong trước khi đóng Mongo. Mốc lỗi là 25 giây, bên dưới cửa sổ shutdown mặc định của Render đã đối chiếu ngày 16/11/2026. Một lượt drain sạch ghi `API drained` rồi thoát 0. [Render shutdown](https://render.com/docs/deploys#graceful-shutdown)
- API có request timeout 15 giây cho việc nhận HTTP, keep-alive 65 giây và đóng kết nối idle khi shutdown. Pool mặc định 20 kết nối hoạt động trên mỗi server Mongo trong topology cho mỗi instance, cộng overhead giám sát của driver. Tính theo số instance, kể cả lúc deploy chồng nhau. Driver dùng retry writes, server selection timeout 5 giây và write concern majority ở staging/production. Kiểm lại giới hạn theo cluster lúc đặt gói. [Atlas limits](https://www.mongodb.com/docs/atlas/reference/atlas-limits/)
- `TRUST_PROXY_HOPS=0` khi gọi thẳng local. Dùng `1` khi staging xác nhận đúng một hop đáng tin ghi địa chỉ thật ở cuối chuỗi `X-Forwarded-For`; kiểm bằng IP từ hai mạng khác nhau và thử chèn giá trị giả đầu chuỗi trước khi copy sang production. Rate limiter vẫn tính riêng từng instance. Log chỉ giữ method/path và request ID theo chính sách redact hiện có.
- Test checkout dựng hai Fastify instance với các kết nối độc lập vào một replica set local. Test gửi đua phiên tồn kho, gửi lặp event Stripe đã ký bằng fixture và chạy hai sweeper. Docker Compose dùng API release không có credential. Docker smoke và Vitest cung cấp hai loại bằng chứng bổ sung.

## Build web khi API offline

Trên bản sao sạch không chứa env thật, có thể thử với PowerShell như sau. `DEPLOY_ENV=local` là chế độ build chạy thử, giới hạn các URL vào loopback khi dùng production Node. Các biến `NEXT_PUBLIC_*` được nhúng lúc build. Đổi giá trị thì cần build/deploy lại.

```powershell
$env:DEPLOY_ENV = 'local'
$env:API_INTERNAL_URL = 'http://127.0.0.1:1'
pnpm build
pnpm --filter @storefront/web start
```

Mở `http://localhost:3000/sitemap.xml`. Kỳ vọng có route tĩnh của site và không có URL sản phẩm trong lúc API tắt. Dùng terminal thứ hai để kiểm tra HTTP rồi dừng đúng process vừa chạy.

Nếu Windows báo hết bộ nhớ ở bước kiểm tra TypeScript ngay sau compile, chạy `pnpm typecheck` riêng. Sau khi build shared/API, vào `apps/web` và lần lượt chạy `pnpm exec next build --experimental-build-mode compile` và `pnpm exec next build --experimental-build-mode generate`. Trên CI vẫn dùng `pnpm build` thông thường.

## Kết quả tại mốc 6.2

- Bản build Next tách hai bước đã khởi động với API trỏ cổng chết. `/sitemap.xml` trả 200 với các URL tĩnh.
- Test HTTP giữ request đang chạy đến khi drain bắt đầu, nhận lại 200 với `Connection: close` rồi mới đóng Mongo. Test checkout dùng hai kết nối độc lập qua cùng replica set với adapter Stripe kiểm thử.
- Compose đã qua kiểm tra cấu hình. Docker Desktop trên máy Windows dừng ở bước xuất image và tiếp tục không mở được Linux engine sau lần khởi động lại, báo lỗi WSL/VHDX. Chưa đo được kích thước image cuối, kiểm layer, chạy hai container, gửi SIGTERM trong container hoặc quét Trivy tại local. Các bước diễn tập và quét cũng đã được cấu hình ở job **Website image scan** để bạn chạy sau khi push.

## Kết quả bàn giao 6.5

| Kiểm tra                                                  | Kết quả                                                                                                                                                                 |
| --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm lint`, `pnpm typecheck`                             | Đạt. Typecheck chạy trên bản sao cô lập không có env thật                                                                                                               |
| `pnpm test --maxWorkers=1`                                | 175 Vitest trong 42 suite và 4 test smoke Node, 0 skip. Có replica set local, hai Fastify instance và Clerk SDK xác minh JWT ký bằng khóa thử                           |
| `pnpm build`                                              | Shared và API build được. Build gộp Next compile xong rồi Windows hết bộ nhớ ở bước TypeScript. Next compile và generate riêng đều đạt sau khi typecheck standalone đạt |
| Next production với API offline                           | `next start` phục vụ `/sitemap.xml` HTTP 200, giữ URL tĩnh và không đưa URL sản phẩm vào sitemap                                                                        |
| `actionlint`, `docker compose config --quiet`             | Đạt                                                                                                                                                                     |
| `docker build`, Trivy, hai container và SIGTERM container | Docker Desktop không có Linux engine. Chưa đo được image và chưa chạy diễn tập container                                                                                |
| `pnpm e2e:staging --list`                                 | Nhận diện một bài hosted. Còn chờ URL staging, user thử và credentials Development để chạy qua browser                                                                  |

Blueprint, cấu hình Vercel và workflow đã có trong repo. Để đánh dấu một tích hợp đã chạy trên cloud, dùng bằng chứng trong [bảng xác nhận dịch vụ](09-deploy-guide.md#6-xác-nhận-từng-dịch-vụ-sau-khi-bạn-deploy). Cache revalidation vẫn được nghiệm thu bằng thao tác admin staging trong [09-environments.md](09-environments.md).
