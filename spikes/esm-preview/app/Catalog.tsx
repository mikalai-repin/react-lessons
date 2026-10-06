import { useQuery } from '@tanstack/react-query';
import { useCart } from './cartStore';
import styles from './Catalog.module.css';

type Game = { id: number; title: string; price: number };

export function Catalog() {
  const { data, isPending } = useQuery({
    queryKey: ['games'],
    queryFn: async (): Promise<Game[]> => (await fetch('/api/games')).json(),
  });
  const add = useCart((s) => s.add);
  if (isPending) return <p>Загрузка…</p>;
  return (
    <ul className={styles.list}>
      {data!.map((g) => (
        <li key={g.id} className={styles.item}>
          {g.title} — {g.price} ₽ <button className="add" onClick={() => add(g.id)}>В корзину</button>
        </li>
      ))}
    </ul>
  );
}
