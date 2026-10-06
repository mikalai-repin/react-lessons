import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Game } from '../api/models';

export interface CartItem {
  game: Game;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  add: (game: Game) => void;
  remove: (id: number) => void;
}

export const useCartStore = create<CartState>()(
  // persist сохраняет корзину в localStorage: она переживает перезапуск
  persist(
    (set) => ({
      items: [],
      add: (game) =>
        set((state) => {
          const existing = state.items.find(
            (item) => item.game.id === game.id,
          );
          if (!existing)
            return {
              items: [...state.items, { game, quantity: 1 }],
            };
          return {
            items: state.items.map((item) =>
              item === existing
                ? { ...item, quantity: item.quantity + 1 }
                : item,
            ),
          };
        }),
      remove: (id) =>
        set((state) => ({
          items: state.items.filter(
            (item) => item.game.id !== id,
          ),
        })),
    }),
    { name: 'hod-konem-cart' },
  ),
);

export const cartCount = (state: CartState) =>
  state.items.reduce((sum, item) => sum + item.quantity, 0);
export const cartTotal = (state: CartState) =>
  state.items.reduce(
    (sum, item) => sum + item.game.price * item.quantity,
    0,
  );
