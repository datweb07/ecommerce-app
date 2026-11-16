# 6.3–6.5 · Triển khai ShopEase trên staging và production

Hướng dẫn này dùng `<DOMAIN>`, vì chưa có hostname production của storefront để kiểm chứng. Thao tác cloud bên dưới để bạn tự làm. Hãy dựng và nghiệm thu staging trước. Cấu hình API cũ dùng cho mobile không tham gia hai Blueprint dưới đây.

## Bắt đầu khi chưa có tên miền

**Bạn có thể dựng staging ngay** với `https://<project>.vercel.app` và `https://<service>.onrender.com`. Vercel và Render cấp URL HTTPS. Clerk Development hỗ trợ URL do nhà cung cấp hosting cấp. Clerk Production trên Vercel cần một miền bạn kiểm soát DNS để tạo và xác minh các bản ghi, không bắt buộc đuôi `.com` hoặc `.vn`. Stripe Checkout test mở ở trang hosted của Stripe, quay lại Vercel và gửi webhook đến địa chỉ HTTPS của Render. [Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain) · [Render web service](https://render.com/docs/web-services) · [Clerk trên Vercel](https://clerk.com/docs/guides/development/deployment/vercel) · [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create) · [Stripe webhooks](https://docs.stripe.com/webhooks)

1. Làm mục 1 bên dưới để có image GHCR và Atlas staging. Tạo project Vercel staging trước để lấy **URL ổn định** trong **Domains**, gồm cả trường hợp build đầu chưa chạy được. Dùng đúng URL được dashboard cấp, có thể có hậu tố tránh trùng tên. Đặt slot **Production của project staging** là `DEPLOY_ENV=staging`.
2. Làm mục 2, thay `https://staging.<DOMAIN>` bằng URL ổn định của Vercel ở cả hai biến `WEB_ORIGIN` và `CORS_ORIGINS` của Render. Lấy URL HTTPS thực tế của service Render từ Dashboard. Bỏ bước gắn custom domain. Kiểm API ready 200.
3. Trong Clerk Development và Stripe **Test mode**, thêm các URL webhook ở mục 2 bằng URL Render vừa lấy. Lưu signing secret dashboard của từng endpoint vào Render. Nếu lần deploy đầu yêu cầu secret trước khi URL có sẵn, chọn trước tên service và kiểm URL thực tế ngay khi service được tạo, rồi cập nhật webhook/dashboard và redeploy nếu hostname được cấp khác.
4. Làm mục 3, bỏ bước trỏ DNS. Vercel `NEXT_PUBLIC_SITE_URL` là URL Vercel ổn định, `NEXT_PUBLIC_API_URL` và `API_INTERNAL_URL` cùng là URL Render mặc định. Dùng cùng Clerk Development instance ở hai nơi. Dùng [phiếu biến staging](../../website/.env.staging.example) để rà từng tên. Bảo vệ staging nếu dùng dữ liệu hạn chế. `noindex` chỉ kiểm soát công cụ tìm kiếm.
5. Sau khi web và API khỏe, mở `/admin` bằng tài khoản thử khớp `ADMIN_EMAIL`, tạo một sản phẩm, rồi chạy smoke ở mục 5 với hai hostname mặc định. Chạy [E2E staging](09-environments.md#e2e-trên-staging-đã-deploy). Đặt một đơn bằng thẻ **test**, kiểm redirect, event test 2xx ở Stripe và đơn đã xuất hiện. Dùng [checklist storefront](04-manual-test-checklist.md) và [checklist admin](05-admin-manual-test-checklist.md).

**Khi bán thật**, cần domain cho Clerk Production và tài khoản Stripe live hợp lệ ở quốc gia/pháp nhân được hỗ trợ. Danh sách Stripe Global được kiểm tra ngày 16/11/2026 không liệt kê Việt Nam cho Stripe Payments. Nếu doanh nghiệp của bạn đăng ký tại Việt Nam, kiểm tra với Stripe trước khi chọn cổng, tránh chọn quốc gia chỉ theo nơi đặt server. Mua domain giải quyết bước cấu hình Clerk, còn Stripe xác minh doanh nghiệp riêng. Code hiện vẫn khóa live, kể cả khi đã có tài khoản. Dừng ở staging cho đến khi đi qua [các cổng chặn](09-go-live-checklist.md). [Stripe Global](https://stripe.com/global) · [Xác minh doanh nghiệp Stripe](https://docs.stripe.com/get-started/account/set-up)

Ước lượng thao tác khi image đã build và bạn đã có tài khoản. Atlas/GHCR và chuẩn bị key khoảng 30–60 phút, Render/Vercel khoảng 30–60 phút, smoke và kiểm luồng thử khoảng 30–60 phút. Với production, dành thêm một phiên cho DNS/Clerk/backup/khôi phục và một phiên cho nghiệm thu. Thời gian cấp chứng chỉ, duyệt Stripe hoặc DNS phụ thuộc nhà cung cấp. Chi phí theo gói nằm trong [bảng vận hành](09-monitoring.md#chi-phí-và-cảnh-báo-hóa-đơn).

## 1. Chuẩn bị image và cơ sở dữ liệu

1. Sau khi bạn push, mở GitHub → **Actions → Website API image**. Đợi cả job scan và publish xanh trên `main`. Trong Summary, lấy tên image và digest. Trong **Packages → storefront-api**, kiểm tra tag `latest` và `sha-<commit>`. Nếu repository hoặc tên package khác mặc định, sửa URL image trong hai Blueprint cho đúng tên **trước khi import**.
2. Trong Atlas, tạo project/cluster web riêng cho mỗi môi trường. Chọn Singapore nếu có trên gói bạn dùng. Từ **Database Access**, cấp user runtime scope DB `web_staging` hoặc `web_prod`. Production dùng cluster có Cloud Backup và user chạy index riêng. URI SRV phải có tên DB ở giữa host và dấu `?`, dùng mặc định TLS và majority. Tách URI này khỏi mobile. [Atlas IP access list](https://www.mongodb.com/docs/atlas/security/ip-access-list/) · [Atlas cloud backup](https://www.mongodb.com/docs/atlas/backup-restore-cluster/)
3. Trong Render → **Workspace Settings → Registry Credentials**, thêm credential GHCR tên `shopease-ghcr-pull` để đọc package private. Dùng credential chỉ có quyền đọc package và có quyền truy cập package storefront. Kiểm tra quyền sau khi xoay key. Nếu bạn chủ động để package public, bỏ cả khối `image.creds` khỏi Blueprint. [Render registry credentials](https://render.com/docs/deploying-an-image)

## 2. API staging trên Render

1. Vào **New → Blueprint**, chọn repository và nhánh `main`, nhập **Blueprint Path** là `website/render.yaml`. Kiểm preview chỉ hiện đúng dịch vụ `shopease-storefront-api-staging`, runtime **Image**, region **Singapore** và plan **Starter**. Kiểm giá hiện tại ở dashboard trước khi Apply. [Render Blueprint](https://render.com/docs/infrastructure-as-code) · [Render pricing](https://render.com/pricing)
2. Khi được hỏi env, điền `WEB_ORIGIN=https://staging.<DOMAIN>`, `CORS_ORIGINS=https://staging.<DOMAIN>`, URI Atlas `web_staging`, Clerk development, Stripe test, Cloudinary staging và `ADMIN_EMAIL`. Tất cả trường `sync:false` được hỏi khi tạo Blueprint. Với dịch vụ đã tồn tại, thêm biến thiếu qua **Environment**. Các biến `HOST` và `DEPLOY_ENV` đã nằm trong Blueprint. [Render Blueprint env vars](https://render.com/docs/blueprint-spec#prompting-for-secret-values)
3. Trong dịch vụ mới, lấy dải IP ở **Connect → Outbound** và thêm đúng các CIDR vào **Atlas → Network Access** của staging. Nếu deploy đầu chạy trước khi bạn hoàn thành access list, khởi động lại deploy sau khi cấu hình xong. **Pre-Deploy Command** của staging chạy `node dist/scripts/indexes.js --apply` bằng URI staging. Đợi log index thành công và service healthy. [Render outbound IPs](https://render.com/docs/outbound-ip-addresses)
4. Vào **Settings → Custom Domains**, thêm `api-staging.<DOMAIN>`, trỏ bản ghi theo dashboard và đợi TLS. Kiểm `https://api-staging.<DOMAIN>/health/ready` trả HTTP 200. Render tự kiểm `/health/live` để một lần gián đoạn Atlas không tự biến thành vòng restart. Theo dõi DB độc lập qua `/health/ready`. [Render custom domains](https://render.com/docs/custom-domains) · [Render health checks](https://render.com/docs/health-checks)
5. Với dịch vụ **Existing Image**, lúc CI ghi lại tag `latest`, Render không tự kéo image mới. Mở **Manual Deploy → Deploy latest reference** khi muốn lấy bản staging vừa scan. Git build filters không áp dụng cho image-backed. Giữ auto-sync Blueprint tắt nếu muốn kiểm soát mỗi lần đồng bộ cấu hình. Cấu hình này không quản lý dịch vụ legacy. [Render image deployments](https://render.com/docs/deploying-an-image)
6. Tạo webhook Clerk development và Stripe test sau khi API có HTTPS. Dùng endpoint `/api/v1/webhooks/clerk` cho `user.created`, `user.updated`, `user.deleted`. Stripe test dùng `/api/v1/webhooks/stripe` cho `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`. Lấy signing secret từ **endpoint Dashboard tương ứng**. Lưu vào Render rồi kiểm redeploy staging. [Clerk webhook docs](https://clerk.com/docs/guides/development/webhooks/overview) · [Stripe webhook test](stripe-local-testing.md)

## 3. Web staging trên Vercel

1. Tạo project staging và liên kết GitHub. Trong **Build and Deployment**, đặt **Root Directory** là `website/apps/web`, bật **Include source files outside of the Root Directory**, chọn Next.js và Node 26.x. File `vercel.json` đặt `sin1` và build shared package trước web. Bật **Automatically Expose System Environment Variables** để Ignored Build Step nhận Git SHA. Nếu history thiếu commit trước, script chọn build. Thay đổi chỉ ở docs hoặc các ứng dụng legacy sẽ được bỏ qua khi diff khả dụng. [Vercel monorepo settings](https://vercel.com/docs/monorepos/monorepo-faq) · [Vercel Node 26](https://vercel.com/changelog/node-js-26-lts-is-now-generally-available-on-vercel)
2. Trong **Git**, đặt Production Branch của **project staging** là `main`. Trong **Domains**, gắn `staging.<DOMAIN>` vào project này, trỏ DNS theo dashboard và đợi Vercel cấp TLS.
3. Trong **Environment Variables**, đặt các biến sau cho **Production** của project staging. Dùng cùng giá trị staging cho **Preview** nếu bật preview. Đặt **Development** bằng cấu hình localhost và Clerk development, dùng `DEPLOY_ENV=local` khi phát triển.

   | Biến trên Vercel                            | Giá trị staging                                                    |
   | ------------------------------------------- | ------------------------------------------------------------------ |
   | `DEPLOY_ENV`                                | `staging`                                                          |
   | `NEXT_PUBLIC_SITE_URL`                      | `https://staging.<DOMAIN>`                                         |
   | `NEXT_PUBLIC_API_URL` và `API_INTERNAL_URL` | `https://api-staging.<DOMAIN>`                                     |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`         | Publishable key Clerk Development cùng instance với Render staging |
   | `CLERK_SECRET_KEY`                          | Secret key tương ứng, chỉ ở server                                 |
   | `CLOUDINARY_IMAGE_CLOUD_NAME`               | Cùng cloud name với `CLOUDINARY_CLOUD_NAME` của API staging        |
   | `WEB_HSTS_MAX_AGE`                          | Bỏ trống bằng cách không tạo biến để dùng 300 giây                 |

4. Bật **Deployment Protection** cho Preview. Nếu bật bảo vệ cả origin staging chính, tạo **Protection Bypass for Automation** rồi truyền secret qua `SMOKE_VERCEL_BYPASS_SECRET` ở terminal kiểm thử. Script chỉ gửi secret trong header HTTPS đến đúng web origin, và kiểm tra redirect thủ công. Staging/Preview luôn có `X-Robots-Tag: noindex, nofollow` và robots chặn `/`. Preview dùng API staging. Nếu một preview cần tương tác đã đăng nhập, thêm exact origin vào API theo [ma trận CORS](09-environments.md#origin-và-cookie). [Vercel environment variables](https://vercel.com/docs/environment-variables) · [Vercel Deployment Protection](https://vercel.com/docs/deployment-protection) · [Automation bypass](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation)
5. Redeploy sau khi đổi `NEXT_PUBLIC_*` hoặc quy tắc ảnh. Đăng nhập staging với tài khoản admin thử, tạo ít nhất một sản phẩm theo checklist admin. Chạy smoke phía dưới. Khoá Atlas, Stripe, Cloudinary upload và webhook ký đều đi vào Render, chỉ Clerk secret phía web đi vào Vercel.

## 4. Production sau khi staging đã đạt

1. Hoàn tất Atlas `web_prod`, bật và kiểm restore backup. Chạy **dry-run index** với credential index production trên máy/runner đã được allowlist. Duyệt output rồi apply. Blueprint production bỏ pre-deploy index để runtime API dùng credential riêng và kế hoạch index chỉ được áp dụng khi đã duyệt.
2. Trong [Blueprint production](../../website/render.production.yaml), thay tag `sha-REPLACE-ME` bằng tag SHA đã qua CI, kiểm digest GHCR và tạo một Blueprint mới với path `website/render.production.yaml`. Kiểm tên `shopease-storefront-api-production`, gắn `api.<DOMAIN>`, thêm outbound CIDR vào Atlas production. Điền Clerk production và Cloudinary production. Render yêu cầu `WEB_ORIGIN` và `CORS_ORIGINS` đều là `https://www.<DOMAIN>` cho cấu hình chuẩn. Để Stripe trống. API hiện chỉ nhận test event, chưa có bước kích hoạt Stripe live.
3. Tạo project Vercel production riêng, dùng cùng Root Directory, Node và region như staging. Dùng **Settings → Git → Disconnect** để giữ phát hành production theo workflow đã duyệt. Trước khi nhập secret live, kiểm rõ Project ID/Org ID. Trong **Production Environment**, đặt `DEPLOY_ENV=production`, `NEXT_PUBLIC_SITE_URL=https://www.<DOMAIN>`, hai API URL bằng `https://api.<DOMAIN>`, Clerk live và cloud name production. Nếu giữ môi trường Preview cho trường hợp deploy thử, dùng biến staging hoặc không cấp secret live cho Preview.
4. Trong **Domains**, thêm `www.<DOMAIN>` và apex `<DOMAIN>`, đặt apex redirect đến www. Làm theo DNS records hiện trên dashboard và chờ TLS cả hai hostname. Giữ truy cập production có kiểm soát khi duyệt catalogue, vì giao diện checkout chưa có chế độ ẩn. [Vercel domains](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
5. Các bước API/web cần key Clerk Production, vì vậy hãy chuẩn bị instance và các bản ghi ngay khi có quyền DNS. Trong Clerk Dashboard → Production → Domains, lấy **chính xác** record do dashboard đưa ra, gồm Frontend API, Account Portal và email theo cấu hình hiện. Nếu dùng Cloudflare, đặt record Clerk là **DNS only**, rồi đợi Clerk cấp và xác nhận chứng chỉ. Tạo Google OAuth credentials của doanh nghiệp, điền redirect URI được Clerk cung cấp và thử đăng nhập. Kiểm cấu hình Apple nếu bản mobile phát hành đang dùng. Tạo endpoint `https://api.<DOMAIN>/api/v1/webhooks/clerk` cho ba sự kiện user ở mục 2. Điền signing secret tương ứng vào Render và xác nhận delivery 2xx khi tạo/sửa tài khoản thử. [Clerk production guide](https://clerk.com/docs/guides/development/deployment/production)
6. Tạo tài khoản admin trong instance production, xác minh primary email và điền `ADMIN_EMAIL`. Nhập sản phẩm qua admin, chạy smoke và xác nhận ảnh, canonical, Clerk, SSR và phân quyền. Công cụ import legacy hiện chỉ ghi local, xem [môi trường](09-environments.md). Kiểm [ảnh hưởng đến mobile](09-clerk-mobile-impact.md) trước khi đổi khóa mobile.
7. Giữ workflow production tắt cho đến khi đạt [go-live checklist](09-go-live-checklist.md). Workflow nhận `PRODUCTION_WEB_ORIGIN`, `PRODUCTION_API_ORIGIN` và tùy chọn `SMOKE_VERCEL_BYPASS_SECRET`. Xem [tên các secret CI](09-ci-setup.md). Sau khi live được duyệt và code hỗ trợ, tạo Stripe endpoint live riêng ở `https://api.<DOMAIN>/api/v1/webhooks/stripe`, bốn sự kiện như mục 2, dùng secret live riêng. Xác minh endpoint bằng sự kiện live hợp lệ, một đơn giá trị nhỏ có sự đồng ý của chủ tài khoản, rồi hoàn tiền trên Dashboard và đối soát thủ công. Đo lại Lighthouse với Clerk Production theo cấu hình Giai đoạn 5.

Fly.io và Railway đều có thể chạy container API. Bản bàn giao giữ Render vì đã có Blueprint, deploy theo image và bộ bước vận hành cho Render. Đổi host cần xác nhận lại outbound IP, Atlas access list, proxy hop và health checks. [Fly.io Dockerfile](https://fly.io/docs/languages-and-frameworks/dockerfile/) · [Railway Dockerfiles](https://docs.railway.com/guides/dockerfiles)

## 5. Chạy smoke sau khi deploy

Trong PowerShell từ `website/`, thay các placeholder bên dưới bằng hostname thật.

```powershell
$env:SMOKE_WEB_ORIGIN = 'https://staging.<DOMAIN>'
$env:SMOKE_API_ORIGIN = 'https://api-staging.<DOMAIN>'
pnpm smoke:deploy -- --env staging
```

```powershell
$env:SMOKE_WEB_ORIGIN = 'https://www.<DOMAIN>'
$env:SMOKE_API_ORIGIN = 'https://api.<DOMAIN>'
pnpm smoke:deploy -- --env production
```

Production suy ra apex bằng cách bỏ `www.`. `SMOKE_APEX_ORIGIN` là tùy chọn nếu muốn khai báo rõ, phải đúng apex đó. Kỳ vọng tất cả dòng `PASS`. Script không đăng nhập hay tạo đơn. Hai POST đều là payload rỗng, không chữ ký gửi cố định đến webhook để xác nhận API từ chối. Script kiểm catalogue phải có ít nhất một sản phẩm. Nếu root trả 401/403 từ Deployment Protection, xác nhận bypass đúng project. Nếu TLS hoặc redirect báo đỏ, quay lại mục Domains và kiểm DNS cùng đích redirect.

### Mở CSP và HSTS theo từng bước

Web hosted đã enforce `base-uri`, `object-src` và `frame-ancestors`. Chính sách tài nguyên đầy đủ tiếp tục ở Report-Only. Chỉ enforce toàn bộ sau khi kiểm đăng nhập Clerk, upload/hiển thị ảnh Cloudinary, Stripe hosted redirect và các nguồn tile nếu bản đồ được nối sau này. Clerk và Next cần cấu hình nonce/dynamic rendering hoặc chính sách tương thích cho script và style nội tuyến. Không thêm allowlist tile khi MapLibre chưa tích hợp. Giữ max-age HSTS ban đầu 300 giây, tăng dần sau khi xác nhận cả hostname và rollback. Không dùng preload ở mốc này. [Clerk CSP](https://clerk.com/docs/guides/secure/best-practices/csp-headers) · [Next CSP](https://nextjs.org/docs/app/guides/content-security-policy)

Nguồn nhà cung cấp được đối chiếu ngày 16/11/2026. Kiểm giá và tính năng theo gói trong dashboard trước khi Apply.

Hai Blueprint đã được đối chiếu bằng JSON Schema của Render. Khi bạn có CLI và workspace Render, từ gốc repo có thể chạy `render blueprints validate website/render.yaml` và `render blueprints validate website/render.production.yaml` để kiểm thêm tài nguyên cùng tên, quyền truy cập và cấu hình trong workspace. [Render Blueprint validation](https://render.com/docs/blueprint-spec#validating-blueprints)

## 6. Xác nhận từng dịch vụ sau khi bạn deploy

| Dịch vụ                | Nơi chạy                                                        | Bằng chứng cần có để đánh dấu đang dùng được                                                                                                    |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Storefront Next.js     | Vercel, `www.<DOMAIN>`                                          | Trang mở qua HTTPS, apex redirect đúng và smoke web xanh                                                                                        |
| Fastify API            | Render, `api.<DOMAIN>`                                          | Readiness 200, catalogue có dữ liệu và route private trả 401 khi chưa đăng nhập                                                                 |
| MongoDB                | Atlas `web_prod`, được truy cập từ Render                       | Readiness 200, đọc catalogue thành công và log xác nhận index release                                                                           |
| Clerk                  | Vercel hiện trang đăng nhập, Render kiểm Bearer và nhận webhook | Đăng nhập bằng instance production, gọi `/api/v1/me` thành công và webhook Clerk có delivery 2xx. Smoke ẩn danh chỉ xác nhận hàng rào đăng nhập |
| Cloudinary             | Render ký upload, Cloudinary lưu ảnh, Vercel hiển thị           | Tạo sản phẩm bằng ảnh mới từ admin, thấy ảnh ở storefront và không lỗi tối ưu ảnh                                                               |
| Stripe                 | Hosted Checkout, webhook vào Render                             | Staging có thể nghiệm thu bằng Stripe test. Production checkout vẫn bị chặn ở mốc này                                                           |
| GitHub Actions và GHCR | GitHub, package `storefront-api`                                | CI xanh trên SHA đã duyệt, có image digest trong Summary                                                                                        |

Mốc 6.3 đã qua lint, typecheck, 171 test Vitest trong 40 suite, ba test smoke bằng fixture và production build cục bộ với API tắt. Cả hai Blueprint và `vercel.json` qua JSON Schema công khai. `actionlint` qua và Ignored Build Step được thử với thay đổi docs, thay đổi web và thiếu Git history. Render CLI và smoke trên domain thật còn chờ quyền truy cập của bạn. Các mục yêu cầu thao tác cloud trong bảng cần kết quả từ URL hoặc dashboard của bạn.
