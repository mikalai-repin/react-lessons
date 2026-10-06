// Среда выполнения в iframe (упрощённая preview-runtime.js из angular-learn)
import { init, parse } from '/vendor/es-module-lexer.js';

const send = (m) => parent.postMessage({ source: 'react-spike', ...m }, '*');
const blobNames = new Map();
const prettify = (t) => { let s = String(t); for (const [u, n] of blobNames) s = s.split(u).join(n); return s.replace(new RegExp(location.origin + '/vendor/', 'g'), ''); };

for (const level of ['log', 'info', 'warn', 'error']) {
  const original = console[level].bind(console);
  console[level] = (...args) => {
    original(...args);
    // React форматирует предупреждения как printf: '%s' и т. п.
    let text = args.map((a) => (a instanceof Error ? a.stack : typeof a === 'object' ? (() => { try { return JSON.stringify(a); } catch { return String(a); } })() : String(a)));
    if (typeof args[0] === 'string' && /%[sdo]/.test(args[0])) {
      let i = 1;
      text = [args[0].replace(/%[sdo]/g, () => String(args[i++])), ...text.slice(i)];
    }
    // Стек владельцев: React 19 в dev даёт captureOwnerStack() во время рендера
    const owner = level === 'error' && window.__React?.captureOwnerStack?.();
    send({ type: 'console', level, text: prettify(text.join(' ')) + (owner ? '\n[owner stack]' + owner : '') });
  };
}
addEventListener('error', (e) => send({ type: 'error', text: prettify(e.error?.stack || e.message) }));
addEventListener('unhandledrejection', (e) => send({ type: 'error', text: prettify(e.reason?.stack || e.reason) }));

for (const m of ['pushState', 'replaceState']) {
  const o = history[m].bind(history);
  history[m] = (...a) => { o(...a); send({ type: 'url', url: location.pathname + location.search }); };
}

// Учебный бэкенд — заглушка
const GAMES = [{ id: 1, title: 'Остров сокровищ', price: 1990 }, { id: 2, title: 'Драконья почта', price: 1290 }, { id: 3, title: 'Зельевары', price: 2490 }];
const realFetch = fetch.bind(window);
window.fetch = async (input, init) => {
  const req = new Request(input, init);
  const u = new URL(req.url);
  if (u.origin === location.origin && u.pathname.startsWith('/api/')) {
    await new Promise((r) => setTimeout(r, 100));
    send({ type: 'network', text: `${req.method} ${u.pathname}` });
    const m = u.pathname.match(/^\/api\/games\/(\d+)$/);
    const body = m ? GAMES.find((g) => g.id === +m[1]) : GAMES;
    return new Response(JSON.stringify(body), { status: body ? 200 : 404, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};

function resolveFile(files, from, spec) {
  const parts = from.split('/').slice(0, -1);
  for (const p of spec.split('/')) { if (p === '..') parts.pop(); else if (p !== '.' && p) parts.push(p); }
  const path = parts.join('/');
  return [path, `${path}.js`, `${path}/index.js`].find((c) => c in files) ?? null;
}

function link(files, entry) {
  const urls = new Map();
  const build = (file) => {
    if (urls.has(file)) return urls.get(file);
    const code = files[file];
    const [imports] = parse(code, file);
    let linked = code;
    for (const imp of [...imports].sort((a, b) => b.start - a.start)) {
      const spec = imp.specifier;
      if (!spec || !/^\.\.?\//.test(spec)) continue;
      const target = resolveFile(files, file, spec);
      if (!target) throw new Error(`${file}: не найден файл для импорта "${spec}"`);
      const url = build(target);
      linked = linked.slice(0, imp.start) + (imp.type === 'dynamic' ? JSON.stringify(url) : url) + linked.slice(imp.end);
    }
    const name = file.replace(/\.js$/, '');
    const url = URL.createObjectURL(new Blob([`${linked}\n//# sourceURL=${name}`], { type: 'text/javascript' }));
    blobNames.set(url, name);
    urls.set(file, url);
    return url;
  };
  return build(entry);
}

addEventListener('message', async (e) => {
  if (e.data?.type !== 'run') return;
  try {
    // Приложение живёт в корне: адрес iframe подменяется до запуска, роутер читает его без basename
    history.replaceState(null, '', e.data.url);
    await init();
    window.__React = await import('react');
    const t0 = performance.now();
    await import(link(e.data.files, e.data.entry));
    send({ type: 'console', level: 'info', text: `module graph loaded in ${Math.round(performance.now() - t0)} ms` });
  } catch (err) {
    send({ type: 'error', text: prettify(err?.stack || err) });
  }
});
send({ type: 'ready' });
