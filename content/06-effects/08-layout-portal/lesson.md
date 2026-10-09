---
title: useLayoutEffect и порталы
startFrom: custom
focus: shared/Tooltip.tsx
api: [useLayoutEffect, createPortal, getBoundingClientRect, useId, 'role="tooltip"']
---

Что значит бейдж «Хит»? Покупатель не знает, что это рейтинг 4,6 и выше. Покажем подсказку при наведении мыши и при фокусе с клавиатуры. Задача кажется простой, но у неё две ловушки: подсказка у правой карточки не должна вылезать за край окна, а родители бейджа не должны ломать её положение.

Что в старте:

- `shared/Tooltip.module.css` — стили: `.anchor` для элемента с подсказкой и `.tooltip` — `position: fixed`, поверх всего, шириной до 220 px;
- в `GameCard.module.css` карточка при наведении чуть приподнимается: `transform: translateY(-2px)`. Запомните это — пригодится;
- `shared/Tooltip.tsx` — заготовка.

## Замер до отрисовки

Подсказку показываем под бейджем, по его левому краю. Но у карточки «Нарды» бейдж в 100 px от правого края окна, а подсказка шире. Значит, её нужно сдвинуть влево — а на сколько, зависит от **ширины подсказки**, которую знает только браузер после того, как она окажется в DOM.

Получается три шага: нарисовать подсказку, измерить, поставить на место. Если сделать это в `useEffect`, браузер может успеть **показать** подсказку в неправильном месте до замера — и она «прыгнет» на глазах.

Для этого в React есть [`useLayoutEffect`](https://react.dev/reference/react/useLayoutEffect). Записывается так же, как `useEffect`, но выполняется **сразу после изменения DOM, до того как браузер нарисует кадр**. А если внутри изменить состояние, React выполнит новый рендер и фиксацию тоже до отрисовки. Пользователь увидит сразу итоговое положение.

```
фиксация: подсказка в DOM, top: 0, left: 0
useLayoutEffect: замер → setPosition(…)
рендер и фиксация: top и left на месте
                                ← только теперь кадр
useEffect …
```

Цена — браузер ждёт, пока работает `useLayoutEffect`. Поэтому в нём делают только то, что нужно увидеть уже в первом кадре: замеры и положение.

## Портал

Вторая ловушка — `position: fixed`. Обычно такой элемент позиционируется от окна браузера. Но если у кого-то из предков есть `transform` (а ещё `filter`, `perspective`), отсчёт идёт **от этого предка**. Карточка при наведении приподнимается через `transform` — и подсказка, нарисованная внутри карточки, уедет. Похожие беды приносят `overflow: hidden` у предка (обрежет) и `z-index` соседей (перекроют).

Выход — нарисовать подсказку **вне** карточки, прямо в `<body>`. Для этого есть [`createPortal`](https://react.dev/reference/react-dom/createPortal) из `react-dom`:

```tsx
createPortal(<div role="tooltip">…</div>, document.body)
```

Это **портал**: элемент попадает в другой DOM-узел, но остаётся на своём месте **в дереве React**. Подсказка по-прежнему ребёнок `Tooltip`: получает его props и состояние, а события из неё всплывают к родителям `Tooltip` в React, хотя в DOM её родитель — `<body>`.

## Подсказка

```tsx shared/Tooltip.tsx
import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import styles from './Tooltip.module.css';

// Отступ подсказки от элемента и от края окна, px
const GAP = 8;

type TooltipProps = {
  text: string;
  children: ReactNode;
};

type Position = { top: number; left: number };

// Подсказка при наведении и фокусе: не выходит за правый край окна
export function Tooltip({ text, children }: TooltipProps) {
  const anchorRef = useRef<HTMLSpanElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  // Где показать подсказку; null — ещё не измерили
  const [position, setPosition] = useState<Position | null>(null);
  // Уникальный id: связать элемент с подсказкой для экранного диктора
  const tipId = useId();

  // Замер после фиксации, но до отрисовки: подсказка уже в DOM,
  // её размер известен, а браузер её ещё не показал
  useLayoutEffect(() => {
    if (!open) return;
    const anchor = anchorRef.current!.getBoundingClientRect();
    const tip = tipRef.current!.getBoundingClientRect();
    // Под элементом, но не правее края окна
    const left = Math.min(
      anchor.left,
      window.innerWidth - tip.width - GAP,
    );
    setPosition({ top: anchor.bottom + GAP, left });
  }, [open]);

  function show() {
    setOpen(true);
  }

  function hide() {
    setOpen(false);
    setPosition(null);
  }

  return (
    <>
      <span
        ref={anchorRef}
        className={styles.anchor}
        tabIndex={0}
        aria-describedby={open ? tipId : undefined}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
      >
        {children}
      </span>
      {open &&
        createPortal(
          <div
            ref={tipRef}
            id={tipId}
            role="tooltip"
            className={styles.tooltip}
            style={position ?? undefined}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
}
```

- Две ссылки на DOM (шаг 2): на элемент и на подсказку — обе нужны для замера.
- `getBoundingClientRect()` даёт положение относительно окна — как раз то, что нужно для `position: fixed`.
- Пока `position` — `null`, у подсказки нет `style`, и она стоит там, куда её ставит CSS: `top: 0; left: 0`. Этого состояния пользователь не увидит.
- `tabIndex={0}` делает бейдж доступным с клавиатуры, а подсказка показывается и при фокусе. `role="tooltip"` и `aria-describedby` говорят экранному диктору, что текст подсказки описывает элемент. Для этой связи нужен id, уникальный на странице: подсказок «Хит» несколько. Его даёт хук [`useId`](https://react.dev/reference/react/useId) — строка, своя у каждого экземпляра компонента и неизменная между рендерами. `Math.random()` или счётчик модуля здесь не годятся: рендер должен быть чистым.

В карточке оберните бейдж «Хит»:

```tsx shared/GameCard.tsx
          {isHit(game) && (
            <Tooltip text="Рейтинг 4,6 и выше: эту игру выбирают чаще всего">
              <Badge tone="dark">Хит</Badge>
            </Tooltip>
          )}
```

::: task
1. Напишите `Tooltip({ text, children })`: ссылки на элемент и подсказку, состояния `open` и `position`, `useLayoutEffect` с замером и ограничением по правому краю, функции `show` и `hide`, элемент `<span>` с обработчиками мыши и фокуса и подсказку через `createPortal` в `document.body`.
2. В `GameCard` оберните бейдж «Хит» в `<Tooltip>` с текстом «Рейтинг 4,6 и выше: эту игру выбирают чаще всего».
:::

## Что получилось

Наведите мышь на «Хит» у «Острова сокровищ» — подсказка под бейджем, по его левому краю. У «Нардов» — сдвинута влево и заканчивается в 8 px от правого края окна. Уведите мышь — подсказка исчезла. Нажимайте Tab: когда фокус дойдёт до бейджа «Хит», подсказка появится и без мыши.

Откройте вкладку «Элементы» в инструментах разработчика браузера (превью — это `<iframe>`): подсказка — последний элемент `<body>`, после `<div id="root">`.

## Эксперименты

1. **Без ограничения.** Замените вычисление на `const left = anchor.left;` и наведите на «Хит» у «Нардов». Подсказка не вылезла за край — браузер **сжал** её до оставшихся 100 px, и текст вытянулся узкой колонкой. Верните `Math.min`.
2. **Без портала.** Нарисуйте подсказку на месте: `{open && (<div …>{text}</div>)}` вместо `createPortal(…)` и уберите импорт `createPortal`. Наведите на «Хит» у «Острова»: подсказка оказалась внизу карточки, узкой полоской, и ушла под соседнюю. При наведении у карточки появился `transform`, и `position: fixed` стал считать координаты от неё. Верните портал.
3. **`useEffect` вместо `useLayoutEffect`.** Добавьте перед замером ещё один эффект, который в ближайшем кадре сообщит, где стоит подсказка, и замените хук замера на `useEffect` (импорт тоже):

   ```tsx shared/Tooltip.tsx
     useLayoutEffect(() => {
       if (open)
         requestAnimationFrame(() =>
           console.log('кадр, left =', tipRef.current?.style.left || 'не задан'),
         );
     }, [open]);
     useEffect(() => {
       if (!open) return;
       console.log('замер');
       …
   ```

   На быстром компьютере разницы, скорее всего, не будет. Замедлите процессор: инструменты разработчика → «Производительность» (Performance) → значок шестерёнки → CPU: замедление в 20 раз. Наводите на «Хит» у «Нардов»: `кадр, left = не задан`, затем `замер` — браузер успел нарисовать кадр с подсказкой в углу окна, до замера. Верните `useLayoutEffect` — теперь всегда `замер`, затем `кадр, left = 252px`. Отключите замедление и уберите лишний эффект.

## Как в настоящем проекте

- Подсказки, выпадающие меню и всплывающие окна почти всегда рисуют порталом в `<body>`: так их не обрежет `overflow`, не сдвинет `transform` и не перекроет чужой `z-index`. UI-киты (глава 15) делают это сами.
- Положение «у края», переворот вверх, если внизу нет места, слежение за прокруткой и изменением размера окна — работа для библиотеки позиционирования, чаще всего [Floating UI](https://floating-ui.com/). Наша подсказка так не умеет: положение вычисляется один раз, при показе.
- `useLayoutEffect` нужен редко: замер размеров, положение, прокрутка, которые должны быть верными в первом же кадре. Для всего остального — `useEffect`, он не задерживает отрисовку.
