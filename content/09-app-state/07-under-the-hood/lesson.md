---
title: 'Под капотом: как устроен стор'
noSolution: true
focus: main.tsx
api: [zustand/vanilla, useSyncExternalStore, снимок, разрыв, синхронная полоса]
---

Этот шаг необязательный. Мы пользуемся `create` из Zustand, но обещали в шаге «Zustand», что внутри — то же, что в нашем самодельном сторе. Прочитаем исходник целиком (он короче этого урока), а потом заглянем в `useSyncExternalStore` и увидим, от какой ошибки он защищает.

## Стор без React

Ядро Zustand — `zustand/vanilla` (файл `node_modules/zustand/esm/vanilla.mjs`, полностью; переносы строк наши, `/* @__PURE__ */` убран):

```js
const createStoreImpl = (createState) => {
  let state;
  const listeners = new Set();
  const setState = (partial, replace) => {
    const nextState =
      typeof partial === 'function' ? partial(state) : partial;
    if (!Object.is(nextState, state)) {
      const previousState = state;
      state = (
        replace != null
          ? replace
          : typeof nextState !== 'object' || nextState === null
      )
        ? nextState
        : Object.assign({}, state, nextState);
      listeners.forEach((listener) => listener(state, previousState));
    }
  };
  const getState = () => state;
  const getInitialState = () => initialState;
  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const api = { setState, getState, getInitialState, subscribe };
  const initialState = (state = createState(setState, getState, api));
  return api;
};
```

Узнаёте? Переменная `state`, набор `listeners`, `subscribe` с отпиской, `setState` со слиянием `Object.assign({}, state, nextState)` — наш `{ ...state, ...next }`. Отличий три: функция в `set`, проверка `Object.is` и `replace`. Функция, которую мы передаём в `create`, вызывается **один раз** — последней строкой — и получает `set`, `get` и сам `api`. Это те самые `(...api)`, которые мы раздавали срезам.

## Хук

React-часть — `zustand/react` (`esm/react.mjs`):

```js
const identity = (arg) => arg;
function useStore(api, selector = identity) {
  const slice = React.useSyncExternalStore(
    api.subscribe,
    React.useCallback(() => selector(api.getState()), [api, selector]),
    React.useCallback(() => selector(api.getInitialState()), [api, selector]),
  );
  React.useDebugValue(slice);
  return slice;
}
const createImpl = (createState) => {
  const api = createStore(createState);
  const useBoundStore = (selector) => useStore(api, selector);
  Object.assign(useBoundStore, api);
  return useBoundStore;
};
```

- `useSyncExternalStore(subscribe, getSnapshot)` — снимок — результат селектора, как у нас. Без селектора — `identity`, весь `state`: вот почему `useCartStore()` рендерится от всего (шаг «Zustand»).
- Третий аргумент — `getServerSnapshot` для серверного рендеринга: снимок **начального** состояния.
- `Object.assign(useBoundStore, api)` — хук получает методы стора. Поэтому работают `useCartStore.getState()` и `useCartStore.subscribe`.

Проверьте последнее: замените `main.tsx` демонстрацией ниже (после шага верните прежний — кнопкой «Сброс» или по памяти) и посмотрите первую строку консоли:

```
["setState", "getState", "getInitialState", "subscribe", "persist"]
```

`persist` добавил стору свой объект (`rehydrate`, `clearStorage`, `hasHydrated`…). `devtools` в превью ничего не добавил — расширения нет, и он вернул стор как есть.

## Зачем useSyncExternalStore

Долго сторы подключали так: копия значения в `useState` и подписка в `useEffect`. Сравним два способа рядом:

```tsx main.tsx
import { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { selectCartCount } from './store/cartSelectors';
import { useCartStore } from './store/cartStore';

console.log(Object.keys(useCartStore));

// Подписка «по-старому»: копия в состоянии + подписка в эффекте
function useNaiveCount() {
  const [count, setCount] = useState(() =>
    selectCartCount(useCartStore.getState()),
  );
  useEffect(
    () =>
      useCartStore.subscribe((state) =>
        setCount(selectCartCount(state)),
      ),
    [],
  );
  return count;
}

function Naive() {
  return <p>Эффект: {useNaiveCount()}</p>;
}

function Synced() {
  const count = useCartStore(selectCartCount);
  return <p>useSyncExternalStore: {count}</p>;
}

// Меняет стор сразу после фиксации — раньше эффектов подписки
function Bump() {
  useLayoutEffect(() => {
    useCartStore.getState().add(1);
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <>
    <Naive />
    <Synced />
    <Bump />
  </>,
);
```

`StrictMode` здесь нет намеренно: с ним эффекты выполняются дважды, и счёт сложнее читать. Перед запуском очистите корзину (удалите ключ `cart` в Application) — на экране:

```
Эффект: 0
useSyncExternalStore: 1
```

Что произошло:

1. Рендер: оба компонента прочитали `0`. Фиксация.
2. Layout-эффект `Bump` (они выполняются раньше обычных, глава 6) положил «Остров» в корзину. Подписчиков у стора ещё нет — `useEffect` не выполнялся.
3. Эффекты: `Naive` подписался — но изменение уже было, и сообщить о нём некому. В его состоянии навсегда `0`, пока корзина не изменится снова.
4. `useSyncExternalStore` после фиксации **сверяет снимок ещё раз**: вызывает селектор, видит `1` вместо `0` и рендерит `Synced` заново.

Пропущенное изменение — первая проблема наивной подписки. Вторая серьёзнее.

## Разрыв

В главе 12 React научится **прерывать рендер**: начал рисовать длинный список, отдал браузеру кадр на щелчок, продолжил. Если стор изменился в паузе, первая половина списка нарисована со старым значением, вторая — с новым. На экране одновременно два разных состояния — **разрыв** (tearing). Копия в `useState` от этого не защищает: каждый компонент читает своё.

`useSyncExternalStore` защищается так (`mountSyncExternalStore` в `react-dom-client.development.js`):

- в прерываемом рендере React запоминает, какой снимок прочитал каждый компонент, и **перед фиксацией** проверяет их снова. Если стор успел измениться — выбрасывает рендер и рисует заново, синхронно, без пауз;
- обновление от стора всегда идёт на **синхронной полосе** (lane 2): его нельзя отложить, как переход (`startTransition`, глава 12).

Плата за это: изменения внешнего стора не бывают «фоновыми». Для данных, которые можно показать с опозданием (результаты поиска), в главе 12 будут `useDeferredValue` и переходы — с состоянием React, а не со стором.

::: deep Почему снимок нужно кешировать
В режиме разработки React при каждом рендере вызывает `getSnapshot` **дважды** и сравнивает результаты через `Object.is`. Разные — значит, функция возвращает новый объект на каждый вызов, и React печатает `The result of getSnapshot should be cached to avoid an infinite loop`. А цикл возникает, потому что после фиксации проверка из пункта 4 тоже видит «новый» снимок — и рендерит снова, и снова. Отсюда правило селектора из шагов «Свой стор» и «Производное состояние».
:::

## А Jotai?

У Jotai свой стор (`jotai/vanilla`): `WeakMap` от атома к его состоянию — значению, зависимостям и подписчикам. А вот к React он подключён иначе. Откройте `node_modules/jotai/dist/react/useAtomValueRaw.js`: там нет `useSyncExternalStore` — значение лежит в `useReducer`, подписка — в `useEffect`. Почти наш «наивный» вариант, с одной поправкой: сразу после подписки Jotai сам сравнивает значение атома с тем, что нарисовано, и, если оно изменилось, рендерит заново. Повторите опыт на атоме:

```tsx main.tsx
import { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { atom, useAtomValue, useSetAtom } from 'jotai';

const countAtom = atom(0);

function Value() {
  return <p>Jotai: {useAtomValue(countAtom)}</p>;
}

function Bump() {
  const setCount = useSetAtom(countAtom);
  useLayoutEffect(() => {
    setCount(1);
  }, [setCount]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <>
    <Value />
    <Bump />
  </>,
);
```

На экране `Jotai: 1`: изменение не потеряно.

Зачем так сложно? Ради глав 11 и 12: обновление через `useReducer` может идти и на несрочной полосе — внутри перехода, с `Suspense` и асинхронными атомами. Цена — защиты от разрыва нет. Для тех, кому она важнее, в Jotai 3 есть хук на `useSyncExternalStore` — `useAtomValueRawSync`. Это хороший пример компромисса: у каждой библиотеки состояния он свой, и выбирают его сознательно.

Верните `main.tsx` (с `StrictMode`, `ThemeProvider` и `FavoritesProvider`) и уберите из корзины «Остров», если он не нужен.
