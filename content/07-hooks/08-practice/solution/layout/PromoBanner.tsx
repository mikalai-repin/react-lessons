import { SALE_ENDS } from '../data/sale';
import { useCountdown } from '../hooks/useCountdown';
import { formatDuration } from '../shared/format';
import styles from './PromoBanner.module.css';

// Текст акции готовят маркетологи в своей системе — с HTML-разметкой
const PROMO_HTML =
  'Неделя семейных игр: скидки до <b>20%</b> на «Остров сокровищ» и «Нарды»';

// Баннер акции над каталогом; акция закончилась — баннера нет
export function PromoBanner() {
  const { remaining, finished } = useCountdown(SALE_ENDS);
  if (finished) return null;

  return (
    <div className={styles.promo}>
      <p dangerouslySetInnerHTML={{ __html: PROMO_HTML }} />
      <p className={styles.timer}>
        До конца акции — {formatDuration(remaining)}
      </p>
    </div>
  );
}
