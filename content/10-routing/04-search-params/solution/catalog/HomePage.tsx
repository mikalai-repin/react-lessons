import { Link } from 'react-router';
import { games } from '../data/games';
import { PromoBanner } from '../layout/PromoBanner';
import { Badge } from '../shared/Badge';
import { isHit } from '../shared/gameRules';
import { Section } from '../shared/Section';
import { GameGrid } from './GameGrid';

// Главная: акция и «Хиты»; весь каталог — на своей странице
export function HomePage() {
  const hits = games.filter(isHit);
  return (
    <>
      <PromoBanner />
      <Section
        title="Хиты"
        extra={<Badge tone="dark">{hits.length}</Badge>}
      >
        <GameGrid games={hits} />
        <p>
          <Link to="/catalog">Весь каталог →</Link>
        </p>
      </Section>
    </>
  );
}
