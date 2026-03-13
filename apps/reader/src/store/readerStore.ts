import { create } from 'zustand';
import { nanoid } from 'nanoid';
import type { BookProgress, BookConfig, PageInfo, TimeInfo, ViewSettings } from '@/types/book';
import type { FoliateView } from '@/types/view';
import type { TOCItem } from '@/libs/document';
import { useBookDataStore } from './bookDataStore';
import { useLibraryStore } from './libraryStore';
import { useSettingsStore } from './settingsStore';

export interface ViewState {
  key: string;
  view: FoliateView | null;
  viewerKey: string;
  isPrimary: boolean;
  loading: boolean;
  inited: boolean;
  error: string | null;
  progress: BookProgress | null;
  ribbonVisible: boolean;
  viewSettings: ViewSettings | null;
}

interface ReaderStore {
  viewStates: Record<string, ViewState>;
  bookKeys: string[];
  hoveredBookKey: string | null;

  setBookKeys: (keys: string[]) => void;
  setHoveredBookKey: (key: string | null) => void;

  getView: (key: string | null) => FoliateView | null;
  setView: (key: string, view: FoliateView) => void;
  getViews: () => FoliateView[];

  clearViewState: (key: string) => void;
  getViewState: (key: string) => ViewState | null;

  setViewInited: (key: string, inited: boolean) => void;
  setIsLoading: (key: string, loading: boolean) => void;

  getViewSettings: (key: string) => ViewSettings | null;
  setViewSettings: (key: string, viewSettings: ViewSettings) => void;

  getProgress: (key: string) => BookProgress | null;
  setProgress: (
    key: string,
    location: string,
    tocItem: TOCItem | null,
    section: PageInfo,
    pageinfo: PageInfo,
    timeinfo: TimeInfo,
    range: Range,
  ) => void;

  setBookmarkRibbonVisibility: (key: string, visible: boolean) => void;

  initViewState: (id: string, key: string, isPrimary?: boolean) => Promise<void>;
  recreateViewer: (key: string) => void;
}

export const useReaderStore = create<ReaderStore>((set, get) => ({
  viewStates: {},
  bookKeys: [],
  hoveredBookKey: null,

  setBookKeys: (keys) => set({ bookKeys: keys }),
  setHoveredBookKey: (key) => set({ hoveredBookKey: key }),

  getView: (key) => (key ? get().viewStates[key]?.view ?? null : null),
  setView: (key, view) =>
    set((state) => ({
      viewStates: { ...state.viewStates, [key]: { ...state.viewStates[key]!, view } },
    })),
  getViews: () => Object.values(get().viewStates).map((s) => s.view!).filter(Boolean),

  clearViewState: (key) =>
    set((state) => {
      const viewStates = { ...state.viewStates };
      delete viewStates[key];
      return { viewStates };
    }),
  getViewState: (key) => get().viewStates[key] ?? null,

  setViewInited: (key, inited) =>
    set((state) => ({
      viewStates: { ...state.viewStates, [key]: { ...state.viewStates[key]!, inited } },
    })),
  setIsLoading: (key, loading) =>
    set((state) => ({
      viewStates: { ...state.viewStates, [key]: { ...state.viewStates[key]!, loading } },
    })),

  getViewSettings: (key) => get().viewStates[key]?.viewSettings ?? null,
  setViewSettings: (key, viewSettings) => {
    if (!key) return;
    const id = key.split('-')[0]!;
    const bookData = useBookDataStore.getState().booksData[id];
    const viewState = get().viewStates[key];
    if (!viewState || !bookData) return;
    if (viewState.isPrimary) {
      useBookDataStore.getState().updateBookConfig(id, { viewSettings });
    }
    set((state) => ({
      viewStates: { ...state.viewStates, [key]: { ...state.viewStates[key]!, viewSettings } },
    }));
  },

  getProgress: (key) => get().viewStates[key]?.progress ?? null,
  setProgress: (key, location, tocItem, section, pageinfo, timeinfo, range) =>
    set((state) => {
      const id = key.split('-')[0]!;
      const bookData = useBookDataStore.getState().booksData[id];
      const viewState = state.viewStates[key];
      if (!viewState || !bookData) return state;

      const pageInfo = bookData.isFixedLayout ? section : pageinfo;
      const progress: [number, number] = [pageInfo.current + 1, pageInfo.total];
      const progressPct = Math.round((progress[0] / progress[1]) * 100);

      // Update library book progress
      const { library, updateBook } = useLibraryStore.getState();
      const existingBook = library.find((b) => b.hash === id);
      if (existingBook) {
        let newStatus = existingBook.readingStatus;
        if (existingBook.readingStatus === 'unread') newStatus = undefined;
        if (progressPct >= 100 && existingBook.readingStatus !== 'finished') newStatus = 'finished';
        updateBook(id, { progress, readingStatus: newStatus, updatedAt: Date.now() });
      }

      // Update config location
      if (viewState.isPrimary) {
        useBookDataStore.getState().updateBookConfig(id, { progress, location });
      }

      return {
        viewStates: {
          ...state.viewStates,
          [key]: {
            ...viewState,
            progress: {
              location,
              sectionHref: tocItem?.href ?? '',
              sectionLabel: tocItem?.label ?? '',
              section,
              pageinfo,
              timeinfo,
              index: section.current,
              range,
              page: pageInfo.current + 1,
            } as BookProgress,
          },
        },
      };
    }),

  setBookmarkRibbonVisibility: (key, visible) =>
    set((state) => ({
      viewStates: {
        ...state.viewStates,
        [key]: { ...state.viewStates[key]!, ribbonVisible: visible },
      },
    })),

  initViewState: async (id, key, isPrimary = true) => {
    set((state) => ({
      viewStates: {
        ...state.viewStates,
        [key]: {
          key: '',
          view: null,
          viewerKey: '',
          isPrimary: false,
          loading: true,
          inited: false,
          error: null,
          progress: null,
          ribbonVisible: false,
          viewSettings: null,
        },
      },
    }));

    try {
      const { getWebAppService } = await import('@/services/webAppService');
      const appService = await getWebAppService();
      const { settings } = useSettingsStore.getState();
      const { library } = useLibraryStore.getState();
      const book = library.find((b) => b.hash === id);
      if (!book) throw new Error('Book not found in library');

      const booksData = useBookDataStore.getState().booksData;
      let bookData = booksData[id];
      let bookDoc = bookData?.bookDoc;
      let file = bookData?.file;

      if (!bookDoc || !file) {
        const content = await appService.loadBookContent(book);
        file = content.file;
        const { DocumentLoader } = await import('@/libs/document');
        const { FIXED_LAYOUT_FORMATS: FLF } = await import('@/types/book');
        const { book: doc, format } = await new DocumentLoader(file).open();
        bookDoc = doc;
        const isFixedLayout =
          (doc.rendition?.layout === 'pre-paginated') || FLF.has(format);
        const config = await appService.loadBookConfig(book);
        useBookDataStore.getState().setBookData(id, {
          id,
          book,
          file,
          config,
          bookDoc: doc,
          isFixedLayout,
        });
        bookData = useBookDataStore.getState().booksData[id]!;
      }

      const configViewSettings = bookData.config.viewSettings ?? {};
      const globalViewSettings = settings.globalViewSettings;
      const mergedSettings = {
        ...appService.getDefaultViewSettings(),
        ...globalViewSettings,
        ...configViewSettings,
      } as ViewSettings;

      set((state) => ({
        viewStates: {
          ...state.viewStates,
          [key]: {
            key,
            view: null,
            viewerKey: `${key}-${nanoid(6)}`,
            isPrimary,
            loading: false,
            inited: false,
            error: null,
            progress: null,
            ribbonVisible: false,
            viewSettings: mergedSettings,
          },
        },
      }));
    } catch (error) {
      console.error('initViewState error:', error);
      set((state) => ({
        viewStates: {
          ...state.viewStates,
          [key]: {
            key: '',
            view: null,
            viewerKey: '',
            isPrimary: false,
            loading: false,
            inited: false,
            error: error instanceof Error ? error.message : 'Failed to load book',
            progress: null,
            ribbonVisible: false,
            viewSettings: null,
          },
        },
      }));
    }
  },

  recreateViewer: (key) => {
    const id = key.split('-')[0]!;
    get()
      .initViewState(id, key, true)
      .then(() => {
        set((state) => ({
          viewStates: {
            ...state.viewStates,
            [key]: {
              ...state.viewStates[key]!,
              viewerKey: `${key}-${nanoid(6)}`,
            },
          },
        }));
      });
  },
}));
