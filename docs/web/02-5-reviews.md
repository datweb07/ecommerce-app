# 2.5 Reviews

`POST /api/v1/reviews` nhận productId, orderId, rating và trả 201. `PATCH /api/v1/reviews/:id` nhận rating và trả 200. `DELETE /api/v1/reviews/:id` trả 200. Cả ba dùng Clerk Bearer. Rating là số nguyên 1–5. Đơn phải thuộc người gọi, đã giao và có sản phẩm tương ứng khi tạo review. Review thuộc người khác trả 404.

Transaction ghi vào cùng Product trước khi kiểm tra trùng và tính aggregate. Hai yêu cầu cùng sản phẩm sẽ xung đột ghi và Mongo retry bằng snapshot mới. Review và tổng rating commit cùng nhau. PATCH/DELETE vẫn xử lý review của chính user nếu Product đã bị xóa.

Một review trên mỗi user/product được đảm bảo đối với writer web. Khi audit dữ liệu và sửa các bản trùng hiện có, có thể đề xuất unique index chung trên userId/productId để bảo vệ mọi writer. Hiện chỉ dùng index thường. Lint, typecheck và 48 test đã đạt tại mốc này.
