import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router/dom';
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
        <RouterProvider router={router} />
      </FavoritesProvider>
    </ThemeProvider>
  </StrictMode>,
);
