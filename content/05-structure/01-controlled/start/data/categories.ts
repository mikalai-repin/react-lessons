import type { Game } from '../api/models';

/** Категории каталога и их подписи — для фильтра */
export const categories: {
  value: Game['category'];
  label: string;
}[] = [
  { value: 'family', label: 'Семейные' },
  { value: 'strategy', label: 'Стратегии' },
  { value: 'party', label: 'Для компании' },
  { value: 'cooperative', label: 'Кооперативные' },
  { value: 'kids', label: 'Детские' },
];
