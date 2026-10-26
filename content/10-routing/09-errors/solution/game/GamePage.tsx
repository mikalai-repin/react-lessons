import { data, useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import type { Game } from '../api/models';
import { games } from '../data/games';
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
  // Нет игры или сервер упал — не страница, а ошибка маршрута:
  // её покажет ближайший ErrorBoundary
  if (!response.ok) {
    throw data(null, { status: response.status });
  }
  return (await response.json()) as Game;
}

// Страница игры: данные уже загружены — компонент их только рисует
export function GamePage() {
  const game = useLoaderData<typeof gameLoader>();

  // Следующая игра каталога; после последней — снова первая
  const index = games.findIndex((item) => item.id === game.id);
  const next = games[(index + 1) % games.length];
  // key: другая игра — новый GameDetails со своим состоянием (глава 5)
  return (
    <GameDetails key={game.id} game={game} nextId={next.id} />
  );
}
