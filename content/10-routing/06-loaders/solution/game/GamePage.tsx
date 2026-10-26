import { Link, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import type { Game } from '../api/models';
import { games } from '../data/games';
import { Section } from '../shared/Section';
import { GameDetails } from './GameDetails';

// Загрузка игры: роутер вызывает loader ДО показа страницы.
// signal отменит запрос, если покупатель уйдёт раньше ответа
export async function gameLoader({
  params,
  request,
}: LoaderFunctionArgs) {
  const response = await fetch(`/api/games/${params.id}`, {
    signal: request.signal,
  });
  if (!response.ok) return null;
  return (await response.json()) as Game;
}

// Страница игры: данные уже загружены — компонент их только рисует
export function GamePage() {
  const game = useLoaderData<typeof gameLoader>();

  if (game === null) {
    return (
      <Section title="Игра не найдена">
        <p className="muted">
          В каталоге нет такой игры.{' '}
          <Link to="/">На главную</Link>
        </p>
      </Section>
    );
  }
  // Следующая игра каталога; после последней — снова первая
  const index = games.findIndex((item) => item.id === game.id);
  const next = games[(index + 1) % games.length];
  // key: другая игра — новый GameDetails со своим состоянием (глава 5)
  return (
    <GameDetails key={game.id} game={game} nextId={next.id} />
  );
}
