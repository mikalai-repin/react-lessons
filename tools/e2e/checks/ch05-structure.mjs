// Проверка утверждений и экспериментов главы 5 «Структура состояния и поля ввода»: каждый эксперимент из текста —
// на коде того шага, о котором текст. node tools/e2e/checks/ch05-structure.mjs (нужен npm run dev)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { CONTENT, OUT, ROOT, collect, compileMap, launch, openPreview, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/05-structure`;
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
const TC = join(OUT, 'ch05-tc');
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

// Каждый шаг: консоль пуста, ошибок типов нет
for (const step of [
  '01-controlled',
  '02-uncontrolled',
  '03-derived',
  '04-structure',
  '05-reset',
  '06-reducer',
  '07-immer',
  '09-practice',
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

// ---------- 5.1 Управляемые поля ----------
const s1 = readDir(`${CH}/01-controlled/solution`);
{
  const r = await run(
    edit(s1, 'App.tsx', 'export function App() {', "export function App() {\n  console.log('render App');"),
  );
  await r.fresh();
  await typeInto(r.page, 'input[type=search]', 'ко');
  const lines = logLines(await r.fresh());
  expect(
    same(await titles(r.page), ['Драконья почта', 'Космические коты']),
    `5.1 «ко» → Драконья почта, Космические коты (${await titles(r.page)})`,
  );
  expect(same(lines, Array(4).fill('render App')), `5.1 две буквы — 4 строки render App (${lines.length})`);
  await select(r.page, 0, 'family');
  expect(same(await titles(r.page), ['Драконья почта']), '5.1 «ко» + «Семейные» → Драконья почта');
  await r.page.$eval('input[type=search]', (e) => e.select());
  await r.page.keyboard.press('Backspace');
  await wait(100);
  expect(
    same(await titles(r.page), ['Остров сокровищ', 'Драконья почта', 'Нарды']),
    `5.1 «Семейные» без поиска: ${await titles(r.page)}`,
  );
  expect(
    same(await titles(r.page, 2), ['Остров сокровищ', 'Ночной экспресс', 'Нарды']),
    '5.1 «Хиты» фильтр не трогает',
  );
}
{
  const r = await run(edit(s1, 'App.tsx', 'onChange={(e) => setQuery(e.target.value)}', ''));
  const lines = await r.fresh();
  await typeInto(r.page, 'input[type=search]', 'кот');
  expect(
    has(
      lines,
      'You provided a `value` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultValue`. Otherwise, set either `onChange` or `readOnly`.',
    ) && (await field(r.page, 'input[type=search]')) === '',
    '5.1 value без onChange: предупреждение, ввод не меняет поле',
  );
}
{
  const f = edit(s1, 'App.tsx', "useState('')", 'useState<string>()');
  expect(
    typeHas(typeErrors(f), "'query' is possibly 'undefined'."),
    "5.1 useState<string>(): TS18048 'query' is possibly 'undefined'",
  );
  const r = await run(edit(f, 'App.tsx', 'query.trim()', "(query ?? '').trim()"));
  expect((await r.fresh()).length === 0, '5.1 undefined в value: при запуске консоль молчит');
  await typeInto(r.page, 'input[type=search]', 'к');
  const lines = await r.fresh();
  expect(
    has(
      lines,
      'A component is changing an uncontrolled input to be controlled. This is likely caused by the value changing from undefined to a defined value, which should not happen. Decide between using a controlled or uncontrolled input element for the lifetime of the component.',
    ),
    '5.1 undefined → строка: «changing an uncontrolled input to be controlled»',
  );
}
{
  const f = edit(s1, 'App.tsx', 'e.target.value as CategoryFilter', 'e.target.value');
  const errors = typeErrors(f);
  expect(
    typeHas(
      errors,
      "Argument of type 'string' is not assignable to parameter of type 'SetStateAction<CategoryFilter>'.",
    ),
    `5.1 setCategory(e.target.value): TS2345 ${JSON.stringify(errors)}`,
  );
}
{
  const r = await run(
    edit(
      s1,
      'App.tsx',
      '<option value="all">Все</option>',
      '<option value="all">Все</option>\n<option value="kids" selected>Дети</option>',
    ),
  );
  expect(
    has(
      await r.fresh(),
      'Use the `defaultValue` or `value` props on <select> instead of setting `selected` on <option>.',
    ),
    '5.1 selected у <option>: предупреждение',
  );
}

// ---------- 5.2 Неуправляемые поля ----------
const s2 = readDir(`${CH}/02-uncontrolled/solution`);
{
  const r = await run(
    edit(
      s2,
      'layout/Footer.tsx',
      'export function Footer() {',
      "export function Footer() {\n  console.log('render Footer');",
    ),
  );
  await r.fresh();
  await typeInto(r.page, 'footer input[name=email]', 'anya@example.ru');
  await r.page.select('footer select', 'sale');
  await r.page.click('footer input[name=weekly]');
  await wait(100);
  const typing = logLines(await r.fresh());
  expect(typing.length === 0, `5.2 ввод, выбор и флажок — ни одного рендера Footer (${typing.length})`);
  await press(r.page, 'Подписаться', 'footer');
  const after = logLines(await r.fresh());
  const text = nb(await r.page.$eval('footer', (f) => f.innerText));
  expect(
    text.endsWith('Подписка оформлена — anya@example.ru: скидки') && same(after, ['render Footer', 'render Footer']),
    `5.2 отправка: «${text.slice(-45)}», рендеров ${after.length}`,
  );
  const values = await r.page.$eval('footer form', (f) => [f.email.value, f.topic.value, f.weekly.checked]);
  expect(same(values, ['', 'new', true]), `5.2 reset вернул значения по умолчанию ${JSON.stringify(values)}`);
  await typeInto(r.page, 'footer input[name=email]', 'boris@example.ru');
  await press(r.page, 'Подписаться', 'footer');
  expect(
    nb(await r.page.$eval('footer', (f) => f.innerText)).endsWith('boris@example.ru: новинки, раз в неделю'),
    '5.2 по умолчанию: «новинки, раз в неделю»',
  );
}
{
  const r = await run(s2);
  await typeInto(r.page, 'footer input[name=email]', 'abc');
  await press(r.page, 'Подписаться', 'footer');
  expect(
    !(await pageText(r.page)).includes('Подписка оформлена'),
    '5.2 «abc» в type="email": браузер не отправляет форму',
  );
}
{
  const f = edit(
    s2,
    'layout/Footer.tsx',
    "    const weekly = data.get('weekly') === 'on';",
    "    const weekly = data.get('weekly') === 'on';\n    console.log([...data.entries()]);",
  );
  const r = await run(f);
  await typeInto(r.page, 'footer input[name=email]', 'a@b.ru');
  await r.page.click('footer input[name=weekly]');
  await press(r.page, 'Подписаться', 'footer');
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['[["email", "a@b.ru"], ["topic", "new"]]']),
    `5.2 неотмеченного флажка в FormData нет: ${JSON.stringify(lines)}`,
  );
}
{
  // defaultValue — только начальное значение
  const r = await run(
    mini(`function App() {
  const [n, setN] = useState(1);
  return <><input defaultValue={'v' + n} /><button onClick={() => setN(n + 1)}>+</button></>;
}`),
  );
  await r.page.click('button');
  await wait(100);
  const v = await r.page.$eval('input', (e) => [e.value, e.getAttribute('value')]);
  expect(same(v, ['v1', 'v2']), `5.2 defaultValue после монтирования: поле v1, атрибут v2 (${v})`);
}
{
  const r = await run(mini(`function App() {\n  return <input type="checkbox" checked={true} />;\n}`));
  expect(
    has(await r.fresh(), 'You provided a `checked` prop to a form field without an `onChange` handler.'),
    '5.2 checked без onChange: предупреждение (про defaultChecked)',
  );
  await r.page.click('input');
  await wait(100);
  expect(await field(r.page, 'input'), '5.2 checked без onChange: щелчок не снимает флажок');
}

// ---------- 5.3 Вычислять, а не хранить ----------
const s3 = readDir(`${CH}/03-derived/solution`);
{
  const r = await run(s3);
  await select(r.page, 1, 'cheap');
  expect(
    same(await titles(r.page), [
      'Драконья почта',
      'Космические коты',
      'Остров сокровищ',
      'Маяк',
      'Нарды',
      'Ночной экспресс',
    ]),
    '5.3 «Сначала дешёвые»',
  );
  await r.page.click('main input[type=checkbox]');
  await wait(100);
  expect(!(await titles(r.page)).includes('Маяк'), '5.3 «Только в наличии» убирает «Маяк»');
  await select(r.page, 1, 'rating');
  expect(
    same(await titles(r.page), ['Ночной экспресс', 'Остров сокровищ', 'Нарды', 'Драконья почта', 'Космические коты']),
    `5.3 по рейтингу: ${await titles(r.page)}`,
  );
  await select(r.page, 1, 'default');
  expect(
    same(await titles(r.page), ['Остров сокровищ', 'Драконья почта', 'Ночной экспресс', 'Нарды', 'Космические коты']),
    '5.3 «Как в каталоге» — исходный порядок (toSorted не меняет games)',
  );
}
{
  // Анти-пример: список в состоянии, обновляется только в обработчике поиска
  let f = edit(
    s3,
    'App.tsx',
    "const [sort, setSort] = useState<SortOrder>('default');",
    "const [sort, setSort] = useState<SortOrder>('default');\n  const [shown, setShown] = useState(games);",
  );
  f = edit(f, 'App.tsx', '{visibleGames.map((game) => (', '{shown.map((game) => (');
  f = edit(
    f,
    'App.tsx',
    'onChange={(e) => setQuery(e.target.value)}',
    `onChange={(e) => {
                  setQuery(e.target.value);
                  setShown(
                    games.filter((game) =>
                      game.title.toLowerCase().includes(e.target.value.toLowerCase()),
                    ),
                  );
                }}`,
  );
  expect(
    typeHas(typeErrors(f), "'visibleGames' is declared but its value is never read."),
    '5.3 анти-пример: visibleGames не используется (TS6133)',
  );
  const r = await run(f);
  await typeInto(r.page, 'input[type=search]', 'ко');
  await select(r.page, 0, 'family');
  expect(
    same(await titles(r.page), ['Драконья почта', 'Космические коты']),
    `5.3 анти-пример: «Семейные» не применились, «Космические коты» на месте (${await titles(r.page)})`,
  );
}

{
  const errors = typeErrors(edit(s3, 'App.tsx', '  rating: (a, b) => b.rating - a.rating,\n', ''));
  expect(
    typeHas(errors, "Property 'rating' is missing in type"),
    `5.3 Record без ключа — ошибка типов ${JSON.stringify(errors)}`,
  );
}
{
  // Копия props в состоянии не обновляется
  const r = await run(
    mini(`function Child({ n }: { n: number }) {
  const [copy] = useState(n);
  return <p>{n}/{copy}</p>;
}
function App() {
  const [n, setN] = useState(1);
  return <><Child n={n} /><button onClick={() => setN(n + 1)}>+</button></>;
}`),
  );
  await r.page.click('button');
  await wait(100);
  expect(
    (await r.page.$eval('p', (p) => p.textContent)) === '2/1',
    '5.3 useState(props.n): копия осталась старой (2/1)',
  );
}

// ---------- 5.4 Принципы структуры ----------
const s4 = readDir(`${CH}/04-structure/solution`);
{
  const r = await run(s4);
  await open(r.page, 'Драконья почта');
  const t = await detailsText(r.page);
  expect(
    t.startsWith('← К каталогу Драконья почта Игроки: 2–4 · 30 мин · 7+') &&
      !(await r.page.$('main > section:nth-of-type(2)')),
    `5.4 страница игры вместо каталога: «${t.slice(0, 60)}»`,
  );
  await press(r.page, 'В корзину', 'main article');
  expect(
    (await detailsText(r.page)).includes('В корзине: 1 шт.') && (await pageText(r.page)).includes('Корзина: 1'),
    '5.4 «В корзину» на странице игры: «В корзине: 1 шт.» и «Корзина: 1»',
  );
  await press(r.page, '← К каталогу');
  expect((await titles(r.page)).length === 6, '5.4 «← К каталогу» — снова каталог');
  expect(
    (
      await r.page.$$eval('main > section:nth-of-type(3) article', (as) =>
        as.filter((a) => a.innerText.includes('В корзине: 1 шт.')).map((a) => a.querySelector('h3').textContent),
      )
    )[0] === 'Драконья почта',
    '5.4 после возврата: «В корзине: 1 шт.» у «Драконьей почты»',
  );
  await select(r.page, 0, 'family');
  await open(r.page, 'Нарды');
  await press(r.page, '← К каталогу');
  expect((await r.page.$eval('main select', (s) => s.value)) === 'family', '5.4 фильтры пережили страницу игры');
}
{
  const errors = typeErrors(edit(s4, 'App.tsx', 'useState<number | null>(', 'useState('));
  expect(
    typeHas(errors, "Argument of type 'number' is not assignable to parameter of type 'SetStateAction<null>'."),
    `5.4 useState(null) без типа — TS2345 ${JSON.stringify(errors.slice(0, 2))}`,
  );
}
{
  // Анти-пример: копия количества в состоянии
  let f = edit(
    s4,
    'App.tsx',
    'export function App() {',
    'export function App() {\n  const [selectedQuantity, setSelectedQuantity] = useState(0);',
  );
  f = edit(
    f,
    'App.tsx',
    'onSelect={() => setSelectedId(game.id)}',
    'onSelect={() => {\n setSelectedId(game.id);\n setSelectedQuantity(quantityOf(game.id));\n }}',
    true,
  );
  f = edit(f, 'App.tsx', 'quantity={quantityOf(selectedGame.id)}', 'quantity={selectedQuantity}');
  const r = await run(f);
  await open(r.page, 'Ночной экспресс');
  for (let i = 0; i < 4; i++) await press(r.page, 'В корзину', 'main article');
  const t = await detailsText(r.page);
  const cart = await sectionText(r.page, 1);
  expect(
    !t.includes('В корзине') &&
      cart.includes('Ночной экспресс − 4 +') &&
      (await r.page.$eval('main article button.button', (b) => !b.disabled)),
    `5.4 анти-пример: копия устарела — «В корзине» нет, кнопка активна, в корзине 4 при остатке 3 (${cart.slice(0, 40)})`,
  );
}

// ---------- 5.5 Сохранение и сброс состояния ----------
const s5 = readDir(`${CH}/05-reset/solution`);
const review = (page) => page.$eval('textarea', (t) => t.value);
const thanks = async (page) => (await pageText(page)).includes('Спасибо! Отзыв появится после проверки.');
{
  const r = await run(s5);
  await open(r.page, 'Остров сокровищ');
  await typeInto(r.page, 'textarea', 'Отличная игра');
  expect((await detailsText(r.page)).includes('13 / 300'), '5.5 счётчик символов «13 / 300»');
  await press(r.page, 'Следующая игра →');
  expect(
    (await detailsText(r.page)).includes('Драконья почта') && (await review(r.page)) === '',
    '5.5 с key: «Следующая игра» — поле пустое',
  );
  await typeInto(r.page, 'textarea', 'Хорошо');
  await press(r.page, 'Отправить', 'main article');
  expect((await thanks(r.page)) && (await review(r.page)) === '', '5.5 «Отправить»: «Спасибо!…», поле пустое');
  await press(r.page, 'Следующая игра →');
  expect(!(await thanks(r.page)), '5.5 с key: у следующей игры «Спасибо» нет');
  await press(r.page, 'Следующая игра →');
  await press(r.page, 'Следующая игра →');
  await press(r.page, 'Следующая игра →');
  await press(r.page, 'Следующая игра →');
  expect((await detailsText(r.page)).includes('Остров сокровищ'), '5.5 после последней игры — снова первая');
  expect(
    await r.page.$eval('main article form button', (b) => b.disabled),
    '5.5 «Отправить» выключена при пустом отзыве',
  );
}
{
  const r = await run(edit(s5, 'App.tsx', 'key={selectedGame.id}', ''));
  await open(r.page, 'Остров сокровищ');
  await typeInto(r.page, 'textarea', 'Отличная игра');
  await press(r.page, 'Следующая игра →');
  expect(
    (await detailsText(r.page)).includes('Драконья почта') && (await review(r.page)) === 'Отличная игра',
    '5.5 без key: отзыв «Острова» остался у «Драконьей почты»',
  );
  await press(r.page, 'Отправить', 'main article');
  await press(r.page, 'Следующая игра →');
  expect(await thanks(r.page), '5.5 без key: «Спасибо» переехало на «Ночной экспресс»');
  await typeInto(r.page, 'textarea', 'Текст');
  await press(r.page, '← К каталогу');
  await open(r.page, 'Ночной экспресс');
  expect((await review(r.page)) === '' && !(await thanks(r.page)), '5.5 без key: через каталог состояние сброшено');
}

// ---------- 5.6 useReducer ----------
async function cartFlow(r, label) {
  await add(r.page, 'Остров сокровищ', 2);
  await add(r.page, 'Остров сокровищ', 3);
  await add(r.page, 'Нарды', 3);
  let cart = await sectionText(r.page, 1);
  expect(
    cart === 'Корзина 3 Остров сокровищ − 2 + 3 980 ₽ × Нарды − 1 + 2 590 ₽ × Итого: 6 570 ₽ Доставка бесплатно',
    `${label} корзина: ${cart}`,
  );
  await press(r.page, '−', 'main > section:nth-of-type(1)');
  await press(r.page, '−', 'main > section:nth-of-type(1)');
  await press(r.page, '×', 'main > section:nth-of-type(1)');
  cart = await sectionText(r.page, 1);
  expect(cart === 'Корзина Корзина пуста — добавьте игру из каталога', `${label} «−» дважды и «×» — корзина пуста`);
}
const s6 = readDir(`${CH}/06-reducer/solution`);
{
  const r = await run(s6);
  await cartFlow(r, '5.6');
}
{
  let f = edit(
    s6,
    'store/cartReducer.ts',
    '): CartItem[] {',
    "): CartItem[] {\n  console.log('reducer', action.type, action.gameId, items.length);",
  );
  f = edit(
    f,
    'App.tsx',
    "dispatch({ type: 'added', gameId });",
    "dispatch({ type: 'added', gameId });\n    console.log('после dispatch');",
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Нарды', 3);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['после dispatch', 'reducer added 10 0', 'reducer added 10 0']),
    `5.6 dispatch → лог «после dispatch», затем редьюсер дважды с тем же состоянием ${JSON.stringify(lines)}`,
  );
}
{
  const errors = typeErrors(
    edit(s6, 'App.tsx', "dispatch({ type: 'added', gameId });", "dispatch({ type: 'add', gameId });"),
  );
  expect(
    typeHas(errors, `Type '"add"' is not assignable to type '"added" | "decreased" | "removed"'.`),
    `5.6 type: 'add' — TS2322 ${JSON.stringify(errors)}`,
  );
  const errors2 = typeErrors(
    edit(s6, 'App.tsx', "dispatch({ type: 'added', gameId });", "dispatch({ type: 'added' });"),
  );
  expect(
    typeHas(errors2, "Property 'gameId' is missing in type '{ type: \"added\"; }'"),
    `5.6 без gameId — TS2345 ${JSON.stringify(errors2)}`,
  );
}

{
  const f = edit(
    s6,
    'store/cartReducer.ts',
    "    case 'removed': {\n      return items.filter(\n        (item) => item.gameId !== action.gameId,\n      );\n    }\n",
    '',
  );
  const errors = typeErrors(f);
  expect(
    typeHas(errors, "Function lacks ending return statement and return type does not include 'undefined'."),
    `5.6 без ветки 'removed' — TS2366 ${JSON.stringify(errors)}`,
  );
}

// ---------- 5.7 Immer ----------
const s7 = readDir(`${CH}/07-immer/solution`);
{
  const r = await run(s7);
  await cartFlow(r, '5.7');
}
{
  const f = edit(
    s7,
    'store/cartReducer.ts',
    '  action: CartAction,\n) {',
    "  action: CartAction,\n) {\n  console.log('reducer', action.type);",
  );
  const r = await run(f);
  await r.fresh();
  await add(r.page, 'Нарды', 3);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['reducer added', 'reducer added']) && (await sectionText(r.page, 1)).includes('Нарды − 1 +'),
    `5.7 редьюсер на черновике дважды, а штука одна ${JSON.stringify(lines)}`,
  );
}
{
  const f = edit(
    s7,
    'App.tsx',
    "dispatch({ type: 'added', gameId });",
    "if (cart.length > 0) cart[0].quantity = 99;\n    dispatch({ type: 'added', gameId });",
  );
  expect(typeErrors(f).length === 0, '5.7 изменение состояния вне редьюсера: TypeScript молчит');
  const r = await run(f);
  await add(r.page, 'Нарды', 3);
  await r.fresh();
  await add(r.page, 'Нарды', 3);
  const lines = await r.fresh();
  expect(
    has(lines, "TypeError: Cannot assign to read only property 'quantity' of object '#<Object>'") &&
      (await sectionText(r.page, 1)).includes('Нарды − 1 +'),
    `5.7 состояние заморожено: TypeError, корзина не изменилась ${JSON.stringify(lines.map((l) => l.slice(0, 120)))}`,
  );
}
{
  const f = edit(
    s7,
    'store/cartReducer.ts',
    "    case 'removed':\n      draft.splice(index, 1);\n      break;",
    "    case 'removed':\n      draft.splice(index, 1);\n      return [];",
  );
  const errors = typeErrors(f);
  const r = await run(f);
  await add(r.page, 'Нарды', 3);
  await r.fresh();
  await press(r.page, '×', 'main > section:nth-of-type(1)');
  const lines = await r.fresh();
  expect(
    errors.length === 0 &&
      has(
        lines,
        '[Immer] An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.',
      ),
    `5.7 и мутация, и return: ошибка Immer ${JSON.stringify(lines.map((l) => l.slice(0, 160)))}`,
  );
}
{
  const f = edit(
    s7,
    'store/cartReducer.ts',
    '        draft[index].quantity += 1;\n      }\n      break;',
    '        draft[index].quantity += 1;\n      }',
  );
  const errors = typeErrors(f);
  expect(typeHas(errors, 'TS7029: Fallthrough case in switch.'), `5.7 забыли break: TS7029 ${JSON.stringify(errors)}`);
}
{
  const errors = typeErrors(edit(s7, 'App.tsx', '    initialCart,\n', '    [],\n'));
  expect(
    typeHas(errors, 'App.tsx:') && typeHas(errors, "Property 'quantity' does not exist on type 'never'."),
    `5.7 useImmerReducer(cartReducer, []) — never[] ${JSON.stringify(errors.slice(0, 2))}`,
  );
}
{
  const f = edit(
    s7,
    'main.tsx',
    "import './styles.css';",
    `import './styles.css';
import { produce } from 'immer';

const base = [
  { gameId: 1, quantity: 1 },
  { gameId: 2, quantity: 1 },
];
const next = produce(base, (draft) => {
  draft[0].quantity += 1;
});
console.log(base[0].quantity, next[0].quantity);
console.log(next === base, next[0] === base[0], next[1] === base[1]);
console.log(Object.isFrozen(next), Object.isFrozen(next[1]));`,
  );
  const r = await run(f);
  const lines = logLines(await r.fresh());
  expect(
    same(lines, ['1 2', 'false false true', 'true true']),
    `5.7 produce: исходник цел, новые только изменённые объекты, результат заморожен ${JSON.stringify(lines)}`,
  );
}

// ---------- 5.8 Под капотом: позиция в дереве ----------
const PROBE = `useState(() => {
    console.log('новое состояние отзыва:', game.title);
    return '';
  });`;
const withProbe = (files) => edit(files, 'game/GameDetails.tsx', "useState('');", PROBE);
// Файбер GameDetails: индекс среди детей родителя, key и родитель
const fiberInfo = (page) =>
  page.evaluate(() => {
    const container = document.getElementById('root');
    const rootKey = Object.keys(container).find((k) => k.startsWith('__reactContainer$'));
    let found = null;
    const walk = (f) => {
      for (; f; f = f.sibling) {
        if (f.type && f.type.name === 'GameDetails') found = f;
        walk(f.child);
      }
    };
    walk(container[rootKey].stateNode.current);
    return `${found.index} ${found.key} ${found.return.type?.name ?? found.return.type}`;
  });
{
  const r = await run(withProbe(s7));
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  const opened = logLines(await r.fresh());
  expect(
    same(opened, Array(2).fill('новое состояние отзыва: Остров сокровищ')) && (await fiberInfo(r.page)) === '2 1 main',
    `5.8 открыли игру: инициализатор дважды (StrictMode), файбер — 3-й ребёнок main с key 1 ${JSON.stringify(opened)}`,
  );
  await press(r.page, 'Следующая игра →');
  const next = logLines(await r.fresh());
  expect(
    same(next, Array(2).fill('новое состояние отзыва: Драконья почта')) && (await fiberInfo(r.page)) === '2 2 main',
    '5.8 «Следующая» с key: новое состояние',
  );
  await typeInto(r.page, 'textarea', 'Драконы');
  await press(r.page, 'В корзину', 'main article');
  expect(
    (await r.fresh()).length === 0 && (await review(r.page)) === 'Драконы',
    '5.8 «В корзину»: состояние сохранилось',
  );
}
{
  const r = await run(withProbe(edit(s7, 'App.tsx', 'key={selectedGame.id}', '')));
  await open(r.page, 'Остров сокровищ');
  await r.fresh();
  await typeInto(r.page, 'textarea', 'Пираты!');
  await press(r.page, 'Следующая игра →');
  expect(
    logLines(await r.fresh()).length === 0 &&
      (await review(r.page)) === 'Пираты!' &&
      (await fiberInfo(r.page)) === '2 null main',
    '5.8 без key: тот же тип на том же месте — инициализатор не вызван, текст на месте',
  );
}
{
  // Обёртка только для игр в корзине
  const DETAILS = /( *)<GameDetails[\s\S]*?\/>/;
  const app = s7['App.tsx'];
  const details = app.match(DETAILS)[0];
  const f = withProbe({
    ...s7,
    'App.tsx': app.replace(
      DETAILS,
      `quantityOf(selectedGame.id) > 0 ? (\n<div className="in-cart">\n${details}\n</div>\n) : (\n${details}\n)`,
    ),
  });
  const r = await run(f);
  await open(r.page, 'Драконья почта');
  await typeInto(r.page, 'textarea', 'Драконы');
  await r.fresh();
  await press(r.page, 'В корзину', 'main article');
  const lines = logLines(await r.fresh());
  expect(
    same(lines, Array(2).fill('новое состояние отзыва: Драконья почта')) &&
      (await review(r.page)) === '' &&
      (await fiberInfo(r.page)) === '0 2 div',
    `5.8 обёртка <div> при «В корзину»: состояние создано заново, отзыв пропал (${await fiberInfo(r.page)})`,
  );
}
{
  // false держит место: акция скрыта, когда корзина не пуста
  const app = s7['App.tsx'];
  const PROMO = /( *)<p\n\s*className=\{styles\.promo\}[\s\S]*?\/>/;
  const f = withProbe({ ...s7, 'App.tsx': app.replace(PROMO, (m) => `{cartCount === 0 && (\n${m}\n)}`) });
  const r = await run(f);
  await open(r.page, 'Драконья почта');
  await typeInto(r.page, 'textarea', 'Драконы');
  await r.fresh();
  await press(r.page, 'В корзину', 'main article');
  expect(
    logLines(await r.fresh()).length === 0 &&
      (await review(r.page)) === 'Драконы' &&
      !(await pageText(r.page)).includes('Неделя семейных игр') &&
      (await fiberInfo(r.page)) === '2 2 main',
    `5.8 {cartCount === 0 && …}: акция пропала, индекс GameDetails тот же — 2, отзыв на месте`,
  );
}
for (const [name, jsx, expected] of [
  ['тернарный, один тип', '{isA ? <Field label="A" /> : <Field label="B" />}', 'B=привет'],
  ['два &&', '{isA && <Field label="A" />}{!isA && <Field label="B" />}', 'B='],
  ['разные key', '{isA ? <Field key="a" label="A" /> : <Field key="b" label="B" />}', 'B='],
  ['обёртка div', '{isA ? <Field label="A" /> : <div><Field label="B" /></div>}', 'B='],
]) {
  const r = await run(
    mini(`function Field({ label }: { label: string }) {
  const [text, setText] = useState('');
  return <label>{label}<input value={text} onChange={(e) => setText(e.target.value)} /></label>;
}
function App() {
  const [isA, setIsA] = useState(true);
  return <>${jsx}<button onClick={() => setIsA(!isA)}>Переключить</button></>;
}`),
  );
  await typeInto(r.page, 'input', 'привет');
  await r.page.click('button');
  await wait(100);
  const got = await r.page.$eval('label', (l) => `${l.textContent}=${l.querySelector('input').value}`);
  expect(got === expected, `5.8 ${name}: ${got}`);
}

{
  // Фрагмент whereIs для main.tsx из текста шага
  const WHERE_IS = `// Где в дереве файберов стоит компонент с таким именем
function whereIs(name: string) {
  const rootKey = Object.keys(container!).find((k) =>
    k.startsWith('__reactContainer$'),
  )!;
  const find = (fiber: any): any => {
    for (; fiber; fiber = fiber.sibling) {
      if (fiber.type?.name === name) return fiber;
      const found = find(fiber.child);
      if (found) return found;
    }
  };
  const fiber = find((container as any)[rootKey].stateNode.current);
  console.log(
    fiber
      ? \`\${name}: место \${fiber.index}, key \${fiber.key}, родитель \${fiber.return.type?.name ?? fiber.return.type}\`
      : \`\${name}: нет в дереве\`,
  );
}
// После каждого щелчка — когда React закончит обновление
document.addEventListener('click', () =>
  setTimeout(() => whereIs('GameDetails')),
);
`;
  const f = { ...s7, 'main.tsx': `${s7['main.tsx']}\n${WHERE_IS}` };
  const errors = typeErrors(f);
  const r = await run(f);
  await r.fresh();
  await open(r.page, 'Остров сокровищ');
  await press(r.page, 'Следующая игра →');
  await press(r.page, '← К каталогу');
  await wait(100);
  const lines = logLines(await r.fresh());
  // Вместе с датчиком в GameDetails — порядок строк, как в тексте
  const r2 = await run(withProbe(f));
  await r2.fresh();
  await open(r2.page, 'Остров сокровищ');
  await wait(50);
  await press(r2.page, 'Следующая игра →');
  await wait(50);
  const both = logLines(await r2.fresh());
  expect(
    same(both, [
      'новое состояние отзыва: Остров сокровищ',
      'новое состояние отзыва: Остров сокровищ',
      'GameDetails: место 2, key 1, родитель main',
      'новое состояние отзыва: Драконья почта',
      'новое состояние отзыва: Драконья почта',
      'GameDetails: место 2, key 2, родитель main',
    ]),
    `5.8 эксперимент 1: лог датчиков ${JSON.stringify(both)}`,
  );
  expect(
    errors.length === 0 &&
      same(lines, [
        'GameDetails: место 2, key 1, родитель main',
        'GameDetails: место 2, key 2, родитель main',
        'GameDetails: нет в дереве',
      ]),
    `5.8 whereIs: ${JSON.stringify([...errors, ...lines])}`,
  );
}

// ---------- 5.9 Практикум: витрина ----------
{
  const r = await run(readDir(`${CH}/09-practice/solution`));
  const head = async () => nb(await r.page.$eval('main > section:nth-of-type(3) h2', (h) => h.parentElement.innerText));
  expect((await head()) === 'Все игры 6', `5.9 «Все игры 6» (${await head()})`);
  await typeInto(r.page, 'input[type=search]', 'о');
  expect((await head()) === 'Все игры 4', `5.9 поиск «о»: 4 (${await head()})`);
  await r.page.click('main input[type=checkbox]');
  await wait(100);
  await select(r.page, 1, 'expensive');
  expect(
    same(await titles(r.page), ['Ночной экспресс', 'Остров сокровищ', 'Космические коты', 'Драконья почта']) &&
      (await head()) === 'Все игры 4',
    `5.9 «о» + в наличии + дорогие: ${await titles(r.page)}`,
  );
  await select(r.page, 0, 'kids');
  const empty = await sectionText(r.page, 3);
  expect(
    empty.endsWith('Ничего не нашлось Сбросить фильтры') && (await head()) === 'Все игры 0',
    `5.9 «Детские» — пусто: ${empty.slice(-40)}`,
  );
  await press(r.page, 'Сбросить фильтры');
  const values = [
    await field(r.page, 'input[type=search]'),
    ...(await r.page.$$eval('main select', (ss) => ss.map((s) => s.value))),
    await field(r.page, 'main input[type=checkbox]'),
  ];
  expect(
    same(values, ['', 'all', 'default', false]) && (await titles(r.page)).length === 6,
    `5.9 «Сбросить фильтры»: поля и список как при запуске ${JSON.stringify(values)}`,
  );
  await select(r.page, 0, 'strategy');
  await open(r.page, 'Ночной экспресс');
  await press(r.page, '← К каталогу');
  expect(
    same(await titles(r.page), ['Ночной экспресс']) &&
      (await r.page.$eval('main select', (s) => s.value)) === 'strategy',
    '5.9 фильтры живут в App: после страницы игры — те же',
  );
  expect((await r.fresh()).length === 0, '5.9 консоль пуста после всех действий');
}

await browser.close();
if (failures.length) {
  console.log(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло');
