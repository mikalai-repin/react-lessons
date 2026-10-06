# Архитектура платформы

> **Состояние: этап 1 готов (2026-10-06).** Всё, что ниже не помечено «план», реализовано и проверено `tools/e2e/checks/preview.mjs` и `platform.mjs` (в dev-режиме и на продакшен-сборке). Технические решения сначала проверены спайком `spikes/esm-preview/`. После каждого этапа — переписать соответствующий раздел из «план» в «как сделано и проверено», как в `../angular-learn/docs/architecture.md`.

Статический сайт без бэкенда. Весь код ученика компилируется и выполняется в браузере. Основа — платформа `../angular-learn` (Vite 8 + React 19 + Monaco 0.57 + markdown-it + Shiki + Prettier), ~7,5 тыс. строк. Она уже написана на React, поэтому интерфейс, навигация, прогресс, рендер уроков, превью-протокол, учебный бэкенд и e2e-инструменты переносятся почти без изменений.

## Интерфейс

Тот же, что в angular-learn (см. `../angular-learn/docs/architecture.md`, «Интерфейс»): три панели (урок / код / результат), адресная строка превью (←, →, ⟳, ввод адреса = перезапуск), заголовок вкладки, консоль (метки `TS`, `Сборка`, схлопывание повторов), вкладка «Сеть» (задержка, ошибка 500, тело запроса), дерево файлов, сворачивание панелей, «Решение» / «Вернуть мой код» / «Сброс», автозапуск через 1 с, `Ctrl/Cmd+Enter`, «Формат».

Отличия для React (этап 1 — сделано, кроме помеченного «этап N»):

| Элемент | Что меняется |
|---|---|
| Вкладки файлов | `.tsx`, `.ts`, `.css`, `.module.css`; порядок без `files`: `main.tsx`, `App.tsx`, затем по папкам; `X.tsx` и `X.module.css` рядом |
| Консоль | Ссылки на `https://react.dev/errors/<код>` (минифицированные ошибки) и owner stack из предупреждений React. Значения: React-элементы — `<GameCard />`, хуки — как есть |
| Подсветка | Monaco — встроенная грамматика `typescript` (JSX-теги подсвечиваются слабо — технический долг), темы `vs`/`vs-dark`. Shiki в тексте урока — `tsx`, `typescript`, `css`, `html`, `json`, `bash` (`ts` → `typescript`, `jsx` → `tsx`) |
| Дерево файлов | Значок `TSX` для `.tsx` |
| Типы в Monaco | `.d.ts` по настоящим путям `file:///node_modules/…` (`@types/react`, `@types/react-dom`, `csstype`, `react-router/dist/production`, `@tanstack/{react-query,query-core}/build/modern`, `zustand`) + заглушки `<подпуть>/index.d.ts` по полю `exports` (`typesOf` ищет условие `types` во вложенных условиях); `jsx: ReactJSX`, `skipLibCheck: true`; `declare module '*.module.css'` / `'*.css'` — как `vite/client` |
| Вкладка «Тесты» | Этап 4 (глава 17): раннер с API Vitest + Testing Library |
| Вкладка «Скомпилировано» | Этап 5: JS после TS для выбранного файла; с переключателем «React Compiler» — после Babel-плагина компилятора (главы 1, 16, 21) |
| Вкладка «Рендеры» (по возможности) | Этап 5: лог рендеров компонентов (через `<Profiler>` или хук DevTools) — для глав 8, 16 |

## Стек

| Задача | Решение | Почему |
|---|---|---|
| Сборка платформы | Vite 8 + TypeScript 6.0 | Как в angular-learn |
| UI платформы | React 19, `react-router`, `react-resizable-panels` | Код из angular-learn |
| Редактор | Monaco Editor 0.57 (встроенный TS 5.9) | TSX и типы `react`, `@types/react` и библиотек; проверить, что типы библиотек не требуют TS 6+ |
| Компиляция TSX → JS | Веб-воркер: **TypeScript 6 `transpileModule`**, `jsx: react-jsxdev` (решено в спайке: 8 файлов — 32 мс, повторно 6 мс) | Один и тот же модуль `shared/compile-core.js` в браузере, валидаторе и e2e (как в angular-learn). TS-трансформ проще Babel и уже есть в vendor |
| React Compiler | `@babel/standalone` + `babel-plugin-react-compiler` в воркере, **по запросу** (вкладка «Скомпилировано», режим главы 16) | Компилятор существует только как Babel-плагин (проверить, нет ли SWC/oxc-версии для браузера) |
| CSS Modules | Свой трансформ без PostCSS (решено, код — `spikes/esm-preview/compile-core.js`): `X.module.css` → JS-модуль, который вставляет `<style>` с классами `X_cls_hash` и экспортирует карту; `:global(...)` | Vite поддерживает CSS Modules из коробки — код курса переносится в настоящий проект без изменений |
| Глобальные стили | `import './styles.css'` в `main.tsx` → JS-модуль, вставляющий `<style>` при импорте (порядок стилей = порядок импортов) | Как в Vite |
| Форматирование | Prettier 3.9 (`typescript` для `.ts`/`.tsx`, `postcss` для CSS), настройки `shared/lesson-prettier.json` | Как в angular-learn; парсер `angular` не нужен |
| Markdown уроков | `markdown-it` + контейнеры + Shiki (`tsx`) | Как в angular-learn |
| Прогресс | `localStorage`, ключ `react-course:v1` | |
| Порт | **5190** (`strictPort`) | 5173/5174 — PixiJS, 5180 — Angular |

## Версии

Фиксируются **точно** (без `^`) в `package.json` и `content/course.json` (`reactVersion`): `react`, `react-dom`, все библиотеки превью (`docs/libraries.md`), `typescript` 6.0.x, `monaco-editor` 0.57.0. Обновление — только между главами, с прогоном `validate`, `checks/*` и `run-chapter` по всем главам.

## Vendor: `scripts/copy-vendor.mjs`

**Проблема:** `react`, `react-dom` и многие библиотеки публикуются только в **CommonJS** (у `react@19.3.0` в `exports` нет ESM-сборки), а превью работает на нативных ES-модулях через import map. Кроме того, у всех библиотек должен быть **один экземпляр React**, иначе «Invalid hook call».

**Решение** (`scripts/copy-vendor.mjs`, ~0,35 с):

0. Список модулей превью — `PREVIEW_MODULES` в начале скрипта (сейчас 11: `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, `react-dom/client`, `react-router`, `react-router/dom`, `@tanstack/react-query`, `zustand`, `zustand/middleware`, `zustand/react/shallow`). Библиотека главы добавляется туда, в `package.json` (точная версия, `devDependencies` — в бандл платформы не попадает) и её `.d.ts` — в `src/editor/monaco.ts`. Формат пакета (ESM или CJS) определяется сам: пробная сборка `export * from '<пакет>'` — если esbuild не нашёл ни одного имени, это CJS, и генерируется обёртка с ключами `require()`.

1. **Один запуск esbuild со `splitting: true`** по всем точкам входа (обёртки — в `node_modules/.cache/vendor-entries/`) (`react`, `react-dom/client`, `react-router`, `antd`, …), `format: esm`. Общий код (сам React) попадает в общие чанки `vendor/chunks/`, поэтому у всех библиотек один экземпляр React — без `external` и договорённостей между бандлами. Цена: добавление библиотеки пересобирает весь vendor (~0,3 с — не проблема).
2. Для CJS-пакетов (`react`, `react-dom`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom/client`, `scheduler`) — ESM-обёртка с **именованными** экспортами: Node загружает модуль, перечисляет `Object.keys(require(...))` и генерирует `export const { useState, … } = mod; export default mod;` (так делает esm.sh). Без этого `import { useState } from 'react'` не работает.
3. `process.env.NODE_ENV` → `'development'` (`define` в esbuild): ученик должен видеть предупреждения React. Development-сборка React заметно больше — приемлемо.
4. Подпути — по полю `exports` каждого пакета (в спайке — явный список; у `antd` поля `exports` нет: локаль брать из `antd/es/locale/ru_RU`, иначе CJS-версия даёт `{ default }`) (`react-dom/client`, `react-router/dom`, `motion/react`, `@tanstack/react-query`, `zustand/middleware`, `antd/locale/ru_RU` и т. п.) — генерировать карту автоматически, как в angular-learn (26 записей для Angular).
5. `public/preview.html` из `scripts/preview.template.html` с import map.
6. `public/vendor/ts-react.mjs` — TypeScript 6 для воркера (с заглушками модулей Node из `scripts/node-stub.mjs`), ~3,5 МБ; пересобирается только при смене версии (кэш и метка — `node_modules/.cache/ts-react.*`).
7. Тяжёлые пакеты грузятся только когда шаг их импортирует (модуль загружается при первом `import`). Замер спайка: весь vendor с antd ~1,36 МБ gzip (0,96 МБ с минификацией), antd — 0,72 МБ gzip, общий чанк react-dom — 0,19 МБ. `npm run build` собирает vendor с `VENDOR_MINIFY=1` (`dist/vendor` — 4,2 МБ вместе с TypeScript); предупреждения React при минификации остаются (проверено `checks/*` на продакшен-сборке).

`public/vendor/` и `public/preview.html` — в `.gitignore`.

## Компиляция кода ученика: `shared/compile-core.js`

`compileFiles(ts, files)` →

1. Каждый `.ts`/`.tsx` → `ts.transpileModule` (`jsx: react-jsxdev`, `module: ESNext`, `target: ES2022`, inline source map). Синтаксические ошибки — в список ошибок сборки с файлом и строкой.
2. `*.module.css` → JS-модуль с картой классов + CSS с переименованными классами (`styles` результата). Обычный `*.css`, импортированный из кода, — в `styles` как есть.
3. Импорты ресурсов (`.svg`/`.png` из `public/assets`) — абсолютными путями, как в angular-learn; импорт картинок модулем — не поддерживаем (упомянуть в уроке).
4. Результат: `{ files: { 'main.js', 'cart/CartPage.js', 'shared/GameCard.module.css.js', … }, sources: { 'main.js': 'main.tsx', … }, styles: [], errors: ['NotFound.tsx:6 — Expected corresponding JSX closing tag for \'h1\'.'] }`. Формат как в angular-learn плюс `sources` (по нему runtime называет модули именами исходников в стеке и ошибках). `styles` пуст: CSS подключается импортом. Файлы `*.test.*`/`*.spec.*` и `.d.ts` не компилируются.

Ошибки типов даёт TS-воркер Monaco параллельно и не блокирует запуск — как в angular-learn. `npm run validate` проверяет типы полного кода шагов `tsc` по настоящим `@types/react` и библиотекам (`.content-check/`).

## Превью: `public/preview-runtime.js`

Перенесён из angular-learn. Протокол `source: 'react-course-preview'`: `ready`, `console`, `error`, `url`, `title`, `network` (iframe → родитель); `run`, `navigate`, `history`, `backend-config` (родитель → iframe). **Приложение живёт в корне адреса iframe, без `/app/` и без `basename`** (решено в спайке): до запуска runtime делает `history.replaceState(null, '', url)`, и `createBrowserRouter` читает адрес как в настоящем проекте — в коде уроков нет лишнего `basename`. Обычная ссылка `<a href="/catalog">` (без роутера) вызвала бы настоящую загрузку iframe по `/catalog`, и dev-сервер отдал бы туда платформу. Поэтому runtime перехватывает клики по ссылкам своего origin, которые никто не обработал (`!event.defaultPrevented`; слушатель на `window` срабатывает после обработчиков React на корне), и шлёт родителю `restart { url }` — `Preview.tsx` перезапускает приложение с этого адреса, как ⟳. Ссылка на якорь той же страницы меняет только `location.hash`.

Изменения:

- точка входа — `main.js` (из `main.tsx`); перед запуском — `<div id="root">` в `<body>`;
- вместо `await import('@angular/compiler')` — ничего: React не нужен компилятор во время выполнения;
- консоль: стек ошибок переводится по source map в строки `.tsx` (`at NotFound (NotFound.tsx:4:9)`), подряд идущие фреймы внутри React и библиотек сворачиваются в строку «… (вызовы внутри библиотек)»; совет «Download the React DevTools» не показывается; предупреждения React приходят как printf-шаблоны (`'…%s%s…'` + аргументы) — подставлять самим; **стек владельцев в текст не входит** (React 19 отдаёт его через `console.createTask`), поэтому в перехвате `console.error` вызывать `captureOwnerStack()` из `react` (проверено: даёт `at li / at Counter`) и переводить позиции по source map; React-элементы в аргументах — `<GameCard />`; ошибки `createRoot` (`onUncaughtError`) передаются как `error`;
- StrictMode — в коде урока (`main.tsx`), не в runtime: ученик видит его так же, как в Vite-проекте.

## Учебный бэкенд: `public/backend/`

Копия из angular-learn **без изменений** (этап 1) (`backend.js`, `data/*.json`: `games`, `categories`, `reviews`, `users`, `promo`) + обложки `public/assets/covers/` и `scripts/build-covers.mjs`. Перехват `fetch` по `/api/…`, задержка (по умолчанию 300 мс), `failRate`, отмена по `AbortSignal`, токены `token-user`/`token-admin`. Доработки, запланированные в angular-learn (~40 игр, `page`/`size`, `/api/refresh`, `/api/logout`, `tokenTtl`), — делать в обоих курсах одинаково (или вынести в общий пакет — решить, когда понадобится).

## Тесты в превью — план (этап 4, глава 17)

Вкладка «Тесты» при `preview: tests`. Раннер с API Vitest (`describe`, `it`, `expect`, `beforeEach`, `vi.fn`, `vi.mock` — последнее сложно без сборщика, решить) + `@testing-library/react`, `user-event`, `jest-dom` из vendor. Тесты запускаются в отдельном iframe с тем же учебным бэкендом. Цель — тесты курса без изменений запускаются в Vite-проекте (глава 23).

## Проверка шагов `check.ts` — план (этап 3)

Как в angular-learn: функция получает `document`, `navigate`, `backend` и проверяет **результат** (DOM, URL, запросы), а не текст кода.

## Структура исходников (целевая)

Совпадает с angular-learn (`src/app`, `src/lesson`, `src/editor`, `src/compiler`, `src/preview`, `src/content`, `src/progress`, `shared/`, `public/`, `scripts/`, `tools/e2e/`, `tools/authoring/`). Удаляется: `src/editor/angular-html.ts`, JIT-трансформ, `@angular/*` в `devDependencies`, Angular-специфичные пункты консоли (`NG0xxx`).

## Подводные камни (известные заранее)

- **TypeScript 7 нельзя** (Go-версия без JS API) — 6.0.x.
- **CJS-пакеты в import map** — только через ESM-обёртку с именованными экспортами (см. Vendor).
- **Два экземпляра React** → «Invalid hook call» / `null` у `useContext`. Все бандлы библиотек — с внешним `react`.
- **`skipLibCheck: true` обязателен** (в Monaco и `.content-check/tsconfig.json`): в `.d.ts` зависимостей antd 6.6.5 (`@rc-component/image`, `@rc-component/picker`) ошибки TS2430 и в TS 5.9, и в 6.0. Код приложения с типами `@types/react` 19.3, antd, react-router 8 проверяется без ошибок обеими версиями. Время загрузки `.d.ts` antd в Monaco — проверить на этапе 1.
- **es-module-lexer 3**: поля импорта — `specifier`, `start`, `end`, `type` (не `n`/`s`/`e`/`d` из v1).
- **Регистр имён файлов**: компоненты `GameCard.tsx`; macOS нечувствительна к регистру, а превью (виртуальная ФС) и Linux — чувствительны. Валидатор должен ловить импорт с неверным регистром.
- **Порты**: 5190 (`strictPort`).
- **Node 20 у автора**: для платформы достаточно, для глав 22–23 (Next 16, react-router 8 CLI, Vite) нужен Node 22+.
- Остальное — `../angular-learn/docs/architecture.md`, «Подводные камни» (Vite и `import()` в воркере, `optimizeDeps.include`, порядок import map, циклические импорты).
