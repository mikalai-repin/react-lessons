import { useQueries } from '@tanstack/react-query';
import { gameQuery } from '../api/games';
import { GameGrid } from '../catalog/GameGrid';
import { useFavorites } from '../favorites/FavoritesContext';

// Вкладка «Избранное»: игры, отмеченные сердечком
export function FavoritesPage() {
  const favorites = useFavorites();
  // Своя запись кэша на каждую игру: открытые раньше — уже там
  const results = useQueries({
    queries: favorites.ids.map((id) => gameQuery(String(id))),
  });

  if (favorites.ids.length === 0) {
    return (
      <p className="muted">
        Здесь будут игры, которые вы отметите сердечком ♡
      </p>
    );
  }
  if (results.some((result) => result.isPending)) {
    return <p className="muted">Загружаем избранное…</p>;
  }
  // Игры, которые удалось загрузить, — в порядке отметки
  const favoriteGames = results.flatMap((result) =>
    result.data ? [result.data] : [],
  );
  return <GameGrid games={favoriteGames} />;
}
