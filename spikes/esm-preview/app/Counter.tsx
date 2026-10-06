import { useState } from 'react';

let renders = 0;

export function Counter() {
  const [count, setCount] = useState(0);
  renders++;
  console.log('render Counter', renders);
  const list = ['a', 'b'];
  return (
    <main>
      <h1>Ход конём</h1>
      <button id="inc" onClick={() => setCount((n) => n + 1)}>Счёт: {count}</button>
      {/* намеренно без key — ждём предупреждение React */}
      <ul>{list.map((x) => <li>{x}</li>)}</ul>
      {count >= 3 && <Boom />}
    </main>
  );
}

function Boom(): never {
  throw new Error('Бум: ошибка при рендере');
}
