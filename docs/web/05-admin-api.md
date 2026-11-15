# A1 · API quản trị website

Mọi đường dẫn admin dưới `/api/v1/admin` dùng Clerk Bearer và `requireAdmin`. Guard kiểm email chính đã xác minh với `ADMIN_EMAIL`. Mã lỗi chuẩn giữ request ID.

## Nhận diện

`GET /me` dưới prefix admin trả `{id,isAdmin:true}` với `Cache-Control: private, no-store`. Dùng route riêng để giữ hợp đồng hồ sơ customer và chạy cùng guard với API quản trị.

## Đối chiếu admin cũ

Admin cũ có dashboard tổng, danh sách khách, chỉnh sản phẩm và chuyển trạng thái đơn. API cũ trả toàn bộ User ở danh sách khách và cho chọn trạng thái đơn trực tiếp. Admin web dùng DTO theo từng màn hình và transition một chiều với trạng thái kỳ vọng, có moderation đánh giá và banner.
