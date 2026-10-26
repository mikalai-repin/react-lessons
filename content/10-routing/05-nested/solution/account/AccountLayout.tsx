import { NavLink, Outlet } from 'react-router';
import { Section } from '../shared/Section';
import styles from './AccountLayout.module.css';

// Кабинет: общий заголовок и вкладки. Вкладка — дочерний маршрут
export function AccountLayout() {
  return (
    <Section title="Кабинет">
      <nav
        className={styles.tabs}
        aria-label="Разделы кабинета"
      >
        {/* Пути относительные: от адреса этого маршрута, /account */}
        {/* end: «Избранное» не горит на /account/settings */}
        <NavLink to="." end>
          Избранное
        </NavLink>
        <NavLink to="settings">Настройки</NavLink>
      </nav>
      <Outlet />
    </Section>
  );
}
