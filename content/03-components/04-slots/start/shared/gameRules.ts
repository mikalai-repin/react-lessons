import type { Game } from '../api/models';

// Рейтинг, с которого игра считается хитом
const HIT_RATING = 4.6;

/** Хит ли игра: правило нужно и карточке (бейдж), и каталогу (раздел «Хиты») */
export function isHit(game: Game): boolean {
  return game.rating >= HIT_RATING;
}
