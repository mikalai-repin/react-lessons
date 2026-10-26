import { createBrowserRouter } from 'react-router';
import { AccountLayout } from './account/AccountLayout';
import { FavoritesPage } from './account/FavoritesPage';
import { SettingsPage } from './account/SettingsPage';
import { CartPage } from './cart/CartPage';
import { CatalogPage } from './catalog/CatalogPage';
import { HomePage } from './catalog/HomePage';
import { GamePage } from './game/GamePage';
import { Layout } from './layout/Layout';
import { NotFoundPage } from './layout/NotFoundPage';

// Маршруты магазина: адрес → компонент страницы.
// Дочерние маршруты рисуются в <Outlet /> макета
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      // index — сам адрес родителя, «/»
      { index: true, Component: HomePage },
      { path: 'catalog', Component: CatalogPage },
      // :id — параметр: часть адреса, которая меняется
      { path: 'games/:id', Component: GamePage },
      { path: 'cart', Component: CartPage },
      // Вложенные маршруты: макет кабинета и его вкладки
      {
        path: 'account',
        Component: AccountLayout,
        children: [
          { index: true, Component: FavoritesPage },
          { path: 'settings', Component: SettingsPage },
        ],
      },
      // * — любой адрес, который не подошёл выше
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
