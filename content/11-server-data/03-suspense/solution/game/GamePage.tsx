import { Suspense } from 'react';
import { useLoaderData } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { fetchGame, fetchReviews } from '../api/games';
import { games } from '../data/games';
import { Section } from '../shared/Section';
import { GameDetails } from './GameDetails';
import { Reviews, ReviewsSkeleton } from './Reviews';

// Загрузка игры: роутер вызывает loader ДО показа страницы.
// Нет игры или сервер упал — fetchGame бросит ApiError,
// и её покажет ближайший ErrorBoundary маршрута
export async function gameLoader({
  params,
  request,
}: LoaderFunctionArgs) {
  // Отзывы не ждём: запрос уходит сейчас, а промис — странице
  const reviews = fetchReviews(params.id!, request.signal);
  const game = await fetchGame(params.id!, request.signal);
  return { game, reviews };
}

// Страница игры: игра уже загружена, отзывы — ещё могут грузиться
export function GamePage() {
  const { game, reviews } = useLoaderData<typeof gameLoader>();

  // Следующая игра каталога; после последней — снова первая
  const index = games.findIndex((item) => item.id === game.id);
  const next = games[(index + 1) % games.length];
  // key: другая игра — новый GameDetails со своим состоянием (глава 5)
  return (
    <>
      <GameDetails key={game.id} game={game} nextId={next.id} />
      <Section title="Отзывы">
        {/* Пока Reviews ждёт промис — заглушка вместо него */}
        <Suspense fallback={<ReviewsSkeleton />}>
          <Reviews reviews={reviews} />
        </Suspense>
      </Section>
    </>
  );
}
