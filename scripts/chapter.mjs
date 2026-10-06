// Глава как ветка git: код шагов пишется обычными файлами, один коммит — один шаг; `export` раскладывает коммиты
// в content/<глава>/<шаг>/{start,solution} (только изменения — формат shared/step-chain.js). Подробно —
// docs/authoring-process.md, «Код шагов: глава — ветка git».
//
//   npm run chapter new 02-jsx -- --title "JSX и разметка" --description "…"   ветка chapter/02-jsx + authoring/02-jsx
//   npm run chapter open 02-jsx         рабочая папка authoring/02-jsx для уже существующей ветки (после клонирования)
//   npm run chapter status 02-jsx       коммиты главы → шаги
//   npm run chapter export 02-jsx       коммиты → content/02-jsx (start/, solution/, frontmatter, lesson.md-заготовки)
//   npm run chapter export all          все главы курса по порядку (например, после изменения shared/lesson-prettier.json)
//   npm run chapter fix 02-jsx 03-lists [-- --start]   изменения в рабочей папке → в коммит шага 03-lists
//   npm run chapter sync-base 02-jsx    прошлая глава изменилась: новая база главы, коммиты шагов — поверх неё
//
// Коммиты ветки chapter/<глава>:
//   base: 01-first-app/07-practice     первый коммит — код, с которого глава начинается (результат шага прошлой главы;
//                                       у главы 1 — «base» без ссылки и пустой);
//   03-lists start: Списки             (необязательно) закадровая подготовка — свой старт шага (startFrom: custom);
//   03-lists: Списки                   решение шага. Метки @todo … @end в нём (scripts/todo-markers.mjs) дают старт
//                                       с заготовкой TODO — тогда отдельный коммит «start» не нужен.
// Шаг только с коммитом «start» — шаг без решения (noSolution: теория, демо).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import * as prettier from 'prettier';
import { filesHash, readResult, writeFiles } from './step-files.mjs';
import { markerKeys, toSolution, toStart } from './todo-markers.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const CONTENT = join(ROOT, 'content');
const AUTHORING = join(ROOT, 'authoring');
const LESSON_PRETTIER = JSON.parse(readFileSync(join(ROOT, 'shared/lesson-prettier.json'), 'utf8'));

class UserError extends Error {}
const fail = (message) => {
  throw new UserError(message);
};

// ---------- git ----------

function git(args, { cwd = ROOT, input, env } = {}) {
  return execFileSync('git', args, {
    cwd,
    input,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  }).replace(/\n$/, '');
}

const branchOf = (chapter) => `chapter/${chapter}`;
const worktreeOf = (chapter) => join(AUTHORING, chapter);
const branchExists = (chapter) => {
  try {
    git(['rev-parse', '--verify', '--quiet', `refs/heads/${branchOf(chapter)}`]);
    return true;
  } catch {
    return false;
  }
};

/** Файлы дерева коммита: путь → текст. Скрытые файлы (.gitkeep и т. п.) не входят в шаг */
const treeCache = new Map();
function readTree(commit) {
  if (treeCache.has(commit)) return treeCache.get(commit);
  const files = {};
  const listing = git(['ls-tree', '-r', '-z', commit]);
  const entries = listing ? listing.split('\0').filter(Boolean) : [];
  const blobs = entries
    .map((entry) => {
      const [info, path] = entry.split('\t');
      return { sha: info.split(' ')[2], path };
    })
    .filter(({ path }) => !path.split('/').some((part) => part.startsWith('.')));
  if (blobs.length) {
    // Все файлы одним вызовом: git cat-file --batch отдаёт «<sha> blob <размер>\n<содержимое>\n» подряд
    const out = execFileSync('git', ['cat-file', '--batch'], {
      cwd: ROOT,
      input: blobs.map((b) => b.sha).join('\n') + '\n',
      maxBuffer: 64 * 1024 * 1024,
    });
    let offset = 0;
    for (const { path } of blobs) {
      const headerEnd = out.indexOf(10, offset);
      const size = Number(out.subarray(offset, headerEnd).toString().split(' ')[2]);
      files[path] = out.subarray(headerEnd + 1, headerEnd + 1 + size).toString('utf8');
      offset = headerEnd + 1 + size + 1;
    }
  }
  treeCache.set(commit, files);
  return files;
}

/** Коммит из набора файлов (без рабочей папки): дерево собирается git hash-object + mktree */
function commitFiles(files, message, parent) {
  const makeTree = (entries) => {
    const lines = [];
    const dirs = new Map();
    for (const [path, text] of entries) {
      const slash = path.indexOf('/');
      if (slash === -1) {
        const sha = git(['hash-object', '-w', '--stdin'], { input: text });
        lines.push(`100644 blob ${sha}\t${path}`);
      } else {
        const dir = path.slice(0, slash);
        if (!dirs.has(dir)) dirs.set(dir, []);
        dirs.get(dir).push([path.slice(slash + 1), text]);
      }
    }
    for (const [dir, children] of dirs) lines.push(`040000 tree ${makeTree(children)}\t${dir}`);
    return git(['mktree'], { input: lines.join('\n') + (lines.length ? '\n' : '') });
  };
  const tree = makeTree(Object.entries(files));
  return git(['commit-tree', tree, ...(parent ? ['-p', parent] : []), '-m', message]);
}

// ---------- курс ----------

const stepFolders = (dir) =>
  existsSync(dir)
    ? readdirSync(dir)
        .filter((name) => /^\d{2}-/.test(name))
        .sort()
    : [];
const readCourse = () => JSON.parse(readFileSync(join(CONTENT, 'course.json'), 'utf8'));

function checkChapterName(chapter) {
  if (!/^\d{2}-[a-z0-9-]+$/.test(chapter ?? '')) fail(`Имя главы — вида NN-slug (02-jsx), а не «${chapter ?? ''}»`);
}

/** База главы: результат последнего шага предыдущей главы курса (у первой главы — пусто) */
function baseOf(chapter) {
  const chapters = readCourse().chapters;
  const index = chapters.includes(chapter) ? chapters.indexOf(chapter) : chapters.length;
  if (index === 0) return { ref: null, files: {} };
  const previous = chapters[index - 1];
  const steps = stepFolders(join(CONTENT, previous));
  if (!steps.length) fail(`В главе ${previous} нет шагов — базу брать неоткуда`);
  const ref = `${previous}/${steps.at(-1)}`;
  return { ref, files: readResult(join(CONTENT, ref)) };
}

function ensureAuthoringConfig() {
  mkdirSync(AUTHORING, { recursive: true });
  // Проверка типов и подсказки в IDE для кода рабочих папок — с теми же настройками, что у кода уроков
  writeFileSync(
    join(AUTHORING, 'tsconfig.json'),
    JSON.stringify(
      {
        extends: '../tsconfig.content.json',
        include: ['*/**/*.ts', '*/**/*.tsx', '../shared/course-env.d.ts'],
      },
      null,
      2,
    ) + '\n',
  );
}

// ---------- коммиты → шаги ----------

const SUBJECT = /^(\d{2}-[a-z0-9-]+)( start)?: (.+)$/;

/** Шаги главы из коммитов ветки: [{ slug, title, start?: commit, solution?: commit }] */
function readSteps(chapter) {
  if (!branchExists(chapter)) fail(`Нет ветки ${branchOf(chapter)}: создайте главу — npm run chapter new ${chapter}`);
  const log = git(['log', '--reverse', '--format=%H%x00%s', branchOf(chapter)]);
  const commits = log.split('\n').map((line) => {
    const [sha, subject] = line.split('\0');
    return { sha, subject };
  });
  const [baseCommit, ...rest] = commits;
  const baseMatch = /^base(?::\s*(\S+))?$/.exec(baseCommit.subject);
  if (!baseMatch) fail(`Первый коммит ${branchOf(chapter)} должен называться «base» или «base: <глава>/<шаг>»`);

  const steps = [];
  for (const { sha, subject } of rest) {
    if (/^(fixup|squash|amend)! /.test(subject)) {
      fail(`Не применена правка «${subject}»: npm run chapter fix делает это сам, или git rebase --autosquash`);
    }
    const match = SUBJECT.exec(subject);
    if (!match) fail(`Коммит ${sha.slice(0, 7)} «${subject}»: нужно «NN-slug: Название» или «NN-slug start: Название»`);
    const [, slug, isStart, title] = match;
    let step = steps.at(-1);
    if (step?.slug !== slug) {
      if (steps.some((s) => s.slug === slug)) fail(`Шаг ${slug}: коммиты шага должны идти подряд`);
      if (step && slug <= step.slug) fail(`Шаг ${slug} идёт после ${step.slug}: номера шагов должны расти`);
      step = { slug, title };
      steps.push(step);
    }
    const kind = isStart ? 'start' : 'solution';
    if (step[kind])
      fail(`Шаг ${slug}: два коммита «${kind}» — объедините их (git commit --amend или npm run chapter fix)`);
    if (kind === 'start' && step.solution) fail(`Шаг ${slug}: коммит «start» должен идти до решения`);
    step[kind] = sha;
    step.title = title;
  }
  return { base: { sha: baseCommit.sha, ref: baseMatch[1] ?? null }, steps };
}

/** JSON в том виде, в каком его оставит Prettier (иначе npx prettier --check . упадёт после new) */
async function writeJson(path, value) {
  writeFileSync(path, await prettier.format(JSON.stringify(value), { parser: 'json' }));
}

async function format(files) {
  const result = {};
  for (const [file, code] of Object.entries(files)) {
    try {
      result[file] = /\.(tsx?|css)$/.test(file)
        ? await prettier.format(code, { ...LESSON_PRETTIER, filepath: file })
        : code;
    } catch {
      result[file] = code; // намеренно сломанный код (шаг про отладку) Prettier не разберёт — оставляем как есть
    }
  }
  return result;
}

const mapFiles = (files, fn) => Object.fromEntries(Object.entries(files).map(([file, code]) => [file, fn(code, file)]));

/** Полный код старта и решения каждого шага (до форматирования) */
function buildSteps({ base, steps }) {
  let previousCommit = base.sha;
  let previousResult = mapFiles(readTree(base.sha), toSolution);
  return steps.map((step) => {
    let start;
    let custom = false;
    let todos = 0;
    if (step.start) {
      start = mapFiles(readTree(step.start), toSolution);
      // Пустой коммит «start» (git commit --allow-empty) — шаг без решения, который начинается с прошлого
      // результата («Под капотом»): это не свой старт
      custom = filesHash(start) !== filesHash(previousResult);
      previousCommit = step.start;
    }
    let solution = null;
    if (step.solution) {
      const tree = readTree(step.solution);
      const parent = readTree(previousCommit);
      solution = mapFiles(tree, toSolution);
      if (!step.start) {
        // Новые метки @todo шага → старт с заготовками; без новых меток старт — результат предыдущего шага
        const derived = {};
        for (const [file, code] of Object.entries(tree)) {
          const converted = toStart(code, file, file in parent ? markerKeys(parent[file], file) : new Set());
          derived[file] = converted.code;
          todos += converted.todos;
        }
        if (todos > 0) {
          start = derived;
          custom = true;
        }
      }
      previousCommit = step.solution;
    }
    start ??= previousResult;
    previousResult = solution ?? start;
    return { ...step, start, solution, custom, todos };
  });
}

// ---------- frontmatter lesson.md ----------

const MANAGED = ['startFrom', 'noSolution', 'base', 'baseHash', 'removedInStart', 'removedInSolution'];

/** Поля, которыми управляет export: остальное во frontmatter (title, files, focus, api, url, …) — дело автора */
function updateLesson(stepDir, title, values) {
  const path = join(stepDir, 'lesson.md');
  if (!existsSync(path)) {
    // YAML: «Под капотом: JSX» без кавычек — ошибка разбора (двоеточие), поэтому такие заголовки — в кавычках
    const yamlTitle = /[:#@{}[\]'",&*!|>%`]/.test(title) ? `'${title.replace(/'/g, "''")}'` : title;
    writeFileSync(path, `---\ntitle: ${yamlTitle}\n---\n\n::: warning\nЧерновик: текст шага ещё не написан.\n:::\n`);
  }
  const text = readFileSync(path, 'utf8');
  const match = /^---\n([\s\S]*?)\n---/.exec(text);
  if (!match) fail(`${relative(ROOT, path)}: нет frontmatter`);
  const lines = match[1].split('\n').filter((line) => !MANAGED.some((key) => line.startsWith(`${key}:`)));
  const at = lines.findIndex((line) => line.startsWith('title:')) + 1;
  const added = Object.entries(values)
    .filter(([, value]) => value !== undefined && !(Array.isArray(value) && !value.length))
    .map(([key, value]) => `${key}: ${Array.isArray(value) ? `[${value.join(', ')}]` : value}`);
  lines.splice(at, 0, ...added);
  writeFileSync(path, `---\n${lines.join('\n')}\n---${text.slice(match[0].length)}`);
}

// ---------- команды ----------

const commands = {
  async new(chapter, options) {
    checkChapterName(chapter);
    if (branchExists(chapter)) fail(`Ветка ${branchOf(chapter)} уже есть: npm run chapter open ${chapter}`);
    const { ref, files } = baseOf(chapter);
    const sha = commitFiles(files, ref ? `base: ${ref}` : 'base');
    git(['branch', branchOf(chapter), sha]);
    commands.open(chapter);

    const chapterDir = join(CONTENT, chapter);
    mkdirSync(chapterDir, { recursive: true });
    if (!existsSync(join(chapterDir, 'chapter.json'))) {
      const part = Number(chapter.slice(0, 2)) <= 8 ? 1 : Number(chapter.slice(0, 2)) <= 20 ? 2 : 3;
      await writeJson(join(chapterDir, 'chapter.json'), {
        title: options.title ?? chapter,
        description: options.description ?? '',
        part,
      });
    }
    const course = readCourse();
    if (!course.chapters.includes(chapter)) {
      course.chapters.push(chapter);
      await writeJson(join(CONTENT, 'course.json'), course);
    }
    console.log(
      `Глава ${chapter}: ветка ${branchOf(chapter)} (база: ${ref ?? 'пусто'}), рабочая папка authoring/${chapter}`,
    );
    console.log('Дальше: пишите код шага в рабочей папке и делайте коммит «NN-slug: Название» на каждый шаг.');
  },

  open(chapter) {
    checkChapterName(chapter);
    ensureAuthoringConfig();
    const dir = worktreeOf(chapter);
    if (existsSync(dir)) return console.log(`Рабочая папка уже есть: authoring/${chapter}`);
    git(['worktree', 'add', dir, branchOf(chapter)]);
    console.log(`Рабочая папка: authoring/${chapter} (ветка ${branchOf(chapter)})`);
  },

  status(chapter) {
    checkChapterName(chapter);
    const parsed = readSteps(chapter);
    const built = buildSteps(parsed);
    console.log(`base ${parsed.base.ref ?? '(пусто)'}`);
    for (const step of built) {
      const kind = !step.solution
        ? 'без решения'
        : step.custom
          ? step.todos
            ? `заготовка: ${step.todos} TODO`
            : 'свой старт'
          : 'старт = прошлый шаг';
      console.log(`${step.slug.padEnd(28)} ${kind.padEnd(22)} ${step.title}`);
    }
  },

  async export(chapter) {
    if (chapter === 'all') {
      for (const name of readCourse().chapters) {
        if (branchExists(name)) await commands.export(name);
        else console.warn(`⚠ ${name}: нет ветки ${branchOf(name)} — глава пропущена`);
      }
      return;
    }
    checkChapterName(chapter);
    const parsed = readSteps(chapter);
    const built = buildSteps(parsed);
    const chapterDir = join(CONTENT, chapter);
    if (!existsSync(join(chapterDir, 'chapter.json')))
      fail(`Нет ${chapter}/chapter.json: npm run chapter new ${chapter}`);

    // База из content/: то, что глава получает от прошлой. Если она не совпадает с коммитом base — прошлая глава
    // изменилась после создания ветки: сначала npm run chapter sync-base
    const base = parsed.base.ref ? readResult(join(CONTENT, parsed.base.ref)) : {};
    const baseTree = mapFiles(readTree(parsed.base.sha), toSolution);
    if (filesHash(await format(base)) !== filesHash(await format(baseTree))) {
      fail(`База ${parsed.base.ref} в content/ изменилась после создания ветки: npm run chapter sync-base ${chapter}`);
    }

    let previous = await format(base);
    for (const [index, step] of built.entries()) {
      const start = await format(step.start);
      const solution = step.solution ? await format(step.solution) : null;
      const stepDir = join(chapterDir, step.slug);
      mkdirSync(stepDir, { recursive: true });
      const own = (files, against) => Object.fromEntries(Object.entries(files).filter(([n, c]) => against[n] !== c));
      // Первый шаг главы всегда custom: его старт — база (у главы 1 — полный снимок)
      const custom = step.custom || index === 0;
      writeFiles(join(stepDir, 'start'), custom ? own(start, previous) : {});
      writeFiles(join(stepDir, 'solution'), solution ? own(solution, start) : {});
      updateLesson(stepDir, step.title, {
        startFrom: custom ? 'custom' : undefined,
        noSolution: solution ? undefined : 'true',
        base: index === 0 && parsed.base.ref ? parsed.base.ref : undefined,
        baseHash: index === 0 && parsed.base.ref ? `'${filesHash(previous)}'` : undefined,
        removedInStart: custom
          ? Object.keys(previous)
              .filter((n) => !(n in start))
              .sort()
          : [],
        removedInSolution: solution
          ? Object.keys(start)
              .filter((n) => !(n in solution))
              .sort()
          : [],
      });
      // Пустые папки start/ и solution/ не нужны (writeFiles создаёт папку, только если есть файлы)
      previous = solution ?? start;
    }

    const known = new Set(built.map((s) => s.slug));
    const extra = stepFolders(chapterDir).filter((name) => !known.has(name));
    for (const name of extra)
      console.warn(`⚠ content/${chapter}/${name}: такого шага нет в ветке — удалите папку, если шаг убран`);
    console.log(`${chapter}: ${built.length} шагов → content/${chapter}. Дальше: npm run validate`);
  },

  fix(chapter, options, slug) {
    checkChapterName(chapter);
    const dir = worktreeOf(chapter);
    if (!existsSync(dir)) fail(`Нет рабочей папки: npm run chapter open ${chapter}`);
    const { steps } = readSteps(chapter);
    const step = steps.find((s) => s.slug === slug);
    if (!step) fail(`В главе ${chapter} нет шага ${slug ?? '(не указан)'}: ${steps.map((s) => s.slug).join(', ')}`);
    const target = options.start ? step.start : step.solution;
    if (!target) fail(`У шага ${slug} нет коммита «${options.start ? 'start' : 'решение'}»`);
    git(['add', '-A'], { cwd: dir });
    if (!git(['diff', '--cached', '--name-only'], { cwd: dir })) fail('В рабочей папке нет изменений');
    git(['commit', '-q', `--fixup=${target}`], { cwd: dir });
    try {
      // Неинтерактивно: список правок не редактируем, --autosquash сам ставит правку за коммитом шага
      git(['rebase', '-q', '-i', '--autosquash', '--root'], {
        cwd: dir,
        env: { GIT_SEQUENCE_EDITOR: 'true', GIT_EDITOR: 'true' },
      });
    } catch (error) {
      fail(
        `Правка шага ${slug} конфликтует со следующими шагами. В authoring/${chapter}: исправьте файлы с конфликтом, ` +
          `git add -A, GIT_EDITOR=true git rebase --continue (или git rebase --abort).\n${error.stderr ?? ''}`,
      );
    }
    console.log(`Правка внесена в шаг ${slug} и в следующие шаги. Дальше: npm run chapter export ${chapter}`);
  },

  sync_base(chapter) {
    checkChapterName(chapter);
    const dir = worktreeOf(chapter);
    if (!existsSync(dir)) fail(`Нет рабочей папки: npm run chapter open ${chapter}`);
    if (git(['status', '--porcelain'], { cwd: dir })) fail(`В authoring/${chapter} есть незакоммиченные изменения`);
    const { base } = readSteps(chapter);
    const { ref, files } = baseOf(chapter);
    const fresh = commitFiles(files, ref ? `base: ${ref}` : 'base');
    if (git(['rev-parse', `${fresh}^{tree}`]) === git(['rev-parse', `${base.sha}^{tree}`]) && ref === base.ref) {
      return console.log('База не изменилась');
    }
    try {
      git(['rebase', '-q', '--onto', fresh, base.sha], { cwd: dir, env: { GIT_EDITOR: 'true' } });
    } catch (error) {
      fail(
        `Изменения базы конфликтуют с шагами. В authoring/${chapter}: исправьте файлы с конфликтом, git add -A, ` +
          `GIT_EDITOR=true git rebase --continue (или git rebase --abort).\n${error.stderr ?? ''}`,
      );
    }
    console.log(`База обновлена (${ref ?? 'пусто'}), шаги перенесены. Дальше: npm run chapter export ${chapter}`);
  },
};

// ---------- запуск ----------

const [command, chapter, ...rest] = process.argv.slice(2);
const options = {};
const positional = [];
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) {
    const key = rest[i].slice(2);
    options[key] = rest[i + 1] && !rest[i + 1].startsWith('--') ? rest[++i] : true;
  } else positional.push(rest[i]);
}
const handler = commands[(command ?? '').replace('-', '_')];
if (!handler) {
  console.error('Команды: new | open | status | export | fix | sync-base — см. начало scripts/chapter.mjs');
  process.exit(1);
}
try {
  await handler(chapter, options, ...positional);
} catch (error) {
  if (error instanceof UserError) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
