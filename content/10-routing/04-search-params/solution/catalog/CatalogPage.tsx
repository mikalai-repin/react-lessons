import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { games } from '../data/games';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { Section } from '../shared/Section';
import { CatalogFilters } from './CatalogFilters';
import {
  filterGames,
  filtersFromParams,
  filtersToParams,
  INITIAL_FILTERS,
} from './filters';
import type { Filters } from './filters';
import { GameGrid } from './GameGrid';
import { LoadMore } from './LoadMore';
import styles from './CatalogPage.module.css';

// Порция каталога: столько игр показываем и подгружаем за раз
const PAGE_SIZE = 3;
// Пауза в наборе, после которой ищем, мс
const SEARCH_DELAY = 300;

// Каталог: все игры с фильтрами. Фильтры живут в адресе
export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  // Фильтры — не состояние, а вычисление из адреса
  const filters = filtersFromParams(searchParams);
  // Поле поиска меняется на каждую букву, а поиск — после паузы
  const query = useDebouncedValue(filters.query, SEARCH_DELAY);
  const visibleGames = filterGames(games, {
    ...filters,
    query,
  });
  // Сколько найденных игр показать: растёт порциями
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shownGames = visibleGames.slice(0, limit);
  // Поле поиска в DOM: React положит его сюда после фиксации
  const searchRef = useRef<HTMLInputElement>(null);

  // Новые фильтры — новый адрес и список с первой порции.
  // Буквы поиска не копят историю: replace вместо новой записи
  function handleFiltersChange(next: Filters) {
    setSearchParams(filtersToParams(next), {
      replace: next.query !== filters.query,
    });
    setLimit(PAGE_SIZE);
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
      extra={<Badge tone="dark">{visibleGames.length}</Badge>}
    >
      <CatalogFilters
        ref={searchRef}
        filters={filters}
        onChange={handleFiltersChange}
      />
      {visibleGames.length === 0 ? (
        <div className={styles.empty}>
          <p className="muted">Ничего не нашлось</p>
          <Button onClick={handleReset}>
            Сбросить фильтры
          </Button>
        </div>
      ) : (
        <>
          <GameGrid games={shownGames} />
          {limit < visibleGames.length && (
            <LoadMore
              onLoad={() => setLimit((n) => n + PAGE_SIZE)}
            />
          )}
        </>
      )}
    </Section>
  );
}
