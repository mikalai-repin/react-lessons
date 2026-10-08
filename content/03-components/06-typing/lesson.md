---
title: Типизация компонентов
startFrom: custom
focus: shared/Button.tsx
api: ["ComponentProps<'button'>", '...rest', union-props, 'React.FC']
---

У кнопки «В корзину» в карточке есть незаметная ошибка: у неё нет атрибута `type`. По стандарту HTML `<button>` без `type` — это `type="submit"`: окажись карточка внутри формы, нажатие отправило бы форму. Писать `type="button"` у каждой кнопки магазина утомительно, и рано или поздно кто-нибудь забудет. Нужен компонент `Button` с правильным значением по умолчанию.

Но у такой обёртки сложная задача: кнопке передают `disabled`, `onClick`, `aria-label`, `title`, `form` — десятки атрибутов. Перечислять их в своём типе props вручную бессмысленно.

## ComponentProps — props чужого компонента

В `react` есть тип **`ComponentProps<T>`**: все props, которые принимает тег или компонент `T`. `ComponentProps<'button'>` — это всё, что можно написать у `<button>` в JSX: атрибуты, обработчики событий, `children`, `ref`.

```tsx shared/Button.tsx {1,3,7-9,13-15}
import type { ComponentProps } from 'react';

type ButtonProps = ComponentProps<'button'>;

// Кнопка магазина: всё, что умеет <button>, и оформление .button из styles.css
export function Button({
  type = 'button',
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={className ? `button ${className}` : 'button'}
      {...rest}
    />
  );
}
```

Разберём деструктуризацию:

- `type = 'button'` — значение по умолчанию. Передадут `type="submit"` — будет `submit`;
- `className` достаём отдельно, чтобы **добавить** к своему классу `button`, а не заменить его;
- `...rest` — всё остальное: `disabled`, `onClick`, `children` и что угодно ещё. Оператор `{...rest}` в JSX раскладывает объект в атрибуты — так все остальные props уходят в `<button>` без перечисления.

Отдельно `children` упоминать не нужно: он лежит в `rest` и попадает в `<button>` как обычный проп.

В карточке обе кнопки теперь — `Button`. «Нет в наличии» стала неактивной кнопкой вместо абзаца: атрибут `disabled` пройдёт через `rest`, а серый стиль `.button:disabled` уже есть в `styles.css`.

```tsx shared/GameCard.tsx {2,5,7}
import { Badge } from './Badge';
import { Button } from './Button';
…
      {game.inStock === 0 ? (
        <Button disabled>Нет в наличии</Button>
      ) : (
        <Button>В корзину</Button>
      )}
```

::: task
1. В `shared/Button.tsx` объявите `type ButtonProps = ComponentProps<'button'>`.
2. Объявите и экспортируйте `Button`: достаньте из props `type` (по умолчанию `'button'`), `className` и `...rest`. Верните `<button>` с этим `type`, классом `button` (плюс `className`, если передали) и `{...rest}`.
3. В `GameCard.tsx` замените `<button className="button">` на `<Button>`, а абзац «Нет в наличии» — на `<Button disabled>Нет в наличии</Button>`. Класс `soldOut` из `GameCard.module.css` удалите.
:::

## Что получилось

У «Маяка» вместо курсива — серая неактивная кнопка «Нет в наличии». А в DOM у всех кнопок появился `type`:

```html
<button type="button" class="button">В корзину</button>
<button type="button" class="button" disabled="">Нет в наличии</button>
```

Эксперименты:

- **Передайте свои атрибуты**: `<Button className="wide" title="Добавить в корзину">`. В DOM — `class="button wide"` и `title`: класс добавился к нашему, а `title` прошёл через `rest`, хотя в `Button` о нём ни слова.
- **Передайте обработчик**: `onClick={(e) => console.log(e.currentTarget.tagName)}` и нажмите «В корзину» — в консоли `BUTTON`. Тип `e` редактор вывел сам: в `ComponentProps<'button'>` описано, что `onClick` получает событие кнопки. События — в главе 4.
- **Передайте то, чего у кнопки нет**: `size="sm"`. Ошибка: `Property 'size' does not exist on type 'IntrinsicAttributes & ClassAttributes<HTMLButtonElement> & ButtonHTMLAttributes<HTMLButtonElement>'.` Так выглядит `ComponentProps<'button'>` изнутри. Свой проп добавляют пересечением: `ComponentProps<'button'> & { size?: 'sm' | 'md' }` — и достают его из props до `...rest`, чтобы он не ушёл в DOM.

Верните `<Button>В корзину</Button>`.

## Типы для разных вариантов: union-props

Иногда набор props зависит от одного из них. Например, бейдж наличия: «На складе: 3» — нужен остаток, «Нет в наличии» — не нужен. Два необязательных поля (`status`, `inStock?`) разрешат бессмыслицу вроде «нет в наличии, осталось 3». Точнее описать варианты объединением:

```tsx
type StockProps =
  | { status: 'available'; inStock: number }
  | { status: 'soldOut' };

function Stock(props: StockProps) {
  if (props.status === 'soldOut') return <p>Нет в наличии</p>;
  return <p>На складе: {props.inStock}</p>;
}
```

Теперь TypeScript проверяет сочетания: `<Stock status="soldOut" inStock={3} />` — ошибка (`Property 'inStock' does not exist on type 'IntrinsicAttributes & { status: "soldOut"; }'`), `<Stock status="available" />` — тоже (`Property 'inStock' is missing…`). Внутри компонента после проверки `props.status` TypeScript знает, какой вариант перед ним, и `props.inStock` доступен.

Обратите внимание: здесь props **не деструктурированы** в параметре. `function Stock({ status, inStock }: StockProps)` не скомпилируется — `Property 'inStock' does not exist on type 'StockProps'`: до проверки `status` поля `inStock` может и не быть.

## Как в настоящем проекте

- **`ComponentProps<typeof X>`** даёт props вашего компонента: `ComponentProps<typeof GameCard>` — это `{ game: Game }`. Удобно, когда тип props не экспортирован.
- Обёртки над тегами (`Button`, `Input`, `Link`) почти всегда строят на `ComponentProps<'тег'>` + `...rest`: компонент остаётся «настоящей» кнопкой со всеми атрибутами. В `rest` попадает и `ref` — в React 19 это обычный проп, поэтому ссылка на DOM-узел тоже пройдёт насквозь (глава 6).
- Есть ещё `ComponentPropsWithoutRef<'button'>` — то же без `ref`, если пропускать его наружу не нужно.

::: legacy React.FC
В старом коде и статьях компоненты часто типизируют так:

```tsx
const Badge: React.FC<BadgeProps> = ({ children, tone = 'accent' }) => …
```

Работает и сейчас, но в курсе так не пишем: обычная функция с типом у параметра короче, а `FC` ничего не добавляет. Раньше (в `@types/react` до 18-й версии) `FC` сам добавлял в props необязательный `children` — компонент принимал содержимое, даже если ничего с ним не делал. Сейчас этого нет: у `FC<{ label: string }>` обращение к `children` — ошибка `Property 'children' does not exist on type '{ label: string; }'`, `children` нужно объявлять явно, как мы и делаем.
:::

::: tip
В Angular обёртку над кнопкой обычно делают директивой на самом `<button>` (`<button appButton>`), чтобы не терять его атрибуты. В React директив нет, и ту же задачу решают тип `ComponentProps` и `...rest`: обёртка принимает всё, что принимает тег, и передаёт ему.
:::
