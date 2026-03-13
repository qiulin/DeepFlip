
import React, { useEffect, useRef, useCallback } from 'react';
import type { FoliateView } from '@/types/view';
import type { BookDoc, TOCItem } from '@/libs/document';
import type { ViewSettings, PageInfo, TimeInfo } from '@/types/book';
import { useReaderStore } from '@/store/readerStore';

interface FoliateViewerProps {
  bookKey: string;
  bookDoc: BookDoc;
  lastLocation?: string;
  viewSettings: ViewSettings;
  viewerKey: string;
  /** Optional handler forwarded into each loaded content document for keyboard events */
  onContentKeyDown?: (e: KeyboardEvent) => void;
}

// Register the foliate-view custom element if not already registered
async function ensureFoliateViewRegistered() {
  if (!customElements.get('foliate-view')) {
    await import('foliate-js/view.js');
  }
}

// Build the CSS renderer attributes from ViewSettings
function buildRendererAttrs(settings: ViewSettings): Record<string, string> {
  return {
    'flow': settings.scrolled ? 'scrolled' : 'paginated',
    'gap': String(settings.gapPercent / 100),
    'max-column-count': String(settings.maxColumnCount),
    'max-inline-size': String(settings.maxInlineSize),
    'max-block-size': String(settings.maxBlockSize),
    'margin-top': String(settings.marginTopPx),
    'margin-bottom': String(settings.marginBottomPx),
    'margin-left': String(settings.marginLeftPx),
    'margin-right': String(settings.marginRightPx),
  };
}

// Build the user stylesheet from ViewSettings
function buildUserStylesheet(settings: ViewSettings): string {
  const styles: string[] = [];
  if (settings.overrideFont) {
    styles.push(`* { font-family: ${settings.defaultFont}, serif !important; }`);
  }
  if (settings.lineHeight !== 1.5) {
    styles.push(`body { line-height: ${settings.lineHeight} !important; }`);
  }
  if (settings.letterSpacing !== 0) {
    styles.push(`body { letter-spacing: ${settings.letterSpacing}em !important; }`);
  }
  if (settings.wordSpacing !== 0) {
    styles.push(`body { word-spacing: ${settings.wordSpacing}em !important; }`);
  }
  if (settings.fullJustification) {
    styles.push(`body { text-align: justify !important; }`);
  }
  return styles.join('\n');
}

const FoliateViewer: React.FC<FoliateViewerProps> = ({
  bookKey,
  bookDoc,
  lastLocation,
  viewSettings,
  viewerKey,
  onContentKeyDown,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<FoliateView | null>(null);
  // Keep a ref so the load handler always sees the latest callback
  const onContentKeyDownRef = useRef(onContentKeyDown);
  useEffect(() => { onContentKeyDownRef.current = onContentKeyDown; }, [onContentKeyDown]);

  const { setView, setViewInited, setIsLoading, setProgress } = useReaderStore();

  const handleRelocate = useCallback(
    (event: Event) => {
      const e = event as CustomEvent;
      const { cfi, location, section, pageinfo, time } = e.detail ?? {};
      if (!viewRef.current) return;

      const tocItems: TOCItem[] = (bookDoc.toc as TOCItem[] | undefined) ?? [];
      const findTOCItem = (items: TOCItem[], href: string): TOCItem | null => {
        for (const item of items) {
          if (item.href && href.startsWith(item.href)) return item;
          if (item.subitems) {
            const found = findTOCItem(item.subitems, href);
            if (found) return found;
          }
        }
        return null;
      };

      const tocItem = location?.href ? findTOCItem(tocItems, location.href) : null;

      const sectionInfo: PageInfo = {
        current: section?.current ?? 0,
        total: section?.total ?? 1,
      };
      const pageinfoData: PageInfo = {
        current: pageinfo?.current ?? 0,
        next: pageinfo?.next,
        total: pageinfo?.total ?? 1,
      };
      const timeinfoData: TimeInfo = {
        section: time?.section ?? 0,
        total: time?.total ?? 0,
      };

      // Get range from CFI for annotation support
      let range: Range = document.createRange();
      try {
        const resolved = viewRef.current.resolveCFI(cfi);
        const contents = viewRef.current.renderer.getContents();
        for (const { doc, index } of contents) {
          if (index === resolved.index) {
            range = resolved.anchor(doc);
            break;
          }
        }
      } catch {
        // Ignore range resolution errors (e.g. on first load before CFI is set)
      }

      setProgress(bookKey, cfi ?? '', tocItem, sectionInfo, pageinfoData, timeinfoData, range);
    },
    [bookKey, bookDoc, setProgress],
  );

  useEffect(() => {
    let mounted = true;
    let view: FoliateView | null = null;

    const initView = async () => {
      if (!containerRef.current) return;
      await ensureFoliateViewRegistered();
      if (!mounted) return;

      // Create foliate-view element
      view = document.createElement('foliate-view') as FoliateView;
      view.style.width = '100%';
      view.style.height = '100%';
      view.style.display = 'block';

      // Apply renderer attributes
      const attrs = buildRendererAttrs(viewSettings);
      for (const [key, value] of Object.entries(attrs)) {
        view.setAttribute(key, value);
      }

      containerRef.current.appendChild(view);
      viewRef.current = view;

      // Listen to relocate events (position changes)
      view.addEventListener('relocate', handleRelocate);

      // When a section document is loaded, forward keyboard events to the outer handler.
      // This is necessary because foliate-js renders content in shadow-DOM iframes
      // whose keyboard events do NOT bubble to the main document.
      view.addEventListener('load', (evt: Event) => {
        if (!mounted) return;
        setViewInited(bookKey, true);
        setIsLoading(bookKey, false);

        // Attach keyboard listener to the inner content document
        const detail = (evt as CustomEvent).detail as { doc?: Document } | undefined;
        const doc = detail?.doc;
        if (doc) {
          doc.addEventListener('keydown', (e: KeyboardEvent) => {
            onContentKeyDownRef.current?.(e);
          });
        }
      });

      // Open the book document
      try {
        await view.open(bookDoc);
        if (!mounted) return;

        // Always call init() — with the saved location when available, or from
        // the beginning for a new book.  Without this call the renderer never
        // navigates to the first page and the reading area stays blank.
        await view.init(lastLocation ? { lastLocation } : {});

        // Apply user-defined styles
        const css = buildUserStylesheet(viewSettings);
        if (css && view.renderer.setStyles) {
          view.renderer.setStyles(css);
        }

        setView(bookKey, view);
        setIsLoading(bookKey, false);
      } catch (err) {
        console.error('Failed to open book in foliate viewer:', err);
      }
    };

    initView();

    return () => {
      mounted = false;
      if (view) {
        view.removeEventListener('relocate', handleRelocate);
        try {
          view.close();
        } catch {
          // ignore cleanup errors
        }
        view.remove();
        viewRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerKey]); // Re-initialize only when the viewerKey changes (book/settings recreate)

  return (
    <div
      ref={containerRef}
      className="foliate-viewer-container"
      style={{ width: '100%', height: '100%', overflow: 'hidden', display: 'block' }}
    />
  );
};

export default FoliateViewer;
