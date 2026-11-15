'use client';

import {
  DropdownMenu as Dropdown,
  Popover as RPopover,
  Tabs as RTabs,
  Tooltip as RTooltip,
} from 'radix-ui';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';

const floating =
  'z-60 rounded-control border border-border bg-card p-2 text-sm';
export const DropdownMenu = Dropdown.Root;
export const DropdownMenuTrigger = Dropdown.Trigger;
export function DropdownMenuContent({
  className,
  ...props
}: ComponentProps<typeof Dropdown.Content>) {
  return (
    <Dropdown.Portal>
      <Dropdown.Content
        sideOffset={6}
        className={cn(floating, 'min-w-36', className)}
        {...props}
      />
    </Dropdown.Portal>
  );
}
export function DropdownMenuItem({
  className,
  ...props
}: ComponentProps<typeof Dropdown.Item>) {
  return (
    <Dropdown.Item
      className={cn(
        'cursor-default rounded-control px-3 py-2 outline-none data-highlighted:bg-muted',
        className,
      )}
      {...props}
    />
  );
}
export const Popover = RPopover.Root;
export const PopoverTrigger = RPopover.Trigger;
export function PopoverContent({
  className,
  ...props
}: ComponentProps<typeof RPopover.Content>) {
  return (
    <RPopover.Portal>
      <RPopover.Content
        sideOffset={6}
        className={cn(floating, 'max-w-64 p-4', className)}
        {...props}
      />
    </RPopover.Portal>
  );
}
export const TooltipProvider = RTooltip.Provider;
export const Tooltip = RTooltip.Root;
export const TooltipTrigger = RTooltip.Trigger;
export function TooltipContent({
  className,
  ...props
}: ComponentProps<typeof RTooltip.Content>) {
  return (
    <RTooltip.Portal>
      <RTooltip.Content
        sideOffset={5}
        className={cn(floating, className)}
        {...props}
      />
    </RTooltip.Portal>
  );
}
export const Tabs = RTabs.Root;
export const TabsContent = RTabs.Content;
export function TabsList({
  className,
  ...props
}: ComponentProps<typeof RTabs.List>) {
  return (
    <RTabs.List
      className={cn('inline-flex flex-wrap border-b border-border', className)}
      {...props}
    />
  );
}
export function TabsTrigger({
  className,
  ...props
}: ComponentProps<typeof RTabs.Trigger>) {
  return (
    <RTabs.Trigger
      className={cn(
        'rounded-control px-3 py-2 text-sm underline-offset-8 data-[state=active]:font-medium data-[state=active]:underline',
        className,
      )}
      {...props}
    />
  );
}
