import { useQuery } from '@tanstack/react-query';
import { Link, NavLink } from 'react-router';
import { gamesQuery } from '../api/games';
import { useFavorites } from '../favorites/FavoritesContext';
import { selectCartCount } from '../store/cartSelectors';
import { useCartStore } from '../store/cartStore';
import styles from './Header.module.css';

// Шапка: логотип, подпись, ссылки в кабинет и корзину
export function Header() {
  // Сколько игр в каталоге: тот же ключ, что у каталога без фильтров, —
  // одна запись в кэше и один запрос на двоих
  const catalog = useQuery(gamesQuery(''));
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
        <Link to="/catalog">
          {catalog.data
            ? `в каталоге ${catalog.data.total} игр`
            : 'каталог'}
        </Link>
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
