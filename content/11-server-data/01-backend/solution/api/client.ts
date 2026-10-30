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
export async function apiGet<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`/api${path}`, { signal });
  if (!response.ok) {
    // Учебный сервер кладёт текст ошибки в поле message
    const body = (await response.json()) as { message: string };
    throw new ApiError(response.status, body.message);
  }
  return (await response.json()) as T;
}
