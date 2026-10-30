import { apiGet } from './client';
import type { Game, Page } from './models';

// Запросы игр: адреса API в одном месте

/** Одна игра по id: GET /api/games/:id */
export function fetchGame(id: string, signal?: AbortSignal) {
  return apiGet<Game>(`/games/${id}`, signal);
}

/** Страница каталога: GET /api/games?q=…&category=…&sort=… */
export function fetchGames(
  params: string,
  signal?: AbortSignal,
) {
  return apiGet<Page<Game>>(`/games?${params}`, signal);
}
