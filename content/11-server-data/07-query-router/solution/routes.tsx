import { createBrowserRouter, redirect } from 'react-router';
import type { Game } from './api/models';
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
import { useCartStore } from './store/cartStore';

// Маршруты магазина: адрес → компонент страницы.
// Дочерние маршруты рисуются в <Outlet /> макета
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    // handle — свои данные маршрута: здесь подпись хлебной крошки
    handle: { crumb: () => 'Главная' },
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
          {
            path: 'catalog',
            Component: CatalogPage,
            handle: { crumb: () => 'Каталог' },
          },
          // :id — параметр: часть адреса, которая меняется
          {
            path: 'games/:id',
            // Данные страницы: роутер загрузит их до показа
            loader: gameLoader,
            Component: GamePage,
            // Подпись — из данных loader: название игры. Если loader
            // бросил ошибку (404), данных нет — loaderData undefined
            handle: {
              crumb: (game: Game | undefined) =>
                game?.title ?? 'Игра не найдена',
            },
          },
          {
            path: 'cart',
            Component: CartPage,
            handle: { crumb: () => 'Корзина' },
          },
          {
            path: 'checkout',
            handle: { crumb: () => 'Оформление заказа' },
            // Защита: с пустой корзиной оформлять нечего — в корзину.
            // Обычный loader, не ленивый: проверка не ждёт кода страницы
            loader: () => {
              if (useCartStore.getState().items.length === 0) {
                return redirect('/cart');
              }
              return null;
            },
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
            handle: { crumb: () => 'Кабинет' },
            children: [
              { index: true, Component: FavoritesPage },
              {
                path: 'settings',
                Component: SettingsPage,
                handle: { crumb: () => 'Настройки' },
              },
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
