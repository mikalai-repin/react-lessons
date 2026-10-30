# Современный React: что верно для версии 19

React и экосистема сильно изменились в 2022–2026 годах. В интернете и в памяти языковых моделей много кода для React 16–18, React Router 5/6, antd 4/5, React Query 3/4, Redux без Toolkit. Этот документ — опора для автора курса: **что проверено** для установленной версии и **что в курсе запрещено**.

Правило: любое утверждение об API проверяется по `.d.ts` (`@types/react`, типы библиотек) и коду (`node_modules/react-dom/cjs/react-dom-client.development.js` и т. п.) **установленной версии**, а поведение — запуском в превью. Новое проверенное — строкой в файл по теме в `docs/facts/`, с источником.

> **Состояние (2026-10-30):** в `docs/facts/` — факты из `npm view`, спайка `spikes/esm-preview/` и глав 1–10. Раздел «Ожидается (из памяти модели) — проверить» — черновик, его нельзя использовать в уроках без проверки.

## Проверено

Проверенные факты (с источником) лежат по темам в `docs/facts/`. Целиком их читать не нужно: перед главой откройте файл по теме главы, остальное ищите поиском по имени API (`grep -rn 'useOptimistic' docs/facts`).

| Файл | Что внутри |
|---|---|
| [facts/render.md](facts/render.md) | JSX и элементы, атрибуты, списки и ключи, props, StrictMode, ошибки рендера, `createRoot` (главы 1–3) |
| [facts/state.md](facts/state.md) | Состояние, события, поля и формы, `useReducer`, ссылки, эффекты, правила хуков, контекст, свой стор (главы 4–9) |
| [facts/ecosystem.md](facts/ecosystem.md) | Immer, Zustand, Jotai, React Router 8, TanStack Query, antd |
| [facts/tooling.md](facts/tooling.md) | Версии и экспорты пакетов, ESM/CJS, особенности превью, приёмы для опытов, ESLint-плагин, шаблон Vite |

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
| React Query v3/v4: `useQuery(key, fn)`, `isLoading` как «первая загрузка», `cacheTime`, `keepPreviousData: true`, `onSuccess` у `useQuery` | v5: `useQuery({ queryKey, queryFn })`, `isPending`, `gcTime`, `placeholderData: keepPreviousData` | |
| `queryClient.ensureQueryData`, `fetchQuery`, `prefetchQuery` (5.104: `@deprecated`) | `queryClient.query(…)` (+ `staleTime: 'static'` / `.catch(noop)`) | Глава 11.7, `facts/ecosystem.md` |
| antd: статические `message.success()`, `Modal.confirm()` без `App`, `visible`, `destroyOnClose`, `moment` | `App.useApp()`, `open`, `destroyOnHidden`, `dayjs` | Проверить список в antd 6 |
| Строковые `ref`, `findDOMNode`, legacy context (`contextTypes`) | `useRef`, `createContext` | Удалены в React 19 |
| `act` из `react-dom/test-utils`, `react-test-renderer` | `act` из `react`, Testing Library | Проверить |

## Ожидается (из памяти модели) — проверить

Каждый пункт перед использованием в уроке подтвердить по исходникам или запуском и перенести в `docs/facts/`.

### React 19.0–19.3

- Actions: `useActionState` (из `react`), `useFormStatus` (из `react-dom`), `useOptimistic`, `<form action={fn}>`, `formAction` у кнопок, сброс неуправляемой формы после успешного action.
- ✅ `use(promise)` + `<Suspense>`: промис из `loader`, промис в рендере — бесконечные запросы без предупреждения (глава 11, `facts/render.md`). ✅ `use(Context)` и вызов в условиях — проверено (глава 8).
- ✅ `ref` как проп; колбэк-ref может вернуть функцию очистки; в TS — неявный `return` из колбэк-ref стал ошибкой — проверено (глава 6).
- ✅ `<Context value>` как провайдер — проверено (глава 8).
- Метаданные документа: `<title>`, `<meta>`, `<link>` в компоненте поднимаются в `<head>`.
- Таблицы стилей с `precedence`, асинхронные скрипты; `preload`, `preinit`, `preconnect`, `prefetchDNS` из `react-dom`.
- Ошибки: `onCaughtError`, `onUncaughtError`, `onRecoverableError` у `createRoot`; повторные ошибки не дублируются в консоли.
- 19.1: owner stack (`captureOwnerStack`), улучшения Suspense.
- 19.2: `<Activity mode="visible|hidden">`, `useEffectEvent` (стабильный), `cacheSignal` (RSC), Performance Tracks в Chrome DevTools, частичный пререндеринг (`prerender`/`resume`), пакетирование раскрытия Suspense при SSR.
- 19.3: **неизвестно** — прочитать CHANGELOG (`node_modules/react/…` нет changelog — смотреть github.com/facebook/react/releases) и блог react.dev.
- ✅ `<ViewTransition>`, `addTransitionType` — стабильные в 19.3 (`facts/tooling.md`); поведение — проверить запуском перед главой 12.
- StrictMode в разработке: двойной вызов рендера, инициализаторов `useState`/`useMemo`/`useReducer`, двойной цикл эффектов (mount → unmount → mount), двойной вызов колбэк-ref (✅ эффекты и колбэк-ref — проверено, глава 6); в React 19 при двойном рендере повторно используется результат `useMemo`/`useCallback` первого рендера (проверить).
- ✅ Двойной вызов инициализатора `useState` и редьюсера `useReducer` в StrictMode — проверено (глава 5).
- ✅ Автоматическое пакетирование (batching) обновлений везде (с React 18), `flushSync` — проверено (`facts/state.md`, глава 4).
- `useId` — формат идентификаторов (в 19.x поменялся — проверить).

### React Compiler 1.0

- Babel-плагин `babel-plugin-react-compiler`; рантайм — `react/compiler-runtime` (`c` → `_c(n)` кэш); директивы `"use memo"`, `"use no memo"`; режимы `compilationMode` (`infer`, `annotation`, `all`); `panicThreshold`.
- Правила компилятора включены в `eslint-plugin-react-hooks` (7.x, конфиг `recommended`) — проверить состав правил.

### Библиотеки (сверить перед главой)

- ✅ **React Router 8** — проверено в главе 10 (`facts/ecosystem.md`). Осталось сверить к главам 14 и 17: `createRoutesStub`/`createMemoryRouter` для тестов, middleware и `context` в data mode.
- ✅ **TanStack Query 5.104** — проверено в главе 11 (`facts/ecosystem.md`): умолчания, статусы, `queryOptions`, `keepPreviousData`, `useSuspenseQuery`, `queryClient.query`, мутации, `useInfiniteQuery`, устройство кэша. Осталось к главам 14 и 18: `throwOnError`, `useMutationState`, `QueryCache({ onError })`, `meta`.
- ✅ **Zustand 5** — проверено в главе 9 (`facts/ecosystem.md`): `create` без `equalityFn`, `useShallow` из `zustand/react/shallow`, `persist` с `version`/`migrate`, `createWithEqualityFn` в `zustand/traditional`.
- **Redux Toolkit 2**: `createSlice` с `selectors`, `buildCreateSlice`, `combineSlices`, `.withTypes()`, `createListenerMiddleware`.
- **React Hook Form 7.89**: `useForm` с `resolver`, `values`, `disabled`; `useWatch` против `watch`; `subscribe` (новое?).
- **Zod 4**: `z.email()` верхнего уровня, `error` вместо `message`/`errorMap`, `z.treeifyError`/`z.flattenError`, локализация `z.config(z.locales.ru())` — проверить наличие русской локали.
- **antd 6**: удалённые API v5, CSS-переменные по умолчанию, `App`, `ConfigProvider` `theme`, `Form.useWatch`, `Table` `onChange`/`pagination`, `Modal` `destroyOnHidden`, совместимость с React 19 без патча (в v5 был `@ant-design/v5-patch-for-react-19`).
- ✅ **Jotai 3** — проверено в главе 9. **TanStack Table 9**, **MSW 3**, **Vitest 5**, **motion 14** — мажорные версии новее памяти модели: всё сверять.

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
