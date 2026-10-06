import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import type { FileMap } from '../content/course';
import lessonPrettier from '../../shared/lesson-prettier.json';

// ---------- Типы библиотек для подсказок и проверки TypeScript ----------
//
// TS-воркер Monaco (TypeScript 5.9) ищет модули по схеме node10 и не понимает поле `exports` в package.json.
// Поэтому кладём .d.ts пакетов по их настоящим путям, а для точек входа из `exports`, у которых типы лежат
// не в `<подпуть>/index.d.ts` (`react-router` → dist/production/index.d.ts), добавляем файл-заглушку
// `<подпуть>/index.d.ts` с `export * from '<настоящий файл>'`.
//
// Библиотека превью, которую добавили в scripts/copy-vendor.mjs (PREVIEW_MODULES), добавляется и сюда.
// Берём только нужные .d.ts: у react-router есть копии development/production, у query — legacy/modern.

const typeFiles = import.meta.glob(
  [
    '../../node_modules/@types/react/**/*.d.ts',
    '../../node_modules/@types/react-dom/**/*.d.ts',
    '../../node_modules/csstype/index.d.ts',
    '../../node_modules/react-router/dist/production/**/*.d.ts',
    '../../node_modules/@tanstack/react-query/build/modern/**/*.d.ts',
    '../../node_modules/@tanstack/query-core/build/modern/**/*.d.ts',
    '../../node_modules/zustand/**/*.d.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** package.json пакетов, у которых типы точек входа указаны только в `exports` */
const typedPackages = import.meta.glob(
  [
    '../../node_modules/react-router/package.json',
    '../../node_modules/@tanstack/react-query/package.json',
    '../../node_modules/@tanstack/query-core/package.json',
  ],
  { import: 'default', eager: true },
) as Record<string, { exports: Record<string, unknown> }>;

self.MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === 'typescript' || label === 'javascript') return new TsWorker();
    if (label === 'css') return new CssWorker();
    return new EditorWorker();
  },
};

// Monaco отклоняет промисы объектом Canceled, когда модель удаляется посреди запроса к воркеру
// (быстрый переход между шагами). Это штатная ситуация, а не ошибка
window.addEventListener('unhandledrejection', (event) => {
  if ((event.reason as { name?: string } | undefined)?.name === 'Canceled') event.preventDefault();
});

const ts = monaco.typescript;

ts.typescriptDefaults.setCompilerOptions({
  target: ts.ScriptTarget.ESNext,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.NodeJs,
  lib: ['es2023', 'dom', 'dom.iterable'],
  // Как в tsconfig.app.json, который создаёт `npm create vite` (шаблон react-ts)
  jsx: ts.JsxEmit.ReactJSX,
  strict: true,
  noFallthroughCasesInSwitch: true,
  noEmitOnError: false,
  allowNonTsExtensions: true,
  isolatedModules: true,
  // В .d.ts зависимостей бывают ошибки (у antd 6 — TS2430), а нам важен только код ученика
  skipLibCheck: true,
});

// Ошибки показываем сразу, но запуск они не блокируют: так ученик видит, что TS ругается, и может поэкспериментировать
ts.typescriptDefaults.setDiagnosticsOptions({ noSemanticValidation: false, noSyntaxValidation: false });
ts.typescriptDefaults.setEagerModelSync(true);

const NODE_MODULES = 'file:///node_modules/';
const relativeToNodeModules = (path: string) => path.slice(path.indexOf('/node_modules/') + '/node_modules/'.length);

for (const [path, source] of Object.entries(typeFiles)) {
  ts.typescriptDefaults.addExtraLib(source, NODE_MODULES + relativeToNodeModules(path));
}

/** Путь к .d.ts из условия `types` в `exports` (условия бывают вложенными: import → types) */
function typesOf(entry: unknown): string | undefined {
  if (typeof entry === 'string') return entry.endsWith('.d.ts') ? entry : undefined;
  if (!entry || typeof entry !== 'object') return undefined;
  const conditions = entry as Record<string, unknown>;
  if (typeof conditions.types === 'string' && conditions.types.endsWith('.d.ts')) return conditions.types;
  for (const key of ['import', 'module', 'default', 'browser']) {
    const found = typesOf(conditions[key]);
    if (found) return found;
  }
  return undefined;
}

for (const [path, pkg] of Object.entries(typedPackages)) {
  const name = relativeToNodeModules(path).replace(/\/package\.json$/, '');
  for (const [subpath, entry] of Object.entries(pkg.exports)) {
    const types = typesOf(entry);
    if (!types || subpath.includes('*')) continue;
    const stubDir = `${name}${subpath.slice(1)}`;
    // Путь к .d.ts относительно заглушки: из 'react-router/dom/index.d.ts' в 'react-router/dist/production/…'
    const depth = subpath === '.' ? 0 : subpath.slice(2).split('/').length;
    const target = `${'../'.repeat(depth) || './'}${types.slice(2).replace(/\.d\.ts$/, '')}`;
    ts.typescriptDefaults.addExtraLib(`export * from '${target}';`, `${NODE_MODULES}${stubDir}/index.d.ts`);
  }
}

// Импорт стилей — как в Vite (vite/client): CSS Modules дают карту классов, обычный CSS — ничего
ts.typescriptDefaults.addExtraLib(
  [
    "declare module '*.module.css' {",
    '  const classes: { readonly [key: string]: string };',
    '  export default classes;',
    '}',
    "declare module '*.css' {}",
  ].join('\n'),
  'file:///course-env.d.ts',
);

// --- Форматирование кода (Prettier) ---
/** Настройки — общие с файлами уроков на диске (shared/lesson-prettier.json: по ним форматирует write_steps
 *  в генераторах глав); .ts и .tsx разбирает парсер `typescript` */
const PRETTIER_OPTIONS = lessonPrettier as { printWidth: number; singleQuote: boolean; trailingComma: 'all' };

/** Prettier весит заметно, поэтому грузим его только при первом форматировании */
async function format(code: string, language: string) {
  const prettier = await import('prettier/standalone');
  if (language === 'typescript') {
    const [typescript, estree] = await Promise.all([
      import('prettier/plugins/typescript'),
      import('prettier/plugins/estree'),
    ]);
    return prettier.format(code, { ...PRETTIER_OPTIONS, parser: 'typescript', plugins: [typescript, estree] });
  }
  const postcss = await import('prettier/plugins/postcss');
  return prettier.format(code, { ...PRETTIER_OPTIONS, parser: 'css', plugins: [postcss] });
}

// Встроенный форматтер CSS выключен: при двух форматтерах Monaco выбирает встроенный, а не наш Prettier
monaco.css.cssDefaults.setModeConfiguration({
  ...monaco.css.cssDefaults.modeConfiguration,
  documentFormattingEdits: false,
  documentRangeFormattingEdits: false,
});

// Стандартная команда Monaco «Format Document» (Shift+Alt+F и контекстное меню) теперь работает через Prettier
for (const language of ['typescript', 'css']) {
  monaco.languages.registerDocumentFormattingEditProvider(language, {
    async provideDocumentFormattingEdits(model) {
      try {
        const text = await format(model.getValue(), language);
        return [{ range: model.getFullModelRange(), text }];
      } catch (error) {
        // Код с синтаксической ошибкой Prettier не разберёт: просто ничего не меняем
        console.warn('Prettier не смог отформатировать код:', error);
        return [];
      }
    },
  });
}

function applyTheme() {
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
}
applyTheme();
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

const stepPrefix = (stepId: string) => `file:///steps/${stepId}/`;

export function modelUri(stepId: string, file: string) {
  return monaco.Uri.parse(stepPrefix(stepId) + file);
}

/** Путь файла внутри шага по модели: 'catalog/Catalog.tsx' */
export function fileOfModel(stepId: string, model: monaco.editor.ITextModel) {
  return model.uri.toString(true).slice(stepPrefix(stepId).length);
}

function languageOf(file: string) {
  // .tsx — тоже язык typescript: TSX TypeScript включает по расширению в адресе модели
  if (file.endsWith('.ts') || file.endsWith('.tsx')) return 'typescript';
  if (file.endsWith('.css')) return 'css';
  if (file.endsWith('.json')) return 'json';
  return undefined;
}

/** Создаёт (или обновляет) модели всех файлов шага */
export function syncModels(stepId: string, files: FileMap) {
  for (const [file, code] of Object.entries(files)) {
    const uri = modelUri(stepId, file);
    const existing = monaco.editor.getModel(uri);
    if (existing) {
      if (existing.getValue() !== code) existing.setValue(code);
    } else {
      monaco.editor.createModel(code, languageOf(file), uri);
    }
  }
}

/** Удаляет модели шага при уходе с него, чтобы TS не видел файлы чужих шагов */
export function disposeModels(stepId: string) {
  const prefix = stepPrefix(stepId);
  for (const model of monaco.editor.getModels()) {
    if (model.uri.toString(true).startsWith(prefix)) model.dispose();
  }
}

/** Текущее содержимое всех файлов шага из редактора */
export function readModels(stepId: string, files: string[]): FileMap {
  const result: FileMap = {};
  for (const file of files) {
    const model = monaco.editor.getModel(modelUri(stepId, file));
    if (model) result[file] = model.getValue();
  }
  return result;
}

export interface Diagnostic {
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

type DiagnosticMessage = string | { messageText: string; next?: DiagnosticMessage[] };

function flattenMessage(message: DiagnosticMessage): string {
  if (typeof message === 'string') return message;
  const nested = (message.next ?? []).map((m) => flattenMessage(m)).join(' ');
  return nested ? `${message.messageText} ${nested}` : message.messageText;
}

/**
 * Доступ к TS-воркеру. Языковой модуль TypeScript в Monaco загружается асинхронно, и при самом первом
 * открытии страницы getTypeScriptWorker может отклонить промис строкой «TypeScript not registered!».
 * Поэтому ждём с повторными попытками
 */
async function getTypeScriptWorker() {
  for (let attempt = 0; ; attempt++) {
    try {
      return await ts.getTypeScriptWorker();
    } catch (error) {
      if (attempt >= 50) throw error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

const isTs = (file: string) => /\.tsx?$/.test(file);

/**
 * Отдаёт воркеру TypeScript все .ts/.tsx-файлы шага. Воркер синхронизирует все модели только при своём создании,
 * а дальше каждый запрос передаёт ему лишь свой файл. Если модели шага созданы разом (переход на другой шаг),
 * проверка одного файла может начаться раньше, чем воркер узнает о соседних, — и импорты станут «не найдены»
 */
async function syncStepWithWorker(stepId: string, files: string[]) {
  const getWorker = await getTypeScriptWorker();
  const uris = files
    .filter(isTs)
    .map((file) => modelUri(stepId, file))
    .filter((uri) => monaco.editor.getModel(uri));
  await getWorker(...uris);
  return getWorker;
}

let revalidation = 0;

/**
 * Пересчитывает подчёркивания ошибок во всех моделях, когда воркер уже знает все файлы шага.
 * Изменение extra-lib заставляет Monaco заново проверить все модели, не перезапуская воркер
 * (изменение настроек компилятора перезапустило бы его)
 */
export async function refreshDiagnostics(stepId: string, files: string[]) {
  await syncStepWithWorker(stepId, files);
  ts.typescriptDefaults.addExtraLib(`// ${++revalidation}`, 'file:///course-revalidate.d.ts');
}

/** Ошибки TypeScript во всех .ts/.tsx-файлах шага (сам код компилирует воркер src/compiler) */
export async function collectDiagnostics(stepId: string, files: string[]): Promise<Diagnostic[]> {
  const getWorker = await syncStepWithWorker(stepId, files);
  const result: Diagnostic[] = [];
  for (const file of files.filter(isTs)) {
    const uri = modelUri(stepId, file);
    const model = monaco.editor.getModel(uri);
    if (!model) continue;
    const worker = await getWorker(uri);
    const name = uri.toString();
    const [syntactic, semantic] = await Promise.all([
      worker.getSyntacticDiagnostics(name),
      worker.getSemanticDiagnostics(name),
    ]);
    for (const diagnostic of [...syntactic, ...semantic]) {
      const position = model.getPositionAt(diagnostic.start ?? 0);
      result.push({
        file,
        line: position.lineNumber,
        column: position.column,
        message: flattenMessage(diagnostic.messageText as DiagnosticMessage),
        // category: 0 — warning, 1 — error (ts.DiagnosticCategory)
        severity: diagnostic.category === 1 ? 'error' : 'warning',
      });
    }
  }
  return result;
}

/** Форматирует файл, открытый в редакторе. Без редактора берёт первый на странице (кнопка «Формат») */
export function formatEditor(editor = monaco.editor.getEditors()[0]) {
  if (!editor || editor.getOption(monaco.editor.EditorOption.readOnly)) return;
  editor.getAction('editor.action.formatDocument')?.run();
}

export { monaco };
