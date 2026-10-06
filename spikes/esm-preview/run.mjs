// Сценарии спайка в headless Chrome. Нужен `npm run serve` (порт 8766) и Chrome (CHROME_PATH).
import puppeteer from 'puppeteer-core';

const BASE = 'http://localhost:8766';
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function open(url, label) {
  console.log(`\n===== ${label} (${url})`);
  const page = await browser.newPage();
  const logs = [];
  page.on('console', (m) => { const t = m.text(); if (t.startsWith('[host]') || t.startsWith('[preview')) { logs.push(t); } });
  page.on('pageerror', (e) => logs.push('[pageerror] ' + e.message));
  page.on('response', (r) => r.status() >= 400 && !r.url().endsWith('favicon.ico') && logs.push(`[http] ${r.status()} ${r.url()}`));
  const t0 = Date.now();
  await page.goto(`${BASE}/index.html?url=${encodeURIComponent(url)}`);
  const frame = await (await page.waitForSelector('#preview')).contentFrame();
  const text = () => frame.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim());
  return { page, frame, logs, text, t0 };
}
const dump = (logs) => { for (const l of logs.splice(0)) console.log('  ', l.slice(0, 400)); };

// 1. Главная: useState, StrictMode, предупреждение про key, ошибка рендера
{
  const { frame, logs, text, t0 } = await open('/', 'Главная: состояние, StrictMode, ошибки');
  await frame.waitForSelector('h1', { timeout: 15000 });
  console.log('first render ms (вкл. компиляцию)', Date.now() - t0);
  console.log('text:', await text());
  await frame.click('#inc'); await frame.click('#inc');
  await wait(100);
  console.log('after 2 clicks:', await text());
  await frame.click('#inc');
  await wait(300);
  console.log('after 3rd click (Boom):', (await text()).slice(0, 200));
  dump(logs);
}

// 2. Каталог: react-query + перехват fetch + zustand + CSS Modules + клиентская навигация
{
  const { frame, logs, text, page } = await open('/catalog', 'Каталог: Query, Zustand, CSS Modules');
  await page.evaluate(() => 0);
  await frame.waitForSelector('.add', { timeout: 15000 });
  await frame.evaluate(() => localStorage.removeItem('cart'));
  const buttons = await frame.$$('.add');
  await buttons[0].click(); await buttons[1].click();
  await wait(100);
  console.log('text:', await text());
  console.log('li class / color:', await frame.evaluate(() => { const li = document.querySelector('li'); return `${li.className} / ${getComputedStyle(li).color}`; }));
  console.log('css module:', await frame.evaluate(() => document.querySelector('style[data-file="Catalog.module.css"]').textContent));
  // Клиентский переход по Link
  await frame.click('a[href="/games/2"]');
  await frame.waitForSelector('#game-title', { timeout: 5000 });
  console.log('after Link click:', await frame.evaluate(() => location.pathname), '|', await frame.$eval('#game-title', (e) => e.textContent));
  dump(logs);
}

// 3. Прямой заход на /games/3: loader
{
  const { frame, logs } = await open('/games/3', 'Игра: loader');
  await frame.waitForSelector('#game-title', { timeout: 15000 });
  console.log('title:', await frame.$eval('#game-title', (e) => e.textContent));
  dump(logs);
}

// 4. Админка: lazy-маршрут + antd
{
  const { frame, logs, t0 } = await open('/admin', 'Админка: lazy + antd');
  await frame.waitForSelector('#antd-btn', { timeout: 30000 });
  console.log('antd first render ms', Date.now() - t0);
  await frame.click('#antd-btn');
  await wait(500);
  console.log('message:', await frame.evaluate(() => document.querySelector('.ant-message')?.innerText));
  console.log('btn bg:', await frame.$eval('#antd-btn', (e) => getComputedStyle(e).backgroundColor));
  console.log('datepicker:', await frame.$eval('#dp', (e) => e.value));
  console.log('pagination:', await frame.evaluate(() => document.querySelector('.ant-pagination')?.innerText.replace(/\s+/g, ' ')));
  console.log('style tags:', await frame.evaluate(() => document.querySelectorAll('style').length));
  console.log('react instances (hook):', await frame.evaluate(() => typeof window.__REACT_DEVTOOLS_GLOBAL_HOOK__));
  dump(logs);
}

await browser.close();
