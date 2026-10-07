// Темы подсветки кода курса (TextMate-темы для Shiki) в цветах React: одни и те же в редакторе
// (src/editor/monaco.ts через @shikijs/monaco) и в тексте урока (src/lesson/markdown.ts).
//
// Роли цветов: ключевые слова и фигурные скобки JSX — фиолетовый; HTML-теги и функции — акцент React;
// компоненты (<GameCard>) — свой цвет, чтобы отличались от тегов HTML; атрибуты — янтарный; типы — бирюзовый.
// Области (scopes) — из грамматик TypeScriptReact и CSS (VS Code).
import type { ThemeRegistration } from 'shiki/core';

interface Palette {
  background: string;
  foreground: string;
  comment: string;
  keyword: string;
  string: string;
  number: string;
  fn: string;
  tag: string;
  component: string;
  attribute: string;
  type: string;
  punctuation: string;
  lineNumber: string;
  lineNumberActive: string;
  lineHighlight: string;
  selection: string;
  cursor: string;
}

function theme(name: string, type: 'light' | 'dark', c: Palette): ThemeRegistration {
  return {
    name,
    type,
    colors: {
      'editor.background': c.background,
      'editor.foreground': c.foreground,
      'editorLineNumber.foreground': c.lineNumber,
      'editorLineNumber.activeForeground': c.lineNumberActive,
      'editor.lineHighlightBackground': c.lineHighlight,
      'editor.selectionBackground': c.selection,
      'editorCursor.foreground': c.cursor,
      'editorIndentGuide.background1': c.lineHighlight,
      'editorBracketMatch.background': c.selection,
      'editorBracketMatch.border': c.selection,
    },
    tokenColors: [
      { settings: { foreground: c.foreground, background: c.background } },
      {
        scope: ['comment', 'punctuation.definition.comment'],
        settings: { foreground: c.comment, fontStyle: 'italic' },
      },
      {
        scope: [
          'keyword',
          'storage.type',
          'storage.modifier',
          'keyword.control',
          'keyword.operator.new',
          'keyword.operator.expression',
          'variable.language.this',
        ],
        settings: { foreground: c.keyword },
      },
      { scope: ['keyword.operator', 'punctuation', 'meta.brace'], settings: { foreground: c.punctuation } },
      // { } вокруг выражений в JSX — заметнее обычной пунктуации: граница между разметкой и JavaScript
      {
        scope: ['punctuation.section.embedded.begin.tsx', 'punctuation.section.embedded.end.tsx'],
        settings: { foreground: c.keyword },
      },
      { scope: ['string', 'punctuation.definition.string'], settings: { foreground: c.string } },
      {
        scope: ['constant.numeric', 'constant.language', 'constant.character.escape', 'keyword.other.unit'],
        settings: { foreground: c.number },
      },
      {
        scope: ['entity.name.function', 'support.function', 'meta.function-call entity.name.function'],
        settings: { foreground: c.fn },
      },
      // JSX: <main> — тег HTML, <GameCard> — компонент
      { scope: ['entity.name.tag', 'punctuation.definition.tag'], settings: { foreground: c.tag } },
      { scope: ['support.class.component', 'entity.name.tag.component'], settings: { foreground: c.component } },
      { scope: ['entity.other.attribute-name'], settings: { foreground: c.attribute } },
      {
        scope: [
          'entity.name.type',
          'support.type',
          'entity.name.class',
          'entity.other.inherited-class',
          'support.class',
        ],
        settings: { foreground: c.type },
      },
      { scope: ['meta.object-literal.key', 'support.type.property-name.json'], settings: { foreground: c.foreground } },
      // CSS: селекторы классов — как атрибуты, свойства — как типы, переменные — как функции
      { scope: ['entity.other.attribute-name.class.css', 'entity.name.tag.css'], settings: { foreground: c.tag } },
      { scope: ['support.type.property-name.css'], settings: { foreground: c.type } },
      {
        scope: ['variable.css', 'variable.argument.css', 'support.constant.property-value.css'],
        settings: { foreground: c.attribute },
      },
    ],
  };
}

export const courseLight = theme('course-light', 'light', {
  background: '#ffffff',
  foreground: '#23272f',
  comment: '#8a93a6',
  keyword: '#7f3fbf',
  string: '#1a7f4b',
  number: '#c2410c',
  fn: '#087ea4',
  tag: '#087ea4',
  component: '#b8326b',
  attribute: '#9a5b00',
  type: '#0f766e',
  punctuation: '#6b7489',
  lineNumber: '#b4bac6',
  lineNumberActive: '#5e687e',
  lineHighlight: '#f3f6f9',
  selection: '#cbe8f3',
  cursor: '#087ea4',
});

export const courseDark = theme('course-dark', 'dark', {
  background: '#1d2027',
  foreground: '#e6e9ef',
  comment: '#7f8aa1',
  keyword: '#c792ea',
  string: '#a3e4a0',
  number: '#f5a97f',
  fn: '#58c4dc',
  tag: '#58c4dc',
  component: '#f78fb3',
  attribute: '#f2c27b',
  type: '#7ee0c3',
  punctuation: '#9aa4b8',
  lineNumber: '#4b5263',
  lineNumberActive: '#99a1b3',
  lineHighlight: '#262b33',
  selection: '#2d4b57',
  cursor: '#58c4dc',
});
