import { Link, useParams } from 'react-router';
import { games } from '../data/games';
import { Section } from '../shared/Section';
import { GameDetails } from './GameDetails';

// Страница игры: id — из адреса /games/:id
export function GamePage() {
  // Параметры адреса — всегда строки (или undefined)
  const { id } = useParams();
  const index = games.findIndex(
    (game) => String(game.id) === id,
  );

  if (index === -1) {
    return (
      <Section title="Игра не найдена">
        <p className="muted">
          В каталоге нет такой игры.{' '}
          <Link to="/">На главную</Link>
        </p>
      </Section>
    );
  }
  const game = games[index];
  // Следующая игра каталога; после последней — снова первая
  const next = games[(index + 1) % games.length];
  // key: другая игра — новый GameDetails со своим состоянием (глава 5)
  return (
    <GameDetails key={game.id} game={game} nextId={next.id} />
  );
}
