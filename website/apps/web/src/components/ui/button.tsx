import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

export const buttonStyles =
  'inline-flex shrink-0 items-center justify-center gap-2 rounded-control text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50';
const variants = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
  outline: 'border border-border bg-card hover:bg-muted',
  ghost: 'hover:bg-muted',
  danger: 'bg-destructive text-white hover:bg-destructive/85',
};
const sizes = {
  default: 'min-h-11 px-4',
  icon: 'size-11',
  small: 'min-h-9 px-3',
};

export function Button({
  asChild,
  variant = 'primary',
  size = 'default',
  className,
  type,
  ...props
}: ComponentProps<'button'> & {
  asChild?: boolean;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
}) {
  const Component = asChild ? Slot.Root : 'button';
  return (
    <Component
      className={cn(buttonStyles, variants[variant], sizes[size], className)}
      type={asChild ? undefined : (type ?? 'button')}
      {...props}
    />
  );
}
