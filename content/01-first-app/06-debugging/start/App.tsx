import styles from './App.module.css';

// Хиты продаж придут с сервера, а пока список пуст
const hits: string[] = [];

export function App() {
  return (
    <main className={styles.page}>
      <h1 className={styles.title}>♞ Ход конём</h2>
      <p className="muted">Магазин настольных игр</p>
      <p>Хит недели: {hits[0].toUpperCase()}</p>
    </main>
  );
}
