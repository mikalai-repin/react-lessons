import { Link } from 'react-router';
import { Section } from '../shared/Section';

// Страница для адреса, которого нет среди маршрутов
export function NotFoundPage() {
  return (
    <Section title="Такой страницы нет">
      <p className="muted">
        Проверьте адрес — или начните{' '}
        <Link to="/">с главной</Link>.
      </p>
    </Section>
  );
}
