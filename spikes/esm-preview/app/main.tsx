import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { router } from './routes';
import './styles.css';

const queryClient = new QueryClient();

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error, info) => console.error('onUncaughtError:', (error as Error).message, info.componentStack?.split('\n')[1]?.trim()),
  onCaughtError: (error) => console.warn('onCaughtError:', (error as Error).message),
}).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
