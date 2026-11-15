# Giai đoạn 5 · Hạng mục còn mở

| Mức    | Hạng mục                                                                                            | Điều kiện đóng                                                                                                  |
| ------ | --------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Medium | Chưa chạy E2E Clerk, Stripe và Cloudinary.                                                          | Truyền biến test bằng môi trường tiến trình, chạy từng tag và checklist thủ công.                               |
| Medium | Add-to-cart của khách giữ URL quay lại đúng sản phẩm. Hành động thêm vẫn cần bấm lại sau đăng nhập. | Xác nhận trải nghiệm mong muốn và kiểm luồng với Clerk development trước khi quyết định cơ chế tiếp tục intent. |
| Medium | Mobile TBT của các tuyến baseline vượt 200 ms.                                                      | Đo lại với ảnh sản phẩm, Clerk và môi trường staging, so sánh trace trước khi thay đổi kiến trúc.               |
| Medium | CSP đang Report-Only.                                                                               | Kiểm đủ Clerk và Cloudinary, xử lý inline script/style và đo lại cache trước khi enforce.                       |
| Medium | ZAP chưa chạy do Docker lỗi ghi layer và metadata khi ổ C gần đầy.                                  | Xử lý dung lượng Docker, rồi chạy `pnpm security:zap` trên web và API local được cô lập.                        |
| Low    | Sign-in có SEO thấp do trạng thái fallback/noindex.                                                 | Giữ trang đăng nhập ngoài kết quả tìm kiếm, đánh giá riêng chức năng Clerk.                                     |
| Low    | Axe riêng tư, trình đọc màn hình, zoom và quy trình bàn phím mua hàng chưa xác minh thực tế.        | Chạy `@auth` và checklist trên ít nhất một thiết bị và một trình đọc màn hình thật.                             |
