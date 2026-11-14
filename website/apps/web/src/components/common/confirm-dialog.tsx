'use client';
import type { ReactElement } from 'react';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '../ui/overlays';

export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = 'Xác nhận',
  onConfirm,
}: {
  trigger: ReactElement;
  title: string;
  description: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogTitle className="text-lg font-bold">
          {title}
        </AlertDialogTitle>
        <AlertDialogDescription className="text-sm text-muted-foreground">
          {description}
        </AlertDialogDescription>
        <div className="flex flex-wrap justify-end gap-2">
          <AlertDialogCancel asChild>
            <Button variant="outline">Quay lại</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button variant="danger" onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
