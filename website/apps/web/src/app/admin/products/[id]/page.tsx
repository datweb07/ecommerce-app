import type { Metadata } from 'next';
import { objectId } from '@storefront/shared';
import { notFound } from 'next/navigation';
import { ProductEditorRoute } from '../../../../components/admin/product-editor';
import { t } from '../../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'editProduct') };
export default async function EditProduct({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const result = objectId.safeParse((await params).id);
  if (!result.success) notFound();
  return <ProductEditorRoute id={result.data} />;
}
