import { useState } from 'react';
import {
  keepPreviousData,
  useQuery,
} from '@tanstack/react-query';
import type { Game, Page } from '../api/models';
import { GameCard } from '../shared/GameCard';
import { useCartStore } from '../store/cartStore';

async function fetchGames(
  query: string,
  signal: AbortSignal,
): Promise<Page<Game>> {
  const response = await fetch(
    `/api/games?q=${encodeURIComponent(query)}`,
    { signal },
  );
  if (!response.ok)
    throw new Error(`Ошибка ${response.status}`);
  return response.json();
}

export function Catalog() {
  const [query, setQuery] = useState('');
  // Запрос перезапускается сам, когда меняется ключ (в нём —
  // строка поиска); устаревший запрос Query отменяет через signal
  const games = useQuery({
    queryKey: ['games', query],
    queryFn: ({ signal }) => fetchGames(query, signal),
    placeholderData: keepPreviousData,
  });
  const add = useCartStore((state) => state.add);

  return (
    <>
      {/* React 19 переносит <title> из компонента в <head> */}
      <title>Каталог — Ход конём</title>
      <h1>Каталог</h1>
      <input
        className="search"
        placeholder="Поиск"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      {games.isPending ? (
        <p className="muted">Загружаем каталог…</p>
      ) : games.isError ? (
        <p>
          Не удалось загрузить каталог.{' '}
          <button
            className="button"
            onClick={() => games.refetch()}
          >
            Повторить
          </button>
        </p>
      ) : (
        <>
          <p className="muted">
            Найдено игр: {games.data.total}
          </p>
          <div className="grid">
            {games.data.items.map((game) => (
              <GameCard key={game.id} game={game} onAdd={add} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
