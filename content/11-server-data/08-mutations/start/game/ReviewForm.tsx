import { useState } from 'react';
import type { SubmitEvent } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Button } from '../shared/Button';
import styles from './ReviewForm.module.css';

// Самый длинный отзыв, символов
const REVIEW_MAX = 300;
// Оценки на выбор: от лучшей к худшей
const RATINGS = [5, 4, 3, 2, 1];

type ReviewFormProps = {
  gameId: string;
};

// Форма отзыва об игре: оценка и текст
export function ReviewForm({ gameId }: ReviewFormProps) {
  // Черновик отзыва — свой у каждой игры, переживает перезапуск
  const [text, setText] = useLocalStorage(
    `review-draft:${gameId}`,
    '',
  );
  const [rating, setRating] = useState(5);
  // Отправлен ли отзыв
  const [sent, setSent] = useState(false);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setText('');
    setSent(true);
  }

  return (
    <form className={styles.review} onSubmit={handleSubmit}>
      <label htmlFor="review">Ваш отзыв об игре</label>
      <textarea
        id="review"
        className="search"
        maxLength={REVIEW_MAX}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className={styles.reviewFooter}>
        <span className={styles.meta}>
          <select
            className="search"
            aria-label="Оценка"
            value={rating}
            onChange={(e) => setRating(Number(e.target.value))}
          >
            {RATINGS.map((value) => (
              <option key={value} value={value}>
                {'★'.repeat(value)}
              </option>
            ))}
          </select>
          {text.length} / {REVIEW_MAX}
        </span>
        <Button type="submit" disabled={text.trim() === ''}>
          Отправить
        </Button>
      </div>
      {sent && (
        <p className={styles.thanks}>
          Спасибо! Отзыв появится после проверки.
        </p>
      )}
    </form>
  );
}
