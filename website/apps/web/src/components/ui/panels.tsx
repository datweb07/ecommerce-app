import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-caption font-medium text-muted-foreground',
        className,
      )}
      {...props}
    />
  );
}
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn(
        'border-t border-border py-5 text-card-foreground',
        className,
      )}
      {...props}
    />
  );
}
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn('rounded-control bg-muted', className)}
      {...props}
    />
  );
}
export function Separator({ className, ...props }: ComponentProps<'hr'>) {
  return <hr className={cn('border-border', className)} {...props} />;
}
