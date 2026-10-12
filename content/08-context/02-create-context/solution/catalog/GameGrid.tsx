import type { Game } from '../api/models';
import { GameCard } from '../shared/GameCard';

type GameGridProps = {
  games: Game[];
  // Покупатель открыл страницу игры
  onSelect: (gameId: number) => void;
};

// Сетка карточек игр: одна разметка для «Хитов» и «Всех игр»
export function GameGrid({ games, onSelect }: GameGridProps) {
  return (
    <div className="grid">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          onSelect={() => onSelect(game.id)}
        />
      ))}
    </div>
  );
}
