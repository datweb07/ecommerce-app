# A1 · API quản trị website

Mọi đường dẫn admin dưới `/api/v1/admin` dùng Clerk Bearer và `requireAdmin`. Guard kiểm email chính đã xác minh với `ADMIN_EMAIL`. Mã lỗi chuẩn giữ request ID.

## Nhận diện

`GET /me` dưới prefix admin trả `{id,isAdmin:true}` với `Cache-Control: private, no-store`. Dùng route riêng để giữ hợp đồng hồ sơ customer và chạy cùng guard với API quản trị.

## Đối chiếu admin cũ

Admin cũ có dashboard tổng, danh sách khách, chỉnh sản phẩm và chuyển trạng thái đơn. API cũ trả toàn bộ User ở danh sách khách và cho chọn trạng thái đơn trực tiếp. Admin web dùng DTO theo từng màn hình và transition một chiều với trạng thái kỳ vọng, có moderation đánh giá và banner.
## Sản phẩm

`GET /products` hỗ trợ `q`, `category`, `stockStatus`, `sort`, `page`, `limit` dưới prefix admin. `GET/PATCH/DELETE /products/:id`, `POST /products` và `POST /products/:id/stock` quản lý sản phẩm. `images` trong MongoDB vẫn là mảng URL theo thứ tự ảnh bìa. Metadata Cloudinary nằm ở trường tùy chọn `webImageAssets`; DTO admin cung cấp `imageAssets` riêng.

Chỉnh tồn dùng delta nguyên tử có điều kiện. Khi xóa, giao dịch ghi lên cùng document Product mà checkout ghi lúc giữ hàng rồi kiểm tra phiên pending. MongoDB buộc một giao dịch đọc lại khi hai thao tác tranh chấp, ngăn xóa món vừa được giữ.

Dọn ảnh do web quản lý theo best-effort. Ảnh đã dùng trong snapshot đơn được giữ để đơn cũ vẫn hiển thị. Catalogue có TTL 60 giây. Mọi route admin trả `private, no-store`.

## Đơn hàng

`GET /orders` lọc `status`, `from`, `to`, `q` và phân trang. Ngày là ngày UTC bao gồm hai đầu. Tìm theo mã ObjectId đầy đủ hoặc một phần email, với ký tự biểu thức chính quy được escape. `GET /orders/:id` đọc snapshot, địa chỉ giao, thông tin khách tối thiểu và 8 ký tự cuối mã thanh toán. `PATCH /orders/:id/status` giữ chuyển trạng thái một bước và tạo thông báo trong giao dịch hiện có.

`GET /reconciliation` chỉ đọc các phiên được đánh dấu cần đối soát. DTO cung cấp mã tham chiếu nội bộ, trạng thái, số tiền, thời gian và phần cuối mã thanh toán để đối chiếu thủ công.
