import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { gamesQuery } from '../api/games';
import { PromoBanner } from '../layout/PromoBanner';
import { Badge } from '../shared/Badge';
import { HIT_RATING } from '../shared/gameRules';
import { Section } from '../shared/Section';
import { GameGrid } from './GameGrid';

// Сколько хитов показать на главной
const HITS_SHOWN = 6;
// Хиты — лучшие по рейтингу: фильтр и порядок делает сервер
const HITS_PARAMS = new URLSearchParams({
  rating: String(HIT_RATING),
  sort: 'rating',
  size: String(HITS_SHOWN),
}).toString();

// Главная: акция и «Хиты»; весь каталог — на своей странице
export function HomePage() {
  const hits = useQuery(gamesQuery(HITS_PARAMS));
  return (
    <>
      <PromoBanner />
      <Section
        title="Хиты"
        extra={
          hits.data && (
            <Badge tone="dark">{hits.data.total}</Badge>
          )
        }
      >
        {hits.isPending ? (
          <p className="muted">Загружаем хиты…</p>
        ) : hits.isError ? (
          <p className="muted">Не удалось загрузить хиты.</p>
        ) : (
          <GameGrid games={hits.data.items} />
        )}
        <p>
          <Link to="/catalog?sort=rating">Весь каталог →</Link>
        </p>
      </Section>
    </>
  );
}
