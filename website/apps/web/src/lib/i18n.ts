const vi = {
  catalogue: {
    imageUnavailable: 'Ảnh sản phẩm chưa có',
    unavailable: 'Không thể tải dữ liệu. Vui lòng thử lại.',
    outOfStock: 'Hết hàng',
    viewAll: 'Xem tất cả',
    noProducts: 'Chưa có sản phẩm',
    noCategories: 'Chưa có danh mục',
  },
  home: {
    title: 'Mua sắm cùng ShopEase',
    intro:
      'Từ đồ công nghệ đến trang phục và phụ kiện, tìm món đồ phù hợp với bạn.',
    explore: 'Khám phá sản phẩm',
    stay: 'Mua sắm theo danh mục',
    new: 'Sản phẩm mới',
    popular: 'Sản phẩm bán chạy',
    shipping: 'Giao hàng tận nơi',
    shippingDetail: 'Xem phí giao hàng trước khi thanh toán.',
    payment: 'Thanh toán qua Stripe',
    paymentDetail: 'Thanh toán trên trang Stripe Checkout.',
    tracking: 'Theo dõi đơn hàng',
    trackingDetail: 'Xem mốc giao hàng trong tài khoản.',
  },
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
