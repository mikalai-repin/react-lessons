// Веб-воркер компиляции кода ученика: TypeScript 6 transpileModule (TSX → JS) и CSS → модули
// (см. shared/compile-core.js). TypeScript (~3,5 МБ) лежит в public/vendor/ts-react.mjs
// (собирает scripts/copy-vendor.mjs) и загружается при первом запуске.
import { compileFiles } from '../../shared/compile-core.js';

interface CompilerModule {
  ts: unknown;
}

const COMPILER_URL = '/vendor/ts-react.mjs';
// import() через Function: иначе Vite в dev-режиме дописывает к адресу «?import», и файл из public/ не грузится
const importModule = new Function('url', 'return import(url)') as (url: string) => Promise<unknown>;
let compiler: Promise<CompilerModule> | undefined;

self.onmessage = async (event: MessageEvent<{ id: number; files: Record<string, string> }>) => {
  const { id, files } = event.data;
  try {
    compiler ??= importModule(new URL(COMPILER_URL, self.location.origin).href) as Promise<CompilerModule>;
    const { ts } = await compiler;
    const result = compileFiles(ts, files);
    self.postMessage({ id, result });
  } catch (error) {
    self.postMessage({ id, error: String((error as Error)?.stack ?? error) });
  }
};
