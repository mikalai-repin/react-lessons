import { useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { fetchGame } from '../api/games';
import { games } from '../data/games';
import { GameDetails } from './GameDetails';

// Загрузка игры: роутер вызывает loader ДО показа страницы.
// signal отменит запрос, если покупатель уйдёт раньше ответа
// Нет игры или сервер упал — fetchGame бросит ApiError,
// и её покажет ближайший ErrorBoundary маршрута
export function gameLoader({
  params,
  request,
}: LoaderFunctionArgs) {
  return fetchGame(params.id!, request.signal);
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
