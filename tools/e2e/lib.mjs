// Общие помощники браузерных проверок курса.
// Нужен запущенный dev-сервер (npm run dev) и установленный Chrome.
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import puppeteer from 'puppeteer-core';
import { compileFiles } from '../../shared/compile-core.js';
import { readStepDir } from '../../scripts/step-files.mjs';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT = resolve(ROOT, 'content');
export const OUT = resolve(ROOT, 'tools/e2e/out');
export const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5190';
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SOURCE = 'react-course-preview';

mkdirSync(OUT, { recursive: true });

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function launch() {
  return puppeteer.launch({ executablePath: CHROME, headless: true });
}

/**
 * Все файлы папки шага (с подпапками): 'store/cartStore.ts' → текст.
 * Путь …/<шаг>/start у шага со startFrom: previous (папки нет) даёт решение предыдущего шага
 */
export function readDir(dir) {
  return readStepDir(dir);
}

/** Компилирует папку шага (start/ или solution/) тем же кодом, что и воркер платформы */
export function compileDir(dir) {
  return compileMap(readDir(dir));
}

/** Компилирует набор файлов из памяти ({ 'main.tsx': '…', 'App.tsx': '…' }) — для экспериментов */
export function compileMap(files) {
  return compileFiles(ts, files);
}

/**
 * Открывает чистую среду превью (без интерфейса платформы) размером 500 × 600 — как превью по умолчанию —
 * и запускает в ней скомпилированный шаг. Возвращает страницу, логи консоли и запросы к учебному бэкенду.
 */
export async function openPreview(
  browser,
  compiled,
  { waitMs = 2000, width = 500, height = 600, url = '/', backend = { latency: 0 } } = {},
) {
  const page = await browser.newPage();
  await page.setViewport({ width, height });
  const logs = compiled.errors.map((e) => `[build-error] ${e}`);
  const network = [];
  page.on('console', (m) => logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`${BASE_URL}/preview.html`, { waitUntil: 'networkidle0' });
  // Чистое состояние: корзина магазина сохраняется в localStorage (persist), а у всех проверок один origin
  await page.evaluate(() => localStorage.clear());
  // В чистом превью «родитель» — само окно: сообщения среды превью приходят сюда же.
  // Ошибки и запросы копим в массивах: через console нельзя — перехваченный console.error сам шлёт сообщение
  await page.evaluate((source) => {
    window.__runtimeErrors = [];
    window.__console = [];
    window.__network = [];
    window.__url = '/';
    window.addEventListener('message', (e) => {
      if (e.data?.source !== source) return;
      if (e.data.type === 'error') window.__runtimeErrors.push(e.data.text);
      // Консоль так, как её видит ученик: с подстановкой %s и стеком владельцев
      if (e.data.type === 'console') window.__console.push(`[preview:${e.data.level}] ${e.data.text}`);
      if (e.data.type === 'network' && e.data.entry.status !== 'pending') window.__network.push(e.data.entry);
      if (e.data.type === 'url') window.__url = e.data.url;
    });
  }, SOURCE);
  await page.evaluate((run) => window.postMessage({ type: 'run', entry: 'main.js', ...run }, '*'), {
    files: compiled.files,
    sources: compiled.sources,
    styles: compiled.styles,
    url,
    backend,
  });
  await wait(waitMs);
  await collect(page, logs, network);
  return { page, logs, network };
}

/**
 * Забирает накопленные ошибки среды и запросы бэкенда в массивы logs и network.
 * В logs: «[error] …» — консоль Chrome как есть, «[preview:error] …» — то, что видит ученик в консоли превью
 */
export async function collect(page, logs, network) {
  logs.push(...(await page.evaluate(() => window.__console.splice(0))));
  for (const text of await page.evaluate(() => window.__runtimeErrors.splice(0))) logs.push(`[runtime-error] ${text}`);
  for (const entry of await page.evaluate(() => window.__network.splice(0))) {
    network.push(entry);
    logs.push(`[network] ${entry.method} ${entry.url} → ${entry.status} (${entry.ms} мс)`);
  }
}

/** Текст страницы превью одной строкой — для проверки результата */
export const pageText = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());

/** Текущий адрес приложения в превью (как в адресной строке) */
export const appUrl = (page) => page.evaluate(() => window.__url);

/** Переход по адресу внутри приложения — как ввод в адресную строку превью */
export async function navigate(page, url, waitMs = 500) {
  await page.evaluate((url) => window.postMessage({ type: 'navigate', url }, '*'), url);
  await wait(waitMs);
}
