import type { Metadata } from 'next';
import { Placeholder } from '../../../../components/common/page';
export const metadata: Metadata = { title: 'Hồ sơ' };
export default function Page() {
  return (
    <Placeholder
      title="Hồ sơ"
      parent={{ label: 'Tài khoản', href: '/account' }}
      embedded
    />
  );
}
