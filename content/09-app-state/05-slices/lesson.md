---
title: Срезы и devtools
startFrom: custom
focus: store/cartStore.ts
api: [срезы, StateCreator, get, devtools, имя действия]
---

`store/cartStore.ts` вырос: позиции, уведомление с таймером, `persist` с миграцией. В практикуме добавится промокод, в главе 14 — пользователь. Стор, в котором живёт всё, через полгода становится файлом на тысячу строк. Zustand предлагает два выхода: несколько сторов или один стор из **срезов** (slices).

## Один стор или несколько

Несколько сторов — `useCartStore`, `useToastStore` — проще всего: каждый в своём файле, со своими middleware. Но наша корзина в `add` показывает уведомление, то есть одна часть состояния зовёт другую. Из соседнего стора это `useToastStore.getState().showToast(…)` — работает, но связь между сторами спрятана в коде действий, а `persist`, `devtools` и подписку `subscribe` придётся настраивать для каждого.

**Срезы** — один стор, собранный из нескольких функций. Каждая строит свою часть состояния и получает те же `set` и `get`, что и весь стор. Срез корзины видит уведомление через `get()`, а middleware навешиваются один раз — на собранный стор.

```
cartSlice.ts   items, add, decrease, …
toastSlice.ts  toast, showToast
        └────────┬────────┘
cartStore.ts   create(devtools(persist(…)))
```

## Срез

Срез — функция того же вида, что мы передавали в `create`, только возвращает часть состояния:

```tsx store/toastSlice.ts
/** Срез уведомления: текст и как его показать */
export type ToastSlice = {
  // Текст уведомления; null — уведомления нет
  toast: string | null;
  showToast: (text: string) => void;
};

// id таймера, который спрячет уведомление
let toastTimer: number | null = null;

export const createToastSlice: StateCreator<
  CartState,
  CartMiddlewares,
  [],
  ToastSlice
> = (set) => ({
  toast: null,
  showToast: (text) => {
    set({ toast: text }, undefined, 'toast/shown');
    // Прошлый таймер отменяем: отсчёт начинается заново
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => set({ toast: null }, undefined, 'toast/hidden'),
      TOAST_MS,
    );
  },
});
```

`StateCreator` — тип такой функции из `zustand`. Четыре параметра:

1. `CartState` — **весь** стор: `set` и `get` работают со всем состоянием, а не с частью;
2. `CartMiddlewares` — какие middleware обёрнуты вокруг: от них зависит тип `set` (у `devtools` — третий аргумент, имя действия);
3. `[]` — middleware, которые добавляет сам срез: никаких — middleware ставятся только на собранный стор, в срезах документация Zustand их применять не советует;
4. `ToastSlice` — что срез возвращает.

Срез корзины — `items` и действия из прошлых шагов. Уведомление он берёт у соседа:

```tsx store/cartSlice.ts
      get().showToast(`Добавлено: ${title}`);
```

`get()` — текущее состояние всего стора, вместе с действиями других срезов. Функции `showToast` у корзины больше нет.

## Собираем стор

```tsx store/cartStore.ts
/** Весь стор — сумма срезов */
export type CartState = CartSlice & ToastSlice;

/** Какие middleware обёрнуты вокруг срезов: их видят типы set */
export type CartMiddlewares = [
  ['zustand/devtools', never],
  ['zustand/persist', unknown],
];

// Стор корзины: срезы собираются в одно состояние.
// devtools — снаружи: он видит каждый set, и persist тоже
export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (...api) => ({
        ...createCartSlice(...api),
        ...createToastSlice(...api),
      }),
      {
        … // name, partialize, version, migrate — как были
      },
    ),
    // Имя стора в Redux DevTools
    { name: 'Корзина' },
  ),
);
```

`(...api)` — те же три аргумента (`set`, `get` и сам стор), что получила функция; каждому срезу передаём их целиком и сливаем результаты в один объект.

Срезы импортируют из `cartStore.ts` только **типы** (`import type`), а `cartStore.ts` импортирует сами функции срезов. Импорт типов исчезает при компиляции, так что круга модулей нет — а превью курса, напомним, циклические импорты не поддерживает.

## devtools

[`devtools`](https://zustand.docs.pmnd.rs/reference/middlewares/devtools) подключает стор к расширению браузера **Redux DevTools**: журнал действий, состояние после каждого, «перемотка» назад. Третий аргумент `set` — имя действия в журнале: `'toast/shown'`, а в корзине — `` `cart/${action.type}` `` из `dispatch`. Без имени в журнале будет `anonymous`.

Порядок обёрток важен: `devtools` — **снаружи**, последним. Он подменяет `set`, и если бы внутри него стоял другой middleware, тоже меняющий `set`, имя действия потерялось бы. Так советует документация Zustand.

::: task
1. Вынесите уведомление в срез — заготовку `store/toastSlice.ts` (`ToastSlice`, `createToastSlice` с `showToast`), позиции и действия — в заготовку `store/cartSlice.ts` (`CartSlice`, `createCartSlice`); корзина показывает уведомление через `get().showToast(…)`.
2. В `store/cartStore.ts` объявите `CartState` как сумму срезов и `CartMiddlewares`, соберите стор из срезов внутри `persist` и оберните в `devtools` с `name: 'Корзина'`.
3. Дайте имена действиям: `cart/${action.type}` в `dispatch`, `toast/shown` и `toast/hidden` в уведомлении.
:::

## Что получилось

Магазин работает как раньше — компоненты не заметили перестройки: `useCartStore`, поля и действия те же. Консоль пуста: в превью нет расширения, и `devtools` без него молча ничего не делает.

В настоящем проекте с установленным Redux DevTools во вкладке расширения появится стор «Корзина». После «В корзину» и «−» в мини-корзине журнал такой (проверено поддельным расширением в превью):

```
anonymous      ← persist прочитал хранилище
cart/added
toast/shown
cart/decreased
toast/hidden   ← через 2,5 с, из таймера
```

Первая строка — не ошибка: при создании стора `persist` записывает прочитанное через `set` без имени.

## Эксперименты

1. **Без имени.** Уберите `undefined, 'toast/shown'` из `set` в `showToast`. TypeScript не возражает: имя необязательно. В журнале DevTools вместо `toast/shown` будет `anonymous` — по такому журналу не понять, что произошло.
2. **Без `devtools` в типах.** Удалите строку `['zustand/devtools', never]` из `CartMiddlewares`. В срезах — `Expected 1-2 arguments, but got 3.` у каждого `set` с именем: без `devtools` у `set` только два аргумента. Тип `set` срез узнаёт из списка middleware — поэтому список общий и лежит рядом со стором. Верните строку.

## Как в настоящем проекте

- Мелкие независимые сторы — нормальная практика Zustand: стор настроек и стор корзины ничего не знают друг о друге. Срезы нужны, когда части состояния зовут друг друга или должны сохраняться и отлаживаться вместе.
- `devtools` в продакшен-сборке обычно выключают: `devtools(…, { enabled: import.meta.env.DEV })` в проекте Vite. По умолчанию Zustand сам включает его вне режима `production`.
- Имена действий «срез/событие» (`cart/added`) — то же соглашение, что у Redux Toolkit (глава 19): журнал читается как история событий.
