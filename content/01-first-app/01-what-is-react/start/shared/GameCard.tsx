import { Link } from 'react-router';
import type { Game } from '../api/models';
import styles from './GameCard.module.css';

interface GameCardProps {
  game: Game;
  onAdd: (game: Game) => void;
}

export function GameCard({ game, onAdd }: GameCardProps) {
  const soldOut = game.inStock === 0;
  return (
    <article className={styles.card}>
      <Link to={`/games/${game.id}`}>
        <img
          className={styles.cover}
          src={game.cover}
          alt={game.title}
        />
      </Link>
      <div className={styles.title}>{game.title}</div>
      <div>
        {game.price} ₽{' '}
        {game.oldPrice && (
          <s className="muted">{game.oldPrice} ₽</s>
        )}
      </div>
      <button
        className="button"
        disabled={soldOut}
        onClick={() => onAdd(game)}
      >
        {soldOut ? 'Нет в наличии' : 'В корзину'}
      </button>
    </article>
  );
}
