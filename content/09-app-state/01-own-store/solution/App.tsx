import { useRef, useState } from 'react';
import { CartToast } from './cart/CartToast';
import { MiniCart } from './cart/MiniCart';
import { CatalogFilters } from './catalog/CatalogFilters';
import {
  filterGames,
  INITIAL_FILTERS,
} from './catalog/filters';
import type { Filters } from './catalog/filters';
import { GameGrid } from './catalog/GameGrid';
import { LoadMore } from './catalog/LoadMore';
import { games } from './data/games';
import { GameDetails } from './game/GameDetails';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { Footer } from './layout/Footer';
import { Header } from './layout/Header';
import { OfflineBanner } from './layout/OfflineBanner';
import { PromoBanner } from './layout/PromoBanner';
import { Badge } from './shared/Badge';
import { Button } from './shared/Button';
import { isHit } from './shared/gameRules';
import { Section } from './shared/Section';
import styles from './App.module.css';

// Порция каталога: столько игр показываем и подгружаем за раз
const PAGE_SIZE = 3;
// Пауза в наборе, после которой ищем, мс
const SEARCH_DELAY = 300;

export function App() {
  const hits = games.filter(isHit);
  // Всё, что выбрано на витрине, — одно состояние
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  // Поле поиска меняется на каждую букву, а поиск — после паузы
  const query = useDebouncedValue(filters.query, SEARCH_DELAY);
  // Что показать — вычисляем при каждом рендере
  const visibleGames = filterGames(games, {
    ...filters,
    query,
  });
  // Сколько найденных игр показать: растёт порциями
  const [limit, setLimit] = useState(PAGE_SIZE);
  const shownGames = visibleGames.slice(0, limit);
  // Поле поиска в DOM: React положит его сюда после фиксации
  const searchRef = useRef<HTMLInputElement>(null);

  // Сброс фильтров: кнопка исчезнет вместе с пустой витриной —
  // фокус переводим в поиск, чтобы он не потерялся
  function handleReset() {
    handleFiltersChange(INITIAL_FILTERS);
    searchRef.current?.focus();
  }

  // Новые фильтры — новый список: показываем его с первой порции
  function handleFiltersChange(next: Filters) {
    setFilters(next);
    setLimit(PAGE_SIZE);
  }
  // Какая игра открыта: только id, null — открыт каталог
  const [selectedId, setSelectedId] = useState<number | null>(
    null,
  );
  // Саму игру находим по id при рендере
  const selectedGame = games.find(
    (game) => game.id === selectedId,
  );

  // Следующая игра каталога; после последней — снова первая
  function handleNext() {
    const index = games.findIndex(
      (game) => game.id === selectedId,
    );
    setSelectedId(games[(index + 1) % games.length].id);
  }

  return (
    <>
      <OfflineBanner />
      <Header count={games.length} />

      <main className={styles.page}>
        <PromoBanner />
        <MiniCart games={games} />
        {selectedGame ? (
          <GameDetails
            key={selectedGame.id}
            game={selectedGame}
            onClose={() => setSelectedId(null)}
            onNext={handleNext}
          />
        ) : (
          <>
            <Section
              title="Хиты"
              extra={<Badge tone="dark">{hits.length}</Badge>}
            >
              <GameGrid games={hits} onSelect={setSelectedId} />
            </Section>
            <Section
              title="Все игры"
              extra={
                <Badge tone="dark">{visibleGames.length}</Badge>
              }
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
                  <GameGrid
                    games={shownGames}
                    onSelect={setSelectedId}
                  />
                  {limit < visibleGames.length && (
                    <LoadMore
                      onLoad={() =>
                        setLimit((n) => n + PAGE_SIZE)
                      }
                    />
                  )}
                </>
              )}
            </Section>
          </>
        )}
      </main>
      <Footer />
      <CartToast />
    </>
  );
}
