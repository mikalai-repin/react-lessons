import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { useLoaderData, useRevalidator } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import { fetchGame, fetchReviews } from '../api/games';
import { games } from '../data/games';
import { Button } from '../shared/Button';
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
  // Отзывы могут отклониться раньше, чем их прочитает use, — такую
  // ошибку браузер сочтёт необработанной. Покажет её граница в
  // странице, а пустой catch помечает промис «обработанным»
  reviews.catch(() => {});
  const game = await fetchGame(params.id!, request.signal);
  return { game, reviews };
}

// Страница игры: игра уже загружена, отзывы — ещё могут грузиться
export function GamePage() {
  const { game, reviews } = useLoaderData<typeof gameLoader>();
  // Повтор: роутер заново вызовет gameLoader — и даст новый промис
  const revalidator = useRevalidator();

  // Следующая игра каталога; после последней — снова первая
  const index = games.findIndex((item) => item.id === game.id);
  const next = games[(index + 1) % games.length];
  // key: другая игра — новый GameDetails со своим состоянием (глава 5)
  return (
    <>
      <GameDetails key={game.id} game={game} nextId={next.id} />
      <Section title="Отзывы">
        {/* Отзывы не загрузились — ошибка остаётся в этом блоке,
            а не роняет страницу. Новый промис — сбросить ошибку */}
        <ErrorBoundary
          resetKeys={[reviews]}
          fallbackRender={() => (
            <p className="muted">
              Не удалось загрузить отзывы.{' '}
              <Button
                onClick={() => revalidator.revalidate()}
                disabled={revalidator.state === 'loading'}
              >
                Повторить
              </Button>
            </p>
          )}
        >
          {/* Пока Reviews ждёт промис — заглушка вместо него */}
          <Suspense fallback={<ReviewsSkeleton />}>
            <Reviews reviews={reviews} />
          </Suspense>
        </ErrorBoundary>
      </Section>
    </>
  );
}
