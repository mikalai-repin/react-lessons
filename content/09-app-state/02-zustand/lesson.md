---
title: Zustand
focus: store/cartStore.ts
api: [create, 'set', селектор, useShallow, getState, subscribe]
---

Свой стор работает, но в настоящем проекте его не пишут: подписку, селекторы, типы и инструменты отладки давно собрали в библиотеки. Самая популярная из лёгких — [Zustand](https://zustand.docs.pmnd.rs/) (нем. «состояние»). Посмотрим, что от нашего кода останется.

## create

```tsx store/cartStore.ts
import { create } from 'zustand';

// Стор корзины: create возвращает хук, у хука — getState и subscribe
export const useCartStore = create<CartState>()((set) => {
  // …dispatch и showToast — ниже
  // Начальное состояние: данные и действия вместе
  return {
    items: initialCart,
    toast: null,
    add: (gameId) => { … },
    decrease: (gameId) =>
      dispatch({ type: 'decreased', gameId }),
    remove: (gameId) => dispatch({ type: 'removed', gameId }),
    clear: () => dispatch({ type: 'cleared' }),
  };
});
```

`create` принимает функцию, которая **один раз** строит начальное состояние, и возвращает хук — тот самый `useCartStore(selector)`, что мы написали руками. Внутри Zustand — переменная состояния, набор подписчиков и `useSyncExternalStore`; в шаге «Под капотом» мы прочитаем эти полсотни строк целиком.

Две записи стоит разобрать:

- `create<CartState>()(…)` — две пары скобок. Первый вызов только задаёт тип состояния, второй принимает функцию — а остальные параметры типа (их добавляют middleware, следующий шаг) TypeScript выводит сам. Одним вызовом так нельзя: TypeScript не умеет указать часть параметров типа, а остальные вывести. Документация Zustand называет эту запись рекомендуемой.
- **Действия живут в состоянии.** `add`, `decrease` — такие же поля, как `items`. Функции не меняются, так что компонент, который выбрал действие, рендериться из-за него не будет. Это обычная практика Zustand: всё о корзине — в одном месте.

## set

Вместо нашего `setState` — `set`, который `create` передаёт в функцию:

```tsx store/cartStore.ts
  // Позиции меняет тот же редьюсер, что и раньше, — через Immer
  function dispatch(action: CartAction) {
    set((state) => ({
      items: produce(state.items, (draft) =>
        cartReducer(draft, action),
      ),
    }));
  }

  function showToast(text: string) {
    set({ toast: text });
    …
  }
```

- `set(объект)` **сливает** объект с состоянием на один уровень: `set({ toast })` меняет `toast`, а `items` и действия остаются прежними. Как наш `{ ...state, ...next }`, с одной проверкой: если функция в `set` вернула тот же объект `state` (`Object.is`), Zustand никого не зовёт.
- `set(функция)` — когда новое значение считается из прошлого, как функция обновления в `useState`.

Объявлять `dispatch` и `showToast` внутри `create` удобно: они видят `set` и не видны снаружи. Переменная таймера `toastTimer` остаётся в модуле.

## Компоненты

Состояние читаем так же, как в прошлом шаге: `useCartStore((state) => state.items)` — шапке, карточкам и уведомлению менять ничего не нужно. Действия — тоже селектором:

```tsx shared/GameCard.tsx
  // Действие — тоже из стора: функция не меняется, рендеров не будет
  const add = useCartStore((state) => state.add);
```

Мини-корзине нужны четыре действия. Четыре строки `useCartStore` — можно, но хочется одним селектором вернуть объект. А объект из селектора — новый при каждом вызове: вспомните бесконечный цикл из прошлого шага. Для этого в Zustand есть [`useShallow`](https://zustand.docs.pmnd.rs/reference/hooks/use-shallow):

```tsx cart/MiniCart.tsx
import { useShallow } from 'zustand/react/shallow';

  // Несколько значений разом: useShallow сравнивает объект по полям
  const { add, decrease, remove, clear } = useCartStore(
    useShallow((state) => ({
      add: state.add,
      decrease: state.decrease,
      remove: state.remove,
      clear: state.clear,
    })),
  );
```

`useShallow` оборачивает селектор: сравнивает новый результат с прошлым **поверхностно** — по каждому полю через `Object.is` — и, если поля те же, возвращает **прошлый** объект. Снимок не изменился, цикла нет.

::: task
1. Перепишите `store/cartStore.ts` на `create` из `zustand`: действия `add`, `decrease`, `remove`, `clear` — поля `CartState`, `dispatch` и `showToast` — внутри функции, переданной в `create`, через `set`. Хук `useCartStore`, объект `cartActions` и функции `subscribe`/`setState` больше не нужны.
2. `GameCard` и `GameDetails`: `const add = useCartStore((state) => state.add);`.
3. `MiniCart`: четыре действия одним селектором с `useShallow`.
:::

## Что получилось

Снаружи — ничего нового: магазин работает как в прошлом шаге, и с логами рендеров из прошлого шага цифры те же — «В корзину» у «Острова»: шапка ×2, мини-корзина ×2, карточки ×4; погасло уведомление — ни строки. А кода хранилища стало меньше, и он стал проще: ни подписчиков, ни `useSyncExternalStore`.

## Эксперименты

1. **Без `useShallow`.** Уберите обёртку — оставьте `useCartStore((state) => ({ add: state.add, … }))`. Магазин пропал, в консоли знакомые `The result of getSnapshot should be cached to avoid an infinite loop` и `Maximum update depth exceeded`. Верните `useShallow`.

   ::: legacy
   В Zustand 4 у хука был второй аргумент — функция сравнения: `useCartStore(selector, shallow)`. В Zustand 5 его нет: `create` построен на `useSyncExternalStore`, и сравнение — только `Object.is`. Старый вариант остался в `createWithEqualityFn` из `zustand/traditional`. В старом коде встретите и `create(…)` без первой пары скобок, и `shallow` из `zustand/shallow` вторым аргументом хука.
   :::

2. **Весь стор.** В `MiniCart` вместо селектора позиций напишите `const { items } = useCartStore();` и добавьте лог рендера. Без селектора хук возвращает **всё** состояние, и компонент рендерится при любом его изменении: погасло уведомление — `render MiniCart ×2`, хотя позиции те же. Это самая частая ошибка с Zustand: удобно, но рендерится всё.

3. **Вне React.** У хука есть методы самого стора. В `main.tsx` после импортов:

   ```tsx
   import { useCartStore } from './store/cartStore';

   useCartStore.subscribe((state, prev) =>
     console.log('было', prev.items.length, 'стало', state.items.length),
   );
   setTimeout(() => useCartStore.getState().add(4), 500);
   ```

   Через полсекунды в корзине «Ночной экспресс», а в консоли две строки: `было 0 стало 1` и `было 1 стало 1`. `getState()` возвращает текущее состояние вместе с действиями, `subscribe` — подписка без React. Почему строк две? `add` вызывает `set` дважды: позиции, затем уведомление. Подписчик слышит каждый `set`, а компоненты рендерятся один раз — React собирает обновления в пакет (глава 4).

4. **Замена вместо слияния.** У `set` есть второй аргумент: `set(…, true)` **заменяет** состояние целиком. Напишите в `showToast` `set({ toast: text }, true)` — TypeScript не пустит:

   ```
   No overload matches this call.
     …
     Type '{ toast: string; }' is missing the following properties from type 'CartState': items, add, decrease, remove, clear
   ```

   Без проверки типов замена стёрла бы позиции и все действия. Верните `set({ toast: text })`.

## Как в настоящем проекте

- Один стор на предметную область (корзина, пользователь, настройки) или один стор с **срезами** (шаг «Срезы и devtools»). Действия — в сторе; компоненты выбирают и данные, и действия селекторами.
- Правило селектора: возвращайте то, что уже лежит в состоянии, или примитив. Нужно несколько полей — `useShallow` или несколько вызовов хука.
- Провайдер Zustand не нужен: стор — модуль. Если стор должен быть свой у каждого поддерева (тесты, серверный рендеринг), есть `createStore` из `zustand/vanilla` и `useStore(store, selector)` — стор раздают через контекст.

::: tip Для тех, кто знает Angular
Стор Zustand похож на сервис с `signal`-ами на уровне `providedIn: 'root'`: одно состояние на приложение, методы рядом с данными. Разница в подписке: компонент читает не сигнал, а результат селектора, и React сравнивает его сам.
:::
