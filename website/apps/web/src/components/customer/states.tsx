'use client';
import { t } from '../../lib/i18n';
import { apiErrorMessage } from '../../lib/api/transport';
import { Button } from '../ui/button';

export function CustomerError({
  error,
  retry,
  disabled = false,
}: {
  error: unknown;
  retry: () => void;
  disabled?: boolean;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-4 border-t border-border py-4"
    >
      <p>{apiErrorMessage(error)}</p>
      <Button variant="outline" disabled={disabled} onClick={retry}>
        {t('common', 'retry')}
      </Button>
    </div>
  );
}
