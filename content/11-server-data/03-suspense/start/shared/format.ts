const priceFormat = new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
});

/** 1990 → «1 990 ₽» */
export function formatPrice(price: number): string {
  return priceFormat.format(price);
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** '2026-08-12' → «12 августа 2026 г.» */
export function formatDate(isoDate: string): string {
  return dateFormat.format(new Date(isoDate));
}

/** Сколько осталось: миллисекунды → «1:05:09» (часы:минуты:секунды) */
export function formatDuration(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${hours}:${pad(minutes)}:${pad(seconds)}`;
}
