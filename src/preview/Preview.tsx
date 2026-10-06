import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import type { BackendConfig, FileMap } from '../content/course';
import type { Diagnostic } from '../editor/monaco';

export interface ConsoleEntry {
  id: number;
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'ts' | 'build';
  text: string;
  /** Сколько раз подряд пришло то же сообщение (рендер в цикле, StrictMode) */
  count: number;
}

export interface NetworkEntry {
  id: number;
  method: string;
  url: string;
  status: number | 'pending' | 'canceled';
  ms?: number;
  requestBody?: unknown;
  responseBody?: unknown;
}

export interface PreviewRun {
  files: FileMap;
  /** Модуль → исходный файл ('App.js' → 'App.tsx') */
  sources: FileMap;
  styles: string[];
  entry: string;
  id: number;
  /** Ошибки TypeScript: показываем их в консоли, но код всё равно запускаем */
  diagnostics: Diagnostic[];
  /** Ошибки сборки: не найден файл шаблона, синтаксис */
  buildErrors: string[];
}

interface PreviewMessage {
  source: 'react-course-preview';
  type: 'ready' | 'console' | 'error' | 'url' | 'network' | 'title' | 'restart';
  level?: ConsoleEntry['level'];
  text?: string;
  url?: string;
  title?: string;
  entry?: NetworkEntry;
}

interface Props {
  /** Скомпилированный код; новый объект = новый запуск */
  run: PreviewRun | null;
  /** Адрес приложения при входе на шаг */
  initialUrl: string;
  /** Настройки учебного бэкенда из шага */
  backend: BackendConfig;
  /** Кнопки в конце адресной строки (свернуть панель) */
  actions?: ReactNode;
}

const DEFAULT_BACKEND: Required<BackendConfig> = { latency: 300, failRate: 0 };
const LATENCIES = [0, 300, 1000, 3000];

let nextEntryId = 1;

const URL_PATTERN = /(https?:\/\/[^\s)'"]+)/g;

/** Делает ссылками адреса (react.dev/link/warning-keys, react.dev/errors/…) */
function linkify(text: string): ReactNode {
  const parts = text.split(URL_PATTERN);
  return parts.map((part, index) => {
    if (index % 2 === 0) return <Fragment key={index}>{part}</Fragment>;
    const href = part.replace(/[.,]$/, '');
    return (
      <a key={index} href={href} target="_blank" rel="noopener">
        {part}
      </a>
    );
  });
}

function statusClass(status: NetworkEntry['status']) {
  if (status === 'pending' || status === 'canceled') return status;
  return status >= 400 ? 'failed' : 'ok';
}

export function Preview({ run, initialUrl, backend, actions }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [network, setNetwork] = useState<NetworkEntry[]>([]);
  const [panel, setPanel] = useState<'console' | 'network'>('console');
  const [selectedRequest, setSelectedRequest] = useState<number | null>(null);
  const [backendConfig, setBackendConfig] = useState({ ...DEFAULT_BACKEND, ...backend });
  /** Адрес, который показывает адресная строка (приложение сообщает о каждом переходе) */
  const [url, setUrl] = useState(initialUrl);
  const [typedUrl, setTypedUrl] = useState(initialUrl);
  /** Заголовок вкладки приложения — document.title внутри iframe */
  const [title, setTitle] = useState('');
  /** Текущий iframe: ключ (новый ключ — новый iframe) и адрес, с которого приложение стартует */
  const [frame, setFrame] = useState<{ key: string; startUrl: string } | null>(null);
  const urlRef = useRef(initialUrl);
  const restarts = useRef(0);

  const configRef = useRef(backendConfig);
  configRef.current = backendConfig;

  function start(startUrl: string) {
    if (!run) return;
    restarts.current++;
    urlRef.current = startUrl;
    setUrl(startUrl);
    setTypedUrl(startUrl);
    setTitle('');
    setNetwork([]);
    setSelectedRequest(null);
    setEntries([
      ...run.buildErrors.map((text) => ({ id: nextEntryId++, level: 'build' as const, text, count: 1 })),
      ...run.diagnostics.map((d) => ({
        id: nextEntryId++,
        level: 'ts' as const,
        text: `${d.file}:${d.line}:${d.column} — ${d.message}`,
        count: 1,
      })),
    ]);
    setFrame({ key: `${run.id}-${restarts.current}`, startUrl });
  }

  // Новый запуск кода — новый iframe. Адрес сохраняется: после правки кода ученик остаётся на той же странице
  useEffect(() => {
    start(urlRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);

  useEffect(() => {
    function onMessage(event: MessageEvent<PreviewMessage>) {
      const data = event.data;
      if (data?.source !== 'react-course-preview') return;
      if (event.source !== iframeRef.current?.contentWindow) return;

      if (data.type === 'ready' && run && frame) {
        iframeRef.current?.contentWindow?.postMessage(
          {
            type: 'run',
            files: run.files,
            sources: run.sources,
            styles: run.styles,
            entry: run.entry,
            url: frame.startUrl,
            backend: configRef.current,
          },
          '*',
        );
      } else if (data.type === 'url' && data.url !== undefined) {
        urlRef.current = data.url;
        setUrl(data.url);
        setTypedUrl(data.url);
      } else if (data.type === 'restart' && data.url !== undefined) {
        // Обычная ссылка <a href> без роутера: в браузере это загрузка страницы — перезапускаем приложение с адреса
        start(data.url);
      } else if (data.type === 'title' && data.title !== undefined) {
        setTitle(data.title);
      } else if (data.type === 'network' && data.entry) {
        const entry = data.entry;
        setNetwork((list) => {
          const index = list.findIndex((e) => e.id === entry.id);
          if (index === -1) return [...list.slice(-199), entry];
          const next = [...list];
          next[index] = entry;
          return next;
        });
      } else if (data.type === 'console' || data.type === 'error') {
        const level: ConsoleEntry['level'] = data.type === 'error' ? 'error' : (data.level ?? 'log');
        const text = data.text ?? '';
        setEntries((list) => {
          const last = list.at(-1);
          if (last && last.level === level && last.text === text) {
            return [...list.slice(0, -1), { ...last, count: last.count + 1 }];
          }
          return [...list.slice(-199), { id: nextEntryId++, level, text, count: 1 }];
        });
      }
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [run, frame]);

  function post(message: object) {
    iframeRef.current?.contentWindow?.postMessage(message, '*');
  }

  function updateBackend(patch: Partial<BackendConfig>) {
    const next = { ...backendConfig, ...patch };
    setBackendConfig(next);
    post({ type: 'backend-config', config: next });
  }

  const selected = network.find((e) => e.id === selectedRequest);
  const errorCount = entries.filter((e) => e.level === 'error' || e.level === 'build').length;

  return (
    <div className="preview">
      <div className="preview-tab" title="Заголовок вкладки — document.title приложения">
        <span className="preview-tab-title">{title || '\u00a0'}</span>
      </div>
      <form
        className="address-bar"
        onSubmit={(event) => {
          event.preventDefault();
          const target = typedUrl.trim() || '/';
          // Ввод адреса — как в браузере: приложение загружается заново с этого адреса
          start(target.startsWith('/') ? target : `/${target}`);
        }}
      >
        <button
          type="button"
          className="icon-button"
          title="Назад"
          onClick={() => post({ type: 'history', delta: -1 })}
        >
          ←
        </button>
        <button
          type="button"
          className="icon-button"
          title="Вперёд"
          onClick={() => post({ type: 'history', delta: 1 })}
        >
          →
        </button>
        <button
          type="button"
          className="icon-button"
          title="Перезагрузить приложение с текущего адреса"
          onClick={() => start(url)}
        >
          ⟳
        </button>
        <input
          className="address-input"
          value={typedUrl}
          spellCheck={false}
          aria-label="Адрес приложения"
          onChange={(event) => setTypedUrl(event.target.value)}
        />
        {actions}
      </form>
      <div className="preview-frame">
        {run && frame ? (
          <iframe key={frame.key} ref={iframeRef} src="/preview.html" title="Результат" />
        ) : (
          <div className="preview-empty">Компилируем…</div>
        )}
      </div>
      <div className="console">
        <div className="console-header">
          <div className="panel-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={panel === 'console'}
              className={panel === 'console' ? 'panel-tab active' : 'panel-tab'}
              onClick={() => setPanel('console')}
            >
              Консоль{errorCount > 0 && <span className="panel-badge error">{errorCount}</span>}
            </button>
            <button
              role="tab"
              aria-selected={panel === 'network'}
              className={panel === 'network' ? 'panel-tab active' : 'panel-tab'}
              onClick={() => setPanel('network')}
            >
              Сеть{network.length > 0 && <span className="panel-badge">{network.length}</span>}
            </button>
          </div>
          {panel === 'console' && entries.length > 0 && (
            <button className="link-button" onClick={() => setEntries([])}>
              Очистить
            </button>
          )}
          {panel === 'network' && (
            <div className="backend-controls">
              <label title="Задержка ответа учебного бэкенда">
                Задержка
                <select
                  value={backendConfig.latency}
                  onChange={(event) => updateBackend({ latency: Number(event.target.value) })}
                >
                  {[...new Set([...LATENCIES, backendConfig.latency])]
                    .sort((a, b) => a - b)
                    .map((ms) => (
                      <option key={ms} value={ms}>
                        {ms} мс
                      </option>
                    ))}
                </select>
              </label>
              <label title="Все запросы к /api/… отвечают ошибкой 500">
                <input
                  type="checkbox"
                  checked={backendConfig.failRate >= 1}
                  onChange={(event) => updateBackend({ failRate: event.target.checked ? 1 : 0 })}
                />
                Ошибка 500
              </label>
            </div>
          )}
        </div>
        {panel === 'console' ? (
          <div className="console-body">
            {entries.length === 0 ? (
              <div className="console-empty">Здесь появится вывод console.log и ошибки</div>
            ) : (
              entries.map((entry) => (
                <pre key={entry.id} className={`console-line console-${entry.level}`}>
                  {entry.count > 1 && <span className="console-count">{entry.count}</span>}
                  {entry.level === 'ts' && <span className="console-badge">TS</span>}
                  {entry.level === 'build' && <span className="console-badge">Сборка</span>}
                  {linkify(entry.text)}
                </pre>
              ))
            )}
          </div>
        ) : (
          <div className="console-body network-body">
            {network.length === 0 ? (
              <div className="console-empty">Здесь появятся запросы к учебному бэкенду (/api/…)</div>
            ) : (
              <>
                <table className="network-table">
                  <tbody>
                    {network.map((entry) => (
                      <tr
                        key={entry.id}
                        className={`network-row network-${statusClass(entry.status)}${entry.id === selectedRequest ? ' selected' : ''}`}
                        onClick={() => setSelectedRequest(entry.id === selectedRequest ? null : entry.id)}
                      >
                        <td className="network-method">{entry.method}</td>
                        <td className="network-url">{entry.url}</td>
                        <td className="network-status">
                          {entry.status === 'pending' ? '…' : entry.status === 'canceled' ? 'отменён' : entry.status}
                        </td>
                        <td className="network-ms">{entry.ms !== undefined ? `${entry.ms} мс` : ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {selected && (
                  <div className="network-details">
                    {selected.requestBody !== undefined && (
                      <>
                        <div className="network-details-title">Тело запроса</div>
                        <pre>{JSON.stringify(selected.requestBody, null, 2)}</pre>
                      </>
                    )}
                    <div className="network-details-title">Ответ</div>
                    <pre>
                      {selected.responseBody === undefined
                        ? '—'
                        : JSON.stringify(selected.responseBody, null, 2)?.slice(0, 5000)}
                    </pre>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
