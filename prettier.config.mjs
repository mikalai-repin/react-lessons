// Настройки Prettier проекта. Код уроков (content/ и рабочие папки глав authoring/) форматируется так же, как кнопка «Формат» в редакторе
// платформы: настройки общие — shared/lesson-prettier.json (их же читают src/editor/monaco.ts и
// scripts/chapter.mjs). Остальной код проекта — ширина 120.
import { readFileSync } from 'node:fs';

const lesson = JSON.parse(readFileSync(new URL('./shared/lesson-prettier.json', import.meta.url), 'utf8'));

export default {
  printWidth: 120,
  singleQuote: true,
  trailingComma: 'all',
  overrides: [{ files: '{content,authoring}/**/*.{ts,tsx,css}', options: lesson }],
};
