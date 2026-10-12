import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { ThemeContext } from './ThemeContext';
import type { Theme, ThemeContextValue } from './ThemeContext';

type ThemeProviderProps = {
  children: ReactNode;
};

// Тема оформления: выбор покупателя переживает перезапуск
export function ThemeProvider({
  children,
}: ThemeProviderProps) {
  const [theme, setTheme] = useLocalStorage<Theme>(
    'theme',
    'light',
  );

  // Синхронизация с <html>: его рисует не React, а страница.
  // По атрибуту data-theme styles.css выбирает цвета
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const value: ThemeContextValue = {
    theme,
    toggleTheme: () =>
      setTheme(theme === 'light' ? 'dark' : 'light'),
  };

  return <ThemeContext value={value}>{children}</ThemeContext>;
}
