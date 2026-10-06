import { useMemo, useState } from 'react';

interface Props {
  files: string[];
  active: string;
  readonly: string[];
  onSelect: (file: string) => void;
}

interface Folder {
  name: string;
  path: string;
  folders: Map<string, Folder>;
  files: string[];
}

/** Строит дерево из путей шага ('shared/GameCard.tsx'), сохраняя порядок файлов внутри папки */
function buildTree(files: string[]): Folder {
  const root: Folder = { name: '', path: '', folders: new Map(), files: [] };
  for (const file of files) {
    const parts = file.split('/');
    let folder = root;
    for (const part of parts.slice(0, -1)) {
      const path = folder.path ? `${folder.path}/${part}` : part;
      if (!folder.folders.has(part)) folder.folders.set(part, { name: part, path, folders: new Map(), files: [] });
      folder = folder.folders.get(part)!;
    }
    folder.files.push(file);
  }
  return root;
}

const FILE_ICONS: Record<string, { label: string; className: string }> = {
  tsx: { label: 'TSX', className: 'file-icon-tsx' },
  ts: { label: 'TS', className: 'file-icon-ts' },
  html: { label: '<>', className: 'file-icon-html' },
  css: { label: '#', className: 'file-icon-css' },
  json: { label: '{}', className: 'file-icon-json' },
};

function FileIcon({ file }: { file: string }) {
  const icon = FILE_ICONS[file.slice(file.lastIndexOf('.') + 1)];
  return <span className={`file-icon ${icon?.className ?? ''}`}>{icon?.label ?? '·'}</span>;
}

/** Дерево файлов шага: папки как в src/ проекта Vite, клик открывает файл во вкладке */
export function FileTree({ files, active, readonly, onSelect }: Props) {
  const tree = useMemo(() => buildTree(files), [files]);
  const [collapsed, setCollapsed] = useState<Set<string>>(() => new Set());

  function toggle(path: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  function renderFolder(folder: Folder, depth: number) {
    // Как в IDE: сначала папки по алфавиту, затем файлы в порядке вкладок
    const folders = [...folder.folders.values()].sort((a, b) => a.name.localeCompare(b.name));
    return (
      <>
        {folders.map((child) => {
          const isCollapsed = collapsed.has(child.path);
          return (
            <li key={child.path}>
              <button
                className="tree-row tree-folder"
                style={{ paddingLeft: 8 + depth * 14 }}
                aria-expanded={!isCollapsed}
                onClick={() => toggle(child.path)}
              >
                <span className="tree-arrow">{isCollapsed ? '▸' : '▾'}</span>
                {child.name}
              </button>
              {!isCollapsed && <ul>{renderFolder(child, depth + 1)}</ul>}
            </li>
          );
        })}
        {folder.files.map((file) => (
          <li key={file}>
            <button
              className={file === active ? 'tree-row tree-file active' : 'tree-row tree-file'}
              style={{ paddingLeft: 8 + depth * 14 + 12 }}
              title={file}
              onClick={() => onSelect(file)}
            >
              <FileIcon file={file} />
              {file.slice(file.lastIndexOf('/') + 1)}
              {readonly.includes(file) && (
                <span className="tab-lock" title="Только для чтения">
                  🔒
                </span>
              )}
            </button>
          </li>
        ))}
      </>
    );
  }

  return (
    <nav className="file-tree" aria-label="Файлы шага">
      <ul>{renderFolder(tree, 0)}</ul>
    </nav>
  );
}
