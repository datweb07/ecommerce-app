# 2.6 Inbox thông báo

- `GET /api/v1/notifications` nhận limit (20 mặc định, 100 tối đa) và cursor từ nextCursor. Trả items, unreadCount trên toàn inbox đã ghi nhận và nextCursor.
- `PATCH /api/v1/notifications/:id/read` trả thông báo đã đọc. Gọi lại trả thời điểm đọc ban đầu.
- `POST /api/v1/notifications/read-all` trả cutoff UTC và readCount. Cả ba route giới hạn dữ liệu theo người gọi.

Inbox dùng unique index userId + orderId + status trên web_notifications. GET đối chiếu shippedAt/deliveredAt của đơn hàng theo cả user và Clerk ID. Mỗi lần đọc thêm tối đa 100 sự kiện còn thiếu. Cursor sắp theo thời điểm ghi nhận và ID để phân trang ổn định khi các bản ghi trùng thời gian.

occurredAt là thời điểm đổi trạng thái. createdAt là thời điểm API ghi nhận sự kiện. Read-all đánh dấu thông báo đã ghi nhận trước mốc giờ server và giữ nguyên mục mới được đồng bộ sau mốc đó. Các mục trùng đúng mili giây với cutoff vẫn chưa đọc. GET tiếp theo sẽ bổ sung dữ liệu còn thiếu.

Đồng bộ chỉ khôi phục các mốc còn lưu trên order. Legacy có thể thay đổi nhiều lần giữa hai lượt đọc và xóa hoặc bỏ qua mốc trung gian. DB web riêng chỉ thấy bản ghi order có trong DB web. Lint, typecheck và 50 test đạt ở mốc 2.6.
