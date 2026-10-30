import { useState } from 'react';
import {
  Form,
  redirect,
  useActionData,
  useBlocker,
  useNavigation,
} from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { Button } from '../shared/Button';
import { formatPrice } from '../shared/format';
import { Section } from '../shared/Section';
import { summarizeCart } from '../store/cartSelectors';
import { useCartStore } from '../store/cartStore';
import styles from './CheckoutPage.module.css';

// Отправка формы: роутер вызывает action с данными формы.
// Корзину берём прямо из стора — он живёт вне React
export async function checkoutAction({
  request,
}: ActionFunctionArgs) {
  const form = await request.formData();
  const { items, promo } = useCartStore.getState();
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      // Серверу — только id и количество: цены он знает сам
      items: items.map(({ game, quantity }) => ({
        gameId: game.id,
        quantity,
      })),
      promo,
      customer: {
        name: form.get('name'),
        email: form.get('email'),
        address: form.get('address'),
      },
    }),
  });
  if (!response.ok) {
    // Ошибку сервера вернём странице: её прочитает useActionData
    const { message } = (await response.json()) as {
      message: string;
    };
    return { error: message };
  }
  const order = (await response.json()) as { id: number };
  useCartStore.getState().clear();
  // Заказ принят — уводим на страницу «Заказ оформлен»
  return redirect(`/checkout/done?order=${order.id}`);
}

// Оформление заказа: итог и форма покупателя
export function CheckoutPage() {
  const items = useCartStore((state) => state.items);
  const promo = useCartStore((state) => state.promo);
  const { count, payable } = summarizeCart(items, promo);
  // Что вернул action: undefined — форму ещё не отправляли
  const actionData = useActionData<typeof checkoutAction>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  // Покупатель начал заполнять форму
  const [dirty, setDirty] = useState(false);
  // Уход на другую страницу с заполненной формой — спросить.
  // Отправка (тот же адрес /checkout) не блокируется
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      currentLocation.pathname !== nextLocation.pathname,
  );

  return (
    <Section title="Оформление заказа">
      <p className={styles.summary}>
        {count} шт. на {formatPrice(payable)}
      </p>
      {/* Form роутера: отправку перехватит action этого маршрута */}
      {blocker.state === 'blocked' && (
        <div className={styles.leave} role="alertdialog">
          <p>Уйти? Введённые данные пропадут.</p>
          <Button onClick={() => blocker.proceed()}>
            Уйти
          </Button>
          <Button onClick={() => blocker.reset()}>
            Остаться
          </Button>
        </div>
      )}
      <Form
        method="post"
        className={styles.form}
        onChange={() => setDirty(true)}
      >
        <label className={styles.field}>
          Имя
          <input name="name" className="search" required />
        </label>
        <label className={styles.field}>
          E-mail
          <input
            name="email"
            type="email"
            className="search"
            required
          />
        </label>
        <label className={styles.field}>
          Адрес доставки
          <textarea
            name="address"
            className="search"
            required
          />
        </label>
        {actionData?.error && (
          <p className={styles.error} role="alert">
            {actionData.error}
          </p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Отправляем…' : 'Заказать'}
        </Button>
      </Form>
    </Section>
  );
}
