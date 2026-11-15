import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AdminShell } from '../../components/admin/shell';
import { requireAdminPage } from '../../lib/admin/guard';

export const metadata: Metadata = {
  title: { default: 'Quản trị', template: '%s | Quản trị ShopEase' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  await requireAdminPage();
  return <AdminShell>{children}</AdminShell>;
}
