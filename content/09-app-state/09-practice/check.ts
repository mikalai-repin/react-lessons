import type { CheckContext, CheckResult } from '@course/check';

// Практикум «Лимиты склада и промокод»: правило склада в сторе,
// промокод с проверками, снятие ниже порога, сохранение в persist
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  await ctx.restart(undefined, { clearStorage: ['cart'] });
  const hits = () => ctx.all('main section')[1];
  const card = (title: string) =>
    hits()
      ?.querySelector(`img[alt="${title}"]`)
      ?.closest('article') ?? null;
  const cart = () => ctx.all('main section')[0];
  const promoField = () =>
    ctx.document.querySelector<HTMLInputElement>(
      'input[name="promo"]',
    );
  const applyPromo = async (code: string) => {
    await ctx.type(promoField(), code);
    await ctx.click(ctx.button('Применить', cart()));
  };

  const train = card('Ночной экспресс');
  if (!train) {
    return {
      pass: false,
      hint: 'В «Хитах» нет карточки «Ночного экспресса» — приложение не отрисовалось. Посмотрите консоль.',
    };
  }

  // Склад: на складе 3, щёлкаем 4 раза
  for (let i = 0; i < 4; i++) {
    const add = ctx.button(
      'В корзину',
      card('Ночной экспресс')!,
    );
    if (!add || add.disabled) {
      if (i < 3) {
        return {
          pass: false,
          hint: '«В корзину» у «Ночного экспресса» выключилась раньше времени — посмотрите консоль.',
        };
      }
      return {
        pass: false,
        hint: 'На третьей штуке «В корзину» выключилась. Правило склада должно жить в сторе: уберите disabled по остатку из кнопок, а add пусть не добавляет больше inStock и показывает уведомление.',
      };
    }
    await ctx.click(add);
  }
  if (
    !ctx
      .text(card('Ночной экспресс'))
      .includes('В корзине: 3 шт.')
  ) {
    return {
      pass: false,
      hint: 'После четырёх щелчков в корзине должно быть 3 «Ночных экспресса» — столько на складе. Проверьте остаток в add.',
    };
  }
  if (!ctx.text().includes('Больше нет: на складе 3 шт.')) {
    return {
      pass: false,
      hint: 'Лимит работает, но нет уведомления «Больше нет: на складе 3 шт.» — покажите его через showToast.',
    };
  }

  // Промокод
  if (!promoField() || !ctx.button('Применить', cart())) {
    return {
      pass: false,
      hint: 'В мини-корзине нет поля промокода (name="promo") и кнопки «Применить».',
    };
  }
  await applyPromo('скидка');
  if (!ctx.text(cart()).includes('Нет такого промокода')) {
    return {
      pass: false,
      hint: 'Неверный код должен показать «Нет такого промокода». applyPromo может вернуть текст ошибки, а форма — вывести его.',
    };
  }
  await applyPromo(' ходконём ');
  const applied = ctx.text(cart());
  if (
    !applied.includes('Промокод ХОДКОНЁМ: −957 ₽') ||
    !applied.includes('К оплате: 8 613 ₽')
  ) {
    return {
      pass: false,
      hint: 'Код «ХОДКОНЁМ» (без учёта регистра и пробелов) при сумме 9 570 ₽ должен дать «Промокод ХОДКОНЁМ: −957 ₽» и «К оплате: 8 613 ₽».',
    };
  }
  if (applied.includes('Нет такого промокода')) {
    return {
      pass: false,
      hint: 'Промокод применился, а старая ошибка «Нет такого промокода» осталась на экране — сбросьте её.',
    };
  }

  // Перезапуск: промокод сохраняется вместе с позициями
  await ctx.restart();
  if (!ctx.text(cart()).includes('К оплате: 8 613 ₽')) {
    return {
      pass: false,
      hint: 'После перезапуска промокод пропал. Добавьте promo в partialize стора.',
    };
  }

  // Ниже порога промокод снимается
  for (let i = 0; i < 3; i++) {
    const minus = ctx.button('Убрать одну', cart());
    if (i === 2) {
      // Перед третьей «−» остаётся один экспресс — 3 190 ₽, промокод ещё действует
      if (!ctx.text(cart()).includes('К оплате: 2 871 ₽')) {
        return {
          pass: false,
          hint: 'При одном «Ночном экспрессе» (3 190 ₽) промокод ещё действует: «К оплате: 2 871 ₽».',
        };
      }
    }
    await ctx.click(minus);
  }
  await ctx.click(
    ctx.button('В корзину', card('Остров сокровищ')!),
  );
  if (ctx.text(cart()).includes('К оплате')) {
    return {
      pass: false,
      hint: 'Корзина опустела, а промокод остался. Сумма ниже 3 000 ₽ — стор должен снять промокод сам, после каждого изменения позиций.',
    };
  }

  await ctx.restart(undefined, { clearStorage: ['cart'] });
  const island = () =>
    ctx.button('В корзину', card('Остров сокровищ')!);
  await ctx.click(island());
  await ctx.click(island());
  await applyPromo('ХОДКОНЁМ');
  await ctx.click(ctx.button('Убрать одну', cart()));
  if (ctx.text(cart()).includes('К оплате')) {
    return {
      pass: false,
      hint: 'Сумма упала с 3 980 до 1 990 ₽, а промокод остался. Проверяйте порог в сторе после каждого изменения позиций.',
    };
  }
  if (
    !ctx.text().includes('Промокод снят: сумма меньше 3 000 ₽')
  ) {
    return {
      pass: false,
      hint: 'Промокод снят, но нет уведомления «Промокод снят: сумма меньше 3 000 ₽».',
    };
  }
  await applyPromo('ХОДКОНЁМ');
  if (
    !ctx.text(cart()).includes('Промокод действует от 3 000 ₽')
  ) {
    return {
      pass: false,
      hint: 'При сумме меньше 3 000 ₽ код не должен применяться: покажите «Промокод действует от 3 000 ₽».',
    };
  }
  if (ctx.errors().length > 0 || ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Всё работает, но в консоли есть ошибки — посмотрите на них.',
    };
  }
  return { pass: true };
}
