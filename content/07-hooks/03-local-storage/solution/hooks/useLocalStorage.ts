import { useState } from 'react';

// Состояние, которое переживает перезапуск: значение хранится
// в localStorage браузера под ключом key
export function useLocalStorage<T>(
  key: string,
  initialValue: T,
) {
  // Начальное значение — из хранилища, если там что-то есть
  const [value, setValue] = useState<T>(() => {
    const saved = localStorage.getItem(key);
    return saved === null
      ? initialValue
      : (JSON.parse(saved) as T);
  });

  // Новое значение — и в состояние, и в хранилище
  function setStoredValue(next: T) {
    setValue(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  return [value, setStoredValue] as const;
}
