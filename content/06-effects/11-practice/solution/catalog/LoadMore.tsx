import { useEffect, useEffectEvent, useRef } from 'react';
import { Button } from '../shared/Button';
import styles from './LoadMore.module.css';

type LoadMoreProps = {
  // Показать следующую порцию
  onLoad: () => void;
};

// «Показать ещё» под сеткой: порция подгружается сама, когда покупатель
// докрутил до конца, или по кнопке
export function LoadMore({ onLoad }: LoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  // Свежий onLoad без перезапуска наблюдения
  const onVisible = useEffectEvent(() => onLoad());

  // Синхронизация с IntersectionObserver: следим, видна ли полоса
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onVisible();
    });
    observer.observe(ref.current!);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={styles.loadMore}>
      <Button onClick={onLoad}>Показать ещё</Button>
    </div>
  );
}
