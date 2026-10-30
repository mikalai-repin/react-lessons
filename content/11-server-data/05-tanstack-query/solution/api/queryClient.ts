import { QueryClient } from '@tanstack/react-query';

// Клиент TanStack Query — один на приложение: в нём живёт кэш
// всех запросов. Отдельный модуль: клиент понадобится и вне React
export const queryClient = new QueryClient();
