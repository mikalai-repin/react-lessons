# Формат уроков

Формат **тот же, что в `../angular-learn/docs/lesson-format.md`** — прочитать его целиком: структура `content/`, `course.json`, `chapter.json`, frontmatter, «шаг хранит только изменения» (`startFrom: previous | custom`, `base` + `baseHash`, `removedInStart`/`removedInSolution`), контейнеры markdown (`tip`, `warning`, `deep`, `legacy`, `task`, `hint`), блоки кода с именем файла и подсветкой строк, `check.ts` (у нас — реализован, раздел ниже), тесты в шаге. `shared/step-chain.js`, `scripts/step-files.mjs`, `scripts/validate-content.mjs` перенесены без изменений логики; вместо `tools/authoring/steps.py` и генераторов глав — `scripts/chapter.mjs`.

Ниже — только отличия для React.

**Главное отличие в процессе:** папки `start/` и `solution/` шагов (и поля frontmatter `startFrom`, `noSolution`, `base`, `baseHash`, `removedInStart`, `removedInSolution`) не пишутся руками и не генерируются Python-скриптом — их раскладывает `npm run chapter export` из коммитов ветки главы (`docs/authoring-process.md`, раздел 2). Формат на диске при этом тот же.

## Файлы шага

- Точка входа — **`main.tsx`** (`createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)`). Корень шага соответствует `src/` Vite-проекта.
- Импорты между файлами — без расширения: `import { GameCard } from './shared/GameCard'`.
- Имена: компоненты `PascalCase.tsx` (+ `PascalCase.module.css`), хуки `useCamelCase.ts`, остальное `camelCase.ts`. Один компонент — один файл, именованный экспорт (`export function GameCard`), без `export default` (кроме `lazy`-модулей, если API этого требует — проверить).
- Стили: `styles.css` — глобальные, импортируются в `main.tsx` (`import './styles.css'`), готовый файл (курс про React, а не CSS). Стили компонента — CSS Modules `X.module.css` (`import styles from './X.module.css'`, `className={styles.card}`).
- Вкладки без `files` во frontmatter: `main.tsx`, `App.tsx`, затем файлы корня, затем подпапки; `X.tsx` и `X.module.css` рядом.

## `course.json`

```json
{
  "title": "React",
  "reactVersion": "19.3.0",
  "chapters": ["01-first-app"]
}
```

## Frontmatter

Как в angular-learn. Примеры значений для React:

```yaml
---
title: Состояние — снимок
files: [main.tsx, App.tsx, shared/GameCard.tsx]
readonly: [main.tsx]
focus: App.tsx
api: [useState, 'set(fn)']
url: /catalog?q=шах
backend: { latency: 800, failRate: 0 }
preview: app            # app | tests
compiler: false         # план (глава 16): запускать код через React Compiler
---
```

YAML: элементы со скобками, `@`, `:`, `<` — в кавычках: `api: ['<Context>', 'use()']`.

## Код в тексте урока

````md
```tsx App.tsx {3,7}
export function App() {
  const [count, setCount] = useState(0);
  …
}
```

```css shared/GameCard.module.css {2}
.card {
  border-radius: 12px;
}
```
````

Ссылки на API — на react.dev и документацию библиотек: `[useState](https://react.dev/reference/react/useState)`, `[useQuery](https://tanstack.com/query/latest/docs/framework/react/reference/useQuery)`. Ссылку проверяем перед публикацией.

Внутренние ссылки: `[шаг про состояние](step:04-state/02-use-state)`.

## Проверка шага — `check.ts`

У практикумов (и шага 1.6 «Отладка») — `content/<глава>/<шаг>/check.ts` рядом с `lesson.md`; платформа показывает кнопку «✓ Проверить». Устройство — `docs/architecture.md`, «Проверка шагов».

```ts
import type { CheckContext, CheckResult } from '@course/check';

// Что проверяем — одной строкой
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  const card = ctx.document
    .querySelector('img[alt="Остров сокровищ"]')
    ?.closest('article');
  if (!card) {
    return { pass: false, hint: 'Карточки не отрисовались — посмотрите консоль.' };
  }
  await ctx.click(ctx.button('В корзину', card));
  if (!ctx.text(card).includes('В корзине: 1 шт.')) {
    return { pass: false, hint: '…что не так и куда смотреть, без готового ответа' };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return { pass: false, hint: 'Работает, но в консоли есть ошибки.' };
  }
  return { pass: true };
}
```

- Проверяем **результат** — DOM, адрес, запросы, консоль, — а не текст кода: решение ученика не обязано совпадать с нашим. Опора — то, что задание называет явно: тексты, `aria-label`, роли, `alt`; классы CSS Modules — по части имени (`[class*="_badge_"]`), только если задание их называет.
- Перед `check` платформа уже перезапустила приложение с `url` шага. Хранилище общее с платформой: если проверка зависит от `localStorage` (избранное, корзина с `persist`), — `ctx.restart(undefined, { clearStorage: ['favorites'] })`.
- `ctx.document` и `ctx.window` — геттеры: после `restart` это новый документ, поэтому не деструктурируйте их.
- Каждый `pass: false` — с `hint`: что не так и куда смотреть, на русском, без готового кода.
- Проверка обязана **проваливаться на старте** с осмысленной подсказкой и **проходить на решении** — это проверяет `tools/e2e/checks/step-checks.mjs`; туда же (`MISTAKES`) добавляйте типичную ошибку ученика и ожидаемую подсказку.
- В тексте практикума, в начале «Проверьте себя», — фраза про кнопку «✓ Проверить».
- Типы — `npm run validate` (`tsc -p tsconfig.checks.json`), формат — Prettier с настройками кода уроков.

## Квиз главы — `quiz.yaml`

У каждой главы — квиз: `content/<глава>/quiz.yaml` рядом с `chapter.json` (папка главы, не шага; `chapter export` его не трогает — пишется руками). Глава считается **пройденной**, когда квиз сдан: правильных ответов ≥ 85 % (`Math.ceil(0.85 × n)`: 10 → 9, 13 → 12, 15 → 13). Платформа: `/<глава>/quiz` (`src/quiz/QuizPage.tsx`), «Далее» с последнего шага главы — «Квиз →», с квиза — к следующей главе (не блокируется); лучший результат — `progress.quizzes[slug главы]`, ✓ у главы и квиза в оглавлении.

```yaml
# Первый вариант в options — правильный: порядок вопросов и вариантов перемешивается при каждой попытке
questions:
  - question: |
      Что выведет `console.log`?

      ```tsx
      root.render(<App />);
      console.log(container.innerHTML);
      ```
    options:
      - Пустую строку — React нарисует `App` позже, отдельной задачей
      - Разметку `App` — `render` создаёт элементы сразу при вызове
      - …
    explanation: |
      Почему верно (1–3 предложения), со ссылкой на шаг: «шаг „Запуск приложения“».
    step: 03-render      # папка шага этой главы: ссылка «Повторить шаг» в разборе ошибок
```

- 10–15 вопросов, у каждого 3–5 разных вариантов (в курсе — 4), `explanation` и `step` — проверяет `npm run validate`.
- `question` и `explanation` — markdown (код, врезки, ссылки `step:`), варианты — строчный markdown.
- YAML: вариант с `: ` внутри или начинающийся с `` ` ``, `<`, `{`, `[`, `*`, `-`, `>` — в одинарных кавычках (иначе YAML прочитает его как объект или список — валидатор скажет «каждый вариант — непустая строка»). Теги в тексте варианта — в `` `…` ``, иначе markdown отрисует их как HTML.
- Правила содержания — `docs/writing-guide.md`, «Квиз главы».

## Ресурсы

Как в angular-learn: обложки — `/assets/covers/<slug>.svg` (абсолютный путь), данные бэкенда — `public/backend/data/*.json`, происхождение — `public/assets/CREDITS.md`.
