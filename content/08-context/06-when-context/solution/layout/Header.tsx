import { useCart } from '../cart/CartContext';
import { useTheme } from '../theme/ThemeContext';
import styles from './Header.module.css';

type HeaderProps = {
  count: number;
};

// Шапка: логотип, подпись, сводка корзины и переключатель темы
export function Header({ count }: HeaderProps) {
  const items = useCart();
  const { theme, toggleTheme } = useTheme();
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
      <button
        type="button"
        className={styles.theme}
        aria-pressed={theme === 'dark'}
        onClick={toggleTheme}
      >
        ☾ Тёмная тема
      </button>
    </header>
  );
}
