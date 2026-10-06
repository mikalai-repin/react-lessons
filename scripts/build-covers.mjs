// Генерирует простые SVG-обложки игр по public/backend/data/games.json → public/assets/covers/<slug>.svg.
// Свои обложки — чтобы не было вопросов с лицензиями. Запуск: npm run covers (после изменения списка игр)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const games = JSON.parse(readFileSync(resolve(root, 'public/backend/data/games.json'), 'utf8'));
const out = resolve(root, 'public/assets/covers');
mkdirSync(out, { recursive: true });

const escape = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Делит название на строки не длиннее maxLength символов */
function wrap(title, maxLength = 12) {
  const lines = [];
  for (const word of title.split(' ')) {
    const last = lines.at(-1);
    if (last && (last + ' ' + word).length <= maxLength) lines[lines.length - 1] = last + ' ' + word;
    else lines.push(word);
  }
  return lines;
}

/** Детерминированный «узор» из кругов и ромбов, чтобы обложки отличались не только цветом */
function pattern(seed) {
  const shapes = [];
  let x = seed * 9301 + 49297;
  const random = () => (x = (x * 9301 + 49297) % 233280) / 233280;
  for (let i = 0; i < 7; i++) {
    const cx = Math.round(random() * 300);
    const cy = Math.round(random() * 260);
    const r = Math.round(20 + random() * 50);
    shapes.push(
      i % 2
        ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#fff" opacity="0.12"/>`
        : `<rect x="${cx - r / 2}" y="${cy - r / 2}" width="${r}" height="${r}" transform="rotate(45 ${cx} ${cy})" fill="#000" opacity="0.10"/>`,
    );
  }
  return shapes.join('');
}

for (const game of games) {
  const lines = wrap(game.title);
  const startY = 300 - (lines.length - 1) * 17;
  const text = lines
    .map((line, i) => `<text x="150" y="${startY + i * 34}" text-anchor="middle">${escape(line)}</text>`)
    .join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" width="300" height="400">
<rect width="300" height="400" fill="${game.color}"/>
${pattern(game.id)}
<g transform="translate(150 140)" fill="#fff" opacity="0.92"><path d="M-34 60h70v-14c0-18-7-32-15-45l9-8 9 9 12-12-6-20c-7-20-20-26-35-26h-9l-3 12-13 9-20 21 8 12 15-8 10 2-18 29c-5 8-6 20-6 28z"/></g>
<rect y="250" width="300" height="150" fill="#000" opacity="0.28"/>
<g font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" font-size="28" font-weight="700" fill="#fff">${text}</g>
</svg>
`;
  writeFileSync(resolve(out, `${game.slug}.svg`), svg);
}
console.log(`[covers] обложек: ${games.length} → public/assets/covers`);
