import type { CheckContext, CheckResult } from '@course/check';

// Практикум «Магазин без локального каталога»: хиты и избранное —
// с сервера, игры, которых нет в локальном массиве, видны везде
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  const hitsSection = () =>
    ctx
      .all('section')
      .find((section) => ctx.text(section).startsWith('Хиты'));

  await ctx.restart('/', { clearStorage: ['favorites'] });
  await ctx.waitFor(
    () => ctx.all('article', hitsSection()).length > 0,
    4000,
  );
  const hits = hitsSection();
  if (!hits) {
    return {
      pass: false,
      hint: 'На главной нет раздела «Хиты» — посмотрите консоль.',
    };
  }
  const titles = ctx
    .all('article h3', hits)
    .map((h) => ctx.text(h));
  if (!titles.includes('Глубокий космос')) {
    return {
      pass: false,
      hint: 'В «Хитах» нет «Глубокого космоса» (рейтинг 4,9) — хиты всё ещё из локального массива. Загрузите их запросом gamesQuery с параметрами rating, sort и size.',
    };
  }
  if (
    titles.length !== 6 ||
    titles[0] !== 'Шахматы «Классика»'
  ) {
    return {
      pass: false,
      hint: `В «Хитах» ${titles.length} карточек, первая — «${titles[0]}». Нужны 6 лучших по рейтингу: sort=rating и size=6.`,
    };
  }
  if (!ctx.text(hits).startsWith('Хиты 11')) {
    return {
      pass: false,
      hint: 'Счётчик у заголовка «Хиты» — сколько хитов на сервере всего: поле total ответа (11), а не число карточек.',
    };
  }

  // Избранное: игра, которой не было в локальном массиве
  await ctx.restart('/catalog?q=Северный', {
    clearStorage: ['favorites'],
  });
  await ctx.waitFor(() => ctx.text().includes('Северный путь'));
  const card = ctx
    .all('main article')
    .find((a) => ctx.text(a).includes('Северный путь'));
  await ctx.click(ctx.button('В избранное', card));
  await ctx.navigate('/account');
  await ctx.waitFor(() => ctx.text().includes('Северный путь'));
  if (
    !ctx
      .text(ctx.document.querySelector('main'))
      .includes('Северный путь')
  ) {
    return {
      pass: false,
      hint: 'Отметили «Северный путь» сердечком, а в «Избранном» его нет. Загрузите каждую отмеченную игру запросом gameQuery — useQueries для массива запросов.',
    };
  }

  await ctx.restart('/account', {
    clearStorage: ['favorites'],
  });
  if (!ctx.text().includes('Здесь будут игры')) {
    return {
      pass: false,
      hint: 'Пустое избранное должно показывать текст про сердечко ♡, а не «Загружаем…».',
    };
  }

  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Работает, но в консоли есть ошибки — посмотрите их.',
    };
  }
  return { pass: true };
}
