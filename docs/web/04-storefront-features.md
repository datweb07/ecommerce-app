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

## 4.4 Giỏ và yêu thích

Giỏ dùng một khóa cache chung với badge. Lượng tuyệt đối được gửi sau 350 ms cùng version, cập nhật tạm và khôi phục nếu ghi lỗi. Mỗi lần ghi chỉ cho sửa một dòng để tránh gửi hai thay đổi với cùng version. Status của API quyết định điều kiện checkout. Wishlist dùng tổng số từ DTO cho badge và cập nhật danh sách khi bỏ yêu thích.

## 4.5 Tài khoản và địa chỉ

Danh tính lấy từ Clerk. UserProfile nhúng ở trang bảo mật để quản lý hồ sơ và phương thức đăng nhập. Bio và username dùng hồ sơ riêng của storefront. Biểu mẫu địa chỉ dùng schema shared và danh sách trả về sau mỗi thao tác.

## 4.6 Checkout và trang return

`success_url` và `cancel_url` hiện cùng trỏ `/checkout/return?checkoutId=<id nội bộ>`. URL chỉ cho biết phiên nào cần đọc. Phân biệt kết quả theo trạng thái và `requiresReconciliation` từ GET session. Client phải giữ nguyên cặp addressId/version và Idempotency-Key của lần tạo phiên đang retry.

Frontend lưu ý định theo tài khoản trong localStorage trước khi gửi. Backend tăng cart version khi giữ chỗ, nên nút thử lại phiên trước dùng nguyên input đã lưu kể cả sau reload. Tab return chỉ xác nhận paid sau phản hồi API. Polling tăng khoảng chờ từ 2 lên tối đa 16 giây trong cửa sổ 90 giây và dừng khi có trạng thái cuối hoặc đối soát.

## 4.7 Đơn hàng

Danh sách phân trang theo URL. Trang chi tiết đọc private API bằng Bearer server để trả HTTP 404 cho đơn không thuộc tài khoản. Client tiếp tục dùng TanStack Query để cập nhật DTO sau mutation. Tên, giá, ảnh và địa chỉ đọc từ snapshot. DTO chỉ có tổng đã lưu, vì vậy bảng hiển thị giá từng dòng và tổng đơn, không suy ra các khoản phí riêng.

## 4.8 Đánh giá sao

Tạo, sửa và xóa từ các dòng đơn hàng có quyền theo API. Sau mutation, làm mới đơn hàng trong TanStack Query. Catalogue giữ TTL 60 giây cho rating công khai. Cách này tránh thêm endpoint xác thực chỉ để invalidation và phù hợp với tần suất thay đổi đánh giá.

## 4.9 Inbox

Inbox dùng cursor từ API và tải trang tiếp theo theo yêu cầu. Mark read và read-all vô hiệu hóa cả cache danh sách lẫn badge. Polling mỗi 60 giây chỉ chạy khi có phiên và tab hiển thị. Nội dung dựa trên các mốc giao hàng còn lưu trong order.

## Cần nghiệm thu với dịch vụ thật

Các test component thay Clerk và fetch ở ranh giới. Google sign-in, đồng bộ user Clerk, phiên Stripe Sandbox, webhook thật, đơn phát sinh sau thanh toán và thông báo từ các mốc của đơn đó cần chạy bằng credentials của môi trường dev. Dùng [checklist kiểm thử](04-manual-test-checklist.md) để tái hiện.

## Kiểm chứng cuối Giai đoạn 4

- `pnpm lint`, `pnpm typecheck`, `pnpm test` và `pnpm build` chạy từ `website/`. Vitest có 89 test trong 16 suite, 0 skip.

- Playwright trên production loopback với Fastify và Mongo dev xác nhận trang công khai, lọc và Back, metadata, JSON-LD, sitemap, HTTP 404 và redirect private. Axe có 0 vi phạm ở 12 tổ hợp desktop/mobile, sáng/tối.
- JavaScript nén tải từ Next khoảng 343 KiB cho Home, 351 KiB cho Catalogue và 353 KiB cho Detail. Response start trên loopback 17–50 ms. Số đo này không thay thế Lighthouse, LCP hoặc thử trên kết nối chậm.
- Khi có lỗi giữ hàng, UI tải lại giỏ và nêu các dòng được đánh dấu lỗi tại thời điểm tải lại. API hiện chỉ trả mã lỗi chung, nên không thể chỉ đích danh sản phẩm nếu trạng thái tồn kho đã đổi lại trước lần đọc.
