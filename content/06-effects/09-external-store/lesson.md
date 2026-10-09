---
title: Внешние хранилища
startFrom: custom
focus: layout/OfflineBanner.tsx
api: [useSyncExternalStore, subscribe, getSnapshot, navigator.onLine]
---

Покупатель листает каталог в метро, и связь пропадает. Предупредим его полосой «Нет сети» вверху страницы, а когда связь вернётся — уберём её.

Есть ли сеть, знает браузер: свойство `navigator.onLine` и события `online` и `offline` у `window`. Это **внешнее хранилище** (external store): значение живёт вне React, может измениться в любой момент, а об изменении сообщает событием. Стили полосы — в `layout/OfflineBanner.module.css`, компонент — заготовка `layout/OfflineBanner.tsx`.

## Через эффект

С тем, что уже знаем, решение такое:

```tsx
const [online, setOnline] = useState(() => navigator.onLine);
useEffect(() => {
  const update = () => setOnline(navigator.onLine);
  window.addEventListener('online', update);
  window.addEventListener('offline', update);
  return () => {
    window.removeEventListener('online', update);
    window.removeEventListener('offline', update);
  };
}, []);
```

Это работает, и так писали годами. Но код хрупкий:

- значение хранится **дважды** — в браузере и копией в состоянии React. Между первым рендером и подпиской в эффекте сеть может пропасть, и копия останется устаревшей: событие пришло, когда слушателя ещё не было;
- в конкурентном рендере (глава 12) React может прервать рендер и продолжить позже. Если хранилище изменилось в паузе, одни компоненты нарисуются со старым значением, другие — с новым. Это называется **разрыв** (tearing);
- каждый, кто подписывается на внешнее хранилище, пишет эти десять строк заново — и ошибается в очистке.

## useSyncExternalStore

[`useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore) — хук именно для подписки на внешнее хранилище. Ему нужны две функции:

```tsx
const value = useSyncExternalStore(subscribe, getSnapshot);
```

- `subscribe(onStoreChange)` — подписаться на изменения: при каждом изменении вызывать `onStoreChange`, вернуть функцию отписки;
- `getSnapshot()` — прочитать текущее значение (**снимок**).

Остальное делает React: подписывается после фиксации и отписывается при уходе компонента; когда хранилище сообщило об изменении, вызывает `getSnapshot` и сравнивает со старым снимком через `Object.is` — если изменилось, рендерит компонент. После подписки React ещё раз сверяет снимок, так что изменение «между рендером и подпиской» не потеряется. А в конкурентном рендере хук не даёт частям экрана разойтись. Своего состояния и эффекта у компонента больше нет: значение берётся прямо из хранилища.

```tsx layout/OfflineBanner.tsx
import { useSyncExternalStore } from 'react';
import styles from './OfflineBanner.module.css';

// Подписка: браузер сообщает о смене сети событиями online и offline.
// Возвращает функцию отписки
function subscribe(onStoreChange: () => void) {
  window.addEventListener('online', onStoreChange);
  window.addEventListener('offline', onStoreChange);
  return () => {
    window.removeEventListener('online', onStoreChange);
    window.removeEventListener('offline', onStoreChange);
  };
}

// Снимок: есть ли сеть прямо сейчас
function getSnapshot() {
  return navigator.onLine;
}

// Полоса «Нет сети» над магазином
export function OfflineBanner() {
  const online = useSyncExternalStore(subscribe, getSnapshot);
  if (online) return null;
  return (
    <p className={styles.banner} role="alert">
      Нет сети — проверьте подключение к интернету
    </p>
  );
}
```

- `subscribe` и `getSnapshot` объявлены **вне компонента**: они не зависят от props и одни на все рендеры. Если бы `subscribe` создавалась в теле компонента, при каждом рендере она была бы новой — и React переподписывался бы каждый раз.
- `role="alert"` — экранный диктор сразу прочитает появившееся сообщение.

В `App` полоса — первой, перед шапкой:

```tsx App.tsx {2}
    <>
      <OfflineBanner />
      <Header count={games.length} cartCount={cartCount} />
```

::: task
1. В `layout/OfflineBanner.tsx` напишите функции `subscribe` (подписка на `online` и `offline` у `window` и отписка) и `getSnapshot` (`navigator.onLine`).
2. Напишите компонент `OfflineBanner`: значение — из `useSyncExternalStore`; в сети — ничего, без сети — `<p className={styles.banner} role="alert">` с текстом «Нет сети — проверьте подключение к интернету».
3. Нарисуйте `<OfflineBanner />` в `App` первым, перед `<Header>`.
:::

## Что получилось

Пока сеть есть — магазин как раньше. Отключите сеть для вкладки: инструменты разработчика браузера → «Сеть» (Network) → список «Без ограничения» (No throttling) → «Офлайн» (Offline). Вверху превью — тёмная полоса «Нет сети — проверьте подключение к интернету»; она прилипает к верху при прокрутке. Верните «Без ограничения» — полоса исчезла.

## Эксперименты

1. **Сколько рендеров.** Добавьте в `OfflineBanner` после хука `console.log('render OfflineBanner', online);`, а в `subscribe` — `console.log('подписка')` и в функцию отписки — `console.log('отписка')`. При запуске: `render OfflineBanner true` дважды, `подписка`, `отписка`, `подписка` — строгий режим проверяет и эту очистку (шаг 5). Отключите сеть — `render OfflineBanner false` дважды; включите — `render OfflineBanner true` дважды.
2. **Поддельное событие.** Выполните в консоли страницы превью (инструменты разработчика, контекст `preview.html`) `window.dispatchEvent(new Event('offline'))`. Ни одного рендера и никакой полосы. React получил сигнал «что-то изменилось», вызвал `getSnapshot` — а `navigator.onLine` по-прежнему `true`, снимок тот же. Источник правды — хранилище, а не событие.
3. **Новый объект из снимка.** Пусть `getSnapshot` возвращает `{ online: navigator.onLine }`, а компонент берёт `const { online } = …`. Ошибка `The result of getSnapshot should be cached to avoid an infinite loop`, затем `Maximum update depth exceeded`, и приложение пропадает. Каждый вызов даёт новый объект, `Object.is` всегда видит «изменение» — бесконечный цикл. Снимок должен быть **тем же значением**, пока хранилище не изменилось: примитив или сохранённый объект. Верните `navigator.onLine`.

Уберите логи.

## Как в настоящем проекте

- Внешние хранилища вокруг: `matchMedia` (тема ОС, ширина экрана — `useMediaQuery` напишем в главе 7), `document.visibilityState`, `localStorage` с событием `storage` из других вкладок, адрес страницы, сторонние сторы. В главе 9 вы напишете на `useSyncExternalStore` собственное хранилище корзины — и увидите, что Zustand устроен так же.
- Для серверного рендеринга у хука есть третий аргумент — `getServerSnapshot`: на сервере нет `navigator`, и React нужно значение для HTML (часть 3).
- Признак, что нужен `useSyncExternalStore`, а не эффект: вы подписываетесь на источник, чтобы **показать его значение**. Если подписка нужна, чтобы что-то **сделать** (отправить, запустить анимацию), — это эффект.
