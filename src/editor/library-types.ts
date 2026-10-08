// .d.ts библиотек превью для Monaco (~2 МБ, с antd — больше). Отдельный модуль: src/editor/monaco.ts загружает его
// динамическим import() — типы приходят отдельным чанком параллельно с запуском редактора и не задерживают страницу.
//
// Библиотека превью, которую добавили в scripts/copy-vendor.mjs (PREVIEW_MODULES), добавляется и сюда.
// Берём только нужные .d.ts: у react-router есть копии development/production, у query — legacy/modern.

export const typeFiles = import.meta.glob(
  [
    '../../node_modules/@types/react/**/*.d.ts',
    '../../node_modules/@types/react-dom/**/*.d.ts',
    '../../node_modules/csstype/index.d.ts',
    '../../node_modules/react-router/dist/production/**/*.d.ts',
    '../../node_modules/@tanstack/react-query/build/modern/**/*.d.ts',
    '../../node_modules/@tanstack/query-core/build/modern/**/*.d.ts',
    '../../node_modules/zustand/**/*.d.ts',
    '../../node_modules/immer/dist/immer.d.ts',
    '../../node_modules/use-immer/dist/index.d.ts',
  ],
  { query: '?raw', import: 'default', eager: true },
) as Record<string, string>;

/** package.json пакетов, у которых типы точек входа указаны только в `exports` */
export const typedPackages = import.meta.glob(
  [
    '../../node_modules/react-router/package.json',
    '../../node_modules/@tanstack/react-query/package.json',
    '../../node_modules/@tanstack/query-core/package.json',
    '../../node_modules/immer/package.json',
    '../../node_modules/use-immer/package.json',
  ],
  { import: 'default', eager: true },
) as Record<string, { exports: Record<string, unknown> }>;
