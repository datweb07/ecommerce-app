# U2 · Card xòe, ghim cuộn và 3D

## U2.1 · Card lợi ích

`FanCards` lấy nội dung từ `storeBenefits` trong `apps/web/src/config/site.ts`. Ba mặt card xoay −6°, 0° và +6° quanh đáy. Vùng hover và focus là chính ô danh sách cố định. Mặt card không nhận pointer events trong chế độ xòe. Cách này giữ hover ổn định khi mặt card dịch lên 20 px và phóng 1,03 lần. CSS dịch các card kề 24 px, ưu tiên focus bàn phím nếu con trỏ đang ở card khác.

Các card hiện là nội dung thông tin, vì vậy từng ô dùng `tabIndex=0` với nhãn từ tiêu đề để người dùng bàn phím có cùng phản hồi như hover. Cả mô tả và tiêu đề có sẵn trong HTML. Màn hẹp và cảm ứng dùng danh sách dọc để đọc đủ ba mục mà không cần cử chỉ ngang. Reduced motion dùng bố cục phẳng, thành ba cột khi đủ rộng.

## U2.2 · Cách mua sắm tại ShopEase

`PinnedScroll` nhận danh sách `steps` cùng đích bỏ qua. Sửa thứ tự ở `shoppingSteps` trong `apps/web/src/config/site.ts` và sửa nội dung tiếng Việt trong namespace `shoppingGuide` ở `apps/web/src/lib/i18n.ts`. Icon được chọn tại trang chủ. Giữ đích bỏ qua là một phần tử có ID và có thể nhận focus, như `#home-benefits`.

HTML ban đầu là danh sách có thứ tự. Khi đủ chiều rộng và chiều cao, client chỉ mở rộng track nếu cả section nằm dưới vùng đang nhìn. Điều này giữ bố cục hiện hành nếu trang khôi phục vị trí cuộn hoặc mở trực tiếp ở giữa hướng dẫn. Khung sticky dùng chiều cao `100svh` trừ header, với `--header-h` mặc định tương ứng header storefront 64 px và viền 1 px. Track giới hạn ở 400svh. Đặt track trong layout không cuộn hoặc cắt overflow ở tổ tiên.

Một listener scroll passive gom sự kiện bằng rAF và ghi vào `--pin-progress` cùng ref trong `PinProgressContext`. React không render lại theo từng frame. Các bước tăng giảm độ nổi và dịch 12 px. Icon trang trí ở khung 4:3 đổi theo cùng tiến độ. Chọn JS dùng chung thay CSS scroll timeline để có giá trị ref cho cảnh sau và nhất quán trên các trình duyệt cũ hơn. [Hỗ trợ animation-timeline](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/animation-timeline)

| Điều kiện                                                                             | Bố cục                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Từ 768 px, cao ít nhất 500 px, bật chuyển động và section ở dưới viewport khi hydrate | Sticky, chỉ số bước và icon theo tiến độ        |
| Màn hẹp, viewport thấp hoặc reduced motion                                            | Danh sách dọc tự nhiên                          |
| Tắt JavaScript hoặc section đã nằm trong vùng nhìn khi hydrate                        | Danh sách từ SSR, có đủ bốn bước và link bỏ qua |

## Kiểm tra và ngân sách

Từ `website/`, chạy `pnpm lint`, `pnpm typecheck`, `pnpm test --maxWorkers=1`, `pnpm e2e:public` và `pnpm lighthouse --home-only --analyze`. Đặt `STOREFRONT_CAPTURE_UI3D=1` để lưu ảnh vào `website/.cache/ui-3d/`. Trên máy thiếu bộ nhớ, xác nhận `pnpm typecheck` rồi dùng `STOREFRONT_E2E_SPLIT_BUILD=1` để Next compile và generate production trong hai tiến trình tách biệt.

Mục tiêu U2 là JS tải ban đầu của trang chủ tăng tối đa khoảng 5 KB, điểm Lighthouse mobile giảm tối đa 3 điểm, LCP dưới 2,5 s, CLS dưới 0,1 và TBT dưới 200 ms. Đường cơ sở mobile đã vượt ngưỡng LCP/TBT từ trước. Các phép đo trước và sau dùng cùng route, API seed cô lập và ba lượt cho mỗi thiết bị.

| Trang chủ         | Performance |    LCP | CLS |    TBT |
| ----------------- | ----------: | -----: | --: | -----: |
| Trước U2, mobile  |          75 | 4,24 s |   0 | 428 ms |
| Trước U2, desktop |          99 | 0,90 s |   0 |   0 ms |

Report đường cơ sở và đồ thị bundle nằm ở `website/.cache/ui-3d/before/`. Lint, typecheck và Vitest của U2.1 đã đạt với 153 test trên 34 suite. Sau U2.2, lint và typecheck vẫn đạt, Vitest đạt 157 test trên 35 suite, không skip. Unit test kiểm góc và nội dung card, tiến độ ghim, fallback và cleanup listener.

Lượt Playwright sau U2.2 dừng trước khi chạy browser test vì Next báo `spawn UNKNOWN` khi tạo tiến trình con trên Windows. Lần chạy lại ngoài sandbox chưa được cấp phép. Chưa có ảnh sau, kết quả axe, bằng chứng đo hình học card/khung ghim hoặc Lighthouse/bundle sau U2.2. Vì vậy chưa thể kết luận đạt ngân sách hiệu năng hoặc xác nhận giao diện trên thiết bị cảm ứng thật.

## U2.3 · Hình minh họa 3D

`HeroObject` nằm bên phải phần mở đầu trên màn hình rộng. Tiêu đề và nút vẫn là nội dung chính. `PackageScene` nằm trong khung ghim và dùng bốn mốc xoay, mở nắp, đóng nắp và hiện vòng theo dõi. `EmptyObject3D` là hình tĩnh trong cảnh 3D ở trang 404. Cả ba có poster SVG 4:3 tạo trong dự án và không nhận focus hay sự kiện con trỏ.

Các poster được render cùng HTML. Client chờ trang tải xong và trình duyệt rảnh, với vùng quan sát 200 px, rồi chỉ tải canvas khi cảnh nằm trong viewport. Tối đa hai canvas được cấp chỗ cùng lúc. Xóa canvas khi cảnh ra khỏi viewport, tab ẩn hoặc rời route. Cảnh kiện hàng render khi tiến độ đổi, cảnh 404 render khi cần, và hero chỉ duy trì animation khi đang hiện. Khi mất WebGL context, poster hiện lại và canvas được thử khởi tạo lại một lần cho lượt hiển thị đó.

| Điều kiện                                                                                                            | Nội dung hiển thị                          |
| -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| JavaScript tắt, WebGL2 không dùng được, tiết kiệm dữ liệu, giảm chuyển động hoặc máy báo tối đa 2 CPU logic/2 GB RAM | Poster SVG                                 |
| Đang tải, hết chỗ canvas hoặc mất WebGL context                                                                      | Poster SVG                                 |
| Hero dưới breakpoint `lg`                                                                                            | Khối văn bản và nút                        |
| Hướng dẫn đang ở bố cục danh sách                                                                                    | Bốn bước bằng chữ, giữ nguyên hành vi U2.2 |

Muốn chỉnh hình, sửa poster trong `apps/web/src/components/scene/scene-3d.tsx` và hình khối trong `scene-canvas.tsx`. Chỉnh các mốc của kiện hàng trong `apps/web/src/lib/scene-motion.ts`. Cảnh mới dùng lại wrapper poster và loader. Cảnh phụ thuộc cuộn có thể đọc ref hiện có qua `PinProgressContext` và yêu cầu vẽ khi section phát `pinprogress`. Xem ba cảnh và hàng poster mô phỏng giảm chuyển động tại `/_dev/components` trong dev, dùng nút theme ở header để đổi sáng/tối.

`three@0.187.0` cung cấp WebGL và hình học. `@react-three/fiber@9.8.0` quản lý canvas và lịch render theo nhu cầu. Peer của Fiber chấp nhận React/React DOM 19.3.1 và Three.js 0.187.0. `@types/three@0.187.0` dùng lúc kiểm tra kiểu. Các package này dùng MIT và được pin trong lockfile. Hình học thủ tục và ánh sáng cơ bản đủ cho cả ba cảnh, vì vậy không cần Drei, model, texture hay tài nguyên ngoài. [Tương thích React Three Fiber](https://github.com/pmndrs/react-three-fiber/releases)

Kiểm tra nhanh U2.3 gồm lint, typecheck và Vitest cho nội suy kiện hàng, điều kiện dùng poster, card lợi ích và ghim cuộn. Chưa đo kích thước chunk, chạy production build, Lighthouse, axe, hoặc xác nhận WebGL và khôi phục context trong trình duyệt.
