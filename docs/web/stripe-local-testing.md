# Thử Stripe Checkout cục bộ

Stripe CLI và key API phải thuộc account test riêng cho website. Điền STRIPE_SECRET_KEY và STRIPE_WEBHOOK_SECRET trong website/.env trên máy bạn. Cấu hình đồng thời Clerk application, WEB_ORIGIN và DB dev theo .env.example.

```powershell
stripe login
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to http://localhost:4000/api/v1/webhooks/stripe
```

Dùng signing secret do lệnh listen in ra cho listener cục bộ rồi khởi động lại API. Dashboard dùng signing secret của endpoint riêng. Chọn snapshot events và account của website khi cấu hình webhook ngoài localhost. [Stripe webhook setup](https://docs.stripe.com/webhooks)

1. Từ website/ chạy pnpm db:up, pnpm seed và pnpm dev. Mở Swagger ở localhost:4000/docs/. Lấy session JWT Clerk của tài khoản test bằng ứng dụng Clerk đã đăng nhập và dùng nút Authorize. Giữ token trong máy, tránh commit vào script.
2. Gọi GET /api/v1/products, dùng product ID để POST /api/v1/cart/items, rồi POST /api/v1/addresses với địa chỉ thử. Lấy version từ GET /api/v1/cart và addressId từ danh sách địa chỉ.
3. POST /api/v1/checkout/quote với addressId và version. POST /api/v1/checkout/sessions với cùng body và Idempotency-Key duy nhất từ 8 đến 128 ký tự. Retry dùng lại key, addressId và version của yêu cầu gốc.
4. Mở URL trong response. Thẻ test thành công là 4242 4242 4242 4242 với ngày tương lai và CVC ba chữ số. Có thể dùng 4000 0000 0000 0002 để thử từ chối. Return URL là /checkout/return trên frontend dự kiến. Ở mốc này xác minh bằng API. [Thẻ test Stripe](https://docs.stripe.com/testing)
5. Sau khi listener báo 200, GET /api/v1/checkout/sessions/:id phải trả paid và orderId. Gọi GET /api/v1/orders/:id, đối chiếu giá, số lượng và cart. Từ chối thẻ vẫn có thể thử lại trong hosted session; khoản giữ được giải phóng khi session hết hạn. Để thử hết hạn ngay, dùng Stripe CLI expire cho đúng session test vừa tạo.

```powershell
stripe checkout sessions expire cs_test_REPLACE_WITH_YOUR_SESSION
stripe trigger checkout.session.completed
stripe trigger checkout.session.async_payment_succeeded
stripe trigger checkout.session.async_payment_failed
stripe trigger payment_intent.succeeded
```

Lệnh trigger tạo Stripe fixtures trong account test. Checkout fixtures không có checkoutId nội bộ hợp lệ và được nhận 200 rồi bỏ qua. payment_intent.succeeded cũng được bỏ qua. Để kiểm thử dedup thật, resend event gốc của phiên web tới endpoint test phù hợp hoặc dùng fixture đã ký của suite checkout. [Stripe CLI trigger](https://docs.stripe.com/cli/trigger)
