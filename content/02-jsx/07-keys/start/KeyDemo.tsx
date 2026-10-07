import { useState } from 'react';
import { games } from './data/games';

// Демо к шагу «Под капотом: почему key».
// useState и onClick — тема главы 4. Здесь достаточно знать:
// кнопка переворачивает список, и React перерисовывает его
export function KeyDemo() {
  const [list, setList] = useState(games.slice(0, 4));

  function handleReverseClick() {
    setList(list.toReversed());
  }

  return (
    <main style={{ padding: 16 }}>
      <h1>Заметки к играм</h1>
      <button className="button" onClick={handleReverseClick}>
        Перевернуть список
      </button>
      <ol>
        {list.map((game, index) => (
          <li key={index}>
            <label>
              {game.title} <input placeholder="Заметка" />
            </label>
          </li>
        ))}
      </ol>
    </main>
  );
}
