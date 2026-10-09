import type { Ref } from 'react';
import { categories } from '../data/categories';
import type {
  CategoryFilter,
  Filters,
  SortOrder,
} from './filters';
import styles from './CatalogFilters.module.css';

type CatalogFiltersProps = {
  filters: Filters;
  // Покупатель изменил фильтр — новый объект фильтров целиком
  onChange: (filters: Filters) => void;
  // Ссылка на поле поиска — для фокуса снаружи
  ref?: Ref<HTMLInputElement>;
};

// Панель фильтров витрины: каждое поле меняет одно свойство объекта
export function CatalogFilters({
  filters,
  onChange,
  ref,
}: CatalogFiltersProps) {
  return (
    <div className={styles.toolbar}>
      <label className={styles.field}>
        Поиск
        <input
          ref={ref}
          type="search"
          className="search"
          placeholder="Название игры"
          value={filters.query}
          onChange={(e) =>
            onChange({ ...filters, query: e.target.value })
          }
        />
      </label>
      <label className={styles.field}>
        Категория
        <select
          className="search"
          value={filters.category}
          onChange={(e) =>
            onChange({
              ...filters,
              category: e.target.value as CategoryFilter,
            })
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
          value={filters.sort}
          onChange={(e) =>
            onChange({
              ...filters,
              sort: e.target.value as SortOrder,
            })
          }
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
          checked={filters.inStockOnly}
          onChange={(e) =>
            onChange({
              ...filters,
              inStockOnly: e.target.checked,
            })
          }
        />
        Только в наличии
      </label>
    </div>
  );
}
