import type { CheckContext, CheckResult } from '@course/check';

// «Показать ещё»: порция из трёх игр, подгрузка при прокрутке (IntersectionObserver) и кнопкой,
// бейдж — число найденных, новые фильтры — снова первая порция
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  const section = () =>
    ctx
      .all('main section')
      .find(
        (s) => ctx.text(s.querySelector('h2')) === 'Все игры',
      ) ?? null;
  const badge = () =>
    ctx.text(
      section()?.querySelector('h2')?.nextElementSibling ??
        null,
    );
  const shown = () =>
    ctx.all('article', section() ?? undefined).length;
  const more = () =>
    section() ? ctx.button('Показать ещё', section()!) : null;
  const category = () =>
    section()?.querySelectorAll('select')[0] ?? null;

  if (!section()) {
    return {
      pass: false,
      hint: 'Нет раздела «Все игры» — посмотрите консоль превью.',
    };
  }
  if (shown() !== 3 || badge() !== '6') {
    return {
      pass: false,
      hint: `При запуске в «Все игры» должно быть 3 игры (PAGE_SIZE) при бейдже «6», а сейчас игр ${shown()}, бейдж ${badge() ? `«${badge()}»` : 'не найден'}.`,
    };
  }
  if (!more()) {
    return {
      pass: false,
      hint: 'Под сеткой нет кнопки «Показать ещё»: рисуйте <LoadMore>, если найдено больше, чем показано.',
    };
  }
  // Прокрутка до конца: полоса LoadMore видна — наблюдатель подгружает порцию
  ctx.window.scrollTo(0, ctx.document.body.scrollHeight);
  if (!(await ctx.waitFor(() => shown() === 6))) {
    return {
      pass: false,
      hint: `После прокрутки до конца показано ${shown()} игр вместо 6. LoadMore должен создавать IntersectionObserver и вызывать onLoad, когда полоса видна.`,
    };
  }
  if (more()) {
    return {
      pass: false,
      hint: 'Все шесть игр показаны, а «Показать ещё» осталась: кнопка нужна, только если найдено больше.',
    };
  }
  ctx.window.scrollTo(0, 0);
  await ctx.select(category(), 'family');
  if (shown() !== 3 || more()) {
    return {
      pass: false,
      hint: '«Семейные» — три игры и без «Показать ещё»: больше не найдено.',
    };
  }
  await ctx.select(category(), 'all');
  if (shown() !== 3 || !more()) {
    return {
      pass: false,
      hint: `Новые фильтры — новый список: после смены категории снова первая порция (3), а показано ${shown()}. Сбрасывайте limit там, где меняете фильтры, — без эффекта.`,
    };
  }
  await ctx.click(more());
  if (!(await ctx.waitFor(() => shown() === 6))) {
    return {
      pass: false,
      hint: 'Кнопка «Показать ещё» должна добавлять порцию: onLoad прибавляет PAGE_SIZE к limit.',
    };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Подгрузка работает, но в консоли есть ошибки (или ошибки «TS») — посмотрите на них.',
    };
  }
  return { pass: true };
}
