# Формат уроков

Формат **тот же, что в `../angular-learn/docs/lesson-format.md`** — прочитать его целиком: структура `content/`, `course.json`, `chapter.json`, frontmatter, «шаг хранит только изменения» (`startFrom: previous | custom`, `base` + `baseHash`, `removedInStart`/`removedInSolution`), контейнеры markdown (`tip`, `warning`, `deep`, `legacy`, `task`, `hint`), блоки кода с именем файла и подсветкой строк, `check.ts`, тесты в шаге. `shared/step-chain.js`, `scripts/step-files.mjs`, `scripts/validate-content.mjs` и `tools/authoring/steps.py` переносятся без изменений логики.

Ниже — только отличия для React.

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

## Ресурсы

Как в angular-learn: обложки — `/assets/covers/<slug>.svg` (абсолютный путь), данные бэкенда — `public/backend/data/*.json`, происхождение — `public/assets/CREDITS.md`.
