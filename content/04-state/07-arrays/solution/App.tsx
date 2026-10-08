import { useState } from 'react';
import type { CartItem } from './api/models';
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

export function App() {
  const hits = games.filter(isHit);
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

  return (
    <>
      <Header count={games.length} cartCount={cartCount} />

      <main className={styles.page}>
        <p
          className={styles.promo}
          dangerouslySetInnerHTML={{ __html: PROMO_HTML }}
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
          <div className="grid">
            {games.map((game) => (
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
