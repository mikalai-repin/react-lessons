import type { CheckContext, CheckResult } from '@course/check';

// Практикум «Избранное»: сердечко на каждой карточке, счётчик в шапке,
// одно состояние на всё дерево (обе карточки игры), выбор переживает перезапуск
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  await ctx.restart(undefined, { clearStorage: ['favorites'] });
  const cards = () => ctx.all('main article');
  const heart = (card: Element) =>
    card.querySelector('button[aria-label="В избранное"]');
  const pressed = (card: Element) =>
    heart(card)?.getAttribute('aria-pressed') === 'true';
  const title = (card: Element) =>
    ctx.text(card.querySelector('h3'));
  const counter = () =>
    ctx
      .text(ctx.document.querySelector('header'))
      .match(/♥\s*(\d+)/)?.[1];

  if (cards().length === 0) {
    return {
      pass: false,
      hint: 'В каталоге нет карточек игр — приложение не отрисовалось. Посмотрите консоль.',
    };
  }
  if (!cards().every((card) => heart(card))) {
    return {
      pass: false,
      hint: 'Не у каждой карточки есть кнопка-сердечко с aria-label="В избранное". Кнопка — внутри GameCard, после обложки.',
    };
  }
  if (cards().some(pressed)) {
    return {
      pass: false,
      hint: 'При пустом избранном сердечки должны быть не нажаты: aria-pressed={false}.',
    };
  }
  if (counter() !== '0') {
    return {
      pass: false,
      hint: 'В шапке нет счётчика «♥ 0»: выведите число игр в избранном из useFavorites().',
    };
  }

  // Сердечко первой карточки — «Остров сокровищ» в «Хитах»
  const first = cards()[0];
  const name = title(first);
  await ctx.click(heart(first));
  if (!pressed(cards()[0])) {
    return {
      pass: false,
      hint: 'После щелчка сердечко не нажато: проверьте toggle в провайдере и aria-pressed у кнопки.',
    };
  }
  const twins = cards().filter((card) => title(card) === name);
  if (twins.length > 1 && !twins.every(pressed)) {
    return {
      pass: false,
      hint: `У «${name}» две карточки, а сердечко горит только на одной. Избранное должно жить в провайдере, а карточки — читать его через useFavorites().`,
    };
  }
  if (counter() !== '1') {
    return {
      pass: false,
      hint: 'Сердечко нажато, а счётчик в шапке не стал «♥ 1». Шапка должна читать тот же контекст.',
    };
  }

  // Перезапуск: избранное — в localStorage
  await ctx.restart();
  if (!pressed(cards()[0]) || counter() !== '1') {
    return {
      pass: false,
      hint: 'После перезапуска избранное пропало. Храните id игр в useLocalStorage с ключом "favorites".',
    };
  }
  await ctx.click(heart(cards()[0]));
  if (cards().some(pressed) || counter() !== '0') {
    return {
      pass: false,
      hint: 'Повторный щелчок должен убрать игру из избранного: toggle удаляет id, если он уже есть.',
    };
  }
  if (ctx.errors().length > 0) {
    return {
      pass: false,
      hint: 'Избранное работает, но в консоли есть ошибки — посмотрите на них.',
    };
  }
  return { pass: true };
}
