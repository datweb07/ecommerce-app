'use client';
import { t } from '../../lib/i18n';
import { apiErrorMessage } from '../../lib/api/transport';
import { Button } from '../ui/button';

export function CustomerError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-4 rounded-panel border border-border bg-card p-5"
    >
      <p>{apiErrorMessage(error)}</p>
      <Button variant="outline" onClick={retry}>
        {t('common', 'retry')}
      </Button>
    </div>
  );
}
