import { Fragment } from 'react';
import type { Game } from '../api/models';
import { Badge } from './Badge';
import { Button } from './Button';
import { formatPrice } from './format';
import { isHit } from './gameRules';
import { Rating } from './Rating';
import { Tooltip } from './Tooltip';
import styles from './GameCard.module.css';

const FEW_LEFT = 5;

type GameCardProps = {
  game: Game;
  // Сколько штук уже в корзине
  quantity: number;
  // Покупатель нажал «В корзину»
  onAdd: () => void;
  // Покупатель открыл страницу игры
  onSelect: () => void;
};

// Карточка игры в каталоге
export function GameCard({
  game,
  quantity,
  onAdd,
  onSelect,
}: GameCardProps) {
  const { min, max } = game.players;
  // Характеристики карточки: пары «термин — значение»
  const specs = [
    {
      label: 'Игроки',
      value: min === max ? `${min}` : `${min}–${max}`,
    },
    { label: 'Время', value: `${game.playTime} мин` },
    { label: 'Возраст', value: `${game.age}+` },
  ];
  const discount =
    game.oldPrice === undefined
      ? 0
      : Math.round((1 - game.price / game.oldPrice) * 100);

  return (
    <article
      className={styles.card}
      data-category={game.category}
    >
      <div className={styles.media}>
        <img
          className={styles.cover}
          src={game.cover}
          alt={game.title}
        />
        <div className={styles.badges}>
          {discount > 0 && <Badge>−{discount}%</Badge>}
          {isHit(game) && (
            <Tooltip text="Рейтинг 4,6 и выше: эту игру выбирают чаще всего">
              <Badge tone="dark">Хит</Badge>
            </Tooltip>
          )}
          {game.inStock > 0 && game.inStock <= FEW_LEFT && (
            <Badge tone="warning">
              Осталось {game.inStock} шт.
            </Badge>
          )}
        </div>
      </div>
      <h3 className={styles.cardTitle}>
        <button
          type="button"
          className={styles.titleButton}
          onClick={onSelect}
        >
          {game.title}
        </button>
      </h3>
      <p className={styles.price}>
        {formatPrice(game.price)}
        {game.oldPrice !== undefined && (
          <s className={`muted ${styles.oldPrice}`}>
            {formatPrice(game.oldPrice)}
          </s>
        )}
      </p>
      <dl className={styles.specs}>
        {specs.map((spec) => (
          <Fragment key={spec.label}>
            <dt>{spec.label}</dt>
            <dd>{spec.value}</dd>
          </Fragment>
        ))}
      </dl>
      <ul className={styles.tags}>
        {game.tags.map((tag) => (
          <li key={tag}>#{tag}</li>
        ))}
      </ul>
      <Rating value={game.rating} size="sm" />
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
    </article>
  );
}
