---
title: Бесконечный список
focus: catalog/CatalogPage.tsx
api: [useInfiniteQuery, infiniteQueryOptions, initialPageParam, getNextPageParam, fetchNextPage, hasNextPage, isFetchingNextPage]
url: /catalog
---

В шаге «fetch в эффекте» каталог потерял «Показать ещё»: сервер отдаёт первую страницу, 12 игр из 40, и остальные не увидеть. Вернём догрузку — но теперь порциями **с сервера**: параметры `page` и `size` у `GET /api/games` для этого и есть.

Можно было бы хранить номер страницы в состоянии и склеивать ответы руками. Но у Query для этого есть отдельный хук — [`useInfiniteQuery`](https://tanstack.com/query/latest/docs/framework/react/reference/useInfiniteQuery). Одна запись кэша хранит **все загруженные страницы** вместе.

## infiniteQueryOptions

```tsx api/games.ts
/** Каталог порциями: страница за страницей по page и size */
export function gamesInfiniteQuery(params: string) {
  return infiniteQueryOptions({
    queryKey: gameKeys.infinite(params),
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams(params);
      query.set('page', String(pageParam));
      query.set('size', String(PORTION));
      return fetchGames(query.toString(), signal);
    },
    // Первая порция — страница 1
    initialPageParam: 1,
    // Номер следующей страницы по последней; undefined — всё загружено
    getNextPageParam: (last) =>
      last.page * last.size < last.total
        ? last.page + 1
        : undefined,
  });
}
```

- **`pageParam`** — «какую страницу загрузить». Query передаёт его в `queryFn` вместе с `signal`.
- **`initialPageParam`** — с чего начать: страница 1.
- **`getNextPageParam`** получает последнюю загруженную страницу и возвращает параметр следующей — или `undefined`, если дальше ничего нет. Наш сервер возвращает `page`, `size` и `total` — по ним и считаем.
- `PORTION` — 6 игр за раз (константа в начале файла).

Данные такой записи — не `Page<Game>`, а объект `{ pages, pageParams }`: массив загруженных страниц и их номера. Форма другая — значит, и **ключ другой**:

```tsx api/games.ts
  // Порции — другая форма данных, значит, и ключ другой
  infinite: (params: string) =>
    [...gameKeys.list(params), 'infinite'] as const,
```

Ключ начинается с ключа обычного списка: «все списки игр» (`gameKeys.lists()`) накрывают и порционные.

## useInfiniteQuery

```tsx catalog/CatalogPage.tsx
  // Каталог порциями. Пока новый список грузится, показываем прежний
  const catalog = useInfiniteQuery({
    ...gamesInfiniteQuery(apiParams),
    placeholderData: keepPreviousData,
  });
  // Все загруженные порции — одним списком
  const games =
    catalog.data?.pages.flatMap((page) => page.items) ?? [];
```

К знакомым полям добавились:

- `fetchNextPage()` — загрузить следующую страницу (с параметром из `getNextPageParam`);
- `hasNextPage` — есть ли она вообще;
- `isFetchingNextPage` — идёт ли загрузка следующей.

Счётчик — из первой страницы: `catalog.data.pages[0].total`. Под сеткой возвращается знакомый `LoadMore`: он вызывает `onLoad` и по кнопке, и сам, когда докрутили до конца (`useInView`).

```tsx catalog/CatalogPage.tsx
  // Следующая порция. Пока она грузится, новый вызов отменил бы её
  function handleLoadMore() {
    if (!catalog.isFetchingNextPage) catalog.fetchNextPage();
  }
```

```tsx catalog/CatalogPage.tsx
          <GameGrid games={games} />
          {catalog.hasNextPage && (
            <LoadMore onLoad={handleLoadMore} />
          )}
```

Проверка `isFetchingNextPage` важна: `fetchNextPage`, вызванный во время загрузки, по умолчанию **отменяет** идущий запрос и начинает заново. А `LoadMore` может позвать `onLoad` дважды: и кнопкой, и прокруткой.

::: task
1. В `api/games.ts` — константа `PORTION = 6`, ключ `gameKeys.infinite(params)` и функция `gamesInfiniteQuery(params)` через `infiniteQueryOptions`.
2. В `CatalogPage` замените `useQuery` на `useInfiniteQuery` (с `keepPreviousData`), соберите `games` из `pages`, счётчик — `pages[0].total`.
3. Под сеткой, пока `hasNextPage`, рисуйте `<LoadMore onLoad={handleLoadMore} />`; `handleLoadMore` не вызывает `fetchNextPage` во время `isFetchingNextPage`.
:::

## Что получилось

Каталог — 6 карточек и «Показать ещё». Во «Сети» — `GET /api/games?page=1&size=6`. Нажмите кнопку — `page=2`, карточек 12. Докрутите до конца — следующая порция пришла сама. 40 игр — это 7 порций: на седьмой кнопка исчезает (`hasNextPage` — `false`).

Загрузите несколько порций, откройте игру и вернитесь: все загруженные карточки на месте, без запросов, — вся стопка страниц живёт в одной записи кэша. Фильтры работают как раньше: новая категория — новый ключ, первая порция, прежний список бледнеет до ответа.

## Эксперименты

1. **Без защиты.** Уберите проверку: `catalog.fetchNextPage();` без `if`. Нажмите «Показать ещё» дважды подряд, быстро. Во «Сети» — `page=2` «отменён» и сразу `page=2` → 200: второй вызов отменил первый запрос и начал заново. Верните проверку.
2. **Общий ключ.** В `gamesInfiniteQuery` поставьте `queryKey: gameKeys.list(params)` — тот же ключ, что у шапки. Откройте каталог: в шапке «в каталоге undefined игр». Шапка и каталог читают одну запись, но ждут разную форму: шапка — `{ items, total }`, каталог — `{ pages }`. Ни TypeScript, ни консоль не возражают. Один ключ — одна форма данных. Верните `gameKeys.infinite(params)`.

## Как в настоящем проекте

- «Бесконечная» прокрутка и «Показать ещё» — `useInfiniteQuery`; обычная пагинация «1 2 3 …» — простой `useQuery` с номером страницы в ключе и `keepPreviousData`.
- Когда запись порционного запроса устаревает, Query перезапрашивает **все** загруженные страницы по очереди, начиная с первой, — чтобы склейка не разошлась. Если порций много, это дорого: ограничивает стопку параметр `maxPages`.
- Серверы чаще отдают не номер страницы, а **курсор** — «продолжить после такого-то элемента». `getNextPageParam` тогда возвращает курсор из ответа — хук не различает, номер это или строка.
- Тысячи карточек в DOM тормозят — список из многих порций виртуализируют (глава 16).
