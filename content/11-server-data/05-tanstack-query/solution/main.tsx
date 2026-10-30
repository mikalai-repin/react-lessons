import { StrictMode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
import { queryClient } from './api/queryClient';
import { FavoritesProvider } from './favorites/FavoritesProvider';
import { router } from './routes';
import { ThemeProvider } from './theme/ThemeProvider';
import './styles.css';

// Элемент, внутри которого React рисует приложение
const container = document.getElementById('root');
if (!container)
  throw new Error('На странице нет элемента #root');

const root = createRoot(container);
root.render(
  <StrictMode>
    <ThemeProvider>
      <FavoritesProvider>
        {/* Кэш запросов — всем компонентам приложения */}
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
        </QueryClientProvider>
      </FavoritesProvider>
    </ThemeProvider>
  </StrictMode>,
);
