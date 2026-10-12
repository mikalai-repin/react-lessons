---
title: Проброс props
startFrom: custom
base: 07-hooks/08-practice
baseHash: '89cd3e39634a'
focus: catalog/GameGrid.tsx
api: [проброс props, prop drilling, композиция через children]
---

Корзина магазина живёт в `App` с главы 4: позиции в `useImmerReducer`, рядом — обработчики «добавить», «убрать одну», «удалить», «очистить». Остальные компоненты получают корзину через props. В конце прошлой главы мы пообещали разобраться, во что это обходится. Сначала посмотрим, куда корзина уходит сейчас:

```
App — корзина и четыре обработчика
├─ Header        cartCount
├─ MiniCart      items, onIncrease, onDecrease,
│                onRemove, onClear
├─ GameDetails   quantity, onAdd
└─ Section «Хиты», Section «Все игры»
   └─ GameCard   quantity, onAdd
```

Пока каждый, кому нужна корзина, — прямой «ребёнок» в разметке `App`. Но в `App` два одинаковых куска: сетка карточек «Хитов» и сетка «Всех игр» — `games.map` с пятью props у `GameCard`. Вынесем сетку в компонент — и посмотрим, что станет с корзиной.

## Сетка карточек

В проекте есть заготовка `catalog/GameGrid.tsx`. Сетка получает список игр и рисует карточки:

```tsx catalog/GameGrid.tsx
import type { Game } from '../api/models';
import { GameCard } from '../shared/GameCard';

type GameGridProps = {
  games: Game[];
  // Корзина: самой сетке не нужна — передаём карточкам
  quantityOf: (gameId: number) => number;
  onAdd: (gameId: number) => void;
  // Покупатель открыл страницу игры
  onSelect: (gameId: number) => void;
};

// Сетка карточек игр: одна разметка для «Хитов» и «Всех игр»
export function GameGrid({
  games,
  quantityOf,
  onAdd,
  onSelect,
}: GameGridProps) {
  return (
    <div className="grid">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          quantity={quantityOf(game.id)}
          onAdd={() => onAdd(game.id)}
          onSelect={() => onSelect(game.id)}
        />
      ))}
    </div>
  );
}
```

В `App` оба блока `<div className="grid">…</div>` превращаются в одну строку с props:

```tsx App.tsx {5-10}
            <Section
              title="Хиты"
              extra={<Badge tone="dark">{hits.length}</Badge>}
            >
              <GameGrid
                games={hits}
                quantityOf={quantityOf}
                onAdd={handleAdd}
                onSelect={setSelectedId}
              />
            </Section>
```

`onSelect={setSelectedId}` — функция записи состояния подходит как есть: она принимает id игры. Импорт `GameCard` из `App` уходит, приходит `import { GameGrid } from './catalog/GameGrid';`.

::: task
1. В `catalog/GameGrid.tsx` напишите компонент `GameGrid({ games, quantityOf, onAdd, onSelect })`: сетка `<div className="grid">` с карточкой `GameCard` для каждой игры.
2. В `App` замените обе сетки — «Хитов» и «Всех игр» (`shownGames`) — на `<GameGrid>`.
:::

## Что получилось

Магазин выглядит и работает как раньше: «В корзину» добавляет игру, «В корзине: 1 шт.» появляется на обеих карточках «Острова сокровищ», название открывает страницу игры. Кода в `App` стало меньше на десяток строк.

Но посмотрите на props `GameGrid`. Из четырёх ей самой нужен один — `games`, чтобы нарисовать сетку. `quantityOf`, `onAdd` и `onSelect` сетка не использует — она **передаёт** их дальше, карточкам:

```
App            quantityOf, onAdd
└─ GameGrid    quantityOf, onAdd   ← только передаёт
   └─ GameCard quantity, onAdd     ← использует
```

Это называется **проброс props** (prop drilling): данные идут через компоненты, которым они не нужны, только потому, что те стоят на пути. На одном уровне это терпимо. Но сетка теперь знает про корзину: тип её props описывает `quantityOf` и `onAdd`, и любое изменение корзины — новая функция, другое имя, другой тип — потянет правку и в `App`, и в `GameGrid`, и в `GameCard`. А появится между сеткой и карточкой ещё один слой (скажем, «полка» с прокруткой) — он тоже начнёт пробрасывать корзину.

## Эксперименты

1. **Забыли передать.** В `GameGrid` удалите строку `onAdd={() => onAdd(game.id)}`. Редактор подчеркнёт два места:

   ```
   TS2741: Property 'onAdd' is missing in type '{ key: number; game: Game; quantity: number; onSelect: () => void; }' but required in type 'GameCardProps'.
   TS6133: 'onAdd' is declared but its value is never read.
   ```

   TypeScript держит цепочку целой: проп нельзя ни забыть передать, ни принять и забыть. Плата за это — каждое звено цепочки знает тип всего, что через него идёт. Верните строку.

2. **Где проброса нет.** Между `App` и `GameGrid` стоит ещё один компонент — `Section`. Но корзину он не получает и про неё не знает. Посмотрите, как `App` его использует: сетку с её props `App` создаёт **сам** и отдаёт разделу готовым элементом в `children` (глава 3). `Section` только ставит `children` под заголовок.

   Это первый способ избавиться от проброса — **композиция**: если промежуточный компонент лишь оборачивает содержимое, пусть принимает готовые элементы через `children` (или другой проп с JSX, как `extra`), а не данные для них. Сетке это не подходит: карточки она создаёт сама, по одной на игру, — данные для каждой ей нужны.

## Как в настоящем проекте

- Проброс на один-два уровня — нормальная практика: поток данных виден в коде, TypeScript проверяет каждое звено. Бороться стоит не с пробросом вообще, а с длинными цепочками через компоненты, которым данные не нужны.
- Сначала попробуйте композицию: часто промежуточные компоненты — это раскладка (`Section`, `Card`, `Layout`), и им хватает `children`.
- Когда одни и те же данные нужны многим компонентам на разной глубине — корзина в шапке, на карточках, на странице игры, в мини-корзине, — нужен способ доставить их без цепочки. В React это **контекст** — следующий шаг.

::: tip
Если вы пришли из Angular: там эту задачу решает внедрение зависимостей — сервис корзины можно `inject()` в любом компоненте, и промежуточные компоненты о нём не знают. Контекст React похож на иерархический инжектор: значение задаёт компонент выше по дереву, а читает любой компонент ниже.
:::
