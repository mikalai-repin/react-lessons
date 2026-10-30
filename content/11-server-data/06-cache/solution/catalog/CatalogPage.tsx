import { useRef } from 'react';
import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query';
import { useSearchParams } from 'react-router';
import { gamesQuery } from '../api/games';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { Section } from '../shared/Section';
import { CatalogFilters } from './CatalogFilters';
import {
  filtersFromParams,
  filtersToApi,
  filtersToParams,
  INITIAL_FILTERS,
} from './filters';
import type { Filters } from './filters';
import { GameGrid } from './GameGrid';
import styles from './CatalogPage.module.css';

// Пауза в наборе, после которой ищем, мс
const SEARCH_DELAY = 300;

// Каталог: игры с сервера по фильтрам. Фильтры живут в адресе
export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Фильтры — не состояние, а вычисление из адреса
  const filters = filtersFromParams(searchParams);
  // Поле поиска меняется на каждую букву, а поиск — после паузы
  const query = useDebouncedValue(filters.query, SEARCH_DELAY);
  // Параметры запроса — строкой: её удобно сравнивать в зависимостях
  const apiParams = filtersToApi({
    ...filters,
    query,
  }).toString();
  // Запрос каталога: ключ — что загружаем, queryFn — как.
  // Пока новый список грузится, показываем прежний
  const catalog = useQuery({
    ...gamesQuery(apiParams),
    placeholderData: keepPreviousData,
  });
  // Поле поиска в DOM: React положит его сюда после фиксации
  const searchRef = useRef<HTMLInputElement>(null);

  // Новые фильтры — новый адрес.
  // Буквы поиска не копят историю: replace вместо новой записи
  function handleFiltersChange(next: Filters) {
    setSearchParams(filtersToParams(next), {
      replace: next.query !== filters.query,
    });
  }

  // Сброс фильтров: кнопка исчезнет вместе с пустой витриной —
  // фокус переводим в поиск, чтобы он не потерялся
  function handleReset() {
    handleFiltersChange(INITIAL_FILTERS);
    searchRef.current?.focus();
  }

  return (
    <Section
      title="Все игры"
      extra={
        catalog.data && (
          <Badge tone="dark">{catalog.data.total}</Badge>
        )
      }
    >
      <CatalogFilters
        ref={searchRef}
        filters={filters}
        onChange={handleFiltersChange}
      />
      {catalog.isPending ? (
        <p className="muted">Загружаем каталог…</p>
      ) : catalog.isError ? (
        <p className="muted">
          Не удалось загрузить каталог.{' '}
          <Button onClick={() => catalog.refetch()}>
            Повторить
          </Button>
        </p>
      ) : catalog.data.items.length === 0 ? (
        <div className={styles.empty}>
          <p className="muted">Ничего не нашлось</p>
          <Button onClick={handleReset}>
            Сбросить фильтры
          </Button>
        </div>
      ) : (
        // Прежний список — бледнее: новый ещё в пути
        <div
          className={styles.results}
          aria-busy={catalog.isPlaceholderData}
        >
          <GameGrid games={catalog.data.items} />
        </div>
      )}
    </Section>
  );
}
