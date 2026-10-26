import { Link, useMatches } from 'react-router';
import styles from './Breadcrumbs.module.css';

/** Что маршрут кладёт в handle: подпись крошки из данных loader */
export type CrumbHandle = {
  crumb: (data: unknown) => string;
};

// handle у маршрута может быть каким угодно — проверяем форму
function hasCrumb(handle: unknown): handle is CrumbHandle {
  return (
    typeof handle === 'object' &&
    handle !== null &&
    'crumb' in handle
  );
}

// Хлебные крошки: цепочка совпавших маршрутов, у которых есть crumb
export function Breadcrumbs() {
  const crumbs = useMatches().flatMap((match) =>
    hasCrumb(match.handle)
      ? [
          {
            id: match.id,
            to: match.pathname,
            label: match.handle.crumb(match.loaderData),
          },
        ]
      : [],
  );
  // На главной крошка одна — показывать нечего
  if (crumbs.length < 2) return null;

  return (
    <nav className={styles.crumbs} aria-label="Хлебные крошки">
      <ol>
        {crumbs.map((crumb, index) => (
          <li key={crumb.id}>
            {index === crumbs.length - 1 ? (
              <span aria-current="page">{crumb.label}</span>
            ) : (
              <Link to={crumb.to}>{crumb.label}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
