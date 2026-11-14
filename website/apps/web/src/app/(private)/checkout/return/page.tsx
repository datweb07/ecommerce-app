import type { Metadata } from 'next';
import { Placeholder } from '../../../../components/common/page';
export const metadata: Metadata = { title: 'Kết quả thanh toán' };
export default function Page() {
  return (
    <Placeholder
      title="Kết quả thanh toán"
      parent={{ label: 'Thanh toán', href: '/checkout' }}
    />
  );
}
