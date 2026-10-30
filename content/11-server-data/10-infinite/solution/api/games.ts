import {
  infiniteQueryOptions,
  queryOptions,
} from '@tanstack/react-query';
import { apiGet, apiPost } from './client';
import type { Game, NewReview, Page, Review } from './models';

// Запросы игр: адреса API в одном месте

// Сколько игр в одной порции бесконечного каталога
const PORTION = 6;

/** Одна игра по id: GET /api/games/:id */
export function fetchGame(id: string, signal?: AbortSignal) {
  return apiGet<Game>(`/games/${id}`, signal);
}

/** Отзывы об игре: GET /api/games/:id/reviews */
export function fetchReviews(id: string, signal?: AbortSignal) {
  return apiGet<Review[]>(`/games/${id}/reviews`, signal);
}

/** Новый отзыв: POST /api/games/:id/reviews → отзыв с id и датой */
export function postReview(id: string, review: NewReview) {
  return apiPost<Review>(`/games/${id}/reviews`, review);
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
  // Порции — другая форма данных, значит, и ключ другой
  infinite: (params: string) =>
    [...gameKeys.list(params), 'infinite'] as const,
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

/** Каталог порциями: страница за страницей по page и size */
export function gamesInfiniteQuery(params: string) {
  return infiniteQueryOptions({
    queryKey: gameKeys.infinite(params),
    queryFn: ({ pageParam, signal }) => {
      const query = new URLSearchParams(params);
      query.set('page', String(pageParam));
      query.set('size', String(PORTION));
      return fetchGames(query.toString(), signal);
    },
    // Первая порция — страница 1
    initialPageParam: 1,
    // Номер следующей страницы по последней; undefined — всё загружено
    getNextPageParam: (last) =>
      last.page * last.size < last.total
        ? last.page + 1
        : undefined,
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
