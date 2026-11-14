# API backend Giai đoạn 2

Prefix bên dưới là /api/v1. Swagger UI chạy ở /docs/ và đặc tả ở /openapi.json trong local/dev. Private routes nhận Authorization: Bearer <Clerk session JWT>. Admin phải có primary email đã xác minh khớp ADMIN_EMAIL. Lỗi JSON có error.code, error.message và requestId.

| Nhóm | Phương thức và đường dẫn |
| --- | --- |
| Danh tính | GET/PATCH /me, POST /webhooks/clerk |
| Catalogue | GET /products, /products/:id, /products/:id/related, /products/:id/reviews, /categories |
| Cart | GET/DELETE /cart, POST /cart/items, PATCH/DELETE /cart/items/:productId |
| Wishlist | GET /wishlist, PUT/DELETE /wishlist/:productId |
| Địa chỉ | GET/POST /addresses, PATCH/DELETE /addresses/:id |
| Thanh toán | POST /checkout/quote, POST /checkout/sessions, GET /checkout/sessions/:id, POST /webhooks/stripe |
| Đơn hàng | GET /orders, /orders/:id |
| Đánh giá | POST /reviews, PATCH/DELETE /reviews/:id |
| Thông báo | GET /notifications, PATCH /notifications/:id/read, POST /notifications/read-all |
| Admin | GET /admin/orders, PATCH /admin/orders/:id/status, POST /admin/uploads/signature |

Order item có canReview và review của chính người gọi, gồm id và rating, để frontend có thể chỉnh/xóa review sau khi tải lại. Review công khai chỉ có tên hiển thị, rating và thời gian.

Chi tiết theo module nằm trong [Auth](02-1-auth.md), [Catalogue](02-2-catalogue.md), [Customer](02-3-customer.md), [Checkout](02-4-checkout.md), [Reviews](02-5-reviews.md), [Notifications](02-6-notifications.md), [Admin](02-7-admin.md) và [Stripe local](stripe-local-testing.md).

## Rà soát bảo mật

| Hạng mục | Kiểm soát và giới hạn |
| --- | --- |
| IDOR và phân quyền | Truy vấn riêng tư lọc owner theo user hoặc Clerk ID, gồm review/order/checkout/inbox. Test truy cập chéo trả 404. Admin xác minh role qua primary email từ Clerk. |
| Injection và dữ liệu đầu vào | Zod strict cho body/query/params kinh doanh. ObjectId sai trả 400. Mongo filter xây từ giá trị đã parse và search regex được escape. |
| Rate limit và tài nguyên | IP budget theo process, route nhạy cảm có quota thấp hơn. Body tối đa 1 MiB và pagination có giới hạn. Khi chạy nhiều process hoặc qua proxy cần kiểm tra trusted proxy và quota dùng chung. Reconcile inbox đọc lịch sử order và thêm tối đa 100 mục mới mỗi poll, có thể cần nhiều lượt cho dữ liệu lớn. |
| DTO và log PII | Review public và admin list chọn field cố định. Order của chủ sở hữu có địa chỉ snapshot. HTTP log bỏ query và redact header nhạy cảm. Cần chốt retention cho dữ liệu checkout và order. |
| Webhook | Svix/Stripe xác minh chữ ký trên body gốc. Ghi receipt cùng transaction. Stripe kiểm mode, session, tổng tiền và currency. Delivery đi muộn hoặc thiếu xác nhận có thể cần đối soát. |
| Upload | Signed folder, định dạng, public ID, overwrite=false. API kiểm dung lượng khai báo, trần byte thực tế phụ thuộc luồng upload provider/client. TTL một giờ. |
| Legacy DB | Nếu dùng chung DB sau này, writer legacy có thể vượt qua khóa review của web và thay đổi tồn kho/cart ngoài transaction web. Inbox chỉ thấy timestamp còn lưu trong DB đang kết nối. |

Tham chiếu checklist [OWASP API Security Top 10](https://api-security.owasp.org/editions/2023/en/0x11-t10/).

## Nghiệm thu local

Chạy pnpm lint, pnpm typecheck, pnpm test và pnpm build từ website/. Seed chạy trên Mongo Docker dev và giữ nguyên sản phẩm đã có. Kiểm thử HTTP loopback dùng Mongo thật, tài khoản fixture và Clerk adapter cục bộ. Health, catalogue, inbox, admin list và Swagger trả 200 trong ca tương ứng. Lỗi validation, thiếu token và thiếu cấu hình upload lần lượt trả 400, 401 và 503. Swagger liệt kê 35 thao tác trên 28 đường dẫn của /api/v1.

Lượt nghiệm thu đạt cả bốn lệnh. Vitest chạy 53 test trong 10 suite gồm foundation, env, shared contracts, auth, products, customer, checkout, reviews, notifications và admin. Không có test bị bỏ qua.

File website/.env chưa có khi kiểm tra. Clerk, Stripe Sandbox và upload Cloudinary thật cần cấu hình. Test tự động dùng SDK ký cục bộ và adapter cho cuộc gọi nhà cung cấp. Thử upload provider thật trong account đã cấu hình dynamic folder mode.

Trước Giai đoạn 3, điền Clerk keys và webhook secret, Stripe test key riêng và listener secret, Cloudinary keys và ADMIN_EMAIL theo các file mẫu. Duyệt UI/auth cho frontend ở mốc tiếp theo.
