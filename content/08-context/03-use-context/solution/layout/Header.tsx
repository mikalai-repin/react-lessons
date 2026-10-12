import { useCart } from '../cart/CartContext';
import styles from './Header.module.css';

type HeaderProps = {
  count: number;
};

// Шапка магазина: логотип, подпись с числом игр и сводка корзины
export function Header({ count }: HeaderProps) {
  const { items } = useCart();
  // Всего штук — считаем из позиций при рендере
  const cartCount = items.reduce(
    (sum, item) => sum + item.quantity,
    0,
  );
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
