# Giai đoạn 4 · Tính năng storefront

## 4.1 Trang chủ

Trang chủ SSR gọi `GET /categories` và hai truy vấn `GET /products` với sort newest và bestselling. Ba khối có skeleton và xử lý lỗi độc lập, cho phép tải lại qua App Router. Khối lợi ích dùng cấu hình storefront. Bestselling dùng thứ tự API hiện có, bao gồm fallback sắp theo ngày tạo cho sản phẩm chưa có hạng bán.

Ảnh sản phẩm dùng Next Image, giới hạn ở Cloudinary và Unsplash theo allowlist hiện có. URL lỗi và ảnh tải thất bại có trạng thái thay thế.

## 4.2 Danh sách sản phẩm

URL là trạng thái bộ lọc. Server chuẩn hóa từng giá trị bằng schema shared, loại truy vấn lặp, khoảng giá ngược và offset vượt giới hạn. Giá tăng dần theo API. Tìm kiếm chờ 350 ms, đổi bộ lọc sẽ về trang đầu. Trang danh mục/phân trang có canonical, còn truy vấn tìm kiếm và bộ lọc sâu đặt noindex.

## Hợp đồng checkout cho mốc 4.6

`success_url` và `cancel_url` hiện cùng trỏ `/checkout/return?checkoutId=<id nội bộ>`. URL chỉ cho biết phiên nào cần đọc. Phân biệt kết quả theo trạng thái và `requiresReconciliation` từ GET session. Client phải giữ nguyên cặp addressId/version và Idempotency-Key của lần tạo phiên đang retry.
