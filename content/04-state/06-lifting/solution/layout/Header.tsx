import styles from './Header.module.css';

type HeaderProps = {
  count: number;
  cartCount: number;
};

// Шапка магазина: логотип, подпись с числом игр и сводка корзины
export function Header({ count, cartCount }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>♞ Ход конём</h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {count} игр
      </p>
      <p className={styles.cart}>Корзина: {cartCount}</p>
    </header>
  );
}
