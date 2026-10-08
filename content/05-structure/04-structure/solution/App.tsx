import { useState } from 'react';
import type { CartItem, Game } from './api/models';
import { MiniCart } from './cart/MiniCart';
import { categories } from './data/categories';
import { games } from './data/games';
import { GameDetails } from './game/GameDetails';
import { Footer } from './layout/Footer';
import { Header } from './layout/Header';
import { Badge } from './shared/Badge';
import { GameCard } from './shared/GameCard';
import { isHit } from './shared/gameRules';
import { Section } from './shared/Section';
import styles from './App.module.css';

// Текст акции готовят маркетологи в своей системе — с HTML-разметкой
const PROMO_HTML =
  'Неделя семейных игр: скидки до <b>20%</b> на «Остров сокровищ» и «Нарды»';

// Фильтр по категории: одна из категорий или все сразу
type CategoryFilter = Game['category'] | 'all';

// Порядок каталога и функция сравнения игр для каждого
type SortOrder = 'default' | 'cheap' | 'expensive' | 'rating';
type Compare = (a: Game, b: Game) => number;
const COMPARE: Record<SortOrder, Compare> = {
  default: () => 0,
  cheap: (a, b) => a.price - b.price,
  expensive: (a, b) => b.price - a.price,
  rating: (a, b) => b.rating - a.rating,
};

export function App() {
  const hits = games.filter(isHit);
  // Поиск, категория, наличие и порядок — что выбрал покупатель
  const [query, setQuery] = useState('');
  const [category, setCategory] =
    useState<CategoryFilter>('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sort, setSort] = useState<SortOrder>('default');
  // Что показать — вычисляем из состояния при каждом рендере
  const search = query.trim().toLowerCase();
  const visibleGames = games
    .filter(
      (game) =>
        game.title.toLowerCase().includes(search) &&
        (category === 'all' || game.category === category) &&
        (!inStockOnly || game.inStock > 0),
    )
    .toSorted(COMPARE[sort]);
  // Позиции корзины — общее состояние страницы
  const [cart, setCart] = useState<CartItem[]>([]);
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

  // Сколько штук игры уже в корзине
  function quantityOf(gameId: number) {
    return (
      cart.find((item) => item.gameId === gameId)?.quantity ?? 0
    );
  }

  function handleAdd(gameId: number) {
    setCart((items) => {
      const inCart = items.some(
        (item) => item.gameId === gameId,
      );
      // Новой игры ещё нет — новый массив с новой позицией в конце
      if (!inCart) return [...items, { gameId, quantity: 1 }];
      // Есть — новый массив, где у этой позиции новый объект
      return items.map((item) =>
        item.gameId === gameId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    });
  }

  function handleDecrease(gameId: number) {
    setCart((items) =>
      items
        .map((item) =>
          item.gameId === gameId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  }

  function handleRemove(gameId: number) {
    setCart((items) =>
      items.filter((item) => item.gameId !== gameId),
    );
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
            game={selectedGame}
            quantity={quantityOf(selectedGame.id)}
            onAdd={() => handleAdd(selectedGame.id)}
            onClose={() => setSelectedId(null)}
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
            <Section title="Все игры">
              <div className={styles.toolbar}>
                <label className={styles.field}>
                  Поиск
                  <input
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
                      setCategory(
                        e.target.value as CategoryFilter,
                      )
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
                    onChange={(e) =>
                      setSort(e.target.value as SortOrder)
                    }
                  >
                    <option value="default">
                      Как в каталоге
                    </option>
                    <option value="cheap">
                      Сначала дешёвые
                    </option>
                    <option value="expensive">
                      Сначала дорогие
                    </option>
                    <option value="rating">По рейтингу</option>
                  </select>
                </label>
                <label className={styles.check}>
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) =>
                      setInStockOnly(e.target.checked)
                    }
                  />
                  Только в наличии
                </label>
              </div>
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
            </Section>
          </>
        )}
      </main>
      <Footer />
    </>
  );
}
