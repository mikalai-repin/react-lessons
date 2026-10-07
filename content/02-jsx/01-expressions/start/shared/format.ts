const priceFormat = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/** 1990 → «1 990 ₽» */
export function formatPrice(price: number): string {
  return priceFormat.format(price);
}
