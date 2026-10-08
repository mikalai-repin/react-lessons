import { useState } from 'react';
import type { CartItem, Game } from './api/models';
import { MiniCart } from './cart/MiniCart';
import { categories } from './data/categories';
import { games } from './data/games';
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

export function App() {
  const hits = games.filter(isHit);
  // Что введено в поиск и какая категория выбрана
  const [query, setQuery] = useState('');
  const [category, setCategory] =
    useState<CategoryFilter>('all');
  // Игры каталога, которые подходят под поиск и категорию
  const search = query.trim().toLowerCase();
  const visibleGames = games.filter(
    (game) =>
      game.title.toLowerCase().includes(search) &&
      (category === 'all' || game.category === category),
  );
  // Позиции корзины — общее состояние страницы
  const [cart, setCart] = useState<CartItem[]>([]);
  // Всего штук — считаем из позиций при рендере
  const cartCount = cart.reduce(
    (sum, item) => sum + item.quantity,
    0,
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
          </div>
          <div className="grid">
            {visibleGames.map((game) => (
              <GameCard
                key={game.id}
                game={game}
                quantity={quantityOf(game.id)}
                onAdd={() => handleAdd(game.id)}
              />
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}
