import { Link } from 'react-router';
import { games } from '../data/games';
import { useCartStore } from '../store/cartStore';
import { MiniCart } from './MiniCart';

// Страница корзины: позиции и переход к оформлению
export function CartPage() {
  const isEmpty = useCartStore(
    (state) => state.items.length === 0,
  );
  return (
    <>
      <MiniCart games={games} />
      {!isEmpty && (
        <Link to="/checkout" className="button">
          Оформить заказ
        </Link>
      )}
    </>
  );
}
