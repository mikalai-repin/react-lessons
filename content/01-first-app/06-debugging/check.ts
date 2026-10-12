import type { CheckContext, CheckResult } from '@course/check';

// Отладка: все три ошибки исправлены — сборка проходит (платформа проверила до запуска),
// приложение рисуется без исключений, ошибок типов нет
export default async function check(
  ctx: CheckContext,
): Promise<CheckResult> {
  if (ctx.errors().some((e) => e.includes('toUpperCase'))) {
    return {
      pass: false,
      hint: 'Приложение падает при рендере: в консоли TypeError про toUpperCase. Это вторая ошибка шага — строка «Хит недели».',
    };
  }
  if (ctx.text().includes('Хит недели')) {
    return {
      pass: false,
      hint: 'Строка «Хит недели» ещё на странице: удалите её вместе с константой hits.',
    };
  }
  const title = ctx.text(ctx.document.querySelector('h1'));
  if (title !== '♞ Ход конём') {
    return {
      pass: false,
      hint: 'На странице нет заголовка «♞ Ход конём». Посмотрите консоль превью.',
    };
  }
  if (ctx.typeErrors().length > 0) {
    return {
      pass: false,
      hint: 'Приложение работает, но в консоли есть ошибка с меткой «TS». Это третья ошибка шага — посмотрите на main.tsx.',
    };
  }
  if (ctx.errors().length > 0) {
    return {
      pass: false,
      hint: 'В консоли остались ошибки — прочитайте их по очереди.',
    };
  }
  return { pass: true };
}
