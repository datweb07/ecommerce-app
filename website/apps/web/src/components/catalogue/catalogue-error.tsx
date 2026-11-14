'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Button } from '../ui/button';
import { t } from '../../lib/i18n';

export function CatalogueError({ message }: { message: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-panel border border-border bg-card p-5">
      <p role="status" className="text-sm text-muted-foreground">
        {message}
      </p>
      <Button
        disabled={pending}
        variant="outline"
        onClick={() => startTransition(() => router.refresh())}
      >
        {t('common', 'retry')}
      </Button>
    </div>
  );
}
