import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export function Badge({ className, ...props }: ComponentProps<'span'>) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-foreground',
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
        'rounded-panel border border-border bg-card p-5 text-card-foreground shadow-panel',
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
      className={cn(
        'animate-pulse rounded-control bg-muted motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}
export function Separator({ className, ...props }: ComponentProps<'hr'>) {
  return <hr className={cn('border-border', className)} {...props} />;
}
