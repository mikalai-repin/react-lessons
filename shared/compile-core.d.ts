// Типы для shared/compile-core.js (модуль на чистом JS: его импортируют и Node-скрипты)
export declare function resolvePath(fromFile: string, specifier: string): string;

export declare function transformCssModule(css: string, file: string): { css: string; classes: Record<string, string> };

export declare function outputName(file: string): string | null;

export interface CompiledStep {
  /** Скомпилированные модули: 'App.js', 'shared/GameCard.js', 'shared/GameCard.module.css.js' */
  files: Record<string, string>;
  /** Модуль → исходный файл: 'App.js' → 'App.tsx' (имена в стеке и ошибках) */
  sources: Record<string, string>;
  /** Глобальные стили вне модулей. В React-курсе пусто: CSS подключается импортом (`import './styles.css'`) */
  styles: string[];
  /** Ошибки сборки (синтаксис): «App.tsx:12 — ')' expected.» */
  errors: string[];
}

export declare function compileFiles(ts: unknown, files: Record<string, string>): CompiledStep;
