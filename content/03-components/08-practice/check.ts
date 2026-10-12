import type { CheckContext, CheckResult } from '@course/check';

// Rating: max звёзд, закрашены Math.round(value), число рядом, role="img" и aria-label; в карточках — size="sm"
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  const card = (title: string) =>
    ctx.document
      .querySelector(`img[alt="${title}"]`)
      ?.closest('article') ?? null;
  const rating = (title: string) =>
    card(title)?.querySelector(
      '[role="img"][aria-label^="Рейтинг"]',
    ) ?? null;
  const stars = (element: Element, kind: 'on' | 'off') =>
    ctx.all(`[class*="_${kind}_"]`, element).length;

  if (!card('Остров сокровищ')) {
    return {
      pass: false,
      hint: 'Карточки игр не отрисовались — посмотрите консоль превью.',
    };
  }
  const island = rating('Остров сокровищ');
  if (
    !island ||
    island.querySelector('[class*="_ratingFill_"]')
  ) {
    return {
      pass: false,
      hint: 'В карточке всё ещё полоска рейтинга. Замените её на <Rating value={game.rating} size="sm" />.',
    };
  }
  if (
    island.getAttribute('aria-label') !== 'Рейтинг 4.6 из 5'
  ) {
    return {
      pass: false,
      hint: `aria-label у рейтинга «Острова» — «${island.getAttribute('aria-label')}», а нужно «Рейтинг 4.6 из 5».`,
    };
  }
  const expected: [string, number][] = [
    ['Остров сокровищ', 5],
    ['Драконья почта', 4],
    ['Маяк', 5],
    ['Космические коты', 4],
  ];
  for (const [title, on] of expected) {
    const element = rating(title)!;
    if (
      stars(element, 'on') !== on ||
      stars(element, 'off') !== 5 - on
    ) {
      return {
        pass: false,
        hint: `У «${title}» должно быть ${on} закрашенных звёзд (styles.on) и ${5 - on} пустых (styles.off) — закрашены первые Math.round(value).`,
      };
    }
  }
  if (!ctx.text(island).endsWith('4.6')) {
    return {
      pass: false,
      hint: 'После звёзд выведите само число рейтинга в <span className={styles.value}>.',
    };
  }
  if (!island.className.includes('_sm_')) {
    return {
      pass: false,
      hint: 'В карточке звёзды должны быть мелкими: size="sm" — класс styles[size] у обёртки.',
    };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Рейтинг рисуется, но в консоли есть ошибки (или ошибки «TS») — посмотрите на них.',
    };
  }
  return { pass: true };
}
