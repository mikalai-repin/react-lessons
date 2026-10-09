import { useCountdown } from '../hooks/useCountdown';
import { formatDuration } from './format';
import styles from './Countdown.module.css';

type CountdownProps = {
  // Когда закончится, мс (как Date.now())
  deadline: number;
};

// Обратный отсчёт до конца акции: «Скидка действует ещё 1:59:58»
export function Countdown({ deadline }: CountdownProps) {
  const { remaining, finished } = useCountdown(deadline);

  return (
    <p className={styles.countdown}>
      {finished
        ? 'Акция закончилась'
        : `Скидка действует ещё ${formatDuration(remaining)}`}
    </p>
  );
}
