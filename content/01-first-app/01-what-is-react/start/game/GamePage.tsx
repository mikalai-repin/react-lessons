import {
  Link,
  useLoaderData,
  type LoaderFunctionArgs,
} from 'react-router';
import type { Game } from '../api/models';
import { useCartStore } from '../store/cartStore';

/** Роутер вызывает loader до показа страницы: компонент получает уже загруженную игру */
export async function gameLoader({
  params,
}: LoaderFunctionArgs): Promise<Game | null> {
  const response = await fetch(`/api/games/${params.id}`);
  return response.ok ? response.json() : null;
}

export function GamePage() {
  const game = useLoaderData<typeof gameLoader>();
  const add = useCartStore((state) => state.add);

  if (!game) {
    return (
      <>
        <Link to="/">← В каталог</Link>
        <h1>Игра не найдена</h1>
      </>
    );
  }
  return (
    <>
      <title>{`${game.title} — Ход конём`}</title>
      <Link to="/">← В каталог</Link>
      <h1>{game.title}</h1>
      <p>{game.description}</p>
      <p className="muted">
        Игроков: {game.players.min}–{game.players.max} ·{' '}
        {game.playTime} мин · {game.age}+
      </p>
      <button
        className="button"
        disabled={game.inStock === 0}
        onClick={() => add(game)}
      >
        В корзину — {game.price} ₽
      </button>
    </>
  );
}
