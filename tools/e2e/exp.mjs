// Прогон эксперимента из текста урока со своим сценарием действий:
// node tools/e2e/exp.mjs <папка шага> <абсолютный путь к сценарию.mjs> [адрес=/] [ждатьМс=2000]
// Сценарий — модуль с export default async ({ page, logs, network, wait, navigate, pageText, appUrl, collect }) => {…}
// page — чистое превью 500 × 600 с запущенным приложением; задержка учебного бэкенда — 0 мс.
import { resolve } from 'node:path';
import { appUrl, collect, compileDir, launch, navigate, openPreview, pageText, ROOT, wait } from './lib.mjs';

const [dir, scenario, url = '/', waitMs = '2000'] = process.argv.slice(2);
if (!dir || !scenario) {
  console.error('Использование: node tools/e2e/exp.mjs <папка шага> <сценарий.mjs> [адрес] [ждатьМс]');
  process.exit(1);
}
const browser = await launch();
const { page, logs, network } = await openPreview(browser, compileDir(resolve(ROOT, dir)), {
  url,
  waitMs: Number(waitMs),
});
const mod = await import(resolve(scenario));
await mod.default({
  page,
  logs,
  network,
  wait,
  navigate: (u, ms) => navigate(page, u, ms),
  pageText: () => pageText(page),
  appUrl: () => appUrl(page),
  collect: () => collect(page, logs, network),
});
await collect(page, logs, network);
console.log(logs.join('\n'));
await browser.close();
