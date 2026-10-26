// Проверка утверждений и экспериментов главы 9 «Состояние приложения»: каждый эксперимент из текста —
// на коде того шага, о котором текст. node tools/e2e/checks/ch09-app-state.mjs (нужен npm run dev).
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { CONTENT, OUT, ROOT, collect, compileMap, launch, openPreview, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/09-app-state`;
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
const TC = join(OUT, 'ch09-tc');
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

// ONLY=9.1,9.2 — только эти разделы (и без общей проверки шагов)
const ONLY = process.env.ONLY?.split(',');
const want = (section) => !ONLY || ONLY.includes(section);

// Каждый шаг: консоль пуста, ошибок типов нет
const STEPS = ['01-own-store', '02-zustand', '03-persist', '04-derived', '05-slices', '06-atoms', '09-practice'];
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

// Логи render в шапке, мини-корзине и карточке (как в 8.5)
const withLogs = (f) =>
  logIn(
    logIn(
      logIn(f, 'Header', 'layout/Header.tsx', 'export function Header({ count }: HeaderProps) {'),
      'MiniCart',
      'cart/MiniCart.tsx',
      'export function MiniCart({ games }: MiniCartProps) {',
    ),
    'GameCard',
    'shared/GameCard.tsx',
    'export function GameCard({ game, onSelect }: GameCardProps) {',
  );

// ---------- 9.1 Свой стор ----------
if (want('9.1')) {
  const f = readDir(`${CH}/01-own-store/solution`);
  const r = await run(withLogs(f));
  await r.fresh();
  await addFirst(r.page);
  const add = counts(await r.fresh());
  expect(
    same(add, { 'render Header': 2, 'render MiniCart': 2, 'render GameCard': 4 }),
    `9.1 «В корзину» у «Острова»: Header 2, MiniCart 2, GameCard 4 (${JSON.stringify(add)})`,
  );
  const toastOn = (await r.text()).includes('Добавлено: Остров сокровищ');
  await wait(2700);
  const fade = await r.fresh();
  expect(
    toastOn && fade.length === 0 && !(await r.text()).includes('Добавлено'),
    `9.1 уведомление погасло — ни одной строки (${JSON.stringify(fade)})`,
  );
  // «Драконья почта» — только во «Всех играх»: одна карточка
  await press(r.page, 'В корзину', 'main section:nth-of-type(3)', 1);
  const other = counts(await r.fresh());
  expect(
    same(other, { 'render Header': 2, 'render MiniCart': 2, 'render GameCard': 2 }),
    `9.1 «В корзину» у «Драконьей почты»: GameCard 2 (${JSON.stringify(other)})`,
  );
  await r.page.close();

  // Селектор возвращает новый объект
  const bad = await run(
    edit(
      f,
      'cart/MiniCart.tsx',
      '  const items = useCartStore((state) => state.items);',
      '  const { items } = useCartStore((state) => ({\n    items: state.items,\n  }));',
    ),
  );
  const badLines = await bad.fresh();
  console.log(badLines.map((l) => l.slice(0, 300)));
  expect(
    has(badLines, 'The result of getSnapshot should be cached to avoid an infinite loop') &&
      has(badLines, 'Maximum update depth exceeded'),
    '9.1 селектор с новым объектом: getSnapshot should be cached + Maximum update depth',
  );
  await bad.page.close();

  // Подписки: при запуске — у каждого компонента со стором (StrictMode: подписка, отписка, подписка), при щелчке — ни одной
  const subs = await run(
    edit(
      f,
      'store/cartStore.ts',
      '  listeners.add(listener);\n  return () => {\n    listeners.delete(listener);',
      "  listeners.add(listener);\n  console.log('подписка');\n  return () => {\n    console.log('отписка');\n    listeners.delete(listener);",
    ),
  );
  const subStart = counts(await subs.fresh());
  await addFirst(subs.page);
  const subClick = counts(await subs.fresh());
  expect(
    same(subStart, { подписка: 18, отписка: 9 }) && same(subClick, {}),
    `9.1 подписки: при запуске 18/9 (9 компонентов), при щелчке — ни одной (${JSON.stringify(subStart)} ${JSON.stringify(subClick)})`,
  );
  await subs.page.close();

  // Действие из обычного модуля: стор работает без компонентов
  const outside = await run(
    edit(
      f,
      'main.tsx',
      "import './styles.css';",
      "import './styles.css';\nimport { cartActions } from './store/cartStore';\n\nsetTimeout(() => cartActions.add(4), 500);",
    ),
  );
  await wait(400);
  const t = await outside.text();
  expect(
    t.includes('Корзина: 1') && t.includes('Ночной экспресс') && t.includes('Добавлено: Ночной экспресс'),
    '9.1 cartActions.add из main.tsx — корзина и уведомление обновились',
  );
  await outside.page.close();
}

// ---------- 9.2 Zustand ----------
if (want('9.2')) {
  const f = readDir(`${CH}/02-zustand/solution`);
  const r = await run(withLogs(f));
  await r.fresh();
  await addFirst(r.page);
  const add = counts(await r.fresh());
  await wait(2700);
  const fade = await r.fresh();
  expect(
    same(add, { 'render Header': 2, 'render MiniCart': 2, 'render GameCard': 4 }) && fade.length === 0,
    `9.2 Zustand: те же рендеры, что у своего стора (${JSON.stringify(add)} ${JSON.stringify(fade)})`,
  );
  await r.page.close();

  // Без useShallow — новый объект из селектора
  const noShallow = edit(
    f,
    'cart/MiniCart.tsx',
    '    useShallow((state) => ({\n      add: state.add,\n      decrease: state.decrease,\n      remove: state.remove,\n      clear: state.clear,\n    })),',
    '    (state) => ({\n      add: state.add,\n      decrease: state.decrease,\n      remove: state.remove,\n      clear: state.clear,\n    }),',
  );
  const bad = await run(noShallow);
  const badLines = await bad.fresh();
  console.log(badLines.map((l) => l.slice(0, 200)));
  expect(
    has(badLines, 'The result of getSnapshot should be cached to avoid an infinite loop') &&
      has(badLines, 'Maximum update depth exceeded'),
    '9.2 без useShallow: getSnapshot should be cached + Maximum update depth',
  );
  await bad.page.close();

  // Весь стор без селектора: рендер и от уведомления
  const whole = edit(
    withLogs(f),
    'cart/MiniCart.tsx',
    '  const items = useCartStore((state) => state.items);',
    '  const { items } = useCartStore();',
  );
  const w = await run(whole);
  await w.fresh();
  await addFirst(w.page);
  await w.fresh();
  await wait(2700);
  const wFade = counts(await w.fresh());
  expect(
    same(wFade, { 'render MiniCart': 2 }),
    `9.2 useCartStore() без селектора: уведомление погасло — MiniCart 2 (${JSON.stringify(wFade)})`,
  );
  await w.page.close();

  // getState и subscribe вне React
  const outside = await run(
    edit(
      f,
      'main.tsx',
      "import './styles.css';",
      "import './styles.css';\nimport { useCartStore } from './store/cartStore';\n\nuseCartStore.subscribe((state, prev) =>\n  console.log('было', prev.items.length, 'стало', state.items.length),\n);\nsetTimeout(() => useCartStore.getState().add(4), 500);",
    ),
  );
  await wait(400);
  const oLines = logLines(await outside.fresh());
  const oText = await outside.text();
  console.log(oLines);
  expect(
    oText.includes('Корзина: 1') &&
      oText.includes('Добавлено: Ночной экспресс') &&
      same(oLines, ['было 0 стало 1', 'было 1 стало 1']),
    `9.2 getState().add и subscribe вне React (${JSON.stringify(oLines)})`,
  );
  await outside.page.close();

  // set(…, true) — замена всего состояния: TypeScript не пускает
  const replaceErrors = typeErrors(
    edit(f, 'store/cartStore.ts', 'set({ toast: text });', 'set({ toast: text }, true);'),
  );
  console.log(replaceErrors);
  expect(replaceErrors.length > 0, `9.2 set({ toast }, true) — ошибка типов (${replaceErrors})`);
}

// ---------- 9.3 Сохранение ----------
if (want('9.3')) {
  const f = readDir(`${CH}/03-persist/solution`);
  const OPTIONS =
    '      // Сохраняем только позиции: уведомление после перезапуска не нужно\n      partialize: (state) => ({ items: state.items }),\n      // Версия формата сохранённых данных: меняется — нужна миграция\n      version: 1,\n      // Версия 0 сохраняла всё состояние — берём из него только позиции\n      migrate: (persisted) => {\n        const { items } = persisted as { items: CartItem[] };\n        return { items };\n      },\n';
  // Первый вариант урока: только name
  const v0 = edit(f, 'store/cartStore.ts', OPTIONS, '');
  const v0p = edit(f, 'store/cartStore.ts', OPTIONS, '      partialize: (state) => ({ items: state.items }),\n');
  const storage = (page) => page.evaluate(() => localStorage.getItem('cart'));

  const a = await run(v0);
  await addFirst(a.page);
  const saved0 = await storage(a.page);
  console.log(saved0);
  expect(
    saved0 === '{"state":{"items":[{"gameId":1,"quantity":1}],"toast":"Добавлено: Остров сокровищ"},"version":0}',
    `9.3 persist({ name }) — в хранилище и уведомление, version 0 (${saved0})`,
  );
  await a.page.close();
  // Перезапуск: уведомление застряло
  const b = await run(v0, { keepStorage: true });
  await wait(3000);
  const bt = await b.text();
  expect(
    bt.includes('Корзина: 1') && bt.includes('Добавлено: Остров сокровищ'),
    '9.3 после перезапуска корзина на месте, а «Добавлено» висит и через 3 с',
  );
  await b.page.close();
  // partialize: старые данные всё ещё с уведомлением — висит
  const c = await run(v0p, { keepStorage: true });
  await wait(3000);
  const ct = await c.text();
  const savedP = await storage(c.page);
  expect(
    ct.includes('Добавлено: Остров сокровищ'),
    `9.3 partialize без версии: старое уведомление всё ещё висит (${savedP})`,
  );
  await c.page.close();
  // Решение: version 1 + migrate — уведомления нет, данные переписаны
  const d = await run(f, { keepStorage: true });
  const dt = await d.text();
  const saved1 = await storage(d.page);
  expect(
    dt.includes('Корзина: 1') &&
      !dt.includes('Добавлено') &&
      saved1 === '{"state":{"items":[{"gameId":1,"quantity":1}]},"version":1}',
    `9.3 version 1 + migrate: корзина на месте, уведомления нет, сохранено заново (${saved1})`,
  );
  await d.page.close();

  // version 2 без migrate: запись версии 1 не читается; вернули — корзина на месте
  const noMigrate = edit(
    edit(f, 'store/cartStore.ts', 'version: 1,', 'version: 2,'),
    'store/cartStore.ts',
    '      migrate: (persisted) => {\n        const { items } = persisted as { items: CartItem[] };\n        return { items };\n      },\n',
    '',
  );
  const e = await run(noMigrate, { keepStorage: true });
  const eLines = await e.fresh();
  const et = await e.text();
  expect(
    has(eLines, "State loaded from storage couldn't be migrated since no migrate function was provided") &&
      et.includes('Корзина: 0'),
    `9.3 version 2 без migrate: ошибка в консоли и пустая корзина ${JSON.stringify(eLines)}`,
  );
  await e.page.close();
  const back = await run(f, { keepStorage: true });
  expect((await back.text()).includes('Корзина: 1'), '9.3 вернули version 1 и migrate — корзина снова на месте');
  await back.page.close();

  // Гидрация синхронная: первый же рендер шапки — с сохранённой корзиной
  const first = await run(
    edit(
      f,
      'layout/Header.tsx',
      '  const { theme, toggleTheme } = useTheme();',
      "  console.log('render Header', cartCount);\n  const { theme, toggleTheme } = useTheme();",
    ),
  );
  await addFirst(first.page);
  await first.page.close();
  const g = await run(
    edit(
      f,
      'layout/Header.tsx',
      '  const { theme, toggleTheme } = useTheme();',
      "  console.log('render Header', cartCount);\n  const { theme, toggleTheme } = useTheme();",
    ),
    { keepStorage: true },
  );
  const gLines = logLines(await g.fresh());
  expect(
    same(gLines, ['render Header 1', 'render Header 1']),
    `9.3 после перезапуска первый рендер уже с корзиной (${JSON.stringify(gLines)})`,
  );
  await g.page.close();
}

// ---------- 9.4 Производное состояние ----------
if (want('9.4')) {
  const f = readDir(`${CH}/04-derived/solution`);
  const r = await run(f);
  await addFirst(r.page);
  await addFirst(r.page);
  const t = await r.text();
  expect(
    t.includes('Итого: 3 980 ₽') &&
      t.includes('Скидка по акции: 1 000 ₽') &&
      t.includes('До бесплатной доставки — 1 020 ₽'),
    '9.4 два «Острова»: итог 3 980, скидка 1 000, до доставки 1 020',
  );
  await press(r.page, 'В корзину', 'main section:nth-of-type(3)', 1);
  const t2 = await r.text();
  expect(
    t2.includes('Итого: 5 270 ₽') && t2.includes('Доставка бесплатно'),
    '9.4 + «Драконья почта»: 5 270 ₽, доставка бесплатно',
  );
  await r.page.close();

  const SEL = '  const items = useCartStore((state) => state.items);';
  const USE = '  const { lines, count, total, savings, toFreeDelivery } =\n    summarizeCart(items, games);';
  for (const [name, wrap] of [
    ['без useShallow', (x) => x],
    ['с useShallow', (x) => `useShallow(${x})`],
  ]) {
    let g = edit(
      f,
      'cart/MiniCart.tsx',
      USE,
      `  const { lines, count, total, savings, toFreeDelivery } =\n    useCartStore(${wrap('(state) => summarizeCart(state.items, games)')});`,
    );
    g = edit(g, 'cart/MiniCart.tsx', SEL + '\n', '');
    const bad = await run(g);
    const lines = await bad.fresh();
    expect(
      has(lines, 'The result of getSnapshot should be cached') && has(lines, 'Maximum update depth exceeded'),
      `9.4 summarizeCart в селекторе ${name}: бесконечный цикл ${JSON.stringify(lines.map((l) => l.slice(0, 90)))}`,
    );
    await bad.page.close();
  }
}

// ---------- 9.5 Срезы и devtools ----------
if (want('9.5')) {
  const f = readDir(`${CH}/05-slices/solution`);
  // Поддельное расширение Redux DevTools: модуль импортируется первым и ставит window.__REDUX_DEVTOOLS_EXTENSION__
  const stub = `(window as any).__REDUX_DEVTOOLS_EXTENSION__ = {
  connect: (options: { name: string }) => ({
    init: (state: object) => console.log('init', options.name, Object.keys(state).join(',')),
    send: (action: { type: string }) => console.log('send', action.type),
    subscribe: () => () => {},
    unsubscribe: () => {},
  }),
};
export {};
`;
  const g = {
    ...edit(
      f,
      'main.tsx',
      "import { StrictMode } from 'react';",
      "import './devtoolsStub';\nimport { StrictMode } from 'react';",
    ),
    'devtoolsStub.ts': stub,
  };
  const r = await run(g);
  const start = logLines(await r.fresh());
  await addFirst(r.page);
  await r.page.click('button[aria-label="Убрать одну"]');
  await wait(150);
  await wait(2700);
  const sent = logLines(await r.fresh());
  console.log(start, sent);
  expect(
    same(start, ['send anonymous', 'init Корзина items,add,decrease,remove,clear,toast,showToast']) &&
      same(sent, ['send cart/added', 'send toast/shown', 'send cart/decreased', 'send toast/hidden']),
    `9.5 devtools: чтение хранилища persist — anonymous, init с именем стора, действия с именами (${JSON.stringify([start, sent])})`,
  );
  await r.page.close();
  const noDev = typeErrors(edit(f, 'store/cartStore.ts', "  ['zustand/devtools', never],\n", ''));
  console.log(noDev);
  expect(
    noDev.some(
      (e) => e.startsWith('store/toastSlice.ts') && e.includes('TS2554: Expected 1-2 arguments, but got 3.'),
    ) && noDev.some((e) => e.startsWith('store/cartSlice.ts')),
    '9.5 без devtools в CartMiddlewares: TS2554 в срезах',
  );
  // Без расширения — тишина (проверено общим прогоном шагов). Без имени действия — anonymous или имя функции
  const anon = await run(
    edit(g, 'store/toastSlice.ts', "set({ toast: text }, undefined, 'toast/shown');", 'set({ toast: text });'),
  );
  await anon.fresh();
  await addFirst(anon.page);
  const anonSent = logLines(await anon.fresh());
  console.log(anonSent);
  expect(
    anonSent.length === 2 && anonSent[0] === 'send cart/added',
    `9.5 set без имени действия: ${JSON.stringify(anonSent)}`,
  );
  await anon.page.close();
}

// ---------- 9.6 Атомы ----------
// Ввод в поле поиска (React-совместимо: нативный сеттер + input)
async function typeSearch(page, value) {
  await page.evaluate((value) => {
    const input = document.querySelector('input[type="search"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
  await wait(500);
}
async function selectCategory(page, value) {
  await page.evaluate((value) => {
    const select = document.querySelectorAll('select')[0];
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
  await wait(200);
}
const cardsIn = (page) => page.$$eval('main section:nth-of-type(3) article', (as) => as.length);
if (want('9.6')) {
  const f = readDir(`${CH}/06-atoms/solution`);
  const r = await run(f);
  await typeSearch(r.page, 'zzz');
  const empty = (await r.text()).includes('Ничего не нашлось');
  await press(r.page, 'Сбросить фильтры');
  const focused = await r.page.evaluate(() => document.activeElement?.getAttribute('type'));
  await wait(400);
  const afterReset = await cardsIn(r.page);
  expect(
    empty && focused === 'search' && afterReset === 3,
    `9.6 «zzz» → пусто → сброс: фокус в поиске, 3 карточки (${focused}, ${afterReset})`,
  );
  for (let i = 0; i < 3; i++) {
    await r.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(300);
  }
  const more = await cardsIn(r.page);
  await selectCategory(r.page, 'family');
  const fam = await cardsIn(r.page);
  const famText = await r.text();
  console.log(more, fam);
  expect(more === 6 && fam <= 3, `9.6 «Показать ещё» → 6, смена категории → снова первая порция (${more} → ${fam})`);
  expect((await r.fresh()).length === 0, '9.6 консоль пуста');
  await r.page.close();

  // Производный атом пересчитывается только при смене зависимостей
  const logged = edit(
    f,
    'catalog/filterAtoms.ts',
    'export const filtersAtom = atom<Filters>((get) => ({',
    "export const filtersAtom = atom<Filters>((get) => {\n  console.log('считаем filtersAtom');\n  return {",
  );
  const g = edit(
    edit(logged, 'catalog/filterAtoms.ts', '  sort: get(sortAtom),\n}));', '  sort: get(sortAtom),\n  };\n});'),
    'App.tsx',
    '  const filters = useAtomValue(filtersAtom);',
    "  const filters = useAtomValue(filtersAtom);\n  console.log('render App');",
  );
  const d = await run(g);
  const dStart = counts(await d.fresh());
  await typeSearch(d.page, 'о');
  const dType = counts(await d.fresh());
  await d.page.evaluate(() => document.querySelector('main section:nth-of-type(2) article h3 button').click());
  await wait(200);
  const dOpen = counts(await d.fresh());
  console.log(dStart, dType, dOpen);
  expect(
    dStart['считаем filtersAtom'] === 1 &&
      dType['считаем filtersAtom'] === 1 &&
      !dOpen['считаем filtersAtom'] &&
      dOpen['render App'] >= 2,
    `9.6 filtersAtom: при запуске 1, буква — 1, открыли игру — 0 при рендере App (${JSON.stringify([dStart, dType, dOpen])})`,
  );
  await d.page.close();

  // Тот же атом в другом компоненте — общее значение
  const shared = edit(
    edit(
      f,
      'layout/Header.tsx',
      "import { useTheme } from '../theme/ThemeContext';",
      "import { useTheme } from '../theme/ThemeContext';\nimport { useAtomValue } from 'jotai';\nimport { queryAtom } from '../catalog/filterAtoms';",
    ),
    'layout/Header.tsx',
    '  const { theme, toggleTheme } = useTheme();',
    "  const query = useAtomValue(queryAtom);\n  console.log('Header: ищем', query);\n  const { theme, toggleTheme } = useTheme();",
  );
  const sh = await run(shared);
  await sh.fresh();
  await typeSearch(sh.page, 'ост');
  const shLines = logLines(await sh.fresh());
  console.log(shLines);
  expect(
    shLines.length >= 2 && shLines.every((l) => l === 'Header: ищем ост'),
    `9.6 queryAtom в шапке — то же значение (${JSON.stringify(shLines)})`,
  );
  await sh.page.close();
}

// ---------- 9.7 Под капотом ----------
const DEMO_97 = `import { useEffect, useLayoutEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { selectCartCount } from './store/cartSelectors';
import { useCartStore } from './store/cartStore';

console.log(Object.keys(useCartStore));

// Подписка «по-старому»: копия в состоянии + подписка в эффекте
function useNaiveCount() {
  const [count, setCount] = useState(() =>
    selectCartCount(useCartStore.getState()),
  );
  useEffect(
    () =>
      useCartStore.subscribe((state) =>
        setCount(selectCartCount(state)),
      ),
    [],
  );
  return count;
}

function Naive() {
  return <p>Эффект: {useNaiveCount()}</p>;
}

function Synced() {
  const count = useCartStore(selectCartCount);
  return <p>useSyncExternalStore: {count}</p>;
}

// Меняет стор сразу после фиксации — раньше эффектов подписки
function Bump() {
  useLayoutEffect(() => {
    useCartStore.getState().add(1);
  }, []);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <>
    <Naive />
    <Synced />
    <Bump />
  </>,
);
`;
if (want('9.7')) {
  const f = readDir(`${CH}/06-atoms/solution`);
  const r = await run({ ...f, 'main.tsx': DEMO_97 });
  const lines = await r.fresh();
  const t = await r.text();
  console.log(lines, t);
  expect(
    t.includes('Эффект: 0') && t.includes('useSyncExternalStore: 1'),
    `9.7 подписка в эффекте пропустила изменение: ${t}`,
  );
  expect(
    has(lines, '["setState", "getState", "getInitialState", "subscribe", "persist"]'),
    `9.7 ключи хука: ${JSON.stringify(lines)}`,
  );
  await r.page.close();
  // Jotai: useReducer + useEffect, но после подписки сверяет значение — изменение не потеряно
  const jotaiDemo = `import { useLayoutEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { atom, useAtomValue, useSetAtom } from 'jotai';

const countAtom = atom(0);

function Value() {
  return <p>Jotai: {useAtomValue(countAtom)}</p>;
}

function Bump() {
  const setCount = useSetAtom(countAtom);
  useLayoutEffect(() => {
    setCount(1);
  }, [setCount]);
  return null;
}

createRoot(document.getElementById('root')!).render(
  <>
    <Value />
    <Bump />
  </>,
);
`;
  const j = await run({ 'main.tsx': jotaiDemo });
  expect((await j.text()).includes('Jotai: 1'), `9.7 Jotai после изменения в layout-эффекте: ${await j.text()}`);
  await j.page.close();
}

// ---------- 9.9 Практикум ----------
async function promo(page, code) {
  await page.evaluate((code) => {
    const input = document.querySelector('input[name="promo"]');
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, code);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, code);
  await press(page, 'Применить');
}
const cardText = (page, title) =>
  page.evaluate(
    (title) => document.querySelector(`main section:nth-of-type(2) img[alt="${title}"]`).closest('article').innerText,
    title,
  );
if (want('9.9')) {
  const f = readDir(`${CH}/09-practice/solution`);
  const r = await run(f);
  // «Ночной экспресс» — второй в «Хитах», на складе 3
  for (let i = 0; i < 4; i++) await press(r.page, 'В корзину', 'main section:nth-of-type(2)', 1);
  const card = (await cardText(r.page, 'Ночной экспресс')).replace(/ /g, ' ');
  const t = await r.text();
  expect(
    card.includes('В корзине: 3 шт.') && t.includes('Больше нет: на складе 3 шт.') && t.includes('Корзина: 3'),
    `9.9 четвёртый «Ночной экспресс» — 3 шт. и «Больше нет» (${card.slice(-40)})`,
  );
  await promo(r.page, 'скидка');
  expect((await r.text()).includes('Нет такого промокода'), '9.9 неверный код — «Нет такого промокода»');
  await promo(r.page, ' ходконём ');
  const t2 = await r.text();
  console.log(t2.slice(t2.indexOf('Итого'), t2.indexOf('Очистить')));
  expect(
    t2.includes('Итого: 9 570 ₽') &&
      t2.includes('Промокод ХОДКОНЁМ: −957 ₽') &&
      t2.includes('К оплате: 8 613 ₽') &&
      !t2.includes('Нет такого') &&
      !t2.includes('Применить'),
    '9.9 ХОДКОНЁМ (без регистра и пробелов): −957 ₽, к оплате 8 613 ₽, поле скрыто',
  );
  // Перезапуск — промокод на месте
  await r.page.close();
  const r2 = await run(f, { keepStorage: true });
  const saved = await r2.page.evaluate(() => localStorage.getItem('cart'));
  expect((await r2.text()).includes('К оплате: 8 613 ₽'), `9.9 после перезапуска промокод на месте (${saved})`);
  // Убрать две — 3 190 ₽ ≥ 3 000, ещё одну — пусто: промокод снят
  await r2.page.click('button[aria-label="Убрать одну"]');
  await wait(150);
  await r2.page.click('button[aria-label="Убрать одну"]');
  await wait(150);
  const t3 = await r2.text();
  expect(
    t3.includes('Промокод ХОДКОНЁМ: −319 ₽') && t3.includes('К оплате: 2 871 ₽'),
    '9.9 один экспресс (3 190 ₽): промокод действует, −319 ₽',
  );
  await r2.page.close();
  // Ниже порога — снимается
  const r3 = await run(f);
  await addFirst(r3.page);
  await addFirst(r3.page);
  await promo(r3.page, 'ХОДКОНЁМ');
  const before = (await r3.text()).includes('К оплате: 3 582 ₽');
  await r3.page.click('button[aria-label="Убрать одну"]');
  await wait(150);
  const t4 = await r3.text();
  expect(
    before &&
      t4.includes('Промокод снят: сумма меньше 3 000 ₽') &&
      !t4.includes('К оплате') &&
      t4.includes('Применить'),
    '9.9 «Остров» ×2 → промокод → «−»: 1 990 ₽, «Промокод снят: сумма меньше 3 000 ₽»',
  );
  await promo(r3.page, 'ХОДКОНЁМ');
  expect(
    (await r3.text()).includes('Промокод действует от 3 000 ₽'),
    '9.9 ниже порога: «Промокод действует от 3 000 ₽»',
  );
  expect((await r3.fresh()).length === 0, '9.9 консоль пуста');
  await r3.page.close();
  // «+» в мини-корзине и пять add из таймера — правило склада одно
  const r4 = await run(
    edit(
      f,
      'main.tsx',
      "import './styles.css';",
      "import './styles.css';\nimport { useCartStore } from './store/cartStore';\n\nsetTimeout(() => {\n  for (let i = 0; i < 5; i++) useCartStore.getState().add(4);\n}, 500);",
    ),
  );
  await wait(400);
  const t5 = await r4.text();
  await r4.page.click('button[aria-label="Добавить ещё"]');
  await wait(150);
  const t6 = await r4.text();
  expect(
    t5.includes('Корзина: 3') && t5.includes('Больше нет: на складе 3 шт.') && t6.includes('Корзина: 3'),
    '9.9 пять add из таймера и «+» — всё равно 3 экспресса',
  );
  await r4.page.close();
}

await browser.close();
console.log(failures.length ? `\nПровалено: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
