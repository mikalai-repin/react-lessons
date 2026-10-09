// Проверка утверждений и экспериментов главы 6 «Ссылки и эффекты»: каждый эксперимент из текста —
// на коде того шага, о котором текст. node tools/e2e/checks/ch06-effects.mjs (нужен npm run dev)
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import {
  CONTENT,
  OUT,
  ROOT,
  appUrl,
  collect,
  compileMap,
  launch,
  openPreview,
  pageText,
  readDir,
  wait,
} from '../lib.mjs';

const CH = `${CONTENT}/06-effects`;
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
const nb = (s) => s.replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

// Названия игр в разделе <main> по порядку (1 — корзина, 2 — «Хиты», 3 — «Все игры»)
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
  await wait(120);
}
// Открыть страницу игры: щелчок по названию в карточке (первой с таким названием)
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
  await wait(120);
}
async function select(page, index, value) {
  await (await page.$$('main select'))[index].select(value);
  await wait(100);
}
async function typeInto(page, selector, text) {
  await page.type(selector, text);
  await wait(100);
}
const field = (page, selector) => page.$eval(selector, (e) => (e.type === 'checkbox' ? e.checked : e.value));
const sectionText = async (page, n) => nb(await page.$eval(`main > section:nth-of-type(${n})`, (s) => s.innerText));
const detailsText = async (page) => nb(await page.$eval('main article', (a) => a.innerText));

// Ошибки типов полного кода — как в редакторе: «App.tsx:5 — TS2322: …» (настройки tsconfig.content.json)
const TC = join(OUT, 'ch06-tc');
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

// Маленькое приложение в main.tsx со StrictMode — для общих фактов о полях и позиции
const mini = (body) => ({
  'main.tsx': `import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
${body}
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
`,
});

// ONLY=6.4,6.7 — только эти разделы (и без общей проверки шагов)
const ONLY = process.env.ONLY?.split(',');
const want = (section) => !ONLY || ONLY.includes(section);

// Каждый шаг: консоль пуста, ошибок типов нет
for (const step of ONLY
  ? []
  : [
      '01-ref-values',
      '02-dom-refs',
      '03-imperative-handle',
      '04-use-effect',
      '06-no-effect',
      '07-effect-event',
      '08-layout-portal',
      '09-external-store',
      '11-practice',
    ]) {
  const files = readDir(`${CH}/${step}/solution`);
  const errors = typeErrors(files);
  const r = await run(files);
  const lines = await r.fresh();
  expect(
    errors.length === 0 && lines.length === 0,
    `${step}: консоль пуста, без ошибок типов ${JSON.stringify([...errors, ...lines])}`,
  );
}
const toastText = (page) => page.evaluate(() => document.querySelector('[role=status]')?.textContent ?? null);
// Когда пропало уведомление: опрос каждые 50 мс, мс от начала
async function toastGoneAfter(page, limit = 4000) {
  const start = Date.now();
  while (Date.now() - start < limit) {
    if ((await toastText(page)) === null) return Date.now() - start;
    await wait(50);
  }
  return Infinity;
}

// ---------- 6.1 useRef: значение без рендера ----------
const s1 = readDir(`${CH}/01-ref-values/solution`);
if (want('6.1')) {
  const r = await run(s1);
  await add(r.page, 'Остров сокровищ', 3);
  expect((await toastText(r.page)) === 'Добавлено: Остров сокровищ', '6.1 уведомление «Добавлено: Остров сокровищ»');
  await wait(1400);
  await add(r.page, 'Драконья почта', 3);
  expect((await toastText(r.page)) === 'Добавлено: Драконья почта', '6.1 второе уведомление — Драконья почта');
  const gone = await toastGoneAfter(r.page);
  expect(gone > 2200 && gone < 2900, `6.1 второе уведомление висит ~2,5 с (${gone} мс)`);
}
if (want('6.1')) {
  // let вместо ref: таймер первого щелчка прячет второе уведомление раньше
  let f = edit(
    s1,
    'App.tsx',
    'const toastTimer = useRef<number | null>(null);',
    'let toastTimer: number | null = null;',
  );
  f = edit(f, 'App.tsx', 'toastTimer.current', 'toastTimer', true);
  f = edit(f, 'App.tsx', 'import { useRef, useState }', 'import { useState }');
  const r = await run(f);
  await add(r.page, 'Остров сокровищ', 3);
  await wait(1400);
  await add(r.page, 'Драконья почта', 3);
  const gone = await toastGoneAfter(r.page);
  expect(gone > 600 && gone < 1400, `6.1 с let второе уведомление пропадает через ~1 с (${gone} мс)`);
  expect(typeErrors(f).length === 0, `6.1 с let ошибок типов нет ${typeErrors(f)}`);
}
if (want('6.1')) {
  // ref меняется сразу, состояние — снимок
  const f = edit(
    s1,
    'App.tsx',
    '    toastTimer.current = setTimeout(',
    "    console.log('до:', toastTimer.current, toast);\n    toastTimer.current = setTimeout(",
  );
  const g = edit(
    f,
    'App.tsx',
    '      TOAST_MS,\n    );\n',
    "      TOAST_MS,\n    );\n    console.log('после:', toastTimer.current, toast);\n",
  );
  const r = await run(g);
  await r.fresh();
  await add(r.page, 'Остров сокровищ', 3);
  await add(r.page, 'Нарды', 3);
  const lines = logLines(await r.fresh());
  console.log('   ', JSON.stringify(lines));
  expect(
    lines.length === 4 && /^до: null null$/.test(lines[0]) && /^после: \d+ null$/.test(lines[1]),
    '6.1 лог: до: null null / после: <число> null',
  );
}

// ---------- 6.2 Ссылки на DOM ----------
const s2 = readDir(`${CH}/02-dom-refs/solution`);
const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    return a === document.body ? 'body' : `${a.tagName.toLowerCase()}${a.type ? `[${a.type}]` : ''}`;
  });
if (want('6.2')) {
  const r = await run(s2);
  await select(r.page, 0, 'kids');
  await press(r.page, 'Сбросить фильтры');
  expect(
    (await active(r.page)) === 'input[search]',
    `6.2 после «Сбросить фильтры» фокус в поиске (${await active(r.page)})`,
  );
  expect((await titles(r.page)).length === 6, '6.2 после сброса — шесть игр');
}
if (want('6.2')) {
  const f = edit(s2, 'App.tsx', '    searchRef.current?.focus();\n', '');
  const r = await run(f);
  await select(r.page, 0, 'kids');
  await press(r.page, 'Сбросить фильтры');
  expect((await active(r.page)) === 'body', `6.2 без focus() фокус на body (${await active(r.page)})`);
}
if (want('6.2')) {
  // ref без объявления в props
  let f = edit(
    s2,
    'catalog/CatalogFilters.tsx',
    '  // Ссылка на поле поиска — для фокуса снаружи\n  ref?: Ref<HTMLInputElement>;\n',
    '',
  );
  f = edit(f, 'catalog/CatalogFilters.tsx', '  ref,\n}', '}');
  f = edit(f, 'catalog/CatalogFilters.tsx', '          ref={ref}\n', '');
  f = edit(f, 'catalog/CatalogFilters.tsx', "import type { Ref } from 'react';\n", '');
  const errors = typeErrors(f);
  console.log('   ', JSON.stringify(errors));
  expect(
    typeHas(errors, "Property 'ref' does not exist on type 'IntrinsicAttributes & CatalogFiltersProps'"),
    '6.2 ref без типа — TS2322',
  );
  const r = await run(f);
  await select(r.page, 0, 'kids');
  await press(r.page, 'Сбросить фильтры');
  const lines = await r.fresh();
  console.log('   ', JSON.stringify(lines), await active(r.page));
}
if (want('6.2')) {
  // Чтение ref во время рендера
  const f = edit(
    s2,
    'App.tsx',
    '  const searchRef = useRef<HTMLInputElement>(null);\n',
    "  const searchRef = useRef<HTMLInputElement>(null);\n  console.log('render App, поле:', searchRef.current);\n",
  );
  const r = await run(f);
  const lines = logLines(await r.fresh());
  console.log('   ', JSON.stringify(lines));
  await typeInto(r.page, 'input[type=search]', 'к');
  console.log('   ', JSON.stringify(logLines(await r.fresh())));
}
if (want('6.2')) {
  // Колбэк-ref с очисткой
  const f = edit(
    s2,
    'catalog/CatalogFilters.tsx',
    '          ref={ref}\n',
    "          ref={(node) => {\n            console.log('ref:', node);\n            return () => console.log('очистка ref');\n          }}\n",
  );
  const r = await run(f);
  console.log('    запуск', JSON.stringify(logLines(await r.fresh())));
  await typeInto(r.page, 'input[type=search]', 'к');
  console.log('    буква', JSON.stringify(logLines(await r.fresh())));
  await open(r.page, 'Нарды');
  console.log('    страница игры', JSON.stringify(logLines(await r.fresh())));
  {
    const f2 = edit(
      s2,
      'catalog/CatalogFilters.tsx',
      '          ref={ref}\n',
      "          ref={(node) => console.log('ref:', node)}\n",
    );
    const r2 = await run(f2);
    const a = logLines(await r2.fresh());
    await typeInto(r2.page, 'input[type=search]', 'к');
    const b = logLines(await r2.fresh());
    expect(
      same(a, ['ref: <input>', 'ref: null', 'ref: <input>']) && same(b, ['ref: null', 'ref: <input>']),
      `6.2 колбэк-ref без очистки: null при отключении ${JSON.stringify([a, b])}`,
    );
  }
  const g = edit(
    s2,
    'catalog/CatalogFilters.tsx',
    '          ref={ref}\n',
    '          ref={(node) => (input = node)}\n',
  );
  const errors = typeErrors(
    edit(
      g,
      'catalog/CatalogFilters.tsx',
      'export function',
      'let input: HTMLInputElement | null = null;\nexport function',
    ),
  );
  console.log('   ', JSON.stringify(errors));
}

// ---------- 6.3 useImperativeHandle ----------
const s3 = readDir(`${CH}/03-imperative-handle/solution`);
const dialogState = (page) =>
  page.evaluate(() => {
    const d = document.querySelector('dialog');
    return d ? `${d.open ? 'open' : 'closed'}${d.matches(':modal') ? ' modal' : ''}` : 'нет';
  });
const cartText = async (page) => nb(await page.$eval('main > section:nth-of-type(1)', (s) => s.innerText));
if (want('6.3')) {
  const r = await run(s3);
  await add(r.page, 'Остров сокровищ', 3);
  await add(r.page, 'Нарды', 3);
  expect((await dialogState(r.page)) === 'closed', `6.3 окно в DOM закрыто (${await dialogState(r.page)})`);
  await press(r.page, 'Очистить корзину');
  expect((await dialogState(r.page)) === 'open modal', `6.3 open() → модальное окно (${await dialogState(r.page)})`);
  expect((await active(r.page)) === 'button[submit]', `6.3 фокус в окне (${await active(r.page)})`);
  const dtext = nb(await r.page.$eval('dialog', (d) => d.innerText));
  expect(dtext.includes('Все игры уберутся из корзины: 2 шт.'), `6.3 текст окна: ${dtext}`);
  await press(r.page, 'Отмена', 'dialog');
  expect(
    (await dialogState(r.page)) === 'closed' && (await cartText(r.page)).includes('Нарды'),
    '6.3 «Отмена» — окно закрыто, корзина та же',
  );
  await press(r.page, 'Очистить корзину');
  await r.page.keyboard.press('Escape');
  await wait(100);
  expect(
    (await dialogState(r.page)) === 'closed' && (await cartText(r.page)).includes('Нарды'),
    '6.3 Esc — окно закрыто, корзина та же',
  );
  await press(r.page, 'Очистить корзину');
  await press(r.page, 'Очистить', 'dialog');
  expect(
    (await cartText(r.page)).includes('Корзина пуста'),
    `6.3 «Очистить» — корзина пуста (${await cartText(r.page)})`,
  );
  expect((await appUrl(r.page)) === '/', '6.3 form method=dialog — без перезапуска превью');
  expect((await r.fresh()).length === 0, '6.3 консоль пуста');
}
if (want('6.3')) {
  // Что лежит в ref у родителя
  const f = edit(
    s3,
    'cart/MiniCart.tsx',
    'onClick={() => confirmRef.current?.open()}',
    "onClick={() => console.log('ref:', confirmRef.current)}",
  );
  const r = await run(f);
  await add(r.page, 'Нарды', 3);
  await r.fresh();
  await press(r.page, 'Очистить корзину');
  console.log('   ', JSON.stringify(await r.fresh()));
  const g = edit(s3, 'cart/MiniCart.tsx', 'confirmRef.current?.open()', 'confirmRef.current?.close()');
  console.log('   ', JSON.stringify(typeErrors(g)));
}
if (want('6.3')) {
  // show() вместо showModal()
  const f = edit(s3, 'shared/ConfirmDialog.tsx', 'showModal()', 'show()');
  const r = await run(f);
  await add(r.page, 'Нарды', 3);
  await press(r.page, 'Очистить корзину');
  const st = await dialogState(r.page);
  await r.page.keyboard.press('Escape');
  await wait(100);
  expect(st === 'open', `6.3 show() — окно не модальное (${st})`);
  console.log('    после Esc:', await dialogState(r.page));
  await press(r.page, 'Нарды', 'main article h3');
  console.log('    щелчок по странице под окном:', nb(await pageText(r.page)).slice(0, 60));
}

// ---------- 6.4 useEffect / 6.5 StrictMode ----------
const s4 = readDir(`${CH}/04-use-effect/solution`);
const countdown = (page) =>
  page.evaluate(() => document.querySelector('main article p[class*=countdown]')?.textContent ?? null);
// Countdown с логом запуска и очистки (и тиков — по желанию)
const logged = (files, { tick = false, cleanup = true, deps = '[finished]' } = {}) => {
  let f = edit(
    files,
    'shared/Countdown.tsx',
    '    const id = setInterval(() => setNow(Date.now()), 1000);',
    `    console.log('таймер: старт');\n    const id = setInterval(() => {${tick ? "\n      console.log('тик');" : ''}\n      setNow(Date.now());\n    }, 1000);`,
  );
  f = edit(
    f,
    'shared/Countdown.tsx',
    '    return () => clearInterval(id);',
    cleanup ? "    return () => {\n      console.log('таймер: стоп');\n      clearInterval(id);\n    };" : '',
  );
  f = edit(f, 'shared/Countdown.tsx', '  }, [finished]);', deps === null ? '  });' : `  }, ${deps});`);
  return f;
};
if (want('6.4')) {
  const r = await run(s4);
  await open(r.page, 'Остров сокровищ');
  const a = await countdown(r.page);
  await wait(2100);
  const b = await countdown(r.page);
  console.log('   ', a, '→', b);
  expect(/^Скидка действует ещё (2:00:00|1:59:5\d)$/.test(a) && a !== b, '6.4 «Скидка действует ещё 2:00:00» и идёт');
  await press(r.page, 'Следующая игра →');
  expect((await countdown(r.page)) === null, '6.4 у «Драконьей почты» таймера нет');
  expect((await r.fresh()).length === 0, '6.4 консоль пуста');
}
if (want('6.4')) {
  const r = await run(logged(s4));
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  expect(
    same(logLines(await r.fresh()), ['таймер: старт', 'таймер: стоп', 'таймер: старт']),
    '6.4/6.5 открыли игру: старт, стоп, старт (StrictMode)',
  );
  await wait(2100);
  expect(logLines(await r.fresh()).length === 0, '6.4 тики с [finished] не перезапускают эффект');
  await press(r.page, '← К каталогу');
  expect(same(logLines(await r.fresh()), ['таймер: стоп']), '6.4 к каталогу: стоп');
  await open(r.page, 'Остров сокровищ');
  await r.fresh();
  await press(r.page, 'Следующая игра →');
  await press(r.page, 'Следующая игра →');
  expect(
    same(logLines(await r.fresh()), ['таймер: стоп', 'таймер: старт', 'таймер: стоп', 'таймер: старт']),
    '6.4 «Следующая» ×2: стоп (Драконья), старт-стоп-старт (Ночной)',
  );
}
if (want('6.4')) {
  // Без StrictMode
  const f = logged(edit(s4, 'main.tsx', '  <StrictMode>\n    <App />\n  </StrictMode>,', '  <App />,'));
  const r = await run(f);
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  expect(same(logLines(await r.fresh()), ['таймер: старт']), '6.5 без StrictMode: один старт');
}
if (want('6.4')) {
  // Без массива зависимостей — эффект после каждого рендера
  const r = await run(logged(s4, { deps: null }));
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  await r.fresh();
  await wait(2050);
  const lines = logLines(await r.fresh());
  console.log('    без deps за 2 с:', JSON.stringify(lines));
  expect(
    lines.length >= 4 && lines[0] === 'таймер: стоп' && lines[1] === 'таймер: старт',
    '6.4 без массива: стоп/старт каждую секунду',
  );
}
if (want('6.4')) {
  // Без очистки: тики удваиваются, после ухода продолжаются
  const r = await run(logged(s4, { tick: true, cleanup: false }));
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  await r.fresh();
  await wait(1050);
  const a = logLines(await r.fresh()).filter((l) => l === 'тик').length;
  await press(r.page, '← К каталогу');
  await r.fresh();
  await wait(1050);
  const b = logLines(await r.fresh()).filter((l) => l === 'тик').length;
  await open(r.page, 'Остров сокровищ');
  await press(r.page, '← К каталогу');
  await open(r.page, 'Остров сокровищ');
  await r.fresh();
  await wait(1050);
  const c = logLines(await r.fresh()).filter((l) => l === 'тик').length;
  console.log(`    без очистки: тиков в секунду ${a}, после ухода ${b}, после трёх заходов ${c}`);
  expect(a === 2 && b === 2 && c === 6, '6.5 без очистки: 2 тика/с, после ухода — 2, после трёх заходов — 6');
  expect((await r.fresh()).length === 0, '6.5 без очистки — React молчит');
}
if (want('6.4')) {
  // Конец акции через 3 с
  const f = logged(edit(s4, 'data/sale.ts', '2 * 60 * 60 * 1000', '3 * 1000'), { tick: true });
  const r = await run(f, { waitMs: 300 });
  await open(r.page, 'Остров сокровищ');
  await r.fresh();
  await wait(3500);
  const lines = logLines(await r.fresh());
  console.log('    акция 3 с:', JSON.stringify(lines), await countdown(r.page));
  expect(
    (await countdown(r.page)) === 'Акция закончилась' && lines.at(-1) === 'таймер: стоп',
    '6.4 конец акции: «Акция закончилась», таймер остановлен',
  );
}
if (want('6.4')) {
  // async-эффект
  const f = edit(s4, 'shared/Countdown.tsx', '  useEffect(() => {', '  useEffect(async () => {');
  console.log('   ', JSON.stringify(typeErrors(f)));
  const r = await run(f);
  await open(r.page, 'Остров сокровищ');
  const lines = await r.fresh();
  expect(
    has(lines, 'useEffect must not return anything besides a function') && (await pageText(r.page)) === '',
    '6.4 async-эффект: ошибка React, приложение пропало',
  );
  expect(typeHas(typeErrors(f), "is not assignable to type 'void | Destructor'"), '6.4 async-эффект: TS2345');
}

if (want('6.4')) {
  // 6.5 «Костыль»: флажок в ref против повторного запуска
  let f = logged(s4);
  f = edit(
    f,
    'shared/Countdown.tsx',
    "import { useEffect, useState } from 'react';",
    "import { useEffect, useRef, useState } from 'react';",
  );
  f = edit(
    f,
    'shared/Countdown.tsx',
    '  const finished = now >= deadline;\n',
    '  const finished = now >= deadline;\n  const started = useRef(false);\n',
  );
  f = edit(
    f,
    'shared/Countdown.tsx',
    '    if (finished) return;\n',
    '    if (finished || started.current) return;\n    started.current = true;\n',
  );
  const r = await run(f);
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  const a = await countdown(r.page);
  await wait(2100);
  const b = await countdown(r.page);
  const lines = logLines(await r.fresh());
  console.log('    флажок:', JSON.stringify(lines), a, '→', b);
  expect(same(lines, ['таймер: старт', 'таймер: стоп']) && a === b, '6.5 флажок в ref: старт, стоп — и таймер стоит');
}

if (want('6.4')) {
  // 6.5 без очистки: что скажет TypeScript; без StrictMode — по одному лишнему интервалу на заход
  const f = logged(s4, { tick: true, cleanup: false });
  console.log('    без очистки, типы:', JSON.stringify(typeErrors(f)));
  const g = edit(f, 'main.tsx', '  <StrictMode>\n    <App />\n  </StrictMode>,', '  <App />,');
  const r = await run(g);
  for (let i = 0; i < 3; i++) {
    await open(r.page, 'Остров сокровищ');
    await press(r.page, '← К каталогу');
  }
  await r.fresh();
  await wait(1050);
  const c = logLines(await r.fresh()).filter((l) => l === 'тик').length;
  expect(c === 3, `6.5 без StrictMode и очистки: после трёх заходов 3 тика/с (${c})`);
}

// ---------- 6.6 Возможно, эффект не нужен ----------
const s6start = readDir(`${CH}/06-no-effect/start`);
const s6 = readDir(`${CH}/06-no-effect/solution`);
expect(same(s6, s4), '6.6 решение = код шага 4 (лишние эффекты убраны)');
// Тексты, которые побывали в DOM внутри селектора (MutationObserver), — до следующего вызова
const watchTexts = (page, selector) =>
  page.evaluate((selector) => {
    window.__seen = [];
    const obs = new MutationObserver(() => {
      const el = document.querySelector(selector);
      if (el) window.__seen.push(el.innerText.replace(/\s+/g, ' ').trim());
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true });
  }, selector);
const seen = (page) => page.evaluate(() => [...new Set(window.__seen)]);
if (want('6.6')) {
  // Итог корзины в эффекте: в DOM побывал 0 ₽, лишние рендеры
  const f = edit(
    s6start,
    'cart/MiniCart.tsx',
    '}: MiniCartProps) {\n',
    "}: MiniCartProps) {\n  console.log('render MiniCart');\n",
  );
  const r = await run(f);
  await r.fresh();
  await watchTexts(r.page, 'main > section:nth-of-type(1) p');
  await add(r.page, 'Остров сокровищ', 3);
  const texts = (await seen(r.page)).map(nb);
  const renders = logLines(await r.fresh()).filter((l) => l === 'render MiniCart').length;
  console.log('    итог в эффекте:', JSON.stringify(texts), 'рендеров', renders);
  expect(
    texts.includes('Итого: 0 ₽') && texts.includes('Итого: 1 990 ₽'),
    '6.6 итог в эффекте: в DOM побывало «Итого: 0 ₽»',
  );
  expect(renders === 4, `6.6 итог в эффекте: 4 рендера MiniCart на щелчок (${renders})`);
  const g = edit(
    s6,
    'cart/MiniCart.tsx',
    '}: MiniCartProps) {\n',
    "}: MiniCartProps) {\n  console.log('render MiniCart');\n",
  );
  const r2 = await run(g);
  await r2.fresh();
  await watchTexts(r2.page, 'main > section:nth-of-type(1) p');
  await add(r2.page, 'Остров сокровищ', 3);
  const texts2 = (await seen(r2.page)).map(nb);
  const renders2 = logLines(await r2.fresh()).filter((l) => l === 'render MiniCart').length;
  expect(
    !texts2.includes('Итого: 0 ₽') && renders2 === 2,
    `6.6 итог при рендере: 2 рендера, без 0 ₽ (${renders2} ${JSON.stringify(texts2)})`,
  );
}
if (want('6.6')) {
  // Сброс отзыва эффектом: в DOM побывал старый счётчик у новой игры
  const f = edit(
    s6start,
    'game/GameDetails.tsx',
    '}: GameDetailsProps) {\n',
    "}: GameDetailsProps) {\n  console.log('render GameDetails', game.title);\n",
  );
  const r = await run(f);
  await open(r.page, 'Остров сокровищ');
  await typeInto(r.page, 'textarea', 'Отличная игра');
  await r.fresh();
  await r.page.evaluate(() => {
    window.__seen = [];
    new MutationObserver(() => {
      const t = document.querySelector('main article h2')?.textContent;
      const c = [...document.querySelectorAll('main article span')].find((s) =>
        s.textContent.includes('/ 300'),
      )?.textContent;
      window.__seen.push(`${t} | ${c}`);
    }).observe(document.body, { subtree: true, childList: true, characterData: true });
  });
  await press(r.page, 'Следующая игра →');
  const states = await seen(r.page);
  const lines = logLines(await r.fresh());
  console.log('    сброс эффектом:', JSON.stringify(states), JSON.stringify(lines));
  expect(
    states.some((x) => x.startsWith('Драконья почта | 13 / 300')),
    '6.6 сброс эффектом: у «Драконьей почты» в DOM побывал «13 / 300»',
  );
  expect((await field(r.page, 'textarea')) === '', '6.6 сброс эффектом: в итоге поле пустое');
  expect(same(lines, Array(4).fill('render GameDetails Драконья почта')), '6.6 сброс эффектом: 4 рендера вместо 2');
}
if (want('6.6')) {
  // Уведомление через эффект: повторное добавление той же игры не перезапускает таймер
  const r = await run(s6start);
  await add(r.page, 'Остров сокровищ', 3);
  await wait(1400);
  await add(r.page, 'Остров сокровищ', 3);
  const gone = await toastGoneAfter(r.page);
  expect(gone > 600 && gone < 1400, `6.6 уведомление в эффекте: второй щелчок по той же игре не продлил (${gone} мс)`);
  const r2 = await run(s6);
  await add(r2.page, 'Остров сокровищ', 3);
  await wait(1400);
  await add(r2.page, 'Остров сокровищ', 3);
  const gone2 = await toastGoneAfter(r2.page);
  expect(gone2 > 2200, `6.6 уведомление в обработчике: второй щелчок продлил (${gone2} мс)`);
}

// ---------- 6.7 useEffectEvent ----------
const s7 = readDir(`${CH}/07-effect-event/solution`);
const EFFECT_EVENT = `  const onView = useEffectEvent((gameId: number) => {
    track('просмотр', { gameId, inCart: quantity });
  });

  // Синхронизация с аналитикой: страница игры показана 3 с
  useEffect(() => {
    const id = setTimeout(() => onView(game.id), VIEW_DELAY);
    return () => clearTimeout(id);
  }, [game.id]);`;
const naive = (deps) => `  // Синхронизация с аналитикой: страница игры показана 3 с
  useEffect(() => {
    const id = setTimeout(
      () => track('просмотр', { gameId: game.id, inCart: quantity }),
      VIEW_DELAY,
    );
    return () => clearTimeout(id);
  }, ${deps});`;
const variant = (deps) => {
  let f = edit(s7, 'game/GameDetails.tsx', EFFECT_EVENT, naive(deps));
  f = edit(
    f,
    'game/GameDetails.tsx',
    'import { useEffect, useEffectEvent, useState }',
    'import { useEffect, useState }',
  );
  return f;
};
// Сценарий: открыть «Остров», через 1 с — «В корзину», ждать; ещё раз «В корзину» через 4,5 с
async function viewScenario(files) {
  const r = await run(files);
  await r.fresh();
  const t0 = Date.now();
  await open(r.page, 'Остров сокровищ');
  const stamp = [];
  const poll = async (until) => {
    while (Date.now() - t0 < until) {
      for (const l of logLines(await r.fresh())) stamp.push(`${Math.round((Date.now() - t0) / 500) / 2} с: ${l}`);
      await wait(100);
    }
  };
  await poll(1000);
  await press(r.page, 'В корзину', 'main article');
  await poll(5000);
  await press(r.page, 'В корзину', 'main article');
  await poll(8500);
  return stamp;
}
for (const [name, files] of !want('6.7')
  ? []
  : [
      ['[game.id] без useEffectEvent', variant('[game.id]')],
      ['[game.id, quantity]', variant('[game.id, quantity]')],
      ['useEffectEvent', s7],
    ]) {
  console.log(`    ${name}:`, JSON.stringify(await viewScenario(files)));
  console.log('      типы:', JSON.stringify(typeErrors(files)));
}
if (want('6.7')) {
  // Вызов во время рендера
  const f = edit(
    s7,
    'game/GameDetails.tsx',
    '  // Синхронизация с аналитикой',
    '  onView(game.id);\n  // Синхронизация с аналитикой',
  );
  const r = await run(f);
  await open(r.page, 'Остров сокровищ');
  console.log(
    '    onView при рендере:',
    JSON.stringify((await r.fresh()).slice(0, 2)),
    JSON.stringify((await pageText(r.page)).slice(0, 30)),
  );
}

if (want('6.7')) {
  // Ушли раньше 3 с — просмотра нет
  const r = await run(s7);
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  await wait(1500);
  await press(r.page, '← К каталогу');
  await wait(2500);
  expect(logLines(await r.fresh()).length === 0, '6.7 ушли раньше 3 с — события нет');
}

// ---------- 6.8 useLayoutEffect и порталы ----------
const s8 = readDir(`${CH}/08-layout-portal/solution`);
// Навести мышь на бейдж «Хит» карточки (n — номер в «Хитах») и вернуть прямоугольники бейджа и подсказки
async function hoverHit(page, n) {
  const badge = (await page.$$('main > section:nth-of-type(2) [class*=anchor]'))[n];
  await badge.hover();
  await wait(150);
  return page.evaluate((n) => {
    const a = document.querySelectorAll('main > section:nth-of-type(2) [class*=anchor]')[n].getBoundingClientRect();
    const t = document.querySelector('[role=tooltip]');
    if (!t) return null;
    const r = t.getBoundingClientRect();
    return {
      anchor: { left: Math.round(a.left), bottom: Math.round(a.bottom) },
      tip: { left: Math.round(r.left), top: Math.round(r.top), right: Math.round(r.right), width: Math.round(r.width) },
      parent: t.parentElement.tagName,
      text: t.textContent,
      vw: window.innerWidth,
    };
  }, n);
}
if (want('6.8')) {
  const r = await run(s8);
  const first = await hoverHit(r.page, 0);
  console.log('    Остров:', JSON.stringify(first));
  expect(
    first && first.tip.left === first.anchor.left && Math.abs(first.tip.top - first.anchor.bottom - 8) <= 3,
    '6.8 подсказка под бейджем, по левому краю',
  );
  expect(first.parent === 'BODY' && first.text.startsWith('Рейтинг 4,6'), '6.8 подсказка — в <body> (портал)');
  const third = await hoverHit(r.page, 2);
  console.log('    Нарды:', JSON.stringify(third));
  expect(
    third.tip.right === third.vw - 8 && third.tip.left < third.anchor.left,
    '6.8 у правого края — сдвинута влево, 8 px от края',
  );
  await r.page.mouse.move(5, 5);
  await wait(100);
  expect((await r.page.$('[role=tooltip]')) === null, '6.8 мышь ушла — подсказки нет');
  // Фокус с клавиатуры
  await r.page.focus('main > section:nth-of-type(2) [class*=anchor]');
  await wait(100);
  const desc = await r.page.evaluate(() => {
    const a = document.activeElement;
    const t = document.querySelector('[role=tooltip]');
    return t && a.getAttribute('aria-describedby') === t.id;
  });
  expect(desc, '6.8 фокус — подсказка, aria-describedby = id подсказки');
  expect((await r.fresh()).length === 0, '6.8 консоль пуста');
}
if (want('6.8')) {
  // Без ограничения: вылезает за край
  const f = edit(
    s8,
    'shared/Tooltip.tsx',
    'const left = Math.min(\n      anchor.left,\n      window.innerWidth - tip.width - GAP,\n    );',
    'const left = anchor.left;',
  );
  const r = await run(f);
  const third = await hoverHit(r.page, 2);
  console.log('    без ограничения:', JSON.stringify(third));
  expect(third.tip.right === third.vw && third.tip.width < 120, '6.8 без ограничения — сжата у края окна до ~100 px');
}
if (want('6.8')) {
  // Без портала: transform у карточки — координаты от карточки
  let f = edit(
    s8,
    'shared/Tooltip.tsx',
    '          document.body,\n        )}',
    '          anchorRef.current?.parentElement ?? document.body,\n        )}',
  );
  f = edit(s8, 'shared/Tooltip.tsx', '      {open &&\n        createPortal(\n', '      {open && (\n');
  f = edit(
    f,
    'shared/Tooltip.tsx',
    '          </div>,\n          document.body,\n        )}',
    '          </div>\n      )}',
  );
  f = edit(f, 'shared/Tooltip.tsx', "import { createPortal } from 'react-dom';\n", '');
  const r = await run(f);
  const first = await hoverHit(r.page, 0);
  console.log('    без портала:', JSON.stringify(first), JSON.stringify(typeErrors(f)));
  await r.page.screenshot({ path: `${OUT}/ch06-no-portal.png` });
}
if (want('6.8')) {
  // useEffect вместо useLayoutEffect + медленный процессор: был ли кадр до замера
  for (const hook of ['useLayoutEffect', 'useEffect']) {
    let f = edit(
      s8,
      'shared/Tooltip.tsx',
      '  useLayoutEffect(() => {\n    if (!open) return;\n',
      `  useLayoutEffect(() => {\n    if (open) requestAnimationFrame(() => console.log('кадр, left =', tipRef.current?.style.left || 'не задан'));\n  }, [open]);\n  ${hook}(() => {\n    if (!open) return;\n    console.log('замер');\n`,
    );
    if (hook === 'useEffect')
      f = edit(f, 'shared/Tooltip.tsx', 'import {\n  useId,', 'import {\n  useEffect,\n  useId,');
    const r = await run(f);
    const cdp = await r.page.createCDPSession();
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 20 });
    await r.fresh();
    const res = [];
    for (let i = 0; i < 3; i++) {
      await hoverHit(r.page, 2);
      await wait(400);
      res.push(logLines(await r.fresh()).join(' / '));
      await r.page.mouse.move(5, 5);
      await wait(300);
      await r.fresh();
    }
    console.log(`    ${hook} (CPU ×20):`, JSON.stringify(res));
  }
}
if (want('6.8')) {
  // События из портала всплывают по дереву React
  const r = await run(
    mini(`import { createPortal } from 'react-dom';
function App() {
  return (
    <div onClick={() => console.log('щелчок дошёл до App')}>
      {createPortal(<button id="p">в портале</button>, document.body)}
    </div>
  );
}`),
  );
  await r.fresh();
  await r.page.click('#p');
  await wait(150);
  const lines = logLines(await r.fresh());
  const parent = await r.page.$eval('#p', (b) => b.parentElement.tagName);
  expect(
    same(lines, ['щелчок дошёл до App']) && parent === 'BODY',
    `6.8 событие из портала всплыло до App (${lines}, родитель в DOM ${parent})`,
  );
}

// ---------- 6.9 Внешние хранилища ----------
const s9 = readDir(`${CH}/09-external-store/solution`);
const banner = (page) => page.evaluate(() => document.querySelector('[role=alert]')?.textContent ?? null);
if (want('6.9')) {
  const f = edit(
    edit(
      s9,
      'layout/OfflineBanner.tsx',
      'export function OfflineBanner() {\n  const online = useSyncExternalStore(subscribe, getSnapshot);\n',
      "export function OfflineBanner() {\n  const online = useSyncExternalStore(subscribe, getSnapshot);\n  console.log('render OfflineBanner', online);\n",
    ),
    'layout/OfflineBanner.tsx',
    "  window.addEventListener('online', onStoreChange);\n",
    "  console.log('подписка');\n  window.addEventListener('online', onStoreChange);\n",
  );
  const g = edit(
    f,
    'layout/OfflineBanner.tsx',
    '  return () => {\n',
    "  return () => {\n    console.log('отписка');\n",
  );
  const r = await run(g);
  console.log('    запуск:', JSON.stringify(logLines(await r.fresh())));
  expect((await banner(r.page)) === null, '6.9 в сети — полосы нет');
  await r.page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await wait(150);
  console.log('    поддельное offline:', JSON.stringify(logLines(await r.fresh())), await banner(r.page));
  await r.page.setOfflineMode(true);
  await wait(300);
  console.log('    офлайн:', JSON.stringify(logLines(await r.fresh())), await banner(r.page));
  expect((await banner(r.page))?.startsWith('Нет сети'), '6.9 офлайн — «Нет сети…»');
  await r.page.setOfflineMode(false);
  await wait(300);
  console.log('    онлайн:', JSON.stringify(logLines(await r.fresh())));
  expect((await banner(r.page)) === null, '6.9 сеть вернулась — полосы нет');
  await r.page.setOfflineMode(true);
  await wait(300);
  await r.page.screenshot({ path: `${OUT}/ch06-offline.png` });
  await r.page.evaluate(() => window.scrollTo(0, 800));
  await wait(100);
  const top = await r.page.$eval('[role=alert]', (b) => Math.round(b.getBoundingClientRect().top));
  expect(top === 0, `6.9 полоса прилипает к верху при прокрутке (top ${top})`);
}
if (want('6.9')) {
  // getSnapshot возвращает новый объект
  let f = edit(s9, 'layout/OfflineBanner.tsx', '  return navigator.onLine;', '  return { online: navigator.onLine };');
  f = edit(
    f,
    'layout/OfflineBanner.tsx',
    '  const online = useSyncExternalStore(subscribe, getSnapshot);',
    '  const { online } = useSyncExternalStore(subscribe, getSnapshot);',
  );
  const r = await run(f);
  const lines = await r.fresh();
  console.log(
    '    новый объект:',
    JSON.stringify(lines.map((l) => l.slice(0, 200))),
    JSON.stringify((await pageText(r.page)).slice(0, 20)),
  );
}
if (want('6.9')) {
  // subscribe внутри компонента — переподписка на каждый рендер
  let f = edit(
    s9,
    'layout/OfflineBanner.tsx',
    "  window.addEventListener('online', onStoreChange);\n",
    "  console.log('подписка');\n  window.addEventListener('online', onStoreChange);\n",
  );
  f = edit(
    f,
    'layout/OfflineBanner.tsx',
    'export function OfflineBanner() {\n',
    'export function OfflineBanner({ n }: { n: number }) {\n  const sub = (cb: () => void) => subscribe(cb);\n',
  );
  f = edit(
    f,
    'layout/OfflineBanner.tsx',
    'useSyncExternalStore(subscribe, getSnapshot)',
    'useSyncExternalStore(sub, getSnapshot)',
  );
  f = edit(
    f,
    'layout/OfflineBanner.tsx',
    '  if (online) return null;',
    '  if (online) return <span hidden>{n}</span>;',
  );
  f = edit(f, 'App.tsx', '<OfflineBanner />', '<OfflineBanner n={cartCount} />');
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Нарды', 3);
  console.log('    subscribe в компоненте, щелчок:', JSON.stringify(logLines(await r.fresh())));
}

// ---------- 6.10 Под капотом: когда выполняются эффекты ----------
if (want('6.10')) {
  // Код датчика — прямо из текста урока
  const md = readFileSync(`${CH}/10-under-the-hood/lesson.md`, 'utf8');
  const probe = md.match(/```tsx main\.tsx\n([\s\S]*?)```/)[1];
  const files = { ...readDir(`${CH}/10-under-the-hood/start`), 'main.tsx': probe };
  expect(typeErrors(files).length === 0, `6.10 код датчика без ошибок типов ${typeErrors(files)}`);
  const r = await run(files, { waitMs: 600 });
  const step = async () => {
    await wait(400);
    return logLines(await r.fresh());
  };
  const expected = (title) => {
    const block = md.slice(md.indexOf(title)).match(/```\n([\s\S]*?)```/)[1];
    return block
      .trim()
      .split('\n')
      .map((l) => l.replace(/^…$/, '…'));
  };
  const cmp = (got, title) => {
    const want = expected(title);
    const cut = want.includes('…') ? got.slice(0, want.indexOf('…')) : got;
    const ok = same(
      cut.map((l) => l.trimEnd()),
      want.filter((l) => l !== '…').map((l) => l.trimEnd()),
    );
    expect(ok, `6.10 лог «${title}» совпадает с текстом${ok ? '' : ` ${JSON.stringify(got)}`}`);
  };
  cmp(await step(), '## Запуск');
  const bs = await r.page.$$('button');
  await bs[0].click();
  cmp(await step(), '## Щелчок');
  await bs[1].hover();
  cmp(await step(), '## Наведение');
  await bs[2].click();
  cmp(await step(), '## Удаление компонента');
  // С микрозадачей из layout-эффекта
  const f2 = edit(
    files,
    'main.tsx',
    '    console.log(`  layout ${name}`);\n',
    "    console.log(`  layout ${name}`);\n    if (name === 'Parent')\n      queueMicrotask(() => console.log('  · микрозадача из layout'));\n",
  );
  const r2 = await run(f2, { waitMs: 600 });
  await wait(300);
  const order = (lines) =>
    lines.indexOf('  effect Child') < lines.indexOf('  · микрозадача из layout')
      ? 'эффект раньше'
      : 'микрозадача раньше';
  const start = logLines(await r2.fresh());
  const b2 = await r2.page.$$('button');
  await b2[0].click();
  await wait(400);
  const click = logLines(await r2.fresh());
  await b2[1].hover();
  await wait(400);
  const hover = logLines(await r2.fresh());
  const res = [order(start), order(click), order(hover)];
  expect(
    same(res, ['микрозадача раньше', 'эффект раньше', 'микрозадача раньше']),
    `6.10 микрозадача из layout: запуск/щелчок/наведение — ${res}`,
  );
}

// ---------- 6.11 Практикум: «Показать ещё» ----------
const s11 = readDir(`${CH}/11-practice/solution`);
const hasMore = (page) =>
  page.evaluate(() => [...document.querySelectorAll('main button')].some((b) => b.textContent === 'Показать ещё'));
if (want('6.11')) {
  const f = edit(
    edit(
      s11,
      'catalog/LoadMore.tsx',
      '    observer.observe(ref.current!);\n',
      "    console.log('наблюдение: старт');\n    observer.observe(ref.current!);\n",
    ),
    'catalog/LoadMore.tsx',
    '    return () => observer.disconnect();',
    "    return () => {\n      console.log('наблюдение: стоп');\n      observer.disconnect();\n    };",
  );
  const r = await run(f);
  expect(
    same(logLines(await r.fresh()), ['наблюдение: старт', 'наблюдение: стоп', 'наблюдение: старт']),
    '6.11 наблюдение: старт, стоп, старт (StrictMode)',
  );
  expect(
    (await titles(r.page)).length === 3 && (await hasMore(r.page)),
    `6.11 при запуске — 3 игры и «Показать ещё» (${await titles(r.page)})`,
  );
  await add(r.page, 'Нарды', 2);
  expect(logLines(await r.fresh()).length === 0, '6.11 «В корзину» — наблюдатель не пересоздан');
  expect(nb(await sectionText(r.page, 3)).startsWith('Все игры 6'), '6.11 бейдж — 6 найденных');
  await r.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(300);
  expect(
    (await titles(r.page)).length === 6 && !(await hasMore(r.page)),
    `6.11 докрутили — 6 игр, кнопки нет (${(await titles(r.page)).length})`,
  );
  expect(
    same(logLines(await r.fresh()), ['наблюдение: стоп']),
    '6.11 все показаны — LoadMore ушёл, наблюдение остановлено',
  );
  await r.page.evaluate(() => window.scrollTo(0, 0));
  await select(r.page, 0, 'family');
  expect(
    same(await titles(r.page), ['Остров сокровищ', 'Драконья почта', 'Нарды']) && !(await hasMore(r.page)),
    '6.11 «Семейные» — 3 игры, кнопки нет',
  );
  await select(r.page, 0, 'all');
  expect((await titles(r.page)).length === 3 && (await hasMore(r.page)), '6.11 смена фильтра — снова первая порция');
  await r.fresh();
  await press(r.page, 'Показать ещё');
  expect((await titles(r.page)).length === 6, '6.11 кнопка «Показать ещё» — 6 игр');
  await select(r.page, 0, 'kids');
  await press(r.page, 'Сбросить фильтры');
  expect((await titles(r.page)).length === 3, '6.11 «Сбросить фильтры» — первая порция');
  await r.fresh();
  await r.page.screenshot({ path: `${OUT}/ch06-practice.png` });
}
if (want('6.11')) {
  // Без очистки: после ухода LoadMore наблюдатель жив
  const f = edit(
    edit(
      s11,
      'catalog/LoadMore.tsx',
      '      if (entry.isIntersecting) onVisible();',
      "      console.log('видна:', entry.isIntersecting);\n      if (entry.isIntersecting) onVisible();",
    ),
    'catalog/LoadMore.tsx',
    '    return () => observer.disconnect();\n',
    '',
  );
  const r = await run(f);
  console.log('    без очистки, запуск:', JSON.stringify(logLines(await r.fresh())));
  await r.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(300);
  console.log('    без очистки, прокрутка:', JSON.stringify(logLines(await r.fresh())), (await titles(r.page)).length);
}
if (want('6.11')) {
  // Порция 2: с очисткой — 2 → 4, без очистки — 2 → 6 за одну прокрутку
  for (const cleanup of [true, false]) {
    let f = edit(s11, 'App.tsx', 'const PAGE_SIZE = 3;', 'const PAGE_SIZE = 2;');
    if (!cleanup) f = edit(f, 'catalog/LoadMore.tsx', '    return () => observer.disconnect();\n', '');
    const r = await run(f);
    const before = (await titles(r.page)).length;
    await r.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await wait(300);
    const after = (await titles(r.page)).length;
    expect(
      before === 2 && after === (cleanup ? 4 : 6),
      `6.11 порция 2, ${cleanup ? 'с очисткой' : 'без очистки'}: ${before} → ${after}`,
    );
  }
}

if (want('6.11')) {
  // onLoad в зависимостях вместо useEffectEvent — наблюдатель пересоздаётся на каждый рендер App
  let f = edit(
    s11,
    'catalog/LoadMore.tsx',
    '      if (entry.isIntersecting) onVisible();',
    '      if (entry.isIntersecting) onLoad();',
  );
  f = edit(f, 'catalog/LoadMore.tsx', '  const onVisible = useEffectEvent(() => onLoad());\n', '');
  f = edit(f, 'catalog/LoadMore.tsx', '  }, []);', '  }, [onLoad]);');
  f = edit(f, 'catalog/LoadMore.tsx', 'import { useEffect, useEffectEvent, useRef }', 'import { useEffect, useRef }');
  f = edit(
    f,
    'catalog/LoadMore.tsx',
    '    observer.observe(ref.current!);\n',
    "    console.log('наблюдение: старт');\n    observer.observe(ref.current!);\n",
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Нарды', 2);
  const lines = logLines(await r.fresh());
  expect(same(lines, ['наблюдение: старт']), `6.11 onLoad в зависимостях: «В корзину» — новый наблюдатель (${lines})`);
}

await browser.close();
if (failures.length) {
  console.log(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло');
