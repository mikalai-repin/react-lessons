import { produce } from 'immer';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem } from '../api/models';
import { games } from '../data/games';
import { cartReducer, initialCart } from './cartReducer';
import type { CartAction } from './cartReducer';

// Сколько показывается уведомление «Добавлено», мс
const TOAST_MS = 2500;

/** Всё, что хранит корзина: данные и действия */
export type CartState = {
  items: CartItem[];
  // Текст уведомления; null — уведомления нет
  toast: string | null;
  add: (gameId: number) => void;
  decrease: (gameId: number) => void;
  remove: (gameId: number) => void;
  clear: () => void;
};

// id таймера, который спрячет уведомление
let toastTimer: number | null = null;

// Стор корзины: create возвращает хук, у хука — getState и subscribe.
// persist сохраняет корзину в localStorage: она переживает перезапуск
export const useCartStore = create<CartState>()(
  persist(
    (set) => {
      // Позиции меняет тот же редьюсер, что и раньше, — через Immer
      function dispatch(action: CartAction) {
        set((state) => ({
          items: produce(state.items, (draft) =>
            cartReducer(draft, action),
          ),
        }));
      }

      function showToast(text: string) {
        set({ toast: text });
        // Прошлый таймер отменяем: отсчёт начинается заново
        if (toastTimer !== null) clearTimeout(toastTimer);
        toastTimer = setTimeout(
          () => set({ toast: null }),
          TOAST_MS,
        );
      }

      // Начальное состояние: данные и действия вместе
      return {
        items: initialCart,
        toast: null,
        add: (gameId) => {
          dispatch({ type: 'added', gameId });
          const { title } = games.find(
            (game) => game.id === gameId,
          )!;
          showToast(`Добавлено: ${title}`);
        },
        decrease: (gameId) =>
          dispatch({ type: 'decreased', gameId }),
        remove: (gameId) =>
          dispatch({ type: 'removed', gameId }),
        clear: () => dispatch({ type: 'cleared' }),
      };
    },
    {
      // Ключ в localStorage
      name: 'cart',
      // Сохраняем только позиции: уведомление после перезапуска не нужно
      partialize: (state) => ({ items: state.items }),
      // Версия формата сохранённых данных: меняется — нужна миграция
      version: 1,
      // Версия 0 сохраняла всё состояние — берём из него только позиции
      migrate: (persisted) => {
        const { items } = persisted as { items: CartItem[] };
        return { items };
      },
    },
  ),
);
