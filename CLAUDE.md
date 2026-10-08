# React — интерактивный курс

Интерактивный учебник по **React 19** и его экосистеме на русском языке. Ученик проходит курс в браузере: слева текст урока, в центре редактор кода с вкладками файлов (`.tsx`, `.ts`, `.css`), справа живое приложение в iframe с адресной строкой, консолью и вкладкой «Сеть».

Это **тот же формат и та же платформа**, что у соседнего курса `../angular-learn` (а он — по образцу `../pixi-js`). Платформа angular-learn сама написана на React, поэтому переносится почти целиком; заново пишется только компиляция кода ученика (TSX → JS вместо компилятора Angular), vendor-сборка библиотек и типы для Monaco.

Сквозной проект — тот же **«Ход конём»**, интернет-магазин настольных игр (каталог, карточка, корзина, оформление, вход, кабинет, админка). Данные, учебный бэкенд и обложки берём из angular-learn без изменений. Подробно — `docs/project-app.md`.

## Цель курса

Довести ученика до **уверенного уровня senior React-разработчика**: не только «как сделать», но и «почему так», «что под капотом» (рендер, сверка, Fiber, планировщик, компилятор) и «какую библиотеку взять и почему». Курс покрывает React и обязательный стек вокруг него (роутинг, серверное состояние, клиентское состояние, формы, UI-кит Ant Design, тесты, производительность, серверный React).

## Целевая аудитория

- Хорошо знает JavaScript и TypeScript (дженерики, union-типы, модули, async/await), HTML, CSS, DOM.
- Может знать Angular или Vue, **но на React не писал** (или писал «по туториалу» и хочет разобраться глубоко).
- Основы JS/TS и веба не объясняем; всё про React и его библиотеки объясняем с нуля и до внутреннего устройства.

## Документация проекта (читать перед работой)

| Файл | Что внутри |
|---|---|
| [docs/roadmap.md](docs/roadmap.md) | **Этапы работы, текущий статус и СЛЕДУЮЩИЙ ШАГ** — начинать отсюда |
| [docs/course-plan.md](docs/course-plan.md) | Программа курса: части, главы, шаги, какие API в каком шаге |
| [docs/libraries.md](docs/libraries.md) | Сторонние библиотеки: какие, какие версии, зачем, в какой главе, что нужно знать на уровне senior |
| [docs/project-app.md](docs/project-app.md) | Сквозной проект «Ход конём» на React: экраны, файлы, что добавляет каждая глава |
| [docs/modern-react.md](docs/modern-react.md) | **Что верно для React 19.x**: проверенные факты, устаревшие и запрещённые паттерны, что ещё проверить |
| [docs/architecture.md](docs/architecture.md) | Архитектура платформы: что переносим из angular-learn, что пишем заново, vendor-сборка, превью |
| [docs/lesson-format.md](docs/lesson-format.md) | Формат урока на диске (отличия от angular-learn) |
| [docs/writing-guide.md](docs/writing-guide.md) | Как писать тексты уроков, правила для кода |
| [docs/authoring-process.md](docs/authoring-process.md) | Процесс написания главы и обязательные проверки (отличия от angular-learn) |
| [docs/glossary.md](docs/glossary.md) | Русско-английский словарь терминов React |

Образец, на который всё равняется: `../angular-learn/CLAUDE.md` и `../angular-learn/docs/*`. Если в этом репозитории чего-то не хватает (решение, приём, скрипт, ловушка) — сначала посмотрите, как это сделано там.

## Ключевые решения

- **React 19** (точная версия фиксируется при установке на этапе 1 — на 2026-10-06 стабильная `19.3.0`). Только современный React: функциональные компоненты, хуки, `ref` как обычный проп, `<Context>` как провайдер, Actions (`useActionState`, `useOptimistic`, `<form action>`), `use()`. Устаревшее (классовые компоненты, `forwardRef`, `defaultProps` у функций, `ReactDOM.render`, загрузка данных в `useEffect` как основной способ) — только во врезках «Вы встретите в старом коде». Полный список — `docs/modern-react.md`.
- **Код ученика выполняется в браузере без сборщика**: TypeScript 6 (`transpileModule`, `jsx: react-jsxdev`) в веб-воркере → ES-модули → iframe с import map. React и библиотеки — заранее собранные esbuild ESM-бандлы с **общим экземпляром React** (см. `docs/architecture.md`).
- **TypeScript 6.0**, не 7: у TypeScript 7 (Go) нет JS API, а он нужен воркеру и Monaco (та же ловушка, что в angular-learn).
- **Библиотеки появляются после того, как ученик сделал то же самое руками**: сначала `useEffect`+`fetch` и гонки → потом TanStack Query; сначала Context+`useReducer` → потом Zustand и Redux Toolkit; сначала нативные формы и Actions → потом React Hook Form + Zod; сначала свои компоненты → потом Ant Design.
- **Ant Design 6** — UI-кит курса (глава 15 и админка, глава 18). До главы 15 магазин свёрстан своими компонентами и общим `styles.css`.
- **Данные** — учебный бэкенд внутри превью (перехват `fetch` по `/api/...`) из angular-learn: задержка, ошибки 500, отмена, токены. Никаких внешних API.
- **Чего нет в превью** (Vite-проект, ESLint, сборка, SSR, React Server Components, Next.js, Playwright) — изучается в части 3 на машине ученика. Node 22+ (сейчас у автора Node 20 — Next 16 и react-router 8 требуют 22+).
- **Тексты** — на русском, идентификаторы — на английском, комментарии в коде — на русском, интерфейс магазина — на русском.

## Структура репозитория

```
CLAUDE.md
docs/                 — документация проекта (этот контекст)
content/              — уроки курса (см. lesson-format.md)
src/                  — код платформы (Vite + React + TS), перенесён из ../angular-learn/src
  compiler/ editor/ preview/ lesson/ app/ content/ progress/
shared/step-chain.js  — сборка полного кода шага из изменений (из angular-learn без изменений)
shared/compile-core.js — компиляция шага: TSX → JS, CSS и CSS Modules → модули (браузер, e2e, валидатор)
public/preview-runtime.js — среда выполнения кода ученика в iframe
public/backend/       — учебный бэкенд (копия из angular-learn)
public/assets/        — обложки игр (копия из angular-learn)
scripts/              — chapter (глава = ветка git → content/), todo-markers (метки @todo), copy-vendor (ESM-модули React
                        и библиотек + import map; PREVIEW_MODULES), validate-content, step-files, build-covers
tools/e2e/            — проверки в headless Chrome (перенос из angular-learn)
authoring/<глава>/    — рабочие папки глав: git worktree веток chapter/<глава> (не в основной ветке, см. .gitignore)
spikes/esm-preview/   — прототип этапа 0: React и библиотеки в iframe без сборщика (README — результаты и решения)
```

У каждой главы — квиз `content/<глава>/quiz.yaml` (10–15 вопросов, один правильный ответ; глава пройдена при ≥ 85 %; формат — `docs/lesson-format.md`). В `content/` главы `01-first-app` (с демо-магазином шага 1.1 — на нём работают проверки платформы), `02-jsx` и `03-components`.

## Команды

- `npm run dev` — платформа на **http://localhost:5190** (5173/5174 — PixiJS, 5180 — Angular)
- `npm run chapter new|open|status|export|fix|sync-base <глава>` — код шагов главы: ветка `chapter/<глава>` и рабочая папка `authoring/<глава>`, один коммит — один шаг; `export` раскладывает коммиты в `content/` (подробно — `docs/authoring-process.md`, раздел 2)
- `npm run validate` — структура уроков, цепочка шагов, сборка и типы кода каждого шага
- `npm run step <…/шаг/solution>` — выгрузить полный код шага
- `npm run build` — проверка типов и продакшен-сборка
- `npx prettier --check .` — форматирование (код уроков — как кнопка «Формат»: `shared/lesson-prettier.json`, ширина 64)
- `node tools/e2e/run-dir.mjs <папка шага> [адрес] [мс]` — код шага в чистом превью: консоль, запросы, адрес, текст, скриншот в `tools/e2e/out/`
- `node tools/e2e/run-chapter.mjs <глава>`, `node tools/e2e/exp.mjs <папка> <сценарий.mjs> [адрес]` — как в angular-learn
- `node tools/e2e/checks/quiz.mjs` — квиз главы: перемешивание, зачёт 85 %, прогресс, оглавление (после правок в `src/quiz/`)
- `node tools/e2e/checks/preview.mjs` и `checks/platform.mjs` — проверки среды превью и интерфейса на демо-магазине шага 1.1 (после любых правок в `src/`, `public/`, `shared/`, `scripts/copy-vendor.mjs`)
- Проверки требуют запущенного `npm run dev` и Chrome (`CHROME_PATH`, по умолчанию путь macOS). Другой адрес — `BASE_URL=http://localhost:5191`
- Новая библиотека для превью: `PREVIEW_MODULES` в `scripts/copy-vendor.mjs` + точная версия в `package.json` + `.d.ts` в `src/editor/library-types.ts` (`typeFiles`, при необходимости `typedPackages`)

## Текущий статус

**Этапы 0 и 1 готовы, главы 1 «Первое приложение» (7 шагов), 2 «JSX и разметка» (8 шагов) и 3 «Компоненты и props» (8 шагов) написаны**; все утверждения проверены запуском — `checks/ch01-first-app.mjs`, `checks/ch02-jsx.mjs`, `checks/ch03-components.mjs`. У глав есть квизы (`quiz.yaml`, страница `/<глава>/quiz`, `checks/quiz.mjs`). Код глав пишется коммитами в ветках `chapter/*` (`scripts/chapter.mjs`). Главы 1–3 вычитаны (2026-10-08). **Следующий шаг — глава 4 «Состояние и события»**: пошагово в `docs/roadmap.md`, раздел «Следующий шаг».

## Пользователь и тон работы

- Пользователь — автор курса. Общение на русском.
- Перед большой работой — короткий план; по ходу — короткие сообщения; в конце — итог: что сделано, как проверено, что осталось.
- После завершения этапа или главы — обновить `docs/roadmap.md` (статус + «Следующий шаг») и раздел «Текущий статус» здесь. Это главный способ передать работу следующему агенту.

## Как работать над уроками

1. Найти шаг в `docs/course-plan.md`, проверить, что уже известно ученику.
2. Писать по `docs/writing-guide.md`; термины — по `docs/glossary.md`.
3. **Код шагов — коммитами в ветке главы** (`authoring/<глава>/`, один коммит — один шаг, заготовки — метками `@todo … @end`), в `content/` его раскладывает `npm run chapter export`. `start/` и `solution/` в `content/` руками не правим; текст — прямо в `content/<глава>/<шаг>/lesson.md`. Процесс — `docs/authoring-process.md`, раздел 2.
4. **Факты об API — по типам и исходникам установленных версий в `node_modules`, а не по памяти.** В памяти модели и в интернете очень много React 16–18 (классы, `forwardRef`, `useEffect` для данных, CRA, React Router 5/6, antd 4/5, React Query 3/4, Redux без Toolkit). Проверенное — в `docs/modern-react.md`.
5. Каждое утверждение и эксперимент из текста проверять запуском (`tools/e2e/run-dir.mjs`). Особенно: «сколько раз отрендерится», «в каком порядке сработают эффекты», «отменится ли запрос» — только по логу.
