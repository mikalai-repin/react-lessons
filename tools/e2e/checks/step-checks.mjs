// Проверки шагов (content/<глава>/<шаг>/check.ts) в настоящем интерфейсе платформы: у каждого шага с check.ts
// «✓ Проверить» на стартовом коде — «не пройдено» с подсказкой, после «Решение» — «пройдено» и шаг отмечен;
// на решении с типичной ошибкой (MISTAKES) — «не пройдено» с подсказкой именно про неё.
// node tools/e2e/checks/step-checks.mjs [глава…] (нужен npm run dev; без аргументов — все главы курса)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { BASE_URL, CONTENT, launch, OUT, readDir, wait } from '../lib.mjs';

const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};
const strip = (dir) => dir.replace(/^\d+-/, '');

const course = JSON.parse(readFileSync(`${CONTENT}/course.json`, 'utf8'));
const chapters = process.argv.length > 2 ? process.argv.slice(2) : course.chapters;
const steps = chapters.flatMap((chapter) =>
  readdirSync(`${CONTENT}/${chapter}`)
    .filter((d) => statSync(`${CONTENT}/${chapter}/${d}`).isDirectory())
    .filter((d) => existsSync(`${CONTENT}/${chapter}/${d}/check.ts`))
    .sort()
    .map((d) => ({ chapter, step: d, route: `${strip(chapter)}/${strip(d)}` })),
);
console.log(`Шагов с check.ts: ${steps.length}`);

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('dialog', (d) => d.accept());
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

// Нажать «✓ Проверить» и дождаться результата: { passed, text }
async function runCheck() {
  await page.click('.check-button');
  await page.waitForSelector('.check-result', { timeout: 40_000 });
  return page.$eval('.check-result', (e) => ({ passed: e.classList.contains('passed'), text: e.textContent.trim() }));
}

await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
for (const { chapter, step, route } of steps) {
  // Чистый прогресс: стартовый код шага, без сохранённых корзин и избранного прошлых шагов
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/${route}`, { waitUntil: 'networkidle0' });
  await wait(2500);
  const start = await runCheck();
  expect(
    !start.passed && start.text.length > 20 && !start.text.includes('не смогла пройти'),
    `${chapter}/${step} старт: не пройдено с подсказкой — «${start.text.slice(0, 160)}»`,
  );
  await page.click('.check-result .icon-button');
  const solution = await page.$('.lesson-footer-middle .button');
  await solution.click();
  await wait(3000);
  const done = await runCheck();
  await page.screenshot({ path: `${OUT}/check-${chapter}-${step}.png` });
  const marked = await page.evaluate((id) => {
    const state = JSON.parse(localStorage.getItem('react-course:v1') ?? '{}');
    return Boolean(state.steps?.[id]?.done);
  }, route);
  expect(done.passed && marked, `${chapter}/${step} решение: пройдено, шаг отмечен — «${done.text.slice(0, 160)}»`);
}

// Типичные ошибки: решение с одной поломкой — проверка не проходит и подсказывает, куда смотреть.
// Код подкладывается в сохранённый прогресс, как его сохранил бы редактор
const MISTAKES = [
  {
    dir: '02-jsx/08-practice',
    file: 'App.tsx',
    from: '{discount > 0 && (',
    to: '{discount && (',
    hint: 'рисует 0',
  },
  {
    dir: '03-components/08-practice',
    file: 'shared/Rating.tsx',
    from: 'Math.round(value)',
    to: 'Math.floor(value)',
    hint: 'Math.round',
  },
  {
    dir: '04-state/09-practice',
    file: 'App.tsx',
    from: '.filter((item) => item.quantity > 0)',
    to: '',
    hint: 'позиция должна исчезнуть',
  },
  {
    dir: '06-effects/11-practice',
    file: 'App.tsx',
    from: '    setLimit(PAGE_SIZE);\n',
    to: '',
    hint: 'первая порция',
  },
  {
    dir: '08-context/08-practice',
    file: 'favorites/FavoritesProvider.tsx',
    from: 'ids.includes(gameId)',
    to: 'false',
    hint: 'Повторный щелчок',
  },
].filter((m) => chapters.includes(m.dir.split('/')[0]));

for (const mistake of MISTAKES) {
  const [chapter, step] = mistake.dir.split('/');
  const route = `${strip(chapter)}/${strip(step)}`;
  const files = readDir(`${CONTENT}/${mistake.dir}/solution`);
  if (!files[mistake.file].includes(mistake.from)) throw new Error(`${mistake.dir}: нет «${mistake.from}»`);
  files[mistake.file] = files[mistake.file].replace(mistake.from, mistake.to);
  await page.evaluate(
    (route, code) => {
      localStorage.clear();
      localStorage.setItem('react-course:v1', JSON.stringify({ steps: { [route]: { code } } }));
    },
    route,
    files,
  );
  await page.goto(`${BASE_URL}/${route}`, { waitUntil: 'networkidle0' });
  await wait(2500);
  const result = await runCheck();
  expect(
    !result.passed && result.text.includes(mistake.hint),
    `${mistake.dir} ошибка «${mistake.to || 'удалено: ' + mistake.from.trim()}»: подсказка про «${mistake.hint}» — «${result.text.slice(0, 160)}»`,
  );
}

expect(pageErrors.length === 0, `ошибок страницы нет ${JSON.stringify(pageErrors)}`);
await browser.close();
if (failures.length) {
  console.log(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло');
