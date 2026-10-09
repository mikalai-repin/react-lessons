import { useOnlineStatus } from '../hooks/useOnlineStatus';
import styles from './OfflineBanner.module.css';

// Полоса «Нет сети» над магазином
export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p className={styles.banner} role="alert">
      Нет сети — проверьте подключение к интернету
    </p>
  );
}
