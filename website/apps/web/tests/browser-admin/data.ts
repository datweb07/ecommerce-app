import { sampleBanners } from '@storefront/shared';

export const id = '700000000000000000000001';
const second = '700000000000000000000002';
const published = '2026-01-02T12:05:00.000Z';
const assets = (file: string) => ({
  url: 'https://res.cloudinary.com/fixture/image/upload/products/' + file,
  publicId: 'products/' + file.split('.')[0],
});
function previewProduct(
  productId: string,
  name: string,
  file: string,
  stock: number,
) {
  const image = assets(file);
  return {
    id: productId,
    name,
    description: 'Thiết kế gọn gàng cho sử dụng hằng ngày.',
    category: 'Phụ kiện',
    price: 49.5,
    stock,
    images: [image.url],
    imageAssets: [image],
    averageRating: 5,
    totalReviews: 1,
    stockStatus: stock < 5 ? 'low' : 'available',
    createdAt: published,
  };
}
const product = previewProduct(
  id,
  'Tai nghe không dây',
  'headphones-mobile.webp',
  3,
);
const shoes = previewProduct(second, 'Giày thể thao', 'shoes-mobile.webp', 24);
const order = {
  id,
  status: 'shipped',
  totalPrice: 128.9,
  itemCount: 2,
  createdAt: published,
  shippedAt: published,
  deliveredAt: null,
};
const orderDetails = {
  ...order,
  customer: { name: 'Nguyễn An', email: 'an@example.test' },
  paymentReference: 'e4b57de1',
  shippingAddress: {
    fullName: 'Nguyễn An',
    streetAddress: '14 Đường Nguyễn Trãi',
    city: 'Hà Nội',
    state: 'Hà Nội',
    zipCode: '100000',
    phoneNumber: '0900000000',
  },
  items: [
    {
      productId: id,
      name: product.name,
      image: product.images[0],
      quantity: 2,
      price: 49.5,
    },
  ],
};
const days = [20, 0, 100, 49.5, 72, 39, 128.9];
const stats = {
  revenue: days.reduce((a, b) => a + b, 0),
  orderCount: 12,
  customerCount: 18,
  productCount: 23,
  lowStockCount: 2,
  outOfStockCount: 1,
  ordersByStatus: { pending: 2, shipped: 3, delivered: 7 },
  revenueByDay: days.map((revenue, index) => ({
    date: '2026-01-0' + (index + 1),
    revenue,
  })),
  topProducts: [
    { id, name: product.name, quantity: 6 },
    { id: second, name: shoes.name, quantity: 4 },
  ],
};
export const banners = sampleBanners.map((row, index) => ({
  ...row,
  imageDesktop: { ...row.imageDesktop, publicId: 'seed/desktop-' + index },
  imageMobile: { ...row.imageMobile, publicId: 'seed/mobile-' + index },
  startsAt: null,
  endsAt: null,
  isActive: index !== 1,
  sortOrder: index,
  createdAt: published,
  updatedAt: published,
}));
function page<T>(items: T[]) {
  return { page: 1, limit: 20, total: items.length, items };
}
export function responseFor(url: URL): unknown {
  const tail = url.pathname.slice('/api/v1/'.length);
  if (tail === 'categories')
    return { items: ['Điện tử', 'Phụ kiện', 'Thời trang'] };
  if (tail === 'products') return page([product, shoes]);
  if (tail.startsWith('products/')) return product;
  if (tail === 'admin/me') return { id, isAdmin: true };
  if (tail === 'admin/stats')
    return { ...stats, range: url.searchParams.get('range') ?? '30d' };
  if (tail === 'admin/orders')
    return page([order, { ...order, id: second, status: 'delivered' }]);
  if (tail.startsWith('admin/orders/')) return orderDetails;
  if (tail === 'admin/products')
    return page(
      url.searchParams.get('stockStatus') === 'low'
        ? [product]
        : [product, shoes],
    );
  if (tail.startsWith('admin/products/')) return product;
  if (tail === 'admin/banners') return page(banners);
  if (tail === 'admin/customers')
    return page([
      {
        id,
        name: 'Nguyễn An',
        email: 'an@example.test',
        createdAt: published,
        orderCount: 3,
        totalSpent: 289.8,
      },
      {
        id: second,
        name: 'Trần Bình',
        email: 'binh@example.test',
        createdAt: published,
        orderCount: 2,
        totalSpent: 135,
      },
    ]);
  if (tail === 'admin/reviews')
    return page([
      {
        id,
        productId: id,
        productName: product.name,
        displayName: 'Nguyễn An',
        rating: 5,
        createdAt: published,
      },
    ]);
  if (tail === 'admin/reconciliation')
    return page([
      {
        id,
        status: 'expired',
        orderId: null,
        totalCents: 5499,
        currency: 'usd',
        expiresAt: published,
        createdAt: published,
        paymentReference: '371bd8f2',
      },
    ]);
  return undefined;
}
