'use client';

import { AlertDialog as Alert, Dialog as Modal } from 'radix-ui';
import { X } from 'lucide-react';
import type { ComponentProps } from 'react';
import { cn } from '../../lib/utils';
import { Button } from './button';

const overlay = 'fixed inset-0 z-50 bg-black/55';
const modal =
  'fixed top-1/2 left-1/2 z-50 grid w-[min(92vw,28rem)] -translate-1/2 gap-4 rounded-panel border border-border bg-card p-6 shadow-panel';
export const Dialog = Modal.Root;
export const DialogTrigger = Modal.Trigger;
export const DialogTitle = Modal.Title;
export const DialogDescription = Modal.Description;
export const DialogClose = Modal.Close;
export const Sheet = Modal.Root;
export const SheetTrigger = Modal.Trigger;
export const SheetTitle = Modal.Title;
export const SheetDescription = Modal.Description;
export const SheetClose = Modal.Close;
export function DialogContent({
  children,
  className,
  ...props
}: ComponentProps<typeof Modal.Content>) {
  return (
    <Modal.Portal>
      <Modal.Overlay className={overlay} />
      <Modal.Content className={cn(modal, className)} {...props}>
        {children}
        <CloseButton />
      </Modal.Content>
    </Modal.Portal>
  );
}
function CloseButton() {
  return (
    <Modal.Close asChild>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-3 right-3"
        aria-label="Đóng"
      >
        <X size={19} />
      </Button>
    </Modal.Close>
  );
}
export function SheetContent({
  children,
  className,
  ...props
}: ComponentProps<typeof Modal.Content>) {
  return (
    <Modal.Portal>
      <Modal.Overlay className={overlay} />
      <Modal.Content
        className={cn(
          'fixed inset-y-0 left-0 z-50 w-[min(88vw,23rem)] overflow-auto border-r border-border bg-card p-5 shadow-panel',
          className,
        )}
        {...props}
      >
        {children}
        <CloseButton />
      </Modal.Content>
    </Modal.Portal>
  );
}
export const AlertDialog = Alert.Root;
export const AlertDialogTrigger = Alert.Trigger;
export const AlertDialogTitle = Alert.Title;
export const AlertDialogDescription = Alert.Description;
export const AlertDialogCancel = Alert.Cancel;
export const AlertDialogAction = Alert.Action;
export function AlertDialogContent({
  className,
  ...props
}: ComponentProps<typeof Alert.Content>) {
  return (
    <Alert.Portal>
      <Alert.Overlay className={overlay} />
      <Alert.Content className={cn(modal, className)} {...props} />
    </Alert.Portal>
  );
}
