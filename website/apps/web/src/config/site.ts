import { t } from '../lib/i18n';

export const site = {
  name: 'ShopEase',
  description: 'Khám phá danh mục và quản lý mua sắm tại ShopEase.',
  contactEmail: process.env.NEXT_PUBLIC_STORE_CONTACT_EMAIL,
};

export const storeBenefits = [
  {
    icon: 'shipping',
    title: t('home', 'shipping'),
    description: t('home', 'shippingDetail'),
  },
  {
    icon: 'payment',
    title: t('home', 'payment'),
    description: t('home', 'paymentDetail'),
  },
  {
    icon: 'tracking',
    title: t('home', 'tracking'),
    description: t('home', 'trackingDetail'),
  },
] as const;

export const shoppingSteps = (['choose', 'cart', 'pay', 'track'] as const).map(
  (id) => ({
    id,
    title: t('shoppingGuide', id),
    description: t('shoppingGuide', `${id}Detail`),
  }),
);
