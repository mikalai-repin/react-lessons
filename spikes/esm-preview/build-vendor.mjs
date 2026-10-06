// Собирает ESM-модули React и библиотек для превью + TypeScript для воркера.
//
// Идея: ОДИН запуск esbuild со splitting по всем точкам входа. Общий код (сам React) попадает в общие чанки,
// поэтому у всех библиотек один экземпляр React — без external и без договорённостей между бандлами.
// CJS-пакеты (react, react-dom, dayjs) получают обёртку с именованными экспортами: ключи берём из require()
// в Node (как esm.sh), иначе `import { useState } from 'react'` не работает.
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const OUT = 'vendor';
const ENTRIES_DIR = 'out/vendor-entries';

// specifier → { cjs: true } — обёртка с ключами require(); иначе ESM: export * (+ default, если есть)
const MODULES = {
  react: { cjs: true },
  'react/jsx-runtime': { cjs: true },
  'react/jsx-dev-runtime': { cjs: true },
  'react-dom': { cjs: true },
  'react-dom/client': { cjs: true },
  'react-router': {},
  'react-router/dom': {},
  '@tanstack/react-query': {},
  zustand: {},
  'zustand/middleware': {},
  antd: {},
  // antd без поля exports: CJS-локаль из antd/locale дала бы { default } вместо объекта — берём ESM-версию
  'antd/locale/ru_RU': { from: 'antd/es/locale/ru_RU', default: true },
  '@ant-design/icons': {},
  dayjs: { cjs: true },
  'dayjs/locale/ru': { cjs: true },
};

const IDENT = /^[A-Za-z_$][\w$]*$/;

fs.rmSync(OUT, { recursive: true, force: true });
fs.rmSync(ENTRIES_DIR, { recursive: true, force: true });
fs.mkdirSync(ENTRIES_DIR, { recursive: true });

process.env.NODE_ENV = 'development';
const entryPoints = {};
for (const [spec, opts] of Object.entries(MODULES)) {
  const from = opts.from ?? spec;
  let code;
  if (opts.cjs) {
    const mod = require(from);
    const keys = Object.keys(mod).filter((k) => IDENT.test(k) && k !== 'default');
    code = `import * as ns from ${JSON.stringify(from)};\nconst m = ns.default ?? ns;\nexport default m;\n` +
      (keys.length ? `export const { ${keys.join(', ')} } = m;\n` : '');
  } else {
    code = `export * from ${JSON.stringify(from)};\n` + (opts.default ? `export { default } from ${JSON.stringify(from)};\n` : '');
  }
  const name = spec.replace(/[@/]/g, '_');
  const file = path.join(ENTRIES_DIR, `${name}.mjs`);
  fs.writeFileSync(file, code);
  entryPoints[name] = file;
}

const t0 = Date.now();
const result = await build({
  entryPoints,
  bundle: true,
  splitting: true,
  format: 'esm',
  outdir: OUT,
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  define: { 'process.env.NODE_ENV': '"development"' },
  target: 'es2022',
  metafile: true,
  logLevel: 'warning',
  nodePaths: [path.resolve('node_modules')],
  absWorkingDir: process.cwd(),
});
console.log(`vendor: ${Date.now() - t0} мс`);

// import map: specifier → файл
const imports = {};
for (const spec of Object.keys(MODULES)) imports[spec] = `/${OUT}/${spec.replace(/[@/]/g, '_')}.js`;
fs.writeFileSync(path.join(OUT, 'importmap.json'), JSON.stringify({ imports }, null, 2));

// Размеры точек входа вместе со статически импортируемыми чанками
const outputs = result.metafile.outputs;
function closure(file, seen = new Set()) {
  if (seen.has(file)) return seen;
  seen.add(file);
  for (const imp of outputs[file]?.imports ?? []) if (imp.kind === 'import-statement') closure(imp.path, seen);
  return seen;
}
for (const spec of Object.keys(MODULES)) {
  const file = `${OUT}/${spec.replace(/[@/]/g, '_')}.js`;
  const total = [...closure(file)].reduce((s, f) => s + (outputs[f]?.bytes ?? 0), 0);
  console.log(`${spec.padEnd(24)} ${(total / 1024).toFixed(0).padStart(6)} КБ (с зависимостями)`);
}

// TypeScript для воркера
await build({
  stdin: { contents: `export { default } from 'typescript';`, resolveDir: process.cwd() },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  minify: true,
  outfile: `${OUT}/typescript.mjs`,
  logLevel: 'error',
  alias: Object.fromEntries(['fs', 'path', 'os', 'crypto', 'module', 'url', 'process', 'util', 'perf_hooks', 'inspector', 'buffer'].map((m) => [m, './stub.mjs'])),
});
console.log('typescript.mjs', (fs.statSync(`${OUT}/typescript.mjs`).size / 1024 / 1024).toFixed(1), 'МБ');

fs.copyFileSync('node_modules/es-module-lexer/dist/lexer.js', `${OUT}/es-module-lexer.js`);

// preview.html: import map должна стоять до любого модуля
fs.writeFileSync(
  'preview.html',
  `<!doctype html>\n<meta charset="utf-8" />\n<title>Превью</title>\n<script type="importmap">${JSON.stringify({ imports })}</script>\n<div id="root"></div>\n<script type="module" src="/runtime.js"></script>\n`,
);
