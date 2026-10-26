---
title: Маршруты
startFrom: custom
base: 09-app-state/09-practice
baseHash: '4adb9d772161'
removedInSolution: [App.module.css, App.tsx]
focus: routes.tsx
api: [createBrowserRouter, RouterProvider, Outlet, index, '*']
---

У магазина один адрес — `/`. Страница игры открывается состоянием `selectedId`, и ссылку на «Ночной экспресс» другу не отправишь: он увидит главную. Кнопка «Назад» браузера уводит с сайта, а не со страницы игры. Корзина всегда висит над каталогом, потому что ей больше негде быть.

В этой главе у магазина появятся настоящие страницы с адресами: `/`, `/catalog`, `/games/4`, `/cart`. Адрес станет частью состояния приложения — тем, что переживает перезагрузку и пересылается ссылкой (карта решений из главы 9).

## React Router

В React нет встроенного роутера. Стандарт — [React Router](https://reactrouter.com/) (у нас версия 8). Он умеет работать в трёх **режимах**:

- **декларативном** — маршруты описываются компонентами `<Routes>` и `<Route>` прямо в JSX; только сопоставление адреса и переходы;
- **режиме данных** (data mode) — маршруты описываются объектами **вне** React, и у каждого может быть загрузка (`loader`) и изменение данных (`action`). Его мы и возьмём;
- **режиме фреймворка** — режим данных плюс плагин Vite: маршруты по файлам, серверный рендеринг, типы для каждого маршрута. Это бывший Remix; в превью курса его нет, он — в части 3.

## Маршруты — объекты

```tsx routes.tsx
import { createBrowserRouter } from 'react-router';

// Маршруты магазина: адрес → компонент страницы.
// Дочерние маршруты рисуются в <Outlet /> макета
export const router = createBrowserRouter([
  {
    path: '/',
    Component: Layout,
    children: [
      // index — сам адрес родителя, «/»
      { index: true, Component: HomePage },
      { path: 'cart', Component: CartPage },
      // * — любой адрес, который не подошёл выше
      { path: '*', Component: NotFoundPage },
    ],
  },
]);
```

- **Маршрут** — объект: `path` — шаблон адреса, `Component` — что рисовать.
- `children` — вложенные маршруты. Их `path` **относительный**: `'cart'` внутри `'/'` — это `/cart`.
- `index: true` — **индексный** маршрут: что показать по адресу самого родителя, без продолжения.
- `path: '*'` — подходит к любому адресу; роутер выбирает его, только если не подошло ничего точнее.

`createBrowserRouter` создаёт **роутер** — объект, который знает маршруты, следит за адресом в браузере и решает, что рисовать. Создаётся один раз, в модуле, а не в компоненте: документация прямо говорит не хранить его в состоянии React.

## Макет и Outlet

У всех страниц общие шапка, подвал, полоса «Нет сети» и уведомление. Их рисует **макет** — компонент корневого маршрута:

```tsx layout/Layout.tsx
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
```

`<Outlet />` из `react-router` — «здесь будет дочерний маршрут». По адресу `/` в нём `HomePage`, по `/cart` — `CartPage`. Родитель не знает, какой ребёнок сейчас выбран: это решает роутер.

```
/cart
 └─ Layout          path: '/'
     └─ <Outlet />
         └─ CartPage   path: 'cart'
```

## Подключить роутер

`App` больше не нужен: его разметка разошлась по макету и страницам. Вместо `<App />` в `main.tsx` — `RouterProvider`:

```tsx main.tsx {3,5,11}
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { FavoritesProvider } from './favorites/FavoritesProvider';
import { router } from './routes';
…
root.render(
  <StrictMode>
    <ThemeProvider>
      <FavoritesProvider>
        <RouterProvider router={router} />
      </FavoritesProvider>
    </ThemeProvider>
  </StrictMode>,
);
```

`RouterProvider` берём из `react-router/dom` — так велит документация режима данных. Это тот же провайдер, которому передан `flushSync` из `react-dom` (глава 4): без него опция перехода `flushSync: true` не работает, и роутер предупреждает об этом в консоли. Всё остальное — из `react-router`. Провайдеры темы и избранного остаются снаружи: им всё равно, какая страница открыта.

::: task
1. В `layout/Layout.tsx` напишите `Layout`: полоса «Нет сети», шапка, `<main className={styles.page}>` с `<Outlet />`, подвал, уведомление корзины (стили — в готовом `Layout.module.css`).
2. В `catalog/HomePage.tsx` перенесите из `App` всё, что было внутри `<main>`, кроме мини-корзины, — вместе с состоянием, фильтрами и `selectedId`. Класс `.empty` — в готовом `HomePage.module.css`.
3. `cart/CartPage.tsx` — `<MiniCart games={games} />`; `layout/NotFoundPage.tsx` — раздел «Такой страницы нет» с подсказкой.
4. В `routes.tsx` создайте `router`, в `main.tsx` нарисуйте `<RouterProvider router={router} />` вместо `<App />`. `App.tsx` и `App.module.css` больше не нужны.
:::

## Что получилось

Главная выглядит как раньше, только без мини-корзины. Введите в адресную строку превью `/cart` — корзина на отдельной странице. `/nope` — «Такой страницы нет». Шапка и подвал на месте на всех трёх адресах.

## Эксперименты

1. **Без `<Outlet />`.** Уберите его из макета: на любом адресе — шапка и подвал, а страницы нет. Роутер выбрал маршрут, но рисовать его негде.
2. **Без `*`.** Удалите последний маршрут и откройте `/nope`. Вместо магазина — встроенная страница роутера `Unexpected Application Error!` и `404 Not Found`: шапки нет, потому что ни один маршрут не подошёл — даже корневой. Как сделать свою страницу ошибок — шаг «Ошибки и 404». Верните маршрут.
3. **Макет живёт между страницами.** На главной наберите что-нибудь в поле e-mail подписки и перейдите на `/cart` через адресную строку. Текст в поле остался: роутер сменил только содержимое `<Outlet />`, а макет и подвал — те же компоненты. Добавьте `console.log('render Layout')` в макет — при переходе ни одной строки. Нажмите ⟳ — поле пустое: это уже новый запуск приложения.

## Как в настоящем проекте

- В Vite-проекте всё то же: `npm i react-router`, `createBrowserRouter` в отдельном модуле, `RouterProvider` в `main.tsx`. Чтобы прямые заходы на `/cart` работали после деплоя, сервер должен отдавать `index.html` на любой адрес (глава 23).
- В старых проектах — пакет `react-router-dom` и `<BrowserRouter>` с `<Routes>` в JSX. В v8 пакета `react-router-dom` нет: всё из `react-router`, а `RouterProvider` — из `react-router/dom`.

::: legacy React Router 5 и 6
В v5 маршруты были компонентами (`<Switch>`, `<Route component={…}>`, `withRouter`), загрузки данных не было. В v6 появились `<Routes>`, `useNavigate` и, в 6.4, режим данных с `createBrowserRouter`. v7 объединила React Router и Remix, v8 убрала `react-router-dom` и требует React 19.2+. В старом коде встретите `element={<HomePage />}` вместо `Component: HomePage` — работает и сейчас, но `Component` короче и не создаёт элемент заранее.
:::
