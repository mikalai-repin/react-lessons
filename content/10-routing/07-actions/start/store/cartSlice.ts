import { produce } from 'immer';
import type { StateCreator } from 'zustand';
import type { CartItem } from '../api/models';
import { games } from '../data/games';
import { PROMO_CODE, PROMO_MIN_TOTAL } from '../data/promo';
import { formatPrice } from '../shared/format';
import { quantityInCart } from './cartReducer';
import { summarizeCart } from './cartSelectors';
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
  // Применённый промокод; null — промокода нет
  promo: string | null;
  // Применить промокод: текст ошибки или null, если применён
  applyPromo: (code: string) => string | null;
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
    // Сумма упала ниже порога — промокод больше не действует
    const { items, promo } = get();
    if (
      promo !== null &&
      summarizeCart(items, games, null).total < PROMO_MIN_TOTAL
    ) {
      set({ promo: null }, undefined, 'cart/promoRemoved');
      get().showToast(
        `Промокод снят: сумма меньше ${formatPrice(PROMO_MIN_TOTAL)}`,
      );
    }
  }

  return {
    items: initialCart,
    promo: null,
    add: (gameId) => {
      const { title, inStock } = games.find(
        (game) => game.id === gameId,
      )!;
      // Правило склада — здесь, а не в кнопках: больше остатка нельзя
      if (quantityInCart(get().items, gameId) >= inStock) {
        get().showToast(`Больше нет: на складе ${inStock} шт.`);
        return;
      }
      dispatch({ type: 'added', gameId });
      get().showToast(`Добавлено: ${title}`);
    },
    decrease: (gameId) =>
      dispatch({ type: 'decreased', gameId }),
    remove: (gameId) => dispatch({ type: 'removed', gameId }),
    // Очистка снимает и промокод — молча, без уведомления «снят»
    clear: () => {
      set({ promo: null }, undefined, 'cart/promoRemoved');
      dispatch({ type: 'cleared' });
    },
    applyPromo: (code) => {
      if (code.trim().toUpperCase() !== PROMO_CODE) {
        return 'Нет такого промокода';
      }
      const { total } = summarizeCart(get().items, games, null);
      if (total < PROMO_MIN_TOTAL) {
        return `Промокод действует от ${formatPrice(PROMO_MIN_TOTAL)}`;
      }
      set(
        { promo: PROMO_CODE },
        undefined,
        'cart/promoApplied',
      );
      return null;
    },
  };
};
