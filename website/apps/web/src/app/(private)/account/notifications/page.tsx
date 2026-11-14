import type { Metadata } from 'next';
import { Placeholder } from '../../../../components/common/page';
export const metadata: Metadata = { title: 'Thông báo' };
export default function Page() {
  return (
    <Placeholder
      title="Thông báo"
      parent={{ label: 'Tài khoản', href: '/account' }}
      embedded
    />
  );
}
