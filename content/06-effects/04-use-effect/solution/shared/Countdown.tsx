import { useEffect, useState } from 'react';
import { formatDuration } from './format';
import styles from './Countdown.module.css';

type CountdownProps = {
  // Когда закончится, мс (как Date.now())
  deadline: number;
};

// Обратный отсчёт до конца акции: «Скидка действует ещё 1:59:58»
export function Countdown({ deadline }: CountdownProps) {
  // Текущее время: обновляем раз в секунду
  const [now, setNow] = useState(() => Date.now());
  const finished = now >= deadline;

  // Синхронизация с внешней системой — таймером браузера
  useEffect(() => {
    // Акция закончилась — таймер больше не нужен
    if (finished) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    // Очистка: перед следующим запуском и при уходе со страницы
    return () => clearInterval(id);
  }, [finished]);

  return (
    <p className={styles.countdown}>
      {finished
        ? 'Акция закончилась'
        : `Скидка действует ещё ${formatDuration(deadline - now)}`}
    </p>
  );
}
