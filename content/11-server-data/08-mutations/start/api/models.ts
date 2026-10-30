/** Игра в каталоге — та же модель, что у учебного бэкенда (глава 11) */
export interface Game {
  id: number;
  slug: string;
  title: string;
  cover: string;
  price: number;
  oldPrice?: number;
  category:
    'family' | 'strategy' | 'party' | 'cooperative' | 'kids';
  players: { min: number; max: number };
  playTime: number;
  age: number;
  rating: number;
  inStock: number;
  description: string;
  tags: string[];
}

/** Отзыв об игре */
export interface Review {
  id: number;
  gameId: number;
  author: string;
  // Оценка от 1 до 5
  rating: number;
  text: string;
  // Дата в формате ISO: '2026-08-12'
  date: string;
}

/** Новый отзыв: что отправляет покупатель. Остальное заполнит сервер */
export type NewReview = Pick<Review, 'rating' | 'text'>;

/** Страница списка с сервера: часть элементов и сколько их всего */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

/** Что корзина помнит об игре: снимок на момент добавления.
 *  Каталог живёт на сервере — корзине не у кого спросить цену */
export type CartGame = Pick<
  Game,
  'id' | 'title' | 'price' | 'oldPrice' | 'inStock'
>;

/** Позиция корзины: какая игра и сколько штук */
export interface CartItem {
  game: CartGame;
  quantity: number;
}
