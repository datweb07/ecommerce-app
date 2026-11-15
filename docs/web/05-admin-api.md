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

## Khách hàng và thống kê

`GET /customers` phân trang, tìm theo tên hoặc email. DTO chỉ có ID nội bộ, tên, email, ngày tạo, số đơn và tổng chi tiêu. Phần tổng hợp đơn chạy một lần cho cả trang. `GET /stats?range=7d|30d|90d` dùng ngày UTC, tính từ đầu ngày đầu tiên đến hết hôm nay, điền số 0 cho ngày trống và cache 60 giây theo khoảng.

Doanh thu là tổng giá trị đơn đã tạo trong khoảng, gồm mọi trạng thái giao hàng. Checkout web chỉ tạo đơn sau xác nhận thanh toán. Tổng khách, sản phẩm và mức tồn là số hiện tại toàn cửa hàng. Top 5 tính theo số lượng mua trong snapshot. Tiền trả theo USD đơn vị chính. Index theo ngày và theo người mua đã được kiểm tra bằng `explain`.

## Banner và upload

`GET /api/v1/banners` trả banner bật và đang hiệu lực, sắp theo `sortOrder`. Mốc bắt đầu bao gồm và mốc kết thúc loại trừ. API và trang chủ đều dùng TTL 60 giây. Khi API lỗi, web dùng banner mẫu. Mảng rỗng hợp lệ ẩn toàn bộ khối. Repo tại thời điểm triển khai chưa có ảnh hoặc config 4.B, nên banner seed dùng ba ảnh từ catalogue mẫu có sẵn.

Admin có `GET/POST /banners`, `PATCH/DELETE /banners/:id`, `PUT /banners/order` với toàn bộ ID hiện có. Một document khóa trong `web_banner_guard` khiến các giao dịch banner tuần tự hóa ở MongoDB. Nhờ đó, reorder nhìn thấy cùng một danh sách và hai lần tạo đồng thời không vượt giới hạn. Đặt `WEB_ORIGIN` trùng origin của `NEXT_PUBLIC_SITE_URL`; URL cùng origin lưu dưới dạng đường dẫn tương đối.

`POST /uploads/signature` nhận `purpose: product | banner` để chọn folder và public ID phía server. Request bỏ qua `purpose` vẫn dùng hợp đồng sản phẩm cũ. Cloudinary dùng Dynamic Folders. Chữ ký còn hiệu lực khoảng 5 phút dựa trên cửa sổ timestamp 1 giờ của Cloudinary. Admin API đọc metadata Cloudinary để xác nhận folder, URL, đúng định dạng, kích thước và số byte thật trước khi gắn ảnh. Ảnh banner tối thiểu desktop 1200×500, mobile 540×675. Byte thật mặc định tối đa 5 MiB. Provider vẫn có thể nhận tệp lớn hơn trước bước lưu, nên ảnh upload bỏ dở cần được quản lý trong Cloudinary. [Thời hạn chữ ký](https://cloudinary.com/documentation/authentication_signatures) · [Cloudinary Admin API](https://cloudinary.com/documentation/admin_api)

## Đánh giá

`GET /reviews` lọc `productId`, `rating` từ 1 đến 5 và phân trang. Tên khách và tên sản phẩm được lấy theo lô. DTO đánh giá dùng tên hiển thị và giữ tên sản phẩm nullable khi sản phẩm đã bị xóa. `DELETE /reviews/:id` tái sử dụng cùng giao dịch xóa và tính lại rating của API khách hàng. Route khách hàng tiếp tục lọc theo chủ sở hữu.

## Danh mục endpoint

| Đường dẫn dưới `/api/v1/admin` | Phương thức |
| --- | --- |
| `/me` | GET |
| `/products` | GET, POST |
| `/products/:id` | GET, PATCH, DELETE |
| `/products/:id/stock` | POST |
| `/orders` | GET |
| `/orders/:id` | GET |
| `/orders/:id/status` | PATCH |
| `/reconciliation` | GET |
| `/customers` | GET |
| `/stats` | GET |
| `/banners` | GET, POST |
| `/banners/:id` | PATCH, DELETE |
| `/banners/order` | PUT |
| `/uploads/signature` | POST |
| `/reviews` | GET |
| `/reviews/:id` | DELETE |

Route công khai mới là `GET /api/v1/banners`. OpenAPI và Swagger UI chạy ở development. Mọi thao tác admin có security scheme Clerk Bearer và response 401/403. Thao tác ghi log `adminId`, `action`, `targetId` và mã lý do nếu chỉnh tồn. API đọc khách hàng và địa chỉ giao đơn chỉ ở route admin có xác thực và dùng `private, no-store`.

## Cấu hình và giới hạn

Đặt `ADMIN_EMAIL` trong cấu hình API, khớp email chính đã xác minh của tài khoản trong cùng Clerk application với web. Dùng `GET /api/v1/admin/me` với Bearer token để xác nhận quyền. Xem [giao diện `/admin`](05-admin-frontend.md) và [checklist tài khoản thật](05-admin-manual-test-checklist.md).

Ảnh legacy giữ URL cũ khi sửa các trường khác của sản phẩm. Với danh sách ảnh mới, API yêu cầu ảnh Cloudinary đã xác minh. Dọn ảnh là best-effort và giữ các ảnh còn được tham chiếu khi kiểm tra. Các kiểm thử quyền và upload dùng adapter fixture, cần nghiệm thu đăng nhập và upload qua tài khoản Clerk và Cloudinary thật.
