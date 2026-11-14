# 2.1 Authentication và Clerk webhook

- `GET /api/v1/me` trả id, name, imageUrl, bio, userName của phiên hiện tại.
- `PATCH /api/v1/me` nhận bio hoặc userName. Trùng userName trả 409 `USERNAME_TAKEN`.
- `POST /api/v1/webhooks/clerk` kiểm tra chữ ký Svix trên JSON nguyên gốc. Đăng ký user.created, user.updated, user.deleted. Delivery lặp hoặc cũ được xác nhận 200.
- `requireAdmin` đọc primary email đã xác minh từ Clerk tại thời điểm gọi. CORS origins cũng dùng để kiểm tra authorized parties của token.

Clerk SDK được gọi trong guard Fastify với Bearer token và loại session. Middleware Clerk có thể phát 307 cho development handshake, nên guard gọi trực tiếp SDK từ `@clerk/fastify` và ánh xạ kết quả sang lỗi JSON. Thiếu credentials chỉ làm các thao tác cần tích hợp trả 503.

Webhook ghi receipt TTL 35 ngày cùng thay đổi danh tính trong transaction. Bản ghi thứ tự theo Clerk user ID giúp chặn cập nhật cũ và khóa hydration đồng thời với webhook. Xóa user giữ tombstone, xóa cart theo Clerk ID, và xóa wishlist/addresses cùng user nhúng. Orders và reviews hiện hữu được giữ lại.

Các index là additive. Nếu DB đã có dữ liệu xung đột index duy nhất, cần kiểm tra dữ liệu trước khi dùng DB đó. Kiểm chứng bằng MongoMemoryReplSet, chữ ký Svix thật tạo từ secret thử và Clerk adapter giả lập. Lint, typecheck và 28 test đã đạt ở mốc 2.1.
