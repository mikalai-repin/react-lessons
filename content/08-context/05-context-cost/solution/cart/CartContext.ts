import { createContext, use } from 'react';
import type { CartItem } from '../api/models';

/** Что можно сделать с корзиной */
export type CartActions = {
  add: (gameId: number) => void;
  decrease: (gameId: number) => void;
  remove: (gameId: number) => void;
  clear: () => void;
};

// Позиции корзины: меняются с каждым действием.
// null — значение по умолчанию: компонент нарисован вне провайдера
export const CartContext = createContext<CartItem[] | null>(
  null,
);

// Действия: функции не меняются — свой контекст, чтобы те,
// кому нужны только действия, не рендерились от новых позиций
export const CartActionsContext =
  createContext<CartActions | null>(null);

// Позиции корзины из ближайшего провайдера выше по дереву
export function useCart() {
  const items = use(CartContext);
  if (items === null) {
    throw new Error(
      'useCart: выше по дереву нет провайдера корзины',
    );
  }
  return items;
}

// Действия с корзиной из ближайшего провайдера
export function useCartActions() {
  const actions = use(CartActionsContext);
  if (actions === null) {
    throw new Error(
      'useCartActions: выше по дереву нет провайдера корзины',
    );
  }
  return actions;
}
