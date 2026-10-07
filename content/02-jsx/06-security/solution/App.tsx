import { Fragment } from 'react';
import { games } from './data/games';
import { formatPrice } from './shared/format';
import styles from './App.module.css';

const MAX_RATING = 5;
// Текст акции готовят маркетологи в своей системе — с HTML-разметкой
const PROMO_HTML =
  'Неделя семейных игр: скидки до <b>20%</b> на «Остров сокровищ» и «Нарды»';

export function App() {
  return (
    <>
      <header className={styles.header}>
        <h1 className={styles.title}>♞ Ход конём</h1>
        <p className="muted">
          Магазин настольных игр · в каталоге {games.length} игр
        </p>
      </header>

      <main className={styles.page}>
        <p
          className={styles.promo}
          dangerouslySetInnerHTML={{ __html: PROMO_HTML }}
        />
        <div className="grid">
          {games.map((game) => {
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

            return (
              <article
                key={game.id}
                className={styles.card}
                data-category={game.category}
              >
                <img
                  className={styles.cover}
                  src={game.cover}
                  alt={game.title}
                />
                <h2 className={styles.cardTitle}>
                  {game.title}
                </h2>
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
                  <p className={styles.soldOut}>
                    Нет в наличии
                  </p>
                ) : (
                  <button className="button">В корзину</button>
                )}
              </article>
            );
          })}
        </div>
      </main>
    </>
  );
}
