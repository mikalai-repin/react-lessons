---
title: Атрибуты
focus: App.tsx
api: [src, alt, 'style={{}}', 'data-*', 'aria-*', htmlFor, tabIndex]
---

Карточке не хватает главного — обложки. Картинка в HTML — это тег `<img>` с атрибутами `src` и `alt`, и в JSX он почти такой же. «Почти» — потому что JSX превращается в JavaScript, и у атрибутов появляются свои правила.

## Строка или выражение

У атрибута в JSX два вида значений:

```tsx
<img
  className={styles.cover}
  src={game.cover}
  alt={game.title}
/>
```

- в **кавычках** — строка как есть: `className="muted"`;
- в **фигурных скобках** — выражение JavaScript: `src={game.cover}`.

Кавычки вокруг скобок не ставятся. `src="{game.cover}"` — это строка из двенадцати символов, и браузер честно попробует загрузить картинку по адресу `/%7Bgame.cover%7D` — фигурные скобки, закодированные в адресе.

Ещё одно отличие от HTML: в JSX **каждый тег должен быть закрыт**. В HTML `<img>` и `<br>` можно не закрывать, в JSX — только `<img />` и `<br />`. Без косой черты код не соберётся: `JSX element 'img' has no corresponding closing tag.`

## Имена атрибутов — как свойства DOM

С `className` вы уже знакомы: `class` — ключевое слово JavaScript, поэтому React берёт имя свойства DOM-элемента. Так же устроены и другие атрибуты, имена которых в HTML неудобны для JavaScript:

| HTML | JSX |
|---|---|
| `class` | `className` |
| `for` (у `<label>`) | `htmlFor` |
| `tabindex` | `tabIndex` |
| `onclick` | `onClick` (обработчики событий — в главе 4) |

Правило простое: имена из нескольких слов пишутся **camelCase**. Исключение — атрибуты `aria-*` и `data-*`: они пишутся как в HTML, через дефис.

## data-* и aria-*

**`data-*`** — собственные атрибуты разметки. Их используют стили, тесты и аналитика. В нашем `App.module.css` уже есть правила вида `.card[data-category='family']`: цветная полоска сверху карточки зависит от категории игры. Осталось передать категорию в разметку:

```tsx
<article className={styles.card} data-category={game.category}>
```

**`aria-*`** — атрибуты доступности: они описывают элемент для программ экранного доступа. Пригодятся прямо сейчас — для полоски рейтинга.

## style — объект, а не строка

Полоска рейтинга — серая дорожка с жёлтой заливкой, и ширина заливки зависит от рейтинга: 4,6 из 5 — это 92 %. Значение вычисляется, поэтому классом его не задать. Для таких случаев есть атрибут `style`, и в JSX он принимает **объект**:

```tsx
<div
  className={styles.ratingFill}
  style={{ width: `${(game.rating / MAX_RATING) * 100}%` }}
/>
```

Двойные скобки — не особый синтаксис: внешние означают «выражение», внутренние — литерал объекта. Свойства в объекте пишутся camelCase, как в `element.style` в DOM: `marginTop`, `backgroundColor`. Числа React считает пикселями: `{ marginTop: 4 }` станет `margin-top: 4px`. Кроме свойств, у которых единиц нет: `{ opacity: 0.9, lineHeight: 1.5 }` останутся числами.

Для статичных стилей `style` не нужен — для них есть классы. `style` — для значений, которые вычисляются из данных.

Полоска — просто цветные прямоугольники, человеку с программой экранного доступа она ничего не скажет. Поэтому у дорожки роль `img` («это картинка») и текстовое описание `aria-label` — программа прочитает «Рейтинг 4.6 из 5».

```tsx App.tsx {5,17-25,34-45}
import { games } from './data/games';
import { formatPrice } from './shared/format';
import styles from './App.module.css';

const MAX_RATING = 5;

export function App() {
  const game = games[0];

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>♞ Ход конём</h1>
      <p className="muted">
        Магазин настольных игр · в каталоге {games.length} игр
      </p>

      <article
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
      </article>
    </main>
  );
}
```

::: task
1. Добавьте `<article>` атрибут `data-category` с категорией игры.
2. Первым элементом карточки поставьте обложку: `<img>` с классом `styles.cover`, `src` из `game.cover` и `alt` из названия игры.
3. Объявите над компонентом константу `MAX_RATING = 5`.
4. В конце карточки нарисуйте полоску рейтинга: `<div>` с классом `styles.rating`, `role="img"` и `aria-label` «Рейтинг 4.6 из 5»; внутри — `<div>` с классом `styles.ratingFill` и шириной в процентах через `style`.
:::

## Что получилось

У карточки появились обложка, оранжевая полоска сверху (категория `family`) и полоска рейтинга, заполненная почти до конца. Посмотрите, во что React превратил JSX, — добавьте в конец `App.tsx`:

```tsx
setTimeout(() => console.log(document.querySelector('article')?.outerHTML), 100);
```

В консоли настоящая разметка: `class="App_card_…"` вместо `className`, `data-category="family"`, `aria-label="Рейтинг 4.6 из 5"` и `style="width: 92%;"`. Браузер получает обычный HTML — все особенности JSX остаются в коде. Уберите строку.

Эксперименты:

- **Напишите `class` вместо `className`** у подписи под заголовком. Редактор подчеркнёт атрибут: `Property 'class' does not exist on type … Did you mean 'className'?`. Код запустится, и подпись даже останется серой — React передаст атрибут в DOM, — но в консоли будет ошибка ``Invalid DOM property `class`. Did you mean `className`?``. Верните `className`: в React-коде `class` считается ошибкой, даже если работает.
- **Передайте в `style` строку**, как в HTML: `style="width: 50%"`. Ошибка типов (`Type 'string' has no properties in common with type 'Properties<…>'`), а при запуске React упадёт с подсказкой: ``The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX.`` Верните объект.

::: tip
В Angular для этого есть привязки `[src]="game.cover"`, `[attr.data-category]`, `[style.width.%]`. В JSX разницы между «атрибутом» и «привязкой» нет: любое значение в фигурных скобках — уже привязка, и при следующем рендере React обновит его в DOM.
:::

::: deep Атрибуты или свойства DOM
Названия в JSX взяты из свойств DOM (`className`, `htmlFor`, `tabIndex`), но записывает React в основном **атрибуты**: в разметке выше — `class`, `data-category`, `style`. Исключение — поля форм: их `value` и `checked` React ведёт как свойства, потому что текущее значение поля живёт в свойстве, а не в атрибуте (атрибут `value` — только начальное значение). Это важно для управляемых полей ввода, до них дойдём в главе 5.

Атрибуты, которых React не знает (например, `class` или любой выдуманный), он по умолчанию передаёт в DOM как есть — поэтому `class` сработал. TypeScript строже: неизвестный атрибут у HTML-тега для него — ошибка. Не проверяет он только имена с дефисом — поэтому любые `data-*` проходят без объявления.
:::
