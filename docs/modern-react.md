# Современный React: что верно для версии 19

React и экосистема сильно изменились в 2022–2026 годах. В интернете и в памяти языковых моделей много кода для React 16–18, React Router 5/6, antd 4/5, React Query 3/4, Redux без Toolkit. Этот документ — опора для автора курса: **что проверено** для установленной версии и **что в курсе запрещено**.

Правило: любое утверждение об API проверяется по `.d.ts` (`@types/react`, типы библиотек) и коду (`node_modules/react-dom/cjs/react-dom-client.development.js` и т. п.) **установленной версии**, а поведение — запуском в превью. Новое проверенное — добавлять в таблицу «Проверено» с источником.

> **Состояние (2026-10-06):** в таблице «Проверено» — факты из `npm view` и спайка `spikes/esm-preview/`. Раздел «Ожидается (из памяти модели) — проверить» — черновик, его нельзя использовать в уроках без проверки.

## Проверено

| Факт | Источник |
|---|---|
| Последние версии на 2026-10-06: `react`/`react-dom` 19.3.0 (идут канареечные 19.3.x), `react-router` 8.4.0, `antd` 6.6.5, `@tanstack/react-query` 5.104.1, `zustand` 5.0.15, `@reduxjs/toolkit` 2.13.0, `react-hook-form` 7.89.0, `zod` 4.6.5, `vitest` 5.0.3, `next` 16.3.8, `babel-plugin-react-compiler` 1.0.0, `typescript` 7.0.2 (Go) | `npm view <пакет> version` |
| В `react@19.3.0` поле `exports`: `.`, `./jsx-runtime`, `./jsx-dev-runtime`, `./compiler-runtime` — только CJS (`default: ./index.js`) и условие `react-server`; ESM-сборки нет | `npm view react@19.3.0 exports` |
| `react-router@8.4.0`: `peerDependencies` `react >=19.2.7`, `react-dom >=19.2.7`; `engines.node >=22.22.0` | `npm view` |
| `antd@6.6.5`: `peerDependencies` `react >=18.0.0` | `npm view` |
| `next@16.3.8`: peer `react ^18.2.0 \|\| ^19.0.0`, опционально `babel-plugin-react-compiler` | `npm view` |
| `react-dom@19.3.0` экспортирует: `createPortal`, `flushSync`, `preconnect`, `prefetchDNS`, `preinit`, `preinitModule`, `preload`, `preloadModule`, `requestFormReset`, `unstable_batchedUpdates`, `useFormState`, `useFormStatus`, `version` (+ внутренний `__DOM_INTERNALS…`); у `react` — 46 ключей. Подпути `react-dom`: `client`, `server*`, `static*`, `profiling`, `test-utils` | `Object.keys(require(…))`, `package.json` |
| Пакеты: `react`, `react-dom`, `dayjs` — только CJS; `react-router` 8, `@tanstack/react-query` 5 — ESM (`type: module`); `zustand` 5 — `exports` с ESM; `antd` 6 и `@ant-design/icons` 6 — CJS с ESM в поле `module` (`es/`), у `antd` нет `exports` | `package.json`, спайк |
| **StrictMode** (dev): при монтировании компонент рендерится дважды; на каждый клик с обновлением состояния — два рендера. Если рендер бросает ошибку, React повторяет рендер (лог: 2 клика → рендеры 3–6, клик с ошибкой → 7–10) | спайк, лог `render Counter N` |
| Предупреждение про `key`: `Each child in a list should have a unique "key" prop.` + `Check the render method of \`Counter\`. See https://react.dev/link/warning-keys for more information.` — в `console.error` шаблоном `%s%s`; стека компонентов в тексте нет, `captureOwnerStack()` в перехвате `console.error` возвращает стек владельцев | спайк |
| React Router 8 (data mode): `createBrowserRouter` из `react-router`, `RouterProvider` из `react-router/dom`; `loader`, `lazy: async () => ({ Component })`, `useLoaderData`, `useParams`, `Link` работают; ошибка рендера без `errorElement` → встроенная граница «Unexpected Application Error!» (+ `console.error` «React Router caught the following error during render»), при этом вызывается `onCaughtError` у `createRoot`. Первый заход на маршрут с `loader` без `HydrateFallback` → `console.warn` «No \`HydrateFallback\` element provided to render during initial hydration» | спайк |
| antd 6.6.5 работает с React 19.3 без патча; `ConfigProvider` (`locale={ruRU}`, `theme.token.colorPrimary`), `App.useApp().message`, `Table`, `DatePicker` + `dayjs.locale('ru')` («6 октября 2026»), пагинация «Назад»/«Вперед»; стили — `<style>` в `<head>` (cssinjs) | спайк |
| `.d.ts` antd 6.6.5 (через `@rc-component/image`, `@rc-component/picker`) не проходят `tsc` без `skipLibCheck` (TS2430) ни в 5.9, ни в 6.0 | `tsc -p spikes/esm-preview` |
| **Экспорты `react@19.3.0`** (development): `Activity`, `Children`, `Component`, `Fragment`, `Profiler`, `PureComponent`, `StrictMode`, `Suspense`, **`ViewTransition`**, `act`, **`addTransitionType`**, `cache`, `cacheSignal`, `captureOwnerStack`, `cloneElement`, `createContext`, `createElement`, `createRef`, `forwardRef`, `isValidElement`, `lazy`, `memo`, `startTransition`, `unstable_useCacheRefresh`, `use`, `useActionState`, `useCallback`, `useContext`, `useDebugValue`, `useDeferredValue`, `useEffect`, `useEffectEvent`, `useId`, `useImperativeHandle`, `useInsertionEffect`, `useLayoutEffect`, `useMemo`, `useOptimistic`, `useReducer`, `useRef`, `useState`, `useSyncExternalStore`, `useTransition`, `version` | `Object.keys(require('react'))` |
| **`ViewTransition`, `addTransitionType`, `Activity`, `useEffectEvent`, `cacheSignal`, `captureOwnerStack` — стабильные** в 19.3: объявлены в `@types/react@19.3.0/index.d.ts`, в `canary.d.ts`/`experimental.d.ts` их нет. `forwardRef` в типах **не** помечен `@deprecated` (в курсе всё равно не используем: `ref` — обычный проп) | `grep` по `@types/react` |
| `<title>` внутри компонента React 19 переносит в `<head>`: заголовок вкладки превью меняется при смене страницы («Каталог — Ход конём» → «Остров сокровищ — Ход конём») | `checks/platform.mjs` |
| **StrictMode + `useQuery` с `signal`**: первый запрос при монтировании отменяется (StrictMode монтирует, размонтирует и снова монтирует компонент; Query отменяет запрос без наблюдателей) — во вкладке «Сеть» первая строка `/api/games?q=` «отменён», вторая — 200. Хороший эксперимент для глав 6 и 11 | `checks/platform.mjs`, скриншот |
| Ошибка рендера: React 19 пишет `console.error` шаблоном `%o\n\n%s\n\n%s\n` — ошибка, «The above error occurred in the <NotFound> component.», «React will try to recreate this component tree from scratch using the error boundary you provided, RenderErrorBoundary.» (граница роутера) | `checks/preview.mjs` |
| **`root.render` рисует не сразу**: сразу после вызова `container.innerHTML` пуст, в микрозадаче, `requestAnimationFrame` и `setTimeout(0)` — тоже; разметка появляется отдельной задачей (в превью ~9 мс, `setTimeout(…, 5)` уже видит её). `flushSync(() => root.render(…))` рисует синхронно | эксперимент главы 1, `checks/ch01-first-app.mjs` |
| Компонент с маленькой буквы (`<app />`): React создаёт DOM-элемент `<app>` и пишет `The tag <app> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter.`; TypeScript — `TS2339: Property 'app' does not exist on type 'JSX.IntrinsicElements'` | `checks/ch01-first-app.mjs`, `tsc` |
| Два корневых элемента без обёртки: `JSX expressions must have one parent element.` (синтаксическая ошибка TS, номер строки — первого элемента) | `checks/ch01-first-app.mjs` |
| Ошибка рендера без границы ошибок (`createRoot` без `onUncaughtError`): `console.warn` «An error occurred in the <App> component.\n\nConsider adding an error boundary to your tree to customize error handling behavior.\nVisit https://react.dev/link/error-boundaries …» + необработанная ошибка (`window.reportError`); всё дерево размонтировано, страница пустая | `checks/ch01-first-app.mjs` |
| Лишний проп у компонента без props: `TS2322: Type '{ title: string; }' is not assignable to type 'IntrinsicAttributes'. Property 'title' does not exist on type 'IntrinsicAttributes'.` — позиция на атрибуте; TS 5.9 и 6.0 одинаково | `tsc`, Monaco |
| JSX → `jsxDEV(тип, props, key, isStaticChildren, { fileName, lineNumber, columnNumber }, this)` из `react/jsx-dev-runtime` (TS `jsx: react-jsxdev`); не-ASCII символы в строках TS записывает `\uXXXX`. React-элемент: ключи `$$typeof`, `type`, `key`, `props`, `_owner`, `_store` (два последних — dev), `key` по умолчанию `null`, элемент и `props` заморожены (`Object.isFrozen`) | `compile-core`, `checks/ch01-first-app.mjs` |
| `createElement(type, props, ...children)` в React 19 есть и работает: тот же элемент, что из JSX (те же ключи, `$$typeof`, заморожен); `key` из props → `element.key` (в `props` его нет); дочерние аргументы → массив `props.children`. Старый трансформ (TS `jsx: react`) даёт `React.createElement(…)`, без `import React` — `ReferenceError: React is not defined` | превью (`run-dir.mjs`), `ts.transpileModule` |
| В превью (как в Vite) код с синтаксической ошибкой не запускается — платформа показывает «Сборка не прошла»; ошибки типов запуск не останавливают | `checks/platform.mjs` |
| В development React пишет в консоль `console.info` «Download the React DevTools for a better development experience: https://react.dev/link/react-devtools» — превью его не показывает (расширение не видит iframe) | превью |
| JSX-значения: `0`, `NaN` рисуются; `null`, `undefined`, `true`, `false`, `''` — нет; массив — элементы подряд (`[0][][][][][][NaN][123]`). Объект → `Objects are not valid as a React child (found: object with keys {min, max}). If you meant to render a collection of children, use an array instead.` (TS: `Type '{ … }' is not assignable to type 'ReactNode'.`) | `checks/ch02-jsx.mjs` |
| `class` вместо `className`: React ставит атрибут `class` (работает) и пишет `Invalid DOM property `class`. Did you mean `className`?`; TS — `… Did you mean 'className'?`. Неизвестные атрибуты (`madeup="3"`) React передаёт в DOM; TS не проверяет имена с дефисом | `checks/ch02-jsx.mjs`, `tsc` |
| `style` строкой → ошибка рендера `The `style` prop expects a mapping from style properties to values, not a string. …`; числа → `px`, кроме безразмерных (`lineHeight`, `opacity`) | `checks/ch02-jsx.mjs` |
| Без `key`: `Each child in a list should have a unique "key" prop.` + `Check the render method of `App`. See https://react.dev/link/warning-keys …`, стек владельцев ведёт к строке элемента в `map`; одинаковые ключи: `Encountered two children with the same key, `family`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.` TS о `key` молчит | `checks/ch02-jsx.mjs` |
| Переворот списка из 4 `<li>` с полями: `key={index}` — 4 замены текста, 0 перестановок, значение поля остаётся на позиции; `key={id}` — 3 перестановки (`placeChild`, `lastPlacedIndex`), значение уезжает с элементом; `key={Math.random()}` — 4 узла пересозданы | `MutationObserver`, `checks/ch02-jsx.mjs`, `reconcileChildrenArray` в `react-dom-client.development.js` |
| `dangerouslySetInnerHTML` HTML **не очищает**: `<img onerror>` выполняется, `<script>` (через `innerHTML`) — нет. `children` вместе с ним → `Can only set one of `children` or `props.dangerouslySetInnerHTML`.` (TS не ловит) | `checks/ch02-jsx.mjs` |
| **`javascript:`-адреса React 19 блокирует** в `href`, `src`, `action`, `formAction`, `xlinkHref`: атрибут заменяется на `javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')`, при рендере предупреждения нет, щелчок — ошибка. Внутри `dangerouslySetInnerHTML` — не блокирует (код выполняется). Проверка — регулярное выражение `isJavaScriptProtocol` (только `javascript:`, не `data:`) | `sanitizeURL` в `react-dom-client.development.js`, `checks/ch02-jsx.mjs` |
| `<>…</>` → `jsxDEV(Fragment, …)`, `Fragment` импортируется из `react/jsx-dev-runtime`; в DOM фрагмента нет; `<>` в списке → предупреждение про `key` | `transpileModule`, `checks/ch02-jsx.mjs` |
| `key` не попадает в props: `jsxDEV(GameCard, { game }, game.id, …)`; чтение `props.key` → `undefined` и один раз `console.error` «GameCard: \`key\` is not a prop. Trying to access it will result in \`undefined\` being returned. …»; TS — `Property 'key' does not exist on type 'GameCardProps'` | `checks/ch03-components.mjs`, `react-jsx-dev-runtime.development.js` |
| Props в dev заморожены неглубоко: `props.game = …` → `TypeError: Cannot assign to read only property 'game' of object '#<Object>'`, `props.game.tags.push(…)` проходит; в продакшен-сборке (`react-jsx-runtime.production.js`) `Object.freeze` нет | `checks/ch03-components.mjs`, исходники |
| `defaultProps` у функциональных компонентов в React 19 игнорируются **молча** (без предупреждения); `propTypes` — `@deprecated`, «Ignored by React» в `@types/react` 19.3 | `checks/ch03-components.mjs`, `index.d.ts` |
| `FC<P>` в `@types/react` 19.3 — `(props: P) => ReactNode \| Promise<ReactNode>`, без неявного `children` (в 17.x было `PropsWithChildren<P>`); `ComponentProps<'button'>` включает `ref` и `children`; есть `ComponentPropsWithoutRef` | `index.d.ts` 19.3 и 17.0.80 |
| Функция вместо элемента в `children` → `console.error` «Functions are not valid as a React child. This may happen if you return GameCard instead of <GameCard /> from render. …»; TS — `… is not assignable to type 'ReactNode'` | `checks/ch03-components.mjs` |
| Компонент, вызванный функцией (`GameCard({ game })`), не получает файбера: в цепочке `__reactFiber$….return` его нет, предупреждение про `key` — «Check the render method of \`App\`»; фрагмент на верхнем уровне компонента тоже не даёт файбера, `StrictMode` даёт (`react.strict_mode`), корень — `type: null` | `checks/ch03-components.mjs` |
| Порядок рендера — обход в глубину по элементам; в StrictMode каждый компонент вызывается дважды подряд (лог `App App Header Header Section Section Badge Badge …`) | `checks/ch03-components.mjs` |
| `eslint-plugin-react-hooks@7.1.1` содержит правила компилятора, среди них `purity`, `immutability`, `static-components`, `refs`, `set-state-in-render`, `set-state-in-effect`, `no-deriving-state-in-effects` | `npm pack`, имена правил в `cjs/` |
| **Состояние и рендер** (StrictMode): клик с `setState` в карточке → рендер только этой карточки, по 2 вызова; изменение обычной переменной рендер не запускает; `set(x)` того же значения (и `set(prev => prev)`) — ни одного вызова компонента; состояние в `App` → `App`, `Header` и все 9 карточек по 2 раза, а в DOM 1–3 изменения (`MutationObserver`) | `checks/ch04-state.mjs` |
| Снимок и очередь: три `set(n + 1)` → +1, `console.log(n)` после — старое; три `set(n => n + 1)` → +3; `set(n + 5); set(n => n + 1)` → 6; `set(n => n + 1); set(42)` → 42; функция обновления в StrictMode вызывается **дважды** с одним аргументом (мутация в ней даёт +2 за клик) | `checks/ch04-state.mjs` |
| Пакетная обработка: несколько `set` в обработчике, в `setTimeout`, после `await` — один рендер на пачку; `flushSync(() => set…)` рендерит сразу (DOM обновлён на следующей строке) | `checks/ch04-state.mjs` |
| `onClick={handler()}` с `setState` внутри → `Too many re-renders. React limits the number of renders to prevent an infinite loop.`, приложение падает; TS — `Type 'void' is not assignable to type 'MouseEventHandler<HTMLButtonElement> \| undefined'.` Хук в обработчике → `Invalid hook call. Hooks can only be called inside of the body of a function component. …` (TS молчит) | `checks/ch04-state.mjs` |
| Объект события: `e.constructor.name` — `SyntheticBaseEvent`, `e.nativeEvent` у щелчка — `PointerEvent`; тип — `MouseEvent<HTMLButtonElement>` из `react` | `checks/ch04-state.mjs` |
| `push` + `setState(тот же массив)` — рендера нет (`Object.is`), мутация всплывает при следующем «правильном» обновлении; `useState([])` без типа — `never[]` | `checks/ch04-state.mjs`, `tsc` |
| Файбер `App` надёжно брать от корня: `container.__reactContainer$….stateNode.current.child.child` (через `StrictMode`); `__reactFiber$` у DOM-узла может указывать на отставшую копию (двойная буферизация), `memoizedState` — первый хук, `.next` — следующий | `checks/ch04-state.mjs` |
| Отправка формы без `preventDefault` в превью — перезапуск приложения с адреса формы (`/?email=…`), консоль платформы очищается (как ⟳); перехват — `submit` в `preview-runtime.js` | `checks/platform.mjs`, `checks/ch04-state.mjs` |
| **Поля ввода**: `value` без `onChange` — поле только для чтения (ввод не меняет его) и `console.error` «You provided a \`value\` prop to a form field without an \`onChange\` handler. This will render a read-only field. If the field should be mutable use \`defaultValue\`. Otherwise, set either \`onChange\` or \`readOnly\`.»; у флажка то же с `checked` и советом `defaultChecked`; `value` `undefined` → строка — «A component is changing an uncontrolled input to be controlled. …», строка → `undefined` — «… a controlled input to be uncontrolled …»; `selected` у `<option>` — «Use the \`defaultValue\` or \`value\` props on <select> instead of setting \`selected\` on <option>.»; `onChange` у `<input>` — на каждую букву (2 буквы = 4 рендера в StrictMode) | `checks/ch05-structure.mjs` |
| `defaultValue` после монтирования: текст поля не меняется, React обновляет только атрибут `value` (поле «v1», атрибут «v2»); `form.reset()` возвращает `defaultValue`/`defaultChecked`; неотмеченного флажка в `FormData` нет (`get` → `null`); ввод в неуправляемые поля рендера не вызывает | `checks/ch05-structure.mjs` |
| **`@types/react` 19.3: `FormEvent` и `FormEventHandler` — `@deprecated`** («FormEvent doesn't actually exist»); для `onSubmit` — `SubmitEvent<HTMLFormElement>` (`submitter`, `target: HTMLFormElement`), для полей — `ChangeEvent` | `index.d.ts` |
| `useState(props.n)` — копия не обновляется при новых props; `useState(null)` без типа → `SetStateAction<null>` (TS2345 на `set(число)`); инициализатор `useState(() => …)` вызывается только при создании состояния, в StrictMode — дважды | `checks/ch05-structure.mjs` |
| **`useReducer`**: `dispatch` ничего не вычисляет и возвращает `undefined`; редьюсер вызывается во время рендера (лог «после dispatch» раньше редьюсера), в StrictMode — дважды с одним состоянием; тип состояния выводится из редьюсера (`useReducer(reducer, [])` — не `never[]`). Внутри React `useState` при обновлении — `updateReducer(basicStateReducer)` | `checks/ch05-structure.mjs`, `react-dom-client.development.js` |
| **Позиция в дереве**: файбер переиспользуется, только если на том же месте совпали `key` и тип (`updateElement`: `current.elementType === element.type` → `useFiber`, иначе `createFiberFromElement`); `{cond && <X/>}` с `false` держит место (индекс соседей не меняется); тернарный оператор с одним типом в обеих ветках сохраняет состояние, два `&&`, разные `key` или обёртка `<div>` — сбрасывают | `checks/ch05-structure.mjs`, исходники |
| **Immer 11.1.21 / use-immer 0.11.0**: `produce` не трогает исходник, новые только объекты на пути к изменению (`next[1] === base[1]`), результат заморожен (`Object.isFrozen`); изменение замороженного состояния вне редьюсера — `TypeError: Cannot assign to read only property …` (TS молчит); и мутация черновика, и `return` — «[Immer] An immer producer returned a new value *and* modified its draft. …» (ошибка рендера); `useImmerReducer` в StrictMode вызывает редьюсер дважды, но каждый раз со своим черновиком (+1, а не +2); `useImmerReducer(reducer, [])` выводит `never[]` — нужна константа с типом; `useImmer` замораживает и начальное значение | `checks/ch05-structure.mjs`, `checks/preview.mjs`, `dist/index.d.ts` |

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
- ✅ `<ViewTransition>`, `addTransitionType` — стабильные в 19.3 (см. «Проверено»); поведение — проверить запуском перед главой 12.
- StrictMode в разработке: двойной вызов рендера, инициализаторов `useState`/`useMemo`/`useReducer`, двойной цикл эффектов (mount → unmount → mount), двойной вызов колбэк-ref; в React 19 при двойном рендере повторно используется результат `useMemo`/`useCallback` первого рендера (проверить).
- ✅ Двойной вызов инициализатора `useState` и редьюсера `useReducer` в StrictMode — проверено (глава 5).
- ✅ Автоматическое пакетирование (batching) обновлений везде (с React 18), `flushSync` — проверено (см. «Проверено», глава 4).
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
