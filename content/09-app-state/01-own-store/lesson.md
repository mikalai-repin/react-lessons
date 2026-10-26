---
title: Свой стор
startFrom: custom
base: 08-context/08-practice
baseHash: '24422ae4b97e'
removedInSolution: [cart/CartContext.ts, cart/CartProvider.module.css, cart/CartProvider.tsx]
focus: store/cartStore.ts
api: [внешнее хранилище, useSyncExternalStore, селектор, subscribe]
---

В главе 8 корзина переехала в контекст, и проброс props исчез. Но осталась цена: после «В корзину» у «Острова сокровищ» рендерились **все шесть карточек**, хотя изменилась одна (12 строк лога в шаге «Цена контекста»). Контекст сообщает «значение другое» и не умеет подписать компонент на часть значения.

В этой главе корзина уедет из React совсем — во **внешнее хранилище** (store, «стор»). Начнём со своего — на `useSyncExternalStore` из главы 6. А в следующем шаге увидим, что Zustand устроен так же.

## Стор — это модуль

Вспомните полосу «Нет сети» (шаг «Внешние хранилища»): значение живёт в браузере, React подписывается на изменения и читает **снимок**. Сделаем такое же хранилище сами — обычный модуль:

```
store/cartStore.ts
  state ─────────── { items, toast }
  listeners ─────── кому сообщить
  setState(next) ── новый state → позвать всех
       ▲                       │
  cartActions.add(4)           ▼
  (кнопка, таймер,       useSyncExternalStore
   любой модуль)         в Header, GameCard, …
```

Состояние — переменная модуля: одна на всё приложение, как сам модуль. Вместе с позициями в нём живёт и текст уведомления «Добавлено» — раньше он был в провайдере.

```tsx store/cartStore.ts
/** Всё, что хранит корзина */
export type CartState = {
  items: CartItem[];
  // Текст уведомления; null — уведомления нет
  toast: string | null;
};

// Состояние живёт в модуле — вне React, одно на всё приложение
let state: CartState = { items: initialCart, toast: null };
// Подписчики: их зовём после каждого изменения
const listeners = new Set<() => void>();

// Подписка: React передаст сюда функцию «проверь, что изменилось»
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Изменение — всегда новый объект состояния, затем оповещение
function setState(next: Partial<CartState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}
```

Правило неизменяемости — то же, что у `useState`: новое состояние — новый объект. `setState({ toast })` копирует `state` с новым `toast`, а `items` остаётся **тем же массивом**. Это пригодится через минуту.

Позиции меняет тот же `cartReducer` из главы 5 — переезжает без единой правки. Раньше черновик ему давал `useImmerReducer`, теперь — `produce` из Immer:

```tsx store/cartStore.ts
// Позиции меняет тот же редьюсер, что и раньше, — через Immer
function dispatch(action: CartAction) {
  setState({
    items: produce(state.items, (draft) =>
      cartReducer(draft, action),
    ),
  });
}
```

Действия — обычные функции в объекте `cartActions`. Их код перенесите из `cart/CartProvider.tsx` почти дословно:

```tsx store/cartStore.ts
// id таймера, который спрячет уведомление
let toastTimer: number | null = null;

function showToast(text: string) {
  setState({ toast: text });
  // Прошлый таймер отменяем: отсчёт начинается заново
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => setState({ toast: null }),
    TOAST_MS,
  );
}

/** Действия корзины: обычные функции, их можно звать откуда угодно */
export const cartActions = {
  add(gameId: number) {
    dispatch({ type: 'added', gameId });
    const { title } = games.find((game) => game.id === gameId)!;
    showToast(`Добавлено: ${title}`);
  },
  decrease: (gameId: number) =>
    dispatch({ type: 'decreased', gameId }),
  remove: (gameId: number) =>
    dispatch({ type: 'removed', gameId }),
  clear: () => dispatch({ type: 'cleared' }),
};
```

Вместо `setToast` — `setState`, а id таймера — переменная модуля, а не ссылка `useRef`: компонента больше нет. Константа `TOAST_MS` переезжает в стор вместе с таймером.

## Селектор

Осталось подключить React. Компоненту нужна не вся корзина, а её **часть**: карточке — количество своей игры, шапке — сколько всего штук. Пусть компонент сам скажет, какую: передаст функцию-**селектор** (selector), которая выбирает часть из состояния.

```tsx store/cartStore.ts
// Часть состояния корзины, которую выбрал selector.
// Компонент рендерится, только когда изменилась эта часть
export function useCartStore<T>(
  selector: (state: CartState) => T,
) {
  return useSyncExternalStore(subscribe, () => selector(state));
}
```

Снимок для React — не весь `state`, а результат селектора. Когда стор зовёт подписчиков, React вызывает `getSnapshot` каждого компонента и сравнивает с прошлым снимком через `Object.is`. Карточка «Драконьей почты» выбирает число: добавили «Остров» — у неё по-прежнему `0`, снимок тот же, рендера нет.

```tsx shared/GameCard.tsx
  // Только количество этой игры: другие позиции карточке не важны
  const quantity = useCartStore((state) =>
    quantityInCart(state.items, game.id),
  );
```

`quantityInCart` из главы 8 оказалась готовым селектором. Кнопка зовёт действие напрямую: `onClick={() => cartActions.add(game.id)}`.

Уведомление теперь — свой компонент: читает из стора только `toast`.

```tsx cart/CartToast.tsx
// Уведомление «Добавлено: …» внизу окна
export function CartToast() {
  const toast = useCartStore((state) => state.toast);
  if (toast === null) return null;
  return (
    <p className={styles.toast} role="status">
      {toast}
    </p>
  );
}
```

::: task
1. В `store/cartStore.ts` напишите тип `CartState`, переменные `state` и `listeners`, функции `subscribe`, `setState`, `dispatch` и `showToast`, объект `cartActions` (`add`, `decrease`, `remove`, `clear`) и хук `useCartStore(selector)`.
2. В `cart/CartToast.tsx` — компонент `CartToast` (стили — в готовом `CartToast.module.css`).
3. Переведите потребителей на стор: `GameCard` и `GameDetails` — `quantityInCart` в селекторе и `cartActions.add`; `MiniCart` — `useCartStore((state) => state.items)` и `cartActions`; `Header` — число штук прямо в селекторе (`state.items.reduce(…)`).
4. В `App` вместо `<CartProvider>` — фрагмент `<>`, а `<CartToast />` — последним, после `<Footer />`. Файлы `CartContext.ts` и `CartProvider.tsx` больше никто не импортирует: в решении их нет, у вас они могут остаться.
:::

## Что получилось

Магазин работает как раньше: «В корзину», мини-корзина, уведомление. А провайдера нет — `App` не знает о корзине ничего, кроме `<CartToast />`.

## Эксперименты

1. **Кто рендерится.** Добавьте `console.log('render Header')` в начало `Header`, `MiniCart` и `GameCard` — как в шаге «Цена контекста». Нажмите «В корзину» у «Острова сокровищ»:

   ```
   render Header       ×2
   render MiniCart     ×2
   render GameCard     ×4
   ```

   Не 12 строк карточек, а 4: «Остров» есть в «Хитах» и во «Всех играх», по два вызова в строгом режиме. Нажмите «В корзину» у «Драконьей почты» — `render GameCard ×2`: она только во «Всех играх». Остальные карточки выбрали своё количество, и оно не изменилось.

2. **Погасло уведомление.** Подождите 2,5 секунды — **ни одной строки**. `setState({ toast: null })` оставил `items` тем же массивом: шапка получила то же число, карточки — те же количества, мини-корзина — тот же `items`. В главе 8 для такого результата понадобились два контекста, `useCallback` и `useMemo`, а здесь хватило селекторов.

3. **Подписки.** Добавьте в `subscribe` `console.log('подписка')`, а в функцию отписки — `console.log('отписка')`. При запуске — `подписка ×18`, `отписка ×9`: девять компонентов читают стор (шапка, мини-корзина, шесть карточек, уведомление), строгий режим проверяет каждую подписку. Нажмите «В корзину» — новых строк нет. Селектор — новая стрелочная функция при каждом рендере, но React переподписывается, только если сменилась `subscribe`, а она — функция модуля.

4. **Действие вне React.** В `main.tsx` после импортов добавьте:

   ```tsx
   import { cartActions } from './store/cartStore';

   setTimeout(() => cartActions.add(4), 500);
   ```

   Через полсекунды «Ночной экспресс» в корзине, в шапке «Корзина: 1», внизу — «Добавлено: Ночной экспресс». Действие вызвал не компонент, а обычный таймер: стору всё равно, кто его зовёт. Так в настоящих проектах корзину меняют из обработчика WebSocket или после ответа сервера.

5. **Новый объект из селектора.** В `MiniCart` замените селектор на `const { items } = useCartStore((state) => ({ items: state.items }));`. Магазин пропал, в консоли:

   ```
   The result of getSnapshot should be cached to avoid an infinite loop
   Maximum update depth exceeded. …
   ```

   Ловушка из главы 6 (там — `getSnapshot` с `{ online }`): селектор каждый раз возвращает новый объект, `Object.is` всегда видит «изменилось», и React рендерит снова и снова. Селектор должен возвращать **то, что уже лежит в состоянии** (`state.items`), или примитив (число, строку). Как выбрать несколько значений сразу — в следующем шаге.

Верните код и уберите логи.

## Как в настоящем проекте

- Свой стор пишут редко: всё, что мы сделали, плюс десятки мелочей (типы middleware, серверный рендеринг, инструменты отладки) уже есть в библиотеках. Но устроены они так же: состояние вне React, подписка, селектор и `useSyncExternalStore`.
- У стора в модуле есть и минус: он **один на приложение**. Для тестов (глава 17) и серверного рендеринга (часть 3), где у каждого запроса должна быть своя корзина, стор создают функцией и раздают через контекст — значение контекста тогда не меняется, и цены из главы 8 нет.

::: deep Цена селекторов
Контекст рендерит всех потребителей. Стор с селекторами — наоборот: при **каждом** изменении React вызывает селектор **каждого** подписчика, а рендерит только тех, у кого результат изменился. Девять селекторов на щелчок — ничто. Но селектор должен быть дешёвым: не сортировать тысячу товаров и не создавать объектов — тяжёлые вычисления делают при рендере, уже после выбора нужных данных (шаг «Производное состояние»).
:::
