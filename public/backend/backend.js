// Учебный бэкенд магазина «Ход конём». Работает внутри iframe превью: preview-runtime.js отдаёт сюда
// все запросы fetch на /api/… (их делают HttpClient, httpResource и обычный fetch в коде ученика).
//
// Данные загружаются из /backend/data/*.json при первом запросе и дальше живут в памяти iframe:
// каждый запуск кода начинается с чистых данных. Маршруты — docs/project-app.md, «Маршруты API».
//
// Настройки (frontmatter шага `backend:` и вкладка «Сеть»):
//   latency  — задержка ответа, мс (по умолчанию 300: так видно состояние загрузки);
//   failRate — доля запросов, которые отвечают 500 (0..1; 1 — «сервер лежит»).

const DEFAULT_CONFIG = { latency: 300, failRate: 0 };
const PAGE_SIZE = 12;

const json = (status, body) => ({ status, body });
const error = (status, message) => ({ status, body: { message } });

/** '/api/games/:id' → регулярное выражение с именованными группами */
function compile(pattern) {
  return new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`);
}

export function createBackend({ originalFetch, report }) {
  let config = { ...DEFAULT_CONFIG };
  let db = null;
  let nextRequestId = 1;

  async function load() {
    const names = ['games', 'categories', 'reviews', 'users', 'promo'];
    const entries = await Promise.all(
      names.map(async (name) => [name, await (await originalFetch(`/backend/data/${name}.json`)).json()]),
    );
    db = Object.fromEntries(entries);
    db.orders = [];
  }

  function currentUser(request) {
    const header = request.headers.get('Authorization') ?? '';
    const token = header.replace(/^Bearer\s+/i, '');
    return db.users.find((user) => user.token === token) ?? null;
  }

  const publicUser = ({ password: _password, token: _token, ...user }) => user;

  function requireUser(request, role) {
    const user = currentUser(request);
    if (!user) return [null, error(401, 'Нужно войти')];
    if (role && user.role !== role) return [null, error(403, 'Недостаточно прав')];
    return [user, null];
  }

  function listGames(query) {
    let items = [...db.games];
    const q = query.get('q')?.trim().toLowerCase();
    if (q) items = items.filter((g) => g.title.toLowerCase().includes(q) || g.tags.some((t) => t.includes(q)));
    const category = query.get('category');
    if (category) items = items.filter((g) => g.category === category);
    const players = Number(query.get('players'));
    if (players) items = items.filter((g) => g.players.min <= players && players <= g.players.max);
    if (query.get('inStock') === 'true') items = items.filter((g) => g.inStock > 0);
    const sort = query.get('sort');
    const comparators = {
      price: (a, b) => a.price - b.price,
      '-price': (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      title: (a, b) => a.title.localeCompare(b.title, 'ru'),
    };
    if (comparators[sort]) items.sort(comparators[sort]);
    const size = Number(query.get('size')) || PAGE_SIZE;
    const page = Math.max(1, Number(query.get('page')) || 1);
    return json(200, { items: items.slice((page - 1) * size, page * size), total: items.length, page, size });
  }

  function validateGame(body) {
    if (!body?.title?.trim()) return 'Нужно название';
    if (!(body.price > 0)) return 'Цена должна быть больше нуля';
    return null;
  }

  // [метод, путь, обработчик(request, params, query, body)]
  const routes = [
    ['GET', '/api/games', (_r, _p, query) => listGames(query)],
    [
      'GET',
      '/api/games/:id',
      (_r, { id }) => {
        const game = db.games.find((g) => String(g.id) === id || g.slug === id);
        return game ? json(200, game) : error(404, 'Игра не найдена');
      },
    ],
    ['GET', '/api/categories', () => json(200, db.categories)],
    [
      'GET',
      '/api/games/:id/reviews',
      (_r, { id }) =>
        json(
          200,
          db.reviews.filter((r) => String(r.gameId) === id),
        ),
    ],
    [
      'POST',
      '/api/games/:id/reviews',
      (request, { id }, _q, body) => {
        const [user, denied] = requireUser(request);
        if (denied) return denied;
        if (!(body?.rating >= 1 && body.rating <= 5)) return error(400, 'Оценка — от 1 до 5');
        const review = {
          id: Math.max(0, ...db.reviews.map((r) => r.id)) + 1,
          gameId: Number(id),
          author: user.name,
          rating: body.rating,
          text: String(body.text ?? ''),
          date: new Date().toISOString().slice(0, 10),
        };
        db.reviews.push(review);
        return json(201, review);
      },
    ],
    [
      'POST',
      '/api/login',
      (_r, _p, _q, body) => {
        const user = db.users.find((u) => u.email === body?.email && u.password === body?.password);
        return user
          ? json(200, { token: user.token, user: publicUser(user) })
          : error(401, 'Неверный e-mail или пароль');
      },
    ],
    [
      'GET',
      '/api/me',
      (request) => {
        const [user, denied] = requireUser(request);
        return denied ?? json(200, publicUser(user));
      },
    ],
    [
      'GET',
      '/api/email-available',
      (_r, _p, query) => json(200, { available: !db.users.some((u) => u.email === query.get('email')) }),
    ],
    [
      'GET',
      '/api/promo/:code',
      (_r, { code }) => {
        const promo = db.promo.find((p) => p.code === decodeURIComponent(code).toUpperCase());
        return promo ? json(200, promo) : error(404, 'Промокод не найден');
      },
    ],
    [
      'GET',
      '/api/orders',
      (request) => {
        const [user, denied] = requireUser(request);
        return (
          denied ??
          json(
            200,
            db.orders.filter((o) => o.userId === user.id),
          )
        );
      },
    ],
    [
      'POST',
      '/api/orders',
      (request, _p, _q, body) => {
        const user = currentUser(request);
        if (!Array.isArray(body?.items) || body.items.length === 0) return error(400, 'Пустой заказ');
        for (const item of body.items) {
          const game = db.games.find((g) => g.id === item.gameId);
          if (!game) return error(400, `Нет игры с id ${item.gameId}`);
          if (game.inStock < item.quantity) return error(409, `«${game.title}»: на складе только ${game.inStock}`);
        }
        for (const item of body.items) db.games.find((g) => g.id === item.gameId).inStock -= item.quantity;
        const order = {
          id: db.orders.length + 1,
          userId: user?.id ?? null,
          ...body,
          createdAt: new Date().toISOString(),
        };
        db.orders.push(order);
        return json(201, order);
      },
    ],
    [
      'POST',
      '/api/games',
      (request, _p, _q, body) => {
        const [, denied] = requireUser(request, 'admin');
        if (denied) return denied;
        const problem = validateGame(body);
        if (problem) return error(400, problem);
        const game = { ...body, id: Math.max(0, ...db.games.map((g) => g.id)) + 1 };
        db.games.push(game);
        return json(201, game);
      },
    ],
    [
      'PUT',
      '/api/games/:id',
      (request, { id }, _q, body) => {
        const [, denied] = requireUser(request, 'admin');
        if (denied) return denied;
        const index = db.games.findIndex((g) => String(g.id) === id);
        if (index === -1) return error(404, 'Игра не найдена');
        const problem = validateGame(body);
        if (problem) return error(400, problem);
        db.games[index] = { ...db.games[index], ...body, id: db.games[index].id };
        return json(200, db.games[index]);
      },
    ],
    [
      'DELETE',
      '/api/games/:id',
      (request, { id }) => {
        const [, denied] = requireUser(request, 'admin');
        if (denied) return denied;
        const before = db.games.length;
        db.games = db.games.filter((g) => String(g.id) !== id);
        return db.games.length < before ? { status: 204, body: null } : error(404, 'Игра не найдена');
      },
    ],
  ].map(([method, pattern, handler]) => ({ method, regexp: compile(pattern), handler }));

  function route(request, url, body) {
    for (const r of routes) {
      const match = r.regexp.exec(url.pathname);
      if (match && r.method === request.method) return r.handler(request, match.groups ?? {}, url.searchParams, body);
    }
    const pathExists = routes.some((r) => r.regexp.test(url.pathname));
    return pathExists
      ? error(405, `Метод ${request.method} не поддерживается`)
      : error(404, `Нет такого адреса API: ${url.pathname}`);
  }

  const wait = (ms, signal) =>
    new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException('Запрос отменён', 'AbortError'));
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new DOMException('Запрос отменён', 'AbortError'));
      });
    });

  async function handle(request) {
    const id = nextRequestId++;
    const url = new URL(request.url);
    const started = performance.now();
    const entry = { id, method: request.method, url: url.pathname + url.search, status: 'pending' };
    report(entry);

    let requestBody = null;
    try {
      const text = await request.text();
      requestBody = text ? JSON.parse(text) : null;
    } catch {
      requestBody = undefined;
    }
    if (requestBody !== null) entry.requestBody = requestBody;

    try {
      if (!db) await load();
      await wait(config.latency, request.signal);
    } catch (abort) {
      report({ ...entry, status: 'canceled', ms: Math.round(performance.now() - started) });
      throw abort;
    }

    let result;
    if (requestBody === undefined) result = error(400, 'Тело запроса — не JSON');
    else if (Math.random() < config.failRate)
      result = error(500, 'Сервер недоступен (ошибка включена во вкладке «Сеть»)');
    else {
      try {
        result = route(request, url, requestBody);
      } catch (cause) {
        result = error(500, `Ошибка учебного бэкенда: ${cause.message}`);
      }
    }

    report({ ...entry, status: result.status, ms: Math.round(performance.now() - started), responseBody: result.body });
    const bodyText = result.body === null ? null : JSON.stringify(result.body);
    return new Response(bodyText, {
      status: result.status,
      headers: bodyText === null ? {} : { 'Content-Type': 'application/json' },
    });
  }

  return {
    handle,
    configure(next) {
      config = { ...DEFAULT_CONFIG, ...next };
    },
  };
}
