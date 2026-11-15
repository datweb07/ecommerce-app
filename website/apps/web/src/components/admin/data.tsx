'use client';

import type { ReactNode, FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ErrorState, LoadingSkeleton } from '../common/states';
import { Button } from '../ui/button';
import { Input } from '../ui/fields';
import { Pagination } from '../ui/pagination';
import { apiErrorMessage } from '../../lib/api/transport';
import { t } from '../../lib/i18n';

export function AdminTitle({
  title,
  action,
  description,
}: {
  title: string;
  action?: ReactNode;
  description?: string;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
      <div>
        <h1 className="text-section font-medium tracking-tight sm:text-title">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function AdminData<T>({
  result,
  children,
  variant,
}: {
  result: {
    data: T | undefined;
    error: unknown;
    isPending: boolean;
    isError: boolean;
    refetch: () => unknown;
  };
  children: (data: T) => ReactNode;
  variant?: 'card' | 'list' | 'form';
}) {
  if (result.isPending) return <LoadingSkeleton variant={variant ?? 'list'} />;
  if (result.isError || result.data === undefined)
    return (
      <ErrorState
        description={apiErrorMessage(result.error)}
        retry={() => {
          void result.refetch();
        }}
      />
    );
  return children(result.data);
}

export type Column<Row> = {
  label: string;
  cell: (row: Row) => ReactNode;
  numeric?: boolean;
};
export function AdminTable<Row extends { id: string }>({
  label,
  columns,
  rows,
  empty = t('admin', 'empty'),
}: {
  label: string;
  columns: Column<Row>[];
  rows: Row[];
  empty?: string;
}) {
  if (!rows.length)
    return (
      <p className="border-b border-border py-8 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  return (
    <div
      // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- Keyboard users need to scroll overflowing tables.
      tabIndex={0}
      role="region"
      aria-label={label}
      className="max-w-full overflow-x-auto"
    >
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-border">
            {columns.map(({ label, numeric }) => (
              <th
                key={label}
                scope="col"
                className={
                  'px-3 py-3 text-xs font-medium tracking-wide text-muted-foreground uppercase first:pl-0 ' +
                  (numeric ? 'text-right' : '')
                }
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="border-b border-border hover:bg-muted/50"
            >
              {columns.map(({ label, cell, numeric }) => (
                <td
                  key={label}
                  className={
                    'px-3 py-3 align-middle first:pl-0 ' +
                    (numeric ? 'text-right tabular-nums' : '')
                  }
                >
                  {cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AdminPagination({
  path,
  filters,
  data,
}: {
  path: string;
  filters: Record<string, string | undefined>;
  data: { page: number; limit: number; total: number };
}) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(filters))
    if (value) search.set(key, value);
  const pages = Math.min(
    501,
    Math.floor(10_000 / data.limit) + 1,
    Math.ceil(data.total / data.limit),
  );
  return (
    <Pagination
      pathname={path}
      search={search.toString()}
      page={data.page}
      totalPages={pages}
    />
  );
}

export type FilterField = {
  name: string;
  label: string;
  type?: 'search' | 'date';
  maxLength?: number;
  options?: ReadonlyArray<readonly [string, string]>;
};
export const selectClass =
  'min-h-11 w-full rounded-control border border-control-border bg-background px-3 text-sm';
export function AdminFilters({
  path,
  fields,
  values,
}: {
  path: string;
  fields: FilterField[];
  values: Record<string, string | undefined>;
}) {
  const router = useRouter();
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = new URLSearchParams();
    for (const [key, entry] of new FormData(event.currentTarget)) {
      if (typeof entry === 'string' && entry.trim())
        search.set(key, entry.trim());
    }
    if (values.limit) search.set('limit', values.limit);
    router.push(search.size ? path + '?' + search.toString() : path);
  }
  return (
    <form
      action={path}
      onSubmit={filter}
      className="flex flex-wrap items-end gap-3"
    >
      {fields.map(({ name, label, type, options, maxLength }) => (
        <label key={name} className="grid gap-1.5 text-sm">
          {label}
          {options ? (
            <select
              name={name}
              className={selectClass}
              defaultValue={values[name] ?? ''}
            >
              {options.map(([value, text]) => (
                <option key={value} value={value}>
                  {text}
                </option>
              ))}
            </select>
          ) : (
            <Input
              name={name}
              type={type ?? 'search'}
              defaultValue={values[name] ?? ''}
              maxLength={maxLength ?? 100}
            />
          )}
        </label>
      ))}
      <Button type="submit" variant="outline">
        {t('admin', 'filter')}
      </Button>
      <Button variant="ghost" asChild>
        <Link href={path}>{t('admin', 'clear')}</Link>
      </Button>
    </form>
  );
}
