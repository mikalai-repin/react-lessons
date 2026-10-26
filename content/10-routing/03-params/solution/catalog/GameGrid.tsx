import type { Game } from '../api/models';
import { GameCard } from '../shared/GameCard';

type GameGridProps = {
  games: Game[];
};

// Сетка карточек игр: одна разметка для «Хитов» и «Всех игр»
export function GameGrid({ games }: GameGridProps) {
  return (
    <div className="grid">
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
