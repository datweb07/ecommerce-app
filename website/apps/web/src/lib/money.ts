export function formatMoney(
  value: number,
  {
    unit = 'major',
    currency = 'usd',
  }: { unit?: 'major' | 'cents'; currency?: 'usd' } = {},
) {
  if (
    !Number.isFinite(value) ||
    (unit === 'cents' && !Number.isSafeInteger(value))
  ) {
    throw new RangeError('Giá tiền không hợp lệ.');
  }
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(unit === 'cents' ? value / 100 : value);
}
