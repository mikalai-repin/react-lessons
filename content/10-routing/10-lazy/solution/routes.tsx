import { createBrowserRouter } from 'react-router';
import { AccountLayout } from './account/AccountLayout';
import { FavoritesPage } from './account/FavoritesPage';
import { SettingsPage } from './account/SettingsPage';
import { CartPage } from './cart/CartPage';
import { CatalogPage } from './catalog/CatalogPage';
import { HomePage } from './catalog/HomePage';
import { OrderDonePage } from './checkout/OrderDonePage';
import { gameLoader, GamePage } from './game/GamePage';
import { subscribeAction } from './layout/Footer';
import { Layout } from './layout/Layout';
import { NotFoundPage } from './layout/NotFoundPage';
import { RouteError } from './layout/RouteError';

// Маршруты магазина: адрес → компонент страницы.
// Дочерние маршруты рисуются в <Outlet /> макета
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    // Первый заход сразу на страницу с loader: что показать, пока он идёт
    HydrateFallback: () => <p className="muted">Загружаем…</p>,
    // Ошибка в самом макете: страницы без шапки, но с объяснением
    ErrorBoundary: RouteError,
    children: [
      {
        // Маршрут без path: общая граница ошибок для всех страниц —
        // ошибка страницы не сносит шапку и подвал макета
        ErrorBoundary: RouteError,
        children: [
          // index — сам адрес родителя, «/»
          { index: true, Component: HomePage },
          { path: 'catalog', Component: CatalogPage },
          // :id — параметр: часть адреса, которая меняется
          {
            path: 'games/:id',
            // Данные страницы: роутер загрузит их до показа
            loader: gameLoader,
            Component: GamePage,
          },
          { path: 'cart', Component: CartPage },
          {
            path: 'checkout',
            // Ленивый маршрут: код оформления загрузится при первом
            // переходе на /checkout — вместе с компонентом и action
            lazy: async () => {
              const { CheckoutPage, checkoutAction } =
                await import('./checkout/CheckoutPage');
              return {
                Component: CheckoutPage,
                action: checkoutAction,
              };
            },
          },
          { path: 'checkout/done', Component: OrderDonePage },
          // Вложенные маршруты: макет кабинета и его вкладки
          {
            path: 'account',
            Component: AccountLayout,
            children: [
              { index: true, Component: FavoritesPage },
              { path: 'settings', Component: SettingsPage },
            ],
          },
          // Ресурсный маршрут: только action, страницы нет
          { path: 'subscribe', action: subscribeAction },
          // * — любой адрес, который не подошёл выше
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
]);
