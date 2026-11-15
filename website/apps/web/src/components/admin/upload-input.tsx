'use client';

import { Upload } from 'lucide-react';
import { useId } from 'react';
import { imageAccept, uploadErrorMessage } from '../../lib/admin/upload';
import { apiErrorMessage } from '../../lib/api/transport';
import { t } from '../../lib/i18n';

export function UploadInput({
  label,
  hint,
  busy,
  percent,
  error,
  multiple,
  disabled,
  onFiles,
}: {
  label: string;
  hint?: string;
  busy: boolean;
  percent: number;
  error: unknown;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label
        className="grid cursor-pointer gap-1 rounded-control border border-dashed border-control-border px-3 py-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-focus"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!busy && !disabled && event.dataTransfer.files.length)
            onFiles(Array.from(event.dataTransfer.files));
        }}
      >
        <span className="flex items-center gap-2 text-sm font-medium">
          <Upload size={16} aria-hidden="true" />
          {label}
        </span>
        <span id={id} className="text-xs text-muted-foreground">
          {hint ?? t('admin', 'imageHint')}
        </span>
        <input
          type="file"
          className="sr-only"
          aria-describedby={id}
          accept={imageAccept}
          multiple={multiple}
          disabled={busy || disabled}
          onChange={(event) => {
            const files = Array.from(event.currentTarget.files ?? []);
            event.currentTarget.value = '';
            if (files.length) onFiles(files);
          }}
        />
      </label>
      {busy && (
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t('admin', 'uploading')} ({percent}%)
          <progress
            max={100}
            value={percent}
            className="h-2 w-full accent-primary"
          />
        </label>
      )}
      {Boolean(error) && (
        <p role="alert" className="text-sm text-destructive">
          {uploadErrorMessage(error) ?? apiErrorMessage(error)}
        </p>
      )}
    </div>
  );
}
