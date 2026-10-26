import type { StateCreator } from 'zustand';
import type { CartState, CartMiddlewares } from './cartStore';

// Сколько показывается уведомление «Добавлено», мс
const TOAST_MS = 2500;

/** Срез уведомления: текст и как его показать */
export type ToastSlice = {
  // Текст уведомления; null — уведомления нет
  toast: string | null;
  showToast: (text: string) => void;
};

// id таймера, который спрячет уведомление
let toastTimer: number | null = null;

export const createToastSlice: StateCreator<
  CartState,
  CartMiddlewares,
  [],
  ToastSlice
> = (set) => ({
  toast: null,
  showToast: (text) => {
    set({ toast: text }, undefined, 'toast/shown');
    // Прошлый таймер отменяем: отсчёт начинается заново
    if (toastTimer !== null) clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => set({ toast: null }, undefined, 'toast/hidden'),
      TOAST_MS,
    );
  },
});
