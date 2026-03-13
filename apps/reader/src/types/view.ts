import type { BookNote, BookSearchConfig } from './book';

export const NOTE_PREFIX = 'foliate-note:';

type RangeAnchor = (doc: Document) => Range;

export interface FoliateView extends HTMLElement {
  open: (book: unknown) => Promise<void>;
  close: () => void;
  init: (options: { lastLocation: string }) => void;
  goTo: (href: string) => void;
  goToFraction: (fraction: number) => void;
  prev: (distance?: number) => void;
  next: (distance?: number) => void;
  goLeft: () => void;
  goRight: () => void;
  getCFI: (index: number, range: Range) => string;
  getCFIProgress: (cfi: string) => Promise<{
    fraction: number;
    section: { current: number; total: number };
    location: { current: number; next: number; total: number };
    time: { section: number; total: number };
  } | null>;
  resolveCFI: (cfi: string) => { index: number; anchor: RangeAnchor };
  addAnnotation: (note: BookNote & { value?: string }, remove?: boolean) => { index: number; label: string };
  search: (config: BookSearchConfig) => AsyncGenerator<unknown, void, void>;
  clearSearch: () => void;
  select: (target: string | number | { fraction: number }) => void;
  deselect: () => void;
  book: unknown;
  isFixedLayout: boolean;
  language: {
    locale?: unknown;
    isCJK?: boolean;
    canonical?: string;
    direction?: string;
  };
  history: {
    canGoBack: boolean;
    canGoForward: boolean;
    back: () => void;
    forward: () => void;
    clear: () => void;
  };
  renderer: {
    scrolled?: boolean;
    scrollLocked: boolean;
    size: number;
    viewSize: number;
    start: number;
    end: number;
    page: number;
    pages: number;
    atStart: boolean;
    atEnd: boolean;
    setAttribute: (name: string, value: string | number) => void;
    removeAttribute: (name: string) => void;
    next: () => Promise<void>;
    prev: () => Promise<void>;
    nextSection?: () => Promise<void>;
    prevSection?: () => Promise<void>;
    goTo?: (params: { index: number; anchor?: number | RangeAnchor }) => void;
    setStyles?: (css: string) => void;
    getContents: () => { doc: Document; index?: number; overlayer?: unknown }[];
    scrollToAnchor?: (anchor: number | Range, reason?: string, smooth?: boolean) => void;
    addEventListener: (type: string, listener: EventListener, option?: AddEventListenerOptions) => void;
    removeEventListener: (type: string, listener: EventListener) => void;
  };
}

// Wraps the foliate view to adapt BookNote to foliate annotation format
export const wrappedFoliateView = (originalView: FoliateView): FoliateView => {
  const originalAddAnnotation = originalView.addAnnotation.bind(originalView);
  originalView.addAnnotation = (note: BookNote, remove = false) => {
    const annotation = { value: note.cfi, ...note };
    return originalAddAnnotation(annotation, remove);
  };
  return originalView;
};
