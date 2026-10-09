import { useRef } from 'react';
import type { CartItem, Game } from '../api/models';
import { Badge } from '../shared/Badge';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import type { ConfirmDialogHandle } from '../shared/ConfirmDialog';
import { formatPrice } from '../shared/format';
import { Section } from '../shared/Section';
import styles from './MiniCart.module.css';

// С какой суммы доставка бесплатная, ₽
const FREE_DELIVERY = 5000;

type MiniCartProps = {
  items: CartItem[];
  games: Game[];
  onIncrease: (gameId: number) => void;
  onDecrease: (gameId: number) => void;
  onRemove: (gameId: number) => void;
  // Покупатель подтвердил очистку корзины
  onClear: () => void;
};

// Мини-корзина: позиции, итог и условие бесплатной доставки
export function MiniCart({
  items,
  games,
  onIncrease,
  onDecrease,
  onRemove,
  onClear,
}: MiniCartProps) {
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
                onClick={() => onDecrease(game.id)}
              >
                −
              </button>
              <output>{quantity}</output>
              <button
                type="button"
                className={styles.step}
                aria-label="Добавить ещё"
                disabled={quantity >= game.inStock}
                onClick={() => onIncrease(game.id)}
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
              onClick={() => onRemove(game.id)}
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
        onConfirm={onClear}
      >
        Все игры уберутся из корзины: {count} шт.
      </ConfirmDialog>
    </Section>
  );
}
