import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

// Элемент, внутри которого React рисует приложение
const container = document.getElementById('root');
if (!container)
  throw new Error('На странице нет элемента #root');

const root = createRoot(container);
root.render(
  <StrictMode>
    <App title="Ход конём" />
  </StrictMode>,
);
