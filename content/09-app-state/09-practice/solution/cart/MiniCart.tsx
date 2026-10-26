import { useRef, useState } from 'react';
import type { SubmitEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Game } from '../api/models';
import { Badge } from '../shared/Badge';
import { Button } from '../shared/Button';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import type { ConfirmDialogHandle } from '../shared/ConfirmDialog';
import { formatPrice } from '../shared/format';
import { Section } from '../shared/Section';
import { summarizeCart } from '../store/cartSelectors';
import { useCartStore } from '../store/cartStore';
import styles from './MiniCart.module.css';

type MiniCartProps = {
  games: Game[];
};

// Мини-корзина: позиции, итог и условие бесплатной доставки
export function MiniCart({ games }: MiniCartProps) {
  const items = useCartStore((state) => state.items);
  const promo = useCartStore((state) => state.promo);
  // Несколько значений разом: useShallow сравнивает объект по полям
  const { add, decrease, remove, clear, applyPromo } =
    useCartStore(
      useShallow((state) => ({
        add: state.add,
        decrease: state.decrease,
        remove: state.remove,
        clear: state.clear,
        applyPromo: state.applyPromo,
      })),
    );
  // Окно подтверждения: у ссылки — только метод open()
  const confirmRef = useRef<ConfirmDialogHandle>(null);
  // Ошибка промокода — забота только этой формы
  const [promoError, setPromoError] = useState<string | null>(
    null,
  );
  // Итоги считаем при рендере из выбранных позиций
  const {
    lines,
    count,
    total,
    savings,
    toFreeDelivery,
    promoDiscount,
    payable,
  } = summarizeCart(items, games, promo);

  function handlePromoSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    const code = new FormData(e.currentTarget).get('promo');
    setPromoError(applyPromo(String(code)));
  }

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
      {savings > 0 && (
        <p className={`muted ${styles.delivery}`}>
          Скидка по акции: {formatPrice(savings)}
        </p>
      )}
      {promo !== null && (
        <>
          <p className={`muted ${styles.delivery}`}>
            Промокод {promo}: −{formatPrice(promoDiscount)}
          </p>
          <p className={styles.total}>
            К оплате: {formatPrice(payable)}
          </p>
        </>
      )}
      {promo === null && (
        <form
          className={styles.promo}
          onSubmit={handlePromoSubmit}
        >
          <input
            name="promo"
            className="search"
            placeholder="Промокод"
            aria-label="Промокод"
          />
          <Button type="submit">Применить</Button>
        </form>
      )}
      {promoError !== null && (
        <p className={styles.promoError} role="alert">
          {promoError}
        </p>
      )}
      <p className={`muted ${styles.delivery}`}>
        {toFreeDelivery === 0
          ? 'Доставка бесплатно'
          : `До бесплатной доставки — ${formatPrice(toFreeDelivery)}`}
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
