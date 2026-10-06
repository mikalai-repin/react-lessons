// Проверка интерфейса платформы на демо-магазине шага 1.1: ошибки TypeScript, сборки и React в консоли
// (предупреждение про key со стеком владельцев и ссылкой), схлопывание повторов, адресная строка, заголовок вкладки
// из <title>, обычная ссылка <a href> → перезапуск, вкладка «Сеть», ошибка 500 из переключателя, «Формат».
// node tools/e2e/checks/platform.mjs
import { BASE_URL, CONTENT, launch, OUT, readDir, wait } from '../lib.mjs';

const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

const STORAGE_KEY = 'react-course:v1';
const ROUTE = 'first-app/what-is-react';
const DEMO = `${CONTENT}/01-first-app/01-what-is-react/start`;

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width: 1600, height: 900 });
page.on('dialog', (d) => d.accept());
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));

// Код ученика с ошибками подкладываем в сохранённый прогресс — так же, как его сохранил бы редактор
const files = readDir(DEMO);
// Ошибка только в типах: код при этом запускается
files['catalog/Catalog.tsx'] = files['catalog/Catalog.tsx']
  .replace("useState('');", "useState('');\n  const wrong: number = 'строка';\n  console.log(wrong);")
  // Список без key: React предупредит и покажет, какой компонент отрисовал список
  .replace(/\s+key=\{game\.id\}/, '');
// Один и тот же лог при каждом рендере карточки: в консоли — одна строка со счётчиком
files['shared/GameCard.tsx'] = files['shared/GameCard.tsx'].replace(
  'const soldOut',
  "console.log('render GameCard');\n  const soldOut",
);

await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
await page.evaluate(
  (key, route, code) => {
    localStorage.clear();
    localStorage.setItem(key, JSON.stringify({ steps: { [route]: { code } } }));
  },
  STORAGE_KEY,
  ROUTE,
  files,
);
await page.goto(`${BASE_URL}/${ROUTE}`, { waitUntil: 'networkidle0' });
await wait(4000);

const lines = () =>
  page.$$eval('.console-line', (els) => els.map((e) => ({ cls: e.className, text: e.textContent ?? '' })));
let consoleLines = await lines();
const has = (cls, text) => consoleLines.some((l) => l.cls.includes(cls) && l.text.includes(text));
expect(has('console-ts', "Type 'string' is not assignable to type 'number'"), 'ошибка TypeScript с меткой TS');
const missingTypes = consoleLines.filter((l) => /Cannot find module|Could not find a declaration/.test(l.text));
expect(
  missingTypes.length === 0,
  `Monaco находит типы react, react-router, query, zustand, *.module.css ${JSON.stringify(missingTypes.map((l) => l.text))}`,
);
// Подсветка Shiki (грамматика TSX): у тега <article> в GameCard.tsx — свой цвет, не как у обычного текста
const tab = await page.evaluateHandle(() =>
  [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === 'shared/GameCard.tsx'),
);
await tab.click();
await wait(800);
const colors = await page.evaluate(() => {
  const spans = [...document.querySelectorAll('.monaco-editor .view-line span span')];
  const color = (text) => {
    const span = spans.find((s) => s.textContent === text);
    return span ? getComputedStyle(span).color : null;
  };
  return { tag: color('article'), text: color(' ') ?? color('('), keyword: color('return') };
});
expect(
  Boolean(colors.tag) && colors.tag !== colors.keyword && colors.tag !== colors.text,
  `теги JSX подсвечены (Shiki): ${JSON.stringify(colors)}`,
);
const keyWarning = consoleLines.find((l) => l.cls.includes('console-error') && l.text.includes('unique "key"'));
expect(Boolean(keyWarning), 'предупреждение React про key в консоли (printf-шаблон подставлен)');
expect(
  Boolean(keyWarning?.text.includes('at Catalog (catalog/Catalog.tsx:')),
  `у предупреждения — стек владельцев с файлом исходника: ${keyWarning?.text.slice(0, 300)}`,
);
expect(
  await page.$$eval('.console-line a', (as) =>
    as.some((a) => a.getAttribute('href') === 'https://react.dev/link/warning-keys'),
  ),
  'ссылка react.dev/link/warning-keys кликабельна',
);
const renderCount = await page.$$eval('.console-line', (els) => {
  const line = els.find((e) => e.textContent?.includes('render GameCard'));
  return line?.querySelector('.console-count')?.textContent ?? '1';
});
expect(
  consoleLines.filter((l) => l.text.includes('render GameCard')).length === 1 && Number(renderCount) >= 24,
  `повторы схлопнуты в одну строку (×${renderCount}: 12 карточек × 2 рендера StrictMode)`,
);
await page.screenshot({ path: `${OUT}/platform-errors.png` });

// Синтаксическая ошибка: как в Vite, приложение не запускается, ошибка — один раз, с меткой «Сборка»
const broken = readDir(DEMO);
broken['NotFound.tsx'] = broken['NotFound.tsx'].replace('</h1>', '</h2>');
await page.evaluate(
  (key, route, code) => localStorage.setItem(key, JSON.stringify({ steps: { [route]: { code } } })),
  STORAGE_KEY,
  ROUTE,
  broken,
);
await page.goto(`${BASE_URL}/${ROUTE}`, { waitUntil: 'networkidle0' });
await wait(3000);
consoleLines = await lines();
expect(has('console-build', 'NotFound.tsx:'), 'синтаксическая ошибка — с меткой «Сборка» и именем файла');
expect(
  consoleLines.filter((l) => l.text.includes('Expected corresponding JSX closing tag')).length === 1,
  'синтаксическая ошибка в консоли один раз (без повтора с меткой TS)',
);
expect(
  (await page.$('.preview iframe')) === null && (await page.$('.preview-build-failed')) !== null,
  'при ошибке сборки приложение не запущено, в превью — подсказка',
);

// Тот же шаг без ошибок: адресная строка, заголовок вкладки, ссылки, сеть
await page.evaluate(() => localStorage.clear());
await page.goto(`${BASE_URL}/${ROUTE}`, { waitUntil: 'networkidle0' });
await wait(3000);
const frame = async () => (await page.$('.preview iframe')).contentFrame();
const frameText = async () => (await frame()).evaluate(() => document.body.innerText);
const address = () => page.$eval('.address-input', (e) => e.value);
const tabTitle = () => page.$eval('.preview-tab-title', (e) => e.textContent);

expect((await tabTitle()) === 'Каталог — Ход конём', `заголовок вкладки из <title> компонента: ${await tabTitle()}`);
await (await frame()).click('article a');
await wait(1500);
expect((await address()) === '/games/1', `клик по Link меняет адресную строку: ${await address()}`);
expect(
  (await tabTitle()) === 'Остров сокровищ — Ход конём',
  `заголовок вкладки следует за страницей: ${await tabTitle()}`,
);

await page.click('.address-input', { clickCount: 3 });
await page.type('.address-input', '/cart\n');
await wait(2500);
expect((await frameText()).includes('Корзина пуста'), 'ввод адреса /cart открывает корзину с нуля');
expect(
  (await tabTitle()) === 'Корзина — Ход конём',
  `после перезапуска — заголовок новой страницы: ${await tabTitle()}`,
);

// Обычная ссылка без роутера: в браузере — загрузка страницы, в превью — перезапуск приложения с адреса
await (
  await frame()
).evaluate(() => {
  const link = document.createElement('a');
  link.href = '/nope';
  link.textContent = 'обычная ссылка';
  document.body.append(link);
  link.click();
});
await wait(2500);
expect((await address()) === '/nope', `обычная ссылка <a href> перезапускает приложение с адреса: ${await address()}`);
expect((await frameText()).includes('Нет такой страницы'), 'после перезапуска по ссылке — страница 404');

await page.click('.address-input', { clickCount: 3 });
await page.type('.address-input', '/\n');
await wait(2500);
const tabs = await page.$$('.panel-tab');
await tabs[1].click();
await wait(200);
const rows = await page.$$eval('.network-row', (rs) => rs.map((r) => r.textContent));
expect(
  rows.some((r) => r?.includes('/api/games') && r.includes('200')),
  `вкладка «Сеть» показывает запрос: ${rows[0]}`,
);

await page.click('.backend-controls input[type=checkbox]');
await (await frame()).type('.search', 'x');
await wait(1500);
const rows2 = await page.$$eval('.network-row', (rs) => rs.map((r) => r.textContent));
expect(
  rows2.some((r) => r?.includes('500')),
  'переключатель «Ошибка 500» действует сразу',
);
expect((await frameText()).includes('Не удалось загрузить каталог'), 'приложение показывает ошибку загрузки');
await page.screenshot({ path: `${OUT}/platform-network.png` });

// Кнопка «Формат» не меняет файлы уроков: на диске код в том же формате (shared/lesson-prettier.json, npm run chapter export)
const formatCases = [[ROUTE, DEMO, ['catalog/Catalog.tsx', 'shared/GameCard.module.css', 'styles.css']]];
for (const [route, dir, names] of formatCases) {
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/${route}`, { waitUntil: 'networkidle0' });
  await wait(2500);
  const original = readDir(dir);
  for (const name of names) {
    const tab = await page.evaluateHandle(
      (name) => [...document.querySelectorAll('.tab')].find((t) => t.textContent.trim() === name),
      name,
    );
    await tab.click();
    await wait(400);
    await page.click('.toolbar .button:nth-child(2)');
    await wait(1500);
    const saved = await page.evaluate(
      (key, route) => JSON.parse(localStorage.getItem(key) ?? '{}').steps?.[route]?.code,
      STORAGE_KEY,
      route,
    );
    const text = saved?.[name] ?? original[name];
    expect(text === original[name], `«Формат» не меняет ${name}`);
  }
}

expect(pageErrors.length === 0, `ошибок страницы нет ${JSON.stringify(pageErrors)}`);
await browser.close();
console.log(failures.length ? `\nПровалено: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
