import { useFetcher } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import styles from './Footer.module.css';

// Подписи тем рассылки — для сообщения после подписки
const TOPICS: Record<string, string> = {
  new: 'новинки',
  sale: 'скидки',
};

// Подписка: action ресурсного маршрута /subscribe (без страницы)
export async function subscribeAction({
  request,
}: ActionFunctionArgs) {
  const data = await request.formData();
  const email = String(data.get('email'));
  const topic = String(data.get('topic'));
  // Неотмеченного флажка в FormData нет совсем
  const weekly = data.get('weekly') === 'on';
  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, topic, weekly }),
  });
  if (!response.ok) {
    const { message } = (await response.json()) as {
      message: string;
    };
    return { message };
  }
  return {
    message: `Подписка оформлена — ${email}: ${TOPICS[topic]}${weekly ? ', раз в неделю' : ''}`,
  };
}

// Подвал магазина: подписка на рассылку — без перехода со страницы
export function Footer() {
  // Свой «канал» к action: своё состояние и свои данные ответа
  const fetcher = useFetcher<typeof subscribeAction>();
  const busy = fetcher.state !== 'idle';

  return (
    <footer className={styles.footer}>
      <h2 className={styles.title}>Новости магазина</h2>
      <fetcher.Form
        method="post"
        action="/subscribe"
        className={styles.form}
      >
        <label>
          E-mail
          <input
            name="email"
            type="email"
            required
            className="search"
            placeholder="you@example.ru"
          />
        </label>
        <label>
          Что присылать
          <select
            name="topic"
            defaultValue="new"
            className="search"
          >
            <option value="new">Новинки</option>
            <option value="sale">Скидки</option>
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="weekly" defaultChecked />
          Не чаще раза в неделю
        </label>
        <button
          type="submit"
          className="button"
          disabled={busy}
        >
          {busy ? 'Подписываем…' : 'Подписаться'}
        </button>
      </fetcher.Form>
      {fetcher.data && (
        <p className={styles.done} role="status">
          {fetcher.data.message}
        </p>
      )}
    </footer>
  );
}
