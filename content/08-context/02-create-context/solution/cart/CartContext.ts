import { createContext } from 'react';
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
