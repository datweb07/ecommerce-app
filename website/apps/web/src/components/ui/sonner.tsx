'use client';

import { useTheme } from 'next-themes';
import { Toaster as Sonner, toast } from 'sonner';
import { apiErrorMessage } from '../../lib/api/transport';

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      theme={resolvedTheme === 'dark' ? 'dark' : 'light'}
      position="bottom-right"
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--foreground)',
          border: '1px solid var(--control-border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'none',
          fontSize: '0.875rem',
        },
      }}
    />
  );
}
export function toastApiError(error: unknown) {
  return toast.error(apiErrorMessage(error));
}
