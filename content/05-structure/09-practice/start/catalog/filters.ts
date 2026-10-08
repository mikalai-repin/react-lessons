import type { Game } from '../api/models';

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
