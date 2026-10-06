import { createBrowserRouter } from 'react-router';
import { CartPage } from './cart/CartPage';
import { Catalog } from './catalog/Catalog';
import { GamePage, gameLoader } from './game/GamePage';
import { Layout } from './layout/Layout';
import { NotFound } from './NotFound';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    // Что показать, пока выполняется loader при первом заходе
    HydrateFallback: () => <p className="muted">Загружаем…</p>,
    children: [
      { index: true, Component: Catalog },
      {
        path: 'games/:id',
        loader: gameLoader,
        Component: GamePage,
      },
      { path: 'cart', Component: CartPage },
      { path: '*', Component: NotFound },
    ],
  },
]);
