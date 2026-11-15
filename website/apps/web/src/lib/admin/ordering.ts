export function moveItem<T>(items: readonly T[], from: number, to: number) {
  const item = items[from];
  if (item === undefined || to < 0 || to >= items.length || from === to)
    return [...items];
  const result = [...items];
  result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}
