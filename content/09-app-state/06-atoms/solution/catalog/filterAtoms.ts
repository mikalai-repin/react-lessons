import { atom } from 'jotai';
import { INITIAL_FILTERS } from './filters';
import type { Filters } from './filters';

// Порция каталога: столько игр показываем и подгружаем за раз
export const PAGE_SIZE = 3;

// Сколько найденных игр показать: растёт порциями
export const limitAtom = atom(PAGE_SIZE);

// Атом поля фильтра: читается как обычный, а запись ещё и
// возвращает каталог к первой порции — новый список с начала
function filterAtom<T>(initialValue: T) {
  const valueAtom = atom(initialValue);
  return atom(
    (get) => get(valueAtom),
    (_get, set, next: T) => {
      set(valueAtom, next);
      set(limitAtom, PAGE_SIZE);
    },
  );
}

// Каждое поле витрины — свой атом
export const queryAtom = filterAtom(INITIAL_FILTERS.query);
export const categoryAtom = filterAtom(
  INITIAL_FILTERS.category,
);
export const inStockOnlyAtom = filterAtom(
  INITIAL_FILTERS.inStockOnly,
);
export const sortAtom = filterAtom(INITIAL_FILTERS.sort);

// Производный атом: все фильтры одним объектом.
// Зависимости Jotai находит сам — по вызовам get
export const filtersAtom = atom<Filters>((get) => ({
  query: get(queryAtom),
  category: get(categoryAtom),
  inStockOnly: get(inStockOnlyAtom),
  sort: get(sortAtom),
}));

// Атом только для записи: сбросить витрину к началу
export const resetFiltersAtom = atom(null, (_get, set) => {
  set(queryAtom, INITIAL_FILTERS.query);
  set(categoryAtom, INITIAL_FILTERS.category);
  set(inStockOnlyAtom, INITIAL_FILTERS.inStockOnly);
  set(sortAtom, INITIAL_FILTERS.sort);
});
