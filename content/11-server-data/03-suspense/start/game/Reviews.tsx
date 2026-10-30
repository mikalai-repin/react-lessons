import styles from './Reviews.module.css';

// TODO: компонент Reviews — список отзывов из промиса

// Заглушка на время загрузки: серые полосы на месте отзывов
export function ReviewsSkeleton() {
  return (
    <ul className={styles.list} aria-label="Загружаем отзывы">
      <li className={`${styles.review} ${styles.skeleton}`} />
      <li className={`${styles.review} ${styles.skeleton}`} />
    </ul>
  );
}
