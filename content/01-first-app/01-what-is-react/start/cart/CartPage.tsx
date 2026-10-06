import { cartTotal, useCartStore } from '../store/cartStore';

export function CartPage() {
  const items = useCartStore((state) => state.items);
  const total = useCartStore(cartTotal);
  const remove = useCartStore((state) => state.remove);

  return (
    <>
      <title>Корзина — Ход конём</title>
      <h1>Корзина</h1>
      {items.length === 0 && (
        <p className="muted">Корзина пуста</p>
      )}
      {items.map((item) => (
        <p key={item.game.id}>
          {item.game.title} × {item.quantity}{' '}
          <button
            className="button"
            onClick={() => remove(item.game.id)}
          >
            Убрать
          </button>
        </p>
      ))}
      <p>
        <b>Итого: {total} ₽</b>
      </p>
    </>
  );
}
