# Phát hành APK Android của ShopEase

Storefront dùng **GitHub Releases** của repo `datweb07/ecommerce-app`. Repo công khai đã có sẵn kênh phát hành, trang riêng cho từng tag và nút tải APK trong **Assets**. APKPure có quy trình gửi APK và chờ duyệt. Có thể thêm kênh đó khi cần người dùng khám phá ứng dụng trên kho bên thứ ba. [GitHub Releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) · [APKPure Developer](https://developer.apkpure.com/)

## Kết quả kiểm tra APK

| Tệp | Dung lượng | Chạy độc lập từ APK | Chữ ký |
| --- | ---: | --- | --- |
| `mobile/android/app/build/outputs/apk/debug/app-debug.apk` | 127,66 MiB | Debuggable, thiếu `assets/index.android.bundle` | Android Debug |
| `mobile/android/app/build/outputs/apk/release/app-release.apk` | 104,09 MiB | Có `assets/index.android.bundle`, manifest không debuggable | Android Debug |
| `app-ver2.apk` trên GitHub `ver-2.0.0` | 103,41 MiB | Có `assets/index.android.bundle`, manifest không debuggable | Android Debug |

Cả ba có package `com.dat82770.anonymous`, versionName `1.0.0`, versionCode `1`, min SDK 24 và target SDK 36. Android SDK Build Tools xác minh được chữ ký v2. Cả ba dùng cùng fingerprint của chứng chỉ debug, nên chưa dùng làm bản phát hành chính thức. File tải từ GitHub khớp SHA-256 do Releases API công bố, `8d510b9b5c1f921dc3d6bce52908906d303b704ef9412141e436f0dc33248117`. ADB chưa thấy thiết bị kết nối, nên các APK mới được kiểm tra tĩnh. [GitHub release đã kiểm tra](https://github.com/datweb07/ecommerce-app/releases/tag/ver-2.0.0) · [Android apksigner](https://developer.android.com/tools/apksigner)

Fingerprint SHA-256 của chứng chỉ debug hiện tại là `fac61745dc0903786fb9ede62a962b399f7348f0bb6f899b8332667591033b9c`. Bundle của hai bản release chứa host Render của backend mobile hiện có. Kết quả tĩnh chưa xác nhận kết nối backend hoặc phiên đăng nhập trên thiết bị.

## 1. Tạo và kiểm tra APK đã ký phát hành

Trong dự án ShopEase trên Expo, đặt `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` và `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` ở môi trường **Preview** mà profile hiện tại sử dụng. Đối chiếu backend mobile đang triển khai trong cấu hình mobile, rồi kiểm đăng nhập và thanh toán theo môi trường đã chọn. Các biến `EXPO_PUBLIC_*` được đóng vào APK. Chỉ đặt publishable key ở đó. [Biến môi trường EAS](https://docs.expo.dev/eas/environment-variables/usage/)

Từ `mobile/`, đăng nhập tài khoản Expo có quyền với dự án. Kiểm tra credentials Android qua `eas credentials -p android` và dùng khóa phát hành do bạn quản lý. Nếu đây là lần đầu tạo khóa phát hành, lưu bản sao keystore và thông tin khôi phục ở nơi an toàn. Giữ đúng khóa này cho các lần cập nhật sau. Profile `preview` hiện có xuất APK độc lập. [Tạo APK bằng EAS](https://docs.expo.dev/build-reference/apk/) · [Ký ứng dụng Android](https://developer.android.com/studio/publish/app-signing)

```powershell
eas login
eas credentials -p android
eas build:version:set -p android -e preview
eas build -p android --profile preview
```

Ở bước version, chọn versionCode lớn hơn mọi bản đã phát hành cho cùng package. Bản đã kiểm tra hiện là 1. `preview` hiện dùng bộ đếm remote và chưa tự tăng. Khi EAS hoàn tất, tải APK xuống và kiểm tra bằng Android SDK. So fingerprint với khóa phát hành bạn đã chọn, kiểm versionCode, package, manifest và bundle trước khi tải lên. [Quản lý phiên bản EAS](https://docs.expo.dev/build-reference/app-versions/)

```powershell
$apk = 'D:\Downloads\ShopEase-android.apk'
$tools = 'D:\Sdk\build-tools\36.1.0'
& "$tools\apksigner.bat" verify --verbose --print-certs $apk
& "$tools\aapt.exe" dump badging $apk | Select-String '^package:|^application-debuggable'
tar -tf $apk | Select-String '^assets/index.android.bundle$'
Get-FileHash -Algorithm SHA256 $apk
```

Cài APK trên Android thật và thử mở app khi Metro tắt, đăng nhập, tải catalogue và luồng thanh toán phù hợp. Nếu máy đã cài một APK ký debug cùng package, bản ký release sẽ không cập nhật đè do khác khóa. Dùng máy test cài mới hoặc gỡ bản debug sau khi lưu dữ liệu cục bộ cần giữ. Kiểm tra yêu cầu xác minh nhà phát triển cho phân phối ngoài Play theo khu vực trước khi mở rộng. [Xác minh nhà phát triển Android](https://developer.android.com/developer-verification)

## 2. Phát hành trên GitHub và bật QR

1. Mở **Releases → Draft a new release** trong repo công khai. Tạo tag dành riêng cho APK, chẳng hạn `android-v1.0.0`, từ commit nguồn đã build. Đính kèm `ShopEase-android.apk` vào **Assets**. Trong ghi chú, ghi versionCode, phiên bản Android được hỗ trợ và SHA-256.
2. Publish release. Mở trang đó ở cửa sổ ẩn danh và tải APK một lần. Kiểm SHA-256 trùng với file đã thử. Dùng URL trang release theo tag để QR luôn trỏ tới bản đã nghiệm thu.
3. Đặt biến dưới đây cho Next.js trong `website/apps/web/.env.local` khi chạy local, hoặc trong môi trường build storefront khi triển khai. Build lại web sau khi thay đổi. Dòng này là ví dụ, hãy thay tag bằng release thực tế.

```dotenv
MOBILE_ANDROID_DOWNLOAD_URL=https://github.com/datweb07/ecommerce-app/releases/tag/android-v1.0.0
```

4. Mở storefront và cuộn xuống cuối trang. Quét mã bằng camera Android, chọn mở trình duyệt, mở **Assets → ShopEase-android.apk**, tải xuống và mở file để Android hiển thị bước cài đặt. Nếu Android hỏi quyền cho nguồn cài đặt, làm theo hướng dẫn của hệ điều hành cho trình duyệt đã tải tệp. Nút **Mở trang tải cho Android** đưa người dùng đến cùng địa chỉ ngay trên điện thoại.

Khi chưa cấu hình URL, footer hiển thị thông báo đang chuẩn bị. QR được tạo trong Next.js từ chính URL của nút tải. Có thể dùng đường dẫn `/releases/latest` khi repo luôn giữ bản latest là release có APK đã kiểm. Với repo chung web và mobile, URL theo tag giúp tránh trỏ nhầm release khác. [Liên kết GitHub release](https://docs.github.com/en/repositories/releasing-projects-on-github/linking-to-releases)
