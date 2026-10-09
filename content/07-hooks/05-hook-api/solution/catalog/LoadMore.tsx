import { useRef } from 'react';
import { useInView } from '../hooks/useInView';
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
  useInView(ref, onLoad);

  return (
    <div ref={ref} className={styles.loadMore}>
      <Button onClick={onLoad}>Показать ещё</Button>
    </div>
  );
}
