import type { CheckContext, CheckResult } from '@course/check';

// Практикум «Хлебные крошки»: цепочка из handle маршрутов,
// последняя — текущая страница, на главной крошек нет, 404 не ломает макет
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  const nav = () =>
    ctx.document.querySelector(
      'nav[aria-label="Хлебные крошки"]',
    );
  const items = () =>
    ctx.all('li', nav() ?? undefined).map((li) => ctx.text(li));

  await ctx.restart('/catalog');
  if (!nav()) {
    return {
      pass: false,
      hint: 'На /catalog нет крошек: нужен <nav aria-label="Хлебные крошки"> в макете, над <Outlet />.',
    };
  }
  if (items().join(' | ') !== 'Главная | Каталог') {
    return {
      pass: false,
      hint: `На /catalog крошки «${items().join(' › ')}», а нужны «Главная › Каталог». Подписи — в handle.crumb корневого маршрута и маршрута catalog.`,
    };
  }
  const home = ctx.all<HTMLAnchorElement>('a', nav()!)[0];
  const current = nav()!.querySelector('[aria-current="page"]');
  if (!home || home.getAttribute('href') !== '/') {
    return {
      pass: false,
      hint: '«Главная» в крошках должна быть ссылкой на «/» (Link to={match.pathname}).',
    };
  }
  if (!current || ctx.text(current) !== 'Каталог') {
    return {
      pass: false,
      hint: 'Последняя крошка — текущая страница: не ссылка, а элемент с aria-current="page".',
    };
  }

  await ctx.restart('/');
  if (nav()) {
    return {
      pass: false,
      hint: 'На главной крошка одна — «Главная», показывать её незачем. Не рисуйте крошки, если их меньше двух.',
    };
  }

  await ctx.restart('/games/4');
  await ctx.waitFor(() => nav());
  if (items().join(' | ') !== 'Главная | Ночной экспресс') {
    return {
      pass: false,
      hint: `На /games/4 крошки «${items().join(' › ')}», а нужны «Главная › Ночной экспресс». Название игры — из данных loader: crumb получает match.loaderData.`,
    };
  }

  await ctx.restart('/account/settings');
  if (items().join(' | ') !== 'Главная | Кабинет | Настройки') {
    return {
      pass: false,
      hint: `На /account/settings крошки «${items().join(' › ')}», а нужны «Главная › Кабинет › Настройки».`,
    };
  }
  // Вторая крошка — ссылка «Кабинет»
  await ctx.click(ctx.all('a', nav()!)[1]);
  if (ctx.url() !== '/account') {
    return {
      pass: false,
      hint: 'Крошка «Кабинет» должна вести на /account — адрес совпавшего маршрута, match.pathname.',
    };
  }

  await ctx.restart('/games/999');
  await ctx.waitFor(() =>
    ctx.text().includes('Такой страницы нет'),
  );
  if (
    !ctx.text().includes('Такой страницы нет') ||
    !ctx.document.querySelector('header')
  ) {
    return {
      pass: false,
      hint: 'На /games/999 пропал весь магазин. loader игры бросил 404, данных нет — match.loaderData равен undefined, и crumb не должен на этом падать.',
    };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Крошки работают, но в консоли есть ошибки — посмотрите на них.',
    };
  }
  return { pass: true };
}
