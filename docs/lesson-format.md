# Формат уроков

Формат **тот же, что в `../angular-learn/docs/lesson-format.md`** — прочитать его целиком: структура `content/`, `course.json`, `chapter.json`, frontmatter, «шаг хранит только изменения» (`startFrom: previous | custom`, `base` + `baseHash`, `removedInStart`/`removedInSolution`), контейнеры markdown (`tip`, `warning`, `deep`, `legacy`, `task`, `hint`), блоки кода с именем файла и подсветкой строк, `check.ts`, тесты в шаге. `shared/step-chain.js`, `scripts/step-files.mjs`, `scripts/validate-content.mjs` перенесены без изменений логики; вместо `tools/authoring/steps.py` и генераторов глав — `scripts/chapter.mjs`.

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
