// Запускает код из папки шага в чистом превью: печатает консоль, запросы к бэкенду, текст страницы
// и сохраняет скриншот.
// node tools/e2e/run-dir.mjs content/01-first-app/01-what-is-react/start [адрес=/] [ждатьМс=2000]
import { basename, dirname, resolve } from 'node:path';
import { appUrl, compileDir, launch, openPreview, OUT, pageText, ROOT } from './lib.mjs';

const [dirArg, url = '/', waitMs = '2000'] = process.argv.slice(2);
if (!dirArg) {
  console.error('Использование: node tools/e2e/run-dir.mjs <папка шага> [адрес] [ждатьМс]');
  process.exit(1);
}
const dir = resolve(ROOT, dirArg);
const browser = await launch();
const { page, logs } = await openPreview(browser, compileDir(dir), { url, waitMs: Number(waitMs) });
const shot = `${OUT}/${basename(dirname(dir))}-${basename(dir)}.png`;
await page.screenshot({ path: shot });
for (const line of logs) console.log(line);
console.log(`[url] ${await appUrl(page)}`);
console.log(`[text] ${await pageText(page)}`);
console.log(`скриншот: ${shot}`);
await browser.close();
