# Giai đoạn 0 — Phân tích repo và kế hoạch customer storefront

Ngày kiểm tra: 27/10/2026. Checkout: `09221f5` (`Merge pull request #30 from datweb07/feat-notifications`). Trạng thái: **chờ duyệt kế hoạch; chưa triển khai Giai đoạn 1**.

> Cập nhật sau duyệt: kế hoạch đã được duyệt với các điều chỉnh tại [01-foundation.md](01-foundation.md). Quyết định mới ghi đè các mặc định trong mục 9–10 của tài liệu lịch sử này: dev/test DB riêng, Stripe test/account riêng, cấu hình giá qua env và ưu tiên cơ chế checkout đơn giản. Phân tích backend cũ bên dưới vẫn giữ nguyên.

## 1. Phạm vi và cơ sở kiểm chứng

- Đối chiếu source backend (server, toàn bộ routes/controllers/models/middleware/config/service), mobile (routes, hooks, components, types, services), admin (routes, API client, pages, layout), manifests, cấu hình build/lint, README và sơ đồ `docs/diagram.png`.
- Inventory bằng `git ls-files`, `rg --files`, rà soát khai báo route, tham chiếu API và biến môi trường. Không thấy `AGENTS.md` áp dụng trong workspace. Không đọc nội dung `.env` thật, không khởi động dịch vụ bằng credentials hiện có, không gọi API production.
- Đọc thêm implementation SDK đã cài cho `@clerk/express` và Inngest 3.48.1 để kiểm chứng hành vi auth/handler, không suy đoán từ tên hàm.
- Các hợp đồng dưới đây là **hành vi suy ra từ source**, không phải OpenAPI đã tồn tại hay kết quả gọi API. Không có quyền kiểm chứng live DB indexes, dữ liệu thực, webhook subscriptions, Clerk Dashboard hoặc cấu hình Render. Collection names là quy ước Mongoose từ model name; cần xác minh khi kết nối DB được phép.
- Không sửa `mobile/`, `backend/`, `admin/`, root scripts hay lockfiles cũ. Giai đoạn này chỉ thêm tài liệu này.

## 2. Cây thư mục và vai trò

```text
ecommerce-app/
├── package.json                 # npm build backend deps + admin; start Express
├── README.md                    # giới thiệu 3 ứng dụng; chưa có hướng dẫn storefront
├── .gitignore                   # node_modules, .env; chưa bao phủ mọi .env.*
├── .vscode/settings.json        # cấu hình editor
├── backend/                     # Express 5, JS ESM, Mongoose 8
│   ├── package.json, package-lock.json
│   └── src/
│       ├── server.js            # mounts, raw Stripe body, CORS, Clerk, static admin
│       ├── config/
│       │   ├── env.js, db.js    # dotenv, ENV, Mongo connection
│       │   ├── cloudinary.js    # Cloudinary SDK
│       │   └── inggest.js       # Inngest Clerk created/updated/deleted functions
│       ├── middleware/         # protectRoute, adminOnly, multer disk upload
│       ├── models/             # User, Product, Cart, Order, Review
│       ├── routes/             # admin, user, product, cart, order, review, payment
│       ├── controllers/        # logic tương ứng 7 nhóm route
│       └── services/notification.service.js # Expo push cập nhật giao hàng
├── mobile/                      # Expo SDK 54, React 19.1, RN 0.81, Expo Router
│   ├── app/
│   │   ├── _layout.tsx          # Clerk/token cache, Query, Stripe, Sentry, push init
│   │   ├── (auth)/             # splash + Google/Apple SSO; auth layout
│   │   ├── (tabs)/             # shop, cart/checkout, profile; bảo vệ bằng Clerk
│   │   ├── (profile)/          # edit, addresses, orders, wishlist, notifications,
│   │   │                       # privacy-security, activity, data-export
│   │   ├── product/[id].tsx    # chi tiết sản phẩm
│   │   └── sso-callback.tsx    # điều hướng sau SSO
│   ├── hooks/                  # Query/mutations cho từng nghiệp vụ + social auth
│   ├── components/             # grid, rating/address modals, states, summary
│   ├── lib/                    # Axios Bearer token, định dạng ngày/trạng thái
│   ├── services/               # Expo permissions/token/listeners/navigation
│   ├── types/                  # DTO TS và activity type
│   ├── assets/images/          # ảnh minh họa, icon, splash, category
│   └── app.config.js, app.json, eas.json, tsconfig.json,
│       metro.config.js, babel.config.js, tailwind.config.js,
│       eslint.config.js, global.css, nativewind-env.d.ts, .vscode/, README.md
├── admin/                       # React 19.2 + Vite 7 + React Router 7
│   ├── src/
│   │   ├── main.jsx, App.jsx    # Clerk, Query, Sentry, routing
│   │   ├── pages/              # Welcome/Login/Dashboard/Products/Orders/Customers
│   │   ├── lib/                # Axios credentials + 4 nhóm API và format utils
│   │   ├── layouts/            # DashboardLayout
│   │   ├── components/         # Navbar, Sidebar, PageLoader
│   │   └── assets/, index.css, App.css
│   └── public/, index.html, vite.config.js, eslint.config.js,
│       package.json, package-lock.json, README.md
└── docs/
    ├── diagram.png             # kiến trúc hiện tại; không phải đặc tả runtime
    └── web/00-repo-analysis.md  # tài liệu mới
```

Hiện chưa có `website/`, pnpm workspace, Docker/Compose, CI GitHub Actions, test suite hoặc Render manifest được track. Mỗi ứng dụng cũ dùng npm lockfile v3 riêng. `mobile` có script reset-project trỏ tới file không thấy trong tracked inventory. Admin thực tế chưa có trang quản trị reviews dù README mô tả rộng hơn.

## 3. Hợp đồng API Express hiện tại

### 3.1 Quy ước và middleware

- Prefix đầy đủ được ghi trong từng bảng. Không có API version.
- **U**: `protectRoute = [requireAuth(), lookup User by clerkId]`. Phải có Clerk session và User trong Mongo. Lookup thiếu user trả `401 {message:"User not found"}`; thiếu Clerk ID ở bước lookup trả `401 {message:"Unauthorized"}`; lỗi lookup trả `500 {message:"Internal server error"}`.
- **Lưu ý thực tế**: SDK `requireAuth()` đang cài tự authenticate và redirect `302` đến `CLERK_SIGN_IN_URL` hoặc `/` nếu chưa đăng nhập. Không được coi mọi unauthenticated request đều trả JSON 401. Vì tự authenticate, payment route mount trước `clerkMiddleware()` không đồng nghĩa route không có auth.
- **A**: U rồi `adminOnly`: so sánh `req.user.email === ENV.ADMIN_EMAIL`. Thiếu user `401 {message:"Unauthorized - User not found"}`; khác email `403 {message:"Forbidden: Admins only"}`. Không có role field/metadata check.
- **P**: không yêu cầu Clerk. Stripe webhook verify `stripe-signature` trên raw body. Inngest dùng protocol/chữ ký SDK, không phải Clerk Svix trực tiếp.
- Các controller dùng JSON nhưng **không có request/response schema validator**. Kiểu dưới đây thể hiện cách code đọc dữ liệu và Mongoose cast/validate, không bảo đảm client sai kiểu nhận 400.
- Ký hiệu `S=String`, `N=Number`, `B=Boolean`, `OID=ObjectId` (JSON là string), `D=Date` (JSON ISO string). `?` là optional theo controller; field schema required ghi riêng ở mục 4. `msg` là `message:S`.
- `Product`, `User`, `Cart`, `Order`, `Review`, `Address`, `Shipping` trong response được định nghĩa ở mục 4. Raw Mongoose documents gồm `_id`, timestamps, `__v`; embedded schemas có `_id`. `populate` có thể trả `null` khi sản phẩm/user đã bị xóa.
- **E**: controller bắt lỗi trả 500. Admin/products dùng `{message:"Internal server error"}`; user/cart/orders/reviews dùng `{error:"Internal server error"}`. Payment intent có thông điệp riêng. Các lỗi ObjectId/cast/duplicate/Mongoose validation thường rơi vào E.
- JSON parser có thể trả 400/413 và Multer có thể lỗi trước controller. Không có error handler tập trung; các lỗi này/Clerk errors có thể là HTML/text Express, không có format thống nhất. Không có error code máy đọc được.

### 3.2 Sản phẩm và giỏ hàng

| Method + path | Quyền | Request thực tế | Thành công | Lỗi controller ngoài E |
|---|---|---|---|---|
| GET `/api/products` | U | Không query được xử lý | 200 `Product[]`, sort createdAt giảm | — |
| GET `/api/products/:id` | U | id OID | 200 `Product` | 404 `{message:"Product not found"}` |
| GET `/api/cart` | U | Không | 200 `{cart:Cart}` với items.product populate; tạo cart rỗng nếu thiếu | — |
| POST `/api/cart` | U | `{productId:OID,quantity?:N=1}` | 200 `{msg:"Item added to cart",cart:Cart}` chưa populate | 404 Product not found; 400 Insufficient stock |
| PUT `/api/cart/:productId` | U | `{quantity:N}` | 200 `{msg:"Cart updated successfully",cart:Cart}` chưa populate | 400 Quantity must be at least 1 / Insufficient stock; 404 Cart not found / Item not found in cart / Product not found |
| DELETE `/api/cart/:productId` | U | productId so sánh string | 200 `{msg:"Item removed from cart",cart:Cart}` | 404 Cart not found; item không có vẫn 200 |
| DELETE `/api/cart` | U | Không | 200 `{msg:"Cart cleared",cart:Cart}` items=[] | 404 Cart not found |

Các lỗi cart ghi trong bảng dùng `{error:S}`. POST cart: item mới dùng quantity client; item đã có chỉ **cộng 1**, bỏ qua quantity được gửi. Không validate số nguyên/giới hạn; GET có side effect tạo dữ liệu.

### 3.3 Users, địa chỉ và wishlist

`Profile={bio:S,userName:S,name:S,email:S,imageUrl:S}`. Các lỗi trong bảng dùng `{error:S}`.

| Method + path | Quyền | Request | Thành công | Lỗi ngoài E |
|---|---|---|---|---|
| GET `/api/users/profile` | U | Không | 200 `{profile:Profile}` | — |
| PUT `/api/users/profile` | U | `{bio?:S,userName?:S}` | 200 `{msg:"Profile updated successfully",profile:{bio,userName}}` | 400 Bio must be 500 characters or less / Username already taken |
| POST `/api/users/profile/sync-image` | U | Không | 200 `{msg:"Image synced successfully from Clerk",imageUrl:S,name:S}` | Clerk/DB failure → E |
| POST `/api/users/push-token` | U | `{expoPushToken:S}` | 200 `{msg:"Push token registered successfully",expoPushToken:S}` | 400 Push token is required / Invalid push token format |
| POST `/api/users/addresses` | U | `{label,fullName,streetAddress,city,state,zipCode,phoneNumber:S,isDefault?:B}` | 201 `{msg:"Address added successfully",addresses:Address[]}` | 400 Missing required address fields; chỉ kiểm tra fullName/streetAddress/city/state/zipCode trước save |
| GET `/api/users/addresses` | U | Không | 200 `{addresses:Address[]}` | — |
| PUT `/api/users/addresses/:addressId` | U | Các field Address optional | 200 `{msg:"Address updated successfully",addresses:Address[]}` | 404 Address not found |
| DELETE `/api/users/addresses/:addressId` | U | addressId | 200 `{msg:"Address deleted successfully",addresses:Address[]}` | 404 Address not found |
| POST `/api/users/wishlist` | U | `{productId:OID}` | 200 `{msg:"Product added to wishlist",wishlist:OID[]}` | 400 Product already in wishlist |
| DELETE `/api/users/wishlist/:productId` | U | productId | 200 `{msg:"Product removed from wishlist",wishlist:OID[]}` | 400 Product not found in wishlist |
| GET `/api/users/wishlist` | U | Không | 200 `{wishlist:Product[]}` populate | — |

Address PUT dùng `value || oldValue` cho string, nên không thể xóa string bằng chuỗi rỗng. isDefault=true bỏ default các địa chỉ khác trên user document trong memory rồi save; xóa default không chọn default thay thế. Wishlist POST không kiểm tra Product tồn tại. Profile name/email/avatar đến từ Clerk, không nhận trực tiếp trong PUT profile.

### 3.4 Đơn hàng, đánh giá và thanh toán

| Method + path | Quyền | Request | Thành công | Lỗi ngoài E |
|---|---|---|---|---|
| POST `/api/orders` | U | `{orderItems:OrderItemInput[],shippingAddress:Shipping,paymentResult?:{id:S,status:S},totalPrice:N}`; stock lookup dùng item.product._id | 201 `{msg:"Order created successfully",order:Order[]}` **mảng** do `Order.create([…])` | 400 No order items / Insufficient stock for {name}; 404 Product {item.name} not found |
| GET `/api/orders` | U | Không | 200 `{orders:(Order & {hasReviewed:B})[]}`, populate orderItems.product, sort mới nhất | — |
| POST `/api/reviews` | U | `{productId:OID,orderId:OID,rating:N}` | 201 `{msg:"Review submitted successfully",review:Review}` | 400 Rating must be between 1 and 5 / Order not found / Can only review delivered orders / Product not found in this order / You have already reviewed this product; 403 Not authorized to review this order; 404 Product not found |
| DELETE `/api/reviews/:reviewId` | U | reviewId OID | 200 `{msg:"Review deleted successfully"}` | 404 Review not found; 403 Not authorized to delete this review |
| POST `/api/payment/create-intent` | U | `{cartItems:[{product:{_id:OID,name?:S},quantity:N}],shippingAddress:Shipping}` | 200 `{clientSecret:S}` | 400 Cart is empty / Insufficient stock for {name} / Invalid order total; 404 Product {clientName} not found; 500 Failed to create payment intent |
| POST `/api/payment/webhook` | P + Stripe signature | raw JSON Stripe Event; xử lý payment_intent.succeeded; metadata userId,clerkId,orderItems JSON,shippingAddress JSON,totalPrice string | 200 `{received:true}`, cả event khác hoặc lỗi tạo đơn sau verify | 400 **text** `Webhook Error: {err.message}` |

Lỗi trong bảng là `{error:S}`, trừ webhook text và auth dùng quy ước mục 3.1. `OrderItemInput` đọc name/price/quantity/image từ client và product object có `_id`; Mongoose ref cần cast được về OID. Đây không phải request contract đã được validate.

`hasReviewed` là true nếu có **bất kỳ review nào của order**, không phải tất cả sản phẩm đã review. Một review/user/product trên mọi order được kiểm bằng query; không có unique index. Không có review text, GET reviews, PUT/PATCH review, GET order detail, cancel, refund hay payment status API trong backend cũ.

### 3.5 Admin

Tất cả dùng A. Upload là multipart `upload.array("images",3)`, disk storage, mỗi file tối đa 5 MiB. MIME/extension filter có typo `webg` thay vì `webp`; số file >3 thường bị Multer chặn trước check trong controller. Các lỗi dùng `{message:S}`.

| Method + path | Request | Thành công | Lỗi ngoài E |
|---|---|---|---|
| POST `/api/admin/products` | multipart name/description/category:S, price/stock:string parse số, images:1–3 files | 201 `{msg:"Product created successfully",product:Product}` | 400 All fields are required / At least one image is required / A maximum of 3 images are allowed |
| GET `/api/admin/products` | Không | 200 `Product[]`, sort mới nhất | — |
| PUT `/api/admin/products/:id` | multipart các field như POST nhưng optional, ảnh mới thay toàn bộ images | 200 `{msg:"Product updated successfully",product:Product}` | 404 Product not found; 400 A maximum of 3 images are allowed |
| DELETE `/api/admin/products/:id` | id OID | 200 `{msg:"Product deleted successfully"}` | 404 Product not found; 500 Failed to delete product |
| GET `/api/admin/orders` | Không | 200 `{orders:Order[]}`, populate user(name,email) và orderItems.product | — |
| PATCH `/api/admin/orders/:orderId/status` | `{status:"pending"\|"shipped"\|"delivered"}` | 200 `{msg:"Order status updated",order:Order}`, populate **toàn bộ User** | 400 Invalid status value; 404 Order not found |
| GET `/api/admin/customers` | Không | 200 `{customers:User[]}`, toàn bộ fields, sort mới nhất | — |
| GET `/api/admin/stats` | Không | 200 `{totalRevenue:N,totalOrders:N,totalCustomers:N,totalProducts:N}` | — |

PATCH status cho phép mọi chuyển đổi giữa 3 giá trị (kể cả lùi trạng thái), chỉ set shippedAt/deliveredAt nếu chưa có; không xóa timestamp khi lùi. Gửi push khi request status shipped/delivered và user có token, kể cả status không đổi. Stats cộng totalPrice mọi order, không phân biệt paid/refund.

### 3.6 Health, Inngest và fallback

| Method + path | Quyền / request | Response và lỗi |
|---|---|---|
| GET `/api/health` | P; không body | 200 `{message:"OK"}`; không kiểm tra DB |
| GET `/api/inngest` | Handler SDK; introspection | 200 JSON SDK mô tả functions/authentication/config; không phải user profile |
| POST `/api/inngest` | Inngest signed invocation, SDK state/event protocol | SDK trả kết quả execution/steps; 200/206, streaming có 201; 400 invalid execution, 401 invalid signature, 500 retryable/internal; schema không do repo định nghĩa |
| PUT `/api/inngest` | SDK registration, optional deployId và in-band sync body/headers | out-of-band `{message,modified}` + HTTP từ registration; in-band 200 registration JSON; 400 invalid_request, 401 sig_verification_failed, 500 missing body/internal |

Có **33 method/path ứng dụng** + 3 method Inngest (36 mục). Inngest mount qua `app.use`, SDK trả 405 cho method không được hỗ trợ; CORS có xử lý preflight chung. Express có HEAD mặc định cho GET; không có handler nghiệp vụ HEAD riêng. Production phục vụ static admin và `GET /{*any}` → admin index.html; URL API GET không tồn tại có thể nhận HTML 200. Development dùng fallback Express 404. Không có Clerk Svix route trực tiếp ở backend cũ: Inngest nhận các event `clerk/user.created`, `clerk/user.updated`, `clerk/user.deleted`; không suy ra cấu hình upstream từ source.

Nguồn chính: `backend/src/server.js`, `backend/src/routes/*.js`, `backend/src/controllers/*.js`, `backend/src/middleware/*.js`; chi tiết Inngest được đối chiếu SDK local 3.48.1.

## 4. Toàn bộ data model MongoDB hiện tại

### 4.1 Quy ước chung

5 model dùng Mongoose, không khai báo tên collection thủ công. Collection dự kiến: `users`, `products`, `carts`, `orders`, `reviews`. Root document có `_id:OID`, `__v:N`, `createdAt:D`, `updatedAt:D` (`timestamps:true`). Embedded schemas Address, Shipping, CartItem, OrderItem có `_id` tự tạo; không có timestamps riêng. Arrays mặc định rỗng theo Mongoose. ObjectId references không có foreign key/cascade enforce ở Mongo.

### 4.2 User → users

| Field | Type / ràng buộc / mặc định |
|---|---|
| email | S required, unique |
| name | S required |
| imageUrl | S, default `""` |
| clerkId | S required, unique; khóa liên kết Clerk |
| bio | S, default `""`, maxlength 500 |
| userName | S, default `""`, unique + sparse |
| expoPushToken | S, default `""`; chỉ một token mỗi user |
| addresses | Address[] nhúng |
| wishlist | OID[] ref Product |

Address: `label`, `fullName`, `streetAddress`, `city`, `state`, `zipCode`, `phoneNumber` đều S required; `isDefault:B=false`; `_id:OID`.

Indexes khai báo: `_id_` mặc định, email unique, clerkId unique, userName unique sparse. **Sparse vẫn index chuỗi rỗng được lưu bởi default**; có nguy cơ user thứ hai không có username vi phạm unique. `stripeCustomerId` được payment controller đọc/ghi nhưng **không có trong schema**; strict update có thể loại bỏ field, dẫn đến tạo nhiều Stripe customers.

### 4.3 Product → products

| Field | Type / ràng buộc / mặc định |
|---|---|
| name, description, category | S required |
| price | N required, min 0 |
| stock | N required, min 0, default 0; không có integer validator |
| images | S[]; phần tử required, không có array min-length validator |
| averageRating | N default 0, min 0, max 5 |
| totalReviews | N default 0, không có min/integer validator |

Chỉ index `_id_`. Category là chuỗi tự do, không có collection/enum category. UI dùng Electronics/Accessories/Fashion/Sports nhưng server không giới hạn. Không có slug, sales counter, discount, freeShipping, currency, variant/SKU, soft-delete.

### 4.4 Cart → carts

`user:OID ref User required`, `clerkId:S required unique`, `items:CartItem[]`.

CartItem: `product:OID ref Product required`, `quantity:N required min 1 default 1`, `_id:OID`. Không enforce integer, không unique product trong array. Indexes `_id_`, clerkId unique. Không index user riêng. Cart lưu server, không có price snapshot, không reserve tồn kho.

### 4.5 Order → orders

| Field | Type / ràng buộc / mặc định |
|---|---|
| user | OID ref User required |
| clerkId | S required |
| orderItems | OrderItem[] |
| shippingAddress | Shipping embedded required |
| paymentResult | object `{id?:S,status?:S}`; không enum/unique |
| totalPrice | N required, min 0 |
| status | S enum **pending, shipped, delivered**; default pending |
| shippedAt, deliveredAt | D optional |

OrderItem: `product:OID ref Product required`, `name:S required`, `price:N required min 0`, `quantity:N required min 1`, `image:S required`, `_id:OID`.

Shipping: `fullName`, `streetAddress`, `city`, `state`, `zipCode`, `phoneNumber` đều S required, `_id:OID`; không label/isDefault. Order lưu snapshot tên/giá/ảnh/địa chỉ nhưng GET vẫn populate product hiện tại. Không có currency/subtotal/tax/shipping/payment method field riêng; không enum cancelled/refunded/payment_pending. Chỉ index `_id_`, không index clerkId/createdAt/paymentResult.id.

### 4.6 Review → reviews

`productId:OID ref Product required`, `userId:OID ref User required`, `orderId:OID ref Order required`, `rating:N required min 1 max 5`. Rating không enforce integer. Chỉ index `_id_`; không compound unique. Không comment/title/images/moderation.

Quan hệ: Clerk userId → User.clerkId; User 1–1 Cart theo clerkId; User 1–N Orders/Reviews; Product 1–N cart/order items và reviews; Order 1–N Reviews; wishlist N–N User/Product nhúng. Không có Notification, Payment, Session hay Category model. Các index trên là **khai báo code**, chưa khẳng định đã tồn tại trong DB live.

## 5. Luồng nghiệp vụ thực tế

### 5.1 Auth, đồng bộ user và hồ sơ

Mobile dùng Clerk Expo Google/Apple `startSSOFlow`, token cache và Bearer token qua Axios. Tabs yêu cầu sign-in; profile routes gọi API được bảo vệ. Admin dùng Clerk React và Axios `withCredentials`; frontend chỉ check signed-in, server mới check email admin. Không có đăng ký/password/session endpoint tự xây trong Express.

Inngest created: `User.create` với clerkId, email đầu tiên, tên ghép, `profile_image_url || image_url`, addresses/wishlist rỗng. Không upsert/idempotency rõ ràng; tên ghép không trim ở created nên tên trống có thể thành khoảng trắng. Updated: chỉ name/imageUrl, không đồng bộ email, không upsert nếu thiếu user. Deleted: xóa User, không dọn cart/wishlist/order/review references. Không có timestamp guard cho event đến sai thứ tự.

Mobile edit gọi Clerk update firstName/lastName và setProfileImage, sau đó backend PUT bio/userName hoặc POST sync-image. Khóa tên/email/avatar và profile extension thuộc hai nguồn khác nhau, có thể lệch khi một bước lỗi. New web webhook phải upsert theo clerkId, giữ `_id`, giữ addresses/wishlist/token/bio; không reset dữ liệu của mobile.

### 5.2 Catalogue, cart, wishlist, addresses

Mobile tải **toàn bộ** products rồi lọc tên/category/giá/còn hàng/rating và sort ở client. Sale/free-shipping/popular có option UI nhưng logic tương ứng bị comment; không được coi là chức năng thật. Product detail có gallery, tồn kho, tổng rating, add cart và wishlist; không lấy danh sách reviews.

Cart, wishlist và addresses lưu MongoDB, đồng bộ được giữa thiết bị nếu cùng user/database. Query cache chỉ là cache frontend. Cart giá dùng Product hiện tại; deleted Product có thể làm mobile dereference null. Read-modify-save các array chưa bảo vệ tốt trước cập nhật đồng thời từ hai backend.

### 5.3 Checkout, Stripe và đơn hàng

Luồng mobile đang dùng: cart → chọn Address → POST payment/create-intent → Stripe PaymentSheet → báo success và gọi clearCart → webhook payment_intent.succeeded tạo Order rồi trừ stock. Subtotal được tính lại từ Product ở intent, shipping **10 USD**, tax **8% subtotal**, total đổi sang cents và currency **usd**. Không thấy PayPal/VNPay/COD. Đây là chính sách hiện có trong code, chưa xác minh tài khoản Stripe live/test hay chính sách kinh doanh production.

Intent chưa trừ/reserve stock; metadata chứa nguyên cart/address JSON. Webhook verify chữ ký đúng cơ chế Stripe, nhưng dedup chỉ findOne(paymentResult.id) rồi create; không unique/transaction. Sau create mới trừ stock bằng `$inc` không điều kiện, không transaction và nuốt lỗi trả 200. Import Cart trong payment controller không được dùng để clear server cart. Mobile clear trước khi webhook chắc chắn ghi đơn nên có khoảng trễ/mất đồng bộ.

POST orders là đường tạo đơn khác: dùng transaction nhưng tin totalPrice/paymentResult/giá snapshot client, không kiểm chứng đã thanh toán; không được hiểu là COD hoàn chỉnh. StartSession/startTransaction ngoài try; cần Mongo replica set. Kiểm stock theo từng item trước decrement, không gộp product trùng. Không có cancel/refund. User chỉ có list đơn; admin chỉnh trạng thái và timestamp. Giá trị pending là trạng thái xử lý giao hàng, **không đồng nghĩa chưa thanh toán**.

### 5.4 Reviews

User chỉ review sản phẩm thuộc đơn của mình và đơn phải delivered. Một user/product bị chặn review lần hai bằng query. Chỉ chấm 1–5 sao, có DELETE ownership check; chưa sửa review/list review. Sau create/delete đọc toàn bộ reviews của product để tính average/count, có race. Mobile đánh giá toàn bộ items nhưng callback `map` không return promise nên `Promise.all` không chờ mutations; `hasReviewed` theo đơn còn có thể khóa UI khi mới review một item.

### 5.5 Notifications sau PR #30

Admin update shipped/delivered → đọc một expoPushToken trên User → service validate token → gửi Expo push qua channel order-updates, payload `{orderId,status,screen:"OrderDetail"}`. Tap trên mobile dẫn đến danh sách orders; chưa mở đúng detail. Push failure không làm hỏng cập nhật đơn; chưa có outbox/retry/receipt cleanup. Lỗi từng chunk bị catch mà tickets có thể rỗng và trả success.

`(profile)/notifications.tsx` thực tế là **Coming Soon**. Không có notification history/read-state API hoặc collection, không có Web Push. Khởi tạo mobile truyền Axios instance vào hàm dùng `apiPost(...)`, không truyền callback `api.post` đúng cách; có nguy cơ gọi sai URL/method và không đăng ký token. initializeNotifications trả void, caller lại kỳ vọng cleanup; listeners có thể không được remove. Không sửa các lỗi này trong nhiệm vụ web, nhưng cần kiểm thử độc lập luồng web.

### 5.6 Tính năng account UI chưa phải nghiệp vụ server

Activity hiển thị hardcoded samples, refresh giả và logout-all chỉ console log. Data export dùng mock data, file write bị comment; chọn CSV không biến JSON thành CSV. Privacy/security: 2FA chỉ flag AsyncStorage và thông báo email giả; passcode/delete account chỉ delay; biometric chỉ xác thực thiết bị để bật setting. Không sao chép những giao diện này thành tính năng bảo mật giả trên web. Web dùng Clerk account management thực cho session/security.

## 6. Ánh xạ toàn bộ màn hình mobile → web

| Mobile route | Thực tế | Web dự kiến |
|---|---|---|
| `(auth)/index` | Splash + Google/Apple SSO | `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]`; public storefront không bắt login |
| `sso-callback` | redirect theo session | Clerk callback theo SDK; không tự viết callback khi SDK quản lý |
| `(tabs)/index` | shop/filter/search client | `/` và `/products?...` SSR/ISR, URL filters và pagination |
| `product/[id]` | detail/gallery/cart/wishlist | `/products/[id]`, metadata/JSON-LD/reviews/related |
| `(tabs)/cart` | cart + address + Stripe sheet | `/cart`, `/checkout`, `/checkout/return` |
| `(tabs)/profile` | account menu/sign-out | `/account` và UserButton |
| `(profile)/edit` | Clerk identity/avatar + DB bio/username | `/account/profile`, Clerk profile/security UI |
| `(profile)/addresses` | Address CRUD modals | `/account/addresses` |
| `(profile)/orders` | list + rating modal | `/account/orders`, `/account/orders/[id]`, review editor |
| `(profile)/wishlist` | server wishlist | `/wishlist` |
| `(profile)/notifications` | placeholder; push ở service riêng | `/account/notifications`, in-app inbox mới |
| `(profile)/privacy-security` | phần lớn local/mock | `/account/security` dùng Clerk; không giả 2FA/passcode |
| `(profile)/activity` | mock | chưa thêm activity timeline riêng; dùng Clerk session management |
| `(profile)/data-export` | mock | ngoài scope mặc định; cần nghiệp vụ export thật nếu yêu cầu thêm |
| `_layout`, `(auth)/_layout`, `(tabs)/_layout` | providers/nav/guards | root layout, account layout, Clerk request guard |

Trang web bổ sung: sitemap.xml, robots.txt, not-found, error/global-error, loading skeletons; metadata Open Graph, keyboard navigation, labels/focus/contrast, responsive desktop/tablet/mobile. Cart/wishlist/checkout/account là private/no-store/noindex; i18n dictionary vi mặc định, cấu trúc en sẵn.

## 7. Biến môi trường hiện tại (chỉ tên)

| Thành phần | Biến được source ứng dụng tham chiếu |
|---|---|
| backend | NODE_ENV, PORT, DB_URL, CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, INNGEST_SIGNING_KEY, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, CLOUDINARY_CLOUD_NAME, ADMIN_EMAIL, CLIENT_URL, STRIPE_PUBLISHABLE_KEY, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET |
| mobile | EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY, EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY |
| admin | VITE_CLERK_PUBLISHABLE_KEY, VITE_SENTRY_DSN, VITE_API_URL |

Không đọc `.env` để lập danh sách. SDK/framework có thể đọc thêm biến ngầm; ví dụ CLERK_SIGN_IN_URL được SDK Express đã cài dùng khi redirect, không được env.js khai báo. Không coi inventory source là inventory settings Render/Clerk/EAS đầy đủ. Mobile API base URL và Sentry DSN/EAS project metadata đang hardcode trong source, không phải biến env; không chép giá trị vào tài liệu. Sentry cũ bật sendDefaultPii và logs/replay; cần chính sách redact riêng cho web.

Biến **đề xuất mới**, chưa tạo: NODE_ENV, PORT, HOST, LOG_LEVEL, MONGODB_URI, CORS_ORIGINS, CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY, CLERK_WEBHOOK_SIGNING_SECRET, ADMIN_EMAIL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, WEB_ORIGIN, API_INTERNAL_URL, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, NEXT_PUBLIC_CLERK_SIGN_IN_URL, NEXT_PUBLIC_CLERK_SIGN_UP_URL. Chỉ thêm UPLOAD/worker/cache env khi implementation cần. Không public hóa secret; root workspace `.env` không tự được Next/API load nếu không cấu hình rõ.

## 8. Rủi ro và cách backend mới tránh lặp lại

| Mức | Bằng chứng source / hệ quả | Thiết kế mới |
|---|---|---|
| Nghiêm trọng | POST orders tin total/giá/paymentResult; có thể tạo đơn không có payment hợp lệ | Checkout chỉ nhận cart version/addressId; server snapshot giá/tổng; chỉ webhook verified finalize paid order |
| Nghiêm trọng | Stripe webhook create rồi decrement không transaction/stock predicate; retry race và trả 200 khi lỗi | Checkout reservation + transaction, unique web payment/session guards, outbox/reconcile, 5xx khi durable work chưa nhận |
| Cao | Cùng account Stripe có thể giao cùng event đến cả 2 webhook; legacy handler không check source | Cách ly Stripe account/event routing được duyệt trước live; chỉ thay API key hoặc signing secret cùng account không cách ly events |
| Cao | Shared stock vẫn bị legacy webhook decrement âm hoặc admin cũ set stock | Không hứa bảo đảm toàn hệ thống khi legacy writer còn hoạt động; race tests cho API mới, inventory monitoring, go-live decision về vận hành/DB |
| Cao | quantities không integer/bounds, duplicate products có thể bypass stock checks | Zod strict + quantity integer dương có max; gộp product; conditional `$inc` stock>=quantity trong transaction retry |
| Cao | created user không idempotent; userName default empty + sparse unique; webhook update không email | Svix raw-body verify, upsert giữ _id, chỉ set field Clerk sở hữu; omit username chưa có; audit index trước mọi migration |
| Cao | 2 luồng Clerk sync ghi cùng User, event sai thứ tự/deletion có thể làm lệch | Web event dedup + ordering/tombstone sidecar; giữ `_id`; ghi rõ không chặn được legacy writer ghi lại event cũ |
| Cao | Không Zod, ObjectId invalid →500; không rate limit/helmet/response DTO | Validate body/query/params/response, errors code/status/requestId thống nhất, rate limit theo IP/user, helmet, CORS whitelist |
| Cao | Không phân trang; Product.find/Order.find/User.find không giới hạn | page/limit cap, query whitelist/index/explain, projection, tránh N+1 |
| Vừa | Wishlist không check product; arrays read-modify-save; default address có race | `$addToSet/$pull`, existence check, atomic array updates/transaction, version conflict; giới hạn số address/cart items |
| Vừa | Review duplicate check và rating aggregate có race | serialize theo product/transaction, guard unique cho write web; audit trước index chung; per-product review state |
| Vừa | Raw customers và status response populate User chứa email/addresses/token; console logs không redact | DTO công khai/private/admin riêng, không trả token/địa chỉ người khác, Pino redact auth/cookies/secrets/PII |
| Vừa | Status cho lùi, push trùng; không durable notification/receipt | state machine tiến pending→shipped→delivered trên API mới, dedup notification theo order+status+timestamp |
| Vừa | Upload typo webg, MIME chỉ tin metadata, file tạm không cleanup; Cloudinary delete parse URL dễ sai | signed upload scope/folder/size/type/expiry cố định, verify asset metadata; lưu public_id trong sidecar nếu cần; cleanup |
| Vừa | Delete product để dangling refs; order UI dereference product live | snapshot order làm nguồn hiển thị; cart/wishlist xử lý null/deleted và thông báo rõ |
| Vừa | payment metadata chứa JSON dài; StripeCustomerId thiếu schema; không idempotency key | lưu checkout payload DB, Stripe metadata chỉ checkout ID/source; web customer mapping riêng; idempotency key/user/hash |
| Vừa | Missing centralized error handler, production SPA fallback API unknown trả HTML | Fastify JSON 404/error, liveness/readiness riêng, không expose stack; request-id xuyên Next→API |
| Vừa | `.gitignore` root chỉ chặn .env, không mọi biến thể | website/.gitignore chặn .env*, cho phép .env.example, scan staged diff không secret |

Các ownership checks đang có ở review và user-scoped arrays/orders là nền nghiệp vụ đúng; API mới phải giữ và test IDOR cho từng tài nguyên. Không kết luận đã có IDOR ở mọi route cũ. Các phát hiện là static review, chưa exploit hoặc load-test production.

## 9. Kiến trúc đề xuất để duyệt

### 9.1 Ranh giới ứng dụng

```text
Mobile ───────────────┐
Admin cũ ─────────────┴── Express cũ ────── MongoDB (legacy collections)
                                                   ↑
Browser → Next App Router → Fastify web mới ────────┘
               │                ├── Clerk + Svix webhook mới
               └── Clerk        ├── Stripe Checkout + webhook mới
                                └── Cloudinary signed upload (admin API)
```

Next App Router + TypeScript strict; Server Components mặc định cho public catalogue. Fetch server gọi API_INTERNAL_URL; browser gọi NEXT_PUBLIC_API_URL với Clerk Bearer token, không dựa vào third-party cookies giữa hai hosting domains. Fastify verify session issuer/audience/authorized parties theo SDK, requireAuth lookup User, requireAdmin kiểm identity đáng tin cậy. CORS whitelist không thay thế auth. CSRF được đánh giá lại nếu thêm cookie auth/BFF.

Cùng Clerk application, clerkId là liên kết. MongoDB mặc định cùng database qua **MONGODB_URI**, collection names tường minh tương thích, không import bất kỳ code nào từ backend cũ. Có thể trỏ database riêng bằng env; khi đó account Clerk vẫn chung nhưng cart/order/catalogue **không tự đồng bộ DB**. Không thêm dịch vụ trả phí tự động.

### 9.2 Cấu trúc website dự kiến

```text
website/
├── apps/
│   ├── web/
│   │   ├── src/app/             # public, auth, account, cart, checkout, metadata
│   │   ├── src/components/      # ui shadcn/Radix + domain components
│   │   ├── src/lib/             # typed API, auth, Query, money, i18n
│   │   ├── src/proxy.ts         # hoặc convention tương ứng stable Next được chốt
│   │   ├── public/, tests/, e2e/
│   │   └── next.config.ts, package.json, .env.example
│   └── api/
│       ├── src/app.ts           # factory dùng fastify.inject, không listen khi import
│       ├── src/server.ts
│       ├── src/config/, src/plugins/ # env/db/auth/security/swagger/errors/logger
│       ├── src/modules/         # products/categories/cart/wishlist/addresses/
│       │                        # users/orders/reviews/notifications/payments/uploads
│       ├── src/workers/         # reservation expiry, payment reconciliation/outbox
│       ├── tests/, Dockerfile, package.json, .env.example
│       └── src/models/          # model độc lập và web sidecar schemas
├── packages/shared/src/         # Zod request/response contracts + inferred TS types
├── package.json, pnpm-lock.yaml, pnpm-workspace.yaml, tsconfig.base.json
├── eslint.config.*, prettier config, .gitignore, .env.example
├── docker-compose.yml           # Mongo replica set + health/init cho transactions
└── README.md
```

Workspace chỉ trong website, không đưa app cũ vào pnpm, không thay root build/deploy. `pnpm dev` chạy cả Next/API từ website; `pnpm --dir website ...` dùng từ root. Shared package chỉ chứa browser-safe contracts, không import DB/server/secrets. Chọn tsc build API và shared để giảm tooling; tsx dev. Giữ SQL/Express/Fastify migration ngoài scope.

Fastify v5, Zod type provider phù hợp phiên bản, Swagger + UI `/docs`, CORS/helmet/rate-limit/sensible, Mongoose, Clerk Fastify, svix, Stripe SDK, Cloudinary. Multipart chỉ thêm nếu quyết định upload qua server. Next stable tại lúc khởi tạo, @clerk/nextjs, Tailwind/shadcn/Radix, lucide, TanStack Query, RHF/Zod, next-themes, sonner; chưa cần Zustand. Kiểm tra peer dependencies/typings và pin lockfile khi Giai đoạn 1; không chốt patch version từ trí nhớ.

### 9.3 Tương thích dữ liệu và cơ chế đồng bộ

1. Giữ nguyên 5 collection, field names, `_id`, enum status, đơn vị price major USD ở legacy records. Tính toán tiền nội bộ integer cents, chuyển khi ghi legacy order. Không đổi price sẵn có sang cents trong DB.
2. Bổ sung **collection riêng prefix web_** cho checkout sessions/reservations, payment mappings/events, Clerk event ledger/tombstones, notification/read-state, outbox và review write guards nếu cần. Legacy schema không biết các collection này nên không xóa dữ liệu phụ khi save. Đây là schema mới được đề xuất để duyệt, không phải model đã có.
3. Không đổi enum/required fields của legacy collections, không dùng `syncIndexes()` hoặc tự drop index. Additive indexes dự kiến: products `{category,price,_id}`, `{createdAt,_id}`, `{averageRating,_id}`, text name/description; orders `{clerkId,createdAt,_id}`; reviews `{productId,createdAt,_id}`, `{userId,productId}`; web event/payment/session unique keys và notification dedup. Chốt theo query/explain. Unique index trên review/user/product hoặc paymentResult.id ở collection chung chỉ thực hiện sau audit duplicate và duyệt migration.
4. Web Clerk webhook chỉ update identity fields; dùng `$setOnInsert` cho _id/default không reset arrays. Dùng primary verified email theo Clerk và xác minh admin email qua Clerk trước cấp quyền; không cho client sửa role. Nếu User chưa đồng bộ, trả lỗi provisioning có thể retry; controlled hydration từ Clerk server API, không tạo user từ request body.
5. Cả Inngest cũ và web webhook chạy song song có thể race create, stale update/delete. Web xử lý duplicate-key/re-read, ordering ledger và reconciliation của chính mình; không thể bảo đảm writer cũ cũng idempotent. Production cần theo dõi failures, đặc biệt userName empty unique, và quyết định migration riêng nếu dữ liệu thực xác nhận lỗi. Không âm thầm sửa index chung.
6. Catalogue cache public có TTL ngắn (đề xuất 60 giây), invalidation cho writes web. Admin cũ không phát invalidation web nên không thể hứa cập nhật ngay tức thì; giá/tồn kho luôn đọc DB khi checkout. Không cache shared cho dữ liệu tài khoản.
7. Notifications web reconcile order shippedAt/deliveredAt khi đọc và polling khi trang mở; upsert event key orderId/status/timestamp, lưu read-state riêng. Nhờ đó thấy cập nhật từ admin cũ mà không sửa code cũ hoặc phụ thuộc push Expo. Không hứa nhận mọi trạng thái trung gian nếu legacy đã đổi/lùi nhiều lần giữa 2 lần đọc; lịch sử chính xác cần CDC/change streams/worker được duyệt thêm. UI công bố thời điểm dữ liệu, phân trang và giới hạn reconciliation.

### 9.4 Thanh toán và tồn kho

Chọn **Stripe Checkout hosted**, cùng payment provider đang có; không thêm COD mặc định. Checkout nhiều bước ở web: địa chỉ → Stripe → xác nhận. Quote server tính từ cart thật, shipping/tax như hiện tại; subtotal/tax/shipping/total snapshot lưu DB, không nhận tổng client.

Web create checkout yêu cầu Idempotency-Key + cart version. Transaction gộp items, conditional decrement stock và tạo reservation + checkout session; không tạo Order legacy chưa trả tiền để admin/mobile không nhầm. Commit DB trước gọi Stripe; external call không đặt trong DB transaction. Stripe call idempotent theo checkout ID. Lỗi/timeout Stripe phải reconcile trước release reservation để tránh trả kho khi payment session còn sống.

Webhook raw-body verify, validate account/mode/source/session, amount/currency và paid status; transaction finalize reservation thành một legacy Order, payment ledger và notification/outbox. Dedup cả event ID lẫn payment/session ID. Redirect success chỉ poll trạng thái, không tạo đơn/tin client. Hủy/chưa trả tiền là checkout session state riêng; expire Stripe session trước release inventory; webhook late-success/retry/concurrent-expiry có state machine và reconciliation/refund compensation được test. Clear cart bằng các items/version đã checkout, giữ thay đổi mới của người dùng. Worker job claim có lease/idempotency; TTL index không thay thế nghiệp vụ trả kho.

**Chặn go-live cần giải quyết:** webhook cũ nhận mọi `payment_intent.succeeded` trong account được subscribe, không check source. Nếu dùng cùng Stripe account và metadata legacy, cả hai backend có thể tạo đơn/trừ kho. Metadata marker ở backend mới không làm handler cũ tự bỏ qua. Signing secret/API key mới cùng account cũng không cách ly event. Mặc định đề xuất credentials của **Stripe account riêng cho web**, vẫn dùng Stripe; không tự tạo account hoặc cấu hình dashboard. Nếu muốn chung account, phải duyệt giải pháp routing events bên ngoài có kiểm chứng và đánh giá ảnh hưởng mobile; không dùng một giải pháp ngầm dựa vào việc handler cũ lỗi validation.

Ngay cả khi cách ly Stripe events, **DB chung + legacy inventory writer không an toàn** vẫn không cho phép chứng minh no-oversell toàn hệ thống. API web đảm bảo transaction cho writes của mình; go-live cần chấp nhận rủi ro legacy có giám sát, hoặc chọn DB/inventory riêng, hoặc một nhiệm vụ khác được phép nâng cấp legacy writer. Không tự thay đổi ràng buộc mobile/backend bất biến.

### 9.5 API Fastify mới dự kiến (khác inventory API cũ)

Prefix `/api/v1`, response DTO Zod; private ownership filter bằng clerkId/user._id, page default 20 max 100; search length cap, sort enum, offset cap/cursor cho feed lớn. Lỗi thống nhất `{error:{code,message,details?},requestId}` với 400/401/403/404/409/413/429/500/503. Webhook có acknowledgement schema riêng theo provider.

| Quyền | Endpoint dự kiến | Mục đích / input chính |
|---|---|---|
| P | GET `/health/live`, GET `/health/ready` | process/DB readiness; không lộ connection string |
| P/dev hoặc bảo vệ production | GET `/docs`, GET `/openapi.json` | Swagger UI và OpenAPI generated từ schemas |
| P | GET `/api/v1/products` | q/category/minPrice/maxPrice/minRating/inStock/sort/page/limit; featured/newest/bestselling bằng sort |
| P | GET `/api/v1/products/:id` | public detail DTO |
| P | GET `/api/v1/products/:id/related` | cùng category, exclude current, capped |
| P | GET `/api/v1/products/:id/reviews` | rating + author display DTO, không email/address |
| P | GET `/api/v1/categories` | distinct category từ products, không thêm category model |
| U | GET `/api/v1/me`, PATCH `/api/v1/me` | profile; PATCH bio/userName; identity/avatar dùng Clerk |
| U | GET `/api/v1/cart` | read DTO có cart version, invalid/deleted items handling |
| U | POST `/api/v1/cart/items` | productId, quantity; atomic add đúng quantity |
| U | PATCH `/api/v1/cart/items/:productId` | quantity tuyệt đối + version |
| U | DELETE `/api/v1/cart/items/:productId`, DELETE `/api/v1/cart` | remove/clear có conflict handling |
| U | GET `/api/v1/wishlist` | product DTO, pagination |
| U | PUT `/api/v1/wishlist/:productId`, DELETE `/api/v1/wishlist/:productId` | add/remove idempotent |
| U | GET/POST `/api/v1/addresses` | own address list/create |
| U | PATCH/DELETE `/api/v1/addresses/:id` | partial update/delete; isDefault xử lý atomic |
| U | POST `/api/v1/checkout/quote` | addressId + cart version, server totals |
| U | POST `/api/v1/checkout/sessions` | addressId/cart version, Idempotency-Key → Stripe checkout URL/session ID |
| U | GET `/api/v1/checkout/sessions/:id` | own pending/paid/expired/failed và orderId khi có |
| U | GET `/api/v1/orders`, GET `/api/v1/orders/:id` | own orders, snapshot detail, trạng thái/review eligibility |
| U | POST `/api/v1/reviews` | productId, delivered orderId, rating integer 1–5 |
| U | PATCH/DELETE `/api/v1/reviews/:id` | own review rating sửa/xóa; recompute aggregates an toàn |
| U | GET `/api/v1/notifications` | derived/persisted shipped/delivered feed, unread count, cursor |
| U | PATCH `/api/v1/notifications/:id/read` | own read-state, idempotent |
| U | POST `/api/v1/notifications/read-all` | read through server cutoff, tránh đánh dấu nhầm event tương lai |
| Provider signature | POST `/api/v1/webhooks/clerk` | Svix verify + event dedup/upsert/order guard |
| Provider signature | POST `/api/v1/webhooks/stripe` | Checkout/payment events chỉ nguồn web; durable dedup/finalize |
| A (tối thiểu đề xuất) | GET `/api/v1/admin/orders` | kiểm tra/đối soát đơn mới qua docs/API, không dashboard |
| A (tối thiểu đề xuất) | PATCH `/api/v1/admin/orders/:id/status` | chỉ tiến pending→shipped→delivered, optimistic concurrency, outbox |
| A (tối thiểu đề xuất) | POST `/api/v1/admin/uploads/signature` | Cloudinary signature scope/expiry cố định cho product assets |

Admin CRUD products (POST/PATCH/DELETE), GET customers/stats và moderation review **không bật mặc định** vì admin cũ đã phụ trách; có thể bổ sung khi bạn chọn. Admin cũ không tự gọi endpoint mới. Upload avatar customer dùng Clerk. Không có endpoint cancel/refund mặc định do nghiệp vụ cũ không cho phép; không mở route generic create-order tin client.

Bestselling không có field sẵn: aggregate quantity từ delivered orders với giới hạn/kết quả cache; không giả định totalReviews là sales. Với DB tách, chỉ thống kê đơn trong DB web. Cần audit dữ liệu giá/stock trước public release.

## 10. Tối đa 5 câu hỏi cần xác nhận và phương án mặc định

1. **Dùng chung Clerk và MongoDB, chấp nhận giới hạn writer cũ?** Mặc định cùng Clerk app + cùng DB qua MONGODB_URI, giữ schema/enum; ghi rõ không bảo đảm hết oversell toàn hệ thống và chưa sửa index chung. DB riêng luôn là tùy chọn env.
2. **Giữ Stripe USD, ship $10, thuế 8% và cách ly Stripe account web?** Mặc định giữ chính sách source và Stripe Checkout, dùng Stripe account riêng khi live để tránh legacy webhook xử lý trùng. Chỉ triển khai sandbox/test trước; cần bạn cung cấp cấu hình production qua env/dashboard an toàn. Không tự chuyển VND/COD hay tạo tài khoản/dịch vụ.
3. **Backend mới cần admin API đến đâu?** Mặc định chỉ GET orders, PATCH status tiến và upload signature như mục 9.5; không admin UI, không full product/customer/stats API.
4. **Notifications web là inbox shipped/delivered, chấp nhận polling?** Mặc định inbox có persisted read-state, reconcile từ orders khi đọc + polling khi mở web; không Web Push/email/CDC, không sửa mobile push.
5. **Giữ giới hạn cancel/review theo schema cũ?** Mặc định không hủy đơn, review chỉ sao (thêm sửa/xóa trên web), không thêm comment/cancel enum; account security dùng Clerk thật, chưa làm mock activity/data export thành chức năng mới.

Nếu không trả lời từng câu, dùng các mặc định sau khi **kế hoạch tổng thể được duyệt**. Không tự hiểu im lặng là đã duyệt Giai đoạn 1, migration chung, Stripe account setup hay go-live production.

## 11. Thứ tự triển khai và điều kiện nghiệm thu sau duyệt

| Giai đoạn | Công việc | Kiểm chứng và tài liệu |
|---|---|---|
| 1 — Nền tảng | website pnpm workspace, pin compatible stable versions, strict TS, lint/Prettier, shared schemas, env loader/examples, Mongo replica set Compose, Fastify factory/plugins/errors/request-id/logging/health/OpenAPI | inject health/errors/env-validation; lint/typecheck/test/build trong website; docs kiến trúc/README chạy mới dưới 10 phút với prerequisites rõ |
| 2 — Backend | auth + Svix → products/categories → cart/wishlist/addresses → checkout/payment/orders + worker → reviews → notifications → signed upload/admin tối thiểu | Vitest + fastify.inject + MongoMemoryReplSet; từng module chạy tests đến xanh; payment provider mocks và Stripe test/CLI verification riêng; docs API/decisions cập nhật |
| 3 — Frontend nền | Next layouts/header/footer/nav/theme/Clerk, shadcn UI, typed shared API client, Query providers, i18n | component tests cho auth/error/form/API behavior; SSR public và private cache checks; 4 lệnh gates |
| 4 — Frontend tính năng | home/catalogue/detail SEO → cart/wishlist → account/addresses → checkout/return/orders → reviews → notifications | chạy browser thật theo từng flow; loading/error/empty/optimistic rollback/a11y responsive; screenshot evidence khi hữu ích; 4 lệnh gates |
| 5 — Kiểm thử/tối ưu | Playwright auth/cart/checkout/orders, Lighthouse/a11y, OWASP review, cache/query/index audit | Clerk test user bằng secret trong test env, không bypass production auth; mocks không thay cho kiểm chứng Clerk/Stripe sandbox; báo rõ external checks chưa chạy; 4 lệnh gates |
| 6 — Deploy | API multi-stage Dockerfile, web Vercel, API Render đề xuất; Atlas replica set; website-only CI; health/shutdown/worker ops; domains/CORS/Clerk/Stripe webhooks | staging smoke + payment signature/retry/expiry, go-live/rollback checklist; cập nhật root README mục Web storefront chỉ ở giai đoạn đã duyệt; production cần credentials/quyền deploy thật |

Mọi giai đoạn sau tạo workspace chạy thật `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` từ website; thêm tests phù hợp thay đổi, không bỏ qua failures. Commit nhỏ Conventional Commits theo module khi được phép ghi git; không commit secrets/fixtures PII. Không dùng root `pnpm build` vì script hiện có cài deps và build ứng dụng cũ.

Test rủi ro ưu tiên: invalid types/ObjectId/NoSQL operators, cross-user IDOR, admin denial, token issuer, webhook sai chữ ký/duplicate/out-of-order/deleted user, cạnh tranh tồn kho/duplicate products/idempotency, Stripe timeout/late success/expiry race, transaction rollback, review duplicate/aggregate race, cart mutation trong checkout, deleted products, DTO không lộ PII, legacy documents round-trip và admin updates xuất hiện trong web inbox. Race tests bảo đảm phạm vi API web, không giả lập rằng legacy writer đã an toàn.

CI chỉ trigger paths website/docs-web/workflow cần thiết; install frozen-lockfile → lint → typecheck → tests → build, không chạy scripts cũ. E2E sandbox/secrets tách khỏi untrusted fork jobs. Deploy không tự provision dịch vụ trả phí; pin release, migration audit/backup, smoke staging trước live, rollback application images/config và ledger reconciliation, không khôi phục DB cũ đè payment mới một cách mù quáng.

## 12. Kết quả kiểm tra Giai đoạn 0

- `git status --short` ban đầu sạch. `git log -8 --oneline` xác nhận PR #30 ở HEAD. Inventory paths và đối chiếu 7 route files, 5 models, 7 controllers, middleware/server với mobile/admin callsites.
- Runtime quan sát: Node v20.19.6, pnpm 10.17.1. Chưa install hoặc pin bất kỳ package mới; runtime yêu cầu sẽ kiểm tra lại theo stable package được chọn ở Giai đoạn 1.
- Đã thử thật `pnpm --dir website lint`, `pnpm --dir website typecheck`, `pnpm --dir website test`, `pnpm --dir website build`: **cả 4 exit 1, ENOENT vì website chưa tồn tại**. Đây không phải kiểm chứng app và không được báo xanh. Không chạy build gốc vì sẽ tác động dependencies/build của app cũ trái phạm vi Giai đoạn 0.
- Kiểm tra tài liệu sau khi ghi: whitespace/diff, đủ mục yêu cầu, đủ endpoint controller và screen mapping; đối chiếu trạng thái Git để bảo đảm chỉ docs/web mới được thêm. Không chạy API, integration/E2E/Lighthouse vì chưa có implementation web.
- Chưa kiểm chứng: dữ liệu/index DB live, Clerk/inngest dashboard, Stripe account/subscriptions/mode, Expo push device, Render deployment settings. Các việc này phải được ghi nhận riêng khi có cấu hình/quyền thích hợp, không được báo đã deploy.

## 13. Tài liệu kỹ thuật đã đối chiếu

Nguồn repo là cơ sở cho toàn bộ mô tả hệ thống cũ. Nguồn chính thức dưới đây dùng để kiểm tra hướng implementation, không khẳng định package đã được cài/kiểm thử trong website:

- [Next installation](https://nextjs.org/docs/app/getting-started/installation) và [Proxy convention](https://nextjs.org/docs/app/getting-started/proxy): App Router tooling và convention mới; chốt stable version/Node yêu cầu khi khởi tạo.
- [Fastify v5 migration](https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/) và [type providers](https://fastify.dev/docs/latest/Reference/Type-Providers/): yêu cầu runtime và Zod provider; kiểm typings/peer dependencies trước chọn scoped package hay fastify-type-provider-zod.
- [Clerk Fastify clerkPlugin](https://clerk.com/docs/reference/fastify/clerk-plugin): plugin/auth helpers, load env trước SDK initialization.
- [Stripe webhooks](https://docs.stripe.com/webhooks): signature, asynchronous event delivery, retry/dedup/account event destinations. Phân tích khả năng xử lý trùng là suy luận từ event delivery kết hợp handler cũ không lọc nguồn.
- [Stripe metadata](https://docs.stripe.com/metadata): giới hạn mỗi value 500 ký tự; dùng checkout ID tham chiếu record DB thay nguyên giỏ/địa chỉ JSON.
- [Inngest serve](https://www.inngest.com/docs/reference/typescript/serve): protocol overview; chi tiết repo cũ được xác minh bằng SDK local **3.48.1**, không lấy contract v4 thay v3.

**Điểm dừng:** chờ bạn duyệt kiến trúc, endpoints và mặc định mục 10 trước khi tạo workspace hoặc code Giai đoạn 1.
