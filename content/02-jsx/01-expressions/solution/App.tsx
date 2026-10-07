import { games } from './data/games';
import { formatPrice } from './shared/format';
import styles from './App.module.css';

export function App() {
  const game = games[0];

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>♞ Ход конём</h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {games.length} игр
      </p>

      <article className={styles.card}>
        <h2 className={styles.cardTitle}>{game.title}</h2>
        <p className={styles.price}>
          {formatPrice(game.price)}
        </p>
        <p className="muted">
          Игроков: {game.players.min}–{game.players.max} ·{' '}
          {game.playTime} мин
        </p>
      </article>
    </main>
  );
}
