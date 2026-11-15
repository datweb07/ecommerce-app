import type { Metadata } from 'next';
import { AdminBanners } from '../../../components/admin/banners';
import { t } from '../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'banners') };
export default function Banners() {
  return <AdminBanners />;
}
