import { Fragment } from 'react';
import type { Game } from '../api/models';
import { Badge } from './Badge';
import { Button } from './Button';
import { formatPrice } from './format';
import { isHit } from './gameRules';
import styles from './GameCard.module.css';

const MAX_RATING = 5;
const FEW_LEFT = 5;

type GameCardProps = {
  game: Game;
};

// Карточка игры в каталоге
export function GameCard({ game }: GameCardProps) {
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
          {isHit(game) && <Badge tone="dark">Хит</Badge>}
          {game.inStock > 0 && game.inStock <= FEW_LEFT && (
            <Badge tone="warning">
              Осталось {game.inStock} шт.
            </Badge>
          )}
        </div>
      </div>
      <h3 className={styles.cardTitle}>{game.title}</h3>
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
      <div
        className={styles.rating}
        role="img"
        aria-label={`Рейтинг ${game.rating} из ${MAX_RATING}`}
      >
        <div
          className={styles.ratingFill}
          style={{
            width: `${(game.rating / MAX_RATING) * 100}%`,
          }}
        />
      </div>
      {game.inStock === 0 ? (
        <Button disabled>Нет в наличии</Button>
      ) : (
        <Button>В корзину</Button>
      )}
    </article>
  );
}
