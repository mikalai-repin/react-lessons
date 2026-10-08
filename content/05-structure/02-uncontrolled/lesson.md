---
title: Неуправляемые поля
startFrom: custom
focus: layout/Footer.tsx
api: [defaultValue, defaultChecked, FormData, 'SubmitEvent', 'form.reset()']
---

Внизу магазина появится подписка на новости: e-mail, тема рассылки и флажок «Не чаще раза в неделю». Покупатель заполняет форму и нажимает «Подписаться». Пока он печатает, магазину не нужно знать ни одной буквы, значения нужны только **в момент отправки**. Держать каждое поле в состоянии и рендерить подвал на каждую букву здесь незачем. Пусть значения хранит сам браузер.

## Поле, которое помнит само

Неуправляемое поле — обычное поле HTML. У него нет `value` из состояния: что ввели, то и лежит в DOM-узле. React задаёт только **начальное** значение:

- `defaultValue` — у `<input>`, `<textarea>` и `<select>`;
- `defaultChecked` — у флажка и переключателя.

Прочитать значения проще всего при отправке формы — через [`FormData`](https://developer.mozilla.org/ru/docs/Web/API/FormData), API браузера, которое собирает поля с атрибутом `name`.

## Подвал с подпиской

Стили готовы в `layout/Footer.module.css`, в `layout/Footer.tsx` — комментарий `TODO`. Компонент:

```tsx layout/Footer.tsx
import { useState } from 'react';
import type { SubmitEvent } from 'react';
import styles from './Footer.module.css';

// Подписи тем рассылки — для сообщения после подписки
const TOPICS: Record<string, string> = {
  new: 'новинки',
  sale: 'скидки',
};

// Подвал магазина: подписка на рассылку
export function Footer() {
  // Итог подписки для сообщения; null — ещё не подписались
  const [result, setResult] = useState<string | null>(null);

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    // Значения полей читаем из формы в момент отправки
    const form = e.currentTarget;
    const data = new FormData(form);
    const email = String(data.get('email'));
    const topic = TOPICS[String(data.get('topic'))];
    // Неотмеченного флажка в FormData нет совсем
    const weekly = data.get('weekly') === 'on';
    setResult(
      `${email}: ${topic}${weekly ? ', раз в неделю' : ''}`,
    );
    form.reset();
  }

  return (
    <footer className={styles.footer}>
      <h2 className={styles.title}>Новости магазина</h2>
      <form className={styles.form} onSubmit={handleSubmit}>
        <label>
          E-mail
          <input
            name="email"
            type="email"
            required
            className="search"
            placeholder="you@example.ru"
          />
        </label>
        <label>
          Что присылать
          <select
            name="topic"
            defaultValue="new"
            className="search"
          >
            <option value="new">Новинки</option>
            <option value="sale">Скидки</option>
          </select>
        </label>
        <label className={styles.check}>
          <input type="checkbox" name="weekly" defaultChecked />
          Не чаще раза в неделю
        </label>
        <button type="submit" className="button">
          Подписаться
        </button>
      </form>
      {result && (
        <p className={styles.done}>Подписка оформлена — {result}</p>
      )}
    </footer>
  );
}
```

Разберём обработчик:

- `SubmitEvent<HTMLFormElement>` — тип события отправки из `react`. Вы встретите и `FormEvent`: в `@types/react` 19.3 он помечен устаревшим, для `onSubmit` правильный тип — `SubmitEvent`.
- `e.preventDefault()` отменяет отправку формы браузером — без него страница ушла бы по адресу формы (глава 4).
- `e.currentTarget` — элемент, на котором висит обработчик, то есть сама форма. `new FormData(form)` собирает пары «`name` — значение».
- `data.get(…)` возвращает `string`, `File` (у поля выбора файла) или `null`, если поля нет. Отсюда `String(…)`.
- Отмеченный флажок без атрибута `value` отправляет строку `'on'`. **Неотмеченного флажка в `FormData` нет вовсе** — поэтому сравнение `=== 'on'`.
- `form.reset()` — метод DOM: поля возвращаются к начальным значениям, то есть к `defaultValue` и `defaultChecked`.

Состояние в подвале всё же есть — `result`: сообщение после подписки нужно нарисовать, а рисует React только из состояния. Состояние нужно для того, что видно на экране, а не для каждого поля формы.

Подвал подключите в `App` после `</main>`:

```tsx App.tsx {3}
        </Section>
      </main>
      <Footer />
    </>
```

::: task
1. В `layout/Footer.tsx` напишите компонент `Footer`: форма с полями `email` (`type="email"`, `required`), `topic` (`<select>` с `defaultValue="new"`) и флажком `weekly` (`defaultChecked`). У полей — атрибут `name`, у кнопки — `type="submit"`.
2. В `handleSubmit` отмените отправку браузером, соберите `FormData`, запишите в состояние строку «адрес: тема[, раз в неделю]» и сбросьте форму.
3. Под формой выводите «Подписка оформлена — …», когда строка есть.
4. Нарисуйте `<Footer />` в `App` после `</main>`.
:::

## Что получилось

Прокрутите вниз. Введите «abc» и нажмите «Подписаться» — браузер не отправит форму и покажет подсказку у поля: `type="email"` и `required` — проверка самого браузера, без единой строки React. Введите `anya@example.ru`, выберите «Скидки», снимите флажок, отправьте: «Подписка оформлена — anya@example.ru: скидки». Поля вернулись к началу: адрес пуст, «Новинки», флажок отмечен.

## Эксперименты

**Рендеров нет.** Добавьте в начало `Footer` строку `console.log('render Footer')`. Введите адрес, смените тему, щёлкните флажок — в консоли пусто: значения меняются в DOM, состояние не трогается. Нажмите «Подписаться» — две строки (строгий режим): `setResult` запустил рендер.

**Что в `FormData`.** В `handleSubmit` добавьте `console.log([...data.entries()])`, снимите флажок и отправьте форму:

```
[["email", "a@b.ru"], ["topic", "new"]]
```

Флажка `weekly` нет. Поле без `name` тоже не попадёт в `FormData` — уберите `name="topic"` и проверьте.

**`defaultValue` — только начало.** Значение по умолчанию React применяет один раз, при появлении поля. Если позже `defaultValue` изменится, текст в поле останется прежним: React обновит атрибут `value` в DOM, но не то, что видит пользователь. Хотите, чтобы поле показывало новые данные, — нужно управляемое поле или сброс через `key` (шаг про сброс состояния).

**`checked` без `onChange`.** Замените у флажка `defaultChecked` на `checked`. Щелчки перестанут работать, а в консоли — знакомое предупреждение, теперь с советом про `defaultChecked`:

```
You provided a `checked` prop to a form field without an `onChange` handler. This will render a read-only field. If the field should be mutable use `defaultChecked`. …
```

## Как в настоящем проекте

| | Управляемое | Неуправляемое |
|---|---|---|
| Где значение | в состоянии React | в DOM |
| Атрибуты | `value` + `onChange` | `name` + `defaultValue` |
| Рендер на каждый ввод | да | нет |
| Значение во время ввода | всегда под рукой | только из DOM |
| Сброс | записать начальное в состояние | `form.reset()` |

- Неуправляемые поля хороши для форм «заполнил — отправил»: подписка, вход, обратная связь. Валидацию часто закрывают атрибуты браузера: `required`, `type`, `minLength`, `pattern`.
- Управляемые — когда значение нужно на лету: поиск, счётчик, зависимые поля, формат при вводе.
- React 19 умеет передавать `FormData` прямо в функцию — `<form action={…}>`, без `preventDefault`; это глава 12. Библиотека форм React Hook Form (глава 13) по умолчанию тоже опирается на неуправляемые поля — ради того же: меньше рендеров.
