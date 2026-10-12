import { createContext, use } from 'react';

/** Избранное: id игр и переключатель */
export type FavoritesContextValue = {
  ids: number[];
  toggle: (gameId: number) => void;
};

// Избранное для всего дерева; null — компонент вне провайдера
export const FavoritesContext =
  createContext<FavoritesContextValue | null>(null);

// Избранное из ближайшего провайдера выше по дереву
export function useFavorites() {
  const value = use(FavoritesContext);
  if (value === null) {
    throw new Error(
      'useFavorites: выше по дереву нет провайдера избранного',
    );
  }
  return value;
}
