import { createContext, use } from 'react';
import type { CartItem } from '../api/models';

/** Что корзина даёт компонентам: позиции и действия с ними */
export type CartContextValue = {
  items: CartItem[];
  add: (gameId: number) => void;
  decrease: (gameId: number) => void;
  remove: (gameId: number) => void;
  clear: () => void;
};

// Корзина для всего дерева компонентов.
// null — значение по умолчанию: компонент нарисован вне провайдера
export const CartContext =
  createContext<CartContextValue | null>(null);

// Корзина из ближайшего провайдера выше по дереву.
// Нет провайдера — ошибка с понятным текстом, а не null дальше по коду
export function useCart() {
  const cart = use(CartContext);
  if (cart === null) {
    throw new Error(
      'useCart: выше по дереву нет провайдера корзины',
    );
  }
  return cart;
}
