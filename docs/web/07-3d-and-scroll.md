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

## Sau mốc duyệt U2.2

U2.3 sẽ dùng khung poster 4:3 và `PinProgressContext` cho cảnh kiện hàng, với fallback sẵn trong bố cục. React hiện tại là 19.3.1. R3F v9 dành cho React 19 và bản v9.8 ghi nhận hỗ trợ React 19.3. Kiểm lại peer dependencies và typings sau khi chốt thư viện cho giai đoạn tiếp theo. [Tương thích R3F](https://github.com/pmndrs/react-three-fiber/releases)
