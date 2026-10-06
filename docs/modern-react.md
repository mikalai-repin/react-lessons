# Современный React: что верно для версии 19

React и экосистема сильно изменились в 2022–2026 годах. В интернете и в памяти языковых моделей много кода для React 16–18, React Router 5/6, antd 4/5, React Query 3/4, Redux без Toolkit. Этот документ — опора для автора курса: **что проверено** для установленной версии и **что в курсе запрещено**.

Правило: любое утверждение об API проверяется по `.d.ts` (`@types/react`, типы библиотек) и коду (`node_modules/react-dom/cjs/react-dom-client.development.js` и т. п.) **установленной версии**, а поведение — запуском в превью. Новое проверенное — добавлять в таблицу «Проверено» с источником.

> **Состояние (2026-10-06):** таблица «Проверено» пуста — пакеты ещё не установлены. Раздел «Ожидается (из памяти модели) — проверить» — черновик, его нельзя использовать в уроках без проверки.

## Проверено

| Факт | Источник |
|---|---|
| Последние версии на 2026-10-06: `react`/`react-dom` 19.3.0 (идут канареечные 19.3.x), `react-router` 8.4.0, `antd` 6.6.5, `@tanstack/react-query` 5.104.1, `zustand` 5.0.15, `@reduxjs/toolkit` 2.13.0, `react-hook-form` 7.89.0, `zod` 4.6.5, `vitest` 5.0.3, `next` 16.3.8, `babel-plugin-react-compiler` 1.0.0, `typescript` 7.0.2 (Go) | `npm view <пакет> version` |
| В `react@19.3.0` поле `exports`: `.`, `./jsx-runtime`, `./jsx-dev-runtime`, `./compiler-runtime` — только CJS (`default: ./index.js`) и условие `react-server`; ESM-сборки нет | `npm view react@19.3.0 exports` |
| `react-router@8.4.0`: `peerDependencies` `react >=19.2.7`, `react-dom >=19.2.7`; `engines.node >=22.22.0` | `npm view` |
| `antd@6.6.5`: `peerDependencies` `react >=18.0.0` | `npm view` |
| `next@16.3.8`: peer `react ^18.2.0 \|\| ^19.0.0`, опционально `babel-plugin-react-compiler` | `npm view` |

## Запрещено в коде курса (только во врезке «Вы встретите в старом коде»)

| Не пишем | Пишем | Почему (проверить формулировки при главе) |
|---|---|---|
| Классовые компоненты, `this.state`, `componentDidMount` | Функции + хуки | Исключение — граница ошибок (класс или `react-error-boundary`) |
| `ReactDOM.render`, `hydrate`, `unmountComponentAtNode` | `createRoot`, `hydrateRoot` | Удалены в React 19 |
| `forwardRef` | `ref` как обычный проп | В React 19 `ref` — проп у функциональных компонентов |
| `<Context.Provider>` | `<Context value={…}>` | React 19 |
| `defaultProps` у функций, `propTypes` | Значения по умолчанию в деструктуризации, TypeScript | Удалены/игнорируются в React 19 |
| `React.FC` с неявным `children` | `function X({ … }: Props)` | Явные props |
| `import React from 'react'` ради JSX | Новый JSX-трансформ | Не нужен с React 17 |
| Загрузка данных в `useEffect` как основной способ | TanStack Query, `loader` роутера, `use()` + Suspense | Гонки, водопады, нет кэша; показываем в 11.2 как проблему |
| Эффект для вычисления производного состояния или «сброса» | Вычисление при рендере, `key` | «You Might Not Need an Effect» |
| `useMemo`/`useCallback` «на всякий случай» | Мемоизация по измерению или React Compiler | Глава 16 |
| Create React App | Vite (или Next / React Router framework) | CRA устарел |
| React Router `<Switch>`, `useHistory`, `component=` (v5) | v8 API | |
| Redux: `createStore`, `connect`, ручные `ACTION_TYPES`, `switch`-редьюсеры | Redux Toolkit | |
| React Query v3/v4: `useQuery(key, fn)`, `isLoading` как «первая загрузка», `cacheTime` | v5: `useQuery({ queryKey, queryFn })`, `isPending`, `gcTime` | |
| antd: статические `message.success()`, `Modal.confirm()` без `App`, `visible`, `destroyOnClose`, `moment` | `App.useApp()`, `open`, `destroyOnHidden`, `dayjs` | Проверить список в antd 6 |
| Строковые `ref`, `findDOMNode`, legacy context (`contextTypes`) | `useRef`, `createContext` | Удалены в React 19 |
| `act` из `react-dom/test-utils`, `react-test-renderer` | `act` из `react`, Testing Library | Проверить |

## Ожидается (из памяти модели) — проверить

Каждый пункт перед использованием в уроке подтвердить по исходникам или запуском и перенести в «Проверено».

### React 19.0–19.3

- Actions: `useActionState` (из `react`), `useFormStatus` (из `react-dom`), `useOptimistic`, `<form action={fn}>`, `formAction` у кнопок, сброс неуправляемой формы после успешного action.
- `use(promise)` и `use(Context)`; промис должен быть кэширован (не создаваться в рендере); `use` можно вызывать в условиях.
- `ref` как проп; колбэк-ref может вернуть функцию очистки; в TS — неявный `return` из колбэк-ref стал ошибкой.
- `<Context value>` как провайдер.
- Метаданные документа: `<title>`, `<meta>`, `<link>` в компоненте поднимаются в `<head>`.
- Таблицы стилей с `precedence`, асинхронные скрипты; `preload`, `preinit`, `preconnect`, `prefetchDNS` из `react-dom`.
- Ошибки: `onCaughtError`, `onUncaughtError`, `onRecoverableError` у `createRoot`; повторные ошибки не дублируются в консоли.
- 19.1: owner stack (`captureOwnerStack`), улучшения Suspense.
- 19.2: `<Activity mode="visible|hidden">`, `useEffectEvent` (стабильный), `cacheSignal` (RSC), Performance Tracks в Chrome DevTools, частичный пререндеринг (`prerender`/`resume`), пакетирование раскрытия Suspense при SSR.
- 19.3: **неизвестно** — прочитать CHANGELOG (`node_modules/react/…` нет changelog — смотреть github.com/facebook/react/releases) и блог react.dev.
- `<ViewTransition>`, `addTransitionType` — статус (canary/experimental или стабильный в 19.3?) — проверить.
- StrictMode в разработке: двойной вызов рендера, инициализаторов `useState`/`useMemo`/`useReducer`, двойной цикл эффектов (mount → unmount → mount), двойной вызов колбэк-ref; в React 19 при двойном рендере повторно используется результат `useMemo`/`useCallback` первого рендера (проверить).
- Автоматическое пакетирование (batching) обновлений везде (с React 18), `flushSync`.
- `useId` — формат идентификаторов (в 19.x поменялся — проверить).

### React Compiler 1.0

- Babel-плагин `babel-plugin-react-compiler`; рантайм — `react/compiler-runtime` (`c` → `_c(n)` кэш); директивы `"use memo"`, `"use no memo"`; режимы `compilationMode` (`infer`, `annotation`, `all`); `panicThreshold`.
- Правила компилятора включены в `eslint-plugin-react-hooks` (7.x, конфиг `recommended`) — проверить состав правил.

### Библиотеки (сверить перед главой)

- **React Router 8**: режимы declarative / data / framework сохранились? `createBrowserRouter` + `RouterProvider` из `react-router/dom` или `react-router`? Типы `Route.LoaderArgs` (typegen — только framework mode?). `useBlocker`, `ScrollRestoration`, `viewTransition` у `Link`. `createRoutesStub`/`createMemoryRouter` для тестов. Что сломалось относительно v7 (журнал изменений).
- **TanStack Query 5**: `isPending` / `isLoading` / `isFetching`, `placeholderData: keepPreviousData`, `queryOptions()`, `useSuspenseQuery`, `throwOnError`, `useMutationState`, `QueryCache({ onError })`.
- **Zustand 5**: `create` без `equalityFn`, `useShallow` из `zustand/react/shallow`, `persist` с `version`/`migrate`, `createWithEqualityFn` в `zustand/traditional`.
- **Redux Toolkit 2**: `createSlice` с `selectors`, `buildCreateSlice`, `combineSlices`, `.withTypes()`, `createListenerMiddleware`.
- **React Hook Form 7.89**: `useForm` с `resolver`, `values`, `disabled`; `useWatch` против `watch`; `subscribe` (новое?).
- **Zod 4**: `z.email()` верхнего уровня, `error` вместо `message`/`errorMap`, `z.treeifyError`/`z.flattenError`, локализация `z.config(z.locales.ru())` — проверить наличие русской локали.
- **antd 6**: удалённые API v5, CSS-переменные по умолчанию, `App`, `ConfigProvider` `theme`, `Form.useWatch`, `Table` `onChange`/`pagination`, `Modal` `destroyOnHidden`, совместимость с React 19 без патча (в v5 был `@ant-design/v5-patch-for-react-19`).
- **TanStack Table 9**, **Jotai 3**, **MSW 3**, **Vitest 5**, **motion 14** — мажорные версии новее памяти модели: всё сверять.

## Как искать в исходниках

```bash
# версия и типы
cat node_modules/react/package.json | grep '"version"'
ls node_modules/@types/react/                   # index.d.ts, canary.d.ts, experimental.d.ts
# что экспортирует пакет (CJS): перечислить ключи
node -e "console.log(Object.keys(require('react')).sort().join('\n'))"
node -e "console.log(Object.keys(require('react-dom')).sort().join('\n'))"
# стабильно ли API: есть в index.d.ts — стабильно; только в canary.d.ts/experimental.d.ts — нет
grep -n 'ViewTransition\|Activity\|useEffectEvent' node_modules/@types/react/index.d.ts node_modules/@types/react/canary.d.ts
# поведение — development-сборка
less node_modules/react-dom/cjs/react-dom-client.development.js
```

zsh: шаблоны с `[`, `?`, `*` — в кавычках; для сложного поиска удобнее Python + `re` (как в angular-learn).
