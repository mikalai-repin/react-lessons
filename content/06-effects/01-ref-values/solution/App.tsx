import { useRef, useState } from 'react';
import { useImmerReducer } from 'use-immer';
import { MiniCart } from './cart/MiniCart';
import { CatalogFilters } from './catalog/CatalogFilters';
import {
  filterGames,
  INITIAL_FILTERS,
} from './catalog/filters';
import { games } from './data/games';
import { GameDetails } from './game/GameDetails';
import { Footer } from './layout/Footer';
import { Header } from './layout/Header';
import { Badge } from './shared/Badge';
import { Button } from './shared/Button';
import { GameCard } from './shared/GameCard';
import { isHit } from './shared/gameRules';
import { Section } from './shared/Section';
import { cartReducer, initialCart } from './store/cartReducer';
import styles from './App.module.css';

// Текст акции готовят маркетологи в своей системе — с HTML-разметкой
const PROMO_HTML =
  'Неделя семейных игр: скидки до <b>20%</b> на «Остров сокровищ» и «Нарды»';

// Сколько показывается уведомление «Добавлено», мс
const TOAST_MS = 2500;

export function App() {
  const hits = games.filter(isHit);
  // Всё, что выбрано на витрине, — одно состояние
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  // Что показать — вычисляем при каждом рендере
  const visibleGames = filterGames(games, filters);
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

  return (
    <>
      <Header count={games.length} cartCount={cartCount} />

      <main className={styles.page}>
        <p
          className={styles.promo}
          dangerouslySetInnerHTML={{ __html: PROMO_HTML }}
        />
        <MiniCart
          items={cart}
          games={games}
          onIncrease={handleAdd}
          onDecrease={handleDecrease}
          onRemove={handleRemove}
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
                filters={filters}
                onChange={setFilters}
              />
              {visibleGames.length === 0 ? (
                <div className={styles.empty}>
                  <p className="muted">Ничего не нашлось</p>
                  <Button
                    onClick={() => setFilters(INITIAL_FILTERS)}
                  >
                    Сбросить фильтры
                  </Button>
                </div>
              ) : (
                <div className="grid">
                  {visibleGames.map((game) => (
                    <GameCard
                      key={game.id}
                      game={game}
                      quantity={quantityOf(game.id)}
                      onAdd={() => handleAdd(game.id)}
                      onSelect={() => setSelectedId(game.id)}
                    />
                  ))}
                </div>
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
