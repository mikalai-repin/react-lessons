import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type CartState = { items: number[]; add: (id: number) => void };

export const useCart = create<CartState>()(
  persist((set) => ({ items: [], add: (id) => set((s) => ({ items: [...s.items, id] })) }), { name: 'cart' }),
);
