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

### Технический долг этапа 1 — закрыт (2026-10-06)

- ✅ Синтаксическая ошибка в консоли дважды («Сборка» и «TS») → консоль берёт у Monaco только ошибки типов (`collectDiagnostics`); подчёркивания в редакторе — обе. Проверяет `checks/platform.mjs`.
- ✅ Слабая подсветка JSX в Monaco → Shiki через `@shikijs/monaco` (грамматика TSX под языком `typescript`, темы `github-light`/`github-dark` — как в тексте урока); гонка со встроенной ленивой грамматикой снята ожиданием `monaco.editor.colorize`. Проверяет `checks/platform.mjs`.
- ✅ Бандл платформы 6,8 МБ → начальная загрузка **374 КБ (119 КБ gzip)**: страница шага — ленивый чанк (`lazy` в `App.tsx`, 1,6 МБ), типы библиотек — отдельный чанк `src/editor/library-types.ts` (2,1 МБ), грузится параллельно; диагностика ждёт его (`typesReady`). Регистрации языков Monaco почти ничего не весят (грамматики и так ленивые) — не трогали.
- ✅ `lesson.md` шага 1.1 — написан (утверждения про «Сеть» проверены запуском).
- ✅ Ловушки окружения перенесены из angular-learn в `docs/authoring-process.md`.
- ✅ Учебный бэкенд — решено: своя копия в этом курсе (`public/backend/`), доработки — по плану этого курса (пункты перед главами 11 и 14 в этапе 4), без синхронизации с angular-learn.
- ✅ Генераторы глав на Python заменены веткой git на главу (`scripts/chapter.mjs`, метки `@todo` — `scripts/todo-markers.mjs`); `tools/authoring/` удалён. Проверено: экспорт главы 1 из ветки совпал с прежним `content/` побайтно; на временной главе — метки, коммит `start`, `fix` с переносом правки в следующие шаги, `sync-base` после изменения главы 1.
- Не долг, а этапы по плану: `check.ts` (этап 3), тест-раннер (этап 4), вкладка «Скомпилировано» (этап 5).

## Этап 2. Пилот: главы 1–3 — ✅

- ✅ Оформление платформы: палитры на выбор («React» — по умолчанию, «Малиновая», «Фиолетовая», «Изумрудная»), кнопка светлой/тёмной темы (по умолчанию тёмная), выбор хранится в `localStorage`; липкая строка главы с «Свернуть», загрузчик-атом, своя тема подсветки (2026-10-07; `checks/platform.mjs` проверяет цвета подсветки и выбор палитры с перезагрузкой)
- ✅ Глава 1. Первое приложение (7 шагов; утверждения и эксперименты проверены запуском и `tsc`; `checks/ch01-first-app.mjs`; найдено и исправлено: превью запускало код с синтаксической ошибкой — теперь нет, как в Vite)
- ✅ Глава 2. JSX и разметка (8 шагов, 2026-10-07; `checks/ch02-jsx.mjs` — 35 проверок; найдено и исправлено: `chapter export` игнорировал метки `@todo` у шага с коммитом `start`; проверено: React 19 блокирует `javascript:` только в своих атрибутах, `dangerouslySetInnerHTML` HTML не чистит)
- ✅ Квизы глав (2026-10-07): `content/<глава>/quiz.yaml` (10–15 вопросов, один ответ, первый вариант — правильный, перемешивание вопросов и вариантов), страница `/<глава>/quiz` (`src/quiz/QuizPage.tsx`), зачёт ≥ 85 % — глава пройдена (✓ в оглавлении), разбор ошибок со ссылками на шаги; проверка формата в `npm run validate`; квизы глав 1 (13 вопросов) и 2 (14 вопросов) — по проверенным утверждениям уроков; `checks/quiz.mjs` (28 проверок; найдено и исправлено: оглавление не обновляло ✓ после сдачи без перехода по адресу)
- ✅ Глава 3. Компоненты и props (8 шагов, 2026-10-08; `checks/ch03-components.mjs` — 62 проверки, квиз — 14 вопросов; новые файлы шагов приходят заготовками в коммите `start` — создавать файлы в редакторе платформы нельзя; проверено: `defaultProps` у функций React 19 игнорирует молча, props заморожены неглубоко и только в dev, `GameCard({ game })` не даёт файбера)
- ✅ Вычитка глав 1–3 (2026-10-08): тексты понятны без опыта в React; исправлено: в 1.7 вместо кодов `\u0425\u043E…` стояла кириллица, в 2.2 `{game.cover}` — 12 символов, а не 11, в 3.5 сломанная разметка кода в сообщении про ключ, «стек владельцев» объяснён при первом появлении (2.4), StrictMode «не сравнивает поведение» (1.4), неуточнённые «монтирует», «состояние» до главы 4

## Этап 3. Основы: главы 4–8 — ⬜

- ✅ Глава 4. Состояние и события (9 шагов, 2026-10-08; `checks/ch04-state.mjs` — 72 проверки, квиз — 14 вопросов; подъём состояния переставлен перед массивами; найдено и исправлено: отправка формы без `preventDefault` уводила iframe превью — теперь перезапуск с адреса формы; проверено: функция обновления в StrictMode вызывается дважды, `set` того же значения не рендерит, `__reactFiber$` у DOM-узла может отставать на обновление)
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

**Глава 5 «Структура состояния и поля ввода»** по `docs/course-plan.md` (5.1–5.7 + практикум «Витрина» + «Под капотом: позиция в дереве») и процессу `docs/authoring-process.md`. Первая сторонняя библиотека курса — Immer.

1. Прочитать «Фактическое состояние» главы 4 в `docs/authoring-process.md` (особенно «Опоры для главы 5»), `docs/writing-guide.md`, `docs/modern-react.md`; главу 4 целиком (`content/04-state/*/lesson.md`).
2. **До главы — vendor Immer:** `immer` и `use-immer` (`docs/libraries.md`: 11.1.x) — точные версии в `package.json` (`devDependencies`), `PREVIEW_MODULES` в `scripts/copy-vendor.mjs`, `.d.ts` в `src/editor/library-types.ts`; сверить экспорты (`produce`, `useImmer`, `useImmerReducer`) по `node_modules`; `checks/preview.mjs` и `checks/platform.mjs`.
3. `npm run chapter new 05-structure -- --title "Структура состояния и поля ввода" --description "…"` — база: результат `04-state/09-practice`.
4. Проверить запуском до текста: управляемое поле (`value` без `onChange` — предупреждение React, текст — из консоли; `undefined` → строка — «uncontrolled to controlled»), `<select>`, `checked`; `defaultValue` + `FormData`; сброс состояния `key` и «состояние привязано к позиции» (одна и та же позиция — состояние сохраняется, другой тип — сбрасывается) — по логу и полю ввода; `useReducer` в StrictMode (редьюсер вызывается дважды?); `produce` и мутация черновика; `useImmerReducer`.
5. После каждого шага — `npm run chapter export 05-structure`, `npm run validate`; в конце — квиз, `node tools/e2e/run-chapter.mjs 05-structure`, `checks/ch05-structure.mjs` (по образцу `checks/ch04-state.mjs`: `add`, `fresh`, `typeErrors`), `npx prettier --check .`; обновить «Фактическое состояние», этот файл и `CLAUDE.md`.
