import { useEffect, useState } from 'react';

// Что показывает обратный отсчёт
type Countdown = {
  // Сколько осталось, мс; 0 — время вышло
  remaining: number;
  finished: boolean;
};

// Обратный отсчёт до deadline (мс, как Date.now()): раз в секунду
export function useCountdown(deadline: number): Countdown {
  // Текущее время: обновляем раз в секунду
  const [now, setNow] = useState(() => Date.now());
  const finished = now >= deadline;

  // Синхронизация с таймером браузера, пока время не вышло
  useEffect(() => {
    if (finished) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [finished]);

  return { remaining: Math.max(deadline - now, 0), finished };
}
