const vi = {
  nav: {
    home: 'Trang chủ',
    products: 'Sản phẩm',
    categories: 'Danh mục',
    wishlist: 'Yêu thích',
    cart: 'Giỏ hàng',
    account: 'Tài khoản',
    notifications: 'Thông báo',
    signIn: 'Đăng nhập',
    search: 'Tìm sản phẩm',
    menu: 'Mở menu',
    skip: 'Chuyển đến nội dung',
  },
  common: {
    preview: 'Đang xây dựng',
    retry: 'Thử lại',
    goHome: 'Về trang chủ',
    close: 'Đóng',
    empty: 'Chưa có dữ liệu',
    theme: 'Giao diện',
    light: 'Sáng',
    dark: 'Tối',
    system: 'Hệ thống',
  },
} as const;

export function t<Namespace extends keyof typeof vi>(
  namespace: Namespace,
  key: keyof (typeof vi)[Namespace],
) {
  return vi[namespace][key];
}
