import type { Metadata } from 'next';
import { ProductEditor } from '../../../../components/admin/product-editor';
import { t } from '../../../../lib/i18n';
export const metadata: Metadata = { title: t('admin', 'addProduct') };
export default function NewProduct() {
  return <ProductEditor />;
}
