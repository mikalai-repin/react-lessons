---
title: use и useContext
focus: cart/CartContext.ts
api: ['use(Context)', useContext, свой хук над контекстом]
---

Карточка читает корзину сама. Осталось перевести шапку, мини-корзину и страницу игры — и `App` перестанет передавать корзину через props совсем. Но если в каждом компоненте писать `useContext` и проверку на `null`, это четыре копии одних и тех же строк. Вынесем их в свой хук — и заодно познакомимся со вторым способом читать контекст.

## `use(Context)`

В React 19 контекст читает ещё и функция [`use`](https://react.dev/reference/react/use):

```tsx
const cart = use(CartContext);
```

Результат тот же, что у `useContext`: значение ближайшего провайдера или значение по умолчанию. Разница — в правилах вызова. `use` можно вызывать **в условиях и циклах**: внутри `if`, после раннего `return`. Правило «только в компонентах и хуках» остаётся — вызывать её в обработчике или эффекте нельзя: контекст читается во время рендера. И ещё одно ограничение из документации: не внутри `try`/`catch`. Почему условие не мешает — увидим в шаге «Под капотом»: в отличие от `useState`, чтение контекста не занимает ячейку в списке хуков.

`use` умеет не только контекст: ещё она читает промисы вместе с `Suspense` (глава 11). Документация React так и сравнивает их: `useContext` — только на верхнем уровне, `use` — и в условиях, и в циклах. В курсе дальше пишем `use`. `useContext` вы встретите в большинстве существующего кода — это не устаревший API, а просто более строгий вариант.

## Свой хук над контекстом

```tsx cart/CartContext.ts {1,10-19}
import { createContext, use } from 'react';

…

export const CartContext =
  createContext<CartContextValue | null>(null);

// Корзина из ближайшего провайдера выше по дереву.
// Нет провайдера — ошибка с понятным текстом, а не null дальше по коду
export function useCart() {
  const cart = use(CartContext);
  if (cart === null) {
    throw new Error(
      'useCart: выше по дереву нет провайдера корзины',
    );
  }
  return cart;
}
```

Это тот случай, о котором шла речь в главе 7, — хук-обёртка, которая действительно нужна: проверка в одном месте, а тип результата — уже `CartContextValue`, без `null`. Компоненту больше не нужно знать ни про объект контекста, ни про значение по умолчанию: `const cart = useCart()`.

Хук вызывает `use`, поэтому называется `useCart` и подчиняется правилам хуков — значит, его самого линтер требует вызывать на верхнем уровне (эксперимент ниже).

## Все потребители

`GameCard` — `const cart = useCart();` вместо пяти строк с `useContext`. Затем:

- **`Header`** — props `cartCount` больше нет, шапка считает его сама:

  ```tsx layout/Header.tsx
  export function Header({ count }: HeaderProps) {
    const { items } = useCart();
    // Всего штук — считаем из позиций при рендере
    const cartCount = items.reduce(
      (sum, item) => sum + item.quantity,
      0,
    );
  ```

- **`MiniCart`** — из props остаётся `games`, остальное — из контекста:

  ```tsx cart/MiniCart.tsx
  export function MiniCart({ games }: MiniCartProps) {
    const { items, add, decrease, remove, clear } = useCart();
  ```

  В разметке: `onClick={() => decrease(game.id)}`, `add(game.id)` у «+», `remove(game.id)` у «×», `onConfirm={clear}`.

- **`GameDetails`** — без `quantity` и `onAdd`:

  ```tsx game/GameDetails.tsx
  const cart = useCart();
  const quantity = quantityInCart(cart.items, game.id);
  ```

  и `onClick={() => cart.add(game.id)}` у кнопки.

В `App` от корзины в разметке остаётся только провайдер: `<Header count={games.length} />`, `<MiniCart games={games} />`, `<GameDetails>` без `quantity` и `onAdd`. Подсчёт `cartCount` из `App` уходит в шапку, импорт `quantityInCart` — тоже.

::: task
1. В `cart/CartContext.ts` напишите хук `useCart()`: читает контекст через `use`, без провайдера бросает ошибку, иначе возвращает корзину.
2. Переведите на `useCart` карточку, шапку, мини-корзину и страницу игры; props корзины у них удалите.
3. В `App` уберите передачу этих props и подсчёт `cartCount`.
:::

## Что получилось

Магазин работает как раньше, но поток данных другой. Посмотрите на `App`: состояние корзины и обработчики по-прежнему здесь, а в разметке о корзине — одна строка `<CartContext value={cartValue}>`. Добавьте игру с карточки, со страницы игры, кнопкой «+» в мини-корзине — счётчик в шапке, мини-корзина и «В корзине: N шт.» меняются вместе: все читают одно значение.

## Эксперименты

1. **`use` в условии.** Пусть подвал после подписки напоминает о корзине. Добавьте в `Footer` перед `handleSubmit` (и импорты `use` и `CartContext`):

   ```tsx layout/Footer.tsx
   // После подписки — напоминание о корзине
   let reminder = '';
   if (result !== null) {
     const cart = use(CartContext);
     reminder = `В корзине позиций: ${cart?.items.length}`;
   }
   ```

   и `<p>{reminder}</p>` перед сообщением о подписке. Добавьте игру в корзину и подпишитесь — «В корзине позиций: 1», консоль пуста. Первый рендер `Footer` контекст не читал, следующий — прочитал, и React это устроило.

2. **`useContext` в том же условии.** Замените `use` на `useContext`. Работает так же, но после подписки в консоли — знакомая по главе 7 таблица:

   ```
   React has detected a change in the order of Hooks called by Footer. …
      Previous render            Next render
      ------------------------------------------------------
   1. useState                   useState
   2. undefined                  useContext
   ```

   Значение прочитано правильно — ячейки у `useContext` нет, ломать нечего. Но React в режиме разработки сверяет **порядок вызовов** хуков, и `useContext` в этом списке есть, а `use` — нет. Линтер тоже различает их: на `useContext` в условии — `React Hook "useContext" is called conditionally. React Hooks must be called in the exact same order in every component render`, на `use` — ничего.

3. **Свой хук в условии.** Замените `useContext(CartContext)` на `useCart()`. Ошибок в консоли нет (внутри — `use`), но линтер скажет то же: `React Hook "useCart" is called conditionally…`. Он судит по имени: функция `use…` — хук, и её вызов в условии запрещён. Внутри хука могут оказаться `useState` и `useEffect`, которым порядок важен. Уберите эксперимент из `Footer`.

4. **Хук вне провайдера.** Нарисуйте в `main.tsx` вместо `App` одну шапку — `<Header count={6} />` (импорт из `./layout/Header`). В консоли — `Error: useCart: выше по дереву нет провайдера корзины` а под ней — стек: `useCart (cart/CartContext.ts…)`, а строкой ниже — `Header (layout/Header.tsx…)`, кто вызвал хук. Верните `App`.

## Как в настоящем проекте

- Хук над контекстом — обычная практика: `useCart()`, `useTheme()`, `useAuth()`. Сам объект контекста часто даже не экспортируют наружу, только провайдер и хук.
- `use` в условии — редкость. Чаще он нужен в компоненте с ранним `return`: прочитать контекст только в той ветке, где он нужен.
- В существующем коде почти везде `useContext`. Оба читают одинаково; меняйте на `use` по мере правок, массовая замена не нужна.

::: tip
Если вы пришли из Angular: `useCart()` похож на `inject(CartService)` — функция, которая достаёт зависимость из окружения компонента. Только `inject` вызывают в контексте внедрения (конструктор, инициализатор поля), а `useCart` — во время рендера.
:::
