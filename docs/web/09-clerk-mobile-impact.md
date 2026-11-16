# 6.5 · Dùng chung Clerk với mobile

Clerk Application có instance Development và Production riêng. Hai instance có key, cấu hình và người dùng riêng. Web trên `*.vercel.app` dùng Development. Nếu mobile đang dùng instance Development đó, cùng một user Clerk có thể đăng nhập ở cả web staging và mobile. Giỏ hàng, đơn và dữ liệu nghiệp vụ vẫn nằm trong DB riêng của mỗi nền tảng. [Clerk environments](https://clerk.com/docs/guides/development/managing-environments)

Khi mở production trên domain do bạn kiểm soát:

1. Tạo và xác minh Clerk Production theo [hướng dẫn triển khai](09-deploy-guide.md). Cấu hình Google và các nhà cung cấp mobile đang dùng, redirect URI và deep link đã được duyệt.
2. Web và Render dùng cùng Production instance. Webhook web trỏ đúng vào API web production. Kiểm tác động endpoint đồng bộ của mobile trước khi chọn ngày chuyển.
3. Nếu muốn mobile production dùng chung tài khoản, phát hành bản mobile có publishable key của **cùng** Production instance, đồng thời cập nhật backend mobile ở một đợt riêng đã duyệt. Đăng nhập lại cần được kiểm vì phiên và user ID của instance Development không tự chuyển sang Production. Khi cần chuyển người dùng cũ, quyết định phương án mapping và migration riêng trước khi đổi khóa.
4. Nếu giữ mobile trên instance cũ, hai app có hai nhóm tài khoản. DB production storefront vẫn tách riêng khỏi DB mobile theo quyết định hiện tại. Không đổi env hoặc phát hành mobile trong đợt triển khai web này.

Quyết định cần bạn xác nhận trước go-live là thời điểm mobile chuyển cùng Production instance, cách xử lý người dùng đang ở Development và phương thức đăng nhập đã nghiệm thu trên cả hai bản. [Clerk deploy production](https://clerk.com/docs/guides/development/deployment/production)
