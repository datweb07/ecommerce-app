# 4.R · Minimalist redesign

Token nằm ở `website/apps/web/src/app/globals.css`. Tailwind đọc token semantic qua `@theme inline`. Clerk và Sonner dùng cùng biến CSS.

## Bảng màu

| Token           | Sáng              | Tối               |
| --------------- | ----------------- | ----------------- |
| Nền             | #FAFAF9           | #121212           |
| Chữ chính       | #111111           | #F5F5F4           |
| Chữ phụ         | #666666           | #A3A3A3           |
| Bề mặt ảnh      | #F3F2F0           | #212121           |
| Đường phân vùng | #E7E5E4           | #262626           |
| Viền điều khiển | #898785           | #737373           |
| Focus           | #4D6473           | #A1BAC9           |
| Nút chính       | #111111 / #FFFFFF | #F5F5F4 / #111111 |

Viền điều khiển có độ tương phản cao hơn đường phân vùng. Màu trạng thái chỉ nằm ở chấm nhỏ, đi cùng nhãn. Điều chỉnh palette trong hai khối `:root` và `.dark`.

## Chữ, bo góc và khoảng cách

- Inter tự host qua next/font với Latin và Vietnamese. Thang chữ 12, 14, 16, 20, 28, 40, 56 px. Hero và tiêu đề chính dùng 500. Body 16 px với leading thoáng.
- Bo góc 6 px cho điều khiển và lớp nổi. Ảnh sản phẩm dùng 2 px. Bố cục và danh sách phẳng.
- Khoảng cách theo bước 4 hoặc 8 px. Trang rộng tối đa 1280 px. Các khối trang chủ cách 64 px trên mobile và 112 px trên desktop.
- Focus ring 2 px với offset 2 px. Chuyển màu 150 ms. Ảnh phóng nhẹ 200 ms khi hover và tôn trọng reduced motion.

## Mẫu sử dụng

| Thành phần        | Dùng                                                                                                             | Tránh                                     |
| ----------------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| Nút               | Một thao tác chính trong mỗi cụm, nút phụ viền, link gạch chân                                                   | Cả cụm dùng nền đậm                       |
| Card và danh sách | Dùng khoảng trắng hoặc một đường phân vùng                                                                       | Lồng nhiều khung trong cùng một khối      |
| Form              | Label trên ô, nền phẳng, focus thấy rõ                                                                           | Nền đặc làm ô nhập lấn phần nội dung      |
| Dialog và Sheet   | Bề mặt phẳng, đường viền, focus được trả về trigger                                                              | Kính mờ hoặc bóng                         |
| Ảnh và danh mục   | Ảnh sản phẩm thật hoặc danh mục dạng chữ khi API chỉ có tên                                                      | Ảnh stock đại diện cho dữ liệu không có   |
| Trạng thái        | Chữ đi cùng chấm màu                                                                                             | Chỉ dựa vào màu                           |
| Giá               | USD hiển thị $49 hoặc $49.50. Cents chia 100 trước khi định dạng. VND hỗ trợ hiển thị số nguyên trong formatter. | Tính lại tổng checkout từ chuỗi đã format |

Hero dùng chữ và hai lối điều hướng. Catalogue giữ filter, sort và pagination hiện có. Nút biểu tượng yêu thích trên ô sản phẩm mở đúng vùng mua hàng ở chi tiết, nơi thao tác wishlist hiện có tiếp tục xử lý. Không thêm truy vấn membership trên mỗi thẻ.

Card xòe dùng mặt `--muted`, viền 1 px và bo 4 px. Mỗi card có một vùng hover và focus đứng yên. Chỉ mặt card dịch chuyển để con trỏ vẫn ở trong vùng nhận tương tác. Tiêu đề và icon nằm trong phần căn trái cách mép chồng. Màn hình hẹp hoặc cảm ứng hiển thị danh sách dọc và reduced motion dùng lưới phẳng.

Ghim cuộn chỉ dùng cho hướng dẫn tuần tự. Nội dung vẫn là danh sách có thứ tự và dùng được khi JavaScript tắt. Đặt một liên kết bỏ qua có thể focus, giữ header ở trên khung ghim và dùng khung minh họa phẳng có tỉ lệ cố định. [Thiết kế U2](07-3d-and-scroll.md)

Cảnh 3D là minh họa, dùng màu từ token, vật liệu mờ và đường cạnh mảnh. Dành sẵn khung có tỉ lệ cố định cho poster và canvas. Đặt thông tin cần đọc và thao tác ở HTML bên cạnh. [Fallback và cấu hình 3D](07-3d-and-scroll.md)

Địa cầu dùng khung vuông trong suốt, chấm đơn sắc và nút mở vị trí có thể dùng bằng bàn phím. Poster chiếm cùng chỗ với canvas. Cử chỉ ngang trên cảm ứng chỉ xoay địa cầu và vẫn cho cuộn dọc. [Địa cầu U3](08-globe.md)

Ảnh trước và sau nằm tại `website/.cache/redesign/before` và `website/.cache/redesign/after`.

## Kiểm chứng

- Mỗi thư mục có 16 ảnh của trang chủ, catalogue, chi tiết và thư viện component ở sáng/tối, desktop 1440px và mobile 390px.
- Axe WCAG 2/2.1 A và AA báo 0 vi phạm trong 16 lượt quét trang và 4 lượt quét hộp thoại tìm kiếm. Kiểm tra tablet 768px, Enter để tìm và Escape trả focus về nút.
- Edge xác nhận hai chuỗi “Sản phẩm bán chạy” và “Đồng hồ tối giản” dùng glyph Inter. Vỏ form Clerk đang render có bo góc 6 px và không đổ bóng.
- Lint, typecheck, test và build đạt. Vitest chạy 89 test trong 16 suite với một worker để giảm bộ nhớ.
