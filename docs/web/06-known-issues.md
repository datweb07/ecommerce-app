# Giai đoạn 5 · Hạng mục còn mở

| Mức    | Hạng mục                                                                                            | Điều kiện đóng                                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Medium | Chưa chạy E2E Clerk, Stripe và Cloudinary.                                                          | Truyền biến test bằng môi trường tiến trình, chạy từng tag và checklist thủ công.                                                  |
| Medium | Add-to-cart của khách giữ URL quay lại đúng sản phẩm. Hành động thêm vẫn cần bấm lại sau đăng nhập. | Xác nhận trải nghiệm mong muốn và kiểm luồng với Clerk development trước khi quyết định cơ chế tiếp tục intent.                    |
| Medium | Mobile TBT của các tuyến baseline vượt 200 ms.                                                      | Đo lại với ảnh sản phẩm, Clerk và môi trường staging, so sánh trace trước khi thay đổi kiến trúc.                                  |
| Medium | Web hosted enforce CSP nền. Chính sách cho script, style và tài nguyên còn ở Report-Only.           | Kiểm đủ Clerk và Cloudinary, xử lý inline script/style và đo lại cache trước khi enforce phần còn lại.                             |
| High   | Thanh toán production chưa được kích hoạt. Adapter chỉ nhận Stripe test event.                      | Xác nhận tài khoản live hợp lệ và duyệt triển khai luồng live riêng. Giữ production giới hạn truy cập nếu dùng để duyệt catalogue. |
| Medium | Chưa kiểm đường đi `X-Forwarded-For` trên hostname Render staging.                                  | Dùng kiểm tra từ hai IP thật và một header giả để xác nhận số hop trước khi áp dụng production.                                    |
| Medium | ZAP chưa chạy do Docker lỗi ghi layer và metadata khi ổ C gần đầy.                                  | Xử lý dung lượng Docker, rồi chạy `pnpm security:zap` trên web và API local được cô lập.                                           |
| Low    | Sign-in có SEO thấp do trạng thái fallback/noindex.                                                 | Giữ trang đăng nhập ngoài kết quả tìm kiếm, đánh giá riêng chức năng Clerk.                                                        |
| Low    | Axe riêng tư, trình đọc màn hình, zoom và quy trình bàn phím mua hàng chưa xác minh thực tế.        | Chạy `@auth` và checklist trên ít nhất một thiết bị và một trình đọc màn hình thật.                                                |

## Triển khai

- Chưa kiểm staging/production trên Vercel, Render hoặc Atlas thật. Sau khi có URL, chạy smoke và E2E hosted. Dùng URL mặc định để kiểm Clerk Development/Stripe test khi chưa có DNS riêng.
- Local đã kiểm quyền theo origin và session được ký bằng Clerk SDK với khóa fixture. Còn cần xác nhận cờ cookie Clerk, proxy hop Render, cache revalidation, webhook delivery và upload thật.
- Docker Desktop hiện không cung cấp Linux engine trên máy kiểm. Image size, Trivy, và diễn tập hai container/SIGTERM cần được xác nhận khi Docker chạy lại hoặc trên CI. Kiểm tra drain và race local không thay bằng chứng container.
