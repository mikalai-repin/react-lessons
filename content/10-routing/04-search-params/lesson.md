---
title: Состояние в URL
startFrom: custom
removedInSolution: [catalog/HomePage.module.css, catalog/filterAtoms.ts]
focus: catalog/CatalogPage.tsx
api: [useSearchParams, setSearchParams, replace, URLSearchParams]
---

Покупатель настроил витрину: «Семейные», «Сначала дешёвые» — и хочет отправить подборку другу. Скопировал адрес — а там `/`. Друг откроет главную без фильтров. Нажмёт ⟳ сам — фильтры тоже пропадут: они живут в атомах, то есть в памяти страницы.

В карте решений главы 9 мы договорились: то, что должно пережить перезагрузку и пересылаться ссылкой, — часть **адреса**. Фильтры каталога — как раз такое состояние. Переедем: каталог — на свою страницу `/catalog`, фильтры — в **параметры поиска** (search params, «query-строка»): `/catalog?category=family&sort=cheap`.

## Страница каталога

Главная становится короче: акция и «Хиты» со ссылкой «Весь каталог →». Раздел «Все игры» с фильтрами переезжает в `catalog/CatalogPage.tsx` и маршрут `catalog`. Атомы Jotai больше не нужны: `catalog/filterAtoms.ts` удаляем, а `CatalogFilters` снова получает `filters` и `onChange` через props, как в главе 5.

## useSearchParams

[`useSearchParams`](https://reactrouter.com/api/hooks/useSearchParams) — как `useState`, только значение хранится в адресе:

```tsx catalog/CatalogPage.tsx
  const [searchParams, setSearchParams] = useSearchParams();
  // Фильтры — не состояние, а вычисление из адреса
  const filters = filtersFromParams(searchParams);
```

`searchParams` — объект браузера [`URLSearchParams`](https://developer.mozilla.org/ru/docs/Web/API/URLSearchParams): `get('category')` вернёт `'family'` или `null`. Своего состояния для фильтров у страницы нет: каждый рендер **вычисляет** их из адреса (глава 5: «вычислять, а не хранить»). Адрес — единственный источник правды.

Переводить фильтры в адрес и обратно будем двумя функциями в `catalog/filters.ts`:

```tsx catalog/filters.ts
/** Фильтры из адреса: ?q=…&category=…&inStock=1&sort=….
 *  Адрес набирает пользователь — незнакомые значения не пропускаем */
export function filtersFromParams(
  params: URLSearchParams,
): Filters {
  const category = params.get('category');
  const sort = params.get('sort');
  return {
    query: params.get('q') ?? '',
    category: categories.some((c) => c.value === category)
      ? (category as CategoryFilter)
      : 'all',
    inStockOnly: params.get('inStock') === '1',
    sort: SORT_ORDERS.includes(sort as SortOrder)
      ? (sort as SortOrder)
      : 'default',
  };
}

/** Фильтры в адрес: только то, что отличается от витрины по умолчанию */
export function filtersToParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.query) params.set('q', filters.query);
  if (filters.category !== 'all') {
    params.set('category', filters.category);
  }
  if (filters.inStockOnly) params.set('inStock', '1');
  if (filters.sort !== 'default')
    params.set('sort', filters.sort);
  return params;
}
```

`SORT_ORDERS` — массив допустимых порядков рядом с функциями. В адрес пишем только то, что отличается от умолчаний: каталог без фильтров — просто `/catalog`, а не `/catalog?q=&category=all&…`.

## Запись в адрес

```tsx catalog/CatalogPage.tsx
  // Новые фильтры — новый адрес и список с первой порции.
  // Буквы поиска не копят историю: replace вместо новой записи
  function handleFiltersChange(next: Filters) {
    setSearchParams(filtersToParams(next), {
      replace: next.query !== filters.query,
    });
    setLimit(PAGE_SIZE);
  }
```

`setSearchParams` переходит на тот же путь с новой query-строкой — как `navigate`. Каждый переход — запись в истории браузера, и «назад» её отменяет. Для категории это удобно: выбрал «Семейные», передумал — «назад». А для поиска — нет: «о», «ос», «ост» дали бы три записи, и «назад» стирал бы по букве. Опция `replace: true` **заменяет** текущую запись вместо новой. Поиск — с `replace`, остальные фильтры — без.

Пауза поиска (`useDebouncedValue`) и порции «Показать ещё» (`limit`) остаются как были: в адрес — то, чем стоит делиться, а сколько игр подгружено — нет.

Две ссылки пользуются новым адресом: в шапке «в каталоге 6 игр» ведёт на `/catalog`, а в баннере акции — «Все семейные игры →» на `/catalog?category=family`.

::: task
1. В `catalog/filters.ts` напишите `filtersFromParams` и `filtersToParams` (и `SORT_ORDERS`).
2. В заготовке `catalog/CatalogPage.tsx` — раздел «Все игры»: фильтры из `useSearchParams`, `handleFiltersChange` с `replace` для поиска, сброс, «Показать ещё». Стиль `.empty` — в готовом `CatalogPage.module.css`. Маршрут `catalog` — в `routes.tsx`.
3. `CatalogFilters` — снова с props `filters` и `onChange` (как в главе 5). `filterAtoms.ts` и импорты `jotai` удалите.
4. `HomePage` — баннер и «Хиты» со ссылкой «Весь каталог →». В шапке «в каталоге N игр» — ссылка на `/catalog`, в `PromoBanner` — «Все семейные игры →» на `/catalog?category=family`.
:::

## Что получилось

«Все семейные игры →» в баннере открывает `/catalog?category=family`: три игры, в списке — «Семейные». Выберите «Сначала дешёвые» — адрес `/catalog?category=family&sort=cheap`. Нажмите ⟳ — фильтры на месте. Наберите «ост» — в адресной строке превью `/catalog?q=%D0%BE%D1%81%D1%82`: так кириллица записывается в URL, а `searchParams.get('q')` вернёт обратно «ост».

## Эксперименты

1. **История.** Выберите «Семейные», затем «Сначала дешёвые» и нажмите «назад» в превью: адрес `/catalog?category=family`, порядок снова «Как в каталоге». Фильтры следуют за адресом сами — кода для этого нет.
2. **Без `replace`.** Уберите опцию: `setSearchParams(filtersToParams(next))`. Наберите «ост» — три записи истории (`history.length` в консоли страницы превью вырос на 3), и «назад» стирает по букве. Верните `replace`.
3. **Чужой адрес.** Откройте `/catalog?category=bogus&sort=zzz` — обычный каталог: незнакомые значения превратились в умолчания. А теперь уберите проверку: `category: (category ?? 'all') as CategoryFilter`. На том же адресе — «Ничего не нашлось», а в списке категорий… «Все»: такого варианта нет, и браузер показал первый. Экран говорит одно, а фильтр делает другое. `as` заглушил TypeScript, но адрес от этого не стал правдой. Верните проверку.

## Как в настоящем проекте

- Что класть в адрес: фильтры, сортировку, номер страницы, вкладку, поисковый запрос — всё, чем делятся и что должно пережить ⟳. Что не класть: черновики, открытые подсказки, промежуточный ввод, секреты.
- Разбор адреса — в одном месте (здесь `filtersFromParams`), с проверкой каждого значения. В больших проектах — схемой (Zod, глава 13) или роутером со встроенной типизацией параметров поиска (TanStack Router, шаг «Под капотом»).
- Фильтры в адресе — заодно ключ для серверного кэша: в главе 11 тот же объект `filters` станет частью ключа запроса, и «назад» покажет прошлую выдачу мгновенно.

::: tip Для тех, кто знает Angular
Аналог — `ActivatedRoute.queryParamMap` и `router.navigate([], { queryParams, replaceUrl: true })`. Разница та же, что с параметрами пути: подписки нет, компонент перерисовывается при смене адреса.
:::
