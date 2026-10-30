import { QueryClient } from '@tanstack/react-query';

// Сколько данные считаются свежими, мс: свежие берутся из кэша
// без запроса. По умолчанию 0 — запрос при каждом новом показе
const STALE_TIME = 30_000;

// Клиент TanStack Query — один на приложение: в нём живёт кэш
// всех запросов. Отдельный модуль: клиент понадобится и вне React
export const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: STALE_TIME } },
});
