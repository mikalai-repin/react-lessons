# Дорожная карта

Статусы: ⬜ не начато · 🟨 в работе · ✅ готово

Правило передачи работы: агент, закончивший этап или главу, **обновляет статусы здесь, раздел «Следующий шаг» в конце и «Текущий статус» в `CLAUDE.md`**. Следующий агент начинает с чтения `CLAUDE.md` и раздела «Следующий шаг».

## Этап 0. Контекст и прототип — ✅

- ✅ Изучен курс `../angular-learn`: платформа, формат уроков, процесс, ловушки (2026-10-06)
- ✅ Документация: `CLAUDE.md`, `docs/course-plan.md`, `docs/libraries.md`, `docs/architecture.md` (план), `docs/project-app.md`, `docs/modern-react.md` (черновик), `docs/lesson-format.md`, `docs/writing-guide.md`, `docs/authoring-process.md`, `docs/glossary.md`
- ✅ Спайк `spikes/esm-preview/` (2026-10-06): React 19.3 + react-router 8 (data mode, `loader`, `lazy`) + TanStack Query + Zustand (`persist`) + antd 6 (`ConfigProvider` `ru_RU`, тема, `App.useApp`, `Table`, `DatePicker`) работают в iframe без сборщика с одним экземпляром React; компиляция 8 файлов — 32 мс (повторно 6 мс); первый рендер ~200 мс. Подробно — README спайка
- ✅ Решено: vendor — один запуск esbuild со `splitting` + обёртки CJS; `react-jsxdev`; CSS Modules — свой трансформ; роутер без `basename` (приложение в корне адреса iframe) + перехват «голых» ссылок; owner stack — `captureOwnerStack()`; `skipLibCheck: true`
- ✅ Проверенные факты — в `docs/modern-react.md` (таблица «Проверено»)
- ⬜ Перенесено на свои этапы: Monaco с типами antd (этап 1), React Compiler в воркере (до главы 16), тест-раннер и MSW (до главы 17)

Критерий готовности достигнут: в iframe работают `createRoot` + `useState` + `react-router` (data mode, `loader`) + `@tanstack/react-query` + `zustand` + `antd` с одним экземпляром React; компиляция TSX в воркере < 100 мс.

## Этап 1. Платформа — ✅

- ✅ Перенос платформы из `../angular-learn` (2026-10-06): `src/`, `shared/step-chain.js`, `scripts/`, `tools/e2e/`, `tools/authoring/steps.py` и `format-content.py`, конфиги; `react-course`, порт 5190, Angular-специфика удалена (`angular-html.ts`, JIT-трансформ, `NG0xxx`, `legacy_dir`, `@angular/*`, `rxjs`)
- ✅ `package.json`: точные версии; библиотеки превью (`@tanstack/react-query`, `zustand`) — в `devDependencies`; `react`, `react-dom`, `react-router` — в `dependencies` (их использует и сама платформа)
- ✅ `scripts/copy-vendor.mjs`: `PREVIEW_MODULES`, один запуск esbuild со splitting, автоопределение CJS, `ts-react.mjs` с меткой версии, `preview.html`; `VENDOR_MINIFY=1` в `prebuild`
- ✅ `shared/compile-core.js`: TSX → JS (`react-jsxdev`), CSS и CSS Modules → модули, `sources`
- ✅ `public/preview-runtime.js`: приложение в корне адреса, `#root`, printf-шаблоны, стек владельцев (`captureOwnerStack`), свёртка фреймов библиотек, React-элементы в консоли, перехват обычных ссылок → `restart`
- ✅ Monaco: типы React, react-router, query, zustand, CSS Modules; Prettier без `angular`; Shiki `tsx`; значок `TSX`; порядок вкладок `main.tsx`, `App.tsx`, `X.tsx` + `X.module.css`
- ✅ Учебный бэкенд и обложки — копия из angular-learn
- ✅ Демо-магазин шага 1.1 (`content/01-first-app/01-what-is-react/start/`): каталог (`useQuery` + `signal`), игра (`loader`, `HydrateFallback`), корзина (Zustand + `persist`), 404, CSS Modules, `<title>` в компонентах. `lesson.md` — черновик-заглушка
- ✅ `npm run validate` (сборка + `tsc` по `.content-check/` с настройками шаблона Vite `react-ts`, `env.d.ts` для CSS), `npx prettier --check .`, `npm run build`
- ✅ `checks/preview.mjs` (21 проверка) и `checks/platform.mjs` (23 проверки) проходят в dev и на продакшен-сборке (`vite preview`); мобильный вид — вкладки «Урок / Код / Результат»

Критерий готовности достигнут: демо-магазин работает в превью; синтаксическая ошибка («Сборка»), ошибка типов («TS»), исключение при рендере (стек со строкой `.tsx`) и предупреждение про `key` (со стеком владельцев и ссылкой) понятно видны в консоли.

### Технический долг этапа 1

- Синтаксическая ошибка показывается дважды: «Сборка» (воркер компиляции) и «TS» (Monaco). Было и в angular-learn. Можно не показывать синтаксические диагностики Monaco, если есть ошибка сборки в том же файле и строке.
- Подсветка JSX в Monaco слабая (встроенная Monarch-грамматика `typescript`): теги и атрибуты не выделяются. Вариант — своя Monarch-грамматика TSX или семантическая подсветка TS-воркера.
- Бандл платформы ~6,8 МБ (1,6 МБ gzip): Monaco + TypeScript Monaco + типы. Как и в angular-learn — ленивая загрузка Monaco.
- `lesson.md` шага 1.1 — заглушка; текст — вместе с главой 1.
- Учебный бэкенд — копия: доработки (~40 игр, `page`/`size`, refresh-токен) делать в обоих курсах.
- Нет `check.ts` (этап 3), тест-раннера (этап 4), вкладки «Скомпилировано» (этап 5).

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
| React и часть библиотек — только CJS, import map требует ESM | ✅ Снят спайком: ESM-обёртки с именованными экспортами |
| Два экземпляра React в превью | ✅ Снят спайком: один запуск esbuild со `splitting`; проверка в `checks/preview.mjs` |
| `antd` тяжёлый и рисует стили в рантайме | Отдельный бандл, грузится только при импорте; проверить cssinjs в iframe |
| Мажорные версии вышли недавно (react-router 8, antd 6, TanStack Table 9, Jotai 3, Zod 4, MSW 3, Vitest 5) — память модели их не знает | Сверять API по `node_modules` перед каждой главой; факты — в `modern-react.md` |
| React Compiler меняет «правила мемоизации» | Глава 16: сначала ручная мемоизация и её механизм, потом компилятор; не утверждать, что `useMemo` устарел |
| Next.js и RSC нельзя показать в превью | Глава 22 — на машине ученика, команды проверяет автор |
| Различия StrictMode/dev/prod (двойной рендер, предупреждения) | Превью всегда dev; в тексте называть отличия от продакшен-сборки |

## Следующий шаг

**Этап 2: глава 1 «Первое приложение»** по `docs/course-plan.md` (шаги 1.1–1.6 + «Под капотом») и процессу `docs/authoring-process.md` (и `../angular-learn/docs/authoring-process.md` — он подробнее).

1. Прочитать `CLAUDE.md`, `docs/writing-guide.md`, `docs/glossary.md`, `docs/modern-react.md` (таблица «Проверено» — там факты про StrictMode, предупреждения, `<title>`, стабильность `ViewTransition`/`Activity`), пример главы `../angular-learn/content/01-first-app/` и её генератор `../angular-learn/tools/authoring/ch01-gen.py`.
2. Шаг 1.1 «Что такое React» (`startFrom: custom`, `noSolution`): старт — уже готовый демо-магазин; заменить заглушку `lesson.md` настоящим текстом (React — библиотека, сравнение с Angular; что React не делает и экосистема курса — `docs/libraries.md`).
3. Шаги 1.2–1.6: от пустого `main.tsx` + `App.tsx` до заголовка «Ход конём» со стилями: первый компонент, `createRoot`, `StrictMode` (эксперимент с логом рендера — два вызова), стили (`styles.css` готовым файлом + CSS Modules), отладка (шаг с `brokenStart`: синтаксис, типы, исключение при рендере, `key`). «Под капотом»: JSX → `jsxDEV()`, React-элемент — объект (`$$typeof`, `type`, `props`, `key`), показать скомпилированный код (до вкладки «Скомпилировано» — через `console.log(<App />)` или `compile-core` в тексте).
4. Генератор `tools/authoring/ch01-gen.py` по образцу angular-learn (`write_steps` из `steps.py`); после — `npm run validate`, `npx prettier --check .`, `run-dir` для каждого шага и эксперимента, `run-chapter`, своя проверка `tools/e2e/checks/ch01-first-app.mjs`.
5. Обновить «Фактическое состояние» в `docs/authoring-process.md`, этот файл и `CLAUDE.md`.
