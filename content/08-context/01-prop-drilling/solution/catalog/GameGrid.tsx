import type { Game } from '../api/models';
import { GameCard } from '../shared/GameCard';

type GameGridProps = {
  games: Game[];
  // Корзина: самой сетке не нужна — передаём карточкам
  quantityOf: (gameId: number) => number;
  onAdd: (gameId: number) => void;
  // Покупатель открыл страницу игры
  onSelect: (gameId: number) => void;
};

// Сетка карточек игр: одна разметка для «Хитов» и «Всех игр»
export function GameGrid({
  games,
  quantityOf,
  onAdd,
  onSelect,
}: GameGridProps) {
  return (
    <div className="grid">
      {games.map((game) => (
        <GameCard
          key={game.id}
          game={game}
          quantity={quantityOf(game.id)}
          onAdd={() => onAdd(game.id)}
          onSelect={() => onSelect(game.id)}
        />
      ))}
    </div>
  );
}
