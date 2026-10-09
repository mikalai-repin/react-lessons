import { useEffect, useEffectEvent, useState } from 'react';
import type { SubmitEvent } from 'react';
import type { Game } from '../api/models';
import { SALE_ENDS } from '../data/sale';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { track } from '../shared/analytics';
import { Button } from '../shared/Button';
import { Countdown } from '../shared/Countdown';
import { formatPrice } from '../shared/format';
import { Rating } from '../shared/Rating';
import styles from './GameDetails.module.css';

// Самый длинный отзыв, символов
const REVIEW_MAX = 300;
// Просмотр засчитываем, если покупатель пробыл на странице 3 с
const VIEW_DELAY = 3000;

type GameDetailsProps = {
  game: Game;
  // Сколько штук уже в корзине
  quantity: number;
  onAdd: () => void;
  // Вернуться в каталог
  onClose: () => void;
  // Открыть следующую игру каталога
  onNext: () => void;
};

// Страница игры: обложка, сведения, описание и кнопка «В корзину»
export function GameDetails({
  game,
  quantity,
  onAdd,
  onClose,
  onNext,
}: GameDetailsProps) {
  const { min, max } = game.players;
  const players = min === max ? `${min}` : `${min}–${max}`;
  // Черновик отзыва — свой у каждой игры, переживает перезапуск
  const [review, setReview] = useLocalStorage(
    `review-draft:${game.id}`,
    '',
  );
  // Отправлен ли отзыв
  const [sent, setSent] = useState(false);

  // Событие «просмотр»: читает свежее quantity, но не зависит от него
  const onView = useEffectEvent((gameId: number) => {
    track('просмотр', { gameId, inCart: quantity });
  });

  // Синхронизация с аналитикой: страница игры показана 3 с
  useEffect(() => {
    const id = setTimeout(() => onView(game.id), VIEW_DELAY);
    return () => clearTimeout(id);
  }, [game.id]);

  function handleReviewSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setReview('');
    setSent(true);
  }

  return (
    <article className={styles.details}>
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.back}
          onClick={onClose}
        >
          ← К каталогу
        </button>
        <button
          type="button"
          className={styles.back}
          onClick={onNext}
        >
          Следующая игра →
        </button>
      </div>
      <div className={styles.body}>
        <img
          className={styles.cover}
          src={game.cover}
          alt={game.title}
        />
        <div>
          <h2 className={styles.title}>{game.title}</h2>
          <p className={`muted ${styles.info}`}>
            Игроки: {players} · {game.playTime} мин · {game.age}
            +
          </p>
          <Rating value={game.rating} />
          <p className={styles.price}>
            {formatPrice(game.price)}
          </p>
          {game.oldPrice !== undefined && (
            <Countdown deadline={SALE_ENDS} />
          )}
          {game.inStock === 0 ? (
            <Button disabled>Нет в наличии</Button>
          ) : (
            <Button
              onClick={onAdd}
              disabled={quantity >= game.inStock}
            >
              В корзину
            </Button>
          )}
          {quantity > 0 && (
            <p className={styles.inCart}>
              В корзине: {quantity} шт.
            </p>
          )}
        </div>
      </div>
      <p className={styles.description}>{game.description}</p>
      <form
        className={styles.review}
        onSubmit={handleReviewSubmit}
      >
        <label htmlFor="review">Ваш отзыв об игре</label>
        <textarea
          id="review"
          className="search"
          maxLength={REVIEW_MAX}
          value={review}
          onChange={(e) => setReview(e.target.value)}
        />
        <div className={styles.reviewFooter}>
          <span>
            {review.length} / {REVIEW_MAX}
          </span>
          <Button type="submit" disabled={review.trim() === ''}>
            Отправить
          </Button>
        </div>
      </form>
      {sent && (
        <p className={styles.thanks}>
          Спасибо! Отзыв появится после проверки.
        </p>
      )}
    </article>
  );
}
