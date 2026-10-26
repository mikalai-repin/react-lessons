import { Link, NavLink } from 'react-router';
import { useFavorites } from '../favorites/FavoritesContext';
import { selectCartCount } from '../store/cartSelectors';
import { useCartStore } from '../store/cartStore';
import { useTheme } from '../theme/ThemeContext';
import styles from './Header.module.css';

type HeaderProps = {
  count: number;
};

// Шапка: логотип, подпись, сводка корзины и переключатель темы
export function Header({ count }: HeaderProps) {
  // Всего штук: шапка рендерится, только когда изменилось число
  const cartCount = useCartStore(selectCartCount);
  const { theme, toggleTheme } = useTheme();
  const favorites = useFavorites();
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        <Link to="/">♞ Ход конём</Link>
      </h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {count} игр
      </p>
      <p className={styles.favorites} title="Избранное">
        ♥ {favorites.ids.length}
      </p>
      {/* NavLink — ссылка, которая знает, открыт ли её адрес */}
      <NavLink to="/cart" className={styles.cart}>
        Корзина: {cartCount}
      </NavLink>
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
