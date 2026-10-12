import type { CheckContext, CheckResult } from '@course/check';

// Мини-корзина: пустое состояние, позиции с «−»/«+»/«×», итог и доставка, лимит по складу
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  // Раздел с заголовком «Корзина»
  const cart = () =>
    ctx
      .all('main section')
      .find(
        (s) => ctx.text(s.querySelector('h2')) === 'Корзина',
      ) ?? null;
  // «В корзину» у index-й карточки игры на странице (0 — «Хиты», 1 — «Все игры»)
  const add = (title: string, index = 0) =>
    ctx.click(
      ctx
        .all(`img[alt="${title}"]`)
        [index]?.closest('article')
        ?.querySelector('button.button'),
    );
  const line = (title: string) =>
    ctx
      .all('li', cart() ?? undefined)
      .find((li) => ctx.text(li).includes(title)) ?? null;

  if (!cart()) {
    return {
      pass: false,
      hint: 'На странице нет раздела «Корзина»: нарисуйте <MiniCart> в App после акции.',
    };
  }
  if (
    !ctx
      .text(cart())
      .includes('Корзина пуста — добавьте игру из каталога')
  ) {
    return {
      pass: false,
      hint: 'Пустая корзина должна показывать «Корзина пуста — добавьте игру из каталога».',
    };
  }
  await add('Остров сокровищ', 0);
  await add('Остров сокровищ', 1);
  await add('Нарды');
  const island = line('Остров сокровищ');
  if (!island || !line('Нарды')) {
    return {
      pass: false,
      hint: 'После «В корзину» в мини-корзине нет позиций: по одной <li> на игру с её названием.',
    };
  }
  if (
    island.querySelector('output')?.textContent !== '2' ||
    !ctx.text(island).includes('3 980 ₽')
  ) {
    return {
      pass: false,
      hint: '«Остров сокровищ» добавлен дважды: в <output> должно быть 2, сумма позиции — 3 980 ₽ (цена × количество).',
    };
  }
  const head = ctx.text(
    cart()!.querySelector('h2')?.parentElement ?? null,
  );
  if (head !== 'Корзина 3') {
    return {
      pass: false,
      hint: `Бейдж у заголовка корзины — общее число штук: должно быть 3, а в заголовке «${head}».`,
    };
  }
  if (
    !ctx.text(cart()).includes('Итого: 6 570 ₽') ||
    !ctx.text(cart()).includes('Доставка бесплатно')
  ) {
    return {
      pass: false,
      hint: 'Под списком — «Итого: 6 570 ₽» и «Доставка бесплатно» (от FREE_DELIVERY = 5000 ₽).',
    };
  }

  for (let i = 0; i < 3; i++) await add('Ночной экспресс');
  const plus = line('Ночной экспресс')?.querySelector(
    'button[aria-label="Добавить ещё"]',
  );
  if (!plus) {
    return {
      pass: false,
      hint: 'У кнопок из одного символа нужен aria-label: «+» — «Добавить ещё», «−» — «Убрать одну».',
    };
  }
  if (!(plus as HTMLButtonElement).disabled) {
    return {
      pass: false,
      hint: '«Ночной экспресс» в корзине 3 раза — столько, сколько на складе: «+» у него должен быть выключен.',
    };
  }

  const minus = () =>
    line('Остров сокровищ')?.querySelector(
      'button[aria-label="Убрать одну"]',
    );
  await ctx.click(minus());
  await ctx.click(minus());
  if (line('Остров сокровищ')) {
    return {
      pass: false,
      hint: '«−» дважды у «Острова» — позиция должна исчезнуть: последняя штука убирает позицию (handleDecrease).',
    };
  }
  await ctx.click(
    ctx.button('Убрать «Ночной экспресс»', cart()!),
  );
  if (line('Ночной экспресс')) {
    return {
      pass: false,
      hint: '«×» должна убирать позицию целиком: кнопка с aria-label «Убрать «Название»» и handleRemove.',
    };
  }
  if (
    !ctx.text(cart()).includes('Итого: 2 590 ₽') ||
    !ctx
      .text(cart())
      .includes('До бесплатной доставки — 2 410 ₽')
  ) {
    return {
      pass: false,
      hint: 'В корзине одни «Нарды»: «Итого: 2 590 ₽» и «До бесплатной доставки — 2 410 ₽».',
    };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Мини-корзина работает, но в консоли есть ошибки (или ошибки «TS») — посмотрите на них.',
    };
  }
  return { pass: true };
}
