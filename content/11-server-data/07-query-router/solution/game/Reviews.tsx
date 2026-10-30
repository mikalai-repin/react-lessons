import { useSuspenseQuery } from '@tanstack/react-query';
import { reviewsQuery } from '../api/games';
import { formatDate } from '../shared/format';
import { Rating } from '../shared/Rating';
import styles from './Reviews.module.css';

type ReviewsProps = {
  gameId: string;
};

// Отзывы об игре. Пока их нет в кэше, useSuspenseQuery
// приостанавливает компонент — ближайший Suspense показывает заглушку
export function Reviews({ gameId }: ReviewsProps) {
  const { data: list } = useSuspenseQuery(reviewsQuery(gameId));
  if (list.length === 0) {
    return <p className="muted">Отзывов пока нет.</p>;
  }
  return (
    <ul className={styles.list}>
      {list.map((review) => (
        <li key={review.id} className={styles.review}>
          <span className={styles.author}>{review.author}</span>{' '}
          <span className="muted">
            {formatDate(review.date)}
          </span>
          <Rating value={review.rating} size="sm" />
          <p>{review.text}</p>
        </li>
      ))}
    </ul>
  );
}

// Заглушка на время загрузки: серые полосы на месте отзывов
export function ReviewsSkeleton() {
  return (
    <ul className={styles.list} aria-label="Загружаем отзывы">
      <li className={`${styles.review} ${styles.skeleton}`} />
      <li className={`${styles.review} ${styles.skeleton}`} />
    </ul>
  );
}
