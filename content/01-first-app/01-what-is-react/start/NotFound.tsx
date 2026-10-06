import { Link } from 'react-router';

export function NotFound() {
  return (
    <>
      <h1>Нет такой страницы</h1>
      <Link to="/">В каталог</Link>
    </>
  );
}
