// Воркер компиляции: TypeScript 6 (transpileModule) + CSS → модули
import ts from '/vendor/typescript.mjs';
import { compileFiles } from '/compile-core.js';

self.onmessage = (e) => {
  const t0 = performance.now();
  const result = compileFiles(ts, e.data.files);
  self.postMessage({ ...result, ms: Math.round(performance.now() - t0) });
};
self.postMessage({ ready: true });
