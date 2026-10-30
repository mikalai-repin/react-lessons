---
title: 'Под капотом: как устроен кэш запросов'
noSolution: true
focus: main.tsx
api: [QueryCache, Query, QueryObserver, hashKey, 'structural sharing', notifyOnChangeProps, SWR, RTK Query, axios]
url: /catalog
---

Этот шаг необязательный. За главу Query отменял запросы, делил один ответ между шапкой и каталогом, повторял ошибки и не перерисовывал лишнего. Посмотрим, как он это делает, — по исходникам `@tanstack/query-core` 5.104 и по логу.

## Из чего состоит кэш

```
QueryClient
├─ QueryCache: хэш ключа → Query
│   └─ Query  ["games","list",""]
│       ├─ state: data, error, status,
│       │         fetchStatus, dataUpdatedAt
│       ├─ observers: [шапка, каталог]
│       ├─ retryer: запрос и повторы
│       └─ таймер gcTime
└─ MutationCache: мутации
```

- **`Query`** — одна запись кэша: данные и ошибка, статусы (`status`: `pending`/`error`/`success` — есть ли данные; `fetchStatus`: `fetching`/`paused`/`idle` — идёт ли запрос), время ответа и флаг «инвалидирован». Запрос в полёте у записи один — отсюда дедупликация.
- **`QueryObserver`** — «наблюдатель»: его создаёт каждый вызов `useQuery`. Он берёт состояние записи, применяет свои опции (`select`, `placeholderData`, `staleTime`) и выдаёт **результат** — тот объект с `isPending` и `data`, что получает компонент. Хук подписан на наблюдателя через `useSyncExternalStore` — как наш стор в главе 9.
- Запись без наблюдателей запускает **таймер `gcTime`**: никто не подписался за 5 минут — запись удаляется. Новый наблюдатель таймер отменяет.
- Где лежит запись, решает **хэш ключа** — функция `hashKey`: `JSON.stringify` ключа, где у объектов ключи **отсортированы**. Поэтому `['games', { a: 1, b: 2 }]` и `['games', { b: 2, a: 1 }]` — одна запись, а порядок элементов массива важен.

## Стенд

Добавьте в конец `main.tsx` код ниже, а в импорты — `import { gamesQuery } from './api/games';`. После шага верните прежний `main.tsx` кнопкой «Сброс».

```tsx main.tsx
// Стенд «Под капотом»: жизнь записей кэша
const cache = queryClient.getQueryCache();
cache.subscribe((event) => {
  // Пересчёты результатов наблюдателей — шумные, пропускаем
  if (
    event.type === 'observerResultsUpdated' ||
    event.type === 'observerOptionsUpdated'
  ) {
    return;
  }
  const what =
    event.type === 'updated'
      ? `updated: ${event.action.type}`
      : event.type;
  console.log(what, event.query.queryHash);
});

// Через 2 с: перезапросить список шапки и сравнить данные
setTimeout(async () => {
  const { queryKey } = gamesQuery('');
  const before = queryClient.getQueryData(queryKey);
  await queryClient.refetchQueries({ queryKey });
  const after = queryClient.getQueryData(queryKey);
  console.log('тот же объект:', before === after);
}, 2000);
```

`QueryCache` оповещает подписчиков обо всём, что происходит с записями: `added` и `removed`, `observerAdded` и `observerRemoved`, а `updated` — с действием, которое изменило состояние записи.

## Жизнь записи при запуске

Превью открыто на `/catalog`. Первые строки консоли:

```
added ["games","list",""]
added ["games","list","","infinite"]
observerAdded ["games","list",""]
updated: fetch ["games","list",""]
observerAdded ["games","list","","infinite"]
updated: fetch ["games","list","","infinite"]
updated: setState ["games","list",""]
observerRemoved ["games","list",""]
updated: setState ["games","list","","infinite"]
observerRemoved ["games","list","","infinite"]
observerAdded ["games","list",""]
updated: fetch ["games","list",""]
observerAdded ["games","list","","infinite"]
updated: fetch ["games","list","","infinite"]
updated: success ["games","list",""]
updated: success ["games","list","","infinite"]
```

1. Рендер шапки и каталога **создаёт** записи (`added`) — по одной на ключ.
2. Эффект подписки добавляет наблюдателя, и запись начинает запрос (`fetch`).
3. StrictMode снимает эффекты: наблюдатель ушёл (`observerRemoved`), запрос больше никто не ждёт — Query его отменяет и возвращает запись в прежнее состояние (`setState`). Это и есть «отменён» во вкладке «Сеть».
4. Второй цикл эффектов — снова наблюдатель и запрос, теперь до конца: `success`.

## Структурное разделение и отслеживание полей

Через две секунды стенд перезапрашивает список шапки:

```
updated: fetch ["games","list",""]
updated: fetch ["games","list","","infinite"]
updated: success ["games","list",""]
updated: success ["games","list","","infinite"]
тот же объект: true
```

Две находки.

**Перезапросились обе записи.** Фильтры Query (`refetchQueries`, `invalidateQueries`, `cancelQueries`) сравнивают **начало** ключа: `["games","list",""]` — начало и ключа порционного каталога. Нужна только одна запись — фильтр `exact: true`.

**Ответ новый, а объект — прежний.** Сервер прислал новый JSON, но `getQueryData` вернул тот же объект, что и до запроса. Это **structural sharing** (структурное разделение): новые данные сравниваются со старыми функцией `replaceEqualDeep`, и всё, что совпало по значению, берётся из **старых** данных — вплоть до целого объекта. Новыми становятся только изменившиеся ветки. Для React это значит: если данные не изменились, ссылки те же, и `memo`, зависимости эффектов и селекторы видят «ничего не случилось».

Добавьте в начало `Header` строку `console.log('render Header');` и нажмите ⟳. После `тот же объект: true` строк «render Header» **нет**: перезапрос не перерисовал шапку. Хотя пока шёл запрос, у результата менялся `isFetching`.

Причина — **отслеживание полей** (tracked properties). Наблюдатель запоминает, какие поля результата компонент **прочитал** при рендере, и оповещает его только об их изменениях. Шапка читает одно `data` — а оно, благодаря structural sharing, не изменилось.

Проверьте обе половины:

1. В `api/queryClient.ts` добавьте в `defaultOptions.queries` поле `structuralSharing: false` и нажмите ⟳. Теперь `тот же объект: false`, и следом две строки «render Header» — новый объект `data`, шапка перерисовалась (дважды — StrictMode). Уберите.
2. В `Header` замените запрос на `useQuery({ ...gamesQuery(''), notifyOnChangeProps: 'all' })` — «сообщать обо всём». Четыре строки «render Header»: две, когда `isFetching` стал `true` (ещё до ответа), и две после ответа. Верните.

## Повторы и сеть

Запрос и его повторы ведёт объект **retryer**. Пауза перед повтором по умолчанию — `min(1000 × 2^n, 30 000)` мс: 1, 2, 4, 8… секунд, но не больше 30. Если браузер сообщает, что сети нет, запрос **ставится на паузу** (`fetchStatus: 'paused'`) и продолжится, когда сеть вернётся, — так работает режим `networkMode: 'online'` по умолчанию. Тот же механизм возвращает устаревшие записи при фокусе окна (`refetchOnWindowFocus`) и после восстановления сети (`refetchOnReconnect`).

## Обзор: другие способы

- **SWR** (от Vercel) — библиотека той же идеи с более простым API: `useSWR(key, fetcher)` возвращает данные из кэша и обновляет их в фоне (stale-while-revalidate — «отдай устаревшее, пока проверяешь»). Меньше возможностей из коробки: мутации, бесконечные списки и Suspense есть, но проще. Хороший выбор для небольших приложений.
- **RTK Query** — часть Redux Toolkit: запросы описываются как «эндпоинты» одного API (`createApi`), кэш живёт в Redux-сторе, а инвалидация — через **теги** вместо ключей. Логично там, где уже есть Redux. Подробно — в главе 19.
- **`loader` роутера без кэша** — как в главе 10: просто, но каждый переход заново спрашивает сервер.
- **axios против `fetch`.** axios — HTTP-клиент, а не кэш: его используют **внутри** `queryFn` вместо `fetch`. Он сам разбирает JSON, бросает ошибку на ответы 4xx и 5xx и умеет **перехватчики** (interceptors) — общий код до запроса и после ответа: подставить токен, обновить его при 401. `fetch` встроен в браузер, отменяется стандартным `AbortSignal`, а всё остальное пишется своим клиентом — как наш `apiGet`. Перехват 401 своими силами — в главе 14.

Все эти инструменты решают одну задачу: серверные данные — это кэш, и у кэша должны быть ключи, свежесть, дедупликация и инвалидация. Писать это руками в каждом компоненте — путь к шагу «fetch в эффекте».
