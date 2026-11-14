import type { Metadata } from 'next';
import { Placeholder } from '../../../../../components/common/page';
export const metadata: Metadata = { title: 'Chi tiết đơn hàng' };
export default function Page() {
  return (
    <Placeholder
      title="Chi tiết đơn hàng"
      parent={{ label: 'Đơn hàng', href: '/account/orders' }}
      embedded
    />
  );
}
