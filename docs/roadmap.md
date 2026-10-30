# Дорожная карта

Статусы: ⬜ не начато · 🟨 в работе · ✅ готово

Правило передачи работы: агент, закончивший этап или главу, **обновляет статусы здесь, раздел «Следующий шаг» в конце и строку статуса в `CLAUDE.md`**. Следующий агент начинает с чтения `CLAUDE.md` и раздела «Следующий шаг».

## Этапы 0–3 — ✅

Подробности (решения, найденное и исправленное) — `docs/archive/roadmap-done.md`; шаги глав — `docs/chapters/`.

- ✅ Этап 0. Контекст и прототип (2026-10-06): спайк `spikes/esm-preview/` — React 19.3, react-router 8, TanStack Query, Zustand, antd 6 в iframe без сборщика с одним экземпляром React
- ✅ Этап 1. Платформа (2026-10-06): перенос из angular-learn, vendor, компиляция TSX, превью, Monaco, учебный бэкенд, демо-магазин 1.1, `chapter.mjs` вместо генераторов на Python
- ✅ Этап 2. Пилот: главы 1–3 (2026-10-08), квизы глав, оформление платформы, вычитка глав 1–3
- ✅ Этап 3. Основы: главы 4–8 (2026-10-12), проверки практикумов `check.ts`

## Этап 4. Приложение: главы 9–20 — 🟨

- ✅ Глава 9. Состояние приложения (9 шагов, 2026-10-26) — `docs/chapters/09-app-state.md`
- ✅ Глава 10. Роутинг (14 шагов, 2026-10-26) — `docs/chapters/10-routing.md`
- ⬜ Учебный бэкенд: ~40 игр, `page`/`size` (общая задача с angular-learn)
- ⬜ Глава 11. Данные с сервера (Suspense, TanStack Query)
- ⬜ Глава 12. Конкурентный React и Actions
- ⬜ Глава 13. Формы (React Hook Form + Zod)
- ⬜ Учебный бэкенд: `tokenTtl`, `/api/refresh`, `/api/logout` (общая задача с angular-learn)
- ⬜ Глава 14. Авторизация
- ⬜ Vendor: `antd` + `@ant-design/icons` + `dayjs` в превью (проверить размер и cssinjs)
- ⬜ Глава 15. Стили и Ant Design
- ⬜ Вкладка «Скомпилировано» с React Compiler (Babel в воркере) — до главы 16
- ⬜ Глава 16. Производительность
- ⬜ Тест-раннер в превью (вкладка «Тесты», API Vitest + Testing Library)
- ⬜ Глава 17. Тестирование
- ⬜ Глава 18. Админка
- ⬜ Глава 19. Redux Toolkit
- ⬜ Глава 20. Паттерны и архитектура

## Этап 5. Инструменты «под капотом» — ⬜

- ⬜ Вкладка «Скомпилировано» (JS после TS и после React Compiler)
- ⬜ Лог рендеров / дерево компонентов (через `<Profiler>` или хук DevTools)

## Этап 6. Глубже: главы 21–25 — ⬜

- ⬜ Глава 21. Под капотом React
- ⬜ Глава 22. Серверный React (Next.js 16, на машине ученика; нужен Node 22+)
- ⬜ Глава 23. Настоящий проект (Vite, ESLint, сборка, деплой)
- ⬜ `reference/` с кодом выбранного проекта и `npm run reference`
- ⬜ Глава 24. Разбор настоящего кода
- ⬜ Глава 25. Финальный проект

## Риски

| Риск | Что делаем |
|---|---|
| React и часть библиотек — только CJS, import map требует ESM | ✅ Снят спайком: ESM-обёртки с именованными экспортами |
| Два экземпляра React в превью | ✅ Снят спайком: один запуск esbuild со `splitting`; проверка в `checks/preview.mjs` |
| `antd` тяжёлый и рисует стили в рантайме | Отдельный бандл, грузится только при импорте; проверить cssinjs в iframe |
| Мажорные версии вышли недавно (react-router 8, antd 6, TanStack Table 9, Jotai 3, Zod 4, MSW 3, Vitest 5) — память модели их не знает | Сверять API по `node_modules` перед каждой главой; факты — в `modern-react.md` |
| React Compiler меняет «правила мемоизации» | Глава 16: сначала ручная мемоизация и её механизм, потом компилятор; не утверждать, что `useMemo` устарел |
| Next.js и RSC нельзя показать в превью | Глава 22 — на машине ученика, команды проверяет автор |
| Различия StrictMode/dev/prod (двойной рендер, предупреждения) | Превью всегда dev; в тексте называть отличия от продакшен-сборки |

## Следующий шаг

**Этап 4: учебный бэкенд (~40 игр, `page`/`size`), затем глава 11 «Данные с сервера» (Suspense, TanStack Query)** по `docs/course-plan.md` и `docs/authoring-process.md`.

1. Прочитать журнал главы 10 `docs/chapters/10-routing.md` (особенно «Опоры для главы 11») и ловушки в `docs/authoring-process.md` (адресная строка превью и роутер, минифицированный vendor после сборки, `tools/e2e/lesson-code.mjs`), шаги 10.6 и 10.9 — им глава 11 отвечает.
2. Бэкенд до главы: `public/backend/data/games.json` — сейчас 12 игр (локальный каталог курса — 6, `data/games.ts`; шесть совпадают с бэкендом полностью, кроме служебного `color`). Расширить до ~40 (обложки — `scripts/build-covers.mjs`), `page`/`size` уже есть в `listGames` (`PAGE_SIZE = 12`). Решить, как фильтры адреса (`cheap`/`expensive`/`rating`, `inStock=1`) переводятся в параметры бэкенда (`price`/`-price`/`rating`/`title`, `inStock=true`). После правки — `checks/preview.mjs`, `checks/platform.mjs` и проверки глав 1 и 10 (демо 1.1 и `gameLoader` читают бэкенд).
3. `@tanstack/react-query` 5.104.1 уже в vendor и типах Monaco (демо 1.1: `useQuery` + `signal`). Сверить по `node_modules` до текста: `isPending`/`isLoading`/`isFetching`, `staleTime`/`gcTime` по умолчанию, `retry` (3 по умолчанию — в превью долго), `queryOptions`, `useSuspenseQuery`, `placeholderData: keepPreviousData`, `useInfiniteQuery`, `ensureQueryData` в `loader`. `react-error-boundary` — в vendor (план 11), `PREVIEW_MODULES` + типы + `checks/preview.mjs`.
4. 11.1 — честный `useEffect` + `fetch` для каталога с гонкой (задержка бэкенда и быстрая смена фильтров), затем TanStack Query; фильтры адреса — в ключ запроса.
5. `npm run chapter new 11-server-data -- --title "Данные с сервера" --description "…"` — база: `10-routing/14-practice`. Новые файлы шагов — заготовками в коммите `start`. В конце — квиз, `check.ts` практикума, `run-chapter`, `checks/ch11-….mjs`, `step-checks`, `lesson-code.mjs`, `npx prettier --check .`; написать журнал `docs/chapters/11-server-data.md`, обновить этот файл и `CLAUDE.md`.
