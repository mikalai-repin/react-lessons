// Запросы к учебному серверу: один fetch на всё приложение

/** Сервер ответил ошибкой: код ответа и сообщение из тела */
export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** GET /api/… → данные ответа. Ответ не 2xx — ApiError.
 *  signal отменит запрос, если ответ больше не нужен */
export function apiGet<T>(path: string, signal?: AbortSignal) {
  return request<T>(path, { signal });
}

/** POST /api/… с телом JSON → данные ответа. Ответ не 2xx — ApiError */
export function apiPost<T>(path: string, body: unknown) {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function request<T>(path: string, init: RequestInit) {
  const response = await fetch(`/api${path}`, init);
  if (!response.ok) {
    // Учебный сервер кладёт текст ошибки в поле message
    const body = (await response.json()) as { message: string };
    throw new ApiError(response.status, body.message);
  }
  return (await response.json()) as T;
}
