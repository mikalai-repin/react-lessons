# Прототип: React 19 и библиотеки в браузере без сборщика

Отвечает на вопрос «можно ли сделать превью как в angular-learn, только для React и его экосистемы». Ответ — **да, все риски этапа 0 сняты**. Это справочный код, не часть платформы.

## Запуск

```bash
npm install
npm run vendor      # vendor/*.js (ESM-модули React и библиотек), vendor/typescript.mjs, preview.html
npm run serve       # http://localhost:8766/index.html?url=/catalog
npm run check       # во втором терминале: 4 сценария в headless Chrome
npm run typecheck   # tsc по app/
```

Нужен Chrome (`CHROME_PATH`, по умолчанию путь macOS). 404 на `favicon.ico` безвреден.

## Как устроено

| Файл | Что делает |
|---|---|
| `build-vendor.mjs` | **Один** запуск esbuild со `splitting` по всем точкам входа (`react`, `react-dom/client`, `react-router`, `@tanstack/react-query`, `zustand`, `antd`, …). Общий код (сам React) уходит в общие чанки → у всех библиотек **один экземпляр React** без `external`. CJS-пакеты получают обёртку с именованными экспортами (ключи `require()` в Node). Пишет `vendor/importmap.json` и `preview.html` |
| `compile-core.js` | `ts.transpileModule` (`jsx: react-jsxdev`, inline source map) для `.ts/.tsx`; `.css` → JS-модуль, который вставляет `<style>` при импорте (как Vite); `*.module.css` → переименование классов (`Catalog_item_1l05i`) + карта, `:global(...)` |
| `worker.js` | Воркер компиляции: `vendor/typescript.mjs` + `compile-core.js` |
| `index.html` | Хост: читает `app/*`, компилирует в воркере, отдаёт iframe |
| `runtime.js` | Среда в iframe (упрощённая `preview-runtime.js` из angular-learn): консоль → родитель (+ стек владельцев), подмена `fetch` для `/api/…`, blob-модули через `es-module-lexer` 3 (поля `specifier/start/end/type`) |
| `app/` | Тестовое приложение: `StrictMode`, `createBrowserRouter` + `loader` + `lazy`, `useQuery`, Zustand + `persist`, CSS Modules, antd (`ConfigProvider` + `ru_RU`, тема, `App.useApp().message`, `Table`, `DatePicker` с dayjs `ru`) |

## Что проверено (2026-10-06, Chrome headless, `npm run check`)

Версии: react/react-dom 19.3.0, react-router 8.4.0, @tanstack/react-query 5.104.1, zustand 5.0.15, antd 6.6.5, @ant-design/icons 6.3.4, dayjs 1.11.23, typescript 6.0.3, esbuild 0.28.2.

1. **Компиляция в воркере**: загрузка TypeScript ~90–170 мс; 8 файлов — **32 мс** первый раз, **6 мс** повторно. Первый рендер главной от открытия страницы — ~200 мс; граф модулей грузится ~30 мс.
2. **React**: `useState`, клики. **StrictMode**: `render Counter 1`, `render Counter 2` при монтировании, по два рендера на клик. При ошибке в рендере React рендерит компонент ещё раз (2 клика → рендеры 3–6, третий клик с ошибкой → 7–10) — учесть в уроках про StrictMode и ошибки.
3. **Предупреждения React** — текст с printf-подстановкой (`%s`) надо собирать самим (сделано в `runtime.js`). Стек владельцев в текст предупреждения **не входит** (React 19 отдаёт его через `console.createTask`), но `captureOwnerStack()` из `react` в перехвате `console.error` возвращает его: `at li / at Counter:10:451 / at Array.map / at Counter`. Позиции — в скомпилированном JS: нужен перевод по source map (код есть в angular-learn).
4. **Один экземпляр React**: контексты пересекают границы бандлов — `RouterProvider`, `QueryClientProvider`, `ConfigProvider`/`App` работают, «Invalid hook call» нет.
5. **React Router 8, data mode, без `basename`**: runtime до запуска делает `history.replaceState(null, '', url)` — роутер читает адрес как в корне сайта. Работают: прямой заход на `/games/3` (`loader` → «Игра 3: Зельевары»), клиентский переход по `Link` (`/catalog` → `/games/2`), `lazy`-маршрут (динамический `import()` blob-модуля). Ошибка рендера ловится встроенной границей роутера («Unexpected Application Error!»), `onCaughtError` у `createRoot` вызывается.
6. **React Router 8 предупреждает** при первом заходе на маршрут с `loader`: `No \`HydrateFallback\` element provided to render during initial hydration` — в уроках главы 10 нужен `HydrateFallback` (или объяснить предупреждение).
7. **TanStack Query** + перехват `fetch`: `GET /api/games` уходит в учебный бэкенд. **Zustand** + `persist`: счётчик в шапке («В корзине: 2») из другого компонента.
8. **CSS Modules**: `className` `Catalog_item_1l05i`, цвет из модуля применился; глобальный `styles.css` через `import './styles.css'`.
9. **antd 6**: cssinjs пишет стили в `<head>` iframe (32 `<style>`); цвет темы `colorPrimary: '#7a3b12'` → `rgb(122, 59, 18)`; `App.useApp().message` — «Добавлено в корзину»; локаль `ru_RU` — «Назад»/«Вперед» в пагинации; `DatePicker` + dayjs `ru` — «6 октября 2026». Первый рендер админки (lazy + antd) — ~410 мс на localhost.
10. **Типы**: код `app/` проверяется без ошибок TypeScript **6.0.3 и 5.9** (версия в Monaco 0.57). Ошибки есть только в `.d.ts` зависимостей antd (`@rc-component/image`, `@rc-component/picker`, TS2430) → нужен `skipLibCheck: true` (как в шаблоне Vite) — и в валидаторе, и в Monaco.

## Размеры vendor (development-сборка React)

| | Без минификации | gzip |
|---|---|---|
| Всё (кроме TypeScript) | ~10 МБ | **1,36 МБ** |
| То же с `minify: true` | 6,6 МБ | **0,96 МБ** |
| `antd` (вход + свои чанки) | 3,5 МБ | 0,72 МБ |
| общий чанк `react-dom` | 1,1 МБ | 0,19 МБ |
| `vendor/typescript.mjs` (минифицирован) | 3,4 МБ | — |

Модули загружаются лениво (import map + `import`), поэтому antd и иконки грузятся только в шагах, которые их импортируют. Сборка vendor — **~0,3 с**.

## Решения для платформы (перенесены в `docs/architecture.md`)

- Vendor — один запуск esbuild со `splitting`, обёртки CJS с именованными экспортами, `NODE_ENV=development`; в продакшен-сборке платформы — `minify: true` (предупреждения React остаются).
- JSX — `react-jsxdev`.
- CSS Modules — свой трансформ (как в `compile-core.js`), без PostCSS.
- Роутер — без `basename`: приложение в корне адреса iframe. **Риск:** обычная ссылка `<a href="/catalog">` без роутера вызовет настоящую загрузку iframe по адресу `/catalog` — dev-сервер Vite отдаст туда платформу. В runtime перехватывать клики по ссылкам своего origin без `preventDefault` и превращать их в перезапуск приложения с этого адреса (как ⟳).
- Стек владельцев — через `captureOwnerStack()` в перехвате `console.error` + перевод позиций по source map.
- `skipLibCheck: true` в Monaco и `.content-check/tsconfig.json`.

## Что прототип не проверял

- Monaco с типами `@types/react` и antd в браузере (только `tsc` 5.9 из Node) — время загрузки `.d.ts` antd;
- React Compiler (`@babel/standalone` + `babel-plugin-react-compiler`) в воркере — до главы 16;
- тест-раннер (Vitest-API + Testing Library) и MSW в iframe — до главы 17;
- настоящий учебный бэкенд из angular-learn (здесь заглушка на 3 игры).
