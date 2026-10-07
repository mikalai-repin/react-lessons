// Проверка контента курса: структура шагов, цепочка start/solution (шаг хранит только изменения — см.
// shared/step-chain.js) и сборка кода шага тем же модулем, что и превью (ловит синтаксические ошибки).
// Импорты относительных файлов, которых нет, и неверный регистр имён ловит tsc. Полный код каждого старта и решения выгружает в .content-check/ — там типы проверяет
// `tsc -p .content-check/tsconfig.json` (второй шаг npm run validate).
import { copyFileSync, existsSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { parse as parseYaml } from 'yaml';
import { compileFiles } from '../shared/compile-core.js';
import { filesHash, readResult, resolveChapterDir, writeFiles } from './step-files.mjs';

const root = join(import.meta.dirname, '..', 'content');
const checkDir = join(import.meta.dirname, '..', '.content-check');
const errors = [];
const warnings = [];

const isDir = (path) => existsSync(path) && statSync(path).isDirectory();

const course = JSON.parse(readFileSync(join(root, 'course.json'), 'utf8'));
let stepCount = 0;
rmSync(checkDir, { recursive: true, force: true });

// Файлы оверлея, совпадающие с базой (копии), и удаления, которых в базе нет
function checkOverlay(where, kind, base, own, removed = []) {
  for (const name of Object.keys(own)) {
    if (base[name] === own[name])
      errors.push(`${where}/${kind}/${name}: совпадает с тем, что было до шага, — копия, удалите её`);
  }
  for (const name of removed) {
    if (!(name in base))
      errors.push(`${where}: removedIn${kind === 'start' ? 'Start' : 'Solution'}: файла ${name} и так нет`);
    if (name in own) errors.push(`${where}: ${name} и удалён, и лежит в ${kind}/`);
  }
}

for (const [chapterIndex, chapterDir] of course.chapters.entries()) {
  const chapterPath = join(root, chapterDir);
  if (!existsSync(join(chapterPath, 'chapter.json'))) {
    errors.push(`${chapterDir}: нет chapter.json`);
    continue;
  }

  const steps = resolveChapterDir(chapterPath);
  let previousResult = {};
  for (const [index, step] of steps.entries()) {
    stepCount++;
    const stepDir = step.path.split('/').at(-1);
    const where = `${chapterDir}/${stepDir}`;
    if (!/^\d{2}-[a-z0-9-]+$/.test(stepDir)) errors.push(`${where}: имя папки должно быть вида NN-slug`);

    const lessonPath = join(step.path, 'lesson.md');
    let meta = {};
    if (!existsSync(lessonPath)) {
      errors.push(`${where}: нет lesson.md`);
    } else {
      const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(lessonPath, 'utf8'));
      if (!match) errors.push(`${where}: нет frontmatter`);
      else {
        try {
          meta = parseYaml(match[1]) ?? {};
        } catch (error) {
          errors.push(`${where}: ошибка YAML во frontmatter: ${error.message.split('\n')[0]}`);
        }
      }
      if (!meta.title) errors.push(`${where}: во frontmatter нет title`);
    }

    const startFrom = meta.startFrom ?? 'previous';
    const { own, start, solution } = step;
    // База первого шага главы — результат шага прошлой главы (base) с хешем (baseHash)
    if (meta.base !== undefined || meta.baseHash !== undefined) {
      const baseChapter = String(meta.base ?? '').split('/')[0];
      if (index !== 0) errors.push(`${where}: base и baseHash бывают только у первого шага главы`);
      else if (!meta.base || !meta.baseHash) errors.push(`${where}: нужны оба поля — base и baseHash`);
      else if (course.chapters.indexOf(baseChapter) < 0 || course.chapters.indexOf(baseChapter) >= chapterIndex) {
        errors.push(`${where}: base ${meta.base} — не шаг одной из предыдущих глав курса`);
      } else if (!isDir(join(root, meta.base))) {
        errors.push(`${where}: base ${meta.base} — нет такого шага`);
      } else {
        previousResult = readResult(join(root, meta.base));
        const actual = filesHash(previousResult);
        if (String(meta.baseHash) !== actual) {
          errors.push(
            `${where}: база ${meta.base} изменилась (baseHash ${meta.baseHash}, сейчас ${actual}) — ` +
              `проверьте, что изменения подходят главе: npm run chapter sync-base ${chapterDir}, затем export`,
          );
        }
      }
    }
    if (startFrom === 'previous') {
      if (index === 0) errors.push(`${where}: первый шаг главы должен иметь startFrom: custom`);
      if (isDir(join(step.path, 'start')))
        errors.push(`${where}: startFrom: previous, но есть папка start/ — нужен startFrom: custom (или удалите её)`);
      if (meta.removedInStart) errors.push(`${where}: removedInStart бывает только у startFrom: custom`);
    } else {
      checkOverlay(where, 'start', previousResult, own.start, meta.removedInStart);
      if (index > 0 && !Object.keys(own.start).length && !meta.removedInStart?.length) {
        errors.push(
          `${where}: startFrom: custom, но старт ничем не отличается от результата предыдущего шага — нужен startFrom: previous`,
        );
      }
    }
    if (meta.noSolution) {
      if (Object.keys(own.solution).length) errors.push(`${where}: noSolution: true, но папка solution/ не пуста`);
      if (meta.removedInSolution) errors.push(`${where}: noSolution: true, но есть removedInSolution`);
    } else {
      checkOverlay(where, 'solution', start, own.solution, meta.removedInSolution);
      if (!Object.keys(own.solution).length && !meta.removedInSolution?.length) {
        errors.push(`${where}: решение не отличается от старта — нужен noSolution: true или файлы в solution/`);
      }
      if (!solution['main.tsx']) errors.push(`${where}: в решении нет main.tsx`);
    }
    if (!start['main.tsx']) errors.push(`${where}: в старте нет main.tsx`);

    // Старт со startFrom: previous — результат предыдущего шага, он уже проверен
    for (const [kind, files] of [
      ['start', startFrom === 'custom' ? start : {}],
      ['solution', solution],
    ]) {
      if (!Object.keys(files).length) continue;
      // brokenStart: стартовый код намеренно содержит ошибки (шаг про отладку) — не собираем и не проверяем типы
      if (kind === 'start' && meta.brokenStart) continue;
      const { errors: buildErrors } = compileFiles(ts, files);
      for (const error of buildErrors) errors.push(`${where}/${kind}: ${error}`);
      writeFiles(join(checkDir, chapterDir, stepDir, kind), files);
    }
    previousResult = meta.noSolution ? start : solution;
  }
}

// Проверка типов полного кода шагов: настройки — из tsconfig.content.json
writeFileSync(
  join(checkDir, 'tsconfig.json'),
  JSON.stringify({ extends: '../tsconfig.content.json', include: ['**/*.ts', '**/*.tsx'] }, null, 2) + '\n',
);
// Импорт стилей — как vite/client в настоящем проекте
copyFileSync(join(import.meta.dirname, '..', 'shared', 'course-env.d.ts'), join(checkDir, 'env.d.ts'));

for (const warning of warnings) console.warn(`⚠ ${warning}`);
for (const error of errors) console.error(`✗ ${error}`);
console.log(`Проверено шагов: ${stepCount}. Ошибок: ${errors.length}, предупреждений: ${warnings.length}.`);
process.exit(errors.length ? 1 : 0);
