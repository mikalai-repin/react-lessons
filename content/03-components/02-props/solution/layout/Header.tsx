import styles from './Header.module.css';

type HeaderProps = {
  count: number;
};

// Шапка магазина: логотип и подпись с числом игр
export function Header({ count }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>♞ Ход конём</h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {count} игр
      </p>
    </header>
  );
}
