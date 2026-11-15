import type { PublicBanner } from './banners.js';

const products = [
  {
    slug: 'headphones',
    alt: 'Tai nghe không dây',
    href: '/products?category=Electronics',
  },
  { slug: 'shoes', alt: 'Giày thể thao', href: '/products?category=Fashion' },
  {
    slug: 'watch',
    alt: 'Đồng hồ tối giản',
    href: '/products?category=Accessories',
  },
];
export const sampleBanners: PublicBanner[] = products.map(
  ({ slug, alt, href }, index) => ({
    id: '71000000000000000000000' + (index + 1),
    imageDesktop: {
      url: '/banners/' + slug + '-desktop.webp',
      width: 1200,
      height: 500,
    },
    imageMobile: {
      url: '/banners/' + slug + '-mobile.webp',
      width: 540,
      height: 675,
    },
    alt,
    href,
    title: alt,
    subtitle: null,
    ctaLabel: null,
  }),
);
