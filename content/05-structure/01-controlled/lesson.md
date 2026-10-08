---
title: Управляемые поля
startFrom: custom
base: 04-state/09-practice
baseHash: 'e26ead6a430e'
focus: App.tsx
api: [value, onChange, '<select>', checked, 'e.target.value']
---

В каталоге шесть игр, а в настоящем магазине их сотни: покупателю нужен поиск. Поле поиска не похоже на кнопку «В корзину». Кнопка просто сообщает о щелчке, а у поля есть **значение**, и от него зависит, какие карточки рисовать. Где хранить это значение — в DOM или в состоянии React? С этого вопроса начинается глава.

## Два хозяина у одного значения

В обычном HTML поле ввода само помнит, что в него ввели: значение живёт в DOM-узле `<input>`. В React у этого значения может быть другой хозяин — состояние компонента. Отсюда два вида полей:

- **управляемое поле** (controlled): значение берётся из состояния через `value`, а каждое изменение возвращается в состояние через `onChange`. Источник истины — React;
- **неуправляемое поле** (uncontrolled): значение хранит DOM, React его не трогает и читает только когда нужно, например при отправке формы. О нём — в следующем шаге.

Поиску нужно знать значение на каждое нажатие клавиши: после каждой буквы список карточек должен стать другим. Поэтому поиск — управляемое поле.

## Поле поиска

Стили панели фильтров и подписи категорий уже лежат в проекте: `App.module.css` (`.toolbar`, `.field`) и `data/categories.ts`. Состояние — в `App`, там же, где список игр:

```tsx App.tsx {1-2,6-9,11-17}
// Фильтр по категории: одна из категорий или все сразу
type CategoryFilter = Game['category'] | 'all';

export function App() {
  const hits = games.filter(isHit);
  // Что введено в поиск и какая категория выбрана
  const [query, setQuery] = useState('');
  const [category, setCategory] =
    useState<CategoryFilter>('all');
  // Игры каталога, которые подходят под поиск и категорию
  const search = query.trim().toLowerCase();
  const visibleGames = games.filter(
    (game) =>
      game.title.toLowerCase().includes(search) &&
      (category === 'all' || game.category === category),
  );
```

`Game['category']` — тип поля `category` из модели игры: `'family' | 'strategy' | …`. Добавив `'all'`, получаем все значения фильтра.

Само поле — в разделе «Все игры», над сеткой:

```tsx App.tsx {2-12,26}
        <Section title="Все игры">
          <div className={styles.toolbar}>
            <label className={styles.field}>
              Поиск
              <input
                type="search"
                className="search"
                placeholder="Название игры"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </label>
            …
          </div>
          <div className="grid">
            {visibleGames.map((game) => (
```

Поле управляемое, потому что связано с состоянием в обе стороны:

```
 буква в поле
     ↓
 onChange → setQuery('к')
     ↓
 рендер App: query = 'к'
     ↓
 <input value="к"> → DOM
```

`value={query}` говорит React: в поле должно быть ровно то, что в состоянии. `onChange` срабатывает **на каждое изменение** — на каждую букву, а не при потере фокуса, как событие `change` в DOM. `e.target` — это сам `<input>`, а `e.target.value` — строка, которую поле получило бы после ввода.

## Список категорий

У `<select>` всё так же: `value` и `onChange` на самом `<select>`:

```tsx App.tsx {4-7,9-14}
            <label className={styles.field}>
              Категория
              <select
                className="search"
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as CategoryFilter)
                }
              >
                <option value="all">Все</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
```

Выбранный пункт задаёт `value` у `<select>`, а не атрибут `selected` у `<option>`, как в HTML. Попробуйте поставить `selected` у пункта — React предупредит:

```
Use the `defaultValue` or `value` props on <select> instead of setting `selected` on <option>.
```

`e.target.value` у любого поля — строка, даже если в списке только наши категории. Без `as CategoryFilter` TypeScript не пропустит вызов: `Argument of type 'string' is not assignable to parameter of type 'SetStateAction<CategoryFilter>'.` Приведение здесь честное: значения пунктов мы сами взяли из `categories`.

::: task
1. В `App.tsx` объявите тип `CategoryFilter` и два состояния: `query` (строка, начальное значение `''`) и `category` (начальное — `'all'`).
2. Вычислите `visibleGames`: игры, в названии которых есть строка поиска (без учёта регистра и пробелов по краям), и подходящие по категории. Импортируйте `categories` из `./data/categories`.
3. В разделе «Все игры» над сеткой добавьте `<div className={styles.toolbar}>` с двумя полями в `<label className={styles.field}>`: поиск (`type="search"`, класс `search`) и список категорий с пунктом «Все». Оба — управляемые.
4. Сетка «Всех игр» рисует `visibleGames` вместо `games`.
:::

## Что получилось

Введите «ко» — во «Всех играх» остались «Драконья почта» и «Космические коты». Выберите «Семейные» — одна «Драконья почта». Сотрите поиск — «Остров сокровищ», «Драконья почта» и «Нарды». «Хиты» фильтры не трогают: этот раздел рисует свой список.

## Эксперименты

**Сколько рендеров стоит буква.** Добавьте в начало `App` строку `console.log('render App')` и введите в поиск две буквы. В консоли четыре строки: каждая буква — новый рендер `App`, удвоенный строгим режимом. А вместе с `App` — шапка и все карточки, как в главе 4. Для шести игр это незаметно; когда станет заметно и что делать — в главах 12 и 16.

**`value` без `onChange`.** Уберите у поиска `onChange` и попробуйте ввести текст. Поле не меняется: React после каждого нажатия возвращает в него значение из состояния, а оно по-прежнему `''`. В консоли:

```
You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`.
```

Нужно поле только для чтения — так и скажите: `readOnly`. Нужно, чтобы поле само хранило значение, — `defaultValue` (следующий шаг).

**`undefined` вместо строки.** Замените `useState('')` на `useState<string>()`. TypeScript сразу подчеркнёт `query.trim()`: `'query' is possibly 'undefined'.` Обойдите это через `(query ?? '').trim()` и введите букву. В консоли:

```
A component is changing an uncontrolled input to be controlled. This is likely caused by the value changing from undefined to a defined value, which should not happen. …
```

`value={undefined}` для React значит «значения нет — поле неуправляемое». После первой буквы `value` стал строкой, и поле на ходу сменило хозяина. Правило: у управляемого поля `value` — всегда строка, пустое поле — `''`. Верните `useState('')`.

## Как в настоящем проекте

| Поле | Значение | Новое значение в `onChange` |
|---|---|---|
| `<input>`, `<textarea>` | `value` | `e.target.value` |
| `<select>` | `value` | `e.target.value` |
| `<input type="checkbox">`, `radio` | `checked` | `e.target.checked` |

- Управляемое поле берут, когда значение нужно **во время ввода**: живой поиск и фильтры, счётчик символов, проверка на лету, поле, от которого зависят другие.
- Поиск по каждой букве на сервер — это запрос на каждую букву. Задержку (debounce) сделаем своим хуком в главе 7, плавный ввод при тяжёлом списке — `useDeferredValue` в главе 12, а фильтры в адресной строке — в главе 10.

::: tip
В Angular то же самое делает `[(ngModel)]` или `[formControl]`: двусторонняя привязка. В React «двусторонность» собрана руками из двух односторонних потоков: `value` — вниз, `onChange` — вверх. Ничего не происходит без вашего обработчика, и в этом обработчике можно изменить, отфильтровать или отклонить ввод.
:::
