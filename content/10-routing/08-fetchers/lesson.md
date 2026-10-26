---
title: useFetcher
focus: layout/Footer.tsx
api: [useFetcher, fetcher.Form, fetcher.data, fetcher.state, ресурсный маршрут]
backend: { latency: 1000, failRate: 0 }
---

Подписка в подвале пока ничего не отправляет: собирает поля и пишет сообщение. В учебном бэкенде появилась ручка `POST /api/subscribe` (`201`; `400` без e-mail; `409`, если адрес уже подписан). Подключим её через роутер — как оформление заказа.

Но `<Form method="post">` из прошлого шага — это **переход**: новая запись в истории, `useNavigation` у всего приложения (страница приглушается), а после — другая страница или та же с данными `action`. Подписка не должна никуда уводить: покупатель читает «Ночной экспресс», подписался в подвале — и продолжает читать. Для таких действий «на месте» — [`useFetcher`](https://reactrouter.com/api/hooks/useFetcher).

## Ресурсный маршрут

Сначала — `action`, которому отправлять. Страница ему не нужна: маршрут только с `action`, без `Component`, называется **ресурсным**:

```tsx routes.tsx
      // Ресурсный маршрут: только action, страницы нет
      { path: 'subscribe', action: subscribeAction },
```

Сам `subscribeAction` — рядом с формой, в `layout/Footer.tsx`. Он устроен как `checkoutAction`: поля из `request.formData()`, `fetch` на бэкенд, результат — объект для формы:

```tsx layout/Footer.tsx
// Подписка: action ресурсного маршрута /subscribe (без страницы)
export async function subscribeAction({
  request,
}: ActionFunctionArgs) {
  const data = await request.formData();
  const email = String(data.get('email'));
  const topic = String(data.get('topic'));
  // Неотмеченного флажка в FormData нет совсем
  const weekly = data.get('weekly') === 'on';
  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, topic, weekly }),
  });
  if (!response.ok) {
    const { message } = (await response.json()) as {
      message: string;
    };
    return { message };
  }
  return {
    message: `Подписка оформлена — ${email}: ${TOPICS[topic]}${weekly ? ', раз в неделю' : ''}`,
  };
}
```

## Fetcher

```tsx layout/Footer.tsx
  // Свой «канал» к action: своё состояние и свои данные ответа
  const fetcher = useFetcher<typeof subscribeAction>();
  const busy = fetcher.state !== 'idle';
  …
      <fetcher.Form
        method="post"
        action="/subscribe"
        className={styles.form}
      >
        …
        <button
          type="submit"
          className="button"
          disabled={busy}
        >
          {busy ? 'Подписываем…' : 'Подписаться'}
        </button>
      </fetcher.Form>
      {fetcher.data && (
        <p className={styles.done} role="status">
          {fetcher.data.message}
        </p>
      )}
```

`useFetcher` возвращает объект-«канал» к загрузчикам и действиям маршрутов, который **не трогает адрес**:

- `fetcher.Form` — как `Form`, но отправка идёт мимо навигации; `action="/subscribe"` — какой маршрут вызвать;
- `fetcher.state` — `'idle'`, `'submitting'`, `'loading'` — только этого фетчера, а не всего приложения;
- `fetcher.data` — что вернул `action`; тип выведен из `typeof subscribeAction`.

Фетчеров на странице может быть сколько угодно, и каждый живёт своей жизнью: десять кнопок «В избранное» в списке — десять фетчеров, каждый со своим «сохраняем…».

Прошлое состояние `result` и обработчик `handleSubmit` больше не нужны — ответ хранит фетчер.

::: task
1. В `layout/Footer.tsx` напишите `subscribeAction`: поля формы → `POST /api/subscribe` → `{ message }` с текстом ошибки сервера или «Подписка оформлена — …».
2. В `routes.tsx` — ресурсный маршрут `subscribe` с этим `action`.
3. В `Footer` вместо `<form onSubmit>` — `fetcher.Form method="post" action="/subscribe"`; кнопка «Подписываем…» на время запроса; сообщение — из `fetcher.data` в `<p role="status">`.
:::

## Что получилось

Откройте «Ночной экспресс» и подпишитесь в подвале: секунду кнопка «Подписываем…», страница **не** приглушается, адрес по-прежнему `/games/4`. Потом — «Подписка оформлена — a@b.ru: новинки, раз в неделю». Подпишите тот же адрес ещё раз — «Этот адрес уже подписан» (`409`).

## Эксперименты

1. **Что ещё ушло в «Сеть».** Посмотрите вкладку после подписки на странице игры: `POST /api/subscribe` — и сразу за ним `GET /api/games/4`. После **любого** `action` — формы или фетчера — роутер заново вызывает загрузчики открытой страницы: вдруг действие изменило их данные (это и есть «ревалидация» из прошлого шага). Для заказа это полезно, для подписки — лишний запрос. Отключают его функцией `shouldRevalidate` у маршрута игры: она получает, какой `action` был, и решает, перезагружать ли.
2. **Обычная `Form`.** Замените `fetcher.Form` на `Form` (и импортируйте её) и подпишитесь со страницы каталога. Адрес стал `/subscribe`, между шапкой и подвалом — пусто, сообщения нет. Это был переход на ресурсный маршрут, у которого нет страницы, а `useActionData` в подвале не читает никто. Верните `fetcher.Form`.

## Как в настоящем проекте

- Правило выбора: действие уводит на другую страницу (оформить заказ, войти, создать запись) — `Form` и `redirect`. Действие «на месте» (лайк, избранное, «отметить прочитанным», подписка, автосохранение) — фетчер.
- У фетчера есть и `fetcher.load('/api-route')` — вызвать **загрузчик** без перехода: подсказки в поиске, превью при наведении, «проверить, свободен ли логин».
- Оптимистичный интерфейс («сердечко загорелось сразу, а запрос идёт») строят на `fetcher.formData` — данных, которые сейчас отправляются; в главе 12 то же самое сделает `useOptimistic` из самого React.
