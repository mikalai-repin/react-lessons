import { parse as parseYaml } from 'yaml';
import { resolveChapter, stepResult } from '../../shared/step-chain.js';

/** Набор файлов шага: имя файла → исходный код */
export type FileMap = Record<string, string>;

export interface StepMeta {
  title: string;
  files?: string[];
  readonly?: string[];
  focus?: string;
  startFrom?: 'previous' | 'custom';
  /** У первого шага главы: шаг прошлой главы ('07-directives-pipes/07-practice'), поверх результата которого start/ */
  base?: string;
  /** Хеш полного кода базы — его сверяет валидатор */
  baseHash?: string;
  api?: string[];
  /** Шаг без задания (демо, теория): кнопки «Решение» нет */
  noSolution?: boolean;
  /** Начальный адрес приложения в превью, по умолчанию '/' */
  url?: string;
  /** Настройки учебного бэкенда для шага */
  backend?: BackendConfig;
  /** Файлы результата предыдущего шага, которых нет в custom-старте (закадровая подготовка) */
  removedInStart?: string[];
  /** Файлы старта, которые ученик удаляет в этом шаге */
  removedInSolution?: string[];
}

/** Настройки учебного бэкенда (public/backend/backend.js) */
export interface BackendConfig {
  /** Задержка ответа, мс */
  latency?: number;
  /** Доля запросов, которые отвечают 500 (0..1) */
  failRate?: number;
}

export interface Step {
  /** Уникальный id для хранения прогресса: «templates/property-binding» */
  id: string;
  /** Папка на диске: «02-templates/02-property-binding» */
  dir: string;
  slug: string;
  /** Номер шага внутри главы, с нуля */
  index: number;
  meta: StepMeta;
  body: string;
  start: FileMap;
  solution: FileMap;
  /** Порядок вкладок в редакторе */
  fileOrder: string[];
  chapter: Chapter;
}

export interface Chapter {
  dir: string;
  slug: string;
  index: number;
  title: string;
  description: string;
  part: number;
  steps: Step[];
}

export interface Course {
  title: string;
  reactVersion: string;
  chapters: Chapter[];
}

// Vite собирает content/ в бандл на этапе сборки
const raw: Record<string, string> = import.meta.glob<string>('/content/**/*', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const stripOrder = (dir: string) => dir.replace(/^\d+-/, '');

function readJson<T>(path: string): T {
  const text = raw[path];
  if (text === undefined) throw new Error(`[content] не найден файл ${path}`);
  return JSON.parse(text) as T;
}

function parseLesson(path: string): { meta: StepMeta; body: string } {
  const text = raw[path];
  if (text === undefined) throw new Error(`[content] не найден файл ${path}`);
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`[content] нет frontmatter в ${path}`);
  try {
    return { meta: parseYaml(match[1]) as StepMeta, body: match[2] };
  } catch (error) {
    throw new Error(`[content] ошибка YAML во frontmatter ${path}: ${(error as Error).message}`);
  }
}

function collectFiles(prefix: string): FileMap {
  const files: FileMap = {};
  for (const [path, text] of Object.entries(raw)) {
    if (path.startsWith(prefix)) files[path.slice(prefix.length)] = text;
  }
  return files;
}

const EXTENSION_ORDER = ['.tsx', '.ts', '.module.css', '.css'];
/** Первые вкладки корня шага: точка входа и корневой компонент */
const FIRST_FILES = ['main.tsx', 'App.tsx'];

/**
 * Порядок вкладок без `files` во frontmatter: main.tsx, App.tsx, затем файлы одного компонента рядом
 * (GameCard.tsx, GameCard.module.css), компоненты — по алфавиту путей, файлы корня шага — раньше подпапок
 */
function compareFiles(a: string, b: string) {
  const key = (file: string) => {
    const index = EXTENSION_ORDER.findIndex((extension) => file.endsWith(extension));
    const base = index === -1 ? file : file.slice(0, -EXTENSION_ORDER[index].length);
    const first = FIRST_FILES.indexOf(file);
    return [
      first === -1 ? FIRST_FILES.length : first,
      file.includes('/') ? 1 : 0,
      base,
      index === -1 ? EXTENSION_ORDER.length : index,
    ] as const;
  };
  const [ka, kb] = [key(a), key(b)];
  return ka[0] - kb[0] || ka[1] - kb[1] || ka[2].localeCompare(kb[2]) || ka[3] - kb[3];
}

function orderFiles(meta: StepMeta, files: FileMap): string[] {
  const names = Object.keys(files);
  const ordered = meta.files ? meta.files.filter((name) => name in files) : [...names].sort(compareFiles);
  for (const name of names) if (!ordered.includes(name)) ordered.push(name);
  // main.tsx — всегда первая вкладка
  return ordered.sort((a, b) => Number(b === 'main.tsx') - Number(a === 'main.tsx'));
}

function loadCourse(): Course {
  const courseJson = readJson<{ title: string; reactVersion: string; chapters: string[] }>('/content/course.json');
  // Результаты уже собранных шагов ('глава/шаг' → код): из них берётся base первого шага следующих глав
  const results = new Map<string, FileMap>();
  const resultOf = (ref: string): FileMap => {
    const files = results.get(ref);
    if (!files) throw new Error(`[content] base ${ref}: нет такого шага в предыдущих главах`);
    return files;
  };

  const loadChapter = (chapterDir: string, chapterIndex: number): Chapter => {
    const info = readJson<{ title: string; description: string; part: number }>(`/content/${chapterDir}/chapter.json`);
    const chapter: Chapter = {
      dir: chapterDir,
      slug: stripOrder(chapterDir),
      index: chapterIndex,
      title: info.title,
      description: info.description,
      part: info.part,
      steps: [],
    };

    const stepDirs = new Set<string>();
    const prefix = `/content/${chapterDir}/`;
    for (const path of Object.keys(raw)) {
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length).split('/');
      if (rest.length > 1) stepDirs.add(rest[0]);
    }

    // Шаг хранит только изменения: start/ — поверх результата предыдущего шага (startFrom: custom; у первого
    // шага главы — поверх base из прошлой главы), solution/ — поверх старта. Полный код собирает
    // shared/step-chain.js (тот же модуль, что у валидатора)
    const lessons = [...stepDirs].sort().map((stepDir) => {
      const base = `${prefix}${stepDir}/`;
      return {
        stepDir,
        ...parseLesson(`${base}lesson.md`),
        own: { start: collectFiles(`${base}start/`), solution: collectFiles(`${base}solution/`) },
      };
    });
    const resolved = resolveChapter(
      lessons.map(({ meta, own }) => ({ meta, ...own })),
      resultOf,
    );
    lessons.forEach(({ stepDir, meta }, index) =>
      results.set(`${chapterDir}/${stepDir}`, stepResult(meta, resolved[index])),
    );
    chapter.steps = lessons.map(({ stepDir, meta, body }, index): Step => {
      const { start, solution } = resolved[index];
      return {
        id: `${chapter.slug}/${stripOrder(stepDir)}`,
        dir: `${chapterDir}/${stepDir}`,
        slug: stripOrder(stepDir),
        index,
        meta,
        body,
        start,
        solution,
        fileOrder: orderFiles(meta, { ...solution, ...start }),
        chapter,
      };
    });

    return chapter;
  };

  const chapters = courseJson.chapters.map((dir, index) => loadChapter(dir, index));
  return { title: courseJson.title, reactVersion: courseJson.reactVersion, chapters };
}

export const course = loadCourse();

/** Все шаги курса подряд — для кнопок «Назад/Далее» через границы глав */
export const allSteps: Step[] = course.chapters.flatMap((chapter) => chapter.steps);

export function findStep(chapterSlug?: string, stepSlug?: string): Step | undefined {
  return allSteps.find((step) => step.chapter.slug === chapterSlug && step.slug === stepSlug);
}

/** Соседние шаги для «Назад / Далее» */
export function neighbours(step: Step): { prev?: Step; next?: Step } {
  const index = allSteps.indexOf(step);
  return { prev: allSteps[index - 1], next: allSteps[index + 1] };
}

export function stepPath(step: Step): string {
  return `/${step.chapter.slug}/${step.slug}`;
}

/** «02-templates/02-property-binding» → шаг; используется для ссылок `step:` в markdown */
export function findStepByDir(dir: string): Step | undefined {
  return allSteps.find((step) => step.dir === dir);
}
