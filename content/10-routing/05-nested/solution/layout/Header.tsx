import { Link, NavLink } from 'react-router';
import { useFavorites } from '../favorites/FavoritesContext';
import { selectCartCount } from '../store/cartSelectors';
import { useCartStore } from '../store/cartStore';
import styles from './Header.module.css';

type HeaderProps = {
  count: number;
};

// Шапка: логотип, подпись, ссылки в кабинет и корзину
export function Header({ count }: HeaderProps) {
  // Всего штук: шапка рендерится, только когда изменилось число
  const cartCount = useCartStore(selectCartCount);
  const favorites = useFavorites();
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>
        <Link to="/">♞ Ход конём</Link>
      </h1>
      <p className="muted">
        Магазин настольных игр ·{' '}
        <Link to="/catalog">в каталоге {count} игр</Link>
      </p>
      <NavLink
        to="/account"
        className={styles.favorites}
        title="Избранное"
      >
        ♥ {favorites.ids.length}
      </NavLink>
      {/* NavLink — ссылка, которая знает, открыт ли её адрес */}
      <NavLink to="/cart" className={styles.cart}>
        Корзина: {cartCount}
      </NavLink>
    </header>
  );
}
