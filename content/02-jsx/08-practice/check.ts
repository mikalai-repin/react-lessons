import type { CheckContext, CheckResult } from '@course/check';

// Карточка игры: бейджи скидки, «Хит» и «Осталось N шт.» поверх обложки, теги после характеристик
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  // Карточка — по alt обложки; бейджи — в блоке с классом badges (CSS Modules: App_badges_…)
  const card = (title: string) =>
    ctx.document
      .querySelector(`img[alt="${title}"]`)
      ?.closest('article') ?? null;
  const badges = (title: string) =>
    ctx
      .all('[class*="_badge_"]', card(title) ?? undefined)
      .map((b) => ctx.text(b));
  const tags = (title: string) =>
    ctx
      .all('ul li', card(title) ?? undefined)
      .map((li) => ctx.text(li));

  if (!card('Остров сокровищ')) {
    return {
      pass: false,
      hint: 'Карточки игр не отрисовались — посмотрите консоль превью.',
    };
  }
  const island = badges('Остров сокровищ');
  if (!island.includes('−20%')) {
    return {
      pass: false,
      hint: `У «Острова сокровищ» нет бейджа «−20%» (сейчас: ${island.join(', ') || 'бейджей нет'}). Скидка — округлённый процент: 1 − price / oldPrice. Бейдж — <span className={styles.badge}> внутри styles.badges, минус — знак «−».`,
    };
  }
  if (
    !island.includes('Хит') ||
    !badges('Ночной экспресс').includes('Хит')
  ) {
    return {
      pass: false,
      hint: 'У «Острова сокровищ» (4.6) и «Ночного экспресса» (4.8) должен быть бейдж «Хит»: рейтинг не ниже HIT_RATING.',
    };
  }
  if (!badges('Ночной экспресс').includes('Осталось 3 шт.')) {
    return {
      pass: false,
      hint: 'У «Ночного экспресса» на складе 3 штуки — нужен бейдж «Осталось 3 шт.» (не больше FEW_LEFT).',
    };
  }
  const lighthouse = badges('Маяк');
  if (lighthouse.length > 0) {
    return {
      pass: false,
      hint: `У «Маяка» не должно быть бейджей, а сейчас: ${lighthouse.join(', ')}. Рейтинг 4.5 — ниже порога, а «Осталось…» не показывается, когда на складе ноль.`,
    };
  }
  for (const title of ['Драконья почта', 'Космические коты']) {
    const media = card(title)?.querySelector(
      '[class*="_badges_"]',
    );
    if (media && ctx.text(media) !== '') {
      return {
        pass: false,
        hint: `На обложке «${title}» что-то лишнее: «${ctx.text(media)}». Проверьте условия бейджей: {discount && …} при скидке 0 рисует 0.`,
      };
    }
  }
  if (tags('Остров сокровищ').join(' ') !== '#пираты #карты') {
    return {
      pass: false,
      hint: 'Теги «Острова сокровищ» — списком <ul className={styles.tags}>: «#пираты», «#карты», каждый в <li>.',
    };
  }
  if (ctx.errors().length > 0) {
    return {
      pass: false,
      hint: 'Карточки правильные, но в консоли есть ошибки — например, про key у списка тегов.',
    };
  }
  return { pass: true };
}
