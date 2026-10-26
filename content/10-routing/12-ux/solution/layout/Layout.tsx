import {
  Outlet,
  ScrollRestoration,
  useNavigation,
} from 'react-router';
import { CartToast } from '../cart/CartToast';
import { games } from '../data/games';
import { Footer } from './Footer';
import { Header } from './Header';
import { OfflineBanner } from './OfflineBanner';
import styles from './Layout.module.css';

// Макет магазина: общая разметка всех страниц.
// <Outlet /> — место, куда роутер подставит страницу маршрута
export function Layout() {
  // Состояние перехода: idle — ничего не происходит,
  // loading — грузятся данные следующей страницы
  const navigation = useNavigation();
  return (
    <>
      <OfflineBanner />
      <Header count={games.length} />
      <main
        className={styles.page}
        aria-busy={navigation.state === 'loading'}
      >
        <Outlet />
      </main>
      <Footer />
      <CartToast />
      {/* Прокрутка: новая страница — сверху, «назад» — где была */}
      <ScrollRestoration />
    </>
  );
}
