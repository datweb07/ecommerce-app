# 6.5 · Checklist mở bán

Tình trạng bàn giao là cấu hình local và runbook. Hiện có thể chuẩn bị staging với URL hosting mặc định. Xem [hướng dẫn triển khai](09-deploy-guide.md) và lưu bằng chứng mỗi mục vào biên bản phát hành.

## Trước go-live

- [ ] Staging chạy đúng image đã scan. `smoke:deploy`, `e2e:staging`, kiểm admin, webhook và checkout test xanh. Lưu SHA, digest, ngày kiểm và đường dẫn Actions.
- [ ] Có DNS do bạn kiểm soát. Kiểm TLS ở apex, www, API và các hostname Clerk, redirect apex → www và canonical đúng. Xác nhận Clerk Production đã deploy, Google OAuth hoạt động và primary email admin đã được xác minh.
- [ ] Atlas production độc lập với mobile. Web runtime user chỉ truy cập `web_prod`, user index tách riêng, outbound CIDR đúng. Cloud Backup đã bật và đã thử restore sang cluster tạm. Lưu thời gian và điểm phục hồi.
- [ ] Đã chạy dry-run index, duyệt output và apply additive index. Chọn trước image digest và deployment Vercel để rollback.
- [ ] Kiểm webhook Clerk Production bằng thay đổi tài khoản thử. Quyền admin, Bearer, origin lạ bị từ chối, API không cookie, request ID và log đã redact.
- [ ] Enforce CSP đầy đủ sau nghiệm thu trên trình duyệt với Clerk và Cloudinary. Kiểm HSTS, `/docs`, `/openapi.json`, `/_dev/components` và source map production. Hiện CSP tài nguyên vẫn ở Report-Only.
- [ ] **Cổng thanh toán**. Xác minh pháp nhân Stripe live hợp lệ và dùng tài khoản Stripe tách riêng cho web. Có bản API được duyệt hỗ trợ live, không còn khóa thử trên production. Sau khi cấu hình endpoint live, kiểm ít nhất một delivery hợp lệ và đối soát với dashboard. Mục này đang mở. Nếu chỉ duyệt catalogue, giới hạn truy cập và giữ Stripe trống.
- [ ] Uptime, cảnh báo Atlas, webhook và billing hoạt động. Ghi người trực, người duyệt rollback, kênh liên lạc và giờ quyết định.

## Trong phát hành

- [ ] Deploy API bằng digest đã duyệt, chờ ready, rồi phát hành đúng build web. Chạy smoke. Kiểm Clerk, ảnh Cloudinary, và thử một origin lạ.
- [ ] Nếu đủ điều kiện thanh toán, mở soft launch cho nhóm nhỏ. Tạo một đơn giá trị nhỏ được chủ tài khoản chấp thuận, kiểm đơn, giao diện return, kho và webhook. Hoàn tiền và đối soát trên Dashboard theo quy trình tài chính.
- [ ] Tiêu chí chạy thử đề xuất trước khi mở rộng là 10 đơn kiểm soát, không oversell, không đơn trùng, không webhook lỗi chưa giải quyết. Kiểm các tình huống retry bằng staging.

## Sau phát hành

- [ ] Xem logs theo request ID, webhook delivery, tồn kho, phiên cần đối soát. Đo Lighthouse trên domain thật, gồm LCP/CLS/TBT. Đưa bất thường cho người trực.
- [ ] Xác nhận SHA/digest đang phục vụ và thông báo kết quả cho nhóm. Nếu phải lùi, theo [runbook rollback](09-rollback-runbook.md).
