import { useSyncExternalStore } from 'react';

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

// Есть ли сеть: значение браузера с подпиской на изменения
export function useOnlineStatus() {
  return useSyncExternalStore(subscribe, getSnapshot);
}
