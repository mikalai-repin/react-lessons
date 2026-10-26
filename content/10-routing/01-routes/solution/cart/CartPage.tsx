import { games } from '../data/games';
import { MiniCart } from './MiniCart';

// Страница корзины
export function CartPage() {
  return <MiniCart games={games} />;
}
