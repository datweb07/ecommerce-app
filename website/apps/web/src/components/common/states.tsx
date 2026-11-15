import { CircleAlert, PackageOpen } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../../lib/i18n';
import { Button } from '../ui/button';
import { Card, Skeleton } from '../ui/panels';

export function EmptyState({
  title = t('common', 'empty'),
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="grid justify-items-center gap-3 py-10 text-center">
      <PackageOpen aria-hidden="true" className="text-primary" />
      <h2 className="text-xl font-medium">{title}</h2>
      {description && <p className="text-muted-foreground">{description}</p>}
      {action}
    </Card>
  );
}
export function ErrorState({
  title = 'Không thể tải nội dung',
  description,
  retry,
  action,
}: {
  title?: string;
  description?: string;
  retry?: () => void;
  action?: ReactNode;
}) {
  return (
    <Card className="grid justify-items-center gap-3 py-10 text-center">
      <CircleAlert aria-hidden="true" className="text-destructive" />
      <h1 className="text-2xl font-medium">{title}</h1>
      {description && <p className="text-muted-foreground">{description}</p>}
      <div className="flex flex-wrap justify-center gap-3">
        {retry && <Button onClick={retry}>{t('common', 'retry')}</Button>}
        {action}
      </div>
    </Card>
  );
}
export function LoadingSkeleton({
  variant = 'list',
}: {
  variant?: 'card' | 'list' | 'form';
}) {
  return (
    <div role="status" className="space-y-4">
      <span className="sr-only">Đang tải</span>
      <Skeleton className="h-7 w-44" />
      <div
        className={
          variant === 'card' ? 'grid gap-4 sm:grid-cols-3' : 'grid gap-3'
        }
      >
        {[1, 2, 3].map((index) => (
          <Skeleton
            key={index}
            className={
              variant === 'card'
                ? 'h-40'
                : variant === 'form'
                  ? 'h-11 max-w-lg'
                  : 'h-16'
            }
          />
        ))}
      </div>
    </div>
  );
}
