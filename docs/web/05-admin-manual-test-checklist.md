# Kiểm thử quản trị bằng tài khoản thật

Chạy từ `website/` theo README. Chuẩn bị MongoDB web, cùng Clerk application cho API và storefront, và Cloudinary web với Dynamic Folders. Đặt `ADMIN_EMAIL` bằng email chính đã xác minh của tài khoản Clerk dùng để quản trị.

| Bước | Kết quả mong đợi | Kiểm tra khi có lỗi |
| --- | --- | --- |
| Mở `/admin/orders?status=pending` khi chưa đăng nhập | Clerk mở trang đăng nhập và giữ URL quay về gồm bộ lọc. | Network ghi HTTP 307 và `Location`. Kiểm tra origin web trong cấu hình Clerk. |
| Đăng nhập bằng tài khoản quản trị và mở `/admin` | Tổng quan tải đủ số liệu. Chọn 7/30/90 ngày đổi URL. | Network kiểm `GET /api/v1/admin/me` và `/admin/stats`. HTTP 403 thì kiểm email chính, xác minh email và `ADMIN_EMAIL`. |
| Tạo sản phẩm có ba ảnh hợp lệ | Upload có tiến trình. Kéo thả tệp vào vùng chọn hoặc dùng picker. Đổi ảnh bìa, lưu, mở lại và thấy đúng thứ tự. | Kiểm request ký rồi POST trực tiếp đến Cloudinary. Lỗi lúc lưu thì xem `requestId` và log API. Kiểm Dynamic Folders và cloud name. |
| Sửa mô tả và tăng/giảm tồn có lý do | Thông tin được lưu. Điều chỉnh quá số lượng còn lại báo lỗi. Catalogue cập nhật sau khi làm mới cache hoặc tối đa TTL 60 giây trong điều kiện bình thường. | Xem PATCH sản phẩm và POST `/stock`, log `product.stock`, và cảnh báo cập nhật cache. |
| Tạo ba banner với hai ảnh mỗi banner | Preview đổi đúng ảnh ở desktop/mobile và đúng theme. Bật/tắt, hẹn lịch, đổi thứ tự qua kéo thả và bàn phím. | Kiểm kích thước tối thiểu, tỉ lệ và request tới `/admin/banners` hoặc `/order`. Form nhập giờ máy, danh sách hiển thị UTC. |
| Chọn lần lượt đích sản phẩm, danh mục và liên kết nội bộ | Từ trang chủ, bấm banner đang hiệu lực để mở đúng đích. Banner tắt hoặc chưa tới giờ biến mất sau khi cache cập nhật. | Xem `GET /api/v1/banners`. Kiểm `WEB_ORIGIN` trùng `NEXT_PUBLIC_SITE_URL`, TTL và mốc thời gian. |
| Chuyển một đơn từ chờ xử lý sang đang giao rồi đã giao | Mỗi lần có xác nhận. Khách thấy thông báo tương ứng. UI chỉ hiện hành động kế tiếp. | Xem PATCH status, request ID, log `order.shipped`/`order.delivered`. Hai tab sửa cùng lúc có thể tải lại khi nhận 409. |
| Xem danh sách khách hàng và lọc/xóa một đánh giá thử nghiệm | Danh sách khách chỉ đọc. Xóa đánh giá có xác nhận và cập nhật điểm sản phẩm. | Kiểm `GET /admin/customers` và `DELETE /admin/reviews/:id`, rồi tải lại trang sản phẩm sau TTL. |
| Đăng nhập tài khoản Clerk thường và mở `/admin` | Giao diện hiển thị 404. API với Bearer hợp lệ của tài khoản thường trả 403. | Kiểm HTTP status và bảo đảm dùng đúng email thử nghiệm. |
| Thử tệp TXT, ảnh quá 5 MiB, hoặc ảnh banner sai tỉ lệ | Form báo lý do và không upload. Nhập đích ngoài site cũng bị chặn. | Nếu gọi API trực tiếp, đối chiếu 400 ở bước xác minh URL, metadata hoặc định dạng. |

Trong Network, lấy `X-Request-Id` hoặc `requestId` trong JSON lỗi và đối chiếu Pino log API. Chrome DevTools có thể hiển thị Bearer token và thông tin Cloudinary. Chỉ sao chép request ID khi báo lỗi.
