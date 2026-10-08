// Проверка утверждений и экспериментов главы 4 «Состояние и события»: каждый эксперимент из текста — на коде
// того шага, о котором текст. node tools/e2e/checks/ch04-state.mjs (нужен npm run dev)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { CONTENT, OUT, ROOT, collect, compileMap, launch, openPreview, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/04-state`;
const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};
const browser = await launch();
const preview = (logs) => logs.filter((l) => l.startsWith('[preview:') || l.startsWith('[runtime-error]'));
const has = (logs, text) => preview(logs).some((l) => l.includes(text));
const edit = (files, name, from, to) => {
  if (!files[name].includes(from)) throw new Error(`${name}: нет «${from}»`);
  return { ...files, [name]: files[name].replace(from, to) };
};
const append = (files, name, code) => ({ ...files, [name]: `${files[name]}\n${code}\n` });
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
const inCart = async (r) => (await r.text()).match(/В корзине: \d+/g) ?? [];

// Щелчок по кнопке карточки: section — номер раздела в <main> (по порядку), title — название игры
async function add(page, title, section) {
  await page.evaluate(
    (title, section) => {
      const card = [...document.querySelectorAll(`main > section:nth-of-type(${section}) article`)].find(
        (a) => a.querySelector('h3').textContent === title,
      );
      card.querySelector('button').click();
    },
    title,
    section,
  );
  await wait(150);
}

// Ошибки типов полного кода — как в редакторе: «App.tsx:5 — TS2322: …» (настройки tsconfig.content.json)
const TC = join(OUT, 'ch04-tc');
function typeErrors(files) {
  rmSync(TC, { recursive: true, force: true });
  for (const [name, text] of Object.entries(files)) {
    mkdirSync(dirname(join(TC, name)), { recursive: true });
    writeFileSync(join(TC, name), text);
  }
  const config = ts.getParsedCommandLineOfConfigFile(
    join(ROOT, 'tsconfig.content.json'),
    {},
    {
      ...ts.sys,
      onUnRecoverableConfigFileDiagnostic: () => {},
    },
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

const RENDER_LOG = "  console.log('render', game.title, quantity);\n";
const withRenderLog = (files) =>
  edit(
    files,
    'shared/GameCard.tsx',
    '  const [quantity, setQuantity] = useState(0);\n',
    `  const [quantity, setQuantity] = useState(0);\n${RENDER_LOG}`,
  );

// ---------- 4.1 Проблема: обычная переменная ----------
const s1 = readDir(`${CH}/01-problem/solution`);
{
  const r = await run(s1);
  expect(
    (await inCart(r)).length === 9 && (await inCart(r)).every((t) => t === 'В корзине: 0'),
    '4.1 под каждой кнопкой «В корзине: 0 шт.»',
  );
  expect((await r.fresh()).length === 0, '4.1 консоль пуста при запуске');
  expect(typeErrors(s1).length === 0, '4.1 без ошибок типов');
  for (let i = 0; i < 3; i++) await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['Остров сокровищ: в корзине 1', 'Остров сокровищ: в корзине 2', 'Остров сокровищ: в корзине 3']) &&
      (await inCart(r)).every((t) => t === 'В корзине: 0'),
    `4.1 три щелчка: лог 1, 2, 3, на экране 0 (${JSON.stringify(lines)})`,
  );
}
{
  let f = edit(
    s1,
    'shared/GameCard.tsx',
    '  // Сколько штук этой игры в корзине — пока обычная переменная\n  let quantity = 0;\n',
    '',
  );
  f = edit(f, 'shared/GameCard.tsx', 'const FEW_LEFT = 5;', 'const FEW_LEFT = 5;\nlet quantity = 0;');
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 2);
  await add(r.page, 'Остров сокровищ', 2);
  await add(r.page, 'Нарды', 2);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['Остров сокровищ: в корзине 1', 'Остров сокровищ: в корзине 2', 'Нарды: в корзине 3']) &&
      (await inCart(r)).every((t) => t === 'В корзине: 0'),
    `4.1 переменная модуля: общий счётчик, экран 0 (${JSON.stringify(lines)})`,
  );
}

// ---------- 4.2 useState ----------
const s2 = readDir(`${CH}/02-use-state/solution`);
{
  const r = await run(s2);
  expect((await r.fresh()).length === 0 && typeErrors(s2).length === 0, '4.2 консоль пуста, без ошибок типов');
  for (let i = 0; i < 3; i++) await add(r.page, 'Остров сокровищ', 1);
  const shown = await inCart(r);
  expect(
    shown[0] === 'В корзине: 3' && shown[3] === 'В корзине: 0',
    `4.2 «Остров» в «Хитах» — 3, во «Всех играх» — 0 (${shown[0]}, ${shown[3]})`,
  );
}
{
  const r = await run(withRenderLog(s2));
  const start = logLines(await r.fresh());
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    start.length === 18 && same(lines, ['render Остров сокровищ 1', 'render Остров сокровищ 1']),
    `4.2 при запуске 18 строк render, щелчок — две строки одной карточки (${start.length}, ${JSON.stringify(lines)})`,
  );
}
{
  let f = edit(
    s2,
    'shared/GameCard.tsx',
    '  // Щелчок по «В корзину»\n',
    '  let clicks = 0;\n\n  // Щелчок по «В корзину»\n',
  );
  f = edit(
    f,
    'shared/GameCard.tsx',
    '    setQuantity(quantity + 1);',
    "    clicks += 1;\n    console.log('clicks', clicks);\n    setQuantity(quantity + 1);",
  );
  const r = await run(f);
  for (let i = 0; i < 3; i++) await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['clicks 1', 'clicks 1', 'clicks 1']) && (await inCart(r))[0] === 'В корзине: 3',
    `4.2 let clicks: всегда 1 (${JSON.stringify(lines)})`,
  );
}
{
  const f = edit(s2, 'shared/GameCard.tsx', 'setQuantity(quantity + 1)', 'quantity = quantity + 1');
  expect(
    typeHas(typeErrors(f), "Cannot assign to 'quantity' because it is a constant."),
    '4.2 присвоение состоянию: TS2588',
  );
  const f2 = edit(s2, 'shared/GameCard.tsx', 'setQuantity(quantity + 1)', "setQuantity('1')");
  expect(
    typeHas(
      typeErrors(f2),
      "Argument of type 'string' is not assignable to parameter of type 'SetStateAction<number>'.",
    ),
    "4.2 setQuantity('1'): TS2345",
  );
}
{
  const f = edit(
    s2,
    'shared/GameCard.tsx',
    '    setQuantity(quantity + 1);',
    '    useState(0);\n    setQuantity(quantity + 1);',
  );
  expect(typeErrors(f).length === 0, '4.2 хук в обработчике: редактор молчит');
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = await r.fresh();
  expect(
    has(lines, 'Invalid hook call. Hooks can only be called inside of the body of a function component.') &&
      (await inCart(r))[0] === 'В корзине: 0',
    '4.2 хук в обработчике: Invalid hook call, счётчик 0',
  );
}
{
  // Обещание главы 3: компонент, вызванный функцией, отдаёт состояние App
  let f = edit(
    s2,
    'App.tsx',
    `            {hits.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}`,
    '            {hits.map((game) => GameCard({ game }))}',
  );
  f = edit(
    f,
    'App.tsx',
    '  const hits = games.filter(isHit);\n',
    "  console.log('render App');\n  const hits = games.filter(isHit);\n",
  );
  f = append(
    f,
    'main.tsx',
    `setTimeout(() => {
  const key = Object.keys(container).find((k) => k.startsWith('__reactContainer'))!;
  const app = (container as any)[key].stateNode.current.child.child;
  let hooks = 0;
  for (let h = app.memoizedState; h; h = h.next) hooks++;
  console.log('hooks', app.type.name, hooks);
}, 300);`,
  );
  const r = await run(f);
  const start = logLines(await r.fresh());
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(start.includes('hooks App 3'), `4.2 GameCard({ game }): три хука у App (${start.at(-1)})`);
  expect(
    same(lines, ['render App', 'render App']) && (await inCart(r))[0] === 'В корзине: 1',
    `4.2 GameCard({ game }): щелчок — render App ×2`,
  );
}

// ---------- 4.3 События ----------
const s3 = readDir(`${CH}/03-events/solution`);
{
  const r = await run(s3);
  expect((await r.fresh()).length === 0 && typeErrors(s3).length === 0, '4.3 консоль пуста, без ошибок типов');
  for (let i = 0; i < 4; i++) await add(r.page, 'Ночной экспресс', 2);
  const disabled = await r.page.$$eval('main > section:nth-of-type(2) article', (as) =>
    as.filter((a) => a.querySelector('button').disabled).map((a) => a.querySelector('h3').textContent),
  );
  expect(
    (await inCart(r))[5] === 'В корзине: 3' && same(disabled, ['Ночной экспресс', 'Маяк']),
    `4.3 «Ночной экспресс»: 3 шт., кнопка выключена (${(await inCart(r))[5]}, ${disabled})`,
  );
}
{
  const f = edit(s3, 'shared/GameCard.tsx', 'onClick={handleAddClick}', 'onClick={handleAddClick()}');
  expect(
    typeHas(typeErrors(f), "Type 'void' is not assignable to type 'MouseEventHandler<HTMLButtonElement> | undefined'."),
    '4.3 onClick={handleAddClick()}: TS2322',
  );
  const r = await run(f);
  expect(
    has(await r.fresh(), 'Too many re-renders. React limits the number of renders to prevent an infinite loop.') &&
      (await r.text()) === '',
    '4.3 onClick={handleAddClick()}: Too many re-renders, экран пуст',
  );
}
{
  let f = edit(
    s3,
    'shared/GameCard.tsx',
    "import { Fragment, useState } from 'react';",
    "import { Fragment, useState, type MouseEvent } from 'react';",
  );
  f = edit(
    f,
    'shared/GameCard.tsx',
    '  function handleAddClick() {\n',
    `  function handleAddClick(e: MouseEvent<HTMLButtonElement>) {
    console.log(
      e.type,
      e.constructor.name,
      e.currentTarget.tagName,
      e.nativeEvent.constructor.name,
    );
`,
  );
  expect(typeErrors(f).length === 0, '4.3 объект события: без ошибок типов');
  const r = await run(f);
  await r.fresh();
  await r.page.click('article button');
  await wait(200);
  const lines = logLines(await r.fresh());
  expect(same(lines, ['click SyntheticBaseEvent BUTTON PointerEvent']), `4.3 объект события: ${JSON.stringify(lines)}`);
  const f2 = edit(s3, 'shared/GameCard.tsx', '  function handleAddClick() {', '  function handleAddClick(e) {');
  expect(typeHas(typeErrors(f2), "Parameter 'e' implicitly has an 'any' type."), '4.3 параметр без типа: TS7006');
}
{
  const bubble = edit(
    s3,
    'shared/GameCard.tsx',
    '      data-category={game.category}\n',
    "      data-category={game.category}\n      onClick={() => console.log('article', game.title)}\n",
  );
  const r = await run(bubble);
  await r.fresh();
  await r.page.click('article button');
  await wait(150);
  const afterButton = logLines(await r.fresh());
  const count = (await inCart(r))[0];
  await r.page.click('article img');
  await wait(150);
  const afterCover = logLines(await r.fresh());
  expect(
    same(afterButton, ['article Остров сокровищ']) &&
      count === 'В корзине: 1' &&
      same(afterCover, ['article Остров сокровищ']) &&
      (await inCart(r))[0] === 'В корзине: 1',
    '4.3 всплытие: щелчок по кнопке доходит до карточки, по обложке — только строка',
  );
  let f = edit(
    bubble,
    'shared/GameCard.tsx',
    "import { Fragment, useState } from 'react';",
    "import { Fragment, useState, type MouseEvent } from 'react';",
  );
  f = edit(
    f,
    'shared/GameCard.tsx',
    '  function handleAddClick() {\n',
    '  function handleAddClick(e: MouseEvent<HTMLButtonElement>) {\n    e.stopPropagation();\n',
  );
  expect(typeErrors(f).length === 0, '4.3 stopPropagation: без ошибок типов');
  const r2 = await run(f);
  await r2.fresh();
  await r2.page.click('article button');
  await wait(150);
  const stopped = logLines(await r2.fresh());
  await r2.page.click('article img');
  await wait(150);
  expect(
    stopped.length === 0 &&
      (await inCart(r2))[0] === 'В корзине: 1' &&
      same(logLines(await r2.fresh()), ['article Остров сокровищ']),
    '4.3 stopPropagation: кнопка без строки, обложка — со строкой',
  );
}
{
  const FORM = `<form
  onSubmit={(e) => {
    console.log('Подписка:', new FormData(e.currentTarget).get('email'));
  }}
>
  <input name="email" placeholder="Почта" />
  <button>Подписаться</button>
</form>
`;
  for (const prevent of [false, true]) {
    const form = prevent ? FORM.replace('(e) => {\n', '(e) => {\n    e.preventDefault();\n') : FORM;
    const f = edit(
      s3,
      'App.tsx',
      '        <Section\n          title="Хиты"',
      `${form}        <Section\n          title="Хиты"`,
    );
    if (!prevent) expect(typeErrors(f).length === 0, '4.3 форма подписки: без ошибок типов');
    const r = await run(f);
    await r.page.evaluate(() => {
      window.__restarts = [];
      window.addEventListener('message', (e) => {
        if (e.data?.type === 'restart') window.__restarts.push(e.data.url);
      });
    });
    await r.fresh();
    await add(r.page, 'Остров сокровищ', 1);
    await r.page.type('input[name="email"]', 'me@example.com');
    await r.page.click('form button');
    await wait(300);
    const restarts = await r.page.evaluate(() => window.__restarts);
    const lines = logLines(await r.fresh());
    expect(
      prevent
        ? restarts.length === 0 && same(lines, ['Подписка: me@example.com'])
        : same(restarts, ['/?email=me%40example.com']),
      `4.3 форма ${prevent ? 'с' : 'без'} preventDefault: перезапуск ${JSON.stringify(restarts)}, лог ${JSON.stringify(lines)}`,
    );
  }
}

// ---------- 4.4 Состояние — снимок (на коде 4.3) ----------
const handler = (files, body) =>
  edit(
    files,
    'shared/GameCard.tsx',
    '  function handleAddClick() {\n    setQuantity(quantity + 1);\n  }',
    `  function handleAddClick() {\n${body}\n  }`,
  );
{
  const f = withRenderLog(
    handler(
      s3,
      `    setQuantity(quantity + 1);
    setQuantity(quantity + 1);
    setQuantity(quantity + 1);
    console.log('после set:', quantity);`,
    ),
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['после set: 0', 'render Остров сокровищ 1', 'render Остров сокровищ 1']) &&
      (await inCart(r))[0] === 'В корзине: 1',
    `4.4 три setQuantity(quantity + 1): экран 1, лог ${JSON.stringify(lines)}`,
  );
}
{
  const f = handler(
    s3,
    "    setQuantity(quantity + 1);\n    setTimeout(() => console.log('через 3 с:', quantity), 3000);",
  );
  expect(typeErrors(f).length === 0, '4.4 таймер: без ошибок типов');
  const r = await run(f);
  await r.fresh();
  for (let i = 0; i < 3; i++) await add(r.page, 'Остров сокровищ', 1);
  const early = (await inCart(r))[0];
  await wait(3300);
  const lines = logLines(await r.fresh());
  expect(
    early === 'В корзине: 3' && same(lines, ['через 3 с: 0', 'через 3 с: 1', 'через 3 с: 2']),
    `4.4 через 3 с: ${JSON.stringify(lines)}, на экране сразу ${early}`,
  );
}

// ---------- 4.5 Очередь обновлений ----------
const s5 = readDir(`${CH}/05-queue/solution`);
{
  const r = await run(s5);
  expect((await r.fresh()).length === 0 && typeErrors(s5).length === 0, '4.5 консоль пуста, без ошибок типов');
  await add(r.page, 'Остров сокровищ', 1);
  expect((await inCart(r))[0] === 'В корзине: 1', '4.5 решение: щелчок — одна штука');
}
const queue = [
  ['    setQuantity((q) => q + 1);\n    setQuantity((q) => q + 1);\n    setQuantity((q) => q + 1);', 3],
  ['    setQuantity(quantity + 1);\n    setQuantity(quantity + 1);\n    setQuantity(quantity + 1);', 1],
  ['    setQuantity(quantity + 5);\n    setQuantity((q) => q + 1);', 6],
  ['    setQuantity((q) => q + 1);\n    setQuantity(42);', 42],
];
for (const [body, result] of queue) {
  const r = await run(withRenderLog(handler(s3, body)));
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    (await inCart(r))[0] === `В корзине: ${result}` &&
      same(lines, [`render Остров сокровищ ${result}`, `render Остров сокровищ ${result}`]),
    `4.5 таблица очереди → ${result}, один рендер (${JSON.stringify(lines)})`,
  );
}
{
  const r = await run(
    handler(s3, "    setQuantity((q) => {\n      console.log('updater', q);\n      return q + 1;\n    });"),
  );
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['updater 0', 'updater 0']) && (await inCart(r))[0] === 'В корзине: 1',
    `4.5 функция обновления дважды: ${JSON.stringify(lines)}`,
  );
}
{
  const f = withRenderLog(
    handler(
      s3,
      "    setTimeout(() => {\n      setQuantity((q) => q + 1);\n      setQuantity((q) => q + 1);\n      console.log('в таймере');\n    }, 0);",
    ),
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['в таймере', 'render Остров сокровищ 2', 'render Остров сокровищ 2']),
    `4.5 пакет в таймере: ${JSON.stringify(lines)}`,
  );
  const f2 = withRenderLog(
    edit(
      handler(s3, '    await Promise.resolve();\n    setQuantity((q) => q + 1);\n    setQuantity((q) => q + 1);'),
      'shared/GameCard.tsx',
      '  function handleAddClick() {',
      '  async function handleAddClick() {',
    ),
  );
  const r2 = await run(f2);
  await r2.fresh();
  await add(r2.page, 'Остров сокровищ', 1);
  const lines2 = logLines(await r2.fresh());
  expect(
    same(lines2, ['render Остров сокровищ 2', 'render Остров сокровищ 2']),
    `4.5 пакет после await: ${JSON.stringify(lines2)}`,
  );
  // Квиз: три обновления в обработчике + два в таймере — два рендера
  const f3 = withRenderLog(
    handler(
      s3,
      '    setQuantity((q) => q + 1);\n    setQuantity((q) => q + 1);\n    setQuantity((q) => q + 1);\n    setTimeout(() => {\n      setQuantity((q) => q + 1);\n      setQuantity((q) => q + 1);\n    }, 0);',
    ),
  );
  const r3 = await run(f3);
  await r3.fresh();
  await add(r3.page, 'Остров сокровищ', 1);
  const lines3 = logLines(await r3.fresh());
  expect(
    same(lines3, [
      'render Остров сокровищ 3',
      'render Остров сокровищ 3',
      'render Остров сокровищ 5',
      'render Остров сокровищ 5',
    ]),
    `4.5 (квиз) 3 + 2 обновления в таймере — два рендера: ${JSON.stringify(lines3)}`,
  );
}
for (const [upd, result] of [
  ['quantity + 1', 1],
  ['(q) => q + 1', 2],
]) {
  const f = edit(
    s5,
    'shared/GameCard.tsx',
    '    setQuantity((q) => q + 1);',
    `    setTimeout(() => setQuantity(${upd}), 1000);`,
  );
  const r = await run(f);
  await add(r.page, 'Драконья почта', 2);
  await add(r.page, 'Драконья почта', 2);
  await wait(1400);
  expect((await inCart(r))[4] === `В корзине: ${result}`, `4.5 два щелчка, таймер с ${upd}: ${(await inCart(r))[4]}`);
}
{
  let f = withRenderLog(
    edit(
      s5,
      'shared/GameCard.tsx',
      '    setQuantity((q) => q + 1);',
      "    flushSync(() => setQuantity((q) => q + 1));\n    console.log('DOM:', document.querySelector('article p:last-child')?.textContent);\n    setQuantity((q) => q + 1);",
    ),
  );
  f = edit(
    f,
    'shared/GameCard.tsx',
    "import { Fragment, useState } from 'react';",
    "import { Fragment, useState } from 'react';\nimport { flushSync } from 'react-dom';",
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, [
      'render Остров сокровищ 1',
      'render Остров сокровищ 1',
      'DOM: В корзине: 1 шт.',
      'render Остров сокровищ 2',
      'render Остров сокровищ 2',
    ]),
    `4.5 flushSync: два рендера, DOM сразу (${JSON.stringify(lines)})`,
  );
}

// ---------- 4.6 Подъём состояния ----------
const s6 = readDir(`${CH}/06-lifting/solution`);
{
  const r = await run(s6);
  expect((await r.fresh()).length === 0 && typeErrors(s6).length === 0, '4.6 консоль пуста, без ошибок типов');
  const header = () => r.page.$eval('header', (h) => h.innerText.match(/Корзина: \d+/)?.[0]);
  expect((await header()) === 'Корзина: 0', '4.6 в шапке «Корзина: 0»');
  await add(r.page, 'Остров сокровищ', 1);
  await add(r.page, 'Остров сокровищ', 2);
  await add(r.page, 'Маяк', 2);
  await add(r.page, 'Космические коты', 2);
  expect(
    (await header()) === 'Корзина: 3' && (await inCart(r)).length === 0,
    `4.6 щелчки в обоих разделах — одно число: ${await header()}`,
  );
}
{
  let f = edit(
    s6,
    'App.tsx',
    '  const hits = games.filter(isHit);\n',
    "  console.log('render App');\n  const hits = games.filter(isHit);\n",
  );
  f = edit(
    f,
    'shared/GameCard.tsx',
    '  const { min, max } = game.players;\n',
    "  console.log('render', game.title);\n  const { min, max } = game.players;\n",
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    lines.filter((l) => l === 'render App').length === 2 &&
      lines.filter((l) => l.startsWith('render ') && l !== 'render App').length === 18,
    `4.6 щелчок: render App ×2 и 18 строк карточек (${lines.length})`,
  );
}
{
  const f = edit(
    s6,
    'App.tsx',
    `                onAdd={handleAdd}
              />
            ))}
          </div>
        </Section>
        <Section title="Все игры">`,
    `              />
            ))}
          </div>
        </Section>
        <Section title="Все игры">`,
  );
  expect(
    typeHas(
      typeErrors(f),
      "Property 'onAdd' is missing in type '{ key: number; game: Game; }' but required in type 'GameCardProps'.",
    ),
    '4.6 без onAdd: TS2741',
  );
}

// ---------- 4.7 Объекты и массивы ----------
const s7 = readDir(`${CH}/07-arrays/solution`);
const headerCount = (r) => r.page.$eval('header', (h) => h.innerText.match(/Корзина: \d+/)?.[0]);
{
  const r = await run(s7);
  expect((await r.fresh()).length === 0 && typeErrors(s7).length === 0, '4.7 консоль пуста, без ошибок типов');
  await add(r.page, 'Остров сокровищ', 1);
  expect(
    (await headerCount(r)) === 'Корзина: 1' && same(await inCart(r), ['В корзине: 1', 'В корзине: 1']),
    '4.7 «Остров» в «Хитах»: в шапке 1, у обоих «Островов» — «В корзине: 1 шт.»',
  );
  for (let i = 0; i < 3; i++) await add(r.page, 'Ночной экспресс', 2);
  const disabled = await r.page.$$eval('article button:disabled', (b) =>
    b.map((x) => x.closest('article').querySelector('h3').textContent),
  );
  expect(
    same(disabled, ['Ночной экспресс', 'Ночной экспресс', 'Маяк']),
    `4.7 «Ночной экспресс» ×3 — кнопки выключены в обоих разделах`,
  );
}
{
  const f = edit(s7, 'App.tsx', 'useState<CartItem[]>([])', 'useState([])');
  expect(typeHas(typeErrors(f), "Property 'quantity' does not exist on type 'never'."), '4.7 useState([]): never');
}
const ADD = s7['App.tsx'].slice(
  s7['App.tsx'].indexOf('  function handleAdd'),
  s7['App.tsx'].indexOf('  return (\n    <>'),
);
const withAdd = (code, files = s7) => edit(files, 'App.tsx', ADD, `${code}\n\n`);
{
  const r = await run(
    withAdd(`  function handleAdd(gameId: number) {
    cart.push({ gameId, quantity: 1 });
    setCart(cart);
    console.log('позиций:', cart.length);
  }`),
  );
  for (let i = 0; i < 3; i++) await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['позиций: 1', 'позиций: 2', 'позиций: 3']) && (await headerCount(r)) === 'Корзина: 0',
    '4.7 push + setCart(cart): лог растёт, в шапке 0',
  );
}
{
  const f = withAdd(`  function handleAdd(gameId: number) {
    if (gameId === 1) {
      cart.push({ gameId, quantity: 1 });
      setCart(cart);
      return;
    }
    setCart([...cart, { gameId, quantity: 1 }]);
  }`);
  const r = await run(f);
  await add(r.page, 'Остров сокровищ', 1);
  await add(r.page, 'Остров сокровищ', 1);
  const before = await headerCount(r);
  await add(r.page, 'Ночной экспресс', 1);
  expect(
    before === 'Корзина: 0' && (await headerCount(r)) === 'Корзина: 3',
    `4.7 мутация всплывает: ${before} → ${await headerCount(r)}`,
  );
}
const MUTATE = `  function handleAdd(gameId: number) {
    setCart((items) => {
      const item = items.find((i) => i.gameId === gameId);
      if (!item) return [...items, { gameId, quantity: 1 }];
      item.quantity += 1;
      return [...items];
    });
  }`;
{
  const r = await run(withAdd(MUTATE));
  for (let i = 0; i < 3; i++) await add(r.page, 'Остров сокровищ', 1);
  const strict = (await inCart(r))[0];
  const r2 = await run(
    withAdd(MUTATE, edit(s7, 'main.tsx', '  <StrictMode>\n    <App />\n  </StrictMode>,', '  <App />,')),
  );
  for (let i = 0; i < 3; i++) await add(r2.page, 'Остров сокровищ', 1);
  expect(
    strict === 'В корзине: 5' && (await inCart(r2))[0] === 'В корзине: 3',
    `4.7 мутация в функции обновления: строгий режим ${strict}, без него ${(await inCart(r2))[0]}`,
  );
}

// ---------- 4.8 Под капотом: рендер и фиксация (на коде 4.7) ----------
{
  let f = edit(
    s7,
    'App.tsx',
    '  const hits = games.filter(isHit);\n',
    "  console.log('render App');\n  const hits = games.filter(isHit);\n",
  );
  f = edit(f, 'layout/Header.tsx', '  return (', "  console.log('render Header');\n  return (");
  f = edit(
    f,
    'shared/GameCard.tsx',
    '  const { min, max } = game.players;\n',
    "  console.log('render GameCard', game.title);\n  const { min, max } = game.players;\n",
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  const n = (p) => lines.filter((l) => l.startsWith(p)).length;
  expect(
    n('render App') === 2 && n('render Header') === 2 && n('render GameCard') === 18,
    `4.8 кого вызвали: App ${n('render App')}, Header ${n('render Header')}, GameCard ${n('render GameCard')}`,
  );
}
{
  const f = edit(
    s7,
    'main.tsx',
    'root.render(',
    `new MutationObserver((records) => {
  for (const r of records) {
    if (r.type === 'characterData') {
      console.log('DOM: текст →', r.target.textContent);
    } else {
      for (const node of r.addedNodes) {
        console.log('DOM: добавлен', node.nodeName, node.textContent);
      }
    }
  }
}).observe(container, {
  subtree: true,
  childList: true,
  characterData: true,
});
root.render(`,
  );
  expect(typeErrors(f).length === 0, '4.8 MutationObserver из текста: без ошибок типов');
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  const first = logLines(await r.fresh());
  await add(r.page, 'Остров сокровищ', 1);
  const second = logLines(await r.fresh());
  expect(
    same(first, ['DOM: текст → 1', 'DOM: добавлен P В корзине: 1 шт.', 'DOM: добавлен P В корзине: 1 шт.']) &&
      same(second, ['DOM: текст → 2', 'DOM: текст → 2', 'DOM: текст → 2']),
    `4.8 изменения DOM: ${JSON.stringify(first)} / ${JSON.stringify(second)}`,
  );
}
{
  let f = withAdd('  function handleAdd(gameId: number) {\n    setCart((items) => items);\n  }');
  f = edit(
    f,
    'App.tsx',
    '  const hits = games.filter(isHit);\n',
    "  console.log('render App');\n  const hits = games.filter(isHit);\n",
  );
  const r = await run(f);
  await r.fresh();
  for (let i = 0; i < 3; i++) await add(r.page, 'Остров сокровищ', 1);
  expect(logLines(await r.fresh()).length === 0, '4.8 setCart((items) => items): ни одного render App');
  const r2 = await run(handler(withRenderLog(s3), '    setQuantity(quantity);'));
  await r2.fresh();
  await add(r2.page, 'Остров сокровищ', 1);
  expect(logLines(await r2.fresh()).length === 0, '4.8 setQuantity(quantity): ни одного рендера');
}
{
  const f = append(
    s7,
    'main.tsx',
    `// После каждого щелчка — первый хук App из его файбера
document.addEventListener('click', () => {
  setTimeout(() => {
    const key = Object.keys(container).find((k) =>
      k.startsWith('__reactContainer'),
    )!;
    const app = (container as any)[key].stateNode.current.child.child;
    console.log(app.type.name, JSON.stringify(app.memoizedState.memoizedState));
  });
});`,
  );
  expect(typeErrors(f).length === 0, '4.8 файбер App: без ошибок типов');
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 1);
  await add(r.page, 'Нарды', 1);
  await add(r.page, 'Остров сокровищ', 1);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, [
      'App [{"gameId":1,"quantity":1}]',
      'App [{"gameId":1,"quantity":1},{"gameId":10,"quantity":1}]',
      'App [{"gameId":1,"quantity":2},{"gameId":10,"quantity":1}]',
    ]),
    `4.8 состояние в файбере: ${JSON.stringify(lines)}`,
  );
}

// ---------- 4.9 Практикум: мини-корзина ----------
{
  const start = readDir(`${CH}/09-practice/start`);
  const r = await run(start);
  expect(
    (await r.fresh()).length === 0 && typeErrors(start).length === 0,
    '4.9 старт запускается: консоль пуста, без ошибок типов',
  );
}
const s9 = readDir(`${CH}/09-practice/solution`);
{
  const r = await run(s9);
  expect((await r.fresh()).length === 0 && typeErrors(s9).length === 0, '4.9 консоль пуста, без ошибок типов');
  const cart = () =>
    r.page.$eval('main > section:nth-of-type(1)', (s) => s.innerText.replace(/\s+/g, ' ').replace(/ /g, ' '));
  expect((await cart()) === 'Корзина Корзина пуста — добавьте игру из каталога', `4.9 пустая корзина: ${await cart()}`);
  await add(r.page, 'Остров сокровищ', 2);
  await add(r.page, 'Остров сокровищ', 3);
  await add(r.page, 'Нарды', 3);
  expect(
    (await cart()) ===
      'Корзина 3 Остров сокровищ − 2 + 3 980 ₽ × Нарды − 1 + 2 590 ₽ × Итого: 6 570 ₽ Доставка бесплатно' &&
      (await headerCount(r)) === 'Корзина: 3' &&
      same(await inCart(r), ['В корзине: 2', 'В корзине: 1', 'В корзине: 2', 'В корзине: 1']),
    `4.9 три штуки: ${await cart()}`,
  );
  for (let i = 0; i < 3; i++) await add(r.page, 'Ночной экспресс', 3);
  const plus = await r.page.$eval(
    'main > section:nth-of-type(1) li:nth-child(3) button[aria-label="Добавить ещё"]',
    (b) => b.disabled,
  );
  const disabled = await r.page.$$eval('article button:disabled', (b) =>
    b.map((x) => x.closest('article').querySelector('h3').textContent),
  );
  expect(
    plus && same(disabled, ['Ночной экспресс', 'Ночной экспресс', 'Маяк']),
    '4.9 «Ночной экспресс» ×3: «+» и «В корзину» выключены',
  );
  for (let i = 0; i < 2; i++) {
    await r.page.click('main > section:nth-of-type(1) li:first-child button[aria-label="Убрать одну"]');
    await wait(150);
  }
  expect(
    !(await cart()).includes('Остров') &&
      same(await inCart(r), ['В корзине: 3', 'В корзине: 1', 'В корзине: 3', 'В корзине: 1']),
    '4.9 «−» у «Острова» дважды: позиция исчезла, строки у карточек пропали',
  );
  await r.page.click('main > section:nth-of-type(1) li:last-child button[aria-label="Убрать «Ночной экспресс»"]');
  await wait(150);
  expect(
    (await cart()) === 'Корзина 1 Нарды − 1 + 2 590 ₽ × Итого: 2 590 ₽ До бесплатной доставки — 2 410 ₽',
    `4.9 «×» у «Ночного экспресса»: ${await cart()}`,
  );
  await r.page.click('main > section:nth-of-type(1) li:last-child button[aria-label="Убрать «Нарды»"]');
  await wait(150);
  expect((await cart()) === 'Корзина Корзина пуста — добавьте игру из каталога', '4.9 «×» у «Нард»: корзина пуста');
  expect((await r.fresh()).length === 0, '4.9 консоль пуста после всех действий');
}

await browser.close();
if (failures.length) {
  console.log(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло');
