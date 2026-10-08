---
title: Несколько слотов
startFrom: custom
focus: shared/Section.tsx
api: ['prop={<X />}', ReactNode, render-функция]
---

Магазину нужна витрина: над общим каталогом — раздел «Хиты» с лучшими играми. У каждого раздела одинаковое устройство: заголовок, рядом с ним что-нибудь маленькое (счётчик, ссылка, подсказка) и содержимое. Содержимое мы уже умеем передавать через `children`. Но мест для чужой разметки здесь три, а `children` один.

## JSX — обычное значение

Ответ уже знаком по главе 1: JSX-элемент — это объект. Его можно сохранить в переменную, вернуть из функции и **передать в любом пропе**, не только в `children`:

```tsx
<Section
  title="Хиты"
  extra={<Badge tone="dark">{hits.length}</Badge>}
>
  …карточки…
</Section>
```

`extra` получит готовый элемент бейджа, а `Section` поставит его в свою разметку, как `children`. Такие props называют **слотами**: компонент задаёт раскладку, а что лежит в каждом месте, решает тот, кто его использует.

```tsx shared/Section.tsx {4-8,19-20,22}
import type { ReactNode } from 'react';
import styles from './Section.module.css';

type SectionProps = {
  title: ReactNode;
  extra?: ReactNode;
  children: ReactNode;
};

// Раздел страницы: заголовок, дополнение рядом с ним и содержимое
export function Section({
  title,
  extra,
  children,
}: SectionProps) {
  return (
    <section className={styles.section}>
      <div className={styles.head}>
        <h2 className={styles.title}>{title}</h2>
        {extra}
      </div>
      {children}
    </section>
  );
}
```

Все три слота — `ReactNode`. В `title` можно передать и строку `"Хиты"`, и разметку. `extra` необязательный: не передали — там `undefined`, и React ничего не нарисует. Проверка `{extra && …}` не нужна.

## Правило «хит» — в одном месте

Раздел «Хиты» отбирает игры с рейтингом от 4.6 — тем же правилом, по которому карточка ставит бейдж «Хит». Чтобы правило не разъехалось, оно лежит в готовом файле `shared/gameRules.ts`: функция `isHit(game)`. Карточка теперь использует её вместо своей константы `HIT_RATING`:

```tsx shared/GameCard.tsx {3,5}
import { Badge } from './Badge';
import { formatPrice } from './format';
import { isHit } from './gameRules';
…
          {isHit(game) && <Badge tone="dark">Хит</Badge>}
```

А `App` отбирает хиты тем же `isHit` и рисует два раздела:

```tsx App.tsx {3,5-6,9,20-36}
import { games } from './data/games';
import { Header } from './layout/Header';
import { Badge } from './shared/Badge';
import { GameCard } from './shared/GameCard';
import { isHit } from './shared/gameRules';
import { Section } from './shared/Section';
…
export function App() {
  const hits = games.filter(isHit);

  return (
    <>
      <Header count={games.length} />

      <main className={styles.page}>
        <p
          className={styles.promo}
          dangerouslySetInnerHTML={{ __html: PROMO_HTML }}
        />
        <Section
          title="Хиты"
          extra={<Badge tone="dark">{hits.length}</Badge>}
        >
          <div className="grid">
            {hits.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </Section>
        <Section title="Все игры">
          <div className="grid">
            {games.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}
          </div>
        </Section>
      </main>
    </>
  );
}
```

Заголовок раздела — `<h2>`, поэтому название игры в карточке стало `<h3>`: уровни заголовков должны идти по порядку, по ним программы экранного доступа строят оглавление страницы.

::: task
1. В `shared/Section.tsx` объявите тип `SectionProps` с тремя слотами: `title` и `children` — обязательные `ReactNode`, `extra` — необязательный.
2. Объявите и экспортируйте `Section`: `<section className={styles.section}>`, в нём строка заголовка `<div className={styles.head}>` с `<h2 className={styles.title}>` и `extra`, под ней — `children`. Стили готовы в `Section.module.css`.
3. В `GameCard.tsx` замените условие бейджа «Хит» на `isHit(game)` из `./gameRules`, удалите константу `HIT_RATING`. Название игры сделайте `<h3>`.
4. В `App.tsx` вычислите `hits = games.filter(isHit)` и нарисуйте два раздела: «Хиты» с бейджем-счётчиком `<Badge tone="dark">` в `extra` и «Все игры» без `extra`. В каждом — сетка `.grid` с карточками.
:::

## Что получилось

Над каталогом — раздел «Хиты» с тёмным бейджем «3» рядом с заголовком и тремя карточками, ниже — «Все игры». Один компонент `Section` нарисовал две разные шапки: с бейджем и без.

Эксперименты:

- **Передайте в `title` разметку**: `title={<>Хиты <span className="muted">недели</span></>}`. Заголовок — «Хиты недели» с серым вторым словом, ошибок типов нет: `title` объявлен как `ReactNode`. Будь он `string` — TypeScript не пропустил бы элемент. Верните `title="Хиты"`.
- **Передайте компонент вместо элемента**: допишите `{GameCard}` первым ребёнком раздела «Все игры». Редактор: `Type '({ game }: GameCardProps) => Element' is not assignable to type 'ReactNode'.` А в консоли React объяснит, что не так:

  ```
  Functions are not valid as a React child. This may happen if
  you return GameCard instead of <GameCard /> from render. Or
  maybe you meant to call this function rather than return it.
  ```

  `GameCard` — функция, а слот ждёт элемент `<GameCard … />`, то есть то, что получается из JSX. Уберите `{GameCard}`.

## Render-функции

Иногда родителю мало передать готовую разметку: он хочет нарисовать её **из данных, которые есть только у дочернего компонента**. Тогда в проп передают функцию, которая возвращает JSX, — её называют **render-функцией** (или render prop):

```tsx
type GameListProps = {
  items: Game[];
  renderItem: (game: Game) => ReactNode;
};

function GameList({ items, renderItem }: GameListProps) {
  return items.map((game) => (
    <Fragment key={game.id}>{renderItem(game)}</Fragment>
  ));
}

<GameList
  items={hits}
  renderItem={(game) => <GameCard game={game} />}
/>
```

`GameList` решает, *какие* игры и в каком порядке рисовать, а родитель — *как* выглядит каждая. Мы проверили: такой список рисует те же карточки без предупреждений. В магазине render-функции нам не понадобятся — передавать логику между компонентами в современном React удобнее собственными хуками (глава 7). Но вы встретите их в библиотеках компонентов: например, когда ячейку таблицы описывают функцией от строки данных.

## Как в настоящем проекте

- **Слоты — для раскладки**, props-данные — для содержимого. Карточка получает `game` и сама решает, что показать; раздел получает готовые куски разметки и только расставляет их. Если компонент начинает принимать пять слотов, подумайте, не разбить ли его на несколько.
- Типичные имена слотов: `title`, `extra`, `icon`, `footer`, `actions`, `empty`. Похожие слоты есть у компонентов UI-китов — увидите в главе 15.

::: tip
В Angular для нескольких мест есть `<ng-content select="…">`. В React отдельного механизма нет: слот — это просто проп типа `ReactNode`, и раскладку проверяет TypeScript.
:::
