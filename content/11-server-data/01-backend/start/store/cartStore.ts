import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { createCartSlice } from './cartSlice';
import type { CartSlice } from './cartSlice';
import { createToastSlice } from './toastSlice';
import type { ToastSlice } from './toastSlice';

/** Весь стор — сумма срезов */
export type CartState = CartSlice & ToastSlice;

/** Какие middleware обёрнуты вокруг срезов: их видят типы set */
export type CartMiddlewares = [
  ['zustand/devtools', never],
  ['zustand/persist', unknown],
];

// Стор корзины: срезы собираются в одно состояние.
// devtools — снаружи: он видит каждый set, и persist тоже
export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (...api) => ({
        ...createCartSlice(...api),
        ...createToastSlice(...api),
      }),
      {
        // Ключ в localStorage
        name: 'cart',
        // Сохраняем позиции и промокод: уведомление после перезапуска не нужно
        partialize: (state) => ({
          items: state.items,
          promo: state.promo,
        }),
        // Версия формата сохранённых данных: меняется — нужна миграция
        version: 2,
        // До версии 2 позиции хранили только id игры: цены в них нет,
        // спросить её не у кого — начинаем с пустой корзины
        migrate: () => ({ items: [], promo: null }),
      },
    ),
    // Имя стора в Redux DevTools
    { name: 'Корзина' },
  ),
);
