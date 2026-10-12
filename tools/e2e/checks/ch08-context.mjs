// Проверка утверждений и экспериментов главы 8 «Контекст»: каждый эксперимент из текста —
// на коде того шага, о котором текст. node tools/e2e/checks/ch08-context.mjs (нужен npm run dev).
// Сообщения ESLint (шаги 8.3, 8.5) проверены в scratchpad — линтера в проекте нет (authoring-process.md, ловушки)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { CONTENT, OUT, ROOT, collect, compileMap, launch, openPreview, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/08-context`;
const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};
const browser = await launch();
const preview = (logs) => logs.filter((l) => l.startsWith('[preview:') || l.startsWith('[runtime-error]'));
const has = (lines, text) => lines.some((l) => l.includes(text));
const edit = (files, name, from, to) => {
  if (!files[name].includes(from)) throw new Error(`${name}: нет «${from}»`);
  return { ...files, [name]: files[name].replace(from, to) };
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
// Сколько раз напечатана каждая строка лога: { 'render Header': 2, … }
const counts = (lines) => {
  const result = {};
  for (const line of logLines(lines)) result[line] = (result[line] ?? 0) + 1;
  return result;
};

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
// «В корзину» у первой карточки «Хитов» («Остров сокровищ»)
const addFirst = (page) => press(page, 'В корзину', 'main section:nth-of-type(2)');
// Лог «render X» в начале компонента: anchor — строка, после которой вставить
const logIn = (files, name, file, anchor) => edit(files, file, anchor, `${anchor}\n  console.log('render ${name}');`);
// Карточки с «В корзине: 1 шт.» по порядку на странице
const inCart = (page) => page.$$eval('main article', (as) => as.map((a) => a.innerText.includes('В корзине: 1 шт.')));

// Ошибки типов полного кода — как в редакторе: «App.tsx:5 — TS2322: …» (настройки tsconfig.content.json)
const TC = join(OUT, 'ch08-tc');
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

// ONLY=8.4,8.5 — только эти разделы (и без общей проверки шагов)
const ONLY = process.env.ONLY?.split(',');
const want = (section) => !ONLY || ONLY.includes(section);

// Каждый шаг: консоль пуста, ошибок типов нет
const STEPS = [
  '01-prop-drilling',
  '02-create-context',
  '03-use-context',
  '04-context-reducer',
  '05-context-cost',
  '06-when-context',
  '08-practice',
];
for (const step of ONLY ? [] : STEPS) {
  const files = readDir(`${CH}/${step}/solution`);
  const errors = typeErrors(files);
  const r = await run(files);
  await addFirst(r.page);
  const lines = await r.fresh();
  expect(
    errors.length === 0 && lines.length === 0 && same((await inCart(r.page)).slice(0, 1), [true]),
    `${step}: «В корзину» работает, консоль пуста, без ошибок типов ${JSON.stringify([...errors, ...lines])}`,
  );
  await r.page.close();
}

// ---------- 8.1 Проброс props ----------
if (want('8.1')) {
  const f = readDir(`${CH}/01-prop-drilling/solution`);
  const errors = typeErrors(edit(f, 'catalog/GameGrid.tsx', '          onAdd={() => onAdd(game.id)}\n', ''));
  expect(
    typeHas(
      errors,
      "TS2741: Property 'onAdd' is missing in type '{ key: number; game: Game; quantity: number; onSelect: () => void; }' but required in type 'GameCardProps'.",
    ) && typeHas(errors, "TS6133: 'onAdd' is declared but its value is never read."),
    `8.1 без onAdd в GameGrid: TS2741 и TS6133 (${errors})`,
  );
  const app = f['App.tsx'];
  expect(
    (app.match(/<GameGrid/g) ?? []).length === 2 && !app.includes('<GameCard') && !/<Section[^>]*quantity/.test(app),
    '8.1 App: две сетки GameGrid, Section корзину не получает',
  );
}

// ---------- 8.2 createContext ----------
const s2 = readDir(`${CH}/02-create-context/solution`);
// Одна карточка в main.tsx вместо App
const cardOnly = (files) =>
  edit(
    edit(
      files,
      'main.tsx',
      "import { App } from './App';",
      "import { GameCard } from './shared/GameCard';\nimport { games } from './data/games';",
    ),
    'main.tsx',
    '<App />',
    '<GameCard game={games[0]} onSelect={() => {}} />',
  );
if (want('8.2')) {
  const errors = typeErrors(
    edit(
      s2,
      'shared/GameCard.tsx',
      "  if (cart === null) {\n    throw new Error('GameCard нужен провайдер CartContext');\n  }\n",
      '',
    ),
  );
  expect(
    errors.length === 2 && errors.every((e) => e.includes("TS18047: 'cart' is possibly 'null'.")),
    `8.2 без проверки на null — дважды TS18047 (${errors})`,
  );
  let r = await run(cardOnly(s2));
  let lines = await r.fresh();
  expect(
    has(lines, 'Error: GameCard нужен провайдер CartContext') &&
      has(lines, 'shared/GameCard.tsx') &&
      (await r.text()) === '',
    '8.2 карточка вне провайдера: наша ошибка со строкой GameCard.tsx, экран пуст',
  );
  await r.page.close();

  const stub = edit(
    cardOnly(s2),
    'cart/CartContext.ts',
    'export const CartContext =\n  createContext<CartContextValue | null>(null);',
    `export const CartContext = createContext<CartContextValue>({
  items: [],
  add: () => {},
  decrease: () => {},
  remove: () => {},
  clear: () => {},
});`,
  );
  r = await run(stub);
  await press(r.page, 'В корзину');
  lines = await r.fresh();
  const text = await r.text();
  expect(
    typeErrors(stub).length === 0 &&
      lines.length === 0 &&
      text.includes('Остров сокровищ') &&
      !text.includes('В корзине'),
    '8.2 заглушка по умолчанию: карточка без ошибок, «В корзину» молча ничего не делает',
  );
  await r.page.close();

  const noValue = edit(s2, 'App.tsx', '<CartContext value={cartValue}>', '<CartContext>');
  const errs = typeErrors(noValue);
  r = await run(noValue);
  lines = await r.fresh();
  expect(
    typeHas(
      errs,
      "TS2741: Property 'value' is missing in type '{ children: (false | Element)[]; }' but required in type 'ProviderProps<CartContextValue | null>'.",
    ) &&
      has(
        lines,
        'The `value` prop is required for the `<Context.Provider>`. Did you misspell it or forget to pass it?',
      ) &&
      has(lines, "TypeError: Cannot read properties of undefined (reading 'items')"),
    `8.2 провайдер без value: TS2741, предупреждение React и undefined вместо null (${errs})`,
  );
  await r.page.close();
}

// ---------- 8.3 use и useContext ----------
if (want('8.3')) {
  const s3 = readDir(`${CH}/03-use-context/solution`);
  // Напоминание о корзине в подвале после подписки: read — use(CartContext), useContext(CartContext) или useCart()
  const reminder = (read, imports) => {
    let f = edit(s3, 'layout/Footer.tsx', "import { useState } from 'react';", imports);
    f = edit(
      f,
      'layout/Footer.tsx',
      '  function handleSubmit(',
      `  // После подписки — напоминание о корзине
  let reminder = '';
  if (result !== null) {
    const cart = ${read};
    reminder = \`В корзине позиций: \${cart?.items.length}\`;
  }

  function handleSubmit(`,
    );
    return edit(f, 'layout/Footer.tsx', '      {result && (', '      <p>{reminder}</p>\n      {result && (');
  };
  const subscribe = async (files) => {
    const r = await run(files);
    await addFirst(r.page);
    await r.fresh();
    await r.page.type('input[type=email]', 'a@b.ru');
    await press(r.page, 'Подписаться');
    const lines = await r.fresh();
    const text = await r.text();
    await r.page.close();
    return { lines, text };
  };
  const ctx = "import { CartContext } from '../cart/CartContext';";
  let f = reminder('use(CartContext)', `import { use, useState } from 'react';\n${ctx}`);
  let res = await subscribe(f);
  expect(
    typeErrors(f).length === 0 && res.lines.length === 0 && res.text.includes('В корзине позиций: 1'),
    '8.3 use в условии: «В корзине позиций: 1», консоль пуста',
  );
  f = reminder('useContext(CartContext)', `import { useContext, useState } from 'react';\n${ctx}`);
  res = await subscribe(f);
  const table = res.lines.find((l) => l.includes('change in the order of Hooks called by Footer')) ?? '';
  expect(
    table.includes('1. useState                   useState') &&
      table.includes('2. undefined                  useContext') &&
      res.text.includes('В корзине позиций: 1'),
    '8.3 useContext в условии: таблица (2. undefined → useContext), значение верное',
  );
  f = reminder('useCart()', "import { useState } from 'react';\nimport { useCart } from '../cart/CartContext';");
  res = await subscribe(f);
  expect(res.lines.length === 0 && res.text.includes('В корзине позиций: 1'), '8.3 useCart в условии: консоль пуста');

  const headerOnly = edit(
    edit(s3, 'main.tsx', "import { App } from './App';", "import { Header } from './layout/Header';"),
    'main.tsx',
    '<App />',
    '<Header count={6} />',
  );
  const r = await run(headerOnly);
  const lines = await r.fresh();
  const error = lines.find((l) => l.includes('Error: useCart: выше по дереву нет провайдера корзины')) ?? '';
  expect(
    error.includes('at useCart (cart/CartContext.ts') && error.includes('at Header (layout/Header.tsx'),
    '8.3 шапка вне провайдера: ошибка useCart, в стеке useCart и Header',
  );
  await r.page.close();
}

// ---------- 8.4 Контекст и редьюсер ----------
const s4 = readDir(`${CH}/04-context-reducer/solution`);
if (want('8.4')) {
  let f = logIn(s4, 'App', 'App.tsx', 'export function App() {');
  f = logIn(
    f,
    'CartProvider',
    'cart/CartProvider.tsx',
    'export function CartProvider({ children }: CartProviderProps) {',
  );
  let r = await run(f);
  const start = counts(await r.fresh());
  await addFirst(r.page);
  const click = counts(await r.fresh());
  expect(
    same(start, { 'render App': 2, 'render CartProvider': 2 }) && same(click, { 'render CartProvider': 2 }),
    `8.4 «В корзину»: только CartProvider ×2, App — ни разу (${JSON.stringify([start, click])})`,
  );
  await r.page.close();

  f = edit(
    s4,
    'App.tsx',
    '        <MiniCart games={games} />',
    '        <CartProvider>\n          <MiniCart games={games} />\n        </CartProvider>',
  );
  r = await run(f);
  await addFirst(r.page);
  const text = await r.text();
  expect(
    text.includes('Корзина: 1') && text.includes('Корзина пуста') && (await inCart(r.page))[0],
    '8.4 второй провайдер у мини-корзины: шапка «Корзина: 1», мини-корзина пуста, карточка «В корзине: 1»',
  );
  await r.page.close();
  const app = s4['App.tsx'];
  expect(
    !app.includes('useImmerReducer') && !app.includes('toast') && !s4['App.module.css'].includes('.toast'),
    '8.4 в App нет редьюсера корзины и уведомления',
  );
}

// ---------- 8.5 Цена контекста ----------
if (want('8.5')) {
  // Логи потребителей: шапка, мини-корзина, карточка
  const consumers = (files) => {
    let f = logIn(files, 'Header', 'layout/Header.tsx', 'export function Header({ count }: HeaderProps) {');
    f = logIn(f, 'MiniCart', 'cart/MiniCart.tsx', 'export function MiniCart({ games }: MiniCartProps) {');
    return logIn(f, 'GameCard', 'shared/GameCard.tsx', '}: GameCardProps) {');
  };
  // Строк лога: после «В корзину» и после того, как погасло уведомление
  const measure = async (files) => {
    const r = await run(consumers(files));
    await r.fresh();
    await addFirst(r.page);
    const click = counts(await r.fresh());
    await wait(2700);
    const hidden = counts(await r.fresh());
    await r.page.close();
    return { click, hidden };
  };
  const ALL = { 'render Header': 2, 'render MiniCart': 2, 'render GameCard': 12 };
  const before = await measure(s4);
  expect(
    same(before.click, ALL) && same(before.hidden, ALL),
    `8.5 без приёмов: «В корзину» — 16 строк, погасло уведомление — те же 16 (${JSON.stringify(before)})`,
  );
  const s5 = readDir(`${CH}/05-context-cost/solution`);
  // Разделение без useMemo: действия — новый объект при каждом рендере
  let split = edit(s5, 'cart/CartProvider.tsx', 'useMemo<CartActions>(\n    () => (', '((');
  split = edit(split, 'cart/CartProvider.tsx', '}),\n    [dispatch, showToast],\n  );', '}));');
  const splitOnly = await measure(split);
  expect(
    same(splitOnly.click, ALL) && same(splitOnly.hidden, { 'render MiniCart': 2, 'render GameCard': 12 }),
    `8.5 разделение без useMemo: погасло уведомление — 14 строк, шапки нет (${JSON.stringify(splitOnly)})`,
  );
  const after = await measure(s5);
  expect(
    same(after.click, ALL) && same(after.hidden, {}),
    `8.5 разделение + useMemo: погасло уведомление — ни одной строки (${JSON.stringify(after)})`,
  );
  // showToast без useCallback: useMemo пересчитывается на каждом рендере
  let plain = edit(
    s5,
    'cart/CartProvider.tsx',
    'const showToast = useCallback((text: string) => {',
    'function showToast(text: string) {',
  );
  plain = edit(plain, 'cart/CartProvider.tsx', '  }, []);\n', '  }\n');
  plain = edit(plain, 'cart/CartProvider.tsx', 'useCallback, ', '');
  const noCallback = await measure(plain);
  expect(
    typeErrors(plain).length === 0 && same(noCallback.hidden, { 'render MiniCart': 2, 'render GameCard': 12 }),
    `8.5 showToast без useCallback: погасло уведомление — снова 12 строк карточек (${JSON.stringify(noCallback)})`,
  );
}

// ---------- 8.6 Когда нужен контекст ----------
const s6 = readDir(`${CH}/06-when-context/solution`);
const themeButton = '☾ Тёмная тема';
if (want('8.6')) {
  let r = await run(s6);
  const pressed = () => r.page.$eval('header button', (b) => b.getAttribute('aria-pressed'));
  const light = [await pressed(), await r.page.evaluate(() => document.documentElement.dataset.theme)];
  await press(r.page, themeButton);
  const dark = [
    await pressed(),
    await r.page.evaluate(() => [
      document.documentElement.dataset.theme,
      localStorage.getItem('theme'),
      getComputedStyle(document.body).backgroundColor,
    ]),
  ];
  await r.page.close();
  r = await run(s6, { keepStorage: true });
  const reloaded = [await pressed(), await r.page.evaluate(() => document.documentElement.dataset.theme)];
  await press(r.page, themeButton);
  const back = await r.page.evaluate(() => [document.documentElement.dataset.theme, localStorage.getItem('theme')]);
  expect(
    same(light, ['false', 'light']) &&
      same(dark, ['true', ['dark', '"dark"', 'rgb(28, 28, 30)']]) &&
      same(reloaded, ['true', 'dark']) &&
      same(back, ['light', '"light"']),
    `8.6 тема: кнопка-переключатель, data-theme, тёмный фон, переживает ⟳ (${JSON.stringify([light, dark, reloaded, back])})`,
  );
  await r.page.close();

  let f = logIn(s6, 'App', 'App.tsx', 'export function App() {');
  f = logIn(f, 'Header', 'layout/Header.tsx', 'export function Header({ count }: HeaderProps) {');
  f = logIn(f, 'GameCard', 'shared/GameCard.tsx', '}: GameCardProps) {');
  f = logIn(f, 'ThemeProvider', 'theme/ThemeProvider.tsx', '}: ThemeProviderProps) {');
  r = await run(f);
  await r.fresh();
  await press(r.page, themeButton);
  const toggle = counts(await r.fresh());
  await r.page.type('main input', 'а');
  await wait(500);
  const typed = counts(await r.fresh());
  expect(
    same(toggle, { 'render ThemeProvider': 2, 'render Header': 2 }) &&
      !typed['render ThemeProvider'] &&
      typed['render App'] > 0 &&
      typed['render GameCard'] > 0,
    `8.6 смена темы — ThemeProvider и Header по 2; ввод — без ThemeProvider (${JSON.stringify([toggle, typed])})`,
  );
  await r.page.close();
}

// ---------- 8.7 Под капотом: как React находит провайдер ----------
if (want('8.7')) {
  const md = readFileSync(`${CH}/07-under-the-hood/lesson.md`, 'utf8');
  const [imports, probe] = [...md.matchAll(/```tsx main\.tsx\n([\s\S]*?)```/g)].map((m) => m[1]);
  const s7 = readDir(`${CH}/07-under-the-hood/start`);
  const files = { ...s7, 'main.tsx': imports + s7['main.tsx'] + probe };
  expect(typeErrors(files).length === 0, `8.7 код датчика без ошибок типов ${typeErrors(files)}`);
  const expected = md
    .slice(md.indexOf('Консоль:'))
    .match(/```\n([\s\S]*?)```/)[1]
    .trim()
    .split('\n');
  let r = await run(files);
  await wait(600);
  const lines = logLines(await r.fresh());
  expect(same(lines, expected), `8.7 вывод датчика как в тексте (${JSON.stringify(lines)})`);
  await r.page.close();

  const noStrict = {
    ...files,
    'main.tsx': files['main.tsx']
      .replace("import { StrictMode } from 'react';\n", '')
      .replace('  <StrictMode>\n', '')
      .replace('  </StrictMode>,\n', ''),
  };
  r = await run(noStrict);
  await wait(600);
  const single = logLines(await r.fresh()).filter((l) => l.includes(' читает '));
  expect(
    same(single, [
      'Header читает CartContext, ThemeContext | хуки: null',
      'MiniCart читает CartContext, CartActionsContext | хуки: ["useRef"]',
      'GameCard читает CartContext, CartActionsContext | хуки: null',
    ]),
    `8.7 без StrictMode — каждый контекст по одному разу (${JSON.stringify(single)})`,
  );
  await r.page.close();

  let nested = edit(
    s7,
    'App.tsx',
    '        <MiniCart games={games} />',
    '        <CartContext value={[]}>\n          <MiniCart games={games} />\n        </CartContext>',
  );
  nested = edit(
    nested,
    'App.tsx',
    "import { CartProvider } from './cart/CartProvider';",
    "import { CartContext } from './cart/CartContext';\nimport { CartProvider } from './cart/CartProvider';",
  );
  r = await run(nested);
  await addFirst(r.page);
  const text = await r.text();
  expect(
    typeErrors(nested).length === 0 &&
      text.includes('Корзина пуста') &&
      same(await inCart(r.page), [true, false, false, true, false, false]),
    '8.7 вложенный провайдер: мини-корзина пуста, обе карточки «Острова» после неё — «В корзине: 1 шт.»',
  );
  await r.page.close();
}

// ---------- 8.8 Практикум: избранное ----------
if (want('8.8')) {
  const s8 = readDir(`${CH}/08-practice/solution`);
  let r = await run(s8);
  const hearts = () =>
    r.page.$$eval('main article button[aria-label="В избранное"]', (bs) =>
      bs.map((b) => `${b.getAttribute('aria-pressed')}${b.textContent}`),
    );
  const counter = () => r.page.$eval('header [title="Избранное"]', (p) => p.textContent.replace(/\s+/g, ' ').trim());
  const empty = [await hearts(), await counter()];
  await r.page.click('main article button[aria-label="В избранное"]');
  await wait(150);
  const one = [await hearts(), await counter(), await r.page.evaluate(() => localStorage.getItem('favorites'))];
  await r.page.close();
  r = await run(s8, { keepStorage: true });
  const kept = [await hearts(), await counter()];
  await r.page.click('main article button[aria-label="В избранное"]');
  await wait(150);
  const off = await counter();
  expect(
    same(empty, [Array(6).fill('false♡'), '♥ 0']) &&
      same(one, [['true♥', 'false♡', 'false♡', 'true♥', 'false♡', 'false♡'], '♥ 1', '[1]']) &&
      same(kept, one.slice(0, 2)) &&
      off === '♥ 0',
    `8.8 сердечко в «Хитах» и «Всех играх», «♥ 1», переживает ⟳ (${JSON.stringify([empty, one, kept, off])})`,
  );
  await r.page.close();

  let f = logIn(s8, 'App', 'App.tsx', 'export function App() {');
  f = logIn(f, 'Header', 'layout/Header.tsx', 'export function Header({ count }: HeaderProps) {');
  f = logIn(f, 'GameCard', 'shared/GameCard.tsx', '}: GameCardProps) {');
  r = await run(f);
  await r.fresh();
  await r.page.click('main article button[aria-label="В избранное"]');
  await wait(150);
  const click = counts(await r.fresh());
  expect(
    same(click, { 'render Header': 2, 'render GameCard': 12 }),
    `8.8 сердечко: шапка ×2 и 12 строк карточек, App — ни одной (${JSON.stringify(click)})`,
  );
  await r.page.close();
}

await browser.close();
if (failures.length) {
  console.log(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло');
