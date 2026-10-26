import { Link, useSearchParams } from 'react-router';
import { Section } from '../shared/Section';

// «Заказ оформлен»: номер заказа — из адреса ?order=…
export function OrderDonePage() {
  const [searchParams] = useSearchParams();
  return (
    <Section
      title={`Заказ №${searchParams.get('order')} оформлен`}
    >
      <p className="muted">
        Мы напишем на почту, когда передадим его в доставку.{' '}
        <Link to="/catalog">Вернуться в каталог</Link>
      </p>
    </Section>
  );
}
