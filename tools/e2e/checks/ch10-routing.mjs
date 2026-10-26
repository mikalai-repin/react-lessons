// Проверка утверждений и экспериментов главы 10 «Роутинг»: каждый эксперимент из текста —
// на коде того шага, о котором текст. node tools/e2e/checks/ch10-routing.mjs (нужен npm run dev).
import fs, { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
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
  navigate,
  openPreview,
  pageText,
  readDir,
  wait,
} from '../lib.mjs';

const CH = `${CONTENT}/10-routing`;
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
const TC = join(OUT, 'ch10-tc');
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

// ONLY=10.1,10.2 — только эти разделы (и без общей проверки шагов)
const ONLY = process.env.ONLY?.split(',');
const want = (section) => !ONLY || ONLY.includes(section);

// Каждый шаг: консоль пуста, ошибок типов нет
const STEPS = [
  '01-routes',
  '02-links',
  '03-params',
  '04-search-params',
  '05-nested',
  '06-loaders',
  '07-actions',
  '08-fetchers',
  '09-errors',
  '10-lazy',
  '11-guards',
  '12-ux',
  '14-practice',
];
for (const step of ONLY ? [] : STEPS) {
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

// ---------- 10.1 Маршруты ----------
if (want('10.1')) {
  const f = readDir(`${CH}/01-routes/solution`);
  // Без Outlet — только макет
  const noOutlet = await run(edit(f, 'layout/Layout.tsx', '        <Outlet />\n', ''));
  const t = await noOutlet.text();
  expect(
    t.includes('Ход конём') && !t.includes('Хиты') && t.includes('Новости магазина'),
    '10.1 без <Outlet /> — шапка и подвал, страницы нет',
  );
  await noOutlet.page.close();
  // Без *: встроенная страница ошибки роутера
  const noStar = await run(
    edit(
      f,
      'routes.tsx',
      "      // * — любой адрес, который не подошёл выше\n      { path: '*', Component: NotFoundPage },\n",
      '',
    ),
    { url: '/nope' },
  );
  const nt = await noStar.text();
  const nl = await noStar.fresh();
  expect(
    nt.includes('Unexpected Application Error!') && nt.includes('404 Not Found') && !nt.includes('Ход конём'),
    '10.1 без * — встроенная ошибка роутера 404 вместо всего магазина',
  );
  await noStar.page.close();
  // Макет переживает переход: поле подписки сохраняет текст
  const r = await run(
    edit(
      edit(
        f,
        'layout/Layout.tsx',
        'export function Layout() {',
        "export function Layout() {\n  console.log('render Layout');",
      ),
      'catalog/HomePage.tsx',
      'export function HomePage() {',
      "export function HomePage() {\n  console.log('render HomePage');",
    ),
  );
  await r.fresh();
  await r.page.type('footer input[type=email]', 'a@b.ru');
  await navigate(r.page, '/cart');
  const kept = await r.page.$eval('footer input[type=email]', (e) => e.value);
  const nav = counts(await r.fresh());
  expect(
    kept === 'a@b.ru' &&
      !nav['render Layout'] &&
      (await appUrl(r.page)) === '/cart' &&
      (await r.text()).includes('Корзина пуста'),
    `10.1 переход на /cart: макет не рендерится, поле подписки сохранило текст (${JSON.stringify(nav)})`,
  );
  await r.page.close();
}

// ---------- 10.2 Ссылки ----------
const cartLink = (page) => page.$eval('header a[href="/cart"]', (a) => a.getAttribute('aria-current'));
if (want('10.2')) {
  const f = readDir(`${CH}/02-links/solution`);
  const r = await run(f);
  const before = await cartLink(r.page);
  await r.page.type('footer input[type=email]', 'a@b.ru');
  await r.page.click('header a[href="/cart"]');
  await wait(300);
  const after = await cartLink(r.page);
  const kept = await r.page.$eval('footer input[type=email]', (e) => e.value);
  expect(
    before === null && after === 'page' && kept === 'a@b.ru' && (await appUrl(r.page)) === '/cart',
    `10.2 NavLink: aria-current=page на /cart, поле сохранилось (${before} → ${after}, ${kept})`,
  );
  await r.page.click('main a[href="/"]');
  await wait(300);
  expect(
    (await appUrl(r.page)) === '/' && (await r.text()).includes('Хиты'),
    '10.2 ссылка из пустой корзины ведёт на главную',
  );
  await r.page.close();
  // Логотип NavLink to="/" — на /cart не активен и без end (корень сравнивается целиком)
  for (const [to, expected] of [
    ['<NavLink to="/">', null],
    ['<NavLink to="/" end>', null],
  ]) {
    let g = edit(f, 'layout/Header.tsx', '<Link to="/">♞ Ход конём</Link>', to + '♞ Ход конём</NavLink>');
    g = edit(
      g,
      'layout/Header.tsx',
      "import { Link, NavLink } from 'react-router';",
      "import { NavLink } from 'react-router';",
    );
    const n = await run(g, { url: '/cart' });
    const cur = await n.page.$eval('header h1 a', (a) => [a.getAttribute('aria-current'), a.className]);
    expect(
      cur[0] === expected && (expected ? cur[1] === 'active' : cur[1] === ''),
      `10.2 ${to} на /cart: aria-current=${cur[0]}, class="${cur[1]}"`,
    );
    await n.page.close();
  }
  // <a href> вместо Link: перезапуск приложения
  const a = await run(
    edit(
      f,
      'layout/Header.tsx',
      '      <NavLink to="/cart" className={styles.cart}>\n        Корзина: {cartCount}\n      </NavLink>',
      '      <a href="/cart" className={styles.cart}>\n        Корзина: {cartCount}\n      </a>',
    ),
  );
  await a.page.type('footer input[type=email]', 'a@b.ru');
  const msgs = [];
  a.page.on('console', () => {});
  await a.page.evaluate(() => {
    window.__restarts = [];
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'restart') window.__restarts.push(e.data.url);
    });
  });
  await a.page.click('header a[href="/cart"]');
  await wait(300);
  const restarts = await a.page.evaluate(() => window.__restarts);
  console.log(restarts);
  expect(restarts.includes('/cart'), `10.2 <a href> — превью перезапускает приложение (${JSON.stringify(restarts)})`);
  await a.page.close();
}

// ---------- 10.3 Параметры ----------
const clickText = async (page, text) => {
  await page.evaluate(
    (text) => [...document.querySelectorAll('a, button')].find((e) => e.textContent.trim() === text).click(),
    text,
  );
  await wait(250);
};
async function sendReview(page, text) {
  await page.evaluate((text) => {
    const area = document.querySelector('#review');
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(area, text);
    area.dispatchEvent(new Event('input', { bubbles: true }));
  }, text);
  await wait(100);
  await clickText(page, 'Отправить');
}
if (want('10.3')) {
  const f = readDir(`${CH}/03-params/solution`);
  const r = await run(f);
  await clickText(r.page, 'Остров сокровищ');
  const u1 = await appUrl(r.page);
  const t1 = await r.text();
  await clickText(r.page, 'Следующая игра →');
  const u2 = await appUrl(r.page);
  await clickText(r.page, '← Назад');
  const u3 = await appUrl(r.page);
  await clickText(r.page, '← Назад');
  const u4 = await appUrl(r.page);
  expect(
    u1 === '/games/1' && t1.includes('Остров сокровищ') && u2 === '/games/2' && u3 === '/games/1' && u4 === '/',
    `10.3 карточка → /games/1 → следующая /games/2 → назад /games/1 → назад / (${[u1, u2, u3, u4]})`,
  );
  expect((await r.fresh()).length === 0, '10.3 консоль пуста');
  await r.page.close();
  // Прямой заход: назад — на главную
  const d = await run(f, { url: '/games/4' });
  await clickText(d.page, '← Назад');
  expect((await appUrl(d.page)) === '/', `10.3 прямой заход на /games/4, «Назад» → / (${await appUrl(d.page)})`);
  await d.page.close();
  for (const url of ['/games/999', '/games/abc']) {
    const n = await run(f, { url });
    expect((await n.text()).includes('Игра не найдена'), `10.3 ${url} — «Игра не найдена»`);
    await n.page.close();
  }
  // Без key: отзыв отправлен — спасибо переезжает на следующую игру
  for (const [withKey, expected] of [
    [true, false],
    [false, true],
  ]) {
    const g = withKey
      ? f
      : edit(
          f,
          'game/GamePage.tsx',
          '<GameDetails key={game.id} game={game} nextId={next.id} />',
          '<GameDetails game={game} nextId={next.id} />',
        );
    const k = await run(g, { url: '/games/1' });
    await sendReview(k.page, 'Отличная игра');
    const thanks1 = (await k.text()).includes('Спасибо!');
    await clickText(k.page, 'Следующая игра →');
    const thanks2 = (await k.text()).includes('Спасибо!');
    expect(
      thanks1 && thanks2 === expected && (await appUrl(k.page)) === '/games/2',
      `10.3 ${withKey ? 'с key' : 'без key'}: «Спасибо» на следующей игре — ${thanks2}`,
    );
    await k.page.close();
  }
  // id — строка: сравнение с числом — ошибка типов
  const tErr = typeErrors(
    edit(f, 'game/GamePage.tsx', '(game) => String(game.id) === id,', '(game) => game.id === id,'),
  );
  expect(
    typeHas(
      tErr,
      "TS2367: This comparison appears to be unintentional because the types 'number' and 'string | undefined' have no overlap.",
    ),
    '10.3 game.id === id — TS2367',
  );
}

// ---------- 10.4 Состояние в URL ----------
// Ввод «как с клавиатуры»: по букве, событие input на каждую
async function typeLetters(page, text) {
  for (let i = 1; i <= text.length; i++) {
    await page.evaluate(
      (value) => {
        const input = document.querySelector('input[type="search"]');
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      text.slice(0, i),
    );
    await wait(60);
  }
  await wait(400);
}
async function choose(page, index, value) {
  await page.evaluate(
    (index, value) => {
      const select = document.querySelectorAll('select')[index];
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
    index,
    value,
  );
  await wait(250);
}
const historyLength = (page) => page.evaluate(() => history.length);
const cardCount = (page) => page.$$eval('main article', (as) => as.length);
if (want('10.4')) {
  const f = readDir(`${CH}/04-search-params/solution`);
  for (const [name, files, expectGrow] of [
    ['с replace', f, false],
    [
      'без replace',
      edit(
        f,
        'catalog/CatalogPage.tsx',
        '    setSearchParams(filtersToParams(next), {\n      replace: next.query !== filters.query,\n    });',
        '    setSearchParams(filtersToParams(next));',
      ),
      true,
    ],
  ]) {
    const r = await run(files, { url: '/catalog' });
    const h0 = await historyLength(r.page);
    await typeLetters(r.page, 'ост');
    const h1 = await historyLength(r.page);
    const u1 = decodeURIComponent(await appUrl(r.page));
    console.log(name, h0, h1, u1);
    expect(
      u1 === '/catalog?q=ост' && (expectGrow ? h1 - h0 === 3 : h1 === h0),
      `10.4 ${name}: три буквы — +${h1 - h0} записей истории, адрес ${u1}`,
    );
    await r.page.close();
  }
  const r = await run(f, { url: '/catalog' });
  await choose(r.page, 0, 'family');
  await choose(r.page, 1, 'cheap');
  const u = await appUrl(r.page);
  await r.page.evaluate(() => history.back());
  await wait(400);
  const back = await appUrl(r.page);
  const sel = await r.page.$$eval('select', (ss) => ss.map((x) => x.value));
  expect(
    u === '/catalog?category=family&sort=cheap' &&
      back === '/catalog?category=family' &&
      sel.slice(0, 2).join() === 'family,default',
    `10.4 категория, порядок, «назад» — порядок снят (${u} → ${back}, ${sel})`,
  );
  expect((await r.fresh()).length === 0, '10.4 консоль пуста');
  await r.page.close();
  // Без проверки значений: bogus — пустая витрина
  const raw = await run(
    edit(
      f,
      'catalog/filters.ts',
      "    category: categories.some((c) => c.value === category)\n      ? (category as CategoryFilter)\n      : 'all',",
      "    category: (category ?? 'all') as CategoryFilter,",
    ),
    { url: '/catalog?category=bogus' },
  );
  const rt = await raw.text();
  const rsel = await raw.page.$eval('select', (x) => x.value);
  expect(
    rt.includes('Ничего не нашлось') && rsel === 'all',
    `10.4 без проверки ?category=bogus: витрина пуста, а в списке «Все» (${rsel})`,
  );
  await raw.page.close();
}

// ---------- 10.5 Вложенные маршруты ----------
const current = (page) => page.$$eval('a[aria-current="page"]', (as) => as.map((a) => a.textContent.trim()));
if (want('10.5')) {
  const f = readDir(`${CH}/05-nested/solution`);
  const r = await run(f);
  await r.page.click('main article button[aria-label="В избранное"]');
  await wait(150);
  await r.page.click('header a[href="/account"]');
  await wait(300);
  const c1 = await current(r.page);
  const t1 = await r.text();
  await clickText(r.page, 'Настройки');
  const c2 = await current(r.page);
  const u2 = await appUrl(r.page);
  await r.page.click('main input[type=checkbox]');
  await wait(150);
  const dark = await r.page.evaluate(() => document.documentElement.dataset.theme);
  console.log(c1, c2, u2, dark);
  expect(
    same(c1, ['♥ 1', 'Избранное']) &&
      t1.includes('Остров сокровищ') &&
      same(c2, ['♥ 1', 'Настройки']) &&
      u2 === '/account/settings' &&
      dark === 'dark',
    `10.5 кабинет: ♥ и вкладка активны, избранное показано, настройки меняют тему (${c1} | ${c2})`,
  );
  expect((await r.fresh()).length === 0, '10.5 консоль пуста');
  await r.page.close();
  // Без end — «Избранное» активна и на настройках
  const ne = await run(
    edit(f, 'account/AccountLayout.tsx', '        <NavLink to="." end>', '        <NavLink to=".">'),
    { url: '/account/settings' },
  );
  const c3 = await current(ne.page);
  expect(same(c3, ['♥ 0', 'Избранное', 'Настройки']), `10.5 без end — «Избранное» тоже активна (${c3})`);
  await ne.page.close();
  // Абсолютный /settings — такого маршрута нет
  const ab = await run(edit(f, 'account/AccountLayout.tsx', '<NavLink to="settings">', '<NavLink to="/settings">'), {
    url: '/account',
  });
  await clickText(ab.page, 'Настройки');
  expect(
    (await appUrl(ab.page)) === '/settings' && (await ab.text()).includes('Такой страницы нет'),
    '10.5 to="/settings" — абсолютный путь, страница 404',
  );
  await ab.page.close();
}

// ---------- 10.6 Загрузка данных ----------
const busy = (page) => page.evaluate(() => document.querySelector('main')?.getAttribute('aria-busy'));
const reqs = async (r) => {
  await collect(r.page, r.logs, r.network);
  return r.network.map((e) => e.method + ' ' + e.url + ' ' + e.status);
};
if (want('10.6')) {
  const f = readDir(`${CH}/06-loaders/solution`);
  const slow = { backend: { latency: 1500 } };
  const r = await run(f, slow);
  await r.page.evaluate(() =>
    [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Остров сокровищ').click(),
  );
  await wait(500);
  const mid = [await appUrl(r.page), await busy(r.page), (await r.text()).includes('Хиты')];
  await wait(1500);
  const end = [await appUrl(r.page), await busy(r.page), (await r.text()).includes('Остров сокровищ')];
  console.log(mid, end, await reqs(r));
  expect(
    same(mid, ['/', 'true', true]) && same(end, ['/games/1', 'false', true]),
    `10.6 переход: адрес и страница старые, aria-busy, через 1,5 с — игра (${mid} | ${end})`,
  );
  expect((await r.fresh()).length === 0, '10.6 консоль пуста');
  await r.page.close();
  // Прямой заход: HydrateFallback
  const d = await run(f, { ...slow, url: '/games/4', waitMs: 400 });
  const dt = await d.text();
  await wait(1600);
  const dt2 = await d.text();
  expect(
    dt.trim() === 'Загружаем…' && dt2.includes('Ход конём') && dt2.includes('Ночной экспресс'),
    '10.6 прямой заход: сначала только «Загружаем…», потом магазин',
  );
  await d.page.close();
  // Без HydrateFallback
  const nh = await run(edit(f, 'routes.tsx', '    HydrateFallback: () => <p className="muted">Загружаем…</p>,\n', ''), {
    ...slow,
    url: '/games/4',
    waitMs: 400,
  });
  const nhText = await nh.text();
  await wait(1600);
  expect(nhText.trim() === '', `10.6 без HydrateFallback — пока грузится, пусто («${nhText.slice(0, 40)}»)`);
  expect(
    has(await nh.fresh(), 'No `HydrateFallback` element provided to render during initial hydration'),
    '10.6 без HydrateFallback — предупреждение роутера',
  );
  await nh.page.close();
  // Нет игры
  const n = await run(f, { url: '/games/999' });
  expect(
    same(await reqs(n), ['GET /api/games/999 404']) && (await n.text()).includes('Игра не найдена'),
    '10.6 /games/999: ответ 404, «Игра не найдена»',
  );
  await n.page.close();
  // Ушли раньше ответа: запрос отменён через signal
  const c = await run(f, slow);
  await c.page.evaluate(() =>
    [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === 'Остров сокровищ').click(),
  );
  await wait(300);
  await c.page.click('header a[href="/cart"]');
  await wait(1800);
  const cr = await reqs(c);
  expect(
    same(cr, ['GET /api/games/1 canceled']) && (await appUrl(c.page)) === '/cart',
    `10.6 переход в корзину до ответа: запрос отменён (${cr})`,
  );
  await c.page.close();
  // Снова на ту же игру — новый запрос: кэша у loader нет
  const again = await run(f, { url: '/games/1' });
  await clickText(again.page, '← Назад');
  await navigate(again.page, '/games/1');
  const ar = await reqs(again);
  expect(same(ar, ['GET /api/games/1 200', 'GET /api/games/1 200']), `10.6 снова /games/1 — второй запрос (${ar})`);
  await again.page.close();
}

// ---------- 10.7 Изменение данных ----------
async function fillCheckout(page) {
  await page.type('input[name="name"]', 'Аня');
  await page.type('input[name="email"]', 'anya@example.ru');
  await page.type('textarea[name="address"]', 'Москва, ул. Лесная, 1');
}
const addOnHome = async (page, title, times = 1) => {
  for (let i = 0; i < times; i++) {
    await page.evaluate(
      (title) =>
        document
          .querySelector(`main img[alt="${title}"]`)
          .closest('article')
          .querySelector('button.button, button:not([aria-label])')
          .click(),
      title,
    );
    await wait(120);
  }
};
if (want('10.7')) {
  const f = readDir(`${CH}/07-actions/solution`);
  const r = await run(f, { backend: { latency: 1000 } });
  await addOnHome(r.page, 'Ночной экспресс', 3);
  await r.page.click('header a[href="/cart"]');
  await wait(200);
  await clickText(r.page, 'Оформить заказ');
  const t0 = await r.text();
  await fillCheckout(r.page);
  const h0 = await historyLength(r.page);
  await clickText(r.page, 'Заказать');
  const mid = [
    await r.page.$eval('main button[type=submit]', (b) => [b.textContent, b.disabled].join()),
    await appUrl(r.page),
  ];
  await wait(1400);
  const t1 = await r.text();
  const u1 = await appUrl(r.page);
  const h1 = await historyLength(r.page);
  console.log(mid, u1, h0, h1, await reqs(r));
  expect(
    t0.includes('3 шт. на 9 570 ₽') &&
      same(mid, ['Отправляем…,true', '/checkout']) &&
      u1 === '/checkout/done?order=1' &&
      t1.includes('Заказ №1 оформлен') &&
      t1.includes('Корзина: 0'),
    `10.7 заказ: «Отправляем…», затем «Заказ №1 оформлен», корзина пуста (${mid}, ${u1})`,
  );
  // Склад на сервере уменьшился: второй заказ — 409
  await r.page.click('header h1 a');
  await wait(200);
  await addOnHome(r.page, 'Ночной экспресс', 1);
  await navigate(r.page, '/checkout');
  await fillCheckout(r.page);
  await clickText(r.page, 'Заказать');
  await wait(1400);
  const t2 = await r.text();
  console.log(t2.slice(t2.indexOf('Оформление'), t2.indexOf('Новости')), await appUrl(r.page));
  expect(
    t2.includes('«Ночной экспресс»: на складе только 0') &&
      (await appUrl(r.page)) === '/checkout' &&
      t2.includes('Корзина: 1'),
    '10.7 второй заказ — 409 из action через useActionData, корзина на месте',
  );
  expect((await r.fresh()).length === 0, '10.7 консоль пуста');
  await r.page.close();
  // «Назад» после заказа — оформление с пустой корзиной; пустые поля — без запроса
  const b = await run(f);
  await addOnHome(b.page, 'Остров сокровищ', 1);
  await navigate(b.page, '/checkout');
  await clickText(b.page, 'Заказать');
  await wait(300);
  const noReq = await reqs(b);
  await fillCheckout(b.page);
  await clickText(b.page, 'Заказать');
  await wait(500);
  await b.page.evaluate(() => history.back());
  await wait(400);
  const bt = await b.text();
  expect(
    noReq.length === 0 && (await appUrl(b.page)) === '/checkout' && bt.includes('0 шт. на 0 ₽'),
    `10.7 пустые поля — запроса нет; «назад» после заказа — /checkout с «0 шт. на 0 ₽» (${noReq})`,
  );
  await fillCheckout(b.page);
  await clickText(b.page, 'Заказать');
  await wait(600);
  expect(
    (await b.text()).includes('Пустой заказ'),
    '10.7 пустая корзина после «назад» — сервер отвечает «Пустой заказ»',
  );
  await b.page.close();
}

// ---------- 10.8 useFetcher ----------
async function subscribe(page, email) {
  await page.evaluate(() => {
    document.querySelector('footer input[name=email]').value = '';
  });
  await page.type('footer input[name=email]', email);
  await page.$eval('footer button[type=submit]', (b) => b.click());
}
if (want('10.8')) {
  const f = readDir(`${CH}/08-fetchers/solution`);
  const r = await run(f, { backend: { latency: 1000 }, url: '/games/4', waitMs: 1600 });
  await reqs(r);
  r.network.length = 0;
  const h0 = await historyLength(r.page);
  await subscribe(r.page, 'a@b.ru');
  await wait(400);
  const mid = [
    await r.page.$eval('footer button[type=submit]', (b) => b.textContent),
    await busy(r.page),
    await appUrl(r.page),
  ];
  await wait(2000);
  const t = await r.text();
  const rq = await reqs(r);
  const h1 = await historyLength(r.page);
  console.log(mid, rq, h0, h1);
  expect(
    same(mid, ['Подписываем…', 'false', '/games/4']) &&
      t.includes('Подписка оформлена — a@b.ru: новинки, раз в неделю') &&
      h1 === h0,
    `10.8 подписка: «Подписываем…», страница не приглушена, адрес и история те же (${mid})`,
  );
  expect(
    same(rq, ['POST /api/subscribe 201', 'GET /api/games/4 200']),
    `10.8 после action фетчера роутер перезапустил loader страницы (${rq})`,
  );
  await subscribe(r.page, 'a@b.ru');
  await wait(2600);
  expect((await r.text()).includes('Этот адрес уже подписан'), '10.8 тот же адрес — 409 «Этот адрес уже подписан»');
  const l8 = (await r.fresh()).filter((l) => !l.includes('[аналитика]'));
  expect(l8.length === 0, `10.8 консоль пуста ${JSON.stringify(l8).slice(0, 400)}`);
  await r.page.close();
  // Обычная Form вместо fetcher.Form
  const g = edit(
    edit(f, 'layout/Footer.tsx', '      <fetcher.Form\n', '      <Form\n'),
    'layout/Footer.tsx',
    '      </fetcher.Form>',
    '      </Form>',
  );
  const g2 = edit(
    g,
    'layout/Footer.tsx',
    "import { useFetcher } from 'react-router';",
    "import { Form, useFetcher } from 'react-router';",
  );
  const fr = await run(g2, { url: '/catalog' });
  await subscribe(fr.page, 'b@b.ru');
  await wait(700);
  const ft = await fr.text();
  expect(
    (await appUrl(fr.page)) === '/subscribe' && !ft.includes('Подписка оформлена') && !ft.includes('Все игры'),
    '10.8 обычная Form — переход на /subscribe: пустая страница, сообщения нет',
  );
  await fr.page.close();
}

// ---------- 10.9 Ошибки и 404 ----------
const backendConfig = (page, config) =>
  page.evaluate((config) => window.postMessage({ type: 'backend-config', config }, '*'), config);
if (want('10.9')) {
  const f = readDir(`${CH}/09-errors/solution`);
  const n = await run(f, { url: '/games/999' });
  const nt = await n.text();
  expect(
    nt.startsWith('♞ Ход конём') && nt.includes('Такой страницы нет') && (await n.fresh()).length === 0,
    '10.9 /games/999: 404 из loader — «Такой страницы нет» внутри макета, консоль пуста',
  );
  await n.page.close();
  const e = await run(f, { url: '/games/4', backend: { latency: 300, failRate: 1 } });
  const et = await e.text();
  expect(
    et.startsWith('♞ Ход конём') && et.includes('Сервер ответил ошибкой 500.'),
    '10.9 failRate 1: «Сервер ответил ошибкой 500.» внутри макета',
  );
  await backendConfig(e.page, { latency: 300, failRate: 0 });
  await clickText(e.page, 'Попробовать снова');
  await wait(800);
  expect(
    (await e.text()).includes('Ночной экспресс') && (await appUrl(e.page)) === '/games/4',
    '10.9 «Попробовать снова» после восстановления сервера — страница игры',
  );
  await e.page.close();
  const rend = await run(
    edit(
      f,
      'game/GameDetails.tsx',
      '}: GameDetailsProps) {',
      "}: GameDetailsProps) {\n  if (game.id === 4) throw new Error('Бум');",
    ),
    { url: '/games/4' },
  );
  const rl = await rend.fresh();
  expect(
    (await rend.text()).includes('Ошибка в приложении — мы уже знаем о ней.') &&
      has(rl, 'The above error occurred in the <GameDetails> component.') &&
      has(rl, 'React Router caught the following error during render Error: Бум'),
    '10.9 ошибка при рендере — та же граница, в консоли два сообщения',
  );
  await rend.page.close();
  const noPathless = await run(
    edit(f, 'routes.tsx', '        ErrorBoundary: RouteError,\n        children: [', '        children: ['),
    { url: '/games/999' },
  );
  expect(
    (await noPathless.text()).startsWith('Такой страницы нет'),
    '10.9 только корневая граница — 404 без шапки и подвала',
  );
  await noPathless.page.close();
  let none = edit(f, 'routes.tsx', '        ErrorBoundary: RouteError,\n        children: [', '        children: [');
  none = edit(none, 'routes.tsx', '    ErrorBoundary: RouteError,\n', '');
  const nn = await run(none, { url: '/games/999' });
  expect(
    (await nn.text()).startsWith('Unexpected Application Error!'),
    '10.9 без границ — встроенная страница роутера',
  );
  await nn.page.close();
}

// ---------- 10.10 Ленивые маршруты ----------
if (want('10.10')) {
  const f = readDir(`${CH}/10-lazy/solution`);
  const g = edit(
    f,
    'checkout/CheckoutPage.tsx',
    "import styles from './CheckoutPage.module.css';",
    "import styles from './CheckoutPage.module.css';\n\nconsole.log('модуль оформления выполнен');",
  );
  const r = await run(g);
  const start = logLines(await r.fresh());
  await addOnHome(r.page, 'Остров сокровищ', 1);
  await navigate(r.page, '/checkout');
  const first = logLines(await r.fresh());
  await navigate(r.page, '/');
  await navigate(r.page, '/checkout');
  const second = logLines(await r.fresh());
  await fillCheckout(r.page);
  await clickText(r.page, 'Заказать');
  await wait(800);
  expect(
    start.length === 0 &&
      same(first, ['модуль оформления выполнен']) &&
      second.length === 0 &&
      (await r.text()).includes('Заказ №1 оформлен'),
    `10.10 модуль выполнен при первом переходе и только раз; заказ работает (${JSON.stringify([start, first, second])})`,
  );
  await r.page.close();
  // Задержка в lazy: переход ждёт кода, как данных
  const d = edit(
    f,
    'routes.tsx',
    '            lazy: async () => {\n',
    '            lazy: async () => {\n              await new Promise((r) => setTimeout(r, 1000));\n',
  );
  const dl = await run(d);
  await addOnHome(dl.page, 'Остров сокровищ', 1);
  await dl.page.click('header a[href="/cart"]');
  await wait(200);
  await dl.page.evaluate(() =>
    [...document.querySelectorAll('a')].find((x) => x.textContent.trim() === 'Оформить заказ').click(),
  );
  await wait(400);
  const mid = [await appUrl(dl.page), await busy(dl.page)];
  await wait(900);
  const end = [await appUrl(dl.page), (await dl.text()).includes('Оформление заказа')];
  expect(
    same(mid, ['/cart', 'true']) && same(end, ['/checkout', true]),
    `10.10 lazy с задержкой: адрес старый и aria-busy, через секунду — оформление (${mid} | ${end})`,
  );
  await dl.page.close();
  const direct = await run(d, { url: '/checkout', waitMs: 400 });
  const dt = await direct.text();
  expect(dt.trim() === 'Загружаем…', `10.10 прямой заход на ленивый маршрут — HydrateFallback («${dt.slice(0, 30)}»)`);
  await direct.page.close();
}

// ---------- 10.11 Защита маршрутов ----------
if (want('10.11')) {
  const f = readDir(`${CH}/11-guards/solution`);
  const logged = edit(
    f,
    'checkout/CheckoutPage.tsx',
    "import styles from './CheckoutPage.module.css';",
    "import styles from './CheckoutPage.module.css';\n\nconsole.log('модуль оформления выполнен');",
  );
  const d = await run(logged, { url: '/checkout' });
  const dLines = logLines(await d.fresh());
  expect(
    (await appUrl(d.page)) === '/cart' && (await d.text()).includes('Корзина пуста'),
    `10.11 прямой заход на /checkout с пустой корзиной → /cart`,
  );
  expect(
    same(dLines, ['модуль оформления выполнен']),
    '10.11 lazy загружается параллельно с loader — даже при редиректе',
  );
  await d.page.close();
  // Заказ, потом «назад» — снова корзина
  const r = await run(f);
  const h0 = await historyLength(r.page);
  await addOnHome(r.page, 'Остров сокровищ', 1);
  await r.page.click('header a[href="/cart"]');
  await wait(200);
  await clickText(r.page, 'Оформить заказ');
  await fillCheckout(r.page);
  await clickText(r.page, 'Заказать');
  await wait(700);
  const done = await appUrl(r.page);
  await r.page.evaluate(() => history.back());
  await wait(500);
  expect(
    done.startsWith('/checkout/done') && (await appUrl(r.page)) === '/cart',
    `10.11 «назад» после заказа → /cart (${await appUrl(r.page)})`,
  );
  await r.page.close();
  // Гард компонентом
  let g = edit(
    f,
    'routes.tsx',
    "            loader: () => {\n              if (useCartStore.getState().items.length === 0) {\n                return redirect('/cart');\n              }\n              return null;\n            },\n",
    '',
  );
  g = edit(
    g,
    'checkout/CheckoutPage.tsx',
    '  const navigation = useNavigation();',
    '  const navigation = useNavigation();\n  console.log(\'render CheckoutPage\', count);\n  if (count === 0) return <Navigate to="/cart" replace />;',
  );
  g = edit(g, 'checkout/CheckoutPage.tsx', '  Form,\n', '  Form,\n  Navigate,\n');
  const c = await run(g, { url: '/checkout' });
  const cl = await c.fresh();
  expect(
    (await appUrl(c.page)) === '/cart' && same(logLines(cl), ['render CheckoutPage 0', 'render CheckoutPage 0']),
    '10.11 гард <Navigate>: страница успела отрендериться (×2), потом /cart',
  );
  await c.page.close();
}

// ---------- 10.12 Навигация и UX ----------
const dialogShown = (page) => page.evaluate(() => Boolean(document.querySelector('[role="alertdialog"]')));
if (want('10.12')) {
  const f = readDir(`${CH}/12-ux/solution`);
  const r = await run(f);
  await addOnHome(r.page, 'Остров сокровищ', 1);
  await r.page.click('header a[href="/cart"]');
  await wait(200);
  await clickText(r.page, 'Оформить заказ');
  await r.page.type('input[name="name"]', 'Аня');
  await wait(100);
  await r.page.click('header h1 a');
  await wait(250);
  const b1 = [await dialogShown(r.page), await appUrl(r.page)];
  await clickText(r.page, 'Остаться');
  const b2 = [
    await dialogShown(r.page),
    await appUrl(r.page),
    await r.page.$eval('input[name="name"]', (i) => i.value),
  ];
  await r.page.evaluate(() => history.back());
  await wait(300);
  const b3 = [await dialogShown(r.page), await appUrl(r.page)];
  await clickText(r.page, 'Уйти');
  const b4 = await appUrl(r.page);
  console.log(b1, b2, b3, b4);
  expect(
    same(b1, [true, '/checkout']) &&
      same(b2, [false, '/checkout', 'Аня']) &&
      same(b3, [true, '/checkout']) &&
      b4 !== '/checkout',
    `10.12 блокировка: ссылка и «назад» спрашивают, «Остаться»/«Уйти» (${JSON.stringify([b1, b2, b3, b4])})`,
  );
  await r.page.close();
  // Отправка заказа не блокируется
  const o = await run(f);
  await addOnHome(o.page, 'Остров сокровищ', 1);
  await navigate(o.page, '/checkout');
  await fillCheckout(o.page);
  await clickText(o.page, 'Заказать');
  await wait(800);
  expect(
    (await appUrl(o.page)).startsWith('/checkout/done') && !(await dialogShown(o.page)),
    '10.12 отправка и redirect после action — без вопроса',
  );
  expect((await o.fresh()).length === 0, '10.12 консоль пуста');
  await o.page.close();
  const nb = await run(
    edit(
      f,
      'checkout/CheckoutPage.tsx',
      '    ({ currentLocation, nextLocation }) =>\n      dirty &&\n      currentLocation.pathname !== nextLocation.pathname,',
      '    () => dirty,',
    ),
  );
  await addOnHome(nb.page, 'Остров сокровищ', 1);
  await nb.page.click('header a[href="/cart"]');
  await wait(200);
  await clickText(nb.page, 'Оформить заказ');
  await fillCheckout(nb.page);
  await clickText(nb.page, 'Заказать');
  await wait(500);
  expect(
    (await dialogShown(nb.page)) && (await appUrl(nb.page)) === '/checkout',
    '10.12 () => dirty — блокирует и отправку формы',
  );
  await nb.page.close();
  // Прокрутка: главная (высота постоянная) → игра → назад
  const scrolls = {};
  for (const [name, files] of [
    ['sr', f],
    ['none', edit(f, 'layout/Layout.tsx', '      <ScrollRestoration />\n', '')],
  ]) {
    const sc = await run(files);
    await sc.page.evaluate(() => window.scrollTo(0, 600));
    await wait(200);
    const y0 = await sc.page.evaluate(() => Math.round(scrollY));
    await sc.page.evaluate(() => [...document.querySelectorAll('main article h3 a')].at(-1).click());
    await wait(600);
    const y1 = await sc.page.evaluate(() => Math.round(scrollY));
    await sc.page.evaluate(() => history.back());
    await wait(800);
    const y2 = await sc.page.evaluate(() => Math.round(scrollY));
    scrolls[name] = [y0, y1, y2];
    await sc.page.close();
  }
  expect(
    scrolls.sr[1] === 0 && scrolls.sr[2] === scrolls.sr[0] && scrolls.none[1] > 0,
    `10.12 ScrollRestoration: игра — сверху, «назад» — прежняя позиция; без него игра открывается прокрученной (${JSON.stringify(scrolls)})`,
  );
  // viewTransition: вызов document.startViewTransition
  const v = await run(f);
  await v.page.evaluate(() => {
    window.__vt = 0;
    const orig = document.startViewTransition?.bind(document);
    document.startViewTransition = (cb) => {
      window.__vt++;
      return orig
        ? orig(cb)
        : (cb(), { finished: Promise.resolve(), ready: Promise.resolve(), updateCallbackDone: Promise.resolve() });
    };
  });
  await v.page.evaluate(() => document.querySelector('main article h3 a').click());
  await wait(600);
  const vt = await v.page.evaluate(() => [window.__vt, typeof document.startViewTransition]);
  await v.page.click('header a[href="/cart"]');
  await wait(400);
  const vt2 = await v.page.evaluate(() => window.__vt);
  expect(
    vt[0] === 1 && vt2 === 1,
    '10.12 viewTransition: startViewTransition у ссылки карточки, у ссылки без пропа — нет',
  );
  await v.page.close();
}

// ---------- 10.13 Под капотом ----------
if (want('10.13')) {
  // Код стенда — прямо из текста урока
  const lesson = fs.readFileSync(`${CH}/13-under-the-hood/lesson.md`, 'utf8');
  const demo = lesson.match(/```tsx main\.tsx\n([\s\S]*?)```/)[1];
  const demoErrors = typeErrors({ 'main.tsx': demo });
  expect(demoErrors.length === 0, `10.13 код стенда без ошибок типов ${demoErrors}`);
  const link = (page, text) =>
    page.evaluate((text) => [...document.querySelectorAll('a')].find((a) => a.textContent === text).click(), text);
  const r = await run({ 'main.tsx': demo }, { url: '/a', waitMs: 1400 });
  const first = logLines(await r.fresh());
  const t = (l) => Number(l.match(/(\d+) мс/)[1]);
  expect(
    same(first.slice(0, 3), [
      '/games/new → /games/new {  }',
      '/games/4 → /games/:id { id: "4" }',
      '/games → * { *: "games" }',
    ]),
    `10.13 ранжирование matchRoutes (${first.slice(0, 3)})`,
  );
  expect(
    first[3].startsWith('корень: начал') && first[4].startsWith('A: начал') && t(first[6]) < 1200,
    `10.13 загрузчики корня и A — параллельно, ~1 с (${first.slice(3)})`,
  );
  await link(r.page, 'Раздел B');
  await wait(600);
  const toB = logLines(await r.fresh());
  expect(
    toB.length === 2 && toB[0].startsWith('B: начал') && toB[1].startsWith('B: закончил'),
    `10.13 переход A → B: только загрузчик B (${toB})`,
  );
  await r.page.close();
  const q = await run({ 'main.tsx': demo }, { url: '/', waitMs: 1400 });
  await q.fresh();
  await link(q.page, 'Раздел A');
  await wait(200);
  await link(q.page, 'Раздел B');
  await wait(1300);
  const race = logLines(await q.fresh()).map((l) => l.replace(/\d+ мс/, 'N'));
  expect(
    same(race, ['A: начал N', 'A: отменён N', 'B: начал N', 'B: закончил N', 'A: закончил N']) &&
      (await appUrl(q.page)) === '/b' &&
      (await q.text()).endsWith('Раздел B'),
    `10.13 быстрая смена: A отменён, победил B; A «закончил» после отмены (${race})`,
  );
  await q.page.close();
}

// ---------- 10.14 Практикум ----------
const crumbs = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('nav[aria-label="Хлебные крошки"] li')]
      .map((li) => li.textContent.trim())
      .join(' › '),
  );
if (want('10.14')) {
  const f = readDir(`${CH}/14-practice/solution`);
  const got = {};
  for (const url of ['/', '/catalog', '/games/4', '/account/settings', '/games/999', '/nope']) {
    const r = await run(f, { url });
    got[url] = await crumbs(r.page);
    if (url === '/account/settings') {
      await r.page.evaluate(() => document.querySelectorAll('nav[aria-label="Хлебные крошки"] a')[1].click());
      await wait(300);
      got['→ Кабинет'] = [await appUrl(r.page), await crumbs(r.page)].join(' ');
    }
    if (url === '/games/999') got[url] += ' | ' + ((await r.text()).includes('Такой страницы нет') ? '404' : '?');
    await r.page.close();
  }
  console.log(got);
  expect(
    same(got, {
      '/': '',
      '/catalog': 'Главная › Каталог',
      '/games/4': 'Главная › Ночной экспресс',
      '/account/settings': 'Главная › Кабинет › Настройки',
      '→ Кабинет': '/account Главная › Кабинет',
      '/games/999': 'Главная › Игра не найдена | 404',
      '/nope': '',
    }),
    `10.14 крошки на страницах (${JSON.stringify(got)})`,
  );
  const bad = await run(
    edit(
      f,
      'routes.tsx',
      "              crumb: (game: Game | undefined) =>\n                game?.title ?? 'Игра не найдена',",
      '              crumb: (game: Game) => game.title,',
    ),
    { url: '/games/999' },
  );
  const bt = await bad.text();
  expect(bt.startsWith('Что-то пошло не так'), '10.14 без защиты от undefined — корневая граница вместо магазина');
  await bad.page.close();
}

await browser.close();
console.log(failures.length ? `\nПровалено: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
