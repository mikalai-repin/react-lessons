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

/** Страница списка с сервера: GET /api/games */
export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
