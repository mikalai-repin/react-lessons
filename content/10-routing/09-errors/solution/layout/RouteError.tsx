import {
  isRouteErrorResponse,
  useRevalidator,
  useRouteError,
} from 'react-router';
import { Button } from '../shared/Button';
import { Section } from '../shared/Section';
import { NotFoundPage } from './NotFoundPage';

// Граница ошибок маршрутов: что показать вместо страницы,
// если loader, action или сам компонент бросили ошибку
export function RouteError() {
  const error = useRouteError();
  // Повторить: роутер заново вызовет загрузчики страницы
  const revalidator = useRevalidator();

  // Ответ с кодом — его бросили намеренно: throw data(…, { status })
  if (isRouteErrorResponse(error) && error.status === 404) {
    return <NotFoundPage />;
  }
  return (
    <Section title="Что-то пошло не так">
      <p className="muted">
        {isRouteErrorResponse(error)
          ? `Сервер ответил ошибкой ${error.status}.`
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
