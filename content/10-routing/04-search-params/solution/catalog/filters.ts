import type { Game } from '../api/models';
import { categories } from '../data/categories';

// Фильтр по категории: одна из категорий или все сразу
export type CategoryFilter = Game['category'] | 'all';

// Порядок каталога
export type SortOrder =
  'default' | 'cheap' | 'expensive' | 'rating';

/** Всё, что покупатель выбрал на витрине, — одним объектом */
export type Filters = {
  query: string;
  category: CategoryFilter;
  inStockOnly: boolean;
  sort: SortOrder;
};

/** Витрина без фильтров: с этого начинаем и к этому сбрасываем */
export const INITIAL_FILTERS: Filters = {
  query: '',
  category: 'all',
  inStockOnly: false,
  sort: 'default',
};

// Функция сравнения игр для каждого порядка
type Compare = (a: Game, b: Game) => number;
const COMPARE: Record<SortOrder, Compare> = {
  default: () => 0,
  cheap: (a, b) => a.price - b.price,
  expensive: (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
};

/** Игры, которые подходят под фильтры, в нужном порядке */
export function filterGames(games: Game[], filters: Filters) {
  const search = filters.query.trim().toLowerCase();
  return games
    .filter(
      (game) =>
        game.title.toLowerCase().includes(search) &&
        (filters.category === 'all' ||
          game.category === filters.category) &&
        (!filters.inStockOnly || game.inStock > 0),
    )
    .toSorted(COMPARE[filters.sort]);
}

// Допустимые значения из адреса: всё остальное — по умолчанию
const SORT_ORDERS: SortOrder[] = [
  'default',
  'cheap',
  'expensive',
  'rating',
];

/** Фильтры из адреса: ?q=…&category=…&inStock=1&sort=….
 *  Адрес набирает пользователь — незнакомые значения не пропускаем */
export function filtersFromParams(
  params: URLSearchParams,
): Filters {
  const category = params.get('category');
  const sort = params.get('sort');
  return {
    query: params.get('q') ?? '',
    category: categories.some((c) => c.value === category)
      ? (category as CategoryFilter)
      : 'all',
    inStockOnly: params.get('inStock') === '1',
    sort: SORT_ORDERS.includes(sort as SortOrder)
      ? (sort as SortOrder)
      : 'default',
  };
}

/** Фильтры в адрес: только то, что отличается от витрины по умолчанию */
export function filtersToParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.category !== 'all') {
    params.set('category', filters.category);
  }
  if (filters.inStockOnly) params.set('inStock', '1');
  if (filters.sort !== 'default')
    params.set('sort', filters.sort);
  return params;
}
