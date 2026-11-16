# 6.5 · Rollback và sự cố thanh toán

Trước khi phát hành, lưu SHA, digest API, ID deployment Vercel, thời gian phát hành và người quyết định. Duy trì ít nhất ba bản đã chạy ổn và quyền dùng **Manual Deploy** hoặc rollback trong dashboard. Dùng digest để xác định chính xác image.

| Triệu chứng                                       | Hành động                                                                                                                                                                                                               | Kiểm lại                                                                                                                                                             |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| SSR lỗi hàng loạt sau bản web mới, API còn ready  | Vercel → project → Deployments → chọn bản ổn → Rollback hoặc Promote theo quyền/gói. Xác nhận alias và môi trường build đã nhúng                                                                                        | Homepage, canonical, đăng nhập, SSR và smoke vào origin thực                                                                                                         |
| API không ready hoặc nhiều 5xx ngay sau phát hành | Render → service → Events/Deploys, chọn bản tốt. Đối chiếu image digest trong bản phát hành hoặc trỏ lại đúng reference bất biến trước khi deploy lại                                                                   | Liveness, readiness, catalogue, API private, webhooks. Kiểm Atlas trước nếu cả bản mới và cũ cùng lỗi                                                                |
| Webhooks lỗi, thanh toán có nhưng chưa thấy đơn   | Dừng phát hành kế tiếp. Nếu có cơ chế tắt checkout đã duyệt thì dùng ngay. Hiện chưa có cơ chế đó, hãy giới hạn truy cập storefront gây ảnh hưởng theo công cụ đã cấu hình, giữ API webhook hoạt động và báo người trực | Stripe Dashboard → event/session/PaymentIntent. So với order, tồn kho và `GET /api/v1/admin/reconciliation`. Gửi lại đúng sự kiện sau khi sửa nếu trạng thái yêu cầu |
| Index hoặc dữ liệu sai                            | Dừng thao tác ghi đang gây lỗi. Rollback ứng dụng tương thích schema khi thay đổi chỉ additive. Khôi phục backup **sang cluster riêng** để kiểm và trích dữ liệu cần đối soát                                           | Kiểm đơn/Stripe sau thời điểm backup. Không restore đè DB đang có đơn đã thanh toán                                                                                  |

Tại phút thứ 10 kể từ khi phát hiện lỗi nghiêm trọng, người trực chọn rollback bản phát hành nếu đã có bản tốt xác định được. Nếu checkout có rủi ro tài chính, cô lập việc nhận đơn mới ngay và báo người chịu trách nhiệm đối soát. Dùng mã session/order/event và request ID trong biên bản. Hàm idempotent cho phép xử lý lại đúng event theo trạng thái, nhưng vẫn kiểm kết quả trước khi gửi tiếp hoặc hoàn tiền.

Mẫu biên bản

- Mốc thời gian và người phụ trách
- Triệu chứng, số request lỗi và mã tham chiếu
- Bản lỗi, bản phục hồi, digest/API và deployment ID/web
- Số thanh toán/đơn cần đối soát, người xử lý và hạn xử lý
- Kết quả smoke và bước phòng ngừa tái diễn

[Vercel rollback](https://vercel.com/docs/deployments/instant-rollback) · [Render rollback](https://render.com/docs/rollbacks) · [Atlas Cloud Backup](https://www.mongodb.com/docs/atlas/backup-restore-cluster/) · [Stripe xử lý webhook](https://docs.stripe.com/webhooks)
