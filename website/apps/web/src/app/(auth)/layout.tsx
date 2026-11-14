import type { ReactNode } from 'react';
import type { Metadata } from 'next';
export const metadata: Metadata = { robots: { index: false, follow: false } };
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto grid min-h-[56vh] w-full max-w-lg place-items-center px-4 py-10">
      {children}
    </div>
  );
}
