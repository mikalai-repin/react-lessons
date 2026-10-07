import type { FileMap } from '../content/course';

const KEY = 'react-course:v1';

interface StepProgress {
  /** Текущий код ученика */
  code?: FileMap;
  /** Код ученика до нажатия «Решение» — чтобы его можно было вернуть */
  backup?: FileMap;
  done?: boolean;
}

/** Лучшая попытка квиза главы */
export interface QuizResult {
  correct: number;
  total: number;
  /** Сдан ли квиз (≥ 85 %, см. quizPassScore) — тогда глава пройдена */
  passed: boolean;
}

interface Progress {
  steps: Record<string, StepProgress>;
  /** Квизы глав: slug главы → лучший результат */
  quizzes?: Record<string, QuizResult>;
  lastStep?: string;
  autorun?: boolean;
  /** Открыто ли дерево файлов рядом с редактором */
  fileTree?: boolean;
  /** Свёрнутые панели рабочей области (урок, код, результат) */
  collapsed?: string[];
  /** Цветовая палитра платформы (src/app/palettes.ts); её же читает скрипт в index.html до запуска приложения */
  palette?: string;
  /** Тема: light | dark (src/app/theme.ts, по умолчанию dark); её же читает скрипт в index.html до запуска */
  theme?: string;
}

// localStorage может быть недоступен (приватный режим, запрет сайта) — тогда работаем без сохранения
function read(): Progress {
  try {
    const text = localStorage.getItem(KEY);
    if (text) return JSON.parse(text) as Progress;
  } catch {
    // ignore
  }
  return { steps: {} };
}

let state = read();

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
}

function updateStep(stepId: string, patch: Partial<StepProgress>) {
  state.steps[stepId] = { ...state.steps[stepId], ...patch };
  write();
}

export const progress = {
  getCode: (stepId: string) => state.steps[stepId]?.code,
  setCode: (stepId: string, code: FileMap) => updateStep(stepId, { code }),
  clearCode: (stepId: string) => updateStep(stepId, { code: undefined, backup: undefined }),

  getBackup: (stepId: string) => state.steps[stepId]?.backup,
  setBackup: (stepId: string, backup: FileMap | undefined) => updateStep(stepId, { backup }),

  isDone: (stepId: string) => Boolean(state.steps[stepId]?.done),
  setDone: (stepId: string) => updateStep(stepId, { done: true }),

  getQuiz: (chapterSlug: string): QuizResult | undefined => state.quizzes?.[chapterSlug],
  /** Сохраняет попытку, если она лучше прежней (сданная попытка всегда лучше несданной) */
  saveQuiz: (chapterSlug: string, result: QuizResult) => {
    const best = state.quizzes?.[chapterSlug];
    const isBetter =
      !best ||
      (result.passed && !best.passed) ||
      (result.passed === best.passed && result.correct / result.total > best.correct / best.total);
    if (!isBetter) return;
    state.quizzes = { ...state.quizzes, [chapterSlug]: result };
    write();
  },
  /** Глава пройдена, когда сдан её квиз */
  isChapterDone: (chapterSlug: string) => Boolean(state.quizzes?.[chapterSlug]?.passed),

  getLastStep: () => state.lastStep,
  setLastStep: (stepId: string) => {
    state.lastStep = stepId;
    write();
  },

  getAutorun: () => state.autorun ?? true,
  setAutorun: (value: boolean) => {
    state.autorun = value;
    write();
  },

  getFileTree: () => state.fileTree ?? false,
  setFileTree: (value: boolean) => {
    state.fileTree = value;
    write();
  },

  getCollapsed: () => state.collapsed ?? [],
  setCollapsed: (value: string[]) => {
    state.collapsed = value;
    write();
  },

  getPalette: () => state.palette,
  setPalette: (value: string) => {
    state.palette = value;
    write();
  },

  getTheme: () => state.theme,
  setTheme: (value: string) => {
    state.theme = value;
    write();
  },

  /** Для отладки: полный сброс прогресса */
  resetAll: () => {
    state = { steps: {} };
    write();
  },
};
