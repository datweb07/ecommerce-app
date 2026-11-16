# 6.2 · Bật GitHub Actions và chuẩn bị dashboard

Mốc này bàn giao cấu hình và hướng dẫn để bạn tự push, chạy CI và xem log. Giữ workflow production ở trạng thái chưa kích hoạt. Smoke public trên domain, Blueprint Render, thiết lập Vercel/DNS và E2E cross-origin thuộc 6.3 trở đi.

## 1. Bảo vệ đúng dịch vụ Render cũ trước khi push

1. Mở Render Dashboard, chọn đúng dịch vụ API legacy đang phục vụ mobile. Vào **Settings → Build & Deploy → Build Filters**. Nếu dịch vụ theo dõi cả repo, thêm `website/**`, `docs/web/**` và các workflow website vào phần **Ignored Paths**. Nếu đã có danh sách **Included Paths** chỉ chứa mã nguồn legacy, kiểm lại danh sách hiện tại trước khi thay đổi.
2. Giữ nguyên repo, branch, Dockerfile/command, biến môi trường và database của dịch vụ legacy. Lưu rồi đối chiếu tab Events.
3. Nếu API web mới liên kết Git, **Included Paths** là `website/**`, context Docker là `website` và Dockerfile là `website/apps/api/Dockerfile` theo cách dashboard tính đường dẫn. Hướng production dự kiến dùng **Existing Image** từ GHCR để triển khai đúng digest. Với image-backed, Git build filter không áp dụng vì dịch vụ không theo dõi repo. [Render build filters](https://render.com/docs/monorepo-support) · [Render existing image](https://render.com/docs/deploying-an-image)

## 2. Chạy CI lần đầu

1. Mở GitHub → **Settings → Actions → General**. Bật GitHub Actions cho repo và giữ mặc định token workflow read-only. Nếu dùng allowlist Actions, thêm các action đã liệt kê trong workflow.
2. Bạn tự push nhánh hoặc mở PR có các file mới. Vào **Actions → Website CI → Website checks**. Thứ tự mong đợi là frozen install, lint, typecheck, Vitest, Next build với API tắt, E2E public. CI tái dùng binary của MongoMemoryReplSet và browser cache. Replica set này được riêng mỗi lượt chạy, phù hợp test transaction và tránh đụng DB local của bạn.
3. Ở **Website API image**, PR build, diễn tập hai container và quét Trivy. Job ghi kích thước image vào **Summary** và kiểm tra index, SIGTERM, API thứ hai còn ready, cùng việc image không mang file env. Trên `main` đã qua scan, job publish dùng `GITHUB_TOKEN` tự cấp để ghi package GHCR. Vào **Packages → storefront-api** kiểm tra tag `sha-<git-sha>`. Digest nằm trong **Summary**. `latest` chỉ dùng cho staging. Nếu dùng package private, cấp pull-only cho Render sau khi tạo môi trường.
4. Ở **Website security**, kiểm audit production, Gitleaks với output redact, actionlint, CodeQL và dependency review. Khi repo private, xác nhận **Settings → Code security and analysis** hỗ trợ CodeQL/dependency review trên gói hiện có. Nếu dashboard yêu cầu tính năng trả phí, dừng tại đó để quyết định. File Dependabot đặt lịch hàng tuần và nhóm cập nhật cho workspace, action và Docker.
5. Nếu E2E public đỏ, mở **Summary → Artifacts → website-public-e2e**. Tải về rồi mở `report/index.html`. Dùng trace từ kết quả lỗi. Artifact staging có credential không được tự upload.

Các workflow tự động lọc path website, tài liệu web và workflows, ngoại trừ sự kiện lịch hoặc triển khai vốn không có bộ lọc `paths`. Các job nhạy cảm giới hạn vào main. Action dùng tag major đã đối chiếu, có thể pin full SHA xác minh qua release chính thức trước khi bắt buộc ở cấp tổ chức. [GitHub workflow syntax](https://docs.github.com/en/actions/writing-workflows/workflow-syntax-for-github-actions) · [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use)

## 3. Bảo vệ nhánh main

1. Vào **Settings → Rules → Rulesets → New branch ruleset**. Chọn `main`, đặt active, bật **Require a pull request before merging**, chọn ít nhất một review và bật **Block force pushes**. Giới hạn bypass cho người giữ quyền quản trị release.
2. Kiểm **Website checks** và **Website image scan** ở PR website trước khi approve. Chỉ đánh dấu required status check cho mọi PR khi repo có check luôn báo kết quả trên mọi path. Với các workflow hiện lọc path, GitHub để check ở Pending trên PR chỉ chạm mobile/legacy nếu đặt chúng bắt buộc toàn nhánh. Nếu muốn enforce toàn nhánh, cần một check trung gian luôn chạy và trả kết quả cho path ngoài website. Workflow release vẫn tự từ chối commit khi thiếu CI xanh đúng SHA. [GitHub required checks và path filtering](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)

## 4. Tạo environment staging và chạy test có credentials

1. GitHub → **Settings → Environments → New environment** → nhập đúng `staging`. Giới hạn **Deployment branches and tags** vào `main`.
2. Trong **Environment secrets**, tạo các tên dưới đây. Dùng tài khoản test và Cloudinary test riêng. Các job nhận secret chỉ tại bước chạy suite.

   - Clerk development: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SIGNING_SECRET`. Trong Clerk Dashboard, chọn **Development** rồi mở **API keys** và **Webhooks**. Không đổi instance mobile khi thử.
   - Stripe test: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Lấy từ sandbox web test và endpoint test tương ứng. Tuyệt đối không đưa key live.
   - Cloudinary test: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Trong **Environment variables** thêm `E2E_CLOUDINARY_CLOUD_NAME` bằng tên cloud test để bộ kiểm thử xác nhận account.

3. Vào **Actions → Website staging E2E → Run workflow → main**. Có thể tích hợp kích hoạt tự động qua GitHub `deployment_status` thành công có tên environment đúng `staging` và ref main. Job chạy `@auth`, `@payment`, `@upload` với Next/API/Mongo loopback, dùng dịch vụ test thật khi có secret. Sau khi deploy, chạy thêm [`pnpm e2e:staging`](09-environments.md#e2e-trên-staging-đã-deploy) để kiểm browser qua hai hostname thật. [Clerk environments](https://clerk.com/docs/guides/development/deployment/production) · [Stripe API keys](https://docs.stripe.com/keys)

## 5. Chuẩn bị production, giữ tắt workflow ở mốc 6.2

1. Tạo **Environment** tên `production`, giới hạn main và bật **Required reviewers** cùng **Prevent self-review** nếu gói repo hỗ trợ. Chọn reviewer thực sự khác người dispatch. Nếu dashboard hiện không cho cấu hình, giữ cổng bật ở trạng thái tắt.
2. Để dành một runner Linux x64 chuyên cho release với label `storefront-deploy`. Chỉ cho repo này dùng runner. Cài Docker buildx, curl, gh, jq, Node 26 và bảo đảm IP đi ra nằm trong Atlas IP Access List của web production. Dùng runner riêng vì GitHub-hosted thông thường không cho một IP cố định để allowlist. Giữ quyền CI PR ở GitHub-hosted và không dùng runner release cho PR. [GitHub environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments) · [Atlas IP access](https://www.mongodb.com/docs/atlas/security/ip-access-list/)
3. Dành các **Environment secrets** cho production gồm `MONGODB_INDEX_URI`, `RENDER_API_KEY`, `VERCEL_TOKEN`. Dùng tài khoản index của `web_prod`, API key Render trong workspace web phù hợp và token Vercel có phạm vi team chứa dự án web. API runtime có credential Atlas riêng. Xoay credential rồi cập nhật ở đúng dashboard trước khi thao tác.
4. Dành các **Environment variables** gồm `PRODUCTION_DEPLOY_ENABLED`, `PRODUCTION_API_ORIGIN`, `PRODUCTION_WEB_ORIGIN`, `RENDER_SERVICE_ID`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `VERCEL_CLI_VERSION`. Giữ `PRODUCTION_DEPLOY_ENABLED=false` đến khi smoke qua trên đúng project và domain. Các URL tương ứng `https://api.<DOMAIN>` và `https://www.<DOMAIN>`. Nếu web được bảo vệ bằng Vercel Automation Bypass, thêm secret `SMOKE_VERCEL_BYPASS_SECRET`. [Thiết lập và smoke](09-deploy-guide.md)
5. Sau khi nghiệm thu các phần còn lại, mở **Run workflow** trên main và nhập SHA đầy đủ hoặc tag có sẵn trỏ vào main. Lượt đầu giữ `apply_indexes_and_deploy=false`, xin review và đọc log kế hoạch index. Lượt thứ hai dùng đúng SHA đó, bật `apply_indexes_and_deploy` và xin review lại trước khi áp dụng. Workflow kiểm CI và image workflow đúng SHA, resolve digest GHCR, đợi Render báo live, release web và gọi smoke chỉ đọc. Chạy deploy thật là thao tác của bạn. [Render API deploy](https://api-docs.render.com/reference/create-deploy) · [Vercel CLI deploy](https://vercel.com/docs/cli/deploy)

## Các quyết định còn chặn go-live

- API hiện nhận Stripe test event và không có chế độ checkout live. Cấu hình production từ chối cả khóa test lẫn live tại thời điểm này. Catalogue có thể diễn tập với Stripe trống. Storefront hiện vẫn hiển thị điều khiển checkout, nên hãy giới hạn truy cập catalogue production cho tới khi duyệt cơ chế hiển thị phù hợp hoặc tích hợp thanh toán live. Xác nhận quốc gia/pháp nhân Stripe hợp lệ trước khi thiết kế bước tiếp.
- Dùng hai cluster/DB riêng cho web staging và web production, không nhập nhầm URI mobile. Atlas production dự kiến M10+ với Cloud Backup, staging cân nhắc tier miễn phí sau khi thử transaction. Tra IP outbound của từng dịch vụ Render trong **Connect → Outbound**. Tài liệu nguồn kiểm ngày 16/11/2026. [Atlas backup](https://www.mongodb.com/docs/atlas/backup-restore-cluster/) · [Atlas cluster settings](https://www.mongodb.com/docs/atlas/cluster-additional-settings/) · [Render outbound IPs](https://render.com/docs/outbound-ip-addresses)
- Instance Clerk Development và Production tách dữ liệu. Bản mobile và web chỉ chia sẻ tài khoản khi cả hai dùng cùng instance. Mobile production cần publishable key của đúng Clerk Production instance, trong khi backend web dùng secret tương ứng. Không sửa cấu hình mobile ở mốc này. [Clerk production deployment](https://clerk.com/docs/guides/development/deployment/production)
- Vercel cấu hình `sin1`. Xác nhận trên deployment thật, cùng DNS, CSP enforce và rollback. Xem [go-live checklist](09-go-live-checklist.md) và [chi phí](09-monitoring.md#chi-phí-và-cảnh-báo-hóa-đơn). [Vercel regions](https://vercel.com/docs/regions)
