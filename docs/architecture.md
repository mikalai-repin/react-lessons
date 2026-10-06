# Архитектура платформы

> **Состояние: план (этап 0).** Кода ещё нет. Документ описывает, что переносится из `../angular-learn` и что пишется заново. После каждого этапа — переписать соответствующий раздел из «план» в «как сделано и проверено», как в `../angular-learn/docs/architecture.md`.

Статический сайт без бэкенда. Весь код ученика компилируется и выполняется в браузере. Основа — платформа `../angular-learn` (Vite 8 + React 19 + Monaco 0.57 + markdown-it + Shiki + Prettier), ~7,5 тыс. строк. Она уже написана на React, поэтому интерфейс, навигация, прогресс, рендер уроков, превью-протокол, учебный бэкенд и e2e-инструменты переносятся почти без изменений.

## Интерфейс

Тот же, что в angular-learn (см. `../angular-learn/docs/architecture.md`, «Интерфейс»): три панели (урок / код / результат), адресная строка превью (←, →, ⟳, ввод адреса = перезапуск), заголовок вкладки, консоль (метки `TS`, `Сборка`, схлопывание повторов), вкладка «Сеть» (задержка, ошибка 500, тело запроса), дерево файлов, сворачивание панелей, «Решение» / «Вернуть мой код» / «Сброс», автозапуск через 1 с, `Ctrl/Cmd+Enter`, «Формат».

Отличия для React:

| Элемент | Что меняется |
|---|---|
| Вкладки файлов | `.tsx`, `.ts`, `.css`, `.module.css`; порядок без `files`: `main.tsx`, `App.tsx`, затем по папкам; `X.tsx` и `X.module.css` рядом |
| Консоль | Ссылки на `https://react.dev/errors/<код>` (минифицированные ошибки) и owner stack из предупреждений React. Значения: React-элементы — `<GameCard />`, хуки — как есть |
| Подсветка | Встроенная TSX-подсветка Monaco — своя грамматика (как `angular-html.ts`) **не нужна**. Shiki — языки `tsx`, `ts`, `css` |
| Вкладка «Тесты» | Этап 4 (глава 17): раннер с API Vitest + Testing Library |
| Вкладка «Скомпилировано» | Этап 5: JS после TS для выбранного файла; с переключателем «React Compiler» — после Babel-плагина компилятора (главы 1, 16, 21) |
| Вкладка «Рендеры» (по возможности) | Этап 5: лог рендеров компонентов (через `<Profiler>` или хук DevTools) — для глав 8, 16 |

## Стек

| Задача | Решение | Почему |
|---|---|---|
| Сборка платформы | Vite 8 + TypeScript 6.0 | Как в angular-learn |
| UI платформы | React 19, `react-router`, `react-resizable-panels` | Код из angular-learn |
| Редактор | Monaco Editor 0.57 (встроенный TS 5.9) | TSX и типы `react`, `@types/react` и библиотек; проверить, что типы библиотек не требуют TS 6+ |
| Компиляция TSX → JS | Веб-воркер: **TypeScript 6 `transpileModule`**, `jsx: react-jsxdev` (или `react-jsx` — решить в спайке: dev-вариант даёт `__source`/owner stack) | Один и тот же модуль `shared/compile-core.js` в браузере, валидаторе и e2e (как в angular-learn). TS-трансформ проще Babel и уже есть в vendor |
| React Compiler | `@babel/standalone` + `babel-plugin-react-compiler` в воркере, **по запросу** (вкладка «Скомпилировано», режим главы 16) | Компилятор существует только как Babel-плагин (проверить, нет ли SWC/oxc-версии для браузера) |
| CSS Modules | Свой трансформ в `compile-core.js`: `import s from './X.module.css'` → модуль `export default { cls: 'X_cls_hash' }` + переписанный CSS (`postcss` + `postcss-modules` в воркере или простой парсер селекторов — решить в спайке) | Vite поддерживает CSS Modules из коробки — код курса переносится в настоящий проект без изменений |
| Глобальные стили | `import './styles.css'` в `main.tsx` → `<style>` в превью | Как в Vite |
| Форматирование | Prettier 3.9 (`typescript` для `.ts`/`.tsx`, `postcss` для CSS), настройки `shared/lesson-prettier.json` | Как в angular-learn; парсер `angular` не нужен |
| Markdown уроков | `markdown-it` + контейнеры + Shiki (`tsx`) | Как в angular-learn |
| Прогресс | `localStorage`, ключ `react-course:v1` | |
| Порт | **5190** (`strictPort`) | 5173/5174 — PixiJS, 5180 — Angular |

## Версии

Фиксируются **точно** (без `^`) в `package.json` и `content/course.json` (`reactVersion`): `react`, `react-dom`, все библиотеки превью (`docs/libraries.md`), `typescript` 6.0.x, `monaco-editor` 0.57.0. Обновление — только между главами, с прогоном `validate`, `checks/*` и `run-chapter` по всем главам.

## Vendor: `scripts/copy-vendor.mjs` (главное новое)

**Проблема:** `react`, `react-dom` и многие библиотеки публикуются только в **CommonJS** (у `react@19.3.0` в `exports` нет ESM-сборки), а превью работает на нативных ES-модулях через import map. Кроме того, у всех библиотек должен быть **один экземпляр React**, иначе «Invalid hook call».

**Решение (план, проверить в спайке этапа 0):**

1. Для каждого пакета превью esbuild собирает ESM-бандл `public/vendor/<пакет>.mjs` с `external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client', …]` — все библиотеки импортируют React через import map, а значит, получают один экземпляр.
2. Для CJS-пакетов (`react`, `react-dom`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom/client`, `scheduler`) — ESM-обёртка с **именованными** экспортами: Node загружает модуль, перечисляет `Object.keys(require(...))` и генерирует `export const { useState, … } = mod; export default mod;` (так делает esm.sh). Без этого `import { useState } from 'react'` не работает.
3. `process.env.NODE_ENV` → `'development'` (`define` в esbuild): ученик должен видеть предупреждения React. Development-сборка React заметно больше — приемлемо.
4. Подпути — по полю `exports` каждого пакета (`react-dom/client`, `react-router/dom`, `motion/react`, `@tanstack/react-query`, `zustand/middleware`, `antd/locale/ru_RU` и т. п.) — генерировать карту автоматически, как в angular-learn (26 записей для Angular).
5. `public/preview.html` из `scripts/preview.template.html` с import map.
6. `public/vendor/ts-react.mjs` — TypeScript 6 для воркера (как `ts-angular.mjs`, без трансформа Angular, с заглушками модулей Node из `scripts/node-stub.mjs`). Возможно, достаточно `typescript` целиком, а не `compiler-cli`.
7. Тяжёлые пакеты (`antd` ~ несколько МБ, `@babel/standalone`) — грузятся только когда шаг их импортирует (import map всё равно ленивая: модуль загружается при первом `import`).

`public/vendor/` и `public/preview.html` — в `.gitignore`.

## Компиляция кода ученика: `shared/compile-core.js` (переписать)

`compileFiles(ts, files)` →

1. Каждый `.ts`/`.tsx` → `ts.transpileModule` (`jsx: react-jsxdev`, `module: ESNext`, `target: ES2022`, inline source map). Синтаксические ошибки — в список ошибок сборки с файлом и строкой.
2. `*.module.css` → JS-модуль с картой классов + CSS с переименованными классами (`styles` результата). Обычный `*.css`, импортированный из кода, — в `styles` как есть.
3. Импорты ресурсов (`.svg`/`.png` из `public/assets`) — абсолютными путями, как в angular-learn; импорт картинок модулем — не поддерживаем (упомянуть в уроке).
4. Результат: `{ files: { 'main.js', 'cart/CartPage.js', … }, styles: [...], errors: [...] }` — тот же формат, что в angular-learn, поэтому `preview-runtime.js`, `src/compiler/*`, `tools/e2e/lib.mjs` и `validate-content.mjs` меняются минимально.

Ошибки типов даёт TS-воркер Monaco параллельно и не блокирует запуск — как в angular-learn. `npm run validate` проверяет типы полного кода шагов `tsc` по настоящим `@types/react` и библиотекам (`.content-check/`).

## Превью: `public/preview-runtime.js`

Переносится из angular-learn. Протокол `source: 'react-course-preview'`: `ready`, `console`, `error`, `url`, `title`, `network` (iframe → родитель); `run`, `navigate`, `history`, `backend-config` (родитель → iframe). Приложение живёт под `/app/` (`<base href="/app/">`), React Router получает `basename: '/app'` — **проверить**: в angular-learn это решалось `<base href>`, а `createBrowserRouter` читает `window.location.pathname`; возможно, нужен `basename` в коде урока (плохо — лишний шум) или подмена в runtime. Решить в спайке.

Изменения:

- точка входа — `main.js` (из `main.tsx`); перед запуском — `<div id="root">` в `<body>`;
- вместо `await import('@angular/compiler')` — ничего: React не нужен компилятор во время выполнения;
- консоль: форматирование React-элементов, owner stack; ошибки `createRoot` (`onUncaughtError`) передаются как `error`;
- StrictMode — в коде урока (`main.tsx`), не в runtime: ученик видит его так же, как в Vite-проекте.

## Учебный бэкенд: `public/backend/`

Копия из angular-learn **без изменений** (`backend.js`, `data/*.json`: `games`, `categories`, `reviews`, `users`, `promo`) + обложки `public/assets/covers/` и `scripts/build-covers.mjs`. Перехват `fetch` по `/api/…`, задержка (по умолчанию 300 мс), `failRate`, отмена по `AbortSignal`, токены `token-user`/`token-admin`. Доработки, запланированные в angular-learn (~40 игр, `page`/`size`, `/api/refresh`, `/api/logout`, `tokenTtl`), — делать в обоих курсах одинаково (или вынести в общий пакет — решить, когда понадобится).

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
- **Монако и `@types/react`**: типы React — в `@types/react` (не в пакете `react`) — проверить для 19.3; JSX-типы библиотек (`antd`) тяжёлые — проверить время загрузки и что TS 5.9 Monaco их принимает.
- **Регистр имён файлов**: компоненты `GameCard.tsx`; macOS нечувствительна к регистру, а превью (виртуальная ФС) и Linux — чувствительны. Валидатор должен ловить импорт с неверным регистром.
- **Порты**: 5190 (`strictPort`).
- **Node 20 у автора**: для платформы достаточно, для глав 22–23 (Next 16, react-router 8 CLI, Vite) нужен Node 22+.
- Остальное — `../angular-learn/docs/architecture.md`, «Подводные камни» (Vite и `import()` в воркере, `optimizeDeps.include`, порядок import map, циклические импорты).
