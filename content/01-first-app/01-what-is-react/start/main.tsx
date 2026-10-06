import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import {
  QueryClient,
  QueryClientProvider,
} from '@tanstack/react-query';
import { router } from './routes';
import './styles.css';

// retry: false — при ошибке сразу показываем её (повторы запросов — глава 11)
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
