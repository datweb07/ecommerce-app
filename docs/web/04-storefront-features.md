# Giai đoạn 4 · Tính năng storefront

## 4.1 Trang chủ

Trang chủ SSR gọi `GET /categories` và hai truy vấn `GET /products` với sort newest và bestselling. Ba khối có skeleton và xử lý lỗi độc lập, cho phép tải lại qua App Router. Khối lợi ích dùng cấu hình storefront. Bestselling dùng thứ tự API hiện có, bao gồm fallback sắp theo ngày tạo cho sản phẩm chưa có hạng bán.

Ảnh sản phẩm dùng Next Image, giới hạn ở Cloudinary và Unsplash theo allowlist hiện có. URL lỗi và ảnh tải thất bại có trạng thái thay thế.

## 4.2 Danh sách sản phẩm

URL là trạng thái bộ lọc. Server chuẩn hóa từng giá trị bằng schema shared, loại truy vấn lặp, khoảng giá ngược và offset vượt giới hạn. Giá tăng dần theo API. Tìm kiếm chờ 350 ms, đổi bộ lọc sẽ về trang đầu. Trang danh mục/phân trang có canonical, còn truy vấn tìm kiếm và bộ lọc sâu đặt noindex.

## 4.3 Chi tiết, mua hàng và sitemap

Product detail và metadata dùng chung kết quả fetch qua React cache trong một request. Public fetch revalidate sau 60 giây. Sau khi xác thực ObjectId và kiểm tra sản phẩm tồn tại, mới stream phần đánh giá và sản phẩm liên quan. Skeleton Home và Catalogue nằm trong route group riêng để HTTP vẫn trả được 404 khi sản phẩm không tồn tại.

Cart và wishlist chỉ ghi bằng Bearer của Clerk. Nút lưu yêu thích cần đọc qua các trang wishlist cho tới khi tìm thấy ID hoặc hết dữ liệu vì API hiện trả một danh sách phân trang. Kết quả được cache theo phiên. UI rollback khi API từ chối. Cấu hình giới hạn số lượng ở web dùng mặc định 25 và cần khớp với API khi được thay đổi. API vẫn kiểm tra tồn kho và giới hạn tại thời điểm ghi.

Sitemap đọc tối đa 1.000 sản phẩm qua từng trang 100 mục và giữ URL tĩnh khi upstream lỗi. Các trang lỗi ảnh hiển thị trạng thái thay thế. Không thêm đường dẫn ảnh ngoài hai host của Next config.

### Kiểm chứng 4.1–4.3

- Lint, typecheck, test và production build đạt. Vitest có 75 test trong 15 suite, không skip.
- Playwright Edge dùng Fastify và Mongo dev thật. Kiểm tra home, sắp xếp/lọc, phân trang và Back, 404, JSON-LD, Open Graph, sitemap và redirect. Axe WCAG 2/2.1 báo 0 vi phạm trong 12 tổ hợp trang, thiết bị và theme. Screenshot tại `website/.cache/catalogue-smoke/`.
- Đo sơ bộ ở production loopback, mỗi lượt dùng browser context mới. JS nén tải từ `/_next/static/` khoảng 338 KiB cho Home, 347 KiB cho Catalogue và 348 KiB cho Detail. Response start khoảng 14–22 ms trên máy local. Đây là số đo loopback với cache server đã ấm. Giai đoạn 5 còn Lighthouse, LCP và số đo qua mạng chậm.
- Test component mock Clerk và fetch xác nhận rollback giỏ/yêu thích khi mutation lỗi. Luồng Clerk và Stripe thật cần khóa dev của người dùng. Dừng trước 4.4.

## Hợp đồng checkout cho mốc 4.6

`success_url` và `cancel_url` hiện cùng trỏ `/checkout/return?checkoutId=<id nội bộ>`. URL chỉ cho biết phiên nào cần đọc. Phân biệt kết quả theo trạng thái và `requiresReconciliation` từ GET session. Client phải giữ nguyên cặp addressId/version và Idempotency-Key của lần tạo phiên đang retry.
