---
title: Изменение данных
startFrom: custom
focus: checkout/CheckoutPage.tsx
api: [action, Form, useActionData, useNavigation, redirect, ActionFunctionArgs]
backend: { latency: 1000, failRate: 0 }
---

Корзина собрана — пора оформить заказ. Учебный бэкенд принимает его без входа (гостевой заказ): `POST /api/orders` с позициями и данными покупателя. В ответ — `201` и номер заказа или ошибка: `400` для пустого заказа и `409`, если на складе меньше, чем заказано.

`loader` из прошлого шага **читает** данные до показа страницы. Для **изменения** у маршрута есть пара — `action`.

## Form и action

Форма оформления — компонент [`Form`](https://reactrouter.com/api/components/Form) из `react-router` вместо `<form>`:

```tsx checkout/CheckoutPage.tsx
      {/* Form роутера: отправку перехватит action этого маршрута */}
      <Form method="post" className={styles.form}>
        <label className={styles.field}>
          Имя
          <input name="name" className="search" required />
        </label>
        …
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Отправляем…' : 'Заказать'}
        </Button>
      </Form>
```

Обычная форма при отправке ушла бы со страницы — браузер загрузил бы адрес `action` (так было в главе 4 без `preventDefault`). `Form` останавливает это и делает то же самое **внутри приложения**: собирает поля в `FormData` и вызывает `action` маршрута, на котором стоит, — как будто это сервер.

```tsx checkout/CheckoutPage.tsx
// Отправка формы: роутер вызывает action с данными формы.
// Корзину берём прямо из стора — он живёт вне React
export async function checkoutAction({
  request,
}: ActionFunctionArgs) {
  const form = await request.formData();
  const { items, promo } = useCartStore.getState();
  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      items,
      promo,
      customer: {
        name: form.get('name'),
        email: form.get('email'),
        address: form.get('address'),
      },
    }),
  });
  if (!response.ok) {
    // Ошибку сервера вернём странице: её прочитает useActionData
    const { message } = (await response.json()) as {
      message: string;
    };
    return { error: message };
  }
  const order = (await response.json()) as { id: number };
  useCartStore.getState().clear();
  // Заказ принят — уводим на страницу «Заказ оформлен»
  return redirect(`/checkout/done?order=${order.id}`);
}
```

- Поля формы — `request.formData()`, по атрибутам `name` (как `FormData` в главе 5).
- Корзина — из стора через `getState()`: `action`, как и `loader`, — функция вне React, хуки в ней нельзя. Вот где пригодилось, что стор Zustand живёт в модуле (глава 9).
- `action` может вернуть **данные** — их получит страница — или **ответ-переход** `redirect(…)`: роутер сразу откроет другой адрес.

Маршрут получает `action`, а рядом — страница «Заказ оформлен»:

```tsx routes.tsx
      {
        path: 'checkout',
        // Изменение данных: <Form method="post"> этой страницы
        action: checkoutAction,
        Component: CheckoutPage,
      },
      { path: 'checkout/done', Component: OrderDonePage },
```

Закадровая правка в старте: `clear` в сторе теперь сбрасывает и промокод — молча, без уведомления «Промокод снят». После заказа уведомлять о нём незачем.

## Что видит страница

```tsx checkout/CheckoutPage.tsx
  // Что вернул action: undefined — форму ещё не отправляли
  const actionData = useActionData<typeof checkoutAction>();
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
```

- [`useActionData`](https://reactrouter.com/api/hooks/useActionData) — результат последнего `action` этого маршрута. Тип выведен из функции: `{ error: string } | undefined` — `redirect` роутер исполнил сам, страница его не получает.
- `useNavigation().state` теперь бывает тремя: `'idle'`, `'loading'` (прошлый шаг) и `'submitting'` — форма отправлена, `action` выполняется. Кнопка на это время выключена и говорит «Отправляем…»: второй щелчок не отправит второй заказ.

`OrderDonePage` читает номер заказа из адреса (`useSearchParams`, шаг «Состояние в URL»). А в `CartPage` под мини-корзиной — ссылка «Оформить заказ» на `/checkout`, оформленная кнопкой (класс `button`; стиль для ссылок-кнопок — в `styles.css`).

::: task
1. В заготовке `checkout/CheckoutPage.tsx` напишите `checkoutAction` (поля формы, корзина из стора, `POST /api/orders`, ошибка — `{ error }`, успех — `clear()` и `redirect`) и `CheckoutPage`: «N шт. на сумму» (`summarizeCart`), `Form method="post"` с полями `name`, `email` (`type="email"`), `address` (все `required`), ошибка из `useActionData` в `<p role="alert">`, кнопка «Заказать» / «Отправляем…».
2. В заготовке `checkout/OrderDonePage.tsx` — раздел «Заказ №N оформлен» и ссылка в каталог.
3. В `routes.tsx` — маршруты `checkout` (с `action`) и `checkout/done`; в `CartPage` — ссылка «Оформить заказ», если корзина не пуста.
:::

## Что получилось

Положите в корзину три «Ночных экспресса», откройте корзину — «Оформить заказ». На странице оформления — «3 шт. на 9 570 ₽». Заполните поля и нажмите «Заказать»: секунду кнопка серая — «Отправляем…», в «Сети» — `POST /api/orders` со статусом `201`. Затем `/checkout/done?order=1`, «Заказ №1 оформлен», в шапке «Корзина: 0».

## Эксперименты

1. **Склад кончился.** Сразу после заказа положите в корзину ещё один «Ночной экспресс» — магазин позволит: локальный каталог по-прежнему думает, что их три. Оформите заказ: под формой «„Ночной экспресс“: на складе только 0» — `409` от сервера, вернувшийся из `action` через `useActionData`. Адрес остался `/checkout`, корзина на месте. Так и в настоящем магазине: данные на экране устаревают, и последнее слово — за сервером. Нажмите ⟳ — склад бэкенда снова полон: учебный бэкенд хранит данные только до перезапуска.
2. **Пустые поля.** Нажмите «Заказать», не заполнив форму: браузер подсветит первое пустое поле, а в «Сети» — ни одного запроса. `required` и `type="email"` проверяет сам браузер, до `Form` дело не доходит. Проверки посложнее — глава 13.
3. **«Назад» после заказа.** На странице «Заказ оформлен» нажмите «назад» в превью: снова оформление, но «0 шт. на 0 ₽» — и форму можно отправить (сервер ответит «Пустой заказ»). Оформлять пустую корзину не должно быть можно вовсе — это шаг «Защита маршрутов».

## Как в настоящем проекте

- После успешного изменения — `redirect`: «назад» не отправит форму ещё раз, а ⟳ на странице результата ничего не сломает (приём «Post/Redirect/Get» — с тех времён, когда формы отправляли на сервер).
- После каждого `action` роутер **заново вызывает загрузчики** открытой страницы: данные на экране сами согласуются с сервером. Здесь загрузчиков нет, но в главе 11 это станет важно.
- `<Form method="post">` — переход: он добавляет запись в историю и меняет `useNavigation` у всего приложения. Для действий «на месте» — «Подписаться», «В избранное», «Отметить прочитанным» — есть `useFetcher` (следующий шаг).
- В режиме фреймворка тот же `action` выполняется **на сервере**, и форма работает даже без JavaScript. В главе 12 вы увидите, как React 19 сделал похожее частью самого React: `<form action={функция}>`, `useActionState`.
