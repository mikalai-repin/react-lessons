import type { CompiledStep } from '../../shared/compile-core.js';
import type { FileMap } from '../content/course';
import CompileWorker from './compile.worker.ts?worker';

export type { CompiledStep };

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (result: CompiledStep) => void; reject: (error: Error) => void }>();

function getWorker() {
  if (worker) return worker;
  worker = new CompileWorker();
  worker.onmessage = (event: MessageEvent<{ id: number; result?: CompiledStep; error?: string }>) => {
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.result) request.resolve(event.data.result);
    else request.reject(new Error(event.data.error));
  };
  return worker;
}

/** Компилирует файлы шага (.tsx, .ts, .css) в модули для превью */
export function compileStep(files: FileMap): Promise<CompiledStep> {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, files });
  });
}
