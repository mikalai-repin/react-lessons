import { useState } from 'react';
import type { SubmitEvent } from 'react';
import {
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { postReview, reviewsQuery } from '../api/games';
import type { NewReview } from '../api/models';
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
  const queryClient = useQueryClient();
  // Ключ из queryOptions помнит тип данных: Review[]
  const { queryKey } = reviewsQuery(gameId);
  // Мутация — запрос, который меняет данные на сервере
  const addReview = useMutation({
    mutationFn: (review: NewReview) =>
      postReview(gameId, review),
    // До запроса: отзыв — в кэш сразу, как будто сервер уже принял
    onMutate: async (review) => {
      // Ответ идущего запроса списка затёр бы наш отзыв — отменяем
      await queryClient.cancelQueries({ queryKey });
      // Список до изменения — для отката
      const previous = queryClient.getQueryData(queryKey);
      queryClient.setQueryData(queryKey, (list = []) => [
        ...list,
        {
          ...review,
          id: -Date.now(),
          gameId: Number(gameId),
          author: 'Гость',
          date: new Date().toISOString().slice(0, 10),
        },
      ]);
      // Что вернул onMutate, получат onError и onSettled
      return { previous };
    },
    // Сервер отказал — вернуть список, каким он был
    onError: (_error, _review, result) => {
      queryClient.setQueryData(queryKey, result?.previous);
    },
    // Принят отзыв или нет — сверить список с сервером.
    // Без return: отзыв уже на экране, ждать сверки незачем
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    // Черновик стираем, только когда сервер принял отзыв
    addReview.mutate(
      { rating, text },
      { onSuccess: () => setText('') },
    );
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
        <Button
          type="submit"
          disabled={text.trim() === '' || addReview.isPending}
        >
          {addReview.isPending ? 'Отправляем…' : 'Отправить'}
        </Button>
      </div>
      {addReview.isSuccess && (
        <p className={styles.thanks}>Спасибо за отзыв!</p>
      )}
      {addReview.isError && (
        <p className={styles.error} role="alert">
          Не удалось отправить: {addReview.error.message}
        </p>
      )}
    </form>
  );
}
