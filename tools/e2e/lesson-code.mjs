// Сверка кода в тексте уроков с решением шага: строки из блоков ```tsx <файл> (и ts, css), которых нет
// в полном решении этого шага. Ловит типичную ошибку: Prettier перенёс строку в коде, а в тексте она целая.
// node tools/e2e/lesson-code.mjs <глава…>   (шаги noSolution пропускаются; строки с «…» не сверяются)
// Блоки экспериментов с намеренно изменённым кодом тоже попадут в список — их просто пропустите глазами.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { CONTENT, readDir } from './lib.mjs';

let problems = 0;
for (const chapter of process.argv.slice(2)) {
  const steps = readdirSync(`${CONTENT}/${chapter}`).filter((d) => existsSync(`${CONTENT}/${chapter}/${d}/lesson.md`));
  for (const step of steps.sort()) {
    const md = readFileSync(`${CONTENT}/${chapter}/${step}/lesson.md`, 'utf8');
    if (/^noSolution: true$/m.test(md)) continue;
    const files = readDir(`${CONTENT}/${chapter}/${step}/solution`);
    for (const [, name, code] of md.matchAll(/```(?:tsx|ts|css) ([\w/.-]+)[^\n]*\n([\s\S]*?)```/g)) {
      if (!files[name]) {
        console.log(`${chapter}/${step}: в решении нет файла ${name}`);
        problems++;
        continue;
      }
      const lines = new Set(files[name].split('\n').map((l) => l.trim()));
      for (const line of code.split('\n').map((l) => l.trim())) {
        if (!line || line.includes('…') || lines.has(line)) continue;
        console.log(`${chapter}/${step} ${name}: «${line}»`);
        problems++;
      }
    }
  }
}
console.log(problems ? `\nРасхождений: ${problems}` : 'Код в тексте совпадает с решениями');
