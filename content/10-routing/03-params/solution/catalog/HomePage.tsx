import { useRef } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { games } from '../data/games';
import { useDebouncedValue } from '../hooks/useDebouncedValue';
import { PromoBanner } from '../layout/PromoBanner';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { isHit } from '../shared/gameRules';
import { Section } from '../shared/Section';
import { CatalogFilters } from './CatalogFilters';
import {
  filtersAtom,
  limitAtom,
  PAGE_SIZE,
  resetFiltersAtom,
} from './filterAtoms';
import { filterGames } from './filters';
import { GameGrid } from './GameGrid';
import { LoadMore } from './LoadMore';
import styles from './HomePage.module.css';

// Пауза в наборе, после которой ищем, мс
const SEARCH_DELAY = 300;

// Главная: акция, «Хиты» и «Все игры»
export function HomePage() {
  const hits = games.filter(isHit);
  // Всё, что выбрано на витрине, — из атомов фильтров
  const filters = useAtomValue(filtersAtom);
  // Поле поиска меняется на каждую букву, а поиск — после паузы
  const query = useDebouncedValue(filters.query, SEARCH_DELAY);
  // Что показать — вычисляем при каждом рендере
  const visibleGames = filterGames(games, {
    ...filters,
    query,
  });
  // Сколько найденных игр показать: растёт порциями
  const [limit, setLimit] = useAtom(limitAtom);
  const resetFilters = useSetAtom(resetFiltersAtom);
  const shownGames = visibleGames.slice(0, limit);
  // Поле поиска в DOM: React положит его сюда после фиксации
  const searchRef = useRef<HTMLInputElement>(null);

  // Сброс фильтров: кнопка исчезнет вместе с пустой витриной —
  // фокус переводим в поиск, чтобы он не потерялся
  function handleReset() {
    resetFilters();
    searchRef.current?.focus();
  }
  return (
    <>
      <PromoBanner />
      <Section
        title="Хиты"
        extra={<Badge tone="dark">{hits.length}</Badge>}
      >
        <GameGrid games={hits} />
      </Section>
      <Section
        title="Все игры"
        extra={<Badge tone="dark">{visibleGames.length}</Badge>}
      >
        <CatalogFilters ref={searchRef} />
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
    </>
  );
}
