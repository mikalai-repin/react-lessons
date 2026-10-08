import { useState } from 'react';
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
  // Сколько всего штук в корзине — общее состояние страницы
  const [cartCount, setCartCount] = useState(0);

  function handleAdd() {
    setCartCount((c) => c + 1);
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
                onAdd={handleAdd}
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
                onAdd={handleAdd}
              />
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}
