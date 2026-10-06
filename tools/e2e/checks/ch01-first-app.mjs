// Проверка утверждений и экспериментов главы 1 «Первое приложение»: каждый эксперимент из текста — на коде
// того шага, о котором текст. node tools/e2e/checks/ch01-first-app.mjs (нужен npm run dev)
import { BASE_URL, compileMap, CONTENT, launch, openPreview, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/01-first-app`;
const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};
const browser = await launch();
const preview = (logs) => logs.filter((l) => l.startsWith('[preview:') || l.startsWith('[runtime-error]'));
const edit = (files, name, from, to) => {
  if (!files[name].includes(from)) throw new Error(`${name}: нет «${from}»`);
  return { ...files, [name]: files[name].replace(from, to) };
};
const run = async (files, options = {}) => {
  const compiled = compileMap(files);
  const result = await openPreview(browser, compiled, { waitMs: 1200, ...options });
  return { ...result, compiled, text: compiled.errors.length ? '' : await pageText(result.page) };
};

// ---------- 1.2 Первый компонент ----------
const s2start = readDir(`${CH}/02-first-component/start`);
const s2 = readDir(`${CH}/02-first-component/solution`);
{
  const r = await run(s2start);
  expect(
    r.text === '' && preview(r.logs).length === 0,
    `1.2 старт: превью пустое, консоль чистая ${JSON.stringify(preview(r.logs))}`,
  );
}
{
  const r = await run(s2);
  expect(r.text === 'Ход конём Магазин настольных игр', `1.2 решение: «${r.text}»`);
}
{
  const noWrapper = edit(edit(s2, 'App.tsx', '    <main>\n', ''), 'App.tsx', '    </main>\n', '');
  const r = await run(noWrapper);
  expect(
    r.compiled.errors.includes('App.tsx:3 — JSX expressions must have one parent element.'),
    `1.2 без <main>: ошибка сборки ${JSON.stringify(r.compiled.errors)}`,
  );
}
{
  let lower = edit(s2, 'App.tsx', 'export function App()', 'export function app()');
  lower = edit(lower, 'main.tsx', "import { App } from './App';", "import { app } from './App';");
  lower = edit(lower, 'main.tsx', '.render(<App />)', '.render(<app />)');
  const r = await run(lower);
  expect(r.text === '', '1.2 компонент с маленькой буквы: превью пустое');
  expect(
    preview(r.logs).some((l) =>
      l.includes(
        'The tag <app> is unrecognized in this browser. If you meant to render a React component, start its name with an uppercase letter.',
      ),
    ),
    '1.2 компонент с маленькой буквы: предупреждение React',
  );
}

// ---------- 1.3 Запуск приложения ----------
const s3 = readDir(`${CH}/03-render/solution`);
{
  const r = await run(s3);
  expect(r.text === 'Ход конём Магазин настольных игр', '1.3 решение рисует то же');
}
{
  const r = await run(edit(s3, 'main.tsx', "getElementById('root')", "getElementById('app')"));
  expect(
    r.text === '' && preview(r.logs).some((l) => l.includes('Error: На странице нет элемента #root')),
    "1.3 getElementById('app'): своя ошибка в консоли",
  );
}
{
  const timing = edit(
    s3,
    'main.tsx',
    'root.render(<App />);',
    'root.render(<App />);\nconsole.log(container.innerHTML);\nsetTimeout(() => console.log(container.innerHTML), 100);',
  );
  const r = await run(timing);
  const logs = preview(r.logs).filter((l) => l.startsWith('[preview:log]'));
  expect(
    logs[0] === '[preview:log] ' && logs[1]?.startsWith('[preview:log] <main><h1>Ход конём</h1>'),
    `1.3 innerHTML сразу — пусто, через 100 мс — разметка ${JSON.stringify(logs)}`,
  );
}

// ---------- 1.4 Строгий режим ----------
const s4 = readDir(`${CH}/04-strict-mode/solution`);
{
  const logged = edit(
    s4,
    'App.tsx',
    'export function App() {\n',
    "export function App() {\n  console.log('render App');\n",
  );
  const r = await run(logged);
  const count = preview(r.logs).filter((l) => l === '[preview:log] render App').length;
  expect(count === 2, `1.4 со StrictMode render App — 2 раза (${count})`);
  const plain = edit(edit(logged, 'main.tsx', '  <StrictMode>\n', ''), 'main.tsx', '  </StrictMode>,\n', '');
  const r2 = await run(edit(plain, 'main.tsx', "import { StrictMode } from 'react';\n", ''));
  const count2 = preview(r2.logs).filter((l) => l === '[preview:log] render App').length;
  expect(count2 === 1, `1.4 без StrictMode — 1 раз (${count2})`);
}

// ---------- 1.5 Стили ----------
const s5start = readDir(`${CH}/05-styles/start`);
const s5 = readDir(`${CH}/05-styles/solution`);
{
  const r = await run(s5start);
  const style = await r.page.$eval('h1', (h) => `${getComputedStyle(h).color} ${getComputedStyle(h).fontSize}`);
  expect(style === 'rgb(0, 0, 0) 32px', `1.5 старт: стили не подключены (заголовок ${style})`);
}
{
  const r = await run(s5);
  const info = await r.page.evaluate(() => {
    const h1 = document.querySelector('h1');
    const p = document.querySelector('p');
    const main = document.querySelector('main');
    return {
      h1: getComputedStyle(h1).color,
      cls: h1.className,
      p: getComputedStyle(p).color,
      padding: getComputedStyle(main).padding,
      size: getComputedStyle(h1).fontSize,
    };
  });
  expect(
    info.h1 === 'rgb(195, 0, 47)' && info.size === '22px',
    `1.5 заголовок фирменного цвета, 22px ${JSON.stringify(info)}`,
  );
  expect(/^App_title_\w+$/.test(info.cls), `1.5 класс переименован: ${info.cls}`);
  expect(
    info.p === 'rgb(110, 110, 115)' && info.padding === '16px',
    `1.5 подпись серая, отступ 16px ${JSON.stringify(info)}`,
  );
  expect(r.text === '♞ Ход конём Магазин настольных игр', `1.5 текст: ${r.text}`);
  const typo = await run(edit(s5, 'App.tsx', 'styles.title', 'styles.titel'));
  const typoInfo = await typo.page.$eval('h1', (h) => ({
    cls: h.getAttribute('class'),
    color: getComputedStyle(h).color,
  }));
  expect(
    typoInfo.cls === null && typoInfo.color !== 'rgb(195, 0, 47)' && preview(typo.logs).length === 0,
    `1.5 опечатка styles.titel: класса нет, ошибок нет ${JSON.stringify(typoInfo)}`,
  );
}

// ---------- 1.6 Отладка ----------
const s6start = readDir(`${CH}/06-debugging/start`);
{
  const r = await run(s6start);
  expect(
    JSON.stringify(r.compiled.errors) ===
      JSON.stringify(["App.tsx:9 — Expected corresponding JSX closing tag for 'h1'."]),
    `1.6 старт: ошибка сборки ${JSON.stringify(r.compiled.errors)}`,
  );
  const fixed1 = edit(s6start, 'App.tsx', '♞ Ход конём</h2>', '♞ Ход конём</h1>');
  const r1 = await run(fixed1);
  const logs = preview(r1.logs);
  expect(r1.text === '', '1.6 после первой правки: превью пустое');
  expect(
    logs.some((l) => l.startsWith('[preview:warn] An error occurred in the <App> component.')),
    '1.6 предупреждение «An error occurred in the <App> component.»',
  );
  expect(
    logs.some((l) =>
      l.startsWith(
        "[runtime-error] TypeError: Cannot read properties of undefined (reading 'toUpperCase')\n    at App (App.tsx:11:31)\n    … (вызовы внутри библиотек)",
      ),
    ),
    `1.6 ошибка рендера со стеком App.tsx:11:31 ${JSON.stringify(logs.filter((l) => l.includes('TypeError')))}`,
  );
  const s6 = readDir(`${CH}/06-debugging/solution`);
  const r2 = await run(s6);
  expect(r2.text === '♞ Ход конём Магазин настольных игр', '1.6 решение: магазин на экране');
}
{
  // Сообщение TypeScript — в интерфейсе платформы (его даёт Monaco)
  const page = await browser.newPage();
  await page.setViewport({ width: 1600, height: 900 });
  page.on('dialog', (d) => d.accept());
  await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${BASE_URL}/first-app/debugging`, { waitUntil: 'networkidle0' });
  await wait(4000);
  const lines = await page.$$eval('.console-line', (els) => els.map((e) => `${e.className}|${e.textContent}`));
  expect(
    lines.some(
      (l) => l.includes('console-build') && l.includes("App.tsx:9 — Expected corresponding JSX closing tag for 'h1'."),
    ),
    '1.6 в платформе: строка «Сборка» первая',
  );
  expect(
    lines.some(
      (l) =>
        l.includes('console-ts') &&
        l.includes(
          "main.tsx:14:10 — Type '{ title: string; }' is not assignable to type 'IntrinsicAttributes'. Property 'title' does not exist on type 'IntrinsicAttributes'.",
        ),
    ),
    `1.6 в платформе: ошибка типов main.tsx:14:10 ${JSON.stringify(lines)}`,
  );
  expect(lines.filter((l) => l.includes('console-ts')).length === 1, '1.6 в платформе: других ошибок TS нет');
  await page.close();
}

// ---------- 1.7 Под капотом: JSX ----------
{
  const s7 = readDir(`${CH}/06-debugging/solution`);
  const withLog = {
    ...s7,
    'App.tsx':
      s7['App.tsx'] +
      '\nconst element = <h1 className="title">Ход конём</h1>;\nconsole.log(element.type, element.props, element.key);\nconsole.log(Object.keys(element), Object.isFrozen(element));\n',
  };
  const r = await run(withLog);
  const logs = preview(r.logs);
  expect(
    logs.includes('[preview:log] h1 { className: "title", children: "Ход конём" } null'),
    `1.7 type, props, key ${JSON.stringify(logs)}`,
  );
  expect(
    logs.includes('[preview:log] ["$$typeof", "type", "key", "props", "_owner", "_store"] true'),
    '1.7 ключи элемента и заморозка',
  );
}

await browser.close();
console.log(failures.length ? `\nПровалено: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
