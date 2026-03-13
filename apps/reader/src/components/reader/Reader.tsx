
import React, { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useReaderStore } from '@/store/readerStore';
import { useBookDataStore } from '@/store/bookDataStore';
import { useLibraryStore } from '@/store/libraryStore';
import { commandRegistry, CORE_COMMANDS } from '@/services/commandRegistry';
import type { CommandContext } from '@/services/commandRegistry';
import FoliateViewer from './FoliateViewer';

interface ReaderProps {
  bookId: string;
}

const Reader: React.FC<ReaderProps> = ({ bookId }) => {
  const navigate = useNavigate();
  const bookKey = `${bookId}-primary`;
  const [showTOC, setShowTOC] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const keyHandlerRef = useRef<((e: KeyboardEvent) => void) | null>(null);

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

  // Register keyboard commands
  useEffect(() => {
    const ctx: CommandContext = { bookKey };

    // Register core commands
    const disposers = [
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.NAVIGATE_NEXT,
        label: 'Next Page',
        category: 'navigation',
        shortcut: 'arrowright',
        handler: () => getView(bookKey)?.next(),
      }),
      commandRegistry.registerCommand({
        id: CORE_COMMANDS.NAVIGATE_PREV,
        label: 'Previous Page',
        category: 'navigation',
        shortcut: 'arrowleft',
        handler: () => getView(bookKey)?.prev(),
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

    const keyHandler = (e: KeyboardEvent) => {
      commandRegistry.handleKeyboardShortcut(e, ctx);
    };
    document.addEventListener('keydown', keyHandler);
    keyHandlerRef.current = keyHandler;

    return () => {
      document.removeEventListener('keydown', keyHandler);
      for (const dispose of disposers) dispose();
    };
  }, [bookKey, getView]);

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
        <p className="text-gray-500">Book not found</p>
      </div>
    );
  }

  if (viewState?.loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <span className="loading loading-spinner loading-lg"></span>
        <p className="ml-4 text-gray-500">Loading {book.title}…</p>
      </div>
    );
  }

  if (viewState?.error) {
    return (
      <div className="flex items-center justify-center h-screen flex-col gap-4">
        <p className="text-error text-lg">Failed to load book</p>
        <p className="text-gray-400 text-sm">{viewState.error}</p>
        <button className="btn btn-primary" onClick={() => navigate({ to: '/library' })}>
          Back to Library
        </button>
      </div>
    );
  }

  const toc = bookData?.bookDoc?.toc ?? [];

  return (
    <div className="reader-page flex flex-col h-screen bg-base-100">
      {/* Header */}
      <div className="reader-header flex items-center justify-between px-4 py-2 bg-base-200 border-b border-base-300 z-10">
        <div className="flex items-center gap-2">
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => navigate({ to: '/library' })}
            title="Back to Library"
          >
            ←
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowTOC((v) => !v)}
            title="Table of Contents (Ctrl+T)"
          >
            ≡
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowSearch((v) => !v)}
            title="Search (Ctrl+F)"
          >
            🔍
          </button>
        </div>
        <div className="text-center flex-1 truncate">
          <span className="font-semibold text-sm truncate">{book.title}</span>
          {book.author && <span className="text-gray-400 text-xs ml-2">{book.author}</span>}
        </div>
        <div className="text-xs text-gray-400 tabular-nums">
          {progress && `${progress.page} / ${progress.pageinfo.total}`}
        </div>
      </div>

      <div className="reader-body flex flex-1 overflow-hidden">
        {/* TOC Sidebar */}
        {showTOC && (
          <div className="toc-sidebar w-64 bg-base-200 border-r border-base-300 overflow-y-auto flex-shrink-0">
            <div className="p-3 border-b border-base-300 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Contents</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowTOC(false)}>
                ✕
              </button>
            </div>
            <TOCList items={toc} onItemClick={handleTOCItemClick} />
          </div>
        )}

        {/* Book Content */}
        <div className="reader-content flex-1 relative">
          {viewState?.viewerKey && bookData?.bookDoc && viewSettings && (
            <FoliateViewer
              key={viewState.viewerKey}
              bookKey={bookKey}
              bookDoc={bookData.bookDoc}
              lastLocation={bookData.config.location}
              viewSettings={viewSettings}
              viewerKey={viewState.viewerKey}
            />
          )}
        </div>

        {/* Search Panel */}
        {showSearch && (
          <div className="search-panel w-72 bg-base-200 border-l border-base-300 flex-shrink-0">
            <div className="p-3 border-b border-base-300 flex items-center justify-between">
              <h3 className="font-semibold text-sm">Search</h3>
              <button className="btn btn-ghost btn-xs" onClick={() => setShowSearch(false)}>
                ✕
              </button>
            </div>
            <div className="p-3">
              <input
                type="text"
                className="input input-bordered input-sm w-full"
                placeholder="Search in book…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    const view = getView(bookKey);
                    if (view) {
                      void view.search({ scope: 'book', matchCase: false, matchWholeWords: false, query: searchQuery });
                    }
                  }
                  if (e.key === 'Escape') setShowSearch(false);
                }}
                autoFocus
              />
              <p className="text-xs text-gray-400 mt-2">Press Enter to search</p>
            </div>
          </div>
        )}
      </div>

      {/* Footer progress bar */}
      {progress && (
        <div className="reader-footer px-4 py-1 bg-base-200 border-t border-base-300">
          <progress
            className="progress progress-primary w-full h-1"
            value={progress.page}
            max={progress.pageinfo.total}
          />
        </div>
      )}
    </div>
  );
};

// TOC list component
interface TOCItemProps {
  items: import('@/libs/document').TOCItem[];
  onItemClick: (href: string) => void;
  depth?: number;
}

const TOCList: React.FC<TOCItemProps> = ({ items, onItemClick, depth = 0 }) => {
  if (!items.length) return <p className="p-3 text-sm text-gray-400">No table of contents</p>;
  return (
    <ul className="menu menu-xs">
      {items.map((item, i) => (
        <li key={i}>
          <button
            className={`text-left text-sm py-1 hover:bg-base-300 rounded px-2 w-full ${depth > 0 ? 'pl-' + (depth * 4 + 2) : ''}`}
            onClick={() => onItemClick(item.href)}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            {item.label}
          </button>
          {item.subitems && item.subitems.length > 0 && (
            <TOCList items={item.subitems as import('@/libs/document').TOCItem[]} onItemClick={onItemClick} depth={depth + 1} />
          )}
        </li>
      ))}
    </ul>
  );
};

export default Reader;
