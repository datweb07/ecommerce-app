import type { Metadata } from 'next';
import { BannerEditor } from '../../../../components/admin/banner-editor';
import { t } from '../../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'addBanner') };
export default function NewBanner() {
  return <BannerEditor />;
}
