
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useLibraryStore } from '@/store/libraryStore';
import { commandRegistry, CORE_COMMANDS } from '@/services/commandRegistry';
import type { CommandContext } from '@/services/commandRegistry';
import FoliateViewer from './FoliateViewer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Loader2 } from 'lucide-react';

interface ReaderProps {
  bookId: string;
}

const Reader: React.FC<ReaderProps> = ({ bookId }) => {
  const navigate = useNavigate();
  const bookKey = `${bookId}-primary`;
  const [showTOC, setShowTOC] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Track whether the navigation overlays should be visible
  const [showNavHint, setShowNavHint] = useState(false);
  const navHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { library } = useLibraryStore();
  const { booksData } = useBookDataStore();
  const {
    viewStates,
    bookKeys,
    setBookKeys,
    initViewState,
    getView,
    getProgress,
    getViewSettings,
  } = useReaderStore();

  const book = library.find((b) => b.hash === bookId);
  const bookData = booksData[bookId];
  const viewState = viewStates[bookKey];
  const progress = getProgress(bookKey);
  const viewSettings = getViewSettings(bookKey);

  // Initialize view state
  useEffect(() => {
    if (!book) {
      navigate({ to: '/library' });
      return;
    }
    if (!bookKeys.includes(bookKey)) {
      setBookKeys([...bookKeys, bookKey]);
    }
    initViewState(bookId, bookKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId]);

  // ------------------------------------------------------------------
  // Navigation helpers — used by both keyboard shortcuts and click zones
  // ------------------------------------------------------------------
  const goToPrev = useCallback(() => {
    getView(bookKey)?.prev();
  }, [bookKey, getView]);

  const goToNext = useCallback(() => {
    getView(bookKey)?.next();
  }, [bookKey, getView]);

  // ------------------------------------------------------------------
  // Register keyboard commands via CommandRegistry
  // ------------------------------------------------------------------
  useEffect(() => {
    const ctx: CommandContext = { bookKey };

    const disposers = [
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.NAVIGATE_NEXT,
        label: 'Next Page',
        category: 'navigation',
        shortcut: 'arrowright',
        handler: goToNext,
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.NAVIGATE_PREV,
        label: 'Previous Page',
        category: 'navigation',
        shortcut: 'arrowleft',
        handler: goToPrev,
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.NAVIGATE_NEXT,
        label: 'Next Page (Space)',
        category: 'navigation',
        shortcut: ' ',
        handler: goToNext,
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.TOGGLE_TOC,
        label: 'Toggle Table of Contents',
        category: 'view',
        shortcut: 'ctrl+t',
        handler: () => setShowTOC((v) => !v),
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.TOGGLE_SEARCH,
        label: 'Toggle Search',
        category: 'view',
        shortcut: 'ctrl+f',
        handler: () => setShowSearch((v) => !v),
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.NAVIGATE_NEXT_SECTION,
        label: 'Next Section',
        category: 'navigation',
        shortcut: 'ctrl+arrowright',
        handler: () => getView(bookKey)?.renderer?.nextSection?.(),
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.NAVIGATE_PREV_SECTION,
        label: 'Previous Section',
        category: 'navigation',
        shortcut: 'ctrl+arrowleft',
        handler: () => getView(bookKey)?.renderer?.prevSection?.(),
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.HISTORY_BACK,
        label: 'History Back',
        category: 'navigation',
        shortcut: 'alt+arrowleft',
        handler: () => {
          const v = getView(bookKey);
          if (v?.history.canGoBack) v.history.back();
        },
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.HISTORY_FORWARD,
        label: 'History Forward',
        category: 'navigation',
        shortcut: 'alt+arrowright',
        handler: () => {
          const v = getView(bookKey);
          if (v?.history.canGoForward) v.history.forward();
        },
      }),
    ];

    // Outer document keyboard handler (catches keys when focus is outside the view)
    const outerKeyHandler = (e: KeyboardEvent) => {
      commandRegistry.handleKeyboardShortcut(e, ctx);
    };
    document.addEventListener('keydown', outerKeyHandler);

    return () => {
      document.removeEventListener('keydown', outerKeyHandler);
      for (const dispose of disposers) dispose();
    };
  }, [bookKey, getView, goToNext, goToPrev]);

  // ------------------------------------------------------------------
  // Key handler forwarded into the book content document (inner iframe)
  // ------------------------------------------------------------------
  const handleContentKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const ctx: CommandContext = { bookKey };
      commandRegistry.handleKeyboardShortcut(e, ctx);
    },
    [bookKey],
  );

  // ------------------------------------------------------------------
  // Click-to-navigate: clicking the left quarter turns the page back;
  // clicking the right quarter turns it forward.
  // ------------------------------------------------------------------
  const handleReaderAreaClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement;
      if (target.closest('.toc-sidebar, .search-panel, .nav-btn')) return;

      const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
      const relX = e.clientX - rect.left;
      const zoneWidth = rect.width * 0.25;

      if (relX < zoneWidth) {
        goToPrev();
      } else if (relX > rect.width - zoneWidth) {
        goToNext();
      }
    },
    [goToPrev, goToNext],
  );

  // Show navigation hints briefly on mouse move
  const handleMouseMove = useCallback(() => {
    setShowNavHint(true);
    if (navHintTimerRef.current) clearTimeout(navHintTimerRef.current);
    navHintTimerRef.current = setTimeout(() => setShowNavHint(false), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (navHintTimerRef.current) clearTimeout(navHintTimerRef.current);
    };
  }, []);

  const handleTOCItemClick = useCallback(
    (href: string) => {
      getView(bookKey)?.goTo(href);
      setShowTOC(false);
    },
    [bookKey, getView],
  );

  if (!book) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Book not found</p>
      </div>
    );
  }

  if (viewState?.loading) {
    return (
      <div className="flex items-center justify-center h-screen gap-3">
        <Loader2 className="animate-spin h-6 w-6 text-muted-foreground" />
        <p className="text-muted-foreground">Loading {book.title}…</p>
      </div>
    );
  }

  if (viewState?.error) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <p className="text-destructive text-lg">Failed to load book</p>
        <p className="text-muted-foreground text-sm">{viewState.error}</p>
        <Button onClick={() => navigate({ to: '/library' })}>Back to Library</Button>
      </div>
    );
  }

  const toc = bookData?.bookDoc?.toc ?? [];
  const progressVal =
    progress && progress.pageinfo.total > 0 ? progress.page : 0;
  const progressMax =
    progress && progress.pageinfo.total > 0 ? progress.pageinfo.total : 100;
  const progressPct =
    progress && progress.pageinfo.total > 0
      ? Math.round((progress.page / progress.pageinfo.total) * 100)
      : null;

  return (
    <div className="reader-page flex flex-col h-screen bg-background">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="reader-header flex items-center justify-between px-4 py-2 bg-card border-b border-border z-10">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={() => navigate({ to: '/library' })} title="Back to Library">
            ← Back
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowTOC((v) => !v)} title="Table of Contents (Ctrl+T)">
            ≡ Contents
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowSearch((v) => !v)} title="Search (Ctrl+F)">
            🔍
          </Button>
        </div>

        <div className="text-center flex-1 truncate px-4">
          <span className="font-semibold text-sm truncate">{book.title}</span>
          {book.author && <span className="text-muted-foreground text-xs ml-2">{book.author}</span>}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
          {progress && (
            <span>
              {progress.page} / {progress.pageinfo.total}
              {progressPct !== null && ` (${progressPct}%)`}
            </span>
          )}
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className="reader-body flex flex-1 overflow-hidden">
        {/* TOC Sidebar */}
        {showTOC && (
          <div className="toc-sidebar w-64 bg-card border-r border-border overflow-y-auto flex-shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Contents</h3>
              <Button variant="ghost" size="xs" onClick={() => setShowTOC(false)}>✕</Button>
            </div>
            <TOCList items={toc} onItemClick={handleTOCItemClick} />
          </div>
        )}

        {/* ── Reading area ──────────────────────────────────────── */}
        <div
          className="reader-content flex-1 relative select-none"
          onClick={handleReaderAreaClick}
          onMouseMove={handleMouseMove}
        >
          {viewState?.viewerKey && bookData?.bookDoc && viewSettings && (
            <FoliateViewer
              key={viewState.viewerKey}
              bookKey={bookKey}
              bookDoc={bookData.bookDoc}
              lastLocation={bookData.config.location}
              viewSettings={viewSettings}
              viewerKey={viewState.viewerKey}
              onContentKeyDown={handleContentKeyDown}
            />
          )}

          {/* Prev page button — left edge overlay */}
          <button
            className={`nav-btn absolute left-0 top-0 h-full w-12 flex items-center justify-center
              text-2xl text-white bg-transparent transition-opacity duration-300 z-10
              hover:bg-black/10 focus:outline-none
              ${showNavHint ? 'opacity-60' : 'opacity-0'}`}
            style={{ cursor: 'w-resize' }}
            onClick={(e) => { e.stopPropagation(); goToPrev(); }}
            aria-label="Previous page"
            title="Previous page (← or click)"
          >
            ‹
          </button>

          {/* Next page button — right edge overlay */}
          <button
            className={`nav-btn absolute right-0 top-0 h-full w-12 flex items-center justify-center
              text-2xl text-white bg-transparent transition-opacity duration-300 z-10
              hover:bg-black/10 focus:outline-none
              ${showNavHint ? 'opacity-60' : 'opacity-0'}`}
            style={{ cursor: 'e-resize' }}
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            aria-label="Next page"
            title="Next page (→ or click)"
          >
            ›
          </button>
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="search-panel w-72 bg-card border-l border-border flex-shrink-0">
            <div className="p-3 border-b border-border flex items-center justify-between">
              <h3 className="font-semibold text-sm">Search</h3>
              <Button variant="ghost" size="xs" onClick={() => setShowSearch(false)}>✕</Button>
            </div>
            <div className="p-3 space-y-2">
              <Input
                placeholder="Search in book…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    const view = getView(bookKey);
                    if (view) {
                      void view.search({
                        scope: 'book',
                        matchCase: false,
                        matchWholeWords: false,
                        query: searchQuery,
                      });
                    }
                  }
                  if (e.key === 'Escape') setShowSearch(false);
                }}
                autoFocus
                className="h-8 text-sm"
              />
              <p className="text-xs text-muted-foreground">Press Enter to search</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Footer progress bar ─────────────────────────────────── */}
      {progress && (
        <div className="reader-footer px-4 py-1 bg-card border-t border-border flex items-center gap-3">
          <Button
            variant="ghost"
            size="xs"
            className="font-bold text-base leading-none"
            onClick={goToPrev}
            title="Previous page (←)"
            aria-label="Previous page"
          >
            ‹
          </Button>
          <div
            className="flex-1 cursor-pointer"
            title="Click to jump to position"
            onClick={(e) => {
              const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
              const frac = (e.clientX - rect.left) / rect.width;
              getView(bookKey)?.goToFraction(frac);
            }}
          >
            <Progress value={progressVal} max={progressMax} className="h-1.5" />
          </div>
          <Button
            variant="ghost"
            size="xs"
            className="font-bold text-base leading-none"
            onClick={goToNext}
            title="Next page (→)"
            aria-label="Next page"
          >
            ›
          </Button>
        </div>
      )}
    </div>
  );
};

// ── TOC list component ──────────────────────────────────────────────
interface TOCItemProps {
  items: import('@/libs/document').TOCItem[];
  onItemClick: (href: string) => void;
  depth?: number;
}

const TOCList: React.FC<TOCItemProps> = ({ items, onItemClick, depth = 0 }) => {
  if (!items.length) return <p className="p-3 text-sm text-muted-foreground">No table of contents</p>;
  return (
    <ul className="py-1">
      {items.map((item, i) => (
        <li key={i}>
          <button
            className="text-left text-sm py-1.5 hover:bg-accent hover:text-accent-foreground rounded w-full px-3 transition-colors"
            onClick={() => onItemClick(item.href)}
            style={{ paddingLeft: `${depth * 12 + 12}px` }}
          >
            {item.label}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <TOCList
              items={item.subitems as import('@/libs/document').TOCItem[]}
              onItemClick={onItemClick}
              depth={depth + 1}
            />
          )}
        </li>
      ))}
    </ul>
  );
};

export default Reader;
