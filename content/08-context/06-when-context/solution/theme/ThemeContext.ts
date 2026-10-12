import { createContext, use } from 'react';

export type Theme = 'light' | 'dark';

/** Тема оформления и её переключатель */
export type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

// Тема для всего приложения; null — компонент вне провайдера
export const ThemeContext =
  createContext<ThemeContextValue | null>(null);

// Тема из ближайшего провайдера выше по дереву
export function useTheme() {
  const value = use(ThemeContext);
  if (value === null) {
    throw new Error(
      'useTheme: выше по дереву нет провайдера темы',
    );
  }
  return value;
}
