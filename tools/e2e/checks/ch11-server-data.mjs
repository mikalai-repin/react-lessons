// Проверка утверждений и экспериментов главы 11 «Данные с сервера»: каждый эксперимент из текста —
// на коде того шага, о котором текст. node tools/e2e/checks/ch11-server-data.mjs (нужен npm run dev).
// ONLY=11.2,11.5 — только эти разделы (и без общей проверки шагов).
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
  navigate,
  openPreview,
  pageText,
  readDir,
  wait,
} from '../lib.mjs';

const CH = `${CONTENT}/11-server-data`;
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
  // Запросы к бэкенду с прошлого вызова: «GET /api/games?category=kids 200»
  const requests = async () => {
    await collect(result.page, result.logs, result.network);
    const list = result.network.splice(0).map((e) => `${e.method} ${e.url} ${e.status}`);
    return list;
  };
  return { ...result, compiled, text, fresh, requests };
};
const logLines = (lines) => lines.filter((l) => l.startsWith('[preview:log] ')).map((l) => l.slice(14));

// Ошибки типов полного кода — как в редакторе (настройки tsconfig.content.json)
const TC = join(OUT, 'ch11-tc');
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
// Выбор в списке фильтра: 0 — категория, 1 — порядок
async function choose(page, index, value, ms = 250) {
  await page.evaluate(
    (index, value) => {
      const select = document.querySelectorAll('select')[index];
      select.value = value;
      select.dispatchEvent(new Event('change', { bubbles: true }));
    },
    index,
    value,
  );
  await wait(ms);
}
// Ввод «как с клавиатуры»: по букве, событие input на каждую
async function typeLetters(page, text, selector = 'input[type="search"]') {
  for (let i = 1; i <= text.length; i++) {
    await page.evaluate(
      (selector, value) => {
        const input = document.querySelector(selector);
        const proto = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
        Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(input, value);
        input.dispatchEvent(new Event('input', { bubbles: true }));
      },
      selector,
      text.slice(0, i),
    );
    await wait(60);
  }
}
// Щелчок по ссылке с таким текстом — переход роутера, а не адресная строка
async function clickLink(page, text, ms = 200) {
  await page.evaluate((text) => {
    [...document.querySelectorAll('a')].find((a) => a.textContent.trim() === text).click();
  }, text);
  await wait(ms);
}
// Категории карточек каталога по порядку
const cardCategories = (page) => page.$$eval('main article', (as) => as.map((a) => a.dataset.category));
const cardTitles = (page) => page.$$eval('main article h3', (hs) => hs.map((h) => h.textContent.trim()));

// Отзывы: кнопка формы, текст блока «Отзывы», отправка
const submitButton = (page) => page.$eval('form button[type="submit"]', (b) => `${b.textContent.trim()}|${b.disabled}`);
const reviewsText = (page) =>
  page.evaluate(
    () =>
      [...document.querySelectorAll('main section')]
        .find((s) => s.textContent.startsWith('Отзывы'))
        ?.innerText.replace(/\s+/g, ' ') ?? '',
  );
async function sendReview(page, text) {
  await typeLetters(page, text, 'textarea');
  await wait(100);
  await page.evaluate(() => document.querySelector('form button[type="submit"]').click());
}
// Настройки учебного бэкенда на ходу — как вкладка «Сеть»
const configure = (page, config) =>
  page.evaluate((config) => window.postMessage({ type: 'backend-config', config }, '*'), config);
const ONLY = process.env.ONLY?.split(',');
const want = (section) => !ONLY || ONLY.includes(section);

// Каждый шаг: консоль пуста, ошибок типов нет
const STEPS = [
  '01-backend',
  '02-fetch-effect',
  '03-suspense',
  '04-error-boundaries',
  '05-tanstack-query',
  '06-cache',
  '07-query-router',
  '08-mutations',
  '09-optimistic',
  '10-infinite',
  '12-practice',
];
for (const step of ONLY ? [] : STEPS) {
  const files = readDir(`${CH}/${step}/solution`);
  const errors = typeErrors(files);
  const r = await run(files, { url: '/catalog' });
  const lines = await r.fresh();
  expect(
    errors.length === 0 && lines.length === 0,
    `${step}: консоль пуста, без ошибок типов ${JSON.stringify([...errors, ...lines])}`,
  );
  await r.page.close();
}

// ---------- 11.1 Учебный бэкенд ----------
if (want('11.1')) {
  const f = readDir(`${CH}/01-backend/solution`);
  // Игра 13 есть только на сервере: страница игры её показывает
  const r = await run(f, { url: '/games/13' });
  const t = await r.text();
  expect(t.includes('Главная Северный путь ← Назад'), '11.1 /games/13 — «Северный путь» с сервера');
  // Корзина хранит снимок игры: игра, которой нет в локальном каталоге, — в корзине с ценой
  await press(r.page, 'В корзину');
  await clickLink(r.page, 'Корзина: 1', 300);
  const cart = await r.text();
  expect(
    cart.includes('Северный путь') && cart.includes('Итого: 2 790 ₽'),
    `11.1 игра 13 в корзине (${cart.slice(60, 200)})`,
  );
  const saved = await r.page.evaluate(() => localStorage.getItem('cart'));
  expect(
    saved.includes('"version":2') && saved.includes('"title":"Северный путь"') && !saved.includes('description'),
    `11.1 в localStorage — снимок без описания, версия 2 (${saved})`,
  );
  // 404 — ApiError, RouteError показывает «не найдено»
  await r.page.close();
  const nf = await run(f, { url: '/games/999' });
  const nt = await nf.text();
  expect(
    /не найден/i.test(nt) && (await nf.requests()).includes('GET /api/games/999 404'),
    `11.1 /games/999 → 404 и NotFoundPage (${nt.slice(0, 160)})`,
  );
  await nf.page.close();
  // Сервер лежит: 500 → «Сервер ответил ошибкой 500.»
  const down = await run(f, { url: '/games/1', backend: { latency: 0, failRate: 1 } });
  const dt = await down.text();
  expect(
    dt.includes('Сервер ответил ошибкой 500.'),
    `11.1 failRate 1 — «Сервер ответил ошибкой 500.» (${dt.slice(0, 200)})`,
  );
  await down.page.close();
  // Без проверки response.ok: fetch не бросает на 404 — тело ошибки становится «игрой»
  const noOk = edit(
    f,
    'api/client.ts',
    `  if (!response.ok) {
    // Учебный сервер кладёт текст ошибки в поле message
    const body = (await response.json()) as { message: string };
    throw new ApiError(response.status, body.message);
  }
`,
    '',
  );
  const no = await run(noOk, { url: '/games/999' });
  const noText = await no.text();
  const noLines = await no.fresh();
  expect(
    noText.includes('Ошибка в приложении') &&
      noLines.some((l) =>
        l.includes("TypeError: Cannot destructure property 'min' of 'game.players' as it is undefined."),
      ),
    `11.1 без проверки ok: «Ошибка в приложении», TypeError про min (${noText.slice(60, 200)}) ${JSON.stringify(noLines.map((l) => l.slice(0, 200)))}`,
  );
  await no.page.close();
  // slow: добавочная задержка одного адреса
  const slow = await run(f, {
    url: '/games/2',
    backend: { latency: 100, slow: { '/api/games/2': 1500 } },
    waitMs: 2200,
  });
  await collect(slow.page, slow.logs, slow.network);
  const entry = slow.network.find((e) => e.url === '/api/games/2');
  expect(entry && entry.ms >= 1550, `11.1 slow: /api/games/2 отвечает через ${entry?.ms} мс`);
  await slow.page.close();
}

// ---------- 11.2 fetch в эффекте ----------
if (want('11.2')) {
  const f = readDir(`${CH}/02-fetch-effect/solution`);
  // StrictMode: первый запрос отменён, второй — 200
  const r = await run(f, { url: '/catalog', backend: { latency: 300 }, waitMs: 1200 });
  const first = await r.requests();
  expect(
    JSON.stringify(first) === JSON.stringify(['GET /api/games canceled', 'GET /api/games 200']),
    `11.2 StrictMode: первый запрос отменён ${JSON.stringify(first)}`,
  );
  const t = await r.text();
  expect(
    t.includes('Все игры 40') && (await r.page.$$('main article')).length === 12,
    '11.2 каталог: 40 всего, 12 карточек',
  );
  // Без кэша: ушли на игру и вернулись — снова «Загружаем каталог…» и новый запрос
  await clickLink(r.page, 'Остров сокровищ', 600);
  await r.requests();
  await r.page.evaluate(() => history.back());
  await wait(100);
  const back = await r.text();
  await wait(800);
  const again = await r.requests();
  expect(
    back.includes('Загружаем каталог…') && again.includes('GET /api/games 200'),
    `11.2 назад — снова загрузка и запрос ${JSON.stringify(again)}`,
  );
  await r.page.close();

  // Гонка: «Семейные» отвечают медленно, сразу выбираем «Детские»
  const race = async (files) => {
    const p = await run(files, {
      url: '/catalog',
      backend: { latency: 300, slow: { '/api/games?category=family': 1500 } },
      waitMs: 1000,
    });
    await p.requests();
    await choose(p.page, 0, 'family', 100);
    await choose(p.page, 0, 'kids', 2500);
    const cats = [...new Set(await cardCategories(p.page))];
    const reqs = await p.requests();
    const selected = await p.page.$eval('select', (s) => s.value);
    await p.page.close();
    return { cats, reqs, selected };
  };
  const ok = await race(f);
  expect(
    ok.selected === 'kids' && ok.cats.join() === 'kids' && ok.reqs.includes('GET /api/games?category=family canceled'),
    `11.2 с очисткой: «Детские», запрос семейных отменён ${JSON.stringify(ok)}`,
  );
  const noCleanup = edit(f, 'catalog/CatalogPage.tsx', '    return () => controller.abort();\n', '');
  const bad = await race(noCleanup);
  expect(
    bad.selected === 'kids' && bad.cats.join() === 'family' && bad.reqs.includes('GET /api/games?category=family 200'),
    `11.2 без очистки: выбраны «Детские», а на экране семейные ${JSON.stringify(bad)}`,
  );
}

// ---------- 11.3 Suspense и use ----------
// Через сколько мс после старта в тексте страницы появилось text (опрос каждые 50 мс)
async function appearsAfter(page, text, limit = 5000) {
  const start = Date.now();
  while (Date.now() - start < limit) {
    if ((await pageText(page)).includes(text)) return Date.now() - start;
    await wait(50);
  }
  return null;
}
if (want('11.3')) {
  const f = readDir(`${CH}/03-suspense/solution`);
  const slowReviews = { latency: 300, slow: { '/api/games/1/reviews': 1500 } };
  // Медленные отзывы: игра видна, на месте отзывов — заглушка
  const r = await run(f, { url: '/games/1', backend: slowReviews, waitMs: 900 });
  const t1 = await r.text();
  const skeleton = await r.page.$('[aria-label="Загружаем отзывы"]');
  await wait(1200);
  const t2 = await r.text();
  expect(
    t1.includes('Остров сокровищ Игроки') && skeleton && !t1.includes('Аня') && t2.includes('Аня 12 августа 2026 г.'),
    `11.3 игра сразу, отзывы — после заглушки (${t1.slice(-120)} | ${t2.includes('Аня')})`,
  );
  const lines = await r.fresh();
  expect(lines.length === 0, `11.3 консоль пуста ${JSON.stringify(lines)}`);
  await r.page.close();

  // Без Suspense: что будет на экране, пока отзывы грузятся
  const noSuspense = edit(
    f,
    'game/GamePage.tsx',
    `        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews reviews={reviews} />
        </Suspense>`,
    `        <Reviews reviews={reviews} />`,
  );
  const ns = await run(noSuspense, { url: '/games/1', backend: slowReviews, waitMs: 900 });
  const nt1 = await ns.text();
  await wait(1300);
  const nt2 = await ns.text();
  const nlines = await ns.fresh();
  console.log(
    '   без Suspense, 0.9 с:',
    JSON.stringify(nt1.slice(0, 120)),
    '| 2.2 с:',
    JSON.stringify(nt2.slice(0, 80)),
    nlines,
  );
  // Из каталога по ссылке (переход роутера) — без Suspense
  await navigate(ns.page, '/catalog', 900);
  await ns.requests();
  await clickLink(ns.page, 'Остров сокровищ', 700);
  const nav1 = await ns.text();
  const navUrl = await appUrl(ns.page);
  await wait(1500);
  const nav2 = await ns.text();
  console.log(
    '   без Suspense, переход: 0.7 с',
    navUrl,
    JSON.stringify(nav1.slice(60, 160)),
    '| 2.2 с',
    JSON.stringify(nav2.slice(60, 140)),
  );
  await ns.page.close();

  // Промис в рендере: Reviews сам создаёт промис — новый на каждую попытку рендера
  let inRender = edit(
    edit(f, 'game/GamePage.tsx', '<Reviews reviews={reviews} />', '<Reviews gameId={String(game.id)} />'),
    'game/GamePage.tsx',
    'const { game, reviews } = useLoaderData',
    'const { game } = useLoaderData',
  );
  inRender = edit(
    inRender,
    'game/Reviews.tsx',
    "import type { Review } from '../api/models';",
    "import { fetchReviews } from '../api/games';",
  );
  inRender = edit(inRender, 'game/Reviews.tsx', 'reviews: Promise<Review[]>;', 'gameId: string;');
  inRender = edit(
    inRender,
    'game/Reviews.tsx',
    'export function Reviews({ reviews }: ReviewsProps) {\n  const list = use(reviews);',
    'export function Reviews({ gameId }: ReviewsProps) {\n  const list = use(fetchReviews(gameId));',
  );
  const ir = await run(inRender, { url: '/games/1', backend: slowReviews, waitMs: 8000 });
  const irReqs = (await ir.requests()).filter((x) => x.includes('/reviews'));
  const irLines = await ir.fresh();
  const irText = await ir.text();
  expect(
    irReqs.length >= 6 && !irText.includes('Аня') && !irLines.some((l) => /preview:(error|warn)/.test(l)),
    `11.3 use(fetchReviews(id)) в Reviews: ${irReqs.length} запросов за 8 с, отзывов нет, консоль пуста ${JSON.stringify(irLines)} ${irText.slice(-200)}`,
  );
  await ir.page.close();

  // Водопад: отзывы запрашиваются после игры
  const waterfall = edit(
    f,
    'game/GamePage.tsx',
    `  const reviews = fetchReviews(params.id!, request.signal);
  const game = await fetchGame(params.id!, request.signal);`,
    `  const game = await fetchGame(params.id!, request.signal);
  const reviews = fetchReviews(params.id!, request.signal);`,
  );
  for (const [name, files] of [
    ['параллельно', f],
    ['водопад', waterfall],
  ]) {
    const w = await run(files, { url: '/games/2', backend: { ...slowReviews, latency: 1000 }, waitMs: 0 });
    const ms = await appearsAfter(w.page, 'Отзывов пока нет.');
    console.log(`   ${name}: отзывы видны через ${ms} мс`);
    w.timing = ms;
    await w.page.close();
    if (name === 'водопад') expect(ms > 1900, `11.3 водопад: отзывы через ${ms} мс (две задержки)`);
    else expect(ms < 1700, `11.3 параллельно: отзывы через ${ms} мс (одна задержка)`);
  }

  // Сервер лежит: игра не загрузилась — промис отзывов тоже отклонён
  const down = await run(f, { url: '/games/1', backend: { latency: 0, failRate: 1 } });
  const dlines = await down.fresh();
  const dt = await down.text();
  console.log(
    '   failRate 1:',
    JSON.stringify(dt.slice(60, 160)),
    dlines.map((l) => l.slice(0, 200)),
  );
  await down.page.close();
}

// ---------- 11.4 Границы ошибок ----------
if (want('11.4')) {
  const failReviews = { latency: 300, fail: ['/api/games/2/reviews'] };
  // Шаг 11.3: ошибка отзывов роняет всю страницу игры до границы маршрута
  const before = await run(readDir(`${CH}/03-suspense/solution`), {
    url: '/games/2',
    backend: failReviews,
    waitMs: 1500,
  });
  const bt = await before.text();
  const blines = await before.fresh();
  expect(
    bt.includes('Что-то пошло не так Сервер ответил ошибкой 500.') &&
      !bt.includes('Драконья почта Игроки') &&
      bt.startsWith('♞ Ход конём'),
    `11.4 без своей границы: вся страница — «Что-то пошло не так», шапка на месте (${bt.slice(0, 200)})`,
  );
  console.log(
    '   консоль 11.3 при ошибке отзывов:',
    blines.map((l) => l.slice(0, 400)),
  );
  await before.page.close();

  const f = readDir(`${CH}/04-error-boundaries/solution`);
  const r = await run(f, { url: '/games/2', backend: failReviews, waitMs: 1500 });
  const t = await r.text();
  const lines = await r.fresh();
  expect(
    t.includes('Драконья почта Игроки') && t.includes('Отзывы Не удалось загрузить отзывы. Повторить'),
    `11.4 игра на месте, в блоке отзывов — ошибка (${t.slice(250, 600)})`,
  );
  expect(
    lines.length === 1 &&
      lines[0].includes('The above error occurred in the <Reviews> component.') &&
      lines[0].includes('error boundary you provided, C.'),
    `11.4 консоль: одно сообщение о пойманной ошибке, граница «C» ${JSON.stringify(lines)}`,
  );
  // Без пустого catch: промис отклонён раньше, чем его прочитал use, — ещё и необработанная ошибка
  const noCatch = edit(f, 'game/GamePage.tsx', '  reviews.catch(() => {});\n', '');
  const nc = await run(noCatch, { url: '/games/2', backend: failReviews, waitMs: 1500 });
  const ncLines = await nc.fresh();
  expect(
    ncLines.some((l) => l.startsWith('[runtime-error] Error: Сервер недоступен')),
    `11.4 без catch — необработанная ошибка в консоли`,
  );
  await nc.page.close();
  await r.requests();
  // Повтор: роутер заново вызывает загрузчик — игра и отзывы
  await press(r.page, 'Повторить');
  const during = await r.text();
  await wait(800);
  const again = await r.requests();
  expect(
    again.includes('GET /api/games/2 200') && again.includes('GET /api/games/2/reviews 500'),
    `11.4 «Повторить» — снова игра и отзывы ${JSON.stringify(again)} (во время: ${during.includes('Повторить')})`,
  );
  // Сервер ожил — повтор показывает отзывы (у игры 2 их нет)
  await configure(r.page, { latency: 300 });
  await press(r.page, 'Повторить');
  await wait(800);
  const healed = await r.text();
  expect(
    healed.includes('Отзывы Отзывов пока нет.'),
    `11.4 сервер ожил — «Отзывов пока нет.» (${healed.slice(300, 500)})`,
  );
  await r.page.close();

  // «Следующая игра →»: с resetKeys отзывы игры 3 видны, без — ошибка переезжает
  const nextGame = async (files) => {
    const p = await run(files, { url: '/games/2', backend: failReviews, waitMs: 1200 });
    await clickLink(p.page, 'Следующая игра →', 900);
    const url = await appUrl(p.page);
    const text = await reviewsText(p.page);
    await p.page.close();
    return { url, text };
  };
  const withKeys = await nextGame(f);
  expect(
    withKeys.url === '/games/4' && withKeys.text.includes('Дима'),
    `11.4 следующая игра — её отзывы ${JSON.stringify(withKeys)}`,
  );
  const noKeys = await nextGame(edit(f, 'game/GamePage.tsx', '          resetKeys={[reviews]}\n', ''));
  expect(
    noKeys.url === '/games/4' && noKeys.text.includes('Не удалось загрузить отзывы.'),
    `11.4 без resetKeys: у игры 4 тоже ошибка ${JSON.stringify(noKeys)}`,
  );

  // Своя граница-класс вместо библиотеки
  const OWN = `
type BoundaryProps = { fallback: ReactNode; children: ReactNode };
type BoundaryState = { failed: boolean };

// Граница ошибок — только класс: у функций нет нужных методов
class OwnBoundary extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { failed: false };

  // Ошибка в рендере потомка → следующий рендер — с запасной разметкой
  static getDerivedStateFromError(): BoundaryState {
    return { failed: true };
  }

  // После фиксации: место для отправки ошибки в мониторинг
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.log('Поймана ошибка:', String(error), info.componentStack?.length);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
`;
  let own = edit(
    f,
    'game/GamePage.tsx',
    "import { Suspense } from 'react';",
    "import { Component, Suspense } from 'react';\nimport type { ErrorInfo, ReactNode } from 'react';",
  );
  own = edit(
    own,
    'game/GamePage.tsx',
    own['game/GamePage.tsx'].slice(
      own['game/GamePage.tsx'].indexOf('        <ErrorBoundary'),
      own['game/GamePage.tsx'].indexOf('          {/* Пока Reviews'),
    ),
    '        <OwnBoundary\n          fallback={<p className="muted">Не удалось загрузить отзывы.</p>}\n        >\n',
  );
  own = edit(own, 'game/GamePage.tsx', '        </ErrorBoundary>\n', '        </OwnBoundary>\n');
  own = { ...own, 'game/GamePage.tsx': own['game/GamePage.tsx'] + OWN };
  const ownErrors = typeErrors(own).filter((e) => !e.includes('TS6133'));
  const ob = await run(own, { url: '/games/2', backend: failReviews, waitMs: 1500 });
  const obText = await reviewsText(ob.page);
  const obLines = await ob.fresh();
  expect(
    ownErrors.length === 0 &&
      obText.includes('Не удалось загрузить отзывы.') &&
      obLines.some((l) => l.includes('error boundary you provided, OwnBoundary.')) &&
      obLines.some((l) => l.includes('Поймана ошибка: Error: Сервер недоступен')),
    `11.4 своя граница-класс работает ${JSON.stringify([...ownErrors, ...obLines.map((l) => l.slice(0, 160))])}`,
  );
  await ob.page.close();

  // Без resetKeys: граница остаётся в ошибке и после удачного повтора
  const noReset = edit(f, 'game/GamePage.tsx', '          resetKeys={[reviews]}\n', '');
  const nr = await run(noReset, { url: '/games/2', backend: failReviews, waitMs: 1500 });
  await configure(nr.page, { latency: 300 });
  await press(nr.page, 'Повторить');
  await wait(800);
  const stuck = await nr.text();
  const stuckReqs = await nr.requests();
  expect(
    stuck.includes('Не удалось загрузить отзывы.') && stuckReqs.includes('GET /api/games/2/reviews 200'),
    `11.4 без resetKeys: отзывы пришли (200), а на экране ошибка ${JSON.stringify(stuckReqs)}`,
  );
  await nr.page.close();
}

// ---------- 11.5 TanStack Query ----------
if (want('11.5')) {
  const f = readDir(`${CH}/05-tanstack-query/solution`);
  const r = await run(f, { url: '/catalog', backend: { latency: 300 }, waitMs: 1200 });
  const first = await r.requests();
  const t = await r.text();
  console.log('   запуск /catalog:', JSON.stringify(first));
  expect(t.includes('в каталоге 40 игр') && t.includes('Все игры 40'), '11.5 шапка и каталог: 40 игр');
  expect(
    first.filter((x) => x.endsWith(' 200')).length === 1,
    `11.5 шапка и каталог — один удачный запрос ${JSON.stringify(first)}`,
  );
  // Смена категории: новый ключ — данных нет — «Загружаем каталог…»
  await choose(r.page, 0, 'kids', 100);
  const flash = await r.text();
  await wait(500);
  expect(
    flash.includes('Загружаем каталог…') && !flash.includes('Все игры 40'),
    `11.5 смена категории — снова «Загружаем каталог…» (${flash.slice(180, 260)})`,
  );
  await r.requests();
  // Назад к «Все»: данные из кэша сразу, и фоновый запрос (staleTime 0)
  await choose(r.page, 0, 'all', 60);
  const cached = await r.text();
  await wait(600);
  const bg = await r.requests();
  expect(
    !cached.includes('Загружаем каталог…') && cached.includes('Все игры 40') && bg.includes('GET /api/games 200'),
    `11.5 снова «Все»: из кэша сразу + фоновый запрос ${JSON.stringify(bg)}`,
  );
  // На игру и обратно: каталог из кэша без «Загружаем»
  await clickLink(r.page, 'Остров сокровищ', 600);
  await r.requests();
  await r.page.evaluate(() => history.back());
  await wait(80);
  const back = await r.text();
  await wait(600);
  const backReqs = await r.requests();
  expect(
    !back.includes('Загружаем каталог…') && back.includes('Все игры 40'),
    `11.5 назад — каталог из кэша сразу ${JSON.stringify(backReqs)}`,
  );
  const lines = await r.fresh();
  expect(lines.length === 0, `11.5 консоль пуста ${JSON.stringify(lines)}`);
  await r.page.close();

  // Без провайдера: ошибка Query
  const noProvider = edit(
    edit(f, 'main.tsx', '        <QueryClientProvider client={queryClient}>\n', ''),
    'main.tsx',
    '        </QueryClientProvider>\n',
    '',
  );
  const np = await run(noProvider, { url: '/catalog' });
  const npLines = await np.fresh();
  const npText = await np.text();
  expect(
    npText.startsWith('Что-то пошло не так Ошибка в приложении') &&
      npLines.some((l) => l.includes('No QueryClient set, use QueryClientProvider to set one')),
    `11.5 без провайдера — No QueryClient set ${JSON.stringify(npLines.map((l) => l.slice(0, 120)))}`,
  );
  await np.page.close();

  // Сервер лежит: 4 запроса (1 + 3 повтора), ошибка через ~7 с
  const down = await run(f, { url: '/catalog', backend: { latency: 300, failRate: 1 }, waitMs: 0 });
  const started = Date.now();
  let errorAt = null;
  while (Date.now() - started < 14000) {
    if ((await down.text()).includes('Не удалось загрузить каталог.')) {
      errorAt = Date.now() - started;
      break;
    }
    await wait(100);
  }
  const downReqs = (await down.requests()).filter((x) => x.startsWith('GET /api/games '));
  console.log('   failRate 1:', errorAt, 'мс', downReqs);
  expect(
    errorAt > 7000 && errorAt < 9500 && downReqs.filter((x) => x.endsWith('500')).length === 4,
    `11.5 ошибка через ${errorAt} мс после 4 запросов`,
  );
  // «Повторить» — снова попытки
  await configure(down.page, { latency: 300 });
  await press(down.page, 'Повторить');
  await wait(800);
  expect((await down.text()).includes('Все игры 40'), '11.5 «Повторить» после ошибки — каталог');
  await down.page.close();
}

// ---------- 11.6 Ключи и кэш ----------
const busy = (page) => page.$eval('main [aria-busy]', (e) => e.getAttribute('aria-busy')).catch(() => null);
if (want('11.6')) {
  const f = readDir(`${CH}/06-cache/solution`);
  const r = await run(f, { url: '/catalog', backend: { latency: 600 }, waitMs: 1500 });
  await r.requests();
  await choose(r.page, 0, 'kids', 150);
  const during = await r.text();
  const dim = await busy(r.page);
  await wait(800);
  const after = [...new Set(await cardCategories(r.page))];
  expect(
    !during.includes('Загружаем каталог…') &&
      during.includes('Все игры 40') &&
      dim === 'true' &&
      after.join() === 'kids',
    `11.6 keepPreviousData: прежний список бледный (aria-busy=${dim}), затем детские ${after}`,
  );
  expect((await busy(r.page)) === 'false', '11.6 новый список — aria-busy=false');
  await r.requests();
  // Снова «Все» в пределах staleTime — из кэша без запроса
  await choose(r.page, 0, 'all', 900);
  const none = await r.requests();
  expect(
    none.length === 0 && (await r.text()).includes('Все игры 40'),
    `11.6 снова «Все» за 30 с — без запроса ${JSON.stringify(none)}`,
  );
  // На игру и обратно — тоже без запроса каталога
  await clickLink(r.page, 'Остров сокровищ', 1500);
  await r.requests();
  await r.page.evaluate(() => history.back());
  await wait(900);
  const backReqs = await r.requests();
  expect(
    !backReqs.some((x) => x.startsWith('GET /api/games ')),
    `11.6 назад — каталог без запроса ${JSON.stringify(backReqs)}`,
  );
  await r.page.close();

  // Ключ без параметров: смена фильтра не меняет ключ — нового запроса нет
  const noParams = edit(f, 'api/games.ts', '    queryKey: gameKeys.list(params),', '    queryKey: gameKeys.lists(),');
  const np = await run(noParams, { url: '/catalog', backend: { latency: 300 }, waitMs: 1200 });
  await np.requests();
  await choose(np.page, 0, 'kids', 900);
  const npReqs = await np.requests();
  const npCats = [...new Set(await cardCategories(np.page))];
  const npUrl = await appUrl(np.page);
  expect(
    npReqs.length === 0 && npCats.length > 1 && npUrl.includes('category=kids'),
    `11.6 ключ без параметров: адрес ${npUrl}, запросов ${npReqs.length}, на экране ${npCats}`,
  );
  await np.page.close();
}

// ---------- 11.7 Query и роутер ----------
if (want('11.7')) {
  const f = readDir(`${CH}/07-query-router/solution`);
  const r = await run(f, { url: '/games/1', backend: { latency: 300 }, waitMs: 1500 });
  const t = await r.text();
  const first = await r.requests();
  expect(t.includes('Главная Остров сокровищ') && t.includes('Аня 12 августа 2026 г.'), '11.7 /games/1: игра и отзывы');
  console.log('   запуск /games/1:', JSON.stringify(first));
  // В каталог и снова на игру: из кэша, без запросов игры и отзывов
  await navigate(r.page, '/catalog', 900);
  await r.requests();
  await clickLink(r.page, 'Остров сокровищ', 120);
  const quick = await r.text();
  await wait(700);
  const again = await r.requests();
  expect(
    quick.includes('Остров сокровищ Игроки') && quick.includes('Аня') && again.length === 0,
    `11.7 повторный переход: сразу и без запросов ${JSON.stringify(again)}`,
  );
  const lines = await r.fresh();
  expect(lines.length === 0, `11.7 консоль пуста ${JSON.stringify(lines)}`);
  await r.page.close();

  const nf = await run(f, { url: '/games/999', backend: { latency: 0 } });
  expect(/Такой страницы нет/.test(await nf.text()), '11.7 /games/999 — «Такой страницы нет»');
  await nf.page.close();

  // Ошибка отзывов: после повторов Query — граница блока; «Повторить» — только отзывы
  const failRun = async (files) => {
    const p = await run(files, {
      url: '/games/2',
      backend: { latency: 300, fail: ['/api/games/2/reviews'] },
      waitMs: 0,
    });
    const started = Date.now();
    let at = null;
    while (Date.now() - started < 14000) {
      if ((await p.text()).includes('Не удалось загрузить отзывы.')) {
        at = Date.now() - started;
        break;
      }
      await wait(100);
    }
    return { p, at };
  };
  const { p, at } = await failRun(f);
  const reqs = await p.requests();
  console.log('   ошибка отзывов через', at, 'мс', reqs);
  expect(
    at < 1000 && reqs.filter((x) => x === 'GET /api/games/2/reviews 500').length === 1,
    `11.7 ошибка предзагрузки (retry: false у query) — сразу в границу, через ${at} мс`,
  );
  await configure(p.page, { latency: 300 });
  await press(p.page, 'Повторить');
  await wait(700);
  const retry = (await p.requests()).filter((x) => x.startsWith('GET /api/games/'));
  expect(
    JSON.stringify(retry) === JSON.stringify(['GET /api/games/2/reviews 200']) &&
      (await p.text()).includes('Отзывов пока нет.'),
    `11.7 «Повторить» — только отзывы ${JSON.stringify(retry)}`,
  );
  await p.page.close();

  // Сервер всё ещё лежит: «Повторить» — заглушка, 4 попытки хука (~7 с), снова ошибка
  const still = await failRun(f);
  await still.p.requests();
  await press(still.p.page, 'Повторить');
  const skel = await still.p.page.$('[aria-label="Загружаем отзывы"]');
  let againAt = null;
  const t0 = Date.now();
  while (Date.now() - t0 < 14000) {
    if ((await still.p.text()).includes('Не удалось загрузить отзывы.')) {
      againAt = Date.now() - t0;
      break;
    }
    await wait(100);
  }
  const stillReqs = (await still.p.requests()).filter((x) => x.includes('/reviews'));
  expect(
    skel && againAt > 6500 && stillReqs.length === 4,
    `11.7 сервер лежит: «Повторить» — скелет, 4 попытки, ошибка через ${againAt} мс ${JSON.stringify(stillReqs)}`,
  );
  await still.p.page.close();

  // Без onReset={reset}: граница сброшена, а запрос не повторён — снова ошибка
  const noReset = edit(f, 'game/GamePage.tsx', '          onReset={reset}\n', '');
  const nr = await failRun(noReset);
  await nr.p.requests();
  await configure(nr.p.page, { latency: 300 });
  await press(nr.p.page, 'Повторить');
  await wait(700);
  const nrReqs = await nr.p.requests();
  const nrText = await nr.p.text();
  expect(
    !nrReqs.some((x) => x.includes('/reviews')) && nrText.includes('Не удалось загрузить отзывы.'),
    `11.7 без onReset: запроса отзывов нет, ошибка осталась ${JSON.stringify(nrReqs)}`,
  );
  await nr.p.page.close();
}

// ---------- 11.8 Изменения на сервере ----------
if (want('11.8')) {
  const f = readDir(`${CH}/08-mutations/solution`);
  const r = await run(f, { url: '/games/1', backend: { latency: 800 }, waitMs: 2200 });
  await r.requests();
  await sendReview(r.page, 'Сыграли втроём');
  await wait(300);
  const b1 = await submitButton(r.page);
  await wait(800); // POST готов (~800 мс), идёт GET отзывов
  const b2 = await submitButton(r.page);
  await wait(1000);
  const b3 = await submitButton(r.page);
  const reqs = await r.requests();
  const list = await reviewsText(r.page);
  expect(
    b1 === 'Отправляем…|true' &&
      b2 === 'Отправляем…|true' &&
      b3 === 'Отправить|true' &&
      JSON.stringify(reqs.filter((x) => x.includes('/reviews'))) ===
        JSON.stringify(['POST /api/games/1/reviews 201', 'GET /api/games/1/reviews 200']),
    `11.8 «Отправляем…» и во время перезапроса списка: ${b1} → ${b2} → ${b3} ${JSON.stringify(reqs)}`,
  );
  expect(
    list.includes('Гость') && list.includes('Сыграли втроём') && (await r.text()).includes('Спасибо за отзыв!'),
    `11.8 отзыв в списке (${list.slice(0, 200)})`,
  );
  expect((await r.page.$eval('textarea', (t) => t.value)) === '', '11.8 черновик очищен');
  const lines = (await r.fresh()).filter((l) => !l.includes('[аналитика]'));
  expect(lines.length === 0, `11.8 консоль без ошибок ${JSON.stringify(lines)}`);
  await r.page.close();

  // onSuccess без return: мутация закончилась, не дожидаясь списка
  const noReturn = edit(
    f,
    'game/ReviewForm.tsx',
    `    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: gameKeys.reviews(gameId),
      }),`,
    `    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: gameKeys.reviews(gameId),
      });
    },`,
  );
  const nr = await run(noReturn, { url: '/games/1', backend: { latency: 800 }, waitMs: 2200 });
  await sendReview(nr.page, 'Сыграли втроём');
  await wait(1100);
  const nb = await submitButton(nr.page);
  const nlist = await reviewsText(nr.page);
  expect(
    nb === 'Отправить|true' && !nlist.includes('Сыграли втроём'),
    `11.8 без return: кнопка уже «Отправить», а отзыва в списке ещё нет (${nb})`,
  );
  await nr.page.close();

  // Сервер лежит: одна попытка (мутации не повторяются), черновик на месте
  const down = await run(f, { url: '/games/1', backend: { latency: 300 }, waitMs: 1200 });
  await down.requests();
  await configure(down.page, { latency: 300, failRate: 1 });
  await sendReview(down.page, 'Не дойдёт');
  await wait(1200);
  const dreqs = await down.requests();
  const dt = await down.text();
  expect(
    dreqs.filter((x) => x.startsWith('POST')).length === 1 &&
      dt.includes('Не удалось отправить: Сервер недоступен (ошибка включена во вкладке «Сеть»)') &&
      (await down.page.$eval('textarea', (t) => t.value)) === 'Не дойдёт',
    `11.8 ошибка 500: одна попытка, сообщение, черновик цел ${JSON.stringify(dreqs)}`,
  );
  await down.page.close();

  // Без invalidateQueries: отзыв на сервере, а список прежний — и после перехода туда-обратно
  const noInvalidate = edit(
    f,
    'game/ReviewForm.tsx',
    `    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: gameKeys.reviews(gameId),
      }),`,
    '',
  );
  const ni = await run(noInvalidate, { url: '/games/1', backend: { latency: 300 }, waitMs: 1200 });
  await sendReview(ni.page, 'Сыграли втроём');
  await wait(800);
  const nil1 = await reviewsText(ni.page);
  await navigate(ni.page, '/catalog', 900);
  await clickLink(ni.page, 'Остров сокровищ', 900);
  const nil2 = await reviewsText(ni.page);
  const nreqs = (await ni.requests()).filter((x) => x.includes('/reviews'));
  expect(
    !nil1.includes('Сыграли втроём') &&
      !nil2.includes('Сыграли втроём') &&
      (await ni.text()).includes('Спасибо за отзыв!') === false,
    `11.8 без invalidate: отзыва нет в списке и после перехода ${JSON.stringify(nreqs)}`,
  );
  await ni.page.close();
}

// ---------- 11.9 Оптимистичное обновление ----------
if (want('11.9')) {
  const f = readDir(`${CH}/09-optimistic/solution`);
  const r = await run(f, { url: '/games/1', backend: { latency: 1500 }, waitMs: 3500 });
  await r.requests();
  await sendReview(r.page, 'Сыграли втроём');
  await wait(200);
  const now = await reviewsText(r.page);
  const b = await submitButton(r.page);
  await wait(3500);
  const later = await reviewsText(r.page);
  const reqs = (await r.requests()).filter((x) => x.includes('/reviews'));
  expect(
    now.includes('Гость') &&
      now.includes('Сыграли втроём') &&
      b === 'Отправляем…|true' &&
      later.includes('Сыграли втроём') &&
      JSON.stringify(reqs) === JSON.stringify(['POST /api/games/1/reviews 201', 'GET /api/games/1/reviews 200']),
    `11.9 отзыв в списке через 0,2 с, пока POST идёт ${JSON.stringify(reqs)}`,
  );
  await r.page.close();

  // Ошибка: отзыв появился и исчез, сообщение об ошибке
  const rollback = async (files) => {
    const p = await run(files, { url: '/games/1', backend: { latency: 300 }, waitMs: 1200 });
    await configure(p.page, { latency: 300, failRate: 1 });
    await sendReview(p.page, 'Не дойдёт');
    await wait(150);
    const before = await reviewsText(p.page);
    await wait(1200);
    const after = await reviewsText(p.page);
    const text = await p.text();
    await p.page.close();
    return {
      before: before.includes('Не дойдёт'),
      after: after.includes('Не дойдёт'),
      error: text.includes('Не удалось отправить'),
    };
  };
  const rb = await rollback(f);
  expect(rb.before && !rb.after && rb.error, `11.9 ошибка: отзыв появился и исчез ${JSON.stringify(rb)}`);
  const noRollback = edit(
    f,
    'game/ReviewForm.tsx',
    `    onError: (_error, _review, result) => {
      queryClient.setQueryData(queryKey, result?.previous);
    },
`,
    '',
  );
  const nrb = await rollback(noRollback);
  // onSettled с return: мутация ждёт сверки списка — при лежащем сервере ~8 с повторов
  const withReturn = edit(
    f,
    'game/ReviewForm.tsx',
    `    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },`,
    `    onSettled: () => queryClient.invalidateQueries({ queryKey }),`,
  );
  const wr = await rollback(withReturn);
  expect(
    wr.before && !wr.after && !wr.error,
    `11.9 onSettled с return: через 1,2 с ошибки ещё нет ${JSON.stringify(wr)}`,
  );
  expect(nrb.before && nrb.after && nrb.error, `11.9 без onError: отзыв остался в списке ${JSON.stringify(nrb)}`);

  // Ключ без типа: gameKeys.reviews — list неизвестного типа
  const untyped = edit(
    edit(
      f,
      'game/ReviewForm.tsx',
      '  const { queryKey } = reviewsQuery(gameId);',
      '  const queryKey = gameKeys.reviews(gameId);',
    ),
    'game/ReviewForm.tsx',
    "import { postReview, reviewsQuery } from '../api/games';",
    "import { gameKeys, postReview } from '../api/games';",
  );
  const errs = typeErrors(untyped);
  expect(
    errs.length === 1 &&
      errs[0].includes("TS2488: Type 'unknown' must have a '[Symbol.iterator]()' method that returns an iterator."),
    `11.9 ключ без типа — TS2488 ${JSON.stringify(errs)}`,
  );
}

// ---------- 11.10 Бесконечный список ----------
const cards = (page) => page.$$eval('main article', (as) => as.length);
const clickLoadMore = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('main button')].find((b) => b.textContent.trim() === 'Показать ещё')?.click(),
  );
if (want('11.10')) {
  const f = readDir(`${CH}/10-infinite/solution`);
  const r = await run(f, { url: '/catalog', backend: { latency: 300 }, waitMs: 1200 });
  const n1 = await cards(r.page);
  await r.requests();
  await clickLoadMore(r.page);
  await wait(700);
  const n2 = await cards(r.page);
  const reqs = await r.requests();
  expect(
    n1 === 6 && n2 === 12 && JSON.stringify(reqs) === JSON.stringify(['GET /api/games?page=2&size=6 200']),
    `11.10 6 → 12 карточек, запрос page=2 ${JSON.stringify(reqs)}`,
  );
  // Прокрутка до конца — порция сама
  await r.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await wait(900);
  const n3 = await cards(r.page);
  expect(n3 === 18, `11.10 прокрутка до конца — ещё порция (${n3})`);
  // До конца каталога: 40 игр — 7 порций, кнопка исчезает
  for (let i = 0; i < 6; i++) {
    await clickLoadMore(r.page);
    await wait(500);
  }
  const all = await cards(r.page);
  const btn = await r.page.evaluate(() =>
    [...document.querySelectorAll('main button')].some((b) => b.textContent.trim() === 'Показать ещё'),
  );
  expect(all === 40 && !btn, `11.10 все 40, «Показать ещё» нет (${all})`);
  // В игру и обратно (данные свежие) — все 40 сразу, без запросов
  await clickLink(r.page, 'Остров сокровищ', 900);
  await r.requests();
  await r.page.evaluate(() => history.back());
  await wait(500);
  const backN = await cards(r.page);
  const backReqs = (await r.requests()).filter((x) => x.includes('size=6'));
  expect(backN === 40 && backReqs.length === 0, `11.10 назад — 40 карточек из кэша ${JSON.stringify(backReqs)}`);
  const lines = (await r.fresh()).filter((l) => !l.includes('[аналитика]'));
  expect(lines.length === 0, `11.10 консоль без ошибок ${JSON.stringify(lines)}`);
  await r.page.close();

  // Без защиты: второй щелчок отменяет идущую порцию
  const noGuard = edit(
    f,
    'catalog/CatalogPage.tsx',
    '    if (!catalog.isFetchingNextPage) catalog.fetchNextPage();',
    '    catalog.fetchNextPage();',
  );
  for (const [name, files] of [
    ['с защитой', f],
    ['без защиты', noGuard],
  ]) {
    const g = await run(files, { url: '/catalog', backend: { latency: 600 }, waitMs: 1500 });
    await g.requests();
    await clickLoadMore(g.page);
    await wait(200);
    await clickLoadMore(g.page);
    await wait(1200);
    const gr = await g.requests();
    const n = await cards(g.page);
    console.log(`   ${name}:`, gr, n);
    if (name === 'без защиты')
      expect(
        gr.includes('GET /api/games?page=2&size=6 canceled') && n === 12,
        `11.10 без защиты: первый запрос порции отменён ${JSON.stringify(gr)}`,
      );
    else
      expect(
        JSON.stringify(gr) === JSON.stringify(['GET /api/games?page=2&size=6 200']) && n === 12,
        `11.10 с защитой: один запрос ${JSON.stringify(gr)}`,
      );
    await g.page.close();
  }

  // Общий ключ с шапкой: у useQuery и useInfiniteQuery разная форма данных
  const sameKey = edit(
    f,
    'api/games.ts',
    '    queryKey: gameKeys.infinite(params),',
    '    queryKey: gameKeys.list(params),',
  );
  const sk = await run(sameKey, { url: '/catalog', backend: { latency: 300 }, waitMs: 1500 });
  const skLines = await sk.fresh();
  const skText = await sk.text();
  expect(
    skText.includes('в каталоге undefined игр') && skLines.length === 0 && typeErrors(sameKey).length === 0,
    `11.10 общий ключ с шапкой: «в каталоге undefined игр», консоль и типы молчат (${skText.slice(0, 80)})`,
  );
  await sk.page.close();
}

// ---------- 11.11 Под капотом: стенд из текста урока ----------
if (want('11.11')) {
  const md = readFileSync(`${CH}/11-under-the-hood/lesson.md`, 'utf8');
  const stand = md.match(/```tsx main\.tsx\n([\s\S]*?)```/)[1];
  // Блоки кода без языка — по строкам: ограда открывает и закрывает блок
  const blocks = [];
  let open = null;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) {
      if (open) {
        blocks.push(open);
        open = null;
      } else open = [];
    } else if (open) open.push(line);
  }
  const startLog = blocks.find((b) => b[0].startsWith('added '));
  const refetchLog = blocks.find((b) => b[0].startsWith('updated: fetch'));
  const base = readDir(`${CH}/10-infinite/solution`);
  const withStand = (files) => {
    let f = edit(
      files,
      'main.tsx',
      "import { queryClient } from './api/queryClient';",
      "import { gamesQuery } from './api/games';\nimport { queryClient } from './api/queryClient';",
    );
    f = { ...f, 'main.tsx': f['main.tsx'] + '\n' + stand };
    return edit(
      f,
      'layout/Header.tsx',
      'export function Header() {\n',
      "export function Header() {\n  console.log('render Header');\n",
    );
  };
  const standRun = async (files) => {
    const r = await run(files, { url: '/catalog', backend: { latency: 300 }, waitMs: 1900 });
    const early = logLines(await r.fresh());
    await wait(1200);
    const late = logLines(await r.fresh());
    await r.page.close();
    return { early, late };
  };
  const plain = await standRun(withStand(base));
  const earlyNoRender = plain.early.filter((l) => l !== 'render Header');
  expect(
    JSON.stringify(earlyNoRender) === JSON.stringify(startLog),
    `11.11 лог запуска совпадает с текстом ${JSON.stringify(earlyNoRender)}`,
  );
  expect(
    JSON.stringify(plain.late) === JSON.stringify(refetchLog),
    `11.11 лог перезапроса совпадает с текстом, без render Header ${JSON.stringify(plain.late)}`,
  );
  const noSharing = await standRun(
    withStand(
      edit(
        base,
        'api/queryClient.ts',
        'queries: { staleTime: STALE_TIME }',
        'queries: { staleTime: STALE_TIME, structuralSharing: false }',
      ),
    ),
  );
  expect(
    noSharing.late.includes('тот же объект: false') && noSharing.late.filter((l) => l === 'render Header').length === 2,
    `11.11 structuralSharing: false — новый объект, 2 рендера шапки ${JSON.stringify(noSharing.late)}`,
  );
  const allProps = await standRun(
    withStand(
      edit(
        base,
        'layout/Header.tsx',
        "useQuery(gamesQuery(''))",
        "useQuery({ ...gamesQuery(''), notifyOnChangeProps: 'all' })",
      ),
    ),
  );
  const firstSuccess = allProps.late.indexOf('updated: success ["games","list",""]');
  expect(
    allProps.late.filter((l) => l === 'render Header').length === 4 &&
      allProps.late.slice(0, firstSuccess).filter((l) => l === 'render Header').length === 2,
    `11.11 notifyOnChangeProps: 'all' — 4 рендера, 2 до ответа ${JSON.stringify(allProps.late)}`,
  );
  // hashKey: порядок ключей объекта не важен
  const hk = await run(
    {
      'main.tsx':
        "import { hashKey } from '@tanstack/react-query';\nconsole.log(hashKey(['games', { a: 1, b: 2 }]) === hashKey(['games', { b: 2, a: 1 }]), hashKey(['a', 'b']) === hashKey(['b', 'a']));\n",
    },
    { waitMs: 500 },
  );
  expect(
    logLines(await hk.fresh()).includes('true false'),
    '11.11 hashKey: порядок ключей объекта не важен, порядок массива важен',
  );
  await hk.page.close();
}

// ---------- 11.12 Практикум ----------
if (want('11.12')) {
  const f = readDir(`${CH}/12-practice/solution`);
  const r = await run(f, { url: '/', backend: { latency: 300 }, waitMs: 1200 });
  const home = await r.text();
  const reqs = await r.requests();
  expect(
    home.includes('Хиты 11') &&
      (await cardTitles(r.page)).slice(0, 2).join('|') === 'Шахматы «Классика»|Глубокий космос' &&
      (await cards(r.page)) === 6 &&
      reqs.includes('GET /api/games?rating=4.6&sort=rating&size=6 200'),
    `11.12 главная: «Хиты 11», 6 карточек, запрос хитов ${JSON.stringify(reqs)}`,
  );
  await clickLink(r.page, 'Весь каталог →', 900);
  expect(
    (await appUrl(r.page)) === '/catalog?sort=rating' &&
      (await r.page.$$eval('select', (ss) => ss[1].value)) === 'rating',
    '11.12 «Весь каталог →» — по рейтингу',
  );
  // Избранное: «Северный путь»
  await navigate(r.page, '/catalog?q=север', 900);
  await r.page.evaluate(() => {
    const card = [...document.querySelectorAll('main article')].find((a) => a.textContent.includes('Северный путь'));
    card.querySelector('button[aria-label="В избранное"]').click();
  });
  await wait(200);
  await r.requests();
  await clickLink(r.page, '♥ 1', 900);
  const fav = await r.text();
  const favReqs = await r.requests();
  expect(
    fav.includes('Северный путь') && favReqs.includes('GET /api/games/13 200'),
    `11.12 избранное: «Северный путь», запрос игры 13 ${JSON.stringify(favReqs)}`,
  );
  await clickLink(r.page, 'Северный путь', 900);
  await r.requests();
  await r.page.evaluate(() => history.back());
  await wait(600);
  const back = (await r.requests()).filter((x) => x.includes('/api/games/13'));
  expect(
    back.length === 0 && (await r.text()).includes('Северный путь'),
    `11.12 снова в избранном — без запроса ${JSON.stringify(back)}`,
  );
  // Снять сердечко на вкладке — карточка исчезла
  await r.page.evaluate(() => document.querySelector('main button[aria-label="В избранное"]').click());
  await wait(200);
  expect((await r.text()).includes('Здесь будут игры'), '11.12 сняли сердечко — карточка исчезла');
  const lines = (await r.fresh()).filter((l) => !l.includes('[аналитика]'));
  expect(lines.length === 0, `11.12 консоль без ошибок ${JSON.stringify(lines)}`);
  await r.page.close();
  // Следующая игра: 34 → 35, 40 → 1
  for (const [from, to] of [
    ['/games/34', '/games/35'],
    ['/games/40', '/games/1'],
  ]) {
    const g = await run(f, { url: from, backend: { latency: 0 }, waitMs: 800 });
    await clickLink(g.page, 'Следующая игра →', 600);
    expect((await appUrl(g.page)) === to, `11.12 «Следующая игра →» ${from} → ${to}`);
    await g.page.close();
  }
  // Сервер лежит: хиты — «Загружаем хиты…», затем ошибка
  const down = await run(f, { url: '/', backend: { latency: 300, failRate: 1 }, waitMs: 1500 });
  const d1 = await down.text();
  await wait(7500);
  const d2 = await down.text();
  expect(
    d1.includes('Загружаем хиты…') && d2.includes('Не удалось загрузить хиты.'),
    '11.12 ошибка 500: «Загружаем хиты…», потом «Не удалось загрузить хиты.»',
  );
  await down.page.close();
}

await browser.close();
console.log(failures.length ? `\nПровалено: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
