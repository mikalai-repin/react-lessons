// Готовит всё, что нужно превью для запуска кода ученика без сборщика (запускается перед dev и build):
//   public/vendor/<модуль>.js, public/vendor/chunks/ — ESM-модули React и библиотек (один запуск esbuild);
//   public/vendor/ts-react.mjs       — TypeScript для воркера компиляции;
//   public/vendor/es-module-lexer.js;
//   public/preview.html              — из scripts/preview.template.html с import map.
//
// Почему один запуск esbuild со splitting: общий код (сам React) попадает в общие чанки, поэтому у всех
// библиотек ОДИН экземпляр React (иначе «Invalid hook call»). Пакеты в CommonJS (react, react-dom, dayjs)
// получают обёртку с именованными экспортами: ключи берём из require() в Node — иначе
// `import { useState } from 'react'` не работает. Проверено спайком spikes/esm-preview (см. его README).
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, 'public/vendor');
const entriesDir = resolve(root, 'node_modules/.cache/vendor-entries');
const require = createRequire(resolve(root, 'package.json'));
const readJson = (path) => JSON.parse(readFileSync(resolve(root, path), 'utf8'));

// Модули, доступные коду ученика. Новая библиотека главы добавляется сюда (и в package.json точной версией),
// её типы — в TYPE_PACKAGES в src/editor/monaco.ts.
// Значение — откуда брать модуль, если не совпадает с именем (у antd нет поля exports: локали — из antd/es/…)
export const PREVIEW_MODULES = {
  react: null,
  'react/jsx-runtime': null,
  'react/jsx-dev-runtime': null,
  'react-dom': null,
  'react-dom/client': null,
  'react-router': null,
  'react-router/dom': null,
  '@tanstack/react-query': null,
  zustand: null,
  'zustand/middleware': null,
  'zustand/react/shallow': null,
};

const IDENT = /^[A-Za-z_$][\w$]*$/;
const fileName = (spec) => spec.replace(/[@/]/g, '_');

/** ESM-модуль или CommonJS? Пробная сборка `export *`: у CJS esbuild не видит ни одного имени */
async function esmExports(from) {
  const result = await build({
    stdin: { contents: `export * from ${JSON.stringify(from)};`, resolveDir: root },
    bundle: true,
    format: 'esm',
    write: false,
    metafile: true,
    logLevel: 'silent',
    define: { 'process.env.NODE_ENV': '"development"' },
  });
  return Object.values(result.metafile.outputs)[0].exports;
}

async function vendorModules() {
  rmSync(entriesDir, { recursive: true, force: true });
  mkdirSync(entriesDir, { recursive: true });
  // NODE_ENV — до require(): react выбирает development-сборку по нему
  process.env.NODE_ENV = 'development';

  const entryPoints = {};
  for (const [spec, source] of Object.entries(PREVIEW_MODULES)) {
    const from = source ?? spec;
    const names = await esmExports(from);
    let code;
    if (names.length > 0) {
      code = `export * from ${JSON.stringify(from)};\n`;
      if (names.includes('default')) code += `export { default } from ${JSON.stringify(from)};\n`;
    } else {
      const keys = Object.keys(require(from)).filter((key) => IDENT.test(key) && key !== 'default');
      code = `import * as ns from ${JSON.stringify(from)};\nconst m = ns.default ?? ns;\nexport default m;\n`;
      if (keys.length) code += `export const { ${keys.join(', ')} } = m;\n`;
    }
    const file = resolve(entriesDir, `${fileName(spec)}.mjs`);
    writeFileSync(file, code);
    entryPoints[fileName(spec)] = file;
  }

  rmSync(out, { recursive: true, force: true });
  await build({
    entryPoints,
    bundle: true,
    splitting: true,
    format: 'esm',
    outdir: out,
    entryNames: '[name]',
    chunkNames: 'chunks/[name]-[hash]',
    // Ученик должен видеть предупреждения React: development-сборка. minify их не убирает
    define: { 'process.env.NODE_ENV': '"development"' },
    minify: process.env.VENDOR_MINIFY === '1',
    target: 'es2022',
    logLevel: 'warning',
    absWorkingDir: root,
  });

  return Object.fromEntries(Object.keys(PREVIEW_MODULES).map((spec) => [spec, `/vendor/${fileName(spec)}.js`]));
}

/** TypeScript для воркера: ~3,5 МБ, пересобираем только при смене версии */
async function vendorTypeScript() {
  const version = readJson('node_modules/typescript/package.json').version;
  const stampPath = resolve(root, 'node_modules/.cache/ts-react.stamp');
  const target = resolve(root, 'node_modules/.cache/ts-react.mjs');
  if (!existsSync(target) || !existsSync(stampPath) || readFileSync(stampPath, 'utf8') !== version) {
    // TypeScript рассчитан и на Node: его модули Node в браузере не нужны — заглушка
    const stub = resolve(root, 'scripts/node-stub.mjs');
    await build({
      stdin: { contents: "export { default as ts } from 'typescript';", resolveDir: root },
      bundle: true,
      format: 'esm',
      platform: 'browser',
      minify: true,
      alias: Object.fromEntries(
        ['fs', 'path', 'module', 'url', 'os', 'crypto', 'process', 'util', 'perf_hooks', 'inspector', 'buffer'].map(
          (m) => [m, stub],
        ),
      ),
      outfile: target,
      logLevel: 'error',
    });
    writeFileSync(stampPath, version);
    console.log(`[vendor] собран ts-react.mjs (TypeScript ${version})`);
  }
  copyFileSync(target, resolve(out, 'ts-react.mjs'));
}

const started = Date.now();
mkdirSync(resolve(root, 'node_modules/.cache'), { recursive: true });
const importMap = await vendorModules();
await vendorTypeScript();
copyFileSync(resolve(root, 'node_modules/es-module-lexer/dist/lexer.js'), resolve(out, 'es-module-lexer.js'));

const template = readFileSync(resolve(root, 'scripts/preview.template.html'), 'utf8');
const importMapJson = JSON.stringify({ imports: importMap }, null, 2).replace(/\n/g, '\n    ');
writeFileSync(resolve(root, 'public/preview.html'), template.replace('<!--IMPORT_MAP-->', importMapJson));

console.log(`[vendor] ${Object.keys(importMap).length} модулей в import map, ${Date.now() - started} мс`);
