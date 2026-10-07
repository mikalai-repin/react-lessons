import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  // 5173 и 5174 обычно заняты курсом PixiJS, 5180 — курсом Angular
  server: { port: 5190, strictPort: true },
  worker: { format: 'es' },
  optimizeDeps: {
    entries: ['index.html'],
    // Модули, которые грузятся динамически: без явного списка Vite находит их уже после старта,
    // пересобирает зависимости и ломает открытую страницу
    include: [
      'monaco-editor',
      'shiki/core',
      'shiki/engine/javascript',
      '@shikijs/monaco',
      'shiki/langs/tsx.mjs',
      'shiki/langs/typescript.mjs',
      'shiki/langs/html.mjs',
      'shiki/langs/javascript.mjs',
      'shiki/langs/json.mjs',
      'shiki/langs/css.mjs',
      'shiki/langs/bash.mjs',
      // Prettier грузится лениво при первом форматировании
      'prettier/standalone',
      'prettier/plugins/typescript',
      'prettier/plugins/estree',
      'prettier/plugins/postcss',
    ],
  },
});
