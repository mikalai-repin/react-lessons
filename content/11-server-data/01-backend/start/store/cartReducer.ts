import type { CartGame, CartItem } from '../api/models';

/** Что может случиться с корзиной: тип события и его данные */
export type CartAction =
  | { type: 'added'; game: CartGame }
  | { type: 'decreased'; gameId: number }
  | { type: 'removed'; gameId: number }
  | { type: 'cleared' };

/** Пустая корзина: тип задаём здесь — из [] TypeScript выведет never[] */
export const initialCart: CartItem[] = [];

/** Редьюсер для Immer: меняет черновик корзины, ничего не возвращает */
export function cartReducer(
  draft: CartItem[],
  action: CartAction,
) {
  // Очистить корзину: убрать все позиции разом
  if (action.type === 'cleared') {
    draft.splice(0);
    return;
  }
  // Где позиция этой игры; -1 — игры в корзине ещё нет
  const gameId =
    action.type === 'added' ? action.game.id : action.gameId;
  const index = draft.findIndex(
    (item) => item.game.id === gameId,
  );
  switch (action.type) {
    case 'added':
      if (index === -1) {
        draft.push({ game: action.game, quantity: 1 });
      } else {
        draft[index].quantity += 1;
      }
      break;
    case 'decreased':
      draft[index].quantity -= 1;
      // Последняя штука — позиция исчезает
      if (draft[index].quantity === 0) draft.splice(index, 1);
      break;
    case 'removed':
      draft.splice(index, 1);
      break;
  }
}

/** Сколько штук игры в корзине; 0 — игры там нет */
export function quantityInCart(
  items: CartItem[],
  gameId: number,
) {
  return (
    items.find((item) => item.game.id === gameId)?.quantity ?? 0
  );
}
