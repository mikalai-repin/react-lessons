---
title: Query и роутер
focus: game/GamePage.tsx
api: ['queryClient.query', "staleTime: 'static'", useSuspenseQuery, useQueryErrorResetBoundary, noop]
url: /games/1
backend: { latency: 300, fail: ['/api/games/2/reviews'] }
---

В магазине теперь два способа загружать данные. Каталог и шапка — через кэш Query. Страница игры — через `loader`, у которого кэша нет: откройте игру, вернитесь в каталог, откройте снова — во «Сети» снова два запроса, и снова скелет на месте отзывов. А «Повторить» в отзывах перезапускает весь загрузчик.

Соединим их. У каждого своя сильная сторона: `loader` начинает загрузку **в момент щелчка**, ещё до рендера страницы, а Query **хранит** ответы. Схема такая: загрузчик кладёт данные в кэш, страница читает их из кэша.

## Ключи игры и отзывов

Сначала — два новых запроса в `api/games.ts`. Ключи продолжают иерархию: отзывы — «внутри» игры:

```tsx api/games.ts
  detail: (id: string) =>
    [...gameKeys.all, 'detail', id] as const,
  reviews: (id: string) =>
    [...gameKeys.detail(id), 'reviews'] as const,
```

```tsx api/games.ts
/** Запрос одной игры */
export function gameQuery(id: string) {
  return queryOptions({
    queryKey: gameKeys.detail(id),
    queryFn: ({ signal }) => fetchGame(id, signal),
  });
}
```

`reviewsQuery(id)` — такой же, с `gameKeys.reviews(id)` и `fetchReviews`.

## Загрузчик наполняет кэш

Вне React с кэшем работают через сам `queryClient` — тот, что мы вынесли в свой модуль. Метод **`queryClient.query(options)`** возвращает промис с данными: если в кэше есть свежий ответ — сразу его, иначе — запрашивает и кладёт в кэш.

```tsx game/GamePage.tsx
// Загрузчик кладёт данные в кэш Query, а страница читает их оттуда.
// Нет игры или сервер упал — query бросит ApiError,
// и её покажет ближайший ErrorBoundary маршрута
export function gameLoader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  // Отзывы — запрос уходит сейчас, но переход его не ждёт
  queryClient.query(reviewsQuery(id)).catch(noop);
  // Игру переход ждёт. 'static': есть в кэше — отдать сразу,
  // даже устаревшую; обновит её useSuspenseQuery страницы
  return queryClient.query({
    ...gameQuery(id),
    staleTime: 'static',
  });
}
```

- **Игра.** Загрузчик возвращает промис `query` — роутер ждёт его, как раньше. `staleTime: 'static'` — только для этой проверки: «если игра есть в кэше, даже устаревшая, не ждать сервер». Переход на уже открытую игру мгновенный, а обновит её компонент страницы.
- **Отзывы.** Запрос запускаем, но не возвращаем — переход его не ждёт. Ошибку глотаем: `noop` (пустая функция из Query) в `catch`. Показать ошибку — забота страницы, а здесь важно только, чтобы запрос **начался** одновременно с запросом игры.
- **Возвращаем игру** — крошка в `routes.tsx` снова получает `Game`: `(game: Game | undefined) => game?.title ?? 'Игра не найдена'`.

::: warning ensureQueryData и prefetchQuery
В главе 10 и во многих статьях для этого используют `queryClient.ensureQueryData` (взять из кэша или загрузить) и `queryClient.prefetchQuery` (загрузить заранее, не бросая ошибок). В версии 5.104 оба помечены устаревшими вместе с `fetchQuery`: их заменил один метод `query`. Старое поведение — `query({ …, staleTime: 'static' })` вместо `ensureQueryData` и `query(…).catch(noop)` вместо `prefetchQuery`.
:::

## useSuspenseQuery

Страница читает кэш хуком **[`useSuspenseQuery`](https://tanstack.com/query/latest/docs/framework/react/reference/useSuspenseQuery)** — это `useQuery` для Suspense:

```tsx game/GamePage.tsx
  const id = useParams().id!;
  // Данные гарантированы: loader уже положил игру в кэш
  const { data: game } = useSuspenseQuery(gameQuery(id));
```

- Данных нет — компонент **приостанавливается**, как с `use(promise)`, и ближайший `<Suspense>` показывает заглушку.
- Ошибка без данных — хук **бросает** её ближайшей границе ошибок.
- Поэтому `data` всегда определено: ни `isPending`, ни проверок `undefined`.

Для игры приостановки не будет: загрузчик дождался её, к рендеру она уже в кэше. А вот `Reviews` теперь берёт отзывы тем же хуком — по `gameId`, без промиса в пропсах:

```tsx game/Reviews.tsx
export function Reviews({ gameId }: ReviewsProps) {
  const { data: list } = useSuspenseQuery(reviewsQuery(gameId));
```

Запрос отзывов, начатый загрузчиком, ещё в пути — `Reviews` приостановится и подождёт **его же**: ключ тот же, второго запроса не будет. Промис в рендере здесь не создаётся: кэш Query и есть то «место вне рендера», которого требует Suspense.

## Повтор только отзывов

Отзывы упали — Query хранит в записи ошибку. Если граница просто сбросится, `useSuspenseQuery` увидит ту же ошибку в кэше и бросит её снова. Нужно сказать Query: «эти ошибки можно пробовать заново». Для этого есть `useQueryErrorResetBoundary`:

```tsx game/GamePage.tsx
        <ErrorBoundary
          resetKeys={[id]}
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <p className="muted">
              Не удалось загрузить отзывы.{' '}
              <Button onClick={resetErrorBoundary}>
                Повторить
              </Button>
            </p>
          )}
        >
```

«Повторить» вызывает `resetErrorBoundary` библиотеки границ, а та — `onReset`, то есть `reset` из Query. Граница рисует `Reviews` заново, и хук **запрашивает отзывы снова** — только их. `resetKeys={[id]}` — сброс при переходе на другую игру: промиса в пропсах больше нет, ключом стал `id`.

::: task
1. В `api/games.ts` добавьте в `gameKeys` ключи `detail` и `reviews` и функции `gameQuery(id)` и `reviewsQuery(id)`.
2. Перепишите `gameLoader`: запустите `queryClient.query(reviewsQuery(id))` с `.catch(noop)` и верните `queryClient.query({ ...gameQuery(id), staleTime: 'static' })`.
3. В `GamePage` возьмите `id` из `useParams()`, игру — из `useSuspenseQuery(gameQuery(id))`. `Reviews` получает `gameId={id}`.
4. В `Reviews` замените `use(reviews)` на `useSuspenseQuery(reviewsQuery(gameId))`.
5. Границе отзывов дайте `resetKeys={[id]}`, `onReset={reset}` из `useQueryErrorResetBoundary()` и кнопку «Повторить» с `resetErrorBoundary` вместо `revalidator`.
6. В `routes.tsx` крошка игры снова получает `Game`.
:::

## Что получилось

Откройте игру — во «Сети» запросы игры и отзывов начались одновременно. Перейдите в каталог (ссылка «в каталоге 40 игр» в шапке) и снова на «Остров сокровищ»: страница игры с отзывами — **сразу**, и во «Сети» ни одного запроса. Данные моложе 30 секунд, загрузчик взял их из кэша.

У этого шага снова сломаны отзывы «Драконьей почты». Нажмите «Следующая игра →»: игра на месте, в блоке отзывов — «Не удалось загрузить отзывы.», и появилось это сразу, после **одной** попытки. У `queryClient.query` повторов нет: по умолчанию `retry: false` — снаружи компонентов некому дождаться повтора. Ошибка попала в кэш, `useSuspenseQuery` нашёл её там и передал границе.

Нажмите «Повторить» — во «Сети» только `GET /api/games/2/reviews`, игра не перезапрашивается. Теперь это повторы самого хука (`retry: 3`): скелет, четыре ответа 500 за восемь секунд — и снова сообщение. Адрес у этого шага сломан навсегда.

## Эксперименты

1. **Без `onReset`.** Уберите `onReset={reset}`, откройте «Драконью почту» и нажмите «Повторить». Во «Сети» — ничего, а сообщение об ошибке на месте: граница сбросилась, но Query не разрешил повтор, и хук сразу бросил ту же ошибку. Верните.
2. **`/games/999`.** «Такой страницы нет» — `query` бросил `ApiError` с 404, его поймала граница маршрута, как и раньше.

## Как в настоящем проекте

- «`loader` наполняет кэш, компонент читает кэш» — распространённая связка React Router и TanStack Query. Загрузка начинается раньше рендера, а кэш, обновление и повторы остаются у Query.
- Без роутера с загрузчиками `useSuspenseQuery` работает и сам: компонент приостановится и запросит данные при первом рендере. Но тогда запросы вложенных компонентов выстраиваются водопадом — запускать их заранее всё равно приходится (`usePrefetchQuery`, предзагрузка по наведению).
- Если в одном компоненте нужны несколько запросов с Suspense — `useSuspenseQueries`: два `useSuspenseQuery` подряд тоже дадут водопад (второй начнётся после первого).
