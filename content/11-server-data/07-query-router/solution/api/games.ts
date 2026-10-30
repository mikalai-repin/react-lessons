import { queryOptions } from '@tanstack/react-query';
import { apiGet } from './client';
import type { Game, Page, Review } from './models';

// Запросы игр: адреса API в одном месте

/** Одна игра по id: GET /api/games/:id */
export function fetchGame(id: string, signal?: AbortSignal) {
  return apiGet<Game>(`/games/${id}`, signal);
}

/** Отзывы об игре: GET /api/games/:id/reviews */
export function fetchReviews(id: string, signal?: AbortSignal) {
  return apiGet<Review[]>(`/games/${id}/reviews`, signal);
}

/** Страница каталога: GET /api/games?q=…&category=…&sort=… */
export function fetchGames(
  params: string,
  signal?: AbortSignal,
) {
  return apiGet<Page<Game>>(`/games?${params}`, signal);
}

// Ключи — от общего к частному: ['games'] накрывает все запросы игр,
// ['games', 'list'] — все списки, ['games', 'list', '…'] — один список
export const gameKeys = {
  all: ['games'] as const,
  lists: () => [...gameKeys.all, 'list'] as const,
  list: (params: string) =>
    [...gameKeys.lists(), params] as const,
  detail: (id: string) =>
    [...gameKeys.all, 'detail', id] as const,
  reviews: (id: string) =>
    [...gameKeys.detail(id), 'reviews'] as const,
};

/** Запрос списка игр: ключ и функция вместе, в одном месте */
export function gamesQuery(params: string) {
  return queryOptions({
    queryKey: gameKeys.list(params),
    queryFn: ({ signal }) => fetchGames(params, signal),
  });
}

/** Запрос одной игры */
export function gameQuery(id: string) {
  return queryOptions({
    queryKey: gameKeys.detail(id),
    queryFn: ({ signal }) => fetchGame(id, signal),
  });
}

/** Запрос отзывов об игре */
export function reviewsQuery(id: string) {
  return queryOptions({
    queryKey: gameKeys.reviews(id),
    queryFn: ({ signal }) => fetchReviews(id, signal),
  });
}
