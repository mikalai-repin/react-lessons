import { createBrowserRouter } from 'react-router';
import { CartPage } from './cart/CartPage';
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
      // :id — параметр: часть адреса, которая меняется
      { path: 'games/:id', Component: GamePage },
      { path: 'cart', Component: CartPage },
      // * — любой адрес, который не подошёл выше
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
