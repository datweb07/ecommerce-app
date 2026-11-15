import type { z } from 'zod';
import type { RouteQuery } from '../url-state';

export const adminKey = (section: string, value?: object | string) =>
  value === undefined
    ? (['admin', section] as const)
    : (['admin', section, value] as const);

export function adminFilters<S extends z.ZodType>(
  schema: S,
  source: RouteQuery,
  keys: readonly string[],
): z.input<S> {
  const values: Record<string, string> = {};
  for (const key of keys) {
    const value = source[key];
    if (typeof value === 'string' && value) values[key] = value.trim();
  }
  if (schema.safeParse(values).success) return values as z.input<S>;
  const valid: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (schema.safeParse({ ...valid, [key]: value }).success)
      valid[key] = value;
  }
  return valid as z.input<S>;
}

export function adminDate(value: string | null, time = false) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    ...(time ? { timeStyle: 'short' as const } : {}),
    timeZone: 'UTC',
  }).format(new Date(value));
}
