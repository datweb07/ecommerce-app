'use client';

import { Check, ChevronDown } from 'lucide-react';
import {
  Checkbox as RCheckbox,
  Label as RLabel,
  RadioGroup as RRadio,
  Select as RSelect,
  Switch as RSwitch,
} from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const field =
  'min-h-11 w-full rounded-control border border-control-border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground disabled:opacity-50';
export function Input({ className, ref, ...props }: ComponentProps<'input'>) {
  return <input ref={ref} className={cn(field, className)} {...props} />;
}
export function Textarea({
  className,
  ref,
  ...props
}: ComponentProps<'textarea'>) {
  return (
    <textarea
      ref={ref}
      className={cn(field, 'min-h-24', className)}
      {...props}
    />
  );
}
export function Label({
  className,
  ...props
}: ComponentProps<typeof RLabel.Root>) {
  return (
    <RLabel.Root
      className={cn('text-label font-medium', className)}
      {...props}
    />
  );
}
export function Checkbox({
  className,
  ...props
}: ComponentProps<typeof RCheckbox.Root>) {
  return (
    <RCheckbox.Root
      className={cn(
        'grid size-5 place-items-center rounded border border-control-border data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        className,
      )}
      {...props}
    >
      <RCheckbox.Indicator>
        <Check size={15} />
      </RCheckbox.Indicator>
    </RCheckbox.Root>
  );
}
export const RadioGroup = RRadio.Root;
export function RadioGroupItem({
  className,
  ...props
}: ComponentProps<typeof RRadio.Item>) {
  return (
    <RRadio.Item
      className={cn(
        'grid size-5 place-items-center rounded-control border border-control-border',
        className,
      )}
      {...props}
    >
      <RRadio.Indicator className="size-2.5 rounded-control bg-primary" />
    </RRadio.Item>
  );
}
export function Switch({
  className,
  ...props
}: ComponentProps<typeof RSwitch.Root>) {
  return (
    <RSwitch.Root
      className={cn(
        'h-6 w-11 rounded-control bg-muted-foreground transition-colors data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <RSwitch.Thumb className="block size-5 translate-x-0.5 rounded-control bg-white transition-transform data-[state=checked]:translate-x-[22px]" />
    </RSwitch.Root>
  );
}

export const Select = RSelect.Root;
export const SelectValue = RSelect.Value;
export function SelectTrigger({
  children,
  className,
  ...props
}: ComponentProps<typeof RSelect.Trigger>) {
  return (
    <RSelect.Trigger
      className={cn(field, 'flex items-center justify-between', className)}
      {...props}
    >
      {children}
      <RSelect.Icon>
        <ChevronDown size={16} />
      </RSelect.Icon>
    </RSelect.Trigger>
  );
}
export function SelectContent({
  children,
  ...props
}: ComponentProps<typeof RSelect.Content>) {
  return (
    <RSelect.Portal>
      <RSelect.Content
        position="popper"
        sideOffset={5}
        className="z-60 min-w-(--radix-select-trigger-width) rounded-control border border-control-border bg-card p-1"
        {...props}
      >
        <RSelect.Viewport>{children}</RSelect.Viewport>
      </RSelect.Content>
    </RSelect.Portal>
  );
}
export function SelectItem({
  children,
  ...props
}: ComponentProps<typeof RSelect.Item>) {
  return (
    <RSelect.Item
      className="relative cursor-default rounded-control py-2 pr-3 pl-8 text-sm outline-none data-highlighted:bg-muted"
      {...props}
    >
      <RSelect.ItemIndicator className="absolute top-2.5 left-2">
        <Check size={14} />
      </RSelect.ItemIndicator>
      <RSelect.ItemText>{children}</RSelect.ItemText>
    </RSelect.Item>
  );
}
