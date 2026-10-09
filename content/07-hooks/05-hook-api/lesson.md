---
title: API хука
startFrom: custom
focus: hooks/useInView.ts
api: [useInView, useCallback, кортеж или объект, стабильность функций]
---

Свой хук — это API, которым пользуются другие компоненты, а иногда и другие разработчики. Как у любого API, у него есть контракт: что он принимает, что возвращает и на что можно положиться. Особенно важна одна вещь, которой нет в обычных функциях: **стабильность** — останется ли функция той же между рендерами.

В этом шаге вынесем наблюдение за прокруткой из `LoadMore` в хук `useInView` и посмотрим на функции, которые входят в хук и выходят из него. Заготовка — `hooks/useInView.ts`.

## Что вернуть

У хуков магазина уже четыре разных формы ответа:

| Хук | Возвращает | Почему так |
|---|---|---|
| `useOnlineStatus()` | значение | одно значение — его и возвращаем |
| `useDebouncedValue(v, ms)` | значение | менять снаружи незачем |
| `useLocalStorage(key, init)` | пару `[значение, set]` | как `useState`: имена даёт тот, кто вызывает |
| `useInView(ref, onEnter)` | ничего | хук только синхронизирует, как `useEffect` |

Пара удобна, когда хук вызывают несколько раз в одном компоненте: `const [draft, setDraft] = …; const [filters, setFilters] = …`. Но больше двух-трёх элементов в кортеже не помнит никто: `const [a, , c] = useX()` нечитаемо. Тогда возвращают **объект** с понятными именами — `const { remaining, finished } = useCountdown(…)` в практикуме этой главы. Из объекта берут только нужное, порядок не важен.

## Функция на входе

В `LoadMore` (практикум главы 6) наблюдение за полосой — эффект с `IntersectionObserver`, а свежий `onLoad` читается через `useEffectEvent`. Это и есть хук:

```tsx hooks/useInView.ts
import { useEffect, useEffectEvent } from 'react';
import type { RefObject } from 'react';

// Вызывает onEnter, когда элемент из ref появился на экране.
// onEnter может быть новой функцией при каждом рендере —
// наблюдение от этого не перезапускается
export function useInView(
  ref: RefObject<Element | null>,
  onEnter: () => void,
) {
  const onVisible = useEffectEvent(onEnter);

  // Синхронизация с IntersectionObserver: следим, виден ли элемент
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onVisible();
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, [ref]);
}
```

- **`ref: RefObject<Element | null>`** — тип объекта, который возвращает `useRef<HTMLDivElement>(null)`. `Element` — любой элемент, хук подходит не только для `<div>`.
- **`ref` в зависимостях.** Объект ссылки не меняется между рендерами, но хук этого не знает: ссылку ему передали снаружи. Линтер потребует её в массиве — и прав: если однажды передадут другую ссылку, наблюдение должно перезапуститься.
- **`onEnter` — через `useEffectEvent`.** Это главное решение API. `App` передаёт `onLoad` стрелочной функцией — новой при каждом рендере. Хук не требует от вызывающего стабильной функции: принимает любую и сам заботится, чтобы наблюдатель не пересоздавался. Хороший хук прячет такие тонкости внутри.

`LoadMore` теперь только рисует:

```tsx catalog/LoadMore.tsx {1-2,6}
import { useRef } from 'react';
import { useInView } from '../hooks/useInView';
…
export function LoadMore({ onLoad }: LoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref, onLoad);

  return (
    <div ref={ref} className={styles.loadMore}>
      <Button onClick={onLoad}>Показать ещё</Button>
    </div>
  );
}
```

## Функция на выходе

Теперь обратная сторона. `useLocalStorage` возвращает `setStoredValue` — функцию, объявленную в теле хука. Тело хука выполняется при каждом рендере компонента, значит, и функция **каждый раз новая**. А `setReview` от `useState` была бы той же самой: React гарантирует, что сеттер состояния не меняется.

Пока функцию только вызывают в обработчиках, разницы нет. Разница появляется, когда функция попадает в **зависимости** — эффекта, другого хука. Представим, что странице игры нужен эффект, который вызывает `setReview`: например, через десять минут считает черновик забытым и очищает его. Линтер потребует:

```
React Hook useEffect has a missing dependency: 'setReview'.
Either include it or remove the dependency array
```

А про `setSent` от `useState` не скажет ничего: о сеттерах `useState` линтер знает, что они стабильны. О функциях вашего хука — не знает и знать не может. С `[setReview]` в массиве такой эффект перезапускался бы при каждом рендере страницы — на каждую букву отзыва (проверим в эксперименте).

Чтобы функция была той же между рендерами, есть [`useCallback`](https://react.dev/reference/react/useCallback):

```tsx
const fn = useCallback(функция, [зависимости]);
```

При первом рендере React запоминает функцию, а при следующих возвращает **запомненную**, пока зависимости те же (`Object.is`, как у эффекта). Сменились зависимости — запоминает новую. Это **мемоизация** (memoization); подробно о ней, о `useMemo` и о том, почему React Compiler делает её за вас, — в главе 16. Здесь `useCallback` нужен по конкретной причине: функция выходит из хука, и вы не знаете, куда её положат.

```tsx hooks/useLocalStorage.ts {1,17-24}
import { useCallback, useState } from 'react';

// Состояние, которое переживает перезапуск: значение хранится
// в localStorage браузера под ключом key
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
) {
  // Начальное значение — из хранилища, если там что-то есть
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    return saved === null
      ? initialValue
      : (JSON.parse(saved) as T);
  });

  // Новое значение — и в состояние, и в хранилище.
  // useCallback: та же функция, пока не сменился key
  const setStoredValue = useCallback(
    (next: T) => {
      setValue(next);
      localStorage.setItem(key, JSON.stringify(next));
    },
    [key],
  );

  return [value, setStoredValue] as const;
}
```

Зависимости — по тому же правилу, что у эффекта: всё, что функция читает из хука. `setValue` стабилен, а `key` может смениться — тогда нужна новая функция, которая пишет под новым ключом.

::: task
1. В `hooks/useInView.ts` напишите хук `useInView(ref, onEnter)`: наблюдатель из `LoadMore`, `onEnter` — через `useEffectEvent`, в зависимостях эффекта — `ref`.
2. В `LoadMore` замените эффект и `useEffectEvent` вызовом `useInView(ref, onLoad)`.
3. В `useLocalStorage` оберните функцию записи в `useCallback` с зависимостью `[key]`.
:::

## Что получилось

Магазин работает как раньше: при запуске три игры, прокрутка до конца подгружает ещё три. Компоненты стали проще, а вся работа с наблюдателем — в одном месте, которое можно проверить один раз.

## Эксперименты

1. **Наблюдатель не пересоздаётся.** Добавьте в эффект `useInView` логи `наблюдение: старт` (перед `observe`) и `наблюдение: стоп` (в очистке). При запуске — `старт`, `стоп`, `старт`. Нажмите «В корзину» у любой игры: `App` отрендерился, `onLoad` новая — новых строк нет. Прокрутите до конца — `наблюдение: стоп`: все игры показаны, `LoadMore` ушёл.

2. **Без `useEffectEvent`.** Вызывайте в колбэке наблюдателя прямо `onEnter()` и поставьте зависимости `[ref, onEnter]` (так потребует линтер). «В корзину» — `наблюдение: стоп`, `наблюдение: старт`: каждый рендер `App` пересоздаёт наблюдатель. Линтер на `[ref]` без `onEnter` подсказал бы и другой выход: «If 'onEnter' changes too often, find the parent component that defines it and wrap that definition in useCallback». Это рабочий путь, но он перекладывает заботу на каждого, кто вызывает хук; `useEffectEvent` внутри хука решает её один раз. Верните `useEffectEvent` и уберите логи.

3. **Стабильная функция на выходе.** Добавьте в `GameDetails` после `useLocalStorage` эффект-датчик (и `useEffect` уже в импорте):

   ```tsx game/GameDetails.tsx
   useEffect(() => {
     console.log('эффект: новая setReview');
   }, [setReview]);
   ```

   Откройте «Остров» — две строки (строгий режим). Напечатайте в отзыве «Да», нажмите «В корзину» — новых строк нет: с `useCallback` функция та же. Теперь уберите `useCallback`, вернув обычную `function setStoredValue`. Каждая буква отзыва и каждое «В корзину» — новая строка: функция новая, эффект перезапускается. Верните `useCallback` и уберите датчик.

## Функция, которую хук отдаёт React

Та же история бывает внутри хука. Вспомните `useMediaQuery` из прошлого шага: в `useSyncExternalStore` нужна `subscribe`, а она зависит от запроса и не может жить на уровне модуля. Если объявить её в теле хука, она новая при каждом рендере — и React **переподписывается** при каждом рендере компонента (проверено логом в `subscribe`: каждое «В корзину» — новая подписка). Решение то же:

```tsx hooks/useMediaQuery.ts
import { useCallback, useSyncExternalStore } from 'react';

// Подходит ли окно под медиазапрос, например '(max-width: 480px)'
export function useMediaQuery(query: string) {
  // Та же функция подписки, пока не сменился запрос
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const list = matchMedia(query);
      list.addEventListener('change', onStoreChange);
      return () =>
        list.removeEventListener('change', onStoreChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => matchMedia(query).matches,
  );
}
```

`getSnapshot` можно оставить новой: React вызывает её, чтобы прочитать значение, и сравнивает результат (`true`/`false`). Переподписки от новой `getSnapshot` нет — в том же эксперименте с `useCallback` для `subscribe` лог молчит.

## Как в настоящем проекте

- Правило для хуков-«библиотек»: **функции, которые хук возвращает, — стабильны** (`useCallback` или сеттеры состояния), а **функции, которые хук принимает, могут быть любыми** — хук сам читает свежую через `useEffectEvent` или кладёт в зависимости осознанно.
- Объекты, которые хук возвращает, тоже новые при каждом рендере. Обычно это не мешает: деструктуризация `const { remaining } = …` берёт значения, а не объект. Класть сам объект в зависимости эффекта не стоит.
- С React Compiler (глава 16) `useCallback` пишут редко: компилятор запоминает функции сам. Но понимать, **когда** функция новая, нужно всё равно — без этого не объяснить, почему эффект перезапускается.
