import type { CheckContext, CheckResult } from '@course/check';

// useCountdown: баннер акции с обратным отсчётом над каталогом, отсчёт на странице игры со скидкой
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  const timer = () =>
    ctx.text().match(/До конца акции — (\d+:\d\d:\d\d)/)?.[1];
  const promos = () =>
    ctx.text().split('Неделя семейных игр').length - 1;

  const first = timer();
  if (!first) {
    return {
      pass: false,
      hint: 'Над корзиной нет строки «До конца акции — 1:59:58». Нарисуйте <PromoBanner /> вместо абзаца акции в App.',
    };
  }
  if (promos() !== 1) {
    return {
      pass: false,
      hint: 'Текст акции на странице дважды: абзац с PROMO_HTML из App нужно удалить — теперь он в PromoBanner.',
    };
  }
  await ctx.wait(1300);
  if (timer() === first) {
    return {
      pass: false,
      hint: 'Время в баннере не меняется. useCountdown должен обновлять now раз в секунду интервалом в эффекте.',
    };
  }
  await ctx.click(ctx.button('Остров сокровищ'));
  if (!/Скидка действует ещё \d+:\d\d:\d\d/.test(ctx.text())) {
    return {
      pass: false,
      hint: 'На странице «Острова сокровищ» пропало «Скидка действует ещё …»: Countdown на useCountdown должен рисовать то же, что раньше.',
    };
  }
  if (!timer()) {
    return {
      pass: false,
      hint: 'На странице игры баннер акции тоже должен остаться.',
    };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Отсчёт работает, но в консоли есть ошибки (или ошибки «TS») — посмотрите на них.',
    };
  }
  return { pass: true };
}
