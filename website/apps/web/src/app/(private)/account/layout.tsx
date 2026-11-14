import type { ReactNode } from 'react';
import { AccountNav } from '../../../components/layout/account-nav';
import { PageContainer } from '../../../components/common/page';
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <PageContainer className="grid items-start gap-7 lg:grid-cols-[14rem_minmax(0,1fr)]">
      <AccountNav />
      {children}
    </PageContainer>
  );
}
