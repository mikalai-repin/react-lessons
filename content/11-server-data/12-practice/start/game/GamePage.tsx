import { Suspense } from 'react';
import {
  noop,
  useQuery,
  useQueryErrorResetBoundary,
  useSuspenseQuery,
} from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { useParams } from 'react-router';
import type { LoaderFunctionArgs } from 'react-router';
import {
  gameQuery,
  gamesQuery,
  reviewsQuery,
} from '../api/games';
import { queryClient } from '../api/queryClient';
import { Button } from '../shared/Button';
import { Section } from '../shared/Section';
import { GameDetails } from './GameDetails';
import { ReviewForm } from './ReviewForm';
import { Reviews, ReviewsSkeleton } from './Reviews';

// Загрузчик кладёт данные в кэш Query, а страница читает их оттуда.
// Нет игры или сервер упал — query бросит ApiError,
// и её покажет ближайший ErrorBoundary маршрута
export function gameLoader({ params }: LoaderFunctionArgs) {
  const id = params.id!;
  // Отзывы — запрос уходит сейчас, но переход его не ждёт
  queryClient.query(reviewsQuery(id)).catch(noop);
  // Игру переход ждёт. 'static': есть в кэше — отдать сразу,
  // даже устаревшую; обновит её useSuspenseQuery страницы
  return queryClient.query({
    ...gameQuery(id),
    staleTime: 'static',
  });
}

// Страница игры: игра — из кэша, отзывы — когда придут
export function GamePage() {
  const id = useParams().id!;
  // Данные гарантированы: loader уже положил игру в кэш
  const { data: game } = useSuspenseQuery(gameQuery(id));
  // «Повторить» после ошибки: Query запросит отзывы заново
  const { reset } = useQueryErrorResetBoundary();

  // Сколько игр в каталоге — из кэша шапки (тот же запрос)
  const total = useQuery(gamesQuery('')).data?.total;
  // Следующая игра; после последней — снова первая.
  // id игр учебного сервера идут подряд: 1, 2, … total
  const nextId = game.id === total ? 1 : game.id + 1;
  // key: другая игра — новый GameDetails со своим состоянием (глава 5)
  return (
    <>
      <GameDetails key={game.id} game={game} nextId={nextId} />
      <Section title="Отзывы">
        {/* Ошибка отзывов остаётся в этом блоке. Другая игра —
            сбросить ошибку: у неё свои отзывы */}
        <ErrorBoundary
          resetKeys={[id]}
          onReset={reset}
          fallbackRender={({ resetErrorBoundary }) => (
            <p className="muted">
              Не удалось загрузить отзывы.{' '}
              <Button onClick={resetErrorBoundary}>
                Повторить
              </Button>
            </p>
          )}
        >
          {/* Пока отзывов нет в кэше — заглушка */}
          <Suspense fallback={<ReviewsSkeleton />}>
            <Reviews gameId={id} />
          </Suspense>
        </ErrorBoundary>
        {/* key: у каждой игры — своя форма со своим состоянием */}
        <ReviewForm key={id} gameId={id} />
      </Section>
    </>
  );
}
