import { games } from './data/games';
import { Header } from './layout/Header';
import { GameCard } from './shared/GameCard';
import styles from './App.module.css';

// Текст акции готовят маркетологи в своей системе — с HTML-разметкой
const PROMO_HTML =
  'Неделя семейных игр: скидки до <b>20%</b> на «Остров сокровищ» и «Нарды»';

export function App() {
  return (
    <>
      <Header count={games.length} />

      <main className={styles.page}>
        <p
          className={styles.promo}
          dangerouslySetInnerHTML={{ __html: PROMO_HTML }}
        />
        <div className="grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </main>
    </>
  );
}
