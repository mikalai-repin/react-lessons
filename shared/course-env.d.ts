// Окружение кода уроков — как vite/client в настоящем проекте: импорт стилей.
// Используют валидатор (.content-check/), Monaco (src/editor/monaco.ts) и рабочие папки глав (authoring/).
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
declare module '*.css' {}
