import { useSyncExternalStore } from 'react';
import styles from './OfflineBanner.module.css';

// Подписка: браузер сообщает о смене сети событиями online и offline.
// Возвращает функцию отписки
function subscribe(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

// Снимок: есть ли сеть прямо сейчас
function getSnapshot() {
  return navigator.onLine;
}

// Полоса «Нет сети» над магазином
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot);
  if (online) return null;
  return (
    <p className={styles.banner} role="alert">
      Нет сети — проверьте подключение к интернету
    </p>
  );
}
