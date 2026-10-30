// Проверка среды превью на демо-магазине шага 1.1: роутер в iframe (в корне адреса, без basename), loader,
// учебный бэкенд и отмена запросов, Zustand + persist, CSS Modules, <title> из компонента, ошибки рендера.
// node tools/e2e/checks/preview.mjs
import {
  appUrl,
  collect,
  compileDir,
  compileMap,
  CONTENT,
  launch,
  navigate,
  openPreview,
  pageText,
  readDir,
  wait,
} from '../lib.mjs';

const browser = await launch();
const failures = [];
const expect = (ok, message) => {
  console.log(`${ok ? '✓' : '✗'} ${message}`);
  if (!ok) failures.push(message);
};

const DEMO = `${CONTENT}/01-first-app/01-what-is-react/start`;
const compiled = compileDir(DEMO);
expect(compiled.errors.length === 0, `сборка без ошибок ${JSON.stringify(compiled.errors)}`);

// Задержка 400 мс: поиск по буквам должен отменять устаревшие запросы
const { page, logs, network } = await openPreview(browser, compiled, { backend: { latency: 400 }, waitMs: 1500 });
expect(
  (await pageText(page)).includes('Найдено игр: 40'),
  'каталог загружен: 40 игр (TanStack Query + учебный бэкенд)',
);
expect((await page.title()) === 'Каталог — Ход конём', `<title> из компонента попал в <head>: ${await page.title()}`);
const header = await page.$eval('header', (e) => `${e.className} ${getComputedStyle(e).display}`);
expect(/^Layout_header_\w+ flex$/.test(header), `CSS Modules: класс переименован и стиль применён (${header})`);

await page.type('.search', 'шах', { delay: 50 });
await wait(1200);
await collect(page, logs, network);
const searches = network.filter((e) => e.url.startsWith('/api/games?q=%D1'));
expect(
  searches.some((e) => e.status === 'canceled'),
  `устаревшие запросы поиска отменены: ${searches.map((e) => e.status).join(', ')}`,
);
expect((await pageText(page)).includes('Найдено игр: 1'), 'поиск «шах» нашёл одну игру');

await page.click('article a');
await wait(800);
expect((await appUrl(page)) === '/games/8', `переход по Link в карточке: ${await appUrl(page)}`);
expect((await pageText(page)).includes('Деревянные шахматы'), 'страница игры загружена loader-ом по :id');

await page.click('.button');
await page.click('.button');
await wait(100);
expect((await pageText(page)).includes('Корзина (2)'), 'счётчик корзины в шапке = 2 (Zustand)');

await navigate(page, '/cart', 800);
const cartText = await pageText(page);
expect(
  cartText.includes('Шахматы «Классика» × 2') && cartText.includes('Итого: 5980'),
  'корзина открылась через адресную строку',
);
expect(
  (await page.evaluate(() => localStorage.getItem('hod-konem-cart')))?.includes('"quantity":2'),
  'корзина сохранена в localStorage (persist)',
);

await navigate(page, '/nope', 500);
expect((await pageText(page)).includes('Нет такой страницы'), 'адрес /nope → 404');

await page.evaluate(() => window.postMessage({ type: 'history', delta: -1 }, '*'));
await wait(500);
expect((await appUrl(page)) === '/cart', `назад по истории: ${await appUrl(page)}`);

await collect(page, logs, network);
const problems = logs.filter((l) => /error|pageerror|warn/.test(l));
expect(problems.length === 0, `консоль без ошибок и предупреждений ${JSON.stringify(problems)}`);

// Прямой заход на страницу игры: loader до первого рендера (HydrateFallback), 404 игры
const direct = await openPreview(browser, compiled, { url: '/games/3', waitMs: 800 });
expect((await pageText(direct.page)).includes('Зельевары'), 'прямой заход на /games/3');
const missing = await openPreview(browser, compiled, { url: '/games/999', waitMs: 800 });
expect((await pageText(missing.page)).includes('Игра не найдена'), '/games/999 → «Игра не найдена»');

// Ошибка сервера: useQuery переходит в состояние ошибки, разметка показывает «Повторить»
const failing = await openPreview(browser, compiled, { backend: { latency: 0, failRate: 1 }, waitMs: 1000 });
expect((await pageText(failing.page)).includes('Не удалось загрузить каталог'), 'при ошибке 500 виден текст ошибки');

// Ошибка при рендере: встроенная граница ошибок роутера + сообщение в консоли с файлом исходника
const broken = readDir(DEMO);
broken['NotFound.tsx'] = broken['NotFound.tsx'].replace(
  'export function NotFound() {',
  "export function NotFound() {\n  throw new Error('Бум: ошибка при рендере');",
);
const crash = await openPreview(browser, compileMap(broken), { url: '/nope', waitMs: 800 });
expect(
  (await pageText(crash.page)).includes('Бум: ошибка при рендере'),
  'ошибка рендера показана границей ошибок роутера',
);
expect(
  crash.logs.some((l) => l.startsWith('[preview:error]') && /Бум: ошибка при рендере[\s\S]*NotFound\.tsx:4:/.test(l)),
  `консоль превью: ошибка со строкой исходника NotFound.tsx:4 ${JSON.stringify(crash.logs.filter((l) => l.startsWith('[preview') && l.includes('Бум')).map((l) => l.slice(0, 400)))}`,
);

// Immer и use-immer: один экземпляр immer в vendor (общий чанк), черновик можно менять, результат заморожен
const immerApp = await openPreview(
  browser,
  compileMap({
    'main.tsx': `import { createRoot } from 'react-dom/client';
import { produce } from 'immer';
import { useImmer, useImmerReducer } from 'use-immer';

type Item = { id: number; quantity: number };
type Action = { type: 'add'; id: number };

function reducer(draft: Item[], action: Action) {
  const item = draft.find((i) => i.id === action.id);
  if (item) item.quantity += 1;
  else draft.push({ id: action.id, quantity: 1 });
}

const base = [{ id: 1, quantity: 1 }];
const next = produce(base, (draft) => {
  draft[0].quantity = 5;
});
console.log('produce', base[0].quantity, next[0].quantity, Object.isFrozen(next[0]));

function App() {
  const [items, dispatch] = useImmerReducer(reducer, []);
  const [user, updateUser] = useImmer({ name: 'Аня' });
  return (
    <main>
      <button id="add" onClick={() => dispatch({ type: 'add', id: 7 })}>+</button>
      <button id="rename" onClick={() => updateUser((d) => { d.name = 'Борис'; })}>имя</button>
      <p id="out">{items.map((i) => i.id + ':' + i.quantity).join(',')}|{user.name}</p>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
`,
  }),
  { waitMs: 600 },
);
for (const id of ['add', 'add', 'rename']) {
  await immerApp.page.click(`#${id}`);
  await wait(50);
}
const immerOut = await immerApp.page.$eval('#out', (e) => e.textContent);
expect(immerOut === '7:2|Борис', `useImmerReducer и useImmer обновляют состояние (${immerOut})`);
expect(
  immerApp.logs.some((l) => l.includes('produce 1 5 true')),
  `produce не трогает исходник, результат заморожен ${JSON.stringify(immerApp.logs.slice(0, 5))}`,
);
expect(!immerApp.logs.some((l) => /error|warn/.test(l)), 'Immer: консоль без ошибок');

// Jotai 3: атомы, производный атом, atomWithStorage из jotai/utils — тот же экземпляр React
const jotaiApp = await openPreview(
  browser,
  compileMap({
    'main.tsx': `import { createRoot } from 'react-dom/client';
import { atom, useAtom, useAtomValue, useSetAtom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

const countAtom = atom(1);
const doubleAtom = atom((get) => get(countAtom) * 2);
const nameAtom = atomWithStorage('jotai-check', 'Аня');

function App() {
  const [count, setCount] = useAtom(countAtom);
  const double = useAtomValue(doubleAtom);
  const setName = useSetAtom(nameAtom);
  const name = useAtomValue(nameAtom);
  return (
    <main>
      <button id="inc" onClick={() => setCount((c) => c + 1)}>+</button>
      <button id="rename" onClick={() => setName('Борис')}>имя</button>
      <p id="out">{count}:{double}|{name}</p>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
`,
  }),
  { waitMs: 600 },
);
for (const id of ['inc', 'inc', 'rename']) {
  await jotaiApp.page.click(`#${id}`);
  await wait(50);
}
const jotaiOut = await jotaiApp.page.$eval('#out', (e) => e.textContent);
expect(jotaiOut === '3:6|Борис', `Jotai: атом, производный атом и atomWithStorage (${jotaiOut})`);
const jotaiSaved = await jotaiApp.page.evaluate(() => localStorage.getItem('jotai-check'));
expect(jotaiSaved === '"Борис"', `Jotai: atomWithStorage пишет в localStorage (${jotaiSaved})`);
expect(!jotaiApp.logs.some((l) => /error|warn/.test(l)), `Jotai: консоль без ошибок ${JSON.stringify(jotaiApp.logs)}`);

// react-error-boundary 6: граница-класс библиотеки ловит ошибку рендера, resetKeys и resetErrorBoundary сбрасывают её
const boundaryApp = await openPreview(
  browser,
  compileMap({
    'main.tsx': `import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary, useErrorBoundary } from 'react-error-boundary';

function Boom({ id }: { id: number }) {
  if (id === 1) throw new Error('Бум ' + id);
  return <p id="ok">ok {id}</p>;
}

function Later() {
  const { showBoundary } = useErrorBoundary();
  return <button id="later" onClick={() => setTimeout(() => showBoundary(new Error('Позже')))}>позже</button>;
}

function App() {
  const [id, setId] = useState(1);
  return (
    <main>
      <button id="next" onClick={() => setId((n) => n + 1)}>+</button>
      <ErrorBoundary
        resetKeys={[id]}
        fallbackRender={({ error, resetErrorBoundary }) => (
          <p id="fallback">{error instanceof Error ? error.message : '?'}<button id="reset" onClick={resetErrorBoundary}>ещё</button></p>
        )}
      >
        <Boom id={id} />
        <Later />
      </ErrorBoundary>
    </main>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
`,
  }),
  { waitMs: 600 },
);
const boundaryText = async () => boundaryApp.page.$eval('main', (e) => e.textContent);
const caught = await boundaryText();
await boundaryApp.page.click('#next');
await wait(80);
const afterKeys = await boundaryText();
await boundaryApp.page.click('#later');
await wait(120);
const shown = await boundaryText();
await boundaryApp.page.click('#reset');
await wait(80);
const afterReset = await boundaryText();
expect(
  caught.includes('Бум 1') && afterKeys.includes('ok 2') && shown.includes('Позже') && afterReset.includes('ok 2'),
  `react-error-boundary: fallbackRender, resetKeys, showBoundary, resetErrorBoundary (${[caught, afterKeys, shown, afterReset].join(' | ')})`,
);
expect(
  !boundaryApp.logs.some((l) => /Invalid hook call|more than one copy/.test(l)),
  'react-error-boundary: один экземпляр React',
);

await browser.close();
console.log(failures.length ? `\nПровалено: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
