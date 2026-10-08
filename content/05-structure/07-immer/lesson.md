---
title: Immer
focus: store/cartReducer.ts
api: [immer, produce, черновик, use-immer, useImmerReducer]
---

Редьюсер корзины работает, но читать его тяжело: чтобы прибавить единицу к одному числу, нужны `map`, тернарный оператор и spread. А ведь корзина — плоский массив. В главе 4 был пример с вложенностью: чтобы поменять `max` у игроков, пишут `{ ...game, players: { ...game.players, max: 6 } }` — копию на каждом уровне. Пять уровней — пять spread. Изменить «на месте» было бы проще, но в React нельзя. Или можно?

## Immer: меняйте черновик

[Immer](https://immerjs.github.io/immer/) — первая сторонняя библиотека курса. Её главная функция — `produce`:

```ts
import { produce } from 'immer';

const next = produce(base, (draft) => {
  draft[0].quantity += 1;
});
```

`produce` передаёт в функцию **черновик** (draft) — объект-заместитель (`Proxy`), который выглядит как `base`. Черновик можно менять обычным кодом: присваивать, `push`, `splice`, `delete`. Immer запоминает каждое изменение и по ним собирает **новое** неизменяемое значение. `base` при этом не меняется.

Проверим. Добавьте в конец `main.tsx`:

```tsx main.tsx
import { produce } from 'immer';

const base = [
  { gameId: 1, quantity: 1 },
  { gameId: 2, quantity: 1 },
];
const next = produce(base, (draft) => {
  draft[0].quantity += 1;
});
console.log(base[0].quantity, next[0].quantity);
console.log(next === base, next[0] === base[0], next[1] === base[1]);
console.log(Object.isFrozen(next), Object.isFrozen(next[1]));
```

В консоли:

```
1 2
false false true
true true
```

- `base` цел: в нём по-прежнему 1.
- Новые — только массив и изменённая позиция. Нетронутая вторая позиция **та же самая** (`next[1] === base[1]`). Это структурное разделение (structural sharing): Immer копирует ровно путь от корня до изменения, как вы бы сделали spread вручную.
- Результат заморожен (`Object.freeze`): случайно изменить его на месте не получится.

Уберите эксперимент из `main.tsx`.

## Редьюсер на черновике

Для редьюсеров есть маленькая библиотека-обёртка `use-immer` с хуком `useImmerReducer`: он работает как `useReducer`, но передаёт в редьюсер черновик. В превью обе библиотеки уже установлены; в своём проекте — `npm install immer use-immer`.

Перепишем редьюсер. Тип действий не меняется:

```ts store/cartReducer.ts {1-2,4-31}
/** Пустая корзина: тип задаём здесь — из [] TypeScript выведет never[] */
export const initialCart: CartItem[] = [];

/** Редьюсер для Immer: меняет черновик корзины, ничего не возвращает */
export function cartReducer(
  draft: CartItem[],
  action: CartAction,
) {
  // Где позиция этой игры; -1 — игры в корзине ещё нет
  const index = draft.findIndex(
    (item) => item.gameId === action.gameId,
  );
  switch (action.type) {
    case 'added':
      if (index === -1) {
        draft.push({ gameId: action.gameId, quantity: 1 });
      } else {
        draft[index].quantity += 1;
      }
      break;
    case 'decreased':
      draft[index].quantity -= 1;
      // Последняя штука — позиция исчезает
      if (draft[index].quantity === 0) draft.splice(index, 1);
      break;
    case 'removed':
      draft.splice(index, 1);
      break;
  }
}
```

Код читается как описание события: «нет позиции — добавить, есть — прибавить». Редьюсер ничего не возвращает: результат — изменения черновика. Ветки заканчиваются `break` — без него выполнение «провалилось» бы в следующую ветку.

В `App`:

```tsx App.tsx {2,5-8}
import { useState } from 'react';
import { useImmerReducer } from 'use-immer';
…
  // Позиции корзины: меняются только через действия редьюсера
  const [cart, dispatch] = useImmerReducer(
    cartReducer,
    initialCart,
  );
```

Почему `initialCart`, а не `[]`, как у `useReducer`? Тип состояния `useImmerReducer` выводит из начального значения, и из `[]` получится `never[]` — та же ловушка, что `useState([])` в главе 4: редактор подчеркнёт `item.quantity` в `App` с `Property 'quantity' does not exist on type 'never'.` Константа с явным типом решает это и заодно даёт имя пустой корзине.

::: task
1. В `store/cartReducer.ts` добавьте `initialCart: CartItem[] = []` и перепишите `cartReducer`: параметр — черновик `draft`, ветки меняют его через `push`, `+=`, `-=` и `splice` и заканчиваются `break`; тип результата уберите.
2. В `App.tsx` замените `useReducer` на `useImmerReducer` из `use-immer` с начальным значением `initialCart`. Импорт `useReducer` больше не нужен.
:::

## Что получилось

Корзина ведёт себя точно как раньше: «Остров сокровищ» дважды и «Нарды» — «Итого: 6 570 ₽», «−» и «×» работают. Обработчики и `dispatch` не изменились: сменилось только то, **как** редьюсер описывает новое состояние.

## Эксперименты

**Строгий режим не страшен.** Добавьте в начало редьюсера `console.log('reducer', action.type)` и положите в корзину «Нарды». Две строки `reducer added` — строгий режим вызвал редьюсер дважды, — но в корзине одна штука. Каждый вызов получает **свой** черновик от одного и того же состояния. Сравните с главой 4: там изменение объекта в функции обновления давало лишнюю штуку.

**Состояние заморожено.** Измените состояние вне редьюсера — в `handleAdd` перед `dispatch`: `if (cart.length > 0) cart[0].quantity = 99;`. TypeScript молчит. Положите «Нарды» дважды: второй щелчок — в консоли `TypeError: Cannot assign to read only property 'quantity' of object '#<Object>'`, корзина не изменилась. Менять можно только черновик и только внутри редьюсера.

**Или черновик, или новое значение.** Редьюсер Immer может и вернуть новое состояние, как обычный, — но не одновременно с изменением черновика. В ветке `'removed'` замените `break` на `return [];` и нажмите «×»:

```
[Immer] An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.
```

Приложение упало: ошибка при рендере. Верните `break`.

**Забытый `break`.** Удалите `break` в ветке `'added'`. Редактор: `Fallthrough case in switch.` — в курсе включена проверка `noFallthroughCasesInSwitch`, как в шаблоне Vite.

## Как в настоящем проекте

- Immer нужен там, где данные вложены, а изменения точечные: «у третьего товара второго заказа поменять статус». Для плоских списков, как наша корзина, spread вполне хорош — Immer даёт читаемость ценой небольшой библиотеки и прокси.
- Для `useState` есть `useImmer`: `const [filters, updateFilters] = useImmer(INITIAL)` и `updateFilters((draft) => { draft.query = 'кот'; })`. Значение можно передать и как обычно: `updateFilters(INITIAL)`.
- `produce` можно использовать и без `use-immer`: в обычном редьюсере `return produce(items, (draft) => { … })` или прямо в сеттере `setCart((items) => produce(items, (draft) => { … }))`.
- Redux Toolkit (глава 19) использует Immer внутри: в его редьюсерах «мутировать» состояние — нормальный стиль. Теперь вы знаете, что за этим стоит.

::: warning
«Мутировать можно» относится только к черновику Immer. В обычном `useReducer`, `useState` и props правило главы 4 действует как прежде: состояние не меняют, а заменяют.
:::
