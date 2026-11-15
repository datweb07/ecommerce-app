export function formatMoney(
  value: number,
  {
    unit = 'major',
    currency = 'usd',
  }: { unit?: 'major' | 'cents'; currency?: 'usd' | 'vnd' } = {},
) {
  if (
    !Number.isFinite(value) ||
    (unit === 'cents' && !Number.isSafeInteger(value))
  ) {
    throw new RangeError('Giá tiền không hợp lệ.');
  }
  const amount = unit === 'cents' ? value / 100 : value;
  const dollars = currency === 'usd';
  return new Intl.NumberFormat(dollars ? 'en-US' : 'vi-VN', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: dollars && !Number.isInteger(amount) ? 2 : 0,
    maximumFractionDigits: dollars ? 2 : 0,
  }).format(amount);
}
