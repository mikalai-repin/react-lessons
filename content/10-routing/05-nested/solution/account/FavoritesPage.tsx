import { GameGrid } from '../catalog/GameGrid';
import { games } from '../data/games';
import { useFavorites } from '../favorites/FavoritesContext';

// Вкладка «Избранное»: игры, отмеченные сердечком
export function FavoritesPage() {
  const favorites = useFavorites();
  const favoriteGames = games.filter((game) =>
    favorites.ids.includes(game.id),
  );
  if (favoriteGames.length === 0) {
    return (
      <p className="muted">
        Здесь будут игры, которые вы отметите сердечком ♡
      </p>
    );
  }
  return <GameGrid games={favoriteGames} />;
}
