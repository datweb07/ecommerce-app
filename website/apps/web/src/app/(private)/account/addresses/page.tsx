import type { Metadata } from 'next';
import { Placeholder } from '../../../../components/common/page';
export const metadata: Metadata = { title: 'Địa chỉ' };
export default function Page() {
  return (
    <Placeholder
      title="Địa chỉ"
      parent={{ label: 'Tài khoản', href: '/account' }}
      embedded
    />
  );
}
