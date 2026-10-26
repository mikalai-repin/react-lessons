---
title: Атомы
startFrom: custom
focus: catalog/filterAtoms.ts
api: [Jotai, atom, производный атом, useAtom, useAtomValue, useSetAtom]
---

Zustand — стор «сверху вниз»: одно состояние, из которого компоненты выбирают части селекторами. Есть и обратная модель — «снизу вверх»: много маленьких независимых значений, **атомов**, из которых собираются производные. Самая известная библиотека этой модели — [Jotai](https://jotai.org/) (яп. «состояние»). Попробуем её на фильтрах витрины.

## Атом

Сейчас фильтры — один объект `filters` в `App`, и `CatalogFilters` получает его вместе с `onChange` через props. Сделаем каждое поле атомом:

```tsx
import { atom } from 'jotai';

const queryAtom = atom('');
```

`atom('')` — не значение, а **описание** ячейки: «строка, вначале пустая». Само значение хранит **стор** Jotai — по умолчанию один на приложение, провайдер не нужен. Компонент читает и пишет атом хуком, похожим на `useState`:

```tsx
const [query, setQuery] = useAtom(queryAtom);
```

Разница с `useState` — где живёт значение. У `useState` — в файбере компонента, у атома — в сторе: любой компонент, который вызвал `useAtom(queryAtom)`, видит то же значение и рендерится, когда оно изменилось.

## Производный атом

Атом можно описать **функцией** от других атомов:

```tsx catalog/filterAtoms.ts
// Производный атом: все фильтры одним объектом.
// Зависимости Jotai находит сам — по вызовам get
export const filtersAtom = atom<Filters>((get) => ({
  query: get(queryAtom),
  category: get(categoryAtom),
  inStockOnly: get(inStockOnlyAtom),
  sort: get(sortAtom),
}));
```

Jotai запоминает, какие атомы прочитал `get`, и пересчитывает `filtersAtom`, только когда изменился один из них. Объект получается новый — но только после изменения. Сравните с ловушкой прошлого шага: селектор Zustand строит объект при каждом вызове, а производный атом хранит результат до смены зависимостей.

## Атомы с записью

Есть тонкость. Раньше `handleFiltersChange` в `App` не только менял фильтры, но и возвращал каталог к первой порции (`setLimit(PAGE_SIZE)`, глава 6). Теперь поля меняются в `CatalogFilters` напрямую — кто сбросит порцию? Сам атом. У `atom` есть второй аргумент — функция записи:

```tsx catalog/filterAtoms.ts
// Сколько найденных игр показать: растёт порциями
export const limitAtom = atom(PAGE_SIZE);

// Атом поля фильтра: читается как обычный, а запись ещё и
// возвращает каталог к первой порции — новый список с начала
function filterAtom<T>(initialValue: T) {
  const valueAtom = atom(initialValue);
  return atom(
    (get) => get(valueAtom),
    (_get, set, next: T) => {
      set(valueAtom, next);
      set(limitAtom, PAGE_SIZE);
    },
  );
}

// Каждое поле витрины — свой атом
export const queryAtom = filterAtom(INITIAL_FILTERS.query);
export const categoryAtom = filterAtom(
  INITIAL_FILTERS.category,
);
…
```

`filterAtom` прячет внутри простой атом со значением и отдаёт наружу атом, который читает его, а при записи меняет два атома. Сброс витрины — атом **только для записи**: значения у него нет (`null`), есть действие.

```tsx catalog/filterAtoms.ts
// Атом только для записи: сбросить витрину к началу
export const resetFiltersAtom = atom(null, (_get, set) => {
  set(queryAtom, INITIAL_FILTERS.query);
  set(categoryAtom, INITIAL_FILTERS.category);
  set(inStockOnlyAtom, INITIAL_FILTERS.inStockOnly);
  set(sortAtom, INITIAL_FILTERS.sort);
});
```

## Компоненты

`CatalogFilters` больше не получает фильтры — читает и пишет атомы сам. Из props остался только `ref` для фокуса:

```tsx catalog/CatalogFilters.tsx
// Панель фильтров витрины: каждое поле читает и пишет свой атом
export function CatalogFilters({ ref }: CatalogFiltersProps) {
  const [query, setQuery] = useAtom(queryAtom);
  const [category, setCategory] = useAtom(categoryAtom);
  const [sort, setSort] = useAtom(sortAtom);
  const [inStockOnly, setInStockOnly] =
    useAtom(inStockOnlyAtom);
  …
          value={query}
          onChange={(e) => setQuery(e.target.value)}
```

`App` только читает: `useAtomValue` — значение без функции записи, `useSetAtom` — функция записи без значения (и без рендеров при изменении).

```tsx App.tsx
  // Всё, что выбрано на витрине, — из атомов фильтров
  const filters = useAtomValue(filtersAtom);
  …
  const [limit, setLimit] = useAtom(limitAtom);
  const resetFilters = useSetAtom(resetFiltersAtom);

  function handleReset() {
    resetFilters();
    searchRef.current?.focus();
  }
```

::: task
1. В заготовке `catalog/filterAtoms.ts` напишите `PAGE_SIZE` и `limitAtom`, функция `filterAtom`, четыре атома полей, производный `filtersAtom`, `resetFiltersAtom`.
2. `CatalogFilters`: вместо props `filters` и `onChange` — `useAtom` для каждого поля.
3. `App`: `filters` — `useAtomValue(filtersAtom)`, `limit` — `useAtom(limitAtom)`, сброс — `useSetAtom(resetFiltersAtom)`; `handleFiltersChange` и `useState` фильтров удалите.
:::

## Что получилось

Витрина работает как раньше: поиск с паузой, категории, «Только в наличии», порядок. Прокрутите вниз — подгрузились все шесть игр; выберите «Семейные» — снова первая порция. «zzz» в поиске → «Ничего не нашлось» → «Сбросить фильтры»: все поля сброшены, фокус в поиске.

## Эксперименты

1. **Когда пересчитывается производный атом.** Превратите `filtersAtom` в функцию с телом и первой строкой `console.log('считаем filtersAtom');`, а в `App` после `useAtomValue` — `console.log('render App');`. При запуске — `считаем filtersAtom` **один раз**, хотя `render App` два (строгий режим): второй вызов компонента получил сохранённое значение. Буква в поиске — снова один пересчёт. Откройте страницу игры: `render App ×2` — и ни одного пересчёта, фильтры не менялись.
2. **Тот же атом — в другом месте.** В `Header` добавьте `const query = useAtomValue(queryAtom);` и `console.log('Header: ищем', query);`. Наберите «ост» — шапка видит то же «ост», что поле поиска. Ни props, ни провайдера: атом — общий адрес значения.

Уберите логи.

## Атомы или стор

| | Zustand | Jotai |
|---|---|---|
| Модель | одно состояние, части — селекторами | много атомов, производные — из атомов |
| Подписка | на результат селектора (`Object.is`) | на атом; производные пересчитываются по зависимостям |
| Действия | функции в сторе | атомы с записью |
| Хорошо для | корзина, пользователь, предметная область | много мелких связанных значений: фильтры, редактор, форма из десятков полей |

Обе библиотеки — от одной команды (Poimandres), обе маленькие. В проекте обычно выбирают **одну**. В нашем магазине их две только потому, что это курс: в главе 10 фильтры уедут в адрес страницы (`?category=family`) — там им самое место, ведь фильтр должен переживать перезагрузку и пересылаться ссылкой.

::: tip Для тех, кто знает Angular
Атом — это `signal`, производный атом — `computed`: зависимости находятся по чтению, пересчёт — только при их изменении. Атом с записью похож на метод сервиса, который меняет несколько сигналов разом.
:::

::: deep Где хранятся атомы
Атом — обычный объект-описание (`read`, `write`, `init`), значений в нём нет. Значения хранит стор Jotai — `WeakMap` от атома к его состоянию, с зависимостями и подписчиками. Хуки подписываются на стор, как наш стор из шага «Свой стор». `<Provider>` из `jotai` создаёт **отдельный** стор для поддерева: так у двух списков на странице могут быть свои фильтры из одних и тех же атомов, а у каждого теста — чистое состояние.
:::
