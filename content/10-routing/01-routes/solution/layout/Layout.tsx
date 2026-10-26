import { Outlet } from 'react-router';
import { CartToast } from '../cart/CartToast';
import { games } from '../data/games';
import { Footer } from './Footer';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';
import styles from './Layout.module.css';

// Макет магазина: общая разметка всех страниц.
// <Outlet /> — место, куда роутер подставит страницу маршрута
export function Layout() {
  return (
    <>
      <OfflineBanner />
      <Header count={games.length} />
      <main className={styles.page}>
        <Outlet />
      </main>
      <Footer />
      <CartToast />
    </>
  );
}
