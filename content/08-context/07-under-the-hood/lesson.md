---
title: 'Под капотом: как React находит провайдер'
noSolution: true
focus: main.tsx
api: [стек провайдеров, _currentValue, fiber.dependencies, распространение изменений]
---

Этот шаг необязательный. Мы говорили «`use` возвращает значение **ближайшего** провайдера выше по дереву». Звучит так, будто React при каждом чтении поднимается по дереву и ищет провайдер. На самом деле он не ищет ничего — значение уже лежит там, где его прочитают. Посмотрим, как это устроено, и заодно — как React узнаёт, кого рендерить при новом значении.

## Объект контекста

Вспомните, что возвращает `createContext` (исходник `react.development.js`, упрощённо):

```js
function createContext(defaultValue) {
  const context = {
    $$typeof: REACT_CONTEXT_TYPE,
    _currentValue: defaultValue,
    …
  };
  context.Provider = context;
  context.Consumer = { $$typeof: REACT_CONSUMER_TYPE, _context: context };
  return context;
}
```

Поле `_currentValue` — «текущее значение» контекста. Сразу после создания там значение по умолчанию. А `Provider` — сам объект: вот почему в React 19 работают и `<CartContext value>`, и `<CartContext.Provider value>`.

## Стек провайдеров

Рендер обходит дерево в глубину (глава 3). Когда обход **входит** в провайдер, React делает (`react-dom-client.development.js`, упрощённо):

```js
function pushProvider(fiber, context, nextValue) {
  push(valueCursor, context._currentValue, fiber); // старое — в стек
  context._currentValue = nextValue;               // новое — в контекст
}
```

а когда **выходит** из него, закончив всё поддерево:

```js
function popProvider(context, fiber) {
  context._currentValue = valueCursor.current; // старое — обратно
  pop(valueCursor, fiber);
}
```

Пока React рендерит что-то внутри провайдера, в `CartContext._currentValue` лежит значение этого провайдера. Чтение контекста — просто чтение поля:

```js
function readContextForConsumer(consumer, context) {
  const value = context._currentValue;
  // …и запись в список зависимостей файбера — ниже
  return value;
}
```

Поиска нет: «ближайший провайдер» получается сам собой — он записал своё значение последним, а когда поддерево закончилось, вернул прежнее.

```
обход               CartContext._currentValue
──────────────────────────────────────────────
до рендера          null (по умолчанию)
вход в провайдер    позиции корзины
  Header            читает → позиции
  MiniCart          читает → позиции
  GameCard ×6       читают → позиции
выход               null
```

## Датчик

Проверим. Добавьте в начало `main.tsx` импорты контекстов:

```tsx main.tsx
import {
  CartActionsContext,
  CartContext,
} from './cart/CartContext';
import { ThemeContext } from './theme/ThemeContext';
```

а в конец — датчик. Обход файберов от корня — как в главе 7; у провайдера в файбере `tag === 10`, его `type` — объект контекста. А прочитанные контексты React записывает в поле `dependencies` файбера-потребителя — списком через `next`.

```tsx main.tsx
// Имена контекстов: у объекта контекста имени нет — подпишем сами
const names = new Map<unknown, string>([
  [CartContext, 'CartContext'],
  [CartActionsContext, 'CartActionsContext'],
  [ThemeContext, 'ThemeContext'],
]);

// Какие контексты читает каждый компонент: fiber.dependencies
function printDependencies() {
  const key = Object.keys(container!).find((k) =>
    k.startsWith('__reactContainer'),
  )!;
  const stack = [(container as any)[key].stateNode.current];
  const seen = new Set<string>();
  while (stack.length > 0) {
    const fiber = stack.pop();
    const name = fiber.type?.name;
    if (fiber.tag === 10) {
      console.log('провайдер', names.get(fiber.type), '→', fiber.memoizedProps.value);
    }
    let dep = fiber.dependencies?.firstContext;
    if (name && dep && !seen.has(name)) {
      seen.add(name);
      const read: string[] = [];
      for (; dep; dep = dep.next) read.push(names.get(dep.context)!);
      console.log(name, 'читает', read.join(', '), '| хуки:', fiber._debugHookTypes);
    }
    if (fiber.sibling) stack.push(fiber.sibling);
    if (fiber.child) stack.push(fiber.child);
  }
}

console.log('Provider === контекст:', CartContext.Provider === CartContext);
console.log('вне рендера:', (CartContext as any)._currentValue);
setTimeout(printDependencies, 500);
```

Консоль:

```
Provider === контекст: true
вне рендера: null
провайдер ThemeContext → { theme: "light", toggleTheme: ƒ toggleTheme() }
провайдер CartContext → []
провайдер CartActionsContext → { add: ƒ add(), decrease: ƒ decrease(), remove: ƒ remove(), clear: ƒ clear() }
Header читает CartContext, ThemeContext, CartContext, ThemeContext | хуки: null
MiniCart читает CartContext, CartActionsContext, CartContext, CartActionsContext | хуки: ["useRef"]
GameCard читает CartContext, CartActionsContext, CartContext, CartActionsContext | хуки: null
```

Что здесь видно:

- **Вне рендера** в контексте — значение по умолчанию: провайдер вернул его на выходе. Читать `_currentValue` вне рендера бессмысленно, поэтому `use` и `useContext` работают только во время рендера.
- **Провайдеры — файберы** в дереве, как компоненты. В `memoizedProps.value` — то, что мы передали в `value`.
- **Зависимости**: шапка читает корзину и тему, карточка — позиции и действия. Каждый контекст записан дважды: строгий режим вызвал компонент второй раз, и второй вызов дописал те же чтения. Уберите `<StrictMode>` из `main.tsx` — по одному разу.
- **Хуки**: у `Header` и `GameCard` — `null`, хотя они вызывают `useCart` и `useTheme`. Внутри — `use`, а чтение контекста **не занимает ячейку** в списке хуков: значение не хранится в компоненте, его каждый раз берут из `_currentValue`. Список зависимостей тоже собирается заново при каждом рендере. Поэтому `use` можно вызвать в условии: сдвигать нечего. А `useContext` в режиме разработки попадает в список имён хуков для сверки порядка — отсюда таблица в шаге про `use`.

## Вложенный провайдер

Оберните в `App` мини-корзину провайдером с пустым массивом (и импортируйте `CartContext`):

```tsx App.tsx
<CartContext value={[]}>
  <MiniCart games={games} />
</CartContext>
```

Нажмите «В корзину» у «Острова»: мини-корзина пуста, а карточки «Острова» **ниже** неё в дереве показывают «В корзине: 1 шт.». На входе во внутренний провайдер React положил `[]` поверх позиций, на выходе — вернул позиции, и соседи после мини-корзины читают уже их. Уберите обёртку.

## Кого рендерить

Чтение понятно. Как React узнаёт, кого рендерить, когда значение провайдера изменилось?

После «В корзину» рендерится `CartProvider` (он внутри `App`, а `App` не рендерится). Его `children` — те же элементы, что был, и React хочет **пропустить** всё поддерево (`bailoutOnAlreadyFinishedWork`). Но прежде чем пропустить, он проверяет провайдеры на пути: не изменилось ли их значение — `Object.is(новый value, старый value)` (функция `propagateParentContextChanges`). Изменилось — React проходит по пропущенному поддереву (`propagateContextChanges`) и у каждого файбера смотрит список `dependencies`: есть там этот контекст — файбер помечается «нужно обновить», и метка поднимается по родителям. Затем обход спускается только по помеченным путям и вызывает только помеченные компоненты.

```
CartProvider: value изменился
├─ Header          CartContext → рендер
├─ main            пропущен
│  ├─ MiniCart     CartContext → рендер
│  └─ Section      пропущен
│     └─ GameGrid  пропущен
│        └─ GameCard ×6 → рендер
└─ Footer          пропущен
```

Это и есть цена из шага «Цена контекста», только видимая изнутри: проход по поддереву дешёвый (сравнение ссылок в списках), а дорогой — рендер каждого помеченного потребителя. И вся информация, которой React располагает, — «значение другое» по `Object.is`. Какую часть значения компонент на самом деле использовал, React не знает.

Пометку React делает **лениво** — только когда собирается пропустить поддерево. Если родитель потребителя и так рендерится (например, `App` после ввода в поиск), потребитель отрендерится вместе с ним, а React лишь сверит: значения из его `dependencies` (`memoizedValue`) с текущими `_currentValue` (`checkIfContextChanged`).

## Итог

- `createContext` создаёт объект с полем текущего значения; провайдер — сам объект.
- Провайдер на входе кладёт своё значение в контекст, старое — в стек, на выходе возвращает старое. «Ближайший провайдер» — следствие обхода в глубину, а не поиск.
- Чтение — поле объекта плюс запись в `fiber.dependencies`. Ячейки хука нет — поэтому `use` можно в условии.
- Новое значение (по `Object.is`) — React находит потребителей по `dependencies` в пропущенном поддереве и рендерит только их.

Уберите датчик и импорты из `main.tsx`.
