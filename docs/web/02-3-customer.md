# 2.3 Cart, wishlist và địa chỉ

- `GET /api/v1/cart`, `POST /api/v1/cart/items`, `PATCH/DELETE /api/v1/cart/items/:productId`, `DELETE /api/v1/cart`. POST cộng quantity và PATCH đặt quantity tuyệt đối, với version tùy chọn. Các thao tác trả cart cùng version mới. GET giỏ chưa tạo trả version 0 và mảng rỗng. Item có trạng thái available, deleted, out_of_stock hoặc insufficient_stock.
- `GET /api/v1/wishlist` phân trang. `PUT/DELETE /api/v1/wishlist/:productId` có thể lặp, PUT kiểm tra sản phẩm tồn tại. Sản phẩm đã bị xóa được bỏ khỏi DTO, total tính số tham chiếu lưu trong wishlist.
- `GET/POST /api/v1/addresses`, `PATCH/DELETE /api/v1/addresses/:id` trả danh sách của người gọi. Tối đa một địa chỉ mặc định. Khi người dùng xóa hoặc tắt địa chỉ mặc định, họ có thể chọn lại sau.

Cart và addresses đọc và ghi mảng trong cùng transaction. Mongo retry transaction bị write conflict, nên hai yêu cầu đồng thời không ghi đè lượng thêm hoặc tạo hai địa chỉ mặc định. Wishlist dùng $addToSet và $pull. Truy vấn cart dùng cả user ObjectId và Clerk ID, còn truy vấn địa chỉ dùng thêm ID địa chỉ trong user document. Giỏ legacy thiếu version được đọc là version 0.

CART_MAX_QUANTITY mặc định 25 trên mỗi sản phẩm, ADDRESS_MAX_COUNT mặc định 10. PATCH số lượng tuyệt đối đổi cart item ID để xử lý checkout đang chờ mà người dùng vừa sửa dòng hàng. Lint, typecheck và 37 test đã đạt.
