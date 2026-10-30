import {
  isRouteErrorResponse,
  useRevalidator,
  useRouteError,
} from 'react-router';
import { ApiError } from '../api/client';
import { Button } from '../shared/Button';
import { Section } from '../shared/Section';
import { NotFoundPage } from './NotFoundPage';

// Граница ошибок маршрутов: что показать вместо страницы,
// если loader, action или сам компонент бросили ошибку
export function RouteError() {
  const error = useRouteError();
  // Повторить: роутер заново вызовет загрузчики страницы
  const revalidator = useRevalidator();

  // Код ответа: от роутера (throw data(…)) или от нашего apiGet
  const status = isRouteErrorResponse(error)
    ? error.status
    : error instanceof ApiError
      ? error.status
      : null;
  if (status === 404) {
    return <NotFoundPage />;
  }
  return (
    <Section title="Что-то пошло не так">
      <p className="muted">
        {status !== null
          ? `Сервер ответил ошибкой ${status}.`
          : 'Ошибка в приложении — мы уже знаем о ней.'}
      </p>
      <Button
        onClick={() => revalidator.revalidate()}
        disabled={revalidator.state === 'loading'}
      >
        Попробовать снова
      </Button>
    </Section>
  );
}
