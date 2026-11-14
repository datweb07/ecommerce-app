# 2.4 Checkout, thanh toán và đơn hàng

| Method | Đường dẫn dưới /api/v1 | Hợp đồng |
| --- | --- | --- |
| POST | /checkout/quote | Bearer. Nhận addressId và version. Trả currency, subtotalCents, shippingCents, taxCents, totalCents. |
| POST | /checkout/sessions | Bearer + Idempotency-Key. Nhận cùng body quote. Trả id nội bộ, status, URL hosted Checkout, expiresAt, orderId, requiresReconciliation. |
| GET | /checkout/sessions/:id | Bearer, chỉ phiên của chính user. |
| POST | /webhooks/stripe | Stripe-Signature trên body JSON nguyên gốc. Trả received: true cho delivery đã xử lý hoặc event ngoài phạm vi. |
| GET | /orders | Bearer, page/limit. |
| GET | /orders/:id | Bearer. Order snapshot và canReview cho từng sản phẩm. |

Mọi private route nhận Clerk Bearer token. Pagination mặc định 20 và tối đa 100. Giá order lưu USD đơn vị chính theo schema legacy. CURRENCY hiện chỉ chấp nhận usd để giữ ngữ nghĩa giá legacy. Quote tính bằng cents, thuế làm tròn half-up đến cent, TAX_RATE có độ chính xác đến 6 chữ số thập phân, giới hạn tổng từ 50 đến 99.999.999 cents. Chỉnh giỏ sau khi lấy version trả 409 khi tạo phiên với version cũ.

## Giữ hàng và tạo order

1. Transaction đọc cart theo user + clerkId, địa chỉ của chính user và giá tồn hiện tại. Gộp dòng legacy trùng, ghi cart version, giữ hàng qua stock >= quantity và tạo bản ghi web_checkout_sessions trong cùng transaction. Mỗi tài khoản có tối đa một phiên pending. Unique index của collection phụ bảo vệ idempotency key, Stripe session ID và payment intent ID.
2. Sau commit gọi Stripe hosted Checkout test mode với thẻ và thời hạn 45 phút. Metadata chỉ có checkoutId. Khóa Stripe dựa trên ID checkout và payload lấy từ snapshot, nên retry sau timeout replay cùng yêu cầu. Client gửi lại cùng key và cùng addressId/version, kể cả version trong giỏ đã tăng bởi lần giữ chỗ.
3. Webhook xác thực chữ ký, test mode, session đã liên kết hoặc metadata checkout ID, số tiền, USD, expiry và trạng thái paid/complete. Transaction ghi receipt, chuyển trạng thái phiên, tạo order và trừ số lượng đã mua khỏi cart. Hai delivery cùng event hoặc hai event cùng session chỉ tạo một order. Chuyển hướng và GET trạng thái đơn thuần đọc dữ liệu.
4. Chỉ trừ item đã checkout theo ID dòng. Thêm cùng sản phẩm trong khi chờ sẽ giữ phần tăng thêm. PATCH quantity tuyệt đối đổi ID dòng, nên lựa chọn mới được giữ nguyên. Dòng xóa rồi thêm lại cũng là lựa chọn mới.
5. Webhook expired hoặc async failed hợp lệ hoàn kho trong transaction nếu phiên vẫn pending. Vòng quét mỗi phút xử lý tối đa 10 bản ghi đã đến hạn, claim bằng nextSweepAt và đẩy lần thử sau 5 phút. Nó hỏi Stripe bằng session ID và chỉ hoàn khi Stripe xác nhận expired. Claim hạn chế gọi API trùng và giúp phiên gặp lỗi tạm thời nhường lượt cho phiên kế tiếp. Mongo transaction là hàng rào chống hoàn kho hai lần.
6. Phiên quá hạn còn thiếu Stripe session ID giữ hàng và bật requiresReconciliation. Đối soát qua log checkoutId, Stripe request theo idempotency key và event timeline. Nếu tìm được session, replay webhook đúng nguồn từ account web. Thanh toán thành công sau khi kho đã được hoàn được ghi payment intent và requiresReconciliation để người vận hành xử lý hoàn tiền thủ công trong Stripe test Dashboard. Không tự sửa kho hay tạo order cho lần thanh toán đó.

Giữ hàng trước khi gọi mạng giúp chống tranh tồn kho. Receipt và các thay đổi DB cùng transaction đảm bảo Stripe có thể retry an toàn nếu ghi order lỗi. Vòng quét trong API dùng cùng transition hoàn kho với webhook và không cần process riêng. Nếu webhook paid bị thất lạc, cần resend từ Stripe để tạo đơn. Phiên chưa xác định kết quả có thể giữ kho đến khi đối soát. Đây là đánh đổi được chọn để tránh hoàn hàng khi khách còn có thể thanh toán.

## Kiểm tra bảo mật và phạm vi

| Kiểm tra | Kết quả và phần cần tiếp tục |
| --- | --- |
| IDOR | Truy vấn private scope theo user và clerkId, địa chỉ scope thêm embedded ID. Kiểm thử truy cập chéo cart, wishlist, addresses, checkout, orders. |
| Validation | Zod strict cho body/query/params, ObjectId lỗi 400, filter regex được escape. Các DTO chọn field cố định. |
| PII | Profile/public review loại email và token, order của chính user có địa chỉ của đơn. Log thanh toán chỉ ghi checkoutId hoặc count. Cần chốt retention cho snapshot địa chỉ khi vận hành. |
| Rate limit | 100/phút mặc định, quote 20 và tạo phiên 10/phút/IP. Webhooks xác thực chữ ký và giới hạn body. Rate limit hiện theo từng process, cần cấu hình reverse proxy/IP đúng nếu triển khai. |
| Webhook | Sai chữ ký trả 400. Event đã verify mà amount/currency/expiry không khớp trả 503 để retry. Event ngoài phạm vi được xác nhận rồi bỏ qua. |
| Legacy | Collection bổ sung dùng web_ prefix. Index sử dụng createIndexes. Dùng chung DB với writer ngoài API web cần audit riêng, nhất là tồn kho và cart version. |

Chữ ký Svix và Stripe được kiểm thử bằng SDK thật với fixture secret. Clerk authentication và Stripe create/retrieve dùng adapter thử trong test. Kiểm tra sandbox thật cần credentials do người dùng cấu hình. Dừng sau 2.4.

Lượt kiểm chứng 14/11/2026 đạt lint, typecheck, test và build. Vitest chạy 46 test trong 7 suite, không skip. `pnpm seed` dùng Mongo dev Docker và giữ nguyên dữ liệu đã có. HTTP qua cổng loopback trả 200 cho health, Swagger, OpenAPI, catalogue và categories, 401 cho orders thiếu token và 400 cho ObjectId sai. OpenAPI có 26 operations trên 20 đường dẫn `/api/v1`.
