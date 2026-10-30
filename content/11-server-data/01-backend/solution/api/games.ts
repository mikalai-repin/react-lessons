import { apiGet } from './client';
import type { Game } from './models';

// Запросы игр: адреса API в одном месте

/** Одна игра по id: GET /api/games/:id */
export function fetchGame(id: string, signal?: AbortSignal) {
  return apiGet<Game>(`/games/${id}`, signal);
}
