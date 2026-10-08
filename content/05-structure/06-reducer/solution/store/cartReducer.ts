import type { CartItem } from '../api/models';

/** Что может случиться с корзиной: тип события и его данные */
export type CartAction =
  | { type: 'added'; gameId: number }
  | { type: 'decreased'; gameId: number }
  | { type: 'removed'; gameId: number };

/** Редьюсер: новое состояние корзины по старому и действию */
export function cartReducer(
  items: CartItem[],
  action: CartAction,
): CartItem[] {
  switch (action.type) {
    case 'added': {
      const inCart = items.some(
        (item) => item.gameId === action.gameId,
      );
      // Новой игры ещё нет — новый массив с новой позицией в конце
      if (!inCart) {
        return [
          ...items,
          { gameId: action.gameId, quantity: 1 },
        ];
      }
      // Есть — новый массив, где у этой позиции новый объект
      return items.map((item) =>
        item.gameId === action.gameId
          ? { ...item, quantity: item.quantity + 1 }
          : item,
      );
    }
    case 'decreased': {
      // Минус одна штука; последняя — позиция исчезает
      return items
        .map((item) =>
          item.gameId === action.gameId
            ? { ...item, quantity: item.quantity - 1 }
            : item,
        )
        .filter((item) => item.quantity > 0);
    }
    case 'removed': {
      return items.filter(
        (item) => item.gameId !== action.gameId,
      );
    }
  }
}
