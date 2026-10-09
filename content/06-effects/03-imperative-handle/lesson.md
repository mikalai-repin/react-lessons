---
title: useImperativeHandle
startFrom: custom
focus: shared/ConfirmDialog.tsx
api: [useImperativeHandle, '<dialog>', showModal, 'method="dialog"', returnValue]
---

В мини-корзине появится ссылка «Очистить корзину». Убрать всё одним щелчком легко и случайно, поэтому сначала спросим: «Очистить корзину?» — в модальном окне с кнопками «Отмена» и «Очистить».

Что уже готово в старте:

- в `store/cartReducer.ts` — действие `{ type: 'cleared' }`: редьюсер убирает все позиции (`draft.splice(0)`);
- в `App` — обработчик `handleClear`, он передан мини-корзине пропом `onClear`; в типе props `MiniCart` проп уже объявлен;
- стили окна — в `shared/ConfirmDialog.module.css`, стиль ссылки `.clear` — в `MiniCart.module.css`;
- `shared/ConfirmDialog.tsx` — только комментарий `TODO`.

## Модальное окно в браузере

Модальное окно не нужно собирать из `<div>` с затемнением: в браузере есть [`<dialog>`](https://developer.mozilla.org/ru/docs/Web/HTML/Element/dialog). Метод `dialog.showModal()` показывает его поверх страницы, затемняет фон (`::backdrop`), не пускает фокус и щелчки на страницу под окном и закрывает окно по Esc.

Открыть модальное окно можно **только вызовом метода**. Атрибут `open` (`<dialog open>`) тоже показывает окно, но обычным блоком, без затемнения и без Esc. Значит, тому, кто хочет открыть окно, нужен доступ к DOM-элементу — ссылка из прошлого шага.

Закрыть окно поможет форма с `method="dialog"`. Отправка такой формы никуда не уходит: браузер закрывает окно, а в `dialog.returnValue` кладёт `value` нажатой кнопки. После закрытия `<dialog>` получает событие `close`.

## Своё API компонента

Можно отдать родителю ссылку прямо на `<dialog>`, как в прошлом шаге — на `<input>`. Но тогда `MiniCart` получит весь элемент: может вызвать `show()` вместо `showModal()`, убрать окно из DOM, поменять ему стили. Компонент окна больше не отвечает за то, как им пользуются.

[`useImperativeHandle`](https://react.dev/reference/react/useImperativeHandle) позволяет положить в ссылку родителя **не DOM-элемент, а свой объект**:

```tsx
useImperativeHandle(ref, () => ({
  open() {
    dialogRef.current?.showModal();
  },
}));
```

Первый аргумент — ссылка из props, второй — функция, которая создаёт объект. После фиксации React запишет этот объект в `ref.current` родителя. Сам `<dialog>` остаётся во внутренней ссылке `dialogRef` — наружу видно только `open()`.

```tsx shared/ConfirmDialog.tsx
import { useImperativeHandle, useRef } from 'react';
import type { ReactNode, Ref } from 'react';
import { Button } from './Button';
import styles from './ConfirmDialog.module.css';

/** Что окно открывает наружу через ref: только open() */
export type ConfirmDialogHandle = {
  open: () => void;
};

type ConfirmDialogProps = {
  ref?: Ref<ConfirmDialogHandle>;
  title: string;
  // Текст кнопки подтверждения: «Очистить», «Удалить»
  confirmText: string;
  children: ReactNode;
  // Покупатель подтвердил
  onConfirm: () => void;
};

// Окно подтверждения на <dialog>: модальное, закрывается по Esc и «Отмене»
export function ConfirmDialog({
  ref,
  title,
  confirmText,
  children,
  onConfirm,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Вместо <dialog> родитель получит объект с одним методом
  useImperativeHandle(ref, () => ({
    open() {
      dialogRef.current?.showModal();
    },
  }));

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      onClose={(e) => {
        // returnValue — value кнопки, которая закрыла окно
        if (e.currentTarget.returnValue === 'confirm') onConfirm();
      }}
    >
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.text}>{children}</p>
      {/* method="dialog": отправка формы закрывает окно */}
      <form method="dialog" className={styles.actions}>
        <button className={styles.cancel} value="cancel">
          Отмена
        </button>
        <Button type="submit" value="confirm">
          {confirmText}
        </Button>
      </form>
    </dialog>
  );
}
```

- Тип ссылки — `Ref<ConfirmDialogHandle>`: родитель знает, что в ней будет объект с `open`, а не `HTMLDialogElement`.
- Обе кнопки отправляют форму (у `<button>` в форме тип по умолчанию — `submit`), отличаются они `value`. Окно закрывается всегда, а `onConfirm` вызываем, только если его закрыла кнопка подтверждения.
- `onClose` — событие `close` элемента `<dialog>`; `e.currentTarget` — сам `<dialog>`.

В мини-корзине — ссылка с типом из окна, кнопка «Очистить корзину» и само окно. Хук вызываем в начале компонента: ниже есть ранний `return` пустой корзины, а хуки нельзя вызывать после условного выхода (почему — глава 7).

```tsx cart/MiniCart.tsx {1,4-5,8,10-11}
import { useRef } from 'react';
import type { CartItem, Game } from '../api/models';
import { Badge } from '../shared/Badge';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import type { ConfirmDialogHandle } from '../shared/ConfirmDialog';
…
  onRemove,
  onClear,
}: MiniCartProps) {
  // Окно подтверждения: у ссылки — только метод open()
  const confirmRef = useRef<ConfirmDialogHandle>(null);
```

```tsx cart/MiniCart.tsx
      <button
        type="button"
        className={styles.clear}
        onClick={() => confirmRef.current?.open()}
      >
        Очистить корзину
      </button>
      <ConfirmDialog
        ref={confirmRef}
        title="Очистить корзину?"
        confirmText="Очистить"
        onConfirm={onClear}
      >
        Все игры уберутся из корзины: {count} шт.
      </ConfirmDialog>
    </Section>
```

Окно стоит в разметке всегда, пока в корзине есть игры, — закрытый `<dialog>` браузер не показывает.

::: task
1. В `shared/ConfirmDialog.tsx` объявите тип `ConfirmDialogHandle` с методом `open` и компонент `ConfirmDialog`: внутренняя ссылка на `<dialog>`, `useImperativeHandle` с `open()`, заголовок, текст из `children` и форма `method="dialog"` с кнопками «Отмена» (`value="cancel"`) и подтверждения (`value="confirm"`). В `onClose` вызовите `onConfirm`, если `returnValue === 'confirm'`.
2. В `MiniCart` деструктурируйте `onClear`, создайте `confirmRef` в начале компонента и после строки о доставке нарисуйте кнопку «Очистить корзину» и `<ConfirmDialog>`.
:::

## Что получилось

Добавьте в корзину «Остров сокровищ» и «Нарды» и нажмите «Очистить корзину». Страница затемнилась, посередине — «Очистить корзину?» и «Все игры уберутся из корзины: 2 шт.», фокус перешёл в окно. Нажмите «Отмена» — окно закрылось, игры на месте. Откройте снова и нажмите Esc — то же самое: `returnValue` пустой. Ещё раз — «Очистить»: «Корзина пуста — добавьте игру из каталога».

::: tip
Отправка формы без `preventDefault` в превью перезапускает приложение с адреса формы (глава 4). Форму `method="dialog"` превью не трогает — как и настоящий браузер, который её никуда не отправляет.
:::

## Эксперименты

1. **Что лежит в ссылке.** Замените обработчик кнопки на `onClick={() => console.log('ref:', confirmRef.current)}` и нажмите «Очистить корзину». В консоли — `ref: { open: ƒ open() }`: никакого `<dialog>`, только то, что вернула функция в `useImperativeHandle`.
2. **Чужие методы.** Вызовите `confirmRef.current?.close()`. Редактор: `Property 'close' does not exist on type 'ConfirmDialogHandle'.` Родитель может только то, что компонент разрешил.
3. **`show()` вместо `showModal()`.** Поменяйте метод в `open()`. Окно появилось в потоке страницы, без затемнения, и Esc его не закрывает — это обычный, немодальный `<dialog>`. Верните `showModal()`.

## Когда императивное API, а когда props

Обычно React-компонентом управляют **декларативно**: родитель описывает, что должно быть (`<Dialog open={isOpen}>`), а компонент сам приводит DOM в соответствие. Императивное API (`open()`, `focus()`, `scrollTo()`) — для действий, которые происходят в момент события, а не описываются состоянием: поставить фокус, прокрутить, запустить анимацию, открыть модальное окно браузера.

Окно подтверждения можно сделать и декларативно — с пропом `open` и вызовом `showModal()` при его изменении. Но «при изменении пропа сделать что-то с DOM» — это уже эффект, следующий шаг. Здесь `showModal()` и так вызывается в ответ на щелчок, и метод `open()` — самый прямой путь.

## Как в настоящем проекте

- `useImperativeHandle` нужен редко: для компонентов-обёрток над DOM (поле, видео, редактор, карта), где родителю нужно несколько действий, но не весь элемент. Если хватает props — используйте props.
- UI-киты дают готовые модальные окна и подтверждения — с ними познакомимся в главе 15 (Ant Design). Внутри у них те же идеи: фокус в окне, Esc, затемнение, возврат фокуса.
- В объект можно положить не только методы: `{ focus, scrollIntoView, reset }`. Третий аргумент `useImperativeHandle` — массив зависимостей, как у эффектов (шаг 4); без него объект создаётся заново после каждой фиксации.

::: deep
В `react-dom-client.development.js` `useImperativeHandle` устроен как layout-эффект (их разберём в шаге 8): после фиксации React вызывает вашу функцию и пишет результат в `ref.current`, а при очистке записывает туда `null`. Если вместо объекта из `useRef` передать колбэк-ref, React вызовет его с объектом — так же, как с DOM-элементом.
:::
