import { useCartStore } from '../store/cartStore';
import styles from './CartToast.module.css';

// Уведомление «Добавлено: …» внизу окна
export function CartToast() {
  const toast = useCartStore((state) => state.toast);
  if (toast === null) return null;
  return (
    <p className={styles.toast} role="status">
      {toast}
    </p>
  );
}
