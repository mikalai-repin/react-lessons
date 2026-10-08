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

/** Позиция корзины: какая игра и сколько штук */
export interface CartItem {
  gameId: number;
  quantity: number;
}
