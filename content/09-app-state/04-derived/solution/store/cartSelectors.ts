import type { Game } from '../api/models';
import type { CartState } from './cartStore';

// С какой суммы доставка бесплатная, ₽
export const FREE_DELIVERY = 5000;

/** Селектор: сколько штук в корзине. Число — сравнивается Object.is */
export const selectCartCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);

/** Итоги корзины из позиций и каталога. Не селектор: возвращает
 *  новый объект — вызываем при рендере, уже выбрав items */
export function summarizeCart(
  items: CartState['items'],
  games: Game[],
) {
  // Позиции вместе с играми: название, цена, остаток.
  // В корзину попадают только игры каталога — find найдёт игру всегда
  const lines = items.map((item) => ({
    ...item,
    game: games.find((game) => game.id === item.gameId)!,
  }));
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
  return { lines, count, total, savings, toFreeDelivery };
}
