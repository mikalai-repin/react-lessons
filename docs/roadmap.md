# Дорожная карта

Статусы: ⬜ не начато · 🟨 в работе · ✅ готово

Правило передачи работы: агент, закончивший этап или главу, **обновляет статусы здесь, раздел «Следующий шаг» в конце и «Текущий статус» в `CLAUDE.md`**. Следующий агент начинает с чтения `CLAUDE.md` и раздела «Следующий шаг».

## Этап 0. Контекст и прототип — 🟨

- ✅ Изучен курс `../angular-learn`: платформа, формат уроков, процесс, ловушки (2026-10-06)
- ✅ Документация: `CLAUDE.md`, `docs/course-plan.md`, `docs/libraries.md`, `docs/architecture.md` (план), `docs/project-app.md`, `docs/modern-react.md` (черновик), `docs/lesson-format.md`, `docs/writing-guide.md`, `docs/authoring-process.md`, `docs/glossary.md`
- ⬜ **Спайк `spikes/esm-preview/`**: доказать, что React 19 + библиотеки работают в iframe без сборщика (см. «Следующий шаг»)
- ⬜ Сверить с установленными пакетами и заполнить `docs/modern-react.md` (раздел «Проверить»)
- ⬜ Решить по итогам спайка: `react-jsx` или `react-jsxdev`; CSS Modules — `postcss-modules` или свой трансформ; `basename` роутера под `/app/`; MSW или учебный бэкенд в тестах

Критерий готовности: в спайке в iframe работают `createRoot` + `useState` + `react-router` (data mode, `loader`) + `@tanstack/react-query` + `zustand` + `antd` (`ConfigProvider` с `ru_RU`, `Button`, `Table`) с одним экземпляром React; компиляция TSX в воркере < 100 мс на 5 файлов.

## Этап 1. Платформа — ⬜

- ⬜ Перенос платформы из `../angular-learn` (`src/`, `shared/step-chain.js`, `scripts/step-files.mjs`, `scripts/validate-content.mjs`, `tools/e2e/`, `tools/authoring/steps.py`, `prettier.config.mjs`, `vite.config.ts`, `index.html`): переименовать `angular-course` → `react-course`, порт 5190, удалить Angular-специфику
- ⬜ `package.json`: `react`/`react-dom` и библиотеки превью — точные версии; `typescript@6.0.x`; `monaco-editor@0.57.0`
- ⬜ `scripts/copy-vendor.mjs`: ESM-бандлы React и библиотек с общим React, ESM-обёртки CJS, `preview.html` с import map по `exports`
- ⬜ `shared/compile-core.js`: TSX → JS, CSS Modules, глобальный CSS
- ⬜ `public/preview-runtime.js`: `#root`, консоль (React-элементы, owner stack, ссылки на react.dev/errors), роутер под `/app/`
- ⬜ Monaco: типы `@types/react`, `@types/react-dom` и библиотек; Prettier для `.tsx`; Shiki `tsx`
- ⬜ Учебный бэкенд и обложки — копия из angular-learn
- ⬜ Демо-магазин шага 1.1 (готовое приложение на React: каталог, игра, корзина — 3 маршрута + 404) — на нём `checks/platform.mjs` и `checks/preview.mjs`
- ⬜ `npm run validate`: структура, цепочка, сборка, `tsc` по `.content-check/`
- ⬜ Проверено в headless Chrome: dev, продакшен-сборка, мобильный вид

Критерий готовности: демо-магазин работает в превью, ошибки в `.tsx` (синтаксис, типы, исключение при рендере, предупреждение про `key`) понятно видны в консоли; все проверки платформы проходят.

## Этап 2. Пилот: главы 1–3 — ⬜

- ⬜ Глава 1. Первое приложение
- ⬜ Глава 2. JSX и разметка
- ⬜ Глава 3. Компоненты и props
- ⬜ Вычитка: тексты понятны человеку без опыта в React

## Этап 3. Основы: главы 4–8 — ⬜

- ⬜ Глава 4. Состояние и события
- ⬜ Глава 5. Структура состояния и поля ввода (первая библиотека — Immer)
- ⬜ Глава 6. Ссылки и эффекты
- ⬜ Глава 7. Собственные хуки
- ⬜ Глава 8. Контекст
- ⬜ Проверки `check.ts` для практикумов

## Этап 4. Приложение: главы 9–20 — ⬜

- ⬜ Глава 9. Состояние приложения (Zustand, Jotai)
- ⬜ Глава 10. Роутинг (React Router 8)
- ⬜ Учебный бэкенд: ~40 игр, `page`/`size` (общая задача с angular-learn)
- ⬜ Глава 11. Данные с сервера (Suspense, TanStack Query)
- ⬜ Глава 12. Конкурентный React и Actions
- ⬜ Глава 13. Формы (React Hook Form + Zod)
- ⬜ Учебный бэкенд: `tokenTtl`, `/api/refresh`, `/api/logout` (общая задача с angular-learn)
- ⬜ Глава 14. Авторизация
- ⬜ Vendor: `antd` + `@ant-design/icons` + `dayjs` в превью (проверить размер и cssinjs)
- ⬜ Глава 15. Стили и Ant Design
- ⬜ Вкладка «Скомпилировано» с React Compiler (Babel в воркере) — до главы 16
- ⬜ Глава 16. Производительность
- ⬜ Тест-раннер в превью (вкладка «Тесты», API Vitest + Testing Library)
- ⬜ Глава 17. Тестирование
- ⬜ Глава 18. Админка
- ⬜ Глава 19. Redux Toolkit
- ⬜ Глава 20. Паттерны и архитектура

## Этап 5. Инструменты «под капотом» — ⬜

- ⬜ Вкладка «Скомпилировано» (JS после TS и после React Compiler)
- ⬜ Лог рендеров / дерево компонентов (через `<Profiler>` или хук DevTools)

## Этап 6. Глубже: главы 21–25 — ⬜

- ⬜ Глава 21. Под капотом React
- ⬜ Глава 22. Серверный React (Next.js 16, на машине ученика; нужен Node 22+)
- ⬜ Глава 23. Настоящий проект (Vite, ESLint, сборка, деплой)
- ⬜ `reference/` с кодом выбранного проекта и `npm run reference`
- ⬜ Глава 24. Разбор настоящего кода
- ⬜ Глава 25. Финальный проект

## Риски

| Риск | Что делаем |
|---|---|
| React и часть библиотек — только CJS, import map требует ESM | ESM-обёртки с именованными экспортами (спайк этапа 0) |
| Два экземпляра React в превью | Все бандлы — с внешним `react`; проверка в `checks/preview.mjs` |
| `antd` тяжёлый и рисует стили в рантайме | Отдельный бандл, грузится только при импорте; проверить cssinjs в iframe |
| Мажорные версии вышли недавно (react-router 8, antd 6, TanStack Table 9, Jotai 3, Zod 4, MSW 3, Vitest 5) — память модели их не знает | Сверять API по `node_modules` перед каждой главой; факты — в `modern-react.md` |
| React Compiler меняет «правила мемоизации» | Глава 16: сначала ручная мемоизация и её механизм, потом компилятор; не утверждать, что `useMemo` устарел |
| Next.js и RSC нельзя показать в превью | Глава 22 — на машине ученика, команды проверяет автор |
| Различия StrictMode/dev/prod (двойной рендер, предупреждения) | Превью всегда dev; в тексте называть отличия от продакшен-сборки |

## Следующий шаг

**Этап 0: спайк `spikes/esm-preview/`** — минимальный прототип без платформы, только чтобы снять технические риски. По образцу `../angular-learn/spikes/jit-preview/` (прочитать его README).

1. `npm init` в `spikes/esm-preview/`, установить точно: `react@19.3.0 react-dom@19.3.0 @types/react @types/react-dom typescript@6.0 esbuild react-router@8.4.0 @tanstack/react-query zustand antd @ant-design/icons dayjs`.
2. Скрипт `build-vendor.mjs`: ESM-обёртки для `react`, `react/jsx-runtime`, `react/jsx-dev-runtime`, `react-dom`, `react-dom/client` (именованные экспорты из `Object.keys(require(…))`, `NODE_ENV=development`); esbuild-бандлы остальных библиотек с `external` на React; import map по полю `exports`.
3. `index.html` + воркер: TypeScript 6 `transpileModule` (`jsx: react-jsxdev`) для 3–5 файлов `.tsx`, переписывание относительных импортов на blob-URL (взять код из `../angular-learn/public/preview-runtime.js`), запуск в iframe.
4. Проверить и записать в README спайка (с цифрами): `useState`, `createBrowserRouter` + `loader` под `/app/`, `useQuery`, `zustand`, `antd` (`ConfigProvider locale={ruRU}`, `Button`, `Table`, `App.useApp().message`), один экземпляр React (контекст через границу бандлов), StrictMode, текст ошибок React в консоли (dev-сборка, owner stack), размер бандлов, время компиляции.
5. По результатам: обновить `docs/architecture.md` (решения вместо «проверить»), `docs/modern-react.md` (проверенные факты), этот файл (статусы и следующий шаг — этап 1 «Платформа»).
