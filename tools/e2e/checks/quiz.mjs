// Проверка квиза главы (src/quiz/QuizPage.tsx): «Квиз →» с последнего шага, перемешивание вопросов и вариантов,
// разбор ответа, несданная и сданная попытки (≥ 85 %), лучший результат в прогрессе, ✓ в оглавлении,
// переход к следующей главе, квиз главы 2 и узкий экран. node tools/e2e/checks/quiz.mjs (нужен npm run dev)
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { BASE_URL, CONTENT, launch, OUT, wait } from '../lib.mjs';

const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

const STORAGE_KEY = 'react-course:v1';
const quiz1 = parseYaml(readFileSync(`${CONTENT}/01-first-app/quiz.yaml`, 'utf8')).questions;
const quiz2 = parseYaml(readFileSync(`${CONTENT}/02-jsx/quiz.yaml`, 'utf8')).questions;
const passScore = Math.ceil(quiz1.length * 0.85);

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 900 });
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

const text = (selector) => page.$eval(selector, (el) => el.textContent.replace(/\s+/g, ' ').trim());
const clickButton = async (label) => {
  const button = await page.evaluateHandle(
    (label) => [...document.querySelectorAll('button, a.button')].find((b) => b.textContent.includes(label)),
    label,
  );
  if (!button.asElement()) throw new Error(`нет кнопки «${label}»`);
  await button.click();
};

await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
await page.evaluate(() => localStorage.clear());

// Последний шаг главы 1: «Далее» превратилось в «Квиз →» и ведёт на квиз
await page.goto(`${BASE_URL}/first-app/jsx`, { waitUntil: 'networkidle0' });
await wait(1500);
const nextLabel = await text('.lesson-footer .button.primary');
expect(nextLabel === 'Квиз →', `кнопка последнего шага — «${nextLabel}»`);
await page.click('.lesson-footer .button.primary');
await page.waitForSelector('.quiz-card h1');
expect(page.url().endsWith('/first-app/quiz'), `переход на квиз: ${page.url()}`);
const intro = await text('.quiz-card');
expect(
  intro.includes(`${quiz1.length} вопросов`) && intro.includes(`${passScore} из ${quiz1.length}`),
  `вступление: число вопросов и порог (${passScore} из ${quiz1.length})`,
);

/**
 * Одна попытка. choose(вопрос, варианты) → номер варианта на экране. Возвращает порядок вопросов,
 * а в known дописывает правильный вариант каждого вопроса (по подсветке после ответа)
 */
async function attempt(choose, known) {
  const order = [];
  for (let i = 0; i < quiz1.length; i++) {
    await page.waitForSelector('.quiz-question');
    const question = await text('.quiz-question');
    const options = await page.$$eval('.quiz-option', (els) => els.map((el) => el.textContent.trim()));
    order.push(question);
    const submit = await page.$eval('button[type=submit]', (b) => b.disabled);
    if (i === 0) expect(submit, '«Ответить» недоступна, пока вариант не выбран');
    const labels = await page.$$('.quiz-option');
    await labels[choose(question, options)].click();
    await page.click('button[type=submit]');
    await page.waitForSelector('.quiz-feedback');
    known.set(question, await page.$eval('.quiz-option.correct', (el) => el.textContent.trim()));
    if (i === 0) {
      const explained = await text('.quiz-feedback');
      expect(/^(Верно|Неверно)/.test(explained) && explained.length > 30, 'после ответа — «Верно/Неверно» и пояснение');
      const focused = await page.evaluate(() => document.activeElement?.textContent ?? '');
      expect(focused.includes('Следующий вопрос'), 'фокус — на «Следующий вопрос»: Enter ведёт дальше');
    }
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.quiz-score');
  return order;
}

// Попытка 1: всегда первый вариант на экране
await clickButton('Начать');
const known = new Map();
const firstOptions = [];
const order1 = await attempt((_, options) => {
  firstOptions.push(options);
  return 0;
}, known);
expect(
  firstOptions.filter((options, i) => options[0] === known.get(order1[i])).length < quiz1.length,
  'правильный вариант не всегда первый (варианты перемешаны)',
);
const score1 = await text('.quiz-score strong');
const correct1 = Number(score1.split(' ')[0]);
const title1 = await text('.quiz-card h1');
expect(correct1 >= passScore === (title1 === 'Глава пройдена'), `попытка 1: ${score1}, заголовок «${title1}»`);
const mistakes = await page.$$eval('.quiz-mistake', (els) => els.length);
expect(mistakes === quiz1.length - correct1, `разбор ошибок: ${mistakes} вопросов`);
if (mistakes) {
  const link = await page.$eval('.quiz-step-link', (a) => a.getAttribute('href'));
  expect(/^\/first-app\/[a-z-]+$/.test(link), `в разборе ссылка на шаг: ${link}`);
}
await page.screenshot({ path: `${OUT}/quiz-result.png`, fullPage: false });

// Попытка 2: все ответы правильные
await clickButton('Пройти ещё раз');
const order2 = await attempt((question, options) => options.indexOf(known.get(question)), known);
expect(order2.join('|') !== order1.join('|'), 'у новой попытки — новый порядок вопросов (перемешаны)');
expect((await text('.quiz-card h1')) === 'Глава пройдена', 'попытка 2: «Глава пройдена»');
expect((await text('.quiz-score strong')) === `${quiz1.length} из ${quiz1.length}`, 'попытка 2: все ответы верны');
const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).quizzes, STORAGE_KEY);
expect(
  saved?.['first-app']?.passed === true && saved['first-app'].correct === quiz1.length,
  `лучший результат в прогрессе: ${JSON.stringify(saved)}`,
);

// Оглавление: ✓ у главы и у квиза
await page.click('.toc summary');
await wait(300);
const toc = await page.$$eval('.toc-panel section', (sections) =>
  sections.map((s) => ({ h3: s.querySelector('h3').textContent, quiz: s.querySelector('.toc-quiz')?.textContent })),
);
expect(toc[0].h3.startsWith('✓') && toc[0].quiz === '✓Квиз по главе', `оглавление, глава 1: ${JSON.stringify(toc[0])}`);
expect(!toc[1].h3.startsWith('✓') && toc[1].quiz === 'Квиз по главе', `оглавление, глава 2: ${JSON.stringify(toc[1])}`);
await page.click('.toc summary');

// Перезагрузка: вступление показывает лучший результат
await page.reload({ waitUntil: 'networkidle0' });
await page.waitForSelector('.quiz-best');
expect((await text('.quiz-best')).includes('сдано ✓'), 'после перезагрузки — лучший результат «сдано ✓»');

// Несданная попытка не затирает сданную
await page.evaluate((key) => {
  const state = JSON.parse(localStorage.getItem(key));
  state.quizzes['jsx'] = { correct: 12, total: 14, passed: true };
  localStorage.setItem(key, JSON.stringify(state));
}, STORAGE_KEY);

// Квиз главы 2: все вопросы с кодом отрисованы подсветкой, у каждого вопроса 4 варианта
await page.goto(`${BASE_URL}/jsx/quiz`, { waitUntil: 'networkidle0' });
await clickButton('Пройти ещё раз');
let withCode = 0;
for (let i = 0; i < quiz2.length; i++) {
  await page.waitForSelector('.quiz-question');
  withCode += await page.$$eval('.quiz-question pre.shiki', (els) => els.length);
  const count = await page.$$eval('.quiz-option', (els) => els.length);
  if (count !== 4) expect(false, `глава 2: у вопроса ${count} вариантов`);
  if (i === 2) await page.screenshot({ path: `${OUT}/quiz-question.png` });
  await (await page.$$('.quiz-option'))[0].click();
  await page.click('button[type=submit]');
  await page.waitForSelector('.quiz-feedback');
  await page.keyboard.press('Enter');
}
const codeQuestions = quiz2.filter((q) => q.question.includes('```')).length;
expect(withCode === codeQuestions, `глава 2: код с подсветкой в ${withCode} из ${codeQuestions} вопросов с кодом`);
const kept = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).quizzes.jsx, STORAGE_KEY);
expect(kept.passed === true && kept.correct >= 12, `несданная попытка не затёрла сданную: ${JSON.stringify(kept)}`);

// С квиза главы 1 — к первому шагу главы 2
await page.goto(`${BASE_URL}/first-app/quiz`, { waitUntil: 'networkidle0' });
await clickButton('Пройти ещё раз');
await attempt((question, options) => options.indexOf(known.get(question)), known);
await clickButton('Глава 2 →');
await wait(800);
expect(page.url().endsWith('/jsx/expressions'), `«Глава 2 →» ведёт на первый шаг главы 2: ${page.url()}`);

// Узкий экран: без горизонтальной прокрутки
await page.setViewport({ width: 390, height: 800 });
await page.goto(`${BASE_URL}/jsx/quiz`, { waitUntil: 'networkidle0' });
await clickButton('Пройти ещё раз');
await page.waitForSelector('.quiz-question');
const overflow = await page.$eval('.quiz-page', (el) => el.scrollWidth - el.clientWidth);
expect(overflow <= 0, `узкий экран: нет горизонтальной прокрутки (${overflow})`);
await page.screenshot({ path: `${OUT}/quiz-mobile.png` });

expect(pageErrors.length === 0, `ошибок страницы нет ${JSON.stringify(pageErrors)}`);
await browser.close();
console.log(failures.length ? `\nПровалено: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
