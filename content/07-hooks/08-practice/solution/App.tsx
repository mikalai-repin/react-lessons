import { useRef, useState } from 'react';
import { useImmerReducer } from 'use-immer';
import { MiniCart } from './cart/MiniCart';
import { CatalogFilters } from './catalog/CatalogFilters';
import {
  filterGames,
  INITIAL_FILTERS,
} from './catalog/filters';
import type { Filters } from './catalog/filters';
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
import { GameCard } from './shared/GameCard';
import { isHit } from './shared/gameRules';
import { Section } from './shared/Section';
import { cartReducer, initialCart } from './store/cartReducer';
import styles from './App.module.css';

// Сколько показывается уведомление «Добавлено», мс
const TOAST_MS = 2500;
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
  // Позиции корзины: меняются только через действия редьюсера
  const [cart, dispatch] = useImmerReducer(
    cartReducer,
    initialCart,
  );
  // Всего штук — считаем из позиций при рендере
  const cartCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );

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

  // Сколько штук игры уже в корзине
  function quantityOf(gameId: number) {
    return (
      cart.find((item) => item.gameId === gameId)?.quantity ?? 0
    );
  }

  // Текст уведомления; null — уведомления нет
  const [toast, setToast] = useState<string | null>(null);
  // id таймера, который спрячет уведомление: нужен между рендерами,
  // но не на экране — поэтому ref, а не состояние
  const toastTimer = useRef<number | null>(null);

  function showToast(text: string) {
    setToast(text);
    // Прошлый таймер отменяем: отсчёт начинается заново
    if (toastTimer.current !== null) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(
      () => setToast(null),
      TOAST_MS,
    );
  }

  // Обработчики сообщают, что случилось; менять — дело редьюсера
  function handleAdd(gameId: number) {
    dispatch({ type: 'added', gameId });
    const { title } = games.find((game) => game.id === gameId)!;
    showToast(`Добавлено: ${title}`);
  }

  function handleDecrease(gameId: number) {
    dispatch({ type: 'decreased', gameId });
  }

  function handleRemove(gameId: number) {
    dispatch({ type: 'removed', gameId });
  }

  function handleClear() {
    dispatch({ type: 'cleared' });
  }

  return (
    <>
      <OfflineBanner />
      <Header count={games.length} cartCount={cartCount} />

      <main className={styles.page}>
        <PromoBanner />
        <MiniCart
          items={cart}
          games={games}
          onIncrease={handleAdd}
          onDecrease={handleDecrease}
          onRemove={handleRemove}
          onClear={handleClear}
        />
        {selectedGame ? (
          <GameDetails
            key={selectedGame.id}
            game={selectedGame}
            quantity={quantityOf(selectedGame.id)}
            onAdd={() => handleAdd(selectedGame.id)}
            onClose={() => setSelectedId(null)}
            onNext={handleNext}
          />
        ) : (
          <>
            <Section
              title="Хиты"
              extra={<Badge tone="dark">{hits.length}</Badge>}
            >
              <div className="grid">
                {hits.map((game) => (
                  <GameCard
                    key={game.id}
                    game={game}
                    quantity={quantityOf(game.id)}
                    onAdd={() => handleAdd(game.id)}
                    onSelect={() => setSelectedId(game.id)}
                  />
                ))}
              </div>
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
                  <div className="grid">
                    {shownGames.map((game) => (
                      <GameCard
                        key={game.id}
                        game={game}
                        quantity={quantityOf(game.id)}
                        onAdd={() => handleAdd(game.id)}
                        onSelect={() => setSelectedId(game.id)}
                      />
                    ))}
                  </div>
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
      {toast !== null && (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      )}
    </>
  );
}
