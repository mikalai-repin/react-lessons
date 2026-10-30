import { PROMO_PERCENT } from '../data/promo';
import type { CartState } from './cartStore';

// С какой суммы доставка бесплатная, ₽
export const FREE_DELIVERY = 5000;

/** Селектор: сколько штук в корзине. Число — сравнивается Object.is */
export const selectCartCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

/** Итоги корзины из позиций. Не селектор: возвращает
 *  новый объект — вызываем при рендере, уже выбрав items */
export function summarizeCart(
  items: CartState['items'],
  promo: string | null,
) {
  // Позиции уже со снимком игры: название, цена, остаток
  const lines = items;
  const count = lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );
  const total = lines.reduce(
    (sum, line) => sum + line.game.price * line.quantity,
    0,
  );
  // Сколько сэкономил покупатель: разница со старой ценой
  const savings = lines.reduce(
    (sum, line) =>
      sum +
      ((line.game.oldPrice ?? line.game.price) -
        line.game.price) *
        line.quantity,
    0,
  );
  const toFreeDelivery = Math.max(FREE_DELIVERY - total, 0);
  // Скидка по промокоду — от суммы корзины
  const promoDiscount =
    promo === null
      ? 0
      : Math.round((total * PROMO_PERCENT) / 100);
  const payable = total - promoDiscount;
  return {
    lines,
    count,
    total,
    savings,
    toFreeDelivery,
    promoDiscount,
    payable,
  };
}
