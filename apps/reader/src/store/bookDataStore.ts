import { create } from 'zustand';
import type { BookConfig, ViewSettings } from '@/types/book';
import type { BookDoc } from '@/libs/document';

export interface BookData {
  id: string;
  book: import('@/types/book').Book;
  file: File;
  config: BookConfig;
  bookDoc: BookDoc;
  isFixedLayout: boolean;
}

interface BookDataStore {
  booksData: Record<string, BookData>;
  setBookData: (id: string, data: BookData) => void;
  updateBookConfig: (id: string, config: Partial<BookConfig>) => void;
  clearBookData: (id: string) => void;
}

export const useBookDataStore = create<BookDataStore>((set) => ({
  booksData: {},
  setBookData: (id, data) =>
    set((state) => ({ booksData: { ...state.booksData, [id]: data } })),
  updateBookConfig: (id, configUpdate) =>
    set((state) => {
      const existing = state.booksData[id];
      if (!existing) return state;
      return {
        booksData: {
          ...state.booksData,
          [id]: {
            ...existing,
            config: { ...existing.config, ...configUpdate, updatedAt: Date.now() },
          },
        },
      };
    }),
  clearBookData: (id) =>
    set((state) => {
      const booksData = { ...state.booksData };
      delete booksData[id];
      return { booksData };
    }),
}));
