// Компиляция кода ученика для превью. Общий модуль для трёх мест:
//   - веб-воркер платформы (src/compiler/compile.worker.ts) — TypeScript из /vendor/ts-react.mjs;
//   - браузерные проверки (tools/e2e/lib.mjs) и валидатор (scripts/validate-content.mjs) — typescript из node_modules.
// Поэтому здесь чистый JS без зависимостей: TypeScript передаётся параметром.
//
// Что делает (как Vite в настоящем проекте):
//   1. .ts/.tsx → ES-модули: ts.transpileModule с JSX-трансформом react-jsxdev (jsxDEV с именем файла и строкой —
//      React показывает их в предупреждениях). Каждый файл компилируется отдельно: типы не нужны, ошибки типов
//      показывает редактор (Monaco) и `npm run validate`.
//   2. .css → JS-модуль, который при импорте вставляет <style> (порядок стилей = порядок импортов, как в Vite).
//   3. *.module.css (CSS Modules) → то же, но классы переименованы (`.card` → `GameCard_card_x1y2z`), а модуль
//      экспортирует карту «имя → новое имя»: `import styles from './GameCard.module.css'` → `styles.card`.

export function resolvePath(fromFile, specifier) {
  const parts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') parts.pop();
    else parts.push(part);
  }
  return parts.join('/');
}

/** Короткий детерминированный хеш (FNV-1a): суффикс имён классов CSS Modules */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).slice(0, 5);
}

/**
 * CSS Modules: переименовывает классы в селекторах и возвращает карту.
 * Классы ищутся только в прелюдиях правил (до `{`): не в значениях свойств (`url(a.png)`, `0.5em`) и не в
 * @-правилах (`@media`). `:global(.x)` оставляет класс как есть.
 */
export function transformCssModule(css, file) {
  const base = file
    .split('/')
    .pop()
    .replace(/\.module\.css$/, '');
  const salt = hash(file);
  const classes = {};
  let out = '';
  let chunk = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (!chunk.trimStart().startsWith('@')) {
        const globals = [];
        let prelude = chunk.replace(/:global\(([^)]*)\)/g, (_, inner) => `\u0000${globals.push(inner) - 1}\u0000`);
        prelude = prelude.replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_, name) => {
          classes[name] ??= `${base}_${name}_${salt}`;
          return `.${classes[name]}`;
        });
        chunk = prelude.replace(/\u0000(\d+)\u0000/g, (_, n) => globals[n]);
      }
      out += chunk + ch;
      chunk = '';
    } else if (ch === '}' || ch === ';') {
      out += chunk + ch;
      chunk = '';
    } else if (ch === '/' && css[i + 1] === '*') {
      const end = css.indexOf('*/', i + 2);
      const stop = end === -1 ? css.length : end + 2;
      chunk += css.slice(i, stop);
      i = stop - 1;
    } else {
      chunk += ch;
    }
  }
  return { css: out + chunk, classes };
}

function styleModule(file, css, classes) {
  return [
    `const style = document.createElement('style');`,
    `style.dataset.file = ${JSON.stringify(file)};`,
    `style.textContent = ${JSON.stringify(css)};`,
    `document.head.append(style);`,
    `export default ${JSON.stringify(classes)};`,
    '',
  ].join('\n');
}

const isTest = (file) => /\.(spec|test)\.tsx?$/.test(file);

/** Имя скомпилированного модуля: 'App.tsx' → 'App.js', 'GameCard.module.css' → 'GameCard.module.css.js' */
export function outputName(file) {
  if (/\.tsx?$/.test(file)) return file.replace(/\.tsx?$/, '.js');
  if (file.endsWith('.css')) return `${file}.js`;
  return null;
}

/**
 * Компилирует файлы шага.
 * @param {typeof import('typescript')} ts
 * @param {Record<string, string>} files — путь относительно корня шага → содержимое (.tsx, .ts, .css, …)
 * @returns {import('./compile-core').CompiledStep}
 */
export function compileFiles(ts, files) {
  const errors = [];
  const compiled = {};
  const sources = {};
  for (const [file, code] of Object.entries(files)) {
    const name = outputName(file);
    if (!name || file.endsWith('.d.ts') || isTest(file)) continue;
    sources[name] = file;
    if (file.endsWith('.module.css')) {
      const { css, classes } = transformCssModule(code, file);
      compiled[name] = styleModule(file, css, classes);
    } else if (file.endsWith('.css')) {
      compiled[name] = styleModule(file, code, {});
    } else {
      const result = ts.transpileModule(code, {
        fileName: file,
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSXDev,
          isolatedModules: true,
          inlineSourceMap: true,
          inlineSources: true,
        },
      });
      for (const diagnostic of result.diagnostics ?? []) {
        const line = diagnostic.file
          ? diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start ?? 0).line + 1
          : 0;
        errors.push(`${file}:${line} — ${ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ')}`);
      }
      compiled[name] = result.outputText;
    }
  }
  return { files: compiled, sources, styles: [], errors };
}
