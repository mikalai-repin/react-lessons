import type { Game } from '../api/models';
import { Button } from '../shared/Button';
import { formatPrice } from '../shared/format';
import { Rating } from '../shared/Rating';
import styles from './GameDetails.module.css';

type GameDetailsProps = {
  game: Game;
  // Сколько штук уже в корзине
  quantity: number;
  onAdd: () => void;
  // Вернуться в каталог
  onClose: () => void;
};

// Страница игры: обложка, сведения, описание и кнопка «В корзину»
export function GameDetails({
  game,
  quantity,
  onAdd,
  onClose,
}: GameDetailsProps) {
  const { min, max } = game.players;
  const players = min === max ? `${min}` : `${min}–${max}`;

  return (
    <article className={styles.details}>
      <button
        type="button"
        className={styles.back}
        onClick={onClose}
      >
        ← К каталогу
      </button>
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
    </article>
  );
}
