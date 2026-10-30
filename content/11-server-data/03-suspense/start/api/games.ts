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
