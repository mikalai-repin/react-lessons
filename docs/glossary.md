# Словарь терминов

Единые переводы для всех уроков. При первом упоминании: «состояние (state)», «эффект (`useEffect`)», дальше — только русский термин. Имена функций, хуков, компонентов и пакетов **не переводим**. Новый термин сначала добавляем сюда, потом используем. Общие веб-термины и термины роутинга/HTTP/форм — как в `../angular-learn/docs/glossary.md`, если не противоречат React.

## Основы

| English | Русский | Комментарий |
|---|---|---|
| library / framework | библиотека / фреймворк | React — библиотека |
| component | компонент | функция, возвращающая JSX |
| element (React element) | элемент | объект, который возвращает JSX; не путать с DOM-элементом — при риске путаницы «React-элемент» |
| JSX | JSX | |
| props | props (пропсы) | в тексте — «props», мн. ч.: «передать в props», «проп `game`» |
| children | `children`, дочерние элементы | |
| slot | слот | проп типа `ReactNode`, в который родитель кладёт разметку (`title`, `extra`); глава 3 |
| render prop / render function | render-функция (render prop) | проп-функция, возвращающая JSX: `renderItem={(game) => …}` |
| element tree / component tree | дерево элементов / дерево компонентов | элементы — одноразовые описания; дерево компонентов — файберы, живут между рендерами |
| depth-first traversal | обход в глубину | порядок вызова компонентов при рендере |
| root | корень | `createRoot` |
| entry point | точка входа | `main.tsx` |
| global styles | глобальные стили | `styles.css`, импорт в `main.tsx` |
| CSS Modules | CSS Modules (модули CSS) | `X.module.css`, `className={styles.x}` |
| stack trace | стек вызовов | строки `at …` в ошибке |
| syntax error / type error / runtime error | синтаксическая ошибка / ошибка типов / ошибка во время выполнения | метки консоли «Сборка» / «TS» / без метки |
| render | рендер, отрисовка | «рендер» — вызов компонента; «отрисовка» — изменения на экране |
| re-render | повторный рендер, перерисовка | |
| commit | фиксация (commit) | фаза, когда React меняет DOM |
| reconciliation | сверка | |
| Strict Mode | строгий режим (`StrictMode`) | |
| pure function / purity | чистая функция / чистота | |
| composition | композиция | |
| one-way data flow | однонаправленный поток данных | |
| owner stack | стек владельцев | |
| conditional rendering | условный рендер | `&&`, `? :`, ранний `return` |
| key | ключ (`key`) | «ключ элемента списка» |
| Fragment | фрагмент | `<>…</>`, `<Fragment key>` |
| escaping | экранирование | выражения в JSX вставляются как текст |
| XSS (cross-site scripting) | XSS (межсайтовый скриптинг) | |
| sanitization | очистка (санитизация) | React HTML не очищает — DOMPurify |

## Состояние и хуки

| English | Русский | Комментарий |
|---|---|---|
| state | состояние | |
| state setter | функция-сеттер, сеттер | `setCount` |
| event handler | обработчик события | `onClick={handleAddClick}`; проп — `onX`, функция — `handleX` |
| synthetic event | синтетическое событие | обёртка React над событием браузера (`SyntheticBaseEvent`), настоящее — `e.nativeEvent` |
| event propagation / bubbling | всплытие (события) | `e.stopPropagation()` |
| default action | действие (браузера) по умолчанию | `e.preventDefault()` |
| render trigger | запуск рендера | первый — `root.render`, дальше — сеттеры состояния |
| current / work-in-progress tree | текущее / черновое дерево файберов | две копии, меняются местами после фиксации |
| updater function | функция обновления | `set(n => n + 1)` |
| snapshot | снимок | «состояние — снимок» |
| batching | пакетная обработка обновлений | |
| lifting state up | подъём состояния | |
| source of truth | источник истины | |
| derived state / derived value | производное значение | вычисляется при рендере, в состоянии не хранится (глава 5) |
| state structure | структура состояния | что хранить и где: минимум, без противоречий и дублей, плоско (глава 5) |
| controlled / uncontrolled | управляемый / неуправляемый | поля и компоненты |
| reducer / action / dispatch | редьюсер / действие / `dispatch` (отправить действие) | |
| draft (Immer) | черновик | объект-заместитель (`Proxy`), который можно менять в `produce` |
| structural sharing | структурное разделение | новые объекты только на пути к изменению, остальное переиспользуется |
| position in the tree | место (позиция) в дереве | состояние привязано к месту, типу и `key` |
| lazy initializer | функция начального значения | `useState(() => …)`: вызывается только при создании состояния |
| hook / custom hook | хук / свой хук | |
| rules of hooks | правила хуков | |
| ref | ссылка (ref) | «ссылка на DOM-элемент», «ref-значение» |
| effect / cleanup | эффект / очистка | |
| dependencies (deps) | зависимости | массив зависимостей |
| stale closure | устаревшее замыкание | |
| external store | внешнее хранилище | `useSyncExternalStore` |
| context / provider / consumer | контекст / провайдер / потребитель | |
| prop drilling | проброс props | |
| portal | портал | `createPortal` |

## Асинхронность и конкурентность

| English | Русский | Комментарий |
|---|---|---|
| Suspense boundary | граница Suspense | |
| fallback | заглушка (fallback) | |
| error boundary | граница ошибок | |
| transition | переход | `useTransition` |
| deferred value | отложенное значение | |
| Action | действие (Action) | при риске путаницы с действием редьюсера — «Action» без перевода |
| optimistic update | оптимистичное обновление | |
| concurrent rendering | конкурентный рендер | |
| lane / priority | полоса (lane) / приоритет | глава 21 |
| hydration | гидратация | |
| Server Component / Client Component | серверный / клиентский компонент | |
| Server Function | серверная функция | `'use server'` |
| streaming | стриминг (потоковая отдача) | |

## Производительность и внутреннее устройство

| English | Русский | Комментарий |
|---|---|---|
| memoization | мемоизация | |
| React Compiler | React Compiler (компилятор React) | |
| code splitting | разделение кода | |
| virtualization | виртуализация | |
| Fiber | файбер (fiber) | объект, который React хранит для каждого элемента дерева; при первом упоминании — «файбер (fiber, „волокно“)», дальше «файбер», мн. ч. «файберы» (глава 3, «Под капотом») |
| work-in-progress tree | рабочее дерево | |
| scheduler | планировщик | |

## Библиотеки

| English | Русский | Комментарий |
|---|---|---|
| route / nested route / layout route | маршрут / вложенный маршрут / маршрут-макет | |
| loader / action (router) | загрузчик (`loader`) / действие маршрута (`action`) | |
| search params | параметры поиска (query-параметры) | |
| server state / client state | серверное / клиентское состояние | |
| query / mutation / query key | запрос / мутация / ключ запроса | TanStack Query |
| stale / invalidate | устаревший / инвалидировать (пометить устаревшим) | |
| store / slice / selector | стор (хранилище) / срез / селектор | «стор» — разговорное, допустимо после первого «хранилище (store)» |
| middleware | промежуточный слой (middleware) | |
| schema / validation | схема / валидация (проверка) | Zod |
| design token | дизайн-токен | antd |
| headless component | headless-компонент (компонент без разметки) | |
