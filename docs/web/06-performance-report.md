# 5.3 · Hiệu năng

`pnpm lighthouse` build Next production cùng API local và MongoDB tạm. Lighthouse 13.6.0 đo ba lần cho mỗi URL và cấu hình mobile/desktop. JSON, HTML và trung vị nằm trong `website/.cache/lighthouse/<id>/`. Dùng `pnpm lighthouse --home-only --analyze` để đo lại trang chủ và xuất đồ thị Turbopack. [Turbopack Bundle Analyzer](https://nextjs.org/docs/app/guides/package-bundling)

## Đường cơ sở

Khóa Clerk chưa có trong tiến trình. Trang đăng nhập là thông báo cấu hình của storefront. Catalogue có 24 sản phẩm seed. Chi tiết sản phẩm seed dùng placeholder ảnh, vì vậy LCP dưới đây chưa đại diện cho media từ Cloudinary.

| Thiết bị | Trang     | Performance | A11y | Best Practices | SEO | LCP (ms) | CLS | TBT (ms) |
| -------- | --------- | ----------: | ---: | -------------: | --: | -------: | --: | -------: |
| Mobile   | Home      |          76 |  100 |             92 | 100 |     4348 |   0 |      371 |
| Mobile   | Catalogue |          93 |  100 |             92 | 100 |      912 |   0 |      330 |
| Mobile   | Danh mục  |          88 |  100 |             92 | 100 |      911 |   0 |      485 |
| Mobile   | Chi tiết  |          94 |  100 |             92 | 100 |      912 |   0 |      277 |
| Mobile   | Đăng nhập |          95 |  100 |             92 |  63 |      911 |   0 |      247 |
| Desktop  | Home      |          99 |  100 |             92 | 100 |      824 |   0 |        4 |
| Desktop  | Catalogue |         100 |  100 |             92 | 100 |      251 |   0 |        0 |
| Desktop  | Danh mục  |         100 |  100 |             92 | 100 |      252 |   0 |        0 |
| Desktop  | Chi tiết  |         100 |  100 |             92 | 100 |      253 |   0 |        0 |
| Desktop  | Đăng nhập |         100 |  100 |             92 |  63 |      251 |   0 |        0 |

Lighthouse xác định ảnh banner đầu là LCP trên mobile. Ảnh có trong HTML nhưng gắn `loading=lazy` và thiếu ưu tiên mạng. Web hiện dùng `loading=eager` và `fetchPriority=high` cho ảnh đầu; giữ art direction của `picture` và chỉ mount ảnh khi slide hiện. Tắt prefetch trên liên kết carousel để tập trung mạng cho slide đang xem. Thêm favicon để xử lý request 404 xuất hiện trong audit console.

## Trang chủ sau sửa

| Thiết bị | Performance | Best Practices |    LCP (ms) |   CLS |  TBT (ms) |
| -------- | ----------: | -------------: | ----------: | ----: | --------: |
| Mobile   |     76 → 79 |        92 → 96 | 4348 → 4073 | 0 → 0 | 371 → 395 |
| Desktop  |     99 → 99 |        92 → 96 |   824 → 861 | 0 → 0 |     4 → 2 |

Các trung vị trong bảng dùng ba lượt hợp lệ cho mỗi thiết bị. Desktop lấy từ lần hậu kiểm đầu, mobile từ lần kế tiếp. Chrome không đọc được trace desktop trong lần kế tiếp khi ổ C gần hết dung lượng. Sau khi chuyển temp sang ổ D, cả ba bài kiểm tra hiệu năng, explain và tải nhẹ đều đạt ở mức thực thi. Lần này mobile đạt 60 điểm, LCP 4207 ms và TBT 1497 ms, desktop đạt 99 điểm, LCP 889 ms và TBT 9 ms. Hai lần hậu kiểm mobile còn lại lần lượt đạt 69 và 79 điểm. LCP discovery sau sửa đạt cả ba kiểm tra về phát hiện trong HTML, eager và ưu tiên, nhưng chưa có cải thiện điểm mobile ổn định. Mobile vẫn dưới mục tiêu Performance 90, LCP vẫn trên 2,5 giây và TBT trên 200 ms.

Turbopack analyzer ghi client nén khoảng 551 KiB cho trang chủ, 550 KiB cho catalogue và 553 KiB cho trang chi tiết, gồm asset tải theo điều kiện. Lighthouse quan sát khoảng 385 KiB JavaScript truyền thực tế trên trang chủ mobile. Giữ đồ thị để điều tra các module chiếm CPU.

## API local

| Route                                       | Mẫu | p50 (ms) | p95 (ms) | Lỗi |
| ------------------------------------------- | --: | -------: | -------: | --: |
| `/products?limit=12`                        |  25 |     11.8 |     15.9 |   0 |
| `/products?category=Electronics&sort=price` |  25 |      9.6 |     12.5 |   0 |
| `/products?sort=bestselling`                |  25 |     11.9 |     17.6 |   0 |

Mỗi nhóm đo bằng 5 request đồng thời, sử dụng giới hạn hiện có. Số đo trên dataset nhỏ chỉ có giá trị kiểm tra hồi quy cục bộ. Script xuất `mongo-explain.json` cho các hình dạng truy vấn catalogue, tìm kiếm, đơn theo chủ, thống kê và nguồn bán chạy.

MongoDB chọn index cho cả năm hình dạng truy vấn. Catalogue dùng `category_1_price_1__id_1`, bestsellers dùng `status_1_createdAt_-1__id_-1`. Regex tìm kiếm dùng index thứ tự tạo và lọc tên sau khi đọc document, nên tìm từ khóa hiếm vẫn có thể quét nhiều bản ghi. Bộ seed hiện không có đơn, nên ba truy vấn đơn chỉ xác nhận được lựa chọn kế hoạch.
