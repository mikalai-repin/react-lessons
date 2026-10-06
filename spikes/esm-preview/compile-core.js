// Компиляция файлов шага: .ts/.tsx → ES-модули, .css → модули, вставляющие <style> (как в Vite).
// Один модуль для браузера (воркер) и Node (проверки) — как shared/compile-core.js в angular-learn.

/** Короткий детерминированный хеш строки (FNV-1a) — для имён классов CSS Modules */
function hash(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36).slice(0, 5);
}

/**
 * CSS Modules: переименовывает классы в селекторах (`.card` → `Catalog_card_x1y2z`) и возвращает карту.
 * Классы ищутся только в прелюдиях правил (до `{`), не в значениях свойств (`url(a.png)`) и не в @-правилах.
 * `:global(.x)` оставляет класс как есть.
 */
export function transformCssModule(css, file) {
  const base = file.split('/').pop().replace(/\.module\.css$/, '');
  const salt = hash(file);
  const classes = {};
  let out = '';
  let chunk = '';
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      const prelude = chunk.trimStart();
      if (!prelude.startsWith('@')) {
        // :global(...) прячем, переименовываем остальное, возвращаем
        const globals = [];
        let p = chunk.replace(/:global\(([^)]*)\)/g, (_, inner) => `\u0000${globals.push(inner) - 1}\u0000`);
        p = p.replace(/\.(-?[_a-zA-Z][\w-]*)/g, (_, name) => {
          classes[name] ??= `${base}_${name}_${salt}`;
          return `.${classes[name]}`;
        });
        chunk = p.replace(/\u0000(\d+)\u0000/g, (_, n) => globals[n]);
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

function cssModuleCode(file, css, classes) {
  return [
    `const style = document.createElement('style');`,
    `style.dataset.file = ${JSON.stringify(file)};`,
    `style.textContent = ${JSON.stringify(css)};`,
    `document.head.append(style);`,
    `export default ${JSON.stringify(classes ?? {})};`,
  ].join('\n');
}

/**
 * @param ts — модуль typescript
 * @param files — { 'main.tsx': '…', 'Catalog.module.css': '…' }
 * @returns { files: { 'main.js', 'Catalog.module.css.js', … }, errors: [{ file, line, message }] }
 */
export function compileFiles(ts, files) {
  const out = {};
  const errors = [];
  for (const [file, source] of Object.entries(files)) {
    if (/\.tsx?$/.test(file) && !file.endsWith('.d.ts')) {
      const result = ts.transpileModule(source, {
        fileName: file,
        reportDiagnostics: true,
        compilerOptions: {
          target: ts.ScriptTarget.ES2022,
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSXDev,
          inlineSourceMap: true,
          inlineSources: true,
          verbatimModuleSyntax: false,
          isolatedModules: true,
        },
      });
      for (const d of result.diagnostics ?? []) {
        const line = d.file && d.start != null ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : 0;
        errors.push({ file, line, message: ts.flattenDiagnosticMessageText(d.messageText, '\n') });
      }
      out[file.replace(/\.tsx?$/, '.js')] = result.outputText;
    } else if (file.endsWith('.module.css')) {
      const { css, classes } = transformCssModule(source, file);
      out[`${file}.js`] = cssModuleCode(file, css, classes);
    } else if (file.endsWith('.css')) {
      out[`${file}.js`] = cssModuleCode(file, source, null);
    }
  }
  return { files: out, errors };
}
