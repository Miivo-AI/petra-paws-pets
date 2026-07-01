import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (serviceId: string) => void;
  clearCart: () => void;
  total: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) =>
        set((state) => {
          const exists = state.items.find(
            (i) => i.service.id === item.service.id
          );
          if (exists) {
            return {
              items: state.items.map((i) =>
                i.service.id === item.service.id ? item : i
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      removeItem: (serviceId) =>
        set((state) => ({
          items: state.items.filter((i) => i.service.id !== serviceId),
        })),

      clearCart: () => set({ items: [] }),

      total: () =>
        get().items.reduce((sum, item) => sum + item.service.price, 0),
    }),
    {
      name: "petra-paws-cart",
    }
  )
);
