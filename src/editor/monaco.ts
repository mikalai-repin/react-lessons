import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import type { FileMap } from '../content/course';
import courseEnv from '../../shared/course-env.d.ts?raw';
import lessonPrettier from '../../shared/lesson-prettier.json';
// Ядро Shiki всё равно в чанке страницы шага (им подсвечивается текст урока, src/lesson/markdown.ts)
import { createHighlighterCore } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import { courseDark, courseLight } from './course-themes';

// ---------- Типы библиотек для подсказок и проверки TypeScript ----------
//
// TS-воркер Monaco (TypeScript 5.9) ищет модули по схеме node10 и не понимает поле `exports` в package.json.
// Поэтому кладём .d.ts пакетов по их настоящим путям, а для точек входа из `exports`, у которых типы лежат
// не в `<подпуть>/index.d.ts` (`react-router` → dist/production/index.d.ts), добавляем файл-заглушку
// `<подпуть>/index.d.ts` с `export * from '<настоящий файл>'`.
// Сами .d.ts — в src/editor/library-types.ts (отдельный чанк, загружается здесь же динамически).

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

/** Типы библиотек загружены и переданы TS-воркеру: до этого проверка дала бы «Cannot find module 'react'» */
const typesReady = import('./library-types').then(({ typeFiles, typedPackages }) => {
  for (const [path, source] of Object.entries(typeFiles)) {
    ts.typescriptDefaults.addExtraLib(source, NODE_MODULES + relativeToNodeModules(path));
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
});

// Импорт стилей — как в Vite (vite/client): CSS Modules дают карту классов, обычный CSS — ничего
ts.typescriptDefaults.addExtraLib(courseEnv, 'file:///course-env.d.ts');

// --- Форматирование кода (Prettier) ---
/** Настройки — общие с файлами уроков на диске (shared/lesson-prettier.json: по ним форматирует код шагов
 *  npm run chapter export); .ts и .tsx разбирает парсер `typescript` */
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

// ---------- Подсветка: Shiki (грамматики VS Code) ----------
//
// Встроенная Monarch-грамматика typescript в Monaco не знает JSX: теги и атрибуты не выделяются. Shiki подсвечивает
// теми же TextMate-грамматиками, что VS Code, и темами курса (src/editor/course-themes.ts) — как код в тексте урока.
// TS-воркер Monaco работает только с языком 'typescript', поэтому грамматика TSX регистрируется под этим именем:
// .ts и .tsx подсвечиваются одинаково (TSX — надмножество TS, кроме приведения типа `<T>x`, которого в курсе нет).

let highlighted = false;

function applyTheme() {
  // Действующую тему ставит на <html> src/app/theme.ts (и скрипт в index.html до запуска)
  const dark = document.documentElement.dataset.theme === 'dark';
  if (highlighted) monaco.editor.setTheme(dark ? courseDark.name! : courseLight.name!);
  else monaco.editor.setTheme(dark ? 'vs-dark' : 'vs');
}
applyTheme();
new MutationObserver(applyTheme).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ['data-theme'],
});

async function setupHighlighting() {
  const [{ shikiToMonaco }, tsx, css] = await Promise.all([
    import('@shikijs/monaco'),
    import('shiki/langs/tsx.mjs'),
    import('shiki/langs/css.mjs'),
  ]);
  const typescript = tsx.default.map((lang) =>
    lang.name === 'tsx' ? { ...lang, name: 'typescript', aliases: [] } : lang,
  );
  const highlighter = await createHighlighterCore({
    themes: [courseLight, courseDark],
    langs: [typescript, css.default],
    engine: createJavaScriptRegexEngine(),
  });
  // Встроенные грамматики Monaco подгружаются лениво и при загрузке регистрируются заново — поверх Shiki, если
  // загрузились позже него. colorize ждёт, пока встроенная грамматика языка загрузится: после этого Shiki — последний
  await Promise.all(['typescript', 'css'].map((language) => monaco.editor.colorize('', language, {})));
  // Адаптер типизирован под monaco-editor-core; monaco-editor содержит то же API
  shikiToMonaco(highlighter, monaco as unknown as Parameters<typeof shikiToMonaco>[1]);
  highlighted = true;
  applyTheme();
}
setupHighlighting().catch((error) => console.warn('Подсветка Shiki не загрузилась, остаётся встроенная:', error));

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
  await typesReady;
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

/**
 * Ошибки типов во всех .ts/.tsx-файлах шага — для консоли превью (сам код компилирует воркер src/compiler).
 * Синтаксические ошибки сюда не входят: их сообщает компиляция с меткой «Сборка» (тот же разбор TypeScript), и в
 * консоли была бы одна ошибка дважды. Подчёркивания в редакторе Monaco ставит сам — там видны обе
 */
export async function collectDiagnostics(stepId: string, files: string[]): Promise<Diagnostic[]> {
  const getWorker = await syncStepWithWorker(stepId, files);
  const result: Diagnostic[] = [];
  for (const file of files.filter(isTs)) {
    const uri = modelUri(stepId, file);
    const model = monaco.editor.getModel(uri);
    if (!model) continue;
    const worker = await getWorker(uri);
    const name = uri.toString();
    for (const diagnostic of await worker.getSemanticDiagnostics(name)) {
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
