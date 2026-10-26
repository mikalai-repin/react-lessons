import { Section } from '../shared/Section';

// Страница для адреса, которого нет среди маршрутов
export function NotFoundPage() {
  return (
    <Section title="Такой страницы нет">
      <p className="muted">
        Проверьте адрес — или начните с главной.
      </p>
    </Section>
  );
}
