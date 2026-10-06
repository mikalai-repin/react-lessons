// Типы для shared/step-chain.js (сборка полного кода шагов главы)
export type FileMap = Record<string, string>;

export interface ChainMeta {
  startFrom?: string;
  /** У первого шага главы: шаг прошлой главы, поверх результата которого лежит start/ */
  base?: string;
  noSolution?: boolean;
  removedInStart?: string[];
  removedInSolution?: string[];
}

export function resolveChapter(
  steps: { meta: ChainMeta; start: FileMap; solution: FileMap }[],
  resultOf?: (ref: string) => FileMap,
): { start: FileMap; solution: FileMap }[];

export function stepResult(meta: ChainMeta, step: { start: FileMap; solution: FileMap }): FileMap;
