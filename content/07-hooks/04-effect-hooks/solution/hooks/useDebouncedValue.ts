import { useEffect, useState } from 'react';

// Значение с задержкой: догоняет value, когда оно не менялось delay мс.
// Пока value меняется чаще, хук возвращает прежнее значение
export function useDebouncedValue<T>(value: T, delay: number) {
  const [debounced, setDebounced] = useState(value);

  // Синхронизация с таймером: новое value — новый отсчёт
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
