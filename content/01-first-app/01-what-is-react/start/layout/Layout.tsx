import { NavLink, Outlet } from 'react-router';
import { cartCount, useCartStore } from '../store/cartStore';
import styles from './Layout.module.css';

export function Layout() {
  const count = useCartStore(cartCount);
  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive ? styles.active : undefined;
  return (
    <>
      <header className={styles.header}>
        <NavLink to="/" className={styles.logo}>
          ♞ Ход конём
        </NavLink>
        <nav className={styles.nav}>
          <NavLink to="/" end className={linkClass}>
            Каталог
          </NavLink>
          <NavLink to="/cart" className={linkClass}>
            Корзина ({count})
          </NavLink>
        </nav>
      </header>
      <main className={styles.page}>
        <Outlet />
      </main>
    </>
  );
}
