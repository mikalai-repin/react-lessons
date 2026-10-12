import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { FavoritesContext } from './FavoritesContext';
import type { FavoritesContextValue } from './FavoritesContext';

type FavoritesProviderProps = {
  children: ReactNode;
};

// Избранное магазина: id игр переживают перезапуск
export function FavoritesProvider({
  children,
}: FavoritesProviderProps) {
  const [ids, setIds] = useLocalStorage<number[]>(
    'favorites',
    [],
  );

  // Новый объект — только когда изменилось избранное
  const value = useMemo<FavoritesContextValue>(
    () => ({
      ids,
      // Была в избранном — убираем, не было — добавляем
      toggle: (gameId) =>
        setIds(
          ids.includes(gameId)
            ? ids.filter((id) => id !== gameId)
            : [...ids, gameId],
        ),
    }),
    [ids, setIds],
  );

  return (
    <FavoritesContext value={value}>
      {children}
    </FavoritesContext>
  );
}
