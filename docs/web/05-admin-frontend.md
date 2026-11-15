# A2 · Giao diện quản trị

`/admin` dùng cùng document layout, Clerk, query provider và design system của ShopEase. Route group `(storefront)` chỉ bọc các trang mua hàng hiện có để admin dùng shell riêng mà giữ các URL cũ. Admin có sidebar desktop và drawer mobile, nút đổi theme, tài khoản Clerk và liên kết về cửa hàng.

Proxy bảo vệ đường dẫn `/admin` và mọi route con, giữ URL trở về và đặt `private, no-store` cùng `noindex`. Layout gọi `GET /api/v1/admin/me` từ server và dùng trang 404 khi API trả 403. API vẫn kiểm quyền ở mọi lần đọc/ghi. Các truy vấn TanStack Query được cô lập theo phiên Clerk, API client đặt `no-store`. Robots chặn `/admin` và sitemap chỉ chứa các URL công khai.

Tổng quan dùng cùng hợp đồng thống kê A1, hiển thị 7/30/90 ngày qua URL. Biểu đồ SVG có bản dữ liệu theo ngày để đọc bằng thiết bị hỗ trợ. Các bảng có vùng cuộn ngang nhận focus và tiêu đề cột. Tìm kiếm và phân trang dùng URL.

`/admin/orders` lọc theo trạng thái, ngày UTC và email hoặc mã đơn. `/admin/orders/[id]` hiển thị các mốc vận chuyển, địa chỉ và trực tiếp gửi trạng thái kỳ vọng sau khi xác nhận. HTTP 409 tải lại chi tiết. `/admin/customers` chỉ đọc khách hàng. `/admin/reviews` lọc theo mã sản phẩm và sao, yêu cầu xác nhận xóa.

`/admin/products` dùng bộ lọc, sắp xếp và phân trang qua URL. `/admin/products/new` và `/admin/products/[id]` dùng resolver Zod từ shared. Có thể kéo thả hoặc chọn ảnh, sắp xếp bằng nút và đặt ảnh bìa. Giao diện dùng giới hạn mặc định 5 ảnh × 5 MiB và tuân thủ giới hạn nhỏ hơn từ upload signature. Ảnh legacy giữ nguyên khi lưu các trường khác.

Upload gửi dữ liệu trực tiếp sang Cloudinary với chữ ký do API cấp. `XMLHttpRequest` cung cấp tiến trình upload; API kiểm lại metadata trước khi gắn ảnh. Chỉnh tồn đi qua endpoint delta. Sau thay đổi, Server Action chỉ chấp nhận tag cố định và kiểm quyền qua Admin API trước khi yêu cầu Next làm mới cache. Lỗi làm mới cache chỉ báo cảnh báo.

`/admin/banners`, `/admin/banners/new` và `/admin/banners/[id]` hỗ trợ ảnh desktop/mobile, xem trước, đích nội bộ và lịch hiệu lực. Form đọc thời gian theo giờ máy và gửi ISO UTC. Ảnh được kiểm định dạng, dung lượng, kích thước tối thiểu và sai số tỉ lệ 3%. Kéo thả và các nút lên/xuống cùng gửi thứ tự đầy đủ trong một lệnh. Xem trước dùng `StorefrontBanner` với chế độ ép khổ và theme, giữ bề mặt phẳng của storefront hiện tại.
