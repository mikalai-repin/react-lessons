import styles from './Rating.module.css';

type RatingProps = {
  value: number;
  max?: number;
  size?: 'sm' | 'md';
};

// Рейтинг звёздами: показывает значение, менять его пока нельзя
export function Rating({
  value,
  max = 5,
  size = 'md',
}: RatingProps) {
  const filled = Math.round(value);
  // true — закрашенная звезда, false — пустая. Звёзды не переставляются
  // и не хранят состояния, поэтому ключ — индекс
  const stars = Array.from(
    { length: max },
    (_, i) => i < filled,
  );

  return (
    <span
      className={`${styles.rating} ${styles[size]}`}
      role="img"
      aria-label={`Рейтинг ${value} из ${max}`}
    >
      {stars.map((on, i) => (
        <span key={i} className={on ? styles.on : styles.off}>
          ★
        </span>
      ))}
      <span className={styles.value}>{value}</span>
    </span>
  );
}
