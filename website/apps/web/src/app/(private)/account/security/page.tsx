import type { Metadata } from 'next';
import { Placeholder } from '../../../../components/common/page';
export const metadata: Metadata = { title: 'Bảo mật' };
export default function Page() {
  return (
    <Placeholder
      title="Bảo mật"
      parent={{ label: 'Tài khoản', href: '/account' }}
      embedded
    />
  );
}
