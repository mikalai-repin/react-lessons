import type { Ref } from 'react';
import { useAtom } from 'jotai';
import { categories } from '../data/categories';
import {
  categoryAtom,
  inStockOnlyAtom,
  queryAtom,
  sortAtom,
} from './filterAtoms';
import type { CategoryFilter, SortOrder } from './filters';
import styles from './CatalogFilters.module.css';

type CatalogFiltersProps = {
  // Ссылка на поле поиска — для фокуса снаружи
  ref?: Ref<HTMLInputElement>;
};

// Панель фильтров витрины: каждое поле читает и пишет свой атом
export function CatalogFilters({ ref }: CatalogFiltersProps) {
  const [query, setQuery] = useAtom(queryAtom);
  const [category, setCategory] = useAtom(categoryAtom);
  const [sort, setSort] = useAtom(sortAtom);
  const [inStockOnly, setInStockOnly] =
    useAtom(inStockOnlyAtom);
  return (
    <div className={styles.toolbar}>
      <label className={styles.field}>
        Поиск
        <input
          ref={ref}
          type="search"
          className="search"
          placeholder="Название игры"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <label className={styles.field}>
        Категория
        <select
          className="search"
          value={category}
          onChange={(e) =>
            setCategory(e.target.value as CategoryFilter)
          }
        >
          <option value="all">Все</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        Порядок
        <select
          className="search"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOrder)}
        >
          <option value="default">Как в каталоге</option>
          <option value="cheap">Сначала дешёвые</option>
          <option value="expensive">Сначала дорогие</option>
          <option value="rating">По рейтингу</option>
        </select>
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setInStockOnly(e.target.checked)}
        />
        Только в наличии
      </label>
    </div>
  );
}
