// Проверка утверждений и экспериментов главы 7 «Собственные хуки»: каждый эксперимент из текста —
// на коде того шага, о котором текст. node tools/e2e/checks/ch07-hooks.mjs (нужен npm run dev).
// Сообщения ESLint (шаги 7.2, 7.5, 7.6) проверены в scratchpad — линтера в проекте нет (authoring-process.md, ловушки)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { CONTENT, OUT, ROOT, collect, compileMap, launch, openPreview, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/07-hooks`;
const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};
const browser = await launch();
const preview = (logs) => logs.filter((l) => l.startsWith('[preview:') || l.startsWith('[runtime-error]'));
const has = (lines, text) => lines.some((l) => l.includes(text));
const edit = (files, name, from, to, all = false) => {
  if (!files[name].includes(from)) throw new Error(`${name}: нет «${from}»`);
  return { ...files, [name]: all ? files[name].replaceAll(from, to) : files[name].replace(from, to) };
};
const run = async (files, options = {}) => {
  const compiled = compileMap(files);
  const result = await openPreview(browser, compiled, { waitMs: 1000, ...options });
  const text = async () => (compiled.errors.length ? '' : (await pageText(result.page)).replace(/ /g, ' '));
  // Новые строки консоли с прошлого вызова — так, как их видит ученик
  const fresh = async () => {
    await collect(result.page, result.logs, result.network);
    const lines = preview(result.logs);
    result.logs.length = 0;
    return lines;
  };
  return { ...result, compiled, text, fresh };
};
const logLines = (lines) => lines.filter((l) => l.startsWith('[preview:log] ')).map((l) => l.slice(14));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// Названия игр в разделе <main> по порядку (2 — «Хиты», 3 — «Все игры»; 1 — корзина)
const titles = (page, section = 3) =>
  page.$$eval(`main > section:nth-of-type(${section}) h3`, (hs) => hs.map((h) => h.textContent));
// Щелчок по кнопке с таким текстом (первой; scope — где искать)
async function press(page, text, scope = 'body', index = 0) {
  await page.evaluate(
    (text, scope, index) => {
      const buttons = [...document.querySelectorAll(`${scope} button`)].filter((b) => b.textContent.trim() === text);
      buttons[index].click();
    },
    text,
    scope,
    index,
  );
  await wait(150);
}
const open = (page, title) => press(page, title, 'main article h3');
// «В корзину» у карточки в разделе
async function add(page, title, section) {
  await page.evaluate(
    (title, section) => {
      const card = [...document.querySelectorAll(`main > section:nth-of-type(${section}) article`)].find(
        (a) => a.querySelector('h3').textContent === title,
      );
      [...card.querySelectorAll('button')].find((b) => b.textContent === 'В корзину').click();
    },
    title,
    section,
  );
  await wait(150);
}
const textarea = (page) => page.$eval('textarea', (t) => t.value);

// Ошибки типов полного кода — как в редакторе: «App.tsx:5 — TS2322: …» (настройки tsconfig.content.json)
const TC = join(OUT, 'ch07-tc');
function typeErrors(files) {
  rmSync(TC, { recursive: true, force: true });
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(TC, name)), { recursive: true });
    writeFileSync(join(TC, name), text);
  }
  const config = ts.getParsedCommandLineOfConfigFile(
    join(ROOT, 'tsconfig.content.json'),
    {},
    { ...ts.sys, onUnRecoverableConfigFileDiagnostic: () => {} },
  );
  const roots = [
    ...Object.keys(files)
      .filter((n) => /\.tsx?$/.test(n))
      .map((n) => join(TC, n)),
    join(ROOT, 'shared/course-env.d.ts'),
  ];
  const program = ts.createProgram(roots, config.options);
  return ts.getPreEmitDiagnostics(program).map((d) => {
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    if (!d.file) return `TS${d.code}: ${message}`;
    const { line } = d.file.getLineAndCharacterOfPosition(d.start);
    return `${d.file.fileName.slice(TC.length + 1)}:${line + 1} — TS${d.code}: ${message}`;
  });
}
const typeHas = (errors, text) => errors.some((e) => e.includes(text));

// ONLY=7.4,7.8 — только эти разделы (и без общей проверки шагов)
const ONLY = process.env.ONLY?.split(',');
const want = (section) => !ONLY || ONLY.includes(section);

// Каждый шаг: консоль пуста, ошибок типов нет
for (const step of ONLY ? [] : ['03-local-storage', '04-effect-hooks', '05-hook-api', '08-practice']) {
  const files = readDir(`${CH}/${step}/solution`);
  const errors = typeErrors(files);
  const r = await run(files);
  const lines = await r.fresh();
  expect(
    errors.length === 0 && lines.length === 0,
    `${step}: консоль пуста, без ошибок типов ${JSON.stringify([...errors, ...lines])}`,
  );
  await r.page.close();
}

// ---------- 7.1 Правила хуков (код — база главы) ----------
const s1 = readDir(`${CH}/01-rules/start`);
const conditional = edit(
  s1,
  'game/GameDetails.tsx',
  '  function handleReviewSubmit(',
  `  if (quantity > 0) {
    useEffect(() => {
      console.log('в корзине', quantity);
    });
  }

  function handleReviewSubmit(`,
);
if (want('7.1')) {
  expect(typeErrors(conditional).length === 0, '7.1 хук в условии: TypeScript молчит');
  const r = await run(conditional);
  await open(r.page, 'Остров сокровищ');
  await r.fresh();
  await press(r.page, 'В корзину', 'main article');
  const lines = await r.fresh();
  const table = lines.find((l) => l.includes('change in the order of Hooks called by GameDetails')) ?? '';
  expect(
    table.includes('4. useEffect                  useEffect') &&
      table.includes('5. undefined                  useEffect') &&
      has(lines, 'Rendered more hooks than during the previous render.'),
    '7.1 «В корзину» на странице: таблица (5. undefined → useEffect) и «Rendered more hooks…»',
  );
  expect((await r.text()) === '', '7.1 страница пропала');
  await r.page.close();
}
if (want('7.1')) {
  const r = await run(conditional);
  await add(r.page, 'Остров сокровищ', 3);
  await open(r.page, 'Остров сокровищ');
  expect(
    same(logLines(await r.fresh()), ['в корзине 1', 'в корзине 1']),
    '7.1 из каталога, затем страница: дважды «в корзине 1»',
  );
  await press(r.page, '−', 'main section:nth-of-type(1)');
  const lines = await r.fresh();
  expect(
    has(lines, 'Rendered fewer hooks than expected. This may be caused by an accidental early return statement.'),
    '7.1 «−» в мини-корзине: «Rendered fewer hooks than expected…»',
  );
  await r.page.close();
}
if (want('7.1')) {
  // Хук в середине App: таблица расходится в 6-й строке, ошибка — чтение чужой ячейки
  let f = edit(
    s1,
    'App.tsx',
    '  // Какая игра открыта: только id, null — открыт каталог',
    `  if (cartCount > 0) {
    useEffect(() => {
      document.title = \`Корзина: \${cartCount}\`;
    });
  }

  // Какая игра открыта: только id, null — открыт каталог`,
  );
  f = edit(
    f,
    'App.tsx',
    "import { useRef, useState } from 'react';",
    "import { useEffect, useRef, useState } from 'react';",
  );
  const r = await run(f);
  await add(r.page, 'Остров сокровищ', 3);
  const lines = await r.fresh();
  const table = lines.find((l) => l.includes('change in the order of Hooks called by App')) ?? '';
  expect(
    table.includes('4. useMemo                    useMemo') &&
      table.includes('5. useReducer                 useReducer') &&
      table.includes('6. useState                   useEffect') &&
      has(lines, "TypeError: Cannot read properties of null (reading 'inst')"),
    "7.1 хук в середине App: 4–5 useMemo/useReducer, 6. useState → useEffect, «reading 'inst'»",
  );
  await r.page.close();
}
if (want('7.1')) {
  // useRef в MiniCart ниже return: React молчит, ссылка создаётся заново
  let f = edit(
    s1,
    'cart/MiniCart.tsx',
    '  // Окно подтверждения: у ссылки — только метод open()\n  const confirmRef = useRef<ConfirmDialogHandle>(null);\n',
    '',
  );
  f = edit(
    f,
    'cart/MiniCart.tsx',
    '  return (\n    <Section\n      title="Корзина"',
    `  // Окно подтверждения: у ссылки — только метод open()
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  console.log('MiniCart: ссылка', confirmRef.current);

  return (
    <Section
      title="Корзина"`,
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 3);
  const first = await r.fresh();
  await add(r.page, 'Нарды', 2);
  const second = logLines(await r.fresh());
  await press(r.page, 'Очистить корзину');
  await r.page.evaluate(() =>
    [...document.querySelectorAll('dialog button')].find((b) => b.textContent === 'Очистить').click(),
  );
  await wait(200);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 3);
  const third = await r.fresh();
  expect(
    same(first, ['[preview:log] MiniCart: ссылка null', '[preview:log] MiniCart: ссылка null']) &&
      second.every((l) => l === 'MiniCart: ссылка { open: ƒ open() }') &&
      same(third, first),
    `7.1 useRef ниже return в MiniCart: без ошибок, null → { open } → после очистки снова null (${JSON.stringify([first, second, third])})`,
  );
  await r.page.close();
}
if (want('7.1')) {
  // Хук в обычной функции, вызванной при рендере, — работает
  let f = edit(
    s1,
    'game/GameDetails.tsx',
    "  const [review, setReview] = useState('');",
    '  const [review, setReview] = readDraft(`review-draft:${game.id}`);',
  );
  f = edit(
    f,
    'game/GameDetails.tsx',
    'type GameDetailsProps = {',
    "function readDraft(key: string) {\n  return useState(() => localStorage.getItem(key) ?? '');\n}\n\ntype GameDetailsProps = {",
  );
  const r = await run(f);
  await open(r.page, 'Остров сокровищ');
  await r.page.type('textarea', 'Да');
  expect(
    typeErrors(f).length === 0 && (await textarea(r.page)) === 'Да' && (await r.fresh()).length === 0,
    '7.1 readDraft с useState при рендере работает без ошибок',
  );
  await r.page.close();
}

// ---------- 7.3 Первый свой хук ----------
const s3 = readDir(`${CH}/03-local-storage/solution`);
if (want('7.3')) {
  let r = await run(s3);
  await open(r.page, 'Остров сокровищ');
  await r.page.type('textarea', 'Отличная игра');
  await wait(100);
  const counter = await r.page.$eval('form span', (s) => s.textContent);
  expect(counter === '13 / 300', `7.3 счётчик «13 / 300» (${counter})`);
  const saved = await r.page.evaluate(() => localStorage.getItem('review-draft:1'));
  expect(saved === '"Отличная игра"', `7.3 в хранилище строка JSON в кавычках (${saved})`);
  await press(r.page, 'Следующая игра →');
  expect((await textarea(r.page)) === '', '7.3 у следующей игры поле пустое');
  await press(r.page, '← К каталогу');
  await open(r.page, 'Остров сокровищ');
  expect((await textarea(r.page)) === 'Отличная игра', '7.3 снова «Остров» — черновик вернулся');
  await r.page.close();
  r = await run(s3, { keepStorage: true });
  await open(r.page, 'Остров сокровищ');
  expect((await textarea(r.page)) === 'Отличная игра', '7.3 после перезапуска черновик на месте');
  await press(r.page, 'Отправить');
  expect((await textarea(r.page)) === '', '7.3 «Отправить» очищает поле');
  await r.page.close();
  r = await run(s3, { keepStorage: true });
  await open(r.page, 'Остров сокровищ');
  expect((await textarea(r.page)) === '', '7.3 после отправки и перезапуска поле пустое');
  expect((await r.fresh()).length === 0, '7.3 консоль пуста');
  await r.page.close();
}
if (want('7.3')) {
  // Тот же ключ в App — своё состояние
  let f = edit(
    s3,
    'App.tsx',
    '  const hits = games.filter(isHit);',
    "  const hits = games.filter(isHit);\n  const [draft] = useLocalStorage('review-draft:1', '');\n  console.log('App, черновик:', draft);",
  );
  f = edit(
    f,
    'App.tsx',
    "import { isHit } from './shared/gameRules';",
    "import { isHit } from './shared/gameRules';\nimport { useLocalStorage } from './hooks/useLocalStorage';",
  );
  const r = await run(f);
  const start = logLines(await r.fresh());
  await open(r.page, 'Остров сокровищ');
  const opened = logLines(await r.fresh());
  await r.page.type('textarea', 'Да');
  await wait(150);
  const typed = logLines(await r.fresh());
  await press(r.page, 'В корзину', 'main article');
  const added = logLines(await r.fresh());
  const stored = await r.page.evaluate(() => localStorage.getItem('review-draft:1'));
  const empty = ['App, черновик: ', 'App, черновик: '];
  expect(
    same(start, empty) && same(opened, empty) && typed.length === 0 && same(added, empty) && stored === '"Да"',
    `7.3 App с тем же ключом: пусто при запуске, открытии и «В корзину», ввод — без строк (${JSON.stringify([start, opened, typed, added, stored])})`,
  );
  await r.page.close();
}
if (want('7.3')) {
  const errors = typeErrors(edit(s3, 'hooks/useLocalStorage.ts', ' as const', ''));
  expect(
    typeHas(
      errors,
      "TS2349: This expression is not callable.\n  Not all constituents of type 'string | ((next: string) => void)' are callable.\n    Type 'string' has no call signatures.",
    ),
    '7.3 без as const — TS2349 в GameDetails',
  );
}

// ---------- 7.4 Хуки поверх эффектов ----------
const s4 = readDir(`${CH}/04-effect-hooks/solution`);
const search = (page, text, delay) => page.type('input[type=search]', text, { delay });
if (want('7.4')) {
  const r = await run(s4);
  await search(r.page, 'ост', 50);
  await wait(80);
  const before = await titles(r.page);
  await wait(400);
  expect(
    before.length === 3 && same(await titles(r.page), ['Остров сокровищ']),
    '7.4 быстрый ввод «ост»: витрина меняется после паузы — «Остров сокровищ»',
  );
  await r.page.close();
}
if (want('7.4')) {
  const f = edit(
    s4,
    'hooks/useDebouncedValue.ts',
    '    const id = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(id);',
    "    console.log('таймер:', value);\n    const id = setTimeout(() => setDebounced(value), delay);\n    return () => {\n      console.log('отмена:', value);\n      clearTimeout(id);\n    };",
  );
  const r = await run(f);
  const start = logLines(await r.fresh());
  await search(r.page, 'ост', 50);
  await wait(500);
  const typed = logLines(await r.fresh());
  expect(
    same(start, ['таймер: ', 'отмена: ', 'таймер: ']) &&
      same(typed, ['отмена: ', 'таймер: о', 'отмена: о', 'таймер: ос', 'отмена: ос', 'таймер: ост']),
    `7.4 логи таймера: запуск и «ост» (${JSON.stringify([start, typed])})`,
  );
  await r.page.close();
}
const probe74 = (files) =>
  edit(
    edit(
      files,
      'App.tsx',
      '  // Что показать — вычисляем при каждом рендере',
      "  useEffect(() => {\n    console.log('ищем:', query);\n  }, [query]);\n  // Что показать — вычисляем при каждом рендере",
    ),
    'App.tsx',
    "import { useRef, useState } from 'react';",
    "import { useEffect, useRef, useState } from 'react';",
  );
if (want('7.4')) {
  const noCleanup = edit(
    probe74(s4),
    'hooks/useDebouncedValue.ts',
    '    const id = setTimeout(() => setDebounced(value), delay);\n    return () => clearTimeout(id);',
    '    setTimeout(() => setDebounced(value), delay);',
  );
  const results = {};
  for (const [name, files, delay] of [
    ['быстро', probe74(s4), 50],
    ['медленно', probe74(s4), 450],
    ['без очистки', noCleanup, 50],
  ]) {
    const r = await run(files);
    const start = logLines(await r.fresh());
    await search(r.page, 'ост', delay);
    await wait(500);
    results[name] = [start, logLines(await r.fresh())];
    await r.page.close();
  }
  const twice = ['ищем: ', 'ищем: '];
  const three = ['ищем: о', 'ищем: ос', 'ищем: ост'];
  expect(
    same(results['быстро'], [twice, ['ищем: ост']]) &&
      same(results['медленно'], [twice, three]) &&
      same(results['без очистки'], [twice, three]),
    `7.4 «ищем»: быстро — одна строка, медленно и без очистки — три (${JSON.stringify(results)})`,
  );
}
if (want('7.4')) {
  // Сброс фильтров: поле и фокус сразу, витрина — после паузы
  const r = await run(s4);
  await search(r.page, 'zzz', 0);
  await wait(450);
  const empty = (await r.text()).includes('Ничего не нашлось');
  await press(r.page, 'Сбросить фильтры');
  const [stillEmpty, value, focus] = [
    (await r.text()).includes('Ничего не нашлось'),
    await r.page.$eval('input[type=search]', (i) => i.value),
    await r.page.evaluate(() => document.activeElement.type),
  ];
  await wait(400);
  expect(
    empty && stillEmpty && value === '' && focus === 'search' && (await titles(r.page)).length === 3,
    '7.4 «zzz» → «Сбросить фильтры»: поле пустое и в фокусе сразу, витрина — через 0,3 с',
  );
  await r.page.close();
}
if (want('7.4')) {
  // Категория — без задержки (сброс после «Детских» мгновенный)
  const r = await run(s4);
  await (await r.page.$$('main select'))[0].select('kids');
  await wait(100);
  const empty = (await r.text()).includes('Ничего не нашлось');
  await press(r.page, 'Сбросить фильтры');
  expect(empty && (await titles(r.page)).length === 3, '7.4 категория и её сброс — без задержки');
  await r.page.close();
}
if (want('7.4')) {
  // Два вызова useOnlineStatus — одно значение браузера
  let f = edit(
    s4,
    'layout/Header.tsx',
    "import styles from './Header.module.css';",
    "import { useOnlineStatus } from '../hooks/useOnlineStatus';\nimport styles from './Header.module.css';",
  );
  f = edit(
    f,
    'layout/Header.tsx',
    'export function Header({ count, cartCount }: HeaderProps) {',
    'export function Header({ count, cartCount }: HeaderProps) {\n  const online = useOnlineStatus();',
  );
  f = edit(f, 'layout/Header.tsx', 'Корзина: {cartCount}', "{online ? 'Корзина' : 'Офлайн'}: {cartCount}");
  const r = await run(f);
  await r.page.setOfflineMode(true);
  await wait(300);
  const offline = await r.text();
  await r.page.setOfflineMode(false);
  await wait(300);
  expect(
    typeErrors(f).length === 0 &&
      offline.startsWith('Нет сети — проверьте подключение к интернету') &&
      offline.includes('Офлайн: 0') &&
      (await r.text()).includes('Корзина: 0'),
    '7.4 «Офлайн»: полоса и «Офлайн: 0» в шапке одновременно',
  );
  await r.page.close();
}
if (want('7.4')) {
  // deep: первая буква — 4 рендера App, следующие — по 2; без StrictMode — 2 и 1
  const f = edit(
    s4,
    'App.tsx',
    '  const hits = games.filter(isHit);',
    "  console.log('render App');\n  const hits = games.filter(isHit);",
  );
  let noStrict = edit(f, 'main.tsx', '<StrictMode>', '<>');
  noStrict = edit(noStrict, 'main.tsx', '</StrictMode>', '</>');
  noStrict = edit(noStrict, 'main.tsx', "import { StrictMode } from 'react';\n", '');
  const counts = [];
  for (const files of [f, noStrict]) {
    const r = await run(files, { waitMs: 800 });
    await r.fresh();
    await r.page.focus('input[type=search]');
    for (const ch of 'ab') {
      await r.page.keyboard.type(ch);
      await wait(100);
      counts.push(logLines(await r.fresh()).length);
    }
    await r.page.close();
  }
  expect(same(counts, [4, 2, 2, 1]), `7.4 лишний рендер на первой букве: строгий 4 и 2, без него 2 и 1 (${counts})`);
}
if (want('7.4')) {
  // useMediaQuery из шага 7.5 работает в превью (500 px → false, 400 px → true)
  const md = readFileSync(`${CH}/05-hook-api/lesson.md`, 'utf8');
  const hook = md.match(/```tsx hooks\/useMediaQuery\.ts\n([\s\S]*?)```/)[1];
  let f = { ...s4, 'hooks/useMediaQuery.ts': hook };
  f = edit(
    f,
    'layout/Header.tsx',
    "import styles from './Header.module.css';",
    "import { useMediaQuery } from '../hooks/useMediaQuery';\nimport styles from './Header.module.css';",
  );
  f = edit(
    f,
    'layout/Header.tsx',
    'export function Header({ count, cartCount }: HeaderProps) {',
    "export function Header({ count, cartCount }: HeaderProps) {\n  const narrow = useMediaQuery('(max-width: 480px)');\n  console.log('narrow', narrow);",
  );
  const r = await run(f);
  const start = logLines(await r.fresh());
  await r.page.setViewport({ width: 400, height: 600 });
  await wait(300);
  const narrow = logLines(await r.fresh());
  expect(
    typeErrors(f).length === 0 &&
      same(start, ['narrow false', 'narrow false']) &&
      same(narrow, ['narrow true', 'narrow true']),
    `7.5 useMediaQuery из текста: 500 px — false, 400 px — true (${JSON.stringify([start, narrow])})`,
  );
  await r.page.close();
}

// ---------- 7.5 API хука ----------
const s5 = readDir(`${CH}/05-hook-api/solution`);
const observeLogs = (files) =>
  edit(
    files,
    'hooks/useInView.ts',
    '    observer.observe(ref.current!);\n    return () => observer.disconnect();',
    "    console.log('наблюдение: старт');\n    observer.observe(ref.current!);\n    return () => {\n      console.log('наблюдение: стоп');\n      observer.disconnect();\n    };",
  );
if (want('7.5')) {
  const r = await run(observeLogs(s5));
  const start = logLines(await r.fresh());
  const first = await titles(r.page);
  await add(r.page, 'Остров сокровищ', 3);
  const added = logLines(await r.fresh());
  await r.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(400);
  const scrolled = logLines(await r.fresh());
  expect(
    same(start, ['наблюдение: старт', 'наблюдение: стоп', 'наблюдение: старт']) &&
      first.length === 3 &&
      added.length === 0 &&
      same(scrolled, ['наблюдение: стоп']) &&
      (await titles(r.page)).length === 6,
    `7.5 useInView: старт/стоп/старт, «В корзину» — тихо, прокрутка — стоп и 6 игр (${JSON.stringify([start, added, scrolled])})`,
  );
  await r.page.close();
}
if (want('7.5')) {
  let f = edit(
    observeLogs(s5),
    'hooks/useInView.ts',
    '      if (entry.isIntersecting) onVisible();',
    '      if (entry.isIntersecting) onEnter();',
  );
  f = edit(f, 'hooks/useInView.ts', '  }, [ref]);', '  }, [ref, onEnter]);');
  f = edit(f, 'hooks/useInView.ts', '  const onVisible = useEffectEvent(onEnter);\n', '');
  f = edit(
    f,
    'hooks/useInView.ts',
    "import { useEffect, useEffectEvent } from 'react';",
    "import { useEffect } from 'react';",
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 3);
  expect(
    typeErrors(f).length === 0 && same(logLines(await r.fresh()), ['наблюдение: стоп', 'наблюдение: старт']),
    '7.5 без useEffectEvent: «В корзину» — стоп и старт',
  );
  await r.page.close();
}
if (want('7.5')) {
  // Датчик [setReview]: с useCallback — только при открытии, без — на каждую букву и «В корзину»
  const withProbe = (files) =>
    edit(
      files,
      'game/GameDetails.tsx',
      '  function handleReviewSubmit(',
      "  useEffect(() => {\n    console.log('эффект: новая setReview');\n  }, [setReview]);\n\n  function handleReviewSubmit(",
    );
  const results = {};
  for (const [name, files] of [
    ['useCallback', s5],
    ['без useCallback', readDir(`${CH}/04-effect-hooks/solution`)],
  ]) {
    const r = await run(withProbe(files));
    await r.fresh();
    await open(r.page, 'Остров сокровищ');
    const opened = logLines(await r.fresh()).length;
    await r.page.type('textarea', 'Да', { delay: 50 });
    await wait(100);
    const typed = logLines(await r.fresh()).length;
    await press(r.page, 'В корзину', 'main article');
    const added = logLines(await r.fresh()).length;
    results[name] = [opened, typed, added];
    await r.page.close();
  }
  expect(
    same(results, { useCallback: [2, 0, 0], 'без useCallback': [2, 2, 1] }),
    `7.5 датчик [setReview]: открытие/«Да»/«В корзину» — 2/0/0 и 2/2/1 (${JSON.stringify(results)})`,
  );
}
if (want('7.5')) {
  // useMediaQuery: subscribe в теле хука — переподписка на каждый рендер; с useCallback — нет
  const md = readFileSync(`${CH}/05-hook-api/lesson.md`, 'utf8');
  const good = md
    .match(/```tsx hooks\/useMediaQuery\.ts\n([\s\S]*?)```/)[1]
    .replace(
      '      const list = matchMedia(query);',
      "      console.log('подписка');\n      const list = matchMedia(query);",
    );
  const bad = `import { useSyncExternalStore } from 'react';

export function useMediaQuery(query: string) {
  function subscribe(onStoreChange: () => void) {
    console.log('подписка');
    const list = matchMedia(query);
    list.addEventListener('change', onStoreChange);
    return () => list.removeEventListener('change', onStoreChange);
  }
  return useSyncExternalStore(subscribe, () => matchMedia(query).matches);
}
`;
  const results = {};
  for (const [name, hook] of [
    ['в теле', bad],
    ['useCallback', good],
  ]) {
    let f = { ...s5, 'hooks/useMediaQuery.ts': hook };
    f = edit(
      f,
      'layout/Header.tsx',
      "import styles from './Header.module.css';",
      "import { useMediaQuery } from '../hooks/useMediaQuery';\nimport styles from './Header.module.css';",
    );
    f = edit(
      f,
      'layout/Header.tsx',
      'export function Header({ count, cartCount }: HeaderProps) {',
      "export function Header({ count, cartCount }: HeaderProps) {\n  const narrow = useMediaQuery('(max-width: 480px)');",
    );
    f = edit(
      f,
      'layout/Header.tsx',
      '<p className={styles.cart}>',
      '<p className={styles.cart} title={String(narrow)}>',
    );
    const r = await run(f);
    const start = logLines(await r.fresh()).length;
    await add(r.page, 'Остров сокровищ', 3);
    await add(r.page, 'Нарды', 2);
    results[name] = [start, logLines(await r.fresh()).length];
    await r.page.close();
  }
  expect(
    same(results, { 'в теле': [2, 2], useCallback: [2, 0] }),
    `7.5 subscribe в теле — подписка на каждое «В корзину», с useCallback — нет (${JSON.stringify(results)})`,
  );
}

// ---------- 7.6 Когда хук не нужен ----------
if (want('7.6')) {
  // Упражнение useToast из текста: перенос toast, toastTimer, showToast в хук
  const s6 = readDir(`${CH}/06-no-hook/start`);
  const hook = `import { useRef, useState } from 'react';

// Сколько показывается уведомление, мс
const TOAST_MS = 2500;

// Уведомление «Добавлено: …», которое прячется само
export function useToast() {
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current !== null) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS);
  }

  return { toast, showToast };
}
`;
  const app = s6['App.tsx'];
  const from = app.indexOf('  // Текст уведомления; null — уведомления нет');
  const to = app.indexOf('  // Обработчики сообщают, что случилось');
  let f = {
    ...s6,
    'hooks/useToast.ts': hook,
    'App.tsx': `${app.slice(0, from)}  const { toast, showToast } = useToast();\n\n${app.slice(to)}`,
  };
  f = edit(
    f,
    'App.tsx',
    "import { useRef, useState } from 'react';",
    "import { useRef, useState } from 'react';\nimport { useToast } from './hooks/useToast';",
  );
  f = edit(f, 'App.tsx', '// Сколько показывается уведомление «Добавлено», мс\nconst TOAST_MS = 2500;\n', '');
  const r = await run(f);
  await add(r.page, 'Остров сокровищ', 3);
  const shown = await r.page.evaluate(() => document.querySelector('[role=status]')?.textContent);
  await wait(2700);
  const hidden = await r.page.evaluate(() => document.querySelector('[role=status]'));
  expect(
    typeErrors(f).length === 0 &&
      shown === 'Добавлено: Остров сокровищ' &&
      hidden === null &&
      (await r.fresh()).length === 0,
    `7.6 упражнение useToast работает (${typeErrors(f)})`,
  );
  await r.page.close();
}

// ---------- 7.7 Под капотом: где живут хуки ----------
if (want('7.7')) {
  const md = readFileSync(`${CH}/07-under-the-hood/lesson.md`, 'utf8');
  const probe = md.match(/```tsx main\.tsx\n([\s\S]*?)```/)[1];
  const s7 = readDir(`${CH}/07-under-the-hood/start`);
  const files = { ...s7, 'main.tsx': s7['main.tsx'] + probe };
  expect(typeErrors(files).length === 0, `7.7 код датчика без ошибок типов ${typeErrors(files)}`);
  const expected = (title) =>
    md
      .slice(md.indexOf(title))
      .match(/```\n([\s\S]*?)```/)[1]
      .trim()
      .split('\n');
  let r = await run(files);
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  const opened = logLines(await r.fresh());
  expect(
    same(opened, expected('## Ячейки страницы игры')),
    `7.7 ячейки GameDetails как в тексте (${JSON.stringify(opened)})`,
  );
  await r.page.type('textarea', 'Да');
  await r.page.click('main article p:last-of-type');
  await wait(150);
  const typed = logLines(await r.fresh());
  expect(
    typed[1] === '1 useState "Да"' && same(typed.slice(2), opened.slice(2)),
    '7.7 после «Да» и щелчка — useState "Да"',
  );
  await r.page.close();
  r = await run({ ...files, 'main.tsx': files['main.tsx'].replace("printHooks('GameDetails')", "printHooks('App')") });
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 3);
  const app = logLines(await r.fresh());
  expect(
    same(app, expected("Замените в датчике `'GameDetails'` на `'App'`")),
    `7.7 ячейки App как в тексте (${JSON.stringify(app)})`,
  );
  await r.page.close();
  // Второй useLocalStorage в GameDetails — ещё две ячейки
  const twice = edit(
    files,
    'game/GameDetails.tsx',
    '  // Отправлен ли отзыв',
    '  const [rating, setRating] = useLocalStorage(\n    `review-rating:${game.id}`,\n    0,\n  );\n  // Отправлен ли отзыв',
  );
  r = await run(twice);
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  const lines = logLines(await r.fresh()).filter((l) => /^\d/.test(l));
  expect(
    lines[2] === '3 useState 0' && lines[3] === '4 useCallback [ƒ, deps ["review-rating:1"]]' && lines.length === 7,
    `7.7 два useLocalStorage: 3 useState 0, 4 useCallback, всего 7 ячеек (${JSON.stringify(lines)})`,
  );
  await r.page.close();
}

// ---------- 7.8 Практикум: useCountdown ----------
const s8 = readDir(`${CH}/08-practice/solution`);
if (want('7.8')) {
  const r = await run(s8);
  const text = await r.text();
  expect(
    /Неделя семейных игр: скидки до 20% на «Остров сокровищ» и «Нарды» До конца акции — (2:00:00|1:59:5\d) Корзина/.test(
      text,
    ),
    '7.8 баннер над корзиной: текст акции и «До конца акции — 2:00:00»',
  );
  await open(r.page, 'Остров сокровищ');
  const page = await r.text();
  expect(
    page.includes('До конца акции —') && page.includes('Скидка действует ещё'),
    '7.8 на странице игры — баннер и таймер скидки',
  );
  // Секунды баннера и страницы иногда расходятся: у каждого вызова хука свой интервал
  const samples = [];
  for (let i = 0; i < 25; i++) {
    samples.push(
      await r.page.evaluate(() => {
        const t = document.body.innerText;
        return t.match(/До конца акции — ([\d:]+)/)[1] === t.match(/Скидка действует ещё ([\d:]+)/)[1];
      }),
    );
    await wait(97);
  }
  expect(
    samples.includes(false),
    `7.8 секунды баннера и страницы иногда расходятся (${samples.filter((s) => !s).length} из 25)`,
  );
  await r.page.close();
}
if (want('7.8')) {
  const short = edit(s8, 'data/sale.ts', '2 * 60 * 60 * 1000', '3 * 1000');
  const r = await run(short, { waitMs: 500 });
  const before = await r.text();
  await wait(3500);
  const after = await r.text();
  await open(r.page, 'Остров сокровищ');
  const page = await r.text();
  expect(
    before.includes('До конца акции') && !after.includes('Неделя семейных игр') && page.includes('Акция закончилась'),
    '7.8 акция 3 с: баннер исчез, на странице «Акция закончилась»',
  );
  expect((await r.fresh()).length === 0, '7.8 акция 3 с: консоль пуста');
  await r.page.close();
}
if (want('7.8')) {
  // Где живёт таймер: в PromoBanner — карточки не рендерятся, в App — 12 строк в секунду
  const f = edit(
    s8,
    'shared/GameCard.tsx',
    '  const { min, max } = game.players;',
    "  console.log('render GameCard');\n  const { min, max } = game.players;",
  );
  let inApp = edit(
    f,
    'App.tsx',
    '  const hits = games.filter(isHit);',
    '  const hits = games.filter(isHit);\n  useCountdown(SALE_ENDS);',
  );
  inApp = edit(
    inApp,
    'App.tsx',
    "import { isHit } from './shared/gameRules';",
    "import { isHit } from './shared/gameRules';\nimport { useCountdown } from './hooks/useCountdown';\nimport { SALE_ENDS } from './data/sale';",
  );
  const counts = [];
  for (const files of [f, inApp]) {
    const r = await run(files, { waitMs: 1500 });
    await r.fresh();
    await wait(3000);
    counts.push(logLines(await r.fresh()).length);
    await r.page.close();
  }
  expect(
    typeErrors(inApp).length === 0 && same(counts, [0, 36]),
    `7.8 рендеры GameCard за 3 с: хук в баннере — 0, в App — 36 (12 в секунду) (${counts})`,
  );
}

await browser.close();
if (failures.length) {
  console.log(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло');
