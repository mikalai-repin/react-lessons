import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { CartItem } from '../api/models';
import { games } from '../data/games';
import { cartReducer, initialCart } from './cartReducer';
import type { CartAction } from './cartReducer';
import type { CartState, CartMiddlewares } from './cartStore';

/** Срез корзины: позиции и действия с ними */
export type CartSlice = {
  items: CartItem[];
  add: (gameId: number) => void;
  decrease: (gameId: number) => void;
  remove: (gameId: number) => void;
  clear: () => void;
};

// Срез видит весь стор: get() вернёт и уведомление из соседнего среза
export const createCartSlice: StateCreator<
  CartState,
  CartMiddlewares,
  [],
  CartSlice
> = (set, get) => {
  // Позиции меняет тот же редьюсер; тип действия — имя для devtools
  function dispatch(action: CartAction) {
    set(
      (state) => ({
        items: produce(state.items, (draft) =>
          cartReducer(draft, action),
        ),
      }),
      undefined,
      `cart/${action.type}`,
    );
  }

  return {
    items: initialCart,
    add: (gameId) => {
      dispatch({ type: 'added', gameId });
      const { title } = games.find(
        (game) => game.id === gameId,
      )!;
      get().showToast(`Добавлено: ${title}`);
    },
    decrease: (gameId) =>
      dispatch({ type: 'decreased', gameId }),
    remove: (gameId) => dispatch({ type: 'removed', gameId }),
    clear: () => dispatch({ type: 'cleared' }),
  };
};
