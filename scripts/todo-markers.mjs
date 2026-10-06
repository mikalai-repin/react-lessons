// Метки заготовок в коде рабочей папки главы (authoring/<глава>, см. scripts/chapter.mjs).
//
// В решении шага кусок, который ученик пишет сам, обрамляется метками:
//   // @todo Добавьте счётчик через useState        {/* @todo Выведите список */}        /* @todo Цвет кнопки */
//   const [count, setCount] = useState(0);          {items.map(…)}                      color: var(--brand);
//   // @end                                         {/* @end */}                        /* @end */
// Решение — код без строк-меток. Старт — блок целиком заменён одной строкой `// TODO: Добавьте счётчик через useState`
// (тем же видом комментария и с тем же отступом).
//
// Метки остаются в файлах и в следующих коммитах главы. Заготовкой становятся только НОВЫЕ метки шага — те, которых
// не было в этом файле в предыдущем коммите (сравнение по тексту строки `@todo …`).

const START = /^(\s*)(?:\/\/\s*@todo\b(.*)|\{\/\*\s*@todo\b(.*?)\*\/\}|\/\*\s*@todo\b(.*?)\*\/)\s*$/;
const END = /^\s*(?:\/\/\s*@end|\{\/\*\s*@end\s*\*\/\}|\/\*\s*@end\s*\*\/)\s*$/;

/** Блоки меток файла: [{ from, to, indent, style, text, key }], from/to — индексы строк меток */
function parseBlocks(code, file) {
  const lines = code.split('\n');
  const blocks = [];
  let open = null;
  lines.forEach((line, index) => {
    const start = START.exec(line);
    if (start) {
      if (open) throw new Error(`${file}:${index + 1}: метка @todo внутри другой (строка ${open.from + 1})`);
      const [, indent, lineText, jsxText, blockText] = start;
      const style = lineText !== undefined ? 'line' : jsxText !== undefined ? 'jsx' : 'block';
      const text = (lineText ?? jsxText ?? blockText).trim().replace(/^:\s*/, '');
      if (!text) throw new Error(`${file}:${index + 1}: у метки @todo нет текста задания`);
      open = { from: index, indent, style, text, key: line.trim() };
    } else if (END.test(line)) {
      if (!open) throw new Error(`${file}:${index + 1}: @end без @todo`);
      blocks.push({ ...open, to: index });
      open = null;
    }
  });
  if (open) throw new Error(`${file}:${open.from + 1}: у метки @todo нет @end`);
  return { lines, blocks };
}

const todoLine = ({ indent, style, text }) =>
  indent + (style === 'line' ? `// TODO: ${text}` : style === 'jsx' ? `{/* TODO: ${text} */}` : `/* TODO: ${text} */`);

const supports = (file) => /\.(tsx?|css)$/.test(file);

/** Ключи меток файла (текст строки @todo) — чтобы отличить новые метки шага от оставшихся с прошлых шагов */
export function markerKeys(code, file) {
  if (!supports(file)) return new Set();
  return new Set(parseBlocks(code, file).blocks.map((b) => b.key));
}

/** Код решения: строки-метки удалены */
export function toSolution(code, file) {
  if (!supports(file)) return code;
  const { lines, blocks } = parseBlocks(code, file);
  const drop = new Set(blocks.flatMap((b) => [b.from, b.to]));
  return lines.filter((_, i) => !drop.has(i)).join('\n');
}

/**
 * Код старта: блоки с новыми метками (их ключей нет в oldKeys) заменены строкой TODO, у старых — только удалены метки.
 * Возвращает { code, todos } — todos: число заменённых блоков
 */
export function toStart(code, file, oldKeys = new Set()) {
  if (!supports(file)) return { code, todos: 0 };
  const { lines, blocks } = parseBlocks(code, file);
  const out = [];
  let todos = 0;
  let index = 0;
  for (const block of blocks) {
    out.push(...lines.slice(index, block.from));
    if (oldKeys.has(block.key)) {
      out.push(...lines.slice(block.from + 1, block.to));
    } else {
      out.push(todoLine(block));
      todos++;
    }
    index = block.to + 1;
  }
  out.push(...lines.slice(index));
  return { code: out.join('\n'), todos };
}
