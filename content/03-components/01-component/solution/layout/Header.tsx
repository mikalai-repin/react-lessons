import { games } from '../data/games';
import styles from './Header.module.css';

// Шапка магазина: логотип и подпись с числом игр
export function Header() {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>♞ Ход конём</h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {games.length} игр
      </p>
    </header>
  );
}
