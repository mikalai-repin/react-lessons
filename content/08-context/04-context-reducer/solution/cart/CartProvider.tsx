import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useImmerReducer } from 'use-immer';
import { games } from '../data/games';
import { cartReducer, initialCart } from '../store/cartReducer';
import { CartContext } from './CartContext';
import type { CartContextValue } from './CartContext';
import styles from './CartProvider.module.css';

// Сколько показывается уведомление «Добавлено», мс
const TOAST_MS = 2500;

type CartProviderProps = {
  children: ReactNode;
};

// Корзина магазина: состояние, действия и уведомление «Добавлено».
// Всё, что внутри провайдера, получает корзину через useCart
export function CartProvider({ children }: CartProviderProps) {
  // Позиции корзины: меняются только через действия редьюсера
  const [items, dispatch] = useImmerReducer(
    cartReducer,
    initialCart,
  );
  // Текст уведомления; null — уведомления нет
  const [toast, setToast] = useState<string | null>(null);
  // id таймера, который спрячет уведомление
  const toastTimer = useRef<number | null>(null);

  function showToast(text: string) {
    setToast(text);
    // Прошлый таймер отменяем: отсчёт начинается заново
    if (toastTimer.current !== null) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(
      () => setToast(null),
      TOAST_MS,
    );
  }

  // Значение контекста: позиции и действия с ними
  const value: CartContextValue = {
    items,
    add: (gameId) => {
      dispatch({ type: 'added', gameId });
      const { title } = games.find(
        (game) => game.id === gameId,
      )!;
      showToast(`Добавлено: ${title}`);
    },
    decrease: (gameId) =>
      dispatch({ type: 'decreased', gameId }),
    remove: (gameId) => dispatch({ type: 'removed', gameId }),
    clear: () => dispatch({ type: 'cleared' }),
  };

  return (
    <CartContext value={value}>
      {children}
      {toast !== null && (
        <p className={styles.toast} role="status">
          {toast}
        </p>
      )}
    </CartContext>
  );
}
