import type { ReactNode } from 'react';

export function FormLine({
  label,
  error,
  id,
  children,
}: {
  label: string;
  error?: string | undefined;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      {children}
      {error && (
        <span
          id={id + '-error'}
          className="text-sm text-destructive"
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
