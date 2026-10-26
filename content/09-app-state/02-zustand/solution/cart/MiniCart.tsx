import { useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Game } from '../api/models';
import { Badge } from '../shared/Badge';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import type { ConfirmDialogHandle } from '../shared/ConfirmDialog';
import { formatPrice } from '../shared/format';
import { Section } from '../shared/Section';
import { useCartStore } from '../store/cartStore';
import styles from './MiniCart.module.css';

// С какой суммы доставка бесплатная, ₽
const FREE_DELIVERY = 5000;

type MiniCartProps = {
  games: Game[];
};

// Мини-корзина: позиции, итог и условие бесплатной доставки
export function MiniCart({ games }: MiniCartProps) {
  const items = useCartStore((state) => state.items);
  // Несколько значений разом: useShallow сравнивает объект по полям
  const { add, decrease, remove, clear } = useCartStore(
    useShallow((state) => ({
      add: state.add,
      decrease: state.decrease,
      remove: state.remove,
      clear: state.clear,
    })),
  );
  // Окно подтверждения: у ссылки — только метод open()
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  // Позиции вместе с играми: название, цена, остаток.
  // В корзину попадают только игры каталога — find найдёт игру всегда
  const lines = items.map((item) => ({
    ...item,
    game: games.find((game) => game.id === item.gameId)!,
  }));
  const count = lines.reduce(
    (sum, line) => sum + line.quantity,
    0,
  );
  const total = lines.reduce(
    (sum, line) => sum + line.game.price * line.quantity,
    0,
  );

  if (lines.length === 0) {
    return (
      <Section title="Корзина">
        <p className={`muted ${styles.empty}`}>
          Корзина пуста — добавьте игру из каталога
        </p>
      </Section>
    );
  }

  return (
    <Section
      title="Корзина"
      extra={<Badge tone="dark">{count}</Badge>}
    >
      <ul className={styles.list}>
        {lines.map(({ game, quantity }) => (
          <li key={game.id} className={styles.item}>
            <span className={styles.title}>{game.title}</span>
            <span className={styles.quantity}>
              <button
                type="button"
                className={styles.step}
                aria-label="Убрать одну"
                onClick={() => decrease(game.id)}
              >
                −
              </button>
              <output>{quantity}</output>
              <button
                type="button"
                className={styles.step}
                aria-label="Добавить ещё"
                disabled={quantity >= game.inStock}
                onClick={() => add(game.id)}
              >
                +
              </button>
            </span>
            <span className={styles.sum}>
              {formatPrice(game.price * quantity)}
            </span>
            <button
              type="button"
              className={styles.step}
              aria-label={`Убрать «${game.title}»`}
              onClick={() => remove(game.id)}
            >
              ×
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.total}>
        Итого: {formatPrice(total)}
      </p>
      <p className={`muted ${styles.delivery}`}>
        {total >= FREE_DELIVERY
          ? 'Доставка бесплатно'
          : `До бесплатной доставки — ${formatPrice(FREE_DELIVERY - total)}`}
      </p>
      <button
        type="button"
        className={styles.clear}
        onClick={() => confirmRef.current?.open()}
      >
        Очистить корзину
      </button>
      <ConfirmDialog
        ref={confirmRef}
        title="Очистить корзину?"
        confirmText="Очистить"
        onConfirm={clear}
      >
        Все игры уберутся из корзины: {count} шт.
      </ConfirmDialog>
    </Section>
  );
}
