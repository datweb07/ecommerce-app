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
    />
  );
}
export function toastApiError(error: unknown) {
  return toast.error(apiErrorMessage(error));
}
