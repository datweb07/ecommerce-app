export type RouteQuery = Record<string, string | string[] | undefined>;
export function toSearchParams(query: RouteQuery) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) {
      for (const item of Array.isArray(value) ? value : [value])
        params.append(key, item);
    }
  }
  return params;
}
export function withPage(pathname: string, search: string, page: number) {
  const params = new URLSearchParams(search);
  if (page > 1) params.set('page', String(page));
  else params.delete('page');
  return params.size ? pathname + '?' + params.toString() : pathname;
}
