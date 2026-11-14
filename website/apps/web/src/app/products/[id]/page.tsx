import type { Metadata } from 'next';
import { Placeholder } from '../../../components/common/page';
export const metadata: Metadata = { title: 'Chi tiết sản phẩm' };
export default function Page() {
  return (
    <Placeholder
      title="Chi tiết sản phẩm"
      parent={{ label: 'Sản phẩm', href: '/products' }}
    />
  );
}
