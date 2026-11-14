import type { Metadata } from 'next';
import { Placeholder } from '../../../../components/common/page';
export const metadata: Metadata = { title: 'Đơn hàng' };
export default function Page() {
  return (
    <Placeholder
      title="Đơn hàng"
      parent={{ label: 'Tài khoản', href: '/account' }}
      embedded
    />
  );
}
