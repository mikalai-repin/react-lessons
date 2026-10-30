import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { fetchGames } from '../api/games';
import type { Game, Page } from '../api/models';
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
  // Последний ответ сервера; null — ответа ещё не было
  const [catalog, setCatalog] = useState<Page<Game> | null>(
    null,
  );
  const [failed, setFailed] = useState(false);
  // Поле поиска в DOM: React положит его сюда после фиксации
  const searchRef = useRef<HTMLInputElement>(null);

  // Синхронизация с сервером: новые параметры — новый запрос
  useEffect(() => {
    const controller = new AbortController();
    fetchGames(apiParams, controller.signal)
      .then((page) => {
        setCatalog(page);
        setFailed(false);
      })
      .catch(() => {
        // Отменили сами — это не ошибка сервера
        if (!controller.signal.aborted) setFailed(true);
      });
    // Параметры сменились или страница закрыта: ответ уже не нужен
    return () => controller.abort();
  }, [apiParams]);

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
        catalog && <Badge tone="dark">{catalog.total}</Badge>
      }
    >
      <CatalogFilters
        ref={searchRef}
        filters={filters}
        onChange={handleFiltersChange}
      />
      {failed ? (
        <p className="muted">Не удалось загрузить каталог.</p>
      ) : catalog === null ? (
        <p className="muted">Загружаем каталог…</p>
      ) : catalog.items.length === 0 ? (
        <div className={styles.empty}>
          <p className="muted">Ничего не нашлось</p>
          <Button onClick={handleReset}>
            Сбросить фильтры
          </Button>
        </div>
      ) : (
        <GameGrid games={catalog.items} />
      )}
    </Section>
  );
}
