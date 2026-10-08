// Проверка утверждений и экспериментов главы 3 «Компоненты и props»: каждый эксперимент из текста — на коде
// того шага, о котором текст. node tools/e2e/checks/ch03-components.mjs (нужен npm run dev)
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import ts from 'typescript';
import { CONTENT, OUT, ROOT, collect, compileMap, launch, openPreview, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/03-components`;
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
  const result = await openPreview(browser, compiled, { waitMs: 1200, ...options });
  const text = compiled.errors.length ? '' : (await pageText(result.page)).replace(/ /g, ' ');
  return { ...result, compiled, text };
};
const logged = (logs, text) => logs.some((l) => l === `[preview:log] ${text}`);
const logLines = (logs) => logs.filter((l) => l.startsWith('[preview:log] ')).map((l) => l.slice(14));
const count = (page, selector) => page.$$eval(selector, (els) => els.length);

// Ошибки типов полного кода — как в редакторе: «App.tsx:5 — TS2322: …» (настройки tsconfig.content.json)
const TC = join(OUT, 'ch03-tc');
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
const unique = (list) => [...new Set(list)];
const strip = (html) => html.replace(/_[a-z0-9]{5}(?=[" ])/g, '');

// ---------- 3.1 Свой компонент ----------
const s1 = readDir(`${CH}/01-component/solution`);
{
  const r = await run(s1);
  expect(
    r.text.startsWith('♞ Ход конём Магазин настольных игр · в каталоге 6 игр Неделя семейных игр'),
    `3.1 решение: «${r.text.slice(0, 60)}…»`,
  );
  expect(preview(r.logs).length === 0, `3.1 консоль пуста: ${JSON.stringify(preview(r.logs))}`);
  expect(typeErrors(s1).length === 0, '3.1 без ошибок типов');
}
{
  const r = await run(
    append(s1, 'App.tsx', "setTimeout(() => console.log(document.querySelector('header')?.outerHTML), 100);"),
  );
  const html = logLines(r.logs)[0] ?? '';
  expect(
    html.startsWith('<header class="Header_header_'),
    `3.1 класс шапки из Header.module.css: ${html.slice(0, 40)}`,
  );
}
{
  const files = edit(s1, 'App.tsx', '<Header />', '<header />');
  const r = await run(files);
  const root = await r.page.$eval('#root', (el) => el.innerHTML);
  expect(
    r.text.startsWith('Неделя семейных игр') && preview(r.logs).length === 0 && root.startsWith('<header></header>'),
    '3.1 <header />: пустой <header>, консоль пуста',
  );
  expect(
    typeHas(typeErrors(files), "App.tsx:4 — TS6133: 'Header' is declared but its value is never read."),
    '3.1 <header />: редактор — импорт Header не используется',
  );
}
{
  const files = edit(s1, 'layout/Header.tsx', 'export function Header', 'function Header');
  const r = await run(files);
  expect(
    has(r.logs, "SyntaxError: The requested module 'layout/Header.tsx' does not provide an export named 'Header'") &&
      r.text === '',
    '3.1 без export: SyntaxError при загрузке модулей, приложение не запустилось',
  );
  expect(
    typeHas(typeErrors(files), `Module '"./layout/Header"' declares 'Header' locally, but it is not exported.`),
    '3.1 без export: TS2459',
  );
}
{
  const files = edit(s1, 'App.tsx', "import { Header } from './layout/Header';\n", '');
  expect(typeHas(typeErrors(files), "Cannot find name 'Header'."), '3.1 без импорта: «Cannot find name»');
}
{
  // Компонент, объявленный внутри другого: при каждом рендере — новый тип, DOM пересоздаётся
  const files = {
    ...s1,
    'App.tsx': `import { useState } from 'react';
export function App() {
  const [n, setN] = useState(0);
  function Inner() { return <input id="in" />; }
  return <><button id="b" onClick={() => setN(n + 1)}>{n}</button><Inner /></>;
}`,
  };
  const r = await run(files);
  await r.page.type('#in', 'abc');
  const before = await r.page.$('#in');
  await r.page.click('#b');
  await wait(200);
  const same = await r.page.evaluate((el) => el.isConnected, before);
  const value = await r.page.$eval('#in', (el) => el.value);
  expect(!same && value === '', `3.1 компонент внутри компонента: поле пересоздано, текст потерян («${value}»)`);
}

// ---------- 3.2 Props ----------
const s2 = readDir(`${CH}/02-props/solution`);
{
  const r = await run(s2);
  expect(
    r.text.startsWith('♞ Ход конём Магазин настольных игр · в каталоге 6 игр') &&
      r.text.includes('Космические коты 1 690 ₽'),
    '3.2 решение: шапка и 6 карточек',
  );
  expect(preview(r.logs).length === 0, `3.2 консоль пуста: ${JSON.stringify(preview(r.logs))}`);
  expect(typeErrors(s2).length === 0, `3.2 без ошибок типов ${JSON.stringify(typeErrors(s2))}`);
  expect(s2['App.tsx'].trimEnd().split('\n').length <= 30, '3.2 App — не больше 30 строк');
}
{
  const files = edit(
    s2,
    'shared/GameCard.tsx',
    'export function GameCard({ game }: GameCardProps) {',
    'export function GameCard(props: GameCardProps) {\n  console.log(props);\n  const { game } = props;',
  );
  const lines = logLines((await run(files)).logs);
  expect(
    lines.length === 12 && lines[0].startsWith('{ game: { id: 1, slug: "treasure-island"') && !lines[0].includes('key'),
    `3.2 console.log(props): 12 строк, только game — ${lines[0]?.slice(0, 50)}`,
  );
}
{
  const files = edit(
    s2,
    'shared/GameCard.tsx',
    'export function GameCard({ game }: GameCardProps) {',
    'export function GameCard(props: GameCardProps) {\n  console.log((props as any).key);\n  const { game } = props;',
  );
  const r = await run(files);
  const errors = preview(r.logs).filter((l) => l.startsWith('[preview:error]'));
  expect(
    errors.length === 1 &&
      errors[0].startsWith(
        '[preview:error] GameCard: `key` is not a prop. Trying to access it will result in `undefined` being returned. If you need to access the same value within the child component, you should pass it as a different prop.',
      ) &&
      logged(r.logs, 'undefined'),
    '3.2 props.key: undefined и одна ошибка «`key` is not a prop»',
  );
  expect(
    typeHas(
      typeErrors(edit(files, 'shared/GameCard.tsx', '(props as any).key', 'props.key')),
      "TS2339: Property 'key' does not exist on type 'GameCardProps'.",
    ),
    '3.2 props.key: TS2339',
  );
}
{
  const files = edit(s2, 'App.tsx', '<Header count={games.length} />', '<Header />');
  const r = await run(files);
  expect(
    r.text.startsWith('♞ Ход конём Магазин настольных игр · в каталоге игр') && preview(r.logs).length === 0,
    '3.2 без count: «в каталоге игр», консоль пуста',
  );
  expect(
    typeHas(typeErrors(files), "Property 'count' is missing in type '{}' but required in type 'HeaderProps'."),
    '3.2 без count: TS2741',
  );
  expect(
    typeHas(
      typeErrors(edit(s2, 'App.tsx', '<Header count={games.length} />', '<Header count="6" />')),
      "Type 'string' is not assignable to type 'number'.",
    ),
    '3.2 count="6": TS2322',
  );
  expect(
    typeHas(
      typeErrors(edit(s2, 'App.tsx', '<Header count={games.length} />', '<Header cout={games.length} />')),
      "Property 'cout' does not exist on type 'IntrinsicAttributes & HeaderProps'. Did you mean 'count'?",
    ),
    '3.2 cout: «Did you mean count?»',
  );
  expect(
    typeHas(
      typeErrors(edit(s2, 'layout/Header.tsx', '({ count }: HeaderProps)', '({ count })')),
      "Binding element 'count' implicitly has an 'any' type.",
    ),
    '3.2 без типа props: TS7031',
  );
}
{
  const out = ts.transpileModule('const x = <GameCard key={game.id} game={game} />', {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSXDev, module: ts.ModuleKind.ESNext },
    fileName: 'a.tsx',
  }).outputText;
  expect(out.includes('_jsxDEV(GameCard, { game: game }, game.id,'), '3.2 jsxDEV(GameCard, { game }, game.id, …)');
}

// ---------- 3.3 children ----------
const s3 = readDir(`${CH}/03-children/solution`);
const firstBadges = (page) =>
  page.$$eval('article span', (els) => els.slice(0, 2).map((e) => e.className.replace(/_[a-z0-9]{5}(?=\s|$)/g, '')));
{
  const r = await run(s3);
  expect(preview(r.logs).length === 0, `3.3 консоль пуста: ${JSON.stringify(preview(r.logs))}`);
  expect(typeErrors(s3).length === 0, `3.3 без ошибок типов ${JSON.stringify(typeErrors(s3))}`);
  const badges = await r.page.$$eval('article span', (els) =>
    els.slice(0, 5).map((e) => `${e.className.replace(/_[a-z0-9]{5}(?=\s|$)/g, '')}=${e.textContent}`),
  );
  expect(
    JSON.stringify(badges) ===
      JSON.stringify([
        'Badge_badge Badge_accent=−20%',
        'Badge_badge Badge_dark=Хит',
        'Badge_badge Badge_accent=−11%',
        'Badge_badge Badge_dark=Хит',
        'Badge_badge Badge_warning=Осталось 3 шт.',
      ]),
    `3.3 тоны бейджей: ${JSON.stringify(badges)}`,
  );
}
{
  const files = edit(s3, 'shared/Badge.tsx', '  return (', '  console.log(children);\n  return (');
  const lines = logLines((await run(files)).logs);
  const expected = [
    '["−", 20, "%"]',
    'Хит',
    '["−", 11, "%"]',
    'Хит',
    '["Осталось ", 3, " шт."]',
    '["−", 13, "%"]',
    'Хит',
  ];
  expect(
    JSON.stringify(lines) === JSON.stringify(expected.flatMap((l) => [l, l])),
    `3.3 children: строка или массив, каждая строка дважды — ${JSON.stringify(lines.slice(0, 4))}`,
  );
}
{
  const hit = '<Badge tone="dark">Хит</Badge>';
  expect(
    typeHas(
      typeErrors(edit(s3, 'shared/GameCard.tsx', hit, '<Badge tone="dark" />')),
      `Property 'children' is missing in type '{ tone: "dark"; }' but required in type 'BadgeProps'.`,
    ),
    '3.3 пустой бейдж: TS2741',
  );
  const danger = edit(s3, 'shared/GameCard.tsx', hit, '<Badge tone="danger">Хит</Badge>');
  expect(
    typeHas(
      typeErrors(danger),
      `Type '"danger"' is not assignable to type '"accent" | "dark" | "warning" | undefined'.`,
    ),
    '3.3 tone="danger": TS2322',
  );
  expect(
    (await firstBadges((await run(danger)).page))[1] === 'Badge_badge undefined',
    '3.3 tone="danger": класс undefined',
  );
  const attr = edit(s3, 'shared/GameCard.tsx', hit, '<Badge tone="dark" children="Хит" />');
  const rAttr = await run(attr);
  expect(
    typeErrors(attr).length === 0 && (await firstBadges(rAttr.page))[1] === 'Badge_badge Badge_dark',
    '3.3 children атрибутом: работает, без ошибок типов',
  );
  const markup = edit(s3, 'shared/GameCard.tsx', hit, '<Badge tone="dark"><b>Хит</b> ★</Badge>');
  const html = await (await run(markup)).page.$eval('article span:nth-child(2)', (e) => e.innerHTML);
  expect(html === '<b>Хит</b> ★' && typeErrors(markup).length === 0, `3.3 разметка в children: ${html}`);
  const legacy = edit(
    edit(s3, 'shared/Badge.tsx', "tone = 'accent',", 'tone,'),
    'shared/Badge.tsx',
    '// Бейдж:',
    "Badge.defaultProps = { tone: 'accent' };\n// Бейдж:",
  );
  const rLegacy = await run(legacy);
  expect(
    preview(rLegacy.logs).length === 0 && (await firstBadges(rLegacy.page))[0] === 'Badge_badge undefined',
    '3.3 defaultProps: молча не работают, класс undefined',
  );
}

// ---------- 3.4 Несколько слотов ----------
const s4 = readDir(`${CH}/04-slots/solution`);
{
  const r = await run(s4);
  expect(preview(r.logs).length === 0, `3.4 консоль пуста: ${JSON.stringify(preview(r.logs))}`);
  expect(typeErrors(s4).length === 0, `3.4 без ошибок типов ${JSON.stringify(typeErrors(s4))}`);
  expect(
    (await count(r.page, 'section:nth-of-type(1) article')) === 3 &&
      (await count(r.page, 'section:nth-of-type(2) article')) === 6,
    '3.4 «Хиты» — 3 карточки, «Все игры» — 6',
  );
  const heads = await r.page.$$eval('section > div:first-child', (els) => els.map((e) => e.innerHTML));
  expect(
    strip(heads[0]) === '<h2 class="Section_title">Хиты</h2><span class="Badge_badge Badge_dark">3</span>' &&
      strip(heads[1]) === '<h2 class="Section_title">Все игры</h2>',
    '3.4 шапки разделов: с бейджем и без extra',
  );
  expect((await count(r.page, 'article h3')) === 9, '3.4 название игры — h3');
}
{
  const f = edit(s4, 'App.tsx', 'title="Хиты"', 'title={<>Хиты <span className="muted">недели</span></>}');
  const html = await (await run(f)).page.$eval('section h2', (e) => e.innerHTML);
  expect(html === 'Хиты <span class="muted">недели</span>' && typeErrors(f).length === 0, '3.4 разметка в title');
}
{
  const f = edit(
    edit(
      s4,
      'App.tsx',
      `            {hits.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}`,
      '            <GameList items={hits} renderItem={(game) => <GameCard game={game} />} />',
    ),
    'App.tsx',
    'export function App() {',
    `type GameListProps = {
  items: Game[];
  renderItem: (game: Game) => ReactNode;
};

function GameList({ items, renderItem }: GameListProps) {
  return items.map((game) => (
    <Fragment key={game.id}>{renderItem(game)}</Fragment>
  ));
}
export function App() {`,
  );
  const f2 = {
    ...f,
    'App.tsx': `import { Fragment, type ReactNode } from 'react';\nimport type { Game } from './api/models';\n${f['App.tsx']}`,
  };
  const r = await run(f2);
  expect(
    preview(r.logs).length === 0 && (await count(r.page, 'article')) === 9 && typeErrors(f2).length === 0,
    '3.4 render-функция: те же 9 карточек, без предупреждений',
  );
}
{
  const f = edit(s4, 'App.tsx', '<Section title="Все игры">', '<Section title="Все игры">{GameCard}');
  const r = await run(f);
  expect(
    has(
      r.logs,
      'Functions are not valid as a React child. This may happen if you return GameCard instead of <GameCard /> from render. Or maybe you meant to call this function rather than return it.',
    ),
    '3.4 {GameCard}: «Functions are not valid as a React child»',
  );
  expect(
    typeHas(typeErrors(f), "Type '({ game }: GameCardProps) => Element' is not assignable to type 'ReactNode'."),
    '3.4 {GameCard}: TS2322',
  );
}

// ---------- 3.5 Однонаправленный поток (код шага 3.4) ----------
{
  const f = edit(
    s4,
    'shared/GameCard.tsx',
    '  const { min, max } = game.players;',
    "  if (isHit(game)) game.tags.push('хит');\n  const { min, max } = game.players;",
  );
  const r = await run(f);
  const tags = await r.page.$$eval('article', (els) =>
    els.map((e) => `${e.querySelector('h3').textContent}: ${e.querySelector('ul').textContent}`),
  );
  expect(
    tags[0] === 'Остров сокровищ: #пираты#карты#хит#хит' &&
      tags[3] === 'Остров сокровищ: #пираты#карты#хит#хит#хит#хит' &&
      typeErrors(f).length === 0 &&
      has(r.logs, 'Encountered two children with the same key, `хит`.'),
    `3.5 push в game.tags: 2 «хита» в «Хитах», 4 во «Всех играх» — ${tags[0]} / ${tags[3]}`,
  );
}
{
  const f = edit(
    s4,
    'shared/GameCard.tsx',
    'export function GameCard({ game }: GameCardProps) {',
    'export function GameCard(props: GameCardProps) {\n  props.game = { ...props.game, price: 0 };\n  const { game } = props;',
  );
  const r = await run(f);
  expect(
    has(r.logs, "TypeError: Cannot assign to read only property 'game' of object '#<Object>'") &&
      r.text === '' &&
      typeErrors(f).length === 0,
    '3.5 props.game =: TypeError (props заморожены), TS молчит',
  );
}
{
  const numbered = edit(
    edit(
      edit(s4, 'shared/GameCard.tsx', 'type GameCardProps', 'let rendered = 0;\n\ntype GameCardProps'),
      'shared/GameCard.tsx',
      '  const { min, max } = game.players;',
      '  rendered++;\n  const { min, max } = game.players;',
    ),
    'shared/GameCard.tsx',
    '{game.title}</h3>',
    '№{rendered} {game.title}</h3>',
  );
  const numbers = (page) => page.$$eval('article h3', (els) => els.map((e) => e.textContent.split(' ')[0]).join(' '));
  const strict = await numbers((await run(numbered)).page);
  expect(strict === '№2 №4 №6 №8 №10 №12 №14 №16 №18', `3.5 счётчик в рендере, StrictMode: ${strict}`);
  const noStrict = edit(edit(numbered, 'main.tsx', '<StrictMode>', '<>'), 'main.tsx', '</StrictMode>', '</>');
  const plain = await numbers((await run(noStrict)).page);
  expect(plain === '№1 №2 №3 №4 №5 №6 №7 №8 №9', `3.5 счётчик без StrictMode: ${plain}`);
}

// ---------- 3.6 Типизация компонентов ----------
const s6 = readDir(`${CH}/06-typing/solution`);
const cart = '<Button>В корзину</Button>';
{
  const r = await run(s6);
  expect(preview(r.logs).length === 0, `3.6 консоль пуста: ${JSON.stringify(preview(r.logs))}`);
  expect(typeErrors(s6).length === 0, `3.6 без ошибок типов ${JSON.stringify(typeErrors(s6))}`);
  const buttons = unique(await r.page.$$eval('article button', (els) => els.map((e) => e.outerHTML)));
  expect(
    JSON.stringify(buttons) ===
      JSON.stringify([
        '<button type="button" class="button">В корзину</button>',
        '<button type="button" class="button" disabled="">Нет в наличии</button>',
      ]),
    `3.6 кнопки в DOM: ${JSON.stringify(buttons)}`,
  );
}
{
  const f = edit(
    s6,
    'shared/GameCard.tsx',
    cart,
    '<Button className="wide" title="Добавить в корзину">В корзину</Button>',
  );
  const buttons = unique(
    await (await run(f)).page.$$eval('article button:not([disabled])', (els) => els.map((e) => e.outerHTML)),
  );
  expect(
    buttons.length === 1 &&
      buttons[0] === '<button type="button" class="button wide" title="Добавить в корзину">В корзину</button>',
    `3.6 className и title: ${buttons[0]}`,
  );
}
{
  const f = edit(
    s6,
    'shared/GameCard.tsx',
    cart,
    '<Button onClick={(e) => console.log(e.currentTarget.tagName)}>В корзину</Button>',
  );
  const r = await run(f);
  await r.page.click('article button:not([disabled])');
  await wait(200);
  await collect(r.page, r.logs, []);
  expect(logged(r.logs, 'BUTTON') && typeErrors(f).length === 0, '3.6 onClick: BUTTON, тип события выведен');
}
{
  const f = edit(s6, 'shared/GameCard.tsx', cart, '<Button size="sm">В корзину</Button>');
  expect(
    typeHas(
      typeErrors(f),
      "Property 'size' does not exist on type 'IntrinsicAttributes & ClassAttributes<HTMLButtonElement> & ButtonHTMLAttributes<HTMLButtonElement>'.",
    ),
    '3.6 size="sm": TS2322',
  );
}
{
  const f = edit(s6, 'shared/GameCard.tsx', cart, '<Button ref={(el) => console.log(el?.tagName)}>В корзину</Button>');
  expect(logged((await run(f)).logs, 'BUTTON') && typeErrors(f).length === 0, '3.6 ref проходит через ...rest');
}
{
  const extra = `import type { ComponentProps, FC } from 'react';
import { GameCard } from './shared/GameCard';
export const p: ComponentProps<typeof GameCard> = { game: 1 };
export const Tag: FC<{ label: string }> = ({ label, children }) => <b>{label}{children}</b>;
type StockProps =
  | { status: 'available'; inStock: number }
  | { status: 'soldOut' };
export function Stock(props: StockProps) {
  if (props.status === 'soldOut') return <p>Нет в наличии</p>;
  return <p>На складе: {props.inStock}</p>;
}
export function Bad({ status, inStock }: StockProps) {
  return <p>{status}{inStock}</p>;
}
export const a = <Stock status="soldOut" inStock={3} />;
export const b = <Stock status="available" />;
export const c = <Stock status="available" inStock={3} />;
`;
  const errors = typeErrors({ ...s6, 'extra.tsx': extra });
  expect(
    errors.length === 5 &&
      typeHas(errors, "extra.tsx:3 — TS2322: Type 'number' is not assignable to type 'Game'.") &&
      typeHas(errors, "extra.tsx:4 — TS2339: Property 'children' does not exist on type '{ label: string; }'.") &&
      typeHas(errors, "extra.tsx:12 — TS2339: Property 'inStock' does not exist on type 'StockProps'.") &&
      typeHas(errors, `Property 'inStock' does not exist on type 'IntrinsicAttributes & { status: "soldOut"; }'`) &&
      typeHas(errors, `Property 'inStock' is missing in type '{ status: "available"; }'`),
    `3.6 ComponentProps<typeof>, FC без children, union-props: ${JSON.stringify(errors)}`,
  );
}

// ---------- 3.7 Под капотом (код шага 3.6) ----------
{
  const f = append(
    s6,
    'main.tsx',
    `const element = App();
console.log(element.type, element.props.children.map((c) => c.type.name ?? c.type));`,
  );
  const r = await run(f);
  expect(
    logged(r.logs, 'Symbol(react.fragment) ["Header", "main"]') &&
      typeHas(typeErrors(f), "TS7006: Parameter 'c' implicitly has an 'any' type."),
    '3.7 App(): фрагмент с Header и main, TS7006 у c',
  );
}
{
  let f = edit(
    s6,
    'App.tsx',
    '  const hits = games.filter(isHit);',
    "  console.log('App');\n  const hits = games.filter(isHit);",
  );
  f = edit(f, 'layout/Header.tsx', '  return (', "  console.log('Header');\n  return (");
  f = edit(f, 'shared/Section.tsx', '  return (', "  console.log('Section', title);\n  return (");
  f = edit(
    f,
    'shared/GameCard.tsx',
    '  const { min, max } = game.players;',
    "  console.log('GameCard', game.title);\n  const { min, max } = game.players;",
  );
  f = edit(f, 'shared/Badge.tsx', '  return (', "  console.log('Badge', children);\n  return (");
  f = edit(f, 'shared/Button.tsx', '  return (', "  console.log('Button');\n  return (");
  const lines = logLines((await run(f)).logs).filter((_, i) => i % 2 === 0);
  const expected = [
    'App',
    'Header',
    'Section Хиты',
    'Badge 3',
    'GameCard Остров сокровищ',
    'Badge ["−", 20, "%"]',
    'Badge Хит',
    'Button',
    'GameCard Ночной экспресс',
  ];
  expect(
    JSON.stringify(lines.slice(0, expected.length)) === JSON.stringify(expected),
    `3.7 обход в глубину: ${lines.slice(0, 9).join(' | ')}`,
  );
}
const FIBER_PATH = `setTimeout(() => {
  const button = document.querySelector('button');
  const key = Object.keys(button!).find((k) => k.startsWith('__reactFiber'))!;
  let fiber = (button as any)[key];
  const path: string[] = [];
  while (fiber) {
    const t = fiber.type;
    path.push(typeof t === 'function' ? t.name : typeof t === 'string' ? t : String(t?.description ?? t));
    fiber = fiber.return;
  }
  console.log(path.join(' ← '));
}, 100);`;
{
  const f = append(s6, 'App.tsx', FIBER_PATH);
  expect(
    logged(
      (await run(f)).logs,
      'button ← Button ← article ← GameCard ← div ← section ← Section ← main ← App ← react.strict_mode ← null',
    ) && typeErrors(f).length === 0,
    '3.7 путь по файберам от кнопки',
  );
}
{
  const f = edit(
    append(s6, 'App.tsx', FIBER_PATH),
    'App.tsx',
    `            {hits.map((game) => (
              <GameCard key={game.id} game={game} />
            ))}`,
    '            {hits.map((game) => GameCard({ game }))}',
  );
  const r = await run(f);
  expect(
    logged(r.logs, 'button ← Button ← article ← div ← section ← Section ← main ← App ← react.strict_mode ← null') &&
      has(r.logs, 'Each child in a list should have a unique "key" prop.\n\nCheck the render method of `App`.') &&
      (await count(r.page, 'article')) === 9,
    '3.7 GameCard({ game }): карточки на месте, GameCard нет в дереве, предупреждение про key у App',
  );
}

// ---------- 3.8 Практикум: Rating ----------
const s8 = readDir(`${CH}/08-practice/solution`);
const starsOf = (rating) => {
  const on = [...rating.children].filter((c) => getComputedStyle(c).color === 'rgb(245, 166, 35)').length;
  return `${on}/${rating.children.length - 1} «${rating.getAttribute('aria-label')}» ${getComputedStyle(rating).fontSize}`;
};
{
  const r = await run(s8);
  expect(preview(r.logs).length === 0, `3.8 консоль пуста: ${JSON.stringify(preview(r.logs))}`);
  expect(typeErrors(s8).length === 0, `3.8 без ошибок типов ${JSON.stringify(typeErrors(s8))}`);
  const stars = await r.page.$$eval(
    'section:nth-of-type(2) article [role="img"]',
    (els, fn) => els.map((e) => new Function(`return (${fn})`)()(e)),
    starsOf.toString(),
  );
  expect(
    JSON.stringify(stars) ===
      JSON.stringify([
        '5/5 «Рейтинг 4.6 из 5» 13px',
        '4/5 «Рейтинг 4.3 из 5» 13px',
        '5/5 «Рейтинг 4.8 из 5» 13px',
        '5/5 «Рейтинг 4.5 из 5» 13px',
        '5/5 «Рейтинг 4.6 из 5» 13px',
        '4/5 «Рейтинг 4.2 из 5» 13px',
      ]),
    `3.8 звёзды в карточках: ${JSON.stringify(stars)}`,
  );
}
{
  const f = edit(
    s8,
    'App.tsx',
    '<Header count={games.length} />',
    '<Header count={games.length} />\n      <Rating value={7.5} max={10} />',
  );
  const f2 = { ...f, 'App.tsx': `import { Rating } from './shared/Rating';\n${f['App.tsx']}` };
  const info = await (
    await run(f2)
  ).page.$eval('#root > [role="img"]', (e, fn) => new Function(`return (${fn})`)()(e), starsOf.toString());
  expect(
    info === '8/10 «Рейтинг 7.5 из 10» 18px' && typeErrors(f2).length === 0,
    `3.8 max={10}, size по умолчанию: ${info}`,
  );
}

await browser.close();
if (failures.length) {
  console.log(`\nНе прошло: ${failures.length}`);
  process.exit(1);
}
console.log('\nВсё прошло');
