import { useTheme } from '../theme/ThemeContext';

// Вкладка «Настройки»: тема оформления
export function SettingsPage() {
  const { theme, toggleTheme } = useTheme();
  return (
    <label>
      <input
        type="checkbox"
        checked={theme === 'dark'}
        onChange={toggleTheme}
      />
      Тёмная тема
    </label>
  );
}
