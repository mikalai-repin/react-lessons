---
title: createContext
startFrom: custom
focus: cart/CartContext.ts
api: [createContext, '<Context value>', useContext, значение по умолчанию]
---

Карточке нужна корзина: сколько штук игры уже там и как добавить ещё. Сейчас корзина приходит к ней через `App` и `GameGrid`. Сделаем так, чтобы карточка брала корзину сама — откуда бы её ни нарисовали.

## Контекст

**Контекст** (context) — способ передать значение всему поддереву компонентов без props. Работа с ним — из трёх частей:

1. **Создать** контекст — один раз, вне компонентов: `createContext(значениеПоУмолчанию)`.
2. **Предоставить** значение — компонент выше по дереву оборачивает поддерево в **провайдер**: `<CartContext value={…}>`.
3. **Прочитать** — любой компонент внутри провайдера, на любой глубине: `useContext(CartContext)`.

```
App  <CartContext value={корзина}>
├─ Header
├─ Section
│  └─ GameGrid           ← о корзине не знает
│     └─ GameCard        ← useContext(CartContext)
└─ …
```

Компоненты между провайдером и тем, кто читает, ничего не передают и о контексте не знают.

## Создать

Контекст корзины — в своём файле `cart/CartContext.ts` (сейчас там заготовка):

```tsx cart/CartContext.ts
import { createContext } from 'react';
import type { CartItem } from '../api/models';

/** Что корзина даёт компонентам: позиции и действия с ними */
export type CartContextValue = {
  items: CartItem[];
  add: (gameId: number) => void;
  decrease: (gameId: number) => void;
  remove: (gameId: number) => void;
  clear: () => void;
};

// Корзина для всего дерева компонентов.
// null — значение по умолчанию: компонент нарисован вне провайдера
export const CartContext =
  createContext<CartContextValue | null>(null);
```

- `createContext` возвращает объект контекста. Состояния в нём нет: это «адрес», по которому провайдер кладёт значение, а потребитель его находит.
- **Значение по умолчанию** (аргумент `createContext`) компонент получит, если выше по дереву нет ни одного провайдера. Для корзины разумного значения по умолчанию нет — без провайдера корзины просто не существует. Поэтому `null`, и тип `CartContextValue | null` честно говорит: «может не оказаться».
- Значение — объект: позиции и функции. Через контекст можно передать что угодно — число, строку, объект с функциями.

## Предоставить

В `App` соберите значение из того, что уже есть, и оберните всю разметку в провайдер вместо фрагмента `<>`:

```tsx App.tsx {1-8,11}
  // Корзина для всех компонентов ниже: позиции и действия
  const cartValue: CartContextValue = {
    items: cart,
    add: handleAdd,
    decrease: handleDecrease,
    remove: handleRemove,
    clear: handleClear,
  };

  return (
    <CartContext value={cartValue}>
      <OfflineBanner />
      …
    </CartContext>
  );
```

В React 19 объект контекста сам служит провайдером: `<CartContext value={…}>`. Проп `value` обязателен — это и есть значение для поддерева.

## Прочитать

В `GameCard` вместо props `quantity` и `onAdd`:

```tsx shared/GameCard.tsx {2-7}
export function GameCard({ game, onSelect }: GameCardProps) {
  // Корзина — из ближайшего провайдера выше по дереву
  const cart = useContext(CartContext);
  if (cart === null) {
    throw new Error('GameCard нужен провайдер CartContext');
  }
  const quantity = quantityInCart(cart.items, game.id);
```

`useContext(CartContext)` возвращает значение **ближайшего** провайдера `CartContext` выше по дереву. Проверка на `null` нужна TypeScript: после неё `cart` — уже `CartContextValue`. А если провайдера нет, карточка упадёт с понятным сообщением, а не где-то ниже на `cart.items`.

Кнопка «В корзину» — `onClick={() => cart.add(game.id)}`. Из типа `GameCardProps` уходят `quantity` и `onAdd`, из `GameGrid` — `quantityOf` и `onAdd` (и в типе, и в разметке карточки). Сколько штук игры в корзине, считает готовая функция `quantityInCart(items, gameId)` в `store/cartReducer.ts`: она пригодится и карточке, и `App` для страницы игры — `quantity={quantityInCart(cart, selectedGame.id)}` вместо прежней `quantityOf`.

::: task
1. В `cart/CartContext.ts` объявите тип `CartContextValue` и создайте `CartContext` со значением по умолчанию `null`.
2. В `App` соберите `cartValue` и оберните разметку в `<CartContext value={cartValue}>`. Функцию `quantityOf` удалите: странице игры передайте `quantityInCart(cart, selectedGame.id)`.
3. В `GameCard` читайте корзину через `useContext`, props `quantity` и `onAdd` удалите.
4. В `GameGrid` уберите `quantityOf` и `onAdd`, в `App` — их передачу сетке.
:::

## Что получилось

Магазин работает как раньше: «В корзину» на карточке добавляет игру, счётчик в шапке и мини-корзина обновляются. Но теперь у `GameGrid` два пропа — `games` и `onSelect`, а про корзину сетка ничего не знает. Карточка берёт корзину сама, сколько бы слоёв ни оказалось между ней и `App`.

Шапка, мини-корзина и страница игры пока получают корзину через props — переведём их в следующем шаге.

## Эксперименты

1. **Без проверки.** Удалите в `GameCard` блок `if (cart === null) { … }`. Редактор подчеркнёт оба обращения к корзине:

   ```
   TS18047: 'cart' is possibly 'null'.
   ```

   Тип `useContext` — тип контекста целиком, с `null`. Верните проверку.

2. **Вне провайдера.** Нарисуйте в `main.tsx` одну карточку вместо `App`:

   ```tsx main.tsx
   root.render(
     <StrictMode>
       <GameCard game={games[0]} onSelect={() => {}} />
     </StrictMode>,
   );
   ```

   (импорты: `GameCard` из `./shared/GameCard`, `games` из `./data/games`). Экран пуст, в консоли — `Error: GameCard нужен провайдер CartContext` со строкой `GameCard.tsx`: провайдера выше нет, `useContext` вернул значение по умолчанию.

3. **Заглушка по умолчанию.** Не меняя `main.tsx`, замените в `CartContext.ts` `null` на объект-заглушку:

   ```tsx cart/CartContext.ts
   export const CartContext = createContext<CartContextValue>({
     items: [],
     add: () => {},
     decrease: () => {},
     remove: () => {},
     clear: () => {},
   });
   ```

   Карточка нарисовалась, консоль чиста. Нажмите «В корзину» — ничего не происходит: ни ошибки, ни «В корзине: 1 шт.». Заглушка спрятала ошибку: забыли провайдер — магазин молча не продаёт. Поэтому для данных, у которых нет разумного значения без провайдера, — `null` и проверка. Значение по умолчанию полезно, когда оно правда подходит, — например, светлая тема. Верните `null` и `main.tsx`.

4. **Провайдер без `value`.** В `App` напишите `<CartContext>` без `value`. TypeScript:

   ```
   TS2741: Property 'value' is missing in type '{ children: (false | Element)[]; }' but required in type 'ProviderProps<CartContextValue | null>'.
   ```

   А React сначала предупредит, а затем приложение упадёт:

   ```
   The `value` prop is required for the `<Context.Provider>`. Did you misspell it or forget to pass it?
   TypeError: Cannot read properties of undefined (reading 'items')
   ```

   Обратите внимание: `undefined`, а не `null`. Значение по умолчанию React берёт, только когда провайдера нет совсем; провайдер без `value` предоставляет `undefined`, и наша проверка `=== null` его пропускает. Верните `value={cartValue}`.

## Как в настоящем проекте

- Контекст объявляют в отдельном модуле и импортируют туда, где он нужен, — и провайдеру, и потребителям. Два вызова `createContext` дают два разных контекста, даже с одинаковым именем: потребитель найдёт только провайдер **того же** объекта.
- Имя — `XContext` (`CartContext`, `ThemeContext`), тип значения — рядом.
- Значение по умолчанию чаще всего `null` или `undefined` + проверка в одном месте — в своём хуке (следующий шаг).

::: legacy Вы встретите в старом коде
До React 19 провайдером был отдельный компонент `CartContext.Provider`:

```tsx
<CartContext.Provider value={cartValue}>…</CartContext.Provider>
```

В React 19 он работает — это тот же объект: `CartContext.Provider === CartContext`. В [анонсе React 19](https://react.dev/blog/2024/12/05/react-19) команда React обещает в будущих версиях объявить `<Context.Provider>` устаревшим. Ещё старше — `<CartContext.Consumer>{(cart) => …}</CartContext.Consumer>`: чтение через функцию в `children`, до появления хуков.
:::

::: tip
Если вы пришли из Angular: провайдер похож на `providers: [CartService]` в компоненте — всё, что ниже, получает этот экземпляр, а ближайший провайдер перекрывает дальние. Разница — React передаёт не сервис с собственным состоянием, а **значение**: что положили в `value` при этом рендере, то потребители и прочитают.
:::
