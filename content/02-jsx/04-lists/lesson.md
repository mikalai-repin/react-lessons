---
title: Списки
focus: App.tsx
api: [map, key, filter]
---

Одна карточка готова — пора показать весь каталог. В HTML пришлось бы копировать разметку шесть раз. В JSX списки строятся из массивов данных обычными методами массива.

## map: массив данных → массив элементов

Вспомните таблицу из первого шага: массив в фигурных скобках React рисует целиком, элемент за элементом. Значит, достаточно превратить массив игр в массив React-элементов — а это работа для `map`:

```tsx
<div className="grid">
  {games.map((game) => (
    <article key={game.id} className={styles.card}>
      <h2>{game.title}</h2>
    </article>
  ))}
</div>
```

Функция в `map` получает игру и возвращает JSX её карточки. Круглые скобки после стрелки — тот же приём, что у `return (…)`: разметка начинается с новой строки. Класс `grid` из глобальных стилей раскладывает карточки сеткой.

Карточка одной игры больше не нужна: её разметка целиком переезжает внутрь `map`. Вместе с ней уходят `FEATURED_ID`, поиск игры и ранний `return`, а `soldOut` превращается в условие прямо в разметке — у каждой игры оно своё.

## key — имя элемента в списке

Новое здесь — атрибут **`key`**. Это не атрибут HTML и в DOM он не попадёт: это пометка для самого React. Когда список перерисовывается (игру добавили, удалили, отсортировали), React сравнивает новый список элементов со старым. По `key` он понимает, какой элемент какому соответствует: «карточка с ключом 4 — та же, что была, только переместилась». Подробно механизм разберём в шаге «Под капотом: почему key», а пока — правила:

- `key` ставится на **внешний** элемент, который возвращает функция в `map`, — здесь на `<article>`;
- ключ должен быть **уникальным среди соседей** (в другом списке такой же ключ — можно);
- ключ должен быть **устойчивым**: у одной и той же игры — один и тот же при каждом рендере. Лучший ключ — id из данных. `Math.random()` не годится: ключи будут новые при каждом рендере. Индекс в массиве (`map((game, index) => … key={index})`) — плохо, если список меняется; почему — увидите в эксперименте шага «Под капотом».

```tsx App.tsx {15-58}
import { games } from './data/games';
import { formatPrice } from './shared/format';
import styles from './App.module.css';

const MAX_RATING = 5;

export function App() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>♞ Ход конём</h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {games.length} игр
      </p>

      <div className="grid">
        {games.map((game) => (
          <article
            key={game.id}
            className={styles.card}
            data-category={game.category}
          >
            <img
              className={styles.cover}
              src={game.cover}
              alt={game.title}
            />
            <h2 className={styles.cardTitle}>{game.title}</h2>
            <p className={styles.price}>
              {formatPrice(game.price)}
              {game.oldPrice !== undefined && (
                <s className={`muted ${styles.oldPrice}`}>
                  {formatPrice(game.oldPrice)}
                </s>
              )}
            </p>
            <p className="muted">
              Игроков: {game.players.min}–{game.players.max} ·{' '}
              {game.playTime} мин
            </p>
            <div
              className={styles.rating}
              role="img"
              aria-label={`Рейтинг ${game.rating} из ${MAX_RATING}`}
            >
              <div
                className={styles.ratingFill}
                style={{
                  width: `${(game.rating / MAX_RATING) * 100}%`,
                }}
              />
            </div>
            {game.inStock === 0 ? (
              <p className={styles.soldOut}>Нет в наличии</p>
            ) : (
              <button className="button">В корзину</button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
```

::: task
1. Удалите `FEATURED_ID`, поиск игры, ранний `return` и `soldOut`.
2. Оберните карточку в `<div className="grid">` и `games.map((game) => (…))`, добавьте `<article>` ключ `key={game.id}`.
3. Условие «Нет в наличии» запишите прямо в разметке: `game.inStock === 0 ? … : …`.
:::

## Что получилось

Шесть карточек в три колонки (прокрутите превью). У «Маяка» — «Нет в наличии», у трёх игр со скидкой — старая цена. Цвет полоски сверху у каждой карточки свой: `data-category` берётся из данных игры. Одна шероховатость — у «Нард» «Игроков: 2–2». Поправим в следующем шаге.

Эксперименты:

- **Уберите `key`.** Всё нарисуется как раньше, но в консоли появится ошибка:

  ```
  Each child in a list should have a unique "key" prop.

  Check the render method of `App`. See https://react.dev/link/warning-keys for more information.
  ```

  Под ней — **стек владельцев** (owner stack): цепочка компонентов, которые создали проблемный элемент, со ссылками на строки кода. Строка `App.tsx:17:11` ведёт прямо к `<article>` внутри `map`. React не может сопоставлять элементы списка и предупреждает. TypeScript молчит: `key` необязателен для типов.

- **Поставьте неуникальный ключ** — `key={game.category}`. У трёх игр категория `family`, и React сообщит: ``Encountered two children with the same key, `family`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.`` С одинаковыми ключами при обновлении списка карточки могут продублироваться или пропасть. Верните `game.id`.

- **Покажите только игры в наличии**: `games.filter((game) => game.inStock > 0).map(…)`. «Маяк» исчез — методы массива складываются в цепочку, как в любом JavaScript-коде. Сортировка (`toSorted`), срез (`slice`) работают так же. Уберите `filter`: фильтры по выбору покупателя сделаем в главе 5.

::: tip
В Angular список — это `@for (game of games; track game.id)`. `track` и `key` — одна и та же идея: по какому значению фреймворк узнаёт элемент между обновлениями. Разница в том, что в Angular `track` обязателен синтаксически, а в React забытый `key` — только предупреждение в консоли.
:::

::: tip Как в настоящем проекте
Когда разметка элемента списка разрастается, как наша карточка, её выносят в отдельный компонент: `games.map((game) => <GameCard key={game.id} game={game} />)`. Этим займёмся в главе 3 — там и выяснится, как передать в компонент данные.
:::
