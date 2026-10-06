// Среда выполнения кода ученика внутри iframe.
//
// Протокол с родительским окном (src/preview/Preview.tsx):
//   iframe → родитель: { type: 'ready' }
//   родитель → iframe: { type: 'run', files: { 'main.js': '<js>', … }, sources: { 'main.js': 'main.tsx', … },
//                        entry: 'main.js', styles: ['<css>'], url: '/catalog', backend: { latency, failRate } }
//   iframe → родитель: { type: 'console', level, text } | { type: 'error', text } | { type: 'url', url } | { type: 'title', title }
//                      | { type: 'network', entry: { id, method, url, status, ms, … } }
//   родитель → iframe: { type: 'navigate', url } | { type: 'history', delta } | { type: 'backend-config', config }
//
// Каждый запуск — новый iframe, поэтому здесь нет никакой очистки состояния.

import { init, parse } from '/vendor/es-module-lexer.js';
import { createBackend } from '/backend/backend.js';

const parentWindow = window.parent;
const SOURCE = 'react-course-preview';
const send = (message) => parentWindow.postMessage({ source: SOURCE, ...message }, '*');

// ---------- Source map: номера строк в ошибках → строки .ts ----------

/** blob-URL → имя файла, чтобы в ошибках было видно «CartPage.tsx:12», а не «blob:...» */
const blobNames = new Map();

/** Имя .ts/.tsx-файла → разобранная source map: номера строк скомпилированного JS → строки исходника */
const sourceMaps = new Map();

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Разбирает поле mappings (Base64 VLQ) в массив строк: [[генКолонка, исхСтрока, исхКолонка], ...] */
function decodeMappings(mappings) {
  const lines = [];
  let sourceLine = 0;
  let sourceColumn = 0;
  for (const lineText of mappings.split(';')) {
    const segments = [];
    let generatedColumn = 0;
    for (const segmentText of lineText.split(',')) {
      if (!segmentText) continue;
      const values = [];
      let value = 0;
      let shift = 0;
      for (const char of segmentText) {
        const digit = BASE64.indexOf(char);
        value += (digit & 31) << shift;
        if (digit & 32) {
          shift += 5;
        } else {
          values.push(value & 1 ? -(value >>> 1) : value >>> 1);
          value = 0;
          shift = 0;
        }
      }
      generatedColumn += values[0];
      if (values.length >= 4) {
        sourceLine += values[2];
        sourceColumn += values[3];
        segments.push([generatedColumn, sourceLine, sourceColumn]);
      }
    }
    lines.push(segments);
  }
  return lines;
}

function readInlineSourceMap(code) {
  const match = /\/\/# sourceMappingURL=data:application\/json;base64,([A-Za-z0-9+/=]+)/.exec(code);
  if (!match) return null;
  try {
    const bytes = Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0));
    const map = JSON.parse(new TextDecoder().decode(bytes));
    return decodeMappings(map.mappings);
  } catch {
    return null;
  }
}

function mapPosition(file, line, column) {
  const segments = sourceMaps.get(file)?.[line - 1];
  if (!segments?.length) return null;
  let best = segments[0];
  for (const segment of segments) {
    if (segment[0] <= column - 1) best = segment;
    else break;
  }
  return { line: best[1] + 1, column: best[2] + 1 };
}

function prettify(text) {
  let result = String(text);
  for (const [url, name] of blobNames) result = result.split(url).join(name);
  // Строки стека внутри React и библиотек (renderWithHooks, beginWork, …) ученику не нужны: подряд идущие
  // сворачиваем в одну — как Chrome прячет фреймы библиотек
  const vendor = `${location.origin}/vendor/`;
  const lines = [];
  for (const line of result.split('\n')) {
    const internal = /^\s+at /.test(line) && line.includes(vendor);
    if (!internal) lines.push(line);
    else if (!lines.at(-1)?.endsWith('(вызовы внутри библиотек)')) lines.push('    … (вызовы внутри библиотек)');
  }
  result = lines.join('\n').replace(new RegExp(vendor, 'g'), '');
  return result.replace(/([\w./-]+\.tsx?):(\d+):(\d+)/g, (whole, file, line, column) => {
    const original = mapPosition(file, Number(line), Number(column));
    return original ? `${file}:${original.line}:${original.column}` : whole;
  });
}

// ---------- Консоль ----------

const REACT_ELEMENT_TYPES = new Set([Symbol.for('react.transitional.element'), Symbol.for('react.element')]);

/** Имя типа React-элемента: 'div', 'GameCard', 'Fragment', 'Context' */
function elementTypeName(type) {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') return type.displayName || type.name || 'Anonymous';
  if (typeof type === 'symbol') return type.description?.replace(/^react\./, '') ?? 'Unknown';
  if (type && typeof type === 'object') return type.displayName || type.render?.name || type.type?.name || 'Component';
  return String(type);
}

function formatValue(value, depth = 0) {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  const type = typeof value;
  if (type === 'string') return depth === 0 ? value : JSON.stringify(value);
  if (type === 'number' || type === 'boolean' || type === 'bigint') return String(value);
  if (type === 'function') return `ƒ ${value.name || 'anonymous'}()`;
  if (type === 'symbol') return value.toString();
  if (value instanceof Error) return prettify(value.stack || `${value.name}: ${value.message}`);
  // React-элемент (результат JSX): <GameCard />
  if (REACT_ELEMENT_TYPES.has(value.$$typeof)) return `<${elementTypeName(value.type)} />`;
  if (value instanceof Node) {
    if (value instanceof Element) return `<${value.tagName.toLowerCase()}${value.id ? '#' + value.id : ''}>`;
    return value.nodeName;
  }

  const name = value.constructor?.name;
  if (Array.isArray(value)) {
    if (depth >= 2) return `Array(${value.length})`;
    const items = value.slice(0, 20).map((item) => formatValue(item, depth + 1));
    if (value.length > 20) items.push(`… ещё ${value.length - 20}`);
    return `[${items.join(', ')}]`;
  }
  // Объекты классов (QueryClient, Map, Date…) бывают огромными и с циклическими ссылками — только имя класса
  if (name && name !== 'Object') {
    if (value instanceof Map) return `Map(${value.size})`;
    if (value instanceof Set) return `Set(${value.size})`;
    if (value instanceof Date) return value.toISOString();
    return `${name} {…}`;
  }
  if (depth >= 2) return '{…}';
  const keys = Object.keys(value);
  const entries = keys.slice(0, 20).map((key) => `${key}: ${formatValue(value[key], depth + 1)}`);
  if (keys.length > 20) entries.push(`… ещё ${keys.length - 20}`);
  return `{ ${entries.join(', ')} }`;
}

/**
 * Подстановка printf-шаблона: React пишет предупреждения как console.error('Each child … %s%s …', a, b).
 * Возвращает аргументы с уже подставленным первым.
 */
function applyFormat(args) {
  if (typeof args[0] !== 'string' || !/%[sdifoOc]/.test(args[0])) return args;
  let index = 1;
  const text = args[0].replace(/%([sdifoOc%])/g, (whole, spec) => {
    if (spec === '%') return '%';
    if (index >= args.length) return whole;
    const arg = args[index++];
    if (spec === 'c') return ''; // стили консоли
    if (spec === 'd' || spec === 'i') return String(parseInt(arg, 10));
    if (spec === 'f') return String(parseFloat(arg));
    return typeof arg === 'string' ? arg : formatValue(arg, 1);
  });
  return [text, ...args.slice(index)];
}

/** Модуль react приложения: из него берём captureOwnerStack (загружается при запуске, см. ниже) */
let react = null;

for (const level of ['log', 'info', 'warn', 'error', 'debug']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    let text = null;
    try {
      text = applyFormat(args)
        .map((arg) => formatValue(arg))
        .join(' ');
      // Стек владельцев («какой компонент отрисовал этот элемент»): React 19 не пишет его в текст
      // предупреждения, но отдаёт через captureOwnerStack() во время рендера (только в development-сборке)
      if (level === 'error' || level === 'warn') {
        const owners = react?.captureOwnerStack?.();
        if (owners) text += `\n${prettify(owners.replace(/^\n/, ''))}`;
      }
    } catch {
      // Ошибка форматирования не должна ломать код ученика
    }
    original(...args);
    // Стек ошибки и стек владельцев свёрнуты по отдельности: на стыке бывают две строки «вызовы внутри библиотек»
    if (text !== null)
      text = text.replace(/(\n {4}… \(вызовы внутри библиотек\))+/g, '\n    … (вызовы внутри библиотек)');
    // Совет React установить DevTools ученику не поможет: расширение не видит приложение внутри iframe платформы
    if (text?.includes('react.dev/link/react-devtools')) return;
    if (text !== null) send({ type: 'console', level, text });
  };
}

// Необработанные ошибки (в том числе ошибки рендера без границы ошибок: React 19 по умолчанию передаёт их
// в window.reportError). Решение откладываем до конца обработки события: если кто-то вызвал preventDefault(),
// ошибка обработана — как браузер, который не пишет «Uncaught» для обработанных ошибок
window.addEventListener('error', (event) => {
  setTimeout(() => {
    if (!event.defaultPrevented) send({ type: 'error', text: prettify(event.error?.stack || event.message) });
  });
});

window.addEventListener('unhandledrejection', (event) => {
  setTimeout(() => {
    if (event.defaultPrevented) return;
    const reason = event.reason;
    send({ type: 'error', text: prettify(reason?.stack || String(reason)) });
  });
});

// ---------- Адрес приложения (роутинг внутри iframe) ----------

// Приложение живёт в корне адреса iframe: до запуска адрес подменяется (replaceState), и роутер читает его
// как в настоящем проекте — без basename (см. docs/architecture.md, «Превью»)
function appUrl() {
  return location.pathname + location.search + location.hash;
}

let lastReportedUrl = null;
function reportUrl() {
  const url = appUrl();
  if (url === lastReportedUrl) return;
  lastReportedUrl = url;
  send({ type: 'url', url });
}

// Роутер меняет адрес через pushState/replaceState: оборачиваем их, чтобы показывать адрес в адресной строке
for (const method of ['pushState', 'replaceState']) {
  const original = history[method].bind(history);
  history[method] = (...args) => {
    original(...args);
    reportUrl();
  };
}
window.addEventListener('popstate', reportUrl);

// Заголовок вкладки (document.title; в React 19 — и <title> в разметке компонента) — показываем над адресной строкой
let lastReportedTitle = null;
function reportTitle() {
  if (document.title === lastReportedTitle) return;
  lastReportedTitle = document.title;
  send({ type: 'title', title: document.title });
}
new MutationObserver(reportTitle).observe(document.head, { subtree: true, childList: true, characterData: true });
reportTitle();

/** Переход по адресу из адресной строки: как будто пользователь сменил URL, а роутер узнал об этом из popstate */
function navigate(url) {
  const target = url.startsWith('/') ? url : `/${url}`;
  history.pushState(null, '', target);
  window.dispatchEvent(new PopStateEvent('popstate', { state: null }));
}

// ---------- Учебный бэкенд ----------

const backend = createBackend({
  originalFetch: window.fetch.bind(window),
  report: (entry) => send({ type: 'network', entry }),
});

// Запросы на /api/… обслуживает учебный бэкенд, остальные — настоящий fetch
const originalFetch = window.fetch.bind(window);
window.fetch = (input, init) => {
  const request = new Request(input, init);
  const url = new URL(request.url);
  if (url.origin === location.origin && url.pathname.startsWith('/api/')) return backend.handle(request);
  return originalFetch(input, init);
};

// ---------- Модули ----------

function resolveFile(files, fromFile, specifier) {
  const baseParts = fromFile.split('/').slice(0, -1);
  for (const part of specifier.split('/')) {
    if (part === '.' || part === '') continue;
    if (part === '..') baseParts.pop();
    else baseParts.push(part);
  }
  const path = baseParts.join('/');
  for (const candidate of [path, `${path}.js`, `${path}/index.js`]) {
    if (candidate in files) return candidate;
  }
  return null;
}

/**
 * Превращает набор файлов в blob-модули. Относительные импорты (`./cart`), в том числе динамические
 * (`lazy: () => import('./admin/AdminPage')`), заменяются на blob-URL зависимостей, а «голые» (`react`)
 * резолвит import map. sources: модуль → исходник ('App.js' → 'App.tsx') — имена в ошибках и стеке.
 */
function linkModules(files, sources, entry) {
  const sourceName = (file) => sources?.[file] ?? file;
  const urls = new Map();
  const visiting = new Set();

  function build(file, chain) {
    if (urls.has(file)) return urls.get(file);
    if (visiting.has(file)) {
      const names = [...chain, file].map(sourceName);
      throw new Error(
        `Циклический импорт: ${names.join(' → ')}. Превью курса не поддерживает циклические зависимости между файлами.`,
      );
    }
    visiting.add(file);

    const code = files[file];
    const [imports] = parse(code, file);
    const replacements = [];

    for (const imp of imports) {
      const spec = imp.specifier;
      if (!spec || !(spec.startsWith('./') || spec.startsWith('../'))) continue;
      const target = resolveFile(files, file, spec);
      if (!target) throw new Error(`${sourceName(file)}: не найден файл для импорта "${spec}"`);
      const url = build(target, [...chain, file]);
      // У статического импорта start/end — без кавычек, у динамического — с кавычками
      const text = imp.type === 'dynamic' ? JSON.stringify(url) : url;
      replacements.push({ start: imp.start, end: imp.end, text });
    }

    let linked = code;
    for (const r of replacements.sort((a, b) => b.start - a.start)) {
      linked = linked.slice(0, r.start) + r.text + linked.slice(r.end);
    }

    // Модуль называется именем исходника (CartPage.tsx) — так его видно в стеке и в DevTools
    const lines = readInlineSourceMap(code);
    const displayName = sourceName(file);
    if (lines) sourceMaps.set(displayName, lines);

    const url = URL.createObjectURL(new Blob([`${linked}\n//# sourceURL=${displayName}`], { type: 'text/javascript' }));
    blobNames.set(url, displayName);
    visiting.delete(file);
    urls.set(file, url);
    return url;
  }

  return build(entry, []);
}

// Обычная ссылка (<a href="/catalog">), которую никто не обработал (Link роутера вызывает preventDefault):
// в браузере это загрузка страницы. iframe превью загрузил бы по этому адресу платформу — поэтому просим
// родителя перезапустить приложение с этого адреса, как кнопка ⟳. Слушатель на window срабатывает после
// обработчиков React (они на корне приложения)
window.addEventListener('click', (event) => {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey
  ) {
    return;
  }
  const link = event.target instanceof Element ? event.target.closest('a[href]') : null;
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  event.preventDefault();
  // Ссылка на якорь той же страницы — браузер не перезагружает страницу
  if (url.pathname === location.pathname && url.search === location.search && url.hash) {
    location.hash = url.hash;
    return;
  }
  send({ type: 'restart', url: url.pathname + url.search + url.hash });
});

function applyStyles(styles) {
  for (const css of styles ?? []) {
    const style = document.createElement('style');
    style.dataset.course = 'global';
    style.textContent = css;
    document.head.append(style);
  }
}

window.addEventListener('message', async (event) => {
  const data = event.data;
  if (event.source !== parentWindow) return;

  if (data?.type === 'navigate') return navigate(data.url);
  if (data?.type === 'history') return history.go(data.delta);
  if (data?.type === 'backend-config') return backend.configure(data.config);
  if (data?.type !== 'run') return;

  try {
    backend.configure(data.backend ?? {});
    // Адрес до запуска: роутер прочитает его при старте
    history.replaceState(null, '', data.url || '/');
    applyStyles(data.styles);

    // Сборка не дала точку входа (ошибка уже в консоли с меткой «Сборка») — запускать нечего
    if (!(data.entry in data.files)) return;
    await init();
    const entryUrl = linkModules(data.files, data.sources, data.entry);
    // Тот же экземпляр react, что у приложения (import map): нужен для captureOwnerStack в консоли
    react = await import('react');
    await import(entryUrl);
  } catch (error) {
    send({ type: 'error', text: prettify(error?.stack || String(error)) });
  }
});

send({ type: 'ready' });
