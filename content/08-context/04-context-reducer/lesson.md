---
title: Контекст и редьюсер
startFrom: custom
focus: cart/CartProvider.tsx
api: [компонент-провайдер, children, useImmerReducer, контекст + редьюсер]
---

Корзину читают через контекст, но живёт она всё ещё в `App`: редьюсер, четыре обработчика, уведомление «Добавлено» с таймером, сборка `cartValue` — почти сотня строк, которые к каталогу отношения не имеют. Соберём всё, что касается корзины, в один компонент — **провайдер корзины**.

## Компонент-провайдер

Провайдер — обычный компонент, который хранит состояние, оборачивает `children` в `<CartContext value>` и больше ничего не рисует (кроме уведомления — оно тоже про корзину):

```tsx cart/CartProvider.tsx
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useImmerReducer } from 'use-immer';
import { games } from '../data/games';
import { cartReducer, initialCart } from '../store/cartReducer';
import { CartContext } from './CartContext';
import type { CartContextValue } from './CartContext';
import styles from './CartProvider.module.css';

// Сколько показывается уведомление «Добавлено», мс
const TOAST_MS = 2500;

type CartProviderProps = {
  children: ReactNode;
};

// Корзина магазина: состояние, действия и уведомление «Добавлено».
// Всё, что внутри провайдера, получает корзину через useCart
export function CartProvider({ children }: CartProviderProps) {
  // Позиции корзины: меняются только через действия редьюсера
  const [items, dispatch] = useImmerReducer(
    cartReducer,
    initialCart,
  );
  // Текст уведомления; null — уведомления нет
  const [toast, setToast] = useState<string | null>(null);
  // id таймера, который спрячет уведомление
  const toastTimer = useRef<number | null>(null);

  function showToast(text: string) {
    … // без изменений — из App
  }

  // Значение контекста: позиции и действия с ними
  const value: CartContextValue = {
    items,
    add: (gameId) => {
      dispatch({ type: 'added', gameId });
      const { title } = games.find(
        (game) => game.id === gameId,
      )!;
      showToast(`Добавлено: ${title}`);
    },
    decrease: (gameId) =>
      dispatch({ type: 'decreased', gameId }),
    remove: (gameId) => dispatch({ type: 'removed', gameId }),
    clear: () => dispatch({ type: 'cleared' }),
  };

  return (
    <CartContext value={value}>
      {children}
      {toast !== null && (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      )}
    </CartContext>
  );
}
```

Это тот же код, что был в `App`, только собранный вместе:

- **редьюсер** отвечает за то, *как* меняется корзина (глава 5);
- **контекст** — за то, *кому* она доступна;
- **провайдер** соединяет их: держит состояние и предоставляет его вместе с действиями. Снаружи видно только `<CartProvider>` и `useCart()`.

Действия в значении — функции, которые сами отправляют `dispatch`. Потребитель вызывает `add(game.id)` и не знает ни про действия редьюсера, ни про уведомление.

`App` теперь начинается с каталога, а вся его разметка — внутри провайдера:

```tsx App.tsx
  return (
    <CartProvider>
      <OfflineBanner />
      …
      <Footer />
    </CartProvider>
  );
```

Из `App` уходят: `TOAST_MS`, `useImmerReducer` с корзиной, `toast`, `toastTimer`, `showToast`, `handleAdd`/`handleDecrease`/`handleRemove`/`handleClear`, `cartValue`, абзац уведомления и класс `.toast` в `App.module.css` (готовая копия — в `cart/CartProvider.module.css`). Импорты `useImmerReducer`, `cartReducer`, `initialCart` и `CartContext` из `App` тоже уходят.

::: task
1. В `cart/CartProvider.tsx` напишите `CartProvider({ children })`: редьюсер корзины, уведомление и значение контекста — перенесите из `App`. Уведомление рисуется после `children`, внутри провайдера.
2. В `App` оберните разметку в `<CartProvider>` вместо `<CartContext value={cartValue}>` и удалите весь код корзины и `.toast` из `App.module.css`.
:::

## Что получилось

Магазин работает как раньше, уведомление «Добавлено: Остров сокровищ» на месте. А `App` похудел на шесть десятков строк: в нём остались каталог, фильтры и выбранная игра.

## Эксперименты

1. **Кто рендерится.** Добавьте `console.log('render App');` в начало `App` и `console.log('render CartProvider');` в начало `CartProvider`. При запуске — по две строки каждого. Нажмите «В корзину»:

   ```
   render CartProvider
   render CartProvider
   ```

   И ни одного `render App`! В главе 4 любой щелчок «В корзину» рендерил `App` со всем деревом: состояние жило там. Теперь оно в `CartProvider`, а `App` — его **родитель**: изменение состояния рендерит компонент, которому оно принадлежит, и тех, кто ниже, но не тех, кто выше.

   Но `<OfflineBanner />`, `<main>` и все карточки — **ниже** провайдера: они в его `children`. Почему не рендерятся они? Элементы в `children` создал `App` при своём последнем рендере, и провайдер получил те же самые объекты. React видит: элемент тот же — компонент можно не вызывать. Кто всё-таки рендерится и почему — в следующем шаге. Уберите логи.

2. **Второй провайдер.** Оберните в `App` мини-корзину ещё одним провайдером:

   ```tsx App.tsx
   <CartProvider>
     <MiniCart games={games} />
   </CartProvider>
   ```

   Нажмите «В корзину» у «Острова»: в шапке «Корзина: 1», на карточке «В корзине: 1 шт.», а мини-корзина — «Корзина пуста». У внутреннего провайдера свой редьюсер и своё состояние, и мини-корзина читает **ближайший** провайдер — пустой. Провайдер — это не «доступ к общей корзине», а место, где корзина создаётся. Сколько провайдеров — столько корзин. Уберите внутренний.

## Как в настоящем проекте

- Связка «редьюсер + контекст + компонент-провайдер + хук» — стандартный приём React без сторонних библиотек; в документации он называется [Scaling Up with Reducer and Context](https://react.dev/learn/scaling-up-with-reducer-and-context). Хранилища из главы 9 (Zustand, Redux Toolkit) решают ту же задачу иначе.
- Провайдер ставят как можно ниже — вокруг той части дерева, которой данные нужны. Корзина нужна всему магазину, поэтому провайдер — у корня `App`.
- Компонент и хук держат в разных файлах (`CartProvider.tsx` и `CartContext.ts`): линтер нового проекта на Vite (шаблон `react-ts`, линтер oxlint) включает правило `react/only-export-components`: оно предупреждает, если файл с компонентом экспортирует что-то ещё, — такой файл горячая замена модулей не сможет обновить на месте, не сбросив состояние.
