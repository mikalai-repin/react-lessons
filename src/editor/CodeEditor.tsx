import { useEffect, useRef, useState, type ReactNode } from 'react';
import { progress } from '../progress/storage';
import { FileTree } from './FileTree';
import { fileOfModel, formatEditor, modelUri, monaco } from './monaco';

/** На узком экране дерево файлов всплывает поверх кода и закрывается после выбора файла */
const NARROW = '(max-width: 900px)';

interface Props {
  stepId: string;
  files: string[];
  active: string;
  readonly: string[];
  onSelect: (file: string) => void;
  onChange: (file: string, code: string) => void;
  onRun: () => void;
  /** Кнопки в конце полосы вкладок (свернуть панель) */
  actions?: ReactNode;
}

export function CodeEditor({ stepId, files, active, readonly, onSelect, onChange, onRun, actions }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  // Колбэки меняются каждый рендер — храним последние в ref, чтобы не пересоздавать подписки
  const handlers = useRef({ onChange, onRun, stepId });
  handlers.current = { onChange, onRun, stepId };

  useEffect(() => {
    const editor = monaco.editor.create(hostRef.current!, {
      automaticLayout: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      tabSize: 2,
      padding: { top: 12 },
      renderLineHighlight: 'line',
      fixedOverflowWidgets: true,
      // Иначе Monaco подсвечивает кириллицу в комментариях как «похожие на латиницу» символы
      unicodeHighlight: { ambiguousCharacters: false },
    });
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => handlers.current.onRun());
    // Ctrl/Cmd + S форматирует код (вместо диалога сохранения страницы): сохраняется он и так автоматически
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => formatEditor(editor));
    editor.onDidChangeModelContent(() => {
      const model = editor.getModel();
      if (!model) return;
      handlers.current.onChange(fileOfModel(handlers.current.stepId, model), model.getValue());
    });
    editorRef.current = editor;
    return () => editor.dispose();
  }, []);

  useEffect(() => {
    const editor = editorRef.current;
    const model = monaco.editor.getModel(modelUri(stepId, active));
    if (!editor || !model || editor.getModel() === model) return;
    editor.setModel(model);
    editor.updateOptions({ readOnly: readonly.includes(active) });
  }, [stepId, active, readonly]);

  // Файлов в шаге может быть больше, чем помещается в полосу вкладок: активную прокручиваем в видимую область.
  // Ещё раз — когда полоса меняет размер: на узком экране панель кода при входе на шаг скрыта (нулевая ширина)
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const tabs = tabsRef.current;
    if (!tabs) return;
    const reveal = () => {
      const tab = tabs.querySelector<HTMLElement>('.tab.active');
      if (!tab || tabs.clientWidth === 0) return;
      if (tab.offsetLeft < tabs.scrollLeft) tabs.scrollLeft = tab.offsetLeft;
      else if (tab.offsetLeft + tab.offsetWidth > tabs.scrollLeft + tabs.clientWidth) {
        tabs.scrollLeft = tab.offsetLeft + tab.offsetWidth - tabs.clientWidth;
      }
    };
    reveal();
    const observer = new ResizeObserver(reveal);
    observer.observe(tabs);
    return () => observer.disconnect();
  }, [active]);

  const [showTree, setShowTree] = useState(() => progress.getFileTree() && !window.matchMedia(NARROW).matches);

  function toggleTree() {
    const next = !showTree;
    setShowTree(next);
    // На узком экране дерево — временная панель, её состояние не запоминаем
    if (!window.matchMedia(NARROW).matches) progress.setFileTree(next);
  }

  function selectFromTree(file: string) {
    onSelect(file);
    if (window.matchMedia(NARROW).matches) setShowTree(false);
  }

  return (
    <div className="editor">
      <div className="editor-header">
        <button
          className={showTree ? 'tree-toggle active' : 'tree-toggle'}
          title={showTree ? 'Скрыть дерево файлов' : 'Показать все файлы деревом'}
          aria-pressed={showTree}
          onClick={toggleTree}
        >
          <span aria-hidden="true">☰</span> Файлы <span className="tree-count">{files.length}</span>
        </button>
        <div className="tabs" role="tablist" ref={tabsRef}>
          {files.map((file) => (
            <button
              key={file}
              role="tab"
              aria-selected={file === active}
              className={file === active ? 'tab active' : 'tab'}
              onClick={() => onSelect(file)}
            >
              <TabLabel file={file} />
              {readonly.includes(file) && (
                <span className="tab-lock" title="Только для чтения">
                  🔒
                </span>
              )}
            </button>
          ))}
        </div>
        {actions}
      </div>
      <div className="editor-body">
        {showTree && <FileTree files={files} active={active} readonly={readonly} onSelect={selectFromTree} />}
        <div className="editor-host" ref={hostRef} />
      </div>
    </div>
  );
}

/** Подпись вкладки: папка приглушённо, имя файла — обычным цветом */
function TabLabel({ file }: { file: string }) {
  const slash = file.lastIndexOf('/');
  if (slash === -1) return <>{file}</>;
  return (
    <>
      <span className="tab-dir">{file.slice(0, slash + 1)}</span>
      {file.slice(slash + 1)}
    </>
  );
}
