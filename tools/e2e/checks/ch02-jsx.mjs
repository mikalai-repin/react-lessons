// Проверка утверждений и экспериментов главы 2 «JSX и разметка»: каждый эксперимент из текста — на коде
// того шага, о котором текст. node tools/e2e/checks/ch02-jsx.mjs (нужен npm run dev)
import { CONTENT, launch, openPreview, compileMap, pageText, readDir, wait } from '../lib.mjs';

const CH = `${CONTENT}/02-jsx`;
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
  const text = compiled.errors.length ? '' : (await pageText(result.page)).replace(/ /g, ' ');
  return { ...result, compiled, text };
};
const logged = (logs, text) => logs.some((l) => l === `[preview:log] ${text}`);
const count = (page, selector) => page.$$eval(selector, (els) => els.length);

// ---------- 2.1 Выражения ----------
const s1 = readDir(`${CH}/01-expressions/solution`);
{
  const r = await run(s1);
  expect(
    r.text === '♞ Ход конём Магазин настольных игр · в каталоге 6 игр Остров сокровищ 1 990 ₽ Игроков: 2–5 · 45 мин',
    `2.1 решение: «${r.text}»`,
  );
}
{
  const r = await run(
    edit(
      s1,
      'App.tsx',
      '</article>',
      '<p id="t">[{0}][{null}][{undefined}][{false}][{true}][{\'\'}][{NaN}][{[1, 2, 3]}]</p></article>',
    ),
  );
  const t = await r.page.$eval('#t', (p) => p.textContent);
  expect(t === '[0][][][][][][NaN][123]', `2.1 что рисуется: ${t}`);
}
{
  const r = await run(edit(s1, 'App.tsx', '{game.title}</h2>', '{game.players}</h2>'));
  expect(
    r.text === '' &&
      has(
        r.logs,
        'Objects are not valid as a React child (found: object with keys {min, max}). If you meant to render a collection of children, use an array instead.',
      ),
    '2.1 объект в {}: ошибка рендера, превью пустое',
  );
}
{
  const r = await run(
    edit(s1, 'App.tsx', '{formatPrice(game.price)}', '{if (game.price > 0) formatPrice(game.price)}'),
  );
  expect(
    r.compiled.errors[0] === 'App.tsx:18 — Expression expected.' && r.compiled.errors.length === 3,
    `2.1 if в {}: три ошибки сборки ${JSON.stringify(r.compiled.errors)}`,
  );
}
{
  const r = await run(edit(s1, 'App.tsx', " ·{' '}", ' ·'));
  expect(r.text.includes('·45 мин'), "2.1 без {' '}: пробел пропал");
}

// ---------- 2.2 Атрибуты ----------
const s2 = readDir(`${CH}/02-attributes/solution`);
{
  const r = await run(
    append(s2, 'App.tsx', "setTimeout(() => console.log(document.querySelector('article')?.outerHTML), 100);"),
  );
  const html = preview(r.logs).find((l) => l.startsWith('[preview:log] <article')) ?? '';
  expect(
    html.includes('data-category="family"') &&
      html.includes('aria-label="Рейтинг 4.6 из 5"') &&
      html.includes('style="width: 92%;"') &&
      /class="App_card_\w+"/.test(html) &&
      html.includes('src="/assets/covers/treasure-island.svg"'),
    '2.2 outerHTML: class, data-category, aria-label, style 92%',
  );
}
{
  const r = await run(
    edit(s2, 'App.tsx', '<p className="muted">\n        Магазин', '<p class="muted">\n        Магазин'),
  );
  const cls = await r.page.$eval('main > p', (p) => p.getAttribute('class'));
  expect(
    cls === 'muted' && has(r.logs, 'Invalid DOM property `class`. Did you mean `className`?'),
    '2.2 class вместо className: работает, но ошибка в консоли',
  );
}
{
  const r = await run(edit(s2, 'App.tsx', /style=\{\{[\s\S]*?\}\}/.exec(s2['App.tsx'])[0], 'style="width: 50%"'));
  expect(
    r.text === '' &&
      has(
        r.logs,
        "The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + 'em'}} when using JSX.",
      ),
    '2.2 style строкой: ошибка рендера',
  );
}
{
  const r = await run(edit(s2, 'App.tsx', 'alt={game.title}\n        />', 'alt={game.title}\n        >'));
  expect(
    r.compiled.errors.includes("App.tsx:21 — JSX element 'img' has no corresponding closing tag."),
    `2.2 незакрытый <img>: ${JSON.stringify(r.compiled.errors)}`,
  );
}
{
  const r = await run(
    append(
      edit(
        edit(s2, 'App.tsx', 'src={game.cover}', 'src="{game.cover}"'),
        'App.tsx',
        '<h2 className={styles.cardTitle}>',
        '<h2 className={styles.cardTitle} style={{ marginTop: 4, lineHeight: 1.5, opacity: 0.9 }}>',
      ),
      'App.tsx',
      "setTimeout(() => { console.log(document.querySelector('h2')?.getAttribute('style')); console.log(new URL(document.querySelector('img')!.src).pathname); }, 100);",
    ),
  );
  expect(
    logged(r.logs, 'margin-top: 4px; line-height: 1.5; opacity: 0.9;') && logged(r.logs, '/%7Bgame.cover%7D'),
    '2.2 числа в style → px (кроме безразмерных); src="{…}" — строка',
  );
}

// ---------- 2.3 Условный рендер ----------
const s3 = readDir(`${CH}/03-conditional/solution`);
{
  const r = await run(s3);
  expect(r.text.includes('1 990 ₽2 490 ₽') && r.text.endsWith('В корзину'), `2.3 решение: «${r.text}»`);
}
{
  const r = await run(edit(s3, 'App.tsx', 'FEATURED_ID = 1', 'FEATURED_ID = 7'));
  expect(
    r.text.includes('Маяк 2 190 ₽ Игроков') &&
      r.text.endsWith('Нет в наличии') &&
      (await count(r.page, 'button')) === 0,
    '2.3 FEATURED_ID = 7: «Нет в наличии», без старой цены и кнопки',
  );
}
{
  const r = await run(edit(s3, 'App.tsx', 'FEATURED_ID = 1', 'FEATURED_ID = 99'));
  expect(r.text === 'Игра не найдена', `2.3 FEATURED_ID = 99: «${r.text}»`);
}
{
  const trap = edit(
    edit(s3, 'App.tsx', 'FEATURED_ID = 1', 'FEATURED_ID = 7'),
    'App.tsx',
    '        {soldOut ? (',
    '        {game.inStock && <p>На складе: {game.inStock} шт.</p>}\n        {soldOut ? (',
  );
  const r = await run(trap);
  expect(r.text.endsWith('50 мин 0 Нет в наличии'), `2.3 ловушка && с нулём: «${r.text.slice(-30)}»`);
  const fixed = await run(edit(trap, 'App.tsx', '{game.inStock &&', '{game.inStock > 0 &&'));
  expect(fixed.text.endsWith('50 мин Нет в наличии'), '2.3 inStock > 0: ноль пропал');
}

// ---------- 2.4 Списки ----------
const s4 = readDir(`${CH}/04-lists/solution`);
{
  const r = await run(s4);
  expect(
    (await count(r.page, 'article')) === 6 && preview(r.logs).length === 0 && r.text.includes('Игроков: 2–2'),
    '2.4 решение: 6 карточек, консоль чистая, у «Нард» «2–2»',
  );
}
{
  const r = await run(edit(s4, 'App.tsx', '            key={game.id}\n', ''));
  const warning =
    preview(r.logs).find((l) => l.includes('Each child in a list should have a unique "key" prop.')) ?? '';
  expect(
    warning.includes(
      'Check the render method of `App`. See https://react.dev/link/warning-keys for more information.',
    ) &&
      warning.includes('at App.tsx:17:11') &&
      (await count(r.page, 'article')) === 6,
    '2.4 без key: предупреждение со ссылкой на App.tsx:17:11',
  );
}
{
  const r = await run(edit(s4, 'App.tsx', 'key={game.id}', 'key={game.category}'));
  expect(
    has(
      r.logs,
      'Encountered two children with the same key, `family`. Keys should be unique so that components maintain their identity across updates. Non-unique keys may cause children to be duplicated and/or omitted — the behavior is unsupported and could change in a future version.',
    ),
    '2.4 неуникальный ключ: ошибка «same key, family»',
  );
}
{
  const r = await run(edit(s4, 'App.tsx', '{games.map(', '{games.filter((game) => game.inStock > 0).map('));
  expect((await count(r.page, 'article')) === 5 && !r.text.includes('Маяк'), '2.4 filter: 5 карточек без «Маяка»');
}

// ---------- 2.5 Фрагменты ----------
const s5 = readDir(`${CH}/05-fragments/solution`);
{
  const r = await run(
    append(
      s5,
      'App.tsx',
      "setTimeout(() => console.log([...document.getElementById('root')!.children].map((el) => el.tagName)), 100);",
    ),
  );
  const dl = await r.page.$eval('dl', (d) => [...d.children].map((c) => c.tagName).join(','));
  expect(
    logged(r.logs, '["HEADER", "MAIN"]') &&
      dl === 'DT,DD,DT,DD,DT,DD' &&
      r.text.includes('Нарды 2 590 ₽2 990 ₽ Игроки 2 Время'),
    `2.5 решение: корень HEADER, MAIN; dl: ${dl}; у «Нард» «Игроки 2»`,
  );
}
{
  const r = await run(
    edit(
      edit(s5, 'App.tsx', '<Fragment key={spec.label}>', '<div key={spec.label}>'),
      'App.tsx',
      '</Fragment>',
      '</div>',
    ),
  );
  const box = await r.page.$$eval('dl:first-of-type dt', (dts) =>
    dts.map((d) => Math.round(d.getBoundingClientRect().top)),
  );
  expect(box[0] === box[1] && box[2] > box[0], `2.5 div вместо Fragment: «Игроки» и «Время» в одной строке ${box}`);
}
{
  const r = await run(edit(edit(s5, 'App.tsx', '<Fragment key={spec.label}>', '<>'), 'App.tsx', '</Fragment>', '</>'));
  expect(
    has(r.logs, 'Each child in a list should have a unique "key" prop.'),
    '2.5 <> в списке: предупреждение про key',
  );
}
{
  const r = await run(edit(edit(s5, 'App.tsx', '    <>\n', ''), 'App.tsx', '    </>\n', ''));
  expect(
    r.compiled.errors.includes('App.tsx:10 — JSX expressions must have one parent element.'),
    `2.5 без <>: ${JSON.stringify(r.compiled.errors)}`,
  );
}

// ---------- 2.6 Безопасность ----------
const s6 = readDir(`${CH}/06-security/solution`);
const PROMO = /<p\n\s*className=\{styles.promo\}\n\s*dangerouslySetInnerHTML=\{\{ __html: PROMO_HTML \}\}\n\s*\/>/;
{
  const r = await run(s6);
  const b = await r.page.$eval('main p b', (b) => b.textContent);
  expect(b === '20%' && preview(r.logs).length === 0, '2.6 решение: «20%» жирным, консоль чистая');
}
{
  const r = await run(
    append(
      edit(s6, 'App.tsx', PROMO.exec(s6['App.tsx'])[0], '<p className={styles.promo}>{PROMO_HTML}</p>'),
      'App.tsx',
      "setTimeout(() => console.log(document.querySelector('main p')?.innerHTML), 100);",
    ),
  );
  expect(
    r.text.includes('скидки до <b>20%</b> на') && preview(r.logs).some((l) => l.includes('&lt;b&gt;20%&lt;/b&gt;')),
    '2.6 {PROMO_HTML}: теги текстом, в innerHTML &lt;b&gt;',
  );
}
{
  const r = await run(
    edit(
      s6,
      'App.tsx',
      "«Нарды»';",
      `«Нарды» <img src="x" onerror="console.log(\\'XSS: чужой код выполнен\\')"><script>console.log(\\'XSS из script\\')</script>';`,
    ),
  );
  expect(
    logged(r.logs, 'XSS: чужой код выполнен') && !preview(r.logs).some((l) => l.includes('XSS из script')),
    '2.6 onerror выполнился, <script> — нет',
  );
}
{
  const r = await run(
    edit(
      s6,
      'App.tsx',
      'dangerouslySetInnerHTML={{ __html: PROMO_HTML }}\n        />',
      'dangerouslySetInnerHTML={{ __html: PROMO_HTML }}\n        >Акция</p>',
    ),
  );
  expect(
    r.text === '' && has(r.logs, 'Can only set one of `children` or `props.dangerouslySetInnerHTML`.'),
    '2.6 children и dangerouslySetInnerHTML: ошибка',
  );
}
{
  const r = await run(
    edit(
      s6,
      'App.tsx',
      '        <div className="grid">',
      `        <a id="rules" href={"javascript:console.log('XSS из ссылки')"}>Правила акции</a>\n        <div className="grid">`,
    ),
  );
  const href = await r.page.$eval('#rules', (a) => a.getAttribute('href'));
  await r.page.click('#rules');
  await wait(300);
  const logs = [...r.logs, ...(await r.page.evaluate(() => window.__console.splice(0)))];
  const errors = await r.page.evaluate(() => window.__runtimeErrors.splice(0));
  expect(
    href === "javascript:throw new Error('React has blocked a javascript: URL as a security precaution.')" &&
      !logs.some((l) => l.includes('XSS из ссылки')) &&
      errors.some((e) => e.includes('React has blocked a javascript: URL as a security precaution.')),
    '2.6 javascript: в href заблокирован, щелчок — ошибка',
  );
}
{
  const r = await run(
    edit(
      s6,
      'App.tsx',
      "«Нарды»';",
      `«Нарды» <a id="rules" href="javascript:console.log(\\'XSS из ссылки в HTML\\')">Правила</a>';`,
    ),
  );
  await r.page.click('#rules');
  await wait(300);
  const logs = await r.page.evaluate(() => window.__console.splice(0));
  expect(
    logs.includes('[preview:log] XSS из ссылки в HTML'),
    '2.6 javascript: внутри dangerouslySetInnerHTML выполняется',
  );
}

// ---------- 2.7 Под капотом: почему key ----------
const s7 = readDir(`${CH}/07-keys/start`);
const flip = async (files) => {
  const r = await run(files);
  await r.page.type('li input', 'купить к Новому году');
  await r.page.evaluate(() => {
    window.__m = { moved: 0, text: 0 };
    new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === 'characterData') window.__m.text++;
        else window.__m.moved += m.addedNodes.length;
      }
    }).observe(document.querySelector('ol'), { childList: true, characterData: true, subtree: true });
  });
  await r.page.click('button');
  await wait(300);
  return r.page.evaluate(() => ({
    rows: [...document.querySelectorAll('li')].map(
      (li) => `${li.textContent.trim()}|${li.querySelector('input').value}`,
    ),
    m: window.__m,
  }));
};
{
  const { rows, m } = await flip(s7);
  expect(
    rows[0] === 'Маяк|купить к Новому году' && rows[3] === 'Остров сокровищ|' && m.text === 4 && m.moved === 0,
    `2.7 key={index}: заметка у «Маяка», 4 замены текста ${JSON.stringify({ rows, m })}`,
  );
}
{
  const { rows, m } = await flip(edit(s7, 'KeyDemo.tsx', 'key={index}', 'key={game.id}'));
  expect(
    rows[3] === 'Остров сокровищ|купить к Новому году' && m.text === 0 && m.moved === 3,
    `2.7 key={game.id}: заметка уехала с игрой, 3 перестановки ${JSON.stringify(m)}`,
  );
}
{
  const { rows, m } = await flip(edit(s7, 'KeyDemo.tsx', 'key={index}', 'key={Math.random()}'));
  expect(
    rows.every((r) => r.endsWith('|')) && m.moved === 4,
    `2.7 Math.random(): все строки пересозданы ${JSON.stringify(m)}`,
  );
}

// ---------- 2.8 Практикум ----------
const s8start = readDir(`${CH}/08-practice/start`);
const s8 = readDir(`${CH}/08-practice/solution`);
{
  const r = await run(s8start);
  expect(
    (s8start['App.tsx'].match(/TODO/g) ?? []).length === 4 &&
      (await count(r.page, 'article')) === 6 &&
      preview(r.logs).length === 0,
    '2.8 старт: 4 TODO, 6 карточек, консоль чистая',
  );
}
{
  const r = await run(s8);
  const badges = await r.page.$$eval('article', (as) =>
    as.map((a) => [...a.querySelectorAll('span')].map((s) => s.textContent).join(' ')),
  );
  expect(
    JSON.stringify(badges) === JSON.stringify(['−20% Хит', '', '−11% Хит Осталось 3 шт.', '', '−13% Хит', '']) &&
      r.text.includes('#пираты #карты') &&
      preview(r.logs).length === 0,
    `2.8 решение: бейджи ${JSON.stringify(badges)}`,
  );
}
{
  const r = await run(edit(s8, 'App.tsx', '{discount > 0 && (', '{discount && ('));
  const zeros = await r.page.$$eval(
    'article',
    (as) => as.filter((a) => a.querySelector('div > div')?.textContent?.startsWith('0')).length,
  );
  expect(zeros === 3, `2.8 {discount && …}: «0» на трёх обложках (${zeros})`);
}

await browser.close();
console.log(failures.length ? `\nНе прошло: ${failures.length}` : '\nВсё прошло');
process.exit(failures.length ? 1 : 0);
