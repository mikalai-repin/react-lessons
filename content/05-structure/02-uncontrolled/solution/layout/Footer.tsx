import { useState } from 'react';
import type { SubmitEvent } from 'react';
import styles from './Footer.module.css';

// Подписи тем рассылки — для сообщения после подписки
const TOPICS: Record<string, string> = {
  new: 'новинки',
  sale: 'скидки',
};

// Подвал магазина: подписка на рассылку
export function Footer() {
  // Итог подписки для сообщения; null — ещё не подписались
  const [result, setResult] = useState<string | null>(null);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    // Значения полей читаем из формы в момент отправки
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email'));
    const topic = TOPICS[String(data.get('topic'))];
    // Неотмеченного флажка в FormData нет совсем
    const weekly = data.get('weekly') === 'on';
    setResult(
      `${email}: ${topic}${weekly ? ', раз в неделю' : ''}`,
    );
    form.reset();
  }

  return (
    <footer className={styles.footer}>
      <h2 className={styles.title}>Новости магазина</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
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
        <button type="submit" className="button">
          Подписаться
        </button>
      </form>
      {result && (
        <p className={styles.done}>
          Подписка оформлена — {result}
        </p>
      )}
    </footer>
  );
}
