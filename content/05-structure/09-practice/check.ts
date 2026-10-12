import type { CheckContext, CheckResult } from '@course/check';

// Витрина: панель фильтров, бейдж с числом найденных, «Ничего не нашлось» и «Сбросить фильтры»,
// фильтры переживают переход на страницу игры
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
  const titles = () =>
    ctx
      .all('article h3', section() ?? undefined)
      .map((h) => ctx.text(h));
  const field = (selector: string) =>
    section()?.querySelector(selector) ?? null;
  const [search, category, sort, stock] = [
    () => field('input[type="search"]'),
    () => section()?.querySelectorAll('select')[0] ?? null,
    () => section()?.querySelectorAll('select')[1] ?? null,
    () => field('input[type="checkbox"]'),
  ];

  if (!section()) {
    return {
      pass: false,
      hint: 'Нет раздела «Все игры» — посмотрите консоль превью.',
    };
  }
  if (badge() !== '6') {
    return {
      pass: false,
      hint: `В заголовке «Все игры» нужен бейдж с числом найденных игр — 6 при запуске (сейчас ${badge() ? `«${badge()}»` : 'бейджа нет'}).`,
    };
  }
  if (!search() || !category() || !sort() || !stock()) {
    return {
      pass: false,
      hint: 'В разделе «Все игры» нужны четыре поля: поиск, категория, порядок и «Только в наличии».',
    };
  }
  await ctx.type(search(), 'о');
  if (badge() !== '4') {
    return {
      pass: false,
      hint: 'Поиск «о» находит 4 игры — бейдж и сетка должны показать это. Проверьте onChange поиска.',
    };
  }
  await ctx.click(stock());
  await ctx.select(sort(), 'expensive');
  const expensive = [
    'Ночной экспресс',
    'Остров сокровищ',
    'Космические коты',
    'Драконья почта',
  ];
  if (titles().join() !== expensive.join()) {
    return {
      pass: false,
      hint: `«о» + «Только в наличии» + «Сначала дорогие»: ожидались ${expensive.join(', ')}, а в сетке: ${titles().join(', ') || 'ничего'}. Каждое поле должно менять своё свойство в новом объекте фильтров.`,
    };
  }
  await ctx.select(category(), 'kids');
  const reset = ctx.button('Сбросить фильтры', section()!);
  if (
    badge() !== '0' ||
    !ctx.text(section()).includes('Ничего не нашлось') ||
    !reset
  ) {
    return {
      pass: false,
      hint: 'Если ничего не найдено — бейдж «0», вместо сетки «Ничего не нашлось» и кнопка «Сбросить фильтры».',
    };
  }
  await ctx.click(reset);
  const fields = [
    (search() as HTMLInputElement).value,
    (category() as HTMLSelectElement).value,
    (sort() as HTMLSelectElement).value,
    String((stock() as HTMLInputElement).checked),
  ];
  if (
    badge() !== '6' ||
    fields.join() !== ',all,default,false'
  ) {
    return {
      pass: false,
      hint: '«Сбросить фильтры» должна вернуть INITIAL_FILTERS: пустой поиск, «Все», «Как в каталоге», флажок снят — и шесть игр.',
    };
  }

  await ctx.select(category(), 'strategy');
  await ctx.click(ctx.button('Ночной экспресс', section()!));
  await ctx.click(ctx.button('← К каталогу'));
  if (
    (category() as HTMLSelectElement | null)?.value !==
    'strategy'
  ) {
    return {
      pass: false,
      hint: 'После возврата со страницы игры фильтр «Стратегии» пропал: фильтры должны храниться в App, а не в панели.',
    };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Витрина работает, но в консоли есть ошибки (или ошибки «TS») — посмотрите на них.',
    };
  }
  return { pass: true };
}
