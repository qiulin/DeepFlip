import { create } from 'zustand';
import type { Book } from '@/types/book';

interface LibraryStore {
  library: Book[];
  isLoading: boolean;
  setLibrary: (books: Book[]) => void;
  addBook: (book: Book) => void;
  updateBook: (hash: string, updates: Partial<Book>) => void;
  removeBook: (hash: string) => void;
  setLoading: (loading: boolean) => void;
}

export const useLibraryStore = create<LibraryStore>((set) => ({
  library: [],
  isLoading: false,
  setLibrary: (library) => set({ library }),
  addBook: (book) =>
    set((state) => ({
      library: state.library.some((b) => b.hash === book.hash)
        ? state.library
        : [book, ...state.library],
    })),
  updateBook: (hash, updates) =>
    set((state) => ({
      library: state.library.map((b) => (b.hash === hash ? { ...b, ...updates } : b)),
    })),
  removeBook: (hash) =>
    set((state) => ({
      library: state.library.filter((b) => b.hash !== hash),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}));
