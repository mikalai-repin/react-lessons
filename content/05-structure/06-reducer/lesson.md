---
title: useReducer
startFrom: custom
focus: store/cartReducer.ts
api: [useReducer, редьюсер, dispatch, действие, discriminated union]
---

`App` разросся: фильтры, открытая игра, корзина. Логика корзины разбросана по трём обработчикам, и в каждом — свой `setCart` со своим `map`, `filter` и spread. Чтобы понять, как вообще меняется корзина, приходится читать весь `App`. Соберём все изменения корзины в одну функцию — **редьюсер**.

## Редьюсер и действия

Редьюсер (reducer) — чистая функция: принимает текущее состояние и **действие** (action) и возвращает новое состояние.

```
(состояние, действие) → новое состояние
```

Действие — объект, который описывает, **что случилось**: «покупатель добавил игру 4». Обработчики перестают сами менять состояние: они только сообщают о событии, вызывая `dispatch(действие)`. Как событие меняет корзину, решает редьюсер. Название — от `Array.prototype.reduce`: функция того же вида сворачивает массив в одно значение.

```
 щелчок «+»
     ↓
 dispatch({ type: 'added', gameId: 4 })
     ↓  (очередь, как у сеттера)
 рендер App:
   cartReducer(корзина, действие)
     ↓
 новая корзина
```

## Корзина на редьюсере

В проекте есть заготовка `store/cartReducer.ts`. Сначала — тип действий. Это объединение (discriminated union) по полю `type`:

```ts store/cartReducer.ts
import type { CartItem } from '../api/models';

/** Что может случиться с корзиной: тип события и его данные */
export type CartAction =
  | { type: 'added'; gameId: number }
  | { type: 'decreased'; gameId: number }
  | { type: 'removed'; gameId: number };
```

Имена — в прошедшем времени: `'added'`, а не `'add'`. Действие описывает событие, которое уже произошло, а не приказ. Так рекомендует документация React, и так проще читать журнал действий.

Затем сам редьюсер. Код переносим из обработчиков `App` почти без изменений:

```ts store/cartReducer.ts
/** Редьюсер: новое состояние корзины по старому и действию */
export function cartReducer(
  items: CartItem[],
  action: CartAction,
): CartItem[] {
  switch (action.type) {
    case 'added': {
      const inCart = items.some(
        (item) => item.gameId === action.gameId,
      );
      // Новой игры ещё нет — новый массив с новой позицией в конце
      if (!inCart) {
        return [...items, { gameId: action.gameId, quantity: 1 }];
      }
      // Есть — новый массив, где у этой позиции новый объект
      return items.map((item) =>
        item.gameId === action.gameId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    }
    case 'decreased': {
      // Минус одна штука; последняя — позиция исчезает
      return items
        .map((item) =>
          item.gameId === action.gameId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0);
    }
    case 'removed': {
      return items.filter(
        (item) => item.gameId !== action.gameId,
      );
    }
  }
}
```

- В каждой ветке `switch` TypeScript **сужает** тип действия: внутри `case 'added'` он знает, что это `{ type: 'added'; gameId: number }`. Добавьте действию поле — оно будет доступно только в своей ветке.
- Фигурные скобки у `case` дают каждой ветке свою область видимости: `const inCart` из одной ветки не столкнётся с одноимённой константой другой.
- Тип результата `CartItem[]` указан явно. Он заставляет обработать все действия: уберите ветку `'removed'` — TypeScript скажет, что функция может завершиться, ничего не вернув.

В `App` вместо `useState` — `useReducer`, а обработчики сокращаются до одной строки:

```tsx App.tsx {1-2,6-17}
  // Позиции корзины: меняются только через действия редьюсера
  const [cart, dispatch] = useReducer(cartReducer, []);
…

  // Обработчики сообщают, что случилось; менять — дело редьюсера
  function handleAdd(gameId: number) {
    dispatch({ type: 'added', gameId });
  }

  function handleDecrease(gameId: number) {
    dispatch({ type: 'decreased', gameId });
  }

  function handleRemove(gameId: number) {
    dispatch({ type: 'removed', gameId });
  }
```

`useReducer(редьюсер, начальное состояние)` возвращает пару, как `useState`: текущее состояние и функцию `dispatch`. Тип состояния TypeScript берёт из редьюсера, поэтому `[]` здесь не превращается в `never[]`, как было с `useState([])` в главе 4. Импорты: `useReducer` из `react`, `cartReducer` из `./store/cartReducer`; тип `CartItem` в `App` больше не нужен.

::: task
1. В `store/cartReducer.ts` объявите `CartAction` — три действия с полями `type` и `gameId`.
2. Напишите `cartReducer(items, action): CartItem[]` со `switch` по `action.type`; код веток перенесите из `handleAdd`, `handleDecrease` и `handleRemove`.
3. В `App.tsx` замените `useState` корзины на `useReducer(cartReducer, [])`, а тела трёх обработчиков — на `dispatch` нужного действия.
:::

## Что получилось

Снаружи ничего не изменилось — так и задумано. Добавьте «Остров сокровищ» в «Хитах» и во «Всех играх», затем «Нарды»: в мини-корзине «Остров сокровищ − 2 +», «Нарды − 1 +», «Итого: 6 570 ₽». «−» дважды у «Острова» и «×» у «Нард» — корзина пуста. Зато вся логика корзины теперь в одном файле, и её можно прочитать, не открывая `App`.

## Эксперименты

**Когда работает редьюсер.** Добавьте в начало `cartReducer` строку `console.log('reducer', action.type, action.gameId, items.length)`, а в `handleAdd` после `dispatch` — `console.log('после dispatch')`. Положите в корзину «Нарды»:

```
после dispatch
reducer added 10 0
reducer added 10 0
```

`dispatch` ничего не считает и не возвращает: он ставит действие в очередь, как сеттер `useState` (глава 4), и обработчик идёт дальше. Редьюсер вызывается во время рендера — и в строгом режиме **дважды** с одним и тем же состоянием. Отсюда главное требование: редьюсер — чистая функция. Никаких запросов, таймеров, `Math.random()` и изменения `items` на месте: второй вызов должен вернуть то же, что первый.

**Ошибки, которые ловит TypeScript.** Напишите `dispatch({ type: 'add', gameId })`:

```
Type '"add"' is not assignable to type '"added" | "decreased" | "removed"'.
```

Уберите `gameId`: `Property 'gameId' is missing in type '{ type: "added"; }' but required in type '{ type: "added"; gameId: number; }'.` Опечатка в имени действия — частая ошибка в редьюсерах на JavaScript; union-тип делает её невозможной.

## Как в настоящем проекте

| `useState` | `useReducer` |
|---|---|
| Простое значение, одно-два обновления | Много способов изменить одно состояние |
| Логика обновления — в обработчике | Логика — в одной функции вне компонента |
| Меньше кода | Легко читать и тестировать отдельно |

- Редьюсер — обычная функция: её проверяют тестом без React, без рендера и щелчков (глава 17): `expect(cartReducer([], { type: 'added', gameId: 1 })).toEqual([{ gameId: 1, quantity: 1 }])`.
- В главе 8 этот редьюсер вместе с `dispatch` уедет в контекст, чтобы корзина была доступна любому компоненту без передачи через props. Redux (глава 19) построен на тех же редьюсерах и действиях.
- Не обязательно переводить на редьюсер всё подряд. Фильтры в `App` меняются по одному полю за раз — `useState` им вполне подходит.

::: deep
`useState` внутри React — это `useReducer` с готовым редьюсером. В `react-dom-client.development.js` обновление состояния вызывает `updateReducer(basicStateReducer)`, а сам редьюсер — две строки:

```js
function basicStateReducer(state, action) {
  return "function" === typeof action ? action(state) : action;
}
```

Значение в сеттере — «действие», которое заменяет состояние; функция — действие, которое вычисляет новое из старого. Поэтому у `useState` и `useReducer` одна и та же очередь обновлений и одна пакетная обработка.
:::

::: tip
Если вы писали на NgRx, всё знакомо: `createAction`, редьюсер, `dispatch`. Разница в масштабе: `useReducer` — локальное состояние одного компонента, без хранилища, эффектов и селекторов.
:::
