---
title: Props
startFrom: custom
focus: shared/GameCard.tsx
api: [props, деструктуризация, 'type Props', key]
---

Шапка стала компонентом, но у неё есть странность: `Header` сам импортирует массив `games`, чтобы посчитать игры. Шапке не нужно знать, где лежит каталог, — ей нужно одно число. А с карточкой так не выйдет вовсе: какую игру рисовать, знает только тот, кто перебирает массив. Компоненту нужны входные данные, и в React их передают через **props**.

## Props — атрибуты вашего компонента

У HTML-тега есть атрибуты: `<img src="…" alt="…">`. У вашего компонента они тоже есть, и называют их как хотите:

```tsx
<Header count={games.length} />
```

Все атрибуты React собирает в один объект и передаёт функции первым аргументом. Встретив этот элемент, React вызовет `Header({ count: 6 })`. Этот объект и называется **props** (от *properties* — свойства).

```tsx layout/Header.tsx {3-5,8,13}
import styles from './Header.module.css';

type HeaderProps = {
  count: number;
};

// Шапка магазина: логотип и подпись с числом игр
export function Header({ count }: HeaderProps) {
  return (
    <header className={styles.header}>
      <h1 className={styles.title}>♞ Ход конём</h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {count} игр
      </p>
    </header>
  );
}
```

Здесь три приёма, которые вы будете видеть в каждом компоненте:

- **тип props** — обычный TypeScript-тип объекта, рядом с компонентом. По нему редактор проверяет каждое использование `<Header>`;
- **деструктуризация** в параметре: `{ count }` вместо `props` и `props.count`. Так сразу видно, что компонент принимает;
- **использование** — как любой переменной: `{count}` в JSX.

Импорт `games` из шапки ушёл. Теперь число передаёт `App`: `<Header count={games.length} />`.

## Объект в props: карточка игры

Значением пропа может быть что угодно: число, строка, массив, объект, функция и даже JSX. Карточке нужна вся игра целиком:

```tsx shared/GameCard.tsx {10-12,15}
import { Fragment } from 'react';
import type { Game } from '../api/models';
import { formatPrice } from './format';
import styles from './GameCard.module.css';

const MAX_RATING = 5;
const HIT_RATING = 4.6;
const FEW_LEFT = 5;

type GameCardProps = {
  game: Game;
};

// Карточка игры в каталоге
export function GameCard({ game }: GameCardProps) {
  const { min, max } = game.players;
  …
  return (
    <article
      className={styles.card}
      data-category={game.category}
    >
      …
    </article>
  );
}
```

Тело функции из `map` переехало в компонент почти без изменений: вычисления (`specs`, `discount`) — до `return`, разметка — в `return`. Константы, которые нужны только карточке, переехали вместе с ней. А `App` стал коротким:

```tsx App.tsx {13,21-23}
import { games } from './data/games';
import { Header } from './layout/Header';
import { GameCard } from './shared/GameCard';
import styles from './App.module.css';

// Текст акции готовят маркетологи в своей системе — с HTML-разметкой
const PROMO_HTML =
  'Неделя семейных игр: скидки до <b>20%</b> на «Остров сокровищ» и «Нарды»';

export function App() {
  return (
    <>
      <Header count={games.length} />

      <main className={styles.page}>
        <p
          className={styles.promo}
          dangerouslySetInnerHTML={{ __html: PROMO_HTML }}
        />
        <div className="grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </main>
    </>
  );
}
```

`key` остался там, где он и был, — у элемента в `map`. Ключ нужен родителю, который рисует список, а не самой карточке.

::: task
1. В `layout/Header.tsx` объявите тип `HeaderProps` с полем `count: number`, примите `{ count }` в параметре и выведите его вместо `games.length`. Импорт `games` из шапки уберите.
2. В `App.tsx` передайте шапке число игр: `<Header count={games.length} />`.
3. В `shared/GameCard.tsx` объявите тип `GameCardProps` с полем `game: Game` и компонент `GameCard({ game })`. Перенесите в него тело функции из `map` вместе с `<article>`. Стили карточки уже лежат в `GameCard.module.css`.
4. Перенесите в `GameCard.tsx` константы `MAX_RATING`, `HIT_RATING`, `FEW_LEFT` и нужные импорты (`Fragment`, `Game`, `formatPrice` — теперь из соседнего `./format`).
5. В `App.tsx` нарисуйте список так: `<GameCard key={game.id} game={game} />`. Удалите из `App.module.css` всё, кроме `page` и `promo`, и уберите лишние импорты — редактор подскажет, какие больше не используются.
:::

## Что получилось

Магазин выглядит как прежде, а `App` уместился в тридцать строк. Посмотрим, что получает карточка. Замените параметр на `props` и выведите его:

```tsx shared/GameCard.tsx
export function GameCard(props: GameCardProps) {
  console.log(props);
  const { game } = props;
```

В консоли двенадцать строк `{ game: { id: 1, slug: "treasure-island", … } }` — по две на каждую из шести карточек: строгий режим вызывает каждый компонент дважды (глава 1). А главное — в объекте **только `game`**. Ключа там нет: `key` — служебный атрибут, его забирает React.

Попробуйте прочитать его: `console.log(props.key)`. Редактор не пропустит: `Property 'key' does not exist on type 'GameCardProps'.` А если обойти проверку типов (`(props as any).key`), React выведет `undefined` и одну ошибку:

```
GameCard: `key` is not a prop. Trying to access it will
result in `undefined` being returned. If you need to access
the same value within the child component, you should pass
it as a different prop.
```

Нужен id внутри карточки — передайте его отдельным пропом или возьмите из `game.id`. Верните `{ game }` в параметр.

Эксперименты с шапкой:

- **Уберите `count`**: `<Header />`. Ошибка типов: `Property 'count' is missing in type '{}' but required in type 'HeaderProps'.` Приложение при этом работает, только вместо числа — пустота: «в каталоге игр». Значение пропа — `undefined`, а его React не рисует (глава 2).
- **Передайте строку**: `count="6"`. В кавычках — строка, а тип ждёт число: `Type 'string' is not assignable to type 'number'.`
- **Опечатайтесь**: `cout={games.length}`. TypeScript знает все props компонента и подскажет: `Property 'cout' does not exist on type 'IntrinsicAttributes & HeaderProps'. Did you mean 'count'?` (`IntrinsicAttributes` — атрибуты, которые есть у любого компонента, например `key`.)

Верните `count={games.length}`.

## Как в настоящем проекте

- Тип props — `type` или `interface`, разницы для компонента нет. В курсе — `type XProps` рядом с компонентом. Экспортируют его, только если он нужен другим файлам.
- Без типа props не обойтись: `function Header({ count })` в строгом TypeScript — ошибка `Binding element 'count' implicitly has an 'any' type.`
- Компонент получает **ровно то, что ему нужно**. Шапке — число, а не весь массив игр: так её проще переиспользовать и проверять.

::: tip
Props похожи на входы Angular (`input()`), но устроены проще: это не сигналы и не поля класса, а аргумент функции. Получил компонент новые props — React вызывает функцию заново с новым объектом. Подписок и `ngOnChanges` нет: каждый вызов видит свои актуальные значения.
:::

::: deep Куда девается key
Вспомните главу 1: JSX превращается в вызов `jsxDEV(тип, props, key, …)`. Для нашего списка это `jsxDEV(GameCard, { game }, game.id, …)` — ключ передаётся **отдельным аргументом** и попадает в поле `element.key`, а не в `element.props`. Компонент получает только `element.props`. Поэтому `key` нельзя прочитать в компоненте и нельзя «пробросить» дальше — он принадлежит элементу в списке родителя, а не данным компонента.
:::
