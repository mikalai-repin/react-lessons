import { createBrowserRouter, Link, Outlet, useLoaderData, useParams } from 'react-router';
import { Catalog } from './Catalog';
import { Counter } from './Counter';
import { useCart } from './cartStore';

function Layout() {
  const count = useCart((s) => s.items.length);
  return (
    <>
      <header>
        <Link to="/">Главная</Link> <Link to="/catalog">Каталог</Link> <Link to="/games/2">Игра 2</Link>{' '}
        <Link to="/admin">Админка</Link> <span id="cart-count">В корзине: {count}</span>
      </header>
      <Outlet />
    </>
  );
}

type Game = { id: number; title: string; price: number };

function GamePage() {
  const game = useLoaderData() as Game;
  const { id } = useParams();
  return <h1 id="game-title">Игра {id}: {game.title}</h1>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Counter /> },
      { path: 'catalog', element: <Catalog /> },
      {
        path: 'games/:id',
        loader: async ({ params }) => (await fetch(`/api/games/${params.id}`)).json(),
        element: <GamePage />,
      },
      { path: 'admin', lazy: async () => ({ Component: (await import('./admin/Admin')).Admin }) },
    ],
  },
]);
