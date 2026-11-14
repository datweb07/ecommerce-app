# 2.2 Catalogue

| GET dưới /api/v1 | Kết quả |
| --- | --- |
| /products | Lọc q, category, minPrice/maxPrice, minRating, inStock. Sort newest, price tăng dần, rating giảm dần, bestselling. |
| /products/:id | Chi tiết sản phẩm. |
| /products/:id/related | Tối đa 8 sản phẩm cùng category. |
| /products/:id/reviews | Review public gồm displayName, rating, createdAt. |
| /categories | Tối đa 1.000 category phân biệt từ sản phẩm. |

Phân trang mặc định 20, tối đa 100, offset tối đa 10.000. Công khai, cache 30 giây. Tìm kiếm tên không phân biệt hoa thường và escape regex. Câu truy vấn search có giới hạn thời gian do regex substring có thể scan nhiều record.

Xếp hạng bán chạy dùng tối đa 5.000 đơn delivered mới nhất và giữ 1.000 product IDs trong cache tiến trình 30 giây. Sản phẩm ngoài bảng hạng xếp theo thời gian tạo. Giới hạn này giữ aggregation và cache hữu hạn. Kết quả phản ánh mẫu giao hàng gần nhất của DB web.

Các index products/order/review chỉ được thêm. Test explain xác nhận IXSCAN cho index category + price + _id với hint và 2 keys examined trên fixture. Lint, typecheck và 32 test đạt ở mốc 2.2.
