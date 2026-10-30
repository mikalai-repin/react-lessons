# Глава 1 «Первое приложение» — 7 шагов

Журнал главы: шаги — как получилось на самом деле (а не по плану), код магазина к концу главы, технический долг, опоры для следующей главы.

Ветка `chapter/01-first-app`; все утверждения и эксперименты проверены запуском (`checks/ch01-first-app.mjs`, 26 проверок) и `tsc`.

- 1.1 «Что такое React» (`noSolution`) — демо-магазин (каталог `useQuery` + `signal`, игра `loader` + `HydrateFallback`, корзина Zustand + `persist`, 404, CSS Modules, `<title>`); на нём работают `checks/preview.mjs` и `checks/platform.mjs`.
- 1.2 «Первый компонент» (свой старт: демо удалено, `App` возвращает `null`) — `App` возвращает `<main>` с `<h1>` и `<p>`. Эксперименты: без обёртки (ошибка сборки), компонент с маленькой буквы.
- 1.3 «Запуск приложения» — `main.tsx` по шагам: `container`, проверка `#root`, `createRoot`, `root.render`. Эксперименты: неверный id, `innerHTML` сразу и через 100 мс; `::: deep` про планирование и `flushSync`.
- 1.4 «Строгий режим» — `<StrictMode>` в `main.tsx`; эксперимент `console.log('render App')` ×2.
- 1.5 «Стили» (свой старт: готовые `styles.css` и `App.module.css`) — `import './styles.css'`, `styles.page`/`styles.title`, `className="muted"`, `♞ Ход конём`. Эксперименты: настоящее имя класса, опечатка `styles.titel`.
- 1.6 «Отладка» (`brokenStart`: `</h2>`, `hits[0].toUpperCase()`, `<App title=…>`) — три метки консоли по очереди; решение = код шага 1.5.
- 1.7 «Под капотом: JSX» (`noSolution`, пустой коммит `start`) — `jsxDEV`, React-элемент, «Итоги главы».

Код магазина к концу главы: `main.tsx` (`StrictMode`, `createRoot` с проверкой `#root`, `import './styles.css'`), `App.tsx` (заголовок и подпись), `App.module.css`, `styles.css` (глобальные стили магазина из демо: переменные цветов, `h1`, `.button`, `.grid`, `.muted`, `.search`).

Опоры для главы 2: данных игр ещё нет — `api/models.ts` (тип `Game` из демо шага 1.1) и локальный массив игр появятся в главе 2; обложки — `/assets/covers/<slug>.svg`; классы `.grid`, `.button`, `.muted` уже в `styles.css`.
