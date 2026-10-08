Документ для того, кто пишет курс: человека или модели в новом чате. Здесь описаны **процесс** написания главы, обязательные проверки и ловушки. Процесс унаследован от `../angular-learn/docs/authoring-process.md` (по нему написаны 10 глав и найдены десятки ошибок черновиков) с одним большим отличием: **код шагов пишется не Python-генератором, а коммитами в ветке главы** (раздел 2). Прочитайте этот документ целиком перед началом работы вместе с `CLAUDE.md`, `docs/writing-guide.md` и `docs/modern-react.md`.

# Процесс написания главы

## 0. Подготовка

```bash
npm install
npm run dev                          # http://localhost:5190 — нужен для всех проверок
node tools/e2e/checks/platform.mjs   # «Всё прошло»
```

Прочитать: строки главы в `course-plan.md` (ориентир, а не закон), что глава добавляет в магазин (`project-app.md`), последний шаг прошлой главы целиком (`npm run step content/<глава>/<последний шаг>/solution`), библиотеки главы в `libraries.md`, пункты главы в `modern-react.md` («Ожидается — проверить»).

## 1. Сверка API до написания кода

Никаких утверждений по памяти: память модели — это в основном React 16–18 и старые мажорные версии библиотек. Для каждой библиотеки главы:

```bash
cat node_modules/<пакет>/package.json | grep '"version"'
NODE_ENV=development node -e "console.log(Object.keys(require('<пакет>')).sort().join('\n'))"   # CJS-экспорты
grep -n '<имя>' node_modules/@types/react/index.d.ts node_modules/@types/react/canary.d.ts      # стабильность
```

Проверять: сигнатуры, **значения по умолчанию**, стабильность (`index.d.ts` — стабильно; только в `canary.d.ts`/`experimental.d.ts` или с префиксом `unstable_` — нет), поведение (development-сборка). Новая для превью библиотека — сначала в vendor (`PREVIEW_MODULES` в `scripts/copy-vendor.mjs`, точная версия в `package.json`, `.d.ts` в `src/editor/library-types.ts`), затем `checks/preview.mjs`. Проверенное — в `modern-react.md`, таблица «Проверено».

## 2. Код шагов: глава — ветка git

Код главы живёт в ветке `chapter/<глава>` и пишется в её рабочей папке `authoring/<глава>/` (git worktree; папка в `.gitignore` основной ветки) — как обычный проект: файлы `.tsx`, подсветка, автодополнение, проверка типов в IDE (`authoring/tsconfig.json` с настройками кода уроков), Prettier с настройками кода уроков. **Один коммит — один шаг.** Скрипт `npm run chapter export` раскладывает коммиты в `content/<глава>/<шаг>/{start,solution}` — только изменения, как ждёт платформа (`shared/step-chain.js`). Руками `start/` и `solution/` в `content/` не правим: следующий `export` перезапишет.

```bash
npm run chapter new 02-jsx -- --title "JSX и разметка" --description "…"
#   ветка chapter/02-jsx с коммитом «base: 01-first-app/06-practice» (результат прошлой главы),
#   рабочая папка authoring/02-jsx, content/02-jsx/chapter.json, глава — в content/course.json
cd authoring/02-jsx
#   … пишем код шага …
git add -A && git commit -m "01-expressions: Выражения в JSX"
#   … следующий шаг …
git add -A && git commit -m "02-attributes: Атрибуты"
cd ../..
npm run chapter status 02-jsx      # коммиты → шаги: «старт = прошлый шаг» / «заготовка: N TODO» / «свой старт» / «без решения»
npm run chapter export 02-jsx      # → content/02-jsx; затем npm run validate
```

Коммиты ветки:

| Сообщение коммита | Что это |
|---|---|
| `base` / `base: 01-first-app/06-practice` | Первый коммит (создаёт `new`): код, с которого глава начинается. У главы 1 — пусто |
| `03-lists: Списки` | Решение шага. Папка шага — `03-lists`, заголовок новой заготовки `lesson.md` — «Списки» |
| `03-lists start: Списки` | (Необязательно, перед решением) закадровая подготовка — свой старт шага: удалить файлы, вынести код, положить заготовку. В тексте шага подготовку нужно описать |
| только `… start: …`, без решения | Шаг без решения (`noSolution`): теория, демо |

**Заготовки — метками в решении** (`scripts/todo-markers.mjs`), отдельный коммит `start` для них не нужен:

```tsx
export function Counter() {
  // @todo Добавьте счётчик через useState
  const [count, setCount] = useState(0);
  // @end
  return (
    <main>
      {/* @todo Выведите счётчик */}
      <p>{count}</p>
      {/* @end */}
    </main>
  );
}
```

Старт шага: блок заменён строкой `// TODO: Добавьте счётчик через useState` (`{/* TODO: … */}` в JSX, `/* TODO: … */` в CSS) с тем же отступом; всё остальное, что поменялось в коммите, ученик получает готовым. Решение: код без строк-меток. Метки можно не убирать в следующих шагах: заготовкой становятся только **новые** метки коммита (их текста не было в этом файле в прошлом коммите). Без новых меток и без коммита `start` старт шага — результат прошлого шага (ученик пишет всё сам по тексту урока). Коммит `start` и метки совмещаются: заготовки строятся поверх коммита `start` (так сделан практикум главы 2 — `start` убирает демо прошлого шага, метки дают `TODO`).

**Исправить ранний шаг:**

```bash
#   правим файлы в authoring/02-jsx так, как они должны выглядеть В ШАГЕ 01-expressions
#   (обычно — после git checkout <коммит шага> -- <файл> или вручную), затем:
npm run chapter fix 02-jsx 01-expressions            # правка → в коммит решения шага (git commit --fixup + rebase --autosquash)
npm run chapter fix 02-jsx 03-lists -- --start       # правка → в коммит «start» шага
npm run chapter export 02-jsx
```

Git сам переносит правку во все следующие шаги. Если следующий шаг менял те же строки — rebase остановится с конфликтом: исправить файлы в `authoring/02-jsx`, `git add -A`, `GIT_EDITOR=true git rebase --continue` (или `git rebase --abort`). Для правки «в последнем шаге» `fix` не нужен — `git commit --amend`.

**Изменилась прошлая глава** — `npm run validate` скажет «база … изменилась», а `export` откажется работать:

```bash
npm run chapter sync-base 02-jsx   # новый коммит base из content/ прошлой главы, коммиты шагов — поверх (git rebase --onto)
npm run chapter export 02-jsx      # и так далее по цепочке глав, если изменился и последний шаг этой
```

Прочее: `npm run chapter open <глава>` — рабочая папка для существующей ветки (после клонирования; ветки `chapter/*` нужно отправлять в origin вместе с основной); `npm run chapter export all` — все главы курса по порядку (после изменения `shared/lesson-prettier.json`). `export` форматирует код Prettier с настройками кода уроков, создаёт `lesson.md`-заготовки для новых шагов и сам ведёт поля frontmatter `startFrom`, `noSolution`, `base`, `baseHash`, `removedInStart`, `removedInSolution`; остальные поля и текст `lesson.md` не трогает. Шаг, которого больше нет в ветке, `export` не удаляет — предупреждает.

Правила:

- первый шаг главы всегда `custom`: его старт — база (у главы 1 — полный снимок);
- интерфейс магазина должен помещаться в превью **500 × 600** без растягивания панелей;
- после `export`: `npm run validate` — полный код всех шагов собирается и проверяется по настоящим типам (в `.content-check/`), `npx prettier --check .`.

## 3. Проверка запуском до текста

```bash
node tools/e2e/run-dir.mjs content/03-state/02-use-state/solution            # консоль, запросы, адрес, текст, скриншот
node tools/e2e/run-dir.mjs content/10-routing/03-params/solution /games/8   # с начального адреса
```

Обязательно:

- консоль без ошибок и без предупреждений React (`key`, неуправляемое → управляемое поле, `act`) — кроме тех, что шаг показывает намеренно;
- текст страницы — тот, что обещает урок;
- скриншот — откройте и посмотрите глазами (вёрстка в 500 px, переполнение, пустые места);
- **рендеры и порядок эффектов — считать логом**, а не рассуждением. В превью `StrictMode` (он в `main.tsx`) удваивает рендер и цикл эффектов — в тексте говорить, с StrictMode число или без;
- для глав с запросами — гонки и отмена по вкладке «Сеть» с задержкой 1000–3000 мс.

Эксперименты из текста — копией шага в scratchpad: `npm run step <…/шаг/solution> <папка>/solution`, правка, `run-dir.mjs` или сценарий `exp.mjs` (клики, ввод, переходы — см. `tools/e2e/exp.mjs`). В `tools/e2e/lib.mjs` есть всё для своих проверок глав: `compileDir`, `compileMap`, `openPreview(browser, compiled, { url, backend, waitMs })` (с чистым `localStorage`), `collect` (ошибки, запросы и консоль так, как её видит ученик — строки `[preview:error] …`), `pageText`, `appUrl`, `navigate`. Образцы — `checks/preview.mjs` (чистое превью) и `checks/platform.mjs` (интерфейс платформы, код ученика подкладывается в `localStorage`).

## 4. Текст уроков

По `docs/writing-guide.md`. Текст пишется прямо в `content/<глава>/<шаг>/lesson.md` (`export` создаёт заготовку и не трогает написанное). Структура шага: зачем → объяснение → код с подсветкой строк → `::: task` → «Что получилось» → эксперименты → «Как в настоящем проекте» → `::: deep` / `::: legacy`. Практикум: `::: task` со списком, `::: hint` от общего к конкретному, «Проверьте себя», «Итоги главы» с мостиком к следующей главе.

## 5. Проверка каждого утверждения в тексте

Самый важный этап. Каждое фактическое утверждение и **каждый предложенный эксперимент** («уберите X — увидите Y») проверяется кодом или исходниками: тексты предупреждений React — только увиденные в консоли; «перерисуется / не перерисуется» и «сколько раз» — логом; «запрос отменится» — по вкладке «Сеть»; порядок эффектов — логом.

Записывайте найденные ошибки черновиков в таблицу — это память проекта.

| Утверждение в черновике | Как на самом деле |
|---|---|
| «В „Сети“ один запрос каталога» (черновик шага 1.1) | Два: первый «отменён» — StrictMode монтирует компонент дважды, Query отменяет запрос через `signal`. Объяснено в тексте шага |
| «Ошибка типов — `main.tsx:13:6`» (черновик 1.6, посчитано по коду шага 1.4) | `main.tsx:14:10`: в шаге 1.5 добавился импорт стилей, а TypeScript указывает на атрибут `title`, а не на имя компонента |
| «После подключения стилей шрифт сменился» (черновик 1.5) | Шрифт и раньше был системным (его задаёт страница превью); меняются размер и цвет заголовка, отступ, цвет подписи |
| Вывод `Object.keys(element)` в консоли — `[$$typeof, type, …]` (черновик 1.7) | Консоль превью показывает строки массива в кавычках: `["$$typeof", "type", …]` |
| «С синтаксической ошибкой приложение не запустится» (замысел 1.2) | Превью запускало то, что TypeScript собрал «как получилось» (без `<main>` на экране был один абзац). Платформа исправлена: при ошибке сборки код не запускается, как в Vite |
| «Новые метки `@todo` дают заготовку» (практикум 2.8 с коммитом `start`) | `chapter.mjs` игнорировал метки, если у шага есть коммит `start`: старт практикума был без `TODO`. Исправлено — метки работают поверх `start` |
| «`{discount && …}` — ловушка» (замысел 2.8) | Подтверждено: на обложках без скидки — `0` в углу. Вошло в подсказку практикума |
| «React чистит HTML, как Angular» (ожидание читателя из Angular) | Нет: `dangerouslySetInnerHTML` вставляет как есть, `onerror` выполняется; `javascript:` React 19 блокирует только в своих `href`/`src`/`action`/`formAction`, внутри HTML-строки — нет |
| «Ученик сам создаст `layout/Header.tsx`» (замысел 3.1) | В редакторе платформы нельзя создать файл. Новый файл приходит в коммите `start` заготовкой из одних комментариев (импорт без использования — ошибка `noUnusedLocals` в старте), стили — готовыми |
| «`console.log(children)` — по строке на бейдж» (черновик 3.3) | Каждая строка дважды (строгий режим), порядок — по карточкам сверху вниз; консоль платформы сворачивает повторы в счётчик |
| «Props заморожены — изменить их нельзя» (замысел 3.5) | Заморозка неглубокая: `props.game =` — `TypeError`, а `game.tags.push` проходит и портит общий объект у всех карточек (два «хита» в «Хитах», четыре во «Всех играх»). TypeScript молчит в обоих случаях |
| «У Ant Design `Card` — `title`/`extra`, у `Table` — `render`» (черновик 3.4) | antd ещё не установлен — проверить нечем; конкретика убрана из текста до главы 15 |
| «Неверный `tone` — React предупредит» (замысел 3.3) | Нет: `styles[tone]` даёт класс `undefined` без сообщений; ловит только TypeScript |
| «Метка `@todo` вокруг объявлений даст заготовку шага» (4.1) | JSX с `handleAddClick` и `quantity` в том же коммите приходит готовым — старт не собирается (TS2304, `ReferenceError`). Метки — только вокруг кода, который без остального не нужен; иначе старт = база, всё по тексту |
| «Добавьте в начало `GameCard` `console.log(…, quantity)`» (черновики 4.2, 4.4, 4.5) | `quantity` объявлена ниже (после вычислений карточки) — в начале функции `ReferenceError` (TDZ). В тексте — «сразу после `useState`» |
| «Отправка формы без `preventDefault` перезагрузит страницу» (замысел 4.3) | В превью iframe уходил на `preview.html?email=…` — приложение пропадало. Платформа исправлена: `submit` перехватывается как обычная ссылка — перезапуск с адреса формы |
| «Путь к состоянию — от DOM-узла через `__reactFiber$`, как в 3.7» (замысел 4.8) | Лог отставал на одно обновление: ссылка в DOM-узле ведёт на одну из двух копий файбера. Файбер `App` берём от корня: `__reactContainer$….stateNode.current.child.child` |
| «Двадцать вызовов компонентов на клик» (черновик 4.8) | `App` ×2, `Header` ×2, `GameCard` ×18, плюс невидимые в логе `Section`, `Badge`, `Rating`, `Button` — «десятки» |
| «Копия количества устарела — на странице игры 0, а в корзине 3» (замысел 5.4) | Хуже: устаревшая копия не выключила кнопку, и в корзину ушло 4 «Ночных экспресса» при остатке 3 — так и написано в тексте |
| «`useImmerReducer(cartReducer, [])` выведет тип из редьюсера, как `useReducer`» (черновик 5.7) | Нет: тип берётся из начального значения — `never[]` и `Property 'quantity' does not exist on type 'never'`. В коде — `initialCart: CartItem[]` |
| «`onSubmit` — `FormEvent<HTMLFormElement>`» (по памяти) | В `@types/react` 19.3 `FormEvent` — `@deprecated`; в курсе `SubmitEvent<HTMLFormElement>` |
| «Сначала экран нарисуется со старым значением, потом эффект…» (черновики 5.3, 5.5) | Отрисует ли браузер промежуточный кадр — не проверено (эффекты после дискретных событий React может выполнить до отрисовки). В тексте — «зафиксирует в DOM», без «нарисует» |
| «В FormData лог `[["email","a@b.ru"],…]`» (черновик 5.2) | Консоль превью печатает массивы с пробелами: `[["email", "a@b.ru"], ["topic", "new"]]` |
| «`useState` и `useReducer` одинаково сравнивают через `Object.is`» (черновик `deep` 5.6) | У `useState` есть ранний выход без рендера (глава 4), у `useReducer` в React 19 редьюсер работает только при рендере. В тексте — только общая очередь и пакетная обработка |

## 6. Регистрация и прогон в платформе

`npm run chapter new` сам добавляет главу в `content/course.json`. После текста: `node tools/e2e/run-chapter.mjs <глава>` (имя главы, без `content/`) — все шаги в интерфейсе платформы с «Решением»; своя проверка главы `tools/e2e/checks/chNN-<slug>.mjs` (по образцу `checks/preview.mjs`) — ключевые утверждения главы запуском.

## 6а. Квиз главы

`content/<глава>/quiz.yaml` — после текста всех шагов (формат — `lesson-format.md`, правила — `writing-guide.md`, «Квиз главы»). Для каждого вопроса — строка «на каком утверждении какого `lesson.md` основан ответ»; утверждения, которых в тексте нет, в квиз не попадают. Затем `npm run validate` и `node tools/e2e/checks/quiz.mjs` (интерфейс квиза на главах 1–2; после правок в `src/quiz/` — обязательно).

## 7. Документация

После главы: «Фактическое состояние» ниже (шаги как получились, что в коде магазина, технический долг, опоры для следующей главы), `docs/roadmap.md` (статус и «Следующий шаг»), «Текущий статус» в `CLAUDE.md`, новые факты — в `modern-react.md`, новые термины — в `glossary.md`.

# Ловушки окружения

Перенесены из angular-learn (то, что касается платформы и инструментов) и дополнены; дописывайте новые.

- **TypeScript 7** (Go-версия) не имеет JS API. Воркеру компиляции, Monaco-обвязке и скриптам нужен **TypeScript 6.0**.
- **Node 20** у автора: скрипты в `scripts/` и `tools/` — `.mjs`. Для глав 22–23 (Next 16, react-router 8 CLI, `npm create vite`) нужен Node 22+ (`nvm use 24.15`).
- **zsh**: `*.ts`, `[`, `?` без кавычек в аргументах — glob («no matches found»); слово из одних `=` — путь к команде. Для поиска по исходникам удобнее Python.
- **Не пишите во временные файлы `/tmp`**: scratchpad сессии или `tools/e2e/out/` (в `.gitignore`).
- **YAML во frontmatter**: `@`, `{`, `[`, `:`, `<` внутри списков — в кавычках.
- **Vite `optimizeDeps.include`**: новый динамически импортируемый модуль платформы — туда, иначе «Failed to fetch dynamically imported module» или перезагрузка страницы посреди проверки.
- **Dev-сервер после правок `src/` или `vite.config.ts`** может отвечать `504 (Outdated Optimize Dep)` — перезапустить `npm run dev`. Второй сервер со своим кэшем — порт 5191 и `BASE_URL=http://localhost:5191` (продакшен-сборку проверять так же: `npx vite preview --port 5191`).
- **Порты**: 5173/5174 — PixiJS, 5180 — Angular, **5190** — React.
- **`localStorage` превью — общий с платформой** (один origin): корзина магазина (`persist`) переживает переход между шагами, «Сброс» её не трогает. `openPreview` в `lib.mjs` очищает `localStorage` перед запуском; проверки интерфейса начинают с `localStorage.clear()`.
- **Puppeteer и iframe превью**: после перезапуска (адресная строка, ⟳, обычная ссылка) iframe новый — брать заново: `(await page.$('.preview iframe')).contentFrame()`.
- **Puppeteer и Monaco**: пробелы в строках редактора — неразрывные, токены склеиваются в один `span`. Слово ищите `includes`, координаты — через `document.createRange()`.
- **`confirm()` и Puppeteer**: щелчок, который открывает `confirm`, блокирует `elementHandle.click()`. В `checks/*` — общий `page.on('dialog')`, щелчок из страницы: `$eval(sel, (el) => setTimeout(() => el.click()))`. «Решение» в платформе тоже спрашивает `confirm`.
- **Консоль платформы сворачивает одинаковые строки подряд** (`.console-count`): «сколько раз напечаталось» — по счётчику. В чистом превью (`exp.mjs`, `openPreview`) строки не сворачиваются.
- **Синтаксическая ошибка** — в консоли один раз, с меткой «Сборка» (компиляция); метка «TS» — только ошибки типов. Подчёркивания в редакторе — обе.
- **Намеренно сломанный старт** (шаг про отладку): frontmatter `brokenStart: true` — валидатор не собирает и не проверяет его; путь — в `.prettierignore`. Для ошибки TypeScript без падения приложения — ошибка только в типах (`const n: number = 'строка'`).
- **Ошибка при рендере роняет всё дерево** до ближайшей границы ошибок (у роутера — встроенная «Unexpected Application Error!»): эксперименты «сломайте X» проверять запуском — дальше по странице ничего не отрисуется.
- **В `content/` у шага только изменения.** Пути `…/<шаг>/start` и `…/solution` в `run-dir.mjs`, `exp.mjs`, `readDir` дают полный код; копировать папку шага (`cp -r`) нельзя — получите только изменения. Полный код: `npm run step <путь> [папка]`. Копия шага для эксперимента — в папку `<имя>/solution` (иначе `readStepDir` молча соберёт пустое приложение).
- **IDE и частичные папки `content/…/solution/`** могут подчёркивать импорты файлов, которых там нет. Код главы читайте и правьте в `authoring/<глава>/`, ошибки типов смотрите в `npm run validate`.
- **Формат кода уроков = кнопка «Формат»**: `shared/lesson-prettier.json` (ширина 64) читают редактор, `prettier.config.mjs` (`content/` и `authoring/`) и `chapter export`. Поменяли настройки — `npm run chapter export all`, `npm run validate`, `checks/platform.mjs` (проверяет, что «Формат» не меняет файлы уроков). Код в `lesson.md` не форматируется.
- **Ширина ASCII-схем в тексте урока — не больше 46 символов** (панель урока при окне 1440 px).
- **Проверяйте эксперименты на коде того шага, о котором текст**, а не на решении последнего шага.
- **Неразрывные пробелы** (`Intl.NumberFormat('ru-RU')` пишет U+00A0 в «1 990 ₽») — в проверках сравнивать после замены на обычный пробел.
- **Циклические импорты превью не поддерживает** («Циклический импорт: … → … → …»), в настоящем проекте Vite их собирает.
- **Обычная ссылка `<a href>` в превью перезапускает приложение** с её адреса (как ⟳), `Link` роутера — нет. `navigate` в `exp.mjs` — `pushState` + `popstate`, без перезапуска.
- **zsh и `$VAR:x`**: `git show $S:layout/…` zsh читает как модификатор `:l` (нижний регистр) — получается чужой путь и пустой файл. Пишите `${S}:layout/…`.
- **`run-dir.mjs` на `authoring/<глава>`** запускает пустое приложение: читает формат шага, а не обычную папку. Сначала `npm run chapter export`, затем `run-dir.mjs content/<глава>/<шаг>/solution`.
- **Тексты ошибок TypeScript в уроке** — из `typeErrors` в `checks/ch03-components.mjs` (полный код эксперимента, настройки `tsconfig.content.json`), а не из памяти.
- **`chapter fix` для удаления меток** (или любой правки строк, которые следующий шаг тоже меняет) — конфликт rebase на следующем шаге. Решение: в конфликте записать файл в состоянии шага (`git show <коммит шага>:<файл>`), `git add -A`, `GIT_EDITOR=true git rebase --continue`; в конце сравнить итоговое дерево с прежним (`git diff <старый HEAD> HEAD`).
- **Стенд в scratchpad с `launch()` на верхнем уровне модуля** не завершается сам: закрывайте браузер (`browser.close()`), иначе команда висит до таймаута.
- **Правки кода главы скриптом** (Python `str.replace`) молча ничего не делают, если строка не совпала: Prettier переносит длинные строки, а в базе главы (код из `content/` прошлой главы) меток `@todo` уже нет. Проверяйте, что замена случилась (`assert old in s`), или правьте через редактор.
- **`tsc` по коду глав — из папки `authoring/`**: `cd authoring && npx tsc -p tsconfig.json --noEmit | grep <глава>`. Из папки главы пути в выводе без префикса главы, и `grep <глава>` ничего не найдёт.
- **Пробелы в JSX у тега на одной строке** (`(<div>          <X />`) — текстовый узел: у `X` индекс файбера 1, а не 0. В экспериментах «индекс среди соседей» код вставлять с переносами строк (как после Prettier).
- **Рабочие папки глав — git worktree.** Не удаляйте `authoring/<глава>` руками: `git worktree remove authoring/<глава>` (или `git worktree prune` после удаления). Ветки `chapter/*` — часть исходников курса: отправляйте их в origin (`git push origin 'chapter/*'`).

# Фактическое состояние

Для каждой написанной главы: шаги (как получилось на самом деле, а не по плану), что осталось в коде магазина к концу главы (файлы, компоненты, сторы), технический долг и опоры для следующей главы. Образец — `../angular-learn/docs/authoring-process.md`, раздел «Фактическое состояние».

## Глава 1 «Первое приложение» — 7 шагов

Ветка `chapter/01-first-app`; все утверждения и эксперименты проверены запуском (`checks/ch01-first-app.mjs`, 26 проверок) и `tsc`.

- 1.1 «Что такое React» (`noSolution`) — демо-магазин (каталог `useQuery` + `signal`, игра `loader` + `HydrateFallback`, корзина Zustand + `persist`, 404, CSS Modules, `<title>`); на нём работают `checks/preview.mjs` и `checks/platform.mjs`.
- 1.2 «Первый компонент» (свой старт: демо удалено, `App` возвращает `null`) — `App` возвращает `<main>` с `<h1>` и `<p>`. Эксперименты: без обёртки (ошибка сборки), компонент с маленькой буквы.
- 1.3 «Запуск приложения» — `main.tsx` по шагам: `container`, проверка `#root`, `createRoot`, `root.render`. Эксперименты: неверный id, `innerHTML` сразу и через 100 мс; `::: deep` про планирование и `flushSync`.
- 1.4 «Строгий режим» — `<StrictMode>` в `main.tsx`; эксперимент `console.log('render App')` ×2.
- 1.5 «Стили» (свой старт: готовые `styles.css` и `App.module.css`) — `import './styles.css'`, `styles.page`/`styles.title`, `className="muted"`, `♞ Ход конём`. Эксперименты: настоящее имя класса, опечатка `styles.titel`.
- 1.6 «Отладка» (`brokenStart`: `</h2>`, `hits[0].toUpperCase()`, `<App title=…>`) — три метки консоли по очереди; решение = код шага 1.5.
- 1.7 «Под капотом: JSX» (`noSolution`, пустой коммит `start`) — `jsxDEV`, React-элемент, «Итоги главы».

Код магазина к концу главы: `main.tsx` (`StrictMode`, `createRoot` с проверкой `#root`, `import './styles.css'`), `App.tsx` (заголовок и подпись), `App.module.css`, `styles.css` (глобальные стили магазина из демо: переменные цветов, `h1`, `.button`, `.grid`, `.muted`, `.search`).

Опоры для главы 2: данных игр ещё нет — `api/models.ts` (тип `Game` из демо шага 1.1) и локальный массив игр появятся в главе 2; обложки — `/assets/covers/<slug>.svg`; классы `.grid`, `.button`, `.muted` уже в `styles.css`.

## Глава 2 «JSX и разметка» — 8 шагов

Ветка `chapter/02-jsx`; все утверждения и эксперименты проверены запуском (`checks/ch02-jsx.mjs`, 35 проверок) и `tsc`.

- 2.1 «Выражения в JSX» (свой старт: `api/models.ts` — тип `Game`, `data/games.ts` — 6 игр (id 1, 2, 4, 7, 10, 11: со скидкой, распроданный «Маяк», «Ночной экспресс» с остатком 3, «Нарды» 2–2 игрока), `shared/format.ts` — `formatPrice`, `App.module.css` со стилями всей главы) — карточка `games[0]`. Эксперименты: таблица «что рисуется» (`[0][][][][][][NaN][123]`), объект в `{}`, `if` в `{}`, `{' '}`.
- 2.2 «Атрибуты» — `img` (`src`, `alt`), `data-category` (цветная полоска через CSS), полоска рейтинга `style={{ width }}` + `role="img"` + `aria-label`. Эксперименты: `outerHTML`, `class`, `style` строкой; `::: deep` про атрибуты и свойства DOM.
- 2.3 «Условный рендер» — `FEATURED_ID` + `find` + ранний `return`, старая цена `!== undefined &&`, тернарный «Нет в наличии» / кнопка. Ловушка `{game.inStock && …}` на «Маяке».
- 2.4 «Списки» — `games.map` с `key={game.id}` в `.grid`; `FEATURED_ID` и ранний `return` удалены. Эксперименты: без `key`, `key={game.category}`, `filter`.
- 2.5 «Фрагменты» — `<>` для `<header>` + `<main>`, тело функции в `map`, `specs` и `<dl>` с `<Fragment key>`. Эксперименты: `div` вместо `Fragment` (раскладка ломается), `<>` в списке, без `<>`.
- 2.6 «Безопасность» — баннер `PROMO_HTML` через `dangerouslySetInnerHTML`. Эксперименты: экранирование, XSS через `onerror`, `children` + `dangerouslySetInnerHTML`, `javascript:` в `href` и внутри HTML-строки.
- 2.7 «Под капотом: почему key» (`noSolution`, свой старт: `KeyDemo.tsx` с `useState`, `main.tsx` рисует `KeyDemo`) — индекс / id / `Math.random()` с полем заметки; алгоритм `reconcileChildrenArray` (3 перестановки при перевороте 4 строк — по `MutationObserver`).
- 2.8 «Практикум: карточка игры» (свой старт: `KeyDemo` удалён, `main.tsx` снова рисует `App`; 4 `TODO`) — `HIT_RATING = 4.6`, `FEW_LEFT = 5`, `discount`, бейджи поверх обложки (`styles.media`/`badges`/`badge`), теги; «Итоги главы».

Код магазина к концу главы: `main.tsx` (как в главе 1), `App.tsx` (~125 строк: `<>` + `<header>` + `<main>`: баннер `PROMO_HTML`, сетка карточек — обложка с бейджами, название, цена со старой, `<dl>` характеристик, теги, рейтинг, кнопка / «Нет в наличии»), `App.module.css` (стили карточки, бейджей, характеристик, баннера), `api/models.ts`, `data/games.ts`, `shared/format.ts`, `styles.css`.

Опоры для главы 3: карточка в `App.tsx` вложена на шесть уровней — первый шаг главы 3 выносит её в `shared/GameCard.tsx` (+ `GameCard.module.css`: классы карточки из `App.module.css`), `games.map((game) => <GameCard key={game.id} game={game} />)`; `key` не попадает в props — показать там. Полоска рейтинга — кандидат в `Rating` (практикум главы 3), бейджи — в «слоты» (3.4). Кнопка «В корзину» без обработчика — глава 4.


## Глава 3 «Компоненты и props» — 8 шагов

Ветка `chapter/03-components`; все утверждения и эксперименты проверены запуском и `tsc` (`checks/ch03-components.mjs`, 62 проверки). Шаги 3.1–3.4, 3.6 и 3.8 — со своим стартом: коммит `start` кладёт готовый `X.module.css` и заготовку `X.tsx` из одних комментариев, ученик переносит или пишет код по тексту.

- 3.1 «Свой компонент» — `layout/Header.tsx` (+ `Header.module.css`): шапка из `App`, сама импортирует `games`. Эксперименты: класс `Header_header_…`, `<header />` (пустой тег, консоль молчит), без `export` (TS2459 + `SyntaxError … does not provide an export named 'Header'`); врезка — компонент внутри компонента (поле теряет текст; правило `react-hooks/static-components`).
- 3.2 «Props» — `Header({ count })`, `shared/GameCard.tsx` (+ `GameCard.module.css`, константы карточки) с `game: Game`; `App` — 29 строк. Эксперименты: `console.log(props)` (12 строк, без `key`), `props.key` (TS2339; `(props as any).key` → `undefined` + «`key` is not a prop»), без `count` (TS2741, «в каталоге игр»), `count="6"`, `cout` («Did you mean 'count'?»); `::: deep` — `jsxDEV(GameCard, { game }, game.id, …)`.
- 3.3 «children» — `shared/Badge.tsx` (+ `.module.css`): `children: ReactNode`, `tone?: 'accent' | 'dark' | 'warning'` = `'accent'`; скидка — тон по умолчанию, «Хит» — `dark`, «Осталось» — `warning`. Эксперименты: `children` — строка или массив `["Осталось ", 3, " шт."]`, разметка в `children`, пустой бейдж (TS2741), `children` атрибутом, `tone="danger"` (класс `undefined`); `::: legacy` — `defaultProps` у функций молча не работают.
- 3.4 «Несколько слотов» — `shared/Section.tsx` (`title`, `extra?`, `children`), `shared/gameRules.ts` (`isHit`, готовый файл в старте), разделы «Хиты» (`extra` — `<Badge tone="dark">3</Badge>`) и «Все игры»; название в карточке — `<h3>`. Эксперименты: разметка в `title`, `{GameCard}` («Functions are not valid as a React child»); render-функции — обзорно (`GameList` с `renderItem`, проверено запуском).
- 3.5 «Однонаправленный поток» (`noSolution`, пустой `start`) — схема потока, `game.tags.push('хит')` (2 и 4 «хита» + предупреждения про ключи), `props.game =` (`TypeError`, заморозка неглубокая, только в dev), счётчик модуля №2…№18 со StrictMode и №1…№9 без; `Readonly<Props>`, правила `react-hooks/purity` и `immutability`.
- 3.6 «Типизация компонентов» — `shared/Button.tsx`: `ComponentProps<'button'>`, `type = 'button'`, `className`, `...rest`; «Нет в наличии» — `<Button disabled>` (класс `soldOut` удалён). Эксперименты: `className` + `title`, `onClick` (тип события выведен), `size="sm"` (TS2322); union-props (`Stock`) и деструктуризация до сужения (TS2339); `::: legacy` — `React.FC` (в `@types/react@17` — неявный `children`, в 19.3 — нет).
- 3.7 «Под капотом: дерево элементов и дерево компонентов» (`noSolution`, пустой `start`) — `App()` → `Symbol(react.fragment) ["Header", "main"]`, обход в глубину по логу (`Badge 3` раньше карточек), путь по файберам через `__reactFiber$` (`button ← Button ← article ← GameCard ← … ← App ← react.strict_mode ← null`; фрагмента верхнего уровня нет), `GameCard({ game })` — карточки нет в дереве, предупреждение про `key` у `App`.
- 3.8 «Практикум: Rating» (свой старт: `Rating.module.css`, заготовка `Rating.tsx`) — `Rating({ value, max = 5, size = 'md' })`: `Math.round(value)` закрашенных `★` из `max`, число, `role="img"` + `aria-label`, ключ-индекс; в карточке — `size="sm"` вместо полоски; «Итоги главы».

Код магазина к концу главы: `main.tsx` (как в главе 1), `App.tsx` (`Header`, баннер `PROMO_HTML`, `Section` «Хиты» и «Все игры» с `GameCard`), `App.module.css` (`page`, `promo`), `layout/Header.tsx` + `.module.css`, `shared/GameCard.tsx` + `.module.css`, `shared/Badge.tsx` + `.module.css`, `shared/Section.tsx` + `.module.css`, `shared/Button.tsx`, `shared/Rating.tsx` + `.module.css`, `shared/gameRules.ts`, `shared/format.ts`, `api/models.ts`, `data/games.ts`, `styles.css`.

Опоры для главы 4: `<Button>В корзину</Button>` в `GameCard` без обработчика — в главе 4 появятся `onAdd` в props карточки и состояние корзины в `App` (подъём состояния); `Button` уже пропускает `onClick` через `...rest`. «Хиты» и «Все игры» рисуют одну игру дважды — хорошая проверка, что корзина считает позиции по `id`, а не по карточкам. Шаг 3.7 обещает: «состояние карточки, вызванной функцией, досталось бы `App`» — в главе 4 это можно показать на `useState`. В 3.5 обещан пример, как React прерывает и повторяет рендер (глава 12).

## Глава 4 «Состояние и события» — 9 шагов

Ветка `chapter/04-state`; все утверждения и эксперименты проверены запуском и `tsc` (`checks/ch04-state.mjs`, 72 проверки), квиз — 14 вопросов. Порядок шагов изменён относительно первого плана: подъём состояния (4.6) — раньше массивов (4.7): сначала общее число в `App`, затем «числа мало — нужны позиции». Найдено и исправлено в платформе: отправка формы без `preventDefault` уводила iframe на `preview.html?…` — теперь перезапуск с адреса формы (`preview-runtime.js`, `checks/platform.mjs`).

- 4.1 «Проблема: обычная переменная» (свой старт: `.inCart` в `GameCard.module.css`) — `let quantity = 0` + `handleAddClick` + `onClick` (кратко), строка «В корзине: N шт.». Эксперименты: лог 1, 2, 3 при нулях на экране; переменная модуля — общий счётчик всех карточек.
- 4.2 «useState» — `const [quantity, setQuantity] = useState(0)`. Эксперименты: 18 строк `render` при запуске, щелчок — 2 строки одной карточки; у «Острова» в двух разделах разные состояния; `let clicks` всегда 1; TS2588 (присвоение), TS2345 (`setQuantity('1')`); `useState(0)` в обработчике — `Invalid hook call`; `::: deep` — `GameCard({ game })`: три хука у `App`, щелчок рендерит `App`.
- 4.3 «События» — `disabled={quantity >= game.inStock}`. Эксперименты: `onClick={handleAddClick()}` (TS2322, `Too many re-renders`, экран пуст), объект события `click SyntheticBaseEvent BUTTON PointerEvent`, TS7006, всплытие до `<article>` и `stopPropagation`, форма подписки с `preventDefault` и без (перезапуск с `/?email=…`).
- 4.4 «Состояние — снимок» (`noSolution`, пустой `start`) — три `setQuantity(quantity + 1)` → 1 и `после set: 0`; таймер 3 с → 0, 1, 2.
- 4.5 «Очередь обновлений» — `setQuantity((q) => q + 1)`. Эксперименты: таблица очереди (3, 1, 6, 42), функция обновления дважды в StrictMode, пакет в обработчике / `setTimeout` / после `await`, таймер 1 с: снимок → 1, функция → 2; `::: deep` — `flushSync`; `::: legacy` — React 17 и `unstable_batchedUpdates`.
- 4.6 «Подъём состояния» (свой старт: `.cart` и сетка в `Header.module.css`) — `cartCount` в `App`, `onAdd` у карточки, `cartCount` у шапки; состояние и лимит в карточке удалены. Эксперименты: щелчок — `render App` ×2 и 18 строк карточек; без `onAdd` — TS2741.
- 4.7 «Объекты и массивы» — `CartItem` в `api/models.ts`, `cart: CartItem[]` в `App`, `cartCount` через `reduce`, `quantityOf`, `handleAdd(gameId)` (функция обновления, `some` + spread / `map`), карточке — `quantity` и `onAdd={() => handleAdd(game.id)}`, строка «В корзине» при `quantity > 0`. Эксперименты: `useState([])` → `never`; `push` + `setCart(cart)` — экран 0, мутация всплывает (0 → 3); мутация в функции обновления — 5 со StrictMode, 3 без.
- 4.8 «Под капотом: рендер и фиксация» (`noSolution`, пустой `start`) — запуск → рендер → фиксация; `App` 2, `Header` 2, `GameCard` 18 при трёх изменениях DOM (`MutationObserver`: текст «1» и два `<p>`, затем три текста «2»); `setCart((items) => items)` и `setQuantity(quantity)` — ни одного рендера; состояние в `memoizedState` файбера `App` (от корня, две копии дерева).
- 4.9 «Практикум: мини-корзина» (свой старт: `cart/MiniCart.module.css`, заготовка `cart/MiniCart.tsx`; 4 `TODO` в `App.tsx`) — `MiniCart({ items, games, onIncrease, onDecrease, onRemove })` в `Section` с `Badge`, `− N +` (`<output>`), сумма позиции, «×», итог, `FREE_DELIVERY = 5000`; в `App` — `handleDecrease` (`map` + `filter`), `handleRemove` (`filter`); «Итоги главы».

Код магазина к концу главы: `main.tsx` (как в главе 1), `App.tsx` (~120 строк: `cart: CartItem[]` в `useState`, `cartCount`, `quantityOf`, `handleAdd`/`handleDecrease`/`handleRemove`; `Header`, акция, `MiniCart`, разделы «Хиты» и «Все игры» с `GameCard`), `api/models.ts` (+ `CartItem`), `cart/MiniCart.tsx` + `.module.css`, `layout/Header.tsx` (+ `cartCount`, сводка справа) + `.module.css`, `shared/GameCard.tsx` (+ `quantity`, `onAdd`, «В корзине: N шт.», лимит по остатку) + `.module.css`, остальное — как в главе 3.

Опоры для главы 5: логика корзины в `App` (три обработчика с `map`/`filter`/spread) — кандидат на `useReducer` (5.6) и Immer (5.7); `cartCount` и итог мини-корзины уже вычисляются при рендере — пример «вычислять, а не хранить» (5.3); в `MiniCart` `games.find(…)!` по `gameId` — к принципам структуры (5.4: id вместо объекта); стиль `.search` в `styles.css` ждёт поле поиска (5.1); форма подписки из эксперимента 4.3 — мостик к неуправляемым полям и `FormData` (5.2). В 4.3 обещано: `<form action>` — глава 12; в 4.4 — устаревшие замыкания в эффектах — глава 6; в 4.6 — контекст (8) и хранилища (9); в 4.8 — `memo`/React Compiler (16) и порядок хуков (7).

## Глава 5 «Структура состояния и поля ввода» — 9 шагов

Ветка `chapter/05-structure`; все утверждения и эксперименты проверены запуском и `tsc` (`checks/ch05-structure.mjs`, 86 проверок), квиз — 14 вопросов. До главы — Immer в vendor превью (`immer` 11.1.21, `use-immer` 0.11.0: `PREVIEW_MODULES`, типы Monaco — `library-types.ts`; у `use-immer` типы только в `exports.require` как `.d.ts`, поэтому `typesOf` в `monaco.ts` смотрит и `require`; `checks/preview.mjs` +3 проверки). Порядок изменён относительно плана: «Под капотом» (5.8) — перед практикумом (5.9), как в главах 3–4.

- 5.1 «Управляемые поля» (свой старт: `data/categories.ts`, `.toolbar`/`.field` в `App.module.css`) — `query` и `category` (`CategoryFilter = Game['category'] | 'all'`) в `App`, `visibleGames` при рендере, поиск и `<select>` над сеткой «Всех игр». Эксперименты: 2 буквы = 4 рендера `App`, `value` без `onChange`, `useState<string>()` (TS18048, затем «uncontrolled to controlled»), `selected` у `<option>`, TS2345 без `as CategoryFilter`.
- 5.2 «Неуправляемые поля» (свой старт: `layout/Footer.module.css`, заготовка `Footer.tsx`) — подписка: `name`, `defaultValue`, `defaultChecked`, `SubmitEvent`, `FormData`, `form.reset()`, `type="email"` + `required`. Эксперименты: ни одного рендера при вводе, `[...data.entries()]` без флажка, `defaultValue` после монтирования, `checked` без `onChange`.
- 5.3 «Вычислять, а не хранить» (свой старт: `.check`, поиск на всю ширину) — `inStockOnly`, `sort` (`SortOrder`, `COMPARE: Record<SortOrder, Compare>`), `toSorted`. Эксперимент: список в состоянии (`shown`) — «Космические коты» в «Семейных»; `::: legacy` — синхронизация эффектом.
- 5.4 «Принципы структуры состояния» (свой старт: готовый `game/GameDetails.tsx` + стили, `.titleButton`) — пять принципов, `selectedId: number | null`, `selectedGame` по id, страница игры вместо каталога (тернарный оператор + фрагмент), название карточки — кнопка `onSelect`. Эксперимент: копия `selectedQuantity` — 4 «Ночных экспресса» при остатке 3.
- 5.5 «Сохранение и сброс состояния» (свой старт: стили отзыва и `.nav`) — отзыв (управляемая `<textarea>`, счётчик, `sent`), «Следующая игра →» (`handleNext` по кругу), ошибка «отзыв уехал», `key={selectedGame.id}`.
- 5.6 «useReducer» (свой старт: заготовка `store/cartReducer.ts`) — `CartAction` (union, `'added' | 'decreased' | 'removed'`), `cartReducer` со `switch` и типом результата, `useReducer(cartReducer, [])`, обработчики — `dispatch`. Эксперименты: «после dispatch» раньше редьюсера ×2, TS2322 `'add'`, TS2345 без `gameId`; `::: deep` — `basicStateReducer`.
- 5.7 «Immer» (старт = прошлый шаг) — `produce` в `main.tsx` (`1 2`, `false false true`, `true true`), `cartReducer(draft, action)` на `push`/`splice`/`+=` с `break`, `initialCart`, `useImmerReducer`. Эксперименты: StrictMode +1, `TypeError` вне редьюсера, «returned a new value *and* modified its draft», TS7029.
- 5.8 «Под капотом: позиция в дереве» (`noSolution`, пустой `start`) — правило `key` + тип по `updateElement`, датчики `useState(() => …)` и `whereIs` (обход файберов от корня в `main.tsx`); ключ, обёртка `<div>` (место 0 у `div`), `{cartCount === 0 && …}` держит место 2, таблица из четырёх вариантов `Field`.
- 5.9 «Практикум: витрина» (свой старт: готовый `catalog/filters.ts` — `Filters`, `INITIAL_FILTERS`, `filterGames`; `catalog/CatalogFilters.module.css`, `.empty` в `App.module.css`, заготовка `CatalogFilters.tsx`) — `CatalogFilters({ filters, onChange })`, одно состояние `filters`, бейдж с числом, «Ничего не нашлось» + «Сбросить фильтры»; «Итоги главы».

Код магазина к концу главы: `main.tsx` (как в главе 1), `App.tsx` (~160 строк: `filters` + `filterGames`, `useImmerReducer(cartReducer, initialCart)` + три обработчика с `dispatch`, `selectedId` + `selectedGame`, `handleNext`, `quantityOf`; `Header`, акция, `MiniCart`, страница игры **или** «Хиты» и «Все игры» с `CatalogFilters`, бейджем и пустым состоянием; `Footer`), `catalog/CatalogFilters.tsx` + `.module.css`, `catalog/filters.ts`, `game/GameDetails.tsx` + `.module.css` (отзыв, навигация), `layout/Footer.tsx` + `.module.css` (подписка), `store/cartReducer.ts` (`CartAction`, `initialCart`, редьюсер на черновике), `data/categories.ts`, `shared/GameCard.tsx` (+ `onSelect`, название-кнопка), остальное — как в главе 4.

Опоры для главы 6: поиск — кандидат на фокус после «Сбросить фильтры» (6.2, `ref`); страница игры — на `<dialog>`/`showModal()` (6.3) или таймер скидки (6.4); `::: legacy` 5.3 и `::: warning` 5.5 обещают разбор «лишних» эффектов (6.6: синхронизация производного и сброс при смене props); `useState(() => …)` уже показан как датчик — в 6.1 можно сравнить с `useRef`; `id="review"` у поля отзыва — повод для `useId` (глава 7 или 20); черновики отзывов `Record<number, string>` — для `useLocalStorage` (7.3). Корзина (`useImmerReducer` в `App`) переедет в контекст в главе 8; фильтры — в адрес в главе 10; `catalog/filters.ts` пригодится там же.

