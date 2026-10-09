---
title: Линтер
noSolution: true
focus: game/GameDetails.tsx
api: [eslint-plugin-react-hooks, rules-of-hooks, exhaustive-deps, правила компилятора]
---

В прошлом шаге React заметил нарушение, только когда покупатель нажал нужную кнопку, — а в `MiniCart` не заметил вовсе. Ждать, пока ошибку найдёт пользователь, не хочется. В настоящем проекте правила хуков проверяет **линтер** — ESLint с официальным плагином React [`eslint-plugin-react-hooks`](https://react.dev/reference/eslint-plugin-react-hooks): нарушение подчёркивается в редакторе сразу, как вы его написали.

В превью курса линтера нет — проект целиком мы настроим в главе 23. Здесь — что он скажет о коде, который мы уже писали. Все сообщения ниже получены запуском ESLint 10 и `eslint-plugin-react-hooks` 7.1 на коде магазина.

## Подключение

```js eslint.config.js
import reactHooks from 'eslint-plugin-react-hooks';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  reactHooks.configs.flat.recommended,
]);
```

Набор `recommended` включает 16 правил. Два из них — классические, они есть в плагине много лет:

| Правило | Уровень | Что проверяет |
|---|---|---|
| `react-hooks/rules-of-hooks` | ошибка | правила хуков из прошлого шага |
| `react-hooks/exhaustive-deps` | предупреждение | массивы зависимостей эффектов и других хуков |

Остальные 14 — правила **React Compiler** (глава 16): компилятор разбирает код компонентов и хуков и находит то, что нарушает правила React, — нечистый рендер, изменение props, чтение ссылок при рендере.

## rules-of-hooks

Эксперименты прошлого шага и главы 4 — с сообщениями линтера:

| Код | Сообщение |
|---|---|
| `useEffect` внутри `if (quantity > 0)` | React Hook "useEffect" is called conditionally. React Hooks must be called in the exact same order in every component render |
| `useRef` после раннего `return` в `MiniCart` | … is called conditionally. … Did you accidentally call a React Hook after an early return? |
| `useState` в `handleAddClick` | React Hook "useState" is called in function "handleAddClick" that is neither a React function component nor a custom React Hook function. React component names must start with an uppercase letter. React Hook names must start with the word "use" |
| `useState` в `readDraft` | то же, с именем "readDraft" |
| хук в `for` | … may be executed more than once. Possibly because it is called in a loop. … |

Последняя фраза третьего сообщения — ключ к тому, как линтер вообще отличает компоненты и хуки от прочих функций: **по имени**. С большой буквы — компонент, с `use` — хук; хуки разрешены только в них. Поэтому `readDraft` — ошибка, хотя React бы её выполнил, а `MiniCart` с `useRef` после `return` — ошибка, хотя React промолчал. Линтер проверяет код, а не одно конкретное нажатие кнопки.

## exhaustive-deps

Это правило мы видели в главе 6: если эффект читает `quantity`, а в массиве его нет, —

```
React Hook useEffect has a missing dependency: 'quantity'.
Either include it or remove the dependency array
```

Правило — предупреждение, а не ошибка: иногда кажется, что зависимость «точно не нужна». Именно так и появляются устаревшие замыкания (шаг про `useEffectEvent`). Правильный ответ на предупреждение — изменить код эффекта, а не массив.

::: warning
В старом коде часто встречается `// eslint-disable-next-line react-hooks/exhaustive-deps` над массивом зависимостей. Это отключение проверки, а не решение: эффект по-прежнему читает устаревшие значения. Для «прочитать свежее, но не перезапускаться» есть `useEffectEvent`.
:::

## Правила компилятора

Ещё несколько ошибок из прошлых глав — теперь с сообщениями линтера:

| Код из курса | Правило | Сообщение |
|---|---|---|
| `useState(Date.now())` (глава 6) | `purity` | Cannot call impure function during render |
| `console.log(searchRef.current)` при рендере (глава 6) | `refs` | Cannot access refs during render |
| итог корзины в эффекте (глава 6) | `set-state-in-effect` | Calling setState synchronously within an effect can trigger cascading renders |
| `setX(…)` прямо в теле компонента | `set-state-in-render` | Cannot call setState during render |
| `props.game = …` (глава 3) | `immutability` | This value cannot be modified |
| `rendered += 1` для переменной модуля (глава 3) | `globals` | Cannot reassign variables declared outside of the component/hook |
| `function Header()` внутри `App` (глава 3) | `static-components` | Cannot create components during render |

У каждого сообщения есть продолжение — объяснение и ссылка на react.dev. Например, у `refs`: «React refs are values that are not needed for rendering. Refs should only be accessed outside of render, such as in event handlers or effects.»

## Чего линтер не видит

Линтер — статический анализ, и у него есть слепые пятна. На коде главы 3:

- `game.tags.push('хит')` — **не отмечено**, хотя это изменение props, испортившее данные всего магазина. Присваивание `props.game = …` отмечено;
- `rendered++` — **не отмечено**, а `rendered += 1` — отмечено, хотя это одно и то же;
- компонент, объявленный внутри `App`, отмечен, только если его используют прямо в JSX `App`; внутри колбэка `map` — нет.

Поэтому линтер не отменяет понимания правил. Он ловит большинство ошибок и почти все нарушения правил хуков, но «рендер чистый» и «props только для чтения» остаются на вас.

## Как в настоящем проекте

- Плагин ставят в каждый React-проект: `npm i -D eslint eslint-plugin-react-hooks` и набор `recommended` в `eslint.config.js`. Расширение ESLint в редакторе подчёркивает нарушения при вводе.
- Набор `recommended` расширяют, а не урезают: новые правила появляются в нём с новыми версиями плагина. Для TypeScript нужен ещё парсер (`typescript-eslint`) — полную настройку сделаем в главе 23.
- Правила компилятора полезны и без самого компилятора: они ловят настоящие ошибки. А когда в главе 16 мы включим React Compiler, код, чистый для линтера, он сможет оптимизировать.
- В дальнейших шагах курса, где важно, что скажет линтер, мы будем приводить его сообщение — как в этом шаге.
