import { useSyncExternalStore } from 'react';
import { produce } from 'immer';
import type { CartItem } from '../api/models';
import { games } from '../data/games';
import { cartReducer, initialCart } from './cartReducer';
import type { CartAction } from './cartReducer';

// Сколько показывается уведомление «Добавлено», мс
const TOAST_MS = 2500;

/** Всё, что хранит корзина */
export type CartState = {
  items: CartItem[];
  // Текст уведомления; null — уведомления нет
  toast: string | null;
};

// Состояние живёт в модуле — вне React, одно на всё приложение
let state: CartState = { items: initialCart, toast: null };
// Подписчики: их зовём после каждого изменения
const listeners = new Set<() => void>();

// Подписка: React передаст сюда функцию «проверь, что изменилось»
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Изменение — всегда новый объект состояния, затем оповещение
function setState(next: Partial<CartState>) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

// Позиции меняет тот же редьюсер, что и раньше, — через Immer
function dispatch(action: CartAction) {
  setState({
    items: produce(state.items, (draft) =>
      cartReducer(draft, action),
    ),
  });
}

// id таймера, который спрячет уведомление
let toastTimer: number | null = null;

function showToast(text: string) {
  setState({ toast: text });
  // Прошлый таймер отменяем: отсчёт начинается заново
  if (toastTimer !== null) clearTimeout(toastTimer);
  toastTimer = setTimeout(
    () => setState({ toast: null }),
    TOAST_MS,
  );
}

/** Действия корзины: обычные функции, их можно звать откуда угодно */
export const cartActions = {
  add(gameId: number) {
    dispatch({ type: 'added', gameId });
    const { title } = games.find((game) => game.id === gameId)!;
    showToast(`Добавлено: ${title}`);
  },
  decrease: (gameId: number) =>
    dispatch({ type: 'decreased', gameId }),
  remove: (gameId: number) =>
    dispatch({ type: 'removed', gameId }),
  clear: () => dispatch({ type: 'cleared' }),
};

// Часть состояния корзины, которую выбрал selector.
// Компонент рендерится, только когда изменилась эта часть
export function useCartStore<T>(
  selector: (state: CartState) => T,
) {
  return useSyncExternalStore(subscribe, () => selector(state));
}
