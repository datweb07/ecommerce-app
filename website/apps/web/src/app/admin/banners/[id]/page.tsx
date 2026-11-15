import type { Metadata } from 'next';
import { objectId } from '@storefront/shared';
import { notFound } from 'next/navigation';
import { BannerEditorRoute } from '../../../../components/admin/banner-editor';
import { t } from '../../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'editBanner') };
export default async function EditBanner({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = objectId.safeParse((await params).id);
  if (!result.success) notFound();
  return <BannerEditorRoute id={result.data} />;
}
